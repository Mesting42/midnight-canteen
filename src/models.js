import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const materials=new Map();
export const TABLE_SURFACE_Y=.923+.025/2;
const armDown=new THREE.Vector3(0,-1,0),forearmRest=new THREE.Vector3(0,-.16,.015).normalize();
const reachDirection=new THREE.Vector3(),elbowBend=new THREE.Vector3(),elbowPoint=new THREE.Vector3(),wristPoint=new THREE.Vector3(),localReach=new THREE.Vector3();
const inverseArm=new THREE.Quaternion();
const bowlPalmOffset=new THREE.Vector3(.08,.025,.09),bowlBiteOffset=new THREE.Vector3(.10,.12,.02);

// Solve both arm segments against a palm target, keeping the bowl supported
// throughout the bite cycle instead of moving it independently below the table.
export function reachDiningArm(arm,elbow,target,side){
  const upper=.19,lower=Math.hypot(.16,.015);
  reachDirection.copy(target).sub(arm.position);
  const distance=THREE.MathUtils.clamp(reachDirection.length(),.04,upper+lower-.0001);
  reachDirection.normalize();
  wristPoint.copy(arm.position).addScaledVector(reachDirection,distance);
  elbowBend.set(side,-.25,0).addScaledVector(reachDirection,-elbowBend.dot(reachDirection)).normalize();
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  elbowPoint.copy(arm.position).addScaledVector(reachDirection,along).addScaledVector(elbowBend,Math.sqrt(Math.max(0,upper*upper-along*along)));
  localReach.copy(elbowPoint).sub(arm.position).normalize();
  arm.quaternion.setFromUnitVectors(armDown,localReach);
  inverseArm.copy(arm.quaternion).invert();
  localReach.copy(wristPoint).sub(elbowPoint).normalize().applyQuaternion(inverseArm);
  elbow.quaternion.setFromUnitVectors(forearmRest,localReach);
}
export function mat(color,extra={}) {const key=JSON.stringify([color,extra]);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.8,...extra}));return materials.get(key);}
export function box(parent,w,h,d,color,x=0,y=0,z=0,r=.04) {const m=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function sphere(parent,r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1) {const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m;}
export function cylinder(parent,rt,rb,h,color,x=0,y=0,z=0,n=24) {const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,n),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function torus(parent,r,t,color,x=0,y=0,z=0) {const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,28),mat(color));m.position.set(x,y,z);parent.add(m);return m;}
export function label(text,{color='#fff3d0',background=null,size=100,width=512,height=128,font='bold',scale=1}={}) {const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${font} ${size}px "Microsoft YaHei",sans-serif`;ctx.fillText(text,width/2,height/2,width-24);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2*scale,.5*scale),new THREE.MeshBasicMaterial({map:t,transparent:!background,side:THREE.DoubleSide,depthWrite:false}));return mesh;}

export function makePerson({color=0x6e948b,hair=0x392c24,chef=false,role='',type='',wheelchair=false}={}) {
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const skin=type==='worker'?0xd9a67b:0xefc49a;
  const legs=[],knees=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.115,.53,0);box(leg,.17,.24,.18,0x343c43,0,-.12,0,.06);const knee=new THREE.Group();knee.position.y=-.24;leg.add(knee);box(knee,.16,.2,.17,0x343c43,0,-.1,0,.05);box(knee,.21,.12,.29,0x30302d,0,-.215,.055,.04);body.add(leg);legs.push(leg);knees.push(knee);}
  box(body,.46,.49,.3,color,0,.7,0,.1);box(body,.22,.07,.22,skin,0,.98,0);
  const arms=[],elbows=[],hands=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.29,.9,0);box(arm,.14,.2,.18,color,0,-.1,0,.06);const elbow=new THREE.Group();elbow.position.y=-.19;arm.add(elbow);box(elbow,.12,.15,.14,color,0,-.065,0,.05);const hand=new THREE.Group();hand.position.set(0,-.16,.015);sphere(hand,.072,skin);elbow.add(hand);body.add(arm);arms.push(arm);elbows.push(elbow);hands.push(hand);}
  const head=new THREE.Group();head.position.y=1.17;body.add(head);sphere(head,.26,skin,0,0,0,.94,1.06,.91);sphere(head,.268,hair,0,.105,-.025,.98,.75,.94);
  // Sculpted fringe, ears, eyes, nose and cheeks make the face read at game scale.
  for(const side of [-1,1]){sphere(head,.055,skin,side*.235,-.015,0);sphere(head,.027,0x362d27,side*.09,.005,.213,1,1.3,.6);sphere(head,.034,0xdd967f,side*.14,-.071,.191,1,.55,.5);}
  sphere(head,.032,0xe4ad87,0,-.03,.237,1,.7,.8);const smile=torus(head,.045,.008,0x885949,0,-.09,.216);smile.scale.y=.5;
  for(let i=0;i<4;i++)sphere(head,.085,hair,-.16+i*.095,.12,.145,1,.65,.6);
  if(chef){box(body,.35,.4,.04,0xf6e7bf,0,.66,.169,.025);box(body,.34,.045,.06,0xd1934c,0,.84,.18);for(const side of [-1,1])box(body,.045,.22,.025,0xf6e7bf,side*.125,.94,.165);cylinder(head,.22,.21,.09,0xf7eed7,0,.22,0);for(let i=-1;i<=1;i++)sphere(head,.14,0xfff3de,i*.115,.31,0,1,1,.9);}
  if(role==='server'){box(body,.31,.25,.035,0xf3d69b,0,.61,.172);sphere(head,.09,0xb7d4bf,-.2,.14,0);}
  if(role==='cleaner'){box(body,.31,.33,.035,0xc9d4bb,0,.64,.172);const band=torus(head,.238,.017,0xf6c774,0,.145,0);band.rotation.x=Math.PI/2;}
  if(role==='shopkeeper'){
    box(body,.34,.33,.045,0xe8d4a4,0,.64,.177,.035);
    box(body,.38,.075,.035,0xb56d4c,0,.82,.184,.025);
    box(body,.10,.12,.035,0x557c73,-.15,.93,.176,.025);
    box(head,.32,.07,.28,0x4e6f67,0,.235,-.015,.025);
    box(head,.18,.035,.16,0xd4b36f,0,.285,-.015,.015);
  }
  if(type==='student'){box(body,.34,.37,.15,0x344d58,0,.74,-.215);box(body,.03,.4,.04,0xbed2ce,-.17,.77,.173);box(body,.03,.4,.04,0xbed2ce,.17,.77,.173);}
  if(type==='child'){box(body,.36,.31,.18,0x8b6751,0,.7,-.205);box(body,.05,.28,.045,0xd8b56e,-.17,.75,.17);sphere(head,.07,hair,-.2,-.12,-.05,.75,1.4,.8);}
  if(type==='elder'){for(const side of [-1,1]){const lens=torus(head,.055,.009,0x665e4d,side*.09,.015,.238);lens.scale.y=.76;}if(!wheelchair)box(body,.045,.29,.035,0xbba77e,.22,.34,-.04);}
  if(type==='worker'){box(body,.035,.2,.025,0xc59767,0,.8,.171);sphere(head,.03,0x282c32,-.1,.015,.24);for(const side of [-1,1]){const g=torus(head,.058,.009,0x333e41,side*.095,.016,.23);g.scale.y=.72;}}
  if(type==='artist'){cylinder(head,.28,.27,.055,0xc5a66f,0,.23,0);sphere(head,.04,0x9c7850,0,.275,0);box(body,.29,.09,.035,0xdec8a5,0,.93,.172);}
  if(type==='neighbor'){sphere(head,.14,hair,0,.08,-.24,1,.8,1);box(body,.035,.28,.035,0xd4a7b4,0,.75,.17);}
  if(type==='takeaway'){sphere(head,.29,0xe4bb51,0,.15,-.012,1,.65,.97);box(body,.39,.29,.19,0xb59345,0,.77,-.22);}
  if(type==='couple'){box(body,.42,.07,.035,0xe8b9a1,0,.83,.17);}
  const utensils=new THREE.Group();hands[1].add(utensils);utensils.rotation.x=-.3;
  for(const x of [-.024,.024])box(utensils,.012,.26,.012,0x795637,x,-.04,.04,.003);
  const bite=sphere(utensils,.037,0xf6dfaa,0,-.16,.04,1,.7,1);utensils.visible=false;
  const dining=new THREE.Group();body.add(dining);dining.visible=false;
  root.userData={body,head,mouth:smile,legs,knees,arms,elbows,hands,utensils,bite,dining,sit:0,leftPalm:new THREE.Vector3(),rightPalm:new THREE.Vector3(),biteAim:new THREE.Vector3(),utensilRotation:new THREE.Quaternion(),wristRotation:new THREE.Quaternion()};return root;
}

// The same rig handles locomotion, seated waiting, chopstick bites and standing
// back up. Joint transforms blend across states instead of swapping models.
export function animatePerson(model, person, time, dt, reducedMotion=false) {
  const d=model.userData, target=person.seated?1:0;
  if(!d.poseInitialized){d.sit=target;d.poseInitialized=true;}
  else if(dt>0)d.sit=THREE.MathUtils.damp(d.sit,target,10,dt);
  const sit=d.sit, moving=!!person.path?.length&&!person.standTimer, eating=person.status==='eating'&&person.table!==null;
  const work=person.task?.phase==='work', cycle=time*3.3+(person.serial||0)*.6;
  if(Number.isFinite(person.x)&&Number.isFinite(person.z)){
    if(d.lastX!==undefined&&d.lastZ!==undefined)d.gaitDistance=(d.gaitDistance||0)+Math.hypot(person.x-d.lastX,person.z-d.lastZ);
    d.lastX=person.x;d.lastZ=person.z;
  }
  const stride=person.walkStride||(person.type?1.35:2.25);
  const phase=(d.gaitDistance||0)*Math.PI*2/stride+(person.serial||0)*.45;
  const lift=(Math.sin(cycle)+1)/2, walk=Math.sin(phase);
  model.position.set(person.x,.165+(moving&&!reducedMotion?Math.abs(Math.sin(phase*2))*.018:0),person.z);
  const yaw=person.yaw||0;
  if(!d.yawInitialized){model.rotation.y=yaw;d.yawInitialized=true;}
  else if(dt>0)model.rotation.y+=Math.atan2(Math.sin(yaw-model.rotation.y),Math.cos(yaw-model.rotation.y))*Math.min(1,dt*12);
  d.body.position.y=-.14*sit+(!moving&&!work&&!reducedMotion?Math.sin(time*2+(person.serial||0))*.009:0);
  d.body.rotation.x=eating?.06+.025*Math.sin(cycle):0;
  d.body.rotation.z=moving&&!reducedMotion?Math.sin(phase)*.025:!moving&&!reducedMotion?Math.sin(time*1.2+(person.serial||0))*.012:0;
  d.legs.forEach((leg,i)=>{
    const strideSwing=moving&&!reducedMotion?Math.sin(phase+i*Math.PI):0;
    leg.rotation.x=-Math.PI/2*sit+strideSwing*.52*(1-sit);
    d.knees[i].rotation.x=Math.PI/2*sit+Math.max(0,-strideSwing)*.24*(1-sit);
  });
  d.arms.forEach((arm,i)=>{
    arm.rotation.set(0,0,0);d.elbows[i].rotation.set(0,0,0);
    arm.rotation.z=sit?(i===0?-.1:.1):0;
    arm.rotation.x=moving&&!reducedMotion?-Math.sin(phase+i*Math.PI)*.3:work?-.65+Math.sin(time*12+i)*.16:person.holding?-.95:sit?-.35:!reducedMotion?Math.sin(time*1.4+i)*.018:0;
    d.elbows[i].rotation.x=sit?-.8:moving&&!reducedMotion?.08+Math.max(0,Math.sin(phase+i*Math.PI))*.15:0;
    if(person.status==='pay'&&i===1){arm.rotation.x=-.65;d.elbows[i].rotation.x=-.7;}
  });
  if(person.wheelchair&&sit>.5){
    d.leftPalm.set(-.30,.60,.14);d.rightPalm.set(.30,.60,.14);
    reachDiningArm(d.arms[0],d.elbows[0],d.leftPalm,-1);
    reachDiningArm(d.arms[1],d.elbows[1],d.rightPalm,1);
  }
  d.head.rotation.x=eating?-.03+lift*.14:!moving&&!reducedMotion?Math.sin(cycle*.4)*.018:0;
  d.head.rotation.y=!moving&&!reducedMotion?Math.sin(time*.65+(person.serial||0))*.027:0;
  d.head.rotation.z=eating&&!reducedMotion?Math.sin(cycle*2)*.025:0;
  d.mouth.scale.y=eating?.45+Math.abs(Math.sin(cycle*3))*.25:.5;
  d.utensils.visible=eating;
  d.bite.visible=lift>.48;
  d.dining.visible=eating;
  if(eating){
    d.leftPalm.set(-.23,.96+lift*.035,.29);
    d.rightPalm.set(.13,1.01+lift*.08,.28-lift*.02);
    reachDiningArm(d.arms[0],d.elbows[0],d.leftPalm,-1);
    reachDiningArm(d.arms[1],d.elbows[1],d.rightPalm,1);
    d.dining.position.copy(d.leftPalm).add(bowlPalmOffset);
    d.dining.rotation.x=.035-lift*.07;
    // Aim the chopsticks from the raised bowl toward the actual mouth position.
    d.biteAim.copy(d.mouth.position).applyQuaternion(d.head.quaternion).add(d.head.position);
    localReach.copy(d.dining.position).add(bowlBiteOffset).lerp(d.biteAim,lift).sub(d.rightPalm).normalize();
    d.utensilRotation.setFromUnitVectors(armDown,localReach);
    d.wristRotation.copy(d.arms[1].quaternion).multiply(d.elbows[1].quaternion).invert();
    d.utensils.quaternion.copy(d.wristRotation).multiply(d.utensilRotation);
  }
  if(person.type==='takeaway'){
    d.dining.position.set(0,.78,.28);
    if(person.served>0){
      d.leftPalm.set(-.17,.80,.27);d.rightPalm.set(.17,.80,.27);
      reachDiningArm(d.arms[0],d.elbows[0],d.leftPalm,-1);reachDiningArm(d.arms[1],d.elbows[1],d.rightPalm,1);
    }
  }
  model.userData.pose=person.seated?(eating?'eating':'seated'):person.status==='leaving'&&person.standTimer>0?'standing-up':moving?'walking':'standing';
}

export function makeFood(id='rice') {
  const g=new THREE.Group(),contents=new THREE.Group();if(id!=='bento')cylinder(g,.24,.18,.045,0xf0dfb6,0,.025,0);g.add(contents);g.userData.contents=contents;
  const rice=()=>{const triangle=new THREE.Shape();triangle.moveTo(-.15,0);triangle.quadraticCurveTo(-.19,.01,-.12,.17);triangle.quadraticCurveTo(0,.36,.12,.17);triangle.quadraticCurveTo(.19,.01,.15,0);triangle.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:.13,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.035,bevelThickness:.025}),mat(0xf8eed7));mesh.position.set(0,.06,-.08);mesh.castShadow=true;contents.add(mesh);box(contents,.15,.12,.175,0x324739,0,.12,-.01,.01);for(let i=0;i<5;i++)sphere(contents,.009,0xcda76a,(i-2)*.04,.26+Math.sin(i)*.045,.105);};
  const greens=()=>{for(let i=0;i<7;i++){const a=i*2.4;sphere(contents,.065,i%2?0x82a955:0x547949,Math.cos(a)*.12,.09+Math.sin(i)*.02,Math.sin(a)*.12,1,.45,1.2);}};
  const bowl=(color=0xbe6c43)=>{cylinder(g,.235,.16,.14,color,0,.11,0);cylinder(g,.208,.208,.012,0x956533,0,.189,0);};
  if(id==='rice')rice();
  else if(['soup','hotpot','noodle'].includes(id)){bowl(id==='hotpot'?0x4c5954:0xb97350);cylinder(contents,.198,.198,.009,0xd69a50,0,.198,0);for(let i=0;i<5;i++)box(contents,.06,.055,.06,0xf1ddb3,Math.cos(i*2)*.13,.218,Math.sin(i*2)*.13,.007);for(let i=0;i<5;i++)sphere(contents,.035,0x719447,Math.cos(i*3)*.08,.228,Math.sin(i*3)*.08,1,.4,1);if(id==='noodle'){for(let i=0;i<5;i++){const ring=torus(contents,.05+i*.018,.009,0xf1c982,0,.211,0);ring.rotation.x=Math.PI/2;ring.scale.z=.7;}}}
  else if(id==='egg'){for(let i=0;i<3;i++){box(contents,.11,.1,.27,0xe4ae39,(i-1)*.12,.095,0,.02);box(contents,.08,.07,.006,0xf4d86e,(i-1)*.12,.102,.14,.006);}sphere(contents,.04,0x648b48,.18,.1,.14,1,.3,1);}
  else if(id==='salad'){greens();for(let i=0;i<3;i++)sphere(contents,.035,0xcb6443,Math.cos(i*2)*.13,.13,Math.sin(i*2)*.13);}
  else if(id==='pork'){cylinder(contents,.16,.17,.11,0xa66c3e,0,.115,0);for(let i=0;i<3;i++)box(contents,.21,.004,.012,0x715336,0,.175,(i-1)*.055,.002);sphere(contents,.065,0x86a95b,.15,.075,.14,1,.25,1);}
  else if(id==='don'){bowl(0x496e67);cylinder(contents,.205,.19,.03,0xe8d5a5,0,.205,0);for(let i=0;i<4;i++)box(contents,.27,.06,.064,0xb77840,0,.256,(i-1.5)*.075,.018);sphere(contents,.05,0x87a752,.13,.29,-.1,1,.3,1);}
  else if(id==='fish'){sphere(contents,.16,0xc99457,0,.1,0,1.18,.32,.65);for(let i=0;i<3;i++)box(contents,.016,.005,.17,0x7e654b,(i-1)*.07,.15,0,.001);cylinder(contents,.055,.055,.025,0xedce68,.15,.1,.1);sphere(contents,.045,0x6d954b,-.14,.09,.12,1,.4,1);}
  else if(id==='bento'){box(g,.51,.065,.38,0xa8784a,0,.035,0,.015);box(g,.48,.025,.35,0xe8d3ab,0,.072,0,.005);box(g,.012,.07,.35,0x8a6546,0,.09,0);for(let i=0;i<2;i++)box(contents,.17,.085,.1,i?0xe2b844:0xa76b3e,.125,.12,(i-.5)*.14,.02);sphere(contents,.1,0xf3e5c7,-.12,.12,0,1,.6,1.25);box(contents,.075,.02,.1,0x456b43,-.12,.175,0);}
  return g;
}

export function plant(parent,x,z,scale=1) {const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);cylinder(g,.19,.14,.3,0xae7650,0,.15,0);for(let i=0;i<7;i++){const a=i*2.4,m=sphere(g,.15,i%2?0x647f52:0x869d63,Math.cos(a)*.16,.35+i*.045,Math.sin(a)*.12, .7,1.7,.5);m.rotation.z=Math.cos(a)*.6;}return g;}
export function chair(parent,x,z,yaw=0) {const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=yaw;parent.add(g);box(g,.52,.12,.48,0x997247,0,.43,0);for(const dx of [-.18,.18])for(const dz of [-.16,.16])box(g,.07,.4,.07,0x70543a,dx,.21,dz);box(g,.48,.35,.065,0xa07c50,0,.75,-.21);for(const dx of [-.2,.2])box(g,.06,.37,.06,0x74563a,dx,.61,-.21);return g;}
