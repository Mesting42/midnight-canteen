import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const root=path.resolve('assets/open-source');
const relative=file=>path.relative(process.cwd(),file).split(path.sep).join('/');
function readGlb(file){const bytes=fs.readFileSync(file);if(bytes.readUInt32LE(0)!==0x46546c67)throw new Error('Invalid glTF binary: '+file);return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());}
function inspectGlb(file){
  const json=readGlb(file);
  return {file:relative(file),bytes:fs.statSync(file).size,meshes:json.meshes?.length||0,skins:json.skins?.length||0,
    joints:json.skins?.[0]?.joints.length||0,nodes:(json.nodes||[]).map(node=>node.name).filter(Boolean),
    animations:(json.animations||[]).map(animation=>({name:animation.name,tracks:animation.channels.length,
      maxKeys:Math.max(...animation.samplers.map(s=>json.accessors[s.input].count)),
      duration:Math.max(...animation.samplers.map(s=>json.accessors[s.input].max?.[0]||0))}))};
}
const libraryFile=path.join(root,'quaternius-ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb');
const carFolder=path.join(root,'kenney-car-kit/Models/GLB format');
const library=inspectGlb(libraryFile),sedan=inspectGlb(path.join(carFolder,'sedan.glb'));
const baseFolder=path.join(root,'quaternius-base-characters/Universal Base Characters[Standard]/Base Characters/Godot - UE');
const bodies=fs.readdirSync(baseFolder).filter(file=>file.endsWith('.gltf')).map(file=>{
  const json=JSON.parse(fs.readFileSync(path.join(baseFolder,file),'utf8'));
  return {file:relative(path.join(baseFolder,file)),skins:json.skins?.length||0,joints:json.skins?.[0]?.joints.length||0};
});
const animals=['Cat','Dog'].map(name=>{
  const file=path.join(root,`quaternius-animals/Animal Pack Vol.2 by @Quaternius/FBX/${name}.fbx`),bytes=fs.readFileSync(file);
  const model=new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  return {file:relative(file),animations:model.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length}))};
});
const archives=fs.readdirSync(path.join(root,'downloads')).filter(file=>file.endsWith('.zip')).map(file=>{
  const full=path.join(root,'downloads',file),bytes=fs.readFileSync(full);
  return {file:relative(full),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const catalog={verifiedOn:'2026-10-18',scope:'Free author-published editions only; not integrated into the restaurant renderer.',
  sources:[
    {name:'Universal Animation Library Standard',author:'Quaternius',license:'CC0-1.0',url:'https://quaternius.itch.io/universal-animation-library',licenseFile:'assets/open-source/quaternius-ual1/Universal Animation Library[Standard]/License.txt'},
    {name:'Universal Base Characters Standard',author:'Quaternius',license:'CC0-1.0',url:'https://quaternius.itch.io/universal-base-characters',licenseFile:'assets/open-source/quaternius-base-characters/Universal Base Characters[Standard]/License_Standard.txt'},
    {name:'Car Kit 3.1',author:'Kenney',license:'CC0-1.0',url:'https://opengameart.org/content/car-kit',licenseFile:'assets/open-source/kenney-car-kit/License.txt'},
    {name:'Animal Pack Vol.2',author:'Quaternius',license:'CC0-1.0',url:'https://opengameart.org/content/animated-animales-low-poly',licenseFile:null,licenseEvidence:'CC0 label on author-published OpenGameArt entry; no separate license text in this older archive.'}
  ],
  humanoid:{...library,usableMotionCount:library.animations.filter(a=>a.name!=='A_TPose').length},
  baseCharacters:bodies,
  vehicles:{glbFiles:fs.readdirSync(carFolder).filter(file=>file.endsWith('.glb')).length,sedan,wheelNodes:sedan.nodes.filter(name=>name.startsWith('wheel-'))},
  animals,archives,
  limitations:[
    'No matching ready-made Chinese retro hand-painted mall/restaurant set found in this search.',
    'Free base-character archive contains Superhero adult male/female bodies; Regular/Teen proportions from full-pack marketing are not in this downloaded free edition.',
    'Animal FBX import warns about vertices with more than four skin weights; Blender sources are provided for conversion and cleanup.',
    'No cooking, serving, cleaning, Chinese clothing or age-specific gait coverage has been verified.',
    'Source preview demonstrates motion and wheel pivots, not the final painted appearance.'
  ]};
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(JSON.stringify({catalog:relative(path.join(root,'catalog.json')),motionClips:catalog.humanoid.usableMotionCount,restPoses:1,freeBodies:bodies.length,carWheels:catalog.vehicles.wheelNodes.length,animals:animals.map(a=>path.basename(a.file)),archives:archives.map(a=>({file:a.file,sha256:a.sha256}))},null,2));
