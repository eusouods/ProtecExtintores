/* Cache the public shell; private records remain in the encrypted account vault. */
const CACHE='protecextintores-interface-v67',VERSION=67;
const root=new URL('./',self.location.href),marker=new URL('__shell-ready',root);
let preparing;
function prepareShell(){
 if(preparing)return preparing;
 preparing=(async()=>{
  const manifestResponse=await fetch(new URL('offline-assets.json',root),{cache:'reload'});
  if(!manifestResponse.ok)throw Error('Não foi possível preparar as telas.');
  const manifest=await manifestResponse.clone().json();if(manifest.version!==VERSION)throw Error('Uma nova versão será preparada automaticamente.');
  const indexResponse=await fetch(new URL('index.html',root),{cache:'reload'});if(!indexResponse.ok)throw Error('Tela inicial indisponível.');
  const urls=[...new Set(manifest.assets.map(path=>new URL(path,root).href))].filter(url=>new URL(url).origin===root.origin),downloaded=[];
  for(let offset=0;offset<urls.length;offset+=8)downloaded.push(...await Promise.all(urls.slice(offset,offset+8).map(async url=>{const response=await fetch(url,{cache:'reload'});if(!response.ok)throw Error('Preparação pendente: '+new URL(url).pathname);return[url,new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers})]})));
  const cache=await caches.open(CACHE);for(const [url,response] of downloaded)await cache.put(url,response);
  await cache.put(new URL('offline-assets.json',root),manifestResponse);await cache.put(new URL('index.html',root),indexResponse);await cache.put(marker,new Response(String(VERSION)));return true;
 })().finally(()=>preparing=null);return preparing;
}
self.addEventListener('install',event=>event.waitUntil(prepareShell().then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=(await caches.keys()).filter(key=>key.startsWith('protecextintores-')),previous=keys.filter(key=>key!==CACHE).slice(-1);
 for(const key of keys)if(key!==CACHE&&!previous.includes(key))await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{
 if(event.data?.type==='PREPARE_OFFLINE')event.waitUntil((async()=>{const cache=await caches.open(CACHE);if(!await cache.match(marker))await prepareShell();event.ports[0]?.postMessage({ok:true});})().catch(error=>event.ports[0]?.postMessage({ok:false,error:error.message})));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname)||url.pathname.includes('/api/')||url.pathname.includes('/media/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),navigation=request.mode==='navigate';
  if(navigation){const shell=await cache.match(new URL('index.html',root));if(shell)return shell;}
  const exact=await cache.match(request);if(exact)return exact;
  if(/\.(?:m?js|css)$/.test(url.pathname)&&url.search){for(const key of await caches.keys()){if(key===CACHE||!key.startsWith('protecextintores-'))continue;const old=await(await caches.open(key)).match(request);if(old)return old;}}
  try{return await fetch(request)}catch(error){if(navigation){for(const key of await caches.keys()){const shell=await(await caches.open(key)).match(new URL('index.html',root));if(shell)return shell;}}throw error;}
 })());
});
