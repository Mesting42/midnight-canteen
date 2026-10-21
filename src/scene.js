import * as THREE from 'three';
import { box,sphere,cylinder,torus,label,makePerson,plant,chair,mat,animatePerson } from './models.js';
import { TYPES,POS,dishById } from './data.js';
import { tablePosition,seatPosition } from './engine.js';
import { Neighborhood } from './exterior.js';
import {animateWorker,makeMealProp,updateMealProp} from './actions.js';

export class Restaurant {
  constructor(container,onSelect,state) {
    this.container=container;this.onSelect=onSelect;this.state=state;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x30453f);this.scene.fog=new THREE.Fog(0x30453f,24,50);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setClearColor(0x30453f);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.24;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;container.appendChild(this.renderer.domElement);Object.assign(this.renderer.domElement.style,{position:'absolute',inset:'0',width:'100%',height:'100%',opacity:'1',pointerEvents:'auto',zIndex:'1'});this.renderer.domElement.setAttribute('aria-label','深夜食堂等距3D经营场景');
    this.camera=new THREE.OrthographicCamera(-12,12,8,-8,.1,100);this.camera.position.set(12,14,20.1);this.camera.lookAt(0,.2,3.2);
    this.scene.add(new THREE.HemisphereLight(0xffe5ba,0x638479,2.5));const key=new THREE.DirectionalLight(0xffdfaf,3.3);key.position.set(-5,10,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:40});key.shadow.bias=-.001;key.shadow.normalBias=.025;this.scene.add(key);this.key=key;const fill=new THREE.DirectionalLight(0xadc8ca,1.1);fill.position.set(8,6,-8);this.scene.add(fill);
    this.world=new THREE.Group();this.scene.add(this.world);this.people=new Map();this.foods=new Map();this.hitTargets=[];this.tableModels=[];this.stations={};this.dynamic=new THREE.Group();this.scene.add(this.dynamic);this.frame=0;this.zoom=1;this.sceneTime=0;this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.build();this.applyQuality(state.settings.quality);this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);
    const surface=this.renderer.domElement;surface.addEventListener('pointerdown',e=>{this.down={x:e.clientX,y:e.clientY,id:e.pointerId};});surface.addEventListener('pointerup',e=>{const down=this.down;this.down=null;if(!down||down.id!==e.pointerId||Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)return;this.pick(e);});surface.addEventListener('pointercancel',()=>this.down=null);
  }
  clickable(group,kind,target) {group.userData.select={kind,target};this.hitTargets.push(group);return group;}
  build() {
    const g=this.world;
    this.neighborhood=new Neighborhood(g);
    box(g,16,.32,13,0x263f37,0,-.5,1,.18);box(g,11.2,.35,9.7,0x7c8a72,0,-.22,.7,.13);box(g,9.3,.26,7.1,0xb19673,0,0,.35,.08);
    // Individual planks and beveled frame rather than a flat floor texture.
    for(let i=0;i<23;i++)box(g,.39,.045,6.75,i%3===0?0xcbb08b:i%3===1?0xd6bc95:0xc4a580,-4.35+i*.396,.155,.38,.008);
    box(g,9.6,.16,.17,0x7d5a3d,0,.13,3.98);box(g,.17,.16,7.65,0x7d5a3d,-4.77,.13,.23);box(g,.17,.16,7.65,0x7d5a3d,4.77,.13,.23);
    box(g,9.55,2.85,.16,0xe4ceb0,0,1.48,-3.2);box(g,.17,2.85,7.4,0xe1caa8,-4.7,1.48,.4);
    for(const x of [-4.6,-1.5,1.7,4.6])box(g,.12,2.9,.17,0x6f5943,x,1.5,-3.075);
    box(g,9.3,.18,.12,0x80644b,0,.52,-3.065);box(g,9.3,.13,.19,0x826548,0,2.9,-3.08);
    // Left windows overlook a blue-green night street.
    for(const z of [-1.35,1.05]) {
      box(g,.03,1.45,1.8,0x284747,-4.6,1.85,z);for(const dz of [-.96,0,.96])box(g,.055,1.62,.07,0x8f7658,-4.56,1.85,z+dz);for(const y of [1.08,1.85,2.63])box(g,.055,.065,1.98,0x8f7658,-4.56,y,z);
      box(g,.16,.07,2.1,0x957551,-4.53,1.01,z);
    }
    const wallSign=label('深 夜 食 堂',{background:'#35574b',color:'#f7dfad',size:73,width:768,height:192,scale:1.5});wallSign.position.set(.1,2.29,-3.05);g.add(wallSign);box(g,3.22,.83,.04,0x7b6644,.1,2.29,-3.075);const subtitle=label('一盏灯 · 一碗热饭',{size:48,color:'#705842',scale:.82});subtitle.position.set(.1,1.66,-3.04);g.add(subtitle);
    // Pantry shelf with jars, cups, plates and ingredient baskets.
    for(const x of [-3.15,3.3]){
      box(g,1.9,.1,.38,0x9b7650,x,2.05,-2.9);box(g,1.9,.1,.38,0x9b7650,x,2.6,-2.9);
      for(let i=0;i<5;i++){const c=i%2?0xbf9463:0xede1c4;cylinder(g,.09,.09,.2,c,x-.65+i*.32,2.19,-2.84);cylinder(g,.1,.1,.04,0x8a5a3b,x-.65+i*.32,2.31,-2.84);cylinder(g,.07,.07,.13,0x799086,x-.6+i*.3,2.73,-2.83);}
    }
    // Kitchen occupies the back edge; workers stand in its open front aisle.
    for(const [id,x] of [['prep',-2.8],['stove',-.8],['plate',1.3],['sink',3]]){
      const station=new THREE.Group();station.position.set(x,0,-2.55);g.add(station);this.stations[id]=station;this.clickable(station,'station',id);
      box(station,id==='sink'?1.45:1.8,.85,.92,id==='stove'?0x525f5d:0xaaa391,0,.55,0);box(station,id==='sink'?1.6:1.95,.09,1.02,id==='prep'?0xc49b65:0xcbd0bb,0,1.02,0);
      if(id!=='stove'){for(const dx of [-.43,.43]){box(station,.74,id==='prep'?.30:.55,.028,0x8c8e80,dx,id==='prep'?.48:.59,.478);box(station,.23,.035,.05,0xd7d1b7,dx,id==='prep'?.54:.72,.51);}}
      const name=label(({prep:'切配',stove:'炉灶',plate:'装盘',sink:'清洁'})[id],{size:80,color:'#f7edd5',background:id==='prep'?'#626e4d':'#556962',scale:.52});name.position.set(0,.49,.5);station.add(name);
      if(id==='prep'){
        for(const bx of [-.67,-.12,.43])box(station,.50,.055,.50,0x97683f,bx,1.09,.20);
        this.restingKnife=new THREE.Group();station.add(this.restingKnife);box(this.restingKnife,.3,.025,.035,0x4d4841,.1,1.132,.20);box(this.restingKnife,.27,.032,.11,0xd6d6c8,-.13,1.14,.20);
        this.prepDrawer=new THREE.Group();this.prepDrawer.position.set(0,.78,.49);station.add(this.prepDrawer);box(this.prepDrawer,1.65,.22,.055,0x7f8b76,0,0,0);box(this.prepDrawer,.32,.035,.05,0xd7d1b7,0,0,.05);box(this.prepDrawer,1.5,.025,.34,0xb79c6d,0,-.10,-.16);
        for(let i=0;i<3;i++)box(station,1.7,.035,.34,0x8b7452,0,1.26+i*.22,-.27,.01);
        cylinder(station,.15,.13,.16,0xc7b389,.63,1.13,-.26);for(let j=0;j<3;j++)sphere(station,.065,0x82955c,.6+j*.065,1.27,-.26,.6,1.2,.6);
        const basket=box(station,.31,.15,.29,0x987b54,-.7,1.13,-.26);sphere(station,.067,0xd5b263,-.75,1.23,-.23);sphere(station,.06,0xd2a653,-.63,1.25,-.28);
      }else if(id==='stove'){
        this.burners=[];this.cookware=[];for(const bx of (this.state.upgrades.includes('stove')?[-.46,.46]:[-.46])){
          cylinder(station,.3,.3,.03,0x333d39,bx,1.08,0);const burner=torus(station,.23,.022,0xb98f4c,bx,1.105,0);burner.rotation.x=Math.PI/2;this.burners.push(burner);
          const pot=new THREE.Group(),pan=new THREE.Group();station.add(pot,pan);
          cylinder(pot,.245,.22,.26,0x707f79,bx,1.22,0);cylinder(pot,.213,.213,.008,0x3e4d46,bx,1.354,0);for(const side of [-1,1])box(pot,.12,.05,.09,0x465b50,bx+side*.27,1.25,0);
          cylinder(pan,.29,.26,.075,0x52625a,bx,1.155,0);cylinder(pan,.26,.26,.008,0x34483e,bx,1.197,0);box(pan,.09,.06,.34,0x9c744e,bx,1.17,.40,.02);pan.visible=false;
          this.cookware.push({pot,pan});
        }
        for(const bx of [-.5,0,.5])cylinder(station,.045,.045,.03,0xbdbba6,bx,.81,.486).rotation.x=Math.PI/2;
        box(station,1.7,.13,1,0x61716b,0,2.55,0);box(station,.5,.5,.46,0x77847b,0,2.84,-.16);
      }else if(id==='plate'){
        for(let j=0;j<3;j++)cylinder(station,.22,.2,.035,0xefdfbd,-.70,1.1+j*.036,-.40);
        for(const x of [.15,.48,.75]){cylinder(station,.06,.07,.17,x===.48?0xab6c45:0xe8dcc2,x,1.16,-.45);cylinder(station,.035,.035,.035,0x486344,x,1.27,-.45);}
      }else{
        box(station,.88,.03,.59,0x607970,0,1.079,0);box(station,.71,.025,.43,0x425e57,0,1.095,0);
        const faucet=torus(station,.155,.022,0xaebcaf,0,1.31,-.19);faucet.scale.y=1.4;box(station,.05,.31,.05,0xaebcaf,.155,1.2,-.19);box(station,.19,.035,.1,0xe3cb6f,.61,1.09,.12);
        if(this.state.upgrades.includes('wash')){box(station,.38,.055,.30,0x7b9189,.29,1.13,.14);box(station,.055,.23,.055,0xb5c3b8,.39,1.25,.03);torus(station,.095,.016,0xb5c3b8,.39,1.36,.03).rotation.x=Math.PI/2;}
      }
    }
    // Tables have two seats and a small warm lamp.
    for(let i=0;i<4;i++){
      const table=new THREE.Group();const p=POS.tables[i];table.position.set(p.x,0,p.z);g.add(table);this.clickable(table,'table',i);this.tableModels.push(table);
      cylinder(table,.11,.18,.67,0x6e5a40,0,.46,0);box(table,1.24,.12,.91,0xb88c57,0,.85,0,.12);box(table,1.15,.025,.82,0xd3ad75,0,.923,0,.06);
      chair(table,-.83,0,Math.PI/2);chair(table,.83,0,-Math.PI/2);
      cylinder(table,.07,.08,.06,0x755c3f,0,.99,-.22);cylinder(table,.075,.05,.14,0xf2d196,0,1.09,-.22);sphere(table,.05,0xfbe6b1,0,1.19,-.22,1,.45,1);
      const number=label(String(i+1),{color:'#785735',size:85,scale:.23});number.position.set(0,.79,.467);table.add(number);
      const mess=new THREE.Group();for(const side of [-1,1]){const pile=new THREE.Group();pile.position.set(side*.32,0,.16);pile.userData.side=side;cylinder(pile,.19,.17,.025,0xe5d5b2,0,.954,0);sphere(pile,.035,0x927848,0,.982,.025,1,.3,1);mess.add(pile);}mess.userData.rest=mess.children.map(pile=>pile.position.clone());mess.visible=false;table.add(mess);table.userData.mess=mess;
    }
    // Cash register, street, lanterns, cloth curtain and seating nook.
    const cash=new THREE.Group();cash.position.set(3.95,0,1.1);g.add(cash);this.clickable(cash,'station','cashier');box(cash,.63,.88,.73,0x7d775d,0,.54,0);box(cash,.8,.08,.88,0xba985e,0,1.02,0);box(cash,.43,.17,.37,0x516962,0,1.16,0);box(cash,.3,.19,.05,0x89b3a3,0,1.27,-.06);box(cash,.31,.03,.12,0xc1c5ac,0,1.26,.17);
    const cashLabel=label('收银',{background:'#566f5d',size:80,scale:.45});cashLabel.position.set(0,.65,.39);cash.add(cashLabel);
    if(this.state.upgrades.includes('service')){const nook=new THREE.Group();nook.position.set(3.92,.72,-3.035);g.add(nook);box(nook,.76,.75,.08,0x6e624d,0,.42,0);box(nook,.83,.075,.18,0xb38c5d,0,.08,.09);box(nook,.68,.055,.16,0xa98659,0,.69,.10);for(const x of [-.22,0,.22]){cylinder(nook,.025,.025,.15,0xc0a26e,x,.53,.08);box(nook,.14,.26,.035,x===0?0xb96f58:0x668376,x,.35,.09,.03);}const nookLabel=label('伙计备勤',{background:'#536b58',size:65,scale:.34});nookLabel.position.set(0,.96,.07);nook.add(nookLabel);}
    const enter=new THREE.Group();enter.position.set(0,0,4.1);g.add(enter);this.clickable(enter,'entrance','entrance');box(enter,2.4,.06,.5,0x9c9f85,0,.03,.32);box(enter,1.65,.025,.45,0x516e5b,0,.165,-.45);
    for(const x of [-1.18,1.18])box(enter,.12,2.8,.12,0x746047,x,1.47,0);box(enter,2.55,.17,.18,0x745438,0,2.9,0);
    for(let i=0;i<5;i++){box(enter,.42,.54,.025,0xad7758,-.92+i*.46,2.54,0,.025);const curtainLabel=label(i===1?'深':i===3?'夜':'',{size:65,scale:.18});curtainLabel.position.set(-.92+i*.46,2.54,.02);enter.add(curtainLabel);}
    for(const x of [-1.55,1.55]){box(enter,.035,.6,.035,0x524b34,x,2.63,0);const lantern=sphere(enter,.23,0xe8b376,x,2.19,0,1,1.3,1);lantern.material=mat(0xe8b376,{emissive:0xbe7f3a,emissiveIntensity:.25});cylinder(enter,.12,.12,.06,0x725c3b,x,2.48,0);cylinder(enter,.12,.12,.06,0x725c3b,x,1.9,0);}
    plant(g,4.4,3.5,1.5);plant(g,-4.25,3.3,1.3);plant(g,-4.25,-2.65,.8);plant(g,4.25,-2.6,.8);
    box(g,1.25,.46,.56,0x879779,-3.4,.27,4.65);box(g,1.31,.08,.61,0xadad86,-3.4,.53,4.65);plant(g,-3.7,4.67,1.25);plant(g,-3.1,4.67,1.1);
    const sandwich=new THREE.Group();sandwich.position.set(2.6,0,4.7);sandwich.rotation.y=-.15;g.add(sandwich);box(sandwich,.75,.89,.075,0x96734c,0,.61,0);box(sandwich,.62,.73,.018,0x34564c,0,.62,.045);for(const x of [-.27,.27])box(sandwich,.06,.52,.07,0x8a6b46,x,.3,.12);const sl=label('今夜开饭',{color:'#f0d8a3',size:68,scale:.31});sl.position.set(0,.75,.061);sandwich.add(sl);const sl2=label('18:00 — 24:00',{color:'#d2caa4',size:43,scale:.28});sl2.position.set(0,.5,.06);sandwich.add(sl2);
    // Exterior pavers, streetlamp, bicycle and foliage frame the miniature.
    for(let i=0;i<12;i++)for(let j=0;j<2;j++)box(g,.91,.03,.5,(i+j)%2?0x82917b:0x8f9b84,-5.1+i*.93,-.02,5.13+j*.54,.03);
    cylinder(g,.055,.085,3.7,0x334f46,-5.65,1.5,3);box(g,.78,.055,.08,0x334f46,-5.3,3.3,3);sphere(g,.16,0xf0d49b,-4.98,3.21,3,1,.6,1);const lamp=new THREE.PointLight(0xffcc7e,5,6,2);lamp.position.set(-4.98,3.13,3);g.add(lamp);
    const bike=new THREE.Group();bike.position.set(4.92,.35,3.95);bike.rotation.y=.2;g.add(bike);for(const x of [-.48,.48])torus(bike,.29,.026,0x2d4038,x,0,0);const frame=box(bike,.96,.035,.035,0xc59856,0,.09,0);frame.rotation.z=.3;box(bike,.03,.42,.04,0xc59856,.25,.28,0);box(bike,.23,.04,.14,0x464f3c,.25,.51,0);box(bike,.03,.42,.03,0x58766c,-.34,.28,0);box(bike,.21,.025,.04,0x58766c,-.42,.49,0);
    for(const [x,z,s] of [[-6,-2,2],[5.8,-2,2],[-6,5,1.5],[6,5,1.5]])plant(g,x,z,s);
    this.chef=makePerson({chef:true,color:0x527b69});this.chef.position.set(1,.16,2.3);this.dynamic.add(this.chef);this.people.set('chef',this.chef);
    this.steam=new THREE.Group();g.add(this.steam);for(let i=0;i<12;i++){const puff=sphere(this.steam,.055,0xf4ebd2,0,0,0);puff.material=new THREE.MeshBasicMaterial({color:0xf1e6cb,transparent:true,opacity:.22,depthWrite:false});puff.visible=false;}
    this.rain=new THREE.Group();g.add(this.rain);for(let i=0;i<70;i++){const drop=box(this.rain,.012,.16,.012,0x9bb7b2,-6+(i*1.713)%12,1+(i*.77)%5,4.8+(i*.231)%2.2,.001);drop.material=new THREE.MeshBasicMaterial({color:0x9bb7b2,transparent:true,opacity:.42});}
    this.highlight=new THREE.Mesh(new THREE.RingGeometry(.4,.46,40),new THREE.MeshBasicMaterial({color:0xf5d99c,transparent:true,opacity:.8,side:THREE.DoubleSide}));this.highlight.rotation.x=-Math.PI/2;this.highlight.position.y=.18;this.highlight.visible=false;this.dynamic.add(this.highlight);
  }
  applyQuality(quality) {this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,quality==='low'?1:1.75));this.renderer.shadowMap.enabled=quality!=='low';this.key.castShadow=quality!=='low';this.quality=quality;}
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);const halfWidth=Math.max(12,6.4*w/h)/this.zoom,halfHeight=halfWidth*h/w;this.camera.left=-halfWidth;this.camera.right=halfWidth;this.camera.top=halfHeight;this.camera.bottom=-halfHeight;this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();}
  setZoom(delta){this.zoom=THREE.MathUtils.clamp(this.zoom+delta,.8,1.3);this.resize();}
  dispose(){this.observer?.disconnect();this.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const material of(Array.isArray(o.material)?o.material:[o.material])){material.map?.dispose();material.dispose();}}});this.renderer.dispose();this.renderer.domElement.remove();}
  pick(e){
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
    this.ray.setFromCamera(this.pointer,this.camera);
    const targets=[...this.hitTargets,...this.people.values()];
    for(const hit of this.ray.intersectObjects(targets,true)){
      let object=hit.object;while(object&&!object.userData.select)object=object.parent;
      if(object?.userData.select){this.onSelect(object.userData.select);return;}
    }
  }
  project(x,y,z){const p=new THREE.Vector3(x,y,z).project(this.camera);return{x:(p.x+1)/2*this.container.clientWidth,y:(1-p.y)/2*this.container.clientHeight};}
  mark(selection,s){this.selection=selection;let p=null;if(selection?.kind==='station')p=POS[selection.target];if(selection?.kind==='table')p=tablePosition(s,selection.target);if(selection?.kind==='guest')p=s.run?.customers.find(c=>c.id===selection.target);if(selection?.kind==='entrance')p=POS.entrance;this.highlight.visible=!!p;if(p)this.highlight.position.set(p.x,.19,p.z);}
  disposeObject(obj){obj.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material.map){o.material.map.dispose();o.material.dispose();}}});obj.removeFromParent();}
  update(s,dt,paused=false){this.state=s;this.frame++;this.sceneTime+=paused?0:dt;const r=s.run;
    const animDt=paused?0:dt;
    this.neighborhood.update(this.sceneTime,animDt,!!s.settings.reducedMotion,this.quality==='low');
    this.tableModels.forEach((m,i)=>{m.visible=i<3||s.upgrades.includes('table');const p=tablePosition(s,i);m.position.set(p.x,0,p.z);const t=r?.tables[i],mess=m.userData.mess;mess.visible=!!t?.seats?.some(seat=>seat.status==='dirty');mess.position.set(0,0,0);mess.children.forEach((pile,k)=>{pile.visible=t?.seats?.some(seat=>seat.status==='dirty'&&seat.side===pile.userData.side)||false;pile.position.copy(mess.userData.rest[k]);pile.scale.setScalar(1);});});
    const fetcher=r?.actors.find(a=>a.task?.step==='fetch'&&a.task.phase==='work');
    if(this.prepDrawer)this.prepDrawer.position.z=.49+(fetcher?Math.sin(Math.min(1,fetcher.task.progress/fetcher.task.duration)*Math.PI)*.24:0);
    if(this.restingKnife)this.restingKnife.visible=!r?.actors.some(a=>a.task?.step==='chop'&&a.task.phase==='work');
    this.rain.visible=['rain'].includes((s.day===3||s.day===7)?'rain':'clear')&&this.quality!=='low';
    if(!paused&&this.rain.visible)for(const drop of this.rain.children){drop.position.y-=dt*4;if(drop.position.y<.1)drop.position.y=5;}
    const active=new Set(['chef']);const list=r?[...r.actors,...r.customers]:[{id:'chef',x:1,z:2.3,yaw:-.5,path:[],status:'idle'}];
    for(const p of list){active.add(p.id);let model=this.people.get(p.id);if(!model){const type=TYPES.find(t=>t.id===p.type);model=makePerson(p.id==='server'?{color:0xb38654,hair:0x4a3427,role:'server'}:p.id==='cleaner'?{color:0x798767,hair:0x59392d,role:'cleaner'}:p.id.startsWith('shopkeeper-')||p.id==='shopkeeper'?{color:0x557c73,hair:0x3c2e27,role:'shopkeeper'}:{...type,type:p.type});model.userData.select={kind:'guest',target:p.id};this.people.set(p.id,model);this.dynamic.add(model);}
      animatePerson(model,p,this.sceneTime,animDt,!!s.settings.reducedMotion);
      if(!p.type)animateWorker(model,p,this.sceneTime,r?.jobs.find(j=>j.id===p.task?.target)?.dish);
      model.updateMatrixWorld(true);
      if(p.type==='couple'){
        const id=`${p.id}:companion`;active.add(id);let companion=this.people.get(id);
        if(!companion){companion=makePerson({color:0x849479,hair:0x4e3725,type:'couple'});companion.userData.select={kind:'guest',target:p.id};this.people.set(id,companion);this.dynamic.add(companion);}
        const companionSide=p.companion?.seatSide??-(p.seatSide??-1),seat=p.companion||(p.seated?seatPosition(s,p.table,companionSide):{x:p.x+Math.cos(p.yaw||0)*.43,z:p.z-Math.sin(p.yaw||0)*.43,yaw:p.yaw});
        animatePerson(companion,{...p,...seat,serial:(p.serial||0)+1},this.sceneTime,animDt,!!s.settings.reducedMotion);
        companion.updateMatrixWorld(true);
      }
    }
    for(const[id,model]of this.people)if(!active.has(id)){this.disposeObject(model);this.people.delete(id);}
    for(const a of r?.actors||[]){
      if(a.task?.step!=='collect'||a.task.phase!=='work')continue;
      const model=this.tableModels[Number(a.task.target)],worker=this.people.get(a.id),mess=model?.userData.mess;if(!mess||!worker)continue;
      const u=THREE.MathUtils.smoothstep(a.task.progress/a.task.duration,0,1),target=worker.userData.carry.getWorldPosition(new THREE.Vector3());
      target.x-=model.position.x;target.z-=model.position.z;target.y-=.954;mess.position.copy(target).multiplyScalar(u);
      mess.children.forEach((pile,k)=>{const rest=mess.userData.rest[k];pile.position.x=rest.x*(1-u);pile.position.y=rest.y+.045*u;pile.scale.setScalar(1-u*.15);});
    }
    const foods=new Set();
    if(r)for(const j of r.jobs){if(['new','waste'].includes(j.stage))continue;
      foods.add(j.id);let food=this.foods.get(j.id);if(!food){food=makeMealProp(j.dish);this.dynamic.add(food);this.foods.set(j.id,food);}
      updateMealProp(food,j,s,this.people,tablePosition);
    }
    for(const[id,food]of this.foods)if(!foods.has(id)){this.disposeObject(food);this.foods.delete(id);}
    const cooking=r?.jobs.filter(j=>j.stage==='heating')||[];this.burners.forEach((burner,i)=>{burner.material=mat(cooking.some(j=>j.slot===i)?0xefad60:0x7d8065);});
    this.cookware.forEach(({pot,pan},slot)=>{const job=r?.jobs.find(j=>j.slot===slot&&!['new','served','waste'].includes(j.stage)),frying=dishById[job?.dish]?.method==='fry';pot.visible=!frying;pan.visible=frying;});
    this.steam.children.forEach((p,i)=>{const j=cooking[i%Math.max(1,cooking.length)];p.visible=!!j&&this.quality!=='low';if(j){const t=(this.sceneTime*.7+i*.17)%1;p.position.set(-.8+(j.slot===0?-.46:.46)+Math.sin(i+t)*.08,1.5+t*.55,-2.55+Math.cos(i)*.07);p.scale.setScalar(.6+t);p.material.opacity=(1-t)*.28;}});
    this.renderer.render(this.scene,this.camera);
  }
}
