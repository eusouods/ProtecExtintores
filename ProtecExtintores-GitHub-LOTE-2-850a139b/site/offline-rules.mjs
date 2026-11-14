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
  if(op.kind==='claim'){
    if(!service||actor.role!=='employee'||service.employeeId||completed(service)||cancelled(service))fail('Esta ordem não está disponível para aceitar.',409);
    if(activeWork(state,actor.id,service.id))fail('Pause ou conclua o outro serviço antes de aceitar este.',409);
    service.employeeId=actor.id;service.employeeName=actor.name;service.status='Recebido';service.items.forEach(i=>i.status='Recebido');event('Serviço aceito');return service;
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
  const state={services:structuredClone([...(profile.services || []),...(profile.available||[]).filter(s=>!(profile.services||[]).some(o=>o.id===s.id))]),types:profile.types || [],settings:profile.settings || {},costCatalog:profile.costCatalog || []};
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

// Field-level changes preserve unrelated edits from another device. Arrays of
// equipment are atomic: their positions are meaningful and cannot be merged safely.
export const adminCollections=['employees','sellers','clients','extinguishers','services','products','orders','types','inventory','costCatalog'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o||{},k);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
const unsafe=k=>['__proto__','prototype','constructor'].includes(k);
export function adminChanges(before,after,canonical=false){
 const changes=[];
 function walk(a,b,path){
   if(equal(a,b))return;
   if(plain(a)&&plain(b)){
     for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
       if(unsafe(k)||(!canonical&&(['localPending','localCompleted','__offlineLocal'].includes(k)||path[0]==='settings'&&['password','username'].includes(k)||path[0]==='services'&&k==='finance')))continue;
       walk(a[k],b[k],[...path,k]);
     }return;
   }
   if(!canonical&&path.at(-1)==='history'&&Array.isArray(a)&&Array.isArray(b)&&b.length>=a.length&&equal(a,b.slice(0,a.length))){changes.push({path,append:b.slice(a.length),before:a});return;}
   changes.push({path,before:{exists:a!==undefined,...(a!==undefined?{value:a}:{})},after:{exists:b!==undefined,...(b!==undefined?{value:b}:{})}});
 }
 walk(before.settings||{},after.settings||{},['settings']);
 for(const group of adminCollections){
   const a=before[group]||[],b=after[group]||[];
   for(const id of new Set([...a.map(x=>x.id),...b.map(x=>x.id)])){
     if(typeof id!=='string'||!id||unsafe(id))fail('Cadastro sem identificador válido.');
     const old=a.find(x=>x.id===id),next=b.find(x=>x.id===id);
     if(!canonical&&!old&&next?.finance)fail('Não é possível cadastrar cobrança por edição direta.');
     walk(old,next,[group,id]);
   }
 }
 if(canonical)for(const key of ['__rev','__ts','teamBills'])walk(before[key],after[key],[key]);
 return changes;
}
export function applyAdminChanges(state,changes,{force=false,canonical=false}={}){
 if(!Array.isArray(changes)||changes.length>20000)fail('Conjunto de alterações inválido.');
 const checkKeys=value=>{if(value&&typeof value==='object')for(const key of Object.keys(value)){if(unsafe(key))fail('Campo inválido.');checkKeys(value[key]);}};
 checkKeys(changes);
 for(const change of changes){
   const path=change.path;
   if(!Array.isArray(path)||!path.length||path.length>15||path.some(k=>typeof k!=='string'||!k||unsafe(k)))fail('Campo inválido.');
   const [group,id]=path;
   if(!canonical&&(group!=='settings'&&!adminCollections.includes(group)||group==='settings'&&(path.length<2||['password','username'].includes(id))||adminCollections.includes(group)&&path[2]==='id'||group==='services'&&path.includes('finance')))fail('Campo protegido.');
   let parent=state,key=group;
   if(adminCollections.includes(group)){
     if(path.length<2)fail('Cadastro inválido.');
     state[group]||=[];parent=state[group];key=parent.findIndex(x=>x.id===id);
     if(path.length>2){if(key<0)fail('O cadastro foi removido em outro aparelho.',409);parent=parent[key];}
   }else if(path.length>1){state[group]||={};parent=state[group];}
   for(let i=adminCollections.includes(group)?2:1;i<path.length;i++){
     key=path[i];if(i<path.length-1){if(!plain(parent[key])){if(!force)fail('Este campo foi alterado em outro aparelho.',409);parent[key]={};}parent=parent[key];}
   }
   const current=key===-1?undefined:parent[key];
   if(change.append){
     if(!Array.isArray(current)||!Array.isArray(change.before)||!equal(current.slice(0,change.before.length),change.before))fail('O histórico mudou. Revise esta alteração.',409);
     parent[key]=current.concat(change.append.filter(event=>!current.some(old=>equal(old,event))));continue;
   }
   if(!change.before||!change.after)fail('Alteração inválida.');
   const matches=change.before.exists?equal(current,change.before.value):current===undefined;
   // A previously applied value is safe to acknowledge, including after a lost reply.
   if(!force&&!matches&&!(change.after.exists?equal(current,change.after.value):current===undefined))throw Object.assign(Error('O mesmo campo mudou em outro aparelho. Revise antes de enviar.'),{status:409,conflict:true,field:path.join(' / ')});
   if(!canonical&&group==='services'){
     const service=state.services.find(s=>s.id===id);
     if(path.length===2&&!change.after.exists)fail('Preserve o histórico: arquive a ordem em vez de excluir.');
     if(path.length===2&&!service&&change.after.value?.finance)fail('Cobrança protegida.');
     if(service?.closed&&['items','employeeId','sellerId','billingOwner','closed'].includes(path[2]))fail('Serviço finalizado: dados técnicos e responsáveis são imutáveis.');
   }
   if(Array.isArray(parent)&&path.length===2){if(change.after.exists){if(key<0)parent.push(structuredClone(change.after.value));else parent[key]=structuredClone(change.after.value)}else if(key>=0)parent.splice(key,1);}
   else if(change.after.exists)parent[key]=structuredClone(change.after.value);else delete parent[key];
 }
 return state;
}
