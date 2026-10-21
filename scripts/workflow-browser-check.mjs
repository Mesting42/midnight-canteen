import {chromium} from 'playwright';
import {existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Engine,newGame,serialize,SAVE_KEY,clone} from '../src/engine.js';
import {beginTutorial} from '../src/tutorial.js';

const e=new Engine(newGame(42));beginTutorial(e.s);e.purchasePlan();e.open();e.spawn();e.s.run.schedule=[];
const c=e.s.run.customers[0],fixtures={};
const until=condition=>{for(let i=0;i<5000&&!condition();i++)e.tick(.01);assert.ok(condition());};
const finish=()=>until(()=>!e.actor().task&&!e.actor().queue.length);
const capture=(name,step,progress=.5,phase='work')=>{
  until(()=>{const t=e.actor().task;return t?.step===step&&t.phase===phase&&(phase==='walk'||t.progress/t.duration>=progress);});
  fixtures[name]=clone(e.s);fixtures[name].paused=true;
};
e.enqueue('greet',c.id);finish();until(()=>c.seated);
fixtures.arrow=clone(e.s);
const j=e.job(c.jobs[0]);e.enqueue('prep',j.id);capture('fetch','fetch');capture('chop','chop',.42);finish();
e.enqueue('heat',j.id);capture('transfer','pour',0,'walk');capture('pour','pour');finish();until(()=>j.stage==='needsPlate');
e.enqueue('plate',j.id);capture('scoop','scoop',.4);capture('plate-transfer','garnish',0,'walk');capture('garnish','garnish',.6);finish();
e.enqueue('serve',j.id);capture('delivery','deliver',0,'walk');finish();until(()=>c.status==='pay');
e.enqueue('pay',c.id);finish();e.enqueue('clean',c.table);capture('wipe','wipe');capture('wash','wash');finish();
const fry=new Engine(newGame(42));fry.s.day=2;beginTutorial(fry.s);fry.setMenu(['egg']);fry.purchasePlan();fry.open();fry.spawn();fry.s.run.schedule=[];
const fryUntil=condition=>{for(let i=0;i<5000&&!condition();i++)fry.tick(.01);assert.ok(condition());};
const fryWork=(kind,target)=>{assert.ok(fry.enqueue(kind,target));fryUntil(()=>!fry.actor().task&&!fry.actor().queue.length);};
const fc=fry.s.run.customers[0];fryWork('greet',fc.id);const fj=fry.job(fc.jobs[0]);fryWork('prep',fj.id);fry.enqueue('heat',fj.id);
fryUntil(()=>fry.actor().task?.step==='pour'&&fry.actor().task.phase==='work'&&fry.actor().task.progress/fry.actor().task.duration>.75);
fixtures.fry=clone(fry.s);fixtures.fry.paused=true;

const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
let page=await browser.newPage({viewport:{width:2048,height:990},deviceScaleFactor:1.5});
const errors=[],report={result:'PASS',scope:'Isolated saved workflow frames plus live tutorial-arrow motion; real clicking is covered by test:service.',frames:{}};
page.on('pageerror',error=>errors.push(error.message));
const url=`http://127.0.0.1:${process.env.PORT||4174}`;
async function show(state){
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:serialize(state)});
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/继续上次经营/}).click();
  await page.waitForFunction(()=>window.__canteenSnapshot().people.length>0);await page.waitForTimeout(100);
  return page.evaluate(()=>window.__canteenSnapshot());
}
try{
  await page.goto(url,{waitUntil:'networkidle'});
  for(const [name,state]of Object.entries(fixtures).filter(([name])=>name!=='arrow')){
    const s=await show(state),worker=s.people.find(p=>p.id==='chef');
    assert.equal(worker.action,state.run.actors[0].task.phase==='work'?state.run.actors[0].task.step:'carry');
    if(!['wipe','wash'].includes(name)){assert.equal(s.foods.length,1);assert.ok(s.mealProps[0].visible);assert.ok(s.mealProps[0].position.every(Number.isFinite));}
    if(['transfer','plate-transfer','delivery'].includes(name)){
      const distance=Math.hypot(...s.mealProps[0].position.map((v,i)=>v-worker.carry[i]));assert.ok(distance<.0001);
    }
    if(name==='fry'){assert.equal(s.cookware[0],'pan');assert.ok(worker.tools.includes('spatula'));}
    if(name==='chop')assert.equal(await page.locator('.tutorial-pointer').evaluate(p=>getComputedStyle(p).animationPlayState),'paused');
    report.frames[name]={action:worker.action,tools:worker.tools,food:s.mealProps[0],carry:worker.carry,drawer:s.drawer};
    await page.screenshot({path:`docs/workflow-${name}.png`});
    if(['chop','pour','garnish'].includes(name))await page.screenshot({path:`docs/workflow-${name}-detail.png`,clip:{x:690,y:90,width:740,height:410}});
    console.log(name,worker.action,worker.tools.join(','));
  }
  await show(fixtures.arrow);
  const pointer=page.locator('.tutorial-pointer');await pointer.waitFor({state:'visible'});
  const motion=await page.evaluate(async()=>{
    const p=document.querySelector('.tutorial-pointer'),ys=[];
    for(let i=0;i<6;i++){ys.push(p.getBoundingClientRect().y);await new Promise(resolve=>setTimeout(resolve,120));}
    return {ys,stroke:getComputedStyle(p.querySelector('path')).stroke,filter:getComputedStyle(p).filter};
  });
  assert.equal(motion.stroke,'none');assert.equal(motion.filter,'none');assert.ok(Math.max(...motion.ys)-Math.min(...motion.ys)>3);
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await pointer.evaluate(p=>getComputedStyle(p).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});report.arrow=motion;
  await page.close();page=await browser.newPage({viewport:{width:844,height:390},screen:{width:390,height:844},deviceScaleFactor:1.5,isMobile:true,hasTouch:true});
  page.on('pageerror',error=>errors.push(error.message));await page.goto(url,{waitUntil:'networkidle'});
  const mobile=await show(fixtures.chop);
  await page.screenshot({path:'docs/workflow-mobile-landscape.png'});
  assert.ok(await page.locator('#scene').isVisible());assert.equal(mobile.people.find(p=>p.id==='chef').action,'chop');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.setViewportSize({width:390,height:844});await page.locator('#orientation-gate').waitFor({state:'visible',timeout:5000});
  assert.deepEqual(errors,[]);writeFileSync('docs/workflow-browser-report.json',JSON.stringify(report,null,2));console.log('workflow browser check PASS');
}finally{await browser.close();}
