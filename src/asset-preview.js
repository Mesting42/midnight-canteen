import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import rigUrl from '../assets/open-source/quaternius-ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb?url';
import carUrl from '../assets/open-source/kenney-car-kit/Models/GLB format/sedan.glb?url';
import researchUrl from '../docs/OPEN_ASSET_RESEARCH.md?url';
import {MotionAtlas} from './motion-atlas.js';
import './asset-preview.css';

const host=document.querySelector('#preview'),status=document.querySelector('#status');
document.querySelector('#research-notes').href=researchUrl;
const controls=[...document.querySelectorAll('button,input,select')];
controls.forEach(el=>el.disabled=true);
const scene=new THREE.Scene();scene.background=new THREE.Color('#cfd5c8');
const camera=new THREE.OrthographicCamera(-7,7,4.8,-4.8,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xfff4db,0x718875,2.5));
const light=new THREE.DirectionalLight(0xfff2d5,3);light.position.set(-4,9,6);light.castShadow=true;
light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-10,right:10,top:7,bottom:-7});scene.add(light);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:'#cbd1c3',roughness:1}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.025;scene.add(floor);
const road=new THREE.Mesh(new THREE.PlaneGeometry(40,2.3),new THREE.MeshStandardMaterial({color:'#969e92',roughness:1}));
road.rotation.x=-Math.PI/2;road.position.set(0,-.016,1.6);road.receiveShadow=true;scene.add(road);
const grid=new THREE.GridHelper(30,30,0xa8b29d,0xbac3b1);grid.position.y=-.014;scene.add(grid);
for(let x=-16;x<=16;x+=1.4){const line=new THREE.Mesh(new THREE.PlaneGeometry(.55,.04),new THREE.MeshBasicMaterial({color:'#e7dfbb'}));line.rotation.x=-Math.PI/2;line.position.set(x,-.009,1.6);scene.add(line);}

let mixer,clips,actor,vehicle,wheels=[],currentAction,currentClip='Walk_Loop',playing=true,speed=1,distance=0;
const actorRoot=new THREE.Group();scene.add(actorRoot);
const vehicleRoot=new THREE.Group();scene.add(vehicleRoot);
const views=[[9,8,13],[-9,8,13],[11,5,0],[-11,5,0]];
function resize(){const width=host.clientWidth,height=host.clientHeight,aspect=width/height;camera.left=-6.2;camera.right=6.2;camera.top=6.2/aspect;camera.bottom=-6.2/aspect;camera.updateProjectionMatrix();renderer.setSize(width,height,false);}
function view(){camera.position.set(...views[Number(document.querySelector('#view').value)]);camera.lookAt(0,.6,.25);}
view();new ResizeObserver(resize).observe(host);resize();
const loader=new GLTFLoader();
try{
  const [human,car]=await Promise.all([loader.loadAsync(rigUrl),loader.loadAsync(carUrl)]);
  actor=human.scene;clips=human.animations;
  const box=new THREE.Box3().setFromObject(actor),size=box.getSize(new THREE.Vector3());
  actor.scale.setScalar(1.8/size.y);actor.position.y=-box.min.y*actor.scale.x;
  actor.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;object.material=new THREE.MeshToonMaterial({color:0xd4aa7e});}});
  actorRoot.add(actor);mixer=new THREE.AnimationMixer(actor);
  vehicle=car.scene;vehicle.scale.setScalar(1.15);vehicle.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;if(object.name.startsWith('wheel-'))wheels.push(object);}});
  // The original CC0 model has four separate wheel pivots along its local X axle.
  // These small rim markers make their rolling angle visible in the source preview.
  for(const wheel of wheels){
    const geometry=new THREE.BufferGeometry(),points=[];
    const side=wheel.position.x<0?-1:1;
    for(let i=0;i<3;i++){const a=i*Math.PI/3;points.push(side*.306,-Math.cos(a)*.15,-Math.sin(a)*.15,side*.306,Math.cos(a)*.15,Math.sin(a)*.15);}
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    wheel.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0xe1c184})));
  }
  vehicleRoot.add(vehicle);changeClip('Walk_Loop');controls.forEach(el=>el.disabled=false);
  status.textContent=`已载入：${clips.length} 个人物片段（含 T 姿势） · ${wheels.length} 个独立车轮 · 当前为原始素材外观`;
}catch(error){status.textContent='素材载入失败，请保持本地服务运行后刷新。'+error.message;console.error(error);}

function changeClip(name){
  const clip=THREE.AnimationClip.findByName(clips||[],name);if(!clip)return;
  const action=mixer.clipAction(clip);action.reset();
  const once=['Sitting_Enter','Sitting_Exit','PickUp_Table'].includes(name);
  action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;
  action.play();if(currentAction&&currentAction!==action)currentAction.crossFadeTo(action,.22,true);
  currentAction=action;currentClip=name;
  for(const button of document.querySelectorAll('[data-clip]'))button.setAttribute('aria-pressed',String(button.dataset.clip===name));
}
document.querySelectorAll('[data-clip]').forEach(button=>button.addEventListener('click',()=>changeClip(button.dataset.clip)));
document.querySelector('#pause').addEventListener('click',event=>{playing=!playing;event.currentTarget.textContent=playing?'暂停':'继续';event.currentTarget.setAttribute('aria-pressed',String(!playing));});
document.querySelector('#speed').addEventListener('input',event=>{speed=Number(event.target.value);document.querySelector('#rate').value=`${speed}×`;});
document.querySelector('#view').addEventListener('change',view);
// Reduced-motion users can start the source demonstration explicitly.
if(matchMedia('(prefers-reduced-motion: reduce)').matches){playing=false;document.querySelector('#pause').textContent='继续';document.querySelector('#pause').setAttribute('aria-pressed','true');}
let previous=performance.now();
renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-previous)/1000,.05)*(playing?speed:0);previous=now;
  if(mixer){
    mixer.update(dt);distance+=dt*1.1;
    const move=document.querySelector('#move').checked;
    const walking=currentClip==='Walk_Loop';
    if(walking&&move)actorRoot.position.x=((distance+4)%8)-4;
    else if(!move)actorRoot.position.x=-1.6;
    actorRoot.position.z=-1.3;actorRoot.rotation.y=Math.PI/2;
    vehicleRoot.position.set(move?4-((distance*.9+2)%8):1.8,0,1.6);
    // Car front is local +Z, so -PI/2 faces world -X, along this lane's velocity.
    vehicleRoot.rotation.y=-Math.PI/2;
    if(move)for(const wheel of wheels)wheel.rotation.x+=dt*1.1*.9/(.3*vehicle.scale.x);
  }
  renderer.render(scene,camera);
});
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);renderer.dispose();},{once:true});

const spriteBank=new MotionAtlas(),spriteCanvas=document.querySelector('#sprite-output'),spriteCtx=spriteCanvas.getContext('2d'),spriteStatus=document.querySelector('#sprite-status');
const sampleYaw=[0,Math.PI/2,Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI,-Math.PI/2];
const sampleEntries=sampleYaw.map((yaw,profile)=>({key:'preview-walker-'+profile,profile,person:{id:'preview-walker-'+profile,yaw,path:[1],phase:profile*.43,serial:profile}}));
spriteBank.loaded.then(ready=>{
  if(!ready){spriteStatus.textContent='主画面动作帧暂不可用，请检查本地动作素材。';return;}
  spriteStatus.textContent='8种身高与衣色 · 骨骼行走循环 · 车轮按行驶距离旋转';
  const draw=(now)=>{
    const time=now/1000;spriteBank.prepare(sampleEntries,time,false);spriteCtx.clearRect(0,0,spriteCanvas.width,spriteCanvas.height);
    spriteCtx.drawImage(spriteBank.canvas,0,0,1024,128,0,0,1024,128);
    spriteCtx.drawImage(spriteBank.canvas,0,816,1024,160,0,160,1024,160);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
});
