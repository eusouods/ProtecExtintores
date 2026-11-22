import {paintingField,powderFields,powderPayload} from './workshop-ui.mjs?v=protec-navy-61';
import {equipmentGroups,powderCapacity} from './workshop-rules.mjs?v=protec-navy-61';
import './service-management.mjs?v=protec-navy-61';
import {openOrderDetail,enhanceRegistrationSteps} from './operations-ui.mjs?v=protec-navy-61';
import {vault,nativeCall} from './offline-vault.mjs?v=protec-navy-61';
import {applyOperation,replayLocal,isPaused,adminChanges,applyAdminChanges,stageFlow} from './offline-rules.mjs?v=protec-navy-61';
import {PART_NAMES,completed,cancelled,applyAdminOperation,finalizeAdminOrder,updateAdminOrder,preserveAndCapture,registrationCatalog,registrationQuote,normalizeRegistration,SALE_CONDITIONS,complementDefinitions,validateComplementSettings,registrationContacts,registrationCapacityAllowed,localDay,employeeCreatedService,employeeServiceView} from './service-rules.mjs?v=protec-navy-61';

const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./offline-services.css?v=protec-navy-61',import.meta.url);document.head.append(css);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokenKey='protecextintores_session',roleKey='protecextintores_role';
const base=String(window.API_BASE_URL || (typeof API_BASE_URL!=='undefined'?API_BASE_URL:''));
const rawApi=window.apiCall;
const registrationDraftWrites=new Map();
let preparationIssue=null,registrationOpening=null,adminApiUnavailable=false,adminCapabilityCheck=null,adminCapabilityToken='',adminCapabilityAt=0,adminCapabilityState=null;
let profile=null,ops=[],results={},services=[],active='',preparing=null,syncing=false,renderTimer,tab='active',employeeScope='own',query='',historyMonth='',locked=false,offline=false,needsLogin=false,serial=Promise.resolve(),lastStamp=0,submissionBasis=null,accountToken='',nativeSyncing=false,nativeKind='',upload=null,nativeTransfer=null,lastSyncAt='';
const names={powder:'Consumo de pó', 'ownership-request':'Envio à administração',claim:'Aceite de serviço',create:'Nova ordem',technical:'Peças e observações',painting:'Pintura',stage:'Etapa',pause:'Pausa',resume:'Retomada',media:'Vídeo de peça',complete:'Conclusão da execução'};
function summary(op){const p=op.payload || {};return `<dl>${[['Cliente',p.clientName],['Serviço',p.serviceType],['Data',p.date],['Motivo',p.reason],['Etapa',p.status],['Observações',p.notes],['Pinturas',p.quantity],['Equipamento',Number.isInteger(p.itemIndex)?p.itemIndex+1:null],['Peças',p.parts?.join?.(', ') || (typeof p.parts==='string'?p.parts:'')],['Peça do vídeo',p.part],['Arquivo',p.name]].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}${Array.isArray(p.items)?`<dt>Equipamentos</dt><dd>${p.items.map(i=>`${esc(i.type)} ${esc(i.kg)} × ${i.qty}`).join('<br>')}</dd>`:''}</dl>`}
function basisFor(id){return{serviceId:id,accountKey:active,baseVersion:services.find(s=>s.id===id)?.syncVersion || '',previousId:ops.filter(o=>o.serviceId===id&&!results[o.id]?.ok&&!results[o.id]?.discarded).at(-1)?.id || ''}}
const statusOf=s=>cancelled(s)?'Cancelado':s.closed?'Revisado pelo administrador':s.localCompleted?'Concluído no aparelho':s.employeeCompletedAt?'Recebido · aguardando revisão':isPaused(s)?'Pausado':s.status || 'Solicitado';
const opPrefix=()=>`op:${active}:`,resultKey=id=>`result:${active}:${id}`;
const notify=message=>window.toast?.(message);
const friendly=error=>/quota|space|disk/i.test(error?.message || '')?'Não há espaço suficiente no aparelho. O registro não foi confirmado.':error?.message || 'Não foi possível salvar no aparelho.';
const reply=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
async function network(path,options={}){
 const headers={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+(localStorage.getItem(tokenKey)||''),...options.headers};
 if(options.body instanceof FormData)return new Promise((resolve,reject)=>{
  const transfer=upload,xhr=new XMLHttpRequest();xhr.open(options.method||'POST',base+path);xhr.timeout=180000;
  Object.entries(headers).forEach(([key,value])=>xhr.setRequestHeader(key,value));
  xhr.upload.onprogress=event=>{if(upload&&upload===transfer){upload.loaded=event.loaded;upload.total=event.lengthComputable?event.total:0;scheduleRender()}};
  xhr.onload=()=>resolve(new Response(xhr.responseText,{status:xhr.status||502,headers:{'Content-Type':xhr.getResponseHeader('Content-Type')||'application/json'}}));
  xhr.onerror=()=>reject(Error('Envio interrompido. O vídeo continua salvo no aparelho.'));
  xhr.ontimeout=()=>reject(Error('O envio demorou além do esperado. O vídeo continua no aparelho para uma nova tentativa.'));
  xhr.send(options.body);
 });
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{return await fetch(base+path,{...options,signal:controller.signal,headers})}finally{clearTimeout(timer)}
}
const withSerial=fn=>{const task=serial.then(fn);serial=task.catch(()=>{});return task};
async function hydrate(){
  if(!active)return;
  profile=await vault.get('profile:'+active);if(!profile)return;
  if(profile.role==='employee'){const before=JSON.stringify([profile.services,profile.available]);profile.services=(profile.services||[]).map(s=>employeeServiceView(s,profile.actor.id));profile.available=(profile.available||[]).map(s=>employeeServiceView(s,profile.actor.id));if(before!==JSON.stringify([profile.services,profile.available]))await vault.put('profile:'+active,profile);}
  accountToken=(await vault.get('auth:'+active))?.token || '';
  const preparedShell=await vault.get('shell:'+active);shellReady=vault.native()||preparedShell?.version===shellVersion;
  if(vault.native()){const nativeState=await vault.get('sync-state:'+active);if(nativeState?.needsLogin)needsLogin=true;if(nativeState?.apiUpdateRequired)preparationIssue={token:accountToken,status:404,message:'A API precisa ser atualizada.'};nativeSyncing=Boolean(nativeState?.syncing&&Date.now()-nativeState.at<300000);nativeKind=nativeState?.kind || '';nativeTransfer=nativeSyncing?{serviceId:nativeState.serviceId,kind:nativeKind,loaded:Number(nativeState.loaded)||0,total:Number(nativeState.total)||0}:null;}
  ops=await Promise.all((await vault.keys(opPrefix())).map(k=>vault.get(k)));ops=ops.filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  results={};for(const op of ops){const r=await vault.get(resultKey(op.id));if(r)results[op.id]=r}
  const savedSync=await vault.get('last-sync:'+active);lastSyncAt=savedSync?.at||'';
  const confirmed=Object.values(results).filter(r=>r.ok&&r.serverAt).map(r=>r.serverAt).sort().at(-1);
  if(confirmed&&confirmed>lastSyncAt){lastSyncAt=confirmed;await vault.put('last-sync:'+active,{at:confirmed})}
  const current=structuredClone(profile);
  for(const op of ops){const r=results[op.id];if((op.dataEpoch||'initial')!==(profile.dataEpoch||'initial'))continue;if(r?.ok&&r.powderStock&&(!profile.powderStock?.checkedAt||r.powderStock.checkedAt>profile.powderStock.checkedAt)){profile.powderStock=r.powderStock;await vault.put('profile:'+active,profile);}if(r?.ok&&r.service&&r.serverAt>profile.preparedAt){const i=current.services.findIndex(s=>s.id===r.service.id);if(i<0)current.services.push(r.service);else current.services[i]=r.service}}
  services=replayLocal(current,ops,results);if(profile.role==='employee'){services=services.map(s=>employeeServiceView(s,profile.actor.id));profile.available=(profile.available||[]).map(s=>employeeServiceView(s,profile.actor.id));}
  if(window.employeePortalState&&profile.role==='employee')window.employeePortalState.services=services;
  if(window.sellerPortalState&&profile.role==='seller')window.sellerPortalState.services=services;
  scheduleRender();
}
function allowed(){return profile&&!locked&&accountToken===localStorage.getItem(tokenKey)&&(profile.offlineMode==='until-logout'||Date.now()<Date.parse(profile.offlineUntil))}
function assertAllowed(){if(!allowed())throw Error(locked?'Desbloqueie o aparelho para continuar.':'O acesso offline venceu. Conecte-se e entre novamente; seus rascunhos estão preservados.')}
async function prepare(quiet=false){
  if(preparing){const data=await preparing;if(quiet)return data;return prepare(false)}
  preparing=(async()=>{
    const preparingToken=localStorage.getItem(tokenKey),r=await network('/api/offline/bootstrap');const data=await r.json();
    if(localStorage.getItem(tokenKey)!==preparingToken)throw Error('A conta mudou durante a atualização. Tente novamente.');
    if(!r.ok){if([401,403].includes(r.status))needsLogin=true;if(r.status===403){locked=true;scheduleRender()}throw Object.assign(Error(data.error || 'Não foi possível carregar os dados offline.'),{status:r.status})}
    if(!['employee','seller'].includes(data.role)||data.role!==localStorage.getItem(roleKey)||data.accountKey!==data.role+':'+data.actor?.id||!Array.isArray(data.types)||!Array.isArray(data.services))throw Error('A resposta do preparo offline está incompleta.');
    data.costCatalog ||= [];data.available ||= [];
    await vault.batch([{key:'profile:'+data.accountKey,value:data},{key:'active',value:{accountKey:data.accountKey}},{key:'auth:'+data.accountKey,value:{token:preparingToken,accountKey:data.accountKey}},{key:'sync-state:'+data.accountKey,value:{needsLogin:false}}]);
    if(localStorage.getItem(tokenKey)!==preparingToken)throw Error('A conta mudou durante a preparação.');
    active=data.accountKey;profile=data;offline=false;needsLogin=false;preparationIssue=null;renderAvailability();
    await hydrate();
    // Once a fresh server snapshot contains a confirmed action, its local receipt
    // no longer needs to carry a full service copy. Draft dependencies are preserved.
    const draftText=(await Promise.all((await vault.keys('draft:'+active+':')).map(k=>vault.get(k)))).map(d=>JSON.stringify(d)).join('\n');
    for(const op of ops){const result=results[op.id],included=data.services.some(s=>s.id===op.serviceId&&s.history?.some(event=>event.operationId===op.id));if(result?.ok&&included&&result.serverAt<=data.preparedAt&&!draftText.includes(op.serviceId)&&!draftText.includes(op.payload.blobKey || '\u0000')){await vault.remove(opPrefix()+op.id);await vault.remove(resultKey(op.id));}}
    await hydrate();
    prepareShell(active).then(()=>scheduleRender()).catch(()=>scheduleRender());
    scheduleRender();return data;
  })().catch(error=>{preparationIssue={token:localStorage.getItem(tokenKey),status:error.status||0,message:friendly(error)};renderAvailability();throw error;}).finally(()=>preparing=null);return preparing;
}
function renderAvailability(){
 const team=['employee','seller'].includes(localStorage.getItem(roleKey)),root=team?document.querySelector('#employeePortal:not(.hidden) .employee-top'):document.querySelector('#dashboard:not(.hidden) .admin-top-right');
 const issue=team?preparationIssue?.token===localStorage.getItem(tokenKey)&&(!allowed()||preparationIssue.status===404):adminApiUnavailable;
 let control=document.getElementById('offlineAvailability');if(!root||!issue){control?.remove();return;}
 if(!control){control=document.createElement('div');control.id='offlineAvailability';control.className='sync-control';control.dataset.syncState='attention';control.innerHTML='<button class="sync-indicator" type="button"><span class="sync-dot" aria-hidden="true"></span><span>Preparação pendente</span></button>';root.append(control);control.querySelector('button').onclick=()=>window.openModal('Acesso offline','<p>O aparelho continuará tentando preparar os dados automaticamente. Entre com internet pelo menos uma vez para disponibilizar esta conta offline.</p><p>'+esc(preparationIssue?.message||'Atualize a API para receber os envios deste aparelho.')+'</p>',()=>{},'Fechar');}
}

function teamValidationState(list){return {services:structuredClone(list),types:profile.types,settings:profile.settings,costCatalog:profile.costCatalog,registrationCatalog:profile.registrationCatalog,registrationContacts:profile.registrationContacts};}
async function enqueue(kind,serviceId,payload,basis=null){basis ||= submissionBasis?.serviceId===serviceId?submissionBasis:null;const account=active;return withSerial(async()=>{
  assertAllowed();await hydrate();
  if(active!==account || basis?.accountKey&&basis.accountKey!==active)throw Error('A conta mudou. Reabra o registro na conta de origem.');
  if(kind==='media'){const already=ops.find(o=>o.kind==='media'&&o.serviceId===serviceId&&o.payload.itemIndex===payload.itemIndex&&o.payload.part===payload.part&&o.payload.blobKey===payload.blobKey&&!results[o.id]?.discarded);if(already)return already;}
  const prior=ops.filter(o=>o.serviceId===serviceId&&!results[o.id]?.ok&&!results[o.id]?.discarded).at(-1);
  const current=services.find(s=>s.id===serviceId)||(profile.available||[]).find(s=>s.id===serviceId);
  const op={dataEpoch:profile.dataEpoch||'initial',id:crypto.randomUUID(),accountKey:active,deviceId:await deviceId(),serviceId,kind,payload,createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString(),baseVersion:basis?.baseVersion ?? current?.syncVersion ?? '',...((prior?.id || basis?.previousId)?{previousId:prior?.id || basis.previousId}:{})};
  const validation=teamValidationState(services);
  applyOperation(validation,profile.actor,kind==='media'?{...op,payload:{...payload,media:{url:'local:'+op.id,durationSeconds:payload.durationSeconds}}}:op,op.createdAt);
  if(active!==account)throw Error('A conta mudou antes de salvar.');
  await vault.put(opPrefix()+op.id,op);if(basis)basis.previousId=op.id;await hydrate();scheduleSync();return op;
})}
async function deviceId(){let d=await vault.get('device');if(!d){d=crypto.randomUUID();await vault.put('device',d)}return d}
let teamRetryTimer,teamRetry=0;
function scheduleSync(retry=false){
 clearTimeout(teamRetryTimer);
 if(!active||locked||needsLogin)return;
 if(vault.native()){nativeCall('sync',{accountKey:active}).catch(()=>{});return;}
 if(!navigator.onLine)return;
 const delay=retry?Math.min(60000,3000*2**Math.min(teamRetry++,5)):150;
 teamRetryTimer=setTimeout(()=>sync().catch(()=>{}),delay);
}
async function sync(){
  if(!active||syncing||locked||needsLogin)return;if(vault.native()){await nativeCall('sync',{accountKey:active});return}
  const work=async()=>{
    syncing=true;scheduleRender();const blocked=new Set(),syncAccount=active,syncToken=localStorage.getItem(tokenKey);let interrupted=false;
    try{await hydrate();for(const op of ops){
      if(active!==syncAccount)break;
      if(results[op.id]?.ok||results[op.id]?.discarded)continue;
      if((op.dataEpoch||'initial')!==(profile.dataEpoch||'initial')){await vault.put(resultKey(op.id),{conflict:true,dataReset:true,error:'Registro de uma base anterior ao reset ou à restauração. O conteúdo foi preservado para consulta.'});blocked.add(op.serviceId);continue;}
      if(results[op.id]?.conflict||blocked.has(op.serviceId)){blocked.add(op.serviceId);continue}
      let body,path='/api/offline/sync';
      if(op.kind==='media'){path='/api/offline/media';body=new FormData();body.append('operation',JSON.stringify(op));body.append('file',await vault.blobGet(op.payload.blobKey,op.payload.mime),op.payload.name || 'video.mp4')}
      else body=JSON.stringify(op);
      upload={serviceId:op.serviceId,kind:op.kind,loaded:0,total:0};scheduleRender();
      const r=await network(path,{method:'POST',body,headers:{Authorization:'Bearer '+syncToken}}),data=await r.json();upload=null;
      if(active!==syncAccount)break;
      if(r.status===401||r.status===403&&!data.conflict){needsLogin=true;break}
      if(r.status===404&&!data.conflict){preparationIssue={token:syncToken,status:404,message:'A API precisa ser atualizada para receber os envios.'};renderAvailability();break;}
      if(!r.ok){if(data.conflict||r.status===400||r.status===404){await vault.put(resultKey(op.id),{error:data.error,conflict:true,current:data.current || null});blocked.add(op.serviceId)}else{interrupted=true;break}}
      else{await vault.put(resultKey(op.id),data);if(op.kind==='media')await vault.remove(op.payload.blobKey)}
      await hydrate();
    }offline=interrupted;if(!interrupted)teamRetry=0}catch(error){offline=true;}finally{syncing=false;upload=null;scheduleRender();if(ops.some(o=>!results[o.id]?.ok&&!results[o.id]?.discarded&&!results[o.id]?.conflict))scheduleSync(true)}
  };
  if(navigator.locks)await navigator.locks.request('protec-sync:'+active,{ifAvailable:true},lock=>lock?work():undefined);else await work();
}
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,40)}
function syncStatus(id){
 const pending=ops.filter(op=>op.serviceId===id&&!results[op.id]?.ok&&!results[op.id]?.discarded);
 if(pending.some(op=>results[op.id]?.conflict))return {state:'attention',label:'Precisa de atenção'};
 if(pending.length&&needsLogin)return {state:'attention',label:'Entre novamente para enviar'};
 if(pending.length&&(upload||nativeTransfer)?.serviceId===id)return {state:'sending',label:(upload||nativeTransfer).kind==='media'?'Enviando vídeo':'Enviando registros'};
 return pending.length?{state:'local',label:'Salvo no aparelho · aguardando envio'}:{state:'synced',label:'Confirmado no sistema'};
}
function render(){
  if(!profile||!active||localStorage.getItem(roleKey)!==profile.role||accountToken!==localStorage.getItem(tokenKey))return;
  const root=document.getElementById('employeePortal');if(!root||root.classList.contains('hidden'))return;
  document.getElementById('sessionRestoreNotice')?.remove();
  root.classList.add('offline-enabled');
  if(locked){if(!root.querySelector('[data-offline-locked]')){root.innerHTML='<section class="offline-locked" data-offline-locked><h1>Acesso bloqueado</h1><p>Desbloqueie o aparelho para consultar os serviços.</p><button class="btn" id="offlineUnlock">Desbloquear</button><button class="btn btn-soft" onclick="logout()">Sair da conta</button></section>';root.querySelector('#offlineUnlock').onclick=async()=>{try{await nativeCall('unlock');locked=false;showPortal()}catch(e){notify(e.message)}}}return}
  let bar=root.querySelector('#offlineToolbar');if(!bar){bar=document.createElement('div');bar.id='offlineToolbar';bar.className='sync-control';root.querySelector('.employee-top')?.append(bar)}
  const pending=ops.filter(o=>!results[o.id]?.ok&&!results[o.id]?.discarded),videos=pending.filter(o=>o.kind==='media'),errors=pending.filter(o=>results[o.id]?.conflict);
  const label=needsLogin?'Entre novamente para enviar':!allowed()?'Acesso offline vencido':offline||!navigator.onLine?'Sem conexão · salvando no aparelho':syncing||nativeSyncing?nativeKind==='media'?'Enviando vídeos…':'Enviando registros…':pending.length?'Envios pendentes':shellReady?'Tudo atualizado':'Preparando uso offline';
  const transfer=upload||(nativeSyncing?nativeTransfer:null);
  const signature=JSON.stringify([label,pending.length,videos.length,errors.length,profile.preparedAt,lastSyncAt,transfer?.kind,transfer?.total?Math.floor(transfer.loaded/transfer.total*100):null]);
  if(bar.dataset.state!==signature){
    bar.dataset.state=signature;
    const percent=transfer?.total?Math.min(99,Math.floor(transfer.loaded/transfer.total*100)):null;
        const expanded=Boolean(bar.querySelector('details')?.open);
    const state=errors.length||needsLogin?'attention':syncing||nativeSyncing?'sending':pending.length?'pending':offline||!navigator.onLine?'offline':'synced';
    const caption=errors.length?pending.length+' pendentes · '+errors.length+' para revisar':needsLogin?'Entrar para sincronizar':syncing||nativeSyncing?'Sincronizando':pending.length?pending.length+' pendente(s)':offline||!navigator.onLine?'Offline · salvo no aparelho':'Tudo sincronizado';
    bar.dataset.syncState=state;bar.innerHTML=`<button type="button" class="sync-indicator" data-pending="${pending.length||''}${errors.length?' · '+errors.length+'!':needsLogin?'!':''}" data-offline-action="status" aria-label="Sincronização: ${esc(caption)}. Abrir detalhes"><span class="sync-dot" aria-hidden="true"></span><span>${esc(caption)}</span></button>`;
    bar.querySelectorAll('[data-offline-action]').forEach(b=>b.onclick=()=>action(b.dataset.offlineAction));
  }
  if(profile.role==='employee'){
   let stock=root.querySelector('#employeePowderStock');if(!stock){stock=document.createElement('section');stock.id='employeePowderStock';stock.className='ops-panel workspace-powder-stock';root.querySelector('main')?.append(stock);}
   const data=profile.powderStock||{},key=JSON.stringify(data);if(stock.dataset.stock!==key){stock.dataset.stock=key;stock.innerHTML=!data.checkedAt?'<div><h2>Estoque de pó químico</h2><p>Conecte-se para confirmar o saldo de ABC e BC.</p></div>':'<div><h2>Estoque de pó químico</h2><p>ABC: <b>'+Number(data.ABC||0).toLocaleString('pt-BR')+' kg</b> · BC: <b>'+Number(data.BC||0).toLocaleString('pt-BR')+' kg</b></p><small>'+(data.checkedAt?'Última confirmação: '+esc(new Date(data.checkedAt).toLocaleString('pt-BR')):'Conecte-se para confirmar o saldo.')+'</small></div>';}
  }
  if(profile.role==='employee')renderWorkbench();else if(window.sellerPortalState){window.sellerPortalState.services=services;window.renderSellerServicesList?.();root.querySelectorAll('.seller-service-status').forEach(card=>{const s=services.find(s=>card.textContent.includes(s.code));if(s?.localPending&&!card.querySelector('.offline-badge')){const b=document.createElement('p');b.className='offline-badge is-pending';b.textContent='Salvo neste aparelho · aguardando envio';card.append(b)}})}
}
async function action(name){try{
  if(name==='status')openSyncDetails(false);
  if(name==='prepare')await prepare();
  if(name==='sync')await sync();
  if(name==='queue')await openQueue();
  if(name==='login'){window.logout();window.showLogin()}
  if(name==='lock'){const state=await nativeCall('lockState');await nativeCall(state.enabled?'disableLock':'enableLock');notify(state.enabled?'Bloqueio adicional desativado.':'Bloqueio ativado. O Android pedirá o desbloqueio do aparelho ao retornar ao app.')}
}catch(error){notify(friendly(error))}}
function renderWorkbench(){
  if(!profile||accountToken!==localStorage.getItem(tokenKey))return;
  const host=document.getElementById('employeeCards');if(!host)return;
  const own=s=>employeeCreatedService(s,profile.actor.id),sent=s=>s.adminOwned&&s.originalCreator?.role==='employee'&&s.originalCreator.id===profile.actor.id,matches=(s,scope)=>scope==='own'?own(s):scope==='sent'?sent(s):!own(s)&&(!sent(s)||s.employeeId===profile.actor.id),all=services.filter(s=>matches(s,employeeScope)),list=all.filter(s=>tab==='history'?completed(s)||cancelled(s):tab==='paused'?isPaused(s):!completed(s)&&!cancelled(s)&&!isPaused(s)).filter(s=>tab!=='history'||!historyMonth||String(s.closedAt||s.employeeCompletedAt||s.date||'').slice(0,7)===historyMonth).sort((a,b)=>String(b.closedAt||b.employeeCompletedAt||b.date||'').localeCompare(String(a.closedAt||a.employeeCompletedAt||a.date||'')));
  const signature=JSON.stringify([all,employeeScope,tab,query,historyMonth,results]);if(host.dataset.offlineState===signature&&host.querySelector('[data-offline-workbench]'))return;host.dataset.offlineState=signature;
  host.innerHTML=`<div data-service-workbench data-offline-workbench><nav class="offline-tabs" aria-label="Origem dos serviços">${[['own','Meus serviços'],['assigned','Serviços para executar'],['sent','Enviados à empresa']].map(([key,label])=>`<button type="button" class="btn btn-soft btn-small" data-employee-scope="${key}" aria-pressed="${employeeScope===key}">${label} (${services.filter(s=>matches(s,key)).length})</button>`).join('')}</nav><p class="helper">${employeeScope==='sent'?'Ordens assumidas pela empresa, com autoria original preservada e sem cobrança interna para você.':employeeScope==='own'?'Ordens criadas por você, vinculadas ao seu nome.':'Ordens recebidas para execução. As validades ficam com quem registrou a ordem.'}</p><div class="offline-tabs">${[['active','Em execução / disponíveis'],['paused','Pausados'],['history','Meu histórico']].map(([key,label])=>`<button type="button" class="btn btn-soft btn-small" data-tab="${key}" aria-pressed="${tab===key}">${label}</button>`).join('')}</div><div class="workshop-history-filters">${tab==='history'?`<label class="form-field">Mês do histórico<select data-history-month><option value="">Todos os meses</option>${[...new Set(all.map(s=>String(s.closedAt||s.employeeCompletedAt||s.date||'').slice(0,7)).filter(Boolean))].sort().reverse().map(month=>`<option value="${month}" ${month===historyMonth?'selected':''}>${month.slice(5,7)}/${month.slice(0,4)}</option>`).join('')}</select></label>`:''}<label>Buscar serviço<input class="offline-search" type="search" value="${esc(query)}" data-offline-search></label></div>${list.map(s=>`<article class="employee-service" data-offline-service="${esc(s.id)}"><header class="employee-service-head"><div><b>${esc(s.code)}</b><p>${esc(s.clientName || 'Cliente não informado')} · ${esc(s.serviceType)}</p></div><span class="offline-badge ${s.localPending?'is-pending':''}">${esc(statusOf(s))}</span></header><div class="employee-service-body service-detail-item"><p>${s.items.length} em manutenção · ${(s.hydrantHoses||[]).reduce((n,i)=>n+i.quantity,0)} mangueira(s) · ${(s.soldExtinguishers||[]).reduce((n,i)=>n+i.quantity,0)} para fornecimento</p><p><span data-sync-state="${syncStatus(s.id).state}">${esc(syncStatus(s.id).label)}</span></p>${isPaused(s)?`<p>Pausa: ${esc(s.pauseReason)} · ${esc(new Date(s.pausedAt).toLocaleString('pt-BR'))}</p>`:''}<div class="offline-actions offline-service-actions"><button type="button" class="btn btn-soft btn-small" data-action="details">Detalhes e histórico</button>${!s.employeeId&&!completed(s)&&!cancelled(s)?'<button type="button" class="btn btn-small" data-action="claim">Aceitar serviço</button>':!completed(s)&&!cancelled(s)&&s.employeeId===profile.actor.id?isPaused(s)?'<button type="button" class="btn btn-small" data-action="resume">Retomar serviço</button>':'<button type="button" class="btn btn-soft btn-small" data-action="pause">Pausar serviço</button><button type="button" class="btn btn-soft btn-small" data-action="technical">Peças, notas e vídeos</button><button type="button" class="btn btn-soft btn-small" data-action="painting">Pinturas da ordem</button><button type="button" class="btn btn-soft btn-small" data-action="powder">Consumo de pó</button><button type="button" class="btn btn-soft btn-small" data-action="stage">Atualizar etapa</button><button type="button" class="btn btn-small" data-action="complete">Concluir execução</button>':''}</div></div></article>`).join('') || '<p class="empty">Nenhum serviço neste filtro.</p>'}</div>`;
  host.querySelectorAll('[data-employee-scope]').forEach(b=>b.onclick=()=>{employeeScope=b.dataset.employeeScope;tab='active';renderWorkbench();});
  host.querySelector('[data-history-month]')?.addEventListener('change',e=>{historyMonth=e.target.value;renderWorkbench();});
  host.querySelectorAll('[data-tab]').forEach(b=>{const key=b.dataset.tab,count=all.filter(s=>key==='history'?completed(s)||cancelled(s):key==='paused'?isPaused(s):!completed(s)&&!cancelled(s)&&!isPaused(s)).length;b.setAttribute('aria-label',b.textContent);b.insertAdjacentHTML('beforeend',` <span aria-hidden="true">(${count})</span>`);b.onclick=()=>{tab=key;renderWorkbench()}});
  const search=host.querySelector('[data-offline-search]');const filter=()=>host.querySelectorAll('[data-offline-service]').forEach(card=>card.hidden=!card.textContent.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));search.oninput=()=>{query=search.value;filter()};filter();
  host.querySelectorAll('[data-offline-service]').forEach(card=>{const service=services.find(s=>s.id===card.dataset.offlineService);if(!service?.items?.length)card.querySelectorAll('[data-action=technical],[data-action=painting],[data-action=powder],[data-action=stage]').forEach(b=>b.remove());});
  host.querySelectorAll('[data-offline-service]').forEach(card=>{const s=services.find(s=>s.id===card.dataset.offlineService);if(s&&!Object.values(powderCapacity(s)).some(Boolean))card.querySelector('[data-action=powder]')?.remove();});
  host.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>staffAction(b.dataset.action,b.closest('[data-offline-service]').dataset.offlineService).catch(e=>notify(friendly(e))));
}
async function staffAction(action,id){
  const s=services.find(s=>s.id===id)||(profile.available || []).find(s=>s.id===id);if(!s)return;
  if(action==='details')return details(s);
  assertAllowed();
  if(action==='ownership-request')return serviceModal(id,s.transferRequest?.status==='pending'?'Cancelar envio à administração':'Enviar ordem à administração',`<p>O administrador precisa aceitar para a empresa assumir esta ordem. Até o aceite, a cobrança permanece com você.</p><label class=\"form-field\">Observação (opcional)<textarea name=\"note\" maxlength=\"500\"></textarea></label>`,async form=>{await enqueue('ownership-request',id,{requestId:crypto.randomUUID(),cancel:s.transferRequest?.status==='pending',note:form.get('note')});return true;},s.transferRequest?.status==='pending'?'Cancelar envio':'Enviar para aceite');
  if(action!=='claim'&&s.employeeId!==profile.actor.id)throw Error('Somente o funcionário responsável pode alterar a execução.');
  if(action==='claim'){await enqueue('claim',id,{});render();return}

  if(action==='technical')return technical(s);
  if(action==='pause')return serviceModal(id,'Pausar serviço · '+esc(s.code),'<p>As etapas e os anexos serão preservados. Depois da pausa, você poderá iniciar outro atendimento.</p><label class="form-field">Motivo da pausa<textarea name="reason" required minlength="3" maxlength="500" placeholder="Ex.: atendimento urgente em outro cliente"></textarea></label>',async f=>{await enqueue('pause',id,{reason:f.get('reason')});notify('Pausa salva no aparelho.');return true},'Pausar serviço');
  if(action==='resume'){await enqueue('resume',id,{});notify('Serviço retomado.');return}
  if(action==='painting')return serviceModal(id,'Pinturas da ordem',paintingField(s),async f=>{await enqueue('painting',id,{quantity:Number(f.get('quantity'))});return true},'Salvar quantidade');
  if(action==='powder')return serviceModal(id,'Consumo de pó químico',powderFields(s),async f=>{await enqueue('powder',id,{usage:powderPayload(f,s)});return true},'Salvar consumo');
  if(action==='stage'){const flow=stageFlow(profile.settings),order=flow.employeeStages,cur=order.indexOf(s.status),next=Math.min(cur+1,order.length-1),opts=order.filter((st,n)=>flow.allowSkip||n<=cur+1);return serviceModal(id,'Atualizar etapa',`<p class="ops-note">Etapa atual: <b>${esc(s.status||'—')}</b></p><label class="form-field">Nova etapa<select name="status">${opts.map(st=>`<option ${order.indexOf(st)===next?'selected':''}>${esc(st)}</option>`).join('')}</select></label>`,async f=>{await enqueue('stage',id,{status:f.get('status')});return true},'Atualizar')}
  if(action==='complete'){const flow=stageFlow(profile.settings),order=flow.employeeStages;if(flow.requireCompleteStage&&order.indexOf(s.status)<order.indexOf(flow.completeAt))throw Error(`Antes de concluir, atualize a etapa até “${flow.completeAt}”.`);return completionWizard(s)}
}
function details(s){
  return openOrderDetail(s,{onAction:(action,id)=>staffAction(action,id).catch(error=>notify(friendly(error))),readVideo:async url=>{
    if(url.startsWith('local:')){const op=ops.find(o=>o.id===url.slice(6));if(!op)throw Error('Vídeo não encontrado no aparelho.');return vault.blobGet(op.payload.blobKey,op.payload.mime)}
    const parsed=new URL(url),api=new URL(base);if(parsed.origin!==api.origin||!parsed.pathname.startsWith('/media/service-media/'))throw Error('Endereço de vídeo inválido.');
    const r=await window.apiCall(parsed.pathname);if(!r.ok)throw Error('Conecte-se para carregar este vídeo no aparelho.');return r.blob();
  }});
}
async function openQueue(){
 await hydrate();const pending=ops.filter(o=>!results[o.id]?.ok&&!results[o.id]?.discarded);
 const draftKeys=await vault.keys('draft:'+active+':'),drafts=await Promise.all(draftKeys.map(async key=>({key,value:await vault.get(key)})));
 openModal('Envios e registros preservados',`<p>Os registros só são confirmados depois da resposta do sistema. Fechar o aplicativo não apaga esta fila.</p>${pending.map(op=>{const r=results[op.id],s=services.find(s=>s.id===op.serviceId);return `<section class="offline-queue-item"><b>${esc(s?.code || 'Ordem local')} · ${esc(names[op.kind] || 'Registro')}</b><p>${esc(r?.error || (op.kind==='media'?'Vídeo aguardando envio':'Aguardando confirmação'))}</p>${r?.conflict?`<p>Esta ordem precisa de revisão. As informações locais continuam preservadas.</p><details><summary>Ver meus dados registrados</summary>${summary(op)}</details>${r.current?`<p>Versão atual no sistema: ${esc(statusOf(r.current))}</p>`:''}<button type="button" class="btn btn-soft btn-small" data-resolve="${esc(op.serviceId)}">Revisar ordem e reenvio</button>`:''}</section>`}).join('') || '<p>Nenhum envio pendente.</p>'}<p class="offline-footer-note">Antes de sincronizar, a cópia está somente neste aparelho. Desinstalar o app ou apagar os dados do navegador remove essa cópia.</p>`,()=>true,'Fechar');
 document.querySelectorAll('[data-resolve]').forEach(b=>b.onclick=()=>reviewConflict(b.dataset.resolve));
 if(drafts.length){const section=document.createElement('section');section.className='offline-form-section';section.innerHTML='<h3>Rascunhos neste aparelho</h3>'+drafts.map((draft,i)=>`<p>${esc(draft.key.endsWith(':create')?'Nova ordem de serviço':draft.key.includes(':technical:')?'Notas, peças e vídeos':draft.value?.title || 'Registro de serviço')} <button type="button" class="btn btn-soft btn-small" data-open-draft="${i}">Continuar rascunho</button></p>`).join('');document.querySelector('#editForm .modal-body').prepend(section);section.querySelectorAll('[data-open-draft]').forEach(button=>button.onclick=()=>{const draft=drafts[Number(button.dataset.openDraft)];if(draft.key.endsWith(':create'))return registration(profile.role);if(draft.key.includes(':technical:')){const service=services.find(s=>s.id===draft.key.split(':').at(-1));if(service)return technical(service).catch(e=>notify(e.message))}const title=draft.value?.title || '',id=draft.value?.serviceId;if(id){const action=title.startsWith('Pausar')?'pause':title.startsWith('Quantidade')?'painting':title.startsWith('Atualizar')?'stage':'complete';return staffAction(action,id).catch(e=>notify(e.message))}notify('Abra o serviço correspondente para recuperar este rascunho.');});}
}
async function reviewConflict(id){
 const related=ops.filter(o=>o.serviceId===id&&!results[o.id]?.ok&&!results[o.id]?.discarded),conflict=related.find(o=>results[o.id]?.conflict),current=conflict&&results[conflict.id].current;
 openModal('Revisar divergência',`<p>Confira as informações abaixo com o administrador antes de reaplicar. O registro original continuará preservado.</p><p>Servidor: ${esc(current?statusOf(current):'Atualize os dados com internet para consultar.')}</p>${related.map(op=>`<details class="offline-details"><summary>${esc(names[op.kind] || 'Registro')} · ${esc(new Date(op.createdAt).toLocaleString('pt-BR'))}</summary>${summary(op)}</details>`).join('')}<label class="form-field"><input name="confirmed" type="checkbox" required> Conferi a versão atual e quero reaplicar meus registros sobre ela.</label>`,async()=>{
   await prepare(true);const fresh=profile.services.find(s=>s.id===id);if(!fresh||fresh.closed||fresh.cancelledAt||fresh.employeeCompletedAt)throw Error('A ordem está encerrada, não pertence mais à sua conta ou já aguarda revisão. O registro local foi preservado.');
   // Validate the replacement against a fresh snapshot, then replace the chain atomically.
   if(related.some(op=>(op.dataEpoch||'initial')!==(profile.dataEpoch||'initial')))throw Error('Este registro pertence à base anterior. Consulte seu conteúdo e crie uma nova ordem se ainda for necessário; ele não será reaplicado automaticamente.');
   const validation=teamValidationState(profile.services),entries=[];let previousId='';
   for(const old of related){const op={...old,id:crypto.randomUUID(),baseVersion:fresh.syncVersion,previousId,createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString()};applyOperation(validation,profile.actor,op.kind==='media'?{...op,payload:{...op.payload,media:{url:'local:'+op.id}}}:op,op.createdAt);entries.push({key:opPrefix()+op.id,value:op},{key:resultKey(old.id),value:{discarded:true,error:'Substituído por reenvio revisado',archivedAt:op.createdAt,replacementId:op.id}});previousId=op.id}
   await vault.batch(entries);await hydrate();scheduleSync();notify('Reenvio revisado salvo.');return true;
 },'Reaplicar após revisão');
}
async function showPortal(){if(!profile)return;locked=false;db.settings={...db.settings,...profile.settings};db.types=profile.types;const data={...profile,services};if(profile.role==='employee')window.renderEmployeePortal(profile.username,services);else window.renderSellerPortal(data);scheduleRender()}
const originalLogout=window.logout;
window.logout=function(){window.closeModal?.();if(vault.native())nativeCall('logout').catch(()=>{});const old=active;if(old){vault.remove('auth:'+old).catch(()=>{});vault.put('active',null).catch(()=>{});if(vault.native())nativeCall('stopSync',{accountKey:old}).catch(()=>{})}active='';profile=null;services=[];ops=[];results={};employeeScope='own';tab='active';query='';upload=null;nativeTransfer=null;lastSyncAt='';originalLogout()};
window.apiCall=async function(path,method='GET',data=null){
 if(!navigator.onLine&&method!=='GET'&&['/api/profile','/api/employee/settings','/api/seller/settings','/api/team/billing'].includes(path))return new Response(JSON.stringify({error:'Esta ação precisa de internet para validar acesso ou pagamento. Seus serviços continuam disponíveis offline.'}),{status:503,headers:{'Content-Type':'application/json'}});
  if(profile?.role==='employee'&&allowed()&&path==='/api/employee/next-maintenance'&&method==='GET')return reply({services:services.filter(s=>employeeCreatedService(s,profile.actor.id)&&s.nextMaintenanceMonth).map(s=>({id:s.id,code:s.code,clientName:s.clientName,serviceType:s.serviceType,nextMaintenanceMonth:s.nextMaintenanceMonth,closed:s.closed,status:s.status}))});
 if(profile&&allowed()&&path==='/api/profile'&&method==='GET')return reply({username:profile.username});
 if(locked&&path==='/api/session')return new Response(JSON.stringify({error:'Desbloqueie o aparelho para abrir os serviços.'}),{status:403,headers:{'Content-Type':'application/json'}});
 if(path==='/api/session'&&method==='GET'&&allowed()){if(navigator.onLine)prepare(true).then(()=>scheduleSync()).catch(()=>{});return reply({...profile,services});}
 const r=await rawApi(path,method,data).catch(async error=>{if(path==='/api/session'&&allowed())return reply({...profile,services});if(active&&['/api/employee/services','/api/seller/services'].includes(path)&&method==='GET'){offline=true;return reply({services})}throw error});
 // Authentication and offline preparation are independent: a vault/connection failure
 // must not turn a successful login into a session error. Existing drafts stay intact.
 if(path==='/api/login'&&r.ok){const d=await r.clone().json();if(['employee','seller'].includes(d.role)){localStorage.setItem(tokenKey,d.token);localStorage.setItem(roleKey,d.role);locked=false;try{await prepare(true);scheduleSync()}catch{notify('Acesso confirmado. A preparação offline será retomada quando a conexão estiver disponível.')}}}
 if(path==='/api/session'&&r.ok){const d=await r.clone().json();if(['employee','seller'].includes(d.role)&&(!profile||profile.username!==d.username||accountToken!==localStorage.getItem(tokenKey)))try{await prepare(true)}catch{notify('Acesso confirmado. A preparação offline está pendente.');}}
 if(path==='/api/session'&&r.status===401&&allowed()){needsLogin=true;return reply({...profile,services})}
 if(active&&accountToken===localStorage.getItem(tokenKey)&&method==='GET'&&['/api/employee/services','/api/seller/services'].includes(path)){if(r.ok){if(!preparing&&Date.now()-Date.parse(profile.preparedAt)>20000)prepare(true).catch(()=>{});return reply({services:profile.role==='employee'?services.concat(offline?[]:profile.available || []):services})}if(allowed())return reply({services})}
 return r;
};
window.openTeamMaintenanceForm=role=>{
 if(registrationOpening)return registrationOpening;
 registrationOpening=registration(role).catch(error=>notify(friendly(error))).finally(()=>registrationOpening=null);return registrationOpening;
};
window.renderEmployeeWorkbench=renderWorkbench;
window.refreshEmployeePortal=()=>prepare(true).catch(error=>notify(error.message));
window.employeeNote=(id)=>{const s=services.find(s=>s.id===id);if(s)technical(s).catch(e=>notify(friendly(e)))};
window.completeEmployeeService=id=>staffAction('complete',id);
window.chooseEmployeeNextStep=id=>staffAction('painting',id);
window.advanceEmployeeService=(id,status)=>enqueue('stage',id,{status});
window.acceptEmployeeService=id=>staffAction('claim',id);
window.offlineServices={prepare,sync,showSync:()=>openSyncDetails(false),sendToAdmin:id=>staffAction('ownership-request',id).catch(e=>notify(friendly(e))),pauseService:id=>staffAction('pause',id).catch(e=>notify(friendly(e))),statusFor:syncStatus,openDetails:id=>{const s=services.find(s=>s.id===id)||(profile?.available||[]).find(s=>s.id===id);if(s)details(s)},get powderStock(){return profile?.powderStock||null},flowFor:()=>stageFlow(profile?.settings||{}),get actorId(){return profile?.actor?.id},get services(){return services},get ready(){return Boolean(allowed())},get locked(){return locked},vault};
window.offlineServices.hasRegistrationDraft=async()=>Boolean((active&&accountToken===localStorage.getItem(tokenKey)&&profile?.role===localStorage.getItem(roleKey)&&await vault.get('draft:'+active+':create'))||await vault.get('draft:online:'+localStorage.getItem(roleKey)+':'+localStorage.getItem('protecextintores_username')+':create'));
window.addEventListener('protec-team-session-verified',()=>{
 const verified=window.protecVerifiedTeamSession;
 if(!verified||verified.token!==localStorage.getItem(tokenKey)||verified.role!==localStorage.getItem(roleKey)||allowed())return;
 prepare(true).then(()=>{if(allowed()){showPortal();scheduleSync();}}).catch(()=>scheduleRender());
});
let lastNativeTheme='';
const syncNativeTheme=()=>{const mode=document.documentElement.dataset.theme==='dark'?'dark':'light';if(vault.native()&&mode!==lastNativeTheme){lastNativeTheme=mode;nativeCall('theme',{mode}).catch(()=>{});}};
new MutationObserver(syncNativeTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});syncNativeTheme();
const previousSettings=window.settings;
window.settings=function(container){previousSettings.apply(this,arguments);if(!container||container.querySelector('[data-offline-policy]'))return;const card=document.createElement('section');card.className='panel config-card';card.dataset.offlinePolicy='';card.innerHTML='<h3>Trabalho sem internet</h3><p>As telas e os dados são preparados automaticamente após entrar. O acesso local continua até sair da conta. Alterações e vídeos aguardam envio neste aparelho. O servidor confere as permissões antes de aceitar cada envio.</p><p>Entrar, configurar credenciais, gerar um novo Pix e confirmar recebimentos precisam de internet.</p>';container.append(card)};

const previousServiceTable=window.serviceTable;
window.serviceTable=function(list){const template=document.createElement('template');template.innerHTML=previousServiceTable.apply(this,arguments);template.content.querySelectorAll('tbody tr').forEach(row=>{const service=list.find(s=>row.innerHTML.includes(s.id));if(service?.pausedAt&&!service.closed&&!service.employeeCompletedAt){const tag=document.createElement('p');tag.className='offline-badge is-pending';tag.textContent='Pausado · '+(service.pauseReason || 'Sem motivo informado');row.querySelector('td:last-child')?.prepend(tag)}});return template.innerHTML};
window.addEventListener('online',()=>{if(!['employee','seller'].includes(localStorage.getItem(roleKey)))return;offline=false;teamRetry=0;scheduleSync();prepare(true).then(()=>scheduleSync()).catch(()=>scheduleRender())});
window.addEventListener('offline',()=>{offline=true;scheduleRender()});
window.addEventListener('protec-native-lock',()=>{locked=true;scheduleRender()});
window.addEventListener('protec-native-unlock',()=>{locked=false;if(profile)showPortal();else initialize()});
new MutationObserver(()=>{renderAvailability();const root=document.getElementById('employeePortal');if(profile&&root&&!root.classList.contains('hidden')&&(!root.querySelector('#offlineToolbar')||profile.role==='employee'&&!root.querySelector('[data-offline-service]')))scheduleRender()}).observe(document.getElementById('employeePortal'),{childList:true,subtree:true});
setInterval(()=>{if(active&&!document.hidden)hydrate().catch(()=>{});},3000);
setInterval(()=>{if(localStorage.getItem(tokenKey)&&['employee','seller'].includes(localStorage.getItem(roleKey))&&!document.hidden&&navigator.onLine&&!locked)prepare(true).then(()=>sync()).catch(()=>{});},45000);
async function initialize(){try{if(vault.native()){const state=await nativeCall('lockState');locked=state.locked;if(locked){await nativeCall('unlock');locked=false}}const saved=await vault.get('active');active=saved?.accountKey || '';if(active&&['employee','seller'].includes(localStorage.getItem(roleKey))){await hydrate();if(profile&&localStorage.getItem(tokenKey)){if(allowed())await showPortal()}else active=''}await initializeAdminOffline();}catch(error){notify(friendly(error));if(locked)showInitialLock()}finally{window.protecOfflineLoaded=true;window.dispatchEvent(new Event('protec-offline-ready'));if(!locked&&localStorage.getItem(tokenKey)&&['employee','seller'].includes(localStorage.getItem(roleKey)))prepare(true).then(()=>{showPortal();scheduleSync()}).catch(()=>scheduleRender());}}
function showInitialLock(){for(const id of ['store','login','dashboard'])document.getElementById(id)?.classList.add('hidden');const root=document.getElementById('employeePortal');root.classList.remove('hidden');root.innerHTML='<section class="offline-locked"><h1>ProtecExtintores</h1><p>Desbloqueie o aparelho para abrir seus serviços.</p><button type="button" class="btn" data-unlock-initial>Desbloquear aparelho</button></section>';root.querySelector('[data-unlock-initial]').onclick=()=>initialize();}
initialize();


let registrationBackendCache=null;
async function registrationBackendProtocol(role,fallback=0,force=false){
 if(!navigator.onLine)return Number(fallback)||0;
 const token=localStorage.getItem(tokenKey);
 if(!force&&registrationBackendCache?.token===token&&Date.now()-registrationBackendCache.at<30000)return registrationBackendCache.protocol;
 const read=async()=>{
  try{const r=await rawApi('/api/capabilities'),d=await r.json();if(r.ok&&Number(d.registrationProtocol)>0)return Number(d.registrationProtocol);}catch{}
  try{const r=await rawApi(role==='admin'?'/api/admin/state':'/api/team/registration-catalog'),d=await r.json();if(r.status===404)return 0;if(r.ok)return Number(role==='admin'?d.state?.__registrationProtocol??d.__registrationProtocol:d.registrationVersion??d.registrationCatalog?.version)||0;}catch{}
  return Number(fallback)||0;
 };
 if(!force&&Number(fallback)>0){read().then(protocol=>{if(token===localStorage.getItem(tokenKey))registrationBackendCache={token,at:Date.now(),protocol};}).catch(()=>{});return Number(fallback);}
 const protocol=await Promise.race([read(),new Promise(resolve=>setTimeout(()=>resolve(Number(fallback)||0),4000))]);
 registrationBackendCache={token,at:Date.now(),protocol};return protocol;
}

async function registration(role,initialDraft){
 const currentRole=localStorage.getItem(roleKey),token=localStorage.getItem(tokenKey);
 if(!token)return notify('Entre na sua conta para registrar o serviço.');
 const isAdmin=currentRole==='admin';
 if(!['admin','employee','seller'].includes(currentRole))return notify('Entre com uma conta da equipe.');
 role=currentRole;let onlineOnly=false,metadata=null;
 if(locked)throw Error(preparationIssue?.status===403?'Conta indisponível. Procure o administrador.':'Desbloqueie o aparelho.');
 if(!isAdmin&&(!allowed()||profile?.role!==role)){
  if(!navigator.onLine)throw Error('Conecte-se uma vez para carregar os dados desta conta automaticamente.');
  try{await prepare(true);}catch(error){
   if([401,403].includes(error.status)||locked)throw error;
   onlineOnly=true;
   try{const r=await rawApi('/api/team/registration-catalog'),d=await r.json();if(r.ok&&d.actor?.role===role)metadata=d;}catch{}
  }
 }
 const cachedProtocol=Number(isAdmin?db.__registrationProtocol:onlineOnly?metadata?.registrationVersion:profile?.registrationCatalog?.version)||0;
 let backendProtocol=await registrationBackendProtocol(role,cachedProtocol);
 if(!isAdmin&&!onlineOnly&&backendProtocol>Number(profile?.registrationCatalog?.version||0)&&navigator.onLine)try{await prepare(true);}catch(error){if([401,403].includes(error.status))throw error;}
 if(onlineOnly&&backendProtocol>Number(metadata?.registrationVersion||0))try{const r=await rawApi('/api/team/registration-catalog'),d=await r.json();if(r.ok&&d.actor?.role===role)metadata=d;}catch{}
 if(token!==localStorage.getItem(tokenKey)||role!==localStorage.getItem(roleKey))throw Error('A conta mudou. Reabra o cadastro.');
 if(!isAdmin&&!onlineOnly)assertAllowed();
 const catalog=isAdmin?registrationCatalog(db):registrationCatalog(metadata?.registrationCatalog?{registrationCatalog:metadata.registrationCatalog}:!onlineOnly?profile:{types:db.types||[],settings:db.settings||{},costCatalog:[]});
 const complementsSupported=backendProtocol>=5,complementsEnabled=true;
 const contactsEnabled=backendProtocol>=6;
 const directory=isAdmin?registrationContacts(db,{role:'admin'}):metadata?.registrationContacts||(!onlineOnly?profile?.registrationContacts:null)||{clients:[],sellers:[]};
 const actorName=metadata?.actor?.name||(!isAdmin&&!onlineOnly?profile.actor.name:'')||localStorage.getItem('protecextintores_username')||'sua conta';
 const formAccount=isAdmin?'admin:'+localStorage.getItem('protecextintores_username'):onlineOnly?'online:'+role+':'+localStorage.getItem('protecextintores_username'):active;
 const key=isAdmin?'draft:'+formAccount+':create':onlineOnly?'draft:'+formAccount+':create':`draft:${active}:create`;
 const onlineDraftKey='draft:online:'+role+':'+localStorage.getItem('protecextintores_username')+':create';
 await Promise.all([registrationDraftWrites.get(key),registrationDraftWrites.get(onlineDraftKey)].map(p=>Promise.resolve(p).catch(()=>{})));
 const recoveredDraft=initialDraft||await vault.get(key).catch(()=>null)||(!isAdmin&&!onlineOnly?await vault.get(onlineDraftKey).catch(()=>null):null);
  const draft=recoveredDraft||{date:localDay(new Date()),items:[{type:'',kg:'',qty:1}]};
 if(!draft.items&&draft.rows)draft.items=draft.rows;
 draft.serviceId ||= crypto.randomUUID();draft.items ||= [{type:'',kg:'',qty:1}];draft.plannedParts ||= [];draft.hydrantHoses ||= [];draft.soldExtinguishers ||= [];
 // Recover both older free-contact drafts and the previous admin selectors.
 if(isAdmin&&draft.clientId){const c=(db.clients||[]).find(c=>c.id===draft.clientId);if(c){draft.clientName ||= c.name;draft.clientPhone ||= c.phone;draft.clientEmail ||= c.email;}}
 draft.clientChoice ??= draft.clientId||(draft.clientName?'__new__':'__self__');if(draft.clientChoice==='')draft.clientChoice='__self__';draft.sellerChoice ??= draft.sellerId||'';
 if(!['','__new__','__self__'].includes(draft.clientChoice)&&!directory.clients.some(c=>c.id===draft.clientChoice))draft.clientChoice=draft.clientName?'__new__':'';
 if(draft.sellerChoice&&!directory.sellers.some(c=>c.id===draft.sellerChoice))draft.sellerChoice='';
 delete draft.clientId;delete draft.sellerId;
 draft.complementaryServices ||= [];
 migrateRegistrationExtras(draft,catalog);
 if(draft.maintenanceEnabled===false)draft.items=[];
 draft.serviceType='Manutenção';
 if(Number(draft.registrationVersion||0)<3&&draft.parts&&!draft.plannedParts.length)draft.notes=[draft.notes,'Peças previstas no rascunho anterior: '+draft.parts].filter(Boolean).join('\n');
 const options=(values,selected='',blank='Selecione')=>(blank!==null?'<option value="">'+esc(blank)+'</option>':'')+values.map(v=>{const value=typeof v==='object'?v.value:v,label=typeof v==='object'?v.label:v;return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;}).join('');
 const quantities=Array.from({length:50},(_,i)=>i+1),saleEnabled=true;
 const complementChoices=(catalog.complements||[]).filter(c=>c.placement!=='equipment');
 const complementRow=item=>`<section class="registration-complement-line" data-complement-row data-catalog-id="${esc(item.catalogId)}"><label>Tipo<select data-complement-variant required></select></label><label>Quantidade<select data-complement-qty>${options(Array.from({length:100},(_,i)=>i+1),item.quantity||1,null)}</select></label><button type="button" class="icon-btn" data-remove-complement aria-label="Remover item complementar">Remover</button><div class="registration-complement-parameters" data-complement-parameters></div></section>`;

 const capacityValue=(type,kg)=>type==='Água pressurizada'&&!kg?'water-10':String(kg||'');
 const typeOptions=item=>options([...new Set(catalog.equipment.map(e=>e.type))],item.type);
 const equipmentRow=item=>`<section class="registration-line" data-equipment-row><label>Tipo *<select data-type required>${typeOptions(item)}</select></label><label>Peso / capacidade *<select data-kg required></select></label><label>Quantidade *<select data-qty required>${options(quantities,item.qty||1,null)}</select></label><button type="button" class="icon-btn" data-remove-row aria-label="Remover extintor">Remover</button></section>`;
 const partRow=item=>`<section class="registration-line registration-part" data-part-row><label>Peça prevista<select data-part required>${options(catalog.parts.map(p=>p.name),item.name)}</select></label><label>Quantidade<select data-part-qty>${options(quantities,item.quantity||1,null)}</select></label><button type="button" class="icon-btn" data-remove-part>Remover</button></section>`;
 const hoseRow=item=>`<section class="registration-line registration-hose" data-hose-row><label>Tipo de mangueira<select data-hose-type required>${options(catalog.hoseTypes,item.type||'Tipo 1',null)}</select></label><label>Diâmetro<select data-hose-diameter>${options(catalog.diameters.map(v=>({value:v,label:v+' mm'})),item.diameterMm||38,null)}</select></label><label>Metros<select data-hose-length>${options(catalog.lengths.map(v=>({value:v,label:v+' m'})),item.lengthMeters||15,null)}</select></label><label>Quantidade<select data-hose-qty>${options(quantities,item.quantity||1,null)}</select></label><button type="button" class="icon-btn" data-remove-hose>Remover</button></section>`;
 const saleRow=item=>registrationSaleRow(catalog,item);
 const textInput=(name,label,type='text')=>`<label class="form-field">${label}<input name="${name}" type="${type}" maxlength="254" value="${esc(draft[name]||'')}"></label>`;
 const descriptions={'demarcation':'Selecione cor, comprimento e largura.','extinguisher-hose':'Adicione uma ou mais mangueiras por agente.','diffuser':'Adicione um ou mais tipos.','safety-signage':'Saídas, extintores, hidrantes e demais placas.','valve':'Escolha a válvula correspondente ao equipamento.','hydrant-accessories':'Esguicho, adaptador, chave ou tampão Storz.'};
 const hoseAvailable=catalog.version<5||catalog.complements?.some(c=>c.id==='hydrant-hose-test');
 const hoseCard=`<article class="registration-service-card" data-extra-card="hydrant-hose-test" ${!hoseAvailable&&!draft.hydrantHoses.length?'hidden':''}><label class="registration-choice"><input type="checkbox" data-hoses-enabled ${draft.hydrantHoses.length?'checked':''}><span><b>Testar mangueira de hidrante</b><small>Selecione tipo, diâmetro, comprimento e quantidade.</small></span></label><div data-hose-section hidden>${hoseAvailable?'':'<p class="helper">Opção removida do catálogo. Desmarque para continuar.</p>'}<div data-hose-rows>${(draft.hydrantHoses.length?draft.hydrantHoses:[{}]).map(hoseRow).join('')}</div><button type="button" class="btn btn-soft btn-small" data-add-hose>＋ Adicionar mangueira</button></div></article>`;
 const complementCards=hoseCard+complementChoices.map(c=>{const selected=draft.complementaryServices.filter(row=>row.catalogId===c.id);return `<article class="registration-service-card" data-complement-card="${esc(c.id)}" data-extra-card="${esc(c.id)}"><label class="registration-choice"><input type="checkbox" data-complement-toggle="${esc(c.id)}" ${selected.length?'checked':''} ${complementsEnabled?'':'disabled'}><span><b>${esc(c.name)}</b>${descriptions[c.id]?'<small>'+esc(descriptions[c.id])+'</small>':''}</span></label><div data-complement-details hidden><div data-complement-rows>${selected.map(complementRow).join('')}</div><button type="button" class="btn btn-soft btn-small" data-add-complement="${esc(c.id)}">＋ Adicionar item</button></div></article>`;}).join('');
  const introductory=onlineOnly?'Registro online: aguarde a confirmação antes de fechar.':recoveredDraft?'Rascunho recuperado. Suas escolhas foram mantidas.':'Rascunho salvo automaticamente neste aparelho.';
  let submitting=false,registered=false;
 openModal('Registrar manutenção / serviço',`<p class="helper registration-required-note">* Campos obrigatórios. Confira os equipamentos e os complementos antes de salvar.</p>
<div class="form-grid team-contact-grid"><label class="form-field">Cliente<select name="clientChoice">${options(directory.clients.map(c=>({value:c.id,label:c.name})),draft.clientChoice,'Selecionar...')}<option value="__new__" ${draft.clientChoice==='__new__'?'selected':''}>＋ Informar novo cliente</option><option value="__self__" ${draft.clientChoice==='__self__'?'selected':''}>Serviço próprio · ${esc(actorName)}</option></select></label><label class="form-field">Vendedor responsável<select name="sellerChoice">${options(directory.sellers.map(s=>({value:s.id,label:s.name})),draft.sellerChoice,'Selecionar...')}</select></label></div>

<section class="team-equipment-section"><h3>Extintores do serviço</h3><div data-maintenance-section><div data-equipment-rows>${draft.items.map(equipmentRow).join('')}</div><button type="button" class="btn btn-soft btn-small registration-add-wide" data-add-row>＋ Adicionar tipo</button></div><p class="helper registration-capacity-note">Pesos e capacidades variam conforme o agente. Para registrar somente compra ou adicionais, remova as linhas de manutenção.</p></section>
<section class="registration-additional-services" data-complement-section><h3>Serviços complementares (opcionais)</h3><p class="helper">Marque somente o que será realizado. Tipos, medidas e quantidades são escolhidos nas listas.</p>${complementsSupported?'':'<p class="helper registration-compatibility-note" role="status">Você pode marcar e guardar estas escolhas no rascunho. Para confirmar os novos complementos, o administrador precisa atualizar a API do sistema.</p>'}<div class="registration-card-grid">${complementCards}</div></section>
<section class="registration-optional registration-choice-card registration-purchase-card"><label class="registration-choice"><input type="checkbox" data-sales-enabled ${draft.soldExtinguishers.length?'checked':''} ${saleEnabled?'':'disabled'}><span><b>Adicionar compra de extintores</b><small>Novos lacrados ou seminovos revisados, junto com a manutenção ou separadamente.</small></span></label>${saleEnabled?'':'<p class="helper">O fornecimento estará disponível quando o administrador atualizar o sistema.</p>'}<div data-sale-section hidden><p class="helper">Novo lacrado, sem argola · seminovo revisado, com argola.</p><div data-sale-rows>${(draft.soldExtinguishers.length?draft.soldExtinguishers:[{}]).map(saleRow).join('')}</div><button type="button" class="btn btn-soft btn-small registration-add-wide" data-add-sale>＋ Adicionar extintor à compra</button></div></section>
<section class="registration-complementary"><div class="registration-section-head"><h3>Peças previstas (opcional)</h3><button type="button" class="btn btn-soft btn-small" data-add-part>＋ Adicionar peça</button></div><div data-part-rows>${draft.plannedParts.map(partRow).join('')}</div><p class="helper">A previsão não confirma troca nem baixa de estoque. As peças usadas serão confirmadas na execução.</p></section>
<details class="registration-contact-details registration-contact-editor" ${draft.clientChoice==='__new__'?'open':''}><summary>Dados do cliente e agendamento (opcional)</summary><p class="helper registration-owner-note">Sem cliente informado, a ordem fica vinculada a quem a registra. A autoria e a cobrança interna seguem a conta autenticada.</p><div class="form-grid">${textInput('clientName','Cliente / empresa (opcional)')}${textInput('clientPhone','Telefone (opcional)','tel')}${textInput('clientEmail','E-mail (opcional)','email')}<label class="form-field registration-service-date">Data<input name="date" type="date" required value="${esc(draft.date)}"></label><label class="form-field">Próxima manutenção (opcional)<input name="nextMaintenanceMonth" type="month" value="${esc(draft.nextMaintenanceMonth||'')}"></label></div></details>
<section class="registration-price"><div class="registration-price-heading"><span>Preço sugerido ao cliente</span><span class="offline-badge" data-registration-version>Cadastro 45</span></div><output data-suggested-price aria-live="polite">Selecione os equipamentos</output><div data-quote-lines></div><p data-order-count class="helper"></p><p data-price-help class="helper"></p><label class="form-field">Valor combinado com o cliente (opcional, R$)<input name="serviceAmount" type="number" min="0" max="1000000" step="0.01" value="${esc(draft.serviceAmount??'')}" placeholder="Vazio usa a sugestão"></label><p class="helper">A sugestão é calculada pela tabela cadastrada e não pode ser editada. O valor combinado com o cliente é independente das condições internas da equipe.</p></section>
<label class="form-field">Observações (opcional)<textarea name="notes" maxlength="3000" rows="3">${esc(draft.notes||'')}</textarea></label><p data-draft-state class="offline-save-state" role="status">${introductory}</p>`,async()=>{
   if(submitting)return false;submitting=true;
   try{
   if(token!==localStorage.getItem(tokenKey)||role!==localStorage.getItem(roleKey)||!isAdmin&&!onlineOnly&&active!==formAccount)throw Error('A conta mudou. Reabra o cadastro.');
  await saves;const payload=collect();normalizeForSubmit(payload);
  const selectedContact=!['','__new__','__self__'].includes(payload.clientChoice)||Boolean(payload.sellerChoice);
  const requiredProtocol=Math.max(8,payload.complementaryServices.length?5:0,payload.soldExtinguishers.length?4:0,payload.hydrantHoses.length?3:0,!isAdmin&&selectedContact?6:0);
  if(requiredProtocol&&backendProtocol<requiredProtocol){backendProtocol=await registrationBackendProtocol(role,backendProtocol,true);if(backendProtocol<requiredProtocol)throw Error('Suas escolhas estão salvas no rascunho. Atualize a API do sistema para confirmar esta ordem com os adicionais selecionados. Depois, tente salvar novamente.');}

  if(isAdmin){
   const next=structuredClone(db),created=applyOperation(next,{role:'admin',id:'admin-account',username:actorName,name:actorName},{id:crypto.randomUUID(),serviceId:draft.serviceId,kind:'create',payload},new Date().toISOString());
   db.services.push(created);
   if(!await window.save()){db.services=db.services.filter(s=>s.id!==created.id);throw Error('A ordem ainda não foi confirmada. O rascunho foi mantido; tente novamente.');}
   window.renderPage?.();notify('Ordem registrada · '+created.code);
  }else if(onlineOnly){
   const selectionText=[...payload.hydrantHoses.map(h=>`Mangueira de hidrante: ${h.type}, ${h.diameterMm} mm, ${h.lengthMeters} m, ${h.quantity} unidade(s).`),...payload.plannedParts.map(p=>`Peça prevista: ${p.name} × ${p.quantity}.`)];
   const r=await rawApi('/api/'+role+'/services','POST',{...payload,notes:[payload.notes,...selectionText].filter(Boolean).join('\n')}),d=await r.json();if(!r.ok)throw Error(d.error||'Não foi possível registrar.');
   notify('Ordem confirmada no sistema · '+d.service.code);
    // The order has already been accepted. A failed refresh must not leave the
    // submission open for another POST of the same order.
    try{const fresh=await rawApi('/api/'+role+'/services'),state=await fresh.json();if(fresh.ok){if(role==='employee')window.refreshEmployeeAfterCreate?.(state.services);else{if(window.sellerPortalState)window.sellerPortalState.services=state.services;window.renderSellerServicesList?.();}}}catch{notify('Ordem confirmada. A lista será atualizada quando a conexão voltar.');}
  }else{await enqueue('create',draft.serviceId,payload);notify('Ordem salva no aparelho. O envio acontece automaticamente.');}
   await registrationDraftWrites.get(key)?.catch(()=>{});
   await vault.remove(key).catch(()=>{});registrationDraftWrites.delete(key);if(!isAdmin&&!onlineOnly)await vault.remove(onlineDraftKey).catch(()=>{});registered=true;window.dispatchEvent(new Event('protec-draft-changed'));return true;
   }finally{submitting=false;}
 },'Registrar ordem');
 const form=document.getElementById('editForm'),hint=form.querySelector('[data-draft-state]');standardizeRegistrationFrame(form,role);if(onlineOnly)form.dataset.onlineRegistration='';let saves=Promise.resolve();
 const collect=()=>{const payload={workshopVersion:44,registrationVersion:8,registrationStep:Number(form.dataset.currentStep||0),serviceId:draft.serviceId,maintenanceEnabled:form.querySelectorAll('[data-equipment-row]').length>0,...Object.fromEntries(['clientChoice','sellerChoice','clientName','clientPhone','clientEmail','date','nextMaintenanceMonth','serviceAmount','notes'].map(n=>[n,form.elements[n]?.value?.trim()||''])),items:[...form.querySelectorAll('[data-equipment-row]')].map(r=>({type:r.querySelector('[data-type]').value,kg:r.querySelector('[data-kg]').value==='water-10'?'':r.querySelector('[data-kg]').value,qty:Number(r.querySelector('[data-qty]').value)})),plannedParts:[...form.querySelectorAll('[data-part-row]')].map(r=>({name:r.querySelector('[data-part]').value,quantity:Number(r.querySelector('[data-part-qty]').value)})),hydrantHoses:form.querySelector('[data-hoses-enabled]').checked?[...form.querySelectorAll('[data-hose-row]')].map(r=>({type:r.querySelector('[data-hose-type]').value,diameterMm:Number(r.querySelector('[data-hose-diameter]').value),lengthMeters:Number(r.querySelector('[data-hose-length]').value),quantity:Number(r.querySelector('[data-hose-qty]').value)})):[],soldExtinguishers:saleEnabled&&form.querySelector('[data-sales-enabled]').checked?[...form.querySelectorAll('[data-sale-row]')].map(r=>({condition:r.querySelector('[data-sale-condition]').value,type:r.querySelector('[data-sale-type]').value,kg:r.querySelector('[data-sale-kg]').value==='water-10'?'':r.querySelector('[data-sale-kg]').value,quantity:Number(r.querySelector('[data-sale-qty]').value)})):[]};payload.complementaryServices=[...form.querySelectorAll('[data-complement-row]')].filter(r=>r.closest('[data-complement-card]').querySelector('[data-complement-toggle]').checked).map(r=>({catalogId:r.dataset.catalogId,variant:r.querySelector('[data-complement-variant]').value,quantity:Number(r.querySelector('[data-complement-qty]').value),parameters:Object.fromEntries([...r.querySelectorAll('[data-complement-param]')].map(input=>[input.dataset.complementParam,input.value]))}));if(isAdmin&&!contactsEnabled){payload.clientId=directory.clients.some(c=>c.id===payload.clientChoice)?payload.clientChoice:'';payload.sellerId=payload.sellerChoice;}if(!isAdmin)payload.sellerChoice='';payload.serviceType=registrationKind(payload.items.length,payload.soldExtinguishers.length,catalog);return payload;};
 const normalizeForSubmit=data=>{normalizeRegistration({registrationCatalog:catalog},data);if(!data.items.length&&!data.hydrantHoses.length&&!data.soldExtinguishers.length&&!data.complementaryServices.length)throw Error('Selecione pelo menos um equipamento da ordem.');if(data.items.some(i=>!catalog.equipment.some(e=>e.type===i.type&&e.kg===i.kg&&e.maintenanceAllowed!==false)))throw Error('Selecione o tipo e a capacidade dos extintores.');};
 const price=()=>{const p=collect(),ready=(p.items.length+p.hydrantHoses.length+p.soldExtinguishers.length+p.complementaryServices.length)>0&&p.items.every(i=>i.type&&catalog.equipment.some(e=>e.type===i.type&&e.kg===i.kg))&&p.soldExtinguishers.every(i=>i.type&&catalog.equipment.some(e=>e.type===i.type&&e.kg===i.kg))&&p.complementaryServices.every(row=>complementChoices.some(c=>c.id===row.catalogId&&c.variants.includes(row.variant))),quote=registrationQuote({registrationCatalog:catalog},p);form.querySelector('[data-suggested-price]').textContent=!ready?'Complete as opções selecionadas':quote.pending?'Preço a definir pelo admin':(quote.amountCents/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});form.querySelector('[data-price-help]').textContent=!ready?'Escolha os equipamentos para calcular.':quote.pending?'Sem preço cadastrado: '+quote.missing.join(', ')+'. O admin precisa revisar estes valores.':'Se o valor combinado ficar vazio, será aplicada esta sugestão. A estimativa offline é conferida no envio.';form.querySelector('[data-quote-lines]').innerHTML=ready?'<ul class="workshop-quote-lines">'+quote.lines.map(line=>'<li><span>'+esc(line.name)+' × '+line.quantity+'</span><b>'+((line.unitCents*line.quantity)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</b></li>').join('')+'</ul>':'';form.querySelector('[data-order-count]').textContent=[p.items.reduce((n,i)=>n+i.qty,0)+' para manutenção',p.hydrantHoses.reduce((n,i)=>n+i.quantity,0)+' mangueira(s)',p.soldExtinguishers.reduce((n,i)=>n+i.quantity,0)+' para fornecimento',p.complementaryServices.reduce((n,i)=>n+i.quantity,0)+' complemento(s)'].join(' · ');};
  const save=()=>{if(submitting||registered)return;const value=collect();price();hint.textContent='Salvando rascunho…';saves=Promise.resolve(registrationDraftWrites.get(key)).catch(()=>{}).then(()=>vault.put(key,value)).then(()=>{hint.textContent='Rascunho salvo neste aparelho';window.dispatchEvent(new Event('protec-draft-changed'));}).catch(e=>{hint.textContent=onlineOnly?'Rascunho somente nesta tela; aguarde a confirmação online.':friendly(e);if(!onlineOnly)throw e;});registrationDraftWrites.set(key,saves);saves.catch(()=>{});};
 const capacity=(row,selected,isSale=false)=>{const typeField=row.querySelector(isSale?'[data-sale-type]':'[data-type]'),type=typeField.value,values=catalog.equipment.filter(e=>e.type===type&&(isSale||e.maintenanceAllowed!==false)),field=row.querySelector(isSale?'[data-sale-kg]':'[data-kg]'),water=type==='Água pressurizada';field.innerHTML=options(values.map(e=>({value:capacityValue(type,e.kg),label:e.label})),water?'water-10':capacityValue(type,selected),water?null:'Selecione');field.closest('label').hidden=water;field.disabled=water;field.required=!water;row.classList.toggle('registration-water-line',water);let note=typeField.closest('label').querySelector('[data-fixed-capacity]');if(water&&!note){note=document.createElement('small');note.dataset.fixedCapacity='';note.textContent='Capacidade fixa: 10 L';typeField.after(note);}if(note)note.hidden=!water;};
 const bindEquipment=(row,item={})=>{capacity(row,item.kg);row.querySelector('[data-type]').onchange=()=>{capacity(row,'');save();};row.querySelector('[data-remove-row]').onclick=()=>{row.remove();save();};};
 const bindSale=(row,item={})=>{capacity(row,item.kg,true);row.querySelector('[data-sale-type]').onchange=()=>{capacity(row,'',true);save();};row.querySelector('[data-remove-sale]').onclick=()=>{row.remove();save();};};
 form.querySelectorAll('[data-equipment-row]').forEach((r,i)=>bindEquipment(r,draft.items[i]));form.querySelectorAll('[data-sale-row]').forEach((r,i)=>bindSale(r,draft.soldExtinguishers[i]));
 const updateComplementCard=card=>{const enabled=card.querySelector('[data-complement-toggle]').checked,details=card.querySelector('[data-complement-details]');details.hidden=!enabled;card.classList.toggle('is-open',enabled);details.querySelectorAll('select').forEach(input=>input.disabled=!enabled);};
 const bindComplement=(row,item={})=>{
  const c=complementChoices.find(c=>c.id===row.dataset.catalogId);row.querySelector('[data-complement-variant]').innerHTML=options(c?.variants||[],item.variant);
  row.querySelector('[data-complement-parameters]').innerHTML=(c?.fields||[]).map(f=>`<label>${esc(f.label)}<select data-complement-param="${esc(f.key)}" required>${options(f.values,item.parameters?.[f.key]||f.values[0],null)}</select></label>`).join('');
  row.querySelector('[data-remove-complement]').onclick=()=>{const card=row.closest('[data-complement-card]');row.remove();if(!card.querySelector('[data-complement-row]'))card.querySelector('[data-complement-toggle]').checked=false;updateComplementCard(card);save();};
 };

 // Bind duplicate groups by their position, preserving each variant in recovered drafts.
 form.querySelectorAll('[data-complement-card]').forEach(card=>{const id=card.dataset.complementCard,items=draft.complementaryServices.filter(row=>row.catalogId===id);card.querySelectorAll('[data-complement-row]').forEach((row,index)=>bindComplement(row,items[index]));
  const add=()=>{const list=card.querySelector('[data-complement-rows]');list.insertAdjacentHTML('beforeend',complementRow({catalogId:id}));bindComplement(list.lastElementChild);};
  card.querySelector('[data-complement-toggle]').onchange=()=>{if(card.querySelector('[data-complement-toggle]').checked&&!card.querySelector('[data-complement-row]'))add();updateComplementCard(card);save();};
  card.querySelector('[data-add-complement]').onclick=()=>{add();updateComplementCard(card);save();};updateComplementCard(card);
 });
 const setClient=()=>{const choice=form.elements.clientChoice?.value,client=directory.clients.find(c=>c.id===choice),own=!choice||choice==='__self__';const fields=form.querySelector('[data-customer-fields]');if(fields)fields.hidden=own;form.elements.clientName.required=choice==='__new__';for(const name of ['clientName','clientPhone','clientEmail'])form.elements[name].disabled=own;const note=form.querySelector('[data-customer-owner-note]');if(note)note.textContent=own?'Serviço próprio de '+actorName+'. '+(isAdmin?'Receitas e custos pertencem à empresa; não há cobrança interna.':'A cobrança interna continua vinculada à sua conta.'):'A escolha do cliente não altera a autoria nem as condições de pagamento desta ordem.';for(const [name,key] of [['clientName','name'],['clientPhone','phone'],['clientEmail','email']]){form.elements[name].readOnly=Boolean(client);if(client)form.elements[name].value=client[key]||'';else if(choice!=='__new__')form.elements[name].value='';}if(choice==='__new__')form.querySelector('.registration-contact-editor').open=true;};
 setClient();if(form.elements.clientChoice)form.elements.clientChoice.onchange=()=>{setClient();save();};
 const bindRemovers=()=>{form.querySelectorAll('[data-remove-part]').forEach(b=>b.onclick=()=>{b.closest('[data-part-row]').remove();save();});form.querySelectorAll('[data-remove-hose]').forEach(b=>b.onclick=()=>{b.closest('[data-hose-row]').remove();save();});};bindRemovers();
 form.querySelector('[data-add-row]').onclick=()=>{form.querySelector('[data-equipment-rows]').insertAdjacentHTML('beforeend',equipmentRow({}));bindEquipment(form.querySelector('[data-equipment-row]:last-child'));save();};
 form.querySelector('[data-add-part]').onclick=()=>{form.querySelector('[data-part-rows]').insertAdjacentHTML('beforeend',partRow({}));bindRemovers();save();};
 form.querySelector('[data-add-hose]').onclick=()=>{form.querySelector('[data-hose-rows]').insertAdjacentHTML('beforeend',hoseRow({}));bindRemovers();save();};
 form.querySelector('[data-add-sale]').onclick=()=>{form.querySelector('[data-sale-rows]').insertAdjacentHTML('beforeend',saleRow({}));bindSale(form.querySelector('[data-sale-row]:last-child'));save();};
 const toggleGroup=(input,section)=>{const enabled=input.checked;section.hidden=!enabled;input.closest('.registration-service-card')?.classList.toggle('is-open',enabled);section.querySelectorAll('select').forEach(s=>s.disabled=!enabled||s.matches('[data-sale-kg]')&&s.closest('[data-sale-row]').classList.contains('registration-water-line'));};
 const toggleAll=()=>{for(const [control,section] of [['hoses','hose'],['sales','sale']])toggleGroup(form.querySelector('[data-'+control+'-enabled]'),form.querySelector('[data-'+section+'-section]'));};
 for(const control of ['hoses','sales'])form.querySelector('[data-'+control+'-enabled]').onchange=()=>{toggleAll();save();};toggleAll();
 form.addEventListener('input',save);form.addEventListener('change',save);price();form.addEventListener('protec-registration-step',save);enhanceRegistrationSteps(form,draft.registrationStep||0);
}

async function technical(service){
 assertAllowed();if(isPaused(service))throw Error('Retome o serviço antes de registrar peças e vídeos.');
 const key=`draft:${active}:technical:${service.id}`,draft=await vault.get(key)||{items:service.items.map(i=>({notes:i.notes || '',parts:i.replacedParts || [],videos:{}}))},parts=[...new Set([...PART_NAMES,...profile.costCatalog.map(i=>i.name)])];
 draft.basis ||= basisFor(service.id);
 openModal('Peças, notas e vídeos · '+esc(service.code),`<p>Cada peça trocada precisa de seu próprio vídeo, com até 60 segundos e 50 MB. Escolha vídeos já disponíveis no aparelho.</p><p class="offline-save-state" data-draft-state>Dados recuperados do aparelho</p>${equipmentGroups(service.items).map(group=>`<details class="workshop-equipment-group"><summary><b>${esc(group.type)} · ${esc(group.kg?group.kg+' kg':'10 L')}</b><span>${group.items.length} unidade(s)</span></summary>${group.items.map((item,position)=>{const i=group.indexes[position];return `<section class="offline-form-section" data-technical-item="${i}"><h3>Equipamento ${i+1} · ${esc(item.type)} ${esc(item.kg || '')}</h3><label>Observação técnica<textarea data-notes maxlength="3000">${esc(draft.items[i]?.notes || '')}</textarea></label><div class="offline-parts">${parts.map(part=>`<label><input type="checkbox" data-piece="${esc(part)}" ${draft.items[i]?.parts?.includes(part)?'checked':''}>${window.protecArtwork.artwork({name:part},'tiny')}<span>${esc(part)}</span></label>`).join('')}</div><div data-video-slots></div></section>`;}).join('')}</details>`).join('')}`,async()=>{
   if(pendingVideos)throw Error('Aguarde a confirmação de que os vídeos foram guardados.');
   await saves;for(let i=0;i<draft.items.length;i++){
     const item=draft.items[i];for(const part of item.parts){if(!item.videos?.[part]&&!service.items[i].replacementMedia?.[part]?.url)throw Error(`Guarde o vídeo de ${part} no equipamento ${i+1}.`)}
   }
   for(let i=0;i<draft.items.length;i++){
     const item=draft.items[i];await enqueue('technical',service.id,{itemIndex:i,notes:item.notes,parts:item.parts},draft.basis);
     for(const part of item.parts){const video=item.videos?.[part];if(video)await enqueue('media',service.id,{itemIndex:i,part,...video},draft.basis)}
   }
   await vault.remove(key);notify('Registros e vídeos guardados. Acompanhe o envio em Pendências.');return true;
 },'Salvar registros');
 const form=document.getElementById('editForm'),hint=form.querySelector('[data-draft-state]');let saves=Promise.resolve(),pendingVideos=0;
 const save=()=>{const copy=structuredClone(draft);hint.textContent='Salvando…';saves=saves.catch(()=>{}).then(()=>vault.put(key,copy)).then(()=>hint.textContent='Rascunho e referências de vídeos salvos neste aparelho').catch(e=>{hint.textContent=friendly(e);throw e});saves.catch(()=>{})};
 for(const section of form.querySelectorAll('[data-technical-item]')){
   const index=Number(section.dataset.technicalItem),item=draft.items[index] ||= {notes:'',parts:[],videos:{}};item.videos ||= {};
   const slots=()=>{
     const host=section.querySelector('[data-video-slots]');host.innerHTML=item.parts.map(part=>`<label>${esc(part)} · vídeo<input type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/3gpp2,video/x-m4v" data-video-part="${esc(part)}"><small data-video-state>${esc(item.videos[part]?.name || (service.items[index].replacementMedia?.[part]?.url?'Vídeo já registrado':'Selecione o vídeo'))}</small></label>`).join('');
     host.querySelectorAll('[data-video-part]').forEach(input=>input.onchange=async()=>{
       const file=input.files[0],part=input.dataset.videoPart,state=input.nextElementSibling;if(!file)return;
       const submit=form.querySelector('.modal-actions button:last-child');pendingVideos++;submit.disabled=true;state.textContent='Conferindo e guardando vídeo…';
       try{if(file.size>50*1024*1024)throw Error('O vídeo ultrapassa 50 MB.');const mime=file.type || (/\.mov$/i.test(file.name)?'video/quicktime':/\.webm$/i.test(file.name)?'video/webm':'video/mp4');if(!['video/mp4','video/quicktime','video/webm','video/3gpp','video/3gpp2','video/x-m4v'].includes(mime))throw Error('Formato de vídeo não aceito.');const durationSeconds=await duration(file);if(durationSeconds>60)throw Error('O vídeo ultrapassa 60 segundos.');const blobKey=`blob:${active}:${crypto.randomUUID()}`;await vault.blobPut(blobKey,file);const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');item.videos[part]={blobKey,name:file.name,mime,durationSeconds,sha256,size:file.size};save();await saves;state.textContent='Vídeo guardado no aparelho · '+file.name}catch(e){input.value='';state.textContent=friendly(e)}finally{pendingVideos--;submit.disabled=pendingVideos>0}
     });
   };
   section.querySelector('[data-notes]').oninput=e=>{item.notes=e.target.value;save()};
   section.querySelectorAll('[data-piece]').forEach(input=>input.onchange=()=>{item.parts=[...section.querySelectorAll('[data-piece]:checked')].map(x=>x.dataset.piece);slots();save()});slots();
 }
}
async function storeVideo(file){
 if(file.size>50*1024*1024)throw Error('O vídeo ultrapassa 50 MB.');
 const mime=file.type||(/\.mov$/i.test(file.name)?'video/quicktime':/\.webm$/i.test(file.name)?'video/webm':'video/mp4');
 if(!['video/mp4','video/quicktime','video/webm','video/3gpp','video/3gpp2','video/x-m4v'].includes(mime))throw Error('Formato de vídeo não aceito.');
 const durationSeconds=await duration(file);if(durationSeconds>60)throw Error('O vídeo ultrapassa 60 segundos.');
 const blobKey=`blob:${active}:${crypto.randomUUID()}`;await vault.blobPut(blobKey,file);
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join('');
 return{blobKey,name:file.name,mime,durationSeconds,sha256,size:file.size};
}
/* Conclusão da execução em passos: pintura → peças → pó → vídeos → conferir.
   Usa as mesmas operações de antes (painting, technical, media, powder, complete); o servidor continua validando tudo. */
async function completionWizard(service){
 assertAllowed();if(isPaused(service))throw Error('Retome o serviço antes de concluir a execução.');
 const total=(service.items||[]).length;if(!total)throw Error('Esta ordem não tem equipamentos.');
 const info=window.offlineServices?.powderStock||profile.powderStock||{},partStock=info.parts||null;
 const catalog=[...new Set([...PART_NAMES,...(profile.costCatalog||[]).filter(i=>i.active!==false&&i.technicalPart).map(i=>i.name)])];
 const capacity=powderCapacity(service);
 const agents=Object.entries(capacity).filter(([,g])=>g>0).map(([agent,g])=>{
  const before=Math.round(Number(service.powderUsage?.find(r=>r.agent===agent)?.grams||0)/1000),balance=info[agent]!=null?Number(info[agent]):null,max=Math.floor(g/1000);
  return{agent,before,balance,max:balance!=null?Math.max(0,Math.min(max,Math.floor(balance+before))):max,capacity:max};
 });
 const held={};for(const item of service.items)for(const part of item.replacedParts||[])held[part]=(held[part]||0)+1;
 const stockOf=part=>partStock&&Object.prototype.hasOwnProperty.call(partStock,part)?Number(partStock[part])+(held[part]||0):null;
 const maxFor=part=>{const stock=stockOf(part);return Math.max(0,stock==null?total:Math.min(total,Math.floor(stock)))};
 const key=`draft:${active}:wizard:${service.id}`,saved=await vault.get(key).catch(()=>null);
 const prevPaint=Number(service.paintingQuantity||0);
 const st=saved?.st||{step:0,
  paint:{use:service.paintingRecordedAt?prevPaint>0:null,qty:Math.max(1,Math.min(total,prevPaint||1))},
  parts:{use:Object.keys(held).length?true:null,rows:Object.entries(held).map(([part,qty])=>({part,qty}))},
  powder:{use:service.powderRecordedAt?agents.some(a=>a.before>0):null,kg:Object.fromEntries(agents.map(a=>[a.agent,a.before]))},
  videos:{}};
 st.videos||={};st.powder.kg||={};
 const persist=()=>{try{vault.put(key,{st:structuredClone(st)}).catch(()=>{})}catch{}};
 const cleanRows=()=>st.parts.use?st.parts.rows.filter(r=>r.part&&Number(r.qty)>0):[];
 const steps=()=>['painting','parts',...(agents.length?['powder']:[]),...(cleanRows().length?['videos']:[]),'review'];
 const names={painting:'Pintura',parts:'Peças',powder:'Pó',videos:'Vídeos',review:'Conferir'};
 const assign=()=>{const per=Array.from({length:total},()=>[]);for(const {part,qty} of cleanRows()){
  const have=service.items.map((it,i)=>(it.replacedParts||[]).includes(part)?i:-1).filter(i=>i>=0).slice(0,qty);
  const extra=service.items.map((_,i)=>i).filter(i=>!have.includes(i)).slice(0,qty-have.length);
  for(const i of [...have,...extra])per[i].push(part);}return per};
 const needVideos=()=>{const out=[];assign().forEach((parts,i)=>parts.forEach(part=>out.push({i,part,id:i+'|'+part,done:Boolean(st.videos[i+'|'+part]||service.items[i].replacementMedia?.[part]?.url),file:st.videos[i+'|'+part]?.name})));return out};
 const options=(from,to,cur,suffix=n=>'')=>Array.from({length:to-from+1},(_,k)=>from+k).map(n=>`<option value="${n}" ${n===cur?'selected':''}>${n}${suffix(n)}</option>`).join('');
 const choice=(name,val)=>`<div class="wiz-choice" role="radiogroup">${[[false,'Não'],[true,'Sim']].map(([v,l])=>`<button type="button" class="wiz-opt${val===v?' on':''}" role="radio" aria-checked="${val===v}" data-wiz-choice="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
 const unusedParts=exceptIndex=>catalog.filter(p=>!st.parts.rows.some((r,i)=>i!==exceptIndex&&r.part===p));
 const html={
  painting:()=>`<h3>Usou pintura neste serviço?</h3><p class="ops-note">Esta ordem tem ${total} extintor(es). Não é preciso dizer quais foram pintados.</p>${choice('paint',st.paint.use)}${st.paint.use?`<label class="form-field">Quantos extintores foram pintados?<select data-wiz-paint>${options(1,total,Number(st.paint.qty))}</select></label>`:''}`,
  parts:()=>{
   const rows=st.parts.rows.map((r,i)=>{const stock=stockOf(r.part),max=Math.max(1,maxFor(r.part));
    return `<div class="wiz-row"><select data-wiz-part="${i}" aria-label="Peça">${unusedParts(i).map(p=>{const s=stockOf(p),out=s!=null&&s<1&&p!==r.part;return `<option value="${esc(p)}" ${p===r.part?'selected':''} ${out?'disabled':''}>${esc(p)}${s!=null?` · estoque ${s}`:''}${out?' (sem estoque)':''}</option>`}).join('')}</select><select data-wiz-qty="${i}" aria-label="Quantidade">${options(1,max,Math.min(Number(r.qty)||1,max))}</select><button type="button" data-wiz-remove="${i}" aria-label="Remover peça">✕</button></div>`}).join('');
   const canAdd=unusedParts(-1).some(p=>{const s=stockOf(p);return s==null||s>=1});
   return `<h3>Trocou alguma peça?</h3><p class="ops-note">Cada peça aparece uma vez. A quantidade vai até o número de extintores da ordem (${total}) e até o que há em estoque.</p>${choice('parts',st.parts.use)}${st.parts.use?`${rows}<button type="button" class="btn btn-soft btn-small" data-wiz-add ${canAdd?'':'disabled'}>＋ Adicionar outra peça</button>`:''}`},
  powder:()=>`<h3>Usou pó químico?</h3><p class="ops-note">Informe o total em kg, sem separar por extintor. O limite é o que há em estoque e a capacidade dos extintores da ordem.</p>${choice('powder',st.powder.use)}${st.powder.use?agents.map(a=>`<label class="form-field">${agents.length>1?`Pó ${a.agent}: quantos kg?`:'Quantos kg de pó?'}<select data-wiz-kg="${a.agent}">${options(0,a.max,Math.min(Number(st.powder.kg[a.agent])||0,a.max),n=>' kg')}</select><small class="ops-note">Máximo: ${a.max} kg${a.balance!=null?` · estoque ${Number(a.balance+a.before).toLocaleString('pt-BR')} kg`:' · estoque conferido ao enviar'}</small></label>`).join(''):''}`,
  videos:()=>`<h3>Vídeos das peças trocadas</h3><p class="ops-note">Cada peça trocada precisa do seu vídeo, com até 60 segundos e 50 MB.</p>${needVideos().map(v=>`<label class="form-field wiz-video"><b>${esc(v.part)} · equipamento ${v.i+1}</b><input type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/3gpp2,video/x-m4v" data-wiz-video="${esc(v.id)}"><small class="ops-note" data-wiz-vstate>${v.file?'Vídeo guardado neste aparelho · '+esc(v.file):v.done?'Vídeo já registrado':'Selecione o vídeo'}</small></label>`).join('')}`,
  review:()=>{const rows=cleanRows(),p=agents.map(a=>(st.powder.use?Number(st.powder.kg[a.agent])||0:0));return `<h3>Conferir e concluir</h3><dl class="wiz-summary"><div><dt>Pintura</dt><dd>${st.paint.use?st.paint.qty+' extintor(es)':'Não usou'}</dd></div><div><dt>Peças</dt><dd>${rows.length?rows.map(r=>esc(r.part)+' × '+r.qty).join('<br>'):'Não trocou'}</dd></div>${agents.length?`<div><dt>Pó</dt><dd>${p.some(Boolean)?agents.map((a,i)=>p[i]?(agents.length>1?'Pó '+a.agent+': ':'')+p[i]+' kg':'').filter(Boolean).join(' · '):'Não usou'}</dd></div>`:''}</dl><p class="ops-note">Ao concluir, a ordem segue para revisão administrativa.</p>`}
 };
 const validate=step=>{
  if(step==='painting'){if(st.paint.use==null)return 'Escolha Sim ou Não.';if(st.paint.use&&!(Number.isInteger(Number(st.paint.qty))&&st.paint.qty>=1&&st.paint.qty<=total))return `Informe de 1 a ${total} extintores.`}
  if(step==='parts'){if(st.parts.use==null)return 'Escolha Sim ou Não.';if(st.parts.use){const rows=st.parts.rows;if(!rows.length)return 'Adicione pelo menos uma peça ou escolha Não.';const seen=new Set();for(const r of rows){if(!r.part)return 'Escolha a peça em todas as linhas.';if(seen.has(r.part))return `A peça ${r.part} foi adicionada duas vezes.`;seen.add(r.part);const max=maxFor(r.part);if(max<1)return `${r.part} está sem estoque.`;if(!(Number.isInteger(Number(r.qty))&&r.qty>=1&&r.qty<=max))return `${r.part}: informe de 1 a ${max}.`}}}
  if(step==='powder'){if(st.powder.use==null)return 'Escolha Sim ou Não.';if(st.powder.use){let any=false;for(const a of agents){const n=Number(st.powder.kg[a.agent])||0;if(!Number.isInteger(n)||n<0||n>a.max)return `Informe de 0 a ${a.max} kg.`;if(n>0)any=true}if(!any)return 'Informe quantos kg ou escolha Não.'}}
  if(step==='videos'){const miss=needVideos().filter(v=>!v.done);if(miss.length)return 'Falta o vídeo de: '+miss.map(v=>`${v.part} (equipamento ${v.i+1})`).join(', ')+'.'}
  return '';
 };
 let form,pending=0,error='',dir='fwd',shown=-1;
 const draw=()=>{
  const list=steps(),cur=Math.min(st.step,list.length-1);st.step=cur;const step=list[cur],last=step==='review';
  const anim=cur!==shown;shown=cur;
 form.querySelector('[data-wiz]').innerHTML=`<ol class="wiz-steps" aria-label="Etapas">${list.map((k,i)=>`<li class="${i<cur?'done':i===cur?'cur':''}" ${i===cur?'aria-current="step"':''}><span>${i<cur?'✓':i+1}</span>${names[k]}</li>`).join('')}</ol><div class="wiz-step${anim?' wiz-anim':''}${anim&&dir==='back'?' is-back':''}">${html[step]()}</div>${error?`<p class="wiz-error" role="alert">${esc(error)}</p>`:''}`;
  const actions=form.querySelector('.modal-actions');let back=actions.querySelector('[data-wiz-back]');
  if(!back){back=document.createElement('button');back.type='button';back.className='btn btn-soft btn-small';back.dataset.wizBack='1';back.textContent='Voltar';actions.insertBefore(back,actions.lastElementChild)}
  back.hidden=cur===0;const primary=actions.lastElementChild;primary.textContent=last?'Concluir execução':'Avançar';primary.disabled=pending>0;
 };
 const redraw=()=>{error='';persist();draw()};
 await serviceModal(service.id,'Concluir execução · '+(service.code||'ordem'),'<div data-wiz></div>',async()=>{
  const list=steps(),step=list[st.step];error=validate(step);
  if(error){setTimeout(draw,0);return false}
  if(step!=='review'){dir='fwd';st.step++;persist();setTimeout(draw,0);return false}
  const per=assign(),usePaint=Boolean(st.paint.use);
  await enqueue('painting',service.id,{quantity:usePaint?Number(st.paint.qty):0});
  for(let i=0;i<total;i++){const item=service.items[i],before=[...(item.replacedParts||[])].sort().join('|'),after=[...(st.parts.use?per[i]:[])].sort().join('|');if(before!==after)await enqueue('technical',service.id,{itemIndex:i,notes:item.notes||'',parts:st.parts.use?per[i]:[]})}
  for(const v of needVideos()){const video=st.videos[v.id];if(video&&st.parts.use)await enqueue('media',service.id,{itemIndex:v.i,part:v.part,...video})}
  if(agents.length)await enqueue('powder',service.id,{usage:agents.map(a=>({agent:a.agent,grams:(st.powder.use?Number(st.powder.kg[a.agent])||0:0)*1000}))});
  await enqueue('complete',service.id,{});
  try{await vault.remove(key)}catch{}
  notify('Conclusão salva para envio e revisão.');return true;
 },'Avançar');
 form=document.getElementById('editForm');form.querySelector('.modal')?.classList.add('wiz-modal');form.classList.add('wiz-modal');
 if(st.step>=steps().length)st.step=0;
 draw();
 form.addEventListener('click',event=>{
  const t=event.target.closest('button');if(!t||!form.contains(t))return;
  if(t.dataset.wizBack){dir='back';st.step=Math.max(0,st.step-1);redraw();return}
  if(t.dataset.wizChoice){const use=t.dataset.v==='true',k=t.dataset.wizChoice;
   if(k==='paint')st.paint.use=use;
   if(k==='parts'){st.parts.use=use;if(use&&!st.parts.rows.length){const first=catalog.find(p=>{const s=stockOf(p);return s==null||s>=1});if(first)st.parts.rows.push({part:first,qty:1})}}
   if(k==='powder')st.powder.use=use;
   redraw();return}
  if('wizAdd' in t.dataset){const next=unusedParts(-1).find(p=>{const s=stockOf(p);return s==null||s>=1});if(next){st.parts.rows.push({part:next,qty:1});redraw()}return}
  if(t.dataset.wizRemove!=null){st.parts.rows.splice(Number(t.dataset.wizRemove),1);redraw()}
 });
 form.addEventListener('change',async event=>{
  const t=event.target;
  if(t.matches('[data-wiz-paint]')){st.paint.qty=Number(t.value);redraw()}
  else if(t.matches('[data-wiz-part]')){const row=st.parts.rows[Number(t.dataset.wizPart)];row.part=t.value;row.qty=Math.min(Number(row.qty)||1,Math.max(1,maxFor(row.part)));redraw()}
  else if(t.matches('[data-wiz-qty]')){st.parts.rows[Number(t.dataset.wizQty)].qty=Number(t.value);redraw()}
  else if(t.matches('[data-wiz-kg]')){st.powder.kg[t.dataset.wizKg]=Number(t.value);redraw()}
  else if(t.matches('[data-wiz-video]')){
   const file=t.files[0],id=t.dataset.wizVideo,state=t.nextElementSibling;if(!file)return;
   const primary=form.querySelector('.modal-actions').lastElementChild;pending++;primary.disabled=true;state.textContent='Conferindo e guardando vídeo…';
   try{st.videos[id]=await storeVideo(file);persist();state.textContent='Vídeo guardado neste aparelho · '+file.name}
   catch(e){t.value='';state.textContent=friendly(e)}
   finally{pending--;primary.disabled=pending>0}
  }
 });
}
async function serviceModal(serviceId,title,body,onSave,label='Salvar'){
 const key=`draft:${active}:form:${serviceId}:${title.replace(/[^a-zA-Z0-9]/g,'').slice(0,60)}`,draft=await vault.get(key)||{values:{},basis:basisFor(serviceId)};let saves=Promise.resolve();
 draft.title=title;draft.serviceId=serviceId;
 openModal(title,body+'<p class="offline-save-state" data-form-draft>Rascunho salvo automaticamente neste aparelho</p>',async form=>{await saves;submissionBasis=draft.basis;try{const result=await onSave(form);if(result!==false)await vault.remove(key);return result}finally{submissionBasis=null}},label);
 const form=document.getElementById('editForm'),hint=form.querySelector('[data-form-draft]');
 for(const [name,value] of Object.entries(draft.values)){const input=form.elements[name];if(input&&input.type!=='file'&&input.type!=='password'){if(input.type==='checkbox')input.checked=Boolean(value);else input.value=value}}
 const save=()=>{draft.values={};for(const input of form.elements)if(input.name&&!['file','password','submit','button'].includes(input.type))draft.values[input.name]=input.type==='checkbox'?input.checked:input.value;const copy=structuredClone(draft);hint.textContent='Salvando rascunho…';saves=saves.catch(()=>{}).then(()=>vault.put(key,copy)).then(()=>hint.textContent='Rascunho salvo neste aparelho').catch(e=>{hint.textContent=friendly(e);throw e});saves.catch(()=>{})};form.addEventListener('input',save);form.addEventListener('change',save);
}
function duration(file){return new Promise((resolve,reject)=>{const video=document.createElement('video'),url=URL.createObjectURL(file);let settled=false,seeking=false;const timer=setTimeout(()=>done(Error('Não foi possível conferir a duração do vídeo.')),15000);const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);video.onloadedmetadata=video.onseeked=video.ondurationchange=video.onerror=null;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);error?reject(error):resolve(value)};const check=()=>{if(Number.isFinite(video.duration)&&video.duration>0){done(null,video.duration);return}if(!seeking){seeking=true;video.currentTime=1e100}};video.preload='metadata';video.onloadedmetadata=check;video.ondurationchange=()=>{if(Number.isFinite(video.duration)&&video.duration>0)done(null,video.duration)};video.onseeked=()=>{const seconds=Number.isFinite(video.duration)?video.duration:video.currentTime;done(!Number.isFinite(seconds)||seconds<=0?Error('Duração de vídeo inválida.'):null,seconds)};video.onerror=()=>done(Error('Este aparelho não conseguiu ler o vídeo.'));video.src=url})}

let shellPreparing=null,shellReady=false,shellError='';
const shellVersion='protec-navy-61';
async function prepareShell(account=''){
 if(shellPreparing)return shellPreparing;
 if(shellReady&&(await vault.get('shell:'+account))?.version===shellVersion)return;
 shellPreparing=(async()=>{
  // Preparation stays automatic without prompting for persistent-storage permission.
  if(!vault.native()){
   if(!('serviceWorker' in navigator))throw Error('Este navegador não oferece telas offline. Use o APK atualizado.');
   const reg=await navigator.serviceWorker.register(new URL('./sw.js',import.meta.url));await navigator.serviceWorker.ready;
   await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('A preparação automática será retomada ao conectar.'));},45000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();e.data.ok?resolve():reject(Error(e.data.error||'Preparação pendente.'));};(reg.active||navigator.serviceWorker.controller).postMessage({type:'PREPARE_OFFLINE'},[channel.port2]);});
  }
  shellReady=true;shellError='';await vault.put('shell:'+account,{at:new Date().toISOString(),version:shellVersion});
 })().catch(e=>{shellError=e.message;throw e;}).finally(()=>{shellPreparing=null;adminRender();});return shellPreparing;
}

// Administrator outbox. A successful response means the encrypted write has
// committed locally; only a server receipt means another device can see it.
const adminAccount='admin:1',adminPrefix='op:admin:1:';
let adminProfile=null,adminAuth='',adminBase=null,adminView=null,adminOps=[],adminResults={},adminBusy=false,adminSerial=Promise.resolve(),adminNeedsLogin=false,adminLastSync='',adminRefreshBusy=false;
const adminReady=()=>Boolean(adminProfile&&adminBase&&adminView&&adminAuth&&adminAuth===localStorage.getItem(tokenKey)&&localStorage.getItem(roleKey)==='admin'&&!locked);
const adminPending=()=>adminOps.filter(o=>!adminResults[o.id]?.ok&&!adminResults[o.id]?.discarded);
function adminProject(baseState){
 let next=structuredClone(baseState);
 for(const op of adminPending())try{if((op.dataEpoch||'initial')!==(baseState.__dataEpoch||'initial')||adminResults[op.id]?.conflict&&op.payload?.action==='powder-history-clear')continue;applyAdminChanges(next,op.preview||op.changes,{force:true,canonical:true});}catch{/* The operation stays in the review queue, never silently discarded. */}
 return next;
}
async function adminHydrate(){
 const hydrateCache=async()=>{
 const persisted=await vault.get('admin-profile');
 if(Number(persisted?.state?.__rev||0)>Number(adminBase?.__rev||0))adminBase=structuredClone(persisted.state);
 adminOps=(await Promise.all((await vault.keys(adminPrefix)).map(k=>vault.get(k)))).filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 adminResults={};for(const op of adminOps){const r=await vault.get('result:'+adminAccount+':'+op.id);if(r)adminResults[op.id]=r;}
 for(const op of adminOps){const r=adminResults[op.id];if((op.dataEpoch||'initial')!==(adminBase.__dataEpoch||'initial'))continue;if(r?.ok&&Number(r.revision)>Number(adminBase?.__rev||0)){applyAdminChanges(adminBase,r.delta,{force:true,canonical:true});adminLastSync=r.serverAt;}}
 const syncState=await vault.get('sync-state:'+adminAccount);if(syncState?.needsLogin)adminNeedsLogin=true;
 if(syncState?.apiUpdateRequired){adminApiUnavailable=true;renderAvailability();}
 adminLastSync=(await vault.get('last-sync:'+adminAccount))?.at||adminLastSync;
 if(adminProfile){adminProfile.state=adminBase;if(JSON.stringify(persisted)!==JSON.stringify(adminProfile))await vault.put('admin-profile',adminProfile);}
 if(!adminBusy&&!syncState?.syncing){
  const included=adminOps.filter(op=>adminResults[op.id]?.ok&&Number(adminResults[op.id].revision)<=Number(adminBase?.__rev||0));
  for(const op of included){await vault.remove(adminPrefix+op.id);await vault.remove('result:'+adminAccount+':'+op.id);delete adminResults[op.id];}
  adminOps=adminOps.filter(op=>!included.some(saved=>saved.id===op.id));
 }
 adminRender();
 };
 if(navigator.locks)return navigator.locks.request('protec-admin-cache',hydrateCache);
 return hydrateCache();
}
async function adminAccept(state,username,token){
 if(!token||token!==localStorage.getItem(tokenKey)||localStorage.getItem(roleKey)!=='admin')throw Error('A conta mudou durante a preparação offline.');
 if(!state?.settings||typeof state.settings!=='object'||!Array.isArray(state.services)||!Array.isArray(state.products))throw Error('A API não retornou os dados completos do painel.');
 const verified=await verifyAdminOfflineBackend(token);
 if(!verified)throw Error('A API precisa ser atualizada para liberar o modo offline. O cadastro online continua disponível.');
 if(Number(verified.__rev||0)>Number(state.__rev||0))state=verified;
 const old=await vault.get('admin-profile');
 adminProfile={state:structuredClone(state),username:username||old?.username||'admin',preparedAt:new Date().toISOString()};
 adminBase=structuredClone(state);adminNeedsLogin=false;
 await vault.batch([{key:'admin-profile',value:adminProfile},{key:'auth:'+adminAccount,value:{token,accountKey:adminAccount}},{key:'sync-state:'+adminAccount,value:{needsLogin:false}}]);
 if(token!==localStorage.getItem(tokenKey)||localStorage.getItem(roleKey)!=='admin')throw Error('A conta mudou durante a preparação offline.');
 adminAuth=token;await adminHydrate();adminView=adminProject(adminBase);
 prepareShell(adminAccount).catch(()=>{});adminSchedule();
 return structuredClone(adminView);
}
async function verifyAdminOfflineBackend(token){
 if(adminCapabilityToken===token&&Date.now()-adminCapabilityAt<30000)return adminCapabilityState;
 if(adminCapabilityCheck){await adminCapabilityCheck.catch(()=>{});if(adminCapabilityToken===token&&Date.now()-adminCapabilityAt<30000)return adminCapabilityState;}
 adminCapabilityCheck=(async()=>{
  const r=await network('/api/offline/admin/bootstrap',{headers:{Authorization:'Bearer '+token}}),data=await r.json();
  if(token!==localStorage.getItem(tokenKey)||localStorage.getItem(roleKey)!=='admin')throw Error('A conta mudou durante a atualização.');
  if([404,405].includes(r.status)){adminCapabilityToken=token;adminCapabilityAt=Date.now();adminCapabilityState=null;adminApiUnavailable=true;renderAvailability();return null;}
  if(!r.ok)throw Object.assign(Error(data.error||'Não foi possível conferir o modo offline.'),{status:r.status});
  if(!data.state?.settings||!Array.isArray(data.state.services)||!Array.isArray(data.state.products))throw Error('A resposta de sincronização está incompleta.');
  adminCapabilityToken=token;adminCapabilityAt=Date.now();adminCapabilityState=data.state;adminApiUnavailable=false;renderAvailability();return data.state;
 })().finally(()=>adminCapabilityCheck=null);return adminCapabilityCheck;
}
async function initializeAdminOffline(){
 if(localStorage.getItem(roleKey)!=='admin'||!localStorage.getItem(tokenKey))return;
 const saved=await vault.get('admin-profile'),auth=await vault.get('auth:'+adminAccount);
 if(!saved?.state||auth?.token!==localStorage.getItem(tokenKey)){
  const verified=window.protecVerifiedAdminState;
  if(verified?.token===localStorage.getItem(tokenKey))try{await adminAccept(verified.state,verified.username,verified.token);}catch{/* A cache failure must not prevent online access. */}
  return;
 }
 adminProfile=saved;adminBase=structuredClone(saved.state);adminAuth=auth.token;await adminHydrate();adminView=adminProject(adminBase);
 if(!locked){db=structuredClone(adminView);window.showDashboard();adminRender();adminSchedule();}
 const shell=await vault.get('shell:'+adminAccount);shellReady=vault.native()||shell?.version===shellVersion;if(navigator.onLine)prepareShell(adminAccount).catch(()=>{});
}
function adminShow(){if(!adminReady())return;db=structuredClone(adminView||adminProject(adminBase));window.showDashboard();adminRender();}
function adminRender(){
 const dashboard=document.getElementById('dashboard');if(!adminReady()||!dashboard||dashboard.classList.contains('hidden')){document.getElementById('adminOfflineToolbar')?.remove();return;}
 const host=document.getElementById('content');if(!host)return;
 let bar=document.getElementById('adminOfflineToolbar');if(!bar){bar=document.createElement('div');bar.id='adminOfflineToolbar';bar.className='sync-control';dashboard.querySelector('.admin-top-right')?.prepend(bar);}
 const pending=adminPending(),conflicts=pending.filter(o=>adminResults[o.id]?.conflict),state=conflicts.length||adminNeedsLogin?'attention':adminBusy?'sending':pending.length?'pending':!navigator.onLine?'offline':'synced';
 const caption=conflicts.length?pending.length+' pendentes · '+conflicts.length+' para revisar':adminNeedsLogin?'Entrar para sincronizar':adminBusy?'Sincronizando':pending.length?pending.length+' pendente(s)':!navigator.onLine?'Offline · salvo no aparelho':'Tudo sincronizado';
 const signature=JSON.stringify([state,caption]);if(bar.dataset.state===signature)return;bar.dataset.state=signature;bar.dataset.syncState=state;
 bar.innerHTML=`<button type="button" class="sync-indicator" data-pending="${pending.length||''}${conflicts.length?' · '+conflicts.length+'!':adminNeedsLogin?'!':''}" data-admin-queue aria-label="Sincronização: ${esc(caption)}. Abrir detalhes"><span class="sync-dot" aria-hidden="true"></span><span>${esc(caption)}</span></button>`;
 bar.querySelector('[data-admin-queue]').onclick=()=>openSyncDetails(true);
}
function openSyncDetails(admin=false){
 const pending=admin?adminPending():ops.filter(o=>!results[o.id]?.ok&&!results[o.id]?.discarded),issues=pending.filter(o=>(admin?adminResults:results)[o.id]?.conflict),last=admin?adminLastSync:lastSyncAt,login=admin?adminNeedsLogin:needsLogin;
 window.openModal('Sincronização automática',`<p>As alterações são guardadas neste aparelho e enviadas automaticamente assim que houver conexão. Não é necessário autorizar o envio.</p><dl class="sync-facts"><div><dt>Conexão</dt><dd>${navigator.onLine?'Disponível':'Offline'}</dd></div><div><dt>Pendentes</dt><dd>${pending.length}</dd></div><div><dt>Precisam de revisão</dt><dd>${issues.length}</dd></div><div><dt>Última confirmação</dt><dd>${last?esc(new Date(last).toLocaleString('pt-BR')):'Nenhum envio neste aparelho'}</dd></div></dl>${login?'<p>Seu trabalho local está disponível. Entre novamente para retomar os envios.</p>':''}<p class="ops-note">${shellReady?'Telas guardadas para uso offline.':'As telas são preparadas automaticamente enquanto houver conexão.'} O acesso local continua até sair da conta.</p><div class="ops-detail-actions"><button type="button" class="btn btn-soft" data-sync-pending>Ver registros pendentes</button><button type="button" class="btn btn-soft" data-sync-now>Verificar agora</button>${login?'<button type="button" class="btn" data-sync-login>Entrar novamente</button>':''}</div>`,()=>{},'Fechar');
 const form=document.getElementById('editForm');form.querySelector('[data-sync-pending]').onclick=()=>admin?adminQueue():openQueue();form.querySelector('[data-sync-now]').onclick=()=>{if(admin){adminRetry=0;adminSchedule();}else{teamRetry=0;scheduleSync();}notify('Verificação automática retomada.');};form.querySelector('[data-sync-login]')?.addEventListener('click',()=>action('login'));
}
function adminQueue(){
 const pending=adminPending();
 const rows=pending.map(op=>{const r=adminResults[op.id];return `<article class="service-detail-item"><strong>${esc(op.label||'Alteração administrativa')}</strong><p>${esc(new Date(op.createdAt).toLocaleString('pt-BR'))}</p><p>${r?.conflict?esc(r.error)+(r.field?' · '+esc(r.field):''):'Salvo neste aparelho · aguardando confirmação'}</p>${r?.conflict?`<button type="button" class="btn btn-small btn-soft" data-admin-review="${esc(op.id)}">Revisar alteração</button>`:''}</article>`;}).join('');
 window.openModal('Envios deste aparelho',rows||'<p>Nenhum envio pendente.</p>',()=>{});
 document.querySelectorAll('[data-admin-review]').forEach(b=>b.onclick=()=>adminReview(b.dataset.adminReview));
}
async function adminReview(id){
 const op=adminOps.find(o=>o.id===id);if(!op)return;
 if(!navigator.onLine)return notify('Conecte-se para conferir a versão atual antes de resolver o conflito. Seus registros continuam salvos.');
 try{
  const r=await network('/api/offline/admin/bootstrap'),data=await r.json();if(!r.ok)throw Error(data.error);
  const serverValue=path=>{let value=data.state;if(path[0]!=='settings'&&Array.isArray(value[path[0]])){value=value[path[0]].find(x=>x.id===path[1]);path=path.slice(2);}for(const key of path)value=value?.[key];return value;};
  const fields=(op.changes||op.preview||[]).map(c=>`<li>${esc(c.path.join(' / '))}<br>Servidor: ${esc(JSON.stringify(serverValue(c.path))?.slice(0,600)||'removido')}<br>Seu registro: ${esc(JSON.stringify(c.after?.value??c.append??'removido').slice(0,600))}</li>`).join('');
  window.openModal('Revisar envio pendente',`<p>${esc(adminResults[id]?.error||'O dado mudou em outro aparelho.')}</p><ul>${fields}</ul><p>Confira a versão atual e decida. A versão guardada neste aparelho será preservada no arquivo de revisão.</p><label>Decisão<select name="decision" required><option value="">Selecione</option><option value="server">Manter os dados atuais do servidor</option>${op.kind==='admin-state'?'<option value="local">Reaplicar meus campos na versão atual</option>':''}</select></label><label><input type="checkbox" name="checked" required> Revisei os campos e confirmo a decisão.</label>`,async form=>{
   if(!form.get('checked')||!form.get('decision'))return false;
   const fresh=await network('/api/offline/admin/bootstrap'),latest=await fresh.json();if(!fresh.ok)throw Error(latest.error);
   await vault.put('review:'+adminAccount+':'+id,{op,result:adminResults[id],decision:form.get('decision'),at:new Date().toISOString()});
   if(form.get('decision')==='local'){
    const target=structuredClone(latest.state);applyAdminChanges(target,op.changes,{force:true});
    const replacement={...op,id:crypto.randomUUID(),createdAt:new Date().toISOString(),changes:adminChanges(latest.state,target)};replacement.preview=replacement.changes;
    await vault.batch([{key:adminPrefix+replacement.id,value:replacement},{key:'result:'+adminAccount+':'+id,value:{discarded:true}}]);
   }else await vault.put('result:'+adminAccount+':'+id,{discarded:true});
   adminBase=latest.state;adminProfile.state=adminBase;await adminHydrate();adminView=adminProject(adminBase);db=structuredClone(adminView);window.saveLocal();window.closeModal();window.renderPage();adminRender();adminSchedule();return false;
  });
 }catch(error){notify(error.message);}
}
const adminRun=fn=>{const task=adminSerial.then(fn);adminSerial=task.catch(()=>{});return task;};
function adminGuards(state,kind,payload){
 if(kind==='admin-state')return [];
 const guards=[],add=group=>guards.push({group,value:structuredClone(state[group]??null)});
 if(payload.serviceId)guards.push({group:'services',id:payload.serviceId,value:structuredClone(state.services.find(s=>s.id===payload.serviceId)??null)});
 if(kind==='admin-finalize'||['capture','team-config','team-rate','policy'].includes(payload.action)){
  const keys=['partPrices','employeeBillingPolicy','sellerBillingPolicy','teamPricing'];guards.push({group:'settings',keys,value:Object.fromEntries(keys.map(k=>[k,state.settings?.[k]??null]))});
  for(const group of ['types','costCatalog','employees','sellers','teamBills'])add(group);
 }
 if(['save-catalog','remove-catalog','service-items'].includes(payload.action))add('costCatalog');
 return guards;
}
async function adminEnqueue(kind,payload,desired=null){return adminRun(async()=>{
 if(!adminReady())throw Error('Entre com internet neste aparelho para disponibilizar o painel offline.');
 const token=adminAuth,shown=structuredClone(adminView);await adminHydrate();
 const op={dataEpoch:shown.__dataEpoch||'initial',id:crypto.randomUUID(),deviceId:await deviceId(),accountKey:adminAccount,serviceId:'admin-state',kind,createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString(),payload:structuredClone(payload||{}),guards:adminGuards(shown,kind,payload||{})};
 let next=structuredClone(shown);
 if(kind==='admin-state'){
  if(desired.services?.some(s=>s.closed&&!shown.services.some(old=>old.id===s.id&&old.closed)))throw Error('Use Finalizar serviço para fechar a ordem.');
  // Legacy display helpers add default fields to items. Apply the same immutable
  // history normalization as the server before deriving an unrelated edit.
  preserveAndCapture(desired,shown,op.createdAt);
  op.changes=adminChanges(shown,desired);applyAdminChanges(next,op.changes);op.label='Cadastros e configurações';
 }
 else{
  let options={};if(kind==='admin-operation'){
    if(payload.action==='save-catalog'&&!payload.id)op.payload.id=crypto.randomUUID();
    options=applyAdminOperation(next,op.payload,adminProfile.username,op.createdAt);op.label='Configuração: '+payload.action;
  }else if(kind==='admin-finalize'){finalizeAdminOrder(next,payload.serviceId,adminProfile.username,op.createdAt);op.label='Finalizar ordem de serviço';}
  else if(kind==='admin-update'){updateAdminOrder(next,payload,adminProfile.username,op.createdAt);op.label='Revisar cadastro da ordem';}
  preserveAndCapture(next,shown,op.createdAt,options);
 }
 op.preview=adminChanges(shown,next,true);
 if(!op.preview.length)return structuredClone(adminView);
 if(localStorage.getItem(tokenKey)!==token||!adminReady())throw Error('A conta mudou antes de salvar.');
 await vault.put(adminPrefix+op.id,op);
 await adminHydrate();adminView=adminProject(adminBase);adminRender();adminSchedule();return structuredClone(adminView);
});}
let adminRetryTimer,adminRetry=0;
function adminSchedule(retry=false){
 clearTimeout(adminRetryTimer);if(!adminReady()||adminNeedsLogin)return;
 if(vault.native()){nativeCall('sync',{accountKey:adminAccount}).catch(()=>{});return;}
 if(navigator.onLine)adminRetryTimer=setTimeout(()=>adminSync().catch(()=>{}),retry?Math.min(60000,3000*2**Math.min(adminRetry++,5)):150);
}

async function adminRefresh(){
 if(!adminReady()||!navigator.onLine||adminRefreshBusy)return;
 adminRefreshBusy=true;const token=adminAuth;
 try{
  const r=await network('/api/offline/admin/bootstrap'),data=await r.json();if(token!==adminAuth||!adminReady())return;
  if([401,403].includes(r.status)){adminNeedsLogin=true;return;}if(r.status===404){adminApiUnavailable=true;renderAvailability();return;}if(!r.ok)throw Error(data.error);
  adminApiUnavailable=false;renderAvailability();
  await adminRun(async()=>{
   if(Number(data.state.__rev||0)<Number(adminBase?.__rev||0))return;
    adminBase=data.state;adminProfile.state=adminBase;adminProfile.preparedAt=data.preparedAt;await adminHydrate();
   // Do not replace the state behind an open form. The next save diffs the form's
   // original view and overlays only its actual edits onto the new snapshot.
   const editing=document.querySelector('.modal:not(.hidden),dialog[open]')||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
   if(!editing){
    const projected=adminProject(adminBase),changed=adminChanges(adminView,projected,true).some(c=>!['__rev','__ts'].includes(c.path[0]));
    adminView=projected;db=structuredClone(adminView);window.saveLocal();
    if(changed){const content=document.getElementById('content'),opened=[...content.querySelectorAll('details')].map(d=>d.open),scroll=window.scrollY;window.renderPage?.();requestAnimationFrame(()=>{content.querySelectorAll('details').forEach((d,i)=>{if(opened[i])d.open=true;});window.scrollTo(0,scroll);});}
   }
  });
 }catch{/* Local work remains available during outages. */}finally{adminRefreshBusy=false;adminRender();}
}
let adminSyncPromise=null;
function adminSync(){
 if(adminSyncPromise)return adminSyncPromise;
 adminSyncPromise=performAdminSync().finally(()=>adminSyncPromise=null);return adminSyncPromise;
}
async function performAdminSync(){
 if(!adminReady()||adminBusy||!navigator.onLine||adminNeedsLogin)return;
 if(adminApiUnavailable&&!await verifyAdminOfflineBackend(adminAuth))return;
 if(vault.native()){adminSchedule();return;}
 const work=async()=>{
  adminBusy=true;adminRender();const token=adminAuth;
  try{
   await adminRun(()=>adminHydrate());
   for(const op of adminPending()){
    if(!adminReady()||adminAuth!==token)break;
    if(adminResults[op.id]?.conflict)continue;
    const r=await network('/api/offline/admin/sync',{method:'POST',body:JSON.stringify(op),headers:{Authorization:'Bearer '+token}}),data=await r.json();
    if(adminAuth!==token||!adminReady())break;
    if([401,403].includes(r.status)&&!data.conflict){adminNeedsLogin=true;break;}
    if(r.status===404&&!data.conflict){adminApiUnavailable=true;adminCapabilityToken=token;adminCapabilityAt=Date.now();adminCapabilityState=null;renderAvailability();break;}
    if(!r.ok){if(data.conflict||[400,404].includes(r.status))await vault.put('result:'+adminAccount+':'+op.id,{...data,conflict:true});break;}
    await vault.batch([{key:'result:'+adminAccount+':'+op.id,value:data},{key:'last-sync:'+adminAccount,value:{at:data.serverAt}}]);
    await adminRun(()=>adminHydrate());
   }
  }catch{/* Retry automatically; the immutable operation remains in the vault. */}finally{adminBusy=false;adminRender();if(adminPending().some(o=>!adminResults[o.id]?.conflict))adminSchedule(true);else adminRetry=0;}
  await adminRefresh();
 };
 if(navigator.locks)await navigator.locks.request('protec-sync:'+adminAccount,{ifAvailable:true},lock=>lock?work():undefined);else await work();
}
const staffApi=window.apiCall;
window.apiCall=async function(path,method='GET',data=null){
 const admin=localStorage.getItem(roleKey)==='admin';
 const account=admin&&adminReady()?adminAccount:allowed()?active:null;
 const video=account&&method==='GET'&&path.startsWith('/media/service-media/'),cachedRead=account&&method==='GET'&&path==='/api/team/billing';
 if(video){
  const key='media:'+account+':'+path;
  const storedVideo=async()=>{const metadata=await vault.get(key+':metadata');return new Response(await vault.blobGet(key,metadata?.mime||'video/mp4'));};
  if(!navigator.onLine){try{return await storedVideo();}catch{return new Response(JSON.stringify({error:'Este vídeo ainda não foi carregado neste aparelho. Conecte-se uma vez para guardá-lo.'}),{status:503});}}
  try{const r=await staffApi(path,method,data);if(r.ok)try{const blob=await r.clone().blob();await vault.blobPut(key,blob);await vault.put(key+':metadata',{mime:blob.type});}catch{notify('Vídeo aberto. Não houve espaço para guardar uma cópia offline.');}return r;}catch(error){try{return await storedVideo();}catch{throw error;}}
 }
 if(cachedRead&&!navigator.onLine){const cached=await vault.get('read:'+account+':'+path);if(cached)return reply({...cached.data,offlineSnapshot:true,checkedAt:cached.at});return new Response(JSON.stringify({error:'Conecte-se uma vez para carregar o saldo. Suas ordens continuam disponíveis offline.'}),{status:503,headers:{'Content-Type':'application/json'}});}
 if(path==='/api/session'&&method==='GET'&&adminReady()){
   adminSchedule();if(navigator.onLine)adminRefresh().catch(()=>{});
   return reply({role:'admin',username:adminProfile.username,state:{...structuredClone(adminView),__offlineLocal:true}});
 }
 if(admin&&adminReady()){
  try{
   if(path==='/api/admin/state'&&method==='GET')return reply(structuredClone(adminView));
   if(path==='/api/admin/state'&&method==='PUT')return reply({ok:true,local:true,state:await adminEnqueue('admin-state',{},data)});
   if(path==='/api/admin/operations'&&method==='POST'&&data?.action!=='mark-paid')return reply({ok:true,local:true,state:await adminEnqueue('admin-operation',data)});
   if(path==='/api/admin/finalize'&&method==='POST')return reply({ok:true,local:true,state:await adminEnqueue('admin-finalize',data)});
   if(path==='/api/admin/services/update'&&method==='POST')return reply({ok:true,local:true,state:await adminEnqueue('admin-update',data)});
   if(method!=='GET'&&path!=='/api/logout'&&adminPending().length){
    if(navigator.onLine)await adminSync();else adminSchedule();
    if(adminPending().length)return new Response(JSON.stringify({error:'Aguarde a confirmação dos envios ou revise Pendências antes de alterar acessos ou pagamentos. As alterações já estão salvas neste aparelho.'}),{status:409,headers:{'Content-Type':'application/json'}});
   }
   if(!navigator.onLine&&method!=='GET'&&path!=='/api/logout')return new Response(JSON.stringify({error:'Esta ação precisa de internet para validar acesso ou pagamento. Ordens, catálogo e configurações gerais continuam disponíveis offline.'}),{status:503,headers:{'Content-Type':'application/json'}});
   if(!navigator.onLine&&method==='GET'&&path.startsWith('/api/admin/')){const cached=await vault.get('read:'+adminAccount+':'+path);if(cached)return reply(cached.data);throw Error('Esta consulta ainda não foi carregada neste aparelho. Conecte-se para atualizá-la.');}
  }catch(error){db=structuredClone(adminView);return new Response(JSON.stringify({error:friendly(error)}),{status:400,headers:{'Content-Type':'application/json'}});}
 }
 let r;
 try{r=await staffApi(path,method,data);}catch(error){
  if(admin&&path==='/api/session'&&adminReady())return reply({role:'admin',username:adminProfile.username,state:{...structuredClone(adminView),__offlineLocal:true}});
  if(cachedRead){const cached=await vault.get('read:'+account+':'+path);if(cached)return reply({...cached.data,offlineSnapshot:true,checkedAt:cached.at});}
  if(admin&&method==='GET'){const cached=await vault.get('read:'+adminAccount+':'+path);if(cached)return reply(cached.data);}
  throw error;
 }
 if(admin&&path==='/api/session'&&r.status===401&&adminReady()){adminNeedsLogin=true;adminRender();return reply({role:'admin',username:adminProfile.username,state:{...structuredClone(adminView),__offlineLocal:true}});}
 if(cachedRead&&r.ok){const d=await r.clone().json();await vault.put('read:'+account+':'+path,{data:d,at:new Date().toISOString()}).catch(()=>{});}
 if(path==='/api/login'&&r.ok){
  const d=await r.clone().json();if(d.role==='admin'){
   localStorage.setItem(tokenKey,d.token);localStorage.setItem(roleKey,'admin');locked=false;
   try{d.state=await adminAccept(d.state,d.username,d.token);r=reply(d);}catch(error){notify('Login confirmado, mas não foi possível guardar o painel offline: '+friendly(error));}
  }
 }
 if(path==='/api/session'&&r.ok){const d=await r.clone().json();if(d.role==='admin'&&d.state){try{d.state=await adminAccept(d.state,d.username,localStorage.getItem(tokenKey));r=reply(d);}catch(error){notify(friendly(error));}}}
 if(admin&&r.ok&&method==='GET'&&path.startsWith('/api/admin/')&&!path.includes('pix-provider')){const d=await r.clone().json();await vault.put('read:'+adminAccount+':'+path,{data:d,at:new Date().toISOString()}).catch(()=>{});}
 // Online-only financial writes refresh the encrypted snapshot after acceptance.
 if(admin&&r.ok&&method!=='GET'&&!['/api/login','/api/logout'].includes(path)){
  const d=await r.clone().json();if(d.state){
   try{if(!adminProfile)await adminAccept(d.state,d.state.settings?.username,localStorage.getItem(tokenKey));else await adminRun(async()=>{adminBase=d.state;adminProfile.state=adminBase;await adminHydrate();adminView=adminProject(adminBase);});d.state=structuredClone(adminView);}catch(error){notify('A alteração foi confirmada no servidor. A cópia offline está indisponível: '+friendly(error));}
   return reply(d);
  }
 }
 return r;
};
const adminLogout=window.logout;
window.logout=function(){
 if(adminAuth){vault.remove('auth:'+adminAccount).catch(()=>{});if(vault.native())nativeCall('stopSync',{accountKey:adminAccount}).catch(()=>{});}
 adminAuth='';adminProfile=null;adminBase=null;adminView=null;adminOps=[];adminResults={};adminApiUnavailable=false;adminCapabilityToken='';adminCapabilityAt=0;adminCapabilityState=null;preparationIssue=null;document.getElementById('offlineAvailability')?.remove();document.getElementById('adminOfflineToolbar')?.remove();adminLogout();
};
window.adminOffline={showSync:()=>openSyncDetails(true),get ready(){return adminReady();},get pending(){return adminPending().length;},show:adminShow,sync:adminSync,capture:adminAccept,overlay(state){return state?.__offlineLocal?structuredClone(adminView):adminProject(state);}};
window.addEventListener('online',()=>{if(adminReady()){adminRetry=0;prepareShell(adminAccount).catch(()=>{});adminSync().catch(()=>{});}adminRender();});
window.addEventListener('offline',adminRender);
window.addEventListener('protec-native-lock',()=>{if(localStorage.getItem(roleKey)==='admin'){document.getElementById('dashboard')?.classList.add('hidden');showInitialLock();}});
window.addEventListener('protec-native-unlock',()=>{if(adminProfile)adminShow();});
setInterval(()=>{if(adminReady()&&!document.hidden){adminRun(()=>adminHydrate()).then(()=>{if(vault.native()&&!document.querySelector('.modal:not(.hidden),dialog[open]')){adminView=adminProject(adminBase);db=structuredClone(adminView);}}).catch(()=>{});}},3000);
setInterval(()=>{
 if(document.hidden||!navigator.onLine)return;
 if(adminReady()){adminSync().catch(()=>{});if(!shellReady)prepareShell(adminAccount).catch(()=>{});}
 else if(adminApiUnavailable&&!locked&&localStorage.getItem(roleKey)==='admin'&&localStorage.getItem(tokenKey)){
  const token=localStorage.getItem(tokenKey);
  verifyAdminOfflineBackend(token).then(async state=>{
   if(!state||token!==localStorage.getItem(tokenKey)||localStorage.getItem(roleKey)!=='admin')return;
   await adminAccept(state,state.settings?.username,token);
   if(!document.querySelector('#editForm')&&document.querySelector('#dashboard:not(.hidden)')){db=structuredClone(adminView);window.saveLocal();window.renderPage?.();}adminRender();
  }).catch(()=>{});
 }
},30000);
new MutationObserver(()=>{renderAvailability();if(adminReady())adminRender();}).observe(document.getElementById('dashboard'),{attributes:true,attributeFilter:['class']});

const earlierRegistrationSettings=window.settings;
window.settings=function(container){
 earlierRegistrationSettings.apply(this,arguments);if(!container||container.querySelector('[data-registration-pricing]'))return;
 const catalog=registrationCatalog(db),card=document.createElement('section');card.className='panel config-card';card.dataset.registrationPricing='';
 const options=(items,selected)=>items.map(v=>`<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(v)}</option>`).join('');
 card.innerHTML='<h3>Preços sugeridos da equipe</h3><p>Os valores abaixo aparecem no cadastro de funcionário e vendedor. Tipos sem preço permanecem a definir. O desconto interno e os custos da empresa são tratados separadamente.</p><form data-equipment-price><label>Extintor<select name="type">'+options([...new Set(catalog.equipment.map(e=>e.type))])+'</select></label><label>Capacidade<select name="kg"></select></label><label>Preço da manutenção (R$)<input name="price" type="number" min="0.01" max="1000000" step="0.01" required></label><button class="btn btn-small">Salvar preço do extintor</button></form><hr><h3>Teste de mangueira de hidrante</h3><form data-hose-price><label>Tipo<select name="type">'+options(catalog.hoseTypes)+'</select></label><label>Metros<select name="lengthMeters">'+options(catalog.lengths,15)+'</select></label><label>Preço por mangueira (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" required></label><button class="btn btn-small">Salvar preço da mangueira</button></form>';
 const equipment=card.querySelector('[data-equipment-price]'),hose=card.querySelector('[data-hose-price]');
 const showEquipment=()=>{const entry=(db.types||[]).find(t=>t.name===equipment.elements.type.value&&String(t.kg||'')===(equipment.elements.kg.value==='water-10'?'':equipment.elements.kg.value));equipment.elements.price.value=entry?.price??'';};
 const capacities=()=>{const type=equipment.elements.type.value;equipment.elements.kg.innerHTML=catalog.equipment.filter(e=>e.type===type).map(e=>`<option value="${esc(type==='Água pressurizada'&&!e.kg?'water-10':e.kg)}">${esc(e.label)}</option>`).join('');equipment.elements.kg.closest('label').hidden=type==='Água pressurizada';showEquipment();};equipment.elements.type.onchange=capacities;equipment.elements.kg.onchange=showEquipment;capacities();
 equipment.onsubmit=async e=>{e.preventDefault();const type=equipment.elements.type.value,kg=equipment.elements.kg.value==='water-10'?'':equipment.elements.kg.value,price=Number(equipment.elements.price.value);if(!Number.isFinite(price)||price<=0)return;const existing=db.types.find(t=>t.name===type&&String(t.kg||'')===kg);if(existing)existing.price=price;else db.types.push({id:crypto.randomUUID(),name:type,kg,price});if(await window.save())notify('Preço salvo. Será carregado automaticamente nos aparelhos ao reconectar.');};
 const hosePrice=()=>{const value=db.settings.registrationHosePrices?.[hose.elements.type.value+'|'+hose.elements.lengthMeters.value];hose.elements.price.value=value??'';};hose.elements.type.onchange=hosePrice;hose.elements.lengthMeters.onchange=hosePrice;hosePrice();
 hose.onsubmit=async e=>{e.preventDefault();const price=Number(hose.elements.price.value);if(!Number.isFinite(price)||price<0)return;db.settings.registrationHosePrices||={};db.settings.registrationHosePrices[hose.elements.type.value+'|'+hose.elements.lengthMeters.value]=price;if(await window.save())notify('Preço da mangueira salvo.');};
 const custom=document.createElement('form');custom.innerHTML='<hr><h3>Adicionar tipo ou capacidade ao seletor</h3><label>Nome do tipo<input name="typeName" maxlength="100" required placeholder="Nome usado pela empresa"></label><label>Capacidade<input name="capacity" type="number" min="0.1" max="1000" step="0.01" required></label><label>Unidade<select name="capacityUnit"><option value="kg">kg</option><option value="L">L</option></select></label><label>Preço de manutenção (R$)<input name="maintenancePrice" type="number" min="0.01" max="1000000" step="0.01" required></label><button class="btn btn-small">Adicionar ao catálogo de manutenção</button>';
 custom.onsubmit=async e=>{e.preventDefault();const name=custom.elements.typeName.value.trim(),kg=String(Number(custom.elements.capacity.value)),unit=custom.elements.capacityUnit.value,price=Number(custom.elements.maintenancePrice.value);if(!name||!Number.isFinite(price)||price<=0)return;if(!registrationCapacityAllowed(name,kg))return notify('Escolha uma das capacidades habilitadas para este agente na tabela de preços.');if(db.types.some(t=>t.name===name&&String(t.kg||'')===kg))return notify('Esse tipo e capacidade já estão cadastrados. Use o formulário de preço acima.');db.types.push({id:crypto.randomUUID(),name,kg,unit,price});if(await window.save()){notify('Opção cadastrada. A equipe poderá selecioná-la ao atualizar os dados.');window.renderPage();}};card.append(custom);container.append(card);
};

// All roles enter the same renderer, validation and encrypted-draft flow.
window.openService=(draft)=>{
 if(registrationOpening)return registrationOpening;
 registrationOpening=registration(localStorage.getItem(roleKey),draft).catch(error=>notify(friendly(error))).finally(()=>registrationOpening=null);return registrationOpening;
};
const earlierSupplySettings=window.settings;
window.settings=function(container){
 earlierSupplySettings.apply(this,arguments);if(!container||container.querySelector('[data-supply-pricing]'))return;
 const catalog=registrationCatalog(db),section=document.createElement('section');section.className='panel config-card';section.dataset.supplyPricing='';
 section.innerHTML=`<h3>Extintores novos e seminovos nas ordens</h3><p>Defina o preço sugerido e o custo de aquisição por condição, tipo e capacidade. A equipe seleciona o equipamento sem ver os custos internos. O desconto interno do perfil também se aplica ao fornecimento.</p><form data-supply-price><label>Condição<select name="condition">${SALE_CONDITIONS.map(c=>`<option value="${c.value}">${esc(c.label)} · ${c.hasRing?'com':'sem'} argola</option>`).join('')}</select></label><label>Tipo de extintor<select name="equipmentType">${[...new Set(catalog.equipment.map(e=>e.type))].map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></label><label>Capacidade<select name="kg"></select></label><label>Preço sugerido de venda (R$)<input name="salePrice" type="number" min="0.01" max="1000000" step="0.01" required></label><label>Custo de aquisição (R$, opcional)<input name="unitCost" type="number" min="0" max="1000000" step="0.01" placeholder="Vazio indica custo pendente"></label><div class="ops-detail-actions"><button class="btn btn-small">Salvar preço e custo</button><button type="button" class="btn btn-soft btn-small" data-remove-supply-price>Desativar esta configuração</button></div></form><p class="ops-note">Novos e seminovos são categorias de cadastro separadas. A identificação e a condição do equipamento real devem ser conferidas pela empresa. Sem preço configurado, o fornecimento fica com valor a definir.</p>`;
 const form=section.querySelector('form');
 const record=()=>db.costCatalog?.find(c=>c.active!==false&&c.saleCondition===form.elements.condition.value&&c.equipmentType===form.elements.equipmentType.value&&String(c.kg||'')===(form.elements.kg.value==='water-10'?'':form.elements.kg.value));
 const show=()=>{const item=record();form.elements.salePrice.value=item?.salePrice??'';form.elements.unitCost.value=item?.unitCost??'';form.querySelector('[data-remove-supply-price]').disabled=!item;};
 const weights=()=>{const type=form.elements.equipmentType.value;form.elements.kg.innerHTML=catalog.equipment.filter(e=>e.type===type).map(e=>`<option value="${esc(type==='Água pressurizada'&&!e.kg?'water-10':e.kg)}">${esc(e.label)}</option>`).join('');form.elements.kg.closest('label').hidden=type==='Água pressurizada';show();};form.elements.equipmentType.onchange=weights;form.elements.kg.onchange=show;form.elements.condition.onchange=show;weights();
 form.onsubmit=async event=>{event.preventDefault();const salePrice=Number(form.elements.salePrice.value),unitCost=form.elements.unitCost.value===''?null:Number(form.elements.unitCost.value);if(!Number.isFinite(salePrice)||salePrice<=0||unitCost!==null&&(!Number.isFinite(unitCost)||unitCost<0))return;const condition=SALE_CONDITIONS.find(c=>c.value===form.elements.condition.value),type=form.elements.equipmentType.value,kg=form.elements.kg.value==='water-10'?'':form.elements.kg.value;db.costCatalog||=[];let item=record();if(!item){item={id:crypto.randomUUID()};db.costCatalog.push(item);}Object.assign(item,{name:'Extintor '+condition.label.toLocaleLowerCase('pt-BR')+' · '+type,category:'Produto',saleCondition:condition.value,equipmentType:type,kg,unitCost,salePrice,technicalPart:false,active:true,updatedAt:new Date().toISOString()});if(await window.save()){notify('Preço e custo do fornecimento salvos.');show();}};
 form.querySelector('[data-remove-supply-price]').onclick=async()=>{const item=record();if(!item)return;item.active=false;if(await window.save()){notify('Configuração desativada para novas cotações.');show();}};container.append(section);
};

function registrationKind(hasMaintenance,hasPurchases,catalog){return hasMaintenance||!hasPurchases?'Manutenção':catalog.services.includes('Compra de extintores')?'Compra de extintores':'Fornecimento de extintores';}
function registrationSaleRow(catalog,item={}){
 const options=(values,selected='',blank='Selecione')=>(blank!==null?'<option value="">'+esc(blank)+'</option>':'')+values.map(v=>{const value=typeof v==='object'?v.value:v,label=typeof v==='object'?v.label:v;return `<option value="${esc(value)}" ${String(value)===String(selected)?'selected':''}>${esc(label)}</option>`;}).join('');
 return `<section class="registration-sale-line" data-sale-row><label>Condição<select data-sale-condition>${options(SALE_CONDITIONS.map(c=>({value:c.value,label:c.label+(c.hasRing?' · com argola':' · sem argola')})),item.condition||'new',null)}</select></label><label>Tipo de extintor<select data-sale-type required>${options([...new Set(catalog.equipment.map(e=>e.type))],item.type)}</select></label><label>Peso / capacidade<select data-sale-kg required></select></label><label>Quantidade<select data-sale-qty>${options(Array.from({length:50},(_,i)=>i+1),item.quantity||1,null)}</select></label><button type="button" class="icon-btn" data-remove-sale>Remover</button></section>`;
}
function standardizeRegistrationFrame(form,role){
 form.classList.add('team-maintenance-form','maintenance-registration-form');form.dataset.registrationRole=role;
 const sections={contact:'.team-contact-grid',equipment:'.team-equipment-section',complements:'[data-complement-section]',parts:'.registration-complementary',date:'.registration-service-date',price:'.registration-price',notes:'[name="notes"]'};
 for(const [name,selector] of Object.entries(sections)){const item=form.querySelector(selector);if(item)(name==='notes'?item.closest('.form-field')||item:item).dataset.registrationSection=name;}
 const title=form.querySelector('.modal-head h2');if(title)title.textContent='Registrar manutenção / serviço';
 form.querySelectorAll('.service-ext-row').forEach(row=>{row.classList.add('registration-line');for(const [name,label] of [['extType','Tipo de extintor'],['extKg','Peso / capacidade']]){const heading=row.querySelector('[name='+name+']')?.closest('.form-field')?.querySelector('label');if(heading?.firstChild?.nodeType===3)heading.firstChild.textContent=label+' ';}});
}

function migrateRegistrationExtras(draft,catalog){
 const extras=draft.extraServicesDraft;if(!Array.isArray(extras))return;
 const recovered=[];
 for(const card of extras){if(!card.checked)continue;
  const values=card.values||[],read=key=>values.find(v=>v.key===key)?.value;
  if(card.code==='hydrant-hose-test'){
   const indexes=[...new Set(values.map(v=>v.line).filter(i=>i>=0))];for(const i of indexes){const get=key=>values.find(v=>v.line===i&&v.key===key)?.value;draft.hydrantHoses.push({type:get('type')||'Tipo 1',diameterMm:Number(get('diameterMm')||38),lengthMeters:Number(get('lengthMeters')||15),quantity:Number(get('quantity')||1)});}
  }else{const definition=(catalog.complements||[]).find(c=>c.id===card.code);recovered.push((definition?.name||read('description')||card.code)+': '+values.filter(v=>v.value).map(v=>v.key+' = '+v.value).join(', '));}
 }
 if(recovered.length)draft.notes=[draft.notes,'Adicionais do rascunho anterior (confira nas novas listas): '+recovered.join('; ')].filter(Boolean).join('\n');
 delete draft.extraServicesDraft;
}

const beforeComplementSettings=window.settings;
window.settings=function(container){
 beforeComplementSettings.apply(this,arguments);if(!container||container.querySelector('[data-complement-settings]'))return;
 const card=document.createElement('section');card.className='panel config-card';card.dataset.complementSettings='';
 card.innerHTML=`<h3>Serviços complementares do registro</h3><p>Estas opções são compartilhadas pelo admin, funcionário e vendedor. Configure os nomes e tipos aqui uma vez; no registro da ordem, a equipe apenas seleciona. Remover retira a opção dos novos registros e preserva o histórico.</p><form data-complement-definition><label>Opção cadastrada<select name="entry"></select></label><label>Nome do serviço<input name="title" required maxlength="100"></label><label>Tipos disponíveis (um por linha)<textarea name="variants" required rows="4" maxlength="10100"></textarea></label><p class="helper">Exemplo: suporte simples e suporte duplo em linhas separadas. As medidas dos serviços padrão continuam disponíveis nas listas.</p><div class="ops-detail-actions"><button class="btn btn-small" type="submit">Salvar opção</button><button class="btn btn-soft btn-small" type="button" data-new-complement>Adicionar nova opção</button><button class="btn btn-soft btn-small" type="button" data-toggle-complement>Remover dos registros</button></div></form><hr><form data-complement-rate><h3>Preço e custo por tipo</h3><label>Tipo do serviço<select name="variant"></select></label><label>Preço sugerido por unidade (R$)<input name="price" type="number" min="0" max="1000000" step="0.01" placeholder="Vazio: a definir"></label><label>Custo por unidade (R$, privado)<input name="cost" type="number" min="0" max="1000000" step="0.01" placeholder="Vazio: custo pendente"></label><p class="helper">O preço é por unidade do tipo selecionado. As medidas são detalhes da execução. Custos não aparecem nos painéis da equipe. Para teste de mangueira, use a tabela por tipo e metros acima.</p><button class="btn btn-small" type="submit">Salvar preço e custo</button></form><p class="helper" data-complement-config-status role="status"></p>`;
 const definition=card.querySelector('[data-complement-definition]'),rate=card.querySelector('[data-complement-rate]'),status=card.querySelector('[data-complement-config-status]');
 const options=items=>items.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.active?'':' (removido)'}</option>`).join('');
 const current=()=>complementDefinitions(db,true).find(c=>c.id===definition.elements.entry.value);
 const showRate=()=>{const c=current(),variant=rate.elements.variant.value;rate.elements.price.value=c?.prices[variant]??'';rate.elements.cost.value=c?.costs[variant]??'';};
 const show=()=>{const c=current();definition.elements.title.value=c?.name||'';definition.elements.variants.value=c?.variants.join('\n')||'';card.querySelector('[data-toggle-complement]').disabled=!c;card.querySelector('[data-toggle-complement]').textContent=c?.active===false?'Reativar nos registros':'Remover dos registros';rate.hidden=!c||c.placement==='equipment';rate.elements.variant.innerHTML=(c?.variants||[]).map(v=>`<option>${esc(v)}</option>`).join('');status.textContent=c?.active===false?'Esta opção está removida dos novos registros. As ordens anteriores foram preservadas.':'';showRate();};
 const refresh=id=>{definition.elements.entry.innerHTML='<option value="">Nova opção</option>'+options(complementDefinitions(db,true));definition.elements.entry.value=id||'';show();};
 const store=c=>{db.settings.registrationComplements||=[];const records=db.settings.registrationComplements,index=records.findIndex(r=>r.id===c.id);const value={id:c.id,name:c.name,variants:c.variants,active:c.active!==false,prices:c.prices||{},costs:c.costs||{}};if(index<0)records.push(value);else records[index]=value;};
 definition.elements.entry.onchange=show;rate.elements.variant.onchange=showRate;card.querySelector('[data-new-complement]').onclick=()=>{definition.elements.entry.value='';show();definition.elements.title.focus();};
 definition.onsubmit=async event=>{event.preventDefault();const previous=structuredClone(db.settings.registrationComplements),old=current(),name=definition.elements.title.value.trim(),variants=[...new Set(definition.elements.variants.value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean))];const c={...old,id:old?.id||crypto.randomUUID(),name,variants,active:old?.active!==false,prices:Object.fromEntries(variants.map(v=>[v,old?.prices[v]??null])),costs:Object.fromEntries(variants.map(v=>[v,old?.costs[v]??null]))};try{store(c);validateComplementSettings(db);if(!await window.save())throw Error('Não foi possível salvar a configuração.');refresh(c.id);status.textContent='Opção salva. Os três painéis recebem a lista ao sincronizar.';}catch(error){db.settings.registrationComplements=previous;notify(error.message);}};
 card.querySelector('[data-toggle-complement]').onclick=async()=>{const c=current();if(!c)return;const previous=structuredClone(db.settings.registrationComplements);store({...c,active:c.active===false});if(!await window.save()){db.settings.registrationComplements=previous;return;}refresh(c.id);status.textContent=c.active?'Opção removida dos novos registros. Histórico preservado.':'Opção reativada nos três painéis.';};
 rate.onsubmit=async event=>{event.preventDefault();const c=current();if(!c)return;const previous=structuredClone(db.settings.registrationComplements),variant=rate.elements.variant.value,price=rate.elements.price.value===''?null:Number(rate.elements.price.value),cost=rate.elements.cost.value===''?null:Number(rate.elements.cost.value);try{store({...c,prices:{...c.prices,[variant]:price},costs:{...c.costs,[variant]:cost}});validateComplementSettings(db);if(!await window.save())throw Error('Não foi possível salvar o preço.');status.textContent='Preço e custo salvos. Apenas o preço sugerido é enviado à equipe.';}catch(error){db.settings.registrationComplements=previous;notify(error.message);}};
 refresh('wall-support');container.append(card);
};
