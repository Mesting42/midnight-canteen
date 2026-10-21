import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,newGame} from '../src/engine.js';
import {EXPANSIONS,expansionReady,shopkeeperLimit,staffCount,staffHireCost} from '../src/data.js';
import {streetCarMotion,streetWalkerMotion} from '../src/exterior.js';

function until(engine,condition,limit=12000,observe=()=>{}){
  for(let i=0;i<limit&&!condition();i++){engine.tick(.02);observe();}
  assert.ok(condition(),'the expected operating state was not reached');
}

test('expansions require the day, cumulative revenue, and served guest targets',()=>{
  const e=new Engine(newGame(317)),service=EXPANSIONS.find(item=>item.id==='service');
  e.s.day=3;e.s.cash=1000;e.s.history=[{revenue:260}];e.s.totalGuests=18;
  assert.equal(expansionReady(e.s,service),false);
  assert.equal(e.buyUpgrade('service'),false);
  e.s.day=4;e.s.history[0].revenue=259;
  assert.equal(expansionReady(e.s,service),false);
  assert.equal(e.buyUpgrade('service'),false);
  e.s.history[0].revenue=260;e.s.totalGuests=17;
  assert.equal(expansionReady(e.s,service),false);
  assert.equal(e.buyUpgrade('service'),false);
  e.s.totalGuests=18;
  assert.equal(expansionReady(e.s,service),true);
  assert.ok(e.buyUpgrade('service'));
  assert.equal(shopkeeperLimit(e.s),2);
});

test('keeper hiring cost rises with each expansion unlocked roster slot',()=>{
  const e=new Engine(newGame(318));
  e.s.day=4;e.s.cash=1000;e.s.history=[{revenue:260}];e.s.totalGuests=18;
  assert.equal(staffHireCost(e.s,'shopkeeper'),85);
  assert.ok(e.buyUpgrade('service'));
  assert.equal(staffHireCost(e.s,'shopkeeper'),85);
  assert.ok(e.hire('shopkeeper'));
  assert.equal(staffHireCost(e.s,'shopkeeper'),145);
  assert.ok(e.hire('shopkeeper'));
  assert.equal(staffCount(e.s,'shopkeeper'),2);
  assert.equal(staffHireCost(e.s,'shopkeeper'),205);
  assert.equal(e.hire('shopkeeper'),false,'the third hire stays locked until the next capacity expansion');
  e.s.day=6;e.s.history.push({revenue:190});e.s.totalGuests=28;
  assert.ok(e.buyUpgrade('wash'));
  assert.equal(shopkeeperLimit(e.s),3);
  assert.ok(e.hire('shopkeeper'));
  assert.equal(staffCount(e.s,'shopkeeper'),3);
  assert.equal(staffHireCost(e.s,'shopkeeper'),265);
});

test('two single guests reserve separate seats and keep independent orders at one table',()=>{
  const e=new Engine(newGame(319));e.purchasePlan();e.open();e.spawn();e.spawn();e.s.run.schedule=[];
  const [first,second]=e.s.run.customers;
  first.type='student';second.type='student';
  assert.ok(e.enqueue('greet',first.id));assert.ok(e.enqueue('greet',second.id));
  assert.notEqual(e.actor().queue[0].seatReservation.sides[0],e.actor().queue[1].seatReservation.sides[0]);
  until(e,()=>first.seated&&second.seated);
  assert.equal(first.table,second.table);
  assert.notEqual(first.seatSide,second.seatSide);
  assert.notEqual(first.jobs[0],second.jobs[0]);
  assert.equal(e.job(first.jobs[0]).customer,first.id);
  assert.equal(e.job(second.jobs[0]).customer,second.id);
  assert.equal(e.s.run.tables[first.table].seats.filter(seat=>seat.status==='occupied').length,2);
  e.assertInvariants();
});

test('one shopkeeper autonomously greets, cooks, plates, and clears a table without duplicate claims',()=>{
  const e=new Engine(newGame(320));e.s.staff=['shopkeeper-1'];e.setMenu(['soup']);e.purchasePlan();e.open();e.spawn();e.s.run.schedule=[];
  const guest=e.s.run.customers[0],assigned=new Set();
  until(e,()=>guest.status==='waiting'&&guest.jobs.every(id=>e.job(id)?.stage==='ready'),12000,()=>{for(const actor of e.s.run.actors)if(actor.task)assigned.add(actor.task.kind);});
  assert.ok(['greet','prep','heat','plate'].every(kind=>assigned.has(kind)));
  assert.equal(e.actor('chef').task,null,'the player retains control of delivery and checkout');
  e.assertInvariants();
  assert.ok(e.enqueue('serve',guest.jobs[0],'chef'));
  until(e,()=>guest.status==='pay');
  assert.ok(e.enqueue('pay',guest.id,'chef'));
  until(e,()=>e.s.run.tables[guest.table].status==='free');
  assert.equal(e.s.run.stats.served,1);
  e.assertInvariants();
});

test('street vehicle headings and rolling wheels agree with travel in both directions',()=>{
  for(const direction of [-1,1]){
    const route={direction,speed:.5,offset:1},start=streetCarMotion(2,route),end=streetCarMotion(2.5,route);
    assert.equal(Math.sign(end.x-start.x),direction);
    assert.equal(Math.sign(Math.cos(start.yaw)),direction);
    assert.ok(end.wheelAngle>start.wheelAngle,'wheel rotation advances in the vehicle local frame');
  }
});

test('wheelchair route turns continuously and keeps the rider facing its rolling wheels',()=>{
  const route={speed:1,offset:0},before=streetWalkerMotion(17.9,route),after=streetWalkerMotion(18.1,route);
  assert.ok(Math.abs(after.x-before.x)<.25,'the route remains continuous at the turn');
  assert.notEqual(before.yaw,after.yaw);
  assert.ok(after.wheelAngle>before.wheelAngle,'wheel rotation keeps advancing through the turn');
  const beforeChair=before.yaw-Math.PI/2,afterChair=after.yaw-Math.PI/2;
  assert.equal(Math.sign(Math.cos(beforeChair)),1);
  assert.equal(Math.sign(Math.cos(afterChair)),-1);
});
