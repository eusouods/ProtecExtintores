export const PART_NAMES = ['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];
export const cents = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) throw Error('Informe um valor não negativo e válido.');
  return Math.round(number * 100);
};
export const cancelled = service => Boolean(service.cancelledAt || service.status === 'Cancelado');
export const completed = service => Boolean(service.closed || service.employeeCompletedAt);
export function billingOwner(service){
  if(service.billingOwner&&['employee','seller'].includes(service.billingOwner.role)&&service.billingOwner.id)return service.billingOwner;
  return service.sellerId?{role:'seller',id:service.sellerId,name:service.sellerName||'Vendedor'}:null;
}
export function teamDiscount(state,owner){
  const person=(state[owner?.role==='employee'?'employees':'sellers']||[]).find(p=>p.id===owner?.id);
  const raw=person?.teamPricing?.discountPercent ?? state.settings?.teamPricing?.[owner?.role]?.discountPercent;
  const percent=Number(raw);
  return raw!==undefined&&raw!==null&&raw!==''&&Number.isFinite(percent)&&percent>0&&percent<100?percent:null;
}
export function teamBase(state,service){
  const owner=billingOwner(service),discount=teamDiscount(state,owner);
  if(service.billingVersion!==2)return {amountCents:cents(service.basePrice??service.price??0),discountPercent:null,pending:false};
  const items=service.items||[],configs=items.map(item=>(state.types||[]).find(t=>t.name===item.type&&String(t.kg||'')===String(item.kg||'')));
  const pending=discount===null||(!Number.isInteger(service.internalBaseCents)&&configs.some(t=>!t||Number(t.price)<=0));
  const amountCents=Number.isInteger(service.internalBaseCents)?service.internalBaseCents:configs.reduce((sum,t)=>sum+Math.round(cents(t?.price||0)*(1-(discount||0)/100)),0);
  return {amountCents,discountPercent:discount,pending};
}
export function localDay(instant) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
}
export function dueDate(instant, policy) {
  const day = localDay(instant), date = new Date(day+'T12:00:00Z');
  if (policy.mode === 'weekly') {
    const weekday = Number(policy.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw Error('Escolha o dia do pagamento semanal.');
    date.setUTCDate(date.getUTCDate() + (weekday - date.getUTCDay() + 7) % 7);
  }
  return date.toISOString().slice(0,10);
}
export function servicePolicy(state, service) {
  const owner=billingOwner(service),person=(state[owner?.role==='employee'?'employees':'sellers']||[]).find(s=>s.id===owner?.id);
  const policy = person?.billingPolicy || state.settings?.[owner?.role==='employee'?'employeeBillingPolicy':'sellerBillingPolicy'] || {mode:'completion',weekday:5};
  if (!['weekly','completion'].includes(policy.mode)) throw Error('Forma de cobrança inválida.');
  return {mode:policy.mode,weekday:Number(policy.weekday ?? 5)};
}
export function estimateFinance(state, service) {
  const internal=teamBase(state,service),factor=service.billingVersion===2?1-(internal.discountPercent||0)/100:1;
  const catalog = (state.costCatalog || []).filter(entry => entry.active !== false);
  const lines = [];
  const add = (name, quantity, entry, revenue, kind) => {
    if (!quantity) return;
    lines.push({name,quantity,kind,unitCostCents:entry?.unitCost != null ? cents(entry.unitCost) : null,unitRevenueCents:Math.round((revenue == null ? cents(entry?.salePrice ?? state.settings?.partPrices?.[name] ?? 0) : cents(revenue))*factor)});
  };
  const find = (name, kg) => catalog.find(entry => entry.name === name && String(entry.kg || '') === String(kg || '')) || catalog.find(entry => entry.name === name && !entry.kg);
  for (const item of service.items || []) {
    const serviceCost = catalog.find(entry=>entry.category==='Serviço' && entry.name===item.type && String(entry.kg || '')===String(item.kg || ''));
    const publicType=(state.types||[]).find(t=>t.name===item.type&&String(t.kg||'')===String(item.kg||''));
    add(item.type || 'Extintor',1,serviceCost,service.billingVersion===2?(publicType?.price||0):(item.unitPrice || 0),'equipment-cost');
    for (const name of item.replacedParts || []) add(name,1,find(name),null,'part');
  }
  add('Pintura',Number(service.paintingQuantity ?? (service.items || []).filter(i=>i.painted).length),find('Pintura'),null,'painting');
  for (const line of service.financialItems || []) {
    const entry = catalog.find(entry => entry.id === line.catalogId);
    if (!entry) throw Error('Um item financeiro foi removido. Revise a ordem antes de finalizar.');
    if (!Number.isInteger(Number(line.quantity)) || line.quantity < 1 || line.quantity > 10000) throw Error('Quantidade financeira inválida.');
    add(entry.name,Number(line.quantity),entry,null,'additional');
  }
  const baseRevenueCents = internal.amountCents;
  const revenueCents = baseRevenueCents + lines.filter(line=>line.kind!=='equipment-cost').reduce((sum,line)=>sum+line.quantity*line.unitRevenueCents,0);
  const costCents = lines.reduce((sum,line)=>sum+line.quantity*(line.unitCostCents || 0),0);
  const missingCosts = lines.filter(line=>line.unitCostCents === null).map(line=>line.name);
  return {lines,baseRevenueCents,revenueCents,costCents,profitCents:revenueCents-costCents,missingCosts:[...new Set(missingCosts)],costsComplete:!missingCosts.length,pricingPending:internal.pending,discountPercent:internal.discountPercent};
}
export function captureFinance(state, service, instant) {
  const totals = estimateFinance(state,service), policy = servicePolicy(state,service),payer=billingOwner(service);
  if(service.billingVersion===2&&(totals.pricingPending||totals.revenueCents<=0))throw Error('Configure o desconto interno do perfil e os preços dos equipamentos, ou defina o valor interno da manutenção, antes de finalizar.');
  let due=payer?dueDate(instant,policy):'';
  if(payer&&policy.mode==='weekly'&&(state.teamBills||[]).some(b=>b.payer.role===payer.role&&b.payer.id===payer.id&&b.policy.mode==='weekly'&&b.dueDate===due)){
    const next=new Date(due+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+7);due=next.toISOString().slice(0,10);
  }
  return {...totals,capturedAt:instant,sellerId:service.sellerId || '',payer,policy,dueDate:due,payment:payer ? {status:'pending'} : {status:'not-applicable'}};
}
export function preserveAndCapture(state, previous, instant, options = {}) {
  if(!options.teamBilling)state.teamBills=structuredClone(previous.teamBills||[]);
  for (const old of previous.services || []) {
    const next = (state.services || []).find(service=>service.id === old.id);
    if (!next) throw Error('O histórico de serviços deve ser preservado. Arquive o serviço em vez de excluí-lo.');
    if (old.finance && !options.settlement) next.finance = structuredClone(old.finance);
    if (old.closed) {
      if (!next.closed || next.sellerId !== old.sellerId || next.employeeId !== old.employeeId || JSON.stringify(next.billingOwner||null)!==JSON.stringify(old.billingOwner||null)) throw Error('O responsável por serviço finalizado não pode ser alterado.');
      // Os dados técnicos e os vídeos do atendimento fechado permanecem imutáveis.
      next.items=structuredClone(old.items || []);
      next.paintingQuantity=old.paintingQuantity;
      next.employeeCompletedAt=old.employeeCompletedAt;
    }
  }
  for (const service of state.services || []) {
    const old = (previous.services || []).find(previous=>previous.id === service.id);
    if (service.closed && !old?.closed) {
      service.finance = captureFinance(state,service,service.closedAt || instant);
      service.basePrice ??= Number(service.price || 0);
      service.price = service.finance.revenueCents / 100;
      service.status = 'Concluído';
    }
  }
}
export function technicalView(service) {
  return {id:service.id,code:service.code,date:service.date,serviceType:service.serviceType,clientName:service.clientName || '',employeeId:service.employeeId || '',employeeName:service.employeeName || '',sellerName:service.sellerName || '',closed:Boolean(service.closed),closedAt:service.closedAt || '',cancelledAt:service.cancelledAt || '',employeeCompletedAt:service.employeeCompletedAt || '',status:service.status,pausedAt:service.pausedAt || '',pauseReason:service.pauseReason || '',pauseStatus:service.pauseStatus || '',pauseIntervals:service.pauseIntervals || [],paintingQuantity:Number(service.paintingQuantity ?? (service.items || []).filter(item=>item.painted).length),paintingRecordedAt:service.paintingRecordedAt || '',notes:service.notes || '',history:service.history || [],workflow:service.workflow || null,items:(service.items || []).map(item=>({type:item.type,kg:item.kg,serial:item.serial || '',maintenanceYear:item.maintenanceYear || '',hydroYear:item.hydroYear || '',status:item.status,notes:item.notes || '',painted:Boolean(item.painted),replacedParts:item.replacedParts || [],replacementMedia:item.replacementMedia || {},history:item.history || []}))};
}
export function teamView(service,role,id){
  const view = technicalView(service);
  const owner=service.finance?.payer||billingOwner(service),owns=owner?.role===role&&owner.id===id;
  view.billingOwner=service.billingOwner||null;view.billingVersion=service.billingVersion||1;
  if(owns&&service.retailAmount!=null)view.retailAmount=service.retailAmount;
  view.nextMaintenanceMonth = service.nextMaintenanceMonth || '';
  view.events = (service.history || []).map(event=>({at:event.at,status:event.action || event.status,item:event.description || ''}));
  view.charge = owns&&service.finance ? {amountCents:service.finance.revenueCents,dueDate:service.finance.dueDate,policy:service.finance.policy,payment:service.finance.payment,settlementId:service.finance.settlementId||'',lines:service.finance.lines.map(line=>({name:line.name,quantity:line.quantity,unitRevenueCents:line.unitRevenueCents}))} : null;
  return view;
}
export function sellerView(service){return teamView(service,'seller',service.sellerId);}
export function missingVideos(service) {
  return (service.items || []).flatMap((item,index)=>(item.replacedParts || []).filter(part=>!item.replacementMedia?.[part]?.url).map(part=>`Extintor ${index+1}: ${part}`));
}

// Shared admin commands, including offline validation.
const cleanText = (value,max=150) => String(value || '').trim().slice(0,max);
const requirePolicy = policy => {
  if (!policy || !['weekly','completion'].includes(policy.mode)) throw Error('Selecione a forma de pagamento.');
  const weekday=Number(policy.weekday);
  if (!Number.isInteger(weekday) || weekday<0 || weekday>6) throw Error('Selecione o dia da semana.');
  return {mode:policy.mode,weekday};
};

export function applyAdminOperation(state,data,username,at){
  if(data.action==='save-catalog'){
    state.costCatalog ||= [];
    const name=cleanText(data.name),category=cleanText(data.category,60),kg=cleanText(data.kg,12);
    if(!name)throw Error('Informe o nome do item.');
    cents(data.unitCost);cents(data.salePrice);
    const duplicate=state.costCatalog.find(item=>item.id!==data.id&&item.active!==false&&item.name===name&&String(item.kg || '')===kg);
    if(duplicate)throw Error('Já existe um item com esse nome e capacidade.');
    let item=state.costCatalog.find(item=>item.id===data.id);
    if(!item){item={id:data.id||crypto.randomUUID()};state.costCatalog.push(item)}
    Object.assign(item,{name,category,kg,unitCost:Number(data.unitCost),salePrice:Number(data.salePrice),technicalPart:Boolean(data.technicalPart),active:true,updatedAt:at});
  }else if(data.action==='remove-catalog'){
    const item=(state.costCatalog || []).find(item=>item.id===data.id);
    if(!item)throw Error('Item não encontrado.');
    item.active=false;item.removedAt=at;
  }else if(data.action==='policy'){
    const policy=requirePolicy(data.policy);
    const role=data.role||'seller',id=data.personId||data.sellerId;if(!['seller','employee'].includes(role))throw Error('Perfil inválido.');
    if(id){const person=(state[role==='employee'?'employees':'sellers'] || []).find(item=>item.id===id);if(!person)throw Error('Pessoa não encontrada.');if(data.inherit)delete person.billingPolicy;else person.billingPolicy=policy}
    else state.settings[role==='employee'?'employeeBillingPolicy':'sellerBillingPolicy']=policy;
  }else if(data.action==='team-config'){
    if(!['employee','seller'].includes(data.role))throw Error('Perfil inválido.');
    const inherited=String(data.discountPercent??'').trim()==='',percent=Number(data.discountPercent);
    if((inherited&&!data.personId)||!inherited&&(!Number.isFinite(percent)||percent<=0||percent>=100))throw Error('Defina um desconto maior que zero e menor que 100%.');
    const policy=data.mode==='inherit'&&data.personId?null:requirePolicy({mode:data.mode,weekday:data.weekday});
    if(data.personId){const person=(state[data.role==='employee'?'employees':'sellers']||[]).find(p=>p.id===data.personId);if(!person)throw Error('Pessoa não encontrada.');if(inherited)delete person.teamPricing;else person.teamPricing={discountPercent:percent};if(policy)person.billingPolicy=policy;else delete person.billingPolicy;}
    else{state.settings.teamPricing ||= {};state.settings.teamPricing[data.role]={discountPercent:percent};state.settings[data.role==='employee'?'employeeBillingPolicy':'sellerBillingPolicy']=policy;}
  }else if(data.action==='team-rate'){
    if(!['employee','seller'].includes(data.role))throw Error('Perfil inválido.');
    const percent=Number(data.discountPercent);if(!data.inherit&&(!Number.isFinite(percent)||percent<=0||percent>=100))throw Error('O desconto deve ser maior que zero e menor que 100%.');
    if(data.personId){const person=(state[data.role==='employee'?'employees':'sellers']||[]).find(p=>p.id===data.personId);if(!person)throw Error('Pessoa não encontrada.');if(data.inherit)delete person.teamPricing;else person.teamPricing={discountPercent:percent}}
    else{state.settings.teamPricing ||= {};state.settings.teamPricing[data.role]={discountPercent:percent};}
  }else if(data.action==='team-quote'){
    const service=state.services.find(s=>s.id===data.serviceId);if(!service||service.closed||cancelled(service)||service.billingVersion!==2)throw Error('Defina o valor interno antes de finalizar esta ordem.');
    service.internalBaseCents=cents(data.amount);if(service.internalBaseCents<=0)throw Error('Informe um valor interno maior que zero.');
    service.history ||= [];service.history.push({at,by:username,action:'Valor interno da manutenção definido',description:'Valor base definido pelo administrador, independente do preço cobrado ao cliente.'});
  }else if(data.action==='service-items'){
    const service=(state.services || []).find(item=>item.id===data.serviceId);
    if(!service||service.closed||cancelled(service))throw Error('Ajuste os itens antes de finalizar o serviço.');
    const lines=Array.isArray(data.items)?data.items:[];
    if(lines.length>100)throw Error('Limite de 100 itens adicionais por ordem.');
    for(const line of lines){if(!(state.costCatalog || []).some(item=>item.id===line.catalogId&&item.active!==false))throw Error('Selecione um item ativo.');if(!Number.isInteger(Number(line.quantity))||line.quantity<1||line.quantity>10000)throw Error('Quantidade inválida.')}
    service.financialItems=lines.map(line=>({catalogId:line.catalogId,quantity:Number(line.quantity)}));
    service.history ||= [];service.history.push({at,action:'Itens financeiros revisados',by:username});
  }else if(data.action==='capture'){
    const service=(state.services || []).find(item=>item.id===data.serviceId);
    if(!service?.closed||service.finance||cancelled(service))throw Error('Somente ordens finalizadas sem lançamento podem ser importadas.');
    service.finance=captureFinance(state,service,at);
    service.history ||= [];service.history.push({at,action:'Ordem anterior importada para cobrança',by:username});
  }else if(data.action==='mark-paid'){
    const ids=[...new Set(Array.isArray(data.serviceIds)?data.serviceIds:[])];
    if(!ids.length||ids.length>500)throw Error('Selecione as ordens a quitar.');
    const reference=cleanText(data.reference,300);if(reference.length<3)throw Error('Informe comprovante, referência ou observação do recebimento.');
    const selected=ids.map(id=>(state.services || []).find(item=>item.id===id));
    if(selected.some(service=>!service?.finance||!service.closed||cancelled(service)||!['pending','not-applicable'].includes(service.finance.payment.status)))throw Error('Há uma ordem inválida ou já paga. Atualize a tela.');
    if(selected.some(s=>s.finance.settlementId))throw Error('Registre o recebimento pelo acerto Pix completo.');
    if(new Set(selected.map(service=>{const owner=service.finance.payer||billingOwner(service);return owner?owner.role+':'+owner.id:'direct'})).size!==1)throw Error('Confirme um responsável por pagamento por vez.');
    const batchId=data.batchId||crypto.randomUUID();
    for(const service of selected){service.finance.payment={status:'paid',paidAt:at,by:username,reference,batchId};service.history ||= [];service.history.push({at,action:'Recebimento confirmado pelo administrador',description:reference,by:username})}
    return {settlement:true};
  }else throw Error('Ação inválida.');
  return {capture:data.action==='capture'};
}

export function finalizeAdminOrder(state,id,username,at){
 const service=state.services.find(s=>s.id===id);
 if(!service)throw Error('Serviço não encontrado.');
 if(service.closed||cancelled(service))throw Error('A ordem já foi finalizada ou cancelada.');
 if(service.pausedAt&&!service.employeeCompletedAt)throw Error('Retome o serviço antes de finalizar.');
 const missing=missingVideos(service);if(missing.length)throw Error('Faltam vídeos de peças trocadas: '+missing.join('; '));
 if(!service.items?.length||service.items.some(i=>!/^20\d{2}$/.test(String(i.maintenanceYear||''))||i.hydroYear&&!/^20\d{2}$/.test(String(i.hydroYear))))throw Error('Confira os anos de manutenção e teste hidrostático em todos os equipamentos.');
 if((state.orders||[]).some(o=>o.code===service.code&&o.kind==='Manutenção'))throw Error('Esta ordem antiga possui pagamento integrado. Finalize com internet.');
 service.closed=true;service.closedAt=at;service.closedBy=username;
 if(!service.nextMaintenanceMonth&&/^\d{4}-\d{2}/.test(service.date||''))service.nextMaintenanceMonth=String(Number(service.date.slice(0,4))+1)+service.date.slice(4,7);
 for(const item of service.items){item.status='Concluído';item.history||=[];item.history.push({status:'Concluído',at,by:username})}
 service.history||=[];service.history.push({at,action:'Serviço finalizado pelo administrador',description:'Registrado no aparelho; confirmação de envio apresentada separadamente.',by:username});
}
export function updateAdminOrder(state,d,username,at){
 const service=state.services.find(s=>s.id===d.serviceId);if(!service)throw Error('Serviço não encontrado.');
 if(service.closed||cancelled(service))throw Error('Edite o cadastro antes de finalizar ou cancelar.');
 const name=String(d.clientName||'').trim(),serviceType=String(d.serviceType||'').trim(),date=String(d.date||'').trim(),lines=d.items;
 if(name&&name.length<2||name.length>100||!serviceType||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(lines)||!lines.length||lines.length>100)throw Error('Confira cliente, data, serviço e equipamentos.');
 for(const [key,max] of [['clientPhone',30],['clientEmail',254],['parts',1000],['notes',3000],['sellerName',100],['employeeName',100]])service[key]=String(d[key]||'').trim().slice(0,max);
 service.clientName=name;service.serviceType=serviceType.slice(0,100);service.date=date;
 service.items=lines.map((line,i)=>{const type=String(line.type||'').trim().slice(0,100);if(!type)throw Error('Informe o tipo de cada equipamento.');return {...service.items[i],type,kg:String(line.kg||'').trim().slice(0,12),serial:String(line.serial||'').trim().slice(0,100)}});
 service.type=[...new Set(service.items.map(i=>i.type))].join(', ');service.serial=service.items[0].serial;
 service.history||=[];service.history.push({at,action:'Cadastro corrigido pelo administrador',by:username});
 const order=(state.orders||[]).find(o=>o.code===service.code);if(order)Object.assign(order,{name,phone:service.clientPhone,email:service.clientEmail,details:service.notes});
}
