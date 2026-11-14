/* Public shell only. Authenticated API data and media belong to the per-account vault. */
const CACHE='protecextintores-automatic-offline-v25';
const root=new URL('./',self.location.href);
const CORE=['./','index.html','offline-services.mjs?v=automatic-offline-25','offline-vault.mjs','offline-rules.mjs','offline-services.css','service-rules.mjs','service-management.mjs?v=automatic-offline-25','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
async function prepareShell(){
 const cache=await caches.open(CACHE),response=await fetch(new URL('index.html',root),{cache:'reload'});
 if(!response.ok)throw Error('Não foi possível baixar a tela inicial.');
 const html=await response.clone().text();await cache.put(new URL('index.html',root),response);
 const manifestResponse=await fetch(new URL('offline-assets.json',root),{cache:'reload'});if(!manifestResponse.ok)throw Error('Publique o manifesto offline junto com o site.');
 const manifest=await manifestResponse.json();await cache.put(new URL('offline-assets.json',root),new Response(JSON.stringify(manifest)));
 const references=[...html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1]).filter(s=>!s.includes('${')&&/\.(?:js|mjs|css|svg|png|webmanifest)(?:\?|$)/.test(s));
 const urls=[...new Set([...CORE,...manifest.assets,...references].map(s=>new URL(s,root).href))].filter(s=>new URL(s).origin===root.origin);
 for(const url of urls){const resource=await fetch(url,{cache:'reload'});if(!resource.ok)throw Error('Não foi possível preparar '+new URL(url).pathname);await cache.put(url,resource)}
}
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('protecextintores-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type==='PREPARE_OFFLINE')event.waitUntil(prepareShell().then(()=>event.ports[0]?.postMessage({ok:true})).catch(error=>event.ports[0]?.postMessage({ok:false,error:error.message})))});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==root.origin||url.pathname.includes('/api/')||url.pathname.includes('/media/'))return;
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{const response=await fetch(request);if(response.ok){await cache.put(request,response.clone());return response}if(request.mode==='navigate'){const shell=await cache.match(new URL('index.html',root));if(shell)return shell}return response}
   catch(error){const cached=await cache.match(request,{ignoreSearch:true})||(request.mode==='navigate'?await cache.match(new URL('index.html',root)):null);if(cached)return cached;throw error}
 })());
});
