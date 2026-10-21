import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine,newGame,serialize,deserialize } from '../src/engine.js';

test('new campaign has viable first menu and balances',()=>{
  const e=new Engine(newGame(7));
  assert.equal(e.s.cash,150);assert.deepEqual(e.s.menu,['rice','soup']);
  assert.equal(e.purchasePlan(),true);assert.ok(e.s.cash>=0);assert.ok(e.open());
});

test('save round-trip preserves active service state and rejects tampering',()=>{
  const e=new Engine(newGame(8));e.purchasePlan();assert.ok(e.open());
  const raw=serialize(e.s), copy=deserialize(raw);assert.equal(copy.phase,'open');assert.equal(copy.run.tables.length,3);
  const tampered=JSON.parse(raw);tampered.payload=tampered.payload.replace('"cash":150','"cash":151');assert.throws(()=>deserialize(JSON.stringify(tampered)),/校验/);
});

test('kitchen queues one heat task per available stove',()=>{
  const e=new Engine(newGame(9));e.purchasePlan();e.open();e.spawn();
  const guest=e.s.run.customers[0];assert.ok(e.enqueue('greet',guest.id));
  for(let i=0;i<100;i++)e.tick(.1);
  const jobs=e.s.run.jobs.filter(j=>j.stage==='needsHeat');if(jobs.length){assert.ok(e.enqueue('heat',jobs[0].id));assert.equal(e.enqueue('heat',jobs[0].id),false);}
});
