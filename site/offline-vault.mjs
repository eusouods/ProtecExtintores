const native=()=>Boolean(window.ProtecNative?.postMessage);
const waiting=new Map();
export function nativeCall(action,data={}){
  if(!native())return Promise.reject(Error('Atualize o APK para usar os recursos nativos.'));
  const id=crypto.randomUUID();
  window.ProtecNative.onmessage=event=>{let message;try{message=JSON.parse(event.data)}catch{return}const task=waiting.get(message.id);if(!task)return;clearTimeout(task.timer);waiting.delete(message.id);message.error?task.reject(Error(message.error)):task.resolve(message.value)};
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error('O armazenamento do aparelho não respondeu.'))},60000);waiting.set(id,{resolve,reject,timer});window.ProtecNative.postMessage(JSON.stringify({id,action,...data}))});
}
let databasePromise,keyPromise;
function database(){return databasePromise ||= new Promise((resolve,reject)=>{const r=indexedDB.open('protecextintores-offline-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function transaction(mode,fn){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('vault',mode),request=fn(tx.objectStore('vault'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(tx.error || request.error || Error('Falha ao salvar no aparelho.'))})}
async function key(){return keyPromise ||= (async()=>{let k=await transaction('readonly',s=>s.get('__key'));if(k)return k;const generated=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite'),store=tx.objectStore('vault'),r=store.get('__key');let selected;r.onsuccess=()=>{selected=r.result || generated;if(!r.result)store.put(generated,'__key')};tx.oncomplete=()=>resolve(selected);tx.onerror=()=>reject(tx.error)})})()}
async function encrypt(bytes,kind){const iv=crypto.getRandomValues(new Uint8Array(12));return{kind,iv,data:await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),bytes)}}
async function decrypt(row){return crypto.subtle.decrypt({name:'AES-GCM',iv:row.iv},await key(),row.data)}
const b64=bytes=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const vault={
 native,
 async get(k){if(native())return nativeCall('get',{key:k});const row=await transaction('readonly',s=>s.get(k));return row?JSON.parse(new TextDecoder().decode(await decrypt(row))):null},
 async put(k,v){if(native())return nativeCall('put',{key:k,value:v});const row=await encrypt(new TextEncoder().encode(JSON.stringify(v)),'json');await transaction('readwrite',s=>s.put(row,k))},
 async remove(k){if(native())return nativeCall('remove',{key:k});await transaction('readwrite',s=>s.delete(k))},
 async batch(entries){
   if(native())return nativeCall('batch',{entries});
   const rows=await Promise.all(entries.map(async entry=>({...entry,row:await encrypt(new TextEncoder().encode(JSON.stringify(entry.value)),'json')})));
   const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite');for(const entry of rows)tx.objectStore('vault').put(entry.row,entry.key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
 },
 async keys(prefix){if(native())return nativeCall('keys',{prefix});return(await transaction('readonly',s=>s.getAllKeys())).filter(k=>typeof k==='string'&&k.startsWith(prefix))},
 async blobPut(k,file){
   const usage=!native()?await navigator.storage?.estimate?.():null;if(usage?.quota&&usage.quota-usage.usage<file.size*1.4+2e6)throw Error('Espaço insuficiente para guardar o vídeo. Libere espaço e tente novamente.');
   if(native()){
     const handle=await nativeCall('blobBegin',{key:k,size:file.size});
     try{for(let offset=0;offset<file.size;offset+=131072)await nativeCall('blobChunk',{handle,data:b64(new Uint8Array(await file.slice(offset,offset+131072).arrayBuffer()))});await nativeCall('blobEnd',{handle});}
     catch(error){await nativeCall('blobAbort',{handle}).catch(()=>{});throw error}
   }else{const row=await encrypt(await file.arrayBuffer(),'blob');row.mime=file.type;await transaction('readwrite',s=>s.put(row,k))}
 },
 async blobGet(k,mime='video/mp4'){
   if(!native()){const row=await transaction('readonly',s=>s.get(k));if(!row)throw Error('Vídeo não encontrado neste aparelho.');return new Blob([await decrypt(row)],{type:row.mime || mime})}
   const handle=await nativeCall('blobOpen',{key:k}),chunks=[];
   try{while(true){const chunk=await nativeCall('blobRead',{handle});if(!chunk)break;chunks.push(unb64(chunk))}}finally{await nativeCall('blobClose',{handle})}
   return new Blob(chunks,{type:mime});
 }
};
