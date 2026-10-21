import { VERSION, INGREDIENTS, dishById, TYPES, UPGRADES, EXPANSIONS, STAFF, POS, DEFAULT_SETTINGS, dailyInfo, dailyGuestCount, recipeCost, stockPlan, expansionReady, staffRole, staffCount, staffHireCost, shopkeeperLimit } from './data.js';
import { advanceTutorial, serviceElapsed } from './tutorial.js';
import {WORKFLOW_VERSION,WORKSPOTS,STEP_LABELS,createTaskPlan,claimRack,jobLocation} from './workflow.js';

export const clone = value => JSON.parse(JSON.stringify(value));
export const SAVE_KEY = 'lantern-canteen:v1';
export const GUEST_ENTRY = Object.freeze({version:4,boundaryZ:4.1,halfWidth:.82,queueZ:4.8,queueGap:.45,queueCapacity:8,insideZ:3.45,outsideZ:4.35});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ACTOR_SPEED=3.8;
export function newGame(seed=Date.now()>>>0) {
  return { version:VERSION, phase:'prep', day:1, mode:'campaign', cash:150, stock:{rice:10,egg:6,veg:12,tofu:8,noodle:0,meat:0,fish:0,broth:8}, upgrades:[], staff:[], menu:['rice','soup'], layout:'classic', seed, rng:seed||1, nextId:1, settings:{...DEFAULT_SETTINGS}, history:[], totalGuests:0, supportUsed:false, opening:null, run:null, result:null };
}
export function checksum(text) { let h=2166136261; for(let i=0;i<text.length;i++) h=Math.imul(h^text.charCodeAt(i),16777619); return (h>>>0).toString(16); }
export function serialize(state) { const payload=JSON.stringify(state); return JSON.stringify({version:VERSION,checksum:checksum(payload),payload,savedAt:new Date().toISOString()}); }
export function deserialize(raw) {
  const data=JSON.parse(raw);
  if(data.version!==VERSION || typeof data.payload!=='string' || checksum(data.payload)!==data.checksum) throw new Error('存档版本或校验不符');
  const s=JSON.parse(data.payload);
  if(!['prep','open','summary','ending'].includes(s.phase)||!Number.isInteger(s.day)||s.day<1||s.day>10||!Number.isFinite(s.cash)||s.cash<0||!Array.isArray(s.menu)||s.menu.length<1||s.menu.some(id=>!dishById[id])||!s.stock||!Array.isArray(s.history)) throw new Error('存档数据不完整');
  if(Object.keys(INGREDIENTS).some(k=>!Number.isInteger(s.stock[k])||s.stock[k]<0)) throw new Error('库存数据损坏');
  if(s.phase==='open'&&(!s.run||!s.opening||!Array.isArray(s.run.customers)||!Array.isArray(s.run.jobs)||!Array.isArray(s.run.actors)||!Array.isArray(s.run.tables))) throw new Error('营业存档不完整');
  s.upgrades=Array.isArray(s.upgrades)?s.upgrades:[];
  s.staff=(Array.isArray(s.staff)?s.staff:[]).map(id=>id==='shopkeeper'?'shopkeeper-1':id);
  s.totalGuests??=(s.history||[]).reduce((sum,item)=>sum+(item.served||0),0);
  s.settings = { ...DEFAULT_SETTINGS, ...s.settings };
  // Old saves used the service aisle as the guest's destination. Re-seat them
  // without changing orders, payments, inventory or their remaining patience.
  for (const c of s.run?.customers || []) {
    if (c.table === null || c.seated !== undefined) continue;
    c.seatSide = -1;
    if (['waiting', 'eating', 'pay'].includes(c.status)) {
      Object.assign(c, seatPosition(s, c.table), { seated: true, path: [] });
    } else if (c.status === 'arriving') c.path = pathToSeat(s, c);
  }
  for(const c of s.run?.customers||[])if(c.type==='couple'&&c.table!==null&&!c.companion){
    const companionSide=-(c.seatSide??-1);
    c.companion={...seatPosition(s,c.table,companionSide),seatSide:companionSide,path:[],seated:!!c.seated,standTimer:0};
    if(c.status==='arriving'){c.companion.x=c.x+.4;c.companion.z=c.z;c.companion.path=pathToSeat(s,{...c.companion,table:c.table,seatSide:companionSide});}
  }
  restoreTableSeats(s);
  migrateGuestRoutes(s);
  return s;
}

// A* on a 0.35 m kitchen grid. Furniture is an obstacle; actors share the aisles.
const STEP=.35, MINX=-4.2, MINZ=-2.1, NX=25, NZ=20;
export function tablePosition(s,index) { const p={...POS.tables[index]}; if(s.layout==='compact'&&index===3) {p.x=2.7;p.z=2.65;} return p; }
export function seatPosition(s, index, side = -1) {
  const p = tablePosition(s, index);
  return { x: p.x + side * .83, z: p.z, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2 };
}
export function seatApproach(s, index, side = -1) {
  const p = tablePosition(s, index);
  return { x: p.x + side * 1.3, z: p.z };
}
function createSeats(){return[-1,1].map(side=>({side,status:'free',customer:null,claim:null}));}
function createTable(index){return{id:index,status:'free',customer:null,claim:null,seats:createSeats()};}
function refreshTableStatus(table){
  const occupied=table.seats.filter(seat=>seat.status==='occupied');
  table.status=occupied.length?'occupied':table.seats.some(seat=>seat.status==='dirty')?'dirty':'free';
  table.customer=occupied[0]?.customer??null;
}
function restoreTableSeats(s){
  const r=s.run;if(!r)return;
  for(const table of r.tables){
    if(!Array.isArray(table.seats)){
      table.seats=createSeats();
      if(table.status==='dirty')table.seats[0].status='dirty';
    }else{
      table.seats=table.seats.slice(0,2);
      for(const side of [-1,1])if(!table.seats.some(seat=>seat.side===side))table.seats.push({side,status:'free',customer:null,claim:null});
    }
    for(const seat of table.seats){seat.customer??=null;seat.claim??=null;}
  }
  for(const c of r.customers){
    if(!Number.isInteger(c.table)||!['arriving','waiting','eating','pay'].includes(c.status))continue;
    const table=r.tables[c.table];if(!table)continue;
    c.seatSide=c.seatSide??-1;
    const primary=table.seats.find(seat=>seat.side===c.seatSide);
    if(primary&&primary.status==='free')Object.assign(primary,{status:'occupied',customer:c.id});
    if(c.type==='couple'){
      if(c.companion)c.companion.seatSide??=-c.seatSide;
      const companion=table.seats.find(seat=>seat.side===-c.seatSide);
      if(companion&&companion.status==='free')Object.assign(companion,{status:'occupied',customer:c.id});
    }
  }
  for(const table of r.tables)refreshTableStatus(table);
}
function pathToSeat(s, c) {
  const side = c.seatSide ?? -1;
  const approach = seatApproach(s, c.table, side);
  const entry=entryRoute(c,side),start=entry.at(-1)||c;
  return [...entry,...findPath(s,start,approach),seatPosition(s,c.table,side)];
}
export function queuePosition(slot){return{x:slot%2===0?-.4:.4,z:GUEST_ENTRY.queueZ+Math.floor(slot/2)*GUEST_ENTRY.queueGap};}
function reserveQueueSlots(used,type,limit=GUEST_ENTRY.queueCapacity){
  for(let i=0;i<limit;i++){
    if(used.has(i))continue;
    if(type==='couple'){if(i%2||used.has(i+1)||i+1>=limit)continue;return[i,i+1];}
    return[i];
  }
  return null;
}
function syncQueue(s,instant=false){
  if(!s.run)return;
  const used=new Set();
  for(const c of s.run.customers.filter(c=>c.status==='queue')){
    const slots=reserveQueueSlots(used,c.type,32);slots.forEach(i=>used.add(i));
    const target=queuePosition(slots[0]);
    if(instant){Object.assign(c,target,{path:[],yaw:Math.PI,entered:false});}
    else if(c.queueSlots?.[0]!==slots[0])c.path=[target];
    c.queueSlots=slots;
    if(c.type==='couple'){
      const next=queuePosition(slots[1]);
      if(!c.companion)c.companion={...next,yaw:Math.PI,seated:false,entered:false,path:[],standTimer:0};
      if(instant)Object.assign(c.companion,next,{path:[],yaw:Math.PI,entered:false});
      else if(c.companion.queueSlot!==slots[1])c.companion.path=[next];
      c.companion.queueSlot=slots[1];
    }
  }
}
function entryRoute(p,side=-1){
  if(p.z<GUEST_ENTRY.boundaryZ-.05)return[];
  const lane=side<0?-.3:.3;
  // Outside guests first walk to the door apron. Only this narrow lane may
  // cross the facade, even when the shortest route to a table lies to the side.
  const route=[];
  if(p.z>GUEST_ENTRY.queueZ+.05){const edge=p.x<0?-1.05:1.05;route.push({x:edge,z:p.z},{x:edge,z:GUEST_ENTRY.outsideZ});}
  if(p.z>GUEST_ENTRY.boundaryZ)route.push({x:lane,z:GUEST_ENTRY.outsideZ},{x:lane,z:GUEST_ENTRY.boundaryZ});
  route.push({x:lane,z:GUEST_ENTRY.insideZ});return route;
}
function pickupRoute(s,p){
  if(p.z<GUEST_ENTRY.boundaryZ)return[...findPath(s,p,{x:.65,z:GUEST_ENTRY.insideZ}),{x:.65,z:GUEST_ENTRY.boundaryZ},{x:.7,z:GUEST_ENTRY.outsideZ}];
  const edge=p.x<0?-1.05:1.05;
  return[{x:edge,z:Math.max(p.z,GUEST_ENTRY.outsideZ)},{x:edge,z:GUEST_ENTRY.outsideZ},{x:.7,z:GUEST_ENTRY.outsideZ}];
}
function outsideExit(p,side=-1){
  const lane=p.x<0?-1:1;
  return[{x:lane*1.1,z:Math.max(p.z,GUEST_ENTRY.outsideZ)},{x:lane*3.1,z:5.65},{x:side*5.15,z:8.6}];
}
function exitRoute(s,p,table=null,side=-1){
  if(p.z>=GUEST_ENTRY.boundaryZ)return outsideExit(p,side);
  const route=[];let start=p;
  if(table!==null){const seat=seatPosition(s,table,side);if(Math.hypot(p.x-seat.x,p.z-seat.z)<.48){start=seatApproach(s,table,side);route.push(start);}}
  const lane=side<0?.65:.05,inside={x:lane,z:GUEST_ENTRY.insideZ};
  return[...route,...findPath(s,start,inside),{x:lane,z:GUEST_ENTRY.boundaryZ},{x:lane,z:GUEST_ENTRY.outsideZ},{x:lane*1.1,z:GUEST_ENTRY.outsideZ},{x:lane*3.1,z:5.65},{x:side*5.15,z:8.6}];
}
function migrateGuestRoutes(s){
  const r=s.run;if(!r||r.guestRouteVersion===GUEST_ENTRY.version)return;
  syncQueue(s,true);
  for(const c of r.customers){
    if(c.status==='arriving'){
      if(c.z>3.8&&Math.abs(c.x)>GUEST_ENTRY.halfWidth){c.x=clamp(c.x,-1.05,1.05);c.z=Math.max(c.z,GUEST_ENTRY.outsideZ);}
      c.path=c.table===null?pickupRoute(s,c):pathToSeat(s,c);
      if(c.companion)c.companion.path=pathToSeat(s,{...c.companion,table:c.table,seatSide:c.companion.seatSide??-(c.seatSide??-1)});
    }else if(c.status==='leaving'){
      c.path=exitRoute(s,c,c.table,c.seatSide??-1);
      if(c.companion)c.companion.path=exitRoute(s,c.companion,c.table,c.companion.seatSide??-(c.seatSide??-1));
    }
    if(c.type==='takeaway'&&c.table===null&&['waiting','eating','pay'].includes(c.status))Object.assign(c,{x:.7,z:GUEST_ENTRY.outsideZ,path:[],yaw:Math.PI,entered:false});
  }
  for(const a of r.actors)if(a.path?.length){const end=a.path.at(-1);a.path=findPath(s,a,end);}
  r.guestRouteVersion=GUEST_ENTRY.version;
}
function blocked(s,x,z) {
  if(x<MINX||x>4.2||z<MINZ||z>4.55) return true;
  if(z>3.8&&Math.abs(x)>GUEST_ENTRY.halfWidth)return true;
  for(let i=0;i<(s.upgrades.includes('table')?4:3);i++) {const p=tablePosition(s,i);if(Math.abs(x-p.x)<1.14&&Math.abs(z-p.z)<.53) return true;}
  return false;
}
export function findPath(s,start,end) {
  const cell=p=>[clamp(Math.round((p.x-MINX)/STEP),0,NX-1),clamp(Math.round((p.z-MINZ)/STEP),0,NZ-1)];
  const [sx,sz]=cell(start),[ex,ez]=cell(end), key=(x,z)=>x+z*NX;
  const from=key(sx,sz), to=key(ex,ez), open=[{x:sx,z:sz,g:0,f:0}], seen=new Map([[from,0]]), parent=new Map();
  for(let n=0;open.length&&n<1200;n++) {
    open.sort((a,b)=>a.f-b.f);const cur=open.shift(), ck=key(cur.x,cur.z);
    if(ck===to) { const points=[];let k=to;while(k!==from){points.push({x:MINX+(k%NX)*STEP,z:MINZ+Math.floor(k/NX)*STEP});k=parent.get(k);if(k===undefined)return [];} points.reverse();points.push({...end});return points; }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {const x=cur.x+dx,z=cur.z+dz,k=key(x,z),g=cur.g+1;if(x<0||x>=NX||z<0||z>=NZ||blocked(s,MINX+x*STEP,MINZ+z*STEP)&&k!==to||g>=(seen.get(k)??Infinity))continue;seen.set(k,g);parent.set(k,ck);open.push({x,z,g,f:g+Math.abs(x-ex)+Math.abs(z-ez)});}
  }
  return [];
}

export class Engine {
  constructor(state=newGame(),notify=()=>{}) { this.s=state;this.notify=notify;this.events=[];restoreTableSeats(this.s);this.restoreWorkflow(); }
  restoreWorkflow(){
    const r=this.s.run;if(!r||r.workflowVersion===WORKFLOW_VERSION)return;
    for(const j of r.jobs){
      j.location=j.stage==='needsPlate'?'plate':jobLocation(j);j.sourceSlot=j.slot??0;
      j.prepSlot=claimRack(r.jobs,'prepSlot',p=>p!==j&&p.location==='prep');
      j.rack=claimRack(r.jobs,'rack',p=>p!==j&&p.location==='plate');
      j.visual=['new','preparing'].includes(j.stage)?'raw':j.stage==='needsHeat'?'chopped':j.stage==='heating'?'cooking':'plated';
    }
    for(const a of r.actors){
      a.carriedJob=null;if(!a.task)continue;
      const t=a.task,j=this.job(t.target),c=this.customer(j?.customer||t.target);
      const carried=t.kind==='serve'&&t.picked;
      t.stockTaken=j?.stage==='preparing';t.plan=createTaskPlan(this.s,t,j,c,tablePosition);t.stepIndex=carried?1:t.stockTaken?2:0;
      if(carried&&j){a.carriedJob=j.id;j.carrier=a.id;j.location='actor';}
      else a.holding=null;
      const step=t.plan[t.stepIndex];if(step){t.step=step.name;t.phase='walk';t.progress=0;t.duration=step.duration;a.path=findPath(this.s,a,step.at);}
    }
    r.workflowVersion=WORKFLOW_VERSION;
  }
  emit(type,message='',data={}) { this.events.push({type,message,...data});if(this.events.length>80)this.events.shift();this.notify(type,message,data); }
  id(prefix) {return prefix+this.s.nextId++;}
  rand() { let t=this.s.rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296; }
  buyStock(key,qty=1) {
    const s=this.s, item=INGREDIENTS[key];qty=Math.floor(qty);
    if(s.phase!=='prep'||!item||qty<1||qty>100||s.cash<item.cost*qty)return false;
    s.cash-=item.cost*qty;s.stock[key]+=qty;this.emit('buy',`${item.name} +${qty}`);return true;
  }
  purchasePlan() {
    if(this.s.phase!=='prep')return false;
    const p=stockPlan(this.s);let cost=0;for(const [k,v] of Object.entries(p))cost+=Math.max(0,v-this.s.stock[k])*INGREDIENTS[k].cost;
    if(this.s.cash<cost) {this.emit('notice',`补足预计库存需 ¥${cost}，可单独购买常用食材。`);return false;}
    for(const [k,v] of Object.entries(p))this.s.stock[k]=Math.max(v,this.s.stock[k]);this.s.cash-=cost;advanceTutorial(this.s,'stock');this.emit('buy',`已补足建议库存 · ¥${cost}`);return true;
  }
  buyUpgrade(id) {
    const s=this.s,u=UPGRADES.find(u=>u.id===id);
    const expansion=EXPANSIONS.find(item=>item.id===id);
    if(s.phase!=='prep'||!u||s.day<u.day||s.cash<u.cost||s.upgrades.includes(id)||expansion&&!expansionReady(s,expansion))return false;
    s.cash-=u.cost;s.upgrades.push(id);this.emit('upgrade',`已添置${u.name}`);return true;
  }
  hire(id) {
    const s=this.s,p=STAFF.find(p=>p.id===id),role=staffRole(id);
    const cost=staffHireCost(s,role);
    if(s.phase!=='prep'||!p||s.day<p.day||s.cash<cost)return false;
    let hiredId=id;
    if(role==='shopkeeper'){
      if(staffCount(s,role)>=shopkeeperLimit(s))return false;
      const next=(s.staff||[]).reduce((highest,staffId)=>staffRole(staffId)===role?Math.max(highest,Number(staffId.split('-')[1])||1):highest,0)+1;
      hiredId=`shopkeeper-${next}`;
    }else if(s.staff.includes(id))return false;
    s.cash-=cost;s.staff.push(hiredId);this.emit('upgrade',`${p.name}加入小店 · 招募费 ¥${cost}`);return true;
  }
  dismiss(id) {const s=this.s;if(s.phase!=='prep')return false;let target=id;if(!s.staff.includes(target)&&staffRole(id)==='shopkeeper')target=[...s.staff].reverse().find(staffId=>staffRole(staffId)==='shopkeeper');if(!target)return false;s.staff=s.staff.filter(x=>x!==target);return true;}
  setMenu(ids) {const s=this.s;ids=[...new Set(ids)].filter(id=>dishById[id]?.day<=s.day);if(s.phase!=='prep'||ids.length<1||ids.length>4)return false;s.menu=ids;return true;}
  support() {const s=this.s;if(s.phase!=='prep'||s.supportUsed||s.cash>=35)return false;s.cash+=45;s.stock.rice+=5;s.stock.veg+=5;s.supportUsed=true;this.emit('notice','街坊互助金 ¥45 与饭团原料已送到。每个营业日限一次。');return true;}
  open() {
    const s=this.s;if(s.phase!=='prep')return false;
    if(!s.menu.some(id=>Object.entries(dishById[id].ingredients).every(([k,v])=>s.stock[k]>=v))) {this.emit('notice','至少准备一份当日菜品的原料才能开门。');return false;}
    s.opening=clone({...s,opening:null,run:null,result:null});s.phase='open';s.rng=(s.seed+s.day*7919)>>>0;
    const info=dailyInfo(s), tableCount=s.upgrades.includes('table')?4:3,guestCount=dailyGuestCount(s);
    s.run={elapsed:0,closed:false,spawnIndex:0,schedule:[],customers:[],jobs:[],tables:Array.from({length:tableCount},(_,i)=>createTable(i)),actors:[{id:'chef',x:1,z:2.3,yaw:0,path:[],task:null,queue:[],status:'等待指令',holding:null},...s.staff.map((id,i)=>({id,x:1.8+(i%3)*.45,z:2.25+Math.floor(i/3)*.42,yaw:0,path:[],task:null,queue:[],status:'寻找工作',holding:null}))],stats:{revenue:0,base:0,tips:0,ingredientCost:0,correct:0,served:0,lost:0,satisfactionSum:0,waste:0,wages:0},settled:false,guide:0};
    for(let i=0;i<guestCount;i++) {
      const wave=i<Math.ceil(guestCount/2)?i*9:info.duration*.5+(i-Math.ceil(guestCount/2))*8;
      s.run.schedule.push(4+wave+this.rand()*2);
    }
    s.run.guestRouteVersion=GUEST_ENTRY.version;s.run.workflowVersion=WORKFLOW_VERSION;
    advanceTutorial(s,'open');if(s.tutorial?.active)s.run.schedule[0]=1;
    this.emit('bell','小店开门了，招呼入口的客人吧。');return true;
  }
  customer(id) {return this.s.run?.customers.find(c=>c.id===id);}
  job(id) {return this.s.run?.jobs.find(j=>j.id===id);}
  actor(id='chef') {return this.s.run?.actors.find(a=>a.id===id);}
  findSeats(type='student') {
    if(type==='takeaway')return null;
    for(const table of this.s.run?.tables||[]){
      if(table.seats.some(seat=>seat.status==='dirty'))continue;
      const free=table.seats.filter(seat=>seat.status==='free'&&!seat.claim);
      if(type==='couple'&&free.length>=2)return{table,seats:free.slice(0,2)};
      if(type!=='couple'&&free.length)return{table,seats:[free[0]]};
    }
    return null;
  }
  canSeat(type='student'){return type==='takeaway'||!!this.findSeats(type);}
  seatingMessage(type='student'){
    const tables=this.s.run?.tables||[],dirty=tables.filter(t=>t.seats.some(seat=>seat.status==='dirty'));
    const clearable=dirty.filter(t=>t.status==='dirty');
    if(clearable.length){const names=clearable.map(t=>`${t.id+1}号桌`).join('、');return `${names}还有餐具待收；先清洁空桌，再接待排队客人。`;}
    if(dirty.length){const names=dirty.map(t=>`${t.id+1}号桌`).join('、');return `${names}还有餐具待收，但同桌客人仍在用餐；等他们离店后再清洁。`;}
    const used=tables.reduce((sum,t)=>sum+t.seats.filter(seat=>seat.status==='occupied').length,0),capacity=tables.length*2;
    if(used>=capacity)return `${used}/${capacity} 个座位都有人了。等客人离店并清洁桌面后再接待，或接待外带客。`;
    return type==='couple'?`目前没有同桌的两把空椅；可先接待单人客或外带客。`:`暂时没有可用空椅；请稍后再接待。`;
  }
  enqueue(kind,target,actorId='chef') {
    const s=this.s,r=s.run,a=this.actor(actorId);if(s.phase!=='open'||!a)return false;
    if(a.queue.length+(a.task?1:0)>=(s.upgrades.includes('queue')?10:6)) {this.emit('notice','指令队列已满，可取消还没开始的工作。');return false;}
    if(!['greet','clean','pay','prep','heat','plate','serve'].includes(kind))return false;
    let c,j,t,seatReservation=null;
    if(kind==='greet') {
      c=this.customer(target);if(r.closed||!c||c.status!=='queue'||c.claim)return false;
      if(c.type!=='takeaway'){
        const found=this.findSeats(c.type);
        if(!found){this.emit('warning',this.seatingMessage(c.type));return false;}
        seatReservation={table:found.table.id,sides:found.seats.map(seat=>seat.side)};
      }
    }
    else if(kind==='clean') {t=r.tables[target];if(!t||t.status!=='dirty'||t.claim)return false;}
    else if(kind==='pay') {c=this.customer(target);if(!c||c.status!=='pay'||c.claim)return false;}
    else {j=this.job(target);if(!j||j.claim)return false;c=this.customer(j.customer);if(!c||!['waiting','arriving'].includes(c.status))return false;
      if(kind==='prep'&&j.stage!=='new'||kind==='heat'&&j.stage!=='needsHeat'||kind==='plate'&&j.stage!=='needsPlate'||kind==='serve'&&j.stage!=='ready')return false;
      if(kind==='heat'&&!this.freeStove()) {this.emit('notice','炉位正在使用，先处理别的料理。');return false;}
      if(kind==='prep') {
        const reserved={};
        for(const actor of r.actors)for(const pending of [...(actor.task?[actor.task]:[]),...actor.queue]) {
          if(pending.kind!=='prep'||pending.stockTaken)continue;
          const reservedJob=this.job(pending.target);if(!reservedJob||reservedJob.stage!=='new')continue;
          for(const [key,value]of Object.entries(dishById[reservedJob.dish].ingredients))reserved[key]=(reserved[key]||0)+value;
        }
        if(!Object.entries(dishById[j.dish].ingredients).every(([k,v])=>s.stock[k]-(reserved[k]||0)>=v)) {this.emit('notice','原料不足。这道菜无法开做，试试其他订单。');return false;}
      }
    }
    const task={id:this.id('task'),kind,target,seatReservation,progress:0,duration:0,phase:'walk'};
    if(c&&['greet','pay'].includes(kind))c.claim=task.id; if(j)j.claim=task.id;if(t)t.claim=task.id;
    if(seatReservation){const table=r.tables[seatReservation.table];for(const side of seatReservation.sides){const seat=table.seats.find(item=>item.side===side);if(seat)seat.claim=task.id;}}
    // Reserving a stove at enqueue prevents two queued jobs from claiming one slot.
    if(kind==='heat'){j.slot=this.freeStove()-1;j.reservedHeat=true;}
    a.queue.push(task);this.emit('click');return true;
  }
  freeStove() {const used=new Set(this.s.run.jobs.filter(j=>!['served','waste'].includes(j.stage)&&(j.location==='stove'||j.stage==='heating'||j.reservedHeat)).map(j=>j.slot));for(let i=0;i<(this.s.upgrades.includes('stove')?2:1);i++)if(!used.has(i))return i+1;return 0;}
  cancel(taskId) {const a=this.actor();const index=a?.queue.findIndex(t=>t.id===taskId);if(index===undefined||index<0)return false;this.release(a.queue[index]);a.queue.splice(index,1);this.emit('notice','已取消尚未开始的指令，原料未扣除。');return true;}
  release(t) {const c=this.customer(t.target),j=this.job(t.target),table=this.s.run.tables[t.target];if(c?.claim===t.id)c.claim=null;if(j?.claim===t.id){j.claim=null;j.reservedHeat=false;}if(table?.claim===t.id)table.claim=null;if(t.seatReservation){const reserved=this.s.run.tables[t.seatReservation.table];for(const side of t.seatReservation.sides){const seat=reserved?.seats.find(item=>item.side===side);if(seat?.claim===t.id)seat.claim=null;}}}
  valid(t) {const c=this.customer(t.target),j=this.job(t.target);if(t.kind==='greet')return c?.status==='queue'&&(!t.seatReservation||t.seatReservation.sides.every(side=>{const seat=this.s.run.tables[t.seatReservation.table]?.seats.find(item=>item.side===side);return seat?.status==='free'&&seat.claim===t.id;}));if(t.kind==='pay')return c?.status==='pay';if(t.kind==='clean')return this.s.run.tables[t.target]?.status==='dirty';return j&&!['served','waste'].includes(j.stage)&&['waiting','arriving'].includes(this.customer(j.customer)?.status);}
  targetFor(t) {const s=this.s,j=this.job(t.target),c=this.customer(j?.customer||t.target);if(t.kind==='greet')return{x:.9,z:3.55};if(t.kind==='prep')return POS.prep;if(t.kind==='heat')return POS.stove;if(t.kind==='plate'||t.kind==='serve'&&!t.picked)return POS.plate;if(t.kind==='clean'){const p=tablePosition(s,Number(t.target));return{x:p.x,z:p.z+.9};}if(t.kind==='pay')return c?.table===null?{x:.7,z:3.9}:{...tablePosition(s,c.table),z:tablePosition(s,c.table).z+.9};if(t.kind==='serve')return c?.table===null?{x:.7,z:3.9}:{...tablePosition(s,c.table),z:tablePosition(s,c.table).z+.9};return POS.entrance;}
  taskName(t) {const j=this.job(t.target),c=this.customer(t.target);return ({greet:`接待 ${c?.label||'客人'}`,prep:`切配 ${dishById[j?.dish]?.name||''}`,heat:`上锅 ${dishById[j?.dish]?.name||''}`,plate:`装盘 ${dishById[j?.dish]?.name||''}`,serve:`送餐 ${dishById[j?.dish]?.name||''}`,pay:`收款 ${c?.label||''}`,clean:`清洁 ${Number(t.target)+1} 号桌`})[t.kind];}
  assign(a) {
    while(a.queue.length){
      const t=a.queue.shift();if(!this.valid(t)){this.release(t);continue;}
      const j=this.job(t.target),c=this.customer(j?.customer||t.target);
      if(t.kind==='prep')j.prepSlot=claimRack(this.s.run.jobs,'prepSlot',p=>p!==j&&['prep','supply'].includes(p.location));
      if(t.kind==='plate'&&j.rack===undefined)j.rack=claimRack(this.s.run.jobs,'rack',p=>p!==j&&['plate','actor'].includes(p.location));
      t.plan=createTaskPlan(this.s,t,j,c,tablePosition);a.task=t;this.beginTaskStep(a,0);break;
    }
    if(!a.task)a.status=a.id==='chef'?'等待指令':'无目标 · 待命';
  }
  beginTaskStep(a,index){
    const t=a.task,step=t.plan[index];t.stepIndex=index;t.step=step.name;t.phase='walk';t.progress=0;t.duration=step.duration;
    a.path=findPath(this.s,a,step.at);a.status=STEP_LABELS[step.name]||this.taskName(t);
    if(!a.path.length){this.release(t);a.task=null;a.holding=null;a.carriedJob=null;this.emit('notice','通路受阻，已释放指令。');}
  }
  startWork(a) {
    const t=a.task,j=this.job(t.target),s=this.s;
    if(!this.valid(t)){this.release(t);a.task=null;a.holding=null;a.carriedJob=null;return;}
    if(t.step==='fetch'&&!t.stockTaken) {
      const d=dishById[j.dish];if(!Object.entries(d.ingredients).every(([k,v])=>s.stock[k]>=v)){this.release(t);a.task=null;this.emit('notice','库存已用完，这份料理没有扣料。');return;}
      for(const[k,v]of Object.entries(d.ingredients))s.stock[k]-=v;s.run.stats.ingredientCost+=recipeCost(d);j.stage='preparing';j.started=s.run.elapsed;j.location='supply';j.visual='raw';t.stockTaken=true;
    }
    if(['pickup','scoop','lift'].includes(t.step)){t.sourceLocation=jobLocation(j);t.sourceSlot=j.slot??j.sourceSlot??0;}
    const face=t.plan?.[t.stepIndex]?.face;
    if(face==='counter')a.yaw=Math.PI;
    else if(face==='cashier')a.yaw=Math.PI/2;
    else if(face==='table'){const c=this.customer(j?.customer),p=tablePosition(s,t.kind==='clean'?Number(t.target):c.table);a.yaw=Math.atan2(p.x-a.x,p.z-a.z);}
    else if(face==='dish')a.yaw=Math.PI;
    else if(t.kind==='greet'){const c=this.customer(t.target);a.yaw=Math.atan2(c.x-a.x,c.z-a.z);}
    else {const c=this.customer(j?.customer||t.target);if(c)a.yaw=Math.atan2(c.x-a.x,c.z-a.z);}
    t.phase='work';t.progress=0;this.emit(t.step==='chop'?'chop':t.step==='wash'?'wash':t.step==='garnish'?'plate':'step');
  }
  complete(a) {
    const s=this.s,r=s.run,t=a.task,j=this.job(t.target),c=this.customer(t.target);
    const completedEvents=[],done=(...event)=>completedEvents.push(event);
    if(!this.valid(t)){this.release(t);a.task=null;a.holding=null;a.carriedJob=null;return;}
    if(t.plan&&t.stepIndex<t.plan.length-1){
      if(t.step==='fetch'){j.location='actor';j.carrier=a.id;a.holding=j.dish;a.carriedJob=j.id;}
      if(t.step==='lay'){j.location='prep';j.carrier=null;a.holding=null;a.carriedJob=null;}
      if(t.step==='chop'){j.location='actor';j.carrier=a.id;j.visual='chopped';a.holding=j.dish;a.carriedJob=j.id;}
      if(['pickup','scoop','lift'].includes(t.step)){
        j.location='actor';j.carrier=a.id;a.holding=j.dish;a.carriedJob=j.id;t.picked=true;
        if(t.kind==='serve')j.stage='carrying';
        if(t.kind==='plate'){j.sourceSlot=j.slot??j.sourceSlot??0;j.slot=null;j.visual='cooked';}
      }
      if(t.step==='payment')a.holding='cash';
      if(t.step==='collect'){a.holding='dirty';r.tables[t.target].cleared=true;}
      this.beginTaskStep(a,t.stepIndex+1);this.emit('step');return;
    }
    if(t.kind==='greet') {
      let table=null,sides=[];
      if(c.type!=='takeaway'){
        const reservation=t.seatReservation;
        table=r.tables[reservation?.table];sides=reservation?.sides||[];
        if(!table||!sides.length){const found=this.findSeats(c.type);table=found?.table||null;sides=found?.seats.map(seat=>seat.side)||[];}
        if(!table||!sides.length){this.release(t);a.task=null;this.emit('warning',this.seatingMessage(c.type));return;}
        c.table=table.id;c.seatSide=sides[0];
        for(const side of sides){const seat=table.seats.find(item=>item.side===side);if(seat){seat.status='occupied';seat.customer=c.id;seat.claim=null;}}
        refreshTableStatus(table);
      }else{c.table=null;c.seatSide=-1;}
      c.label=c.table===null?`外带 ${c.serial}`:`${c.table+1}号桌 ${sides.length>1?'A+B座':sides[0]<0?'A座':'B座'}`;c.status='arriving';c.seated=false;
      c.path=c.table===null?pickupRoute(s,c):pathToSeat(s,c);
      if(c.type==='couple'){
        c.companion=c.companion||{x:c.x+.43,z:c.z,yaw:c.yaw,seated:false,standTimer:0};
        c.companion.seatSide=-c.seatSide;
        c.companion.path=pathToSeat(s,{...c.companion,table:c.table,seatSide:c.companion.seatSide});
      }
      syncQueue(s);
      const count=c.type==='couple'&&s.day>=6?2:1;
      for(let i=0;i<count;i++){let dish=s.menu[Math.floor(this.rand()*s.menu.length)];if(c.type==='neighbor'&&s.menu.includes('soup'))dish='soup';if(c.type==='artist'&&s.menu.includes('salad'))dish='salad';const item={id:this.id('job'),customer:c.id,dish,stage:'new',claim:null,slot:null,reservedHeat:false,progress:0,readyAt:0};r.jobs.push(item);c.jobs.push(item.id);}
      advanceTutorial(s,'greet',c);
      r.guide=Math.max(r.guide,1);done('order',`${c.label}已点单`);
    } else if(t.kind==='prep'){j.stage=dishById[j.dish].method==='assemble'?'needsPlate':'needsHeat';j.location='prep';j.carrier=null;j.visual='chopped';r.guide=Math.max(r.guide,2);advanceTutorial(s,'prep',this.customer(j.customer),j);}
    else if(t.kind==='heat'){j.stage='heating';j.location='stove';j.carrier=null;j.sourceSlot=j.slot;j.visual='cooking';j.progress=0;j.reservedHeat=false;done(dishById[j.dish].method==='boil'?'boil':'fry');}
    else if(t.kind==='plate'){j.stage='ready';j.location='plate';j.carrier=null;j.visual='plated';j.readyAt=r.elapsed;r.guide=Math.max(r.guide,3);advanceTutorial(s,'plate',this.customer(j.customer),j);done('ready','一道料理做好了，可以送餐。');}
    else if(t.kind==='serve') {
      const guest=this.customer(j.customer);j.stage='served';j.location='table';j.carrier=null;a.holding=null;guest.served++;r.stats.correct++;r.guide=Math.max(r.guide,4);done('serve');
      this.startEating(guest);advanceTutorial(s,'serve',guest,j);
    } else if(t.kind==='pay') {
      if(!c.paid){const type=TYPES.find(x=>x.id===c.type),base=c.jobs.reduce((v,id)=>v+dishById[this.job(id).dish].price,0),tip=Math.round(base*type.tip*c.satisfaction/100);c.paid=true;s.cash+=base+tip;r.stats.base+=base;r.stats.tips+=tip;r.stats.revenue+=base+tip;r.guide=Math.max(r.guide,5);advanceTutorial(s,'pay',c);done('cash',`收到 ¥${base} + 小费 ¥${tip}`);this.leave(c,false);}
    } else if(t.kind==='clean'){const table=r.tables[t.target];for(const seat of table.seats)if(seat.status==='dirty')Object.assign(seat,{status:'free',customer:null,claim:null});refreshTableStatus(table);table.cleared=false;r.guide=Math.max(r.guide,6);if(!s.tutorial?.active||s.tutorial.table===Number(t.target))advanceTutorial(s,'clean');done('wash','餐桌收拾好了。');}
    this.release(t);a.task=null;a.holding=null;a.carriedJob=null;
    if(['serve','pay','clean'].includes(t.kind)&&!a.queue.length){a.path=findPath(s,a,{x:a.id==='chef'?1:2.2,z:-1.3});a.status='回到厨房待命';}
    // UI notifications may immediately persist a save. Publish only after the
    // whole handoff, payment or cleanup has reached a consistent state.
    for(const event of completedEvents)this.emit(...event);
  }
  startEating(c) {
    if(c.status!=='waiting'||c.companion&&!c.companion.seated||!c.jobs.length||!c.jobs.every(id=>this.job(id)?.stage==='served'))return;
    c.status='eating';c.timer=0;
    c.satisfaction=clamp(55+45*c.patience/c.maxPatience-(c.stale?8:0),0,100);
    this.s.run.stats.served++;this.s.run.stats.satisfactionSum+=c.satisfaction;
  }
  leave(c,lost,reason='') {
    const r=this.s.run;if(['leaving','gone'].includes(c.status))return;let tableNotice='';const warning=lost?(reason||`${c.label}等太久离开了。`):'';
    if(lost){r.stats.lost++;for(const id of c.jobs){const j=this.job(id);if(j&&!['served','waste'].includes(j.stage)){if(j.stage!=='new')r.stats.waste++;j.stage='waste';j.claim=null;j.reservedHeat=false;j.location='none';j.carrier=null;j.slot=null;}}}
    if(c.table!==null){const t=r.tables[c.table];let soiled=false;for(const seat of t.seats)if(seat.status==='occupied'&&seat.customer===c.id){Object.assign(seat,{status:'dirty',customer:null,claim:null});soiled=true;}if(soiled){t.claim=null;refreshTableStatus(t);tableNotice=t.status==='dirty'?`${c.label}离店了，${t.id+1}号桌还有餐具待收。`:`${t.id+1}号桌有餐具待收；另一位客人离店后才能清洁整桌。`;}}
    c.claim=null;c.status='leaving';c.standTimer=c.seated?.45:0;c.seated=false;
    c.path=exitRoute(this.s,c,c.table,c.seatSide??-1);
    if(c.companion){const p=c.companion,side=p.seatSide??-(c.seatSide??-1);p.standTimer=p.seated?.65:0;p.seated=false;p.path=exitRoute(this.s,p,c.table,side);}
    syncQueue(this.s);
    for(const a of r.actors){if(a.task&&!this.valid(a.task)){this.release(a.task);a.task=null;a.path=[];a.holding=null;a.carriedJob=null;}a.queue=a.queue.filter(t=>{if(this.valid(t))return true;this.release(t);return false;});}
    if(warning)this.emit('warning',warning);
    if(tableNotice)this.emit('table-dirty',tableNotice);
  }
  spawn() {
    const s=this.s,r=s.run;if(!r||r.closed)return false;const guestLimit=7+Number(s.upgrades.includes('table'))*2+Number(s.upgrades.includes('service'))*2;if(r.customers.filter(c=>!['gone','leaving'].includes(c.status)).length>=guestLimit)return false;
    let choices=TYPES.filter(t=>t.id!=='couple'||s.day>=6);if(s.day<3)choices=choices.filter(t=>t.id!=='takeaway');
    let type=choices[Math.floor(this.rand()*choices.length)];if(s.day===5&&r.spawnIndex%2===0)type=TYPES[5];if(s.day>=6&&r.spawnIndex%4===2)type=TYPES[4];if(s.tutorial?.active&&r.spawnIndex===0)type=TYPES[0];
    syncQueue(s);
    const used=new Set(r.customers.filter(c=>c.status==='queue').flatMap(c=>c.queueSlots));
    const slots=reserveQueueSlots(used,type.id);if(!slots)return false;
    const patience=type.patience+(dailyInfo(s).weather==='rain'?15:0),id=this.id('guest'),side=r.spawnIndex%2===0?-1:1;
    const approach=(target,offset=0)=>[{x:side*3.6+offset,z:7.85},{x:side*2.1+offset,z:6.2},{x:target.x,z:target.z}];
    const start={x:side*3.85,z:8.8},target=queuePosition(slots[0]);
    const c={id,type:type.id,serial:r.spawnIndex+1,label:`等候 ${r.spawnIndex+1}`,status:'queue',table:null,...start,queueSlots:slots,path:approach(target),approachingMall:true,yaw:side<0?Math.PI/2:-Math.PI/2,seated:false,entered:false,patience,maxPatience:patience,claim:null,jobs:[],served:0,paid:false,timer:0,satisfaction:0};
    if(c.type==='couple')c.companion={...start,x:start.x+.55,...{queueSlot:slots[1],yaw:c.yaw,seated:false,entered:false,path:approach(queuePosition(slots[1]),.55),standTimer:0}};
    r.customers.push(c);r.spawnIndex++;this.emit('bell','有客人到了。');return true;
  }
  move(a,dt,speed) {if(!a.path.length)return false;let budget=dt*speed;while(a.path.length&&budget>0){const p=a.path[0],dx=p.x-a.x,dz=p.z-a.z,d=Math.hypot(dx,dz);a.yaw=Math.atan2(dx,dz);if(d<=budget){a.x=p.x;a.z=p.z;a.path.shift();budget-=d;}else{a.x+=dx/d*budget;a.z+=dz/d*budget;budget=0;}}return true;}
  autoStaff(a) {
    if(a.task||a.queue.length)return;
    const r=this.s.run,role=staffRole(a.id);if(role==='server'){
      const paid=r.customers.find(c=>c.status==='pay'&&!c.claim);if(paid){this.enqueue('pay',paid.id,a.id);return;}
      const food=r.jobs.find(j=>j.stage==='ready'&&!j.claim&&this.customer(j.customer)?.status==='waiting');if(food){this.enqueue('serve',food.id,a.id);return;}
      if(!r.closed){const guest=r.customers.find(c=>c.status==='queue'&&!c.claim&&this.canSeat(c.type));if(guest)this.enqueue('greet',guest.id,a.id);}
    }else if(role==='cleaner'){const table=r.tables.find(t=>t.status==='dirty'&&!t.claim);if(table)this.enqueue('clean',table.id,a.id);}
    else if(role==='shopkeeper'){
      const guest=!r.closed&&r.customers.find(c=>c.status==='queue'&&!c.claim&&this.canSeat(c.type));
      if(guest){this.enqueue('greet',guest.id,a.id);return;}
      // Free a table first when a waiting guest is blocked by dirty seats.
      const waitingForSeat=r.customers.some(c=>c.status==='queue'&&!c.claim&&c.type!=='takeaway');
      const dirty=r.tables.find(t=>t.status==='dirty'&&!t.claim);
      if(waitingForSeat&&dirty){this.enqueue('clean',dirty.id,a.id);return;}
      const jobs=r.jobs.filter(j=>!j.claim&&['waiting','arriving'].includes(this.customer(j.customer)?.status));
      const plate=jobs.find(j=>j.stage==='needsPlate');if(plate){this.enqueue('plate',plate.id,a.id);return;}
      const prep=jobs.find(j=>j.stage==='new');if(prep){this.enqueue('prep',prep.id,a.id);return;}
      const heat=jobs.find(j=>j.stage==='needsHeat');if(heat&&this.freeStove()){this.enqueue('heat',heat.id,a.id);return;}
      if(dirty)this.enqueue('clean',dirty.id,a.id);
    }
  }
  releaseUnfulfillableAtClose() {
    const r=this.s.run,remaining={...this.s.stock},prepPriority=new Map();let sequence=0;
    for(const actor of r.actors)for(const task of [...(actor.task?[actor.task]:[]),...actor.queue])if(task.kind==='prep'&&!prepPriority.has(task.target))prepPriority.set(task.target,sequence++);
    const active=r.customers.filter(c=>['arriving','waiting'].includes(c.status));
    const priority=c=>Math.min(...c.jobs.filter(id=>prepPriority.has(id)).map(id=>prepPriority.get(id)),Number.POSITIVE_INFINITY);
    active.sort((a,b)=>priority(a)-priority(b));
    const impossible=[];
    for(const c of active){
      const demand={};
      for(const id of c.jobs){const job=this.job(id);if(job?.stage!=='new')continue;for(const [key,value]of Object.entries(dishById[job.dish].ingredients))demand[key]=(demand[key]||0)+value;}
      const needed=Object.entries(demand);if(!needed.length)continue;
      if(needed.some(([key,value])=>(remaining[key]||0)<value)){impossible.push(c);continue;}
      for(const [key,value]of needed)remaining[key]-=value;
    }
    for(const c of impossible)this.leave(c,true,`原料不足，${c.label}的订单无法完成，客人离开了。`);
  }
  tick(dt) {
    const s=this.s;if(s.phase!=='open'||dt<=0)return;dt=Math.min(dt,.1);if(s.settings.slow)dt*=.7;const r=s.run,info=dailyInfo(s);r.elapsed+=dt;
    if(!r.closed){if(serviceElapsed(s)>=info.duration){r.closed=true;for(const c of r.customers)if(c.status==='queue'&&!c.claim)this.leave(c,true,`营业时间结束，未接待的${c.label}离开了。`);this.emit('notice','营业时间结束，已停止接待新客；请完成已经接待的订单。');}else if(r.spawnIndex<r.schedule.length&&(!s.tutorial?.active||r.spawnIndex===0)&&(s.tutorial?.active?r.elapsed:serviceElapsed(s))>=r.schedule[r.spawnIndex])this.spawn();}
    if(r.closed)this.releaseUnfulfillableAtClose();
    syncQueue(s);
    for(const c of r.customers){const activeAtClose=r.closed&&(c.claim||['arriving','waiting','eating','pay'].includes(c.status));if(['queue','waiting','arriving'].includes(c.status)&&!activeAtClose&&!(s.tutorial?.active&&(!s.tutorial.guest||s.tutorial.guest===c.id))){c.patience-=dt;if(c.patience<=0){this.leave(c,true);continue;}}
      if(c.status==='queue'){this.move(c,dt,c.approachingMall?1.8:1.3);if(!c.path.length){c.approachingMall=false;c.yaw=Math.PI;}}
      if(c.status==='arriving'){this.move(c,dt,2);if(c.z<=GUEST_ENTRY.insideZ+.001)c.entered=true;if(!c.path.length){c.status='waiting';c.seated=c.table!==null;c.yaw=c.seated?seatPosition(s,c.table,c.seatSide??-1).yaw:Math.PI;this.startEating(c);}}
      else if(c.status==='leaving'){if(c.standTimer>0)c.standTimer=Math.max(0,c.standTimer-dt);else{this.move(c,dt,2);if(!c.path.length&&!c.companion?.path.length)c.status='gone';}}
      if(c.companion){const p=c.companion;
        if(c.status==='queue'){this.move(p,dt,c.approachingMall?1.8:1.3);if(!p.path.length)p.yaw=Math.PI;}
        else if(c.status==='leaving'){if(p.standTimer>0)p.standTimer=Math.max(0,p.standTimer-dt);else this.move(p,dt,2);}
        else if(['arriving','waiting','eating','pay'].includes(c.status)&&p.path.length){this.move(p,dt,2);if(!p.path.length){p.seated=true;p.yaw=seatPosition(s,c.table,p.seatSide??-(c.seatSide??-1)).yaw;this.startEating(c);}}
      }
      if(c.status==='eating'){c.timer+=dt;if(c.timer>=TYPES.find(t=>t.id===c.type).eat){c.status='pay';c.claim=null;advanceTutorial(s,'eaten',c);this.emit('payment-due',`${c.label}用餐结束，点客人或订单提醒结账。`);}}
    }
    for(const j of r.jobs){if(j.stage==='heating'){j.progress+=dt;if(j.progress>=dishById[j.dish].heat){j.stage='needsPlate';j.visual='cooked';advanceTutorial(s,'heated',this.customer(j.customer),j);this.emit('ready','炉上的料理好了，记得装盘。');}}if(j.stage==='ready'&&r.elapsed-j.readyAt>(s.upgrades.includes('warm')?90:45)&&!s.tutorial?.active){const c=this.customer(j.customer);if(c)c.stale=true;}}
    for(const a of r.actors){
      this.autoStaff(a);
      if(a.task&&!this.valid(a.task)){this.release(a.task);a.task=null;a.path=[];a.holding=null;a.carriedJob=null;}
      if(!a.task){if(a.queue.length)this.assign(a);else if(a.path.length){this.move(a,dt,ACTOR_SPEED);a.status='回到厨房待命';}else a.status=a.id==='chef'?'等待指令':'无目标 · 待命';}
      if(a.task){if(a.task.phase==='walk'){if(a.path.length)this.move(a,dt,ACTOR_SPEED*(a.id==='chef'&&s.upgrades.includes('shoes')?1.28:1));else this.startWork(a);}else{a.task.progress+=dt;if(a.task.progress+1e-8>=a.task.duration)this.complete(a);}}
    }
    r.customers=r.customers.filter(c=>c.status!=='gone'||r.jobs.some(j=>j.customer===c.id&&j.claim));
    r.jobs=r.jobs.filter(j=>!['served','waste'].includes(j.stage)||r.customers.some(c=>c.id===j.customer));
    if(r.closed&&r.customers.every(c=>['leaving','gone'].includes(c.status))&&r.actors.every(a=>!a.task&&!a.queue.length))this.settle();
  }
  settle() {
    const s=this.s,r=s.run;if(s.phase!=='open'||r.settled)return false;r.settled=true;
    for(const c of r.customers)if(!['leaving','gone'].includes(c.status))this.leave(c,true);
    for(const j of r.jobs)if(!['new','served','waste'].includes(j.stage)){r.stats.waste++;j.stage='waste';}
    const wages=s.staff.reduce((n,id)=>n+(STAFF.find(p=>p.id===staffRole(id))?.wage||0),0);r.stats.wages=wages;const due=Math.min(s.cash,wages);s.cash-=due;
    const satisfaction=r.stats.served?Math.round(r.stats.satisfactionSum/r.stats.served):0, info=dailyInfo(s),passed=r.stats.revenue>=info.target&&r.stats.correct>=info.correct&&satisfaction>=info.satisfaction;
    s.result={...clone(r.stats),day:s.day,title:info.title,satisfaction,passed,profit:r.stats.revenue-r.stats.ingredientCost-wages,target:info.target,required:info.correct,requiredSat:info.satisfaction,cash:s.cash,unpaidWage:wages-due,openingCash:s.opening.cash,elapsed:r.elapsed};
    s.phase='summary';this.emit(passed?'success':'warning',passed?'这一夜，圆满收工。':'这一夜还差一点，可以调整后重试。');return true;
  }
  nextDay() {const s=this.s;if(s.phase!=='summary'||!s.result?.passed)return false;s.history.push(clone(s.result));s.totalGuests+=s.result.served;if(s.day===10&&s.mode==='campaign'){s.phase='ending';this.emit('ending');return true;}if(s.day<10)s.day++;s.phase='prep';s.run=null;s.opening=null;s.result=null;s.supportUsed=false;this.emit('success');return true;}
  retry() {const s=this.s;if(s.phase!=='summary'||!s.opening)return false;const settings=clone(s.settings),restore=clone(s.opening);Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,restore,{settings,phase:'prep',run:null,opening:null,result:null});this.emit('notice','已恢复本日开店前的资金、库存、升级与种子。可调整准备后再开门。');return true;}
  freeMode() {const s=this.s;if(s.phase!=='ending')return false;s.mode='free';s.phase='prep';s.run=null;s.opening=null;s.result=null;s.supportUsed=false;return true;}
  getActions() {const r=this.s.run;if(this.s.phase!=='open')return[];const actions=[];for(const c of r.customers){if(!r.closed&&c.status==='queue'&&!c.claim&&this.canSeat(c.type))actions.push({kind:'greet',target:c.id});if(c.status==='pay'&&!c.claim)actions.push({kind:'pay',target:c.id});}for(const j of r.jobs){if(j.claim||!['waiting','arriving'].includes(this.customer(j.customer)?.status))continue;const kind=({new:'prep',needsHeat:'heat',needsPlate:'plate',ready:'serve'})[j.stage];if(kind&&!(kind==='heat'&&!this.freeStove()))actions.push({kind,target:j.id});}for(const t of r.tables)if(t.status==='dirty'&&!t.claim)actions.push({kind:'clean',target:t.id});return actions;}
  assertInvariants() {
    const s=this.s,r=s.run;if(Object.values(s.stock).some(v=>v<0||!Number.isInteger(v)))throw new Error('Negative stock');if(s.cash<0)throw new Error('Negative cash');if(!r)return true;
    const slots=r.jobs.filter(j=>j.stage!=='waste'&&(j.location==='stove'||j.stage==='heating'||j.reservedHeat)).map(j=>j.slot);if(new Set(slots).size!==slots.length)throw new Error('Stove double booking');
    for(const t of r.tables){
      if(!Array.isArray(t.seats)||t.seats.length!==2)throw new Error('Table seat count');
      const expected=t.seats.some(seat=>seat.status==='occupied')?'occupied':t.seats.some(seat=>seat.status==='dirty')?'dirty':'free';
      if(t.status!==expected)throw new Error('Table seat status mismatch');
      for(const seat of t.seats)if(seat.status==='occupied'&&!r.customers.find(c=>c.id===seat.customer&&c.table===t.id&&['arriving','waiting','eating','pay'].includes(c.status)))throw new Error('Orphan seat');
      const occupants=t.seats.filter(seat=>seat.status==='occupied').map(seat=>seat.customer);
      for(const id of new Set(occupants))if(occupants.filter(occupant=>occupant===id).length>1&&r.customers.find(c=>c.id===id)?.type!=='couple')throw new Error('Customer owns two seats');
    }
    const claims=r.actors.flatMap(a=>[a.task,...a.queue].filter(Boolean));if(new Set(claims.map(t=>`${t.kind}:${t.target}`)).size!==claims.length)throw new Error('Duplicate task');return true;
  }
}
