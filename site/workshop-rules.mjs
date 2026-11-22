// Business amounts are editable suggestions, never an assertion of a single local retail price.
export const PRICE_SOURCES=[
 {id:'coren-2026',label:'COREN-PI · referência de contratação, jan/2026',url:'https://coren-pi.org.br/wp-content/uploads/2026/01/Termo_de_Referencia.pdf'},
 {id:'tre-2026',label:'TRE-PI · fornecimento 55/2026, preços contratados em volume',url:'https://www.tre-pi.jus.br/transparencia-e-prestacao-de-contas/licitacoes-e-contratos/contratos/compras'},
 {id:'digfire',label:'DigFire · anúncio nacional, consulta em 15/11/2026',url:'https://digfire.com.br/categoria-produto/extintores/'},
 {id:'promax',label:'Promax · recondicionados, anúncio nacional, consulta em 15/11/2026',url:'https://www.promaxextintores.com.br/extintores'}
];
const nonnegative=n=>Number.isFinite(Number(n))&&Number(n)>=0&&Number(n)<=1000000;
export const equipmentKey=(type,kg)=>type+'|'+String(kg||'');
export function equipmentGroups(items){const groups=new Map();for(const [index,item] of (items||[]).entries()){const key=equipmentKey(item.type,item.kg);if(!groups.has(key))groups.set(key,{type:item.type,kg:item.kg,indexes:[],items:[]});groups.get(key).indexes.push(index);groups.get(key).items.push(item);}return [...groups.values()];}
export const powderAgent=type=>/p[oó].*ABC/i.test(type)?'ABC':/p[oó].*BC/i.test(type)?'BC':null;
export function maintenanceSuggestion(type,kg){const w=Number(kg)||10;if(/água/i.test(type))return 69.33;if(/CO/.test(type))return w===6?103.33:Math.round(45+w*11);if(powderAgent(type))return w===6&&powderAgent(type)==='BC'?77.58:Math.round((powderAgent(type)==='ABC'?36:30)+w*(w>12?7:8));return Math.round(100+w*18);}
export function saleSuggestion(type,kg,condition='new'){
 const w=Number(kg)||10,agent=powderAgent(type),tables={ABC:{1:89.99,2:119,4:139.29,6:145.3,8:204.43,12:318,20:1653.14,30:2197.14,50:3682},BC:{1:89,2:109,4:131.43,6:230,8:182.86,12:271.43,20:2127,30:1953.71,50:3400}};
 if(condition==='refurbished'){const prices={ABC:{4:145,6:159,8:189,12:210},BC:{4:129.9,6:139,8:149,12:165}};return prices[agent]?.[w]??Math.round(saleSuggestion(type,kg)*.75);}
 return agent?tables[agent]?.[w]??Math.round(90+w*30):/água/i.test(type)?152.43:/CO/.test(type)?(w===6?671.67:Math.round(250+w*75)):Math.round(350+w*70);
}
export function partSuggestion(name){return /CO/.test(name)&&/válvula/i.test(name)?41:/válvula/i.test(name)?22:/manômetro/i.test(name)?6:/sifão/i.test(name)?15:/difusor/i.test(name)?8:/mangueira/i.test(name)?17:20;}
export function complementSuggestion(id,variant=''){return ({demarcation:35,'wall-support':10.17,'floor-stand':45,'extinguisher-hose':/CO/.test(variant)?41:17,diffuser:8,'hydrant-cabinet':450,'safety-signage':26.48,'pressure-gauge':6,valve:/CO/.test(variant)?41:22,'hydrant-accessories':/regulável/.test(variant)?220:65,'extinguisher-wheels':120,'emergency-light':/faróis/.test(variant)?220:45,'hydrant-hose-test':50.7})[id]??35;}
export function minimumSuggestion(type,kg){const w=Number(kg)||10;return /água/i.test(type)?35:/CO/.test(type)?Math.round(30+w*8):powderAgent(type)?Math.round(18+w*(w>12?4:4.5)):Math.round(60+w*10);}
export function minimumRates(state,owner){const role=owner?.role||'employee',person=(state[role==='employee'?'employees':'sellers']||[]).find(p=>p.id===owner?.id);return {...(state.settings?.teamPricing?.[role]?.minimumRates||{}),...(person?.teamPricing?.minimumRates||{})};}
export function minimumRate(state,owner,type,kg){const value=minimumRates(state,owner)[equipmentKey(type,kg)];return value===undefined?minimumSuggestion(type,kg):Number(value);}
export const saleMinimumKey=(type,kg,condition)=>'sale|'+condition+'|'+equipmentKey(type,kg);
export function minimumSaleRate(state,owner,type,kg,condition){const value=minimumRates(state,owner)[saleMinimumKey(type,kg,condition)];if(value!==undefined)return Number(value);const tables={new:{ABC:{1:70,2:90,4:120,6:130,8:170,12:240,20:1300,30:1700,50:2800},BC:{1:65,2:85,4:110,6:120,8:150,12:220,20:1600,30:1500,50:2600}},refurbished:{ABC:{1:50,2:70,4:95,6:110,8:140,12:170,20:950,30:1300,50:2100},BC:{1:45,2:60,4:85,6:100,8:120,12:145,20:1200,30:1100,50:1900}}};const w=Number(kg)||10;return tables[condition]?.[powderAgent(type)]?.[w]??(/água/i.test(type)?condition==='new'?120:90:/CO/.test(type)?({2:250,4:380,6:condition==='new'?550:430,10:750}[w]??500):Math.round(200+w*40));}
export function allPowderMovements(state){return [...(state.powderMovementArchive||[]),...(state.powderMovements||[])];}
export function ensureWorkshopState(state){
 state.inventory||=[];state.powderMovements||=[];state.powderMovementArchive||=[];state.settings||={};state.settings.teamPricing||={};
 for(const role of ['employee','seller']){const pricing=state.settings.teamPricing[role]||={};pricing.mode='minimum';pricing.minimumRates||={};for(const t of state.types||[])pricing.minimumRates[equipmentKey(t.name,t.kg)]??=minimumSuggestion(t.name,t.kg);}
 for(const agent of ['ABC','BC'])if(!state.inventory.some(row=>row.powderAgent===agent))state.inventory.push({id:'powder-'+agent,powderAgent:agent,name:'Pó químico '+agent,category:'Pó químico',unit:'kg',qty:0,minQty:10,unitCost:null});
 for(const t of state.types||[])if(!(Number(t.price)>0))t.price=maintenanceSuggestion(t.name,t.kg);
 for(const p of state.products||[])if(!(Number(p.price)>0)){p.price=powderAgent(p.type)||/água|CO₂/i.test(p.type||'')?saleSuggestion(p.type,p.kg):/placa/i.test(p.name)?26.48:/ilumina/i.test(p.name)?45:/mangueira/i.test(p.name)?250:partSuggestion(p.name);p.quoteOnly=true;p.priceOrigin='Estimativa inicial editável';}
 return state;
}
export function powderCapacity(service){const totals={ABC:0,BC:0};for(const item of service.items||[]){const agent=powderAgent(item.type);if(agent)totals[agent]+=Math.round(Number(item.kg)*1000);}return totals;}
export function validatePowderUsage(service,raw){if(!Array.isArray(raw)||raw.length>2)throw Error('Confira o consumo de pó químico.');const capacity=powderCapacity(service),seen=new Set();return raw.map(row=>{const grams=Number(row.grams);if(!['ABC','BC'].includes(row.agent)||seen.has(row.agent)||!capacity[row.agent]||!Number.isSafeInteger(grams)||grams<0||grams%1000!==0||grams>capacity[row.agent])throw Error('Consumo de pó inválido para os extintores desta ordem.');seen.add(row.agent);return{agent:row.agent,grams};});}
export function recordPowder(service,usage,by,at){if(service.closed||service.cancelledAt)throw Error('A ordem está encerrada.');service.powderUsage=validatePowderUsage(service,usage);service.powderRecordedAt=at;service.powderRecordedBy=by;service.history||=[];service.history.push({at,by,action:'Consumo de pó registrado',description:service.powderUsage.map(row=>row.agent+': '+row.grams/1000+' kg').join(' · ')});}
export function setPainting(service,value,by,at){const q=Number(value);if(!Number.isInteger(q)||q<0||q>(service.items||[]).length)throw Error('Selecione de zero ao total de extintores para pintura.');service.paintingQuantity=q;service.paintingRecordedAt=at;for(const item of service.items||[])delete item.painted;service.history||=[];service.history.push({at,by,action:'Pintura registrada',description:q+' extintor(es), quantidade total da ordem.'});}
export function requestOwnership(service,actor,data,at){
 const original=service.originalCreator||{role:service.registeredByRole,id:service.registeredById};
 if(service.closed||service.cancelledAt||service.adminOwned||original.role!==actor.role||original.id!==actor.id)throw Error('Somente quem registrou esta ordem pode enviá-la para a administração.');
 if(data.cancel){if(service.transferRequest?.status!=='pending'||service.transferRequest.fromId!==actor.id)throw Error('Não há envio pendente desta conta.');service.transferRequest.status='cancelled';}
 else{if(!/^[-a-zA-Z0-9_]{8,80}$/.test(String(data.requestId||'')))throw Error('Identificador do envio inválido.');if(service.transferRequest?.status==='pending')throw Error('Esta ordem já aguarda aceite do administrador.');service.transferRequest={id:data.requestId,fromRole:actor.role,fromId:actor.id,fromName:actor.name||actor.username,status:'pending',requestedAt:at,note:String(data.note||'').trim().slice(0,500)};}
 service.history||=[];service.history.push({at,by:actor.username,action:data.cancel?'Envio à administração cancelado':'Ordem enviada à administração',description:'A cobrança permanece com o criador até o aceite do administrador.'});return service;
}
export function acceptOwnership(state,data,username,at){
 const s=state.services.find(row=>row.id===data.serviceId),r=s?.transferRequest;
 if(!s||s.closed||s.cancelledAt||s.finance?.settlementId||s.finance?.payment?.status==='paid'||r?.status!=='pending'||r.id!==data.requestId)throw Error('O envio não está mais disponível para aceite. Atualize a ordem.');
 const owner=s.billingOwner;if(!owner||owner.id!==r.fromId||owner.role!==r.fromRole)throw Error('O responsável desta ordem mudou. Solicite um novo envio.');
 if(data.accept){s.originalCreator||={role:s.registeredByRole,id:s.registeredById,name:s.registeredBy};s.adminOwned=true;s.ownershipRole='admin';s.clientSource=s.clientSource==='creator'?'company':s.clientSource;s.billingOwner=null;s.billingVersion=1;s.sellerId='';s.sellerName='';delete s.internalBaseCents;s.basePrice=(s.items||[]).reduce((n,i)=>n+Number((state.types||[]).find(t=>t.name===i.type&&String(t.kg||'')===String(i.kg||''))?.price||i.unitPrice||0),0);s.price=s.basePrice;}
 r.status=data.accept?'accepted':'rejected';r.reviewedAt=at;r.reviewedBy=username;s.history||=[];s.history.push({at,by:username,action:data.accept?'Autoria comercial transferida à administração':'Envio à administração recusado',description:data.accept?'O criador original permanece no histórico. Não há cobrança interna ao funcionário ou vendedor.':'O serviço e sua cobrança permanecem com o criador.'});return s;
}
export function powderEntryReversal(state,entryId){
 const movements=state.powderMovements||[],entry=movements.find(m=>m.id===entryId&&m.kind==='entry');
 if(!entry||!['ABC','BC'].includes(entry.agent)||!Number.isSafeInteger(entry.grams)||entry.grams<=0)throw Error('Entrada de pó não encontrada. Atualize o estoque.');
 if(movements.some(m=>m.kind==='entry-reversal'&&m.reversalOf===entry.id))throw Error('Esta entrada já foi estornada.');
 const row=state.inventory?.find(r=>r.powderAgent===entry.agent),beforeGrams=Math.round(Number(row?.qty)*1000),balance=beforeGrams-entry.grams;
 if(!row||!Number.isSafeInteger(beforeGrams)||balance<0)throw Error('Não é possível estornar toda esta entrada: parte do pó já foi usada e o saldo ficaria negativo. Confira o consumo antes de corrigir a entrada.');
 const entryCost=Number(entry.unitCostCents);
 if(entry.unitCostCents==null||!Number.isFinite(entryCost)||entryCost<0)throw Error('Esta entrada antiga não tem custo registrado para um estorno seguro.');
 let unitCost=null;
 if(row.unitCost!=null){
  const currentCost=Number(row.unitCost),remainingValue=beforeGrams/1000*currentCost-entry.grams/1000*entryCost/100;
  if(!Number.isFinite(currentCost)||currentCost<0||remainingValue<-.005||balance===0&&Math.abs(remainingValue)>.005)throw Error('O custo desta entrada já foi usado em outras movimentações. O estorno alteraria custos já registrados; confira as movimentações antes de corrigir.');
  if(balance>0)unitCost=Math.max(0,remainingValue)/(balance/1000);
 }
 return {entry,balanceGrams:balance,unitCost};
}
export function workshopAdminOperation(state,data,username,at){
 if(data.action==='ownership-review'){acceptOwnership(state,data,username,at);return {workshopTransfer:true};}
 if(data.action==='powder-use'){const s=state.services.find(s=>s.id===data.serviceId);if(!s)throw Error('Ordem não encontrada.');recordPowder(s,data.usage,username,at);return {};}
 if(data.action==='painting-total'){const s=state.services.find(s=>s.id===data.serviceId);if(!s||s.closed||s.cancelledAt)throw Error('Ordem indisponível.');setPainting(s,data.quantity,username,at);return {};}
 if(data.action==='powder-entry'){
  if(data.entryId&&allPowderMovements(state).some(m=>m.id===data.entryId))throw Error('Esta entrada de pó já foi registrada. Atualize o estoque.');
  const row=state.inventory.find(row=>row.powderAgent===data.agent),grams=Math.round(Number(data.kg)*1000);if(!row||!Number.isSafeInteger(grams)||grams<=0||grams>100000000||!nonnegative(data.unitCost)||String(data.reference||'').trim().length<3)throw Error('Informe pó, quantidade, custo por kg e referência da entrada.');
  const before=Number(row.qty)||0;row.qty=(Math.round(before*1000)+grams)/1000;row.unitCost=before>0&&row.unitCost!=null?(before*Number(row.unitCost)+(grams/1000)*Number(data.unitCost))/row.qty:Number(data.unitCost);state.powderMovements.push({id:data.entryId||crypto.randomUUID(),agent:data.agent,grams,kind:'entry',at,by:username,reference:String(data.reference).trim().slice(0,300),unitCostCents:Math.round(Number(data.unitCost)*100)});return{workshopStock:true};
 }
 if(data.action==='powder-entry-reverse'){
  const correction=powderEntryReversal(state,data.entryId),entry=correction.entry,row=state.inventory.find(r=>r.powderAgent===entry.agent);
  const reversalId=data.reversalId||crypto.randomUUID();if(state.powderMovements.some(m=>m.id===reversalId))throw Error('Identificador do estorno já utilizado. Atualize o estoque.');
  row.qty=correction.balanceGrams/1000;row.unitCost=correction.unitCost;
  state.powderMovements.push({id:reversalId,agent:entry.agent,grams:-entry.grams,kind:'entry-reversal',reversalOf:entry.id,at,by:username,reference:'Estorno da entrada: '+entry.reference,unitCostCents:entry.unitCostCents});return{workshopStock:true};
 }
 if(data.action==='powder-history-clear'){
  if(data.confirm!==true||!/^[-a-zA-Z0-9_]{8,80}$/.test(String(data.clearId||'')))throw Error('Confirme a limpeza dos registros de pó.');
  if((state.powderMovementArchive||[]).some(m=>m.clearingId===data.clearId))throw Error('Esta limpeza já foi registrada.');
  if(!state.powderMovements?.length)throw Error('Não há registros de pó para limpar.');
  if(data.expectedCount!==state.powderMovements.length||data.expectedLastId!==state.powderMovements.at(-1).id)throw Object.assign(Error('As movimentações mudaram. Atualize a lista e confirme a limpeza novamente.'),{status:409,conflict:true});
  state.powderMovementArchive=[...(state.powderMovementArchive||[]),...state.powderMovements.map(m=>({...m,clearingId:data.clearId}))];
  state.powderMovements=[];state.powderHistoryClearedAt=at;state.powderHistoryClearedBy=username;return{workshopHistory:true};
 }
 if(data.action==='minimum-rates'){
  if(!['employee','seller'].includes(data.role))throw Error('Perfil inválido.');const rates=data.rates;if(!rates||typeof rates!=='object'||Array.isArray(rates)||Object.entries(rates).some(([k,v])=>!nonnegative(v)||k.length>150))throw Error('Confira os valores mínimos.');
  const person=data.personId?(state[data.role==='employee'?'employees':'sellers']||[]).find(p=>p.id===data.personId):null;if(data.personId&&!person)throw Error('Pessoa não encontrada.');
  let policy;if(data.mode!==undefined){if(!['completion','weekly',...(person?['inherit']:[])].includes(data.mode)||!Number.isInteger(Number(data.weekday))||Number(data.weekday)<0||Number(data.weekday)>6)throw Error('Confira o prazo e o dia de pagamento.');policy=data.mode==='inherit'?null:{mode:data.mode,weekday:Number(data.weekday)};}
  const target=person||(state.settings.teamPricing[data.role]||={});if(person)person.teamPricing={mode:'minimum',minimumRates:Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,Number(v)]))};else Object.assign(target,{mode:'minimum',minimumRates:Object.fromEntries(Object.entries(rates).map(([k,v])=>[k,Number(v)]))});if(data.mode!==undefined){if(person){if(policy)person.billingPolicy=policy;else delete person.billingPolicy;}else state.settings[data.role==='employee'?'employeeBillingPolicy':'sellerBillingPolicy']=policy;}return{};
 }
 if(data.action==='suggested-price'){
  if(!nonnegative(data.price)||Number(data.price)<=0)throw Error('Informe um preço sugerido maior que zero.');const price=Number(data.price);
  if(data.kind==='maintenance'){let t=state.types.find(t=>t.name===data.type&&String(t.kg||'')===String(data.kg||''));if(!t){t={id:crypto.randomUUID(),name:String(data.type).slice(0,100),kg:String(data.kg||'')};state.types.push(t);}t.price=price;}
  else if(data.kind==='sale'){state.costCatalog||=[];let row=state.costCatalog.find(c=>c.saleCondition===data.condition&&c.equipmentType===data.type&&String(c.kg||'')===String(data.kg||''));if(!row){row={id:crypto.randomUUID(),name:'Venda '+data.condition+' '+data.type+' '+data.kg,category:'Extintores',equipmentType:data.type,kg:String(data.kg||''),saleCondition:data.condition,unitCost:null};state.costCatalog.push(row);}row.salePrice=price;row.active=true;}
  else if(data.kind==='part'){state.settings.partPrices||={};state.settings.partPrices[data.name]=price;const row=(state.costCatalog||[]).find(c=>c.name===data.name&&!c.kg);if(row)row.salePrice=price;}
  else if(data.kind==='hose'){state.settings.registrationHoseDefaultPrice=price;state.settings.registrationHosePrices={};const row=(state.costCatalog||[]).find(c=>c.name==='Teste de mangueira de hidrante');if(row)row.salePrice=price;}
  else if(data.kind==='complement'){state.settings.registrationComplements||=[];let c=state.settings.registrationComplements.find(c=>c.id===data.catalogId);if(!c){c={id:data.catalogId,name:data.name,variants:data.variants};state.settings.registrationComplements.push(c);}c.prices||={};c.prices[data.variant]=price;}
  else if(data.kind==='product'){const p=state.products.find(p=>p.id===data.id);if(!p)throw Error('Produto não encontrado.');p.price=price;}
  else if(data.kind==='painting'){state.settings.partPrices.Pintura=price;const row=(state.costCatalog||[]).find(c=>c.name==='Pintura');if(row)row.salePrice=price;}
  else throw Error('Item de preço inválido.');return{};
 }
 return null;
}
export function preserveWorkshopState(state,previous,at,options={}){
 ensureWorkshopState(state);ensureWorkshopState(previous);
 if(!options.workshopHistory){state.powderMovementArchive=structuredClone(previous.powderMovementArchive);for(const key of ['powderHistoryClearedAt','powderHistoryClearedBy']){if(previous[key]!==undefined)state[key]=previous[key];else delete state[key];}}
 if(!options.workshopStock&&!options.workshopHistory)state.powderMovements=structuredClone(previous.powderMovements);
 if(!options.workshopStock)for(const row of state.inventory.filter(i=>i.powderAgent)){const old=previous.inventory.find(i=>i.powderAgent===row.powderAgent);row.qty=old.qty;row.unitCost=old.unitCost;}
 for(const s of state.services||[]){const old=previous.services.find(o=>o.id===s.id);if(old){
  for(const k of ['registeredBy','registeredByRole','registeredById']){if(old[k]!==undefined)s[k]=structuredClone(old[k]);else delete s[k];}
  if(old.originalCreator)s.originalCreator=structuredClone(old.originalCreator);else if(!options.workshopTransfer)delete s.originalCreator;
  if(!options.workshopTransfer)for(const k of ['transferRequest','adminOwned','ownershipRole','billingOwner','billingVersion']){if(old[k]!==undefined)s[k]=structuredClone(old[k]);else delete s[k];}
  if(old.closed){s.powderUsage=structuredClone(old.powderUsage||[]);s.powderRecordedAt=old.powderRecordedAt;}
 }
 if(s.closed&&!old?.closed&&s.transferRequest?.status==='pending')throw Error('Aceite ou recuse o envio à administração antes de finalizar a ordem.');
 if(s.paintingQuantity!==undefined&&(!Number.isInteger(Number(s.paintingQuantity))||Number(s.paintingQuantity)<0||Number(s.paintingQuantity)>(s.items||[]).length))throw Error('A quantidade de pinturas deve ficar entre zero e o total de extintores.');
 const prior=old?.powderPostedGrams||{},next=Object.fromEntries((old&&JSON.stringify(old.powderUsage||[])===JSON.stringify(s.powderUsage||[])?s.powderUsage||[]:validatePowderUsage(s,s.powderUsage||[])).map(r=>[r.agent,r.grams]));
 s.powderPostedGrams={...prior};for(const agent of ['ABC','BC']){const grams=(next[agent]||0)-(prior[agent]||0);if(!grams)continue;const row=state.inventory.find(r=>r.powderAgent===agent),beforeGrams=Math.round(Number(row.qty)*1000),balance=beforeGrams-grams;if(balance<0)throw Error('Estoque insuficiente de pó '+agent+'. O registro foi preservado para revisão; cadastre a entrada ou confira o consumo.');let unitCostCents=row.unitCost==null?null:Math.round(row.unitCost*100);
  if(grams<0){const priorMoves=allPowderMovements(state).filter(m=>m.serviceId===s.id&&m.agent===agent),used=-priorMoves.reduce((sum,m)=>sum+m.grams,0),cost=-priorMoves.reduce((sum,m)=>sum+m.grams/1000*Number(m.unitCostCents||0),0);unitCostCents=used>0&&!priorMoves.some(m=>m.unitCostCents==null)?Math.round(cost/(used/1000)):null;if(unitCostCents!=null&&balance>0)row.unitCost=(beforeGrams/1000*Number(row.unitCost||0)-grams/1000*unitCostCents/100)/(balance/1000);}
  row.qty=balance/1000;s.powderPostedGrams[agent]=next[agent]||0;state.powderMovements.push({id:crypto.randomUUID(),agent,grams:-grams,kind:grams>0?'consumption':'return',at,by:s.powderRecordedBy||s.employeeName||'Administração',serviceId:s.id,code:s.code,reference:'Consumo da ordem',unitCostCents});}
 const movements=allPowderMovements(state).filter(m=>m.serviceId===s.id);s.powderCostCents=movements.some(m=>m.grams<0&&m.unitCostCents==null)?null:Math.round(movements.reduce((sum,m)=>sum-m.grams/1000*Number(m.unitCostCents||0),0));
 }
}
