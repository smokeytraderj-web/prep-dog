import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { build } from 'esbuild';
// Embed this small static app in the Worker, so local preview and Sites share the same APIs
// without depending on a platform-specific asset binding or a second public origin.
const assets = {};
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.csv':'text/csv; charset=utf-8'};
async function walk(dir, prefix='') {
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  if(entry.name==='server' || entry.name==='.openai') continue;
  const path=join(dir,entry.name), url=`${prefix}/${entry.name}`;
  if(entry.isDirectory()) await walk(path,url);
  else {
   if(!types[extname(entry.name)]) throw Error(`Unsupported asset type: ${entry.name}`);
   assets[url]={body:await readFile(path,extname(entry.name)==='.png'?'base64':'utf8'),type:types[extname(entry.name)],binary:extname(entry.name)==='.png'};
  }
 }
}
await walk('dist');
await mkdir('dist/server',{recursive:true});
await build({stdin:{contents:`import {benchmarkResponse} from './server/benchmark.js';
import {marketResponse} from './server/market.js';
import {historyResponse} from './server/history.js';
const assets=${JSON.stringify(assets)};
export default {async fetch(request) {
 const path=new URL(request.url).pathname;
 if(path==='/api/benchmark/sp500')return benchmarkResponse(request);
 if(path==='/api/market/ytd')return marketResponse(request);
 if(path==='/api/history')return historyResponse(request);
 if(request.method!=='GET' && request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const asset=assets[path==='/'?'/index.html':path];
 if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
}};`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',minify:true});
console.log('Sites Worker built with benchmark, YTD market and price-history APIs.');
