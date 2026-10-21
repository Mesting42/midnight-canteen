import * as THREE from 'three';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sharp=require(process.env.ART_NODE_MODULES ? path.join(process.env.ART_NODE_MODULES,'sharp') : 'sharp');
const width=1800,height=1200,halfHeight=8;
const target=new THREE.Vector3(0,.2,3.2);
const camera=new THREE.OrthographicCamera(-halfHeight*width/height,halfHeight*width/height,halfHeight,-halfHeight,.1,100);
camera.position.set(12,14,20.1);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
const project=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(camera);return[(p.x+1)*width/2,(1-p.y)*height/2];};
const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="1800" height="1200" fill="#d0cab5"/>`];
const polygon=(points,fill,stroke='#6e7063')=>parts.push(`<polygon points="${points.map(p=>project(...p).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
const floor=(x1,z1,x2,z2,fill)=>polygon([[x1,0,z1],[x2,0,z1],[x2,0,z2],[x1,0,z2]],fill);
const line=(a,b,stroke='#838b7d',width=2)=>parts.push(`<path d="M ${project(...a)} L ${project(...b)}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`);
const label=(value,x,y,z)=>{const p=project(x,y,z);parts.push(`<text x="${p[0]}" y="${p[1]}" text-anchor="middle" font-size="17" font-family="sans-serif" fill="#384336">${value}</text>`);};
floor(-16,3.9,16,10.05,'#c8cbbb');
for(let x=-15;x<=15;x+=1.2)line([x,0,4],[x,0,10.05],'#a8b3a5',1);
for(let z=4;z<10.1;z+=.8)line([-16,0,z],[16,0,z],'#a8b3a5',1);
floor(-16,10.1,16,13.8,'#8e9492');
for(let x=-16;x<16;x+=2.2)line([x,0,11.5],[x+.9,0,11.5],'#d9ce9a',3);
// The room plan is a strict placement guide. Final movable furniture is supplied as sprites.
floor(-4.85,-3.3,4.85,4.05,'#d8c5a1');
for(let x=-4.8;x<=4.9;x+=.65)line([x,0,-3.3],[x,0,4.02],'#bba783',1);
for(let z=-3.3;z<4.1;z+=.65)line([-4.8,0,z],[4.8,0,z],'#bba783',1);
polygon([[-4.85,0,-3.3],[4.85,0,-3.3],[4.85,3.05,-3.3],[-4.85,3.05,-3.3]],'#d6c5aa');
polygon([[-4.85,0,-3.3],[-4.85,0,4.02],[-4.85,2.2,4.02],[-4.85,3.05,-3.3]],'#b2b9a2');
polygon([[-1.65,1.8,-3.26],[1.65,1.8,-3.26],[1.65,2.65,-3.26],[-1.65,2.65,-3.26]],'#536f60');
label('BLANK RESTAURANT SIGN',0,2.2,-3.24);
// Low cutaway front wall and a clear 1.7m central doorway.
for(const [a,b]of [[-4.85,-.88],[.88,4.85]])polygon([[a,0,4.03],[b,0,4.03],[b,.48,4.03],[a,.48,4.03]],'#a8b6a0');
label('OPEN DOOR',0,0,4.35);
// The continuous perimeter storefronts belong to the mall rather than freestanding kiosks.
for(const [x1,x2,z,color]of [[-12,-5.6,4.4,'#c1b092'],[6,13,4.7,'#a9b4a2']]){
  polygon([[x1,0,z],[x2,0,z],[x2,3.45,z],[x1,3.45,z]],color);
  for(let x=x1+.3;x<x2;x+=1.2)polygon([[x,.35,z+.02],[x+.95,.35,z+.02],[x+.95,2.4,z+.02],[x,2.4,z+.02]],'#9baea2');
}
label('MALL CONCOURSE: KEEP WALKWAY OPEN',-1,.03,7.6);
label('ROAD OUTSIDE GLAZING: NO PARKED CARS',0,.03,12.3);
// Mark only the glass baseline; no solid foreground panels should obscure actors.
line([-16,0,10.06],[16,0,10.06],'#64817a',6);
parts.push('</svg>');
const out=path.resolve('assets/painted/source');await fs.mkdir(out,{recursive:true});
const svg=parts.join('\n');await fs.writeFile(path.join(out,'layout-guide.svg'),svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(out,'layout-guide.png'));
const a=project(0,0,0),b=project(1,0,0);
await fs.writeFile(path.join(out,'layout-guide.json'),JSON.stringify({width,height,halfHeight,target:[0,.2,3.2],camera:[12,14,20.1],referenceUnit:Math.hypot(b[0]-a[0],b[1]-a[1])},null,2));
console.log(path.join(out,'layout-guide.png'));
