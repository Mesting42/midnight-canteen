import { Engine, newGame, serialize, deserialize } from '../src/engine.js';
import { dishById } from '../src/data.js';
import { mkdir,writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function operate(e) {
  const a=e.actor();if(a.queue.length+(a.task?1:0)>=3)return;
  const actions=e.getActions();
  const score=t=>{
    const job=e.job(t.target),c=e.customer(job?.customer||t.target),pressure=c?Math.max(0,60-c.patience):0;
    return ({pay:110,serve:100,plate:85,heat:80,prep:65,greet:50,clean:35})[t.kind]+pressure-(t.kind==='greet'&&e.s.run.jobs.filter(j=>!['served','waste'].includes(j.stage)).length>=3?55:0);
  };
  actions.sort((a,b)=>score(b)-score(a));
  for(const t of actions)if(e.enqueue(t.kind,t.target))break;
}
export function prepare(e,route='kitchen') {
  const s=e.s;
  const menus={1:['rice','soup'],2:['rice','soup','egg'],3:['rice','soup','salad'],4:['rice','soup','noodle'],5:['rice','soup','pork'],6:['rice','don'],7:['rice','fish'],8:['rice','hotpot'],9:['rice','bento'],10:['rice','egg']};
  e.setMenu(menus[s.day]);e.purchasePlan();
  const desired=route==='kitchen'?['prep','stove','shoes','wash','queue','table','warm']:['wash','table','queue','prep','shoes','stove','warm'];
  for(const id of desired){const cost=({prep:65,stove:85,shoes:70,wash:60,queue:50,table:90,warm:65})[id];if(s.cash>cost+70)e.buyUpgrade(id);}
  if(route==='team'&&s.cash>130){if(s.day>=4)e.hire('server');if(s.day>=7)e.hire('cleaner');}
  e.purchasePlan();e.open();
}
export function runCampaign(seed,route) {
  let e=new Engine(newGame(seed));const days=[];
  for(let day=1;day<=10;day++) {
    prepare(e,route);let ticks=0;
    while(e.s.phase==='open'&&ticks++<4000){operate(e);e.tick(.1);if(ticks%100===0)e.assertInvariants();if(ticks===500)e=new Engine(deserialize(serialize(e.s)));}
    if(e.s.phase!=='summary')throw new Error('Day did not finish');
    days.push({...e.s.result,upgrades:[...e.s.upgrades],staff:[...e.s.staff],stock:{...e.s.stock}});
    if(!e.s.result.passed)return {seed,route,passed:false,days};
    e.nextDay();
  }
  return{seed,route,passed:e.s.phase==='ending',days,cash:e.s.cash,history:e.s.history.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const reports=[];
  for(const route of ['kitchen','team'])for(const seed of [42,87,2026]){const report=runCampaign(seed,route);reports.push(report);console.log(route,seed,report.passed?'PASS':'FAIL',report.days.map(d=>`${d.day}:${d.revenue}/${d.correct}/${d.satisfaction}`).join(' '));}
  await mkdir('docs',{recursive:true});await writeFile('docs/campaign-simulation.json',JSON.stringify({scope:'Headless deterministic simulation through public actions, fixed 0.1-second simulation steps, no state cheats. Not human or real device play.',reports},null,2));
  if(reports.some(r=>!r.passed))process.exitCode=1;
}
