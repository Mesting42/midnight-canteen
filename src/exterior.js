import * as THREE from 'three';
import { box, cylinder, torus, sphere, label, plant, makePerson, animatePerson, mat } from './models.js';

export function streetWalkerMotion(time,{speed,offset}) {
  const distance=time*speed+offset,progress=distance%36,forward=progress<18;
  return {distance,progress,forward,x:-9+(forward?progress:36-progress),yaw:forward?Math.PI/2:-Math.PI/2,wheelAngle:distance/.34};
}

export function streetCarMotion(time,{direction,speed,offset}) {
  const distance=time*speed+offset,along=distance%20;
  return {distance,x:direction>0?-10+along:10-along,yaw:direction>0?0:Math.PI,wheelAngle:distance/.185};
}

function beam(parent, from, to, radius, color) {
  const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
  const mesh=cylinder(parent,radius,radius,delta.length(),color);
  mesh.position.copy(a.add(b).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  return mesh;
}

function shop(parent,{x,z,width,color,sign,awning}) {
  const g=new THREE.Group();g.position.set(x,-.15,z);parent.add(g);
  box(g,width,2.65,2.8,color,0,1.15,0,.09);
  box(g,width+.16,.18,3,0x3d5656,0,2.55,0);
  box(g,width-.26,1.45,.03,0x203f47,0,1.05,1.42);
  for(const dx of [-width*.28,0,width*.28])box(g,.055,1.48,.065,0x9f997b,dx,1.06,1.47);
  box(g,width-.28,.045,.08,0xb09a73,0,1.07,1.47);
  for(const dx of [-width*.25,width*.25]){
    box(g,width*.4,.56,.025,0xcba971,dx,1.47,1.45);
    const window=g.children[g.children.length-1];window.material=mat(0xcba971,{emissive:0xc58c48,emissiveIntensity:.28});
  }
  const canopy=box(g,width+.13,.12,.76,awning,0,2.05,1.55);canopy.rotation.x=.14;
  for(let i=0;i<Math.floor(width/.27);i++)box(g,.13,.13,.76,0xe1cf9e,-width/2+.12+i*.28,2.08,1.55,.015);
  box(g,width-.1,.48,.08,0x304f50,0,2.32,1.45);
  const name=label(sign,{color:'#f1d99e',size:68,scale:width*.37});name.position.set(0,2.33,1.505);g.add(name);
  plant(g,-width*.4,1.7,.85);
  return g;
}

function makeStreetCar(parent,paint) {
  const car=new THREE.Group();car.name='street-car';parent.add(car);
  box(car,1.7,.36,.82,paint,0,.31,0,.11);
  box(car,.82,.43,.67,paint,-.08,.66,0,.12);
  box(car,.48,.26,.018,0x668084,-.08,.68,.345,.025);
  box(car,.48,.26,.018,0x668084,-.08,.68,-.345,.025);
  box(car,.32,.24,.018,0x668084,.34,.66,.345,.025);
  box(car,.32,.24,.018,0x668084,.34,.66,-.345,.025);
  box(car,.12,.12,.88,0xaaa994,.84,.22,0,.025);
  box(car,.12,.12,.88,0xaaa994,-.84,.22,0,.025);
  for(const side of [-1,1]){
    box(car,.09,.10,.055,0xf5dfa0,.76,.34,side*.421,.018);
    box(car,.09,.11,.055,0xa65243,-.78,.34,side*.421,.018);
  }
  box(car,.52,.16,.025,0x465051,.82,.38,0,.02);
  box(car,.06,.13,.02,0x465051,.91,.38,0,.012);
  const wheels=[];
  for(const x of [-.54,.55])for(const z of [-.42,.42]){
    const pivot=new THREE.Group();pivot.position.set(x,.18,z);car.add(pivot);
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.185,.185,.125,12),mat(0x303735));
    tire.rotation.x=Math.PI/2;tire.castShadow=true;tire.receiveShadow=true;pivot.add(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.082,.082,.132,10),mat(0xb7a982));
    hub.rotation.x=Math.PI/2;hub.castShadow=true;pivot.add(hub);wheels.push(pivot);
  }
  car.userData.wheels=wheels;return car;
}

function makeStreetPet(parent,kind) {
  const pet=new THREE.Group();pet.name=kind==='cat'?'street-cat':'street-dog';parent.add(pet);
  const coat=kind==='cat'?0x797d76:0xb28459,face=kind==='cat'?0xa9a18a:0xd3b28a;
  const body=box(pet,.38,.23,.22,coat,0,.20,0,.07);
  const head=sphere(pet,.13,face,.20,.32,0,1,.95,.9);
  if(kind==='cat'){
    for(const z of [-.075,.075]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.055,.16,4),mat(coat));ear.position.set(.17,.47,z);ear.rotation.z=-.25;ear.castShadow=true;pet.add(ear);}
  }else{
    for(const z of [-.105,.105])sphere(pet,.075,0x694f3d,.17,.29,z,.55,1.25,.65);
  }
  sphere(pet,.024,0x302e2a,.29,.34,.075);
  const legs=[];
  for(const x of [-.12,.13])for(const z of [-.07,.07]){
    const leg=new THREE.Group();leg.position.set(x,.13,z);pet.add(leg);box(leg,.065,.15,.065,coat,0,-.05,0,.018);legs.push(leg);
  }
  const tail=new THREE.Group();tail.position.set(-.2,.26,0);pet.add(tail);
  if(kind==='cat'){
    const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(-.05,.12,0),new THREE.Vector3(-.015,.22,0)]),8,.025,5,false),mat(coat));tail.add(tube);
  }else{
    const tip=sphere(tail,.045,coat,-.08,.1,0);tip.rotation.z=-.7;
  }
  pet.userData={legs,tail,head,body,kind};return pet;
}

function makeWheelchair(parent) {
  const chair=new THREE.Group();chair.name='moving-wheelchair';parent.add(chair);
  box(chair,.46,.075,.48,0x566862,0,.48,0,.025);
  box(chair,.39,.07,.38,0x71887a,0,.55,0,.035);
  box(chair,.075,.43,.48,0x617a70,-.2,.72,0,.025);
  for(const side of [-1,1]){
    // Arm rests frame the rider instead of reading as bicycle handlebars.
    box(chair,.44,.055,.055,0x596f64,-.015,.68,side*.27,.02);
    for(const x of [-.19,.17])box(chair,.055,.20,.055,0x596f64,x,.58,side*.27,.015);
  }
  // A forward-facing footplate sits in front of the seat and between the wheels.
  box(chair,.07,.055,.34,0x354b45,.42,.14,0,.015);
  box(chair,.06,.22,.06,0x354b45,.29,.24,0,.012);
  const wheels=[];
  for(const side of [-1,1]){
    const axle=new THREE.Group();axle.position.set(-.03,.35,side*.30);chair.add(axle);
    torus(axle,.34,.035,0x343d3c);
    const hub=cylinder(axle,.045,.045,.12,0xb8a879,0,0,0,12);hub.rotation.x=Math.PI/2;
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4,radius=.155;
      const spoke=box(axle,.014,.29,.012,0x879087,Math.cos(angle)*radius,Math.sin(angle)*radius,0,.003);
      spoke.rotation.z=angle-Math.PI/2;
    }
    wheels.push(axle);
  }
  chair.userData.wheels=wheels;return chair;
}

function nightMarketStall(parent,{x,z,title,paint,kind}) {
  const g=new THREE.Group();g.name=`market-stall-${kind}`;g.position.set(x,-.16,z);parent.add(g);
  // A compact pushcart keeps the shop entrance and the walking lane clear.
  box(g,1.95,.46,.88,0x755638,0,.43,0,.035);
  box(g,2.05,.12,.96,0xb68b56,0,.75,0,.04);
  box(g,1.7,.10,.70,0x846241,0,.22,0,.02);
  for(const dx of [-.78,.78])for(const dz of [-.33,.33])box(g,.08,.55,.08,0x654b36,dx,.48,dz,.012);
  for(const dx of [-.76,.76]){
    const wheel=torus(g,.13,.027,0x343b36,dx,.17,.39);wheel.rotation.y=Math.PI/2;
    cylinder(g,.036,.036,.11,0xb4935e,dx,.17,.39,12).rotation.x=Math.PI/2;
  }
  for(const dx of [-.91,.91])for(const dz of [-.42,.42])cylinder(g,.035,.045,1.45,0x5b4c38,dx,1.62,dz,8);
  box(g,2.2,.12,1.24,paint,0,2.23,0,.035);
  // Faded cream stripes make the canvas read as a hand-built market awning.
  for(let i=0;i<8;i++){
    const stripeX=-1.0+i*.285;
    box(g,.16,.025,1.22,i%2?0xe4d0a5:paint,stripeX,2.30,0,.012);
    box(g,.16,.15,.045,i%2?0xe4d0a5:paint,stripeX,2.12,.62,.012);
  }
  box(g,1.52,.42,.055,0x40564a,0,1.88,.48,.025);
  const sign=label(title,{color:'#f5e0b0',size:66,scale:.72});sign.position.set(0,1.88,.515);g.add(sign);
  const lamp=sphere(g,.16,0xf2cb82,kind==='noodle'?.56:-.56,1.72,.55,1,.9,1);
  lamp.material=mat(0xf2cb82,{emissive:0xe9a955,emissiveIntensity:.78});
  cylinder(g,.09,.07,.04,0x745638,lamp.position.x,1.89,.55,12);
  if(kind==='noodle'){
    cylinder(g,.25,.21,.29,0x7c8980,-.48,1.03,-.08,20);
    cylinder(g,.22,.22,.018,0x484f49,-.48,1.185,-.08,20);
    for(const x of [-.12,.28,.61]){
      cylinder(g,.105,.09,.09,0xd5c29b,x,1.00,-.12,14);
      cylinder(g,.045,.045,.065,0xb36b42,x,1.075,-.12,12);
    }
    for(const x of [-.61,.65]){box(g,.34,.06,.3,0x876342,x,1.02,.16,.015);for(let i=0;i<3;i++)sphere(g,.075,[0xc58c49,0x73904e,0xc66e48][i],x-.1+i*.1,1.11,.15,1,.65,1);}
  }else{
    for(let row=0;row<2;row++){
      box(g,.42,.16,.34,0x896843,-.56+row*.77,.99,-.13,.025);
      for(let i=0;i<4;i++)sphere(g,.072,[0xd88742,0xb95442,0xd4ae58,0x7c9a60][(i+row)%4],-.7+row*.77+(i%2)*.17,1.13,-.2+Math.floor(i/2)*.15,1,.9,1);
    }
    for(let i=0;i<3;i++)cylinder(g,.075,.065,.16,[0xb9784c,0x718c76,0xc99d55][i],-.35+i*.32,1.02,.22,12);
  }
  // Two low stools and a chalk menu give the carts a lived-in footprint.
  for(const sx of [-.54,.48]){
    cylinder(g,.23,.24,.075,0xb48250,sx,.34,.88,12);
    for(const dx of [-.15,.15])for(const dz of [-.13,.13])box(g,.045,.3,.045,0x705337,sx+dx,.16,.88+dz,.008);
  }
  const board=new THREE.Group();board.position.set(1.13,.58,.46);board.rotation.y=-.18;g.add(board);
  box(board,.38,.56,.07,0x514b3c,0,.36,0,.025);box(board,.31,.45,.025,0xe6d4aa,0,.37,.048,.01);
  const menu=label(kind==='noodle'?'热汤面':'时令鲜果',{color:'#715640',size:42,scale:.21});menu.position.set(0,.38,.065);board.add(menu);
  return{vendorX:x,vendorZ:z-.68,kind};
}

function marketLanternLine(parent) {
  const points=[];
  for(let i=0;i<=24;i++){
    const t=i/24,x=-8.65+t*17.3;
    points.push(new THREE.Vector3(x,3.65-Math.sin(t*Math.PI)*.36,4.12));
  }
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.017,6,false),mat(0x554c39)));
  for(let i=0;i<9;i++){
    const t=(i+.35)/9,index=Math.round(t*24),point=points[index];
    beam(parent,[point.x,point.y,point.z],[point.x,point.y-.18,point.z],.012,0x554c39);
    const color=i%3===0?0xe99f62:i%3===1?0xf1d18f:0xd37c59;
    const globe=sphere(parent,.115,color,point.x,point.y-.29,point.z,1,.9,1);
    globe.material=mat(color,{emissive:color,emissiveIntensity:.72});
    cylinder(parent,.075,.055,.045,0x73583b,point.x,point.y-.16,point.z,12);
  }
}

export class Neighborhood {
  constructor(parent) {
    const g=new THREE.Group();g.name='neighborhood';parent.add(g);this.root=g;this.walkers=[];this.vendors=[];this.marketSteam=[];
    // A continuous street replaces the empty green plane around the diorama.
    box(g,23,.28,18,0x213e41,0,-.7,2.25,.25);
    box(g,22,.11,3.5,0x354e56,0,-.48,8.2,.03);
    box(g,2.4,.1,12,0x354e56,-7.25,-.49,1.2,.03);
    box(g,22,.18,.15,0xa5b09b,0,-.31,6.42,.02);
    box(g,22,.18,.15,0xa5b09b,0,-.31,9.98,.02);
    for(let x=-10;x<=10;x+=2.5)box(g,1.1,.012,.07,0xc5c09c,x,-.415,8.2,.004);
    // Sidewalk seams, rain drains and a pedestrian crossing.
    for(let x=-10.2;x<10.5;x+=.85)for(const z of [5.95,10.5])box(g,.81,.035,.65,0x81938a,x,-.22,z,.025);
    for(let z=6.85;z<9.8;z+=.48)box(g,1.65,.014,.21,0xb6bcab,6.9,-.414,z,.004);
    for(const x of [-4,3.7]){
      box(g,.58,.015,.25,0x294047,x,-.20,6.15,.02);
      for(let i=0;i<6;i++)box(g,.024,.012,.2,0x5e7777,x-.23+i*.09,-.189,6.15,.002);
    }
    const cover=cylinder(g,.38,.38,.018,0x263e45,-1.3,-.407,8.9,32);
    for(const dz of [-.12,0,.12])box(g,.43,.012,.025,0x536a6d,-1.3,-.39,8.9+dz,.003);
    cover.name='manhole';
    // Neighboring storefronts sit behind the restaurant's open sight lines.
    shop(g,{x:-7.05,z:-2.5,width:3.2,color:0x648782,sign:'花 间 · 花铺',awning:0x526e61});
    shop(g,{x:6.85,z:-3.55,width:3.15,color:0x677e87,sign:'街 角 杂 货',awning:0xb88462});
    for(const [x,z] of [[-8.05,-.7],[-7.4,-.5],[-6.7,-.6]]){
      cylinder(g,.18,.14,.26,0xae785b,x,.02,z);
      for(let i=0;i<5;i++){const a=i*2.4;beam(g,[x,.1,z],[x+Math.cos(a)*.12,.65+i*.04,z+Math.sin(a)*.12],.012,0x5e8157);sphere(g,.065,i%2?0xe6b07c:0xb17e91,x+Math.cos(a)*.12,.65+i*.04,z+Math.sin(a)*.12);}
    }
    // An illuminated vending machine with real geometric rows and a coin slot.
    const vending=new THREE.Group();vending.position.set(5.38,-.14,-.25);vending.rotation.y=-.24;g.add(vending);
    box(vending,.86,1.75,.57,0xb96c55,0,.875,0,.08);
    box(vending,.63,1.1,.035,0x264b52,-.04,1.04,.304);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      cylinder(vending,.047,.047,.15,[0xe0bd73,0x85ad9b,0xb76e56][col],-.23+col*.2,.68+row*.28,.35,12);
      box(vending,.13,.025,.035,0xead6a8,-.23+col*.2,.57+row*.28,.34,.006);
    }
    box(vending,.43,.13,.03,0x193a42,0,.27,.31);box(vending,.07,.035,.03,0xe0c789,.34,.7,.31,.005);
    const vendingName=label('巷口饮物',{size:70,scale:.31});vendingName.position.set(0,1.63,.31);vending.add(vendingName);
    // Two distinct carts turn the bare sidewalk into a small late-night market.
    const stalls=[
      nightMarketStall(g,{x:-7.25,z:3.18,title:'深夜热汤',paint:0xa75f4d,kind:'noodle'}),
      nightMarketStall(g,{x:7.18,z:1.92,title:'街口果摊',paint:0x55766c,kind:'fruit'}),
    ];
    marketLanternLine(g);
    this.vendors=stalls.map((stall,i)=>{
      const model=makePerson({color:i?0x75866b:0x647b78,hair:i?0x4c372b:0x39302b,role:'shopkeeper'});g.add(model);
      return{model,x:stall.vendorX,z:stall.vendorZ,serial:40+i};
    });
    // Steam above the noodle pot gives the cart a warm, freshly-cooked cue.
    for(let i=0;i<5;i++){
      const puff=sphere(g,.09,0xf3ead6,-7.25+(i%2)*.12,1.55+i*.16,3.08,1,.7,1);
      puff.material=new THREE.MeshBasicMaterial({color:0xf3ead6,transparent:true,opacity:.16,depthWrite:false});
      this.marketSteam.push(puff);
    }
    this.marketCat=makeStreetPet(g,'cat');this.marketCat.scale.setScalar(.43);
    this.marketCat.position.set(-6.1,-.16,4.72);
    // A slatted street bench and a small delivery corner.
    const bench=new THREE.Group();bench.position.set(-3.85,-.16,5.65);g.add(bench);
    for(let i=0;i<3;i++)box(bench,1.65,.06,.12,0xa17f59,0,.43,-.15+i*.15,.015);
    for(let i=0;i<3;i++)box(bench,1.65,.11,.055,0xb08d62,0,.63+i*.14,-.27,.015);
    for(const x of [-.57,.57]){box(bench,.08,.48,.5,0x3b5551,x,.22,0);box(bench,.055,.65,.055,0x3b5551,x,.57,-.29);}
    for(const [x,z] of [[5.3,1.8],[5.15,2.45]]){
      box(g,.58,.37,.48,0x648675,x,.05,z,.025);
      for(let i=0;i<4;i++)box(g,.51,.032,.025,0x324e4b,x,-.065+i*.075,z+.249,.005);
      for(let i=0;i<5;i++)sphere(g,.074,0xc8a565,x-.19+(i%3)*.15,.27,z-.1+Math.floor(i/3)*.15);
    }
    // Bus stop, bollards and a second pool of warm street light.
    const stop=new THREE.Group();stop.position.set(5,-.19,5.78);g.add(stop);
    cylinder(stop,.035,.05,2.3,0x617b77,0,1.15,0);
    box(stop,.5,.65,.07,0x94b5a4,0,2.1,0,.09);
    const stopName=label('深夜巷',{color:'#203e42',size:68,scale:.22});stopName.position.set(0,2.13,.047);stop.add(stopName);
    box(stop,.31,.35,.055,0xd2d7b9,0,1.44,0,.025);
    for(const x of [-6,-1.9,2.1,7.7]){cylinder(g,.065,.09,.48,0x405b5d,x,.02,6.05);cylinder(g,.073,.073,.065,0xc7b378,x,.21,6.05);}
    cylinder(g,.06,.09,3.9,0x405c5d,7.9,1.48,4.9);
    beam(g,[7.9,3.39,4.9],[7.25,3.39,4.9],.05,0x405c5d);
    const shade=sphere(g,.21,0xf1c687,7.25,3.31,4.9,1,.55,1);shade.material=mat(0xf1c687,{emissive:0xedb56d,emissiveIntensity:.5});
    const light=new THREE.PointLight(0xffc985,5,6,2);light.position.set(7.25,3.2,4.9);g.add(light);
    // Utility wire behind the shops, so it never crosses the kitchen.
    for(const x of [-9.25,9.1]){cylinder(g,.055,.09,4.6,0x626d5e,x,1.66,-4.8);box(g,.95,.07,.08,0x626d5e,x,3.6,-4.8);}
    const wirePoints=Array.from({length:21},(_,i)=>new THREE.Vector3(-9.25+i*.918,3.75-Math.sin(i/20*Math.PI)*.46,-4.8));
    const wire=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wirePoints),24,.012,5,false),mat(0x30474b));g.add(wire);
    for(const [x,z] of [[-9.4,3.8],[8.9,.4],[-8.7,10.5],[8.5,10.5]])plant(g,x,z,1.8);
    // Keep the street lively with the same articulated low-poly characters as the dining room.
    const passerSpecs=[
      {type:'student',color:0x71929e,hair:0x302d30,lane:6.04,speed:.54,walkStride:.68},
      {type:'worker',color:0x566983,hair:0x38302b,lane:6.04,speed:.46,walkStride:.76,pet:'dog'},
      {type:'elder',color:0x9a8171,hair:0xb5aa93,lane:6.04,speed:.34,walkStride:.92,wheelchair:true},
      {type:'neighbor',color:0xa46f74,hair:0x584744,lane:6.04,speed:.4,walkStride:.8},
      {type:'child',color:0x78a074,hair:0x302d30,lane:10.45,speed:.48,walkStride:.52,pet:'cat'},
      {type:'student',color:0x85928d,hair:0x3e342f,lane:10.45,speed:.56,walkStride:.68},
      {type:'elder',color:0x76886f,hair:0xb5aa93,lane:10.45,speed:.36,walkStride:.92},
      {type:'worker',color:0x916f83,hair:0x352d2a,lane:10.45,speed:.43,walkStride:.76},
      {type:'child',color:0xc18b63,hair:0x3e302d,lane:6.04,speed:.50,walkStride:.56,pet:'cat'},
      {type:'elder',color:0x78908a,hair:0xb8ad95,lane:6.04,speed:.32,walkStride:.9},
      {type:'neighbor',color:0x638175,hair:0x39322c,lane:10.45,speed:.42,walkStride:.78},
      {type:'child',color:0xa66e74,hair:0x312c29,lane:10.45,speed:.46,walkStride:.54,pet:'dog'},
    ];
    const laneCounts=new Map();
    this.walkers=passerSpecs.map((spec,i)=>{
      const person=makePerson(spec);person.scale.setScalar(spec.type==='child'?.66:spec.type==='elder'?.92:.84);g.add(person);
      const pet=spec.pet?makeStreetPet(g,spec.pet):null;if(pet)pet.scale.setScalar(spec.pet==='cat'?.58:.66);
      const wheelchair=spec.wheelchair?makeWheelchair(g):null;
      const laneIndex=laneCounts.get(spec.lane)||0;laneCounts.set(spec.lane,laneIndex+1);
      const laneTotal=passerSpecs.filter(p=>p.lane===spec.lane).length;
      return{person,pet,wheelchair,lane:spec.lane,speed:spec.speed,walkStride:spec.walkStride,offset:laneIndex*18/laneTotal,serial:i,type:spec.type};
    });
    this.cars=[
      {model:makeStreetCar(g,0xd8c6a7),lane:7.32,direction:1,speed:.96,offset:2},
      {model:makeStreetCar(g,0x78908a),lane:9.05,direction:-1,speed:.82,offset:9},
      {model:makeStreetCar(g,0xc9825f),lane:9.58,direction:-1,speed:.72,offset:15,scale:.7},
    ];
  }
  update(time,dt,reducedMotion,low) {
    this.vendors.forEach(({model,x,z,serial},i)=>{
      const working=Math.floor((time+i*2.5)/6)%3!==0;
      animatePerson(model,{x,z,yaw:0,path:[],serial,status:'idle',task:{phase:working?'work':'idle'}},time+serial*.13,dt,reducedMotion);
      model.position.y=-.16;model.visible=!low;
    });
    this.marketSteam.forEach((puff,i)=>{
      const phase=reducedMotion?0:(time*.32+i/this.marketSteam.length)%1;
      puff.position.set(-7.25+(i%2)*.12+Math.sin(time*.8+i)*.035,1.46+phase*.72,3.08);
      puff.material.opacity=(1-phase)*.17;
      puff.visible=!low;
      puff.scale.setScalar(.65+phase*.7);
    });
    if(this.marketCat){this.marketCat.visible=!low;this.marketCat.userData.tail.rotation.z=reducedMotion?0:Math.sin(time*1.25)*.15;this.marketCat.userData.head.rotation.x=reducedMotion?0:Math.sin(time*.8)*.018;}
    this.walkers.forEach((walker,i)=>{
      const {person,pet,wheelchair,lane,speed,walkStride,offset,serial,type}=walker;
      const motion=streetWalkerMotion(time,{speed,offset}),{distance,x,yaw}=motion;
      person.visible=!low||i<4;
      if(wheelchair)wheelchair.visible=person.visible;
      animatePerson(person,{x,z:lane,yaw,path:wheelchair||reducedMotion?[]:[{}],status:'walking',serial,type,walkStride,seated:!!wheelchair,wheelchair:!!wheelchair},time+serial*.2,dt,reducedMotion);
      person.position.y=wheelchair?-.10:-.19;
      if(pet){pet.visible=person.visible;pet.position.set(x-(motion.forward?.42:-.42),-.17,lane+(i%2?.15:-.15));pet.rotation.y=yaw;const phase=distance*Math.PI*2/.42;pet.userData.legs.forEach((leg,k)=>leg.rotation.x=reducedMotion?0:Math.sin(phase+(k%2)*Math.PI)*.32);pet.userData.tail.rotation.z=reducedMotion?0:Math.sin(time*5+serial)*.18;pet.userData.head.rotation.x=reducedMotion?0:Math.sin(time*3+serial)*.025;}
      if(wheelchair){wheelchair.position.set(x,-.19,lane);wheelchair.rotation.y=person.rotation.y-Math.PI/2;wheelchair.userData.wheels.forEach(w=>{w.rotation.z=reducedMotion?0:motion.wheelAngle;});}
    });
    this.cars.forEach(({model,lane,direction,speed,offset,scale=1})=>{
      const motion=streetCarMotion(time,{direction,speed,offset});
      model.scale.setScalar(scale);
      model.visible=true;model.position.set(motion.x,-.39,lane);model.rotation.y=motion.yaw;
      model.userData.wheels.forEach(w=>{w.rotation.z=motion.wheelAngle;});
    });
  }
}
