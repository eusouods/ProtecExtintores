import {mountDataTools} from './data-tools.mjs?v=protec-interface-65';
import './team-mobile.mjs';
import {mountWorkshop,bindWorkshopOrder,groupedEquipmentMarkup} from './workshop-ui.mjs?v=protec-interface-65';
import {equipmentGroups,powderCapacity} from './workshop-rules.mjs?v=protec-interface-65';
function complementaryWork(service){return service.complementaryServices?.length?'<h3>Serviços complementares</h3><ul>'+service.complementaryServices.map(row=>'<li><b>'+esc(row.name)+'</b> · '+esc(row.variant)+' · '+Number(row.quantity)+' unidade(s)'+Object.entries(row.parameters||{}).map(([key,value])=>' · '+esc(({lengthMeters:'Comprimento',widthCm:'Largura',diameterMm:'Diâmetro'})[key]||key)+': '+esc(value)+(key==='lengthMeters'?' m':key==='widthCm'?' cm':key==='diameterMm'?' mm':'')).join('')+'</li>').join('')+'</ul>':'';}
function suppliedEquipment(service){return service.soldExtinguishers?.length?'<h3>Extintores para fornecimento</h3><ul>'+service.soldExtinguishers.map(i=>'<li>'+esc(i.condition==='new'?'Novo lacrado · sem argola':'Seminovo revisado · com argola')+' · '+esc(i.type)+' '+esc(i.kg||'10 L')+' · '+i.quantity+' unidade(s)</li>').join('')+'</ul>':'';}
import {cancelled,completed,estimateFinance,localDay,missingVideos,billingOwner,teamDiscount,servicePolicy,employeeCreatedService} from './service-rules.mjs?v=protec-interface-65';
import {isPaused} from './offline-rules.mjs?v=protec-interface-65';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>(Number(value||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const day=value=>value?new Date(String(value).length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR'):'Não informado';
const instant=value=>value?new Date(value).toLocaleString('pt-BR'):'Não informado';
const role=()=>localStorage.getItem('protecextintores_role');
const eyeSvg='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const passwordButtons=new WeakMap();let passwordResize;
function positionPasswordEye(input){const button=passwordButtons.get(input);if(!button)return;button.style.left=Math.max(0,input.offsetLeft+input.offsetWidth-48)+'px';button.style.top=input.offsetTop+Math.max(0,(input.offsetHeight-44)/2)+'px';}
function passwordEyes(){
 document.querySelectorAll('input[type="password"]').forEach(input=>{
  if(input.hasAttribute('data-password-eye'))return;input.dataset.passwordEye='';input.parentElement.classList.add('password-visibility');
  // Keep the original input in its form. Moving password controls can cause the
  // browser's credential manager to clear an entry that is already being typed.
  const button=document.createElement('button');button.type='button';button.className='password-eye icon-btn';button.setAttribute('aria-label','Mostrar senha');button.setAttribute('aria-pressed','false');button.innerHTML=eyeSvg;input.after(button);passwordButtons.set(input,button);
  passwordResize ||= new ResizeObserver(entries=>entries.forEach(({target})=>{if(target.isConnected)positionPasswordEye(target);else passwordResize.unobserve(target);}));passwordResize.observe(input);positionPasswordEye(input);
  button.onmousedown=e=>e.preventDefault();button.onclick=()=>{const visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-pressed',String(visible));button.setAttribute('aria-label',visible?'Ocultar senha':'Mostrar senha');input.focus({preventScroll:true});};
 });
}
async function teamAccessList(roleName,hostId){
 const host=document.getElementById(hostId);if(!host||role()!=='admin')return;
 try{const r=await window.apiCall('/api/admin/'+(roleName==='employee'?'users':'sellers')),data=await r.json();if(!r.ok)throw Error(data.error);host.innerHTML=data.map(u=>`<div class="employee-user-row"><div><strong>${esc(u.employeeName||u.sellerName)}</strong><small>${esc(u.username)}</small></div><div class="ops-detail-actions"><button type="button" class="btn btn-soft btn-small" data-reset-access="${esc(u.id)}" data-username="${esc(u.username)}">Redefinir senha</button><button type="button" class="icon-btn" data-remove-access="${esc(u.id)}">Remover</button></div></div>`).join('')||'<p>Nenhum acesso criado.</p>';host.querySelectorAll('[data-reset-access]').forEach(b=>b.onclick=()=>resetTeamAccess(roleName,b.dataset.resetAccess,b.dataset.username));host.querySelectorAll('[data-remove-access]').forEach(b=>b.onclick=()=>roleName==='employee'?window.deleteEmployeeUser(b.dataset.removeAccess):window.deleteSellerUser(b.dataset.removeAccess));}catch(e){host.textContent=e.message;}
}
function resetTeamAccess(roleName,accountId,username){
 window.openModal('Redefinir acesso · '+esc(username),'<p>A nova senha substitui a anterior e encerra as sessões no servidor. Os registros offline da conta permanecem no aparelho e poderão ser enviados após entrar novamente.</p><label class="form-field">Nova senha (opcional)<input type="password" name="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Vazio gera uma senha de 16 caracteres"></label><p class="ops-note">Use o olho para conferir o que digitou. A senha nova será apresentada após a confirmação.</p>',async form=>{
  const password=String(form.get('password')||''),r=await window.apiCall('/api/admin/team-password','POST',{role:roleName,accountId,password,generate:!password}),data=await r.json();if(!r.ok)throw Error(r.status===404?'Publique a API atualizada para redefinir os acessos.':data.error);
  return{afterClose:()=>{
   window.openModal('Nova senha criada',`<p>Usuário: <strong>${esc(data.username)}</strong></p><label class="form-field">Nova senha<input type="password" readonly id="teamNewPassword" autocomplete="off"></label><button class="btn btn-soft btn-small" type="button" id="copyTeamNewPassword">Copiar senha</button><p class="ops-note">Confira e entregue a senha ao titular. Depois de fechar, você poderá redefinir novamente se necessário. A senha não fica disponível na lista de acessos.</p>`,()=>true,'Fechar');
   document.getElementById('teamNewPassword').value=data.password;passwordEyes();document.getElementById('copyTeamNewPassword').onclick=async()=>{try{await navigator.clipboard.writeText(data.password);window.toast('Senha copiada.');}catch{document.getElementById('teamNewPassword').select();window.toast('Selecione e copie a senha.');}};
   roleName==='employee'?window.loadEmployeeUsers():window.loadSellerUsers();
  }};
 },'Redefinir senha');
}
export const orderStatus=s=>cancelled(s)?'Cancelado':s.closed?'Finalizado':s.localCompleted?'Concluído no aparelho':s.employeeCompletedAt?'Aguardando revisão':isPaused(s)?'Pausado':s.employeeId?(s.status||'Em execução'):'Aguardando aceite';
export function summarizeFinance(services,today=localDay(new Date())){
 const list=services.filter(s=>s.closed&&s.finance&&!cancelled(s)),paid=list.filter(s=>s.finance.payment?.status==='paid'),open=list.filter(s=>s.finance.payment?.status!=='paid');
 const sum=(rows,key)=>rows.reduce((n,s)=>n+Number(s.finance[key]||0),0);
 return {revenue:sum(list,'revenueCents'),received:sum(paid,'revenueCents'),receivable:sum(open,'revenueCents'),cost:sum(list,'costCents'),forecast:sum(list.filter(s=>s.finance.costsComplete),'profitCents'),realized:sum(paid.filter(s=>s.finance.costsComplete),'profitCents'),missing:list.filter(s=>!s.finance.costsComplete).length,unrecorded:open.filter(s=>s.finance.payment?.status==='not-applicable').length,overdue:open.filter(s=>s.finance.dueDate&&s.finance.dueDate<today).length};
}
const metric=(label,value,note='',tone='')=>`<article class="ops-metric">${tone?`<span class="ops-metric-icon" aria-hidden="true" data-tone="${tone}">${icon({review:'review',work:'orders',paused:'clock',payment:'money'}[tone])}</span>`:''}<span>${esc(label)}</span><strong>${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</article>`;
const empty=text=>`<p class="ops-empty">${esc(text)}</p>`;
const icon=name=>({orders:'▤',review:'✓',clock:'◷',money:'＄'}[name]||'↗');
function orderCard(s){return `<article class="ops-order"><div><span class="ops-code">${esc(s.code||'Ordem local')}</span><h3>${esc(s.clientName||'Cliente não informado')}</h3><p>${esc(s.serviceType||'Manutenção')} · ${day(s.date)}</p><span class="ops-badge">${esc(orderStatus(s))}</span></div><div class="ops-order-meta"><span>${s.items?.length||0} equipamento(s)</span><span>${esc(s.employeeName||'Aguardando responsável')}</span><button type="button" class="btn btn-soft btn-small" data-ops-order="${esc(s.id)}">Abrir ordem</button></div></article>`;}
function bindOrders(root){root.querySelectorAll('[data-ops-order]').forEach(b=>b.onclick=()=>window.openServiceDetails(b.dataset.opsOrder));root.querySelectorAll('[data-ops-nav]').forEach(b=>b.onclick=()=>window.go(b.dataset.opsNav));}
function adminHome(host){
 const list=(db.services||[]).filter(s=>!cancelled(s)),review=list.filter(s=>s.employeeCompletedAt&&!s.closed),paused=list.filter(s=>isPaused(s)&&!completed(s)),active=list.filter(s=>!completed(s)&&!isPaused(s)),totals=summarizeFinance(list);
 const priority=[...review,...paused,...active.filter(s=>!s.employeeId)].slice(0,6),recent=list.slice().sort((a,b)=>String(b.closedAt||b.date||'').localeCompare(String(a.closedAt||a.date||''))).slice(0,4);
 host.innerHTML=`<div class="ops-admin-home"><span class="admin-team-shortcuts" hidden></span><header class="ops-hero"><div><span class="ops-eyebrow">Centro operacional</span><h1>Seu dia, organizado.</h1><p>${review.length?'Há '+review.length+' ordem(ns) aguardando sua revisão.':'Acompanhe os atendimentos e os próximos compromissos da equipe.'}</p></div><button class="btn" type="button" id="opsNewService">＋ Nova ordem de serviço</button></header><div class="ops-metrics">${metric('Aguardando revisão',review.length,'Execução enviada pelo funcionário','review')}${metric('Em atendimento',active.length,'Inclui serviços disponíveis para aceite','work')}${metric('Serviços pausados',paused.length,'Etapas e anexos preservados','paused')}${metric('A receber',money(totals.receivable),totals.overdue+' acerto(s) vencido(s)','payment')}</div><nav class="ops-shortcuts" aria-label="Ações da operação">${[['workshop','money','Pó, preços e envios','Estoque e aceite da equipe'],['services','orders','Ordens de serviço','Acompanhar e revisar'],['finance','money','Custos e recebimentos','Conferir resultados']].map(([target,glyph,title,note])=>`<button type="button" data-ops-nav="${target}"><span aria-hidden="true">${icon(glyph)}</span><span><b>${title}</b><small>${note}</small></span><span aria-hidden="true">↗</span></button>`).join('')}</nav><nav class="ops-utility-links" aria-label="Alertas e relatórios"><button type="button" class="icon-btn" data-ops-nav="alerts">Alertas da operação</button><button type="button" class="icon-btn" data-ops-nav="reports">Relatórios</button></nav><div class="ops-columns"><section class="ops-panel"><header><div><h2>Precisam de atenção</h2><p>Revisões, pausas e serviços aguardando aceite.</p></div><button class="icon-btn" type="button" data-ops-nav="services">Ver ordens</button></header>${priority.map(orderCard).join('')||empty('Nenhuma pendência operacional neste momento.')}</section><section class="ops-panel"><header><div><h2>Recebimentos e resultado</h2><p>Somente ordens finalizadas e não canceladas.</p></div></header><dl class="ops-money-list"><div><dt>Recebimentos confirmados</dt><dd>${money(totals.received)}</dd></div><div><dt>Resultado bruto realizado</dt><dd>${money(totals.realized)}</dd></div><div><dt>Resultado bruto previsto</dt><dd>${money(totals.forecast)}</dd></div></dl><p class="ops-note">O realizado considera ordens pagas com todos os custos informados. ${totals.missing} ordem(ns) com custos incompletos ficam fora do resultado.</p><button class="btn btn-soft btn-small" type="button" data-ops-nav="finance">Conferir custos e cobranças</button></section></div><details class="ops-panel workspace-history"><summary>Movimentação recente</summary><header><div><h2>Histórico recente</h2><p>Consulte a ordem para ver cada registro e responsável.</p></div></header>${recent.map(orderCard).join('')||empty('As novas ordens aparecerão aqui.')}</details></div>`;
 host.querySelector('#opsNewService').onclick=()=>window.openService();bindOrders(host);
}

let detailUrls=[],previousFocus=null;
function releaseVideos(){detailUrls.forEach(url=>URL.revokeObjectURL(url));detailUrls=[];}
function financeDetail(s){
 let f=s.finance;try{f ||= estimateFinance(db,s)}catch{return empty('Revise os itens de custo para calcular esta ordem.');}
 return `${f.pricingPending?'<p class="ops-alert">Tarifa interna pendente. Configure os valores mínimos por extintor, ou defina o valor interno base desta ordem.</p>':''}<p class="ops-note">${s.finance?'Valores registrados na finalização.':'Estimativa com os custos atuais. Os valores são registrados ao finalizar.'}</p><div class="ops-metrics">${metric('Valor da ordem',money(f.revenueCents))}${metric('Custos registrados',money(f.costCents))}${metric(f.costsComplete?'Resultado bruto':'Resultado parcial',money(f.profitCents))}</div>${!f.costsComplete?`<p class="ops-alert">Custos ainda não informados: ${(f.missingCosts||[]).map(esc).join(', ')}. O resultado está incompleto.</p>`:''}<div class="table-wrap"><table><thead><tr><th>Item</th><th>Quantidade</th><th>Custo unitário</th><th>Valor unitário</th><th>Resultado do item</th></tr></thead><tbody>${(f.lines||[]).map(line=>`<tr><td>${esc(line.name)}</td><td>${line.quantity}</td><td>${line.unitCostCents==null?'Não informado':money(line.unitCostCents)}</td><td>${money(line.unitRevenueCents)}</td><td>${line.unitCostCents==null?'Pendente':money((line.unitRevenueCents-line.unitCostCents)*line.quantity)}</td></tr>`).join('')}</tbody></table></div><p class="ops-note">O valor base do serviço é ${money(f.baseRevenueCents)}. O resultado é bruto; impostos e despesas só entram quando cadastrados nos custos.</p>`;
}
function flowActions(s){
 const f=window.offlineServices?.flowFor?.(),stage=['stage','Atualizar etapa'],done=['complete','Concluir execução'],pause=['pause','Pausar serviço'];
 if(!f)return [stage,pause,done];
 const order=f.employeeStages,atEnd=order.indexOf(f.completeAt)>=0&&order.indexOf(s.status)>=order.indexOf(f.completeAt);
 return [...(f.requireCompleteStage?[atEnd?done:stage]:[stage,done]),pause];
}
export function openOrderDetail(s,{readVideo,onAction}={}){
 releaseVideos();const admin=role()==='admin',employee=role()==='employee',charge=s.charge||(s.finance?{amountCents:s.finance.revenueCents,dueDate:s.finance.dueDate,payment:s.finance.payment,policy:s.finance.policy}:null);
 const done=cancelled(s)?-1:s.closed?4:s.employeeCompletedAt||s.localCompleted?3:s.employeeId?2:1;
 const rawEvents=[...(s.history||[]),...(s.items||[]).flatMap((item,index)=>(item.history||[]).map(e=>({...e,description:`Equipamento ${index+1}: ${e.description||e.status||''}`})))].sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
 const seenEvents=new Set(),events=rawEvents.filter(e=>{const key=[e.at,e.action||e.status,e.by,e.description?.startsWith('Equipamento ')?e.description.replace(/^Equipamento \d+: /,''):e.description].join('|');if(seenEvents.has(key))return false;seenEvents.add(key);return true;});
 const stages=['Registrado','Aguardando aceite','Em execução','Revisão administrativa','Finalizado'];
 const technical=equipmentGroups(s.items).map(g=>`<details class="ops-equipment workshop-equipment-group"><summary><b>${esc(g.type)} · ${esc(g.kg?g.kg+' kg':'10 L')}</b><span>${g.items.length} unidade(s)</span></summary><div class="ops-evidence-grid">${g.items.map((item,i)=>`<section><p><b>Unidade ${g.indexes[i]+1}</b>${item.serial?' · Série '+esc(item.serial):''}</p>${item.notes?'<p>'+esc(item.notes)+'</p>':''}${(item.replacedParts||[]).map(part=>{const media=item.replacementMedia?.[part];return `<section class="ops-evidence"><b>${esc(part)}</b>${media?.url?`<button class="btn btn-soft btn-small" type="button" data-ops-video="${esc(media.url)}">Assistir vídeo</button>`:'<span class="ops-badge">Vídeo pendente</span>'}</section>`;}).join('')||'<p class="ops-note">Sem peças substituídas.</p>'}</section>`).join('')}</div></details>`).join('');
 const hasActions=(admin?!s.closed:!completed(s))&&!cancelled(s),techActions=employee&&onAction&&hasActions&&(!s.employeeId||s.employeeId===window.offlineServices?.actorId)?(isPaused(s)?[['resume','Retomar serviço']]:s.employeeId?flowActions(s):[['claim','Aceitar serviço']]):[];
 const sections=[['summary','Resumo'],...(Number(s.paintingQuantity)>0?[['equipment','Equipamentos e vídeos']]:[]),...((admin||charge)?[['finance',admin?'Custos e recebimento':'Pagamento']]:[]),['history','Histórico']];
 const billing=charge?`<div class="ops-metrics">${metric('Valor da ordem',money(charge.amountCents))}${metric('Recebimento',charge.payment?.status==='paid'?'Confirmado':charge.payment?.status==='not-applicable'?'Não registrado':'Pendente')}${metric('Vencimento',charge.dueDate?day(charge.dueDate):'Sem prazo registrado')}</div><p>${charge.policy?.mode==='weekly'?'Acerto semanal':'Pagamento após conclusão'}${charge.payment?.paidAt?' · Confirmado em '+instant(charge.payment.paidAt):''}</p>${charge.payment?.reference?`<p>Referência: ${esc(charge.payment.reference)}</p>`:''}`:empty('O valor e o prazo de cobrança serão registrados na finalização administrativa.');
 const selectedDetails=`${groupedEquipmentMarkup(s)}${!Number(s.paintingQuantity)&&(s.items||[]).some(i=>(i.replacedParts||[]).length)?'<section class=\"workshop-parts-evidence\"><h3>Peças substituídas e seus vídeos</h3>'+technical+'</section>':''}${s.powderRecordedAt?'<h3>Consumo de pó confirmado na ordem</h3><p>'+(s.powderUsage||[]).map(r=>'Pó '+esc(r.agent)+': '+r.grams/1000+' kg').join(' · ')+'</p>':''}${suppliedEquipment(s)}${complementaryWork(s)}${s.adminOwned?'<p class=ops-note>Ordem assumida pela empresa. Criador original: '+esc(s.registeredBy)+'.</p>':''}${s.retailAmount!=null?'<p><b>Valor ao cliente: '+money(Math.round(s.retailAmount*100))+'</b> · '+(s.retailPriceSource==='suggested'?'Sugestão aplicada':'Valor combinado')+'</p>':''}${s.suggestedRetailCents!=null&&(s.retailAmount==null||Math.round(s.retailAmount*100)!==Number(s.suggestedRetailCents))?'<p class="ops-note">Sugestão registrada: '+money(s.suggestedRetailCents)+'</p>':''}${s.plannedParts?.length?'<h3>Peças previstas</h3><ul>'+s.plannedParts.map(p=>'<li>'+esc(p.name)+' × '+p.quantity+'</li>').join('')+'</ul>':''}${s.hydrantHoses?.length?'<h3>Mangueiras de hidrante</h3><ul>'+s.hydrantHoses.map(h=>'<li>'+esc(h.type)+' · '+h.diameterMm+' mm · '+h.lengthMeters+' m · '+h.quantity+' unidade(s)</li>').join('')+'</ul>':''}`;
 const body=`<div class="ops-order-detail" data-ops-detail="${esc(s.id)}"><header class="ops-detail-hero"><div><span class="ops-code">${esc(s.code||'Ordem local')}</span><h2>${esc(s.clientName||'Cliente não informado')}</h2><p>${esc(s.serviceType||'Manutenção')} · ${day(s.date)}</p></div><span class="ops-badge">${esc(orderStatus(s))}</span></header><nav class="ops-detail-tabs" aria-label="Seções da ordem">${sections.map(([id,title])=>`<button type="button" data-ops-section="${id}" aria-pressed="${id==='summary'}">${title}</button>`).join('')}</nav><section data-ops-pane="summary">${selectedDetails}<ol class="ops-progress">${stages.map((label,index)=>`<li class="${index<done?'is-done':index===done?'is-current':''}" ${index===done?'aria-current="step"':''}><span>${index<done?'✓':index+1}</span><b>${label}</b></li>`).join('')}</ol>${cancelled(s)?'<p class="ops-alert">Esta ordem foi cancelada. O histórico permanece disponível.</p>':''}${s.localPending?'<p class="ops-alert">Há registros salvos neste aparelho aguardando confirmação de envio.</p>':''}<dl class="ops-summary-grid">${[['Responsável técnico',s.employeeName||'Aguardando aceite'],['Vendedor',s.sellerName||'Administração'],['Equipamentos',s.items?.length||0],['Pinturas',s.paintingQuantity||0],...(s.retailAmount!=null?[['Preço informado ao cliente',money(s.retailAmount*100)]]:[]),...(admin?[['Telefone',s.clientPhone||'Não informado'],['E-mail',s.clientEmail||'Não informado']]:[])].map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>${isPaused(s)?`<div class="ops-alert"><b>Serviço pausado</b><p>${esc(s.pauseReason)} · ${instant(s.pausedAt)}</p></div>`:''}<h3>Observações da ordem</h3><p>${esc(s.notes||'Nenhuma observação adicional.')}</p><div class="ops-detail-actions">${admin&&hasActions?'<button type="button" class="btn btn-soft btn-small" data-ops-review>Revisar dados</button><button type="button" class="btn btn-soft btn-small" data-ops-contacts>Vincular cliente / vendedor</button><button type="button" class="btn btn-small" data-ops-finalize>Finalizar serviço</button>':''}${techActions.filter(([action])=>(s.items?.length||!['technical','painting','stage'].includes(action))&&(action!=='powder'||Object.values(powderCapacity(s)).some(Boolean))).map(([action,label])=>`<button type="button" class="btn ${['complete','claim','resume','stage'].includes(action)?'':'btn-soft'} btn-small" data-ops-tech="${action}">${label}</button>`).join('')}</div></section><section data-ops-pane="equipment" hidden><h3>Equipamentos e evidências</h3><p class="ops-note">Cada vídeo fica vinculado à peça e ao equipamento correspondente.</p>${technical||empty('Nenhum equipamento informado.')}</section>${admin||charge?`<section data-ops-pane="finance" hidden><h3>${admin?'Custos e resultado':'Pagamento da ordem'}</h3>${admin?financeDetail(s):''}<h3>Recebimento</h3>${billing}${!admin&&charge?.payment?.status!=='paid'?'<button type="button" class="btn btn-small" data-ops-pay-team>Pagar com Pix / ver acerto</button>':''}${admin&&s.closed&&s.finance&&s.finance.payment?.status!=='paid'?'<button class="btn btn-small" type="button" data-ops-receive>Registrar recebimento</button>':''}${admin&&s.billingVersion===2&&!(s.workshopVersion>=44)&&!s.closed?'<button type="button" class="btn btn-soft btn-small" data-ops-internal-quote>Definir valor interno base</button>':''}${admin&&!s.closed&&!cancelled(s)?'<button class="btn btn-soft btn-small" type="button" data-ops-costs>Adicionar custos ou itens</button>':''}</section>`:''}<section data-ops-pane="history" hidden><h3>Histórico e responsáveis</h3><ol class="ops-timeline">${events.map(event=>`<li><time>${instant(event.at)}</time><h4>${esc(event.action||event.status||'Atualização')}</h4>${event.description?`<p>${esc(event.description)}</p>`:''}<small>${event.by?'Registrado por '+esc(event.by):'Registro do sistema'}</small></li>`).join('')||'<li>Nenhum evento adicional registrado.</li>'}</ol></section></div>`;
 window.openModal('Ordem de serviço',body,()=>true,'Fechar');const root=document.getElementById('editForm');root.closest('.modal').classList.add('ops-detail-modal');bindWorkshopOrder(root,s);if(!Number(s.paintingQuantity))root.querySelector('[data-ops-pane=equipment]')?.remove();
 root.querySelectorAll('[data-ops-section]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-ops-section]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));root.querySelectorAll('[data-ops-pane]').forEach(p=>p.hidden=p.dataset.opsPane!==b.dataset.opsSection);});
 root.querySelector('[data-ops-review]')?.addEventListener('click',()=>window.openAdminServiceReview(s.id));
 root.querySelector('[data-ops-contacts]')?.addEventListener('click',()=>window.editOrderContacts(s.id));
 root.querySelector('[data-ops-finalize]')?.addEventListener('click',()=>window.finalizeService(s.id));
 root.querySelector('[data-ops-pay-team]')?.addEventListener('click',()=>window.openTeamPayments());
 root.querySelector('[data-ops-internal-quote]')?.addEventListener('click',()=>window.editInternalQuote(s.id));
 root.querySelector('[data-ops-costs]')?.addEventListener('click',()=>window.editServiceFinance(s.id));
 root.querySelector('[data-ops-receive]')?.addEventListener('click',()=>window.recordOrderReceipt(s.id));
 root.querySelectorAll('[data-ops-tech]').forEach(b=>b.onclick=()=>onAction(b.dataset.opsTech,s.id));
 root.querySelectorAll('[data-ops-video]').forEach(button=>button.onclick=async()=>{
  button.disabled=true;button.textContent='Carregando vídeo…';
  try{const blob=readVideo?await readVideo(button.dataset.opsVideo):await privateVideo(button.dataset.opsVideo);if(!button.isConnected)return;const url=URL.createObjectURL(blob);detailUrls.push(url);const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=url;video.className='ops-video';button.replaceWith(video)}
  catch(error){button.disabled=false;button.textContent='Tentar abrir vídeo novamente';window.toast(error.message||'Não foi possível abrir o vídeo.');}
 });
}
async function privateVideo(value){const url=new URL(value),api=new URL(API_BASE_URL);if(url.origin!==api.origin||!url.pathname.startsWith('/media/service-media/'))throw Error('Endereço de vídeo inválido.');const r=await window.apiCall(url.pathname);if(!r.ok)throw Error('Conecte-se e confirme seu acesso para assistir ao vídeo.');return r.blob();}

function enhanceFinance(){
 const host=document.getElementById('content');if(window.page!=='finance'||!host||host.querySelector('#opsFinance'))return;
 const services=db.services||[],totals=summarizeFinance(services),section=document.createElement('section');section.id='opsFinance';section.className='ops-panel';
 const dueOf=s=>/^\d{4}-\d{2}-\d{2}$/.test(s.finance.dueDate||'')?s.finance.dueDate:'';
 const pending=services.filter(s=>s.closed&&s.finance?.payment?.status!=='paid'&&s.finance&&!cancelled(s))
  .sort((a,b)=>(dueOf(a)||'9999-12-31').localeCompare(dueOf(b)||'9999-12-31')||String(a.code||'').localeCompare(String(b.code||'')));
 const next=pending.find(s=>dueOf(s)),featured=next||pending[0],today=localDay(new Date());
 const mobile=document.createElement('section');mobile.className='mobile-receipts';mobile.setAttribute('aria-label','Cobranças a receber');
 const lines=pending.map(s=>{
  const payer=s.finance.payer?.name||billingOwner(s)?.name, due=dueOf(s);
  const status=due&&due<today?'Vencida':s===next?'Vence primeiro':'';
  return `<button class="mobile-receipt-line" type="button" data-mobile-receipt="${esc(s.id)}"><span><strong>${esc(payer||s.clientName||s.code||'Ordem')}</strong><small>${esc((payer?s.code:s.serviceType)||'Serviço')} · ${due?day(due):'Sem vencimento'}</small></span><span class="mobile-receipt-amount"><strong>${money(s.finance.revenueCents)}</strong>${status?`<small class="mobile-receipt-status">${status}</small>`:''}</span></button>`;
 }).join('');
 mobile.innerHTML=`<div class="mobile-receipts-summary"><span>Total a receber</span><strong>${money(totals.receivable)}</strong><p>${pending.length===0?'Nenhuma cobrança em aberto':pending.length===1?'1 cobrança em aberto':pending.length+' cobranças em aberto'}</p>${featured?`<button class="btn mobile-receipt-primary" type="button" data-mobile-receipt="${esc(featured.id)}">${next?'Ver próxima cobrança':'Ver cobrança'}</button>`:''}</div>${lines?`<h2>Cobranças em aberto</h2><div class="mobile-receipts-list">${lines}</div>`:''}`;
 mobile.querySelectorAll('[data-mobile-receipt]').forEach(button=>button.addEventListener('click',()=>{
  const s=(db.services||[]).find(order=>order.id===button.dataset.mobileReceipt);
  if(!s)return window.toast('Ordem não encontrada. Atualize o painel.');
  openOrderDetail(s);
  document.querySelector('#modalRoot [data-ops-section="finance"]')?.click();
 }));
 host.prepend(mobile);
 section.innerHTML=`<h2>Resultados e recebimentos</h2><div class="ops-metrics">${metric('Recebido',money(totals.received),'Pagamentos confirmados')}${metric('A receber',money(totals.receivable),'Inclui recebimentos não registrados')}${metric('Resultado bruto realizado',money(totals.realized),'Ordens pagas com custos completos')}${metric('Resultado bruto previsto',money(totals.forecast),'Ordens finalizadas com custos completos')}</div><p class="ops-note">${totals.missing} ordem(ns) com custos incompletos não entram nos resultados. Custos registrados: ${money(totals.cost)}. ${totals.unrecorded} ordem(ns) diretas aguardam registro de recebimento.</p>`;
 const old=host.querySelector(':scope > .finance-metrics');if(old)old.replaceWith(section);else host.querySelector('.page-title')?.after(section);
 const direct=(db.services||[]).filter(s=>s.closed&&s.finance&&!billingOwner(s)&&!s.finance.payer&&s.finance.payment?.status!=='paid'&&!cancelled(s));
 if(direct.length){const panel=document.createElement('section');panel.className='ops-panel';panel.innerHTML='<h2>Recebimentos diretos a conferir</h2><p class="ops-note">Finalizar uma ordem não confirma que o pagamento foi recebido.</p>'+direct.map(s=>`<div class="ops-receivable"><div><b>${esc(s.code)}</b><p>${esc(s.clientName||'Cliente não informado')} · ${money(s.finance.revenueCents)}</p></div><button class="btn btn-small" type="button" data-receive-order="${esc(s.id)}">Registrar recebimento</button></div>`).join('');section.after(panel);panel.querySelectorAll('[data-receive-order]').forEach(b=>b.onclick=()=>window.recordOrderReceipt(b.dataset.receiveOrder));}
}
function enhanceTables(){
 document.querySelectorAll('#dashboard .table-wrap table:not([data-ops-cards]),.ops-order-detail table:not([data-ops-cards])').forEach(table=>{
  const headings=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());if(!headings.length)return;table.dataset.opsCards='';
  table.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,index)=>{cell.dataset.label=headings[index]||'Informações';if(index===row.cells.length-1&&/aç[õo]es/i.test(headings[index]||''))cell.classList.add('ops-cell-actions')}));
 });
}
function enhanceDialogs(){
 const modal=document.querySelector('#modalRoot .modal');if(!modal||modal.dataset.opsAccessible)return;modal.dataset.opsAccessible='true';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
 const title=modal.querySelector('.modal-head h2');if(title){title.id='opsDialogTitle';modal.setAttribute('aria-labelledby',title.id)}
 const close=modal.querySelector('.modal-head button');if(close&&!close.getAttribute('aria-label'))close.setAttribute('aria-label','Fechar');
 modal.tabIndex=-1;queueMicrotask(()=>{if(modal.isConnected)modal.focus({preventScroll:true})});
 modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();window.closeModal();return;}if(event.key!=='Tab')return;const controls=[...modal.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length),first=controls[0],last=controls.at(-1);if(!first){event.preventDefault();return}if(event.shiftKey&&(document.activeElement===first||document.activeElement===modal)){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===modal)){event.preventDefault();first.focus()}});
}
function enhanceTeamHeader(root,main){
 const header=root.querySelector('.employee-top');if(!header)return;if(!header.classList.contains('ops-team-header'))header.classList.add('ops-team-header');
 let menu=header.querySelector('.ops-team-menu');
 if(!menu){
  menu=document.createElement('div');menu.className='ops-team-menu';menu.id='opsTeamMenu';menu.hidden=true;
  const toggle=document.createElement('button');toggle.type='button';toggle.className='btn btn-soft btn-small ops-team-menu-toggle';toggle.textContent='☰ Menu';toggle.setAttribute('aria-controls',menu.id);toggle.setAttribute('aria-expanded','false');header.append(toggle,menu);
  toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden))};
  menu.addEventListener('click',event=>{if(event.target.closest('button')){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});
  header.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){menu.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus()}});
 }
 if(!menu.querySelector('[data-workspace-theme]')){const theme=document.createElement('button');theme.type='button';theme.className='btn btn-soft btn-small workspace-menu-theme';theme.dataset.workspaceTheme='';theme.textContent='Alternar tema';theme.onclick=()=>header.querySelector('.theme-toggle')?.click();menu.append(theme);}
 let register=main.querySelector('.ops-team-register');if(!register){register=document.createElement('div');register.className='ops-team-register';main.append(register)}
 root.querySelectorAll('[data-team-register]').forEach(button=>{if(button.parentElement!==register)register.append(button)});
  header.querySelectorAll('button').forEach(button=>{if(button.closest('.ops-team-menu,.sync-control')||button.classList.contains('ops-team-menu-toggle'))return;if(button.classList.contains('theme-toggle')){if(button.parentElement!==header)header.insertBefore(button,header.querySelector('.ops-team-menu-toggle'));}else menu.append(button)});
 for(const child of header.children)if(child.tagName==='DIV'&&!child.classList.contains('ops-team-menu')&&!child.textContent.trim()&&!child.querySelector('img'))child.hidden=true;
}
function enhanceTeam(){
 const root=document.getElementById('employeePortal');if(!root||root.classList.contains('hidden'))return;
 root.querySelector('#employeeDashboardStats')?.setAttribute('hidden','');root.querySelector('#sellerDashboardStats')?.setAttribute('hidden','');
 const state=role()==='employee'?window.employeePortalState:window.sellerPortalState,list=state?.services||[],host=root.querySelector('.employee-main');if(!host)return;
 enhanceTeamHeader(root,host);
 const active=list.filter(s=>!completed(s)&&!cancelled(s)&&!isPaused(s)),paused=list.filter(isPaused),current=active.find(s=>s.employeeId===window.offlineServices?.actorId),charges=list.filter(s=>s.charge&&s.charge.payment?.status!=='paid'&&!cancelled(s));
 const signature=JSON.stringify([role(),list.map(s=>[s.id,orderStatus(s),s.charge,s.localPending])]);let summary=host.querySelector('#opsTeamSummary');
 if(!summary){summary=document.createElement('section');summary.id='opsTeamSummary';summary.className='ops-team-summary';const bar=host.querySelector('#offlineToolbar');if(bar)bar.after(summary);else host.prepend(summary)}
 const toolbar=host.querySelector('#offlineToolbar');
   let heading=host.querySelector('[data-workspace-heading]');
  if(!heading){heading=document.createElement('header');heading.dataset.workspaceHeading='';heading.className='workspace-heading';heading.innerHTML='<div><span class="ops-eyebrow">'+(role()==='employee'?'Área técnica':'Área comercial')+'</span><h1>'+(role()==='employee'?'Seu trabalho, organizado.':'Suas ordens, em um só lugar.')+'</h1><p>'+(role()==='employee'?'Registre suas ordens e acompanhe os atendimentos da equipe.':'Acompanhe seus registros, histórico e pagamentos.')+'</p></div>';summary.before(heading);}
  if(heading.parentElement!==host)host.prepend(heading);
  if(heading.nextElementSibling!==summary)heading.after(summary);
  const powder=host.querySelector('#employeePowderStock');if(powder&&summary.nextElementSibling!==powder)summary.after(powder);
  const registration=host.querySelector('.ops-team-register');if(registration&&registration.parentElement!==heading)heading.append(registration);
 if(summary.dataset.state===signature)return;summary.dataset.state=signature;summary.dataset.role=role();
   summary.innerHTML=role()==='employee'?`<header class="workspace-current"><div><span class="ops-eyebrow">${current?'Atendimento em andamento':'Próximo atendimento'}</span><h2>${current?esc(current.clientName||'Serviço próprio'):'Tudo pronto para começar'}</h2><p>${current?'<span class="ops-code">'+esc(current.code)+'</span>':'Escolha uma ordem recebida ou registre um serviço em seu nome.'}</p>${current?'<div class="workspace-current-meta"><span class="ops-badge">'+esc(current.status||'Em atendimento')+'</span><span>'+esc(employeeCreatedService(current,window.offlineServices?.actorId)?'Criado por você':current.registeredByRole==='seller'?'Registrado pelo vendedor':'Registrado pela administração')+'</span></div>':''}</div><div class="workspace-current-actions">${current?'<button class="btn" type="button" data-ops-current="'+esc(current.id)+'">Continuar atendimento <span aria-hidden="true">→</span></button><button class="btn btn-soft" type="button" data-ops-pause="'+esc(current.id)+'">Pausar serviço</button>':'<button class="btn btn-soft" type="button" data-ops-assigned>Ver serviços para executar</button>'}</div></header><div class="ops-metrics workspace-metrics">${metric('Em atendimento',active.filter(s=>s.employeeId===window.offlineServices?.actorId).length)}${metric('Pausados',paused.length)}${metric('No histórico',list.filter(s=>completed(s)||cancelled(s)).length)}</div>`:`<header><div><span class="ops-eyebrow">Visão dos seus registros</span><h2>Do registro ao recebimento.</h2><p>Consulte o andamento e as informações de cada ordem.</p></div></header><div class="ops-metrics workspace-metrics">${metric('Em acompanhamento',list.filter(s=>!s.closed&&!cancelled(s)).length)}${metric('Saldo a pagar',money(charges.reduce((n,s)=>n+s.charge.amountCents,0)))}${metric('Próximo vencimento',charges.map(s=>s.charge.dueDate).filter(Boolean).sort()[0]?day(charges.map(s=>s.charge.dueDate).filter(Boolean).sort()[0]):'—')}</div>`;
  summary.querySelector('[data-ops-current]')?.addEventListener('click',()=>window.offlineServices?.openDetails(current.id));
  summary.querySelector('[data-ops-pause]')?.addEventListener('click',()=>window.offlineServices?.pauseService(current.id));
  summary.querySelector('[data-ops-assigned]')?.addEventListener('click',()=>host.querySelector('[data-employee-scope="assigned"]')?.click());
}
function install(){
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./operations-ui.css?v=protec-interface-65',import.meta.url);document.head.append(css);
 window.overview=adminHome;
 window.openServiceDetails=id=>{const list=role()==='admin'?db.services:role()==='employee'?window.employeePortalState?.services:window.sellerPortalState?.services;const s=(list||[]).find(s=>s.id===id);if(!s)return window.toast('Ordem não encontrada. Atualize os dados.');if(['employee','seller'].includes(role())&&window.offlineServices?.ready)return window.offlineServices.openDetails(id);openOrderDetail(s);};
 window.recordOrderReceipt=id=>{
  const s=(db.services||[]).find(s=>s.id===id);if(role()!=='admin'||!s?.closed||!s.finance||cancelled(s))return;
  window.openModal('Registrar recebimento',`<p><b>${esc(s.code)}</b> · ${esc(s.clientName||'Cliente não informado')}</p><p>Valor integral: <strong>${money(s.finance.revenueCents)}</strong></p><p>Confirme apenas depois de conferir o pagamento recebido. O nome da sua conta e a data serão registrados no histórico.</p><label class="form-field">Referência do pagamento<input name="reference" required minlength="3" maxlength="300" placeholder="Ex.: Pix conferido em 13/11"></label>`,async form=>{
   const r=await window.apiCall('/api/admin/operations','POST',{action:'mark-paid',serviceIds:[id],reference:form.get('reference')}),data=await window.apiJson(r);if(!r.ok)throw Error(data.error||'Não foi possível registrar o recebimento.');db=data.state;window.saveLocal();window.toast('Recebimento confirmado e registrado no histórico.');return{afterClose:()=>window.go('finance')};
  },'Confirmar recebimento');
 };
 const open=window.openModal,close=window.closeModal;
 window.openModal=function(...args){if(!document.getElementById('modalRoot').contains(document.activeElement))previousFocus=document.activeElement;return open.apply(this,args)};
 window.closeModal=function(...args){releaseVideos();const result=close.apply(this,args);if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});return result;};
 document.addEventListener('keydown',event=>{
  if(event.defaultPrevented)return;const modal=document.querySelector('#modalRoot .modal');if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();window.closeModal();}
  else if(event.key==='Tab'&&!modal.contains(document.activeElement)){event.preventDefault();modal.focus({preventScroll:true});}
 });
 const finalize=window.finalizeService,finalizing=new Set();
 window.finalizeService=async function(id,...args){if(finalizing.has(id))return;finalizing.add(id);try{return await finalize.call(this,id,...args)}finally{finalizing.delete(id)}};
 installBillingControls();
 let scheduled=false;const update=()=>{scheduled=false;enhanceFinance();enhanceTables();enhanceDialogs();enhanceTeam();mountTeamBilling();};
 new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update)}}).observe(document.body,{subtree:true,childList:true});
 update();if(role()==='admin'&&!document.getElementById('dashboard').classList.contains('hidden')&&(window.page||'overview')==='overview')adminHome(document.getElementById('content'));
}
const billingDays=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const roleLabel=value=>value==='employee'?'Funcionário':'Vendedor';
const policyText=p=>p?.mode==='weekly'?'Semanal · '+billingDays[p.weekday]:'Após finalização administrativa';
let walletState=null,walletToken='',walletLoading=false,walletChecked=0;
async function billingRequest(path,method='GET',data=null){
 const token=localStorage.getItem('protecextintores_session'),r=await window.apiCall(path,method,data),value=await window.apiJson(r);
 if(token!==localStorage.getItem('protecextintores_session'))throw Error('A conta mudou. Reabra seus pagamentos.');
 if(!r.ok)throw Error(value.error||'Não foi possível consultar os pagamentos.');return value;
}
const walletPath=(owner,admin)=>admin?'/api/admin/team-billing?role='+encodeURIComponent(owner.role)+'&id='+encodeURIComponent(owner.id):'/api/team/billing';
const billData=(owner,extra)=>({...extra,role:owner.role,id:owner.id});
async function showPix(owner,selection,admin){
 const data=await billingRequest(admin?'/api/admin/team-billing':'/api/team/billing','POST',billData(owner,{action:'pix',...selection}));
 const body=`<div class="ops-pix"><span class="ops-eyebrow">Pagamento à ProtecExtintores</span><h2>${money(data.amountCents)}</h2><p>${esc(data.merchant)} · ${esc(policyText(data.policy))}</p><p>${data.orders.length} ordem(ns) · referência ${esc(data.txid)}</p><img class="ops-pix-qr" loading="eager" decoding="sync" width="256" height="256" src="${esc(data.qr)}" alt="QR Code Pix no valor de ${esc(money(data.amountCents))}"><label class="form-field">Pix copia e cola<textarea readonly rows="4" id="opsPixCode">${esc(data.payload)}</textarea></label><button type="button" class="btn btn-small" id="opsCopyPix">Copiar Pix</button><p class="ops-note">Confira o recebedor e o valor no aplicativo do banco. O pagamento permanece pendente até o administrador conferir o recebimento.</p><details><summary>Ordens deste acerto</summary>${data.orders.map(s=>`<p>${esc(s.code)} · ${money(s.amountCents)}</p>`).join('')}</details>${admin?'<button type="button" class="btn btn-soft btn-small" id="opsConfirmBill">Confirmar recebimento</button>':'<button type="button" class="btn btn-soft btn-small" id="opsReportBill">Já paguei · avisar administrador</button>'}</div>`;
 window.openModal('Pix do acerto',body,()=>true,'Fechar');
 document.getElementById('opsCopyPix').onclick=async()=>{const field=document.getElementById('opsPixCode');try{if(!navigator.clipboard?.writeText)throw Error();await navigator.clipboard.writeText(field.value);window.toast('Pix copiado.')}catch{field.focus();field.select();if(document.execCommand('copy'))window.toast('Pix copiado.');else window.toast('Selecione e copie o código Pix acima.');}};
 document.getElementById('opsConfirmBill')?.addEventListener('click',()=>confirmBill(owner,data.id,data));
 document.getElementById('opsReportBill')?.addEventListener('click',()=>reportBill(owner,data.id,data));
}
function confirmBill(owner,id,bill){
 window.openModal('Conferir recebimento do acerto',`${bill?`<div class="ops-alert"><strong>${money(bill.amountCents)}</strong> · ${esc(bill.payer?.name||roleLabel(owner.role))}<p>${bill.orders.map(s=>esc(s.code)).join(', ')}</p></div>`:''}<p>Confirme somente após conferir o valor integral recebido. Todas as ordens deste acerto serão quitadas juntas.</p><label class="form-field">Referência / comprovante conferido<input name="reference" required minlength="3" maxlength="300"></label>`,async form=>{
  const result=await billingRequest('/api/admin/team-billing','POST',billData(owner,{action:'settle',billId:id,reference:form.get('reference')}));db=result.state;window.saveLocal();return{afterClose:()=>{window.toast('Acerto quitado e registrado no histórico.');window.go('finance')}};
 },'Confirmar recebimento');
}
function reportBill(owner,id,bill){
 window.openModal('Informar pagamento realizado',`${bill?`<p><strong>${money(bill.amountCents)}</strong> · ${bill.orders.map(s=>esc(s.code)).join(', ')}</p>`:''}<p>O administrador ainda precisará conferir o recebimento no banco.</p><label class="form-field">Referência do seu pagamento<input name="reference" required minlength="3" maxlength="300" placeholder="Identificação ou observação do comprovante"></label>`,async form=>{
  const result=await billingRequest('/api/team/billing','POST',billData(owner,{action:'report',billId:id,reference:form.get('reference')}));walletState=result.wallet;walletChecked=Date.now();return{afterClose:()=>{window.toast('Aviso enviado. A confirmação depende da conferência do administrador.');openTeamPayments()}};
 },'Avisar administrador');
}
async function openTeamPayments(owner=null){
 const admin=role()==='admin';
 if(!admin)owner={role:role(),id:window.offlineServices?.actorId};
 if(!owner?.id)return window.toast('Conecte-se e confirme o acesso à sua conta.');
 const data=await billingRequest(walletPath(owner,admin));
 if(data.offlineSnapshot)window.toast('Consulta salva em '+new Date(data.checkedAt).toLocaleString('pt-BR')+'. Conecte-se para atualizar o saldo ou pagar.');
 if(!admin){walletState=data;walletToken=localStorage.getItem('protecextintores_session');walletChecked=Date.now();}
 const pending=data.bills.filter(b=>b.status!=='paid'),paid=data.bills.filter(b=>b.status==='paid');
 const groupMarkup=data.groups.map((g,index)=>`<article class="ops-bill"><header><div><h3>${g.policy.mode==='weekly'?'Acerto semanal':'Ordem '+esc(g.orders[0]?.code)}</h3><p>Pagamento: ${day(g.dueDate)} · ${g.orders.length} ordem(ns)</p></div><b>${money(g.amountCents)}</b></header>${g.policy.mode==='weekly'?'<p class="ops-note">Ao abrir o Pix, este acerto será fechado. Novas ordens finalizadas depois entram no próximo período.</p>':''}<button type="button" class="btn btn-small" data-new-team-bill="${index}" ${g.eligible?'':'disabled'}>${g.eligible?'Pagar com Pix':'Pix disponível em '+day(g.dueDate)}</button><details><summary>Ordens incluídas</summary>${g.orders.map(s=>`<p>${esc(s.code)} · ${esc(s.clientName)} · ${money(s.amountCents)}</p>`).join('')}</details></article>`).join('');
 const billsMarkup=pending.map(b=>`<article class="ops-bill"><header><div><h3>${b.policy.mode==='weekly'?'Acerto semanal fechado':'Cobrança da ordem'}</h3><p>${day(b.dueDate)} · ${b.orders.length} ordem(ns)</p></div><b>${money(b.amountCents)}</b></header>${b.reportedAt?`<p class="ops-alert">Pagamento informado em ${instant(b.reportedAt)}. Aguardando conferência.${b.reportedReference?' '+esc(b.reportedReference):''}</p>`:''}${b.status==='pending'?`<div class="ops-detail-actions"><button class="btn btn-small" type="button" data-issued-team-bill="${esc(b.id)}">Ver Pix</button>${admin?`<button class="btn btn-soft btn-small" type="button" data-settle-team-bill="${esc(b.id)}">Conferir recebimento</button>`:''}</div>`:'<p class="ops-alert">Este acerto precisa de revisão pelo administrador. Não reutilize o QR anterior.</p>'}</article>`).join('');
 const body=`<div class="ops-wallet"><header><span class="ops-eyebrow">${admin?esc(data.payer.name):'Seus pagamentos à Protec'}</span><h2>${roleLabel(owner.role)} · ${esc(policyText(data.policy))}</h2><p>Cobrança interna por valor mínimo fixo de cada extintor. O preço cobrado ao seu cliente é livre e separado desta cobrança.</p></header><div class="ops-metrics">${metric('Saldo a pagar',money(data.balanceCents))}${metric('Pagamentos confirmados',money(data.paidCents))}</div>${!data.pixConfigured?'<p class="ops-alert">O administrador precisa cadastrar a chave Pix e a cidade da empresa em Configurações para liberar os QR Codes.</p>':''}<h3>Acertos pendentes</h3>${billsMarkup+groupMarkup||empty('Nenhum pagamento pendente.')}<h3>Ordens em andamento</h3><p class="ops-note">O Pix só fica disponível após a finalização administrativa e, no semanal, no dia combinado.</p>${data.openOrders.map(s=>`<div class="ops-receivable"><div><b>${esc(s.code)}</b><p>${esc(s.clientName)}</p></div><span>${s.pricingPending?'Valor interno a definir':money(s.amountCents)+' · estimativa interna'}</span></div>`).join('')||empty('Nenhuma ordem própria em andamento.')}<details><summary>Histórico de pagamentos (${paid.length+(data.otherPayments||[]).length})</summary>${paid.map(b=>`<p><b>${money(b.amountCents)}</b> · ${instant(b.paidAt)}<br>${b.orders.map(s=>esc(s.code)).join(', ')}<br>${esc(b.reference)}</p>`).join('')+(data.otherPayments||[]).map(p=>`<p><b>${money(p.amountCents)}</b> · ${instant(p.paidAt)}<br>${esc(p.code)}<br>${esc(p.reference)}</p>`).join('')||'<p>Nenhum acerto confirmado.</p>'}</details></div>`;
 window.openModal(admin?'Acertos de '+esc(data.payer.name):'Meus pagamentos',body,()=>true,'Fechar');const root=document.getElementById('editForm');
 const run=(button,action)=>{button.disabled=true;action().catch(error=>{if(button.isConnected)button.disabled=false;window.toast(error.message)})};
 root.querySelectorAll('[data-new-team-bill]').forEach(b=>b.onclick=()=>run(b,()=>showPix(owner,{groupId:data.groups[Number(b.dataset.newTeamBill)].id},admin)));
 root.querySelectorAll('[data-issued-team-bill]').forEach(b=>b.onclick=()=>run(b,()=>showPix(owner,{billId:b.dataset.issuedTeamBill},admin)));
 root.querySelectorAll('[data-settle-team-bill]').forEach(b=>b.onclick=()=>confirmBill(owner,b.dataset.settleTeamBill,data.bills.find(bill=>bill.id===b.dataset.settleTeamBill)));
}
function editTeamConditions(value,id=''){return window.editMinimumConditions(value,id);}

function mountTeamBilling(){
 const admin=role()==='admin';
 if(admin&&window.page==='finance'){
  const host=document.getElementById('content');if(!host||host.querySelector('#opsTeamBillingAdmin'))return;
  host.querySelectorAll(':scope > section').forEach(section=>{if(['Regras de pagamento','Acertos em aberto'].includes(section.querySelector('h2')?.textContent)){section.hidden=true;section.dataset.teamLegacy='';}});
  const panel=document.createElement('section');panel.className='ops-panel';panel.id='opsTeamBillingAdmin';
  panel.innerHTML=`<h2>Cobranças internas da equipe</h2><p class="ops-note">Quem cria a ordem paga a tarifa interna. Executar uma ordem da empresa ou de outro parceiro não transfere a dívida ao funcionário.</p>${['employee','seller'].map(value=>{const people=db[value==='employee'?'employees':'sellers']||[],discount=db.settings.teamPricing?.[value]?.discountPercent,policy=db.settings[value==='employee'?'employeeBillingPolicy':'sellerBillingPolicy'];return `<section class="ops-billing-role"><header><div><h3>${value==='employee'?'Funcionários':'Vendedores'}</h3><p>Valor mínimo fixo por extintor · ${esc(policyText(policy))}</p></div><button type="button" class="btn btn-soft btn-small" data-team-default="${value}">Configurar padrão</button></header><details><summary>Condições e acertos individuais (${people.length})</summary>${people.map(person=>{const owner={role:value,id:person.id},percent=teamDiscount(db,owner),rule=servicePolicy(db,{billingOwner:owner});return `<div class="ops-receivable"><div><b>${esc(person.name)}</b><p>Mínimos por tipo e capacidade · ${esc(policyText(rule))}</p></div><div class="ops-detail-actions"><button type="button" class="icon-btn" data-team-person="${esc(person.id)}" data-team-role="${value}">Condições</button><button type="button" class="btn btn-soft btn-small" data-team-wallet="${esc(person.id)}" data-team-role="${value}">Ver acertos</button></div></div>`}).join('')||'<p>Nenhum cadastro neste perfil.</p>'}</details></section>`}).join('')}<p class="ops-note">Cadastre a chave Pix e a cidade da empresa em Configurações. A confirmação do recebimento é feita pelo administrador após conferir o banco.</p>`;
  (host.querySelector('#opsFinance')||host.querySelector('.page-title'))?.after(panel);
  panel.querySelectorAll('[data-team-default]').forEach(b=>b.onclick=()=>editTeamConditions(b.dataset.teamDefault));
  panel.querySelectorAll('[data-team-person]').forEach(b=>b.onclick=()=>editTeamConditions(b.dataset.teamRole,b.dataset.teamPerson));
  panel.querySelectorAll('[data-team-wallet]').forEach(b=>b.onclick=()=>openTeamPayments({role:b.dataset.teamRole,id:b.dataset.teamWallet}).catch(e=>window.toast(e.message)));
 }
 if(!['employee','seller'].includes(role()))return;
 const main=document.querySelector('#employeePortal:not(.hidden) .employee-main');if(!main)return;
 let panel=main.querySelector('#opsBillingWallet');if(!panel){panel=document.createElement('section');panel.id='opsBillingWallet';panel.className='ops-panel ops-wallet-summary';panel.innerHTML='<div><h2>Meus pagamentos à Protec</h2><p data-wallet-balance>Conecte-se para conferir o saldo.</p></div><button type="button" class="btn btn-soft btn-small">Ver pagamentos e Pix</button>';main.append(panel);panel.querySelector('button').onclick=()=>openTeamPayments().catch(e=>window.toast(e.message));}
 const token=localStorage.getItem('protecextintores_session');
 if(walletState&&walletToken===token){const text=money(walletState.balanceCents)+' a pagar · o valor cobrado ao cliente é livre.';const label=panel.querySelector('[data-wallet-balance]');if(label.textContent!==text)label.textContent=text;}
 if(!walletLoading&&token&&navigator.onLine&&(walletToken!==token||Date.now()-walletChecked>40000)){
  walletLoading=true;walletChecked=Date.now();billingRequest('/api/team/billing').then(data=>{walletState=data;walletToken=token;const label=main.querySelector('[data-wallet-balance]');if(label&&localStorage.getItem('protecextintores_session')===token)label.textContent=money(data.balanceCents)+' a pagar · o valor cobrado ao cliente é livre.';}).catch(()=>{}).finally(()=>{walletLoading=false;if(token!==localStorage.getItem('protecextintores_session'))queueMicrotask(mountTeamBilling)});
 }
}
function installBillingControls(){
 window.openTeamPayments=owner=>openTeamPayments(owner).catch(e=>window.toast(e.message));
 window.editInternalQuote=id=>{const s=db.services.find(s=>s.id===id);if(!s)return;window.openModal('Valor interno da manutenção',`<p>Defina o valor base que o parceiro paga à Protec. Peças, pinturas e itens adicionais são calculados separadamente com o desconto do perfil. Este valor não altera o preço cobrado ao cliente.</p><label class="form-field">Valor interno base (R$)<input name="amount" type="number" min="0.01" step="0.01" required value="${s.internalBaseCents!=null?s.internalBaseCents/100:''}"></label>`,async form=>{const data=await billingRequest('/api/admin/operations','POST',{action:'team-quote',serviceId:id,amount:form.get('amount')});db=data.state;window.saveLocal();return{afterClose:()=>window.openServiceDetails(id)};});};
 const receipt=window.recordOrderReceipt;
 window.recordOrderReceipt=id=>{const s=db.services.find(s=>s.id===id),owner=s?.finance?.payer||s&&billingOwner(s);if(owner)return window.openTeamPayments(owner);return receipt(id);};
 setInterval(()=>{if(!document.hidden)mountTeamBilling()},45000);window.addEventListener('online',()=>{walletChecked=0;mountTeamBilling()});
}
let sellerQuery='',sellerFilter='all',sellerLimit=40,sellerAccount='';
function sellerBoard(){
 const host=document.getElementById('sellerServices');if(!host||role()!=='seller')return;
 document.querySelectorAll('[data-seller-tab]').forEach(button=>{const nav=button.closest('nav');if(nav&&!nav.hidden)nav.hidden=true;});
 const heading=document.getElementById('sellerServiceHeading');if(heading&&heading.textContent!=='Minhas ordens de serviço')heading.textContent='Minhas ordens de serviço';
 const account=localStorage.getItem('protecextintores_username')||'';if(sellerAccount!==account){sellerAccount=account;sellerQuery='';sellerFilter='all';sellerLimit=40;}
 const list=(window.sellerPortalState?.services||[]).slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));
 const signature=JSON.stringify([list,sellerQuery,sellerFilter,sellerLimit]);if(host.dataset.selectionState===signature&&host.querySelector('[data-seller-controls]'))return;host.dataset.selectionState=signature;
 const focused=document.activeElement?.hasAttribute('data-seller-search'),cursor=focused?document.activeElement.selectionStart:0;
 const filtered=list.filter(s=>{const text=[s.code,s.clientName,s.serviceType,...(s.items||[]).map(i=>i.type+' '+i.kg)].join(' ').toLocaleLowerCase('pt-BR');return text.includes(sellerQuery.toLocaleLowerCase('pt-BR'))&&(sellerFilter==='all'||sellerFilter==='done'&&s.closed||sellerFilter==='cancelled'&&cancelled(s)||sellerFilter==='review'&&s.employeeCompletedAt&&!s.closed||sellerFilter==='active'&&!completed(s)&&!cancelled(s));});
 host.innerHTML=`<div data-seller-controls class="seller-filter-bar"><label>Buscar cliente, ordem ou equipamento<input type="search" data-seller-search value="${esc(sellerQuery)}"></label><label>Situação<select data-seller-status>${[['all','Todas as ordens'],['active','Em andamento'],['review','Aguardando revisão'],['done','Finalizadas'],['cancelled','Canceladas']].map(([v,t])=>`<option value="${v}" ${v===sellerFilter?'selected':''}>${t}</option>`).join('')}</select></label><p>${filtered.length} ordem(ns) encontrada(s)</p></div>`+filtered.slice(0,sellerLimit).map(s=>`<article class="seller-service-status"><header><div><strong>${esc(s.code)}</strong><small>${esc(s.clientName||s.registeredBy||'Serviço próprio')} · ${day(s.date)}</small></div><span class="ops-badge">${esc(orderStatus(s))}</span></header><p>${esc(s.serviceType)} · ${s.items?.length||0} extintor(es)${s.hydrantHoses?.length?' · '+s.hydrantHoses.reduce((n,h)=>n+h.quantity,0)+' mangueira(s) de hidrante':''}</p>${s.adminOwned?'<p class=ops-note>Ordem assumida pela empresa. Criador original: '+esc(s.registeredBy)+'.</p>':s.clientSource==='creator'?'<p class="ops-note">Serviço próprio vinculado ao seu cadastro.</p>':''}${s.retailAmount!=null?`<p><b>Valor ao seu cliente: ${money(Math.round(s.retailAmount*100))}</b> · ${s.retailPriceSource==='suggested'?'Sugestão aplicada':'Valor combinado'}</p>`:'<p class="ops-note">Preço ao cliente a definir.</p>'}${s.charge?`<p>Tarifa interna: ${money(s.charge.amountCents)} · ${s.charge.payment?.status==='paid'?'paga':s.charge.dueDate?'vencimento '+day(s.charge.dueDate):'aguardando acerto'}</p>${s.retailAmount!=null?`<p class="ops-note">Margem bruta estimada: ${money(Math.round(s.retailAmount*100)-s.charge.amountCents)}. Não representa recebimento do cliente.</p>`:''}`:''}<button type="button" class="btn btn-soft btn-small" data-seller-order="${esc(s.id)}">Ver serviço e histórico</button></article>`).join('')+(filtered.length>sellerLimit?'<button type="button" class="btn btn-soft" data-seller-more>Mostrar mais ordens</button>':filtered.length?'':'<p class="ops-empty">Nenhuma ordem neste filtro.</p>');
 host.querySelector('[data-seller-search]').oninput=e=>{sellerQuery=e.target.value;sellerLimit=40;sellerBoard();};host.querySelector('[data-seller-status]').onchange=e=>{sellerFilter=e.target.value;sellerLimit=40;sellerBoard();};
 host.querySelectorAll('[data-seller-order]').forEach(b=>b.onclick=()=>window.openServiceDetails(b.dataset.sellerOrder));host.querySelector('[data-seller-more]')?.addEventListener('click',()=>{sellerLimit+=40;sellerBoard();});
 if(focused){const input=host.querySelector('[data-seller-search]');input.focus({preventScroll:true});input.setSelectionRange(cursor,cursor);}
}
let draftCheckAt=0,draftCheckBusy=false;
function registrationShortcuts(){
 const root=document.querySelector('#employeePortal:not(.hidden)'),host=root?.querySelector('.ops-team-register');if(!host||!['employee','seller'].includes(role()))return;
 let actions=host.querySelector('[data-team-fast-actions]');if(!actions){actions=document.createElement('div');actions.dataset.teamFastActions='';actions.className='ops-detail-actions';actions.innerHTML='<button type="button" class="btn btn-soft btn-small" data-team-draft hidden>Continuar rascunho</button><button type="button" class="btn btn-soft btn-small" data-team-last hidden>Abrir última ordem</button>';host.append(actions);actions.querySelector('[data-team-draft]').onclick=()=>window.openTeamMaintenanceForm(role());actions.querySelector('[data-team-last]').onclick=()=>{const state=role()==='employee'?window.employeePortalState:window.sellerPortalState;const list=(state?.services||[]).filter(s=>role()!=='employee'||s.employeeId===window.offlineServices?.actorId||employeeCreatedService(s,window.offlineServices?.actorId)).slice().sort((a,b)=>String(b.createdAt||b.date||'').localeCompare(String(a.createdAt||a.date||'')));if(list[0])window.openServiceDetails(list[0].id);};}
 const state=role()==='employee'?window.employeePortalState:window.sellerPortalState;const own=(state?.services||[]).filter(s=>role()!=='employee'||s.employeeId===window.offlineServices?.actorId||employeeCreatedService(s,window.offlineServices?.actorId));actions.querySelector('[data-team-last]').hidden=!own.length;
 if(!draftCheckBusy&&Date.now()-draftCheckAt>3000&&window.offlineServices?.hasRegistrationDraft){draftCheckBusy=true;draftCheckAt=Date.now();window.offlineServices.hasRegistrationDraft().then(has=>{if(actions.isConnected)actions.querySelector('[data-team-draft]').hidden=!has;}).catch(()=>{}).finally(()=>draftCheckBusy=false);}
}
function alignPanelButtons(){
 for(const cell of document.querySelectorAll('#dashboard td,#employeePortal td,#modalRoot td')){
  const buttons=[...cell.children].filter(child=>child.tagName==='BUTTON');let group=cell.querySelector(':scope > .panel-button-group');
  if(!buttons.length||!group&&buttons.length<2)continue;
  if(!group){group=document.createElement('div');group.className='panel-button-group';cell.insertBefore(group,buttons[0]);}
  for(const button of buttons)group.append(button);
 }
}
if(typeof document!=='undefined'){
 install();window.loadEmployeeUsers=()=>teamAccessList('employee','employeeUsers');window.loadSellerUsers=()=>teamAccessList('seller','sellerUsers');window.renderSellerServicesList=sellerBoard;
 window.setSellerServicesTab=tab=>{sellerFilter=tab==='finished'?'done':'active';sellerLimit=40;sellerBoard();};
 const earlierServiceOrder=window.serviceOrder;
 window.serviceOrder=function(id){earlierServiceOrder?.apply(this,arguments);const s=(db.services||[]).find(s=>s.id===id),paper=document.querySelector('#editForm .service-order');if(!s||!paper||paper.querySelector('[data-registration-print]'))return;const section=document.createElement('section');section.dataset.registrationPrint='';section.innerHTML=`${suppliedEquipment(s)}${complementaryWork(s)}${s.adminOwned?'<p class=ops-note>Ordem assumida pela empresa. Criador original: '+esc(s.registeredBy)+'.</p>':s.clientSource==='creator'?'<p><b>Serviço próprio:</b> '+esc(s.registeredBy||s.clientName)+'</p>':''}${s.plannedParts?.length?'<h3>Peças previstas</h3><ul>'+s.plannedParts.map(p=>'<li>'+esc(p.name)+' × '+p.quantity+'</li>').join('')+'</ul>':''}${s.hydrantHoses?.length?'<h3>Mangueiras de hidrante</h3><ul>'+s.hydrantHoses.map(h=>'<li>'+esc(h.type)+' · '+h.diameterMm+' mm · '+h.lengthMeters+' m · '+h.quantity+' unidade(s)</li>').join('')+'</ul>':''}${s.retailAmount!=null?'<p><b>Valor ao cliente:</b> '+money(Math.round(s.retailAmount*100))+'</p>':''}`;paper.append(section);};
 let supportTimer;const support=()=>{clearTimeout(supportTimer);supportTimer=setTimeout(()=>{passwordEyes();registrationShortcuts();sellerBoard();alignPanelButtons();organizeNavigation();},35);};new MutationObserver(support).observe(document.body,{childList:true,subtree:true});support();
 window.addEventListener('protec-draft-changed',()=>{draftCheckAt=0;registrationShortcuts();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('input[data-password-eye]').forEach(input=>{input.type='password';const button=passwordButtons.get(input);button?.setAttribute('aria-pressed','false');button?.setAttribute('aria-label','Mostrar senha');});});
}

// Administrative routing belongs to order details, outside the common registration.
if(typeof window!=='undefined')window.editOrderContacts=function(id){
 if(role()!=='admin')return window.toast('Acesso restrito ao administrador.');
 const service=(db.services||[]).find(s=>s.id===id);if(!service||service.closed||cancelled(service))return window.toast('Selecione uma ordem em aberto.');
 const options=(rows,selected,blank)=>'<option value="">'+esc(blank)+'</option>'+rows.map(row=>`<option value="${esc(row.id)}" ${row.id===selected?'selected':''}>${esc(row.name)}</option>`).join('');
 window.openModal('Vincular cliente / vendedor',`<p class="helper">Os vínculos são administrativos. A pessoa que registrou a ordem permanece no histórico, e cobranças já atribuídas ao criador são preservadas.</p><div class="form-grid"><label class="form-field">Cliente cadastrado<select name="clientId">${options(db.clients||[],service.clientId,'Manter contato informado, sem vínculo')}</select></label><label class="form-field">Vendedor responsável<select name="sellerId">${options((db.sellers||[]).filter(s=>s.active!==false),service.sellerId,'Sem vendedor atribuído')}</select></label></div>`,async form=>{
  if(role()!=='admin')throw Error('Acesso restrito ao administrador.');
  const current=db.services.find(s=>s.id===id);if(!current||current.closed||cancelled(current))throw Error('A ordem foi finalizada ou cancelada.');
  const clientId=String(form.get('clientId')||''),sellerId=String(form.get('sellerId')||''),client=(db.clients||[]).find(c=>c.id===clientId),seller=(db.sellers||[]).find(s=>s.id===sellerId&&s.active!==false);
  if(clientId&&!client||sellerId&&!seller)throw Error('Selecione contatos ativos do cadastro.');
  const previous=structuredClone(current);current.clientId=clientId;current.sellerId=sellerId;current.sellerName=seller?.name||'';
  if(client)Object.assign(current,{clientName:client.name,clientPhone:client.phone||'',clientEmail:client.email||'',clientSource:'customer'});
  current.history||=[];current.history.push({at:new Date().toISOString(),action:'Vínculos administrativos atualizados',description:'Cliente: '+(client?.name||'Contato informado')+'; vendedor: '+(seller?.name||'Sem atribuição'),by:localStorage.getItem('protecextintores_username')||'admin'});
  if(!await window.save()){const index=db.services.findIndex(s=>s.id===id);if(index>=0)db.services[index]=previous;throw Error('Os vínculos ainda não foram confirmados. Tente novamente.');}
  window.renderPage?.();return {afterClose:()=>window.openServiceDetails(id)};
 },'Salvar vínculos');
};

mountWorkshop();

mountDataTools();

// Keep the original route buttons and handlers; only group their presentation.
let organizedPage;
function organizeNavigation(){
 const sidebar=document.querySelector('#dashboard .sidebar');if(!sidebar)return;
 const navs=[...sidebar.querySelectorAll('.side-nav')],currentPage=window.page||'overview',changed=organizedPage!==currentPage;
 navs.forEach((nav,index)=>{
  const label=nav.previousElementSibling;if(!label?.classList.contains('side-label'))return;
  nav.id ||= 'workspace-nav-'+index;
  if(!label.querySelector('[data-nav-toggle]')){
   const title=label.textContent.trim(),toggle=document.createElement('button');toggle.type='button';toggle.dataset.navToggle='';toggle.textContent=title;toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded',String(index<2));label.replaceChildren(toggle);nav.hidden=index>=2;
   toggle.onclick=()=>{nav.hidden=!nav.hidden;toggle.setAttribute('aria-expanded',String(!nav.hidden))};
  }
  if(changed){nav.hidden=index!==0&&!nav.querySelector('button.active');label.querySelector('button').setAttribute('aria-expanded',String(!nav.hidden))}
 });
 organizedPage=currentPage;const mobile=document.getElementById('mobileAdminNav');if(!mobile||!mobile.querySelector(':scope > button[data-page]'))return;
 const buttons=[...mobile.querySelectorAll(':scope > button[data-page]')],groups=new Map();
 for(const button of buttons){const source=sidebar.querySelector('[data-page="'+button.dataset.page+'"]')?.closest('.side-nav'),title=source?.previousElementSibling?.textContent?.trim()||'Outros';if(!groups.has(title)){const group=document.createElement('details');group.className='workspace-nav-group';const summary=document.createElement('summary');summary.textContent=title;group.append(summary);groups.set(title,group);mobile.insertBefore(group,mobile.querySelector(':scope > .mobile-logout'));}const group=groups.get(title);group.append(button);if(button.classList.contains('active'))group.open=true;}
}
if(typeof document!=='undefined'){document.addEventListener('click',event=>{if(event.target.closest('[data-page]'))setTimeout(organizeNavigation,0)});window.addEventListener('popstate',()=>setTimeout(organizeNavigation,0));}

export function enhanceRegistrationSteps(form,initialStep=0){
 if(!form||form.dataset.stepsReady)return;form.dataset.stepsReady='true';form.noValidate=true;form.querySelector('[data-registration-version]')?.remove();
 const body=form.querySelector('.modal-body'),footer=form.querySelector('.modal-actions'),cancel=footer.firstElementChild,submit=footer.lastElementChild;
 const nav=document.createElement('nav');nav.className='registration-step-nav';nav.setAttribute('aria-label','Etapas do registro');
 const titles=['Cliente','Equipamentos','Complementos','Conferir'],panels=titles.map((title,index)=>{const panel=document.createElement('section');panel.className='registration-step';panel.id='registration-step-'+index;panel.dataset.step=index;const button=document.createElement('button');button.type='button';button.innerHTML='<span>'+String(index+1)+'</span>'+title;button.setAttribute('aria-controls',panel.id);button.onclick=()=>move(index);nav.append(button);return panel});
 const customerFields=document.createElement('div');customerFields.className='form-grid registration-customer-fields';customerFields.dataset.customerFields='';
 for(const name of ['clientName','clientPhone','clientEmail']){const field=form.elements[name]?.closest('label');if(field)customerFields.append(field);}
 const contacts=form.querySelector('.team-contact-grid');contacts.after(customerFields);const owner=document.createElement('p');owner.className='ops-note';owner.dataset.customerOwnerNote='';customerFields.after(owner);
 const seller=form.elements.sellerChoice;seller.value='';seller.disabled=true;seller.closest('label').hidden=true;
 const contactDetails=form.querySelector('.registration-contact-editor');if(contactDetails){contactDetails.querySelector('summary').textContent='Data e próxima manutenção';contactDetails.querySelector('.registration-owner-note')?.remove();}
 form.elements.clientChoice?.dispatchEvent(new Event('change',{bubbles:true}));
 const nodes=[...body.children];
 for(const node of nodes){let index=3;if(node.matches('.team-contact-grid,[data-customer-fields],[data-customer-owner-note]'))index=0;else if(node.matches('.team-equipment-section,.registration-purchase-card'))index=1;else if(node.matches('[data-complement-section],.registration-complementary'))index=2;else if(node.matches('.registration-required-note,[data-draft-state]'))continue;panels[index].append(node)}
 body.prepend(nav);nav.after(...panels);const review=document.createElement('div');review.className='registration-review-summary';panels[3].prepend(review);
 const previous=document.createElement('button'),next=document.createElement('button');previous.type=next.type='button';previous.className='btn btn-soft btn-small';next.className='btn btn-small';previous.textContent='Voltar';next.textContent='Avançar';footer.insertBefore(previous,submit);footer.insertBefore(next,submit);
 let step=0,stepAnimation;
 const refresh=()=>{
  const lines=[],value=(row,key)=>row.querySelector(key)?.selectedOptions[0]?.textContent||'';
  for(const row of form.querySelectorAll('[data-equipment-row]'))lines.push(['Manutenção · '+value(row,'[data-type]')+' · '+value(row,'[data-kg]'),value(row,'[data-qty]')]);
  if(form.querySelector('[data-sales-enabled]').checked)for(const row of form.querySelectorAll('[data-sale-row]'))lines.push(['Compra · '+value(row,'[data-sale-condition]')+' · '+value(row,'[data-sale-type]')+' · '+value(row,'[data-sale-kg]'),value(row,'[data-sale-qty]')]);
  if(form.querySelector('[data-hoses-enabled]').checked)for(const row of form.querySelectorAll('[data-hose-row]'))lines.push(['Mangueira · '+value(row,'[data-hose-type]')+' · '+value(row,'[data-hose-diameter]')+' · '+value(row,'[data-hose-length]'),value(row,'[data-hose-qty]')]);
  for(const card of form.querySelectorAll('[data-complement-card]'))if(card.querySelector('[data-complement-toggle]').checked)for(const row of card.querySelectorAll('[data-complement-row]'))lines.push([card.querySelector('.registration-choice b').textContent+' · '+value(row,'[data-complement-variant]')+' '+[...row.querySelectorAll('[data-complement-param]')].map(select=>select.selectedOptions[0]?.textContent).join(' · '),value(row,'[data-complement-qty]')]);
  for(const row of form.querySelectorAll('[data-part-row]'))lines.push(['Peça prevista · '+value(row,'[data-part]'),value(row,'[data-part-qty]')]);
  const choice=form.elements.clientChoice?.value,customer=choice==='__new__'?form.elements.clientName.value:choice==='__self__'||!choice?'Serviço próprio':form.elements.clientChoice.selectedOptions[0]?.textContent;
  review.innerHTML='<h3>Confira a ordem</h3><p><b>'+esc(customer)+'</b></p><p>Revise suas escolhas antes de registrar. O envio ao sistema acontece automaticamente.</p><div class="workshop-equipment-summary">'+lines.map(([name,qty])=>'<div><span>'+esc(name)+'</span><b>'+esc(qty)+' unidade(s)</b></div>').join('')+'</div>';
 };
 const invalid=index=>[...panels[index].querySelectorAll('input,select,textarea')].find(input=>!input.disabled&&!input.checkValidity());
 function show(index){
  const direction=Math.sign(index-step);
  step=index;
  panels.forEach((panel,n)=>panel.hidden=n!==step);
  [...nav.children].forEach((button,n)=>button.setAttribute('aria-current',n===step?'step':'false'));
  cancel.hidden=step!==0;
  previous.hidden=step===0;
  next.hidden=step===3;
  submit.hidden=step!==3;
  form.dataset.currentStep=step;
  if(step===3){const contact=panels[3].querySelector('details');if(contact)contact.open=true;refresh();}
  body.scrollTop=0;
  if(direction){
   stepAnimation?.cancel();
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    stepAnimation=panels[step].animate([{opacity:0,transform:`translateX(${direction*18}px)`},{opacity:1,transform:'none'}],
     {duration:240,easing:'cubic-bezier(.22,1,.36,1)'});
   }
  }
  form.dispatchEvent(new Event('protec-registration-step'));
 }
 function move(index){if(index>step){for(let n=0;n<index;n++){const control=invalid(n);if(control){show(n);control.focus();control.reportValidity();return}}}show(index)}
 previous.onclick=()=>show(Math.max(0,step-1));next.onclick=()=>move(Math.min(3,step+1));
 form.addEventListener('submit',event=>{if(step<3){event.preventDefault();event.stopImmediatePropagation();move(step+1);return;}for(let index=0;index<4;index++){const control=invalid(index);if(control){event.preventDefault();event.stopImmediatePropagation();show(index);control.focus();control.reportValidity();return}}},true);
 form.addEventListener('change',refresh);show(Math.max(0,Math.min(3,Number(initialStep)||0)));
}
