import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import humanUrl from '../assets/open-source/quaternius-ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb?url';
import carUrl from '../assets/open-source/kenney-car-kit/Models/GLB format/sedan.glb?url';

const WIDTH=1024,HEIGHT=1024,CELL=128,COLS=8,ROWS=6,CHARACTERS=COLS*ROWS;
const CAR_RECT={y:816,w:224,h:160,screenY:-5.4};
const INK='#514536';
const CLOTH=['#587789','#c9785f','#55774d','#d2a24e','#81775e','#817080','#596a70','#687e78','#f0e9d9','#718c78','#648096','#a57d55'];
const SKIN=['#d3a279','#d7a77d','#e0ad80','#e3b38b','#c99b72','#cda47e','#d0a07a','#d8aa83','#d4a07b','#d6aa83','#c99a75','#d7a27a'];
const ACTION_DURATION={Sitting_Enter:1.3,Sitting_Exit:1.033333,PickUp_Table:.833333};
const OUTLINE_OFFSETS=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
const motionKey=entry=>String(entry.key??entry.person?.id??entry.person?.serial??'walker');

export class MotionAtlas{
  constructor(){
    this.canvas=document.createElement('canvas');this.canvas.width=WIDTH;this.canvas.height=HEIGHT;
    this.ctx=this.canvas.getContext('2d');this.source=document.createElement('canvas');
    this.source.width=WIDTH;this.source.height=HEIGHT;this.slots=[];this.byKey=new Map();this.ready=false;
    this.loaded=this.load();this.lastFrame=-Infinity;this.lastReduced=null;this.disposeOnPageHide=()=>this.dispose();
    window.addEventListener('pagehide',this.disposeOnPageHide,{once:true});
  }
  async load(){
    try{
      const loader=new GLTFLoader(),[human,car]=await Promise.all([loader.loadAsync(humanUrl),loader.loadAsync(carUrl)]);
      this.rig=human.scene;this.clips=human.animations;this.car=car.scene;
      this.clipsByName=new Map(this.clips.map(clip=>[clip.name,clip]));
      const renderer=new THREE.WebGLRenderer({canvas:this.source,alpha:true,antialias:true,preserveDrawingBuffer:true});
      renderer.setPixelRatio(1);renderer.setSize(WIDTH,HEIGHT,false);renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.shadowMap.enabled=false;
      this.renderer=renderer;this.scene=new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xfff1d8,0x75614e,2.15));
      const key=new THREE.DirectionalLight(0xfff0d2,2.5);key.position.set(-7,12,9);this.scene.add(key);
      const fill=new THREE.DirectionalLight(0xc4d4c4,.65);fill.position.set(8,5,-9);this.scene.add(fill);
      this.ramp=this.makeRamp();
      this.camera=new THREE.OrthographicCamera(-7.2,7.2,7.2,-7.2,.1,120);
      const target=new THREE.Vector3(0,.2,3.2),direction=new THREE.Vector3(12,14,20.1).sub(target).normalize();
      this.camera.position.copy(direction).multiplyScalar(42);this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld(true);
      this.right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion).normalize();
      this.up=new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion).normalize();
      this.outlineTiles=new Map();this.makeCars();this.ready=true;
      return true;
    }catch(error){this.error=error;console.error('动画素材无法载入，暂用手绘姿势。',error);return false;}
  }
  makeRamp(){
    const data=new Uint8Array([62,62,62,255,112,112,112,255,176,176,176,255,238,238,238,255]);
    const texture=new THREE.DataTexture(data,4,1,THREE.RGBAFormat);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
  }
  stage(x,y){return this.right.clone().multiplyScalar(x).addScaledVector(this.up,y);}
  makeCharacter(index){
    const row=Math.floor(index/COLS),col=index%COLS,group=new THREE.Group();
    const cellX=(col+.5-COLS/2)*1.8,cellY=7.2-(row+.5)*1.8;
    group.position.copy(this.stage(cellX,cellY-.64));this.scene.add(group);
    const model=cloneSkeleton(this.rig),base=new THREE.Box3().setFromObject(model),baseSize=base.getSize(new THREE.Vector3());
    const normalize=1.8/(baseSize.y||1.8);model.scale.setScalar(normalize);model.position.y=-base.min.y*normalize;
    group.add(model);
    const slot={index,group,model,baseScale:normalize,baseMinY:base.min.y,mixer:new THREE.AnimationMixer(model),active:false,key:null,profile:0,lastAction:null,
      tile:this.makeTile(CELL,CELL),mask:this.makeTile(CELL,CELL),mode:null,modeAt:0};
    this.styleCharacter(slot,0);return slot;
  }
  makeTile(w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return{canvas,ctx:canvas.getContext('2d')};}
  styleCharacter(slot,id){
    const child=id===2||id===3,scale=([1.78,1.69,1.12,1.08,1.65,1.56,1.79,1.69,1.76,1.65,1.61,1.76][id]||1.7)/1.8;
    slot.profile=id;slot.model.scale.set(slot.baseScale*.98*scale,slot.baseScale*scale,slot.baseScale*1.02*scale);slot.model.position.y=-slot.baseMinY*slot.baseScale*scale;
    slot.group.traverse(object=>{
      if(object.isSkinnedMesh){
        const source=Array.isArray(object.material)?object.material:[object.material];
        object.material=source.map((material,index)=>new THREE.MeshToonMaterial({
          color:index===0?CLOTH[id%12]:SKIN[id%12],map:material.map||null,
          gradientMap:this.ramp||null,roughness:1,metalness:0
        }));object.frustumCulled=false;
        if(child){const head=object.skeleton?.getBoneByName('head')||object.skeleton?.getBoneByName('Head');if(head)head.scale.setScalar(1.12);}
      }
    });
    slot.mixer.timeScale=id===4||id===5?.82:child?1.12:1;
  }
  makeCars(){
    this.carSlots=[];const bb=new THREE.Box3().setFromObject(this.car),raw=bb.getSize(new THREE.Vector3());
    const baseScale=Math.min(.82,2.6/Math.max(raw.x,raw.z));
    for(let i=0;i<4;i++){
      const model=this.car.clone(true),group=new THREE.Group(),x=-4.8+i*3.2;
      const profile=i%2,paint=profile?'#c9ad83':'#aeb7b3';
      model.scale.setScalar(baseScale);model.position.y=-bb.min.y*baseScale;
      model.traverse(object=>{
        if(!object.isMesh)return;
        const original=Array.isArray(object.material)?object.material[0]:object.material;
        const wheel=object.name.startsWith('wheel-');
        object.material=new THREE.MeshToonMaterial({color:wheel?'#4b4338':paint,map:original?.map||null,gradientMap:this.ramp||null,roughness:1,metalness:0});
        object.castShadow=false;object.receiveShadow=false;
        if(wheel){
          object.userData.rollingWheel=true;
          const side=object.position.x<0?-1:1,points=[];
          for(let spoke=0;spoke<5;spoke++){const a=spoke*Math.PI*2/5;points.push(side*.303,-Math.cos(a)*.13,-Math.sin(a)*.13,side*.303,Math.cos(a)*.13,Math.sin(a)*.13);}
          const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
          object.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xd1bb91})));
        }
      });
      const stageY=CAR_RECT.screenY;
      group.position.copy(this.stage(x,stageY));group.rotation.y=i%2? -Math.PI/2:Math.PI/2;group.add(model);this.scene.add(group);
      const wheels=[];model.traverse(object=>{if(object.userData.rollingWheel)wheels.push(object);});
      this.carSlots.push({group,model,wheels,speed:.8+Math.floor(i/2)*.09,direction:i%2?-1:1,index:i,tile:this.makeTile(CAR_RECT.w,CAR_RECT.h),mask:this.makeTile(CAR_RECT.w,CAR_RECT.h)});
    }
  }
  getCharacter(key){const slot=this.byKey.get(String(key));return slot?{x:(slot.index%COLS)*CELL,y:Math.floor(slot.index/COLS)*CELL,w:CELL,h:CELL}:null;}
  getCar(index){
    const i=((index%this.carSlots.length)+this.carSlots.length)%this.carSlots.length,cx=-4.8+i*3.2;
    const centerX=Math.round((cx+7.2)/14.4*WIDTH),centerY=Math.round((.5-CAR_RECT.screenY/14.4)*HEIGHT);
    return{x:centerX-CAR_RECT.w/2,y:centerY-CAR_RECT.h/2,w:CAR_RECT.w,h:CAR_RECT.h};
  }
  prepare(entries,time,reducedMotion=false){
    if(!this.ready)return false;
    const present=new Map();for(const entry of entries)present.set(motionKey(entry),entry);
    for(const[key,slot]of this.byKey)if(!present.has(key)){slot.active=false;slot.key=null;this.byKey.delete(key);}
    for(const[key,entry]of present){
      let slot=this.byKey.get(key);
      if(!slot){slot=this.slots.find(candidate=>!candidate.active)||(this.slots.length<CHARACTERS?this.makeCharacter(this.slots.length):null);if(!slot)continue;if(!this.slots.includes(slot))this.slots.push(slot);slot.active=true;slot.key=key;this.byKey.set(key,slot);slot.mode=!!entry.person.seated?'seated':'standing';slot.modeAt=time;slot.lastAction=null;this.styleCharacter(slot,entry.profile);}
      if(slot.profile!==entry.profile)this.styleCharacter(slot,entry.profile);
      const person=entry.person;slot.group.rotation.y=Number.isFinite(person.yaw)?person.yaw:0;
      const moving=!!person.path?.length&&!person.standTimer;
      const mode=person.seated?'seated':moving?'moving':person.task?.phase==='work'?'working':'standing';
      if(mode!==slot.mode){if(mode==='seated')slot.transition='Sitting_Enter';else if(slot.mode==='seated')slot.transition='Sitting_Exit';else slot.transition=null;slot.mode=mode;slot.modeAt=time;}
      const elapsed=Math.max(0,time-slot.modeAt);let clipName='Idle_Loop',clipTime=time+(person.phase||person.serial||0)*.17;
      if(mode==='moving')clipName='Walk_Loop';
      else if(mode==='working')clipName='Interact';
      else if(mode==='seated')clipName=slot.transition==='Sitting_Enter'&&elapsed<1.3?'Sitting_Enter':'Sitting_Idle_Loop';
      else if(mode==='standing'&&slot.transition==='Sitting_Exit'&&elapsed<1.033333)clipName='Sitting_Exit';
      else slot.transition=null;
      if(clipName!==slot.lastAction){
        const clip=this.clipsByName.get(clipName)||this.clipsByName.get('Idle_Loop');
        const action=slot.mixer.clipAction(clip);action.reset();
        const once=clipName==='Sitting_Enter'||clipName==='Sitting_Exit'||clipName==='PickUp_Table';
        action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.play();
        if(slot.currentAction&&slot.currentAction!==action)slot.currentAction.crossFadeTo(action,.16,true);
        slot.currentAction=action;slot.lastAction=clipName;
      }
      const clip=this.clipsByName.get(clipName);if(clip){
        const localTime=clipName==='Sitting_Enter'?Math.min(elapsed,clip.duration):clipName==='Sitting_Exit'?Math.min(elapsed,clip.duration):clipTime;
        slot.mixer.setTime(reducedMotion?0:localTime);
      }
      slot.group.updateMatrixWorld(true);
    }
    for(const car of this.carSlots)for(const wheel of car.wheels)wheel.rotation.x=reducedMotion?0:(time*car.speed)/(.3*car.model.scale.x);
    if(reducedMotion===this.lastReduced&&time-this.lastFrame<1/12)return true;
    this.lastFrame=time;this.lastReduced=reducedMotion;
    this.renderer.clear(true,true,true);this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);
    this.compose();
    return true;
  }
  compose(){
    const ctx=this.ctx;ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.imageSmoothingEnabled=true;
    for(const slot of this.slots){if(!slot.active)continue;const sx=(slot.index%COLS)*CELL,sy=Math.floor(slot.index/COLS)*CELL;this.outlineTile(slot.tile,slot.mask,sx,sy,CELL,CELL,sx,sy);}
    for(const car of this.carSlots){const cx=-4.8+car.index*3.2,sx=Math.round((cx+7.2)/14.4*WIDTH),sy=Math.round((.5-CAR_RECT.screenY/14.4)*HEIGHT);this.outlineTile(car.tile,car.mask,sx-CAR_RECT.w/2,sy-CAR_RECT.h/2,CAR_RECT.w,CAR_RECT.h,sx-CAR_RECT.w/2,sy-CAR_RECT.h/2);}
  }
  outlineTile(tile,mask,sx,sy,w,h,dx,dy){
    const context=this.ctx;
    if(tile){tile.ctx.clearRect(0,0,w,h);tile.ctx.drawImage(this.source,sx,sy,w,h,0,0,w,h);mask.ctx.clearRect(0,0,w,h);mask.ctx.drawImage(tile.canvas,0,0);mask.ctx.globalCompositeOperation='source-in';mask.ctx.fillStyle=INK;mask.ctx.fillRect(0,0,w,h);mask.ctx.globalCompositeOperation='source-over';}
    else return;
    for(const[ox,oy]of OUTLINE_OFFSETS)context.drawImage(mask.canvas,dx+ox,dy+oy);
    context.drawImage(tile.canvas,dx,dy);
  }
  dispose(){
    window.removeEventListener('pagehide',this.disposeOnPageHide);
    this.renderer?.dispose();this.scene?.traverse(object=>{if(object.isMesh){object.geometry?.dispose();for(const material of(Array.isArray(object.material)?object.material:[object.material]))material?.dispose();}});
  }
}
