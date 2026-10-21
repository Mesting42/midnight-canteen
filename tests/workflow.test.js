import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {Engine,newGame,serialize,deserialize,tablePosition} from '../src/engine.js';
import {dishById,TYPES} from '../src/data.js';
import {beginTutorial} from '../src/tutorial.js';
import {makePerson,animatePerson} from '../src/models.js';
import {animateWorker,makeMealProp,updateMealProp} from '../src/actions.js';

function until(e,condition,observe=()=>{}){
  for(let i=0;i<5000&&!condition();i++){e.tick(.02);observe();}
  assert.ok(condition(),'workflow did not reach the expected state');
}
function work(e,kind,target,observe){
  assert.ok(e.enqueue(kind,target),`${kind} must be available`);
  until(e,()=>!e.actor().task&&!e.actor().queue.length,observe);
}
function service(){
  const e=new Engine(newGame(42));beginTutorial(e.s);e.purchasePlan();e.open();e.spawn();e.s.run.schedule=[];
  const c=e.s.run.customers[0];work(e,'greet',c.id);until(e,()=>c.seated);
  return {e,c,j:e.job(c.jobs[0])};
}

test('one click per original task performs the whole physical workflow and consumes stock once',()=>{
  const {e,c,j}=service(),stock={...e.s.stock},steps=new Set();
  const observe=()=>{if(e.actor().task?.phase==='work')steps.add(e.actor().task.step);e.assertInvariants();};
  work(e,'prep',j.id,observe);assert.equal(j.location,'prep');assert.equal(j.visual,'chopped');
  for(const [key,amount]of Object.entries(dishById[j.dish].ingredients))assert.equal(e.s.stock[key],stock[key]-amount);
  work(e,'heat',j.id,observe);assert.equal(j.location,'stove');assert.equal(e.actor().carriedJob,null);
  until(e,()=>j.stage==='needsPlate');assert.equal(e.freeStove(),0,'cooked food still occupies its pot');
  assert.ok(e.enqueue('plate',j.id));until(e,()=>e.actor().task?.step==='garnish');
  assert.equal(j.location,'actor');assert.equal(e.actor().carriedJob,j.id);assert.equal(e.freeStove(),1);
  until(e,()=>!e.actor().task,observe);work(e,'serve',j.id,observe);
  until(e,()=>c.status==='pay');work(e,'pay',c.id,observe);work(e,'clean',c.table,observe);
  for(const name of ['fetch','lay','chop','pickup','pour','garnish','lift','deliver','payment','deposit','wipe','collect','wash'])assert.ok(steps.has(name),`missing ${name}`);
  assert.equal(e.s.run.tables[c.table].status,'free');assert.equal(e.s.run.stats.served,1);
});

test('the plated food visibly shrinks while a diner eats and empties at checkout',()=>{
  const {e,c,j}=service(),diner=makePerson({type:c.type}),meal=makeMealProp(j.dish),people=new Map([[c.id,diner]]);
  work(e,'prep',j.id);if(j.stage==='needsHeat'){work(e,'heat',j.id);until(e,()=>j.stage==='needsPlate');}
  work(e,'plate',j.id);work(e,'serve',j.id);assert.equal(c.status,'eating');
  const update=()=>{animatePerson(diner,c,e.s.run.elapsed,.02);diner.updateMatrixWorld(true);updateMealProp(meal,j,e.s,people,tablePosition);};
  const contents=meal.userData.variants.plated.userData.contents;
  update();assert.equal(contents.visible,true);const full=contents.scale.y;
  c.timer=TYPES.find(type=>type.id===c.type).eat/2;update();const half=contents.scale.y;
  assert.ok(half<full&&half>.45&&half<.55,`halfway meal scale should be near .5, got ${half}`);
  c.status='pay';update();assert.equal(contents.visible,false);assert.ok(contents.scale.y<=.001);
});

test('saving while carrying ingredients resumes the same step without charging stock again',()=>{
  let {e,j}=service();assert.ok(e.enqueue('prep',j.id));
  until(e,()=>e.actor().task?.step==='lay');
  const stock={...e.s.stock},cost=e.s.run.stats.ingredientCost,jobId=j.id;
  assert.equal(e.actor().carriedJob,j.id);
  e=new Engine(deserialize(serialize(e.s)));j=e.job(jobId);
  assert.equal(e.actor().task.step,'lay');assert.equal(j.carrier,e.actor().id);
  until(e,()=>!e.actor().task);assert.deepEqual(e.s.stock,stock);assert.equal(e.s.run.stats.ingredientCost,cost);
  assert.equal(j.location,'prep');assert.equal(j.carrier,null);e.assertInvariants();
});

test('abandoned food releases both cookware and the carrying actor',()=>{
  const {e,c,j}=service();work(e,'prep',j.id);work(e,'heat',j.id);
  assert.equal(e.freeStove(),0);e.leave(c,true);assert.equal(e.freeStove(),1);assert.equal(j.location,'none');
  const next=service();work(next.e,'prep',next.j.id);next.e.enqueue('heat',next.j.id);
  until(next.e,()=>next.e.actor().carriedJob===next.j.id);next.e.leave(next.c,true);
  assert.equal(next.e.actor().carriedJob,null);assert.equal(next.j.carrier,null);next.e.assertInvariants();
});

test('the same meal prop follows the hands on every transport leg, including the walk to the table',()=>{
  const {e,c,j}=service(),worker=makePerson({chef:true}),diner=makePerson({type:c.type});
  const people=new Map([['chef',worker],[c.id,diner]]),meal=makeMealProp(j.dish),carried=new Set(),tools=new Set();
  const anchor=new Vector3(),position=new Vector3();let samples=0;
  const draw=()=>{
    const a=e.actor(),time=e.s.run.elapsed;animatePerson(worker,a,time,.02);animateWorker(worker,a,time);
    animatePerson(diner,c,time,.02);worker.updateMatrixWorld(true);diner.updateMatrixWorld(true);
    updateMealProp(meal,j,e.s,people,tablePosition);meal.updateMatrixWorld(true);
    for(const [name,tool]of Object.entries(worker.userData.tools))if(tool.visible)tools.add(name);
    if(j.location==='actor'&&a.task?.phase==='walk'){
      worker.userData.carry.getWorldPosition(anchor);meal.getWorldPosition(position);
      assert.ok(anchor.distanceTo(position)<.00001,`${a.task.step}: food left the carrying hands`);
      assert.equal(meal.userData.variant,a.task.kind==='heat'||a.task.step==='stow'?'chopped':a.task.kind==='prep'?'raw':'plated');
      carried.add(a.task.step);samples++;
    }
    assert.ok(meal.position.toArray().every(Number.isFinite));
  };
  work(e,'prep',j.id,draw);work(e,'heat',j.id,draw);until(e,()=>j.stage==='needsPlate',draw);
  work(e,'plate',j.id,draw);work(e,'serve',j.id,draw);until(e,()=>c.status==='pay',draw);
  work(e,'pay',c.id,draw);work(e,'clean',c.table,draw);
  assert.ok(samples>20);for(const step of ['lay','pour','garnish','deliver'])assert.ok(carried.has(step),step);
  for(const name of ['knife','spatula','ladle','bottle','cash','dirty','cloth','water'])assert.ok(tools.has(name),name);
});

test('the cutting blade clears the board and frying uses a spatula',()=>{
  const worker=makePerson({chef:true}),bounds=new Box3();
  for(let i=0;i<80;i++){
    const p={x:-2.8,z:-1.9,yaw:Math.PI,path:[],task:{step:'chop',phase:'work',progress:i/100,duration:1}};
    animatePerson(worker,p,0,.02);animateWorker(worker,p,0);worker.updateMatrixWorld(true);
    bounds.setFromObject(worker.userData.tools.knife);assert.ok(bounds.min.y>1.1815,'blade passes through the ingredient tray');
  }
  const p={x:-1.26,z:-1.9,yaw:Math.PI,path:[],task:{step:'scoop',phase:'work',progress:.5,duration:1}};
  animatePerson(worker,p,0,.02);animateWorker(worker,p,0,'egg');
  assert.ok(worker.userData.tools.spatula.visible);assert.equal(worker.userData.tools.ladle.visible,false);
});

test('takeaway food is packed and stays with the guest after the handoff and payment',()=>{
  const e=new Engine(newGame(42));beginTutorial(e.s);e.purchasePlan();e.open();e.spawn();e.s.run.schedule=[];
  const c=e.s.run.customers[0];c.type='takeaway';work(e,'greet',c.id);until(e,()=>c.status==='waiting');
  const j=e.job(c.jobs[0]),worker=makePerson({chef:true}),guest=makePerson({type:'takeaway'}),meal=makeMealProp(j.dish),people=new Map([['chef',worker],[c.id,guest]]),anchor=new Vector3();
  work(e,'prep',j.id);if(j.stage==='needsHeat'){work(e,'heat',j.id);until(e,()=>j.stage==='needsPlate');}
  work(e,'plate',j.id);work(e,'serve',j.id);
  const draw=()=>{animatePerson(guest,c,e.s.run.elapsed,.02);guest.updateMatrixWorld(true);updateMealProp(meal,j,e.s,people,tablePosition);guest.userData.dining.getWorldPosition(anchor);assert.ok(meal.visible);assert.equal(meal.userData.variant,'packed');assert.ok(meal.position.distanceTo(anchor)<.00001);};
  draw();until(e,()=>c.status==='pay');work(e,'pay',c.id);assert.equal(c.status,'leaving');draw();
});

test('autosaving from completion notifications captures the finished handoff and payment atomically',()=>{
  const {e,c,j}=service(),saved={};e.notify=type=>{if(['serve','cash','ready'].includes(type))saved[type]=serialize(e.s);};
  work(e,'prep',j.id);work(e,'heat',j.id);until(e,()=>j.stage==='needsPlate');work(e,'plate',j.id);
  const plated=new Engine(deserialize(saved.ready));assert.equal(plated.actor().task,null);assert.equal(plated.job(j.id).location,'plate');
  work(e,'serve',j.id);const served=new Engine(deserialize(saved.serve));
  assert.equal(served.customer(c.id).status,'eating');assert.equal(served.actor().carriedJob,null);
  until(e,()=>c.status==='pay');work(e,'pay',c.id);const paid=new Engine(deserialize(saved.cash));
  assert.equal(paid.customer(c.id).status,'leaving');assert.equal(paid.actor().task,null);assert.equal(paid.s.cash,e.s.cash);
});
