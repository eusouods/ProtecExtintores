// Shared, deterministic rules. The server is authoritative for ownership and time.
import {PART_NAMES, cancelled, completed, missingVideos,teamBase} from './service-rules.mjs';
export const uuid = value => /^[a-zA-Z0-9_-]{8,80}$/.test(String(value || ''));
export function fail(message, status = 400) { throw Object.assign(new Error(message), {status}); }
const text = (value, max = 3000) => String(value ?? '').trim().slice(0, max);
export const isPaused = service => Boolean(service.pausedAt && !completed(service) && !cancelled(service));
export function activeWork(state, employeeId, except) {
  return state.services.find(s => s.id !== except && s.employeeId === employeeId && !completed(s) && !cancelled(s) && !isPaused(s));
}
export function applyOperation(state, actor, op, at) {
  if (!['employee','seller'].includes(actor.role) || !uuid(op.id) || !uuid(op.serviceId)) fail('Operação inválida.');
  const data = op.payload || {};
  let service = state.services.find(s => s.id === op.serviceId);
  const event = (action, description = '') => {
    service.history ||= [];
    service.history.push({at,action,description,by:actor.username,operationId:op.id,deviceId:op.deviceId || '',recordedAt:op.createdAt});
    service.updatedAt = at;
  };
  if (op.kind === 'create') {
    if (service) fail('O identificador desta ordem já existe.',409);
    const input = data.items;
    if (!Array.isArray(input) || !input.length || input.length > 50) fail('Adicione de 1 a 50 grupos de equipamentos.');
    const name = text(data.clientName,100), serviceType = text(data.serviceType,100);
    if (name && name.length < 2) fail('Informe um nome de cliente válido.');
    const date = text(data.date,10);
    if (!serviceType || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) fail('Confira o serviço e a data.');
    const email=text(data.clientEmail,254), phone=text(data.clientPhone,30);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('E-mail inválido.');
    if (phone && !/^\+?[\d\s().-]{8,30}$/.test(phone)) fail('Telefone inválido.');
    if (actor.role==='employee' && activeWork(state,actor.id)) fail('Pause ou conclua o serviço em execução antes de iniciar outro.',409);
    const items=[]; let price=0;
    for (const line of input) {
      const type=text(line.type,100),kg=text(line.kg,12),qty=Number(line.qty);
      if (!type || !Number.isInteger(qty) || qty<1 || qty>50 || items.length+qty>100) fail('Confira os equipamentos e as quantidades (máximo de 100).');
      const config=state.types.find(t=>t.name===type && String(t.kg || '')===kg);
      const unitPrice=Number(config?.price) || 0;
      for(let i=0;i<qty;i++) items.push({type,kg,serial:'',unitPrice,status:actor.role==='employee'?'Recebido':'Solicitado',notes:'',replacedParts:[],replacementMedia:{},history:[]});
      price+=qty*unitPrice;
    }
    let retailAmount=null;
    if (String(data.serviceAmount ?? '').trim()!=='') {retailAmount=Number(data.serviceAmount);if (!Number.isFinite(retailAmount)||retailAmount<0||retailAmount>1000000)fail('Valor cobrado do cliente inválido.');}
    service={id:op.serviceId,code:'FS-'+op.serviceId.replace(/-/g,'').slice(-10).toUpperCase(),date,createdAt:at,clientName:name,clientEmail:email,clientPhone:phone,serviceType,notes:text(data.notes),parts:text(data.parts,1000),items,price:Math.round(price*100)/100,basePrice:Math.round(price*100)/100,employeeId:actor.role==='employee'?actor.id:'',employeeName:actor.role==='employee'?actor.name:'',sellerId:actor.role==='seller'?actor.id:'',sellerName:actor.role==='seller'?actor.name:'',registeredBy:actor.name,registeredByRole:actor.role,status:actor.role==='employee'?'Recebido':'Solicitado',nextMaintenanceMonth:`${Number(date.slice(0,4))+1}${date.slice(4,7)}`};
    service.billingVersion=2;service.billingOwner={role:actor.role,id:actor.id,name:actor.name||actor.username};service.retailAmount=retailAmount;
    const internal=teamBase(state,service);service.price=internal.amountCents/100;service.basePrice=service.price;
    if(state.services.some(s=>s.code===service.code))fail('Código já utilizado. A ordem foi preservada para revisão.',409);
    state.services.push(service); event('Ordem registrada','Registro recebido do aparelho.');
    return service;
  }
  if (!service || actor.role!=='employee' || service.employeeId!==actor.id) fail('Ordem não atribuída a este funcionário.',403);
  if (service.closed || cancelled(service)) fail('A ordem foi finalizada ou cancelada. Revise as alterações pendentes.',409);
  if (service.employeeCompletedAt) fail('A execução já foi concluída. O administrador deve revisar a ordem.',409);
  if (op.kind==='pause') {
    if (isPaused(service)) fail('Este serviço já está pausado.',409);
    const reason=text(data.reason,500);
    if(reason.length<3)fail('Informe o motivo da pausa.');
    service.pausedAt=at;service.pauseReason=reason;service.pauseStatus=service.status || service.items[0]?.status || 'Recebido';
    service.status='Pausado';event('Serviço pausado',reason);return service;
  }
  if (op.kind==='resume') {
    if (!isPaused(service)) fail('Este serviço não está pausado.',409);
    if(activeWork(state,actor.id,service.id)) fail('Pause ou conclua o outro serviço antes de retomar este.',409);
    service.status=service.pauseStatus || service.items[0]?.status || 'Recebido';
    service.pauseIntervals ||= [];service.pauseIntervals.push({from:service.pausedAt,to:at,reason:service.pauseReason,by:actor.username});
    service.pausedAt='';service.pauseReason='';event('Serviço retomado');return service;
  }
  if (isPaused(service)) fail('Retome o serviço antes de alterar a execução.',409);
  if(op.kind==='painting') {
    const q=Number(data.quantity);
    if(!Number.isInteger(q)||q<0||q>service.items.length)fail('Quantidade de pinturas inválida.');
    service.paintingQuantity=q;service.paintingRecordedAt=at;service.items.forEach((item,i)=>item.painted=i<q);
    event('Pintura registrada',`${q} equipamento(s).`);
  } else if(op.kind==='stage') {
    const status=text(data.status,80),stages=state.settings.stages || [];
    if(!stages.includes(status)||['Concluído','Solicitado','Aguardando peça'].includes(status))fail('Etapa inválida.');
    service.status=status;service.items.forEach(item=>{item.status=status;item.history ||= [];item.history.push({status,at,by:actor.username})});
    event('Etapa atualizada',status);
  } else if(op.kind==='technical') {
    const index=Number(data.itemIndex), item=service.items[index];
    if(!Number.isInteger(index)||!item)fail('Equipamento não encontrado.');
    const allowed=[...PART_NAMES,...(state.costCatalog || []).filter(x=>x.active!==false&&x.technicalPart).map(x=>x.name)];
    if(!Array.isArray(data.parts)||data.parts.some(p=>!allowed.includes(p)))fail('Peça não cadastrada.');
    const parts=[...new Set(data.parts)],old=item.replacedParts || [];
    for(const part of allowed){if(old.includes(part)===parts.includes(part))continue;const stock=(state.inventory || []).find(x=>x.name===part);if(stock)stock.qty=Math.max(0,Number(stock.qty || 0)+(parts.includes(part)?-1:1))}
    item.notes=text(data.notes);item.replacedParts=parts;
    for(const part of Object.keys(item.replacementMedia || {}))if(!parts.includes(part))delete item.replacementMedia[part];
    event('Dados técnicos registrados',`Equipamento ${index+1}: ${parts.join(', ') || 'sem troca de peças'}.`);
  } else if(op.kind==='media') {
    const index=Number(data.itemIndex),item=service.items[index],part=text(data.part,100);
    if(!Number.isInteger(index)||!item||(item.replacedParts || []).indexOf(part)<0)fail('Registre a peça antes de enviar o vídeo.');
    if(!data.media?.url)fail('Vídeo não recebido.');
    item.replacementMedia ||= {};item.replacementMedia[part]=data.media;event('Vídeo recebido',`Equipamento ${index+1}: ${part}.`);
  } else if(op.kind==='complete') {
    if(!service.paintingRecordedAt)fail('Informe a quantidade de pinturas, inclusive zero.');
    const missing=missingVideos(service);if(missing.length)fail('Vídeos pendentes: '+missing.join('; '));
    service.employeeCompletedAt=at;service.status='Concluído';service.items.forEach(item=>item.status='Concluído');
    event('Execução recebida para revisão','Dados e vídeos recebidos; aguardando aprovação administrativa.');
  } else fail('Operação desconhecida.');
  return service;
}
export function replayLocal(profile, operations, results) {
  const state={services:structuredClone(profile.services || []),types:profile.types || [],settings:profile.settings || {},costCatalog:profile.costCatalog || []};
  for(const op of operations) {
    if(results[op.id]?.ok || results[op.id]?.discarded) continue;
    try {
      // Pending media has a local reference, never represented as a server URL in a request.
      const projected=op.kind==='media'?{...op,payload:{...op.payload,media:{url:'local:'+op.id,durationSeconds:op.payload.durationSeconds}}}:op;
      const service=applyOperation(state,profile.actor,projected,op.createdAt);
      service.localPending=true;
      if(op.kind==='complete')service.localCompleted=true;
    }catch{const service=state.services.find(s=>s.id===op.serviceId);if(service)service.localPending=true}
  }
  return state.services;
}
