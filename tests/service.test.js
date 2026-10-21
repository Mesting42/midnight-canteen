import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine, newGame, seatPosition, serialize, deserialize } from '../src/engine.js';
import { makePerson, animatePerson, makeFood, TABLE_SURFACE_Y } from '../src/models.js';
import { Box3,Vector3 } from 'three';
import { beginTutorial, finishTutorial, serviceElapsed, tutorialView } from '../src/tutorial.js';
import { dailyInfo } from '../src/data.js';

function until(e, condition, limit=3000) {
  for(let i=0;i<limit&&!condition();i++)e.tick(.1);
  assert.ok(condition(),'expected service state was not reached');
}
function work(e,kind,target) {
  assert.ok(e.enqueue(kind,target),`${kind} should be available`);
  until(e,()=>!e.actor().task&&!e.actor().queue.length);
}
function service(seed=42,tutorial=false) {
  const e=new Engine(newGame(seed));if(tutorial)beginTutorial(e.s);
  e.purchasePlan();e.open();e.spawn();e.s.run.schedule=[];
  return e;
}
function cookAndServe(e,c) {
  for(const id of c.jobs){
    const j=e.job(id);if(j.stage==='new')work(e,'prep',id);
    if(j.stage==='needsHeat'){work(e,'heat',id);until(e,()=>j.stage==='needsPlate');}
    work(e,'plate',id);work(e,'serve',id);
  }
}

test('guests arrive at a real chair and face the table before eating',()=>{
  const e=service(),c=e.s.run.customers[0];work(e,'greet',c.id);
  until(e,()=>c.status==='waiting');
  const seat=seatPosition(e.s,c.table);
  assert.equal(c.seated,true);assert.equal(c.x,seat.x);assert.equal(c.z,seat.z);assert.equal(c.yaw,seat.yaw);
  assert.equal(e.s.run.tables[c.table].status,'occupied');
  cookAndServe(e,c);assert.equal(c.status,'eating');assert.equal(c.seated,true);
  until(e,()=>c.status==='pay');work(e,'pay',c.id);
  assert.equal(c.status,'leaving');assert.equal(c.seated,false);assert.ok(c.standTimer>0);
  assert.equal(e.s.run.tables[c.table].status,'dirty');
  work(e,'clean',c.table);until(e,()=>!e.customer(c.id));
  assert.equal(e.s.run.tables[c.table].status,'free');assert.equal(e.s.run.stats.served,1);e.assertInvariants();
});

test('food delivered early does not interrupt the walk to the chair',()=>{
  const e=service(),c=e.s.run.customers[0];work(e,'greet',c.id);
  assert.equal(c.status,'arriving');
  for(const id of c.jobs)e.job(id).stage='served';
  e.startEating(c);assert.equal(c.status,'arriving');
  until(e,()=>c.status==='eating');assert.equal(c.seated,true);assert.equal(e.s.run.stats.served,1);
});

test('old aisle-position saves are migrated without changing their orders or money',()=>{
  const e=service(),c=e.s.run.customers[0];work(e,'greet',c.id);until(e,()=>c.status==='waiting');
  delete c.seated;delete c.seatSide;c.z+=.9;
  const originalCash=e.s.cash,ids=[...c.jobs],s=deserialize(serialize(e.s)),m=s.run.customers[0];
  assert.equal(m.seated,true);assert.equal(m.z,seatPosition(s,m.table).z);
  assert.deepEqual(m.jobs,ids);assert.equal(s.cash,originalCash);
});

test('tutorial progresses only through actual actions and grants a pressure-free first service',()=>{
  const e=service(13,true),c=e.s.run.customers[0];
  assert.equal(e.s.tutorial.step,'greet');assert.equal(c.type,'neighbor');
  const patience=c.patience;for(let i=0;i<1600;i++)e.tick(.1);
  assert.equal(c.patience,patience);assert.equal(e.s.run.closed,false);assert.equal(serviceElapsed(e.s),0);assert.equal(e.s.run.spawnIndex,1);
  work(e,'greet',c.id);assert.equal(e.s.tutorial.step,'prep');
  cookAndServe(e,c);assert.equal(e.s.tutorial.step,'eat');
  until(e,()=>c.status==='pay');assert.equal(e.s.tutorial.step,'pay');work(e,'pay',c.id);assert.equal(e.s.tutorial.step,'clean');
  work(e,'clean',c.table);assert.equal(e.s.tutorial.completed,true);assert.equal(e.s.tutorial.active,false);assert.equal(tutorialView(e.s).step,'done');
  const elapsed=serviceElapsed(e.s);e.tick(.1);assert.ok(serviceElapsed(e.s)>elapsed);
  const saved=deserialize(serialize(e.s));assert.equal(saved.tutorial.completed,true);e.assertInvariants();
});

test('skipping and replaying the guide preserves service progress and money',()=>{
  const e=service(3,true);const c=e.s.run.customers[0];work(e,'greet',c.id);until(e,()=>c.status==='waiting');
  const cash=e.s.cash,jobs=[...c.jobs];finishTutorial(e.s);assert.equal(tutorialView(e.s),null);
  beginTutorial(e.s);assert.equal(e.s.tutorial.step,'prep');assert.equal(e.s.tutorial.guest,c.id);
  assert.equal(e.s.cash,cash);assert.deepEqual(c.jobs,jobs);
});

test('closing stops new greetings but waits for all accepted guests to finish',()=>{
  const e=new Engine(newGame(421));e.purchasePlan();assert.ok(e.open());e.s.run.schedule=[];
  const guests=Array.from({length:4},()=>{assert.ok(e.spawn());return e.s.run.customers.at(-1);});
  guests.forEach(guest=>{guest.type='student';});
  for(const guest of guests.slice(0,3))assert.ok(e.enqueue('greet',guest.id));
  const duration=dailyInfo(e.s).duration;e.s.run.elapsed=duration;e.tick(.1);
  assert.equal(e.s.run.closed,true);assert.equal(e.s.phase,'open');
  assert.equal(guests[3].status,'leaving','unaccepted queue guests leave at closing');
  assert.equal(e.enqueue('greet',guests[3].id),false);assert.equal(e.spawn(),false);
  const patience=guests.slice(0,3).map(guest=>guest.patience);
  for(let i=0;i<350;i++)e.tick(.1);
  assert.ok(e.s.run.elapsed>duration+32,'closing has passed the former 32-second cutoff');
  assert.equal(e.s.phase,'open','the summary waits while accepted guests remain');
  assert.deepEqual(guests.slice(0,3).map(guest=>guest.patience),patience,'accepted guests keep their patience after closing');
  until(e,()=>guests.slice(0,3).every(guest=>guest.status==='waiting'));
  for(const guest of guests.slice(0,3))cookAndServe(e,guest);
  for(const guest of guests.slice(0,3))until(e,()=>guest.status==='pay');
  for(const guest of guests.slice(0,3))work(e,'pay',guest.id);
  assert.equal(e.s.phase,'summary');assert.equal(e.s.result.served,3);assert.equal(e.s.result.lost,1);
});

test('shopkeepers do not greet new guests after closing',()=>{
  const state=newGame(422);state.staff=['shopkeeper-1'];
  const e=new Engine(state);e.purchasePlan();assert.ok(e.open());e.s.run.schedule=[];assert.ok(e.spawn());
  const guest=e.s.run.customers[0];e.s.run.elapsed=dailyInfo(e.s).duration;e.tick(.1);
  assert.equal(guest.status,'leaving');assert.equal(e.actor('shopkeeper-1').task,null);assert.equal(e.actor('shopkeeper-1').queue.length,0);
});

test('closing lets feasible accepted orders finish and releases orders that cannot be made',()=>{
  const state=newGame(423);state.day=5;state.menu=['pork'];
  const e=new Engine(state);e.purchasePlan();assert.ok(e.open());e.s.run.schedule=[];e.s.stock.meat=2;e.s.stock.veg=1;
  const guests=Array.from({length:2},()=>{assert.ok(e.spawn());return e.s.run.customers.at(-1);});
  guests.forEach(guest=>{guest.type='student';work(e,'greet',guest.id);});
  guests.forEach(guest=>until(e,()=>guest.status==='waiting'));
  assert.ok(e.enqueue('prep',guests[0].jobs[0]),'the first pork order reserves the available ingredients');
  assert.equal(e.enqueue('prep',guests[1].jobs[0]),false,'a second order cannot reserve the same ingredients twice');
  e.s.run.elapsed=dailyInfo(e.s).duration;e.tick(.1);
  assert.equal(guests[0].status,'waiting');assert.equal(guests[1].status,'leaving');
  assert.ok(e.events.some(event=>event.type==='warning'&&event.message.includes('原料不足')));
  assert.equal(e.s.phase,'open','the feasible accepted guest can still finish after closing');
  until(e,()=>!e.actor().task&&!e.actor().queue.length);
  cookAndServe(e,guests[0]);until(e,()=>guests[0].status==='pay');work(e,'pay',guests[0].id);
  until(e,()=>e.s.phase==='summary');
  assert.equal(e.s.result.served,1);assert.equal(e.s.result.lost,1);
});

test('seated and eating animations bend knees, raise food and move the chopstick hand',()=>{
  const model=makePerson(),c={x:0,z:0,yaw:Math.PI/2,seated:true,table:0,status:'waiting',path:[]};
  animatePerson(model,c,1,.1);assert.equal(model.userData.pose,'seated');
  assert.ok(model.userData.legs.every(l=>l.rotation.x<-1.5));assert.ok(model.userData.knees.every(k=>k.rotation.x>1.5));
  c.status='eating';animatePerson(model,c,1,.1);const arm=model.userData.arms[1].rotation.x;
  assert.equal(model.userData.dining.visible,true);assert.equal(model.userData.utensils.visible,true);
  animatePerson(model,c,1.6,.1);assert.notEqual(model.userData.arms[1].rotation.x,arm);
  c.status='leaving';c.seated=false;c.standTimer=.45;
  for(let i=0;i<15;i++)animatePerson(model,c,1.6+i*.1,.1);
  assert.ok(model.userData.sit<.01);assert.equal(model.userData.dining.visible,false);
});

test('walking gait follows traveled distance instead of the wall clock',()=>{
  const model=makePerson({type:'elder',wheelchair:true}),person={x:0,z:0,yaw:Math.PI/2,path:[{}],serial:2,type:'elder',walkStride:.92,status:'walking'};
  animatePerson(model,person,0,0);
  const start=model.userData.legs.map(leg=>leg.rotation.x);
  person.x=.30;animatePerson(model,person,.1,.1);
  const end=model.userData.legs.map(leg=>leg.rotation.x);
  assert.ok(end.some((angle,index)=>Math.abs(angle-start[index])>.1));
  assert.ok(Math.abs(model.rotation.y-Math.PI/2)<.001);
});

test('wheelchair rider reaches both push rims with a clear seated arm pose',()=>{
  for(const yaw of [Math.PI/2,-Math.PI/2]){
    const model=makePerson({type:'elder',wheelchair:true}),person={x:0,z:0,yaw,path:[],serial:2,type:'elder',status:'walking',seated:true,wheelchair:true};
    model.position.y=-.10;animatePerson(model,person,0,.016);model.updateMatrixWorld(true);
    const expected=[new Vector3(-.30,.60,.14),new Vector3(.30,.60,.14)].map(point=>model.userData.body.localToWorld(point));
    const hands=model.userData.hands.map(hand=>hand.getWorldPosition(new Vector3()));
    assert.ok(hands.every((hand,index)=>hand.distanceTo(expected[index])<.025));
    assert.equal(model.userData.pose,'seated');
  }
});

test('couples each walk to an opposite chair and stand from their own seat',()=>{
  const e=service(),c=e.s.run.customers[0];e.s.day=6;c.type='couple';work(e,'greet',c.id);
  until(e,()=>c.seated&&c.companion?.seated);
  assert.equal(c.x,seatPosition(e.s,c.table,-1).x);
  assert.equal(c.companion.x,seatPosition(e.s,c.table,1).x);
  const copy=deserialize(serialize(e.s));assert.deepEqual(copy.run.customers[0].companion,c.companion);
  cookAndServe(e,c);until(e,()=>c.status==='pay');work(e,'pay',c.id);
  assert.equal(c.companion.seated,false);assert.ok(c.companion.standTimer>0);
  assert.equal(c.companion.x,seatPosition(e.s,c.table,1).x);
  until(e,()=>!e.customer(c.id));e.assertInvariants();
});

test('takeaway guests wait near the entry without occupying a chair',()=>{
  const e=service(),c=e.s.run.customers[0];c.type='takeaway';work(e,'greet',c.id);
  until(e,()=>c.status==='waiting');assert.equal(c.table,null);assert.equal(c.seated,false);
  cookAndServe(e,c);until(e,()=>c.status==='pay');work(e,'pay',c.id);
  assert.ok(e.s.run.tables.every(t=>t.status==='free'));assert.ok(e.s.run.stats.revenue>0);
});

test('all held dishes and chopsticks clear the table through a full eating cycle on both sides',()=>{
  const heldBounds=new Box3(),utensilBounds=new Box3(),palm=new Vector3(),bowlOrigin=new Vector3();
  for(const yaw of [Math.PI/2,-Math.PI/2])for(const dish of ['rice','soup','egg','salad','noodle','pork','don','fish','hotpot','bento']){
    const model=makePerson(),food=makeFood(dish);food.scale.setScalar(.64);model.userData.dining.add(food);
    const c={x:0,z:0,yaw,seated:true,table:0,status:'eating',path:[]};
    for(let i=0;i<240;i++){
      animatePerson(model,c,i/60,1/60);model.updateMatrixWorld(true);
      heldBounds.setFromObject(model.userData.dining,true);
      assert.ok(heldBounds.min.y>TABLE_SURFACE_Y+.045,`${dish} bowl intersects table at sample ${i}: ${heldBounds.min.y}`);
      utensilBounds.setFromObject(model.userData.utensils,true);
      assert.ok(utensilBounds.min.y>TABLE_SURFACE_Y+.01,`${dish} chopsticks intersect table at sample ${i}: ${utensilBounds.min.y}`);
      model.userData.hands[0].getWorldPosition(palm);model.userData.dining.getWorldPosition(bowlOrigin);
      assert.ok(palm.distanceTo(bowlOrigin)<.14,`${dish} bowl must stay with the supporting hand`);
    }
  }
});
