import {applyOperation,uuid,fail,adminChanges,applyAdminChanges} from '../../site/offline-rules.mjs';
import {technicalView,sellerView,teamView,teamDiscount,applyAdminOperation,finalizeAdminOrder,updateAdminOrder} from '../../site/service-rules.mjs';
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
export const serviceVersion=service=>hash(JSON.stringify({technical:technicalView(service),sellerId:service.sellerId || '',price:Number(service.price || 0),clientPhone:service.clientPhone || '',clientEmail:service.clientEmail || ''}));
const accountKey=session=>`${session.role}:${session.employee_id || session.seller_id}`;
async function ensureOffline(env){await env.DB.prepare('CREATE TABLE IF NOT EXISTS offline_receipts(account_id TEXT NOT NULL,operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(account_id,operation_id))').run()}
async function actorFor(env,state,session){
  if(!session||!['employee','seller'].includes(session.role))fail('Entre novamente para sincronizar.',401);
  const id=session.employee_id || session.seller_id,table=session.role==='employee'?'employee_auth':'seller_auth',column=session.role==='employee'?'employee_id':'seller_id';
  const exists=await env.DB.prepare(`SELECT username FROM ${table} WHERE ${column}=? AND username=?`).bind(id,session.username).first();
  const person=(state[session.role==='employee'?'employees':'sellers'] || []).find(p=>p.id===id);
  if(!exists||!person||person.active===false)fail('Conta indisponível. Procure o administrador.',403);
  return {id,role:session.role,username:session.username,name:person.name || session.username};
}
async function view(service,role,id){return {...teamView(service,role,id),syncVersion:await serviceVersion(service),clientPhone:service.clientPhone || '',clientEmail:service.clientEmail || ''}}
async function receiptResponse(receipt,state,actor,at){const recorded=JSON.parse(receipt.result),service=state.services.find(s=>s.id===recorded.service.id),owned=service&&(actor.role==='employee'?(service.employeeId===actor.id||service.billingOwner?.role==='employee'&&service.billingOwner.id===actor.id):service.sellerId===actor.id);return{ok:true,operationId:recorded.operationId,serverAt:at,duplicate:true,service:owned?await view(service,actor.role,actor.id):null}}
export async function handleOffline(request,env,context){
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/offline/'))return null;
  const {auth,readState,saveState,json,now}=context;
  try{
    await ensureOffline(env);
    const session=await auth(request,env),state=await readState(env);
    if(path.startsWith('/api/offline/admin/'))return await handleAdminOffline(request,env,context,session,state);
    if(path==='/api/offline/policy'&&request.method==='POST'){
      if(session?.role!=='admin')fail('Somente o administrador pode configurar o acesso offline.',403);
      const data=await request.json(),hours=Number(data.hours);
      if(data.mode==='until-logout'){state.settings.offlineMode='until-logout';await saveState(env,state,session.username);return json({ok:true,mode:'until-logout'});}
      if(!Number.isInteger(hours)||hours<1||hours>168)fail('Escolha entre 1 e 168 horas.');
      state.settings.offlineHours=hours;state.settings.offlineMode='limited';await saveState(env,state,session.username);return json({ok:true,hours});
    }
    const actor=await actorFor(env,state,session),key=accountKey(session);
    if(path==='/api/offline/bootstrap'&&request.method==='GET'){
      const own=state.services.filter(s=>actor.role==='employee'?(s.employeeId===actor.id||s.billingOwner?.role==='employee'&&s.billingOwner.id===actor.id):s.sellerId===actor.id),hours=Math.max(1,Math.min(168,Number(state.settings.offlineHours)||72));
      const unlimited=state.settings.offlineMode!=='limited';
      return json({accountKey:key,actor,role:actor.role,username:actor.username,preparedAt:now(),offlineMode:unlimited?'until-logout':'limited',offlineUntil:unlimited?null:new Date(Date.now()+hours*3600000).toISOString(),settings:{company:state.settings.company,stages:state.settings.stages,offlineHours:hours,teamPricing:{[actor.role]:{discountPercent:teamDiscount(state,{role:actor.role,id:actor.id})}}},types:state.types || [],available:actor.role==='employee'?await Promise.all(state.services.filter(s=>!s.employeeId&&!s.closed&&!s.cancelledAt).map(s=>view(s,actor.role,actor.id))):[],costCatalog:(state.costCatalog || []).filter(i=>i.active!==false&&i.technicalPart).map(i=>({name:i.name,technicalPart:true})),services:await Promise.all(own.map(s=>view(s,actor.role,actor.id)))});
    }
    if(!['/api/offline/sync','/api/offline/media'].includes(path)||request.method!=='POST')fail('Não encontrado.',404);
    let op,file;
    if(path.endsWith('/media')){const form=await request.formData();op=JSON.parse(String(form.get('operation') || '{}'));file=form.get('file')}
    else op=await request.json();
    if(op.accountKey!==key)fail('A conta desta operação é diferente da conta autenticada.',403);
    if(!uuid(op.id)||!uuid(op.serviceId)||!uuid(op.deviceId)||!Number.isFinite(Date.parse(op.createdAt))||!op.payload||typeof op.payload!=='object')fail('Operação inválida.');
    if(JSON.stringify(op).length>100000)fail('Operação muito grande.');
    const digest=await hash(JSON.stringify(op)),saved=await env.DB.prepare('SELECT request_hash,result FROM offline_receipts WHERE account_id=? AND operation_id=?').bind(key,op.id).first();
    if(saved){if(saved.request_hash!==digest)fail('O identificador desta operação já foi utilizado com outros dados.',409);return json(await receiptResponse(saved,await readState(env),actor,now()))}
    const existing=state.services.find(s=>s.id===op.serviceId);
    // Check ownership before returning any current service data.
    if(existing&&(actor.role==='employee'?existing.employeeId!==actor.id&&!(op.kind==='claim'&&!existing.employeeId):existing.sellerId!==actor.id))return json({error:'Esta ordem não está mais atribuída à sua conta. Seus registros locais foram preservados.',conflict:true},403);
    let expected=op.baseVersion;
    if(op.previousId){const prior=await env.DB.prepare('SELECT result FROM offline_receipts WHERE account_id=? AND operation_id=?').bind(key,op.previousId).first();if(!prior)fail('A operação anterior ainda não foi recebida.',409);const result=JSON.parse(prior.result);if(result.service.id!==op.serviceId)fail('Sequência inválida.');expected=result.service.syncVersion}
    if(existing&&await serviceVersion(existing)!==expected)return json({error:'Esta ordem mudou no sistema. Seus registros locais foram preservados para revisão.',conflict:true,current:await view(existing,actor.role,actor.id)},409);
    const original=structuredClone(op);
    if(op.kind==='media'){
      if(path!=='/api/offline/media'||!file||typeof file.arrayBuffer!=='function'||!file.size||file.size>50*1024*1024)fail('Envie um vídeo de até 50 MB.');
      const duration=Number(op.payload.durationSeconds),mime=String(op.payload.mime || file.type),allowed={'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','video/3gpp':'3gp','video/3gpp2':'3g2','video/x-m4v':'m4v'};
      if(!allowed[mime]||!Number.isFinite(duration)||duration<=0||duration>60)fail('Vídeo inválido: máximo de 60 segundos.');
      // Validate the target before writing the object. Deterministic keys make retries safe.
      const target=existing?.items?.[Number(op.payload.itemIndex)];if(!target?.replacedParts?.includes(op.payload.part))fail('A peça deste vídeo não foi registrada.');
      const bytes=await file.arrayBuffer(),contentHash=await hashBytes(bytes);
      if(contentHash!==op.payload.sha256)fail('A integridade do vídeo não foi confirmada.');
      if(!env.MEDIA)fail('Armazenamento de vídeos indisponível.',503);
      const mediaKey=`service-media/${op.serviceId}/${op.id}.${allowed[mime]}`;
      await env.MEDIA.put(mediaKey,bytes,{httpMetadata:{contentType:mime}});
      op.payload={...op.payload,media:{url:(env.PUBLIC_API_URL || url.origin)+'/media/'+mediaKey,durationSeconds:duration,bytes:file.size,mime,sha256:contentHash,uploadedAt:now()}};
    }else if(path!=='/api/offline/sync')fail('Operação inválida.');
    const service=applyOperation(state,actor,op,now());
    // The receipt and app state commit in the same D1 transaction. A lost HTTP response
    // can therefore be retried without creating a second order or stock movement.
    const response={ok:true,operationId:op.id,serverAt:now(),service:await view(service,actor.role,actor.id)};
    const compactReceipt={ok:true,operationId:op.id,serverAt:response.serverAt,service:{id:service.id,syncVersion:response.service.syncVersion}};
    try{await saveState(env,state,(await env.DB.prepare('SELECT username FROM admin_auth WHERE id=1').first()).username,{offlineReceipt:{account:key,id:original.id,hash:digest,result:JSON.stringify(compactReceipt)}})}catch(error){const committed=await env.DB.prepare('SELECT request_hash,result FROM offline_receipts WHERE account_id=? AND operation_id=?').bind(key,original.id).first();if(committed?.request_hash===digest)return json(await receiptResponse(committed,await readState(env),actor,now()));throw error}
    return json(response);
  }catch(error){return json({error:error.message || 'Não foi possível sincronizar.'},error.status || (/atualiz|Outra pessoa/.test(error.message)?409:400))}
}
async function hashBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('')}

async function handleAdminOffline(request,env,context,session,state){
 const {json,now,saveState}=context,path=new URL(request.url).pathname;
 if(session?.role!=='admin')return json({error:'Entre como administrador para sincronizar.'},401);
 if(path.endsWith('/bootstrap')&&request.method==='GET')return json({state,username:session.username,preparedAt:now()});
 if(!path.endsWith('/sync')||request.method!=='POST')return json({error:'Não encontrado.'},404);
 const op=await request.json(),key='admin:1';
 if(op.accountKey!==key||!uuid(op.id)||!uuid(op.deviceId)||op.serviceId!=='admin-state'||!Number.isFinite(Date.parse(op.createdAt)))fail('Operação administrativa inválida.');
 if(JSON.stringify(op).length>16*1024*1024)fail('Registro muito grande. Divida a alteração em etapas.');
 const digest=await hash(JSON.stringify(op)),saved=await env.DB.prepare('SELECT request_hash,result FROM offline_receipts WHERE account_id=? AND operation_id=?').bind(key,op.id).first();
 if(saved){if(saved.request_hash!==digest)fail('Identificador já utilizado com outros dados.',409);return json({...JSON.parse(saved.result),duplicate:true});}
 const previous=structuredClone(state);let options={};
 try{
   // Commands guard their business inputs as well as the edited service. Pricing
   // changes cannot silently alter a fee the administrator reviewed offline.
   for(const guard of op.guards||[]){const value=guard.keys?Object.fromEntries(guard.keys.map(k=>[k,state[guard.group]?.[k]??null])):guard.id?(state[guard.group]||[]).find(x=>x.id===guard.id):state[guard.group];if(JSON.stringify(value??null)!==JSON.stringify(guard.value))throw Object.assign(Error('Os dados usados nesta operação mudaram. Revise os valores e a ordem.'),{status:409,conflict:true});}
   if(op.kind==='admin-state'){
     applyAdminChanges(state,op.changes);
     if(state.services.some(s=>s.closed&&!previous.services.some(o=>o.id===s.id&&o.closed)))fail('Use a opção Finalizar serviço para fechar uma ordem.');
     if(state.services.some(s=>{const old=previous.services.find(o=>o.id===s.id);return s.status==='Recebido'&&old?.status!=='Recebido'||s.items?.some((i,n)=>i.status==='Recebido'&&old?.items?.[n]?.status!=='Recebido')}))fail('Somente o funcionário pode registrar o recebimento.');
   }else if(op.kind==='admin-operation'){
     if(op.payload?.action==='mark-paid')fail('Confirme recebimentos com internet para conferir o acerto completo.');
     options=applyAdminOperation(state,op.payload,session.username,op.createdAt);
   }else if(op.kind==='admin-finalize')finalizeAdminOrder(state,op.payload.serviceId,session.username,op.createdAt);
   else if(op.kind==='admin-update')updateAdminOrder(state,op.payload,session.username,op.createdAt);
   else fail('Ação administrativa desconhecida.');
 }catch(error){return json({error:error.message,conflict:true,field:error.field||''},error.status||409);}
 const result=clean=>JSON.stringify({ok:true,operationId:op.id,serverAt:now(),revision:clean.__rev,delta:adminChanges(previous,clean,true)});
 try{
   await saveState(env,state,session.username,{...options,offlineReceipt:{account:key,id:op.id,hash:digest,result}});
 }catch(error){
   const receipt=await env.DB.prepare('SELECT request_hash,result FROM offline_receipts WHERE account_id=? AND operation_id=?').bind(key,op.id).first();
   if(receipt?.request_hash===digest)return json({...JSON.parse(receipt.result),duplicate:true});
   if(/atualiz|Outra pessoa/.test(error.message))return json({error:error.message,retry:true},409);
   throw error;
 }
 const receipt=await env.DB.prepare('SELECT result FROM offline_receipts WHERE account_id=? AND operation_id=?').bind(key,op.id).first();
 return json(JSON.parse(receipt.result));
}
