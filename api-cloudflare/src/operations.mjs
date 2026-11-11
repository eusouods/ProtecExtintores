import {cents,PART_NAMES,technicalView,sellerView,captureFinance,missingVideos,completed,cancelled} from '../../site/service-rules.mjs';
export const allowedParts = state => [...new Set([...PART_NAMES,...(state.costCatalog || []).filter(item=>item.active !== false && item.technicalPart).map(item=>item.name)])];
export const employeeHistory = (state,id) => (state.services || []).filter(service=>service.employeeId === id || (!service.employeeId && !completed(service) && !cancelled(service))).map(technicalView);
export const sellerHistory = (state,id) => (state.services || []).filter(service=>service.sellerId === id).map(sellerView);
const cleanText = (value,max=150) => String(value || '').trim().slice(0,max);
const requirePolicy = policy => {
  if (!policy || !['weekly','completion'].includes(policy.mode)) throw Error('Selecione a forma de pagamento.');
  const weekday=Number(policy.weekday);
  if (!Number.isInteger(weekday) || weekday<0 || weekday>6) throw Error('Selecione o dia da semana.');
  return {mode:policy.mode,weekday};
};
export async function handleOperations(request,env,context) {
  const {auth,readState,saveState,json,now}=context;
  const path=new URL(request.url).pathname;
  if (!['/api/admin/operations','/api/employee/painting'].includes(path)) return null;
  if (request.method!=='POST') return json({error:'Método não permitido.'},405);
  const employee=path==='/api/employee/painting';
  const session=await auth(request,env,employee?'employee':'admin');
  if(!session)return json({error:'Acesso não autorizado.'},403);
  const data=await request.json(),state=await readState(env),at=now();
  if(employee){
    const service=(state.services || []).find(item=>item.id===data.serviceId && item.employeeId===session.employee_id);
    if(!service||service.closed||service.employeeCompletedAt||cancelled(service))return json({error:'O serviço não está disponível para alteração.'},409);
    const quantity=Number(data.quantity);
    if(!Number.isInteger(quantity)||quantity<0||quantity>(service.items || []).length)return json({error:'Informe uma quantidade entre zero e o total de extintores.'},400);
    service.paintingQuantity=quantity;service.paintingRecordedAt=at;
    service.items.forEach((item,index)=>item.painted=index<quantity);
    service.history ||= [];service.history.push({at,action:'Pintura registrada',description:`${quantity} extintor(es) com pintura.`,by:session.username});
    const admin=await env.DB.prepare('SELECT username FROM admin_auth WHERE id=1').first();
    await saveState(env,state,admin.username);
    return json({ok:true,service:technicalView(service)});
  }
  if(data.action==='save-catalog'){
    state.costCatalog ||= [];
    const name=cleanText(data.name),category=cleanText(data.category,60),kg=cleanText(data.kg,12);
    if(!name)throw Error('Informe o nome do item.');
    cents(data.unitCost);cents(data.salePrice);
    const duplicate=state.costCatalog.find(item=>item.id!==data.id&&item.active!==false&&item.name===name&&String(item.kg || '')===kg);
    if(duplicate)throw Error('Já existe um item com esse nome e capacidade.');
    let item=state.costCatalog.find(item=>item.id===data.id);
    if(!item){item={id:crypto.randomUUID()};state.costCatalog.push(item)}
    Object.assign(item,{name,category,kg,unitCost:Number(data.unitCost),salePrice:Number(data.salePrice),technicalPart:Boolean(data.technicalPart),active:true,updatedAt:at});
  }else if(data.action==='remove-catalog'){
    const item=(state.costCatalog || []).find(item=>item.id===data.id);
    if(!item)throw Error('Item não encontrado.');
    item.active=false;item.removedAt=at;
  }else if(data.action==='policy'){
    const policy=requirePolicy(data.policy);
    if(data.sellerId){const seller=(state.sellers || []).find(item=>item.id===data.sellerId);if(!seller)throw Error('Vendedor não encontrado.');seller.billingPolicy=policy}
    else state.settings.sellerBillingPolicy=policy;
  }else if(data.action==='service-items'){
    const service=(state.services || []).find(item=>item.id===data.serviceId);
    if(!service||service.closed||cancelled(service))throw Error('Ajuste os itens antes de finalizar o serviço.');
    const lines=Array.isArray(data.items)?data.items:[];
    if(lines.length>100)throw Error('Limite de 100 itens adicionais por ordem.');
    for(const line of lines){if(!(state.costCatalog || []).some(item=>item.id===line.catalogId&&item.active!==false))throw Error('Selecione um item ativo.');if(!Number.isInteger(Number(line.quantity))||line.quantity<1||line.quantity>10000)throw Error('Quantidade inválida.')}
    service.financialItems=lines.map(line=>({catalogId:line.catalogId,quantity:Number(line.quantity)}));
    service.history ||= [];service.history.push({at,action:'Itens financeiros revisados',by:session.username});
  }else if(data.action==='capture'){
    const service=(state.services || []).find(item=>item.id===data.serviceId);
    if(!service?.closed||service.finance||cancelled(service))throw Error('Somente ordens finalizadas sem lançamento podem ser importadas.');
    service.finance=captureFinance(state,service,at);
    service.history ||= [];service.history.push({at,action:'Ordem anterior importada para cobrança',by:session.username});
  }else if(data.action==='mark-paid'){
    const ids=[...new Set(Array.isArray(data.serviceIds)?data.serviceIds:[])];
    if(!ids.length||ids.length>500)throw Error('Selecione as ordens a quitar.');
    const reference=cleanText(data.reference,300);if(reference.length<3)throw Error('Informe comprovante, referência ou observação do recebimento.');
    const selected=ids.map(id=>(state.services || []).find(item=>item.id===id));
    if(selected.some(service=>!service?.finance||!service.sellerId||!service.closed||cancelled(service)||service.finance.payment.status!=='pending'))throw Error('Há uma ordem inválida ou já paga. Atualize a tela.');
    if(new Set(selected.map(service=>service.sellerId)).size!==1)throw Error('Quite um vendedor por vez.');
    const batchId=crypto.randomUUID();
    for(const service of selected){service.finance.payment={status:'paid',paidAt:at,by:session.username,reference,batchId};service.history ||= [];service.history.push({at,action:'Recebimento confirmado pelo administrador',description:reference,by:session.username})}
    await saveState(env,state,session.username,{settlement:true});return json({ok:true,state:await readState(env)});
  }else throw Error('Ação inválida.');
  await saveState(env,state,session.username,{capture:data.action==='capture'});
  return json({ok:true,state:await readState(env)});
}
