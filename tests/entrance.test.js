import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine,newGame,serialize,deserialize,GUEST_ENTRY,queuePosition} from '../src/engine.js';

function restaurant(seed=42){const e=new Engine(newGame(seed));e.purchasePlan();e.open();e.s.run.schedule=[];return e;}
function until(e,condition,onTick=()=>{}){for(let i=0;i<3000&&!condition();i++){const before=e.s.run.customers.map(c=>({id:c.id,x:c.x,z:c.z,companion:c.companion?{...c.companion}:null}));e.tick(.04);onTick(before);}assert.ok(condition(),'guest flow failed to finish');}
function crossings(from,to){
  const result=[];
  for(const z of [GUEST_ENTRY.boundaryZ,3.98,3.8]){
    if(from.z===to.z||!((from.z<=z&&to.z>z)||(from.z>=z&&to.z<z)))continue;
    const x=from.x+(to.x-from.x)*(z-from.z)/(to.z-from.z);
    assert.ok(Math.abs(x)<=GUEST_ENTRY.halfWidth+1e-8,`crossed the facade at x=${x}, z=${z}`);result.push({x,z});
  }
  return result;
}

test('new guests wait in unique doorway slots and never enter before reception',()=>{
  for(const seed of [2,13,42,87]){
    const e=restaurant(seed);e.s.day=6;for(let i=0;i<7;i++)e.spawn();
    for(let i=0;i<100;i++)e.tick(.04);
    const people=e.s.run.customers.flatMap(c=>[c,...(c.companion?[c.companion]:[])]);
    assert.ok(people.length<=GUEST_ENTRY.queueCapacity);
    assert.equal(new Set(people.map(p=>`${p.x}:${p.z}`)).size,people.length);
    for(const p of people){assert.ok(Math.abs(p.x)<=.401);assert.ok(p.z>=GUEST_ENTRY.queueZ&&p.z<=queuePosition(7).z);}
    assert.ok(e.s.run.customers.every(c=>c.status==='queue'&&c.table===null));
  }
});

test('every table in both layouts is entered and exited only through the real doorway, including companions',()=>{
  for(const layout of ['classic','compact'])for(let table=0;table<4;table++)for(const couple of [false,true]){
    const e=restaurant();e.s.layout=layout;e.s.upgrades.push('table');
    e.s.run.tables.push({id:3,status:'free',customer:null,claim:null,seats:[{side:-1,status:'free',customer:null,claim:null},{side:1,status:'free',customer:null,claim:null}]});
    for(let i=0;i<table;i++){e.s.run.tables[i].status='dirty';for(const seat of e.s.run.tables[i].seats)seat.status='dirty';}
    e.spawn();const c=e.s.run.customers[0];if(couple){c.type='couple';e.s.day=6;e.tick(.04);}
    assert.ok(e.enqueue('greet',c.id));const entry=[],exit=[];
    const watch=records=>before=>{const prev=before.find(p=>p.id===c.id);if(!prev)return;records.push(...crossings(prev,c));if(prev.companion&&c.companion)records.push(...crossings(prev.companion,c.companion));};
    until(e,()=>c.seated&&(!c.companion||c.companion.seated),watch(entry));
    assert.equal(c.table,table);assert.ok(entry.some(p=>p.z===GUEST_ENTRY.boundaryZ));
    assert.ok(c.path.length===0&&c.z<GUEST_ENTRY.insideZ);
    e.leave(c,false);until(e,()=>!e.customer(c.id),watch(exit));
    assert.ok(exit.some(p=>p.z===GUEST_ENTRY.boundaryZ));e.assertInvariants();
  }
});

test('the waiting line advances outdoors after reception',()=>{
  const e=restaurant();e.spawn();e.spawn();e.spawn();const [first,...rest]=e.s.run.customers;
  assert.ok(e.enqueue('greet',first.id));until(e,()=>first.status!=='queue');
  until(e,()=>rest.every(c=>c.path.length===0));
  for(let i=0;i<rest.length;i++){assert.equal(rest[i].x,queuePosition(i).x);assert.equal(rest[i].z,queuePosition(i).z);}
});

test('unserved guests and takeaway guests remain outside the facade',()=>{
  const e=restaurant();e.spawn();const c=e.s.run.customers[0];e.leave(c,true);
  until(e,()=>!e.customer(c.id),before=>{const old=before.find(p=>p.id===c.id);if(old){assert.ok(c.z>GUEST_ENTRY.boundaryZ);assert.deepEqual(crossings(old,c),[]);}});
  e.spawn();const pickup=e.s.run.customers[0];pickup.type='takeaway';assert.ok(e.enqueue('greet',pickup.id));
  until(e,()=>pickup.status==='waiting',()=>assert.ok(pickup.z>GUEST_ENTRY.boundaryZ));
  assert.equal(pickup.table,null);assert.equal(pickup.seated,false);e.assertInvariants();
});

test('legacy queues and side-entry paths are migrated without resetting business progress',()=>{
  const e=restaurant();e.spawn();e.spawn();e.spawn();const [arriving,...waiting]=e.s.run.customers;
  assert.ok(e.enqueue('greet',arriving.id));until(e,()=>arriving.status==='arriving');
  arriving.x=-2.5;arriving.z=4.3;arriving.path=[{x:-3.98,z:.55},{x:-3.53,z:.55}];
  waiting.forEach((c,i)=>{c.x=-1.65+i*.65;c.z=4.2;delete c.queueSlots;});
  delete e.s.run.guestRouteVersion;
  const money=e.s.cash,jobs=JSON.stringify(e.s.run.jobs),stock=JSON.stringify(e.s.stock),copy=deserialize(serialize(e.s));
  assert.equal(copy.cash,money);assert.equal(JSON.stringify(copy.run.jobs),jobs);assert.equal(JSON.stringify(copy.stock),stock);
  assert.equal(copy.run.guestRouteVersion,GUEST_ENTRY.version);
  const guest=copy.run.customers.find(c=>c.id===arriving.id);
  assert.ok(guest.path.some(p=>p.z===GUEST_ENTRY.boundaryZ&&Math.abs(p.x)<=GUEST_ENTRY.halfWidth));
  for(const c of copy.run.customers.filter(c=>c.status==='queue'))assert.ok(c.z>=GUEST_ENTRY.queueZ&&Math.abs(c.x)<=.401);
  assert.deepEqual(deserialize(serialize(copy)),copy,'new route saves should resume their exact paths');
});
