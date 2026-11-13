import './service-management.mjs?v=valve-art-21';
import {vault,nativeCall} from './offline-vault.mjs';
import {applyOperation,replayLocal,isPaused} from './offline-rules.mjs';
import {PART_NAMES,completed,cancelled} from './service-rules.mjs';

const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./offline-services.css',import.meta.url);document.head.append(css);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tokenKey='protecextintores_session',roleKey='protecextintores_role';
const base=String(window.API_BASE_URL || (typeof API_BASE_URL!=='undefined'?API_BASE_URL:''));
const rawApi=window.apiCall;
let profile=null,ops=[],results={},services=[],active='',preparing=null,syncing=false,renderTimer,tab='active',query='',locked=false,offline=false,needsLogin=false,serial=Promise.resolve(),lastStamp=0,submissionBasis=null,accountToken='',nativeSyncing=false,nativeKind='';
const names={create:'Nova ordem',technical:'Peças e observações',painting:'Pintura',stage:'Etapa',pause:'Pausa',resume:'Retomada',media:'Vídeo de peça',complete:'Conclusão da execução'};
function summary(op){const p=op.payload || {};return `<dl>${[['Cliente',p.clientName],['Serviço',p.serviceType],['Data',p.date],['Motivo',p.reason],['Etapa',p.status],['Observações',p.notes],['Pinturas',p.quantity],['Equipamento',Number.isInteger(p.itemIndex)?p.itemIndex+1:null],['Peças',p.parts?.join?.(', ') || (typeof p.parts==='string'?p.parts:'')],['Peça do vídeo',p.part],['Arquivo',p.name]].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}${Array.isArray(p.items)?`<dt>Equipamentos</dt><dd>${p.items.map(i=>`${esc(i.type)} ${esc(i.kg)} × ${i.qty}`).join('<br>')}</dd>`:''}</dl>`}
function basisFor(id){return{serviceId:id,accountKey:active,baseVersion:services.find(s=>s.id===id)?.syncVersion || '',previousId:ops.filter(o=>o.serviceId===id&&!results[o.id]?.ok&&!results[o.id]?.discarded).at(-1)?.id || ''}}
const statusOf=s=>cancelled(s)?'Cancelado':s.closed?'Revisado pelo administrador':s.localCompleted?'Concluído no aparelho':s.employeeCompletedAt?'Recebido · aguardando revisão':isPaused(s)?'Pausado':s.status || 'Solicitado';
const opPrefix=()=>`op:${active}:`,resultKey=id=>`result:${active}:${id}`;
const notify=message=>window.toast?.(message);
const friendly=error=>/quota|space|disk/i.test(error?.message || '')?'Não há espaço suficiente no aparelho. O registro não foi confirmado.':error?.message || 'Não foi possível salvar no aparelho.';
const reply=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
async function network(path,options={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.body instanceof FormData?180000:15000);try{return await fetch(base+path,{...options,signal:controller.signal,headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+(localStorage.getItem(tokenKey)||''),...options.headers}})}finally{clearTimeout(timer)}}
const withSerial=fn=>{const task=serial.then(fn);serial=task.catch(()=>{});return task};
async function hydrate(){
  if(!active)return;
  profile=await vault.get('profile:'+active);if(!profile)return;
  accountToken=(await vault.get('auth:'+active))?.token || '';
  if(vault.native()){const nativeState=await vault.get('sync-state:'+active);if(nativeState?.needsLogin)needsLogin=true;nativeSyncing=Boolean(nativeState?.syncing&&Date.now()-nativeState.at<300000);nativeKind=nativeState?.kind || '';}
  ops=await Promise.all((await vault.keys(opPrefix())).map(k=>vault.get(k)));ops=ops.filter(Boolean).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  results={};for(const op of ops){const r=await vault.get(resultKey(op.id));if(r)results[op.id]=r}
  const current=structuredClone(profile);
  for(const op of ops){const r=results[op.id];if(r?.ok&&r.service&&r.serverAt>profile.preparedAt){const i=current.services.findIndex(s=>s.id===r.service.id);if(i<0)current.services.push(r.service);else current.services[i]=r.service}}
  services=replayLocal(current,ops,results);
  if(window.employeePortalState&&profile.role==='employee')window.employeePortalState.services=services;
  if(window.sellerPortalState&&profile.role==='seller')window.sellerPortalState.services=services;
  scheduleRender();
}
function allowed(){return profile&&!locked&&accountToken===localStorage.getItem(tokenKey)&&Date.now()<Date.parse(profile.offlineUntil)}
function assertAllowed(){if(!allowed())throw Error(locked?'Desbloqueie o aparelho para continuar.':'O acesso offline venceu. Conecte-se e entre novamente; seus rascunhos estão preservados.')}
async function prepare(quiet=false){
  if(preparing){const data=await preparing;if(quiet)return data;return prepare(false)}
  preparing=(async()=>{
    const preparingToken=localStorage.getItem(tokenKey),r=await network('/api/offline/bootstrap');const data=await r.json();
    if(localStorage.getItem(tokenKey)!==preparingToken)throw Error('A conta mudou durante a atualização. Tente novamente.');
    if(!r.ok){if([401,403].includes(r.status))needsLogin=true;if(r.status===403){locked=true;scheduleRender()}throw Error(data.error || 'Entre novamente para preparar o aparelho.')}
    active=data.accountKey;profile=data;offline=false;needsLogin=false;
    await vault.put('profile:'+active,data);await vault.put('active',{accountKey:active});
    await vault.put('auth:'+active,{token:localStorage.getItem(tokenKey),accountKey:active});
    await vault.put('sync-state:'+active,{needsLogin:false});
    await hydrate();
    // Once a fresh server snapshot contains a confirmed action, its local receipt
    // no longer needs to carry a full service copy. Draft dependencies are preserved.
    const draftText=(await Promise.all((await vault.keys('draft:'+active+':')).map(k=>vault.get(k)))).map(d=>JSON.stringify(d)).join('\n');
    for(const op of ops){const result=results[op.id],included=data.services.some(s=>s.id===op.serviceId&&s.history?.some(event=>event.operationId===op.id));if(result?.ok&&included&&result.serverAt<=data.preparedAt&&!draftText.includes(op.serviceId)&&!draftText.includes(op.payload.blobKey || '\u0000')){await vault.remove(opPrefix()+op.id);await vault.remove(resultKey(op.id));}}
    await hydrate();
    if(!quiet){
      await navigator.storage?.persist?.().catch(()=>false);
      if(!('serviceWorker' in navigator))throw Error('Este navegador não permite preparar as telas offline. Use o APK atualizado.');
      const reg=await navigator.serviceWorker.register(new URL('./sw.js',import.meta.url));await navigator.serviceWorker.ready;
      await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('A preparação das telas ainda não terminou. Tente novamente com internet.')),60000);channel.port1.onmessage=e=>{clearTimeout(timer);e.data.ok?resolve():reject(Error(e.data.error || 'Falha ao preparar as telas.'))};(reg.active || navigator.serviceWorker.controller).postMessage({type:'PREPARE_OFFLINE'},[channel.port2])});
      await vault.put('shell:'+active,{at:new Date().toISOString()});notify('Aparelho preparado. Os serviços atribuídos já podem ser consultados sem internet.');
    }
    scheduleRender();return data;
  })().finally(()=>preparing=null);return preparing;
}
async function enqueue(kind,serviceId,payload,basis=null){basis ||= submissionBasis?.serviceId===serviceId?submissionBasis:null;const account=active;return withSerial(async()=>{
  assertAllowed();await hydrate();
  if(active!==account || basis?.accountKey&&basis.accountKey!==active)throw Error('A conta mudou. Reabra o registro na conta de origem.');
  if(kind==='media'){const already=ops.find(o=>o.kind==='media'&&o.serviceId===serviceId&&o.payload.itemIndex===payload.itemIndex&&o.payload.part===payload.part&&o.payload.blobKey===payload.blobKey&&!results[o.id]?.discarded);if(already)return already;}
  const prior=ops.filter(o=>o.serviceId===serviceId&&!results[o.id]?.ok&&!results[o.id]?.discarded).at(-1);
  const current=services.find(s=>s.id===serviceId);
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
      const r=await network(path,{method:'POST',body,headers:{Authorization:'Bearer '+syncToken}}),data=await r.json();
      if(active!==syncAccount)break;
      if(r.status===401||r.status===403&&!data.conflict){needsLogin=true;break}
      if(!r.ok){if(data.conflict||r.status===400||r.status===404){await vault.put(resultKey(op.id),{error:data.error,conflict:true,current:data.current || null});blocked.add(op.serviceId)}else break}
      else{await vault.put(resultKey(op.id),data);if(op.kind==='media')await vault.remove(op.payload.blobKey)}
      await hydrate();
    }offline=false}catch(error){offline=true;notify(error.message || 'Envio interrompido. Os registros continuam no aparelho.')}finally{syncing=false;scheduleRender()}
  };
  if(navigator.locks)await navigator.locks.request('protec-sync:'+active,{ifAvailable:true},lock=>lock?work():undefined);else await work();
}
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(render,40)}
function render(){
  if(!profile||!active||localStorage.getItem(roleKey)!==profile.role||accountToken!==localStorage.getItem(tokenKey))return;
  const root=document.getElementById('employeePortal');if(!root||root.classList.contains('hidden'))return;
  document.getElementById('sessionRestoreNotice')?.remove();
  root.classList.add('offline-enabled');
  if(locked){if(!root.querySelector('[data-offline-locked]')){root.innerHTML='<section class="offline-locked" data-offline-locked><h1>Acesso bloqueado</h1><p>Desbloqueie o aparelho para consultar os serviços.</p><button class="btn" id="offlineUnlock">Desbloquear</button><button class="btn btn-soft" onclick="logout()">Sair da conta</button></section>';root.querySelector('#offlineUnlock').onclick=async()=>{try{await nativeCall('unlock');locked=false;showPortal()}catch(e){notify(e.message)}}}return}
  let bar=root.querySelector('#offlineToolbar');if(!bar){bar=document.createElement('section');bar.id='offlineToolbar';bar.className='offline-toolbar';root.querySelector('main')?.prepend(bar)}
  const pending=ops.filter(o=>!results[o.id]?.ok&&!results[o.id]?.discarded),videos=pending.filter(o=>o.kind==='media'),errors=pending.filter(o=>results[o.id]?.conflict);
  const label=needsLogin?'Entre novamente para enviar':!allowed()?'Acesso offline vencido':offline||!navigator.onLine?'Sem conexão · salvando no aparelho':syncing||nativeSyncing?nativeKind==='media'?'Enviando vídeos…':'Enviando registros…':'Acesso ao trabalho offline';
  const signature=JSON.stringify([label,pending.length,videos.length,errors.length,profile.preparedAt]);
  if(bar.dataset.state!==signature){bar.dataset.state=signature;bar.innerHTML=`<div><strong>${esc(label)}</strong><p>${new Set(pending.map(o=>o.serviceId)).size} ordem(ns) e ${videos.length} vídeo(s) aguardando envio${errors.length?' · '+errors.length+' precisa(m) de revisão':''}</p><p>Dados conferidos em ${esc(new Date(profile.preparedAt).toLocaleString('pt-BR'))} · acesso até ${esc(new Date(profile.offlineUntil).toLocaleString('pt-BR'))}</p></div><div class="offline-actions"><button type="button" class="btn btn-small" data-offline-action="prepare">Preparar offline</button><button type="button" class="btn btn-small btn-soft" data-offline-action="sync">Sincronizar agora</button><button type="button" class="btn btn-small btn-soft" data-offline-action="queue">Pendências</button>${vault.native()?'<button type="button" class="btn btn-small btn-soft" data-offline-action="lock">Bloqueio do aparelho</button>':''}${needsLogin?'<button type="button" class="btn btn-small btn-soft" data-offline-action="login">Entrar novamente</button>':''}</div>`;bar.querySelectorAll('[data-offline-action]').forEach(b=>b.onclick=()=>action(b.dataset.offlineAction))}
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
  const own=services,available=(!offline&&navigator.onLine?profile.available || []:[]),all=own.concat(available),list=all.filter(s=>tab==='history'?completed(s)||cancelled(s):tab==='paused'?isPaused(s):!completed(s)&&!cancelled(s)&&!isPaused(s));
  const signature=JSON.stringify([all,tab,query,results]);if(host.dataset.offlineState===signature&&host.querySelector('[data-offline-workbench]'))return;host.dataset.offlineState=signature;
  host.innerHTML=`<div data-service-workbench data-offline-workbench><div class="offline-tabs">${[['active','Em execução / disponíveis'],['paused','Pausados'],['history','Meu histórico']].map(([key,label])=>`<button type="button" class="btn btn-soft btn-small" data-tab="${key}" aria-pressed="${tab===key}">${label}</button>`).join('')}</div><label>Buscar serviço<input class="offline-search" type="search" value="${esc(query)}" data-offline-search></label>${list.map(s=>`<article class="employee-service" data-offline-service="${esc(s.id)}"><header class="employee-service-head"><div><b>${esc(s.code)}</b><p>${esc(s.clientName || 'Cliente não informado')} · ${esc(s.serviceType)}</p></div><span class="offline-badge ${s.localPending?'is-pending':''}">${esc(statusOf(s))}</span></header><div class="employee-service-body service-detail-item"><p>${s.items.length} equipamento(s) · ${s.paintingQuantity || 0} pintura(s)</p>${s.localPending?'<p class="offline-state">Salvo neste aparelho · aguardando confirmação do sistema</p>':''}${isPaused(s)?`<p>Pausa: ${esc(s.pauseReason)} · ${esc(new Date(s.pausedAt).toLocaleString('pt-BR'))}</p>`:''}<div class="offline-actions offline-service-actions"><button type="button" class="btn btn-soft btn-small" data-action="details">Detalhes e histórico</button>${!s.employeeId?'<button type="button" class="btn btn-small" data-action="claim">Aceitar serviço</button>':!completed(s)&&!cancelled(s)?isPaused(s)?'<button type="button" class="btn btn-small" data-action="resume">Retomar serviço</button>':'<button type="button" class="btn btn-soft btn-small" data-action="pause">Pausar serviço</button><button type="button" class="btn btn-soft btn-small" data-action="technical">Peças, notas e vídeos</button><button type="button" class="btn btn-soft btn-small" data-action="painting">Quantidade de pinturas</button><button type="button" class="btn btn-soft btn-small" data-action="stage">Atualizar etapa</button><button type="button" class="btn btn-small" data-action="complete">Concluir execução</button>':''}</div></div></article>`).join('') || '<p class="empty">Nenhum serviço neste filtro.</p>'}</div>`;
  host.querySelectorAll('[data-tab]').forEach(b=>{const key=b.dataset.tab,count=all.filter(s=>key==='history'?completed(s)||cancelled(s):key==='paused'?isPaused(s):!completed(s)&&!cancelled(s)&&!isPaused(s)).length;b.setAttribute('aria-label',b.textContent);b.insertAdjacentHTML('beforeend',` <span aria-hidden="true">(${count})</span>`);b.onclick=()=>{tab=key;renderWorkbench()}});
  const search=host.querySelector('[data-offline-search]');const filter=()=>host.querySelectorAll('[data-offline-service]').forEach(card=>card.hidden=!card.textContent.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));search.oninput=()=>{query=search.value;filter()};filter();
  host.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>staffAction(b.dataset.action,b.closest('[data-offline-service]').dataset.offlineService).catch(e=>notify(friendly(e))));
}
async function staffAction(action,id){
  const s=services.find(s=>s.id===id)||(profile.available || []).find(s=>s.id===id);if(!s)return;
  if(action==='details')return details(s);
  assertAllowed();
  if(action==='claim'){await sync();await hydrate();if(ops.some(o=>o.kind==='pause'&&!results[o.id]?.ok&&!results[o.id]?.discarded))throw Error('A pausa está salva. Aguarde a confirmação do envio antes de aceitar outro serviço.');const r=await rawApi('/api/employee/claim','POST',{serviceId:id}),d=await r.json();if(!r.ok)throw Error(d.error);await prepare(true);render();return}
  if(action==='technical')return technical(s);
  if(action==='pause')return serviceModal(id,'Pausar serviço · '+esc(s.code),'<p>As etapas e os anexos serão preservados. Depois da pausa, você poderá iniciar outro atendimento.</p><label class="form-field">Motivo da pausa<textarea name="reason" required minlength="3" maxlength="500" placeholder="Ex.: atendimento urgente em outro cliente"></textarea></label>',async f=>{await enqueue('pause',id,{reason:f.get('reason')});notify('Pausa salva no aparelho.');return true},'Pausar serviço');
  if(action==='resume'){await enqueue('resume',id,{});notify('Serviço retomado.');return}
  if(action==='painting')return serviceModal(id,'Quantidade de pinturas',`<label class="form-field">Quantos equipamentos receberam pintura?<input type="number" name="quantity" required min="0" max="${s.items.length}" step="1" value="${s.paintingQuantity || 0}"></label><p>Informe zero se não houve pintura.</p>`,async f=>{await enqueue('painting',id,{quantity:Number(f.get('quantity'))});return true},'Salvar quantidade');
  if(action==='stage')return serviceModal(id,'Atualizar etapa',`<label class="form-field">Etapa<select name="status">${profile.settings.stages.filter(st=>!['Concluído','Solicitado','Aguardando peça'].includes(st)).map(st=>`<option ${st===s.status?'selected':''}>${esc(st)}</option>`).join('')}</select></label>`,async f=>{await enqueue('stage',id,{status:f.get('status')});return true});
  if(action==='complete')return serviceModal(id,'Concluir execução',`<p>Confirme a quantidade de pinturas. Os vídeos obrigatórios precisam estar guardados no aparelho antes de concluir.</p><label class="form-field">Quantidade de pinturas<input name="quantity" type="number" min="0" max="${s.items.length}" required value="${s.paintingQuantity || 0}"></label><p>A conclusão ficará pendente até o sistema receber os registros e vídeos. A aprovação será feita pelo administrador.</p>`,async f=>{await enqueue('painting',id,{quantity:Number(f.get('quantity'))});await enqueue('complete',id,{});notify('Conclusão salva. O envio e a revisão podem ser acompanhados nas pendências.');return true},'Concluir no aparelho');
}
function details(s){
  openModal('Detalhes · '+esc(s.code),`<p><b>${esc(statusOf(s))}</b> · ${esc(s.clientName)}</p><p>${esc(s.notes || '')}</p>${s.items.map((item,i)=>`<section class="offline-item"><h3>Equipamento ${i+1} · ${esc(item.type)} ${esc(item.kg || '')}</h3><p>${esc(item.notes || '')}</p><p>Peças: ${esc((item.replacedParts || []).join(', ') || 'Nenhuma')}</p>${Object.entries(item.replacementMedia || {}).map(([part,media])=>`<p>${esc(part)} <button type="button" class="btn btn-soft btn-small" data-watch="${esc(media.url)}" data-part="${esc(part)}">Assistir vídeo</button></p>`).join('')}</section>`).join('')}<details class="offline-details" open><summary>Histórico do serviço</summary><ol>${(s.history || []).map(e=>`<li><b>${esc(e.action || e.status)}</b> · ${esc(new Date(e.at).toLocaleString('pt-BR'))}<br>${esc(e.description || '')} ${esc(e.by || '')}</li>`).join('')}</ol></details>`,()=>true,'Fechar');
  document.querySelectorAll('[data-watch]').forEach(b=>b.onclick=async()=>{try{const url=b.dataset.watch;let blob;if(url.startsWith('local:')){const op=ops.find(o=>o.id===url.slice(6));if(!op)throw Error('Vídeo não encontrado no aparelho.');blob=await vault.blobGet(op.payload.blobKey,op.payload.mime)}else{const parsed=new URL(url),api=new URL(base);if(parsed.origin!==api.origin||!parsed.pathname.startsWith('/media/service-media/'))throw Error('Endereço de vídeo inválido.');const r=await network(parsed.pathname);if(!r.ok)throw Error('Conecte-se e entre novamente para assistir ao vídeo enviado.');blob=await r.blob()}const player=document.createElement('video');player.controls=true;player.playsInline=true;player.className='offline-video-preview';player.src=URL.createObjectURL(blob);b.replaceWith(player);player.addEventListener('emptied',()=>URL.revokeObjectURL(player.src),{once:true})}catch(e){notify(e.message)}});
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
window.logout=function(){window.closeModal?.();if(vault.native())nativeCall('logout').catch(()=>{});const old=active;if(old){vault.remove('auth:'+old).catch(()=>{});vault.put('active',null).catch(()=>{});if(vault.native())nativeCall('stopSync',{accountKey:old}).catch(()=>{})}active='';profile=null;services=[];ops=[];results={};originalLogout()};
window.apiCall=async function(path,method='GET',data=null){
 if(locked&&path==='/api/session')return new Response(JSON.stringify({error:'Desbloqueie o aparelho para abrir os serviços.'}),{status:403,headers:{'Content-Type':'application/json'}});
 const r=await rawApi(path,method,data).catch(async error=>{if(path==='/api/session'&&allowed())return reply({...profile,services});if(active&&['/api/employee/services','/api/seller/services'].includes(path)&&method==='GET'){offline=true;return reply({services})}throw error});
 if(path==='/api/login'&&r.ok){const d=await r.clone().json();if(['employee','seller'].includes(d.role)){localStorage.setItem(tokenKey,d.token);localStorage.setItem(roleKey,d.role);locked=false;await prepare(true);scheduleSync()}}
 if(path==='/api/session'&&r.ok){const d=await r.clone().json();if(['employee','seller'].includes(d.role)&&(!profile||profile.username!==d.username||accountToken!==localStorage.getItem(tokenKey)))await prepare(true);}
 if(path==='/api/session'&&r.status===401&&allowed()){needsLogin=true;return reply({...profile,services})}
 if(active&&accountToken===localStorage.getItem(tokenKey)&&method==='GET'&&['/api/employee/services','/api/seller/services'].includes(path)){if(r.ok){if(!preparing&&Date.now()-Date.parse(profile.preparedAt)>20000)prepare(true).catch(()=>{});return reply({services:profile.role==='employee'?services.concat(offline?[]:profile.available || []):services})}if(allowed())return reply({services})}
 return r;
};
window.openTeamMaintenanceForm=role=>registration(role);
window.renderEmployeeWorkbench=renderWorkbench;
window.refreshEmployeePortal=()=>prepare(true).catch(error=>notify(error.message));
window.employeeNote=(id)=>{const s=services.find(s=>s.id===id);if(s)technical(s).catch(e=>notify(friendly(e)))};
window.completeEmployeeService=id=>staffAction('complete',id);
window.chooseEmployeeNextStep=id=>staffAction('painting',id);
window.advanceEmployeeService=(id,status)=>enqueue('stage',id,{status});
window.acceptEmployeeService=id=>staffAction('claim',id);
window.offlineServices={prepare,sync,get services(){return services},get ready(){return Boolean(profile&&!locked&&accountToken===localStorage.getItem(tokenKey))},vault};
let lastNativeTheme='';
const syncNativeTheme=()=>{const mode=document.documentElement.dataset.theme==='dark'?'dark':'light';if(vault.native()&&mode!==lastNativeTheme){lastNativeTheme=mode;nativeCall('theme',{mode}).catch(()=>{});}};
new MutationObserver(syncNativeTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});syncNativeTheme();
const previousSettings=window.settings;
window.settings=function(container){previousSettings.apply(this,arguments);if(!container||container.querySelector('[data-offline-policy]'))return;const card=document.createElement('section');card.className='panel config-card';card.dataset.offlinePolicy='';card.innerHTML=`<h3>Acesso offline da equipe</h3><p>Defina por quanto tempo um aparelho preparado pode registrar serviços sem validar novamente o acesso. A sincronização sempre confere a conta no servidor.</p><form><label class="form-field">Prazo em horas (1 a 168)<input name="hours" type="number" min="1" max="168" step="1" required value="${Number(db.settings.offlineHours)||72}"></label><button class="btn btn-small">Salvar prazo offline</button></form>`;card.querySelector('form').onsubmit=async e=>{e.preventDefault();try{const hours=Number(new FormData(e.currentTarget).get('hours')),r=await network('/api/offline/policy',{method:'POST',body:JSON.stringify({hours})}),data=await r.json();if(!r.ok)throw Error(data.error);db.settings.offlineHours=hours;notify('Prazo atualizado. Será aplicado quando cada aparelho se conectar novamente.')}catch(error){notify(error.message)}};container.append(card)};
const previousServiceTable=window.serviceTable;
window.serviceTable=function(list){const template=document.createElement('template');template.innerHTML=previousServiceTable.apply(this,arguments);template.content.querySelectorAll('tbody tr').forEach(row=>{const service=list.find(s=>row.innerHTML.includes(s.id));if(service?.pausedAt&&!service.closed&&!service.employeeCompletedAt){const tag=document.createElement('p');tag.className='offline-badge is-pending';tag.textContent='Pausado · '+(service.pauseReason || 'Sem motivo informado');row.querySelector('td:last-child')?.prepend(tag)}});return template.innerHTML};
window.addEventListener('online',()=>{offline=false;prepare(true).then(()=>sync()).catch(()=>scheduleRender())});
window.addEventListener('offline',()=>{offline=true;scheduleRender()});
window.addEventListener('protec-native-lock',()=>{locked=true;scheduleRender()});
window.addEventListener('protec-native-unlock',()=>{locked=false;if(profile)showPortal();else initialize()});
new MutationObserver(()=>{const root=document.getElementById('employeePortal');if(profile&&root&&!root.classList.contains('hidden')&&(!root.querySelector('#offlineToolbar')||profile.role==='employee'&&!root.querySelector('[data-offline-service]')))scheduleRender()}).observe(document.getElementById('employeePortal'),{childList:true,subtree:true});
setInterval(()=>{if(active&&!document.hidden)hydrate().catch(()=>{});},3000);
setInterval(()=>{if(active&&!document.hidden&&navigator.onLine&&!locked)prepare(true).then(()=>sync()).catch(()=>{});},45000);
async function initialize(){try{if(vault.native()){const state=await nativeCall('lockState');locked=state.locked;if(locked){await nativeCall('unlock');locked=false}}const saved=await vault.get('active');active=saved?.accountKey || '';if(active){await hydrate();if(profile&&localStorage.getItem(tokenKey)){if(allowed())await showPortal()}else active=''}}catch(error){notify(friendly(error));if(locked)showInitialLock()}finally{window.protecOfflineLoaded=true;window.dispatchEvent(new Event('protec-offline-ready'));if(!locked&&localStorage.getItem(tokenKey)&&['employee','seller'].includes(localStorage.getItem(roleKey)))prepare(true).then(()=>{showPortal();scheduleSync()}).catch(()=>scheduleRender());}}
function showInitialLock(){for(const id of ['store','login','dashboard'])document.getElementById(id)?.classList.add('hidden');const root=document.getElementById('employeePortal');root.classList.remove('hidden');root.innerHTML='<section class="offline-locked"><h1>ProtecExtintores</h1><p>Desbloqueie o aparelho para abrir seus serviços.</p><button type="button" class="btn" data-unlock-initial>Desbloquear aparelho</button></section>';root.querySelector('[data-unlock-initial]').onclick=()=>initialize();}
initialize();

async function registration(role){
 if(!profile||profile.role!==role)return notify('Entre na sua conta e prepare o aparelho com internet primeiro.');
 const formAccount=active;
 const key=`draft:${active}:create`,draft=await vault.get(key)||{date:new Date().toISOString().slice(0,10),items:[{type:'',kg:'',qty:1}]};
 draft.serviceId ||= crypto.randomUUID();
 const fields=[['clientName','Cliente / empresa'],['clientPhone','Telefone'],['clientEmail','E-mail'],['serviceType','Nome do serviço'],['date','Data'],['serviceAmount','Valor do serviço (R$)'],['parts','Peças previstas']];
 const row=item=>`<div class="offline-equipment-row"><input data-type list="offlineTypes" aria-label="Tipo de equipamento" placeholder="Tipo" required value="${esc(item.type)}"><input data-kg aria-label="Peso ou capacidade" placeholder="Peso / capacidade" value="${esc(item.kg)}"><input data-qty aria-label="Quantidade" type="number" min="1" max="50" required value="${item.qty || 1}"><button type="button" class="icon-btn" data-remove-row>Remover</button></div>`;
 openModal('Registrar ordem de serviço',`<p>O rascunho é salvo neste aparelho enquanto você preenche. A confirmação do sistema aparecerá depois do envio.</p><p class="offline-save-state" data-draft-state>Rascunho recuperado</p><datalist id="offlineTypes">${[...new Set(profile.types.map(t=>t.name))].map(t=>`<option>${esc(t)}</option>`).join('')}</datalist><div class="offline-grid">${fields.map(([name,label])=>`<label>${label}<input name="${name}" ${name==='serviceType'||name==='date'?'required':''} type="${name==='date'?'date':name==='clientEmail'?'email':name==='serviceAmount'?'number':'text'}" ${name==='serviceAmount'?'min="0" max="1000000" step="0.01"':''} maxlength="${name==='parts'?1000:254}" value="${esc(draft[name] || '')}"></label>`).join('')}</div><h3>Equipamentos</h3><div data-equipment-rows>${draft.items.map(row).join('')}</div><button type="button" class="btn btn-soft btn-small" data-add-row>Adicionar equipamento</button><label class="form-field">Observações<textarea name="notes" maxlength="3000" rows="4">${esc(draft.notes || '')}</textarea></label>`,async()=>{if(active!==formAccount)throw Error('Reabra o rascunho na conta de origem.');await saves;const payload=collect();await enqueue('create',draft.serviceId || crypto.randomUUID(),payload);await vault.remove(key);notify('Ordem salva no aparelho. Acompanhe a confirmação em Pendências.');return true},'Registrar ordem');
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
