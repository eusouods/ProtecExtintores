export const PART_NAMES = ['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];
export const cents = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) throw Error('Informe um valor não negativo e válido.');
  return Math.round(number * 100);
};
export const cancelled = service => Boolean(service.cancelledAt || service.status === 'Cancelado');
export const completed = service => Boolean(service.closed || service.employeeCompletedAt);
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
  const seller = (state.sellers || []).find(s => s.id === service.sellerId);
  const policy = seller?.billingPolicy || state.settings?.sellerBillingPolicy || {mode:'completion',weekday:5};
  if (!['weekly','completion'].includes(policy.mode)) throw Error('Forma de cobrança inválida.');
  return {mode:policy.mode,weekday:Number(policy.weekday ?? 5)};
}
export function estimateFinance(state, service) {
  const catalog = (state.costCatalog || []).filter(entry => entry.active !== false);
  const lines = [];
  const add = (name, quantity, entry, revenue, kind) => {
    if (!quantity) return;
    lines.push({name,quantity,kind,unitCostCents:entry?.unitCost != null ? cents(entry.unitCost) : null,unitRevenueCents:revenue == null ? cents(entry?.salePrice ?? state.settings?.partPrices?.[name] ?? 0) : cents(revenue)});
  };
  const find = (name, kg) => catalog.find(entry => entry.name === name && String(entry.kg || '') === String(kg || '')) || catalog.find(entry => entry.name === name && !entry.kg);
  for (const item of service.items || []) {
    const serviceCost = catalog.find(entry=>entry.category==='Serviço' && entry.name===item.type && String(entry.kg || '')===String(item.kg || ''));
    add(item.type || 'Extintor',1,serviceCost,item.unitPrice || 0,'equipment-cost');
    for (const name of item.replacedParts || []) add(name,1,find(name),null,'part');
  }
  add('Pintura',Number(service.paintingQuantity ?? (service.items || []).filter(i=>i.painted).length),find('Pintura'),null,'painting');
  for (const line of service.financialItems || []) {
    const entry = catalog.find(entry => entry.id === line.catalogId);
    if (!entry) throw Error('Um item financeiro foi removido. Revise a ordem antes de finalizar.');
    if (!Number.isInteger(Number(line.quantity)) || line.quantity < 1 || line.quantity > 10000) throw Error('Quantidade financeira inválida.');
    add(entry.name,Number(line.quantity),entry,null,'additional');
  }
  const baseRevenueCents = cents(service.basePrice ?? service.price ?? 0);
  const revenueCents = baseRevenueCents + lines.filter(line=>line.kind!=='equipment-cost').reduce((sum,line)=>sum+line.quantity*line.unitRevenueCents,0);
  const costCents = lines.reduce((sum,line)=>sum+line.quantity*(line.unitCostCents || 0),0);
  const missingCosts = lines.filter(line=>line.unitCostCents === null).map(line=>line.name);
  return {lines,baseRevenueCents,revenueCents,costCents,profitCents:revenueCents-costCents,missingCosts:[...new Set(missingCosts)],costsComplete:!missingCosts.length};
}
export function captureFinance(state, service, instant) {
  const totals = estimateFinance(state,service), policy = servicePolicy(state,service);
  return {...totals,capturedAt:instant,sellerId:service.sellerId || '',policy,dueDate:service.sellerId ? dueDate(instant,policy) : '',payment:service.sellerId ? {status:'pending'} : {status:'not-applicable'}};
}
export function preserveAndCapture(state, previous, instant, options = {}) {
  for (const old of previous.services || []) {
    const next = (state.services || []).find(service=>service.id === old.id);
    if (!next) throw Error('O histórico de serviços deve ser preservado. Arquive o serviço em vez de excluí-lo.');
    if (old.finance && !options.settlement) next.finance = structuredClone(old.finance);
    if (old.closed) {
      if (!next.closed || next.sellerId !== old.sellerId || next.employeeId !== old.employeeId) throw Error('O responsável por serviço finalizado não pode ser alterado.');
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
export function sellerView(service) {
  const view = technicalView(service);
  view.nextMaintenanceMonth = service.nextMaintenanceMonth || '';
  view.events = (service.history || []).map(event=>({at:event.at,status:event.action || event.status,item:event.description || ''}));
  view.charge = service.finance ? {amountCents:service.finance.revenueCents,dueDate:service.finance.dueDate,policy:service.finance.policy,payment:service.finance.payment,lines:service.finance.lines.map(line=>({name:line.name,quantity:line.quantity,unitRevenueCents:line.unitRevenueCents}))} : null;
  return view;
}
export function missingVideos(service) {
  return (service.items || []).flatMap((item,index)=>(item.replacedParts || []).filter(part=>!item.replacementMedia?.[part]?.url).map(part=>`Extintor ${index+1}: ${part}`));
}
