import {chromium} from 'playwright';
import {existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Engine,newGame,serialize,SAVE_KEY,GUEST_ENTRY} from '../src/engine.js';

const e=new Engine(newGame(42));e.s.day=6;e.purchasePlan();e.open();e.s.run.schedule=[];
for(let i=0;i<3;i++)e.spawn();
e.s.run.customers[0].type='student';e.s.run.customers[1].type='takeaway';e.tick(.04);
const [first,takeaway,couple]=e.s.run.customers;assert.equal(couple.type,'couple');
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const page=await browser.newPage({viewport:{width:1500,height:960}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const read=()=>page.evaluate(()=>window.__canteenSnapshot());
const wait=condition=>page.waitForFunction(condition,null,{timeout:45000});
try{
  await page.goto(`http://127.0.0.1:${process.env.PORT||4174}`,{waitUntil:'networkidle'});
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:serialize(e.s)});
  await page.reload();await page.getByRole('button',{name:/继续上次经营/}).click();
  await page.evaluate(()=>{
    window.entranceFrames=[];
    const record=()=>{const s=window.__canteenSnapshot();if(s.state.phase==='open')window.entranceFrames.push(s.state.run.customers.flatMap(c=>[{id:c.id,x:c.x,z:c.z,status:c.status,approachingMall:c.approachingMall},...(c.companion?[{id:`${c.id}:companion`,x:c.companion.x,z:c.companion.z,status:c.status,approachingMall:c.approachingMall}]:[])]));requestAnimationFrame(record);};record();
  });
  await wait(()=>{const guests=window.__canteenSnapshot().state.run.customers;return guests.length===3&&guests.every(c=>!c.approachingMall);});
  await page.waitForTimeout(250);await page.screenshot({path:'docs/entrance-queue.png'});
  await page.locator(`[data-guest="${first.id}"]`).click();
  await wait(()=>window.__canteenSnapshot().state.run.customers[0].status==='arriving'&&window.__canteenSnapshot().state.run.customers[0].z<4.3);
  await page.screenshot({path:'docs/entrance-through-door.png'});
  await wait(()=>window.__canteenSnapshot().state.run.customers[0].seated);
  await page.locator(`[data-guest="${takeaway.id}"]`).click();
  await wait(()=>window.__canteenSnapshot().state.run.customers[1].status==='waiting');
  const pickup=(await read()).state.run.customers[1];assert.equal(pickup.table,null);assert.ok(pickup.z>GUEST_ENTRY.boundaryZ);
  await page.locator(`[data-guest="${couple.id}"]`).click();
  await wait(()=>{const c=window.__canteenSnapshot().state.run.customers[2];return c.seated&&c.companion.seated;});
  await page.screenshot({path:'docs/entrance-seated-and-pickup.png'});
  const frames=await page.evaluate(()=>window.entranceFrames),crossed=new Set();
  for(let i=1;i<frames.length;i++)for(const p of frames[i]){
    if(p.status==='queue'&&!p.approachingMall)assert.ok(p.z>=GUEST_ENTRY.queueZ-.001&&Math.abs(p.x)<=.401);
    const old=frames[i-1].find(c=>c.id===p.id);if(!old||old.z===p.z)continue;
    for(const boundary of [GUEST_ENTRY.boundaryZ,3.98])if(old.z>=boundary&&p.z<boundary){
      const x=old.x+(p.x-old.x)*(boundary-old.z)/(p.z-old.z);assert.ok(Math.abs(x)<=GUEST_ENTRY.halfWidth,`side entry: ${p.id} at ${x}`);crossed.add(p.id);
    }
  }
  assert.ok(crossed.has(first.id));assert.ok(crossed.has(couple.id));assert.ok(crossed.has(`${couple.id}:companion`));assert.ok(!crossed.has(takeaway.id));assert.deepEqual(errors,[]);
  const report={result:'PASS',frames:frames.length,doorway:GUEST_ENTRY,crossed:[...crossed],takeaway:pickup,checks:['doorway-only queue','single guest entrance','couple entrances','queue advances outdoors','takeaway stays outside','actual rendered-frame crossing positions'],trajectories:frames};
  writeFileSync('docs/entrance-browser-report.json',JSON.stringify(report,null,2));
  console.log(`Entrance browser check PASS: ${frames.length} rendered frames, all 3 dining people crossed the real doorway; takeaway stayed outdoors.`);
}finally{await browser.close();}
