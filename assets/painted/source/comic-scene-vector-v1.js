import { POS, dishById } from './data.js';
import { tablePosition } from './engine.js';
import { WORKSPOTS, jobLocation } from './workflow.js';

const INK = '#24313b';
const PAPER = '#fff4dd';
const palette = ['#ef795f','#59a9a0','#e4b74f','#8e79b8','#78a46e','#e38a79','#5e94c2'];
const walkerLooks = [
  {age:'young',gender:'female',skin:'#f4c5a2',hair:'#382b2b',coat:'#e77f67',pants:'#4b6681',pet:'dog'},
  {age:'adult',gender:'male',skin:'#dba47d',hair:'#352b2c',coat:'#477d86',pants:'#334353'},
  {age:'child',gender:'female',skin:'#f0bc98',hair:'#4b332d',coat:'#e6bd55',pants:'#ad7961',pet:'cat'},
  {age:'senior',gender:'male',skin:'#d9a981',hair:'#c8c4aa',coat:'#7789a6',pants:'#48566a'},
  {age:'adult',gender:'female',skin:'#f2c5a2',hair:'#4a2f29',coat:'#9d75a5',pants:'#48576a'},
  {age:'child',gender:'male',skin:'#dfa982',hair:'#3e342f',coat:'#75a9a0',pants:'#536c86'},
  {age:'senior',gender:'female',skin:'#edc1a0',hair:'#b7b7a9',coat:'#d27d65',pants:'#737f70',pet:'dog'},
  {age:'young',gender:'male',skin:'#e4b28b',hair:'#292c33',coat:'#508c63',pants:'#394861'},
  {age:'adult',gender:'male',skin:'#f0c09b',hair:'#625041',coat:'#cf9854',pants:'#52637c'},
  {age:'young',gender:'female',skin:'#d9a17d',hair:'#2d2d36',coat:'#5c79b2',pants:'#bb745e'},
  {age:'senior',gender:'male',skin:'#e9bb9c',hair:'#c2bba5',coat:'#83a17d',pants:'#4c5b63'},
  {age:'adult',gender:'female',skin:'#f3c6a2',hair:'#6a4634',coat:'#e09c62',pants:'#526c78',pet:'cat'},
];

const rounded = (ctx,x,y,w,h,r=0.08) => {
  const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();
};
function fillStroke(ctx,fill= PAPER,stroke=INK,width=.045){ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.fill();ctx.stroke();}
function outline(ctx,width=.045,color=INK){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';}
function ellipse(ctx,x,y,rx,ry,fill,stroke=INK,width=.04){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);fillStroke(ctx,fill,stroke,width);}
function poly(ctx,points,fill,stroke=INK,width=.045){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();fillStroke(ctx,fill,stroke,width);}
function line(ctx,points,color=INK,width=.04){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));outline(ctx,width,color);ctx.stroke();}
function text(ctx,value,x,y,size=.25,color=INK,weight=700,align='center'){
  ctx.save();ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Microsoft YaHei", "Segoe UI", sans-serif`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x,y);ctx.restore();
}
function hash(value){let h=2166136261;for(const c of String(value||''))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function guestLook(person,slot=0){
  const seed=hash(`${person?.id||person?.serial||'guest'}:${slot}`),look={...walkerLooks[seed%walkerLooks.length]};
  if(person?.type==='neighbor')Object.assign(look,{age:'senior',gender:'female'});
  else if(person?.type==='student')Object.assign(look,{age:'young',gender:seed%2?'male':'female'});
  else if(person?.type==='couple')Object.assign(look,{age:'adult',gender:slot?'female':'male'});
  else if(person?.type==='takeaway')Object.assign(look,{age:'young',gender:seed%2?'male':'female'});
  else if(person?.type==='worker')Object.assign(look,{age:'adult',gender:seed%3?'male':'female'});
  else if(person?.type==='artist')Object.assign(look,{age:'adult',gender:seed%2?'female':'male'});
  return {...look,coat:person?.id==='server'?'#eac66e':person?.id==='cleaner'?'#80a28b':look.coat};
}

export class ComicScene {
  constructor(host,view){
    this.host=host;this.view=view;this.canvas=document.createElement('canvas');this.canvas.className='comic-scene';this.canvas.setAttribute('aria-label','深夜食堂 2D 漫画场景');
    Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block',touchAction:'none',zIndex:'1'});
    host.appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.dpr=1;this.resize();
  }
  resize(){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.dpr=Math.min(window.devicePixelRatio||1,1.6);this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  }
  at(x,y,z){return this.view.project(x,y,z);}
  unit(x=0,z=0){const a=this.at(x,0,z),b=this.at(x+1,0,z);return Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));}
  worldPolygon(points,fill,stroke=INK,width=2){
    const p=points.map(([x,y,z])=>this.at(x,y,z));this.ctx.beginPath();p.forEach((v,i)=>i?this.ctx.lineTo(v.x,v.y):this.ctx.moveTo(v.x,v.y));this.ctx.closePath();this.ctx.fillStyle=fill;this.ctx.fill();if(stroke){this.ctx.strokeStyle=stroke;this.ctx.lineWidth=width;this.ctx.lineJoin='round';this.ctx.stroke();}
  }
  worldFloor(x1,z1,x2,z2,fill){this.worldPolygon([[x1,0,z1],[x2,0,z1],[x2,0,z2],[x1,0,z2]],fill);}
  worldWall(x1,x2,z,y,fill,stroke=INK,width=2){this.worldPolygon([[x1,0,z],[x2,0,z],[x2,y,z],[x1,y,z]],fill,stroke,width);}
  sign(x,y,z,w,h,label,fill,ink='#fff7df',font=.24){
    const p=this.at(x,y,z),u=this.unit(x,z),ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
    rounded(ctx,-w/2,-h/2,w,h,.09);fillStroke(ctx,fill,INK,.055);text(ctx,label,0,0,font,ink,800);ctx.restore();
  }
  render(state,time){
    const ctx=this.ctx,w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    const motionTime=state.settings?.reducedMotion?0:time;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#273d61');sky.addColorStop(.38,'#6f83a2');sky.addColorStop(.72,'#d9ad89');sky.addColorStop(1,'#f4d5a5');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    this.drawMall(motionTime,state.settings?.quality==='low');this.drawRestaurant(state);
    const ambient=this.ambient(motionTime,state.settings?.quality==='low');
    const active=[...(state.run?.customers||[]),...(state.run?.actors||[])].map((p,i)=>({p,look:guestLook(p,p.type==='couple'?i%2:0),kind:p.type?'guest':'worker',order:0}));
    const all=[...ambient.map(item=>({...item,order:1})),...active];
    all.sort((a,b)=>(a.p.z||0)-(b.p.z||0));
    for(const item of all){
      const p=item.p,look=item.look||guestLook(p);this.drawPerson(p,look,motionTime,item.kind==='walker');
      if(item.kind==='walker'&&look.pet)this.drawPetWithLead(p,look.pet,motionTime);
      if(p.type==='couple'&&p.companion){this.drawPerson({...p,...p.companion,id:`${p.id}:companion`,type:'couple'},guestLook(p,1),motionTime,false);}
    }
    this.drawMeals(state,motionTime);this.drawTaskEffects(state,motionTime);this.drawSelection(state);
    this.drawComicDetails(w,h,motionTime,state);
  }
  drawMall(time,low){
    const ctx=this.ctx;
    // A pale ceiling plane and repeated beams establish an indoor arcade above the corridor.
    this.worldPolygon([[-10,4.2,4.35],[10,4.2,4.35],[10,4.2,9.78],[-10,4.2,9.78]],'rgba(205,222,219,.32)','#607984',2);
    for(let x=-9;x<=9;x+=3){const a=this.at(x,4.16,4.55),b=this.at(x,4.16,9.65);line(ctx,[[a.x,a.y],[b.x,b.y]],'#b5c9c4',3);}
    // Road and passing cars sit behind a transparent glass wall at the end of the mall.
    this.worldFloor(-12,9.9,12,12.3,'#465164');
    for(let x=-11.5;x<12;x+=2.2){const a=this.at(x,0,10.55),b=this.at(x+.72,0,10.55);line(ctx,[[a.x,a.y],[b.x,b.y]],'#ead39b',2);}
    // Broad tiled concourse, with color breaks that guide the eye toward the restaurant.
    this.worldFloor(-10,4.0,10,9.9,'#cad9d2');
    this.worldFloor(-10,4.0,10,4.56,'#f0d7ad');
    for(let z=4.6;z<9.8;z+=.72){const a=this.at(-10,0,z),b=this.at(10,0,z);line(ctx,[[a.x,a.y],[b.x,b.y]],'#a9beb8',1);}
    for(let x=-9.8;x<=10;x+=1.35){const a=this.at(x,0,4.55),b=this.at(x,0,9.85);line(ctx,[[a.x,a.y],[b.x,b.y]],'#b5c9c0',1);}
    this.worldFloor(-10,5.95,10,6.0,'#90b4ae');
    const carCount=low?2:4;for(let i=0;i<carCount;i++){
      const dir=i%2? -1:1,span=22,raw=((time*(.44+i*.055)+i*6.7)%span),x=dir>0?-11+raw:11-raw;
      this.drawCar(x,10.7+(i%2)*.47,dir,palette[(i+2)%palette.length],time+i);
    }
    this.worldWall(-11,11,9.85,3.8,'rgba(200,232,238,.17)','#496476',3);
    for(let x=-10.5;x<=10.5;x+=2.1){const a=this.at(x,0,9.82),b=this.at(x,3.65,9.82);line(ctx,[[a.x,a.y],[b.x,b.y]],'#477084',3);}
    const head=this.at(0,3.65,9.82),tail=this.at(0,0,9.82);line(ctx,[[tail.x,tail.y],[head.x,head.y]],'#fff1cc',1.5);
    // Shopfronts make the walkway read as an indoor retail corridor.
    this.drawMallShop(-7.5,7.8,'花漾','花店','#efaa78');
    this.drawMallShop(8.8,5.2,'小星球','玩具店','#74a9ab',.78);
    this.drawMallShop(-5.2,5.0,'茶','饮品铺','#d7a753');
    this.drawMallShop(9.2,8.35,'书','绘本屋','#a98bb4',.78);
    for(const x of [-5.3,5.1])this.drawPlanter(x,7.65,0.84);
    this.sign(0,3.25,8.9,4.5,.58,'购物中心  ·  夜间通道','#375d73','#fff0ca',.23);
    // Ceiling lights and wayfinding pennants.
    for(const x of [-6,-2,2,6]){
      const p=this.at(x,3.25,6.7);ellipse(ctx,p.x,p.y,12,7,'#fff0bb','#7a8790',2);ctx.save();ctx.shadowColor='#ffe7a5';ctx.shadowBlur=18;ellipse(ctx,p.x,p.y+2,6,3,'#fff3ca','#fff3ca',1);ctx.restore();
    }
  }
  drawMallShop(x,z,label,sub,color,size=1){
    const u=this.unit(x,z),base=this.at(x,0,z),ctx=this.ctx;ctx.save();ctx.translate(base.x,base.y);ctx.scale(u*size,u*size);
    // Built-in shop facades use glazed doors, a lit fascia and a colored display bay.
    rounded(ctx,-1.16,-2.72,2.32,2.72,.08);fillStroke(ctx,color,INK,.075);
    rounded(ctx,-1.03,-2.56,2.06,.46,.045);fillStroke(ctx,'#fff0cf',INK,.04);text(ctx,label,0,-2.33,.25,INK,900);
    rounded(ctx,-.93,-1.96,1.86,1.72,.05);fillStroke(ctx,'#8fbeb9',INK,.045);
    ctx.fillStyle='rgba(246,249,224,.55)';ctx.fillRect(-.84,-1.85,1.68,1.47);
    rounded(ctx,-.49,-1.82,.98,1.42,.025);fillStroke(ctx,'rgba(226,190,129,.56)','#6a5a4b',.025);
    line(ctx,[[-.86,-.22],[-.86,-1.83],[.86,-1.83],[.86,-.22]],'#fff0d1',.045);
    rounded(ctx,-1.02,-.12,2.04,.20,.035);fillStroke(ctx,'#e9d8b7',INK,.035);text(ctx,sub,0,-.02,.15,'#5c5147',800);
    for(const dx of [-.84,.84]){rounded(ctx,dx-.055,-.34,.11,.12,.025);fillStroke(ctx,'#ffe39c',INK,.018);}
    if(label==='花漾'){
      for(const [x,c]of [[-.66,'#ef795f'],[.65,'#e4b74f']]){ellipse(ctx,x,-1.28,.09,.09,c,INK,.018);ellipse(ctx,x-.09,-1.28,.075,.06,'#fff0cf',INK,.015);ellipse(ctx,x+.09,-1.28,.075,.06,'#fff0cf',INK,.015);line(ctx,[[x,-1.18],[x,-.95]],'#5f9b72',.035);}
    }else if(label==='小星球'){
      for(const [x,c]of [[-.63,'#ef795f'],[.62,'#e4b74f']]){rounded(ctx,x-.11,-1.36,.22,.28,.05);fillStroke(ctx,c,INK,.022);ellipse(ctx,x,-1.41,.11,.08,'#fff0cf',INK,.018);}
    }else if(label==='书'){
      for(const [x,c]of [[-.64,'#e4b74f'],[-.4,'#ef795f'],[.62,'#59a9a0']]){rounded(ctx,x-.09,-1.37,.18,.42,.02);fillStroke(ctx,c,INK,.018);line(ctx,[[x,-1.33],[x,-.99]],'#fff0cf',.012);}
    }else{
      ellipse(ctx,0,-1.2,.21,.15,'#fff0cf',INK,.025);rounded(ctx,-.22,-1.3,.44,.16,.05);fillStroke(ctx,'#9b684a',INK,.018);line(ctx,[[.26,-1.4],[.38,-1.17]],'#9b684a',.025);
    }
    ctx.restore();
  }
  drawPlanter(x,z,s){
    const u=this.unit(x,z),p=this.at(x,0,z),ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(u*s,u*s);
    ellipse(ctx,0,-.12,.36,.13,'#ae7458');poly(ctx,[[-.31,-.11],[.31,-.11],[.24,.23],[-.24,.23]],'#d99467');
    for(let i=0;i<5;i++){const a=i*2.4,xx=Math.cos(a)*.22,yy=-.42-Math.sin(i)*.07;ctx.beginPath();ctx.ellipse(xx,yy,.13,.23,a*.35,0,Math.PI*2);fillStroke(ctx,i%2?'#5f9b72':'#7eae78',INK,.035);}
    ellipse(ctx,0,-.54,.11,.09,'#e88979');ctx.restore();
  }
  drawCar(x,z,dir,color,time){
    const u=this.unit(x,z),p=this.at(x,.04,z),ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(u*.78,u*.78);ctx.scale(dir,1);
    ellipse(ctx,0,.0,.77,.28,'rgba(23,34,51,.22)','rgba(23,34,51,.22)',.01);
    rounded(ctx,-.82,-.43,1.64,.68,.20);fillStroke(ctx,color,INK,.065);
    rounded(ctx,-.35,-.37,.76,.54,.16);fillStroke(ctx,'#a9d9db',INK,.045);
    line(ctx,[[.05,-.34],[.05,.08]],'#e8f3dc',.035);
    rounded(ctx,-.72,-.35,.23,.16,.05);fillStroke(ctx,'#ffe9a2',INK,.025);
    rounded(ctx,.49,-.35,.22,.16,.05);fillStroke(ctx,'#fff1b5',INK,.025);
    for(const xx of [-.48,.45]){rounded(ctx,xx-.14,.12,.28,.18,.06);fillStroke(ctx,'#303642',INK,.025);}
    if(Math.sin(time*2)>.96){ctx.beginPath();ctx.arc(-.58,-.9,.16,-Math.PI/2,Math.PI/2);outline(ctx,.045,'#f8db91');ctx.stroke();}
    ctx.restore();
  }
  ambient(time,low){
    const count=low?7:walkerLooks.length,range=11.2;
    return walkerLooks.slice(0,count).map((look,i)=>{
      const dir=i%2? -1:1,speed=.17+(i%4)*.025,travel=(time*speed+i*1.77)%range;
      return {kind:'walker',look,p:{id:`mall-walker-${i}`,x:dir>0?-5.6+travel:5.6-travel,z:[5.55,6.35,7.12,8.05][i%4],yaw:dir>0?Math.PI/2:-Math.PI/2,path:[{}],status:'walking',serial:i,phase:i*.91}};
    });
  }
  drawRestaurant(state){
    const ctx=this.ctx;
    // Warm wood floor and the illustrated back wall of the restaurant.
    this.worldFloor(-5,-3.6,5,4.13,'#a87b5b');
    this.worldFloor(-4.75,-3.25,4.75,3.98,'#e7c89a');
    for(let x=-4.55;x<4.6;x+=.47){const a=this.at(x,0,-3.2),b=this.at(x,0,3.95);line(ctx,[[a.x,a.y],[b.x,b.y]],x%1.4<.2?'#f1d8af':'#d1ae7e',1);}
    for(let z=-2.9;z<4;z+=.82){const a=this.at(-4.65,0,z),b=this.at(4.65,0,z);line(ctx,[[a.x,a.y],[b.x,b.y]],'#bb9168',1);}
    this.worldWall(-4.7,4.7,-3.2,2.9,'#8c5e48','#573e3a',4);
    this.worldWall(-4.55,4.55,-3.16,2.63,'#f1d8b0','#654b40',2);
    // Back-wall shelf shapes and framed menu art.
    for(const y of [1.58,2.15]){
      const a=this.at(-3.35,y,-3.08),b=this.at(3.35,y,-3.08);line(ctx,[[a.x,a.y],[b.x,b.y]],'#704b3e',5);
      for(let i=0;i<8;i++){const x=-3+i*.83,p=this.at(x,y+.2,-3.05);ellipse(ctx,p.x,p.y,8,10,palette[i%palette.length],INK,2);}
    }
    this.sign(0.1,2.26,-3.035,3.45,.77,'深 夜 食 堂','#315c63','#ffe2a3',.33);
    this.sign(-3.75,2.0,-3.02,.88,.54,'今夜菜单','#d87559','#fff3dc',.17);
    this.sign(3.67,2.0,-3.02,.86,.54,'晚间营业','#587f71','#fff3dc',.16);
    this.drawKitchen();
    for(let i=0;i<4;i++)this.drawTable(state,i);
    this.drawEntrance();
    this.drawPlanter(-4.1,3.2,1.15);this.drawPlanter(4.1,3.2,1.0);
    this.drawHostStand();
  }
  drawKitchen(){
    const ids=[['prep',-2.8,'切 配','#d78a5f'],['stove',-.8,'煮 炒','#668e77'],['plate',1.3,'裝 盤','#d4a34d'],['sink',3,'清 洗','#6f9baa']];
    for(const[id,x,label,color]of ids){
      const z=-2.35,u=this.unit(x,z),p=this.at(x,.9,z),ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
      poly(ctx,[[-.88,.28],[.84,.28],[.72,.55],[-.72,.55]],'#8b6048');
      rounded(ctx,-.94,-.30,1.88,.68,.12);fillStroke(ctx,color,INK,.075);
      rounded(ctx,-.78,-.46,1.56,.22,.06);fillStroke(ctx,'#f3dfb8',INK,.035);
      text(ctx,label,0,-.34,.18,'#283b43',900);
      if(id==='prep'){
        rounded(ctx,-.42,-.12,.84,.37,.05);fillStroke(ctx,'#dcb479',INK,.035);
        rounded(ctx,-.14,-.05,.3,.11,.02);fillStroke(ctx,'#70726a',INK,.025);
        line(ctx,[[-.08,-.32],[.16,-.02]],'#eef2e8',.055);ellipse(ctx,.2,-.31,.045,.045,'#7c5741',INK,.02);
      }else if(id==='stove'){
        for(const dx of [-.44,.42]){ellipse(ctx,dx,-.10,.25,.11,'#343d43',INK,.04);ellipse(ctx,dx,-.14,.17,.065,'#e9a75d','#573f3c',.035);}
        this.drawPotLocal(ctx,-.44,-.24);this.drawPanLocal(ctx,.42,-.24);
      }else if(id==='plate'){
        for(let i=0;i<3;i++){ellipse(ctx,-.54+i*.53,-.09,.19,.07,'#fff2d8','#554d49',.025);ellipse(ctx,-.54+i*.53,-.13,.11,.045,i===1?'#74a258':'#e6a75c','#9a795a',.018);}
      }else{
        rounded(ctx,-.58,-.16,1.16,.32,.08);fillStroke(ctx,'#b9d7cf',INK,.035);line(ctx,[[.25,-.35],[.25,-.13],[.55,-.13]],'#e2ede2',.05);ellipse(ctx,.59,-.12,.1,.06,'#7aa4a0',INK,.02);
      }
      ctx.restore();
    }
  }
  drawPotLocal(ctx,x,y){
    rounded(ctx,x-.22,y-.22,.44,.28,.08);fillStroke(ctx,'#788c84',INK,.04);ellipse(ctx,x,y-.22,.24,.07,'#455750',INK,.03);line(ctx,[[x-.3,y-.12],[x-.2,y-.1]],INK,.05);line(ctx,[[x+.2,y-.1],[x+.3,y-.12]],INK,.05);
  }
  drawPanLocal(ctx,x,y){
    ellipse(ctx,x,y-.12,.26,.1,'#535f59',INK,.04);ellipse(ctx,x,y-.15,.2,.065,'#dfad5f','#373b3a',.025);rounded(ctx,x+.22,y-.2,.36,.08,.04);fillStroke(ctx,'#8d6242',INK,.03);
  }
  drawTable(state,index){
    if(index===3&&!state.upgrades.includes('table'))return;
    const p=tablePosition(state,index),u=this.unit(p.x,p.z),anchor=this.at(p.x,.92,p.z),ctx=this.ctx;
    ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(u,u);
    ellipse(ctx,0,.38,.42,.12,'rgba(53,43,40,.18)','rgba(53,43,40,.18)',.01);
    poly(ctx,[[-.12,-.04],[.12,-.04],[.18,.46],[-.18,.46]],'#8e674c');
    rounded(ctx,-.68,-.32,1.36,.34,.12);fillStroke(ctx,'#ba8756',INK,.065);
    rounded(ctx,-.61,-.28,1.22,.21,.08);fillStroke(ctx,'#ead0a2','#725642',.035);
    ellipse(ctx,0,-.32,.09,.055,'#e7b568','#785842',.025);ellipse(ctx,0,-.41,.06,.07,'#ffe0a0','#765947',.02);
    text(ctx,String(index+1),0,-.17,.16,'#634c3c',900);
    for(const dx of [-.88,.88]){
      rounded(ctx,dx-.22,-.03,.44,.11,.035);fillStroke(ctx,'#8d6d4f',INK,.04);
      for(const side of [-1,1])line(ctx,[[dx+side*.13,.02],[dx+side*.16,.39]],'#76573f',.055);
      line(ctx,[[dx-.21,-.23],[dx+.21,-.23]],'#98724f',.07);
    }
    const table=state.run?.tables[index];if(table?.status==='dirty'&&!table.cleared){ellipse(ctx,.03,-.35,.22,.06,'#e9e4d3','#776c60',.03);ellipse(ctx,-.24,-.32,.13,.05,'#dcc8a5','#776c60',.025);}
    ctx.restore();
  }
  drawEntrance(){
    const ctx=this.ctx,z=4.06,u=this.unit(0,z),p=this.at(0,0,z);ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
    // Wide open portal connects the dining room directly to the mall hall.
    rounded(ctx,-1.32,-2.65,2.64,2.62,.16);fillStroke(ctx,'#80523f',INK,.085);
    rounded(ctx,-1.08,-2.39,2.16,2.38,.14);ctx.fillStyle='rgba(71,123,120,.28)';ctx.fill();outline(ctx,.055,'#293741');ctx.stroke();
    poly(ctx,[[-.83,-.14],[-.83,-2.20],[-.47,-2.02],[-.47,-.13]],'#e8aa75','#493e3e',.035);
    poly(ctx,[[.83,-.14],[.83,-2.20],[.47,-2.02],[.47,-.13]],'#e8aa75','#493e3e',.035);
    rounded(ctx,-.78,-2.82,1.56,.34,.09);fillStroke(ctx,'#edcd84',INK,.055);text(ctx,'欢迎光临',0,-2.65,.22,'#513e3a',900);
    for(const dx of [-1.47,1.47]){ellipse(ctx,dx,-2.05,.12,.25,'#ffdf96','#644c3b',.04);ctx.save();ctx.shadowColor='#ffd886';ctx.shadowBlur=14;ellipse(ctx,dx,-2.05,.07,.17,'#fff0bc','#fff0bc',.01);ctx.restore();}
    ctx.restore();
  }
  drawHostStand(){
    const p=this.at(3.3,0,1),u=this.unit(3.3,1),ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
    rounded(ctx,-.34,-.84,.68,.83,.08);fillStroke(ctx,'#627b71',INK,.055);rounded(ctx,-.42,-1.03,.84,.22,.06);fillStroke(ctx,'#e2bd79',INK,.04);
    rounded(ctx,-.19,-.93,.38,.17,.025);fillStroke(ctx,'#b7d0bd',INK,.025);text(ctx,'收銀',0,-.85,.11,'#35544c',800);ctx.restore();
  }
  drawPerson(person,look,time,walker=false){
    const x=Number.isFinite(person.x)?person.x:0,z=Number.isFinite(person.z)?person.z:0,p=this.at(x,.02,z),u=this.unit(x,z),ctx=this.ctx;
    const age=look.age||'adult',height=age==='child'?.78:age==='senior'?.93:age==='young'?.96:1,walking=!!person.path?.length&&!person.standTimer&&!person.seated;
    const swing=walking?Math.sin(time*8.5+(person.phase||person.serial||0))*.13:0;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(u*height,u*height);
    if(person.yaw!==undefined&&Math.cos(person.yaw)<-.25)ctx.scale(-1,1);
    ellipse(ctx,0,.035,.28,.08,'rgba(42,49,52,.22)','rgba(42,49,52,.22)',.01);
    const skin=look.skin||'#efbf9a',hair=look.hair||'#423536',coat=look.coat||'#668d91',pants=look.pants||'#45566b';
    const seated=!!person.seated;
    // Legs swing independently so the 2D figures keep the recognizable walk loop.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*.105,-.49);ctx.rotate((side===-1?1:-1)*swing);
      line(ctx,[[0,0],[side*.015,.29],[side*.025,.49]],INK,.16);line(ctx,[[0,0],[side*.015,.29],[side*.025,.49]],pants,.105);
      rounded(ctx,-.09,.40,.23,.13,.05);fillStroke(ctx,'#373b41',INK,.035);ctx.restore();
    }
    if(seated){
      for(const side of [-1,1]){line(ctx,[[side*.1,-.47],[side*.22,-.24],[side*.27,-.05]],INK,.16);line(ctx,[[side*.1,-.47],[side*.22,-.24],[side*.27,-.05]],pants,.105);}
    }
    // Jacket, shirt and a small comic-style collar.
    ctx.beginPath();ctx.moveTo(-.24,-.96);ctx.quadraticCurveTo(-.37,-.84,-.30,-.55);ctx.lineTo(-.23,-.46);ctx.lineTo(.23,-.46);ctx.quadraticCurveTo(.37,-.62,.29,-.88);ctx.lineTo(.21,-1.00);ctx.closePath();fillStroke(ctx,coat,INK,.05);
    poly(ctx,[[-.11,-.96],[0,-.78],[.12,-.96],[.09,-.49],[-.09,-.49]],look.shirt||'#f2dfbd',INK,.025);
    if(look.gender==='female'&&age!=='child'){
      poly(ctx,[[-.25,-.65],[.25,-.65],[.31,-.43],[-.31,-.43]],coat,INK,.035);
      line(ctx,[[-.22,-.55],[.22,-.55]],'#f3d3a9',.025);
    }
    // Arms are drawn as short, readable silhouettes with hand color at the end.
    for(const side of [-1,1]){
      ctx.save();ctx.translate(side*.25,-.88);ctx.rotate((side===-1?1:-1)*swing+(person.task?.phase==='work'?-.14:0));
      line(ctx,[[0,0],[side*.025,.23],[side*.06,.39]],INK,.13);line(ctx,[[0,0],[side*.025,.23],[side*.06,.39]],coat,.082);ellipse(ctx,side*.06,.4,.052,.052,skin,INK,.023);ctx.restore();
    }
    // Face and hair silhouette: distinct age, gender and expression cues at small scale.
    ellipse(ctx,0,-1.2,.245,.285,skin,INK,.045);
    if(look.gender==='female'&&age!=='child'){
      rounded(ctx,-.25,-1.35,.12,.42,.055);fillStroke(ctx,hair,INK,.035);rounded(ctx,.13,-1.35,.12,.42,.055);fillStroke(ctx,hair,INK,.035);
    }
    ctx.beginPath();ctx.ellipse(0,-1.33,.25,.17,-.05,Math.PI,Math.PI*2);fillStroke(ctx,hair,INK,.04);
    for(const side of [-1,1]){ellipse(ctx,side*.092,-1.22,.025,.035,INK,INK,.01);ellipse(ctx,side*.15,-1.12,.035,.025,'#ef927f','#d46f67',.015);}
    line(ctx,[[-.055,-1.095],[0,-1.07],[.055,-1.095]],'#874d4c',.018);
    if(age==='senior'){
      ellipse(ctx,0,-1.39,.26,.09,'#d8d4c7',INK,.035);
      for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*.09,-1.2,.055,0,Math.PI*2);outline(ctx,.018,'#53606a');ctx.stroke();}line(ctx,[[-.04,-1.2],[.04,-1.2]],'#53606a',.018);
      if(person.seated===undefined&&walker&&person.serial%4===3){line(ctx,[[.34,-.46],[.38,.02]],'#76634d',.035);ellipse(ctx,.38,.025,.055,.035,'#7a6651',INK,.015);}
    }else if(look.gender==='male'){
      rounded(ctx,-.20,-1.36,.4,.14,.07);fillStroke(ctx,hair,INK,.03);
      if(age==='adult')line(ctx,[[-.12,-1.0],[0,-.95],[.12,-1.0]],'#684d43',.024);
    }
    if(person.id==='chef'){
      rounded(ctx,-.21,-1.6,.42,.13,.055);fillStroke(ctx,'#fff5de',INK,.04);ellipse(ctx,0,-1.64,.20,.13,'#fff6e3',INK,.035);
      rounded(ctx,-.19,-.79,.38,.41,.05);fillStroke(ctx,'#f4ead0',INK,.04);line(ctx,[[0,-.77],[0,-.41]],'#d08b57',.03);
    }else if(person.id==='server'){
      rounded(ctx,-.18,-.72,.36,.16,.04);fillStroke(ctx,'#f6dfa1',INK,.025);
    }
    if(person.type==='takeaway'&&person.served>0){rounded(ctx,.22,-.73,.27,.34,.045);fillStroke(ctx,'#d5a869',INK,.035);text(ctx,'暖',.355,-.55,.1,'#63483b',800);}
    if(person.status==='eating'&&person.table!==null){
      ellipse(ctx,-.12,-.82,.18,.11,'#f2e6d0',INK,.035);ellipse(ctx,-.12,-.83,.13,.065,'#b96351','#805449',.025);line(ctx,[[.12,-.82],[.2,-1.01]],'#805638',.024);line(ctx,[[.17,-.82],[.25,-1.01]],'#805638',.024);
    }
    if(person.task?.phase==='work')this.drawHandProp(ctx,person.task,person.task.progress/(person.task.duration||1));
    ctx.restore();
  }
  drawHandProp(ctx,task,u){
    const step=task.step||task.kind;
    if(['chop','prep','fetch','pour','scoop','garnish','deliver','serve'].includes(step)){
      const color=step==='chop'?'#e6e9dd':step==='pour'?'#d3a86c':step==='scoop'?'#ead8b0':'#f5e5c8';
      rounded(ctx,.15,-.93,.25,.055,.02);fillStroke(ctx,color,INK,.025);
      if(step==='chop'){line(ctx,[[.29,-.91],[.17,-.76]],'#dde7e4',.035);}
      if(step==='pour'){line(ctx,[[.13,-.91],[.28,-.71]],'#b88a56',.05);}
      if(step==='garnish'){ellipse(ctx,.28,-.75,.035,.06,'#e4a551',INK,.015);}
    }else if(['wipe','wash','clean'].includes(step)){rounded(ctx,.18,-.88,.23,.12,.035);fillStroke(ctx,'#82aaa1',INK,.025);}
    else if(step==='payment'||step==='deposit'||step==='pay'){rounded(ctx,.18,-.86,.2,.1,.025);fillStroke(ctx,'#91b26e',INK,.025);}
  }
  drawPetWithLead(person,type,time){
    const dir=Math.sin(person.yaw||0)>0?1:-1,petX=person.x+dir*.43,petZ=person.z+.06,u=this.unit(petX,petZ),a=this.at(person.x,-.03,person.z),b=this.at(petX,.02,petZ),ctx=this.ctx;
    line(ctx,[[a.x,a.y-u*.42],[b.x,b.y-u*.25]],'#5e5146',Math.max(1,u*.025));this.drawPet(petX,petZ,type,time,person.phase||0);
  }
  drawPet(x,z,type,time,phase=0){
    const p=this.at(x,.03,z),u=this.unit(x,z)*.58,ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(u,u);
    ellipse(ctx,0,.03,.42,.11,'rgba(40,43,46,.18)','rgba(40,43,46,.18)',.01);
    const step=Math.sin(time*10+phase)*.055;
    if(type==='dog'){
      rounded(ctx,-.34,-.35,.55,.28,.13);fillStroke(ctx,'#bf8b5c',INK,.055);
      ellipse(ctx,.23,-.34,.21,.19,'#cf9a69',INK,.05);ellipse(ctx,.38,-.29,.15,.09,'#e5c09b',INK,.035);
      poly(ctx,[[.1,-.46],[.08,-.66],[.25,-.49]],'#855943');ellipse(ctx,.29,-.36,.025,.03,INK,INK,.01);
      for(const dx of [-.22,.07])line(ctx,[[dx,-.19],[dx+step,-.035]],INK,.085);
      line(ctx,[[-.34,-.28],[-.48,-.39],[-.54,-.48]],'#bf8b5c',.055);line(ctx,[[.24,-.12],[.23,-.28]],'#e95f56',.035);
      ellipse(ctx,-.04,-.36,.055,.035,'#f0d28b',INK,.02);
    }else{
      ellipse(ctx,0,-.30,.30,.21,'#d78f68',INK,.05);ellipse(ctx,.25,-.47,.18,.17,'#e8b28f',INK,.045);
      poly(ctx,[[.13,-.52],[.11,-.78],[.29,-.57]],'#c57b61');poly(ctx,[[.29,-.58],[.37,-.76],[.42,-.48]],'#c57b61');
      for(const dx of [-.14,.1])line(ctx,[[dx,-.14],[dx+step,-.02]],INK,.07);
      line(ctx,[[-.23,-.39],[-.43,-.48],[-.52,-.35]],'#d78f68',.055);line(ctx,[[.37,-.45],[.48,-.4]],'#62494b',.018);line(ctx,[[.37,-.43],[.48,-.44]],'#62494b',.018);
      ellipse(ctx,.3,-.48,.023,.03,INK,INK,.01);ellipse(ctx,.43,-.44,.025,.02,'#41393b',INK,.012);
    }
    ctx.restore();
  }
  drawMeals(state,time){
    const r=state.run;if(!r)return;
    for(const j of r.jobs){if(['new','waste'].includes(j.stage))continue;
      const loc=jobLocation(j);let p;
      if(loc==='actor'){
        const carrier=r.actors.find(a=>a.id===j.carrier)||r.actors.find(a=>a.task?.target===j.id);if(!carrier)continue;p=this.at(carrier.x+(carrier.yaw?Math.sin(carrier.yaw)*.16:.16),1.02,carrier.z+.1);
      }else if(loc==='supply')p=this.at(WORKSPOTS.supply.x,WORKSPOTS.supply.y,WORKSPOTS.supply.z);
      else if(loc==='prep')p=this.at(WORKSPOTS.prepRack(j.prepSlot||0).x,WORKSPOTS.prepRack(j.prepSlot||0).y,WORKSPOTS.prepRack(j.prepSlot||0).z);
      else if(loc==='stove')p=this.at(WORKSPOTS.stove(j.slot??j.sourceSlot??0,dishById[j.dish]?.method).x,1.38,-2.55);
      else if(loc==='plate')p=this.at(WORKSPOTS.plateRack(j.rack||0).x,1.1,WORKSPOTS.plateRack(j.rack||0).z);
      else if(loc==='table'){
        const customer=this.customerForJob(r,j);
        if(customer?.table===null||customer?.table===undefined)p=this.at(customer?.x??0,.92,(customer?.z??4.8)-.12);
        else {const table=tablePosition(state,customer.table);p=this.at(table.x,.99,table.z-.17);}
      }
      else continue;
      this.drawFoodIcon(p,j,time,this.customerForJob(r,j)?.type==='takeaway');
    }
  }
  customerForJob(run,job){return run.customers.find(c=>c.id===job.customer);}
  drawFoodIcon(p,job,time,takeaway=false){
    const ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.scale(1,1);
    ctx.beginPath();ctx.ellipse(0,3,16,7,0,0,Math.PI*2);fillStroke(ctx,'#fff1d7','#554b47',2);
    const type=job.visual||'plated',dish=job.dish;let colors={rice:'#f5e9c9',soup:'#c67956',egg:'#e8b14c',salad:'#73a15b',noodle:'#d6af68',pork:'#b56d50',don:'#c58248',fish:'#89a5a1',hotpot:'#6d8877',bento:'#ad7954'};
    const base=colors[dish]||'#cc9b67';
    if(type==='cooking'||type==='cooked'){
      ellipse(ctx,0,-8,12,6,'#56645e','#283540',2);ellipse(ctx,0,-11,8,4,base,'#684f42',1.5);
      if(job.stage==='heating'){ctx.save();ctx.globalAlpha=.48;for(let i=0;i<3;i++){const y=-20-((time*24+i*8)%15);ellipse(ctx,(i-1)*6,y,2,5,'#fff3d6','#fff3d6',.5);}ctx.restore();}
    }else if(type==='raw'||type==='chopped'){
      for(let i=0;i<4;i++){rounded(ctx,-8+(i%2)*10,-13+Math.floor(i/2)*7,7,5,.025);fillStroke(ctx,type==='raw'?base:'#78a76a','#5b5144',1);}
    }else{
      for(let i=0;i<5;i++){const a=i*2.4;ellipse(ctx,Math.cos(a)*6,-10+Math.sin(a)*3,4,3,i===2?'#79a458':base,'#655346',1);}
    }
    if(takeaway){
      rounded(ctx,-9,-18,18,17,.035);fillStroke(ctx,'#d6aa70','#5c493d',1.5);text(ctx,'暖',0,-10,6,'#664d40',900);
    }
    ctx.restore();
  }
  drawTaskEffects(state,time){
    const chef=state.run?.actors.find(a=>a.id==='chef');if(!chef?.task)return;
    if(['chop','pour','scoop','wash','greet','payment','deposit'].includes(chef.task.step)){
      const p=this.at(chef.x,1.75,chef.z),ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);
      const count=chef.task.step==='greet'?3:2;
      for(let i=0;i<count;i++){
        const a=time*2+i*2.09,r=7+Math.sin(time*8+i)*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+6),Math.sin(a)*(r+6));outline(ctx,2,i%2?'#eaa857':'#ef795f');ctx.stroke();
      }ctx.restore();
    }
  }
  drawSelection(state){
    const sel=this.view.selection;if(!sel)return;let p;
    if(sel.kind==='guest'){const c=state.run?.customers.find(g=>g.id===sel.target);if(c)p=this.at(c.x,0,c.z);}
    else if(sel.kind==='table'){const t=tablePosition(state,sel.target);p=this.at(t.x,.98,t.z);}
    else if(sel.kind==='station'){const sp=POS[sel.target];if(sp)p=this.at(sp.x,1.2,sp.z);}
    else if(sel.kind==='entrance')p=this.at(0,.1,4.1);
    if(!p)return;const ctx=this.ctx;ctx.save();ctx.strokeStyle='#f3b951';ctx.lineWidth=4;ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(p.x,p.y,27,13,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  drawComicDetails(w,h,time,state){
    const ctx=this.ctx;
    // Small hand-inked accents complete the comic panel without hiding the playfield.
    const p=this.at(-4.5,2.45,-3.1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.08);rounded(ctx,-34,-11,68,22,5);fillStroke(ctx,'#ffe6a7',INK,2);text(ctx,'今晚營業',0,1,12,'#5a403b',900);ctx.restore();
    const door=this.at(0,3.05,4.1);ctx.save();ctx.translate(door.x,door.y);for(let i=0;i<3;i++){const a=time*1.7+i*2.1;ctx.beginPath();ctx.moveTo(Math.cos(a)*4,Math.sin(a)*4);ctx.lineTo(Math.cos(a)*9,Math.sin(a)*9);outline(ctx,2,'#ffd675');ctx.stroke();}ctx.restore();
    if(state.run?.customers.some(c=>c.status==='queue')){
      const q=this.at(1.1,1.5,5.4);ctx.save();ctx.translate(q.x,q.y);rounded(ctx,-34,-13,68,25,8);fillStroke(ctx,'#fff2d7',INK,2);text(ctx,'排隊中',0,0,11,'#6a4d42',800);ctx.restore();
    }
    // Avoid overpainting clipped edges on compact landscape screens.
    ctx.save();ctx.strokeStyle='rgba(31,49,63,.35)';ctx.lineWidth=3;ctx.strokeRect(2,2,w-4,h-4);ctx.restore();
  }
  dispose(){this.canvas.remove();}
}
