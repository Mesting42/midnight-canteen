import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
const requested=Number(process.env.PORT||4173);
function available(port){return new Promise(resolve=>{const s=createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
let port=requested;while(!(await available(port)))port++;
const child=spawn('npx',['vite','--host','0.0.0.0','--port',String(port)],{stdio:['ignore','pipe','pipe'],shell:true,windowsHide:true});
const host=hostname();let info={port,local:`http://127.0.0.1:${port}`,lan:`http://${host}:${port}`,pid:child.pid};
const relay=(chunk,isError=false)=>{const line=chunk.toString();(isError?process.stderr:process.stdout).write(line);const match=line.match(/Local:\s+https?:\/\/localhost:(\d+)\//);if(match){const actual=Number(match[1]);info={...info,port:actual,local:`http://127.0.0.1:${actual}`,lan:`http://${host}:${actual}`};writeFile('.server.json',JSON.stringify(info,null,2));console.log(`深夜食堂已启动\n电脑: ${info.local}\n局域网: ${info.lan}\n端口: ${actual}`);}};child.stdout.on('data',c=>relay(c));child.stderr.on('data',c=>relay(c,true));await writeFile('.server.json',JSON.stringify(info,null,2));child.on('exit',code=>process.exit(code??0));
