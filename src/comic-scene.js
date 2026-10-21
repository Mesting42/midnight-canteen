import { POS, dishById } from './data.js';
import { tablePosition, seatPosition } from './engine.js';
import { WORKSPOTS, jobLocation } from './workflow.js';
import backgroundUrl from '../assets/painted/department-store-v2.webp';
import propsUrl from '../assets/painted/props-v2.webp';
import frontUrl from '../assets/painted/people-walk-front-v2.webp';
import backUrl from '../assets/painted/people-walk-back-v2.webp';
import actionsUrl from '../assets/painted/people-actions-v2.webp';
import foodUrl from '../assets/painted/food-v2.webp';
import atlas from '../assets/painted/atlas-v2.json';
import {MotionAtlas} from './motion-atlas.js';

const INK='#514536',PAPER='#f6e9c9';
const HEIGHTS=[1.78,1.69,1.12,1.08,1.65,1.56,1.79,1.69,1.76,1.65,1.61,1.76];
const CROWD=[0,1,2,3,4,5,6,7,0,1,4,5];
const FOOD=['rice','soup','egg','salad','noodle','pork','don','fish','hotpot','bento'];
const PROP_HEIGHT=[128,105,145,112,85,70,70,82,104,76,27,27,34,34,106,100];
const PROP_ANCHOR=[.86,.84,.88,.86,.83,.87,.87,.86,.95,.91,.93,.93,.93,.93,.76,.76];
const hash=value=>{let n=2166136261;for(const ch of String(value||''))n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;};
const rounded=(ctx,x,y,w,h,r)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);};
const sameSelection=(a,b)=>a?.kind===b?.kind&&a?.target===b?.target;

function profile(person,companion=false){
  if(person.id==='chef')return 8;if(person.id==='server')return 9;if(person.id==='cleaner')return 10;
  const n=hash(person.id||person.serial);
  if(person.type==='neighbor')return 5;
  if(person.type==='couple')return companion?1:0;
  if(person.type==='student')return n%2;
  if(person.type==='worker')return 6+n%2;
  if(person.type==='artist')return n%2?0:6;
  if(person.type==='takeaway')return n%2?1:6;
  return n%8;
}

export class ComicScene{
  constructor(host,view){
    this.host=host;this.view=view;this.canvas=document.createElement('canvas');this.canvas.className='comic-scene painted-scene';
    this.canvas.setAttribute('aria-label','复古百货商场与深夜食堂手绘场景');
    Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block',touchAction:'none',zIndex:'1'});
    host.appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.images={};this.hitAreas=[];this.loading=true;this.loaded=0;this.motion=new MotionAtlas();this.resize();
    const urls={background:backgroundUrl,props:propsUrl,front:frontUrl,back:backUrl,actions:actionsUrl,food:foodUrl};
    Promise.all(Object.entries(urls).map(([key,url])=>new Promise((resolve,reject)=>{
      const img=new Image();img.decoding='async';
      img.onload=()=>{this.images[key]=img;this.loaded++;resolve();};
      img.onerror=()=>reject(new Error('无法加载场景资源 '+key));img.src=url;
    }))).then(async()=>{await this.motion.loaded;if(!this.disposed)this.loading=false;}).catch(error=>{this.error=error.message;console.error(error);});
    this.onMove=e=>{const hit=this.pick(e);this.canvas.style.cursor=hit?'pointer':'default';};
    this.canvas.addEventListener('pointermove',this.onMove);
  }
  resize(){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.dpr=Math.min(window.devicePixelRatio||1,this.view.quality==='low'?1:1.6);
    this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);
  }
  at(x,y,z){return this.view.project(x,y,z);}
  scales(){
    const zoom=this.view.zoom||1;
    return{x:this.host.clientWidth/1800*zoom,y:this.host.clientHeight/1200*zoom,zoom};
  }
  groundShadow(x,z,width,alpha=.16){
    const p=this.at(x,0,z),s=this.scales(),ctx=this.ctx;
    ctx.save();ctx.fillStyle='rgba(49,39,25,'+alpha+')';ctx.beginPath();ctx.ellipse(p.x,p.y,width*s.x,width*.25*s.y,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  render(state,time){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,w,h);this.hitAreas=[];
    if(this.loading){this.drawLoading(w,h);return;}
    const t=state.settings?.reducedMotion?0:time,s=this.scales();
    const bw=w*s.zoom,bh=h*s.zoom;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(this.images.background,(w-bw)/2,(h-bh)/2,bw,bh);
    this.drawPaintedSigns();
    const entrance=this.at(0,0,4.1);
    this.hitAreas.push({selection:{kind:'entrance',target:'entrance'},x:entrance.x-42*s.x,y:entrance.y-38*s.y,w:84*s.x,h:48*s.y,ground:entrance});
    const nodes=[];
    const add=(x,z,draw,bias=0)=>nodes.push({depth:this.at(x,0,z).y+bias,draw});
    this.addFurniture(state,add);
    this.addCars(t,state.settings?.quality==='low',add);
    const crowd=this.ambient(t,state.settings?.quality==='low'),motionEntries=[];
    for(const {person,id} of crowd)motionEntries.push({key:person.id,profile:id,person});
    for(const c of state.run?.customers||[]){
      if(c.status==='gone')continue;
      motionEntries.push({key:c.id,profile:profile(c),person:c});
      if(c.companion){const p={...c,...c.companion,id:c.id+':companion',status:c.status,table:c.table};motionEntries.push({key:p.id,profile:profile(c,true),person:p});}
    }
    for(const actor of state.run?.actors||[])motionEntries.push({key:actor.id,profile:profile(actor),person:actor});
    this.motion.prepare(motionEntries,t,!!state.settings?.reducedMotion);
    for(const item of crowd){
      const {person,id,pet}=item;
      add(person.x,person.z,()=>this.drawPerson(person,id,t,state,null));
      if(pet){
        const dir=Math.sin(person.yaw)>0?1:-1,px=person.x-dir*.65,pz=person.z+.13;
        add(px,pz,()=>this.drawPet(person,px,pz,pet,t));
      }
    }
    for(const c of state.run?.customers||[]){
      if(c.status==='gone')continue;
      add(c.x,c.z,()=>this.drawPerson(c,profile(c),t,state,{kind:'guest',target:c.id}));
      if(c.companion){
        const p={...c,...c.companion,id:c.id+':companion',status:c.status,table:c.table};
        add(p.x,p.z,()=>this.drawPerson(p,profile(c,true),t,state,{kind:'guest',target:c.id}));
      }
    }
    for(const actor of state.run?.actors||[])add(actor.x,actor.z,()=>this.drawPerson(actor,profile(actor),t,state,null));
    nodes.sort((a,b)=>a.depth-b.depth).forEach(n=>n.draw());
    this.drawMeals(state,t);
    this.drawSelection();
    this.drawContext(state);
    this.drawWindowLight(w,h);
  }
  drawLoading(w,h){
    const ctx=this.ctx;ctx.fillStyle='#d6c6a6';ctx.fillRect(0,0,w,h);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=INK;
    ctx.font='600 20px "KaiTi","STKaiti","SimSun",serif';ctx.fillText(this.error?'场景资源未能加载':'正在布置百货商场…',w/2,h/2-16);
    ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText(this.error?'请刷新后重试':this.loaded<6?this.loaded+' / 6':'正在载入动作模型…',w/2,h/2+15);
  }
  paintLabel(value,x,y,size,angle=.42){
    const ctx=this.ctx,s=this.scales(),p={x:(x/1536-.5)*this.host.clientWidth*s.zoom+this.host.clientWidth/2,y:(y/1024-.5)*this.host.clientHeight*s.zoom+this.host.clientHeight/2};
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(s.x*1800/1536,s.y*1200/1024);ctx.rotate(angle);
    ctx.fillStyle='#f5e7bc';ctx.shadowColor='rgba(21,34,24,.4)';ctx.shadowBlur=1;ctx.font='700 '+size+'px "KaiTi","STKaiti","SimSun",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,0,0);ctx.restore();
  }
  drawPaintedSigns(){
    this.paintLabel('深 夜 食 堂',1008,153,27,.416);
    const ctx=this.ctx,s=this.scales();
    const labels=[['百 货 书 屋',184,151,25],['花 漾 花 店',1188,558,24],['锦 华 百 货',1396,669,22]];
    for(const[value,x,y,size]of labels){
      const px=(x/1536-.5)*this.host.clientWidth*s.zoom+this.host.clientWidth/2,py=(y/1024-.5)*this.host.clientHeight*s.zoom+this.host.clientHeight/2;
      ctx.save();ctx.translate(px,py);ctx.scale(s.x*1800/1536,s.y*1200/1024);ctx.rotate(.42);ctx.fillStyle='#66513b';ctx.font='700 '+size+'px "KaiTi","STKaiti","SimSun",serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,0,0);ctx.restore();
    }
  }
  drawSprite(sheet,index,p,height,options={}){
    const frame=atlas[sheet]?.frames[index],img=this.images[sheet];if(!frame||!img)return null;
    const s=this.scales(),hh=height*s.y,ww=hh*frame.w/frame.h*(options.natural?1:s.x/s.y);
    const ax=options.anchorX??.5,ay=options.anchorY??1,xx=-ww*ax,yy=-hh*ay;
    const ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y+(options.bob||0));if(options.flip)ctx.scale(-1,1);
    ctx.drawImage(img,frame.x,frame.y,frame.w,frame.h,xx,yy,ww,hh);ctx.restore();
    const box={x:p.x-ww*(options.flip?1-ax:ax),y:p.y-hh*ay,w:ww,h:hh,ground:p};
    if(options.selection){const touchW=Math.max(32,box.w),touchH=Math.max(40,box.h);this.hitAreas.push({...box,x:box.x-(touchW-box.w)/2,y:box.y-(touchH-box.h)/2,w:touchW,h:touchH,selection:options.selection});}
    return box;
  }
  drawProp(index,x,z,selection=null,options={}){
    this.groundShadow(x,z,index>=14?46:index===4?29:19,index===9?.1:.13);
    const p=this.at(x,options.y||0,z);
    return this.drawSprite('props',index,p,options.height||PROP_HEIGHT[index],{anchorY:PROP_ANCHOR[index],selection,...options});
  }
  addFurniture(state,add){
    for(const [i,x,key]of [[0,-2.8,'prep'],[1,-.8,'stove'],[2,1.3,'plate'],[3,3.1,'sink']]){
      add(x,-2.35,()=>{const box=this.drawProp(i,x,-2.35,{kind:'station',target:key});this.stationTag(box,{prep:'切配',stove:'上锅',plate:'装盘',sink:'清洗'}[key]);});
    }
    for(let i=0;i<4;i++){
      if(i===3&&!state.upgrades.includes('table'))continue;
      const p=tablePosition(state,i),table=state.run?.tables[i];
      for(const side of [-1,1]){
        const seat=seatPosition(state,i,side);
        add(seat.x,seat.z,()=>this.drawProp(side<0?5:6,seat.x,seat.z),-.5);
      }
      add(p.x,p.z,()=>{
        const box=this.drawProp(4,p.x,p.z,{kind:'table',target:i});
        const top=this.at(p.x,.97,p.z);this.tableNumber(i,top);
        if(table?.status==='dirty'&&!table.cleared)this.drawSprite('food',11,top,22,{anchorY:.75});
      });
    }
    add(3.8,2.75,()=>this.drawProp(7,3.8,2.75,{kind:'station',target:'cashier'}));
    add(-4.28,3.65,()=>this.drawProp(8,-4.28,3.65,null,{height:91}));
    add(4.15,3.9,()=>this.drawProp(8,4.15,3.9,null,{height:79}));
    add(1.55,4.62,()=>this.drawProp(9,1.55,4.62,{kind:'entrance',target:'entrance'}));
  }
  stationTag(box,value){
    if(!box)return;const ctx=this.ctx,s=this.scales(),w=40*s.x,h=16*s.y,x=box.x+box.w/2,y=box.y+box.h-7*s.y;
    ctx.save();rounded(ctx,x-w/2,y,w,h,2);ctx.fillStyle='#f3e5bc';ctx.strokeStyle='#8c7857';ctx.lineWidth=.7;ctx.fill();ctx.stroke();ctx.fillStyle='#544b38';ctx.font='600 '+Math.max(8,10*s.y)+'px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(value,x,y+h/2);ctx.restore();
  }
  tableNumber(index,p){
    const ctx=this.ctx,s=this.scales();ctx.save();ctx.fillStyle='#f8ecd0';ctx.strokeStyle='#907751';ctx.lineWidth=.7;
    rounded(ctx,p.x-7*s.x,p.y-3*s.y,14*s.x,12*s.y,2);ctx.fill();ctx.stroke();ctx.fillStyle='#6a533c';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 '+Math.max(7,9*s.y)+'px Georgia,serif';ctx.fillText(String(index+1),p.x,p.y+3*s.y);ctx.restore();
  }
  addCars(time,low,add){
    for(let i=0;i<(low?2:4);i++){
      const direction=i%2?-1:1,x=direction*((time*(.8+i*.09)+i*8.4)%36-18),z=11.12+i%2*1.24;
      add(x,z,()=>this.drawCar(i,x,z));
    }
  }
  drawCar(index,x,z){
    const motion=this.motion,frame=motion?.getCar(index);if(!frame){this.drawProp(index%2?15:14,x,z);return;}
    const ctx=this.ctx,s=this.scales(),p=this.at(x,0,z),height=(index%2?PROP_HEIGHT[15]:PROP_HEIGHT[14])*s.y,width=height*frame.w/frame.h;
    this.groundShadow(x,z,46,.18);ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.drawImage(motion.canvas,frame.x,frame.y,frame.w,frame.h,p.x-width/2,p.y-height*.84,width,height);ctx.restore();
  }
  ambient(time,low){
    const count=low?8:12,span=23;
    return Array.from({length:count},(_,i)=>{
      const direction=i%2?-1:1,travel=(time*(.38+i%4*.065)+i*2.03)%span;
      return{id:CROWD[i],pet:i===1||i===7?'cat':i===0||i===5?'dog':null,person:{id:'walker-'+i,x:direction*(-11.5+travel),z:[6.25,7.0,7.9,8.85][i%4],yaw:direction>0?Math.PI/2:-Math.PI/2,path:[1],serial:i,phase:i*.63}};
    });
  }
  drawPerson(person,id,time,state,selection){
    const ctx=this.ctx,p=this.at(person.x,.02,person.z),moving=!!person.path?.length&&!person.seated&&!person.standTimer;
    const motion=this.motion?.getCharacter(person.id||'walker-'+(person.serial||0));
    if(motion){
      const height=HEIGHTS[id]*58*this.scales().y;
      this.groundShadow(person.x,person.z,id===2||id===3?8:11,.18);
      const drawHeight=height/.84,drawWidth=drawHeight,box={x:p.x-height*.25,y:p.y-height,w:height*.5,h:height,ground:p};
      ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(this.motion.canvas,motion.x,motion.y,motion.w,motion.h,p.x-drawWidth/2,p.y-height,drawWidth,drawHeight);ctx.restore();
      if(selection){const touchW=Math.max(32,box.w),touchH=Math.max(40,box.h);this.hitAreas.push({...box,x:box.x-(touchW-box.w)/2,y:box.y-(touchH-box.h)/2,w:touchW,h:touchH,selection});}
      return box;
    }
    const dx=Math.sin(person.yaw||0),dz=Math.cos(person.yaw||0),next=this.at(person.x+dx,0,person.z+dz),flip=next.x<p.x;
    const away=dx*.58+dz*.82<-.1,phase=moving?Math.floor(time*4.5+(person.phase||person.serial||0))%2:0;
    let sheet=away?'back':'front',frame=id*2+phase,height=HEIGHTS[id]*58,anchorY=1;
    if(person.seated){
      sheet='actions';frame=id*2+(person.status==='eating'&&Math.floor(time*.7)%2?1:0);
      height=HEIGHTS[id]*45;
    }else if(person.task?.phase==='work'){
      const step=person.task.step||person.task.kind;
      sheet='actions';
      if(id===8)frame=['pour','scoop','wash'].includes(step)?17:16;
      else if(id===9)frame=['deliver','lift','garnish'].includes(step)?19:18;
      else if(id===10){frame=step==='wash'?21:20;height=HEIGHTS[id]*49;}
      else {sheet=away?'back':'front';frame=id*2;}
    }
    this.groundShadow(person.x,person.z,id===2||id===3?8:11,.18);
    const bob=moving&&!state.settings?.reducedMotion?Math.sin(time*9+(person.serial||0))*.45*this.scales().y:0;
    this.drawSprite(sheet,frame,p,height,{natural:true,flip,anchorY,bob,selection});
  }
  drawPet(owner,x,z,type,time){
    const direction=Math.sin(owner.yaw)>0?1:-1,phase=Math.floor(time*5+(owner.phase||0))%2,index=type==='cat'?10+phase:12+phase;
    const p=this.at(x,.02,z),hand=this.at(owner.x,.62,owner.z),ctx=this.ctx,s=this.scales();
    ctx.save();ctx.strokeStyle='#84674a';ctx.lineWidth=Math.max(.6,s.y);ctx.beginPath();ctx.moveTo(hand.x,hand.y);ctx.quadraticCurveTo((hand.x+p.x)/2,Math.max(hand.y,p.y)-7*s.y,p.x,p.y-12*s.y);ctx.stroke();ctx.restore();
    this.drawProp(index,x,z,null,{flip:direction<0});
  }
  drawMeals(state,time){
    const r=state.run;if(!r)return;
    for(const job of r.jobs){
      if(['new','waste'].includes(job.stage))continue;
      const location=jobLocation(job),customer=r.customers.find(c=>c.id===job.customer);let p;
      if(location==='actor'){
        const actor=r.actors.find(a=>a.id===job.carrier)||r.actors.find(a=>a.task?.target===job.id);if(!actor)continue;
        p=this.at(actor.x+Math.sin(actor.yaw||0)*.18,1.04,actor.z+.08);
      }else if(location==='supply')p=this.at(WORKSPOTS.supply.x,WORKSPOTS.supply.y,WORKSPOTS.supply.z);
      else if(location==='prep'){const spot=WORKSPOTS.prepRack(job.prepSlot||0);p=this.at(spot.x,spot.y,spot.z);}
      else if(location==='stove'){const spot=WORKSPOTS.stove(job.slot??job.sourceSlot??0,dishById[job.dish]?.method);p=this.at(spot.x,1.28,spot.z);}
      else if(location==='plate'){const spot=WORKSPOTS.plateRack(job.rack||0);p=this.at(spot.x,1.12,spot.z);}
      else if(location==='table'){
        if(customer?.table===null)p=this.at(customer.x,.94,customer.z);
        else if(customer){if(r.tables[customer.table]?.status==='dirty')continue;const table=tablePosition(state,customer.table);p=this.at(table.x+(customer.jobs.indexOf(job.id)?-.25:.23),.98,table.z);}
      }
      if(!p)continue;
      const raw=['raw','chopped'].includes(job.visual),index=raw?10:customer?.type==='takeaway'&&location==='table'?9:Math.max(0,FOOD.indexOf(job.dish));
      this.drawSprite('food',index,p,raw?24:22,{anchorY:.8,natural:true});
      if(job.stage==='heating'&&!state.settings?.reducedMotion)this.steam(p,time);
    }
    for(const actor of r.actors){
      if(actor.holding==='dirty'){const p=this.at(actor.x+Math.sin(actor.yaw||0)*.15,1.02,actor.z+.05);this.drawSprite('food',11,p,23,{anchorY:.8,natural:true});}
    }
  }
  steam(p,time){
    const ctx=this.ctx,s=this.scales();ctx.save();ctx.strokeStyle='rgba(255,250,224,.62)';ctx.lineWidth=Math.max(.8,1.5*s.y);
    for(let i=0;i<3;i++){const k=(time*.5+i*.31)%1,x=p.x+(i-1)*6*s.x,y=p.y-(14+k*16)*s.y;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-4*s.x,y-4*s.y,x+4*s.x,y-7*s.y,x,y-12*s.y);ctx.stroke();}ctx.restore();
  }
  drawContext(state){
    const queued=state.run?.customers.filter(c=>c.status==='queue').length||0;if(!queued)return;
    const p=this.at(1.55,1.2,4.62),ctx=this.ctx,s=this.scales();ctx.save();
    rounded(ctx,p.x-23*s.x,p.y-8*s.y,46*s.x,17*s.y,3);ctx.fillStyle=PAPER;ctx.strokeStyle='#948264';ctx.lineWidth=.8;ctx.fill();ctx.stroke();ctx.fillStyle=INK;ctx.font='600 '+Math.max(8,10*s.y)+'px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(queued+' 位等候',p.x,p.y+.5*s.y);ctx.restore();
  }
  drawSelection(){
    const selected=this.view.selection;if(!selected)return;
    const area=[...this.hitAreas].reverse().find(a=>sameSelection(a.selection,selected));if(!area)return;
    const ctx=this.ctx,s=this.scales(),p=area.ground;ctx.save();ctx.strokeStyle='#cf9b3e';ctx.lineWidth=Math.max(1.4,2*s.y);ctx.setLineDash([4*s.x,3*s.x]);ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(13*s.x,Math.min(area.w*.45,38*s.x)),8*s.y,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  drawWindowLight(w,h){
    const ctx=this.ctx;ctx.save();const shade=ctx.createRadialGradient(w*.52,h*.42,w*.2,w*.52,h*.42,w*.8);shade.addColorStop(0,'rgba(255,244,212,0)');shade.addColorStop(1,'rgba(49,37,21,.12)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);ctx.restore();
  }
  pick(event){
    if(this.loading)return null;const rect=this.canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
    for(let i=this.hitAreas.length-1;i>=0;i--){const hit=this.hitAreas[i];if(x>=hit.x&&x<=hit.x+hit.w&&y>=hit.y&&y<=hit.y+hit.h)return hit.selection;}
    return null;
  }
  dispose(){this.disposed=true;this.canvas.removeEventListener('pointermove',this.onMove);this.canvas.remove();this.motion?.dispose();this.images={};}
}

