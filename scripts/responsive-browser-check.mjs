import {chromium} from 'playwright';
import {existsSync,mkdirSync,writeFileSync,readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Engine,newGame,serialize,SAVE_KEY,clone} from '../src/engine.js';
import {TUTORIAL_KEY,beginTutorial} from '../src/tutorial.js';
import {prepare,operate} from './verify-campaign.mjs';

const url='http://127.0.0.1:'+(process.env.PORT||4173);
const folder='docs/responsive-verified';mkdirSync(folder,{recursive:true});
const executablePath=process.env.BROWSER_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const sizes=[
  {id:'phone-small',width:568,height:320,touch:true,fullService:true},
  {id:'phone-standard',width:667,height:375,touch:true,tutorial:true},
  {id:'phone-wide',width:844,height:390,touch:true},
  {id:'phone-browser-bars',width:844,height:300,touch:true},
  {id:'phone-large',width:932,height:430,touch:true},
  {id:'phone-portrait',width:390,height:844,touch:true,gate:true},
  {id:'tablet-small',width:600,height:960,touch:true},
  {id:'tablet-narrow',width:712,height:1138,touch:true},
  {id:'tablet-portrait',width:768,height:1024,touch:true,rotate:true},
  {id:'tablet-landscape',width:1024,height:768,touch:true},
  {id:'tablet-large',width:1180,height:820,touch:true},
  {id:'laptop',width:1024,height:600},
  {id:'desktop',width:1440,height:900},
  {id:'desktop-narrow',width:600,height:900},
];
// Test fixtures live only in nonpersistent contexts, separate from the player's browser.
const prepState=newGame(20261020);Object.assign(prepState,{day:6,cash:1800,menu:['rice','soup','egg','don'],upgrades:['table','stove','queue','shoes']});
const service=new Engine(clone(prepState));service.purchasePlan();service.open();service.s.run.schedule=[];
for(const type of ['student','worker','artist','couple','takeaway']){
  service.spawn();const c=service.s.run.customers.at(-1);c.type=type;c.patience=c.maxPatience=500;service.enqueue('greet',c.id);
}
for(let i=0;i<500&&!service.s.run.customers.every(c=>c.status==='waiting');i++)service.tick(.1);
service.spawn();const serviceState=clone(service.s);
const single=new Engine(clone(prepState));single.s.menu=['egg'];single.purchasePlan();single.open();single.s.run.schedule=[];single.spawn();
const singleGuest=single.s.run.customers[0];singleGuest.type='student';singleGuest.patience=singleGuest.maxPatience=500;single.enqueue('greet',singleGuest.id);
for(let i=0;i<500&&singleGuest.status!=='waiting';i++)single.tick(.1);
const singleServiceState=clone(single.s);
const summary=new Engine(newGame(42));prepare(summary);
for(let i=0;i<4000&&summary.s.phase==='open';i++){operate(summary);summary.tick(.1);}
assert.equal(summary.s.phase,'summary');
const errors=[],reports=[];
const sourceFiles=['src/main.js','src/style.css','src/scene.js'];
const sourceFingerprint=createHash('sha256').update(sourceFiles.map(file=>readFileSync(file,'utf8')).join('\n')).digest('hex');
if(process.argv.includes('--resume')&&existsSync(folder+'/report.json')){
  const saved=JSON.parse(readFileSync(folder+'/report.json','utf8'));
  const unchanged=saved.sourceFingerprint?saved.sourceFingerprint===sourceFingerprint:sourceFiles.every(file=>statSync(file).mtimeMs<=statSync(folder+'/report.json').mtimeMs);
  assert.ok(unchanged,'UI sources changed since the previous run; run without --resume');
  const retry=(process.argv.find(argument=>argument.startsWith('--retry='))?.slice(8)||'').split(',').filter(Boolean);
  for(const id of retry)assert.ok(sizes.some(size=>size.id===id),'Unknown viewport: '+id);
  const outstanding=saved.errors.filter(error=>!retry.some(id=>error.startsWith(id+': ')));
  assert.deepEqual(outstanding,[]);reports.push(...saved.reports.filter(report=>!retry.includes(report.id)));console.log('Resuming after',reports.length,'completed viewport checks');
}

const snapshot=page=>page.evaluate(()=>window.__canteenSnapshot());
const metrics=page=>page.evaluate(()=>{
  const rect=el=>el?Object.fromEntries(['x','y','width','height','top','right','bottom','left'].map(k=>[k,Math.round(el.getBoundingClientRect()[k]*100)/100])):null;
  const selectors=['.title-actions','.prep-top','.prep-layout','.prep-work','.prep-summary','.prep-tabs','.game-top','.game-layout','.canvas-wrap','.order-rail','.order-list','.work-rail','.tutorial-panel','.modal','.summary-card'];
  return {
    viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,
    rects:Object.fromEntries(selectors.map(s=>[s,rect(document.querySelector(s))])),
    touchControls:[...document.querySelectorAll('.game-stats .icon-btn,.help-btn,.scene-zoom,.station-shortcuts button,.queued-task')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;}).map(el=>({label:(el.getAttribute('title')||el.textContent).trim().slice(0,35),...rect(el)})),
    fonts:Object.fromEntries(['.order-top b','.order-status','.order-dish','.tab','.ingredient b'].map(s=>[s,document.querySelector(s)?parseFloat(getComputedStyle(document.querySelector(s)).fontSize):null])),
  };
});
async function load(page,state){
  // Leave the running game before installing the next fixture so its autosave
  // cannot overwrite that fixture while the old document is unloading.
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:serialize(state)});
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/继续上次经营/}).click();
  await page.locator(state.phase==='open'?'.game-layout':state.phase==='summary'?'.summary-card':'.prep-layout').waitFor({state:'visible'});
  await page.waitForTimeout(150);
}
function noOverflow(m,label){assert.ok(m.scrollWidth<=m.viewport.width+1,label+' must not scroll horizontally');}
function inside(rect,width,height,label){assert.ok(rect&&rect.left>=-1&&rect.top>=-1&&rect.right<=width+1&&rect.bottom<=height+1,label+' must fit the viewport: '+JSON.stringify(rect));}
async function capture(page,id,phase){
  const result=await metrics(page);noOverflow(result,id+' '+phase);
  await page.screenshot({path:folder+'/'+id+'-'+phase+'.png',style:'.toast { visibility: hidden; }'});return result;
}
async function settings(page,size,press,fromGame){
  if(fromGame){await press(page.locator('[data-action="pause"]'));await press(page.getByRole('button',{name:'调整偏好'}));}
  else await press(page.locator('[data-action="settings"]').first());
  const result=await capture(page,size.id,'settings');inside(result.rects['.modal'],size.width,size.height,'settings modal');
  const last=page.getByRole('button',{name:'保存并返回'});await last.scrollIntoViewIfNeeded();
  inside(await last.boundingBox().then(r=>({...r,left:r.x,top:r.y,right:r.x+r.width,bottom:r.y+r.height})),size.width,size.height,'settings return');
  await press(last);if(fromGame)await press(page.getByRole('button',{name:'继续营业'}));return result;
}
async function fullService(page,press,guestId,jobId){
  const stage=value=>page.waitForFunction(({id,value})=>window.__canteenSnapshot().state.run.jobs.find(j=>j.id===id)?.stage===value,{id:jobId,value},{timeout:45000});
  await stage('needsHeat');await press(page.locator('[data-station="stove"]'));await stage('needsPlate');
  await press(page.locator('[data-station="plate"]'));await stage('ready');
  await press(page.locator('.order-card[data-guest="'+guestId+'"]'));
  await page.waitForFunction(id=>window.__canteenSnapshot().state.run.customers.find(c=>c.id===id)?.status==='pay',guestId,{timeout:45000});
  await press(page.locator('.order-card[data-guest="'+guestId+'"]'));
  await page.waitForFunction(id=>['leaving','gone'].includes(window.__canteenSnapshot().state.run.customers.find(c=>c.id===id)?.status)||!window.__canteenSnapshot().state.run.customers.some(c=>c.id===id),guestId,{timeout:45000});
  await page.locator('.service-alert.dirty').waitFor();await press(page.locator('.service-alert.dirty'));
  await page.waitForFunction(()=>window.__canteenSnapshot().state.run.tables[0].seats.every(s=>s.status==='free'),null,{timeout:45000});
  return {result:'PASS',flow:['touch cutting shortcut','touch stove shortcut','touch plating shortcut','serve via order card','checkout via order card','clear dirty table reminder']};
}
try{
  for(const size of sizes){
    if(reports.some(report=>report.id===size.id))continue;
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},screen:{width:size.width,height:size.height},deviceScaleFactor:1,isMobile:!!size.touch,hasTouch:!!size.touch});
    await context.addInitScript(key=>localStorage.setItem(key,'skipped'),TUTORIAL_KEY);
    const page=await context.newPage();const press=locator=>size.touch?locator.tap():locator.click();
    page.on('pageerror',e=>errors.push(size.id+': '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(size.id+': '+m.text());});
    await page.goto(url,{waitUntil:'networkidle'});const report={...size,title:await capture(page,size.id,'title')};
    assert.equal(await page.locator('#orientation-gate').isVisible(),false,'menus work in both orientations');
    await press(page.getByRole('button',{name:/接手这间小店/}));await page.locator('.prep-layout').waitFor();
    await load(page,prepState);report.prep=await capture(page,size.id,'prep');
    for(const tab of ['店铺扩建','设备升级','伙伴安排','菜单与备料'])await press(page.getByRole('button',{name:tab,exact:true}));
    const rice=(await snapshot(page)).state.stock.rice;await press(page.locator('[data-buy="rice"]'));assert.equal((await snapshot(page)).state.stock.rice,rice+1,'touch/mouse purchasing works');
    await page.getByRole('button',{name:/开门营业/}).scrollIntoViewIfNeeded();
    if(size.gate){
      report.settings=await settings(page,size,press,false);
      await load(page,summary.s);report.summary=await capture(page,size.id,'summary');
      await press(page.getByRole('button',{name:/准备下一日/}));await page.locator('.prep-layout').waitFor();assert.equal(await page.evaluate(()=>scrollY),0);
      await load(page,serviceState);assert.ok(await page.locator('#orientation-gate').isVisible());
      const before=await snapshot(page);await page.waitForTimeout(350);assert.equal((await snapshot(page)).state.run.elapsed,before.state.run.elapsed,'portrait service freezes the clock');
      report.gate=await capture(page,size.id,'paused-service');
      await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);
      const resumed=await snapshot(page);assert.equal(resumed.sceneId,before.sceneId);assert.ok(resumed.state.run.elapsed>before.state.run.elapsed);assert.deepEqual(resumed.state.run.customers.map(c=>c.id),before.state.run.customers.map(c=>c.id));
      report.rotation={scenePreserved:true,ordersPreserved:true,clockResumed:true};
      await page.setViewportSize({width:size.width,height:size.height});
      const guide=clone(prepState);beginTutorial(guide);await load(page,guide);report.tutorial=await capture(page,size.id,'tutorial-prep');inside(report.tutorial.rects['.tutorial-panel'],size.width,size.height,'portrait tutorial');
      await press(page.locator('[data-action="tutorial-do"]'));await page.waitForFunction(()=>window.__canteenSnapshot().state.tutorial.step==='open');
      await press(page.locator('[data-action="tutorial-do"]'));assert.ok(await page.locator('#orientation-gate').isVisible(),'opening from portrait tutorial pauses for rotation');
    }else{
      await load(page,size.fullService?singleServiceState:serviceState);report.game=await capture(page,size.id,'game');
      assert.equal(await page.locator('#orientation-gate').isVisible(),false,'tablets and desktop windows must remain playable in portrait');
      const {rects}=report.game;inside(rects['.canvas-wrap'],size.width,size.height,'restaurant canvas');inside(rects['.order-list'],size.width,size.height,'order list');inside(rects['.work-rail'],size.width,size.height,'work queue');
      assert.ok(rects['.canvas-wrap'].bottom<=rects['.work-rail'].top+1,'scene cannot run underneath the footer');
      assert.ok(rects['.order-list'].height>=90,'orders keep a usable scrolling area');
      if(size.touch){for(const control of report.game.touchControls)assert.ok(control.width>=43.9&&control.height>=43.9,'touch target: '+JSON.stringify(control));assert.ok(report.game.fonts['.order-top b']>=12);assert.ok(report.game.fonts['.order-status']>=11);}
      const before=await snapshot(page);assert.ok(before.drawCalls>0);report.scene=before.layout;
      for(const [name,p]of Object.entries(before.layout.stations))assert.ok(p.x>=4&&p.x<=before.layout.width-4&&p.y>=4&&p.y<=before.layout.height-4,name+' stays inside the scene');
      const queued=before.state.run.customers.find(c=>c.status==='queue');
      if(queued){await press(page.locator('.order-card[data-guest="'+queued.id+'"]'));assert.ok((await snapshot(page)).state.run.customers.find(c=>c.id===queued.id).claim,'queue reception responds to input');}
      const first=before.state.run.customers[0],jobId=first.jobs[0];await page.locator('.order-card[data-guest="'+first.id+'"]').scrollIntoViewIfNeeded();
      if(await page.locator('[data-station="prep"]').isVisible())await press(page.locator('[data-station="prep"]'));
      else{const box=await page.locator('#scene').boundingBox(),p=before.layout.stations.prep;if(size.touch)await page.touchscreen.tap(box.x+p.x,box.y+p.y);else await page.mouse.click(box.x+p.x,box.y+p.y);}
      await page.waitForFunction(id=>window.__canteenSnapshot().state.run.jobs.find(j=>j.id===id)?.claim||window.__canteenSnapshot().state.run.jobs.find(j=>j.id===id)?.stage!=='new',jobId,{timeout:5000});
      if(size.fullService){console.log(size.id,'running full touch service');report.service=await fullService(page,press,first.id,jobId);await capture(page,size.id,'service-complete');}
      if(size.rotate){const stateBefore=await snapshot(page);await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(300);const after=await snapshot(page);assert.equal(after.sceneId,stateBefore.sceneId);assert.deepEqual(after.state.run.customers.map(c=>c.id),stateBefore.state.run.customers.map(c=>c.id));assert.equal(await page.locator('#orientation-gate').isVisible(),false);await page.setViewportSize({width:size.width,height:size.height});report.rotation={scenePreserved:true,ordersPreserved:true};}
      report.settings=await settings(page,size,press,true);await press(page.locator('[data-action="help"]'));report.help=await metrics(page);inside(report.help.rects['.modal'],size.width,size.height,'help modal');await press(page.getByRole('button',{name:'返回游戏'}));
      await load(page,summary.s);report.summary=await capture(page,size.id,'summary');await press(page.getByRole('button',{name:/准备下一日/}));await page.locator('.prep-layout').waitFor();assert.equal(await page.evaluate(()=>scrollY),0);
      if(size.tutorial){const guide=clone(serviceState);beginTutorial(guide);await load(page,guide);report.tutorial=await capture(page,size.id,'tutorial-game');const p=report.tutorial.rects['.tutorial-panel'];inside(p,size.width,size.height,'landscape tutorial');assert.ok(p.left>=report.tutorial.rects['.canvas-wrap'].right,'the compact tutorial leaves the restaurant visible');await press(page.locator('[data-action="tutorial-do"]'));}
    }
    reports.push(report);writeFileSync(folder+'/report.json',JSON.stringify({result:'RUNNING',sourceFingerprint,errors,reports},null,2));await context.close();console.log(size.id,'PASS');
  }
  assert.deepEqual(errors,[]);writeFileSync(folder+'/report.json',JSON.stringify({result:'PASS',sourceFingerprint,scope:'14 viewports; nonpersistent isolated contexts; test fixtures only; real touch/mouse input; no player profile access.',checks:['title, preparation, settings, help, summary and service','no horizontal document overflow','scene and order list bounded above work rail','44px touch controls and readable order typography','purchasing and kitchen input','full phone cooking, serving, checkout and cleanup','phone rotation pauses/resumes without dropping orders','tablet rotation preserves scene and orders','portrait preparation and live tutorial'],errors,reports},null,2));console.log('responsive browser PASS');
}catch(error){console.error('Browser errors:',errors);throw error;}finally{await browser.close();}
