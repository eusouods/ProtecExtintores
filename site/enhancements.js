/* Extensões do painel FogoSeguro: sessão persistente, estoque e perfis. */
(() => {
  const tokenKey = window.API_TOKEN_KEY || 'fogoseguro_session';
  const roleKey = 'fogoseguro_role';
  const nameKey = 'fogoseguro_username';
  window.apiCall = function(path, method = 'GET', data = null) {
    const headers = {'Content-Type':'application/json'};
    const token = localStorage.getItem(tokenKey);
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(API_BASE_URL + path, {method, headers, ...(data ? {body:JSON.stringify(data)} : {})});
  };
  window.save = function() {
    saveLocal();
    const token = localStorage.getItem(tokenKey);
    if (!API_ENABLED || !token || localStorage.getItem(roleKey) !== 'admin') return Promise.resolve(true);
    const copy = structuredClone(db); delete copy.settings.password;
    return apiCall('/api/admin/state','PUT',copy).then(async r => {
      const d = await apiJson(r); if (!r.ok) throw Error(d.error || 'Não foi possível salvar');
      if (d.state) { db = d.state; saveLocal(); }
      return true;
    }).catch(e => { toast(e.message || 'Falha ao salvar'); return false; });
  };
  window.logout = function() {
    const token = localStorage.getItem(tokenKey);
    if (API_ENABLED && token) apiCall('/api/logout','POST').catch(()=>{});
    [tokenKey, roleKey, nameKey].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roleKey);
    showStore();
  };
  window.loginPersistente = async function(event) {
    event.preventDefault(); event.stopImmediatePropagation();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const error = document.getElementById('loginError'); error.classList.add('hidden');
    try {
      const response = await apiCall('/api/login','POST',{username,password});
      const data = await apiJson(response); if (!response.ok) throw Error(data.error || 'Usuário ou senha incorretos.');
      localStorage.setItem(tokenKey,data.token); localStorage.setItem(roleKey,data.role); localStorage.setItem(nameKey,data.username || username);
      sessionStorage.removeItem(tokenKey); sessionStorage.removeItem(roleKey);
      if (data.role === 'employee') return renderEmployee(data.username,data.services || []);
      if (data.role === 'seller') return renderSeller(data);
      db = data.state; db.settings.password = ''; saveLocal(); showDashboard();
    } catch (e) { error.textContent = e.message || 'Não foi possível acessar o painel.'; error.classList.remove('hidden'); }
  };
  document.getElementById('loginForm').addEventListener('submit',loginPersistente,true);

  const employeeState = {username:'',services:[],timer:null,known:new Set()};
  function groupEmployeeItems(items) {
    const map = new Map();
    items.forEach((it,index) => {
      const key = `${(it.type||'Extintor').toLowerCase()}|${it.kg||''}`;
      if (!map.has(key)) map.set(key,{type:it.type||'Extintor',kg:it.kg||'',indexes:[],items:[]});
      const group=map.get(key); group.indexes.push(index); group.items.push(it);
    });
    return [...map.values()];
  }
  function renderEmployee(username,services) {
    employeeState.username=username; employeeState.services=services;
    employeeState.known=new Set(services.map(s=>s.id));
    document.getElementById('store').classList.add('hidden'); document.getElementById('login').classList.add('hidden'); document.getElementById('dashboard').classList.add('hidden');
    const root=document.getElementById('employeePortal'); root.className='employee-portal'; root.classList.remove('hidden');
    root.innerHTML=`<header class="employee-top"><b>${esc(db.settings.company||'FogoSeguro')} · Área técnica</b><button class="btn btn-small" onclick="logout()">Sair</button></header><main class="employee-main"><h1>Serviços disponíveis</h1><p>Os serviços livres aparecem para todos. Ao aceitar, ficam atribuídos somente a você.</p><div id="employeeCards"></div></main>`;
    drawEmployeeCards(); refreshEmployee();
    if('Notification' in window && Notification.permission==='default') Notification.requestPermission().catch(()=>{});
    if (employeeState.timer) clearInterval(employeeState.timer); employeeState.timer=setInterval(refreshEmployee,25000);
  }
  function drawEmployeeCards() {
    const host=document.getElementById('employeeCards'); if(!host)return;
    if(!employeeState.services.length){host.innerHTML='<div class="panel config-card">Nenhum serviço disponível no momento.</div>';return;}
    host.innerHTML=employeeState.services.map(service=>{
      const groups=groupEmployeeItems(service.items||[]),assigned=Boolean(service.employeeId);
      return `<article class="employee-service"><header class="employee-service-head"><div><b>${esc(service.code||'Serviço')}</b><div>${esc(service.clientName||'Cliente')} · ${esc(date(service.date))}</div></div><span>${assigned?'Aceito por você':'Disponível'}</span></header><div class="employee-service-body">${groups.map((g,gi)=>`<section class="employee-group"><strong>${esc(g.type)}${g.kg?' · '+esc(g.kg)+' kg':''} <small>× ${g.items.length}</small></strong><label>Status<select ${!assigned?'disabled':''} onchange="updateEmployeeGroup('${esc(service.id)}',${gi},this.value)">${(db.settings.stages||[]).filter(x=>x!=='Concluído').map(st=>`<option ${g.items.every(i=>i.status===st)?'selected':''}>${esc(st)}</option>`).join('')}</select></label><button class="btn btn-small btn-soft" ${!assigned?'disabled':''} onclick="employeeNote('${esc(service.id)}',${gi})">Observação e peças</button></section>`).join('')}</div>${!assigned?`<footer class="panel-actions"><button class="btn" onclick="acceptEmployeeService('${esc(service.id)}')">Aceitar serviço</button></footer>`:''}</article>`;
    }).join('');
  }
  async function refreshEmployee() {
    if(!localStorage.getItem(tokenKey)||localStorage.getItem(roleKey)!=='employee')return;
    try { const r=await apiCall('/api/employee/services'); const d=await apiJson(r); if(r.ok){const latest=d.services||[];for(const s of latest){if(!employeeState.known.has(s.id)&&!s.employeeId&&'Notification'in window&&Notification.permission==='granted')new Notification('Novo serviço disponível',{body:`${s.code} · ${s.clientName||'Cliente'}`});employeeState.known.add(s.id);}employeeState.services=latest;drawEmployeeCards();} } catch {}
  }
  window.acceptEmployeeService=async function(serviceId){try{const r=await apiCall('/api/employee/claim','POST',{serviceId}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Este serviço já foi aceito.');toast('Serviço atribuído a você');await refreshEmployee();}catch(e){toast(e.message)}};
  window.updateEmployeeGroup=async function(serviceId,groupIndex,status){const service=employeeState.services.find(x=>x.id===serviceId),group=service&&groupEmployeeItems(service.items||[])[groupIndex];if(!group)return;try{for(const itemIndex of group.indexes){const r=await apiCall('/api/employee/status','POST',{serviceId,itemIndex,status});const d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível alterar o status.');}group.items.forEach(x=>x.status=status);toast('Status atualizado para os '+group.items.length+' extintores');}catch(e){toast(e.message);refreshEmployee();}};
  window.employeeNote=function(serviceId,groupIndex){const service=employeeState.services.find(x=>x.id===serviceId),group=service&&groupEmployeeItems(service.items||[])[groupIndex];if(!group)return;const parts=['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];const body=`<div class="form-field"><label>Observação técnica</label><textarea name="notes" rows="4">${esc(group.items[0].notes||'')}</textarea></div><h3>Peças substituídas</h3><p class="helper">Selecione a peça e a quantidade. Lacres e etiquetas não são cobrados.</p><div class="employee-parts-picker">${parts.map((part,i)=>`<label>${esc(part)}<select name="part_${i}">${Array.from({length:group.items.length+1},(_,n)=>`<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}</div>`;openModal('Observações e peças · '+group.items.length+' extintores',body,async f=>{const fd=f,notes=val(fd,'notes'),quantities=Object.fromEntries(parts.map((p,i)=>[p,Number(val(fd,'part_'+i))||0]));for(let pos=0;pos<group.indexes.length;pos++){const itemIndex=group.indexes[pos],payload={serviceId,itemIndex,status:group.items[pos].status||'Recebido',notes,partQuantities:quantities,itemIndexes:group.indexes};const r=await apiCall('/api/employee/status','POST',payload),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível salvar observação e peças.');}group.items.forEach((x,pos)=>{x.notes=notes;x.replacedParts=parts.filter(p=>pos<quantities[p]);});toast('Observações e quantidades de peças salvas');});};

  function renderSeller(data) {
    document.getElementById('store').classList.add('hidden'); document.getElementById('login').classList.add('hidden'); document.getElementById('dashboard').classList.add('hidden');
    const root=document.getElementById('employeePortal');root.className='employee-portal';root.classList.remove('hidden');
    root.innerHTML=`<header class="employee-top"><b>${esc(data.settings?.company||'FogoSeguro')} · Área comercial</b><button class="btn btn-small" onclick="logout()">Sair</button></header><main class="employee-main"><h1>Olá, ${esc(data.username)}</h1><p>Use os atalhos para registrar pedidos pela loja e acompanhar o atendimento.</p><div class="seller-shortcuts"><button class="btn" onclick="openSellerStore('products')">Comprar produtos</button><button class="btn" onclick="openSellerStore('service')">Solicitar manutenção</button><button class="btn btn-soft" onclick="openSellerStore('tracking')">Acompanhar serviço</button></div><div class="panel config-card"><h3>Seus pedidos recentes</h3><div>${(data.orders||[]).length?(data.orders||[]).map(o=>`<p><b>${esc(o.code)}</b> · ${esc(o.kind)} · ${esc(o.status)}</p>`).join(''):'Os pedidos que registrar aparecem aqui após atualizar a sessão.'}</div></div></main>`;
  }
  window.openSellerStore=function(tab){document.getElementById('employeePortal').classList.add('hidden');document.getElementById('store').classList.remove('hidden');showPublicPage(tab);};

  // O aceite de serviço aciona aviso nativo quando o navegador já autorizou notificações.
  let knownServiceIds=new Set();
  async function pollAdminNotifications(){if(localStorage.getItem(roleKey)!=='admin'||!localStorage.getItem(tokenKey))return;try{const r=await apiCall('/api/admin/state');if(!r.ok)return;const d=await apiJson(r);const available=(d.services||[]).filter(s=>!s.closed&&!s.employeeId);for(const s of available){if(!knownServiceIds.has(s.id)&&knownServiceIds.size&&'Notification'in window&&Notification.permission==='granted')new Notification('Novo serviço disponível',{body:`${s.code} · ${s.clientName||'Cliente'}`});knownServiceIds.add(s.id);}}catch{}}
  setInterval(pollAdminNotifications,45000);

  const originalServiceTable=window.serviceTable;
  window.serviceTable=function(list){const html=originalServiceTable(list);return html.replace(/(<button class="icon-btn" onclick="serviceOrder\('([^']+)'\)">Ordem de serviço<\/button>)/g,(_,button,id)=>{const item=db.services.find(x=>x.id===id);return button+(item?.closed?' <button class="icon-btn" disabled>Finalizado</button>':` <button class="icon-btn" onclick="finalizeService('${id}')">Finalizar</button>`);});};
  window.finalizeService=async function(serviceId){const s=db.services.find(x=>x.id===serviceId);if(!s)return;const answer=confirm('Finalizar este serviço definitivamente? Esta ação não pode ser desfeita. Antes, preencha em cada extintor o ano da manutenção, número e selo.');if(!answer)return;try{const r=await apiCall('/api/admin/finalize','POST',{serviceId}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível finalizar');db=d.state||db;saveLocal();renderPage();toast('Serviço finalizado');}catch(e){toast(e.message)}};

  window.inventoryPage=function(c){const rows=db.inventory||[];c.innerHTML=`<div class="page-title"><div><h1>Estoque</h1><p>Controle extintores, peças e materiais. Quantidades são selecionadas em lista.</p></div><button class="btn btn-small" onclick="editStock()">＋ Cadastrar item</button></div><div class="panel table-wrap"><table><thead><tr><th>Item</th><th>Categoria</th><th>Quantidade</th><th>Alerta mínimo</th><th>Custo unitário</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr class="${Number(x.qty)<=Number(x.minQty)?'inventory-low':''}"><td>${esc(x.name)}</td><td>${esc(x.category)}</td><td><select aria-label="Quantidade" onchange="changeStock('${esc(x.id)}','qty',this.value)">${Array.from({length:Math.max(101,Number(x.qty||0)+21)},(_,i)=>`<option value="${i}" ${Number(x.qty)===i?'selected':''}>${i}</option>`).join('')}</select> ${esc(x.unit||'un')}</td><td>${x.minQty||0}</td><td>${money(x.unitCost||0)}</td><td><button class="icon-btn" onclick="editStock('${esc(x.id)}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`;};
  window.changeStock=async function(id,key,value){const x=db.inventory.find(i=>i.id===id);if(!x)return;x[key]=Number(value);await save();};
  window.editStock=function(stockId=''){const x=(db.inventory||[]).find(i=>i.id===stockId)||{id:'',name:'',category:'Peças',qty:0,unit:'un',minQty:0,unitCost:0};const body=`<div class="form-grid">${field('Nome do item','name',{required:true,value:x.name})}${field('Categoria','category',{required:true,value:x.category})}${field('Unidade','unit',{required:true,value:x.unit})}${field('Quantidade em estoque','qty',{type:'number',min:0,step:1,value:x.qty})}${field('Estoque mínimo','minQty',{type:'number',min:0,step:1,value:x.minQty})}${field('Custo unitário (R$)','unitCost',{type:'number',min:0,step:'0.01',value:x.unitCost})}</div>`;openModal(stockId?'Editar item':'Cadastrar item',body,async f=>{let item={id:x.id||id(),name:val(f,'name'),category:val(f,'category'),unit:val(f,'unit'),qty:Number(val(f,'qty'))||0,minQty:Number(val(f,'minQty'))||0,unitCost:Number(val(f,'unitCost'))||0};if(x.id)Object.assign(x,item);else(db.inventory=db.inventory||[]).push(item);await save();renderPage();toast('Estoque atualizado')});};
  const oldRenderPage=window.renderPage;
  window.renderPage=function(){if(page==='inventory')return inventoryPage(document.getElementById('content'));return oldRenderPage();};
  const oldGo=window.go;
  window.go=function(p){if(p==='inventory'){page=p;document.querySelectorAll('.side-nav button[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===p));document.getElementById('crumb').textContent='Estoque';return renderPage();}return oldGo(p);};
  function addInventoryNav(){const nav=document.querySelector('.side-nav button[data-page="extinguishers"]')?.parentElement;if(nav&&!document.querySelector('[data-page="inventory"]')){const b=document.createElement('button');b.dataset.page='inventory';b.innerHTML='<span>▣</span><span class="navtext">Estoque</span>';b.onclick=()=>go('inventory');nav.appendChild(b);}}

  const oldUsersPage=window.usersPage;
  window.usersPage=function(c){c.innerHTML=`<div class="page-title"><div><h1>Acessos da equipe</h1><p>Funcionários atualizam os serviços; vendedores acessam a área comercial.</p></div></div><div class="config-grid"><div class="panel config-card"><h3>Novo acesso de funcionário</h3><form onsubmit="createEmployeeUser(event)"><div class="form-field"><label>Funcionário</label><select name="employeeId" required><option value="">Selecione…</option>${db.employees.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div><div class="form-field"><label>Usuário</label><input name="username" minlength="3" required></div><div class="form-field"><label>Senha (mínimo 5 caracteres)</label><input name="password" type="password" minlength="5" required></div><button class="btn btn-small">Criar acesso</button></form><div id="employeeUsers" class="employee-users">Carregando…</div></div><div class="panel config-card"><h3>Novo acesso de vendedor</h3><form onsubmit="createSellerUser(event)"><div class="form-field"><label>Vendedor cadastrado</label><select name="sellerId" required><option value="">Selecione…</option>${(db.sellers||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div><div class="form-field"><label>Usuário</label><input name="username" minlength="3" required></div><div class="form-field"><label>Senha (mínimo 5 caracteres)</label><input name="password" type="password" minlength="5" required></div><button class="btn btn-small">Criar acesso</button></form><div id="sellerUsers" class="employee-users">Carregando…</div></div></div>`;loadEmployeeUsers();loadSellerUsers();};
  window.createSellerUser=async function(e){e.preventDefault();const f=e.target;try{const r=await apiCall('/api/admin/sellers','POST',Object.fromEntries(new FormData(f))),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Erro ao criar usuário');f.reset();loadSellerUsers();toast('Acesso de vendedor criado');}catch(err){toast(err.message)}};
  window.loadSellerUsers=async function(){const host=document.getElementById('sellerUsers');if(!host)return;try{const r=await apiCall('/api/admin/sellers'),data=await apiJson(r);host.innerHTML=data.length?data.map(u=>`<div class="employee-user-row"><div><strong>${esc(u.sellerName)}</strong><small>${esc(u.username)}</small></div><button class="icon-btn" onclick="deleteSellerUser('${esc(u.id)}')">Remover</button></div>`).join(''):'Nenhuma conta criada.';}catch(e){host.textContent=e.message}};
  window.deleteSellerUser=async function(id){if(!confirm('Remover este acesso de vendedor?'))return;const r=await apiCall('/api/admin/sellers?id='+encodeURIComponent(id),'DELETE');if(r.ok)loadSellerUsers();};
  const oldCreateEmployee=window.createEmployeeUser;
  window.createEmployeeUser=async function(e){e.preventDefault();const f=e.target;const data=Object.fromEntries(new FormData(f));data.password=data.password||'';try{const r=await apiCall('/api/admin/users','POST',data),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Erro ao criar usuário');f.reset();loadEmployeeUsers();toast('Acesso de funcionário criado');}catch(err){toast(err.message)}};
  if(window.bootstrap) window.bootstrap=async function(){
    try {const r=await apiCall('/api/public');if(r.ok){const d=await apiJson(r);db.settings={...db.settings,...d.settings};db.products=d.products||db.products;renderPublic();}}catch{}
    addInventoryNav();
    document.getElementById('today').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});syncBrand();renderPublic();document.getElementById('year').textContent=new Date().getFullYear();
    const token=localStorage.getItem(tokenKey);
    if(token&&API_ENABLED){try{const r=await apiCall('/api/session');const d=await apiJson(r);if(!r.ok)throw Error('Sessão expirada');localStorage.setItem(roleKey,d.role);localStorage.setItem(nameKey,d.username||'');if(d.role==='admin'){db=d.state;db.settings.password='';saveLocal();showDashboard();}else if(d.role==='employee'){db.settings={...db.settings,...d.settings};renderEmployee(d.username,d.services||[]);}else renderSeller(d);}catch{localStorage.removeItem(tokenKey);localStorage.removeItem(roleKey);localStorage.removeItem(nameKey);showPublicPage('home');}}
    else showPublicPage('home');
  };
  window.addEventListener('storage',e=>{if(e.key===tokenKey&&!e.newValue){sessionStorage.removeItem(tokenKey);sessionStorage.removeItem(roleKey);showStore();}else if(e.key===tokenKey&&e.newValue&&document.getElementById('dashboard').classList.contains('hidden')){bootstrap();}});

  document.querySelectorAll('.login-note').forEach(n=>n.textContent='Acesso protegido para administrador, funcionários e vendedores.');
  document.querySelectorAll('.side-nav button[data-page="users"]').forEach(b=>{b.querySelector('.navtext').textContent='Acessos da equipe';});
  // Deixa campo de pesos e botões legíveis em telas estreitas.
  document.documentElement.classList.add('fogo-enhanced');
  if(window.bootstrap) bootstrap();
})();
