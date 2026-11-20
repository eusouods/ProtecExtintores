import {maintenanceSuggestion,saleSuggestion,partSuggestion,complementSuggestion,minimumRate,minimumSaleRate,workshopAdminOperation,powderCapacity} from './workshop-rules.mjs?v=registration-flow-53';
export const SALE_CONDITIONS=[{value:'new',label:'Novo lacrado',hasRing:false},{value:'refurbished',label:'Seminovo revisado',hasRing:true}];
export const PART_NAMES = ['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];
export const REGISTRATION_SERVICES=['Manutenção','Inspeção','Recarga','Teste hidrostático','Instalação','Pintura','Substituição de peças','Teste de mangueira de hidrante','Fornecimento de extintores','Compra de extintores'];
export const REGISTRATION_EQUIPMENT=[
 ['Água pressurizada',[''],'L'],
 ['Pó químico ABC',['1','2','4','6','8','12','20','30','50'],'kg'],
 ['Pó químico BC',['1','2','4','6','8','12','20','30','50'],'kg'],
 ['CO₂',['2','4','6','10'],'kg'],
 ['Espuma mecânica',['9','10','50'],'L'],['Classe D',['9','50'],'kg'],['Classe K',['6','50'],'L']
];
const LEGACY_REGISTRATION_EQUIPMENT=[
 ['Água pressurizada',['','75','150'], 'L'],['Pó químico ABC',['0.9','1','2','2.3','3','4','6','8','9','12','20','25','30','50','70','100','250'],'kg'],
 ['Pó químico BC',['1','2','4','6','8','12','20','30','50','100','250'],'kg'],['CO₂',['2','2.27','3.5','4','4.54','5','6','6.8','9.07','10','25','30','50'],'kg'],
 ['Espuma mecânica',['9','10','50'],'L'],['Classe D',['9','50'],'kg'],['Classe K',['6','50'],'L']
];

// One catalog feeds every registration screen. Costs stay in administrator settings.
const choices=(key,label,values)=>({key,label,values:values.map(String)});
const range=(n)=>Array.from({length:n},(_,i)=>String(i+1));
export const COMPLEMENT_DEFAULTS=[
 {id:'hydrant-hose-test',name:'Testar mangueira de hidrante',placement:'equipment',variants:['Tipos 1 a 5']},
 {id:'demarcation',name:'Aplicar faixa de demarcação',variants:['Amarela e vermelha'],fields:[]},
 {id:'wall-support',name:'Adicionar suporte de parede',variants:['Universal','Pó químico / água','CO₂']},
 {id:'floor-stand',name:'Adicionar suporte de piso',variants:['Simples','Duplo','Triplo']},
 {id:'extinguisher-hose',name:'Adicionar mangueira de extintor',variants:['Pó químico ABC','Pó químico BC','Água pressurizada','CO₂','Espuma mecânica']},
 {id:'diffuser',name:'Adicionar difusor de extintor',variants:['Pó químico ABC/BC','Água','CO₂ portátil','CO₂ sobre rodas']},
 {id:'hydrant-cabinet',name:'Adicionar ou instalar abrigo de hidrante',variants:['Sobrepor simples','Embutir simples','Sobrepor duplo','Embutir duplo']},
 {id:'safety-signage',name:'Adicionar placa de sinalização',variants:['Saída','Extintor de incêndio','Extintor de pó químico ABC','Extintor de pó químico BC','Extintor de CO₂','Extintor de água','Hidrante','Mangueira de incêndio','Alarme de incêndio','Acionador manual','Saída de emergência','Saída à direita','Saída à esquerda','Saída acima','Escada de emergência','Rota de fuga','Não utilize elevador','Proibido fumar','Risco elétrico','Inflamável','Ponto de encontro','Porta corta-fogo','Iluminação de emergência']},
 {id:'pressure-gauge',name:'Adicionar manômetro',variants:['ABC / BC','Água pressurizada','Espuma mecânica']},
 {id:'valve',name:'Adicionar ou revisar válvula',variants:['Válvula M30','Válvula de CO₂','Válvula de água pressurizada','Válvula de espuma mecânica']},
 {id:'hydrant-accessories',name:'Adicionar acessório de hidrante',variants:['Esguicho regulável','Esguicho jato sólido','Adaptador Storz','Chave Storz','Tampão Storz'],fields:[choices('diameterMm','Diâmetro (mm)',[38,63,75])]},
 {id:'extinguisher-wheels',name:'Adicionar rodas / carrinho para extintor',variants:['Roda avulsa','Par de rodas','Conjunto de rodagem','Carrinho de extintor']},
 {id:'emergency-light',name:'Adicionar iluminação de emergência',variants:['Bloco de 30 LEDs','Bloco de 60 LEDs','Bloco de 120 LEDs','Dois faróis']}
];
const validMoney=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000?Number(value):null;
export function complementDefinitions(state,includeInactive=false){
 const configured=Array.isArray(state.settings?.registrationComplements)?state.settings.registrationComplements:[];
 const all=[...COMPLEMENT_DEFAULTS.map(base=>({...base,...configured.find(c=>c.id===base.id),fields:base.fields||[],...(base.id==='demarcation'?{variants:['Amarela e vermelha']}:{}),placement:base.placement||'complement'})),...configured.filter(c=>!COMPLEMENT_DEFAULTS.some(b=>b.id===c.id)).map(c=>({...c,fields:[],placement:'complement'}))];
 return all.filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&(includeInactive||c.active!==false)).map(c=>({...c,active:c.active!==false,variants:[...new Set((c.variants||['Padrão']).filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim()))],prices:Object.fromEntries((c.id==='demarcation'?['Amarela e vermelha']:c.variants||['Padrão']).map(v=>[v,c.prices?.[v]??complementSuggestion(c.id,v)])),costs:c.costs||{}}));
}
export function validateComplementSettings(state){
 const records=state.settings?.registrationComplements;if(records===undefined)return;
 if(!Array.isArray(records)||records.length>100)throw Error('Cadastre no máximo 100 opções complementares.');
 const ids=new Set();for(const c of records){
  if(!c||!/^[-a-zA-Z0-9_]{3,80}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>100)throw Error('Confira o nome e o identificador do complemento.');ids.add(c.id);
  if(!Array.isArray(c.variants)||!c.variants.length||c.variants.length>100||c.variants.some(v=>typeof v!=='string'||!v.trim()||v.length>100)||new Set(c.variants).size!==c.variants.length)throw Error('Informe de 1 a 100 tipos diferentes para cada complemento.');
  for(const values of [c.prices||{},c.costs||{}])for(const [variant,value] of Object.entries(values))if(!c.variants.includes(variant)||value!==null&&value!==''&&validMoney(value)===null)throw Error('Confira os preços e custos dos complementos.');
 }
}
function publicComplements(state){return complementDefinitions(state).map(c=>({id:c.id,name:c.name,placement:c.placement,variants:c.variants,fields:c.fields,prices:Object.fromEntries(c.variants.map(v=>[v,validMoney(c.prices[v])]))}));}
export function normalizeComplements(state,raw){
 const catalog=registrationCatalog(state),rows=Array.isArray(raw)?raw:[];
 if(raw!==undefined&&!Array.isArray(raw))throw Error('Confira a lista de serviços complementares.');
 if(rows.length>50)throw Error('Máximo de 50 grupos de complementos por ordem.');
 return rows.map(row=>{const c=(catalog.complements||[]).find(c=>c.id===row.catalogId&&c.placement!=='equipment');
  if(!c||!c.variants.includes(row.variant))throw Error('Selecione um serviço complementar ativo e um tipo cadastrado.');
  const quantity=Number(row.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw Error('Selecione a quantidade do complemento.');
  const parameters={};for(const f of c.fields||[]){const value=String(row.parameters?.[f.key]??'');if(!f.values.includes(value))throw Error('Selecione '+f.label.toLowerCase()+' do complemento.');parameters[f.key]=value;}
  return {catalogId:c.id,name:c.name,variant:row.variant,quantity,parameters,unitPrice:validMoney(c.prices[row.variant])};
 });
}


// Only expose contacts already available to the authenticated account.
export function registrationContacts(state,actor){
 if(state.registrationContacts)return state.registrationContacts;
 const clean=c=>({id:String(c.id),name:String(c.name||'Cliente').slice(0,100),phone:String(c.phone||'').slice(0,30),email:String(c.email||'').slice(0,254)});
 const people=state.sellers||[];
 if(actor.role==='admin')return {clients:(state.clients||[]).filter(c=>c.active!==false).map(clean),sellers:people.filter(p=>p.active!==false).map(p=>({id:p.id,name:p.name}))};
 const related=(state.services||[]).filter(s=>s.billingOwner?.role===actor.role&&s.billingOwner.id===actor.id||actor.role==='employee'&&s.employeeId===actor.id||actor.role==='seller'&&s.sellerId===actor.id);
 const clients=[],seen=new Set();for(const service of related){
  if(service.clientSource==='creator'||!service.clientName)continue;
  const record=(state.clients||[]).find(c=>c.id===service.clientId&&c.active!==false),client=record?clean(record):clean({id:'service:'+service.id,name:service.clientName,phone:service.clientPhone,email:service.clientEmail});
  const key=client.id;if(!seen.has(key)){seen.add(key);clients.push(client);}
 }
 const sellerIds=new Set(actor.role==='seller'?[actor.id]:related.flatMap(s=>[s.sellerId,s.billingOwner?.role==='seller'?s.billingOwner.id:'']).filter(Boolean));
 return {clients,sellers:people.filter(p=>p.active!==false&&sellerIds.has(p.id)).map(p=>({id:p.id,name:p.name}))};
}


const restrictedAgents=new Set(['Água pressurizada','Pó químico ABC','Pó químico BC','CO₂']);
export function registrationCapacityAllowed(type,kg){return !restrictedAgents.has(type)||REGISTRATION_EQUIPMENT.find(row=>row[0]===type)?.[1].includes(String(kg||''));}
export function currentRegistrationCatalog(catalog){
 const existing=catalog.equipment||[],equipment=[];
 for(const [type,weights,unit] of REGISTRATION_EQUIPMENT)for(const kg of weights){const previous=existing.find(e=>e.type===type&&String(e.kg||'')===kg);equipment.push({...previous,type,kg,label:(type==='Água pressurizada'?'10':kg)+' '+unit,price:previous?.price??maintenanceSuggestion(type,kg),maintenanceAllowed:true,fixedCapacity:type==='Água pressurizada'});}
 for(const row of existing)if(!restrictedAgents.has(row.type)&&!equipment.some(e=>e.type===row.type&&e.kg===String(row.kg||'')))equipment.push(row);
 const complements=Array.isArray(catalog.complements)?catalog.complements:publicComplements({});
 return {...catalog,version:8,catalogRevision:51,equipment,complements,sales:(catalog.sales||[]).filter(e=>registrationCapacityAllowed(e.type,e.kg))};
}
function legacyRegistrationCatalog(state){
 const catalog=registrationCatalog(state),equipment=[...catalog.equipment],costs=state.costCatalog||[];
 const add=(type,kg,unit)=>{if(equipment.some(e=>e.type===type&&e.kg===kg))return;const configured=(state.types||[]).find(t=>t.name===type&&String(t.kg||'')===kg);equipment.push({type,kg,maintenanceAllowed:!(type==='Pó químico ABC'&&kg==='0.9'),label:(kg||'10')+' '+unit,price:Number(configured?.price)>0?Number(configured.price):null});};
 for(const [type,weights,unit] of LEGACY_REGISTRATION_EQUIPMENT)for(const kg of weights)add(type,kg,unit);
 for(const row of state.types||[])add(row.name,String(row.kg||''),row.unit||'kg');
 const sales=[...(catalog.sales||[])];for(const entry of state.registrationCatalog?.sales||[])if(!sales.some(e=>e.condition===entry.condition&&e.type===entry.type&&e.kg===String(entry.kg||'')))sales.push(entry);for(const entry of costs.filter(c=>c.active!==false&&c.saleCondition))if(!sales.some(e=>e.condition===entry.saleCondition&&e.type===entry.equipmentType&&e.kg===String(entry.kg||'')))sales.push({condition:entry.saleCondition,type:entry.equipmentType,kg:String(entry.kg||''),price:Number(entry.salePrice)>0?Number(entry.salePrice):null});
 return {...catalog,equipment,sales};
}
const catalogForRequest=(state,data)=>Number(data.registrationVersion||7)<7?legacyRegistrationCatalog(state):registrationCatalog(state);

export function registrationCatalog(state){
 if(state.registrationCatalog)return currentRegistrationCatalog(state.registrationCatalog);
 const types=state.types||[],costs=(state.costCatalog||[]).filter(p=>p.active!==false),settings=state.settings||{},equipment=[];
 const price=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
 const equipmentPrice=value=>Number(value)>0?price(value):null;
 for(const [type,weights,unit] of REGISTRATION_EQUIPMENT)for(const kg of weights){const configured=types.find(t=>t.name===type&&String(t.kg||'')===kg);equipment.push({type,kg,maintenanceAllowed:true,fixedCapacity:type==='Água pressurizada',label:(type==='Água pressurizada'&&!kg?'10':kg.replace('.',','))+' '+unit,price:equipmentPrice(configured?.price)??maintenanceSuggestion(type,kg)});}
 for(const t of types)if(t.active!==false&&registrationCapacityAllowed(t.name,t.kg)&&!equipment.some(e=>e.type===t.name&&e.kg===String(t.kg||''))){const unit=['kg','L'].includes(t.unit)?t.unit:REGISTRATION_EQUIPMENT.find(e=>e[0]===t.name)?.[2]||'kg';equipment.push({type:String(t.name),kg:String(t.kg||''),label:String(t.kg||'Sem capacidade')+(t.kg?' '+unit:''),price:equipmentPrice(t.price)});}
 const names=[...new Set([...PART_NAMES,...costs.filter(p=>p.technicalPart).map(p=>p.name)])];
 const parts=names.map(name=>({name,price:price(costs.find(p=>p.name===name&&!p.kg)?.salePrice??settings.partPrices?.[name])??partSuggestion(name)}));
 const fallback=costs.find(p=>p.name==='Teste de mangueira de hidrante')?.salePrice;
 const services=Array.isArray(settings.registrationServices)?settings.registrationServices:[],lengths=Array.isArray(settings.registrationHoseLengths)?settings.registrationHoseLengths:[];
 const hosePrices=Object.fromEntries(Object.entries(settings.registrationHosePrices||{}).filter(([,value])=>price(value)!=null).map(([key,value])=>[key,Number(value)]));
 const sales=SALE_CONDITIONS.flatMap(condition=>equipment.map(e=>{const record=costs.find(c=>c.saleCondition===condition.value&&c.equipmentType===e.type&&String(c.kg||'')===e.kg);return{type:e.type,kg:e.kg,label:e.label,condition:condition.value,price:equipmentPrice(record?.salePrice)??saleSuggestion(e.type,e.kg,condition.value)};}));
 return {version:8,catalogRevision:51,complements:publicComplements(state),saleConditions:SALE_CONDITIONS,sales,services:[...new Set([...REGISTRATION_SERVICES,...services].filter(x=>typeof x==='string'&&x.length<100))],equipment,parts,hoseTypes:['Tipo 1','Tipo 2','Tipo 3','Tipo 4','Tipo 5'],diameters:[38,63,75],lengths:[...new Set([...Array.from({length:500},(_,i)=>i+1),...lengths])].filter(n=>Number.isFinite(Number(n))&&n>0&&n<=500).map(Number),hosePrices,hoseDefaultPrice:price(settings.registrationHoseDefaultPrice??fallback)??50.7};
}
export function registrationQuote(state,data){
 const catalog=catalogForRequest(state,data),missing=[],lines=[];let amount=0;
 const add=(name,quantity,rate)=>{if(rate==null){missing.push(name);return;}const unitCents=Math.round(Number(rate)*100);amount+=unitCents*quantity;lines.push({name,quantity,unitCents});};
 for(const line of data.items||[]){const entry=catalog.equipment.find(e=>e.type===line.type&&e.kg===String(line.kg||''));add(line.type+' '+(entry?.label||line.kg||''),Number(line.qty)||0,entry?.price);}
 for(const part of data.plannedParts||[])add(part.name,Number(part.quantity)||0,catalog.parts.find(p=>p.name===part.name)?.price);
 for(const hose of data.hydrantHoses||[]){const key=hose.type+'|'+Number(hose.lengthMeters);add('Mangueira de hidrante '+hose.type+' · '+hose.lengthMeters+' m',Number(hose.quantity)||0,catalog.hosePrices[key]??catalog.hoseDefaultPrice);}
 for(const item of data.soldExtinguishers||[]){const sale=(catalog.sales||[]).find(e=>e.type===item.type&&e.kg===String(item.kg||'')&&e.condition===item.condition);add('Extintor '+(SALE_CONDITIONS.find(c=>c.value===item.condition)?.label||'')+' · '+item.type+' '+(sale?.label||item.kg||''),Number(item.quantity)||0,sale?.price);}
 for(const row of data.complementaryServices||[]){const c=(catalog.complements||[]).find(c=>c.id===row.catalogId);add((c?.name||row.name||'Complemento')+' · '+(row.variant||'Tipo a selecionar'),Number(row.quantity)||0,c?.prices?.[row.variant]);}
 return {amountCents:amount,missing:[...new Set(missing)],pending:missing.length>0,lines};
}
export function normalizeRegistration(state,data){
 const catalog=catalogForRequest(state,data);
 if(!catalog.services.includes(data.serviceType))throw Error('Selecione um serviço disponível.');
 for(const line of data.items||[])if(!catalog.equipment.some(e=>e.type===line.type&&e.kg===String(line.kg??'')&&e.maintenanceAllowed!==false))throw Error('Selecione o tipo e a capacidade do extintor na lista.');
 const parts=Array.isArray(data.plannedParts)?data.plannedParts:[],hoses=Array.isArray(data.hydrantHoses)?data.hydrantHoses:[];
 if(parts.length>50||hoses.length>50)throw Error('Máximo de 50 grupos de peças ou mangueiras por ordem.');
 const count=(n,max=100)=>{const value=Number(n);if(!Number.isInteger(value)||value<1||value>max)throw Error('Selecione uma quantidade válida.');return value;};
 const plannedParts=parts.map(p=>{if(!catalog.parts.some(a=>a.name===p.name))throw Error('Selecione uma peça cadastrada.');return{name:p.name,quantity:count(p.quantity)};});
 if(hoses.length&&catalog.version>=5&&!catalog.complements.some(c=>c.id==='hydrant-hose-test'))throw Error('O teste de mangueira foi desativado pelo administrador.');
 const hydrantHoses=hoses.map(h=>{if(!catalog.hoseTypes.includes(h.type)||!catalog.diameters.includes(Number(h.diameterMm))||!catalog.lengths.includes(Number(h.lengthMeters)))throw Error('Confira tipo, diâmetro e metros da mangueira.');return{type:h.type,diameterMm:Number(h.diameterMm),lengthMeters:Number(h.lengthMeters),quantity:count(h.quantity)};});
 const rawSales=Array.isArray(data.soldExtinguishers)?data.soldExtinguishers:[];if(rawSales.length>50)throw Error('Máximo de 50 grupos de extintores para fornecimento.');
 const soldExtinguishers=rawSales.map(item=>{const condition=SALE_CONDITIONS.find(c=>c.value===item.condition),kg=String(item.kg??'');if(!condition||!catalog.equipment.some(e=>e.type===item.type&&e.kg===kg))throw Error('Selecione condição, tipo e capacidade do extintor para fornecimento.');return{condition:condition.value,type:item.type,kg,quantity:count(item.quantity),hasRing:condition.hasRing};});
 if(soldExtinguishers.reduce((n,i)=>n+i.quantity,0)>100)throw Error('Máximo de 100 extintores para fornecimento por ordem.');
 return {plannedParts,hydrantHoses,soldExtinguishers,complementaryServices:normalizeComplements(state,data.complementaryServices)};
}
export const cents = value => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) throw Error('Informe um valor não negativo e válido.');
  return Math.round(number * 100);
};
export const cancelled = service => Boolean(service.cancelledAt || service.status === 'Cancelado');
export const completed = service => Boolean(service.closed || service.employeeCompletedAt);
export function billingOwner(service){
  if(service.adminOwned)return null;
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
  const owner=billingOwner(service);
  if(service.billingVersion!==2)return {amountCents:cents(service.basePrice??service.price??0),discountPercent:null,pending:false};
  const rates=(service.items||[]).map(item=>minimumRate(state,owner,item.type,item.kg));
  const amountCents=!(service.workshopVersion>=44)&&Number.isInteger(service.internalBaseCents)?service.internalBaseCents:rates.reduce((sum,rate)=>sum+cents(rate),0);
  return {amountCents,discountPercent:null,pending:rates.some(rate=>!Number.isFinite(rate)||rate<0)};
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
  const internal=teamBase(state,service),factor=1;
  const publicCatalog=registrationCatalog(state);
  const catalog = (state.costCatalog || []).filter(entry => entry.active !== false);
  const lines = [];let extraPricingPending=false;
  const add = (name, quantity, entry, revenue, kind) => {
    if (!quantity) return;
    lines.push({name,quantity,kind,unitCostCents:entry?.unitCost != null ? cents(entry.unitCost) : null,unitRevenueCents:Math.round((revenue == null ? cents(entry?.salePrice ?? state.settings?.partPrices?.[name] ?? 0) : cents(revenue))*factor)});
  };
  const find = (name, kg) => catalog.find(entry => entry.name === name && String(entry.kg || '') === String(kg || '')) || catalog.find(entry => entry.name === name && !entry.kg);
  for (const item of service.items || []) {
    const serviceCost = catalog.find(entry=>entry.category==='Serviço' && entry.name===item.type && String(entry.kg || '')===String(item.kg || ''));
    const publicType=(state.types||[]).find(t=>t.name===item.type&&String(t.kg||'')===String(item.kg||''));
    add(item.type || 'Extintor',1,serviceCost,service.billingVersion===2?(publicType?.price??maintenanceSuggestion(item.type,item.kg)):(item.unitPrice || 0),'equipment-cost');
    for (const name of item.replacedParts || []) add(name,1,find(name),null,'part');
  }
  if((service.powderUsage||[]).some(r=>r.grams>0))add('Consumo de pó químico',1,{unitCost:service.powderCostCents==null?null:service.powderCostCents/100},0,'powder');
  add('Pintura',Number(service.paintingQuantity ?? (service.items || []).filter(i=>i.painted).length),find('Pintura'),find('Pintura')?.salePrice??state.settings?.partPrices?.Pintura??7,'painting');
  for (const line of service.financialItems || []) {
    const entry = catalog.find(entry => entry.id === line.catalogId);
    if (!entry) throw Error('Um item financeiro foi removido. Revise a ordem antes de finalizar.');
    if (!Number.isInteger(Number(line.quantity)) || line.quantity < 1 || line.quantity > 10000) throw Error('Quantidade financeira inválida.');
    add(entry.name,Number(line.quantity),entry,null,'additional');
  }
  for(const hose of service.hydrantHoses||[]){
    const entry=find('Teste de mangueira de hidrante',''),rate=state.settings?.registrationHosePrices?.[hose.type+'|'+hose.lengthMeters]??entry?.salePrice??publicCatalog.hosePrices?.[hose.type+'|'+hose.lengthMeters]??publicCatalog.hoseDefaultPrice;
    if(rate==null)extraPricingPending=true;
    add('Teste de mangueira de hidrante · '+hose.type+' · '+hose.lengthMeters+' m',hose.quantity,entry,rate??0,'hydrant-hose');
  }
  for(const item of service.soldExtinguishers||[]){
    const condition=SALE_CONDITIONS.find(c=>c.value===item.condition),entry=catalog.find(c=>c.saleCondition===item.condition&&c.equipmentType===item.type&&String(c.kg||'')===String(item.kg||''));
    const rate=entry?.salePrice??publicCatalog.sales?.find(e=>e.type===item.type&&e.kg===String(item.kg||'')&&e.condition===item.condition)?.price;
    if(!condition||rate==null||Number(rate)<=0)extraPricingPending=true;
    add('Extintor '+(condition?.label||'')+' · '+item.type+' '+(item.kg||'10 L'),item.quantity,entry,service.billingVersion===2?minimumSaleRate(state,billingOwner(service),item.type,item.kg,item.condition):(rate||0),'extinguisher-sale');
  }
  for(const row of service.complementaryServices||[]){
    const definition=complementDefinitions(state,true).find(c=>c.id===row.catalogId),published=publicCatalog.complements?.find(c=>c.id===row.catalogId);
    const rate=validMoney(row.unitPrice)??validMoney(definition?.prices?.[row.variant])??validMoney(published?.prices?.[row.variant]);
    if(rate===null)extraPricingPending=true;
    add(row.name+' · '+row.variant,row.quantity,{unitCost:validMoney(definition?.costs?.[row.variant])},rate??0,'complement');
  }
  const baseRevenueCents = internal.amountCents;
  let revenueCents = baseRevenueCents + lines.filter(line=>line.kind!=='equipment-cost').reduce((sum,line)=>sum+line.quantity*line.unitRevenueCents,0);
  if(service.registrationVersion>=8&&service.registeredByRole==='admin'&&!billingOwner(service)&&service.retailPriceSource==='custom'&&service.retailAmount!=null){
    const agreed=cents(service.retailAmount),difference=agreed-revenueCents;
    if(difference)lines.push({name:'Ajuste do valor combinado com o cliente',quantity:1,kind:'retail-adjustment',unitCostCents:0,unitRevenueCents:difference});
    revenueCents=agreed;
  }
  const costCents = lines.reduce((sum,line)=>sum+line.quantity*(line.unitCostCents || 0),0);
  const missingCosts = lines.filter(line=>line.unitCostCents === null).map(line=>line.name);
  return {lines,baseRevenueCents,revenueCents,costCents,profitCents:revenueCents-costCents,missingCosts:[...new Set(missingCosts)],costsComplete:!missingCosts.length,pricingPending:internal.pending||extraPricingPending,discountPercent:internal.discountPercent};
}
export function captureFinance(state, service, instant) {
  const totals = estimateFinance(state,service), policy = servicePolicy(state,service),payer=billingOwner(service);
  if((service.soldExtinguishers?.length||service.complementaryServices?.length)&&totals.pricingPending)throw Error('Configure preços de extintores novos/seminovos e as condições internas da equipe antes de finalizar.');
  if(service.billingVersion===2&&(totals.pricingPending||totals.revenueCents<=0))throw Error('Configure os valores mínimos por extintor ou defina o valor interno da manutenção antes de finalizar.');
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
    if(old.suggestedRetailCents!=null)next.suggestedRetailCents=old.suggestedRetailCents;
    if (old.finance && !options.settlement) next.finance = structuredClone(old.finance);
    if (old.closed) {
      if (!next.closed || next.sellerId !== old.sellerId || next.employeeId !== old.employeeId || JSON.stringify(next.billingOwner||null)!==JSON.stringify(old.billingOwner||null)) throw Error('O responsável por serviço finalizado não pode ser alterado.');
      // Os dados técnicos e os vídeos do atendimento fechado permanecem imutáveis.
      next.items=structuredClone(old.items || []);
      if(old.registrationVersion>=4)next.soldExtinguishers=structuredClone(old.soldExtinguishers||[]);
      if(old.registrationVersion>=5)next.complementaryServices=structuredClone(old.complementaryServices||[]);
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
  return {adminOwned:Boolean(service.adminOwned),ownershipRole:service.ownershipRole||service.registeredByRole,originalCreator:service.originalCreator||null,transferRequest:service.transferRequest||null,workshopVersion:service.workshopVersion||0,powderUsage:service.powderUsage||[],powderRecordedAt:service.powderRecordedAt||'',complementaryServices:(service.complementaryServices||[]).map(({catalogId,name,variant,quantity,parameters})=>({catalogId,name,variant,quantity,parameters})),soldExtinguishers:service.soldExtinguishers||[],clientSource:service.clientSource||'',registeredBy:service.registeredBy||'',registeredByRole:service.registeredByRole||'',registeredById:service.registeredById||'',plannedParts:service.plannedParts||[],hydrantHoses:service.hydrantHoses||[],id:service.id,code:service.code,date:service.date,serviceType:service.serviceType,clientName:service.clientName || '',employeeId:service.employeeId || '',employeeName:service.employeeName || '',sellerName:service.sellerName || '',closed:Boolean(service.closed),closedAt:service.closedAt || '',cancelledAt:service.cancelledAt || '',employeeCompletedAt:service.employeeCompletedAt || '',status:service.status,pausedAt:service.pausedAt || '',pauseReason:service.pauseReason || '',pauseStatus:service.pauseStatus || '',pauseIntervals:service.pauseIntervals || [],paintingQuantity:Number(service.paintingQuantity ?? (service.items || []).filter(item=>item.painted).length),paintingRecordedAt:service.paintingRecordedAt || '',notes:service.notes || '',history:service.history || [],workflow:service.workflow || null,items:(service.items || []).map(item=>({type:item.type,kg:item.kg,serial:item.serial || '',maintenanceYear:item.maintenanceYear || '',hydroYear:item.hydroYear || '',status:item.status,notes:item.notes || '',painted:Boolean(item.painted),replacedParts:item.replacedParts || [],replacementMedia:item.replacementMedia || {},history:item.history || []}))};
}
export function employeeCreatedService(service,id){
 if(service.adminOwned||service.registeredByRole!=='employee')return false;
 const creator=service.registeredById||(service.billingOwner?.role==='employee'?service.billingOwner.id:'');
 return Boolean(id&&creator===id);
}
export function employeeServiceView(service,id){
 const view=structuredClone(service);
 if(!employeeCreatedService(service,id)){
  const remove=value=>{if(!value||typeof value!=='object')return;for(const key of ['nextMaintenanceMonth','maintenanceYear','hydroYear','maintenanceValid','hydroValid'])delete value[key];for(const child of Object.values(value))if(child&&typeof child==='object')remove(child);};remove(view);
 }
 return view;
}
export function teamView(service,role,id){
  const view = technicalView(service);
  const owner=service.finance?.payer||billingOwner(service),owns=owner?.role===role&&owner.id===id;
  view.billingOwner=service.billingOwner||null;view.billingVersion=service.billingVersion||1;
  if(owns){view.retailAmount=service.retailAmount??null;view.suggestedRetailCents=service.suggestedRetailCents??null;view.retailPriceSource=service.retailPriceSource||'';}
  view.nextMaintenanceMonth = service.nextMaintenanceMonth || '';
  view.events = (service.history || []).map(event=>({at:event.at,status:event.action || event.status,item:event.description || ''}));
  view.charge = owns&&service.finance ? {amountCents:service.finance.revenueCents,dueDate:service.finance.dueDate,policy:service.finance.policy,payment:service.finance.payment,settlementId:service.finance.settlementId||'',lines:service.finance.lines.map(line=>({name:line.name,quantity:line.quantity,unitRevenueCents:line.unitRevenueCents}))} : null;
  return role==='employee'?employeeServiceView(view,id):view;
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
 const workshop=workshopAdminOperation(state,data,username,at);if(workshop)return workshop;
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
 if(service.workshopVersion>=44&&Object.values(powderCapacity(service)).some(Boolean)&&!service.powderRecordedAt)throw Error('Registre o consumo de pó químico, inclusive zero, antes de finalizar.');
 const missing=missingVideos(service);if(missing.length)throw Error('Faltam vídeos de peças trocadas: '+missing.join('; '));
 if(!(service.items?.length||service.hydrantHoses?.length||service.soldExtinguishers?.length||service.complementaryServices?.length)||(service.items||[]).some(i=>!/^20\d{2}$/.test(String(i.maintenanceYear||''))||i.hydroYear&&!/^20\d{2}$/.test(String(i.hydroYear))))throw Error('Confira os anos de manutenção e teste hidrostático em todos os equipamentos.');
 if((state.orders||[]).some(o=>o.code===service.code&&o.kind==='Manutenção'))throw Error('Esta ordem antiga possui pagamento integrado. Finalize com internet.');
 service.closed=true;service.closedAt=at;service.closedBy=username;
 if(service.items?.length&&!service.nextMaintenanceMonth&&/^\d{4}-\d{2}/.test(service.date||''))service.nextMaintenanceMonth=String(Number(service.date.slice(0,4))+1)+service.date.slice(4,7);
  for(const item of service.items||[]){item.status='Concluído';item.history||=[];item.history.push({status:'Concluído',at,by:username})}
 service.history||=[];service.history.push({at,action:'Serviço finalizado pelo administrador',description:'Registrado no aparelho; confirmação de envio apresentada separadamente.',by:username});
}
export function updateAdminOrder(state,d,username,at){
 const service=state.services.find(s=>s.id===d.serviceId);if(!service)throw Error('Serviço não encontrado.');
 if(service.closed||cancelled(service))throw Error('Edite o cadastro antes de finalizar ou cancelar.');
 const name=String(d.clientName||'').trim(),serviceType=String(d.serviceType||'').trim(),date=String(d.date||'').trim(),lines=d.items;
  if(name&&name.length<2||name.length>100||!serviceType||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||!Array.isArray(lines)||(!lines.length&&!service.soldExtinguishers?.length&&!service.complementaryServices?.length&&!service.hydrantHoses?.length)||lines.length>100)throw Error('Confira cliente, data, serviço e equipamentos.');
  const email=String(d.clientEmail||'').trim(),phone=String(d.clientPhone||'').trim();
  if(email&&(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw Error('E-mail inválido.');
  if(phone&&!/^\+?[\d\s().-]{8,30}$/.test(phone))throw Error('Telefone inválido.');
  const items=lines.map((line,i)=>{const type=String(line.type||'').trim().slice(0,100);if(!type)throw Error('Informe o tipo de cada equipamento.');return {...service.items?.[i],type,kg:String(line.kg||'').trim().slice(0,12),serial:String(line.serial||'').trim().slice(0,100)}});
 for(const [key,max] of [['clientPhone',30],['clientEmail',254],['parts',1000],['notes',3000],['sellerName',100],['employeeName',100]])service[key]=String(d[key]||'').trim().slice(0,max);
 service.clientName=name;service.serviceType=serviceType.slice(0,100);service.date=date;
  service.items=items;
  service.type=[...new Set(service.items.map(i=>i.type))].join(', ');service.serial=service.items[0]?.serial||'';
 service.history||=[];service.history.push({at,action:'Cadastro corrigido pelo administrador',by:username});
 const order=(state.orders||[]).find(o=>o.code===service.code);if(order)Object.assign(order,{name,phone:service.clientPhone,email:service.clientEmail,details:service.notes});
}
