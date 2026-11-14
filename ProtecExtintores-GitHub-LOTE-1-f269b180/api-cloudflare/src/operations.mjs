import {applyAdminOperation,cents,PART_NAMES,technicalView,sellerView,teamView,billingOwner,captureFinance,missingVideos,completed,cancelled} from '../../site/service-rules.mjs';
import {isPaused} from '../../site/offline-rules.mjs';
export const allowedParts = state => [...new Set([...PART_NAMES,...(state.costCatalog || []).filter(item=>item.active !== false && item.technicalPart).map(item=>item.name)])];
export const employeeHistory = (state,id) => (state.services || []).filter(service=>service.employeeId === id || service.billingOwner?.role==='employee'&&service.billingOwner.id===id || (!service.employeeId && !completed(service) && !cancelled(service))).map(service=>teamView(service,'employee',id));
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
    if(!service||service.closed||service.employeeCompletedAt||cancelled(service)||isPaused(service))return json({error:'O serviço não está disponível para alteração. Retome o serviço se estiver pausado.'},409);
    const quantity=Number(data.quantity);
    if(!Number.isInteger(quantity)||quantity<0||quantity>(service.items || []).length)return json({error:'Informe uma quantidade entre zero e o total de extintores.'},400);
    service.paintingQuantity=quantity;service.paintingRecordedAt=at;
    service.items.forEach((item,index)=>item.painted=index<quantity);
    service.history ||= [];service.history.push({at,action:'Pintura registrada',description:`${quantity} extintor(es) com pintura.`,by:session.username});
    const admin=await env.DB.prepare('SELECT username FROM admin_auth WHERE id=1').first();
    await saveState(env,state,admin.username);
    return json({ok:true,service:technicalView(service)});
  }
  const options=applyAdminOperation(state,data,session.username,at);
  await saveState(env,state,session.username,options);
  return json({ok:true,state:await readState(env)});
}
