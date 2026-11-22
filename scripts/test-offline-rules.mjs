import assert from 'node:assert/strict';
import {applyOperation,replayLocal,isPaused,activeWork,adminChanges,applyAdminChanges} from '../site/offline-rules.mjs';
import {registrationCatalog,registrationQuote,estimateFinance,teamView} from '../site/service-rules.mjs';
const actor={role:'employee',id:'employee-test',username:'tecnico',name:'Técnico'};
const state=()=>({settings:{teamPricing:{employee:{minimumRates:{'ABC|6':80}}},stages:['Recebido','Em manutenção','Pintando','Inspeção final']},types:[{name:'ABC',kg:'6',price:80}],services:[],inventory:[{name:'Válvula M30',qty:5}]});
let n=0;const operation=(kind,serviceId,payload={})=>({id:'operation-'+(++n),deviceId:'device-test',serviceId,kind,payload,createdAt:'2026-11-12T12:00:00Z'});
const create=id=>operation('create',id,{date:'2026-11-12',serviceType:'Recarga',clientName:'Empresa Teste',items:[{type:'ABC',kg:'6',qty:2}]});
const at='2026-11-12T12:00:00Z';
{
 const selected=state();selected.settings.teamPricing={seller:{minimumRates:{'ABC|6':64}}};selected.settings.registrationHosePrices={'Tipo 2|15':30};selected.costCatalog=[{name:'Válvula M30',salePrice:50,unitCost:7,technicalPart:true},{name:'Teste de mangueira de hidrante',unitCost:10}];
 const vendor={role:'seller',id:'seller-choice',username:'vendedor',name:'Vendedor Teste'};
 const payload={registrationVersion:3,date:'2026-11-12',serviceType:'Recarga',items:[{type:'ABC',kg:'6',qty:2}],plannedParts:[{name:'Válvula M30',quantity:1}],hydrantHoses:[{type:'Tipo 2',diameterMm:38,lengthMeters:15,quantity:2}],suggestedRetailCents:1};
 assert.equal(registrationQuote(selected,payload).amountCents,27000);
 const order=applyOperation(selected,vendor,operation('create','service-select',payload),at);
 assert.equal(order.clientName,vendor.name);assert.equal(order.clientSource,'creator');assert.equal(order.billingOwner.id,vendor.id);assert.equal(order.retailAmount,270);assert.equal(order.suggestedRetailCents,27000);assert.equal(order.retailPriceSource,'suggested');assert.equal(order.hydrantHoses[0].quantity,2);
 const f=estimateFinance(selected,order);assert.equal(f.baseRevenueCents,12800);assert.equal(f.revenueCents,18800);assert.equal(f.lines.some(l=>l.kind==='part'),false,'planned parts are not stock consumption or a performed replacement');
 const custom=applyOperation(selected,vendor,operation('create','service-custom-price',{...payload,clientName:'Cliente externo',serviceAmount:999}),at);assert.equal(custom.retailAmount,999);assert.equal(custom.suggestedRetailCents,27000);assert.equal(custom.clientSource,'customer');
 assert.equal(teamView(order,'employee','other').retailAmount,undefined);assert.equal(teamView(order,'seller',vendor.id).retailAmount,270);
 assert.equal(JSON.stringify(registrationCatalog(selected)).includes('unitCost'),false);
 assert.throws(()=>applyOperation(selected,vendor,operation('create','service-bad-kind',{...payload,items:[{type:'Digitado fora da lista',kg:'6',qty:1}]}),at),/lista/);
 assert.throws(()=>applyOperation(selected,vendor,operation('create','service-bad-hose',{...payload,hydrantHoses:[{type:'Tipo 9',diameterMm:38,lengthMeters:15,quantity:1}]}),at),/mangueira/);
 assert.throws(()=>applyOperation(selected,vendor,operation('create','service-bad-part',{...payload,plannedParts:[{name:'Peça inventada',quantity:1}]}),at),/peça/);
 const missing=applyOperation(selected,vendor,operation('create','service-pending-price',{...payload,items:[{type:'Classe D',kg:'9',qty:1}]}),at);assert.ok(missing.suggestedRetailCents>0);assert.ok(missing.retailAmount>0);assert.equal(missing.retailPriceSource,'suggested');
}
// Available orders are cached automatically and can be claimed without a request.
const availableState=state(),available=applyOperation(availableState,{...actor,role:'seller'},create('service-available'),at);
applyOperation(availableState,actor,operation('claim',available.id),at);
assert.equal(available.employeeId,actor.id);assert.equal(available.status,'Recebido');
assert.throws(()=>applyOperation(availableState,actor,operation('claim',available.id),at),/não está disponível/);
const original={settings:{company:'Protec',whatsapp:'111'},products:[{id:'product-test',name:'Antes',active:true}],services:[{id:'service-test',history:[{action:'Criada'}]}]};
const edited=structuredClone(original);edited.settings.company='Novo nome';edited.products[0].active=false;edited.services[0].history.push({action:'Nota local'});
const patch=adminChanges(original,edited),remote=structuredClone(original);remote.settings.whatsapp='222';remote.services[0].history.push({action:'Nota remota'});
applyAdminChanges(remote,patch);assert.equal(remote.settings.company,'Novo nome');assert.equal(remote.settings.whatsapp,'222');assert.equal(remote.products[0].active,false);assert.equal(remote.services[0].history.length,3);
const conflict=structuredClone(original);conflict.settings.company='Nome remoto';assert.throws(()=>applyAdminChanges(conflict,patch),/mesmo campo mudou/);
const removed=structuredClone(original);removed.products=[];const deletion=adminChanges(original,removed);applyAdminChanges(removed,deletion);assert.equal(removed.products.length,0);
assert.throws(()=>applyAdminChanges(structuredClone(original),[{path:['settings','__proto__'],before:{exists:false},after:{exists:true,value:{hacked:true}}}]),/Campo inválido/);
assert.equal({}.hacked,undefined);
const db=state(),first=applyOperation(db,actor,create('service-first'),at);
assert.equal(first.price,160);assert.equal(first.employeeId,actor.id);
assert.throws(()=>applyOperation(db,actor,create('service-urgent'),at),/Pause ou conclua/);
applyOperation(db,actor,operation('stage',first.id,{status:'Em manutenção'}),at);
applyOperation(db,actor,operation('pause',first.id,{reason:'Atendimento urgente'}),at);
assert.ok(isPaused(first));assert.equal(first.items[0].status,'Em manutenção');assert.equal(activeWork(db,actor.id),undefined);
assert.throws(()=>applyOperation(db,actor,operation('technical',first.id,{itemIndex:0,parts:[],notes:'x'}),at),/Retome/);
const urgent=applyOperation(db,actor,create('service-urgent'),at);
assert.throws(()=>applyOperation(db,actor,operation('resume',first.id),at),/outro serviço/);
applyOperation(db,actor,operation('pause',urgent.id,{reason:'Retorno ao anterior'}),at);
applyOperation(db,actor,operation('resume',first.id),at);
assert.equal(first.status,'Em manutenção');assert.equal(first.pauseIntervals.length,1);assert.equal(first.pauseIntervals[0].reason,'Atendimento urgente');
applyOperation(db,actor,operation('technical',first.id,{itemIndex:0,parts:['Válvula M30'],notes:'Troca necessária'}),at);
assert.equal(db.inventory[0].qty,4);
applyOperation(db,actor,operation('technical',first.id,{itemIndex:0,parts:['Válvula M30'],notes:'Conferido'}),at);
assert.equal(db.inventory[0].qty,4);
assert.throws(()=>applyOperation(db,actor,operation('complete',first.id),at),/atualize a etapa até “Inspeção final”/);
applyOperation(db,actor,operation('stage',first.id,{status:'Inspeção final'}),at);
assert.throws(()=>applyOperation(db,actor,operation('complete',first.id),at),/quantidade de pinturas/);
applyOperation(db,actor,operation('painting',first.id,{quantity:0}),at);
assert.throws(()=>applyOperation(db,actor,operation('complete',first.id),at),/Vídeos pendentes/);
applyOperation(db,actor,operation('media',first.id,{itemIndex:0,part:'Válvula M30',media:{url:'https://example.com/video'}}),at);
applyOperation(db,actor,operation('complete',first.id),at);
assert.ok(first.employeeCompletedAt);assert.equal(first.closed,undefined);assert.equal(first.items[0].status,'Concluído');
assert.throws(()=>applyOperation(db,actor,operation('pause',first.id,{reason:'Não pode'}),at),/já foi concluída/);
assert.throws(()=>applyOperation(db,{...actor,id:'other'},operation('resume',first.id),at),/não atribuída/);
const seller={...actor,role:'seller',id:'seller-test'};const sellerState=state();
const order=applyOperation(sellerState,seller,create('service-seller'),at);assert.equal(order.sellerId,seller.id);assert.equal(order.employeeId,'');
assert.throws(()=>applyOperation(sellerState,seller,operation('painting',order.id,{quantity:0}),at),/não atribuída/);
assert.throws(()=>applyOperation(state(),actor,{...create('bad-date'),payload:{date:'2026-02-30',serviceType:'x',items:[{type:'ABC',qty:1}]}},at),/data/);
assert.throws(()=>applyOperation(state(),actor,{...create('bad-qty1'),payload:{date:'2026-11-12',serviceType:'x',items:[{type:'ABC',qty:0}]}},at),/quantidades/);
const profile={actor,settings:state().settings,types:state().types,services:[]},queued=create('service-replay');
const projected=replayLocal(profile,[queued],{});assert.equal(projected.length,1);assert.ok(projected[0].localPending);assert.equal(profile.services.length,0);
assert.equal(replayLocal(profile,[queued],{[queued.id]:{discarded:true}}).length,0);

{
const {applyOperation}=await import('../site/offline-rules.mjs');
const {registrationCatalog,registrationQuote,estimateFinance,captureFinance,technicalView,finalizeAdminOrder,preserveAndCapture}=await import('../site/service-rules.mjs');
const type='Pó químico ABC',at='2026-11-14T15:00:00Z',actor={id:'seller-one',name:'Vendedor',username:'seller',role:'seller'};
const fixture=()=>({services:[],types:[{id:'abc-six',name:type,kg:'6',price:100}],settings:{teamPricing:{seller:{minimumRates:{'Pó químico ABC|6':80}}},registrationHosePrices:{'Tipo 2|15':40}},costCatalog:[{id:'service-cost',name:type,kg:'6',category:'Serviço',unitCost:10,salePrice:100},{id:'new',name:'Novo',saleCondition:'new',equipmentType:type,kg:'6',salePrice:300,unitCost:180},{id:'used',name:'Seminovo',saleCondition:'refurbished',equipmentType:type,kg:'6',salePrice:200,unitCost:100},{id:'hose',name:'Teste de mangueira de hidrante',unitCost:10,salePrice:40},{id:'part',name:'Válvula M30',technicalPart:true,unitCost:5,salePrice:15}]});
const payload={registrationVersion:4,date:'2026-11-14',serviceType:'Manutenção',items:[{type,kg:'6',qty:1}],plannedParts:[{name:'Válvula M30',quantity:1}],hydrantHoses:[{type:'Tipo 2',diameterMm:38,lengthMeters:15,quantity:2}],soldExtinguishers:[{condition:'new',type,kg:'6',quantity:2,hasRing:true,unitPrice:1},{condition:'refurbished',type,kg:'6',quantity:1,hasRing:false}]};
const operation=data=>({id:crypto.randomUUID(),serviceId:crypto.randomUUID(),kind:'create',payload:data});
const state=fixture(),service=applyOperation(state,actor,operation(payload),at);
assert.equal(service.price,530);assert.equal(service.basePrice,80);
const cached=fixture();cached.registrationCatalog=registrationCatalog(cached);cached.costCatalog=[];assert.equal(applyOperation(cached,actor,operation(payload),at).price,530);
assert.equal(service.items.length,1);assert.equal(service.soldExtinguishers.length,2);assert.equal(service.soldExtinguishers[0].hasRing,false);assert.equal(service.soldExtinguishers[1].hasRing,true);assert.equal(service.retailAmount,995);assert.equal(service.billingOwner.id,actor.id);
const finance=estimateFinance(state,service);assert.equal(finance.revenueCents,53000);assert.equal(finance.costCents,49000);assert.equal(finance.lines.filter(l=>l.kind==='extinguisher-sale').length,2);assert.equal(finance.lines.filter(l=>l.kind==='part').length,0);assert.equal(finance.pricingPending,false);
assert.equal(JSON.stringify(registrationCatalog(state)).includes('unitCost'),false);assert.equal(JSON.stringify(technicalView(service)).includes('unitCost'),false);
for(const bad of [{condition:'invented',type,kg:'6',quantity:1},{condition:'new',type:'invented',kg:'6',quantity:1},{condition:'new',type,kg:'6',quantity:1.5}])assert.throws(()=>applyOperation(fixture(),actor,operation({...payload,soldExtinguishers:[bad]}),at),/Selecione|quantidade/);
const missing=fixture();missing.costCatalog.find(c=>c.id==='new').active=false;assert.equal(registrationQuote(missing,payload).pending,false);const unpriced=applyOperation(missing,actor,operation(payload),at);assert.ok(captureFinance(missing,unpriced,at).revenueCents>0);
const only=fixture(),supply=applyOperation(only,actor,operation({...payload,items:[],plannedParts:[],hydrantHoses:[],soldExtinguishers:[{condition:'new',type,kg:'6',quantity:1}]}),at);assert.equal(supply.items.length,0);assert.ok(supply.paintingRecordedAt);finalizeAdminOrder(only,supply.id,'admin',at);const previous=fixture();previous.services=[structuredClone({...supply,closed:false})];preserveAndCapture(only,previous,at);assert.equal(supply.finance.revenueCents,13000);
assert.throws(()=>applyOperation(fixture(),actor,operation({...payload,items:[],plannedParts:[],hydrantHoses:[],soldExtinguishers:[]}),at),/pelo menos/);

}
console.log('Regras offline: pausa, retomada, urgência, histórico, peças, estoque, vídeos obrigatórios, papéis, projeção local e fornecimento novo/seminovo verificados.');

// Shared registration v5: arbitrary technical text never becomes an order option.
{
 const {registrationCatalog,normalizeRegistration,registrationQuote,estimateFinance,technicalView,finalizeAdminOrder,captureFinance,preserveAndCapture,validateComplementSettings}=await import('../site/service-rules.mjs');
 const {serviceVersion}=await import('../api-cloudflare/src/offline.mjs');
 const at='2026-11-14T18:00:00Z',type='Pó químico ABC',actor={role:'seller',id:'seller-v34',username:'seller',name:'Vendedor'};
 const fixture=()=>({services:[],types:[{name:type,kg:'4',price:100}],settings:{teamPricing:{seller:{minimumRates:{'ABC|6':64}}},registrationComplements:[{id:'wall-support',name:'Suporte de parede',variants:['Universal','Duplo'],active:true,prices:{Universal:25,Duplo:40},costs:{Universal:9,Duplo:15}}]},costCatalog:[]});
 const payload={registrationVersion:5,date:'2026-11-14',serviceType:'Manutenção',items:[],plannedParts:[],hydrantHoses:[],soldExtinguishers:[],complementaryServices:[{catalogId:'wall-support',variant:'Universal',quantity:2,unitPrice:0,unitCost:0,name:'FORGED',parameters:{unexpected:'not accepted'}}]};
 const op=data=>({id:crypto.randomUUID(),serviceId:crypto.randomUUID(),kind:'create',payload:data});
 const db=fixture(),catalog=registrationCatalog(db),selected=normalizeRegistration(db,payload);validateComplementSettings(db);
 assert.equal(catalog.version,8);assert.equal(catalog.complements.length,13);assert.equal(JSON.stringify(catalog).includes('costs'),false);
 assert.deepEqual(selected.complementaryServices,[{catalogId:'wall-support',name:'Suporte de parede',variant:'Universal',quantity:2,parameters:{},unitPrice:25}]);
 assert.equal(registrationQuote(db,payload).amountCents,5000);
 const service=applyOperation(db,actor,op(payload),at);assert.equal(service.price,50);assert.equal(service.retailAmount,50);assert.equal(service.paintingQuantity,0);
 const totals=estimateFinance(db,service);assert.equal(totals.costCents,1800);assert.equal(totals.revenueCents,5000);assert.equal(totals.profitCents,3200);assert.equal(totals.pricingPending,false);
 const publicService=technicalView(service);assert.equal(JSON.stringify(publicService).includes('unitPrice'),false);assert.equal(JSON.stringify(publicService).includes('unitCost'),false);
 const offline=fixture();offline.registrationCatalog=catalog;offline.costCatalog=[];assert.equal(applyOperation(offline,actor,op(payload),at).price,50);
 for(const bad of [{...payload.complementaryServices[0],catalogId:'other-work'},{...payload.complementaryServices[0],variant:'typed arbitrary text'},{...payload.complementaryServices[0],quantity:1.5}])assert.throws(()=>applyOperation(fixture(),actor,op({...payload,complementaryServices:[bad]}),at),/Selecione/);
 const removed=fixture();removed.settings.registrationComplements[0].active=false;assert.equal(registrationCatalog(removed).complements.some(c=>c.id==='wall-support'),false);assert.throws(()=>applyOperation(removed,actor,op(payload),at),/ativo/);
 const invalid=fixture();invalid.settings.registrationComplements[0].prices.Universal=-1;assert.throws(()=>validateComplementSettings(invalid),/preços/);
 const missing=fixture();missing.settings.registrationComplements[0].prices.Universal=null;const unpriced=applyOperation(missing,actor,op(payload),at);assert.equal(unpriced.retailAmount,20.34);assert.ok(captureFinance(missing,unpriced,at).revenueCents>0);
 // Inactive catalog options remain readable and billable in previously accepted orders.
 db.settings.registrationComplements[0].active=false;db.settings.registrationComplements[0].prices.Universal=999;assert.equal(estimateFinance(db,service).revenueCents,5000);finalizeAdminOrder(db,service.id,'admin',at);
 const previous=fixture();previous.services=[structuredClone({...service,closed:false})];preserveAndCapture(db,previous,at);assert.equal(service.finance.revenueCents,5000);
 const closed=structuredClone(db);closed.services[0].complementaryServices=[];preserveAndCapture(closed,db,at);assert.equal(closed.services[0].complementaryServices.length,1);
 const adminState=fixture(),adminService=applyOperation(adminState,{role:'admin',id:'admin-account',username:'admin',name:'Admin'},op({...payload,items:[{type,kg:'4',qty:1}]}),at);assert.equal(adminService.price,150);assert.equal(adminService.basePrice,100);assert.equal(adminService.billingVersion,1);assert.equal(adminService.billingOwner,undefined);
 assert.throws(()=>applyOperation(adminState,{role:'admin'}, {...op({}),kind:'complete'},at),/inválida/);
 const legacy={...service,registrationVersion:4};const changed=structuredClone(legacy);changed.complementaryServices=[];assert.equal(await serviceVersion(legacy),await serviceVersion(changed));changed.registrationVersion=5;assert.notEqual(await serviceVersion(service),await serviceVersion(changed));
 assert.throws(()=>applyOperation(fixture(),actor,op({...payload,registrationVersion:4}),at),/Atualize/);
}
console.log('Cadastro compartilhado v5: complementos por catálogo, privacidade, preços/custos, desconto, desativação, somente complementos, histórico imutável, compatibilidade de versões e admin verificados.');

{
 const {registrationContacts,registrationCatalog}=await import('../site/service-rules.mjs');const {serviceVersion}=await import('../api-cloudflare/src/offline.mjs');
 const actor={role:'seller',id:'seller-allowed',name:'Vendedor',username:'seller'};
 const fixture=()=>({services:[{id:'previous-contact',clientId:'client-allowed',clientName:'Cliente autorizado',clientPhone:'11999999999',employeeId:actor.id,sellerId:'seller-allowed',items:[],closed:true}],clients:[{id:'client-allowed',name:'Cliente autorizado',phone:'11999999999',email:'allowed@example.com',document:'private-document'},{id:'client-private',name:'Cliente de outra equipe',email:'private@example.com'}],sellers:[{id:'seller-allowed',name:'Vendedor autorizado',password:'private-password'},{id:'seller-private',name:'Outro vendedor'}],employees:[{id:actor.id}],types:[{name:'Pó químico ABC',kg:'4',price:100}],settings:{teamPricing:{employee:{discountPercent:20},seller:{minimumRates:{'ABC|6':64}}}},costCatalog:[]});
 const db=fixture(),directory=registrationContacts(db,actor);assert.deepEqual(directory.clients.map(c=>c.id),['client-allowed']);assert.deepEqual(directory.sellers.map(c=>c.id),['seller-allowed']);assert.equal(JSON.stringify(directory).includes('private'),false);
 assert.equal(registrationContacts(db,{role:'admin'}).clients.length,2);assert.equal(registrationContacts(db,{role:'seller',id:'seller-private'}).clients.length,0);
 const payload={registrationVersion:6,serviceType:'Manutenção',date:'2026-11-15',items:[{type:'Pó químico ABC',kg:'4',qty:1}],clientChoice:'client-allowed',sellerChoice:'seller-allowed',clientName:'FORGED',clientEmail:'forged@example.com'};
 const operation=data=>({id:crypto.randomUUID(),serviceId:crypto.randomUUID(),kind:'create',payload:data});
 const service=applyOperation(db,actor,operation(payload),'2026-11-15T12:00:00Z');assert.equal(service.clientName,'Cliente autorizado');assert.equal(service.clientEmail,'allowed@example.com');assert.equal(service.clientId,'client-allowed');assert.equal(service.sellerId,'seller-allowed');assert.equal(service.billingOwner.id,actor.id);assert.equal(service.registeredById,actor.id);
 assert.throws(()=>applyOperation(fixture(),actor,operation({...payload,clientChoice:'client-private'}),'2026-11-15T12:00:00Z'),/cliente selecionado/);assert.throws(()=>applyOperation(fixture(),actor,operation({...payload,sellerChoice:'seller-private'}),'2026-11-15T12:00:00Z'),/vendedor selecionado/);
 const cached=fixture();cached.registrationCatalog=registrationCatalog(cached);cached.registrationContacts=directory;cached.clients=[];cached.sellers=[];assert.equal(applyOperation(cached,actor,operation(payload),'2026-11-15T12:00:00Z').clientId,'client-allowed');
 const personal=applyOperation(fixture(),actor,operation({...payload,clientChoice:'__self__',sellerChoice:'',clientName:'FORGED'}),'2026-11-15T12:00:00Z');assert.equal(personal.clientName,actor.name);assert.equal(personal.clientSource,'creator');
 const manual=applyOperation(fixture(),actor,operation({...payload,clientChoice:'__new__',sellerChoice:'',clientName:'Novo cliente',clientEmail:'new@example.com'}),'2026-11-15T12:00:00Z');assert.equal(manual.clientName,'Novo cliente');
 const changed=structuredClone(service);changed.clientId='different-client';assert.equal(await serviceVersion(service),await serviceVersion(changed));
 const edited=structuredClone(service);edited.clientName='Cliente alterado';assert.notEqual(await serviceVersion(service),await serviceVersion(edited));
 const old={...service,registrationVersion:5},oldChanged={...changed,registrationVersion:5};assert.equal(await serviceVersion(old),await serviceVersion(oldChanged));
}
console.log('Seletores v6: contatos limitados à conta, escolhas conferidas no servidor, rascunho offline, cliente próprio/novo, autoria e cobrança preservadas.');

{
 const {registrationCatalog,normalizeRegistration,registrationQuote}=await import('../site/service-rules.mjs');
 const powders=['1','2','4','6','8','12','20','30','50'],co2=['2','4','6','10'];
 const fixture=()=>({services:[],types:[{name:'Pó químico ABC',kg:'70',price:100},{name:'CO₂',kg:'8',price:150},{name:'Água pressurizada',kg:'75',price:200},{name:'Água pressurizada',kg:'',price:40}],settings:{},costCatalog:[]});
 const db=fixture(),catalog=registrationCatalog(db);
 for(const type of ['Pó químico ABC','Pó químico BC']){assert.deepEqual(catalog.equipment.filter(e=>e.type===type).map(e=>e.kg),powders);for(const condition of ['new','refurbished'])assert.deepEqual(catalog.sales.filter(e=>e.type===type&&e.condition===condition).map(e=>e.kg),powders);}
 assert.deepEqual(catalog.equipment.filter(e=>e.type==='CO₂').map(e=>e.kg),co2);assert.deepEqual(catalog.equipment.filter(e=>e.type==='Água pressurizada').map(e=>[e.kg,e.label,e.fixedCapacity]),[['','10 L',true]]);
 const cached={registrationCatalog:{version:6,equipment:[{type:'CO₂',kg:'8',price:100},{type:'Pó químico ABC',kg:'70',price:100},{type:'Água pressurizada',kg:'150',price:100}],sales:[{type:'CO₂',kg:'8',price:100}],services:['Manutenção'],parts:[],hoseTypes:[],diameters:[],lengths:[],hosePrices:{}}};
 const upgraded=registrationCatalog(cached);assert.deepEqual(upgraded.equipment.filter(e=>e.type==='CO₂').map(e=>e.kg),co2);assert.equal(upgraded.sales.some(e=>e.type==='CO₂'&&e.kg==='8'),false);assert.ok(upgraded.complements.length);
 const data={registrationVersion:7,serviceType:'Manutenção',items:[{type:'Água pressurizada',kg:'',qty:1}],soldExtinguishers:[{type:'Pó químico BC',kg:'30',condition:'new',quantity:1}]};assert.equal(normalizeRegistration(db,data).soldExtinguishers[0].kg,'30');
 for(const [type,kg] of [['CO₂','1'],['CO₂','8'],['Pó químico ABC','70'],['Água pressurizada','75']])assert.throws(()=>normalizeRegistration(db,{...data,items:[{type,kg,qty:1}]}),/tipo e a capacidade/);
 const legacy={...data,registrationVersion:6,items:[{type:'Pó químico ABC',kg:'70',qty:1}],soldExtinguishers:[]};assert.equal(normalizeRegistration(db,legacy).soldExtinguishers.length,0);assert.equal(registrationQuote(db,legacy).amountCents,10000);assert.equal(normalizeRegistration(db,{...legacy,items:[{type:'CO₂',kg:'8',qty:1}]}).hydrantHoses.length,0);
 assert.equal(db.types.length,4);
}
console.log('Capacidades v7: listas exatas em manutenção/venda, água fixa em 10 L, cache antigo filtrado e filas anteriores preservadas.');

{
 const {employeeCreatedService,employeeServiceView,teamView}=await import('../site/service-rules.mjs');
 const actor={id:'employee-author',role:'employee',name:'Funcionário autor',username:'autor'};
 const state={services:[],settings:{},types:[{name:'Pó químico ABC',kg:'4',price:100}],clients:[],sellers:[],costCatalog:[]};
 const own=applyOperation(state,actor,{id:crypto.randomUUID(),serviceId:crypto.randomUUID(),kind:'create',payload:{registrationVersion:7,clientChoice:'__new__',clientName:'Nome forjado',clientEmail:'outro@example.com',sellerChoice:'inexistente',serviceType:'Manutenção',date:'2026-11-15',items:[{type:'Pó químico ABC',kg:'4',qty:1}]}},'2026-11-15T12:00:00Z');
 assert.equal(own.clientName,actor.name);assert.equal(own.clientEmail,'');assert.equal(own.registeredById,actor.id);assert.equal(own.clientSource,'creator');assert.equal(own.sellerId,'');
 own.nextMaintenanceMonth='2027-11';own.items[0].maintenanceYear='2026';own.items[0].hydroYear='2025';own.employeeId='other-executor';
 assert.equal(employeeCreatedService(own,actor.id),true);assert.equal(employeeCreatedService(own,'other-executor'),false);
 assert.equal(teamView(own,'employee',actor.id).nextMaintenanceMonth,'2027-11');
 for(const origin of ['admin','seller','employee']){
  const foreign={...structuredClone(own),registeredByRole:origin,registeredById:'someone-else',employeeId:actor.id};
  const view=teamView(foreign,'employee',actor.id);assert.equal(view.nextMaintenanceMonth,undefined);assert.equal(view.items[0].maintenanceYear,undefined);assert.equal(view.items[0].hydroYear,undefined);assert.equal(foreign.items[0].maintenanceYear,'2026');
  assert.equal(employeeServiceView(foreign,actor.id).nextMaintenanceMonth,undefined);
 }
 assert.equal(employeeCreatedService({...own,registeredById:undefined,billingOwner:{role:'employee',id:actor.id}},actor.id),true);
}
console.log('Funcionário: autoria separada do executor, contato automático e validades próprias protegidas inclusive em cache antigo.');

{
 const {billingOwner,estimateFinance,captureFinance}=await import('../site/service-rules.mjs');
 const at='2026-11-16T18:00:00Z',type='Pó químico ABC',base={registrationVersion:8,workshopVersion:44,clientChoice:'__self__',serviceType:'Manutenção',date:'2026-11-16',items:[{type,kg:'6',qty:1}],serviceAmount:'150'};
 for(const role of ['admin','employee','seller']){
  const actor={role,id:role+'-author',username:role,name:'Autor '+role};
  const fixture=()=>({services:[{id:'prior-related',closed:true,clientSource:'customer',clientId:'allowed-client',clientName:'Cliente permitido',billingOwner:role==='admin'?null:{role,id:actor.id},employeeId:role==='employee'?actor.id:'',sellerId:role==='seller'?actor.id:''}],clients:[{id:'allowed-client',name:'Cliente permitido'},{id:'other-client',name:'Outro cliente'}],sellers:[{id:'seller-choice',name:'Vendedor responsável'}],employees:[],settings:{},types:[{name:type,kg:'6',price:100}],costCatalog:[{id:'maintenance-cost',name:type,kg:'6',category:'Serviço',unitCost:20}]});
  const create=(state,payload)=>applyOperation(state,actor,{id:crypto.randomUUID(),serviceId:crypto.randomUUID(),kind:'create',payload},at);
  for(const choice of ['','__self__','__new__','allowed-client']){
   const db=fixture(),payload={...base,clientChoice:choice,clientName:choice==='__new__'?'Novo cliente':'Nome que deve ser ignorado',clientEmail:choice==='__new__'?'cliente@example.com':''},service=create(db,payload);
   assert.equal(service.registeredById,actor.id);assert.equal(service.registeredByRole,role);
   assert.equal(service.clientSource,['','__self__'].includes(choice)?'creator':'customer');
   assert.equal(service.clientName,['','__self__'].includes(choice)?actor.name:choice==='__new__'?'Novo cliente':'Cliente permitido');
   if(role==='admin'){assert.equal(billingOwner(service),null);assert.equal(estimateFinance(db,service).revenueCents,15000);assert.equal(estimateFinance(db,service).costCents,2000);assert.equal(estimateFinance(db,service).profitCents,13000);assert.equal(captureFinance(db,service,at).payer,null);assert.equal(captureFinance(db,service,at).payment.status,'not-applicable');}
   else{assert.equal(billingOwner(service).id,actor.id);assert.equal(billingOwner(service).role,role);assert.notEqual(estimateFinance(db,service).revenueCents,15000);assert.equal(service.retailAmount,150);}
  }
  assert.throws(()=>create(fixture(),{...base,clientChoice:'__new__',clientName:''}),/nome do novo cliente/);
  if(role!=='admin')assert.throws(()=>create(fixture(),{...base,clientChoice:'other-client'}),/não está mais disponível/);
  else{const db=fixture(),service=create(db,{...base,sellerChoice:'seller-choice'});assert.equal(service.sellerId,'seller-choice');assert.equal(billingOwner(service),null);}
 }
 console.log('Cadastro v8: cliente opcional nos três perfis, serviço próprio com autoria autenticada, cliente autorizado/novo, cobrança interna da equipe preservada e lucro do admin pelo valor combinado.');
}
