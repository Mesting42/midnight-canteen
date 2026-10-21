import {createServer} from 'vite';

// Browser regressions do not need hot reload connections on every fixture load.
const server=await createServer({server:{host:'127.0.0.1',port:Number(process.env.PORT||4175),strictPort:true,hmr:false}});
await server.listen();server.printUrls();
