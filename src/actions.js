import * as THREE from 'three';
import {box,sphere,cylinder,torus,makeFood,reachDiningArm} from './models.js';
import {dishById,TYPES} from './data.js';
import {WORKSPOTS,jobLocation} from './workflow.js';

const left=new THREE.Vector3(),right=new THREE.Vector3(),toolQ=new THREE.Quaternion(),inverse=new THREE.Quaternion();
const point=new THREE.Vector3(),from=new THREE.Vector3(),to=new THREE.Vector3(),hand=new THREE.Vector3();
const ease=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
const progress=t=>t?.phase==='work'?THREE.MathUtils.clamp(t.progress/(t.duration||1),0,1):0;

function toolRotation(d,tool,index,x=0,y=0,z=0){
  inverse.copy(d.arms[index].quaternion).multiply(d.elbows[index].quaternion).invert();
  toolQ.setFromEuler(new THREE.Euler(x,y,z));tool.quaternion.copy(inverse).multiply(toolQ);
}

export function initWorker(model){
  const d=model.userData;if(d.tools)return;
  const carry=new THREE.Group();carry.position.set(0,.99,.31);d.body.add(carry);d.carry=carry;
  const tools={};
  const create=(name,parent=d.hands[1])=>{const g=new THREE.Group();g.visible=false;parent.add(g);tools[name]=g;return g;};
  const knife=create('knife');box(knife,.14,.04,.045,0x714a30,-.055,.04,0,.01);box(knife,.18,.10,.018,0xdde5db,.10,.012,.018,.006);box(knife,.18,.01,.02,0xf5f5de,.10,-.042,.018,.002);
  const ladle=create('ladle');box(ladle,.025,.025,.32,0xa5b5ab,0,0,.13,.008);const cup=cylinder(ladle,.082,.06,.055,0xc0ccc1,0,-.045,.30,16);cup.rotation.x=.3;
  const spatula=create('spatula');box(spatula,.025,.03,.23,0x7c5e3e,0,0,.095,.006);box(spatula,.13,.018,.13,0xc9d0be,0,-.02,.26,.008);
  const cloth=create('cloth');box(cloth,.21,.025,.15,0x9bbcad,0,-.04,.04,.025);
  const notebook=create('notebook',d.hands[0]);box(notebook,.18,.025,.22,0xf4dfaa,0,0,.04,.012);for(let i=0;i<3;i++)box(notebook,.11,.004,.006,0xa48962,0,.015,i*.04,.001);
  const pencil=create('pencil');cylinder(pencil,.009,.009,.18,0xbd8151,0,0,.035,8).rotation.x=.6;
  const bottle=create('bottle');cylinder(bottle,.047,.052,.16,0xb9794e,0,-.04,.02,16);cylinder(bottle,.023,.023,.06,0x69845b,0,.07,.02,12);
  const cash=create('cash',carry);for(let i=0;i<3;i++)box(cash,.2,.008,.11,0xa9ba84,0,i*.01,0,.005);
  const dirty=create('dirty',carry);for(let i=0;i<2;i++)cylinder(dirty,.19,.17,.025,0xe5d5b2,0,i*.045,0);sphere(dirty,.03,0x886e4d,.07,.07,.03,1,.3,1);
  const empty=create('emptyDish',carry);cylinder(empty,.22,.16,.09,0xf0dfb6,0,.045,0);
  const tray=create('tray',carry);box(tray,.48,.035,.34,0xc3a16f,0,.0175,0,.02);tray.scale.setScalar(.9);
  const water=create('water',d.body);for(let i=0;i<6;i++)sphere(water,.025,0xa2cfcb,(i%3-.8)*.08,.91+(i%2)*.05,.41+Math.floor(i/3)*.04);
  d.tools=tools;
}

export function animateWorker(model,p,time,dishId){
  initWorker(model);const d=model.userData,t=p.task,step=t?.step,u=progress(t),working=t?.phase==='work';
  for(const tool of Object.values(d.tools))tool.visible=false;
  d.carry.position.set(0,.99,.31);d.carry.rotation.set(0,0,0);
  d.action=working?step:p.holding?'carry':p.path?.length?'walk':'idle';
  if(!working&&!p.holding)return;
  d.body.rotation.x=working?.08:0;
  d.head.rotation.x=working?.10:0;
  left.set(-.21,.95,.28);right.set(.21,.95,.28);
  if(working){
    if(step==='fetch'){left.set(-.14,.58+ease(u)*.35,.21);right.set(.18,.65+ease(u)*.25,.24);d.body.rotation.x=.14;}
    else if(step==='lay'||step==='stow'||step==='pickup'||step==='lift'){left.set(-.20,.96,.29+Math.sin(u*Math.PI)*.04);right.set(.20,.96,.29+Math.sin(u*Math.PI)*.04);}
    else if(step==='collect'){
      const height=.80+ease(u)*.15;left.set(-.20,height,.32);right.set(.20,height,.32);d.carry.position.set(0,height+.04,.34);
    }
    else if(step==='chop'){
      const beat=Math.abs(Math.sin(u*Math.PI*4));left.set(-.20,.94,.30);right.set(.15,1.10+beat*.12,.25);d.tools.knife.visible=u<.88;
      if(u>.88){left.set(-.20,.96,.29);right.set(.20,.96,.29);}
    }else if(step==='pour'){
      const lift=ease(Math.min(1,u/.35));left.set(-.19,.95+lift*.20,.29-lift*.12);right.set(.19,.95+lift*.20,.29-lift*.12);
      d.carry.position.set(0,.99+lift*.22,.31-lift*.12);d.carry.rotation.x=ease(Math.max(0,(u-.25)/.5))*.45;
      d.tools.tray.visible=u>.45;d.tools.spatula.visible=u>.70;
    }
    else if(step==='scoop'){left.set(-.20,.95,.28);right.set(.13,1.02+Math.sin(u*Math.PI*2)*.035,.29);d.tools[dishById[dishId]?.method==='fry'?'spatula':'ladle'].visible=true;d.tools.emptyDish.visible=u<.65;}
    else if(step==='garnish'){left.set(-.20,.91,.30);right.set(.13,1.03+Math.sin(u*Math.PI*3)*.04,.25);d.tools.bottle.visible=u>.30;}
    else if(step==='deliver'){
      const height=.95-ease(u)*.16;left.set(-.20,height,.30+u*.10);right.set(.20,height,.30+u*.10);d.carry.position.set(0,height+.04,.31+u*.10);
    }
    else if(step==='greet'){
      if(u<.28){left.set(-.20,.78,.15);right.set(.26,1.13,.16+Math.sin(u*30)*.04);}
      else if(u<.75){left.set(-.15,.86,.26);right.set(.02,.92+Math.sin(u*35)*.02,.28);d.tools.notebook.visible=true;d.tools.pencil.visible=true;}
      else{left.set(-.18,.79,.16);right.set(.20,.99,.28);}
      d.head.rotation.x=Math.sin(u*Math.PI*2)*.10;
    }else if(step==='payment'||step==='deposit'){
      left.set(-.20,.80,.15);right.set(.11,step==='deposit'?.90-ease(u)*.23:.87+ease(u)*.10,step==='deposit'?.24-ease(u)*.11:.29);
      d.tools.cash.visible=true;d.carry.position.set(.11,right.y-.01,right.z+.03);
    }else if(step==='wipe'){
      left.set(-.20,.88,.18);right.set(Math.sin(u*Math.PI*4)*.14,.85,.32+Math.cos(u*Math.PI*4)*.025);d.tools.cloth.visible=true;
    }else if(step==='wash'){
      left.set(-.18,.91,.29);right.set(.10+Math.sin(u*Math.PI*6)*.04,.92,.32);d.tools.cloth.visible=true;d.tools.dirty.visible=true;d.tools.water.visible=true;d.carry.position.set(0,.94,.34);
      d.tools.water.children.forEach((drop,i)=>{drop.scale.setScalar(.6+Math.abs(Math.sin(u*25+i))*.7);});
    }
  }
  if(p.holding==='cash')d.tools.cash.visible=true;
  if(p.holding==='dirty')d.tools.dirty.visible=true;
  reachDiningArm(d.arms[0],d.elbows[0],left,-1);reachDiningArm(d.arms[1],d.elbows[1],right,1);
  if(d.tools.knife.visible)toolRotation(d,d.tools.knife,1,0,0,Math.sin(u*Math.PI*4)*.10);
  if(d.tools.ladle.visible)toolRotation(d,d.tools.ladle,1,Math.sin(u*Math.PI*2)*.25,Math.sin(u*Math.PI*2)*.18,0);
  if(d.tools.spatula.visible)toolRotation(d,d.tools.spatula,1,0,0,.15);
  if(d.tools.cloth.visible)toolRotation(d,d.tools.cloth,1);
  if(d.tools.bottle.visible)toolRotation(d,d.tools.bottle,1,-.65,0,.3);
  if(d.tools.notebook.visible)toolRotation(d,d.tools.notebook,0);
  if(d.tools.pencil.visible)toolRotation(d,d.tools.pencil,1,-.3);
}

function ingredientPieces(group,key,chopped){
  const colors={rice:0xf0e3bf,egg:0xedcc83,veg:0x70a158,tofu:0xf3e5ba,noodle:0xd9b779,meat:0xbe856d,fish:0x93a8a5,broth:0xb99560},color=colors[key];
  if(key==='broth'){
    cylinder(group,.065,.055,.13,color,0,.09,0);cylinder(group,.07,.07,.018,0xe1cdaa,0,.16,0);box(group,.025,.07,.04,0xc8ab7b,.075,.11,0,.007);
  }else if(!chopped){
    if(key==='veg')for(let i=0;i<3;i++)sphere(group,.09,color,(i-1)*.08,.1,i%2*.08,.55,1.4,.65);
    else if(key==='egg')sphere(group,.10,color,0,.1,0,.75,1.1,.75);
    else if(key==='rice'||key==='noodle')sphere(group,.13,color,0,.08,0,1.2,.5,1);
    else box(group,.21,.12,.17,color,0,.085,0,.02);
  }else for(let i=0;i<7;i++){
    const a=i*2.4;box(group,.055,.045,.05,color,Math.cos(a)*(.06+i*.009),.06+Math.floor(i/5)*.02,Math.sin(a)*(.06+i*.009),.007);
  }
}

export function makeMealProp(dish){
  const root=new THREE.Group(),raw=new THREE.Group(),chopped=new THREE.Group(),cooking=new THREE.Group();
  const keys=Object.keys(dishById[dish].ingredients);
  for(const variant of [raw,chopped]){
    box(variant,.48,.035,.34,0xc3a16f,0,.0175,0,.02);
    keys.forEach((key,i)=>{const g=new THREE.Group();g.position.set((i-(keys.length-1)/2)*.13,.02,0);ingredientPieces(g,key,variant===chopped);variant.add(g);});
  }
  cylinder(cooking,.20,.20,.015,dishById[dish].method==='fry'?0x9a7449:0xbca06a,0,.012,0);
  keys.forEach((key,i)=>{const g=new THREE.Group();g.position.set((i-(keys.length-1)/2)*.07,0,0);ingredientPieces(g,key,true);cooking.add(g);});
  const plated=makeFood(dish),packed=new THREE.Group();box(packed,.37,.30,.29,0xc4a06b,0,.15,0,.025);box(packed,.15,.09,.008,0xf1dfb6,0,.17,.15,.008);
  for(const z of [-.09,.09]){const handle=torus(packed,.08,.012,0xa08054,0,.34,z);handle.scale.y=.8;}
  for(const g of [raw,chopped,cooking,plated,packed])root.add(g);
  root.userData.variants={raw,chopped,cooking,plated,packed};root.userData.dish=dish;return root;
}

function setPoint(v,p){return v.set(p.x,p.y,p.z);}
function mix(a,b,t){return point.copy(a).lerp(b,ease(t));}
function sourcePoint(j,location){
  if(location==='supply')return WORKSPOTS.supply;
  if(location==='prep')return WORKSPOTS.prepRack(j.prepSlot??0);
  if(location==='stove')return WORKSPOTS.stove(j.slot??j.sourceSlot??0,dishById[j.dish].method);
  return WORKSPOTS.plateRack(j.rack??0);
}

export function updateMealProp(prop,j,state,people,tablePosition){
  const r=state.run,c=r.customers.find(c=>c.id===j.customer),a=r.actors.find(a=>a.task?.target===j.id),t=a?.task,u=progress(t);
  const model=a?people.get(a.id):null,anchor=model?.userData.carry;
  if(anchor)anchor.getWorldPosition(hand);
  let variant=j.visual==='raw'?'raw':j.visual==='chopped'?'chopped':j.visual==='cooking'||j.visual==='cooked'?'cooking':'plated';
  let location=jobLocation(j),scale=.9,rotation=0,visible=j.stage!=='new'&&j.stage!=='waste';
  setPoint(point,sourcePoint(j,location));
  if(location==='actor'&&anchor){point.copy(hand);variant=t?.kind==='prep'&&t?.step!=='stow'?'raw':t?.kind==='prep'||t?.kind==='heat'||t?.kind==='plate'&&t.sourceLocation==='prep'?'chopped':'plated';}
  if(t?.phase==='work'){
    if(t.step==='fetch'){variant='raw';setPoint(from,WORKSPOTS.supply);point.copy(mix(from,hand,Math.max(0,(u-.15)/.85)));visible=u>.1;}
    else if(t.step==='lay'){variant='raw';setPoint(to,WORKSPOTS.board);point.copy(mix(hand,to,u));}
    else if(t.step==='chop'){
      variant=u<.4?'raw':'chopped';setPoint(point,WORKSPOTS.board);
      if(u>.88){setPoint(from,WORKSPOTS.board);point.copy(mix(from,hand,(u-.88)/.12));}
    }else if(t.step==='stow'){
      variant='chopped';setPoint(to,WORKSPOTS.prepRack(j.prepSlot??0));point.copy(mix(hand,to,u));
    }else if(['pickup','lift','scoop'].includes(t.step)){
      const source=t.sourceLocation||location;setPoint(from,sourcePoint(j,source));point.copy(mix(from,hand,u));
      variant=t.kind==='heat'||t.kind==='plate'&&source==='prep'?'chopped':t.kind==='serve'?'plated':u<.6&&source==='stove'?'cooking':'plated';
      if(t.step==='scoop')point.y+=Math.sin(u*Math.PI)*.23;
    }else if(t.step==='pour'){
      const pouring=Math.max(0,(u-.45)/.45);setPoint(to,WORKSPOTS.stove(j.slot??0,dishById[j.dish].method));point.copy(mix(hand,to,pouring));
      variant=u<.9?'chopped':'cooking';rotation=u<.9?-ease(Math.max(0,(u-.25)/.5))*.45:0;
    }else if(t.step==='garnish'){
      setPoint(to,WORKSPOTS.plateRack(j.rack??0));point.copy(mix(hand,to,Math.min(1,u/.40)));variant=t.sourceLocation==='prep'&&u<.45?'chopped':'plated';
      prop.userData.variants.plated.scale.setScalar(.86+.14*Math.min(1,u));
    }
  }
  if(j.stage==='served'||t?.step==='deliver'&&t.phase==='work'){
    variant='plated';const table=c?.table!==null&&c?tablePosition(state,c.table):null;
    if(table){
      const index=c.jobs.indexOf(j.id),side=c.type==='couple'&&index>0?-(c.seatSide??-1):(c.seatSide??-1);setPoint(to,{x:table.x+side*.31,y:.961,z:table.z+.17});
      if(t?.step==='deliver'&&t.phase==='work')point.copy(mix(hand,to,u));else point.copy(to);
      scale=.82;
      if(j.stage==='served'&&c.status==='eating'){
        const diner=people.get(index===0?c.id:`${c.id}:companion`);
        if(diner){
          const remaining=TYPES.find(type=>type.id===c.type).eat-c.timer;
          const lift=Math.min(1,c.timer/.4,remaining/.4);diner.userData.dining.getWorldPosition(to);
          point.copy(mix(point,to,lift));scale=THREE.MathUtils.lerp(.82,.64,ease(lift));
        }
      }
      if(['leaving','gone'].includes(c.status))visible=false;
    }else if(c?.type==='takeaway'){
      const diner=people.get(c.id);
      if(diner){
        diner.userData.dining.getWorldPosition(to);point.copy(t?.step==='deliver'?mix(hand,to,u):to);scale=.82;variant='packed';
        if(c.status==='gone')visible=false;
      }
    }else if(j.stage==='served')visible=false;
  }
  if(j.stage==='served'&&c?.status==='pay')scale=.82;
  if(c?.type==='takeaway'&&variant==='plated'&&(!t||t.step!=='garnish'||u>.75))variant='packed';
  prop.visible=visible;prop.position.copy(point);prop.rotation.set(rotation,0,0);prop.scale.setScalar(scale);
  for(const[name,g]of Object.entries(prop.userData.variants))g.visible=name===variant;
  const contents=prop.userData.variants.plated.userData.contents;
  if(contents){
    const eating=c?.type!=='takeaway'&&(c?.status==='eating'||c?.status==='pay'),duration=TYPES.find(type=>type.id===c?.type)?.eat||1,amount=eating?THREE.MathUtils.clamp((c.status==='pay'?duration:c.timer)/duration,0,1):0;
    contents.scale.set(1-.42*amount,Math.max(.001,1-amount),1-.42*amount);contents.visible=amount<.985;
  }
  prop.userData.variants.chopped.children[0].visible=!(t?.step==='pour'&&t.phase==='work'&&u>.45);
  if(variant!=='plated')prop.userData.variants.plated.scale.setScalar(1);
  prop.userData.location=location;prop.userData.variant=variant;
}
