import './service-management.mjs?v=registration-recovery-26';
import {openOrderDetail} from './operations-ui.mjs?v=registration-recovery-26';
import {vault,nativeCall} from './offline-vault.mjs';
import {applyOperation,replayLocal,isPaused,adminChanges,applyAdminChanges} from './offline-rules.mjs';
import {PART_NAMES,completed,cancelled,applyAdminOperation,finalizeAdminOrder,updateAdminOrder,preserveAndCapture} from './service-rules.mjs';

const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./offline-services.css',import.meta.url);document.head.append(css);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokenKey='protecextintores_session',roleKey='protecextintores_role';
const base=String(window.API_BASE_URL || (typeof API_BASE_URL!=='undefined'?API_BASE_URL:''));
const rawApi=window.apiCall;
const onlineTeamRegistration=window.openTeamMaintenanceForm;
let preparationIssue=null,registrationOpening=null,adminApiUnavailable=false,adminCapabilityCheck=null,adminCapabilityToken='',adminCapabilityAt=0,adminCapabilityState=null;
let profile=null,ops=[],results={},services=[],active='',preparing=null,syncing=false,renderTimer,tab='active',query='',locked=false,offline=false,needsLogin=false,serial=Promise.resolve(),lastStamp=0,submissionBasis=null,accountToken='',nativeSyncing=false,nativeKind='',upload=null,nativeTransfer=null,lastSyncAt='';
const names={claim:'Aceite de serviço',create:'Nova ordem',technical:'Peças e observações',painting:'Pintura',stage:'Etapa',pause:'Pausa',resume:'Retomada',media:'Vídeo de peça',complete:'Conclusão da execução'};
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
  accountToken=(await vault.get('auth:'+active))?.token || '';
  const preparedShell=await vault.get('shell:'+active);shellReady=vault.native()||preparedShell?.version===shellVersion;
  if(vault.native()){const nativeState=await vault.get('sync-state:'+active);if(nativeState?.needsLogin)needsLogin=true;if(nativeState?.apiUpdateRequired)preparationIssue={token:accountToken,status:404,message:'A API precisa ser atualizada.'};nativeSyncing=Boolean(nativeState?.syncing&&Date.now()-nativeState.at<300000);nativeKind=nativeState?.kind || '';nativeTransfer=nativeSyncing?{serviceId:nativeState.serviceId,kind:nativeKind,loaded:Number(nativeState.loaded)||0,total:Number(nativeState.total)||0}:null;}
  ops=await Promise.all((await vault.keys(opPrefix())).map(k=>vault.get(k)));ops=ops.filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  results={};for(const op of ops){const r=await vault.get(resultKey(op.id));if(r)results[op.id]=r}
  const savedSync=await vault.get('last-sync:'+active);lastSyncAt=savedSync?.at||'';
  const confirmed=Object.values(results).filter(r=>r.ok&&r.serverAt).map(r=>r.serverAt).sort().at(-1);
  if(confirmed&&confirmed>lastSyncAt){lastSyncAt=confirmed;await vault.put('last-sync:'+active,{at:confirmed})}
  const current=structuredClone(profile);
  for(const op of ops){const r=results[op.id];if(r?.ok&&r.service&&r.serverAt>profile.preparedAt){const i=current.services.findIndex(s=>s.id===r.service.id);if(i<0)current.services.push(r.service);else current.services[i]=r.service}}
  services=replayLocal(current,ops,results);
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
 const team=['employee','seller'].includes(localStorage.getItem(roleKey)),root=team?document.querySelector('#employeePortal:not(.hidden) main'):document.querySelector('#dashboard:not(.hidden) #content')?.parentElement;
 const issue=team?preparationIssue?.token===localStorage.getItem(tokenKey)&&(!allowed()||preparationIssue.status===404):adminApiUnavailable;
 let bar=document.getElementById('offlineAvailability');
 if(!root||!issue){bar?.remove();return;}
 const message=team?preparationIssue?.status===401?'Entre novamente para atualizar o acesso. Seus registros locais estão preservados.':preparationIssue?.status===403?'O acesso ao trabalho offline não foi autorizado. Procure o administrador.':allowed()?'Os registros continuam salvos neste aparelho. O sistema precisa ser atualizado para receber os envios.':'Você pode registrar serviços com internet. O modo offline será liberado quando a conexão com o sistema estiver atualizada.':'Cadastro online disponível. A API precisa ser atualizada para liberar os envios offline. Os registros já salvos neste aparelho estão preservados.';
 if(!bar){bar=document.createElement('section');bar.id='offlineAvailability';bar.className='offline-banner';root.prepend(bar);}
 if(bar.dataset.message!==message){bar.dataset.message=message;bar.innerHTML='<strong>Modo offline indisponível no momento</strong><p>'+esc(message)+'</p>';}
}
async function enqueue(kind,serviceId,payload,basis=null){basis ||= submissionBasis?.serviceId===serviceId?submissionBasis:null;const account=active;return withSerial(async()=>{
  assertAllowed();await hydrate();
  if(active!==account || basis?.accountKey&&basis.accountKey!==active)throw Error('A conta mudou. Reabra o registro na conta de origem.');
  if(kind==='media'){const already=ops.find(o=>o.kind==='media'&&o.serviceId===serviceId&&o.payload.itemIndex===payload.itemIndex&&o.payload.part===payload.part&&o.payload.blobKey===payload.blobKey&&!results[o.id]?.discarded);if(already)return already;}
  const prior=ops.filter(o=>o.serviceId===serviceId&&!results[o.id]?.ok&&!results[o.id]?.discarded).at(-1);
  const current=services.find(s=>s.id===serviceId)||(profile.available||[]).find(s=>s.id===serviceId);
  const op={id:crypto.randomUUID(),accountKey:active,deviceId:await deviceId(),serviceId,kind,payload,createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString(),baseVersion:basis?.baseVersion ?? current?.syncVersion ?? '',...((prior?.id || basis?.previousId)?{previousId:prior?.id || basis.previousId}:{})};
  const validation={services:structuredClone(services),types:profile.types,settings:profile.settings,costCatalog:profile.costCatalog};
  applyOperation(validation,profile.actor,kind==='media'?{...op,payload:{...payload,media:{url:'local:'+op.id,durationSeconds:payload.durationSeconds}}}:op,op.createdAt);
  if(active!==account)throw Error('A conta mudou antes de salvar.');
  await vault.put(opPrefix()+op.id,op);if(basis)basis.previousId=op.id;await hydrate();scheduleSync();return op;
})}
async function deviceId(){let d=await vault.get('device');if(!d){d=crypto.randomUUID();await vault.put('device',d)}return d}
function scheduleSync(){if(vault.native())nativeCall('sync',{accountKey:active}).catch(()=>{});else if(navigator.onLine)setTimeout(()=>sync().catch(()=>{}),50)}
async function sync(){
  if(!active||syncing||locked)return;if(vault.native()){await nativeCall('sync',{accountKey:active});notify('Envio agendado no Android.');return}
  const work=async()=>{
    syncing=true;scheduleRender();const blocked=new Set(),syncAccount=active,syncToken=localStorage.getItem(tokenKey);
    try{await hydrate();for(const op of ops){
      if(active!==syncAccount)break;
      if(results[op.id]?.ok||results[op.id]?.discarded)continue;
      if(results[op.id]?.conflict||blocked.has(op.serviceId)){blocked.add(op.serviceId);continue}
      let body,path='/api/offline/sync';
      if(op.kind==='media'){path='/api/offline/media';body=new FormData();body.append('operation',JSON.stringify(op));body.append('file',await vault.blobGet(op.payload.blobKey,op.payload.mime),op.payload.name || 'video.mp4')}
      else body=JSON.stringify(op);
      upload={serviceId:op.serviceId,kind:op.kind,loaded:0,total:0};scheduleRender();
      const r=await network(path,{method:'POST',body,headers:{Authorization:'Bearer '+syncToken}}),data=await r.json();upload=null;
      if(active!==syncAccount)break;
      if(r.status===401||r.status===403&&!data.conflict){needsLogin=true;break}
      if(r.status===404&&!data.conflict){preparationIssue={token:syncToken,status:404,message:'A API precisa ser atualizada para receber os envios.'};renderAvailability();break;}
      if(!r.ok){if(data.conflict||r.status===400||r.status===404){await vault.put(resultKey(op.id),{error:data.error,conflict:true,current:data.current || null});blocked.add(op.serviceId)}else break}
      else{await vault.put(resultKey(op.id),data);if(op.kind==='media')await vault.remove(op.payload.blobKey)}
      await hydrate();
    }offline=false}catch(error){offline=true;notify(error.message || 'Envio interrompido. Os registros continuam no aparelho.')}finally{syncing=false;upload=null;scheduleRender()}
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
  let bar=root.querySelector('#offlineToolbar');if(!bar){bar=document.createElement('section');bar.id='offlineToolbar';bar.className='offline-toolbar';root.querySelector('main')?.prepend(bar)}
  const pending=ops.filter(o=>!results[o.id]?.ok&&!results[o.id]?.discarded),videos=pending.filter(o=>o.kind==='media'),errors=pending.filter(o=>results[o.id]?.conflict);
  const label=needsLogin?'Entre novamente para enviar':!allowed()?'Acesso offline vencido':offline||!navigator.onLine?'Sem conexão · salvando no aparelho':syncing||nativeSyncing?nativeKind==='media'?'Enviando vídeos…':'Enviando registros…':'Trabalho offline disponível · preparação automática';
  const transfer=upload||(nativeSyncing?nativeTransfer:null);
  const signature=JSON.stringify([label,pending.length,videos.length,errors.length,profile.preparedAt,lastSyncAt,transfer?.kind,transfer?.total?Math.floor(transfer.loaded/transfer.total*100):null]);
  if(bar.dataset.state!==signature){
    bar.dataset.state=signature;
    const percent=transfer?.total?Math.min(99,Math.floor(transfer.loaded/transfer.total*100)):null;
    bar.innerHTML=`<div><strong>${esc(label)}</strong><p>${pending.length?`${new Set(pending.map(o=>o.serviceId)).size} ordem(ns) e ${videos.length} vídeo(s) aguardando confirmação`:'Nenhum envio pendente neste aparelho.'}${errors.length?' · '+errors.length+' precisa(m) de revisão':''}</p>${transfer?.kind==='media'?`<progress class="ops-upload-progress" max="100" ${percent!==null?'value="'+percent+'"':''} aria-label="Progresso do envio do vídeo"></progress><span class="ops-upload-caption">${percent!==null?percent+'% enviado · aguardando confirmação':'Enviando vídeo · seus dados permanecem no aparelho'}</span>`:''}<p>${shellReady?'Telas disponíveis offline.':'Preparando telas automaticamente… '+esc(shellError)} Última confirmação de envio: ${lastSyncAt?esc(new Date(lastSyncAt).toLocaleString('pt-BR')):'nenhum envio registrado neste aparelho'}</p><details><summary>Conferência e prazo offline</summary><p>Dados conferidos em ${esc(new Date(profile.preparedAt).toLocaleString('pt-BR'))} · ${profile.offlineMode==='until-logout'?'acesso local mantido até sair da conta':'acesso até '+esc(new Date(profile.offlineUntil).toLocaleString('pt-BR'))}</p></details></div><div class="offline-actions"><button type="button" class="btn btn-small btn-soft" data-offline-action="sync" ${syncing||nativeSyncing?'disabled':''}>Sincronizar agora</button><button type="button" class="btn btn-small btn-soft" data-offline-action="queue" aria-label="Pendências">Pendências${pending.length?' ('+pending.length+')':''}</button>${vault.native()?'<button type="button" class="btn btn-small btn-soft" data-offline-action="lock">Bloqueio do aparelho</button>':''}${needsLogin?'<button type="button" class="btn btn-small btn-soft" data-offline-action="login">Entrar novamente</button>':''}</div>`;
    bar.querySelectorAll('[data-offline-action]').forEach(b=>b.onclick=()=>action(b.dataset.offlineAction));
  }
  if(profile.role==='employee')renderWorkbench();else if(window.sellerPortalState){window.sellerPortalState.services=services;window.renderSellerServicesList?.();root.querySelectorAll('.seller-service-status').forEach(card=>{const s=services.find(s=>card.textContent.includes(s.code));if(s?.localPending&&!card.querySelector('.offline-badge')){const b=document.createElement('p');b.className='offline-badge is-pending';b.textContent='Salvo neste aparelho · aguardando envio';card.append(b)}})}
}
async function action(name){try{
  if(name==='prepare')await prepare();
  if(name==='sync')await sync();
  if(name==='queue')await openQueue();
  if(name==='login'){window.logout();window.showLogin()}
  if(name==='lock'){const state=await nativeCall('lockState');await nativeCall(state.enabled?'disableLock':'enableLock');notify(state.enabled?'Bloqueio adicional desativado.':'Bloqueio ativado. O Android pedirá o desbloqueio do aparelho ao retornar ao app.')}
}catch(error){notify(friendly(error))}}
function renderWorkbench(){
  if(!profile||accountToken!==localStorage.getItem(tokenKey))return;
  const host=document.getElementById('employeeCards');if(!host)return;
  const all=services,list=all.filter(s=>tab==='history'?completed(s)||cancelled(s):tab==='paused'?isPaused(s):!completed(s)&&!cancelled(s)&&!isPaused(s));
  const signature=JSON.stringify([all,tab,query,results]);if(host.dataset.offlineState===signature&&host.querySelector('[data-offline-workbench]'))return;host.dataset.offlineState=signature;
  host.innerHTML=`<div data-service-workbench data-offline-workbench><div class="offline-tabs">${[['active','Em execução / disponíveis'],['paused','Pausados'],['history','Meu histórico']].map(([key,label])=>`<button type="button" class="btn btn-soft btn-small" data-tab="${key}" aria-pressed="${tab===key}">${label}</button>`).join('')}</div><label>Buscar serviço<input class="offline-search" type="search" value="${esc(query)}" data-offline-search></label>${list.map(s=>`<article class="employee-service" data-offline-service="${esc(s.id)}"><header class="employee-service-head"><div><b>${esc(s.code)}</b><p>${esc(s.clientName || 'Cliente não informado')} · ${esc(s.serviceType)}</p></div><span class="offline-badge ${s.localPending?'is-pending':''}">${esc(statusOf(s))}</span></header><div class="employee-service-body service-detail-item"><p>${s.items.length} equipamento(s) · ${s.paintingQuantity || 0} pintura(s)</p><p><span data-sync-state="${syncStatus(s.id).state}">${esc(syncStatus(s.id).label)}</span></p>${isPaused(s)?`<p>Pausa: ${esc(s.pauseReason)} · ${esc(new Date(s.pausedAt).toLocaleString('pt-BR'))}</p>`:''}<div class="offline-actions offline-service-actions"><button type="button" class="btn btn-soft btn-small" data-action="details">Detalhes e histórico</button>${!s.employeeId&&!completed(s)&&!cancelled(s)?'<button type="button" class="btn btn-small" data-action="claim">Aceitar serviço</button>':!completed(s)&&!cancelled(s)&&s.employeeId===profile.actor.id?isPaused(s)?'<button type="button" class="btn btn-small" data-action="resume">Retomar serviço</button>':'<button type="button" class="btn btn-soft btn-small" data-action="pause">Pausar serviço</button><button type="button" class="btn btn-soft btn-small" data-action="technical">Peças, notas e vídeos</button><button type="button" class="btn btn-soft btn-small" data-action="painting">Quantidade de pinturas</button><button type="button" class="btn btn-soft btn-small" data-action="stage">Atualizar etapa</button><button type="button" class="btn btn-small" data-action="complete">Concluir execução</button>':''}</div></div></article>`).join('') || '<p class="empty">Nenhum serviço neste filtro.</p>'}</div>`;
  host.querySelectorAll('[data-tab]').forEach(b=>{const key=b.dataset.tab,count=all.filter(s=>key==='history'?completed(s)||cancelled(s):key==='paused'?isPaused(s):!completed(s)&&!cancelled(s)&&!isPaused(s)).length;b.setAttribute('aria-label',b.textContent);b.insertAdjacentHTML('beforeend',` <span aria-hidden="true">(${count})</span>`);b.onclick=()=>{tab=key;renderWorkbench()}});
  const search=host.querySelector('[data-offline-search]');const filter=()=>host.querySelectorAll('[data-offline-service]').forEach(card=>card.hidden=!card.textContent.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));search.oninput=()=>{query=search.value;filter()};filter();
  host.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>staffAction(b.dataset.action,b.closest('[data-offline-service]').dataset.offlineService).catch(e=>notify(friendly(e))));
}
async function staffAction(action,id){
  const s=services.find(s=>s.id===id)||(profile.available || []).find(s=>s.id===id);if(!s)return;
  if(action==='details')return details(s);
  assertAllowed();
  if(action!=='claim'&&s.employeeId!==profile.actor.id)throw Error('Somente o funcionário responsável pode alterar a execução.');
  if(action==='claim'){await enqueue('claim',id,{});render();return}

  if(action==='technical')return technical(s);
  if(action==='pause')return serviceModal(id,'Pausar serviço · '+esc(s.code),'<p>As etapas e os anexos serão preservados. Depois da pausa, você poderá iniciar outro atendimento.</p><label class="form-field">Motivo da pausa<textarea name="reason" required minlength="3" maxlength="500" placeholder="Ex.: atendimento urgente em outro cliente"></textarea></label>',async f=>{await enqueue('pause',id,{reason:f.get('reason')});notify('Pausa salva no aparelho.');return true},'Pausar serviço');
  if(action==='resume'){await enqueue('resume',id,{});notify('Serviço retomado.');return}
  if(action==='painting')return serviceModal(id,'Quantidade de pinturas',`<label class="form-field">Quantos equipamentos receberam pintura?<input type="number" name="quantity" required min="0" max="${s.items.length}" step="1" value="${s.paintingQuantity || 0}"></label><p>Informe zero se não houve pintura.</p>`,async f=>{await enqueue('painting',id,{quantity:Number(f.get('quantity'))});return true},'Salvar quantidade');
  if(action==='stage')return serviceModal(id,'Atualizar etapa',`<label class="form-field">Etapa<select name="status">${profile.settings.stages.filter(st=>!['Concluído','Solicitado','Aguardando peça'].includes(st)).map(st=>`<option ${st===s.status?'selected':''}>${esc(st)}</option>`).join('')}</select></label>`,async f=>{await enqueue('stage',id,{status:f.get('status')});return true});
  if(action==='complete')return serviceModal(id,'Concluir execução',`<p>Confirme a quantidade de pinturas. Os vídeos obrigatórios precisam estar guardados no aparelho antes de concluir.</p><label class="form-field">Quantidade de pinturas<input name="quantity" type="number" min="0" max="${s.items.length}" required value="${s.paintingQuantity || 0}"></label><p>A conclusão ficará pendente até o sistema receber os registros e vídeos. A aprovação será feita pelo administrador.</p>`,async f=>{await enqueue('painting',id,{quantity:Number(f.get('quantity'))});await enqueue('complete',id,{});notify('Conclusão salva. O envio e a revisão podem ser acompanhados nas pendências.');return true},'Concluir no aparelho');
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
   const validation={services:structuredClone(profile.services),types:profile.types,settings:profile.settings,costCatalog:profile.costCatalog},entries=[];let previousId='';
   for(const old of related){const op={...old,id:crypto.randomUUID(),baseVersion:fresh.syncVersion,previousId,createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString()};applyOperation(validation,profile.actor,op.kind==='media'?{...op,payload:{...op.payload,media:{url:'local:'+op.id}}}:op,op.createdAt);entries.push({key:opPrefix()+op.id,value:op},{key:resultKey(old.id),value:{discarded:true,error:'Substituído por reenvio revisado',archivedAt:op.createdAt,replacementId:op.id}});previousId=op.id}
   await vault.batch(entries);await hydrate();scheduleSync();notify('Reenvio revisado salvo.');return true;
 },'Reaplicar após revisão');
}
async function showPortal(){if(!profile)return;locked=false;db.settings={...db.settings,...profile.settings};db.types=profile.types;const data={...profile,services};if(profile.role==='employee')window.renderEmployeePortal(profile.username,services);else window.renderSellerPortal(data);scheduleRender()}
const originalLogout=window.logout;
window.logout=function(){window.closeModal?.();if(vault.native())nativeCall('logout').catch(()=>{});const old=active;if(old){vault.remove('auth:'+old).catch(()=>{});vault.put('active',null).catch(()=>{});if(vault.native())nativeCall('stopSync',{accountKey:old}).catch(()=>{})}active='';profile=null;services=[];ops=[];results={};upload=null;nativeTransfer=null;lastSyncAt='';originalLogout()};
window.apiCall=async function(path,method='GET',data=null){
 if(!navigator.onLine&&method!=='GET'&&['/api/profile','/api/employee/settings','/api/seller/settings','/api/team/billing'].includes(path))return new Response(JSON.stringify({error:'Esta ação precisa de internet para validar acesso ou pagamento. Seus serviços continuam disponíveis offline.'}),{status:503,headers:{'Content-Type':'application/json'}});
 if(profile&&allowed()&&path==='/api/profile'&&method==='GET')return reply({username:profile.username});
 if(locked&&path==='/api/session')return new Response(JSON.stringify({error:'Desbloqueie o aparelho para abrir os serviços.'}),{status:403,headers:{'Content-Type':'application/json'}});
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
window.offlineServices={prepare,sync,statusFor:syncStatus,openDetails:id=>{const s=services.find(s=>s.id===id)||(profile?.available||[]).find(s=>s.id===id);if(s)details(s)},get actorId(){return profile?.actor?.id},get services(){return services},get ready(){return Boolean(allowed())},get locked(){return locked},vault};
let lastNativeTheme='';
const syncNativeTheme=()=>{const mode=document.documentElement.dataset.theme==='dark'?'dark':'light';if(vault.native()&&mode!==lastNativeTheme){lastNativeTheme=mode;nativeCall('theme',{mode}).catch(()=>{});}};
new MutationObserver(syncNativeTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});syncNativeTheme();
const previousSettings=window.settings;
window.settings=function(container){previousSettings.apply(this,arguments);if(!container||container.querySelector('[data-offline-policy]'))return;const card=document.createElement('section');card.className='panel config-card';card.dataset.offlinePolicy='';card.innerHTML='<h3>Trabalho sem internet</h3><p>As telas e os dados são preparados automaticamente após entrar. O acesso local continua até sair da conta. Alterações e vídeos aguardam envio neste aparelho. O servidor confere as permissões antes de aceitar cada envio.</p><p>Entrar, configurar credenciais, gerar um novo Pix e confirmar recebimentos precisam de internet.</p>';container.append(card)};

const previousServiceTable=window.serviceTable;
window.serviceTable=function(list){const template=document.createElement('template');template.innerHTML=previousServiceTable.apply(this,arguments);template.content.querySelectorAll('tbody tr').forEach(row=>{const service=list.find(s=>row.innerHTML.includes(s.id));if(service?.pausedAt&&!service.closed&&!service.employeeCompletedAt){const tag=document.createElement('p');tag.className='offline-badge is-pending';tag.textContent='Pausado · '+(service.pauseReason || 'Sem motivo informado');row.querySelector('td:last-child')?.prepend(tag)}});return template.innerHTML};
window.addEventListener('online',()=>{if(!['employee','seller'].includes(localStorage.getItem(roleKey)))return;offline=false;prepare(true).then(()=>sync()).catch(()=>scheduleRender())});
window.addEventListener('offline',()=>{offline=true;scheduleRender()});
window.addEventListener('protec-native-lock',()=>{locked=true;scheduleRender()});
window.addEventListener('protec-native-unlock',()=>{locked=false;if(profile)showPortal();else initialize()});
new MutationObserver(()=>{renderAvailability();const root=document.getElementById('employeePortal');if(profile&&root&&!root.classList.contains('hidden')&&(!root.querySelector('#offlineToolbar')||profile.role==='employee'&&!root.querySelector('[data-offline-service]')))scheduleRender()}).observe(document.getElementById('employeePortal'),{childList:true,subtree:true});
setInterval(()=>{if(active&&!document.hidden)hydrate().catch(()=>{});},3000);
setInterval(()=>{if(localStorage.getItem(tokenKey)&&['employee','seller'].includes(localStorage.getItem(roleKey))&&!document.hidden&&navigator.onLine&&!locked)prepare(true).then(()=>sync()).catch(()=>{});},45000);
async function initialize(){try{if(vault.native()){const state=await nativeCall('lockState');locked=state.locked;if(locked){await nativeCall('unlock');locked=false}}const saved=await vault.get('active');active=saved?.accountKey || '';if(active&&['employee','seller'].includes(localStorage.getItem(roleKey))){await hydrate();if(profile&&localStorage.getItem(tokenKey)){if(allowed())await showPortal()}else active=''}await initializeAdminOffline();}catch(error){notify(friendly(error));if(locked)showInitialLock()}finally{window.protecOfflineLoaded=true;window.dispatchEvent(new Event('protec-offline-ready'));if(!locked&&localStorage.getItem(tokenKey)&&['employee','seller'].includes(localStorage.getItem(roleKey)))prepare(true).then(()=>{showPortal();scheduleSync()}).catch(()=>scheduleRender());}}
function showInitialLock(){for(const id of ['store','login','dashboard'])document.getElementById(id)?.classList.add('hidden');const root=document.getElementById('employeePortal');root.classList.remove('hidden');root.innerHTML='<section class="offline-locked"><h1>ProtecExtintores</h1><p>Desbloqueie o aparelho para abrir seus serviços.</p><button type="button" class="btn" data-unlock-initial>Desbloquear aparelho</button></section>';root.querySelector('[data-unlock-initial]').onclick=()=>initialize();}
initialize();

async function registration(role){
 const currentRole=localStorage.getItem(roleKey),token=localStorage.getItem(tokenKey);
 if(!token)return notify('Entre na sua conta para registrar o serviço.');
 if(currentRole==='admin')return window.openService();
 if(!['employee','seller'].includes(currentRole))return notify('Entre com uma conta de funcionário ou vendedor.');
 role=currentRole;
 if(locked)throw Error(preparationIssue?.status===403?'O acesso desta conta não foi autorizado. Procure o administrador.':'Desbloqueie o aparelho para registrar o serviço.');
 if(!allowed()||profile?.role!==role){
  if(navigator.onLine){
   try{await prepare(true);}catch(error){
    if(token!==localStorage.getItem(tokenKey)||role!==localStorage.getItem(roleKey))throw Error('A conta mudou. Abra o formulário novamente.');
    if([401,403].includes(error.status)||locked)throw Error(error.status===401?'Entre novamente para registrar o serviço.':error.message);
    if(typeof onlineTeamRegistration!=='function')throw error;
    onlineTeamRegistration(role);
    const form=document.getElementById('editForm');
    if(form&&!form.querySelector('[data-online-registration]')){const note=document.createElement('p');note.className='offline-banner';note.dataset.onlineRegistration='';note.textContent='Registro online: aguarde a confirmação do sistema antes de fechar este formulário. O modo offline será preparado automaticamente quando estiver disponível.';form.querySelector('.modal-body')?.prepend(note);}
    return;
   }
  }else throw Error('Este aparelho ainda não recebeu os dados desta conta. Conecte-se uma vez para carregá-los automaticamente; não é necessário preparar manualmente.');
 }
 if(token!==localStorage.getItem(tokenKey)||role!==localStorage.getItem(roleKey))throw Error('A conta mudou. Abra o formulário novamente.');
 assertAllowed();
 const formAccount=active;
 const key=`draft:${active}:create`,draft=await vault.get(key)||{date:new Date().toISOString().slice(0,10),items:[{type:'',kg:'',qty:1}]};
 draft.serviceId ||= crypto.randomUUID();
 const fields=[['clientName','Cliente / empresa'],['clientPhone','Telefone'],['clientEmail','E-mail'],['serviceType','Nome do serviço'],['date','Data'],['serviceAmount','Valor que você cobrará do cliente (opcional, R$)'],['parts','Peças previstas']];
 const row=item=>`<div class="offline-equipment-row"><input data-type list="offlineTypes" aria-label="Tipo de equipamento" placeholder="Tipo" required value="${esc(item.type)}"><input data-kg aria-label="Peso ou capacidade" placeholder="Peso / capacidade" value="${esc(item.kg)}"><input data-qty aria-label="Quantidade" type="number" min="1" max="50" required value="${item.qty || 1}"><button type="button" class="icon-btn" data-remove-row>Remover</button></div>`;
 openModal('Registrar ordem de serviço',`<p>O rascunho é salvo neste aparelho enquanto você preenche. A confirmação do sistema aparecerá depois do envio. Você paga à Protec a tarifa interna definida pelo administrador; o preço do seu cliente é livre e não altera essa cobrança.</p><p class="offline-save-state" data-draft-state>Rascunho recuperado</p><datalist id="offlineTypes">${[...new Set(profile.types.map(t=>t.name))].map(t=>`<option>${esc(t)}</option>`).join('')}</datalist><div class="offline-grid">${fields.map(([name,label])=>`<label>${label}<input name="${name}" ${name==='serviceType'||name==='date'?'required':''} type="${name==='date'?'date':name==='clientEmail'?'email':name==='serviceAmount'?'number':'text'}" ${name==='serviceAmount'?'min="0" max="1000000" step="0.01"':''} maxlength="${name==='parts'?1000:254}" value="${esc(draft[name] || '')}"></label>`).join('')}</div><h3>Equipamentos</h3><div data-equipment-rows>${draft.items.map(row).join('')}</div><button type="button" class="btn btn-soft btn-small" data-add-row>Adicionar equipamento</button><label class="form-field">Observações<textarea name="notes" maxlength="3000" rows="4">${esc(draft.notes || '')}</textarea></label>`,async()=>{if(active!==formAccount)throw Error('Reabra o rascunho na conta de origem.');await saves;const payload=collect();await enqueue('create',draft.serviceId || crypto.randomUUID(),payload);await vault.remove(key);notify('Ordem salva no aparelho. Acompanhe a confirmação em Pendências.');return true},'Registrar ordem');
 const form=document.getElementById('editForm'),state=form.querySelector('[data-draft-state]');let saves=Promise.resolve();
 const collect=()=>({serviceId:draft.serviceId,...Object.fromEntries(fields.map(([name])=>[name,form.elements[name].value.trim()])),notes:form.elements.notes.value,items:[...form.querySelectorAll('.offline-equipment-row')].map(r=>({type:r.querySelector('[data-type]').value.trim(),kg:r.querySelector('[data-kg]').value.trim(),qty:Number(r.querySelector('[data-qty]').value)}))});
 const save=()=>{const value=collect();state.textContent='Salvando rascunho…';saves=saves.catch(()=>{}).then(()=>vault.put(key,value)).then(()=>state.textContent='Rascunho salvo neste aparelho').catch(e=>{state.textContent=friendly(e);throw e});saves.catch(()=>{})};
 const bind=()=>form.querySelectorAll('[data-remove-row]').forEach(b=>b.onclick=()=>{b.parentElement.remove();save()});bind();form.querySelector('[data-add-row]').onclick=()=>{form.querySelector('[data-equipment-rows]').insertAdjacentHTML('beforeend',row({}));bind();save()};form.addEventListener('input',save);form.addEventListener('change',save);
}
async function technical(service){
 assertAllowed();if(isPaused(service))throw Error('Retome o serviço antes de registrar peças e vídeos.');
 const key=`draft:${active}:technical:${service.id}`,draft=await vault.get(key)||{items:service.items.map(i=>({notes:i.notes || '',parts:i.replacedParts || [],videos:{}}))},parts=[...new Set([...PART_NAMES,...profile.costCatalog.map(i=>i.name)])];
 draft.basis ||= basisFor(service.id);
 openModal('Peças, notas e vídeos · '+esc(service.code),`<p>Cada peça trocada precisa de seu próprio vídeo, com até 60 segundos e 50 MB. Escolha vídeos já disponíveis no aparelho.</p><p class="offline-save-state" data-draft-state>Dados recuperados do aparelho</p>${service.items.map((item,i)=>`<section class="offline-form-section" data-technical-item="${i}"><h3>Equipamento ${i+1} · ${esc(item.type)} ${esc(item.kg || '')}</h3><label>Observação técnica<textarea data-notes maxlength="3000">${esc(draft.items[i]?.notes || '')}</textarea></label><div class="offline-parts">${parts.map(part=>`<label><input type="checkbox" data-piece="${esc(part)}" ${draft.items[i]?.parts?.includes(part)?'checked':''}>${window.protecArtwork.artwork({name:part},'tiny')}<span>${esc(part)}</span></label>`).join('')}</div><div data-video-slots></div></section>`).join('')}`,async()=>{
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
const shellVersion='registration-recovery-26';
async function prepareShell(account=''){
 if(shellPreparing)return shellPreparing;
 if(shellReady&&(await vault.get('shell:'+account))?.version===shellVersion)return;
 shellPreparing=(async()=>{
  await navigator.storage?.persist?.().catch(()=>false);
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
 for(const op of adminPending())try{applyAdminChanges(next,op.preview||op.changes,{force:true,canonical:true});}catch{/* The operation stays in the review queue, never silently discarded. */}
 return next;
}
async function adminHydrate(){
 const hydrateCache=async()=>{
 const persisted=await vault.get('admin-profile');
 if(Number(persisted?.state?.__rev||0)>Number(adminBase?.__rev||0))adminBase=structuredClone(persisted.state);
 adminOps=(await Promise.all((await vault.keys(adminPrefix)).map(k=>vault.get(k)))).filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 adminResults={};for(const op of adminOps){const r=await vault.get('result:'+adminAccount+':'+op.id);if(r)adminResults[op.id]=r;}
 for(const op of adminOps){const r=adminResults[op.id];if(r?.ok&&Number(r.revision)>Number(adminBase?.__rev||0)){applyAdminChanges(adminBase,r.delta,{force:true,canonical:true});adminLastSync=r.serverAt;}}
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
 let bar=document.getElementById('adminOfflineToolbar');if(!bar){bar=document.createElement('section');bar.id='adminOfflineToolbar';bar.className='offline-toolbar';host.before(bar);}
 const pending=adminPending(),conflicts=pending.filter(o=>adminResults[o.id]?.conflict),title=adminNeedsLogin?'Acesso local disponível · entre novamente para enviar':!navigator.onLine?'Sem conexão · salvando neste aparelho':adminBusy?'Enviando alterações…':pending.length?'Alterações salvas neste aparelho':'Dados confirmados no sistema';
 const signature=JSON.stringify([title,pending.length,conflicts.length,adminLastSync,shellReady,shellError,locked]);if(bar.dataset.state===signature)return;bar.dataset.state=signature;
 bar.innerHTML=`<div><strong>${esc(title)}</strong><p>${pending.length?pending.length+' alteração(ões) aguardando confirmação.':'Nenhum envio pendente.'}${conflicts.length?' '+conflicts.length+' precisa(m) de revisão.':''}</p><p>${shellReady?'Telas disponíveis offline.':'Preparando telas automaticamente… '+esc(shellError)} Acesso local mantido até sair da conta.</p><p>Última confirmação: ${adminLastSync?esc(new Date(adminLastSync).toLocaleString('pt-BR')):'ainda não há envios neste aparelho'}</p></div><div class="offline-actions"><button type="button" class="btn btn-small btn-soft" data-admin-queue>Pendências${pending.length?' ('+pending.length+')':''}</button>${adminNeedsLogin?'<button type="button" class="btn btn-small" data-admin-login>Entrar novamente</button>':''}</div>`;
 bar.querySelector('[data-admin-queue]').onclick=adminQueue;
 bar.querySelector('[data-admin-login]')?.addEventListener('click',()=>{window.logout();window.showLogin();});
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
 const op={id:crypto.randomUUID(),deviceId:await deviceId(),accountKey:adminAccount,serviceId:'admin-state',kind,createdAt:new Date(lastStamp=Math.max(Date.now(),lastStamp+1)).toISOString(),payload:structuredClone(payload||{}),guards:adminGuards(shown,kind,payload||{})};
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
function adminSchedule(){
 if(!adminReady()||adminNeedsLogin)return;
 if(vault.native()){
  if(navigator.onLine)verifyAdminOfflineBackend(adminAuth).then(s=>{if(s&&adminReady())nativeCall('sync',{accountKey:adminAccount}).catch(()=>{});}).catch(()=>{});
  else nativeCall('sync',{accountKey:adminAccount}).catch(()=>{});
 }
 else if(navigator.onLine)setTimeout(()=>adminSync().catch(()=>{}),80);
}
async function adminRefresh(){
 if(!adminReady()||!navigator.onLine||adminRefreshBusy)return;
 adminRefreshBusy=true;const token=adminAuth;
 try{
  const r=await network('/api/offline/admin/bootstrap'),data=await r.json();if(token!==adminAuth||!adminReady())return;
  if([401,403].includes(r.status)){adminNeedsLogin=true;return;}if(r.status===404){adminApiUnavailable=true;renderAvailability();return;}if(!r.ok)throw Error(data.error);
  adminApiUnavailable=false;renderAvailability();
  await adminRun(async()=>{
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
    if(!adminReady()||adminAuth!==token||adminResults[op.id]?.conflict)break;
    const r=await network('/api/offline/admin/sync',{method:'POST',body:JSON.stringify(op),headers:{Authorization:'Bearer '+token}}),data=await r.json();
    if(adminAuth!==token||!adminReady())break;
    if([401,403].includes(r.status)&&!data.conflict){adminNeedsLogin=true;break;}
    if(r.status===404&&!data.conflict){adminApiUnavailable=true;adminCapabilityToken=token;adminCapabilityAt=Date.now();adminCapabilityState=null;renderAvailability();break;}
    if(!r.ok){if(data.conflict||[400,404].includes(r.status))await vault.put('result:'+adminAccount+':'+op.id,{...data,conflict:true});break;}
    await vault.batch([{key:'result:'+adminAccount+':'+op.id,value:data},{key:'last-sync:'+adminAccount,value:{at:data.serverAt}}]);
    await adminRun(()=>adminHydrate());
   }
  }catch{/* Retry on reconnect; the immutable operation remains in the vault. */}finally{adminBusy=false;adminRender();}
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
  if(cachedRead){const cached=await vault.get('read:'+account+':'+path);if(cached)return reply({...cached.data,offlineSnapshot:true,checkedAt:cached.at});}
  if(admin&&method==='GET'){const cached=await vault.get('read:'+adminAccount+':'+path);if(cached)return reply(cached.data);}
  throw error;
 }
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
window.adminOffline={get ready(){return adminReady();},get pending(){return adminPending().length;},show:adminShow,sync:adminSync,capture:adminAccept,overlay(state){return state?.__offlineLocal?structuredClone(adminView):adminProject(state);}};
window.addEventListener('online',()=>{if(adminReady()){adminNeedsLogin=false;prepareShell(adminAccount).catch(()=>{});adminSync().catch(()=>{});}adminRender();});
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
