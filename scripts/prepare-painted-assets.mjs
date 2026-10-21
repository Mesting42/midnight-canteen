import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.ART_NODE_MODULES ? path.join(process.env.ART_NODE_MODULES,'sharp') : 'sharp');
const root=path.resolve('assets/painted');

// Measure actual alpha islands so a toe or hair strand near a grid boundary is not clipped.
// This only records source rectangles; the generated artwork remains unchanged.
async function measure(file,rows){
  const {data,info}=await sharp(path.join(root,file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),components=[];
  // The seated/action sheet uses tighter, nonuniform row gutters. Record their measured
  // boundaries explicitly so the neighboring chef cap and diner's shoes stay separate.
  if(file==='people-actions-v2.png'){
    const xs=[0,300/1024,550/1024,785/1024,1].map(v=>Math.round(v*w));
    const ys=[0,286/1536,532/1536,800/1536,1073/1536,1324/1536,1].map(v=>Math.round(v*h));
    const frames=[];
    for(let row=0;row<6;row++)for(let col=0;col<4;col++){
      let x1=xs[col+1],y1=ys[row+1],x2=xs[col],y2=ys[row];
      for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++)if(data[(y*w+x)*4+3]>=160){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y);}
      x1=Math.max(xs[col],x1-2);y1=Math.max(ys[row],y1-2);x2=Math.min(xs[col+1]-1,x2+2);y2=Math.min(ys[row+1]-1,y2+2);
      frames.push({x:x1,y:y1,w:x2-x1+1,h:y2-y1+1});
    }
    return{width:w,height:h,columns:4,rows,frames};
  }
  for(let start=0;start<w*h;start++){
    if(seen[start]||data[start*4+3]<160)continue;
    let head=0,tail=1;queue[0]=start;seen[start]=1;let x1=w,y1=h,x2=0,y2=0,sx=0,sy=0;
    while(head<tail){
      const p=queue[head++],x=p%w,y=Math.floor(p/w);x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);sx+=x;sy+=y;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
        const n=ny*w+nx;if(!seen[n]&&data[n*4+3]>=160){seen[n]=1;queue[tail++]=n;}
      }
    }
    if(tail>=40)components.push({x1,y1,x2,y2,area:tail,cx:sx/tail,cy:sy/tail});
  }
  const frames=Array.from({length:4*rows},()=>null);
  for(const c of components.sort((a,b)=>b.area-a.area)){
    const col=Math.min(3,Math.floor(c.cx/w*4)),row=Math.min(rows-1,Math.floor(c.cy/h*rows)),id=row*4+col;
    if(!frames[id])frames[id]={...c};
    else if(c.area>120){const f=frames[id];if(c.x2>=f.x1-9&&c.x1<=f.x2+9&&c.y2>=f.y1-9&&c.y1<=f.y2+9){f.x1=Math.min(f.x1,c.x1);f.x2=Math.max(f.x2,c.x2);f.y1=Math.min(f.y1,c.y1);f.y2=Math.max(f.y2,c.y2);}}
  }
  const result=frames.map((f,id)=>{if(!f||f.area<400)throw new Error(`${file}: missing sprite ${id}`);const x=Math.max(0,f.x1-3),y=Math.max(0,f.y1-3);return{x,y,w:Math.min(w,f.x2+4)-x,h:Math.min(h,f.y2+4)-y};});
  return{width:w,height:h,columns:4,rows,frames:result};
}
const definitions=[['front','people-walk-front-v2.png',6],['back','people-walk-back-v2.png',6],['actions','people-actions-v2.png',6],['props','props-v2.png',4],['food','food-v2.png',3]];
const atlas={reference:JSON.parse(await fs.readFile(path.join(root,'source/layout-guide.json'),'utf8'))};
for(const [name,file,rows]of definitions){
  atlas[name]=await measure(file,rows);
  await sharp(path.join(root,file)).webp({quality:92,alphaQuality:100,effort:5}).toFile(path.join(root,file.replace('.png','.webp')));
  console.log(name,atlas[name].frames.length,atlas[name].frames.map(f=>`${f.w}x${f.h}`).join(' '));
}
await sharp(path.join(root,'department-store-v2.png')).webp({quality:93,effort:5}).toFile(path.join(root,'department-store-v2.webp'));
await fs.writeFile(path.join(root,'atlas-v2.json'),JSON.stringify(atlas,null,2));
