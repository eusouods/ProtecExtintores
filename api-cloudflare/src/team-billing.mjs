import {billingOwner,teamDiscount,servicePolicy,estimateFinance,teamView,cancelled,localDay} from '../../site/service-rules.mjs';
const same=(a,b)=>a?.role===b?.role&&a?.id===b?.id;
export function normalizePixKey(value){
 const raw=String(value||'').trim();if(!raw)throw Error('Cadastre a chave Pix da empresa em Configurações.');
 if(raw.length<=77&&/^[\x21-\x7e]+$/.test(raw)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw))return raw.toLowerCase();
 if(/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(raw))return raw.toLowerCase();
 const key=raw.replace(/[.\s()/\-]/g,'').toUpperCase();
 if(/^\+[1-9]\d{1,14}$/.test(key)||/^\d{11}$/.test(key)||/^[A-Z\d]{12}\d{2}$/.test(key))return key;
 throw Error('Formato de chave Pix não reconhecido. Use CPF, CNPJ, e-mail, telefone com +55 ou chave aleatória cadastrada no banco.');
}
const payer=s=>s.finance?.payer||billingOwner(s);
const pending=s=>s.closed&&s.finance&&!cancelled(s)&&s.finance.payment?.status==='pending';
const owned=(state,owner)=>state.services.filter(s=>same(payer(s),owner));
const groupKey=s=>JSON.stringify([payer(s).role,payer(s).id,s.finance.policy.mode,s.finance.dueDate,s.finance.policy.mode==='completion'?s.id:'weekly']);
export function teamGroups(state,owner,at){
 const map=new Map();
 for(const s of owned(state,owner).filter(s=>pending(s)&&!s.finance.settlementId)){
  const id=groupKey(s);if(!map.has(id))map.set(id,{id,payer:payer(s),policy:s.finance.policy,dueDate:s.finance.dueDate,amountCents:0,orders:[],eligible:s.finance.policy.mode==='completion'||s.finance.dueDate<=localDay(at)});
  const group=map.get(id);group.amountCents+=s.finance.revenueCents;group.orders.push({id:s.id,code:s.code,clientName:s.clientName||'',amountCents:s.finance.revenueCents});
 }
 return [...map.values()].sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
}
function checkBill(state,bill){
 const services=bill.orders.map(line=>state.services.find(s=>s.id===line.id));
 return services.every((s,i)=>s&&pending(s)&&same(payer(s),bill.payer)&&s.finance.settlementId===bill.id&&s.finance.revenueCents===bill.orders[i].amountCents)&&services.reduce((n,s)=>n+s.finance.revenueCents,0)===bill.amountCents;
}
function billView(state,bill){return {id:bill.id,payer:bill.payer,policy:bill.policy,dueDate:bill.dueDate,amountCents:bill.amountCents,orders:bill.orders,status:bill.status==='paid'?'paid':checkBill(state,bill)?'pending':'needs-review',createdAt:bill.createdAt,paidAt:bill.paidAt||'',reference:bill.reference||'',reportedAt:bill.reportedAt||'',reportedReference:bill.reportedReference||'',merchant:bill.merchant};}
function wallet(state,owner,at){
 const person=(state[owner.role==='employee'?'employees':'sellers']||[]).find(p=>p.id===owner.id),orders=owned(state,owner).filter(s=>!cancelled(s));
 const all=orders.filter(s=>s.closed&&s.finance),unpaid=all.filter(pending);
 const open=state.services.filter(s=>!s.closed&&!cancelled(s)&&same(billingOwner(s),owner)).map(s=>{let f;try{f=estimateFinance(state,s)}catch{f={pricingPending:true,revenueCents:0}}return{id:s.id,code:s.code,clientName:s.clientName||'',amountCents:f.revenueCents,pricingPending:f.pricingPending,retailAmount:s.retailAmount??null}});
 return {payer:{...owner,name:person?.name||owner.name},preparedAt:at,pixConfigured:Boolean(state.settings.pixKey&&state.settings.pixCity),discountPercent:teamDiscount(state,owner),policy:servicePolicy(state,{billingOwner:owner}),balanceCents:unpaid.reduce((n,s)=>n+s.finance.revenueCents,0),paidCents:all.filter(s=>s.finance.payment.status==='paid').reduce((n,s)=>n+s.finance.revenueCents,0),groups:teamGroups(state,owner,at),bills:(state.teamBills||[]).filter(b=>same(b.payer,owner)).reverse().map(b=>billView(state,b)),otherPayments:all.filter(s=>s.finance.payment.status==='paid'&&!s.finance.settlementId).map(s=>({code:s.code,amountCents:s.finance.revenueCents,paidAt:s.finance.payment.paidAt,reference:s.finance.payment.reference||''})),openOrders:open};
}
function requireReference(value){const text=String(value||'').trim();if(text.length<3||text.length>300)throw Error('Informe uma referência de pagamento de 3 a 300 caracteres.');return text;}
export async function handleTeamBilling(request,env,context){
 const {auth,readState,saveState,json,now,createPixPayload,pixQrDataUrl}=context,url=new URL(request.url),admin=url.pathname==='/api/admin/team-billing';
 const session=await auth(request,env,admin?'admin':undefined);
 if(!session||admin&&session.role!=='admin'||!admin&&!['employee','seller'].includes(session.role))return json({error:'Acesso não autorizado.'},403);
 const state=await readState(env),at=now(),data=request.method==='POST'?await request.json():{};
 let owner=admin?{role:data.role||url.searchParams.get('role'),id:data.id||url.searchParams.get('id')}:{role:session.role,id:session.employee_id||session.seller_id};
 if(!['employee','seller'].includes(owner.role)||!owner.id)return json({error:'Selecione um funcionário ou vendedor.'},400);
 if(!admin&&((data.role&&data.role!==owner.role)||(data.id&&data.id!==owner.id)))return json({error:'Esta cobrança pertence a outra conta.'},403);
 const person=(state[owner.role==='employee'?'employees':'sellers']||[]).find(p=>p.id===owner.id);
 if(!admin&&(!person||person.active===false))return json({error:'Conta indisponível.'},403);
 owner.name=person?.name||owner.id;
 if(request.method==='GET')return json(wallet(state,owner,at));
 if(request.method!=='POST')return json({error:'Método não permitido.'},405);
 state.teamBills ||= [];
 let bill=data.billId?state.teamBills.find(b=>b.id===data.billId&&same(b.payer,owner)):null;
 if(data.action==='settle'){
  if(!admin)return json({error:'Somente o administrador pode confirmar recebimentos.'},403);
  if(!bill||bill.status==='paid'||!checkBill(state,bill))return json({error:'O acerto mudou ou já foi pago. Atualize a tela.'},409);
  const reference=requireReference(data.reference);
  for(const line of bill.orders){const s=state.services.find(s=>s.id===line.id);s.finance.payment={status:'paid',paidAt:at,by:session.username,reference,batchId:bill.id};s.history ||= [];s.history.push({at,by:session.username,action:'Recebimento do acerto Pix confirmado',description:reference});}
  Object.assign(bill,{status:'paid',paidAt:at,by:session.username,reference});
 }else if(data.action==='report'){
  if(admin||!bill||bill.status!=='pending'||!checkBill(state,bill))return json({error:'Este acerto não está disponível para informar pagamento.'},409);
  Object.assign(bill,{reportedAt:at,reportedBy:session.username,reportedReference:requireReference(data.reference)});
 }else if(data.action==='pix'){
  if(!bill){
   const group=teamGroups(state,owner,at).find(g=>g.id===data.groupId);
   if(!group)return json({error:'As ordens deste acerto mudaram. Atualize a tela.'},409);
   if(!group.eligible)return json({error:'O Pix semanal será liberado no dia de pagamento configurado.'},409);
   if(group.amountCents<=0||group.orders.length>1000)return json({error:'Confira o valor e as ordens deste acerto com o administrador.'},400);
   const id=crypto.randomUUID(),txid='T'+id.replace(/-/g,'').slice(0,24);
   const payload=createPixPayload(state.settings,{code:txid},group.amountCents/100);
   bill={...group,id,txid,payload,status:'pending',merchant:state.settings.company||'ProtecExtintores',createdAt:at,createdBy:session.username};
   delete bill.eligible;state.teamBills.push(bill);
   for(const line of bill.orders){const s=state.services.find(s=>s.id===line.id);s.finance.settlementId=id;s.history ||= [];s.history.push({at,action:'Acerto Pix gerado',description:`Referência ${txid}`,by:session.username});}
  }else if(bill.status!=='pending'||!checkBill(state,bill))return json({error:'Este acerto não está mais disponível para pagamento.'},409);
  if(!data.billId)await saveState(env,state,(await env.DB.prepare('SELECT username FROM admin_auth WHERE id=1').first()).username,{settlement:true,teamBilling:true});
  return json({...billView(state,bill),payload:bill.payload,qr:pixQrDataUrl(bill.payload),txid:bill.txid,confirmation:'manual'});
 }else return json({error:'Ação inválida.'},400);
 await saveState(env,state,(await env.DB.prepare('SELECT username FROM admin_auth WHERE id=1').first()).username,{settlement:true,teamBilling:true});
 return json({ok:true,wallet:wallet(state,owner,at),...(admin?{state:await readState(env)}:{})});
}
