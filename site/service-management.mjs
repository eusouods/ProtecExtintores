import {estimateFinance,completed,cancelled,localDay,missingVideos} from './service-rules.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = cents => (Number(cents || 0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const role = () => localStorage.getItem('protecextintores_role') || sessionStorage.getItem('protecextintores_role');
const allServices = () => role()==='admin' ? db.services || [] : role()==='employee' ? window.employeePortalState?.services || [] : window.sellerPortalState?.services || [];
const status = s => cancelled(s)?'Cancelado':s.closed?'Finalizado':s.employeeCompletedAt?'Aguardando revisão':s.status || s.items?.[0]?.status || 'Solicitado';
const dayNames=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const dateLabel = value => value ? new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR') : '—';
const policyLabel = policy => policy?.mode==='weekly' ? `Semanal · ${dayNames[policy.weekday]}` : 'Após conclusão';
const partVideos = s => (s.items || []).flatMap((item,index)=>Object.entries(item.replacementMedia || {}).map(([part,media])=>({part,media,index})));
let privateUrls=[];
const originalClose = window.closeModal;
window.closeModal = function(){privateUrls.forEach(url=>URL.revokeObjectURL(url));privateUrls=[];return originalClose.apply(this,arguments)};
async function adminAction(payload){
 const response=await apiCall('/api/admin/operations','POST',payload),data=await apiJson(response);
 if(!response.ok)throw Error(data.error || 'Não foi possível salvar.');
 db=data.state;saveLocal();return data;
}
function attachVideos(root){root.querySelectorAll('[data-private-video]').forEach(button=>button.addEventListener('click',async()=>{
 button.disabled=true;
 try{
  const url=new URL(button.dataset.privateVideo),base=new URL(API_BASE_URL);
  if(url.origin!==base.origin || !url.pathname.startsWith('/media/service-media/'))throw Error('Endereço de vídeo inválido.');
  const response=await apiCall(url.pathname);
  if(!response.ok)throw Error('Não foi possível carregar o vídeo. Entre novamente e tente outra vez.');
  const objectURL=URL.createObjectURL(await response.blob());privateUrls.push(objectURL);
  const video=document.createElement('video');video.controls=true;video.playsInline=true;video.src=objectURL;video.className='service-evidence-player';
  button.replaceWith(video);
 }catch(error){button.textContent=error.message;button.disabled=false}
}))}
function costTable(finance){return `<div class="table-wrap"><table><thead><tr><th>Item</th><th>Qtd.</th><th>Custo un.</th><th>Receita un.</th><th>Resultado do item</th></tr></thead><tbody>${finance.lines.map(line=>`<tr><td>${esc(line.name)}</td><td>${line.quantity}</td><td>${line.unitCostCents===null?'Não informado':money(line.unitCostCents)}</td><td>${money(line.unitRevenueCents)}</td><td>${line.unitCostCents===null?'Pendente':money((line.unitRevenueCents-line.unitCostCents)*line.quantity)}</td></tr>`).join('')}</tbody></table></div><p>Valor base do serviço: <b>${money(finance.baseRevenueCents)}</b></p><div class="finance-metrics"><div><small>Valor total da ordem</small><b>${money(finance.revenueCents)}</b></div><div><small>Custos registrados</small><b>${money(finance.costCents)}</b></div><div><small>${finance.costsComplete?'Resultado bruto':'Resultado parcial'}</small><b>${money(finance.profitCents)}</b></div></div>${finance.missingCosts.length?`<p class="helper">Custos pendentes: ${finance.missingCosts.map(esc).join(', ')}. O resultado ainda não representa todos os gastos.</p>`:''}<p class="helper">Resultado bruto = valor da ordem menos custos registrados; despesas fixas e impostos só entram se forem cadastrados como itens.</p>`}
window.openServiceDetails = function(id){
 const s=allServices().find(s=>s.id===id);if(!s)return toast('Serviço não encontrado. Atualize o painel.');
 const admin=role()==='admin';
 let finance=s.finance;try{if(admin&&!finance)finance=estimateFinance(db,s)}catch{}
 const charge=s.charge || (s.finance?{amountCents:s.finance.revenueCents,dueDate:s.finance.dueDate,payment:s.finance.payment,policy:s.finance.policy}:null);
 const body=`<div class="service-detail-summary"><span class="status">${esc(status(s))}</span><h3>${esc(s.clientName || 'Cliente não informado')}</h3><p>${esc(s.serviceType || 'Manutenção')} · ${dateLabel(s.date)}</p><p>Técnico: ${esc(s.employeeName || 'Aguardando aceite')} · Vendedor: ${esc(s.sellerName || 'Administração')}</p><p><b>Pintura: ${Number(s.paintingQuantity ?? (s.items || []).filter(i=>i.painted).length)} extintor(es)</b></p></div>${(s.items || []).map((item,index)=>`<section class="service-detail-item"><h3>Extintor ${index+1} · ${esc(item.type)} ${esc(item.kg || '')}</h3><p>Série: ${esc(item.serial || 'Não informada')} · ${esc(item.status)}</p><p>Peças: ${(item.replacedParts || []).map(esc).join(', ') || 'Nenhuma'}</p><p>${esc(item.notes || '')}</p>${(item.replacedParts || []).map(part=>item.replacementMedia?.[part]?.url?`<div class="evidence-block"><span class="product-reference-label">${window.protecArtwork.artwork({name:part},'tiny')}<b>${esc(part)}</b></span><button type="button" class="btn btn-soft btn-small" data-private-video="${esc(item.replacementMedia[part].url)}">Assistir vídeo</button></div>`:`<p class="helper">${esc(part)}: vídeo pendente.</p>`).join('')}</section>`).join('')}${charge?`<section class="service-detail-item"><h3>Cobrança da ordem</h3><p>Valor: <b>${money(charge.amountCents)}</b> · ${esc(policyLabel(charge.policy))}</p><p>Vencimento: ${dateLabel(charge.dueDate)} · ${charge.payment?.status==='paid'?'Pago em '+dateLabel(charge.payment.paidAt):'A pagar'}</p>${charge.payment?.reference?`<p>Referência: ${esc(charge.payment.reference)}</p>`:''}</section>`:''}${admin&&finance?`<section class="service-detail-item"><h3>Custos e resultado ${s.finance?'registrados':'estimados'}</h3>${costTable(finance)}</section>`:''}<section class="service-detail-item"><h3>Histórico da ordem</h3>${(s.history || []).slice().reverse().map(event=>`<p><small>${dateLabel(event.at)}</small> <b>${esc(event.action || event.status || 'Atualização')}</b><br>${esc(event.description || '')}</p>`).join('') || '<p>Sem atualizações adicionais.</p>'}</section>`;
 const chargeLines=!admin&&charge?.lines?.length?`<section class="service-detail-item"><h3>Itens da cobrança</h3>${charge.lines.map(line=>`<p>${esc(line.name)} × ${line.quantity} · ${money(line.unitRevenueCents)} por unidade</p>`).join('')}</section>`:'';
 openModal(`Serviço ${esc(s.code || '')}`,body+chargeLines,()=>true,'Fechar');attachVideos(document.getElementById('editForm'));
};
window.chooseEmployeeNextStep = function(id){
 openModal('Quantos extintores receberam pintura?',`<p>Registre a quantidade pintada neste serviço. Use zero quando não houve pintura.</p><label class="form-field">Quantidade<input name="quantity" type="number" required min="0" max="${allServices().find(s=>s.id===id)?.items?.length || 0}" step="1" value="${allServices().find(s=>s.id===id)?.paintingQuantity || 0}"></label>`,async form=>{
  const response=await apiCall('/api/employee/painting','POST',{serviceId:id,quantity:Number(form.get('quantity'))}),data=await apiJson(response);
  if(!response.ok)throw Error(data.error);
  await window.refreshEmployeePortal?.();return true;
 },'Salvar quantidade');
};
window.completeEmployeeService = async function(id){
 const s=allServices().find(s=>s.id===id);if(!s)return;
 openModal('Concluir execução do serviço',`<p>Quantos extintores receberam pintura? Informe zero quando não houve pintura.</p><label class="form-field">Quantidade de pinturas<input type="number" name="quantity" min="0" max="${s.items.length}" step="1" required value="${s.paintingQuantity || 0}"></label><p class="helper">Cada peça trocada precisa ter seu vídeo enviado. O serviço seguirá para revisão do administrador.</p>`,async form=>{
  let response=await apiCall('/api/employee/painting','POST',{serviceId:id,quantity:Number(form.get('quantity'))}),data=await apiJson(response);if(!response.ok)throw Error(data.error);
  response=await apiCall('/api/employee/complete','POST',{serviceId:id});data=await apiJson(response);if(!response.ok)throw Error(data.error);
  await window.refreshEmployeePortal?.();toast('Execução concluída. O serviço permanece no seu histórico.');return true;
 },'Concluir e enviar à revisão');
};
window.clearCompletedServices = () => toast('Os serviços concluídos são preservados no histórico individual. Use os filtros para consultar.');
let employeeTab='active',employeeQuery='';
window.renderEmployeeWorkbench = function(){
 const host=document.getElementById('employeeCards');if(!host||role()!=='employee')return;
 const list=allServices(),visible=list.filter(s=>employeeTab==='history' ? completed(s)||cancelled(s) : !completed(s)&&!cancelled(s));
 host.innerHTML=`<div data-service-workbench><div class="employee-tabs"><button type="button" data-work-tab="active" class="${employeeTab==='active'?'active':''}">Em execução (${list.filter(s=>!completed(s)&&!cancelled(s)).length})</button><button type="button" data-work-tab="history" class="${employeeTab==='history'?'active':''}">Meu histórico (${list.filter(s=>completed(s)||cancelled(s)).length})</button></div><label class="form-field">Buscar código ou cliente<input type="search" data-work-search value="${esc(employeeQuery)}"></label>${visible.map(s=>`<article class="employee-service"><header class="employee-service-head"><div><b>${esc(s.code || '')}</b><p>${esc(s.clientName || 'Cliente não informado')}</p></div><span class="status">${esc(status(s))}</span></header><div class="employee-service-body service-detail-item"><p>${s.items?.length || 0} extintor(es) · Pintura: ${s.paintingQuantity || 0}</p><button type="button" class="btn btn-soft btn-small" data-detail="${esc(s.id)}">Detalhes e vídeos</button>${!completed(s)&&!cancelled(s)?s.employeeId?`<button type="button" class="btn btn-soft btn-small" data-parts="${esc(s.id)}">Registrar peças e vídeos</button><button type="button" class="btn btn-soft btn-small" data-paint="${esc(s.id)}">Quantidade de pinturas</button><button type="button" class="btn btn-small" data-complete="${esc(s.id)}">Concluir execução</button>`:`<button type="button" class="btn btn-small" data-accept="${esc(s.id)}">Aceitar serviço</button>`:''}</div></article>`).join('') || '<p class="empty">Nenhum serviço neste filtro.</p>'}</div>`;
 host.querySelectorAll('[data-work-tab]').forEach(b=>b.onclick=()=>{employeeTab=b.dataset.workTab;window.renderEmployeeWorkbench()});
 const applySearch=()=>host.querySelectorAll('.employee-service').forEach(card=>card.hidden=!card.textContent.toLowerCase().includes(employeeQuery.toLowerCase()));
 host.querySelector('[data-work-search]').oninput=e=>{employeeQuery=e.target.value;applySearch()};applySearch();
 host.querySelectorAll('[data-detail]').forEach(b=>{b.onclick=()=>window.openServiceDetails(b.dataset.detail);const service=list.find(s=>s.id===b.dataset.detail);if(service?.employeeCompletedAt&&!service.closed&&missingVideos(service).length){const upload=document.createElement('button');upload.type='button';upload.className='btn btn-soft btn-small';upload.dataset.parts=service.id;upload.textContent='Completar vídeos pendentes';b.after(upload)}});
 host.querySelectorAll('[data-complete]').forEach(b=>b.onclick=()=>window.completeEmployeeService(b.dataset.complete));
 host.querySelectorAll('[data-paint]').forEach(b=>b.onclick=()=>window.chooseEmployeeNextStep(b.dataset.paint));
 host.querySelectorAll('[data-accept]').forEach(b=>b.onclick=()=>window.acceptEmployeeService(b.dataset.accept));
 host.querySelectorAll('[data-parts]').forEach(b=>b.onclick=()=>{
  const service=list.find(s=>s.id===b.dataset.parts),groups=[...new Set(service.items.map(item=>`${item.type}|${item.kg || ''}`))];
  if(groups.length===1)return window.employeeNote(service.id,0);
  openModal('Escolha o grupo de extintores',`<label class="form-field">Tipo e capacidade<select name="group">${groups.map((group,index)=>`<option value="${index}">${esc(group.replace('|',' · '))}</option>`).join('')}</select></label>`,form=>({afterClose:()=>window.employeeNote(service.id,Number(form.get('group')))}),'Abrir peças');
 });
};
window.renderSellerServicesList = function(){
 const host=document.getElementById('sellerServices'),state=window.sellerPortalState;if(!host||!state)return;
 const list=state.services || [],tab=state.tab || 'ordered',visible=list.filter(s=>tab==='finished'?s.closed||cancelled(s):!s.closed&&!cancelled(s));
 const charges=list.filter(s=>s.charge?.payment?.status==='pending'),total=charges.reduce((sum,s)=>sum+s.charge.amountCents,0);
 const heading=document.getElementById('sellerServiceHeading');if(heading)heading.textContent=tab==='finished'?'Meu histórico de serviços':'Serviços em andamento';
 host.innerHTML=`<div class="finance-metrics"><div><small>Ordens a pagar</small><b>${charges.length}</b></div><div><small>Saldo a pagar</small><b>${money(total)}</b></div><div><small>Ordens quitadas</small><b>${list.filter(s=>s.charge?.payment?.status==='paid').length}</b></div></div>${charges.length?`<h3>Meus vencimentos</h3>${[...new Set(charges.map(s=>s.charge.dueDate))].sort().map(date=>`<p>${dateLabel(date)} · ${money(charges.filter(s=>s.charge.dueDate===date).reduce((sum,s)=>sum+s.charge.amountCents,0))}</p>`).join('')}`:''}${visible.map(s=>`<article class="seller-service-status"><header><div><b>${esc(s.code)}</b><p>${esc(s.clientName || 'Cliente não informado')} · ${dateLabel(s.date)}</p></div><span class="status">${esc(status(s))}</span></header><p>Peças trocadas: ${(s.items || []).reduce((sum,i)=>sum+(i.replacedParts || []).length,0)} · Pinturas: ${s.paintingQuantity || 0} · Vídeos: ${partVideos(s).length}</p>${s.charge?`<p>Ordem: ${money(s.charge.amountCents)} · ${s.charge.payment.status==='paid'?'Pago':'Vence em '+dateLabel(s.charge.dueDate)} · ${esc(policyLabel(s.charge.policy))}</p>`:'<p class="helper">Cobrança será registrada na finalização administrativa.</p>'}<button type="button" class="btn btn-soft btn-small" data-detail="${esc(s.id)}">Ver serviço, peças e vídeos</button></article>`).join('') || '<p class="empty">Nenhum serviço neste filtro.</p>'}`;
 host.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>window.openServiceDetails(b.dataset.detail));
 document.querySelectorAll('[data-seller-tab]').forEach(b=>b.classList.toggle('active',b.dataset.sellerTab===tab));
};
window.openSellerServiceTracking = window.openServiceDetails;

function policyForm(policy={mode:'completion',weekday:5}){return `<div class="form-grid"><label class="form-field">Forma de pagamento<select name="mode"><option value="completion" ${policy.mode==='completion'?'selected':''}>Após a conclusão administrativa</option><option value="weekly" ${policy.mode==='weekly'?'selected':''}>Acumulado semanal</option></select></label><label class="form-field">Dia de pagamento semanal<select name="weekday">${dayNames.map((name,index)=>`<option value="${index}" ${Number(policy.weekday)===index?'selected':''}>${name}</option>`).join('')}</select></label></div><p class="helper">Aplica-se às próximas ordens finalizadas. As já cobradas mantêm o prazo registrado. Serviço finalizado no dia do acerto vence nesse mesmo dia.</p>`}
window.editSellerBillingPolicy = function(id=''){
 const seller=(db.sellers || []).find(s=>s.id===id),policy=seller?.billingPolicy || db.settings.sellerBillingPolicy;
 openModal(id?'Pagamento de '+esc(seller?.name):'Regra padrão de pagamento',policyForm(policy),async form=>{await adminAction({action:'policy',sellerId:id,policy:{mode:form.get('mode'),weekday:Number(form.get('weekday'))}});renderFinance();return true});
};
window.editCostEntry = function(id=''){
 const entry=(db.costCatalog || []).find(e=>e.id===id) || {};
 openModal('Item de custo e cobrança',`<div class="form-grid"><label class="form-field">Nome<input name="name" required maxlength="150" value="${esc(entry.name || '')}" placeholder="Válvula M30, placa, extintor, pintura..."></label><label class="form-field">Categoria<input name="category" list="costCategories" value="${esc(entry.category || '')}"><datalist id="costCategories">${['Serviço','Extintores','Placas','Peças','Pintura','Mão de obra','Outros'].map(name=>`<option value="${name}">`).join('')}</datalist></label><label class="form-field">Capacidade / peso (opcional)<input name="kg" value="${esc(entry.kg || '')}" placeholder="6"></label><label class="form-field">Custo unitário pago (R$)<input name="unitCost" type="number" min="0" step="0.01" required value="${entry.unitCost ?? ''}"></label><label class="form-field">Valor cobrado por unidade (R$)<input name="salePrice" type="number" min="0" step="0.01" required value="${entry.salePrice ?? ''}"></label><label><input type="checkbox" name="technicalPart" ${entry.technicalPart?'checked':''}> Disponível como peça para o técnico (exige vídeo)</label></div><p class="helper">Para custo de recarga/manutenção automática, use a categoria Serviço com o mesmo nome e peso do tipo de extintor. Aquisições de extintores e placas entram como itens adicionais da ordem. Pintura deve ter o nome Pintura.</p>`,async form=>{await adminAction({action:'save-catalog',id,name:form.get('name'),category:form.get('category'),kg:form.get('kg'),unitCost:form.get('unitCost'),salePrice:form.get('salePrice'),technicalPart:form.has('technicalPart')});renderFinance();return true});
};
window.removeCostEntry = async function(id){if(!confirm('Remover este item das opções? Os valores de ordens já finalizadas serão preservados.'))return;try{await adminAction({action:'remove-catalog',id});renderFinance()}catch(e){toast(e.message)}};
window.editServiceFinance = function(id){
 const service=(db.services || []).find(s=>s.id===id);if(!service)return;
 const entries=(db.costCatalog || []).filter(e=>e.active!==false),lines=service.financialItems || [];
 openModal('Itens adicionais · '+esc(service.code),`<p class="helper">Peças registradas pelo técnico e pintura entram automaticamente. Use esta lista para extintores novos, placas, mão de obra extra ou outros gastos/cobranças. Não repita aqui peças já registradas.</p><div id="financeOrderLines"></div><button class="btn btn-soft btn-small" type="button" id="addFinanceLine">Adicionar item</button>`,async()=>{
  const items=[...document.querySelectorAll('[data-finance-line]')].map(row=>({catalogId:row.querySelector('select').value,quantity:Number(row.querySelector('input').value)}));
  await adminAction({action:'service-items',serviceId:id,items});renderFinance();return true;
 });
 const add=(line={})=>{const row=document.createElement('div');row.className='finance-line';row.dataset.financeLine='';row.innerHTML=`<select required aria-label="Item">${entries.map(entry=>`<option value="${esc(entry.id)}" ${entry.id===line.catalogId?'selected':''}>${esc(entry.name)} ${esc(entry.kg || '')}</option>`).join('')}</select><input aria-label="Quantidade" type="number" min="1" max="10000" step="1" value="${line.quantity || 1}" required><button type="button" class="icon-btn">Remover</button>`;row.querySelector('button').onclick=()=>row.remove();document.getElementById('financeOrderLines').append(row)};
 lines.forEach(add);document.getElementById('addFinanceLine').onclick=()=>entries.length?add():toast('Cadastre os itens de custo primeiro.');
};
window.markSellerPaid = function(sellerId,due){
 const services=(db.services || []).filter(s=>s.sellerId===sellerId&&s.finance?.dueDate===due&&s.finance.payment.status==='pending'&&!cancelled(s));
 openModal('Confirmar recebimento',`<p>${services.length} ordem(ns) · Total <b>${money(services.reduce((sum,s)=>sum+s.finance.revenueCents,0))}</b></p><p>Confirme somente após receber o pagamento do vendedor.</p><label class="form-field">Referência do pagamento / comprovante<input required name="reference" minlength="3" maxlength="300"></label>`,async form=>{await adminAction({action:'mark-paid',serviceIds:services.map(s=>s.id),reference:form.get('reference')});renderFinance();return true},'Confirmar recebimento');
};
window.importClosedOrder = async function(id){if(!confirm('Registrar cobrança desta ordem anterior com os custos e a regra atuais?'))return;try{await adminAction({action:'capture',serviceId:id});renderFinance()}catch(error){toast(error.message)}};
function renderFinance(){
 const host=document.getElementById('content');if(!host)return;
 const catalog=(db.costCatalog || []).filter(e=>e.active!==false),services=db.services || [],charged=services.filter(s=>s.finance&&!cancelled(s)),pending=charged.filter(s=>s.sellerId&&s.finance.payment.status==='pending'),paid=charged.filter(s=>s.finance.payment.status==='paid'),groups=[...new Set(pending.map(s=>`${s.sellerId}|${s.finance.dueDate}`))];
 host.innerHTML=`<div class="page-title"><div><h1>Custos e cobranças</h1><p>Investimento, resultado bruto das ordens e acerto dos vendedores.</p></div><button type="button" class="btn btn-small" onclick="editCostEntry()">Adicionar item</button></div><div class="finance-metrics"><div><small>A receber de vendedores</small><b>${money(pending.reduce((sum,s)=>sum+s.finance.revenueCents,0))}</b></div><div><small>Recebido de vendedores</small><b>${money(paid.reduce((sum,s)=>sum+s.finance.revenueCents,0))}</b></div><div><small>Resultado bruto das ordens</small><b>${money(charged.filter(s=>s.finance.costsComplete).reduce((sum,s)=>sum+s.finance.profitCents,0))}</b><small>${charged.filter(s=>!s.finance.costsComplete).length} ordem(ns) com custos pendentes</small></div></div><section class="panel config-card"><h2>Regras de pagamento</h2><button type="button" class="btn btn-soft btn-small" onclick="editSellerBillingPolicy()">Padrão: ${esc(policyLabel(db.settings.sellerBillingPolicy))}</button>${(db.sellers || []).map(seller=>`<div class="list-line"><span><b>${esc(seller.name)}</b><br>${esc(policyLabel(seller.billingPolicy || db.settings.sellerBillingPolicy))}</span><button type="button" class="icon-btn" data-policy="${esc(seller.id)}">Definir regra</button></div>`).join('')}</section><section class="panel config-card"><h2>Acertos em aberto</h2>${groups.map(key=>{const [sellerId,due]=key.split('|'),list=pending.filter(s=>s.sellerId===sellerId&&s.finance.dueDate===due);return `<div class="list-line"><span><b>${esc(list[0].sellerName || 'Vendedor')}</b> · ${dateLabel(due)} · ${money(list.reduce((sum,s)=>sum+s.finance.revenueCents,0))}<br>${list.map(s=>esc(s.code)).join(', ')}${due<localDay(new Date())?' · Vencido':''}</span><button type="button" class="btn btn-small" data-pay="${esc(sellerId)}" data-due="${due}">Registrar recebimento</button></div>`}).join('') || '<p>Não há acertos pendentes.</p>'}</section><section class="panel config-card"><h2>Itens: custo e valor cobrado</h2><p class="helper">Remover uma opção preserva os lançamentos já fechados.</p><div class="table-wrap"><table><thead><tr><th>Item</th><th>Categoria</th><th>Custo pago</th><th>Valor cobrado</th><th>Resultado unitário</th><th>Ações</th></tr></thead><tbody>${catalog.map(entry=>`<tr><td><span class="product-reference-label">${window.protecArtwork.artwork(entry,'tiny')}<span>${esc(entry.name)} ${esc(entry.kg || '')}</span></span></td><td>${esc(entry.category)}</td><td>${money(entry.unitCost*100)}</td><td>${money(entry.salePrice*100)}</td><td>${money((entry.salePrice-entry.unitCost)*100)}</td><td><button type="button" class="icon-btn" data-edit-cost="${esc(entry.id)}">Editar</button> <button type="button" class="icon-btn" data-remove-cost="${esc(entry.id)}">Remover</button></td></tr>`).join('') || '<tr><td colspan="6">Cadastre os custos reais da empresa para calcular os resultados.</td></tr>'}</tbody></table></div></section><section class="panel config-card"><h2>Ordens e resultados</h2>${services.filter(s=>!cancelled(s)).slice().reverse().map(s=>`<div class="list-line"><span><b>${esc(s.code)}</b> · ${esc(s.clientName || '')}<br>${esc(status(s))} ${s.finance?' · '+money(s.finance.revenueCents):''}</span><div><button class="icon-btn" type="button" data-detail="${esc(s.id)}">Detalhes e resultado</button>${!s.closed?` <button class="icon-btn" type="button" data-finance-items="${esc(s.id)}">Itens adicionais</button>`:!s.finance?` <button class="icon-btn" type="button" data-import="${esc(s.id)}">Importar ordem anterior</button>`:''}</div></div>`).join('')}</section>`;
 host.querySelectorAll('[data-policy]').forEach(b=>b.onclick=()=>window.editSellerBillingPolicy(b.dataset.policy));
 host.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>window.markSellerPaid(b.dataset.pay,b.dataset.due));
 host.querySelectorAll('[data-edit-cost]').forEach(b=>b.onclick=()=>window.editCostEntry(b.dataset.editCost));
 host.querySelectorAll('[data-remove-cost]').forEach(b=>b.onclick=()=>window.removeCostEntry(b.dataset.removeCost));
 host.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>window.openServiceDetails(b.dataset.detail));
 host.querySelectorAll('[data-finance-items]').forEach(b=>b.onclick=()=>window.editServiceFinance(b.dataset.financeItems));
 host.querySelectorAll('[data-import]').forEach(b=>b.onclick=()=>window.importClosedOrder(b.dataset.import));
}
const nativeGo=window.go,nativeRender=window.renderPage;
window.go=function(target,...args){if(target==='finance'){page='finance';window.page='finance';document.getElementById('crumb').textContent='Custos e cobranças';document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page==='finance'));return renderFinance()}return nativeGo.call(this,target,...args)};
window.renderPage=function(target,...args){if((target || window.page)==='finance')return renderFinance();return nativeRender.call(this,target,...args)};
function mount(){
 const nav=document.querySelector('.side-nav button[data-page="services"]')?.parentElement;
 for(const host of [nav,document.getElementById('mobileAdminNav')])if(host&&!host.querySelector('[data-page="finance"]')){const b=document.createElement('button');b.type='button';b.dataset.page='finance';b.innerHTML='<span>＄</span><span class="navtext">Custos e cobranças</span>';b.onclick=()=>window.go('finance');host.append(b)}
 const employee=document.getElementById('employeeCards');if(role()==='employee'&&employee&&!employee.querySelector('[data-service-workbench]'))window.renderEmployeeWorkbench();
 document.querySelectorAll('#servicesTable tbody tr').forEach(row=>{
  if(row.querySelector('[data-service-details]'))return;
  const service=(db.services || []).find(service=>row.innerHTML.includes(service.id));if(!service)return;
  const button=document.createElement('button');button.type='button';button.className='icon-btn';button.dataset.serviceDetails='';button.textContent='Peças, vídeos e resultado';button.onclick=()=>window.openServiceDetails(service.id);row.querySelector('td:last-child')?.append(button);
 });
 document.getElementById('clearCompletedServices')?.remove();
}
new MutationObserver(()=>requestAnimationFrame(mount)).observe(document.body,{childList:true,subtree:true});mount();
// A revisão administrativa também disponibiliza as evidências antes do fechamento.
for(const name of ['manageProcess','serviceHistory','serviceOrder']){const previous=window[name];window[name]=function(id,...args){const result=previous.call(this,id,...args);if(role()==='admin'){const actions=document.querySelector('#modalRoot .modal-actions');if(actions){const b=document.createElement('button');b.type='button';b.className='btn btn-soft btn-small';b.textContent='Detalhes e vídeos';b.onclick=()=>window.openServiceDetails(id);actions.prepend(b)}}return result}}
