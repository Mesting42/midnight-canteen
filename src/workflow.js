import {POS,dishById} from './data.js';

export const WORKFLOW_VERSION=1;
export const WORKSPOTS={
  supply:{x:-2.8,y:.73,z:-2.025},
  board:{x:-2.92,y:1.15,z:-2.35},
  stove:(slot,method='boil')=>({x:-.8+(slot===1?.46:-.46),y:method==='fry'?1.205:1.36,z:-2.55}),
  stoveStand:slot=>({x:-.8+(slot===1?.46:-.46),z:-1.9}),
  prepRack:slot=>({x:-2.92+[0,-.55,.55][slot%3],y:slot<3?1.15:1.28+(Math.floor(slot/3)-1)*.22,z:slot<3?-2.45:-2.82}),
  plateRack:slot=>({x:.68+(slot%3)*.61,y:1.105,z:-2.27-Math.floor(slot/3)*.43}),
};
export const STEP_LABELS={fetch:'从柜中取食材',lay:'把食材放到砧板',chop:'持刀切配',stow:'放好备料盘',pickup:'端起食材',pour:'倒入锅中',scoop:'从锅中盛出',garnish:'摆盘与点缀',lift:'端起成品',deliver:'把餐点放上桌',greet:'招呼并记录点单',payment:'收取餐费',deposit:'收妥餐费',wipe:'擦拭餐桌',collect:'收起脏餐具',wash:'清洗餐具'};

export function claimRack(jobs,key,eligible){
  const used=new Set(jobs.filter(eligible).map(j=>j[key]).filter(Number.isInteger));
  for(let i=0;i<12;i++)if(!used.has(i))return i;
  return 0;
}

export function jobLocation(j){
  if(j.location)return j.location;
  return({new:'supply',preparing:'prep',needsHeat:'prep',heating:'stove',needsPlate:'stove',ready:'plate',carrying:'actor',served:'table'})[j.stage]||'none';
}

export function createTaskPlan(s,t,j,c,tablePosition){
  const step=(name,at,duration,face='counter')=>({name,at:{...at},duration,face});
  const table=t.kind==='clean'?tablePosition(s,Number(t.target)):c?.table!==null&&c?.table!==undefined?tablePosition(s,c.table):null;
  const service=table?{x:table.x,z:table.z+.9}:{x:.7,z:3.9};
  const delivery=table&&t.kind==='serve'?{x:table.x+(c.jobs.indexOf(j.id)===0?-.29:.29),z:table.z+.76}:service;
  const cleaning=table?{x:table.x,z:table.z+.76}:service;
  const prepStand=j?{x:WORKSPOTS.prepRack(j.prepSlot??0).x,z:POS.prep.z}:POS.prep;
  if(t.kind==='prep'){
    const duration=dishById[j.dish].prep*(s.upgrades.includes('prep')?.65:1);
    return[step('fetch',POS.prep,duration*.22),step('lay',POS.prep,duration*.16),step('chop',POS.prep,duration*.52),step('stow',prepStand,duration*.10)];
  }
  if(t.kind==='heat')return[step('pickup',prepStand,.26),step('pour',WORKSPOTS.stoveStand(j.slot),.44)];
  if(t.kind==='plate'){
    const duration=dishById[j.dish].plate;
    const source=jobLocation(j)==='prep'?prepStand:jobLocation(j)==='plate'?POS.plate:WORKSPOTS.stoveStand(j.slot??j.sourceSlot??0);
    return[step(jobLocation(j)==='stove'?'scoop':'pickup',source,duration*.4),step('garnish',{x:WORKSPOTS.plateRack(j.rack??0).x,z:POS.plate.z},duration*.6)];
  }
  if(t.kind==='serve')return[step('lift',{x:WORKSPOTS.plateRack(j.rack??0).x,z:POS.plate.z},.22),step('deliver',delivery,.43,table?'dish':'guest')];
  if(t.kind==='greet')return[step('greet',{x:.9,z:3.55},1,'guest')];
  if(t.kind==='pay')return[step('payment',service,.55,'guest'),step('deposit',service,.45,'guest')];
  if(t.kind==='clean'){
    const duration=s.upgrades.includes('wash')?1.7:3.5;
    return[step('wipe',cleaning,duration*.4,'table'),step('collect',cleaning,duration*.15,'table'),step('wash',POS.sink,duration*.45)];
  }
  return[];
}
