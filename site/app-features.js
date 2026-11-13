/* Módulos funcionais consolidados. Seções SOURCE mantêm a origem para manutenção. */

;/* SOURCE: enhancements.js */
/* Extensões do painel ProtecExtintores: sessão persistente, estoque e perfis. */
(() => {
  const tokenKey = window.API_TOKEN_KEY || 'protecextintores_session';
  const roleKey = 'protecextintores_role';
  const nameKey = 'protecextintores_username';
  if (!localStorage.getItem(tokenKey) && sessionStorage.getItem(tokenKey)) {
    localStorage.setItem(tokenKey,sessionStorage.getItem(tokenKey));
    if(sessionStorage.getItem(roleKey))localStorage.setItem(roleKey,sessionStorage.getItem(roleKey));
  }
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
    const copy = JSON.parse(JSON.stringify(db)); delete copy.settings.password;
    return apiCall('/api/admin/state','PUT',copy).then(async r => {
      const d = await apiJson(r);
      if (r.status === 409) {
        try { const fresh = await apiJson(await apiCall('/api/admin/state')); if (fresh && fresh.products) { db = fresh; saveLocal(); if (typeof renderPage === 'function') renderPage(); } } catch {}
        throw Error(d.error || 'Outra pessoa alterou os dados. Atualizamos a tela; repita a última alteração.');
      }
      if (!r.ok) throw Error(d.error || 'Não foi possível salvar');
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
  window.renderEmployeePortal=renderEmployee;window.renderSellerPortal=renderSeller;
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
  const originalShowLogin=window.showLogin;
  window.showLogin=function(){if(localStorage.getItem(tokenKey)){bootstrap();return;}originalShowLogin();};

  const employeeState = window.employeePortalState = {username:'',services:[],timer:null,known:new Set()};
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
    root.innerHTML=`<header class="employee-top"><b>${esc(db.settings.company||'ProtecExtintores')} · Área técnica</b><div class="employee-header-actions"><button class="btn btn-soft btn-small" onclick="refreshEmployeePortal()">Atualizar</button><button class="btn btn-small" onclick="logout()">Sair da conta</button></div></header><main class="employee-main"><h1>Serviços</h1><p>Aceite atendimentos disponíveis, atualize cada etapa e consulte os que você concluiu.</p><div id="employeeCards"></div></main>`;
    drawEmployeeCards(); refreshEmployee();
    if('Notification' in window && Notification.permission==='default') Notification.requestPermission().catch(()=>{});
    if (employeeState.timer) clearInterval(employeeState.timer); employeeState.timer=setInterval(refreshEmployee,25000);
  }
  function drawEmployeeCards() {
    const host=document.getElementById('employeeCards'); if(!host)return;
    if(!employeeState.services.length){host.innerHTML='<div class="panel config-card">Nenhum serviço disponível no momento.</div>';return;}
    host.innerHTML=employeeState.services.map(service=>{
      const groups=groupEmployeeItems(service.items||[]),assigned=Boolean(service.employeeId);
      return `<article class="employee-service"><header class="employee-service-head"><div><b>${esc(service.code||'Serviço')}</b><div>${esc(service.clientName||'Sem cliente vinculado')} · ${esc(date(service.date))}</div></div><span>${assigned?'Aceito por você':'Disponível'}</span></header><div class="employee-service-body">${groups.map((g,gi)=>`<section class="employee-group"><strong>${esc(g.type)}${g.kg?' · '+esc(g.kg)+' kg':''} <small>× ${g.items.length}</small></strong><label>Status<select ${!assigned?'disabled':''} onchange="updateEmployeeGroup('${esc(service.id)}',${gi},this.value)">${(db.settings.stages||[]).filter(x=>x!=='Concluído').map(st=>`<option ${g.items.every(i=>i.status===st)?'selected':''}>${esc(st)}</option>`).join('')}</select></label><button class="btn btn-small btn-soft" ${!assigned?'disabled':''} onclick="employeeNote('${esc(service.id)}',${gi})">Observação e peças</button></section>`).join('')}</div>${!assigned?`<footer class="panel-actions"><button class="btn" onclick="acceptEmployeeService('${esc(service.id)}')">Aceitar serviço</button></footer>`:''}</article>`;
    }).join('');
  }
  async function refreshEmployee() {
    if(!localStorage.getItem(tokenKey)||localStorage.getItem(roleKey)!=='employee')return;
    try { const r=await apiCall('/api/employee/services'); const d=await apiJson(r); if(r.ok){const latest=d.services||[];for(const s of latest){if(!employeeState.known.has(s.id)&&!s.employeeId&&'Notification'in window&&Notification.permission==='granted')new Notification('Novo serviço disponível',{icon:window.protecBrand.url,body:`${s.code} · ${s.clientName||'Cliente'}`});employeeState.known.add(s.id);}employeeState.services=latest;drawEmployeeCards();} } catch {}
  }
  window.refreshEmployeeAfterCreate=services=>{employeeState.services=services||[];employeeState.known=new Set(employeeState.services.map(s=>s.id));drawEmployeeCards();};window.refreshEmployeePortal=refreshEmployee;
  window.acceptEmployeeService=async function(serviceId){try{const r=await apiCall('/api/employee/claim','POST',{serviceId}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Este serviço já foi aceito.');toast('Serviço atribuído a você');await refreshEmployee();}catch(e){toast(e.message)}};
  window.updateEmployeeGroup=async function(serviceId,groupIndex,status){const service=employeeState.services.find(x=>x.id===serviceId),group=service&&groupEmployeeItems(service.items||[])[groupIndex];if(!group)return;try{for(const itemIndex of group.indexes){const r=await apiCall('/api/employee/status','POST',{serviceId,itemIndex,status});const d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível alterar o status.');}group.items.forEach(x=>x.status=status);toast('Status atualizado para os '+group.items.length+' extintores');}catch(e){toast(e.message);refreshEmployee();}};
  window.employeeNote=function(serviceId,groupIndex){const service=employeeState.services.find(x=>x.id===serviceId),group=service&&groupEmployeeItems(service.items||[])[groupIndex];if(!group)return;const parts=['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];const body=`<div class="form-field"><label>Observação técnica</label><textarea name="notes" rows="4">${esc(group.items[0].notes||'')}</textarea></div><h3>Peças substituídas</h3><p class="helper">Selecione a peça e a quantidade. Registre apenas observações técnicas e peças substituídas.</p><div class="employee-parts-picker">${parts.map((part,i)=>`<label>${esc(part)}<select name="part_${i}">${Array.from({length:group.items.length+1},(_,n)=>`<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}</div>`;openModal('Observações e peças · '+group.items.length+' extintores',body,async f=>{const fd=f,notes=val(fd,'notes'),quantities=Object.fromEntries(parts.map((p,i)=>[p,Number(val(fd,'part_'+i))||0]));for(let pos=0;pos<group.indexes.length;pos++){const itemIndex=group.indexes[pos],payload={serviceId,itemIndex,status:group.items[pos].status||'Recebido',notes,partQuantities:quantities,itemIndexes:group.indexes};const r=await apiCall('/api/employee/status','POST',payload),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível salvar observação e peças.');}group.items.forEach((x,pos)=>{x.notes=notes;x.replacedParts=parts.filter(p=>pos<quantities[p]);});toast('Observações e quantidades de peças salvas');});};

  function renderSeller(data) {
    document.getElementById('store').classList.add('hidden'); document.getElementById('login').classList.add('hidden'); document.getElementById('dashboard').classList.add('hidden');
    const root=document.getElementById('employeePortal');root.className='employee-portal';root.classList.remove('hidden');
    root.innerHTML=`<header class="employee-top seller-top"><div><b>${esc(data.settings?.company||'ProtecExtintores')} · Painel do vendedor</b><small>${esc(data.username)}</small></div><button class="btn btn-small" onclick="logout()">Sair da conta</button></header><main class="employee-main seller-dashboard"><h1>Serviços</h1><p>Acompanhe solicitações feitas pela sua conta, incluindo serviços já finalizados.</p><nav class="seller-service-tabs" aria-label="Serviços do vendedor"><button type="button" data-seller-tab="ordered" onclick="setSellerServicesTab('ordered')">Serviços encomendados</button><button type="button" data-seller-tab="finished" onclick="setSellerServicesTab('finished')">Finalizados</button></nav><section class="panel config-card"><div class="seller-status-head"><div><h2 id="sellerServiceHeading">Serviços encomendados</h2><p>O andamento é atualizado automaticamente.</p></div></div><div id="sellerServices" class="seller-services" aria-live="polite">Carregando serviços…</div></section></main>`;window.sellerPortalState={tab:'ordered',services:[]};window.loadSellerServices();if(window.sellerServicesRefreshTimer)clearInterval(window.sellerServicesRefreshTimer);window.sellerServicesRefreshTimer=setInterval(()=>{if(localStorage.getItem('protecextintores_role')==='seller')window.loadSellerServices?.();},45000);
  }
  window.openSellerStore=function(tab){document.getElementById('employeePortal').classList.add('hidden');document.getElementById('store').classList.remove('hidden');showPublicPage(tab);};

  // O aceite de serviço aciona aviso nativo quando o navegador já autorizou notificações.
  let knownServiceIds=new Set();
  async function pollAdminNotifications(){if(localStorage.getItem(roleKey)!=='admin'||!localStorage.getItem(tokenKey))return;try{const r=await apiCall('/api/admin/state');if(!r.ok)return;const d=await apiJson(r);const available=(d.services||[]).filter(s=>!s.closed&&!s.employeeId);for(const s of available){if(!knownServiceIds.has(s.id)&&knownServiceIds.size&&'Notification'in window&&Notification.permission==='granted')new Notification('Novo serviço disponível',{icon:window.protecBrand.url,body:`${s.code} · ${s.clientName||'Cliente'}`});knownServiceIds.add(s.id);}}catch{}}
  setInterval(pollAdminNotifications,45000);

  const originalServiceTable=window.serviceTable;
  window.serviceTable=function(list){const html=typeof originalServiceTable==='function'?originalServiceTable(list):'<div class="empty">Nenhuma manutenção registrada.</div>';return html.replace(/(<button class="icon-btn" onclick="serviceOrder\('([^']+)'\)">Ordem de serviço<\/button>)/g,(_,button,id)=>{const item=db.services.find(x=>x.id===id);return button+(item?.cancelledAt||item?.status==='Cancelado'?' <button class="icon-btn" disabled>Cancelado</button>':item?.closed?' <button class="icon-btn" disabled>Finalizado</button>':` <button class="icon-btn" onclick="finalizeService('${id}')">Finalizar</button>`);});};
  window.finalizeService=async function(serviceId){const s=db.services.find(x=>x.id===serviceId);if(!s)return;const answer=confirm('Finalizar este serviço definitivamente? Esta ação não pode ser desfeita.');if(!answer)return;try{const r=await apiCall('/api/admin/finalize','POST',{serviceId}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível finalizar');db=d.state||db;saveLocal();(window.renderPage||renderPage)();toast('Serviço finalizado');}catch(e){toast(e.message)}};

  const byType=(items,key='type')=>{const map=new Map();for(const item of items){const value=String(item[key]||item.name||'Outros').trim(),normalized=value.toLocaleLowerCase('pt-BR');if(!map.has(normalized))map.set(normalized,{name:value,items:[]});map.get(normalized).items.push(item);}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));};
  window.extinguishers=function(c){const groups=byType(db.types,'name');c.innerHTML=`<div class="page-title"><div><h1>Extintores</h1><p>Preços de manutenção por tipo; cada peso permanece em sua própria linha.</p></div><button class="btn btn-small" onclick="openExtinguisher()">＋ Adicionar configuração</button></div><div class="panel"><div class="panel-head"><div><h3>Tipos e preços</h3><p>${db.types.length} combinações</p></div></div><div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Peso</th><th>Preço de manutenção</th><th>Ações</th></tr></thead><tbody>${groups.map(g=>`<tr class="type-group"><th colspan="4">${esc(g.name)}</th></tr>${g.items.sort((a,b)=>Number(a.kg||0)-Number(b.kg||0)).map(x=>`<tr><td></td><td>${x.kg?esc(x.kg)+' kg':'—'}</td><td>${money(x.price||0)}</td><td><button class="icon-btn" onclick="editTypePrice('${esc(x.id)}')">Editar preço</button> <button class="icon-btn" onclick="deleteType('${esc(x.id)}')">Remover</button></td></tr>`).join('')}`).join('')}</tbody></table></div></div>`;};
  const oldSettings=window.settings;
  window.settings=function(c){if(typeof oldSettings==='function')oldSettings(c);else{c.innerHTML='<div class="panel config-card"><h1>Configurações</h1><p>Configure a empresa, acessos e catálogo.</p></div>';}const card=[...c.querySelectorAll('.config-card')].find(x=>x.querySelector('h3')?.textContent.includes('Tipos de extintor'));if(card){card.querySelectorAll('.list-line').forEach(x=>x.remove());const form=card.querySelector('form');if(form){const holder=document.createElement('div');holder.className='grouped-type-prices';holder.innerHTML=byType(db.types,'name').map(g=>`<details class="type-price-group" open><summary>${esc(g.name)} <small>${g.items.length} pesos</small></summary>${g.items.sort((a,b)=>Number(a.kg||0)-Number(b.kg||0)).map(t=>`<div class="list-line"><span>${t.kg?esc(t.kg)+' kg':'Sem peso'} · ${money(t.price||0)}</span><span><button class="icon-btn" onclick="editTypePrice('${esc(t.id)}')">Editar preço</button> <button class="icon-btn" onclick="del('types','${esc(t.id)}')">Remover</button></span></div>`).join('')}</details>`).join('');card.insertBefore(holder,form);}}const panel=document.createElement('section');panel.className='panel config-card availability-settings';panel.innerHTML=`<h3>Disponibilidade do site</h3><p>Pause temporariamente as vendas ou os novos pedidos de manutenção. Os dados e cadastros ficam preservados.</p><form onsubmit="saveAvailability(event)"><label class="setting-toggle"><input type="checkbox" name="shopEnabled" ${db.settings.shopEnabled!==false?'checked':''}><span><b>Loja ativa</b><small>${db.settings.shopEnabled===false?'Produtos indisponíveis para venda':'Produtos disponíveis no catálogo'}</small></span></label><label class="setting-toggle"><input type="checkbox" name="servicesEnabled" ${db.settings.servicesEnabled!==false?'checked':''}><span><b>Manutenções ativas</b><small>${db.settings.servicesEnabled===false?'Solicitações pausadas':'Clientes podem solicitar manutenção'}</small></span></label><div class="panel-actions"><button class="btn btn-small">Salvar disponibilidade</button></div></form>`;c.appendChild(panel);};
  window.saveAvailability=async function(event){event.preventDefault();const form=new FormData(event.currentTarget),before={shopEnabled:db.settings.shopEnabled,servicesEnabled:db.settings.servicesEnabled};db.settings.shopEnabled=form.has('shopEnabled');db.settings.servicesEnabled=form.has('servicesEnabled');if(!await save()){Object.assign(db.settings,before);return false;}renderPage();renderPublic();toast('Disponibilidade do site atualizada');};
  const renderPublicAvailability=window.renderPublic;window.renderPublic=function(){renderPublicAvailability();const host=document.getElementById('publicProducts');if(!host)return;let notice=host.querySelector('.store-paused-notice');if(db.settings.shopEnabled===false){if(!notice){notice=document.createElement('p');notice.className='store-paused-notice';notice.textContent='Loja temporariamente indisponível para vendas.';host.prepend(notice);}host.querySelectorAll('[data-product-id]').forEach(button=>{button.disabled=true;button.textContent='Indisponível';});}else{notice?.remove();host.querySelectorAll('[data-product-id]').forEach(button=>{button.disabled=false;const product=db.products.find(item=>item.id===button.dataset.productId);button.textContent=product&&(product.quoteOnly||Number(product.price)<=0)?'Solicitar orçamento':'Adicionar ao carrinho';});}};
  const addToCartAvailability=window.addToCart;window.addToCart=function(productId){if(db.settings.shopEnabled===false){toast('A loja está temporariamente fechada.');return;}return addToCartAvailability(productId);};
  const maintenanceRequestAvailability=window.submitMaintenanceRequest;window.submitMaintenanceRequest=function(event){if(db.settings.servicesEnabled===false){event.preventDefault();toast('As solicitações de manutenção estão temporariamente pausadas.');return;}return maintenanceRequestAvailability(event);};
  window.products=function(c){const groups=byType(db.products,'category');c.innerHTML=`<div class="page-title"><div><h1>Produtos da loja</h1><p>Produtos agrupados por tipo, com cada capacidade e peso separado.</p></div><button class="btn btn-small" onclick="openProduct()">＋ Publicar produto</button></div><div class="panel"><div class="panel-head"><div><h3>Catálogo publicado</h3><p>${db.products.length} produtos em ${groups.length} tipos</p></div><button class="btn btn-soft btn-small" onclick="showStore()">Ver loja ↗</button></div>${db.products.length?`<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Peso</th><th>Modelo</th><th>Preço</th><th>Mídia</th><th>Ações</th></tr></thead><tbody>${groups.map(g=>`<tr class="type-group"><th colspan="6">${esc(g.name)}</th></tr>${g.items.sort((a,b)=>Number(a.kg||0)-Number(b.kg||0)).map(x=>`<tr><td><strong>${esc(x.name)}</strong><small>ID ${esc(x.id)}</small></td><td>${x.kg?esc(x.kg)+' kg':'—'}</td><td>${esc(x.model||'—')}</td><td>${x.quoteOnly||Number(x.price)<=0?'Sob consulta':money(x.price)}</td><td>${x.image?'Imagem':x.video?'Vídeo':'Imagem pendente'}</td><td><button class="icon-btn" onclick="editProduct('${esc(x.id)}')">Editar</button> <button class="icon-btn" onclick="del('products','${esc(x.id)}')">Excluir</button></td></tr>`).join('')}`).join('')}</tbody></table></div>`:'<div class="empty">Nenhum produto publicado.</div>'}</div>`;};

  window.renderPublic=function(){syncBrand();const host=document.getElementById('publicProducts');if(!host)return;const products=db.products||[],categories=[...new Set(products.map(p=>p.category||'Extintores'))];const icon=c=>c==='Placas e sinalização'?'🟩':c==='Hidrantes e mangueiras'?'🧯':c==='Acessórios de prevenção'?'🛡️':'🧯';const card=p=>`<article class="product"><div class="product-image" data-image>${p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:`<div class="placeholder" aria-hidden="true">${icon(p.category)}</div>`}</div><div class="product-body"><h3>${esc(p.name)}</h3><p>${esc(p.description||p.type||'Produto de prevenção contra incêndio')}${p.model?` · ${esc(p.model)}`:''}</p><div class="product-foot"><span class="price">${p.quoteOnly||Number(p.price)<=0?'Sob consulta':money(p.price)}</span><button class="btn btn-small" data-product-id="${esc(p.id)}" onclick="addToCart('${esc(p.id)}')">${p.quoteOnly||Number(p.price)<=0?'Solicitar orçamento':'Adicionar ao carrinho'}</button></div></div></article>`;host.innerHTML=categories.length?categories.map(category=>{const items=products.filter(p=>(p.category||'Extintores')===category);if(category==='Extintores'){const groups=byType(items,'type');return `<section class="store-category" data-category="${esc(category)}"><h2>${esc(category)}</h2><div class="product-grid">${groups.map((g,gi)=>{const variants=[...g.items].sort((a,b)=>Number(a.kg||0)-Number(b.kg||0)),first=variants[0],options=variants.map(p=>`<option value="${esc(p.id)}">${p.kg?esc(p.kg)+' kg':'Sem peso'}${p.model?' · '+esc(p.model):''}</option>`).join('');return `<article class="product product-variant" data-variant-group="${gi}"><div class="product-image" data-image>${first.image?`<img src="${esc(first.image)}" alt="${esc(first.name)}">`:`<div class="placeholder" aria-hidden="true">🧯</div>`}</div><div class="product-body"><h3>${esc(g.name)}</h3><label class="variant-label">Peso / capacidade<select aria-label="Peso ou capacidade" onchange="selectPublicVariant(this)">${options}</select></label><p data-description>${esc(first.description||first.type||'Extintor de prevenção')}${first.kg?` · ${esc(first.kg)} kg`:''}</p><div class="product-foot"><span class="price" data-price>${first.quoteOnly||Number(first.price)<=0?'Sob consulta':money(first.price)}</span><button class="btn btn-small" data-product-id="${esc(first.id)}" onclick="addSelectedVariant(this)">${first.quoteOnly||Number(first.price)<=0?'Solicitar orçamento':'Adicionar ao carrinho'}</button></div></div></article>`}).join('')}</div></section>`}return `<section class="store-category" data-category="${esc(category)}"><h2>${esc(category)}</h2><div class="product-grid">${items.map(card).join('')}</div></section>`}).join(''):'<div class="empty">Em breve, novidades na loja.</div>';updateCartCount();};
  window.selectPublicVariant=function(select){const card=select.closest('.product-variant'),p=db.products.find(x=>x.id===select.value);if(!card||!p)return;card.querySelector('[data-product-id]').dataset.productId=p.id;card.querySelector('[data-price]').textContent=p.quoteOnly||Number(p.price)<=0?'Sob consulta':money(p.price);card.querySelector('[data-product-id]').textContent=p.quoteOnly||Number(p.price)<=0?'Solicitar orçamento':'Adicionar ao carrinho';card.querySelector('[data-description]').textContent=(p.description||p.type||'Extintor de prevenção')+(p.kg?' · '+p.kg+' kg':'')+(p.model?' · '+p.model:'');const media=card.querySelector('[data-image]');media.innerHTML=p.image?`<img src="${esc(p.image)}" alt="${esc(p.name)}">`:p.video?`<video src="${esc(p.video)}" muted controls></video>`:'<div class="placeholder">🧯</div>';};
  window.addSelectedVariant=function(button){addToCart(button.dataset.productId);};

  window.productTypeChanged=function(select,chosen=''){const kg=select.form.elements.kg,type=select.value,water=isWaterExtinguisher(type),weights=[...new Set([...db.types.filter(t=>t.name===type).map(t=>String(t.kg||'')),...db.products.filter(p=>p.type===type).map(p=>String(p.kg||''))])].filter(Boolean).sort((a,b)=>Number(a)-Number(b));kg.disabled=water;kg.required=!water;kg.innerHTML=`<option value="">${water?'Não se aplica':'Selecione o peso'}</option>${weights.map(w=>`<option value="${esc(w)}" ${String(w)===String(chosen)?'selected':''}>${esc(w)} kg</option>`).join('')}`;if(water)kg.value='';suggestProductPrice(kg);};
  window.suggestProductPrice=function(select){const form=select.form,type=form.elements.type.value,weight=select.value,match=db.products.find(p=>p.type===type&&String(p.kg||'')===String(weight||''));if(match)form.elements.price.value=Number(match.price||0).toFixed(2);};
  window.openProduct=function(){const cats=['Extintores','Placas e sinalização','Hidrantes e mangueiras','Acessórios de prevenção'],types=[...new Set(db.types.map(t=>t.name))],body=`<div class="form-grid">${field('Nome do produto','name',{required:true})}<div class="form-field"><label>Categoria</label><select name="category">${cats.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="form-field"><label>Tipo</label><select name="type">${types.map(x=>`<option>${esc(x)}</option>`).join('')}<option>Placa</option><option>Mangueira de hidrante</option><option>Acessório</option></select></div>${field('Peso / capacidade (quando aplicável)','kg')}${field('Modelo','model')}${field('Preço de venda (R$)','price',{type:'number',step:'0.01',min:'0',value:'0'})}${field('Código / SKU','sku')}${field('Descrição','description',{cls:'span2'})}<p class="helper span2">Use preço 0 para exibir “Sob consulta”. Cadastre o preço real antes de confirmar e liberar o Pix.</p><div class="form-field"><label>Imagem do produto</label><label class="upload">Selecionar imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div></div>`;openModal('Publicar produto',body,async f=>{const image=await fileData(f.get('imageFile')),price=Number(val(f,'price'))||0;db.products.push({id:id(),name:val(f,'name'),category:val(f,'category'),type:val(f,'type')||val(f,'category'),kg:val(f,'kg'),model:val(f,'model'),price,quoteOnly:price<=0,sku:val(f,'sku'),description:val(f,'description'),image,video:''});await save();renderPage();renderPublic();toast('Produto publicado');});};
  window.editProduct=function(productId){const p=db.products.find(x=>x.id===productId);if(!p)return;const cats=['Extintores','Placas e sinalização','Hidrantes e mangueiras','Acessórios de prevenção'],body=`<div class="form-grid">${field('Nome do produto','name',{required:true,value:p.name})}<div class="form-field"><label>Categoria</label><select name="category">${cats.map(x=>`<option ${x===(p.category||'Extintores')?'selected':''}>${esc(x)}</option>`).join('')}</select></div>${field('Tipo','type',{value:p.type||''})}${field('Peso / capacidade','kg',{value:p.kg||''})}${field('Modelo','model',{value:p.model||''})}${field('Preço de venda (R$)','price',{type:'number',step:'0.01',min:'0',value:p.price||0})}${field('Código / SKU','sku',{value:p.sku||''})}${field('Descrição','description',{cls:'span2',value:p.description||''})}<div class="form-field span2"><label>Imagem (opcional)</label><label class="upload">Selecionar nova imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div></div>`;openModal('Editar produto',body,async f=>{const price=Number(val(f,'price'))||0;Object.assign(p,{name:val(f,'name'),category:val(f,'category'),type:val(f,'type'),kg:val(f,'kg'),model:val(f,'model'),price,quoteOnly:price<=0,sku:val(f,'sku'),description:val(f,'description')});const image=await fileData(f.get('imageFile'));if(image)p.image=image;await save();renderPage();renderPublic();toast('Produto atualizado');});};
  window.openProduct=function(){const types=[...new Set(db.types.map(t=>t.name))],typeOptions=types.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');const body=`<div class="form-grid">${field('Nome do produto','name',{required:true})}<div class="form-field"><label>Tipo</label><select name="type" required onchange="productTypeChanged(this)"><option value="">Selecione o tipo</option>${typeOptions}</select></div><div class="form-field"><label>Peso (kg)</label><select name="kg" required disabled onchange="suggestProductPrice(this)"><option value="">Selecione o tipo primeiro</option></select></div>${field('Modelo','model')}${field('Preço de venda (R$)','price',{type:'number',step:'0.01',required:true})}${field('Código / SKU','sku')}${field('Descrição','description',{cls:'span2'})}<div class="form-field"><label>Imagem do produto</label><label class="upload">Selecionar imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div><div class="form-field"><label>Vídeo (opcional)</label><label class="upload">Selecionar vídeo<input type="file" hidden accept="video/*" name="videoFile"></label></div></div>`;openModal('Publicar produto',body,async f=>{const type=val(f,'type'),kg=isWaterExtinguisher(type)?'':val(f,'kg');if(!type||(!isWaterExtinguisher(type)&&!kg)){toast('Selecione tipo e peso');return false}const image=await fileData(f.get('imageFile')),video=await fileData(f.get('videoFile'));db.products.push({id:id(),name:val(f,'name'),type,kg,model:val(f,'model'),price:Number(val(f,'price'))||0,sku:val(f,'sku'),description:val(f,'description'),image,video});await save();renderPage();renderPublic();toast('Produto publicado');});};
  window.editProduct=function(productId){const p=db.products.find(x=>x.id===productId);if(!p)return;const types=[...new Set([...db.types.map(t=>t.name),p.type])],weights=[...new Set([...db.types.filter(t=>t.name===p.type).map(t=>String(t.kg||'')),...db.products.filter(x=>x.type===p.type).map(x=>String(x.kg||''))])].filter(Boolean).sort((a,b)=>Number(a)-Number(b)),body=`<div class="form-grid">${field('Nome do produto','name',{required:true,value:p.name})}<div class="form-field"><label>Tipo</label><select name="type" required onchange="productTypeChanged(this)">${types.map(n=>`<option value="${esc(n)}" ${n===p.type?'selected':''}>${esc(n)}</option>`).join('')}</select></div><div class="form-field"><label>Peso (kg)</label><select name="kg" ${isWaterExtinguisher(p.type)?'disabled':''} ${isWaterExtinguisher(p.type)?'':'required'} onchange="suggestProductPrice(this)"><option value="">${isWaterExtinguisher(p.type)?'Não se aplica':'Selecione o peso'}</option>${weights.map(w=>`<option value="${esc(w)}" ${String(p.kg)===w?'selected':''}>${esc(w)} kg</option>`).join('')}</select></div>${field('Modelo','model',{value:p.model})}${field('Preço de venda (R$)','price',{type:'number',step:'0.01',required:true,value:p.price})}${field('Código / SKU','sku',{value:p.sku||''})}${field('Descrição','description',{cls:'span2',value:p.description||''})}<div class="form-field span2"><label>Imagem (opcional)</label><label class="upload">Selecionar nova imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div></div>`;openModal('Editar produto',body,async f=>{const type=val(f,'type'),kg=isWaterExtinguisher(type)?'':val(f,'kg');if(!type||(!isWaterExtinguisher(type)&&!kg)){toast('Selecione tipo e peso');return false}Object.assign(p,{name:val(f,'name'),type,kg,model:val(f,'model'),price:Number(val(f,'price'))||0,sku:val(f,'sku'),description:val(f,'description')});const image=await fileData(f.get('imageFile'));if(image)p.image=image;await save();renderPage();renderPublic();toast('Produto atualizado');});};

  window.inventoryPage=function(c){const rows=db.inventory||[];c.innerHTML=`<div class="page-title"><div><h1>Estoque</h1><p>Controle extintores, peças e materiais. Quantidades são selecionadas em lista.</p></div><button class="btn btn-small" onclick="editStock()">＋ Cadastrar item</button></div><div class="panel table-wrap"><table><thead><tr><th>Item</th><th>Categoria</th><th>Quantidade</th><th>Alerta mínimo</th><th>Custo unitário</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr class="${Number(x.qty)<=Number(x.minQty)?'inventory-low':''}"><td><span class="product-reference-label">${window.protecArtwork.artwork(x,'tiny')}<span>${esc(x.name)}</span></span></td><td>${esc(x.category)}</td><td><select aria-label="Quantidade" onchange="changeStock('${esc(x.id)}','qty',this.value)">${Array.from({length:Math.max(101,Number(x.qty||0)+21)},(_,i)=>`<option value="${i}" ${Number(x.qty)===i?'selected':''}>${i}</option>`).join('')}</select> ${esc(x.unit||'un')}</td><td>${x.minQty||0}</td><td>${money(x.unitCost||0)}</td><td><button class="icon-btn" onclick="editStock('${esc(x.id)}')">Editar</button></td></tr>`).join('')}</tbody></table></div>`;};
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
  let bootstrapPromise=null;
  function showSessionRestoreError(){
    if(window.offlineServices?.ready && document.querySelector('#employeePortal:not(.hidden)'))return;
    let notice=document.getElementById('sessionRestoreNotice');
    if(!notice){
      notice=document.createElement('div');notice.id='sessionRestoreNotice';
      notice.setAttribute('role','status');
      notice.style.cssText='position:fixed;z-index:30;left:50%;bottom:20px;transform:translateX(-50%);width:min(520px,calc(100% - 32px));padding:16px 18px;background:var(--ui-panel,#f9fcff);color:var(--ui-text,#20374a);border:1px solid var(--ui-border,#c5d8e6);border-radius:12px;box-shadow:0 12px 36px rgb(var(--ui-scrim-rgb,17 14 12) / 0.267);font:14px Nunito,system-ui,sans-serif';
      document.body.appendChild(notice);
    }
    notice.innerHTML='<div style="font-weight:700;margin-bottom:6px">Não foi possível confirmar sua sessão agora.</div><div style="color:var(--ui-text,#20374a);font-size:12px;margin-bottom:12px">Seu acesso foi mantido. Confira a conexão e tente novamente.</div><button type="button" class="btn btn-small" id="retrySessionRestore">Tentar novamente</button>';
    document.getElementById('retrySessionRestore').onclick=()=>{notice.remove();bootstrap();};
  }
  if(window.bootstrap) window.bootstrap=async function(){
    if(bootstrapPromise)return bootstrapPromise;
    bootstrapPromise=(async()=>{
      try {const r=await apiCall('/api/public');if(r.ok){const d=await apiJson(r);db.settings={...db.settings,...d.settings};db.products=d.products||db.products;renderPublic();}}catch{}
      addInventoryNav();
      document.getElementById('today').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});syncBrand();renderPublic();document.getElementById('year').textContent=new Date().getFullYear();
      const token=localStorage.getItem(tokenKey);
      if(!token||!API_ENABLED){showPublicPage('home');return;}
      try{
        const r=await apiCall('/api/session');
        if(r.status===401){
          [tokenKey,roleKey,nameKey].forEach(k=>localStorage.removeItem(k));
          sessionStorage.removeItem(tokenKey);sessionStorage.removeItem(roleKey);
          showPublicPage('home');return;
        }
        if(!r.ok)throw Error('A API está temporariamente indisponível (HTTP '+r.status+').');
        const d=await apiJson(r);
        if(!['admin','employee','seller'].includes(d.role))throw Error('A resposta da sessão não é válida.');
        localStorage.setItem(roleKey,d.role);localStorage.setItem(nameKey,d.username||'');
        if(d.role==='admin'){
          if(!d.state)throw Error('A API não retornou os dados do painel.');
          db=d.state;db.settings.password='';saveLocal();showDashboard();
        }else if(d.role==='employee'){
          db.settings={...db.settings,...d.settings};renderEmployee(d.username,d.services||[]);
        }else renderSeller(d);
        document.getElementById('sessionRestoreNotice')?.remove();
      }catch(error){
        showPublicPage('home');showSessionRestoreError();
      }
    })().finally(()=>{bootstrapPromise=null;});
    return bootstrapPromise;
  };
  window.addEventListener('storage',e=>{if(e.key===tokenKey&&!e.newValue){sessionStorage.removeItem(tokenKey);sessionStorage.removeItem(roleKey);showStore();}else if(e.key===tokenKey&&e.newValue&&document.getElementById('dashboard').classList.contains('hidden')){bootstrap();}});

  document.querySelectorAll('.login-note').forEach(n=>n.textContent='Acesso protegido para administrador, funcionários e vendedores.');
  document.querySelectorAll('.side-nav button[data-page="users"]').forEach(b=>{b.querySelector('.navtext').textContent='Acessos da equipe';});
  // Deixa campo de pesos e botões legíveis em telas estreitas.
  // Fluxo de ordem e status compartilhado por todos os extintores do serviço.
  const stageList=()=>db.settings.stages||['Solicitado','Recebido','Em manutenção','Aguardando peça','Pintando','Inspeção final','Concluído'];
  document.getElementById('homeExtinguisherDecor')?.remove();
  const stageOf=service=>serviceStatus(service)||stageList()[0];
  const nextStage=service=>typeof employeeNextStage==='function'?employeeNextStage(service):(()=>{const stages=stageList(),index=stages.indexOf(stageOf(service));return index<0?stages[1]||stages[0]:stages[Math.min(index+1,stages.length-1)];})();
  const originalOpenService=window.openService;
  window.openService=function(){originalOpenService();const form=document.getElementById('editForm');if(!form)return;const helper=[...form.querySelectorAll('.helper')].find(x=>x.textContent.includes('Número do extintor'));if(helper)helper.textContent='* Obrigatório. Informe um cliente ou um vendedor; tipo, peso quando aplicável, quantidade, serviço e data também são obrigatórios.';for(const label of form.querySelectorAll('.form-field label')){const input=label.parentElement.querySelector('input,select,textarea');if(input?.required||['clientId','sellerId'].includes(input?.name))label.insertAdjacentHTML('beforeend',' <span class="required-mark" aria-label="obrigatório">*</span>');}};
  window.advanceServiceStage=async function(serviceId){const service=db.services.find(x=>x.id===serviceId);if(!service)return;const stages=stageList(),current=stageOf(service),index=stages.indexOf(current);if(index>=stages.length-1){toast('Este serviço já está na última etapa.');return;}const next=stages[index+1];if(next==='Recebido'){toast('Somente um funcionário pode marcar o serviço como Recebido.');return;}const before=JSON.parse(JSON.stringify(service)),at=new Date().toISOString();service.status=next;service.items=serviceItems(service);for(const item of service.items){item.status=next;item.history||=[];item.history.push({status:next,at});delete item.lacre;delete item.labelNumber;}service.history||=[];service.history.push({at,action:'Etapa da manutenção atualizada',description:'Status do serviço atualizado para '+next+'.'});if(!await save()){Object.assign(service,before);saveLocal();return false;}renderPage();toast('Status atualizado: '+next);};
  window.serviceTable=function(list){return list.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Extintores</th><th>Funcionário</th><th>Validade</th><th>Acompanhamento</th><th>Ações</th></tr></thead><tbody>${list.map(s=>{const groups=groupExtinguishers(serviceItems(s)),status=stageOf(s),next=nextStage(s),done=stageList().indexOf(status)>=stageList().length-1;return `<tr><td>${date(s.date)}</td><td><strong>${esc(s.clientName||'Sem cliente vinculado')}</strong><small>${esc(s.serviceType||'Serviço interno')}</small></td><td>${groups.map(g=>`<div>${esc(g.type)}${g.kg&&!isWaterExtinguisher(g.type)?' · '+esc(g.kg)+' kg':''} <b>× ${g.items.length}</b></div>`).join('')}</td><td>${esc(s.employeeName||'—')}</td><td>${s.maintenanceValid?esc(s.maintenanceValid.slice(0,4)):'—'}</td><td><span class="status">${esc(status)}</span><br><small>${esc(s.code||'')}</small><br><small>ID ${esc(s.id)}</small></td><td><button class="icon-btn" ${done||next==='Recebido'?'disabled':''} title="${next==='Recebido'?'Somente funcionário pode marcar como recebido.':''}" onclick="advanceServiceStage('${esc(s.id)}')">${done?'Serviço concluído':next==='Recebido'?'Aguardando funcionário':'Avançar para '+esc(next)}</button> <button class="icon-btn" onclick="serviceHistory('${s.id}')">Histórico</button> <button class="icon-btn" onclick="serviceOrder('${s.id}')">Ordem de serviço</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">Nenhuma manutenção registrada. Comece criando seu primeiro serviço.</div>';};
  window.manageProcess=function(serviceId){window.advanceServiceStage(serviceId);};
  const originalSave=window.save;window.save=async function(){(db.services||[]).forEach(s=>(s.items||[]).forEach(item=>{delete item.lacre;delete item.labelNumber;}));return originalSave();};
  function employeeNextStage(service){const stages=(db.settings.stages||[]).filter(x=>x!=='Concluído'),status=service.items?.[0]?.status||stages[0]||'Solicitado',index=stages.indexOf(status),workflow=service.workflow||{};const find=name=>stages.find(x=>x.toLowerCase()===name.toLowerCase())||'';if(status==='Em manutenção'){if(workflow.needsParts)return find('Aguardando peça')||find('Inspeção final');if(workflow.needsPainting)return find('Pintando')||find('Inspeção final');return find('Inspeção final')||stages[index+1]||status;}if(status==='Aguardando peça'&&!workflow.needsPainting)return find('Inspeção final')||stages[index+1]||status;if(status==='Pintando')return find('Inspeção final')||stages[index+1]||status;return stages[index+1]||status;}
  drawEmployeeCards=function(){const host=document.getElementById('employeeCards');if(!host)return;if(!employeeState.services.length){host.innerHTML='<div class="panel config-card">Nenhum serviço disponível no momento.</div>';return;}host.innerHTML=employeeState.services.map(service=>{const groups=groupEmployeeItems(service.items||[]),assigned=Boolean(service.employeeId),stages=(db.settings.stages||[]).filter(x=>x!=='Concluído'),status=service.items?.[0]?.status||stages[0]||'Solicitado',next=employeeNextStage(service);return `<article class="employee-service"><header class="employee-service-head"><div><b>${esc(service.code||'Serviço')}</b><div>${esc(service.clientName||'Sem cliente vinculado')} · ${esc(date(service.date))}</div></div><span>${assigned?'Aceito por você':'Disponível'}</span></header><div class="employee-service-body">${groups.map((g,gi)=>`<section class="employee-group"><strong>${esc(g.type)}${g.kg?' · '+esc(g.kg)+' kg':''} <small>× ${g.items.length}</small></strong><button class="btn btn-small btn-soft" ${!assigned?'disabled':''} onclick="employeeNote('${esc(service.id)}',${gi})">Observação e peças</button></section>`).join('')}</div>${assigned?`<footer class="panel-actions"><span class="employee-status-label">Status atual: <b>${esc(status)}</b></span><button class="btn btn-small" ${!next||next===status?'disabled':''} onclick="advanceEmployeeService('${esc(service.id)}','${esc(next||status)}')">${next&&next!==status?'Avançar para '+esc(next):'Etapa final'}</button></footer>`:`<footer class="panel-actions"><button class="btn" onclick="acceptEmployeeService('${esc(service.id)}')">Aceitar serviço</button></footer>`}</article>`;}).join('');};
  window.advanceEmployeeService=async function(serviceId,status){const service=employeeState.services.find(s=>s.id===serviceId);if(!service)return;const current=service.items?.[0]?.status||'';if(current==='Em manutenção'&&!service.workflow){const body='<p class="helper">Antes de avançar, informe o que este serviço realmente precisa. As opções que não forem necessárias serão puladas.</p><div class="workflow-choice"><label><input type="checkbox" name="needsParts"> Precisa de peça ou componente</label><label><input type="checkbox" name="needsPainting"> Precisa de pintura</label></div>';return openModal('Como seguir com este serviço?',body,async form=>{const workflow={needsParts:Boolean(form.get('needsParts')),needsPainting:Boolean(form.get('needsPainting'))},next=workflow.needsParts?'Aguardando peça':workflow.needsPainting?'Pintando':'Inspeção final';service.workflow=workflow;return advanceEmployeeServiceWithWorkflow(service,next,workflow);},'Continuar');}return advanceEmployeeServiceWithWorkflow(service,status,service.workflow||null);};
  async function advanceEmployeeServiceWithWorkflow(service,status,workflow){const indexes=(service.items||[]).map((_,i)=>i),previousWorkflow=service.workflow;try{for(const itemIndex of indexes){const r=await apiCall('/api/employee/status','POST',{serviceId:service.id,itemIndex,itemIndexes:indexes,status,workflow}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível atualizar o serviço.');}service.items.forEach(item=>{item.status=status;item.history||=[];item.history.push({status,at:new Date().toISOString()});});if(workflow)service.workflow=workflow;toast('Status do serviço atualizado para '+status);drawEmployeeCards();}catch(e){if(workflow){if(previousWorkflow)service.workflow=previousWorkflow;else delete service.workflow;}toast(e.message);refreshEmployee();return false;}}
  const originalEmployeeNote=window.employeeNote;window.employeeNote=function(serviceId,groupIndex){originalEmployeeNote(serviceId,groupIndex);const helper=[...document.querySelectorAll('#editForm .helper')].find(x=>x.textContent.includes('Lacres'));if(helper)helper.textContent='Registre apenas observações técnicas e peças substituídas.';};
  const employeeFinished=service=>Boolean(service.closed)||(service.items?.length>0&&service.items.every(item=>item.status==='Concluído'));
  window.setEmployeeTab=function(tab){employeeState.tab=tab;drawEmployeeCards();};
  drawEmployeeCards=function(){const host=document.getElementById('employeeCards');if(!host)return;const services=employeeState.services||[],active=services.filter(s=>!employeeFinished(s)),finished=services.filter(employeeFinished),activeMine=active.some(s=>Boolean(s.employeeId)),tab=employeeState.tab||'active';const card=(service,done=false)=>{const groups=groupEmployeeItems(service.items||[]),assigned=Boolean(service.employeeId),stages=(db.settings.stages||[]).filter(x=>x!=='Concluído'),status=service.items?.[0]?.status||stages[0]||'Solicitado',next=employeeNextStage(service);return `<article class="employee-service ${done?'is-complete':''}"><header class="employee-service-head"><div><b>${esc(service.code||'Serviço')}</b><div>${esc(service.clientName||'Sem cliente vinculado')} · ${esc(date(service.date))}</div></div><span>${done?'Concluído':assigned?'Em andamento':'Disponível'}</span></header><div class="employee-service-body">${groups.map((g,gi)=>`<section class="employee-group"><strong>${esc(g.type)}${g.kg?' · '+esc(g.kg)+' kg':''} <small>× ${g.items.length}</small></strong>${done?`<span class="employee-complete-note">Serviço finalizado</span>`:`<button class="btn btn-small btn-soft" ${!assigned?'disabled':''} onclick="employeeNote('${esc(service.id)}',${gi})">Observação e peças</button>`}</section>`).join('')}</div>${done?`<footer class="panel-actions"><span class="employee-status-label">Concluído em ${esc(date(service.closedAt||service.date))}</span></footer>`:assigned?`<footer class="panel-actions"><span class="employee-status-label">Status: <b>${esc(status)}</b></span><button class="btn btn-small" ${!next||next===status?'disabled':''} onclick="advanceEmployeeService('${esc(service.id)}','${esc(next||status)}')">${next&&next!==status?'Avançar para '+esc(next):'Etapa final'}</button></footer>`:`<footer class="panel-actions"><button class="btn" ${activeMine?'disabled':''} onclick="acceptEmployeeService('${esc(service.id)}')">${activeMine?'Finalize o serviço atual':'Aceitar serviço'}</button></footer>`}</article>`;};host.innerHTML=`<div class="employee-tabs" role="tablist"><button class="${tab==='active'?'active':''}" onclick="setEmployeeTab('active')">Em processo <span>${active.length}</span></button><button class="${tab==='finished'?'active':''}" onclick="setEmployeeTab('finished')">Concluídos <span>${finished.length}</span></button></div>${tab==='active'?`<section class="employee-tab-panel"><div class="employee-section-intro"><h2>Serviços em processo</h2><p>Aceite um serviço disponível e conclua uma etapa por vez.</p></div>${active.length?active.map(s=>card(s)).join(''):'<div class="panel config-card">Nenhum serviço em processo.</div>'}</section>`:`<section class="employee-tab-panel"><div class="employee-section-intro"><h2>Serviços concluídos</h2><p>Histórico dos atendimentos finalizados por você.</p></div>${finished.length?finished.map(s=>card(s,true)).join(''):'<div class="panel config-card">Nenhum serviço concluído ainda.</div>'}</section>`}`;};
  drawEmployeeCards=function(){
    if(window.offlineServices?.ready && window.renderEmployeeWorkbench){window.renderEmployeeWorkbench();return;}
    const host=document.getElementById('employeeCards');if(!host)return;
    const services=employeeState.services||[],active=services.filter(s=>!employeeFinished(s)),finished=services.filter(employeeFinished),tab=employeeState.tab||'active',activeMine=active.some(s=>Boolean(s.employeeId));
    const card=service=>{const done=employeeFinished(service),assigned=Boolean(service.employeeId),groups=groupEmployeeItems(service.items||[]),status=service.items?.[0]?.status||'Solicitado',next=employeeNextStage(service),searchText=[service.code,service.clientName,service.serviceType,...(service.items||[]).map(item=>item.type+' '+item.kg)].join(' ').toLocaleLowerCase('pt-BR');return `<article class="employee-service ${done?'is-complete':''}" data-employee-search="${esc(searchText)}"><header class="employee-service-head"><div><b>${esc(service.code||'Serviço')}</b><div>${esc(service.clientName||'Sem cliente vinculado')} · ${esc(date(service.date))}</div></div><span>${done?'Concluído':assigned?'Em andamento':'Disponível'}</span></header><div class="employee-service-body">${groups.map((group,index)=>`<section class="employee-group"><strong>${esc(group.type)}${group.kg?' · '+esc(group.kg)+' kg':''} <small>× ${group.items.length}</small></strong>${done?`<span class="employee-complete-note">Etapa finalizada</span>`:`<span class="employee-status-label">${esc(group.items[0]?.status||status)}</span><button class="btn btn-small btn-soft" ${!assigned?'disabled':''} onclick="employeeNote('${esc(service.id)}',${index})">Observação, peças e evidências</button>`}</section>`).join('')}</div>${done?`<footer class="panel-actions"><span class="employee-status-label">Concluído em ${esc(date(service.closedAt||service.date))}</span></footer>`:assigned?`<footer class="panel-actions"><span class="employee-status-label">Responsável: ${esc(service.employeeName||'você')} · ${esc(status)}</span><button class="btn btn-small" ${!next||next===status?'disabled':''} onclick="advanceEmployeeService('${esc(service.id)}')">Atualizar andamento</button></footer>`:`<footer class="panel-actions"><button class="btn" ${activeMine?'disabled':''} onclick="acceptEmployeeService('${esc(service.id)}')">${activeMine?'Conclua o serviço atual':'Aceitar serviço'}</button></footer>`}</article>`;};
    const list=tab==='finished'?finished:active;
    host.innerHTML=`<div class="employee-tabs" role="tablist" aria-label="Filtro de serviços"><button type="button" role="tab" aria-selected="${tab==='active'}" class="${tab==='active'?'active':''}" onclick="setEmployeeTab('active')">Em processo <span>${active.length}</span></button><button type="button" role="tab" aria-selected="${tab==='finished'}" class="${tab==='finished'?'active':''}" onclick="setEmployeeTab('finished')">Concluídos <span>${finished.length}</span></button></div><div class="employee-service-tools"><label for="employeeServiceSearch">Buscar por código, cliente ou extintor</label><input id="employeeServiceSearch" type="search" autocomplete="off" placeholder="Ex.: código ou cliente" value="${esc(employeeState.search||'')}" oninput="setEmployeeSearch(this.value)"></div><section class="employee-tab-panel"><div class="employee-section-intro"><h2>${tab==='finished'?'Serviços concluídos':'Serviços em processo'}</h2><p>${tab==='finished'?'Histórico dos atendimentos finalizados por você.':'Aceite um serviço disponível e atualize o andamento até concluir.'}</p></div>${list.length?list.map(card).join(''):`<div class="panel config-card">${tab==='finished'?'Você ainda não concluiu serviços.':'Nenhum serviço em processo no momento.'}</div>`}</section>`;
    window.setEmployeeSearch(employeeState.search||'');
  };
  window.setEmployeeSearch=function(value){const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR'),query=normalize(value),host=document.getElementById('employeeCards'),cards=[...(host?.querySelectorAll('[data-employee-search]')||[])];employeeState.search=String(value||'');let visible=0;cards.forEach(card=>{card.hidden=!normalize(card.dataset.employeeSearch).includes(query);if(!card.hidden)visible++;});let empty=host?.querySelector('#employeeSearchEmpty');if(query&&cards.length&&!visible){if(!empty){empty=document.createElement('div');empty.id='employeeSearchEmpty';empty.className='panel config-card';empty.textContent='Nenhum serviço corresponde à busca.';host.appendChild(empty);}}else empty?.remove();};
  window.advanceEmployeeService=async function(serviceId){const choiceRoot=document.getElementById('modalRoot');choiceRoot.innerHTML=`<div class="modal-back"><section class="modal"><header class="modal-head"><h2>O serviço está completo?</h2><button class="icon-btn" onclick="closeModal()" aria-label="Fechar">×</button></header><div class="modal-body"><p>Confirme se todos os extintores deste serviço foram atendidos.</p></div><footer class="modal-actions"><button class="btn btn-soft" onclick="closeModal()">Cancelar</button><button class="btn btn-soft" onclick="chooseEmployeeNextStep('${esc(serviceId)}')">Não, continuar</button><button class="btn" onclick="completeEmployeeService('${esc(serviceId)}')">Sim, concluir</button></footer></section></div>`;};
  window.chooseEmployeeNextStep=function(serviceId){window.toast('Abra Quantidade de pinturas no serviço.');};
  window.setEmployeeServiceStatus=async function(serviceId,status){try{const services=employeeState.services||[],service=services.find(s=>s.id===serviceId),items=service?.items||[];for(let i=0;i<items.length;i++){const r=await apiCall('/api/employee/status','POST',{serviceId,itemIndex:i,status}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível atualizar o status.');}closeModal();toast('Status atualizado para '+status);await refreshEmployee();}catch(error){toast(error.message);}};
  window.completeEmployeeService=async function(serviceId){try{const r=await apiCall('/api/employee/complete','POST',{serviceId}),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível concluir o serviço.');closeModal();toast('Concluído. O administrador foi avisado para revisar e finalizar.');await refreshEmployee();}catch(error){toast(error.message);}};
  document.documentElement.classList.add('fogo-enhanced');
  if(window.bootstrap){window.addEventListener('protec-offline-ready',()=>bootstrap(),{once:true});setTimeout(()=>{if(!window.protecOfflineLoaded)bootstrap()},8000);}
})();
window.togglePublicMenu=function(button){const nav=document.getElementById('publicNav');if(!nav)return;const open=nav.classList.toggle('is-open');button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');};
window.closePublicMenu=function(){const nav=document.getElementById('publicNav'),button=document.querySelector('.menu-toggle');if(nav)nav.classList.remove('is-open');if(button){button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Abrir menu');}};
window.renderSellerServicesList=function(){const host=document.getElementById('sellerServices'),state=window.sellerPortalState||{tab:'ordered',services:[]};if(!host)return;const finished=service=>Boolean(service.closed||service.status==='Concluído'),list=(state.services||[]).filter(service=>state.tab==='finished'?finished(service):!finished(service));document.querySelectorAll('[data-seller-tab]').forEach(button=>button.classList.toggle('active',button.dataset.sellerTab===state.tab));const heading=document.getElementById('sellerServiceHeading');if(heading)heading.textContent=state.tab==='finished'?'Finalizados':'Serviços encomendados';host.innerHTML=list.length?list.map(service=>`<article class="seller-service-status"><header><div><strong>${esc(service.code||'Serviço')}</strong><small>${esc(date(service.date))} · ${esc(service.clientName||'Sem cliente vinculado')}</small></div><span class="status ${finished(service)?'success':'warn'}">${esc(finished(service)?'Finalizado':service.status)}</span></header><p>${esc(service.serviceType||'Manutenção')} · ${(service.items||[]).length} extintor(es)${service.employeeName?' · Responsável: '+esc(service.employeeName):''}</p><div class="seller-service-items">${(service.items||[]).map(item=>`<span>${esc(item.type)}${item.kg?' · '+esc(item.kg)+' kg':''}: <b>${esc(item.status)}</b></span>`).join('')}</div><button type="button" class="btn btn-soft btn-small" onclick="openSellerServiceTracking('${esc(service.id)}')">Acompanhar serviço</button></article>`).join(''):`<div class="empty">${state.tab==='finished'?'Nenhum serviço finalizado até agora.':'Nenhum serviço encomendado por esta conta.'}</div>`;};
window.setSellerServicesTab=function(tab){if(!['ordered','finished'].includes(tab))return;if(!window.sellerPortalState)window.sellerPortalState={tab:'ordered',services:[]};window.sellerPortalState.tab=tab;window.renderSellerServicesList();};
window.openSellerServiceTracking=function(id){const service=(window.sellerPortalState?.services||[]).find(item=>item.id===id);if(!service)return;const events=(service.events||[]).map(event=>`<article class="seller-tracking-event"><small>${esc(event.at?new Date(event.at).toLocaleString('pt-BR'):'')}</small><b>${esc(event.status)}</b><span>${esc(event.item||'Serviço')}</span></article>`).join('');const items=(service.items||[]).map(item=>`<li>${esc(item.type)}${item.kg?' · '+esc(item.kg)+' kg':''}: <b>${esc(item.status)}</b></li>`).join('');openModal('Acompanhamento · '+esc(service.code),`<div class="seller-tracking-summary"><span class="status ${service.closed?'success':'warn'}">${esc(service.closed?'Finalizado':service.status)}</span><p>${esc(service.serviceType)} · ${esc(service.employeeName||'Aguardando responsável')}</p></div><h3>Andamento</h3><div class="seller-tracking-timeline">${events||'<p class="empty">Nenhuma atualização adicional foi registrada.</p>'}</div><h3>Extintores</h3><ul>${items||'<li>Sem itens detalhados.</li>'}</ul>`,()=>true,'Fechar');};
window.loadSellerServices=async function(){const host=document.getElementById('sellerServices');if(!host)return;host.innerHTML='<p class="helper">Atualizando serviços…</p>';try{const response=await apiCall('/api/seller/services'),data=await apiJson(response);if(!response.ok)throw Error(data.error||'Falha ao consultar seus serviços.');window.sellerPortalState||={tab:'ordered',services:[]};window.sellerPortalState.services=data.services||[];window.renderSellerServicesList();}catch(error){host.innerHTML='<div class="empty" role="alert">'+esc(error.message||'Não foi possível carregar seus serviços.')+'</div>';}};
  const sellerStyle=document.createElement('style');sellerStyle.textContent='.seller-status-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.seller-service-status{padding:15px 0;border-top:1px solid var(--line)}.seller-service-status header{display:flex;justify-content:space-between;gap:12px;align-items:center}.seller-service-status header small{display:block;color:var(--muted);margin-top:4px}.seller-service-status>p{font-size:12px;color:var(--muted)}.seller-service-items{display:grid;gap:7px}.seller-service-items span{padding:8px 10px;background:var(--ui-raised,#dce9f3);border-radius:8px;font-size:12px}.seller-service-tabs{display:flex;gap:9px;margin:18px 0;flex-wrap:wrap}.seller-service-tabs button{min-height:44px;padding:10px 16px;border:1px solid var(--line);border-radius:11px;background:var(--ui-panel,#f9fcff);color:var(--ink);font-weight:800}.seller-service-tabs button.active{background:var(--ui-panel,#f9fcff);color:var(--ui-text,#20374a);border-color:var(--ui-border,#c5d8e6)}.seller-top{justify-content:space-between}.seller-top small{display:block;color:var(--muted);font-size:11px;margin-top:3px}.seller-tracking-timeline{display:grid;gap:9px;margin:12px 0 20px}.seller-tracking-event{display:grid;grid-template-columns:minmax(110px,auto) 1fr;gap:4px 12px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--ui-panel,#f9fcff)}.seller-tracking-event small{grid-row:span 2;color:var(--muted)}.seller-tracking-event span{color:var(--muted);font-size:12px}.customer-order-group{margin-top:20px}.customer-order-group h3{margin-bottom:8px}.customer-dashboard-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.customer-dashboard-summary span{display:grid;padding:13px;border-radius:12px;background:var(--ui-raised,#dce9f3)}.customer-dashboard-summary b{font-size:20px}.customer-dashboard-summary small{color:var(--muted)}.customer-order-actions{display:flex;gap:8px;flex-wrap:wrap}.customer-order-actions .btn{flex:1;min-width:130px}.customer-order-tracking{margin-top:12px;padding:14px;border-radius:12px;background:var(--ui-raised,#dce9f3)}';document.head.appendChild(sellerStyle);
const baseServiceList=window.renderServicesPage;window.renderServicesPage=function(){baseServiceList();(db.services||[]).filter(s=>s.employeeCompletedAt&&!s.closed).forEach(s=>{const row=[...document.querySelectorAll('#servicesTable tr')].find(tr=>tr.innerHTML.includes(esc(s.id)));if(!row)return;const action=row.querySelector('td:last-child'),first=action?.querySelector('button');if(first){first.textContent='Finalizar serviço';first.setAttribute('onclick',`finalizeService('${esc(s.id)}')`);first.insertAdjacentHTML('afterend',` <button class="icon-btn" onclick="manageProcess('${esc(s.id)}')">Revisar dados</button>`);}});};
const completedAlerts=new Set();async function pollCompletedServices(){if(localStorage.getItem('protecextintores_role')!=='admin'||!localStorage.getItem(tokenKey))return;try{const response=await apiCall('/api/admin/state');if(!response.ok)return;const state=await apiJson(response);for(const s of state.services||[])if(s.employeeCompletedAt&&!s.closed&&!completedAlerts.has(s.id)){completedAlerts.add(s.id);toast('Manutenção '+(s.code||'')+' concluída pelo funcionário; revise e finalize.');if('Notification'in window&&Notification.permission==='granted')new Notification('Manutenção concluída',{icon:window.protecBrand.url,body:(s.code||'Serviço')+' aguarda sua revisão e finalização.'});}}catch{}}setInterval(pollCompletedServices,30000);
window.openPersonalSettings=async function(){try{const response=await apiCall('/api/profile'),profile=await apiJson(response);if(!response.ok)throw Error(profile.error||'Falha ao carregar perfil');const body=`<p class="helper">Atualize seu nome de usuário ou senha.</p><div class="form-field"><label>Nome de usuário</label><input name="username" value="${esc(profile.username)}" required minlength="3" maxlength="30"></div><div class="form-field"><label>Senha atual para confirmar alterações</label><input name="currentPassword" type="password" autocomplete="current-password"></div><div class="form-field"><label>Nova senha (opcional)</label><input name="newPassword" type="password" minlength="5" autocomplete="new-password"></div>`;openModal('Meu painel e acesso',body,async form=>{const payload=Object.fromEntries(new FormData(form));const r=await apiCall('/api/profile','PUT',payload),data=await apiJson(r);if(!r.ok)throw Error(data.error||'Não foi possível salvar perfil.');toast('Dados de acesso salvos');if(data.username!==profile.username){localStorage.setItem('protecextintores_username',data.username);toast('Usuário alterado; entre novamente com o novo nome.');}return true;},'Salvar alterações');}catch(error){toast(error.message);}};
const profileStyle=document.createElement('style');profileStyle.textContent='.personal-settings-button{margin-left:10px}';document.head.appendChild(profileStyle);const profileMountTimer=setInterval(()=>{const header=document.querySelector('#employeePortal .employee-top');if(!header)return;let button=header.querySelector('.personal-settings-button');if(!button){button=document.createElement('button');button.className='btn btn-small personal-settings-button';button.textContent='Configurações';button.onclick=openPersonalSettings;header.appendChild(button);}},1000);setTimeout(()=>clearInterval(profileMountTimer),30000);
window.serviceContactMode=function(kind,select){const panel=document.getElementById(kind+'InlineCreate'),open=select.value==='__new__';panel?.classList.toggle('hidden',!open);panel?.querySelectorAll('[name^="new'+(kind==='client'?'Client':'Seller')+'"]').forEach(input=>input.required=open&&input.name.endsWith('Name'));};
const openInlineContactService=window.openService;window.openService=function(){const result=openInlineContactService.apply(this,arguments);setTimeout(()=>{const form=document.querySelector('#editForm');for(const kind of ['client','seller']){const select=form?.elements[kind+'Choice'];if(select)window.serviceContactMode(kind,select);}},0);return result;};
const pagePaths={overview:'/painel',services:'/manutencoes',extinguishers:'/extintores',inventory:'/estoque',parts:'/pecas-precos',clients:'/clientes',employees:'/funcionarios',products:'/produtos',orders:'/pedidos',deliveries:'/entregas',warranties:'/garantias',reviews:'/avaliacoes',users:'/acessos',settings:'/configuracoes'},pathPages=Object.fromEntries(Object.entries(pagePaths).map(([key,value])=>[value,key]));pathPages['/config']='settings';const initialPanelPath=sessionStorage.getItem('__protecPendingRoute')||location.pathname;const initialRoutePage=pathPages[initialPanelPath.replace(/\/$/,'')]||null;sessionStorage.removeItem('__protecPendingRoute');const navigatePanel=window.go;window.go=function(target,fromHistory=false){let pageTarget=target;if(target==='overview'&&initialRoutePage){pageTarget=initialRoutePage;}const result=navigatePanel(pageTarget);if(!fromHistory&&pagePaths[pageTarget])history.pushState({protecPage:pageTarget},'',pagePaths[pageTarget]);return result;};window.addEventListener('popstate',event=>{const route=pathPages[location.pathname.replace(/\/$/,'')];if(route&&localStorage.getItem('protecextintores_role')==='admin')window.go(route,true);});if(initialRoutePage&&localStorage.getItem('protecextintores_role')==='admin')setTimeout(()=>window.go(initialRoutePage,true),0);
const enhancementsScript=document.querySelector('script[src*="app-features.js"]'),routeRoot=enhancementsScript?new URL('./',enhancementsScript.src).pathname.replace(/\/$/,''):'';let startupRouteConsumed=false;window.go=function(target,fromHistory=false){let resolved=target;if(target==='overview'&&initialRoutePage&&!startupRouteConsumed){resolved=initialRoutePage;startupRouteConsumed=true;}const result=navigatePanel(resolved);syncMobileAdminNav(resolved);if(!fromHistory&&pagePaths[resolved])history.pushState({protecPage:resolved},'',routeRoot+pagePaths[resolved]);return result;};window.addEventListener('popstate',()=>{let pathname=location.pathname;if(routeRoot&&pathname.startsWith(routeRoot))pathname=pathname.slice(routeRoot.length)||'/';const route=pathPages[pathname.replace(/\/$/,'')];if(route&&localStorage.getItem('protecextintores_role')==='admin')window.go(route,true);});
window.openService=function(){window.ensureServiceWeightCatalog?.();const clientOptions=(db.clients||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''),sellerOptions=(db.sellers||[]).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''),body=`<p class="helper"><b>*</b> Selecione cliente ou vendedor. Cadastros novos podem ser feitos aqui, sem sair do formulário.</p><div class="form-grid"><div class="form-field"><label>Cliente</label><select name="clientChoice" onchange="serviceContactMode('client',this)"><option value="">Selecionar cliente…</option>${clientOptions}<option value="__new__">＋ Adicionar cliente</option></select></div><div class="form-field"><label>Vendedor responsável</label><select name="sellerChoice" onchange="serviceContactMode('seller',this)"><option value="">Sem vendedor</option>${sellerOptions}<option value="__new__">＋ Adicionar vendedor</option></select></div><div id="clientInlineCreate" class="form-grid span2 hidden"><h3 class="span2">Novo cliente</h3>${field('Nome do cliente','newClientName',{required:true})}${field('Telefone / WhatsApp','newClientPhone')}${field('CPF / CNPJ','newClientDocument')}</div><div id="sellerInlineCreate" class="form-grid span2 hidden"><h3 class="span2">Novo vendedor</h3>${field('Nome do vendedor','newSellerName',{required:true})}${field('Telefone / WhatsApp','newSellerPhone')}${field('E-mail','newSellerEmail',{type:'email'})}</div><div class="form-field span2"><label>Extintores do serviço</label><div id="serviceExtRows"></div><button type="button" class="btn btn-soft btn-small" onclick="addServiceExtRow()">＋ Adicionar tipo</button><p class="helper">ABC/BC: 4, 6, 8 ou 12 kg · CO₂: 4, 6 ou 8 kg · Água pressurizada: 10 L.</p></div>${field('Tipo de serviço','serviceType',{required:true,options:['Manutenção','Inspeção','Recarga','Teste hidrostático','Instalação','Outro'].map(x=>({value:x,label:x}))})}${field('Data do serviço','date',{type:'date',required:true,value:new Date().toISOString().slice(0,10)})}<div class="form-field"><label>Total da ordem</label><strong id="serviceTotal">R$ 0,00</strong><input name="price" type="hidden" value="0.00"></div>${field('Componentes / peças previstas','parts')}${field('Observações iniciais','notes',{cls:'span2'})}</div>`;openModal('Registrar manutenção / serviço',body,async form=>{let clientId=val(form,'clientChoice'),sellerId=val(form,'sellerChoice'),client=null,seller=null;if(clientId==='__new__'){const name=val(form,'newClientName').trim();if(!name){toast('Informe o nome do cliente.');return false}client={id:id(),name,phone:val(form,'newClientPhone'),document:val(form,'newClientDocument')};db.clients.push(client);clientId=client.id;}else client=(db.clients||[]).find(x=>x.id===clientId);if(sellerId==='__new__'){const name=val(form,'newSellerName').trim();if(!name){toast('Informe o nome do vendedor.');return false}seller={id:id(),name,phone:val(form,'newSellerPhone'),email:val(form,'newSellerEmail')};db.sellers.push(seller);sellerId=seller.id;}else seller=(db.sellers||[]).find(x=>x.id===sellerId);if(!client&&!seller){toast('Selecione um cliente ou vendedor.');return false}const rows=[...document.querySelectorAll('#serviceExtRows .service-ext-row')],items=[];let total=0;if(!rows.length){toast('Adicione ao menos um tipo de extintor.');return false}for(const row of rows){const type=row.querySelector('[name="extType"]')?.value||'',kg=isWaterExtinguisher(type)?'':row.querySelector('[name="extKg"]')?.value||'',qty=Number(row.querySelector('[name="extQty"]')?.value||0),config=typeFor(type,kg);if(!type||(!isWaterExtinguisher(type)&&!kg)||!config||qty<1){toast('Confira tipo, peso e quantidade.');return false}total+=qty*Number(config.price||0);for(let i=0;i<qty;i++)items.push({type,kg,model:config.model||'',unitPrice:Number(config.price||0),status:'Solicitado',serial:'',seal:'',maintenanceYear:'',hydroYear:'',notes:'',replacedParts:[],extraParts:'',painted:false,history:[{status:'Solicitado',at:new Date().toISOString()}]});}const at=new Date().toISOString(),service={id:id(),code:'FS-'+Math.random().toString(36).slice(2,8).toUpperCase(),clientId:client?.id||'',clientName:client?.name||seller?.name||'Cliente não informado',clientPhone:client?.phone||'',sellerId:seller?.id||'',sellerName:seller?.name||'Loja',date:val(form,'date'),serviceType:val(form,'serviceType'),employeeId:'',employeeName:'',price:Math.round(total*100)/100,parts:val(form,'parts'),notes:val(form,'notes'),items,type:[...new Set(items.map(i=>i.type))].join(', '),history:[{at,action:'Serviço registrado pela loja',description:'Aguardando aceite de um funcionário.'}]};db.services.push(service);if(!await save()){db.services.pop();return false}(window.renderPage||renderPage)();toast('Serviço registrado e disponível para aceite.');return {afterClose:()=>setTimeout(()=>window.serviceOrder(service.id),80)};});addServiceExtRow();};
window.openService=function(){window.ensureServiceWeightCatalog?.();const body=`<p class="helper"><b>*</b> Campos obrigatórios. Este serviço será registrado pela loja; o funcionário responsável poderá aceitá-lo depois.</p><div class="form-grid">${field('Nome do cliente','clientName',{required:true,placeholder:'Digite o nome do cliente'})}<div class="form-field span2"><label>Extintores do serviço</label><div id="serviceExtRows"></div><button type="button" class="btn btn-soft btn-small" onclick="addServiceExtRow()">＋ Adicionar tipo</button><p class="helper">Pesos disponíveis: ABC/BC — 4, 6, 8 ou 12 kg; CO₂ — 4, 6 ou 8 kg; água pressurizada — 10 L.</p></div>${field('Tipo de serviço','serviceType',{required:true,options:['Manutenção','Inspeção','Recarga','Teste hidrostático','Instalação','Outro'].map(x=>({value:x,label:x}))})}${field('Data do serviço','date',{type:'date',required:true,value:new Date().toISOString().slice(0,10)})}<div class="form-field"><label>Total da ordem</label><strong id="serviceTotal">R$ 0,00</strong><input name="price" type="hidden" value="0.00"></div>${field('Componentes / peças previstas','parts')}${field('Observações iniciais','notes',{cls:'span2'})}</div>`;openModal('Registrar manutenção / serviço',body,async form=>{const clientName=val(form,'clientName').trim(),rows=[...document.querySelectorAll('#serviceExtRows .service-ext-row')];if(!clientName){toast('Informe o nome do cliente.');return false}if(!rows.length){toast('Adicione ao menos um tipo de extintor.');return false}const items=[];let total=0;for(const row of rows){const type=row.querySelector('[name="extType"]')?.value||'',water=isWaterExtinguisher(type),kg=water?'':row.querySelector('[name="extKg"]')?.value||'',qty=Number(row.querySelector('[name="extQty"]')?.value||0),config=typeFor(type,kg);if(!type||(!water&&!kg)||!config||qty<1){toast('Confira tipo, peso e quantidade.');return false}total+=qty*Number(config.price||0);for(let i=0;i<qty;i++)items.push({type,kg,model:config.model||'',unitPrice:Number(config.price||0),status:db.settings.stages?.[0]||'Solicitado',serial:'',seal:'',maintenanceYear:'',hydroYear:'',notes:'',replacedParts:[],extraParts:'',painted:false,history:[{status:db.settings.stages?.[0]||'Solicitado',at:new Date().toISOString()}]});}const createdAt=new Date().toISOString(),service={id:id(),code:'FS-'+Math.random().toString(36).slice(2,8).toUpperCase(),clientId:'',clientName,sellerId:'',sellerName:'Loja',date:val(form,'date'),serviceType:val(form,'serviceType'),employeeId:'',employeeName:'',price:Math.round(total*100)/100,maintenanceValid:'',hydroValid:'',parts:val(form,'parts'),notes:val(form,'notes'),items,serial:'',type:[...new Set(items.map(x=>x.type))].join(', '),history:[{at:createdAt,action:'Serviço registrado pela loja',description:`${items.length} extintor(es) aguardando aceite de um funcionário.`}]};db.services.push(service);if(!await save()){db.services.pop();saveLocal();return false}(window.renderPage||renderPage)();toast('Serviço da loja registrado. Aguardando aceite do funcionário.');return {afterClose:()=>setTimeout(()=>window.serviceOrder(service.id),80)};});addServiceExtRow();};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePublicMenu();});
function mountMobileAdminNav(){const top=document.querySelector('.admin-top'),crumb=top?.querySelector('.crumb');if(!top||!crumb||document.getElementById('mobileAdminNav'))return;const operationNav=document.querySelector('.side-nav button[data-page="extinguishers"]')?.parentElement;if(operationNav&&!operationNav.querySelector('[data-page="inventory"]')){const inventoryButton=document.createElement('button');inventoryButton.dataset.page='inventory';inventoryButton.innerHTML='<span>▣</span><span class="navtext">Estoque</span>';operationNav.appendChild(inventoryButton);}const toggle=document.createElement('button');toggle.className='mobile-admin-menu';toggle.type='button';toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','mobileAdminNav');toggle.innerHTML='<span aria-hidden="true">☰</span><span>Módulos</span>';toggle.onclick=()=>toggleAdminNav(toggle);crumb.prepend(toggle);const nav=document.createElement('nav');nav.id='mobileAdminNav';nav.className='mobile-admin-nav';nav.setAttribute('aria-label','Módulos do painel');const pages=[...document.querySelectorAll('.side-nav button[data-page]')].map(button=>({page:button.dataset.page,icon:button.querySelector('span:not(.navtext)')?.textContent||'•',label:button.querySelector('.navtext')?.textContent?.trim()||button.textContent.trim()}));nav.innerHTML=pages.map(({page,icon,label})=>`<button type="button" data-page="${page}" onclick="go('${page}')"><span aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')+'<button type="button" class="mobile-logout" onclick="logout()"><span aria-hidden="true">↪</span><span>Sair do painel</span></button>';top.insertAdjacentElement('afterend',nav);syncMobileAdminNav();}
window.toggleAdminNav=function(button){const nav=document.getElementById('mobileAdminNav');if(!nav)return;const open=nav.classList.toggle('is-collapsed');button.setAttribute('aria-expanded',String(!open));};
function syncMobileAdminNav(current=window.page){const activePage=current||'overview';document.querySelectorAll('#mobileAdminNav [data-page]').forEach(button=>{const active=button.dataset.page===activePage;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});}
document.addEventListener('click',e=>{const button=e.target.closest('#mobileAdminNav [data-page]');if(button){const nav=document.getElementById('mobileAdminNav');nav?.classList.add('is-collapsed');document.querySelector('.mobile-admin-menu')?.setAttribute('aria-expanded','false');setTimeout(()=>syncMobileAdminNav(button.dataset.page),0);}});
mountMobileAdminNav();
window.clearCompletedServices=async function(){const done=(db.services||[]).filter(service=>Boolean(service.closed));if(!done.length){toast('Não há serviços finalizados pelo administrador para limpar.');return;}if(!confirm(`Limpar ${done.length} serviço(s) finalizado(s) do histórico?`))return;db.services=(db.services||[]).filter(service=>!service.closed);if(await save()){renderPage();toast(`${done.length} serviço(s) finalizado(s) removido(s) do histórico.`);}};
window.renderServicesPage=function(){const host=document.getElementById('content');if(!host)return;const list=(db.services||[]).slice().reverse(),lastStage=(db.settings.stages||[]).filter(x=>x!=='Concluído').at(-1)||'Concluído';const rows=list.map(s=>{const items=s.items||[],types=[...new Set(items.map(x=>x.type||'Extintor'))].join(', '),status=serviceStatus(s),done=Boolean(s.closed)||(items.length>0&&items.every(x=>x.status==='Concluído'||x.status===lastStage));return '<tr><td>'+esc(date(s.date))+'</td><td><strong>'+esc(s.clientName||'Cliente não informado')+'</strong></td><td>'+esc(types)+' <b>× '+items.length+'</b></td><td>'+esc(s.employeeName||'Aguardando aceite')+'</td><td><span class="status">'+esc(done?'Concluído':status)+'</span><br><small>'+esc(s.code||'')+'</small></td><td>'+(done?'<button class="icon-btn receipt-action" onclick="showServiceReceipt(\''+esc(s.id)+'\')">Exibir comprovante</button>':'<button class="icon-btn" onclick="manageProcess(\''+esc(s.id)+'\')">Atualizar status</button>')+' <button class="icon-btn" onclick="serviceHistory(\''+esc(s.id)+'\')">Histórico</button> <button class="icon-btn" onclick="serviceOrder(\''+esc(s.id)+'\')">Ordem de serviço</button></td></tr>';}).join('');host.innerHTML='<div class="page-title"><div><h1>Manutenções</h1><p>Histórico de serviços, inspeções e validade dos extintores.</p></div><button class="btn btn-small" onclick="openService()">＋ Registrar serviço</button></div><div class="panel"><div class="panel-head"><div><h3>Histórico de serviços</h3><p>'+list.length+' registros</p></div><input class="search" placeholder="Buscar cliente ou numeração…" oninput="filterTable(this.value,\'servicesTable\')"></div><div id="servicesTable">'+(rows?'<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Extintores</th><th>Funcionário</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<div class="empty">Nenhuma manutenção registrada. Comece criando seu primeiro serviço.</div>')+'</div></div>';setTimeout(addCompletedClearButton,0);};
window.showServiceReceipt=function(serviceId){const s=(db.services||[]).find(x=>x.id===serviceId);if(!s)return;const items=s.items||[],groups=groupExtinguishers(items),grandTotal=Number(s.price||items.reduce((n,x)=>n+Number(x.unitPrice||0),0)),brand=db.settings.company||'ProtecExtintores';const rows=groups.map(g=>'<tr><td>'+esc(g.type)+(g.kg?' · '+esc(g.kg)+' kg':'')+'</td><td>'+g.items.length+'</td><td>'+money(g.items.reduce((n,x)=>n+Number(x.unitPrice||0),0))+'</td></tr>').join('');const receipt='<article class="receipt-paper"><header class="receipt-heading"><div><div class="receipt-brand">'+'<span style="margin-right:10px">'+window.protecBrand.image(44)+'</span>'+esc(brand)+'</div><h2>Comprovante de serviço</h2><p>Manutenção de extintores</p></div><div class="receipt-code"><small>CÓDIGO DO SERVIÇO</small><b>'+esc(s.code||'—')+'</b></div></header><div class="receipt-grid"><div><small>Cliente</small><b>'+esc(s.clientName||'—')+'</b></div><div><small>Data do serviço</small><b>'+esc(date(s.date))+'</b></div><div><small>Tipo de serviço</small><b>'+esc(s.serviceType||'Manutenção')+'</b></div><div><small>Responsável técnico</small><b>'+esc(s.employeeName||'—')+'</b></div><div><small>Status</small><b>Concluído</b></div><div><small>Extintores atendidos</small><b>'+items.length+'</b></div></div><h3>Itens do serviço</h3><table class="receipt-table"><thead><tr><th>Tipo e capacidade</th><th>Qtd.</th><th>Subtotal</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><th colspan="2">Total do serviço</th><th>'+money(grandTotal)+'</th></tr></tfoot></table>'+(s.notes?'<section class="receipt-notes"><h3>Observações</h3><p>'+esc(s.notes)+'</p></section>':'')+'<footer class="receipt-footer">Comprovante emitido em '+esc(new Date().toLocaleString('pt-BR'))+' · '+esc(brand)+'</footer></article>';document.getElementById('modalRoot').innerHTML='<div class="modal-back" onclick="if(event.target===this)closeModal()"><div class="modal receipt-modal"><div class="modal-head"><h2>Comprovante do serviço</h2><button class="icon-btn" onclick="closeModal()" aria-label="Fechar">✕</button></div><div class="modal-body">'+receipt+'</div><div class="modal-actions"><button class="btn btn-soft" onclick="closeModal()">Fechar</button><button class="btn btn-soft" onclick="shareServiceReceipt(\''+esc(s.id)+'\')">Compartilhar</button><button class="btn" onclick="printServiceReceipt(\''+esc(s.id)+'\')">Imprimir / salvar PDF</button></div></div></div>';};
window.printServiceReceipt=function(serviceId){const s=(db.services||[]).find(x=>x.id===serviceId);if(!s)return;const paper=document.querySelector('.receipt-paper');if(!paper)return;const win=window.open('','_blank','noopener,noreferrer,width=900,height=720');if(!win){toast('Permita a abertura da janela para imprimir o comprovante.');return;}win.document.open();win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante '+esc(s.code||'')+'</title><style>body{font:14px Arial,sans-serif;color:var(--ui-text,#20374a);margin:32px}.receipt-paper{max-width:760px;margin:auto;padding:30px;border:1px solid var(--ui-border,#c5d8e6);border-radius:14px}.receipt-heading{display:flex;justify-content:space-between;border-bottom:2px solid var(--ui-border,#c5d8e6);padding-bottom:18px}.receipt-brand{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--ui-text,#20374a);font-weight:bold}.receipt-heading h2{margin:7px 0}.receipt-code{text-align:right}.receipt-code small,.receipt-grid small{display:block;color:var(--ui-muted,#526b80);font-size:10px}.receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:22px 0}.receipt-grid b{display:block;margin-top:5px}.receipt-table{width:100%;border-collapse:collapse}.receipt-table th,.receipt-table td{text-align:left;padding:11px;border-bottom:1px solid var(--ui-border,#c5d8e6)}.receipt-table th{background:var(--ui-raised,#dce9f3)}.receipt-table tfoot th{font-size:15px}.receipt-notes{margin-top:22px}.receipt-footer{margin-top:40px;padding-top:12px;border-top:1px solid var(--ui-border,#c5d8e6);color:var(--ui-muted,#526b80);font-size:11px}@media print{body{margin:0}.receipt-paper{border:0}}</style></head><body>'+paper.outerHTML+'</body></html>');win.document.close();Promise.all([...win.document.images].map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>{win.focus();win.print();});};
window.shareServiceReceipt=async function(serviceId){const s=(db.services||[]).find(x=>x.id===serviceId);if(!s)return;const lines=[`Comprovante de serviço ${s.code||''}`,`Empresa: ${db.settings.company||'ProtecExtintores'}`,`Cliente: ${s.clientName||'—'}`,`Data: ${date(s.date)}`,`Serviço: ${s.serviceType||'Manutenção'}`,`Responsável: ${s.employeeName||'—'}`,`Extintores: ${(s.items||[]).map(x=>`${x.type||'Extintor'}${x.kg?' '+x.kg+' kg':''}`).join(', ')||'—'}`,`Total: ${money(s.price||0)}`].join('\n');if(navigator.share){try{await navigator.share({title:'Comprovante '+(s.code||''),text:lines});return}catch(error){if(error.name==='AbortError')return;}}try{await navigator.clipboard.writeText(lines);toast('Resumo do comprovante copiado para compartilhar.')}catch{toast('Não foi possível compartilhar neste navegador. Use Imprimir / salvar PDF.')}};
window.printServiceReceipt=function(serviceId){const paper=document.querySelector('.receipt-paper');if(!paper)return;const win=window.open('','_blank','width=900,height=720');if(!win){toast('Permita a abertura da janela para imprimir o comprovante.');return;}win.document.open();win.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante de serviço</title><style>body{font:14px Arial,sans-serif;color:var(--ui-text,#20374a);margin:32px}.receipt-paper{max-width:760px;margin:auto;padding:30px;border:1px solid var(--ui-border,#c5d8e6)}.receipt-heading{display:flex;justify-content:space-between;border-bottom:2px solid var(--ui-border,#c5d8e6);padding-bottom:18px}.receipt-brand{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--ui-text,#20374a);font-weight:bold}.receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:22px 0}.receipt-grid small{display:block;color:var(--ui-muted,#526b80);font-size:10px}.receipt-grid b{display:block;margin-top:5px}.receipt-table{width:100%;border-collapse:collapse}.receipt-table th,.receipt-table td{text-align:left;padding:11px;border-bottom:1px solid var(--ui-border,#c5d8e6)}.receipt-table th{background:var(--ui-raised,#dce9f3)}.receipt-footer{margin-top:40px;padding-top:12px;border-top:1px solid var(--ui-border,#c5d8e6);color:var(--ui-muted,#526b80);font-size:11px}@media print{body{margin:0}.receipt-paper{border:0}}</style></head><body>'+paper.outerHTML+'</body></html>');win.document.close();Promise.all([...win.document.images].map(img=>img.decode?img.decode().catch(()=>{}):Promise.resolve())).then(()=>{win.focus();win.print();});};
const receiptStyle=document.createElement('style');receiptStyle.textContent='.receipt-modal{width:min(820px,100%)}.receipt-paper{background:var(--ui-panel,#f9fcff);padding:26px;border:1px solid var(--ui-border,#c5d8e6);border-radius:14px;color:var(--ui-text,#20374a)}.receipt-heading{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid var(--ui-border,#c5d8e6);padding-bottom:18px}.receipt-brand{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--ui-text,#20374a);font-weight:900}.receipt-heading h2{margin:7px 0}.receipt-heading p{margin:0;color:var(--ui-muted,#526b80)}.receipt-code{text-align:right}.receipt-code small,.receipt-grid small{display:block;color:var(--ui-muted,#526b80);font-size:10px}.receipt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin:22px 0}.receipt-grid b{display:block;margin-top:5px}.receipt-table{width:100%;border-collapse:collapse}.receipt-table th,.receipt-table td{text-align:left;padding:11px;border-bottom:1px solid var(--ui-border,#c5d8e6)}.receipt-table th{background:var(--ui-raised,#dce9f3);color:var(--ui-text,#20374a)}.receipt-notes{margin-top:18px}.receipt-footer{margin-top:30px;padding-top:12px;border-top:1px solid var(--ui-border,#c5d8e6);color:var(--ui-muted,#526b80);font-size:11px}@media(max-width:600px){.receipt-paper{padding:16px}.receipt-grid{grid-template-columns:1fr}.receipt-heading{flex-direction:column}.receipt-code{text-align:left}.receipt-modal .modal-actions{flex-wrap:wrap}}';document.head.appendChild(receiptStyle);
window.renderServicesPage=function(){
  const host=document.getElementById('content');if(!host)return;
  const list=(db.services||[]).slice().reverse(),lastStage=(db.settings.stages||[]).slice(-1)[0]||'Concluído';
  const rows=list.map(service=>{
    const items=service.items||[],status=serviceStatus(service),done=Boolean(service.closed),cancelled=Boolean(service.cancelledAt||service.status==='Cancelado');
    const allItemsDone=items.length>0&&items.every(item=>item.status===lastStage||item.status==='Concluído');
    const review=!done&&!cancelled&&Boolean(service.employeeCompletedAt||allItemsDone);
    const label=cancelled?'Cancelado':done?'Concluído':review?'Aguardando conferência':status;
    const types=[...new Set(items.map(item=>item.type||'Extintor'))].join(', ');
    const primary=cancelled
      ? '<span class="status">Cancelado</span>'
      : done
      ? `<button class="icon-btn" onclick="showServiceReceipt('${esc(service.id)}')">Exibir comprovante</button>`
      : review
        ? `<button class="icon-btn" onclick="manageProcess('${esc(service.id)}')">Revisar dados</button> <button class="btn btn-small" onclick="finalizeService('${esc(service.id)}')">Finalizar serviço</button>`
        : `<button class="icon-btn" onclick="manageProcess('${esc(service.id)}')">Atualizar status</button>`;
    return `<tr><td>${esc(date(service.date))}</td><td><strong>${esc(service.clientName||'Cliente não informado')}</strong></td><td>${esc(types)} <b>× ${items.length}</b></td><td>${esc(service.employeeName||'Aguardando aceite')}</td><td><span class="status ${cancelled?'':review?'warn':done?'success':''}">${esc(label)}</span><br><small>${esc(service.code||'')}</small></td><td>${primary} <button class="icon-btn" onclick="serviceHistory('${esc(service.id)}')">Histórico</button> <button class="icon-btn" onclick="serviceOrder('${esc(service.id)}')">Ordem de serviço</button></td></tr>`;
  }).join('');
  host.innerHTML=`<div class="page-title"><div><h1>Manutenções</h1><p>Histórico de serviços, inspeções e validade dos extintores.</p></div><button class="btn btn-small" onclick="openService()">＋ Registrar serviço</button></div><div class="panel"><div class="panel-head"><div><h3>Histórico de serviços</h3><p>${list.length} registros</p></div><input class="search" placeholder="Buscar cliente ou numeração…" oninput="filterTable(this.value,'servicesTable')"></div><div id="servicesTable">${rows?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Extintores</th><th>Funcionário</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Nenhuma manutenção registrada.</div>'}</div></div>`;
  setTimeout(addCompletedClearButton,0);
};
function addCompletedClearButton(){if(typeof page==='undefined'||page!=='services'||document.getElementById('clearCompletedServices'))return;const title=document.querySelector('#content .page-title');if(!title)return;const button=document.createElement('button');button.id='clearCompletedServices';button.type='button';button.className='btn btn-soft btn-small clear-completed';button.textContent='Limpar concluídos';button.onclick=clearCompletedServices;title.appendChild(button);}
const renderPageWithClear=window.renderPage;
window.renderPage=function(){
  try {
    const result=renderPageWithClear.apply(this,arguments);
    setTimeout(addCompletedClearButton,0);
    return result;
  } catch (error) {
    if (typeof page==='string' && page==='services') {
      const host=document.getElementById('content');
      if (host) {
        host.innerHTML='<div class="page-title"><div><h1>Manutenções</h1><p>Histórico de serviços, inspeções e validade dos extintores.</p></div><button class="btn btn-small" onclick="openService()">＋ Registrar serviço</button></div><div class="panel"><div class="panel-head"><div><h3>Histórico de serviços</h3><p>'+((db.services||[]).length)+' registros</p></div><input class="search" placeholder="Buscar cliente ou numeração…" oninput="filterTable(this.value,\'servicesTable\')"></div><div id="servicesTable">'+((window.serviceTable&&typeof window.serviceTable==='function')?window.serviceTable((db.services||[]).slice().reverse()):'<div class="empty">Nenhuma manutenção registrada.</div>')+'</div></div>';
        setTimeout(addCompletedClearButton,0);
        return;
      }
    }
    console.error('Falha ao renderizar o painel',error);
    toast('Não foi possível abrir esta página. Recarregue o painel.');
  }
};
/* Recupera o cadastro da ordem de serviço com pesos dependentes do tipo. */
window.serviceTypeChanged=function(select,chosenKg=''){const row=select.closest('.service-ext-row'),weight=row?.querySelector('[name="extKg"]'),wrap=row?.querySelector('.service-weight');if(!row||!weight)return;const water=isWaterExtinguisher(select.value);if(wrap)wrap.classList.toggle('hidden',water);weight.disabled=water;weight.required=!water;const weights=availableWeights(select.value);weight.innerHTML='<option value="">Selecione o peso</option>'+weights.map(w=>`<option value="${w}" ${String(w)===String(chosenKg)?'selected':''}>${w} kg</option>`).join('');if(water)weight.value='';window.refreshServicePrice();};
window.addServiceExtRow=function(type='',kg='',qty=1){const host=document.getElementById('serviceExtRows');if(!host)return;const row=document.createElement('div');row.className='service-ext-row form-grid';const names=uniqueTypeNames().map(name=>`<option value="${esc(name)}" ${name===type?'selected':''}>${esc(name)}</option>`).join('');row.innerHTML=`<div class="form-field"><label>Tipo <span class="required-mark">*</span></label><select name="extType" required onchange="serviceTypeChanged(this)"><option value="">Selecione o tipo</option>${names}</select></div><div class="form-field service-weight"><label>Peso <span class="required-mark">*</span></label><select name="extKg" required onchange="refreshServicePrice()"><option value="">Selecione o peso</option></select></div><div class="form-field"><label>Quantidade <span class="required-mark">*</span></label><select name="extQty" required onchange="refreshServicePrice()">${Array.from({length:50},(_,i)=>`<option value="${i+1}" ${i+1===Number(qty)?'selected':''}>${i+1}</option>`).join('')}</select></div><button type="button" class="icon-btn" aria-label="Remover tipo" onclick="this.closest('.service-ext-row').remove();refreshServicePrice()">Remover</button>`;host.appendChild(row);serviceTypeChanged(row.querySelector('[name="extType"]'),kg);};
window.refreshServicePrice=function(){const total=[...document.querySelectorAll('#serviceExtRows .service-ext-row')].reduce((sum,row)=>{const type=row.querySelector('[name="extType"]')?.value,kg=row.querySelector('[name="extKg"]')?.value,qty=Number(row.querySelector('[name="extQty"]')?.value||0),item=typeFor(type,kg);return sum+qty*Number(item?.price||0)},0),input=document.querySelector('#editForm [name="price"]'),display=document.getElementById('serviceTotal');if(input)input.value=total.toFixed(2);if(display)display.textContent=money(total);};
window.openService=function(){const body=`<p class="helper"><b>*</b> Campos obrigatórios. O funcionário responsável aceitará o serviço depois que ele for criado.</p><div class="form-grid">${field('Cliente','clientId',{options:clientOptions()})}${field('Vendedor responsável','sellerId',{options:(db.sellers||[]).map(x=>({value:x.id,label:x.name}))})}<div class="form-field span2"><label>Extintores do serviço</label><div id="serviceExtRows"></div><button type="button" class="btn btn-soft btn-small" onclick="addServiceExtRow()">＋ Adicionar tipo</button><p class="helper">Escolha o tipo, o peso e a quantidade de cada grupo.</p></div>${field('Tipo de serviço','serviceType',{required:true,options:['Manutenção','Inspeção','Recarga','Teste hidrostático','Instalação','Outro'].map(x=>({value:x,label:x}))})}${field('Data do serviço','date',{type:'date',required:true,value:new Date().toISOString().slice(0,10)})}${field('Próxima manutenção (mês e ano)','nextMaintenanceMonth',{type:'month'})}<p class="helper span2">Informe somente mês e ano; deixe em branco se ainda não estiver definido.</p><div class="form-field"><label>Total da ordem</label><strong id="serviceTotal">R$ 0,00</strong><input name="price" type="hidden" value="0.00"></div>${field('Componentes / peças previstas','parts')}${field('Observações iniciais','notes',{cls:'span2'})}</div>`;openModal('Registrar manutenção / serviço',body,async form=>{const client=db.clients.find(x=>x.id===val(form,'clientId')),seller=(db.sellers||[]).find(x=>x.id===val(form,'sellerId')),rows=[...document.querySelectorAll('#serviceExtRows .service-ext-row')];if(!client&&!seller){toast('Selecione um cliente ou vendedor.');return false}if(!rows.length){toast('Adicione ao menos um tipo de extintor.');return false}const items=[];let total=0;for(const row of rows){const type=row.querySelector('[name="extType"]').value,kg=isWaterExtinguisher(type)?'':row.querySelector('[name="extKg"]').value,qty=Number(row.querySelector('[name="extQty"]').value||0),config=typeFor(type,kg);if(!type||(!isWaterExtinguisher(type)&&!kg)||!config||qty<1){toast('Confira tipo, peso e quantidade.');return false}total+=qty*Number(config.price||0);for(let i=0;i<qty;i++)items.push({type,kg,model:config.model||'',unitPrice:Number(config.price||0),status:db.settings.stages?.[0]||'Solicitado',serial:'',seal:'',maintenanceYear:'',hydroYear:'',notes:'',replacedParts:[],extraParts:'',painted:false,history:[{status:db.settings.stages?.[0]||'Solicitado',at:new Date().toISOString()}]});}const createdAt=new Date().toISOString(),service={id:id(),code:'FS-'+Math.random().toString(36).slice(2,8).toUpperCase(),clientId:client?.id||'',clientName:client?.name||'Desconhecido',clientPhone:client?.phone||'',sellerId:seller?.id||'',sellerName:seller?.name||'Desconhecido',date:val(form,'date'),serviceType:val(form,'serviceType'),nextMaintenanceMonth:val(form,'nextMaintenanceMonth'),registeredByRole:'admin',registeredBy:db.settings.username||'admin',employeeId:'',employeeName:'',price:Math.round(total*100)/100,maintenanceValid:'',hydroValid:'',parts:val(form,'parts'),notes:val(form,'notes'),items,serial:'',type:[...new Set(items.map(x=>x.type))].join(', '),history:[{at:createdAt,action:'Serviço registrado',description:`${items.length} extintor(es) aguardando aceite de um funcionário.`}]};db.services.push(service);if(!await save()){db.services.pop();saveLocal();return false}renderPage();toast('Serviço criado e disponível para aceite.');return {afterClose:()=>setTimeout(()=>window.serviceOrder(service.id),80)};});addServiceExtRow();};
window.serviceOrder=function(serviceId){const service=db.services.find(x=>x.id===serviceId);if(!service)return;const items=serviceItems(service),groups=groupExtinguishers(items),rows=groups.map(g=>`<tr><td>${esc(g.type)}${g.kg&&!isWaterExtinguisher(g.type)?' · '+esc(g.kg)+' kg':''}</td><td>${g.items.length}</td><td>${money(g.items.reduce((sum,x)=>sum+Number(x.unitPrice||0),0))}</td></tr>`).join('');openModal('Ficha da ordem de serviço',`<div class="service-order"><div class="order-head"><div>${window.protecBrand.image(52)}<div class="eyebrow">Ordem de serviço</div><h2>${esc(db.settings.company||'ProtecExtintores')}</h2><p>${esc(service.code)}</p></div><div class="order-code"><small>${date(service.date)}</small></div></div><div class="order-parties"><div><small>Cliente</small><b>${esc(service.clientName||'Sem cliente vinculado')}</b></div><div><small>Serviço</small><b>${esc(service.serviceType||'Manutenção')}</b></div><div><small>Registrado por</small><b>${esc(service.registeredBy||service.sellerName||service.employeeName||'Administração')}</b></div><div><small>Responsável técnico</small><b>${esc(service.employeeName||'Aguardando aceite')}</b></div></div><table class="order-table"><thead><tr><th>Tipo</th><th>Qtd.</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><p><b>Observações:</b> ${esc(service.notes||'—')}</p></div>`,()=>true,'Fechar');};
// Completa capacidades CO₂ em bancos criados antes do catálogo de pesos.
for(const kg of [2,4,6,10])if(!db.types.some(t=>String(t.name||'').toLocaleLowerCase('pt-BR').includes('co')&&Number(t.kg)===kg))db.types.push({id:'co2-'+kg,name:'CO₂',kg,model:'CO2-'+kg,price:0});
var SERVICE_PART_OPTIONS=['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];
window.renderPartsPage=function(){const host=document.getElementById('content');if(!host)return;try{return partsPrices(host);}catch(error){console.error('Falha em Peças e preços',error);host.innerHTML='<div class="page-title"><div><h1>Peças e preços</h1><p>Configure os valores dos componentes usados pela equipe.</p></div></div><div class="panel empty">Não foi possível carregar os preços. Recarregue o painel para tentar novamente.</div>';}};
window.renderSettingsPage=function(){const host=document.getElementById('content');if(!host)return;try{return settings(host);}catch(error){console.error('Falha em Configurações',error);host.innerHTML='<div class="page-title"><div><h1>Configurações</h1><p>Preferências da empresa e do catálogo.</p></div></div><div class="panel empty">Não foi possível carregar as configurações. Recarregue o painel para tentar novamente.</div>';}};
window.serviceTypeChanged=function(select,chosenKg=''){const row=select?.closest('.service-ext-row'),weight=row?.querySelector('[name="extKg"]');if(!row||!weight)return;const water=isWaterExtinguisher(select.value),weights=[...new Set(db.types.filter(t=>t.name===select.value&&t.kg!==''&&t.kg!=null).map(t=>Number(t.kg)).filter(Number.isFinite))].sort((a,b)=>a-b);weight.disabled=water;weight.required=!water;row.querySelector('.service-weight')?.classList.toggle('hidden',water);weight.innerHTML='<option value="">Selecione o peso</option>'+weights.map(w=>`<option value="${w}" ${String(w)===String(chosenKg)?'selected':''}>${w} kg</option>`).join('');if(water)weight.value='';window.refreshServicePrice();};
window.ensureServiceWeightCatalog=function(){db.types=db.types||[];const families=[{test:n=>/(pó|po|abc|bc|químic)/i.test(n),weights:[1,2,4,6,8,12,20,30,50]},{test:n=>/(co2|co₂|dióxido|carbono)/i.test(n),weights:[2,4,6,10]}];for(const family of families){const names=[...new Set(db.types.map(t=>String(t.name||'')).filter(family.test))];for(const name of names)for(const kg of family.weights)if(!db.types.some(t=>t.name===name&&Number(t.kg)===kg))db.types.push({id:'auto-'+name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')+'-'+kg,name,kg,model:name+'-'+kg,price:0});}return db.types;};
window.ensureServiceWeightCatalog();
const openServiceWithCatalog=window.openService;window.openService=function(){window.ensureServiceWeightCatalog();return openServiceWithCatalog.apply(this,arguments);};
const sparseWeightCatalog=window.ensureServiceWeightCatalog;window.ensureServiceWeightCatalog=function(){sparseWeightCatalog();const families=[{test:n=>/(pó|po|abc|bc|químic)/i.test(n)},{test:n=>/(co2|co₂|dióxido|carbono)/i.test(n)}];for(const family of families){const names=[...new Set(db.types.map(t=>String(t.name||'')).filter(family.test))];for(const name of names)for(let kg=1;kg<=50;kg++)if(!db.types.some(t=>t.name===name&&Number(t.kg)===kg))db.types.push({id:'auto-'+name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')+'-'+kg,name,kg,model:name+'-'+kg,price:0});}return db.types;};
window.openService=function(){window.ensureServiceWeightCatalog();return openServiceWithCatalog.apply(this,arguments);};
const originalSaveCompany=window.saveCompany;window.saveCompany=function(event){const result=originalSaveCompany?.apply(this,arguments);document.title=(db.settings.company||'ProtecExtintores')+' — Gestão de extintores';return result;};
window.serviceTypeChanged=function(select,chosenKg=''){const row=select?.closest('.service-ext-row'),weight=row?.querySelector('[name="extKg"]');if(!row||!weight)return;const name=String(select.value||''),water=isWaterExtinguisher(name),isPowder=/(pó|po|abc|bc|químic)/i.test(name),isCo2=/(co2|co₂|dióxido|carbono)/i.test(name),weights=water?[]:(isPowder||isCo2?Array.from({length:50},(_,i)=>i+1):[...new Set(db.types.filter(t=>t.name===name&&t.kg!==''&&t.kg!=null).map(t=>Number(t.kg)).filter(Number.isFinite))].sort((a,b)=>a-b));weight.disabled=water;weight.required=!water;row.querySelector('.service-weight')?.classList.toggle('hidden',water);weight.innerHTML='<option value="">Selecione o peso</option>'+weights.map(w=>`<option value="${w}" ${String(w)===String(chosenKg)?'selected':''}>${w} kg</option>`).join('');if(water)weight.value='';window.refreshServicePrice();};
const normalizeRealWeights=window.ensureServiceWeightCatalog;window.ensureServiceWeightCatalog=function(){normalizeRealWeights();const rules=[{test:n=>/(pó|po|abc|bc|químic)/i.test(n),allowed:[4,6,8,12]},{test:n=>/(co2|co₂|dióxido|carbono)/i.test(n),allowed:[4,6,8]}];for(const rule of rules){db.types=db.types.filter(t=>{const n=String(t.name||'');return !(rule.test(n)&&t.kg!==''&&t.kg!=null&&!rule.allowed.includes(Number(t.kg)))});const names=[...new Set(db.types.map(t=>String(t.name||'')).filter(rule.test))];for(const name of names)for(const kg of rule.allowed)if(!db.types.some(t=>t.name===name&&Number(t.kg)===kg))db.types.push({id:'real-'+name.toLowerCase().replace(/[^a-z0-9]+/gi,'-')+'-'+kg,name,kg,model:name+'-'+kg,price:0});}return db.types;};window.ensureServiceWeightCatalog();
window.serviceTypeChanged=function(select,chosenKg=''){const row=select?.closest('.service-ext-row'),weight=row?.querySelector('[name="extKg"]');if(!row||!weight)return;const name=String(select.value||''),water=isWaterExtinguisher(name),isPowder=/(pó|po|abc|bc|químic)/i.test(name),isCo2=/(co2|co₂|dióxido|carbono)/i.test(name),weights=water?[]:(isPowder?[4,6,8,12]:isCo2?[4,6,8]:[...new Set(db.types.filter(t=>t.name===name&&t.kg!==''&&t.kg!=null).map(t=>Number(t.kg)).filter(Number.isFinite))].sort((a,b)=>a-b));weight.disabled=water;weight.required=!water;row.querySelector('.service-weight')?.classList.toggle('hidden',water);weight.innerHTML='<option value="">Selecione o peso</option>'+weights.map(w=>`<option value="${w}" ${String(w)===String(chosenKg)?'selected':''}>${w} kg</option>`).join('');if(water)weight.value='';window.refreshServicePrice();};
const openServiceFinal=window.openService;window.openService=function(){const result=openServiceFinal.apply(this,arguments);const hint=document.querySelector('#editForm #serviceExtRows')?.parentElement?.querySelector('.helper');if(hint)hint.textContent='Pesos disponíveis: pó químico ABC/BC — 4, 6, 8 ou 12 kg; CO₂ — 4, 6 ou 8 kg; água pressurizada — 10 L.';return result;};
const originalAddServiceExtRow=window.addServiceExtRow;window.addServiceExtRow=function(){const result=originalAddServiceExtRow.apply(this,arguments);const row=document.querySelector('#serviceExtRows .service-ext-row:last-child'),select=row?.querySelector('[name="extType"]');if(select){select.onchange=()=>window.serviceTypeChanged(select);window.serviceTypeChanged(select,arguments[1]||'');}return result;};
var isWaterExtinguisher=function(name){return /água|agua|pressurizada|10\s*l/i.test(String(name||''));};
var typeFor=function(name,kg){return (db.types||[]).find(t=>t.name===name&&(isWaterExtinguisher(name)||String(t.kg)===String(kg)))||null;};
var groupExtinguishers=function(items){const map=new Map();(items||[]).forEach((item,index)=>{const key=String(item.type||'Extintor')+'|'+String(item.kg||'');if(!map.has(key))map.set(key,{type:item.type||'Extintor',kg:item.kg||'',items:[],indexes:[]});const group=map.get(key);group.items.push(item);group.indexes.push(index);});return [...map.values()];};
// Handler único e delegado para os tipos no formulário de registro.
document.addEventListener('change',function(event){const typeSelect=event.target;if(!typeSelect.matches('#serviceExtRows select[name="extType"]'))return;const row=typeSelect.closest('.service-ext-row'),weight=row?.querySelector('select[name="extKg"]');if(!weight)return;const name=String(typeSelect.value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),isWater=/agua|pressurizada/.test(name),weights=/\b(co2|co₂|dioxido|carbono)\b/.test(name)?[4,6,8]:(/po|abc|bc|quimic/.test(name)?[4,6,8,12]:[]);weight.replaceChildren(new Option('Selecione o peso',''));for(const kg of weights)weight.add(new Option(kg+' kg',String(kg)));weight.disabled=isWater;weight.required=!isWater;row.querySelector('.service-weight')?.classList.toggle('hidden',isWater);if(isWater)weight.value='';if(typeof window.refreshServicePrice==='function')window.refreshServicePrice();},true);

;

;/* SOURCE: service-client-inline.js */
/* Register a client or seller from a service, then restore the service draft. */
(() => {
  const draftKey = 'protecextintores_service_contact_handoff';

  const style = document.createElement('style');
  style.textContent = `
    .service-draft-return{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px;padding:14px 16px;border:1px solid var(--ui-border,#c5d8e6);border-radius:12px;background:var(--ui-raised,#dce9f3);color:var(--ui-text,#20374a)}
    .service-draft-return p{margin:0;font-size:13px}
    .service-draft-return button{flex:none}
    @media(max-width:620px){.service-draft-return{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  function readDraft() {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || 'null'); }
    catch { return null; }
  }

  function captureServiceDraft(contactType) {
    const form = document.getElementById('editForm');
    if (!form) return {contactType};
    const read = name => form.querySelector(`[name="${name}"]`)?.value || '';
    const clientSelect = form.querySelector('[name="clientId"]');
    const sellerSelect = form.querySelector('[name="sellerId"]');
    const rows = [...document.querySelectorAll('#serviceExtRows .service-ext-row')].map(row => ({
      type: row.querySelector('[name="extType"]')?.value || '',
      kg: row.querySelector('[name="extKg"]')?.value || '',
      qty: row.querySelector('[name="extQty"]')?.value || '1'
    }));
    return {
      contactType,
      clientId: clientSelect?.value === '__create_client__' ? clientSelect.dataset.lastClientValue || '' : clientSelect?.value || '',
      sellerId: sellerSelect?.value === '__create_seller__' ? sellerSelect.dataset.lastSellerValue || '' : sellerSelect?.value || '',
      serviceType: read('serviceType'),
      date: read('date'),
      parts: read('parts'),
      notes: read('notes'),
      extraServicesDraft: window.captureServiceExtrasDraft?.() || null,
      rows
    };
  }

  function restoreServiceDraft(draft) {
    const form = document.getElementById('editForm');
    if (!form || !draft) return;
    for (const name of ['clientId', 'sellerId', 'serviceType', 'date', 'parts', 'notes']) {
      const control = form.querySelector(`[name="${name}"]`);
      if (control && draft[name] != null) control.value = draft[name];
    }
    const host = document.getElementById('serviceExtRows');
    if (!host) return;
    host.replaceChildren();
    const rows = Array.isArray(draft.rows) ? draft.rows : [];
    if (rows.length) rows.forEach(row => addServiceExtRow(row.type || '', row.kg || '', row.qty || 1));
    else addServiceExtRow();
    refreshServicePrice();
  }

  function showReturnBanner() {
    if (!readDraft()) return;
    const host = document.getElementById('content');
    if (!host || document.getElementById('serviceContactDraftReturn')) return;
    const banner = document.createElement('div');
    banner.id = 'serviceContactDraftReturn';
    banner.className = 'service-draft-return';
    banner.innerHTML = '<p>O serviço está salvo como rascunho enquanto você cadastra o contato.</p><button type="button" class="btn btn-small">Voltar ao serviço</button>';
    banner.querySelector('button').addEventListener('click', () => window.resumeServiceRegistration());
    host.prepend(banner);
  }

  function openContactRegistration(kind) {
    const isClient = kind === 'client';
    const collection = isClient ? 'clients' : 'sellers';
    const body = isClient
      ? `<div class="form-grid">
          ${field('Nome / Empresa','name',{required:true})}
          ${field('CPF / CNPJ','document')}
          ${field('Telefone','phone',{type:'tel'})}
          ${field('E-mail','email',{type:'email'})}
          ${field('Endereço','address',{cls:'span2'})}
          ${field('Observações','notes',{cls:'span2'})}
        </div><p class="helper">O cliente será salvo em Clientes e vendedores. Depois, o serviço será retomado com ele selecionado.</p>`
      : `<div class="form-grid">
          ${field('Nome completo','name',{required:true})}
          ${field('Telefone / WhatsApp','phone',{type:'tel'})}
          ${field('E-mail','email',{type:'email'})}
        </div><p class="helper">O vendedor será salvo em Clientes e vendedores. Depois, o serviço será retomado com ele selecionado.</p>`;

    openModal(isClient ? 'Cadastrar novo cliente' : 'Cadastrar novo vendedor', body, async form => {
      const contact = {
        id: id(),
        name: val(form, 'name'),
        phone: val(form, 'phone'),
        email: val(form, 'email')
      };
      if (isClient) {
        contact.document = val(form, 'document');
        contact.address = val(form, 'address');
        contact.notes = val(form, 'notes');
      }
      if (!contact.name || contact.name.length < 2) {
        toast('Informe o nome com pelo menos 2 caracteres.');
        return false;
      }

      db[collection] ||= [];
      db[collection].push(contact);
      if (!await save()) {
        db[collection] = db[collection].filter(item => item.id !== contact.id);
        saveLocal();
        return false;
      }
      renderPage();
      toast(isClient ? 'Cliente cadastrado. Retomando o serviço.' : 'Vendedor cadastrado. Retomando o serviço.');
      return {afterClose: () => window.resumeServiceRegistration(isClient ? contact.id : '', isClient ? '' : contact.id)};
    }, isClient ? 'Salvar cliente' : 'Salvar vendedor');
  }

  const originalOpenClient = window.openClient;
  window.openClient = function(...args) {
    if (readDraft()?.contactType === 'client') return openContactRegistration('client');
    return originalOpenClient.apply(this, args);
  };

  const originalOpenSeller = window.openSeller;
  window.openSeller = function(...args) {
    if (readDraft()?.contactType === 'seller') return openContactRegistration('seller');
    return originalOpenSeller.apply(this, args);
  };

  window.resumeServiceRegistration = function(clientId = '', sellerId = '') {
    const draft = readDraft();
    if (!draft) return;
    if (clientId) draft.clientId = clientId;
    if (sellerId) draft.sellerId = sellerId;
    sessionStorage.removeItem(draftKey);
    go('services');
    setTimeout(() => window.openService(draft), 60);
  };

  function openContactPageFromService(kind) {
    sessionStorage.setItem(draftKey, JSON.stringify(captureServiceDraft(kind)));
    closeModal();
    go('clients');
    setTimeout(() => {
      showReturnBanner();
      if (kind === 'seller') window.openSeller();
      else window.openClient();
    }, 60);
  }

  function installContactOptions() {
    const form = document.getElementById('editForm');
    const clientSelect = form?.querySelector('select[name="clientId"]');
    const sellerSelect = form?.querySelector('select[name="sellerId"]');
    if (!form) return;

    if (clientSelect && ![...clientSelect.options].some(option => option.value === '__create_client__')) {
      clientSelect.add(new Option('+ Cadastrar cliente', '__create_client__'));
      clientSelect.dataset.lastClientValue = clientSelect.value;
      clientSelect.addEventListener('change', () => {
        if (clientSelect.value === '__create_client__') {
          clientSelect.value = clientSelect.dataset.lastClientValue || '';
          openContactPageFromService('client');
          return;
        }
        clientSelect.dataset.lastClientValue = clientSelect.value;
      });
    }

    if (sellerSelect && ![...sellerSelect.options].some(option => option.value === '__create_seller__')) {
      sellerSelect.add(new Option('+ Cadastrar vendedor', '__create_seller__'));
      sellerSelect.dataset.lastSellerValue = sellerSelect.value;
      sellerSelect.addEventListener('change', () => {
        if (sellerSelect.value === '__create_seller__') {
          sellerSelect.value = sellerSelect.dataset.lastSellerValue || '';
          openContactPageFromService('seller');
          return;
        }
        sellerSelect.dataset.lastSellerValue = sellerSelect.value;
      });
    }
  }

  const originalOpenService = window.openService;
  window.openService = function(draft, ...args) {
    const result = originalOpenService.apply(this, args);
    installContactOptions();
    if (draft && typeof draft === 'object') restoreServiceDraft(draft);
    return result;
  };

  const originalGo = window.go;
  window.go = function(target, ...args) {
    const result = originalGo.call(this, target, ...args);
    if (target === 'clients') setTimeout(showReturnBanner, 0);
    return result;
  };
})();

;

;/* SOURCE: service-extra-options.js */
/* Optional fire-safety work attached to a service order. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .service-extra-section{grid-column:1/-1;margin:8px 0 18px;padding:16px;border:1px solid var(--ui-border,#c5d8e6);border-radius:14px;background:var(--ui-panel,#f9fcff)}
    .service-extra-section>h3{margin:0 0 5px;font-size:14px}
    .service-extra-section>.helper{margin:0 0 12px}
    .service-extra-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .service-extra-card{min-width:0;padding:12px;border:1px solid var(--ui-border,#c5d8e6);border-radius:11px;background:var(--ui-panel,#f9fcff)}
    .service-extra-choice{display:flex;align-items:flex-start;gap:9px;cursor:pointer;font-size:12px;font-weight:700}
    .service-extra-choice input{width:17px;height:17px;flex:none;margin:1px 0 0;accent-color:var(--ui-accent,#226b99)}
    .service-extra-choice span{display:grid;gap:3px}
    .service-extra-choice small{color:var(--ui-muted,#526b80);font-size:10px;font-weight:400;line-height:1.4}
    .service-extra-details{padding-top:10px}
    .service-extra-details .form-field{margin:8px 0}
    .service-extra-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 10px}
    .service-extra-line{display:grid;grid-template-columns:repeat(4,minmax(72px,1fr)) auto;align-items:end;gap:8px;margin:0 0 9px}
    .service-extra-line .form-field{min-width:0;margin:0}
    .service-extra-line .form-field label{font-size:10px}
    .service-extra-remove{min-height:38px;padding:7px 11px;border:1px solid var(--ui-border,#c5d8e6);border-radius:9px;background:var(--ui-raised,#dce9f3);color:var(--ui-muted,#526b80);font-weight:700;white-space:nowrap}
    .service-extra-add{margin-top:4px}
    @media(max-width:680px){.service-extra-grid{grid-template-columns:1fr}.service-extra-line{grid-template-columns:repeat(2,minmax(0,1fr))}.service-extra-remove{grid-column:1/-1;width:100%}}
  `;
  document.head.appendChild(style);

  const panelMarkup = `
    <h3>Serviços complementares (opcionais)</h3>
    <p class="helper">Marque somente o que será realizado. Medidas de mangueiras aceitam valores personalizados.</p>
    <div class="service-extra-grid">
      <article class="service-extra-card" data-extra-card="hydrant-hose-test">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Testar mangueira de hidrante<small>Informe o tipo ou classe, diâmetro e comprimento. As medidas aceitam qualquer valor.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="hydrant-hose-test"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar mangueira</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="demarcation">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Aplicar faixa de demarcação<small>Registre cor e medidas para execução.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Cor</label><select data-field="color"><option value="Amarela">Amarela</option><option value="Vermelha">Vermelha</option><option value="Branca">Branca</option><option value="Outra">Outra</option></select></div>
          <div class="form-field hidden" data-other-color><label>Informe a cor</label><input data-field="otherColor" type="text"></div>
          <div class="form-field"><label>Comprimento (m)</label><input data-field="lengthMeters" type="number" min="0.1" step="any" placeholder="Metros"></div>
          <div class="form-field"><label>Largura (cm), se aplicável</label><input data-field="widthCm" type="number" min="0.1" step="any" placeholder="Centímetros"></div>
        </div><div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div></div>
      </article>
      <article class="service-extra-card" data-extra-card="wall-support">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar suporte de parede</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="floor-stand">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar suporte de piso</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="extinguisher-hose">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar mangueira de extintor<small>Adicione uma ou mais mangueiras por agente.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="extinguisher-hose"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar mangueira</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="diffuser">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar difusor de extintor<small>Adicione um ou mais tipos.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="diffuser"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar difusor</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="hydrant-cabinet">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar ou instalar abrigo de hidrante</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="safety-signage">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar placas de sinalização<small>Saídas, extintores, hidrantes, alarmes e placas personalizadas.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="safety-signage"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar placa</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="pressure-gauge">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar manômetro</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="valve">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar ou revisar válvula</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Tipo / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="hydrant-accessories">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar acessório de hidrante<small>Esguicho, adaptador, chave ou tampão Storz.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="hydrant-accessories"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar acessório</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="extinguisher-wheels">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar rodas / carrinho para extintor</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="emergency-light">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar iluminação de emergência</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="other-work">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Outro serviço complementar</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Descreva o serviço</label><input data-field="description" type="text"></div>
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
        </div></div>
      </article>
    </div>`;

  function hydrantLine() {
    return `<div class="service-extra-line" data-extra-line>
      <div class="form-field"><label>Tipo / modelo</label><input data-field="type" type="text" placeholder="Conforme identificação da mangueira"></div>
      <div class="form-field"><label>Diâmetro (mm)</label><input data-field="diameterMm" type="number" min="0.1" step="any" placeholder="mm"></div>
      <div class="form-field"><label>Comprimento (m)</label><input data-field="lengthMeters" type="number" min="0.1" step="any" placeholder="m"></div>
      <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
      <button type="button" class="service-extra-remove" data-remove-line aria-label="Remover mangueira de hidrante">Remover mangueira</button>
    </div>`;
  }

  function selectLine(kind) {
    const isHose = kind === 'extinguisher-hose';
    const isHydrantAccessory = kind === 'hydrant-accessories';
    const isSignage = kind === 'safety-signage';
    const options = isSignage
      ? [['','Selecione a placa'],['Saída','Saída'],['Saída de emergência','Saída de emergência'],['Rota de fuga','Rota de fuga'],['Extintor de incêndio','Extintor de incêndio'],['Extintor de pó químico ABC','Extintor de pó químico ABC'],['Extintor de pó químico BC','Extintor de pó químico BC'],['Extintor de CO₂','Extintor de CO₂'],['Extintor de água','Extintor de água'],['Hidrante','Hidrante'],['Alarme de incêndio','Alarme de incêndio'],['Acionador manual','Acionador manual'],['Ponto de encontro','Ponto de encontro'],['Proibido fumar','Proibido fumar'],['Não utilize elevador','Não utilize elevador'],['Porta corta-fogo','Porta corta-fogo'],['Risco elétrico','Risco elétrico'],['Outra','Outra']]
      : isHydrantAccessory
      ? [['','Selecione o acessório'],['Esguicho regulável','Esguicho regulável'],['Esguicho jato sólido','Esguicho jato sólido'],['Adaptador Storz','Adaptador Storz'],['Chave Storz','Chave Storz'],['Tampão Storz','Tampão Storz'],['Outro','Outro']]
      : isHose
      ? [['','Selecione o agente'],['Pó químico ABC','Pó químico ABC'],['Pó químico BC','Pó químico BC'],['Água pressurizada','Água pressurizada'],['CO₂','CO₂'],['Outro','Outro']]
      : [['','Selecione o tipo'],['Pó químico ABC/BC','Pó químico ABC/BC'],['Água','Água'],['CO₂','CO₂'],['Outro','Outro']];
    const label = isSignage ? 'Placa' : isHydrantAccessory ? 'Acessório' : isHose ? 'Mangueira' : 'Difusor';
    return `<div class="service-extra-line" data-extra-line>
      <div class="form-field"><label>${label}</label><select data-field="type">${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></div>
      <div class="form-field hidden" data-other-type><label>Informe o tipo</label><input data-field="otherType" type="text"></div>
      <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
      ${isSignage ? '<div class="form-field"><label>Local de instalação</label><input data-field="location" type="text" placeholder="Ex.: corredor, recepção"></div>' : ''}
      <button type="button" class="service-extra-remove" data-remove-line aria-label="Remover ${label.toLocaleLowerCase('pt-BR')}">Remover ${label.toLocaleLowerCase('pt-BR')}</button>
    </div>`;
  }

  function addLine(card, kind) {
    const list = card.querySelector(`[data-extra-list="${kind}"]`);
    if (!list) return;
    const holder = document.createElement('div');
    holder.innerHTML = kind === 'hydrant-hose-test' ? hydrantLine() : selectLine(kind);
    const line = holder.firstElementChild;
    line.querySelector('[data-remove-line]').addEventListener('click', () => {
      line.remove();
      if (!list.querySelector('[data-extra-line]')) {
        const toggle = card.querySelector('[data-extra-toggle]');
        if (toggle?.checked) { toggle.checked = false; toggle.dispatchEvent(new Event('change', {bubbles:true})); }
      }
      window.refreshServicePrice();
    });
    line.querySelector('[data-field="type"]')?.addEventListener('change', event => {
      const other = line.querySelector('[data-other-type]');
      if (other) other.classList.toggle('hidden', event.target.value !== 'Outro');
    });
    list.appendChild(line);
  }

  function addAmountFields(section) {
    section.querySelectorAll('[data-extra-card]').forEach(card => {
      const details = card.querySelector('[data-extra-details]');
      if (!details || details.querySelector('[data-field="amount"]')) return;
      const field = document.createElement('div');
      field.className = 'form-field';
      field.innerHTML = '<label>Valor total adicional (R$), se aplicável</label><input data-field="amount" type="number" min="0" step="0.01" value="0">';
      details.appendChild(field);
    });
  }

  function install(form) {
    if (!form || form.querySelector('.service-extra-section')) return;
    const section = document.createElement('section');
    section.className = 'form-field span2 service-extra-section';
    section.innerHTML = panelMarkup;
    addAmountFields(section);
    const serviceTypeField = form.querySelector('[name="serviceType"]')?.closest('.form-field');
    const rows = form.querySelector('#serviceExtRows')?.closest('.form-field');
    (rows || serviceTypeField || form.querySelector('.form-grid')).insertAdjacentElement(rows ? 'afterend' : 'beforebegin', section);

    section.querySelectorAll('[data-extra-card]').forEach(card => {
      const toggle = card.querySelector('[data-extra-toggle]');
      const details = card.querySelector('[data-extra-details]');
      const kind = card.dataset.extraCard;
      toggle.addEventListener('change', () => {
        details.classList.toggle('hidden', !toggle.checked);
        if (toggle.checked && ['hydrant-hose-test','extinguisher-hose','diffuser','hydrant-accessories','safety-signage'].includes(kind) && !card.querySelector('[data-extra-line]')) addLine(card, kind);
      });
      card.querySelector('[data-extra-add]')?.addEventListener('click', () => addLine(card, kind));
      card.querySelector('[data-field="color"]')?.addEventListener('change', event => {
        card.querySelector('[data-other-color]')?.classList.toggle('hidden', event.target.value !== 'Outra');
      });
    });
    section.addEventListener('input', event => { if (event.target.matches('[data-field="amount"]')) window.refreshServicePrice(); });
    section.addEventListener('change', event => { if (event.target.matches('[data-extra-toggle]')) window.refreshServicePrice(); });
    window.refreshServicePrice();
    bindSubmit(form);
  }

  function readNumber(card, field) {
    return Number(card.querySelector(`[data-field="${field}"]`)?.value || 0);
  }

  function collectExtras(form) {
    const items = [];
    for (const card of form.querySelectorAll('[data-extra-card]')) {
      if (!card.querySelector('[data-extra-toggle]')?.checked) continue;
      const code = card.dataset.extraCard;
      const val = name => card.querySelector(`[data-field="${name}"]`)?.value.trim() || '';
      const positiveQty = () => Math.max(1, Math.floor(readNumber(card, 'quantity') || 1));
      const price = Math.max(0,readNumber(card,'amount'));
      if (code === 'hydrant-hose-test') {
        const lines = [...card.querySelectorAll('[data-extra-line]')].map(line => ({
          type: line.querySelector('[data-field="type"]')?.value.trim() || '',
          diameterMm: Number(line.querySelector('[data-field="diameterMm"]')?.value || 0),
          lengthMeters: Number(line.querySelector('[data-field="lengthMeters"]')?.value || 0),
          quantity: Math.max(1, Math.floor(Number(line.querySelector('[data-field="quantity"]')?.value || 1)))
        }));
        if (!lines.length || lines.some(line => !line.type || line.diameterMm <= 0 || line.lengthMeters <= 0)) return {items,error:'Informe tipo, diâmetro e comprimento de cada mangueira de hidrante.'};
        items.push({code,title:'Teste de mangueira de hidrante',lines,price});
      } else if (code === 'extinguisher-hose' || code === 'diffuser' || code === 'hydrant-accessories' || code === 'safety-signage') {
        const lines = [...card.querySelectorAll('[data-extra-line]')].map(line => ({
          type: line.querySelector('[data-field="type"]')?.value || '',
          otherType: line.querySelector('[data-field="otherType"]')?.value.trim() || '',
          location: line.querySelector('[data-field="location"]')?.value.trim() || '',
          quantity: Math.max(1, Math.floor(Number(line.querySelector('[data-field="quantity"]')?.value || 1)))
        }));
        const label = code === 'safety-signage' ? 'placa' : code === 'diffuser' ? 'difusor' : code === 'hydrant-accessories' ? 'acessório' : 'mangueira';
        if (!lines.length || lines.some(line => !line.type || (line.type === 'Outro' && !line.otherType))) return {items,error:`Selecione o tipo de ${label} ou informe o tipo personalizado.`};
        const title = code === 'safety-signage' ? 'Placa de sinalização' : code === 'diffuser' ? 'Difusor de extintor' : code === 'hydrant-accessories' ? 'Acessório de hidrante' : 'Mangueira de extintor';
        items.push({code,title,lines,price});
      } else if (code === 'demarcation') {
        const lengthMeters = readNumber(card, 'lengthMeters');
        if (lengthMeters <= 0) return {items,error:'Informe o comprimento da faixa de demarcação.'};
        const color = val('color') === 'Outra' ? val('otherColor') : val('color');
        if (!color) return {items,error:'Informe a cor da faixa de demarcação.'};
        items.push({code,title:'Faixa de demarcação',details:{color,lengthMeters,widthCm:readNumber(card,'widthCm')||'',notes:val('notes')},price});
      } else if (code === 'other-work') {
        if (val('description').length < 2) return {items,error:'Descreva o outro serviço complementar.'};
        items.push({code,title:val('description'),quantity:positiveQty(),price});
      } else {
        const titleMap={'wall-support':'Suporte de parede','floor-stand':'Suporte de piso','hydrant-cabinet':'Abrigo de hidrante','safety-signage':'Placa de sinalização','pressure-gauge':'Manômetro','valve':'Válvula','extinguisher-wheels':'Rodas / carrinho de extintor','emergency-light':'Iluminação de emergência'};
        items.push({code,title:titleMap[code]||'Serviço complementar',quantity:positiveQty(),details:{notes:val('notes')},price});
      }
    }
    return {items,error:''};
  }

  function bindSubmit(form) {
    if (form.dataset.extraServicesBound) return;
    const originalSubmit = form.onsubmit;
    if (typeof originalSubmit !== 'function') return;
    form.dataset.extraServicesBound = 'true';
    form.onsubmit = async function(event) {
      const result = collectExtras(form);
      if (result.error) {
        event.preventDefault();
        toast(result.error);
        return false;
      }
      const serviceList = db.services;
      const originalPush = serviceList.push;
      serviceList.push = function(...services) {
        const extrasTotal = result.items.reduce((sum,item)=>sum+Number(item.price||0),0);
        services.forEach(service => {
          if (service && typeof service === 'object') {
            service.extraServices = result.items;
            service.price = Math.round((Number(service.price||0)+extrasTotal)*100)/100;
          }
        });
        return originalPush.apply(this, services);
      };
      try { return await originalSubmit.call(this, event); }
      finally { serviceList.push = originalPush; }
    };
  }

  window.captureServiceExtrasDraft = function() {
    const form = document.getElementById('editForm');
    const section = form?.querySelector('.service-extra-section');
    if (!section) return null;
    return [...section.querySelectorAll('[data-extra-card]')].map(card => ({
      code:card.dataset.extraCard,
      checked:Boolean(card.querySelector('[data-extra-toggle]')?.checked),
      values:[...card.querySelectorAll('[data-field]')].map(field => ({
        key:field.dataset.field,
        value:field.value,
        line:field.closest('[data-extra-line]')?.sectionIndex ?? [...card.querySelectorAll('[data-extra-line]')].indexOf(field.closest('[data-extra-line]'))
      }))
    }));
  };

  const originalRefreshServicePrice = window.refreshServicePrice;
  window.refreshServicePrice = function(...args) {
    const result = originalRefreshServicePrice.apply(this,args);
    const form = document.getElementById('editForm');
    const section = form?.querySelector('.service-extra-section');
    if (!section) return result;
    const extraTotal = [...section.querySelectorAll('[data-extra-card]')].reduce((sum,card) => {
      if (!card.querySelector('[data-extra-toggle]')?.checked) return sum;
      return sum + Math.max(0,Number(card.querySelector('[data-field="amount"]')?.value||0));
    },0);
    const input = form.querySelector('[name="price"]');
    const display = form.querySelector('#serviceTotal');
    const total = (Number(input?.value||0)+extraTotal);
    if (input) input.value = total.toFixed(2);
    if (display) display.textContent = money(total);
    return result;
  };

  window.restoreServiceExtrasDraft = function(draft) {
    const form = document.getElementById('editForm');
    const section = form?.querySelector('.service-extra-section');
    if (!section || !Array.isArray(draft)) return;
    for (const savedCard of draft) {
      const card = section.querySelector(`[data-extra-card="${savedCard.code}"]`);
      if (!card) continue;
      const toggle = card.querySelector('[data-extra-toggle]');
      if (toggle) { toggle.checked = Boolean(savedCard.checked); toggle.dispatchEvent(new Event('change')); }
      const lineValues = new Map();
      for (const item of savedCard.values || []) {
        const index = Number(item.line);
        if (Number.isInteger(index) && index >= 0) {
          if (!lineValues.has(index)) lineValues.set(index, []);
          lineValues.get(index).push(item);
        } else {
          const field = [...card.querySelectorAll('[data-field]')].find(element => element.dataset.field === item.key && !element.closest('[data-extra-line]'));
          if (field) field.value = item.value;
        }
      }
      for (const [index, values] of lineValues) {
        let lines = [...card.querySelectorAll('[data-extra-line]')];
        const kind = card.dataset.extraCard;
        while (lines.length <= index) { addLine(card, kind); lines = [...card.querySelectorAll('[data-extra-line]')]; }
        for (const item of values) {
          const field = [...lines[index].querySelectorAll('[data-field]')].find(element => element.dataset.field === item.key);
          if (field) { field.value = item.value; field.dispatchEvent(new Event('change')); }
        }
      }
    }
  };

  function describeExtra(item) {
    const parts = [];
    if (Array.isArray(item.lines)) {
      item.lines.forEach(line => {
        if (item.code === 'hydrant-hose-test') parts.push(`${line.type} · ${line.diameterMm} mm · ${line.lengthMeters} m · qtd. ${line.quantity}`);
        else parts.push(`${line.type === 'Outro' ? line.otherType : line.type} · qtd. ${line.quantity}${line.location ? ` · local: ${line.location}` : ''}`);
      });
    }
    if (item.details) {
      const names={color:'Cor',lengthMeters:'Comprimento (m)',widthCm:'Largura (cm)',notes:'Local / observações'};
      Object.entries(item.details).forEach(([key,value]) => { if (value !== '' && value != null) parts.push(`${names[key]||key}: ${value}`); });
    }
    if (item.quantity) parts.push(`Quantidade: ${item.quantity}`);
    if (Number(item.price||0)>0) parts.push(`Valor: ${money(item.price)}`);
    return parts.join(' | ');
  }

  function appendExtras(container, service, heading) {
    const extras = service?.extraServices || [];
    if (!container || !extras.length || container.querySelector('.saved-service-extras')) return;
    const section = document.createElement('section');
    section.className = 'saved-service-extras';
    section.style.cssText = 'margin-top:18px;padding:14px;border:1px solid var(--ui-border,#c5d8e6);border-radius:10px;background:var(--ui-panel,#f9fcff)';
    const title = document.createElement('h3'); title.textContent = heading; title.style.cssText = 'margin:0 0 8px;font-size:14px'; section.appendChild(title);
    const list = document.createElement('ul'); list.style.cssText = 'margin:0;padding-left:20px';
    extras.forEach(item => { const li = document.createElement('li'); li.style.cssText = 'margin:5px 0'; li.textContent = [item.title,describeExtra(item)].filter(Boolean).join(' — '); list.appendChild(li); });
    section.appendChild(list);
    const footer = container.querySelector('.receipt-footer');
    if (footer) footer.before(section); else container.appendChild(section);
  }

  const originalOpenService = window.openService;
  window.openService = function(draft, ...args) {
    const result = originalOpenService.apply(this, [draft, ...args]);
    const form = document.getElementById('editForm');
    if (!form) return result;
    const section = document.createElement('section');
    section.className = 'form-field span2 service-extra-section';
    section.innerHTML = panelMarkup;
    addAmountFields(section);
    const extinguisherField = form.querySelector('#serviceExtRows')?.closest('.form-field');
    const serviceTypeField = form.querySelector('[name="serviceType"]')?.closest('.form-field');
    const insertAfter = extinguisherField || serviceTypeField;
    if (insertAfter) insertAfter.insertAdjacentElement(extinguisherField ? 'afterend' : 'beforebegin', section);
    section.querySelectorAll('[data-extra-card]').forEach(card => {
      const toggle = card.querySelector('[data-extra-toggle]');
      const details = card.querySelector('[data-extra-details]');
      const kind = card.dataset.extraCard;
      toggle.addEventListener('change', () => {
        details.classList.toggle('hidden', !toggle.checked);
        if (toggle.checked && ['hydrant-hose-test','extinguisher-hose','diffuser','hydrant-accessories','safety-signage'].includes(kind) && !card.querySelector('[data-extra-line]')) addLine(card, kind);
      });
      card.querySelector('[data-extra-add]')?.addEventListener('click', () => addLine(card, kind));
      card.querySelector('[data-field="color"]')?.addEventListener('change', event => card.querySelector('[data-other-color]')?.classList.toggle('hidden', event.target.value !== 'Outra'));
    });
    section.addEventListener('input', event => { if (event.target.matches('[data-field="amount"]')) window.refreshServicePrice(); });
    section.addEventListener('change', event => { if (event.target.matches('[data-extra-toggle]')) window.refreshServicePrice(); });
    bindSubmit(form);
    if (draft?.extraServicesDraft) window.restoreServiceExtrasDraft(draft.extraServicesDraft);
    window.refreshServicePrice();
    return result;
  };

  const originalServiceOrder = window.serviceOrder;
  window.serviceOrder = function(serviceId, ...args) {
    const result = originalServiceOrder.apply(this, [serviceId, ...args]);
    const service = (db.services || []).find(item => item.id === serviceId);
    appendExtras(document.querySelector('.service-order'), service, 'Serviços complementares');
    return result;
  };

  const originalShowReceipt = window.showServiceReceipt;
  window.showServiceReceipt = function(serviceId, ...args) {
    const result = originalShowReceipt.apply(this, [serviceId, ...args]);
    const service = (db.services || []).find(item => item.id === serviceId);
    appendExtras(document.querySelector('.receipt-paper'), service, 'Serviços complementares realizados');
    return result;
  };

  const employeeExtrasByCode = new Map();
  function rememberEmployeeServices(services) {
    (services || []).forEach(service => {
      if (service.code) employeeExtrasByCode.set(service.code, service.extraServices || []);
    });
  }
  function renderEmployeeExtras() {
    document.querySelectorAll('#employeePortal .employee-service').forEach(card => {
      const code = card.querySelector('.employee-service-head b')?.textContent.trim();
      const extras = employeeExtrasByCode.get(code) || [];
      const body = card.querySelector('.employee-work, .employee-service-body');
      if (!body || !extras.length || body.querySelector('.employee-extra-summary')) return;
      const summary = document.createElement('section');
      summary.className = 'employee-extra-summary';
      summary.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid var(--ui-border,#c5d8e6);border-radius:10px;background:var(--ui-panel,#f9fcff)';
      const heading = document.createElement('strong'); heading.textContent = 'Serviços complementares'; heading.style.cssText = 'font-size:12px'; summary.appendChild(heading);
      const list = document.createElement('ul'); list.style.cssText = 'margin:6px 0 0;padding-left:18px;font-size:11px';
      extras.forEach(item => { const line = document.createElement('li'); line.textContent = [item.title,describeExtra(item)].filter(Boolean).join(' — '); list.appendChild(line); });
      summary.appendChild(list);
      body.appendChild(summary);
    });
  }

  const originalApiCall = window.apiCall;
  window.apiCall = async function(path, ...args) {
    const response = await originalApiCall.call(this, path, ...args);
    if (response.ok && (path === '/api/login' || path === '/api/employee/services')) {
      try {
        const data = await response.clone().json();
        if (path === '/api/login' && data.role === 'employee') rememberEmployeeServices(data.services);
        if (path === '/api/employee/services') rememberEmployeeServices(data.services);
        renderEmployeeExtras();
      } catch {}
    }
    return response;
  };

  const employeeCardsHost = document.getElementById('employeePortal');
  if (employeeCardsHost) new MutationObserver(renderEmployeeExtras).observe(employeeCardsHost,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('employeePortal');
    if (host) new MutationObserver(renderEmployeeExtras).observe(host,{childList:true,subtree:true});
  }, {once:true});
})();

;

;/* SOURCE: site-info.js */
/* Dados da empresa, WhatsApp, confiança e perguntas frequentes. Tudo vem de config.js (window.PROTEC_EMPRESA). */
(() => {
  const info = Object.assign({destaques:[],certificacoes:[],avaliacoes:[],precosAPartirDe:{}}, window.PROTEC_EMPRESA || {});
  const digits = value => String(value || '').replace(/\D/g, '');
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value; else if (value !== false && value != null) node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };

  const whatsapp = digits(info.whatsapp);
  window.fogoWhatsAppLink = (message = 'Olá! Vim pelo site da ProtecExtintores e gostaria de um orçamento.') =>
    whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}` : '';

  const store = document.getElementById('store');
  if (!store) return;

  // Cartão da página inicial: horário real, ou uma frase neutra quando não há horário.
  const status = document.getElementById('heroStatus');
  if (status && info.horario) status.textContent = 'Atendimento ' + info.horario;

  // Três fatos sob o título (ficam os padrões do HTML se o config não trouxer nenhum).
  const trust = document.getElementById('heroTrust');
  if (trust && info.destaques.length) {
    trust.replaceChildren(...info.destaques.slice(0, 3).map(([title, detail]) =>
      el('span', {}, [el('b', {text: title}), detail ? el('small', {text: ' ' + detail}) : null])));
  }

  // Botão fixo de WhatsApp.
  const link = window.fogoWhatsAppLink();
  if (link) {
    const icon = '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.04 3C9.4 3 4 8.38 4 15c0 2.27.64 4.4 1.75 6.2L4 29l8.02-1.7A12.1 12.1 0 0 0 16.04 27C22.66 27 28 21.62 28 15S22.66 3 16.04 3Zm0 21.9c-1.2 0-2.37-.3-3.4-.86l-.5-.27-4.76 1 1.02-4.6-.3-.5A9.7 9.7 0 0 1 6.3 15c0-5.3 4.4-9.6 9.74-9.6S25.7 9.7 25.7 15s-4.4 9.9-9.66 9.9Zm5.3-7.26c-.3-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.2.3-.74.94-.9 1.13-.17.2-.33.22-.62.07-.3-.15-1.2-.44-2.3-1.4-.85-.76-1.42-1.7-1.6-1.98-.16-.3-.02-.45.13-.6l.43-.5c.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.65-1.57-.9-2.14-.23-.56-.47-.48-.65-.49h-.55c-.2 0-.5.07-.76.37s-1 .98-1 2.4 1.03 2.77 1.17 2.96c.15.2 2.03 3.1 4.9 4.34.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.56-.35Z"/></svg>';
    const button = el('a', {class: 'wa-float', href: link, target: '_blank', rel: 'noopener', 'aria-label': 'Falar com a equipe no WhatsApp'});
    button.innerHTML = icon + '<span>WhatsApp</span>';
    store.append(button);
  }

  // Dados no rodapé.
  const footer = document.getElementById('footerContact');
  if (footer) {
    const rows = [];
    if (info.horario) rows.push(el('span', {text: 'Atendimento: ' + info.horario}));
    if (info.areaAtendida) rows.push(el('span', {text: 'Área atendida: ' + info.areaAtendida}));
    if (info.endereco) rows.push(el('a', {href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(info.endereco), target: '_blank', rel: 'noopener', text: info.endereco}));
    if (info.telefone) rows.push(el('a', {href: 'tel:+' + (digits(info.telefone).startsWith('55') ? '' : '55') + digits(info.telefone), text: info.telefone}));
    if (link) rows.push(el('a', {href: link, target: '_blank', rel: 'noopener', text: 'WhatsApp'}));
    if (info.email) rows.push(el('a', {href: 'mailto:' + info.email, text: info.email}));
    if (info.instagram) rows.push(el('a', {href: 'https://instagram.com/' + String(info.instagram).replace(/^@/, ''), target: '_blank', rel: 'noopener', text: 'Instagram @' + String(info.instagram).replace(/^@/, '')}));
    if (info.cnpj) rows.push(el('span', {text: 'CNPJ ' + info.cnpj}));
    if (rows.length) { footer.replaceChildren(...rows); footer.hidden = false; }
  }

  // "A partir de" nos cartões de serviço.
  for (const [code, price] of Object.entries(info.precosAPartirDe || {})) {
    const label = document.querySelector(`[data-customer-service="${CSS.escape(code)}"] .customer-service-choice span`);
    if (label && price) label.append(el('em', {class: 'price-from', text: 'a partir de ' + price}));
  }


  // Ícones reais nos três cartões (antes eram "01/02/03", que não indicam sequência).
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const icons = [
    svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
    svg('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>'),
    svg('<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-5.2A8 8 0 1 1 21 12z"/>')
  ];
  document.querySelectorAll('#servicos .feature-icon').forEach((node, i) => { if (icons[i]) node.innerHTML = icons[i]; });

  // Seções da página inicial: como funciona, confiança e perguntas frequentes.
  const anchor = document.getElementById('servicos');
  if (!anchor) return;
  const go = (page, text, cls = 'btn btn-small') => {
    const a = el('a', {href: '#', class: cls, text});
    a.addEventListener('click', event => { event.preventDefault(); window.showPublicPage?.(page); });
    return a;
  };
  const section = (id, title, intro, body) => {
    const node = el('section', {class: 'section home-extra public-view', 'data-public-page': 'home', id}, [
      el('div', {class: 'section-head'}, [el('div', {}, [el('h2', {text: title}), intro ? el('p', {text: intro}) : null])]), body]);
    if (document.querySelector('.hero.active')) node.classList.add('active');
    return node;
  };
  const sections = [];

  sections.push(section('como-funciona', 'Como funciona', 'Do pedido ao serviço concluído, sem precisar criar conta.',
    el('ol', {class: 'how-steps'}, [
      ['Peça o orçamento', 'Escolha o serviço e informe seu nome e WhatsApp. Leva poucos minutos.'],
      ['A equipe confirma', 'Combinamos endereço, visita e valores. Nada é agendado nem cobrado antes disso.'],
      ['Acompanhe pelo código', 'Você recebe um código e vê cada etapa do serviço na aba Acompanhar.']
    ].map(([title, text]) => el('li', {}, [el('h3', {text: title}), el('p', {text})])))));

  if (info.certificacoes.length) {
    sections.push(section('certificacoes', 'Certificações e normas', null,
      el('ul', {class: 'proof-list'}, info.certificacoes.map(item => el('li', {text: String(item)})))));
  }
  if (info.avaliacoes.length) {
    sections.push(section('avaliacoes', 'O que dizem os clientes', null,
      el('div', {class: 'proof-quotes'}, info.avaliacoes.slice(0, 5).map(item => el('figure', {}, [
        el('blockquote', {text: item.texto}),
        el('figcaption', {text: [item.nome, item.empresa].filter(Boolean).join(' — ')})])))));
  }

  const faq = [
    ['Preciso criar conta para pedir orçamento?', 'Não. Para o orçamento você informa só nome e WhatsApp. A conta é necessária apenas para comprar na loja e guardar seu histórico de pedidos.'],
    ['Enviar o pedido já agenda ou cobra alguma coisa?', 'Não. O pedido apenas avisa a equipe. Endereço, visita e valores são confirmados com você antes de qualquer serviço.'],
    ['De quanto em quanto tempo o extintor precisa de recarga?', 'Em geral, a cada 12 meses para extintores de pó químico e de água, com inspeções periódicas no intervalo. O teste hidrostático costuma ser exigido a cada 5 anos. A data exata está na etiqueta do seu extintor e depende do tipo e do fabricante.'],
    ['O que acontece se o extintor vencer?', 'Com o prazo vencido, o extintor deixa de ter garantia de funcionamento e pode ser apontado em vistorias, como as do Corpo de Bombeiros ou do seguro. O ideal é pedir a recarga antes da data de vencimento.'],
    ['Como acompanho meu serviço?', 'Ao enviar o pedido você recebe um código, como FS-A1B2C3. Digite esse código na aba Acompanhar para ver em que etapa o serviço está.'],
    ['Quais serviços vocês fazem?', 'Recarga e manutenção de extintores, instalação, suportes de parede e de piso, faixas de demarcação, placas de sinalização, teste de mangueira de hidrante, abrigos e acessórios de hidrante e iluminação de emergência.']
  ];
  const faqList = el('div', {class: 'faq-list'}, faq.map(([question, answer]) =>
    el('details', {}, [el('summary', {text: question}), el('p', {text: answer})])));
  const faqFoot = el('div', {class: 'faq-foot'}, [go('service', 'Pedir orçamento', 'btn')]);
  if (link) faqFoot.append(el('a', {class: 'btn btn-soft', href: link, target: '_blank', rel: 'noopener', text: 'Tirar dúvidas no WhatsApp'}));
  sections.push(section('perguntas', 'Perguntas frequentes', null, el('div', {}, [faqList, faqFoot])));

  anchor.after(...sections);
})();

;

;/* SOURCE: cart-customer-access.js */
/* Require an authenticated customer account for shopping cart actions. */
(() => {
  const teamRoles = new Set(['admin', 'employee', 'seller']);
  const isTeamAccount = () => teamRoles.has(localStorage.getItem('protecextintores_role')) || teamRoles.has(sessionStorage.getItem('protecextintores_role'));
  window.customerAccountState = window.customerAccountState || {authenticated:false,customer:null,token:''};
  const isCustomer = () => Boolean(window.customerAccountState.authenticated && window.customerAccountState.token && !isTeamAccount());

  function syncCartAccess() {
    const team = isTeamAccount();
    const customer = isCustomer();
    document.querySelectorAll('#publicProducts .product-foot > button').forEach(button => {
      const label = customer ? 'Adicionar ao carrinho' : 'Entrar para comprar';
      const disabled = team || db.settings.shopEnabled === false;
      // Só escreve quando o valor muda: reescrever textContent (mesmo igual) gera
      // mutação de childList e fazia o MutationObserver abaixo entrar em loop infinito.
      if (button.hidden !== team) button.hidden = team;
      if (button.disabled !== disabled) button.disabled = disabled;
      if (button.textContent !== label) button.textContent = label;
      if (button.getAttribute('aria-hidden') !== String(team)) button.setAttribute('aria-hidden', String(team));
    });
    const cartButton = document.getElementById('customerCartButton');
    if (cartButton && cartButton.hidden === customer) cartButton.hidden = !customer;
    const cartCount = document.getElementById('cartCount');
    if (cartCount && cartCount.hidden === customer) cartCount.hidden = !customer;
    const teamLink = document.querySelector('.team-login-link');
    if (teamLink) {
      teamLink.hidden = customer;
      teamLink.style.display = customer ? 'none' : '';
      teamLink.setAttribute('aria-hidden', String(customer));
    }
    const accountButton = document.getElementById('customerAccountButton');
    if (accountButton) {
      if (accountButton.hidden !== team) accountButton.hidden = team;
      const accountLabel = customer ? 'Painel do cliente' : 'Entrar';
      if (accountButton.textContent !== accountLabel) accountButton.textContent = accountLabel;
      accountButton.onclick = event => {
        event.preventDefault();
        if (customer) window.openCustomerAccount?.(); else window.openCustomerAuth?.('login');
        window.closePublicMenu?.();
      };
    }
    window.syncCustomerServiceAccess?.();
  }

  const originalAddToCart = window.addToCart;
  window.addToCart = function(productId, ...args) {
    if (isTeamAccount()) {
      toast('A compra está disponível para contas de cliente.');
      return false;
    }
    if (!isCustomer()) {
      window.openCustomerAuth?.('login');
      return false;
    }
    return originalAddToCart.call(this, productId, ...args);
  };

  const originalOpenCart = window.openCart;
  window.openCart = function(...args) {
    if (isTeamAccount()) {
      toast('A compra está disponível para contas de cliente.');
      return false;
    }
    if (!isCustomer()) {
      window.openCustomerAuth?.('login');
      return false;
    }
    const result = originalOpenCart.apply(this, args);
    const form = document.getElementById('editForm'), customer = window.customerAccountState.customer;
    if (form && customer) {
      for (const [name,value] of [['name',customer.name],['email',customer.email]]) {
        const input = form.elements[name];
        if (!input) continue;
        input.value = value || '';
        input.required = false;
        input.closest('.form-field')?.classList.add('hidden');
      }
    }
    return result;
  };

  const originalRenderPublic = window.renderPublic;
  window.renderPublic = function(...args) {
    const result = originalRenderPublic.apply(this, args);
    syncCartAccess();
    return result;
  };

  const originalShowStore = window.showStore;
  window.showStore = function(...args) {
    const result = originalShowStore.apply(this, args);
    syncCartAccess();
    return result;
  };

  const products = document.getElementById('publicProducts');
  if (products) {
    const productsOptions = {childList:true,subtree:true};
    const productsObserver = new MutationObserver(() => {
      // Pausa o observer enquanto sincroniza, para as próprias alterações não o reativarem.
      productsObserver.disconnect();
      try { syncCartAccess(); } finally { productsObserver.observe(products, productsOptions); }
    });
    productsObserver.observe(products, productsOptions);
  }
  for (const id of ['login','dashboard','employeePortal']) {
    const panel = document.getElementById(id);
    if (panel) new MutationObserver(syncCartAccess).observe(panel, {attributes:true,attributeFilter:['class']});
  }
  window.addEventListener('storage', syncCartAccess);
  window.syncCartAccess = syncCartAccess;
  syncCartAccess();
})();

;

;/* SOURCE: customer-account.js */
/* Customer registration, sign-in, Google identity and session restore. */
(() => {
  const tokenKey = 'protecextintores_customer_session';
  const state = window.customerAccountState = window.customerAccountState || {authenticated:false,customer:null,token:''};
  let googleNonce = '';
  let googleScriptPromise = null;
  const originalSendPublicOrder = window.sendPublicOrder;

  function isTeamAccount() {
    return ['admin','employee','seller'].includes(localStorage.getItem('protecextintores_role')) || ['admin','employee','seller'].includes(sessionStorage.getItem('protecextintores_role'));
  }

  function customerRequest(path, method='GET', data=null) {
    const headers = {'Content-Type':'application/json'};
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    return fetch((window.PROTEC_API_BASE_URL||'').replace(/\/$/,'') + path, {
      method, headers, ...(data ? {body:JSON.stringify(data)} : {})
    });
  }

  async function readResponse(response) {
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Não foi possível conversar com o servidor.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir o acesso.');
    return data;
  }

  function updateCustomerSession(data) {
    state.token = data.token;
    state.customer = data.customer;
    state.authenticated = true;
    localStorage.setItem(tokenKey, data.token);
    window.syncCartAccess?.();
  }

  function requireApi() {
    if (location.protocol === 'file:') throw new Error('Contas de cliente precisam do site publicado e da API online.');
  }

  function authBody(mode) {
    const registering = mode === 'register';
    return `<div class="customer-auth-copy"><p>${registering?'Crie sua conta para comprar e acompanhar seus pedidos.':'Entre para adicionar produtos ao carrinho e concluir seu pedido.'}</p></div>
      ${registering?'<div class="form-field"><label>Nome completo</label><input name="name" autocomplete="name" minlength="2" maxlength="100" required></div>':''}
      <div class="form-field"><label>E-mail</label><input name="email" type="email" autocomplete="email" maxlength="254" required></div>
      <div class="form-field"><label>Senha</label><input name="password" type="password" autocomplete="${registering?'new-password':'current-password'}" minlength="${registering?8:1}" maxlength="128" required>${registering?'<small class="helper">Use pelo menos 8 caracteres.</small>':''}</div>
      <button type="button" class="customer-auth-switch" onclick="openCustomerAuth('${registering?'login':'register'}')">${registering?'Já tem uma conta? Entrar':'Ainda não tem conta? Criar conta'}</button>
      <div class="customer-auth-divider"><span>ou</span></div>
      <div id="googleCustomerSignIn"></div>`;
  }

  function mountGoogleButton() {
    const host = document.getElementById('googleCustomerSignIn');
    if (!host) return;
    const clientId = String(window.PROTEC_GOOGLE_CLIENT_ID||'').trim();
    if (!clientId) {
      const divider = host.previousElementSibling;
      if (divider?.classList.contains('customer-auth-divider')) divider.remove();
      host.remove();
      return;
    }
    host.innerHTML = '<div class="google-button-mount"></div>';
    const render = () => {
      if (!window.google?.accounts?.id) return;
      googleNonce = crypto.randomUUID();
      window.google.accounts.id.initialize({client_id:clientId,nonce:googleNonce,callback:window.handleCustomerGoogleCredential});
      window.google.accounts.id.renderButton(host.querySelector('.google-button-mount'),{type:'standard',theme:'outline',size:'large',shape:'pill',text:'continue_with',width:340,locale:'pt-BR'});
    };
    if (window.google?.accounts?.id) { render(); return; }
    if (!googleScriptPromise) googleScriptPromise = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
      script.onload = resolve; script.onerror = () => reject(new Error('Não foi possível carregar o login Google.'));
      document.head.appendChild(script);
    });
    googleScriptPromise.then(render).catch(error => { if (host.isConnected) host.innerHTML = `<small>${esc(error.message)}</small>`; });
  }

  window.openCustomerAuth = function(mode='login') {
    if (isTeamAccount()) { toast('Saia do painel da equipe antes de entrar como cliente.'); return; }
    const registering = mode === 'register';
    openModal(registering?'Criar conta de cliente':'Entrar na loja',authBody(registering?'register':'login'),async form => {
      try {
        requireApi();
        const payload = registering
          ? {name:String(form.get('name')||'').trim(),email:String(form.get('email')||'').trim(),password:String(form.get('password')||'')}
          : {email:String(form.get('email')||'').trim(),password:String(form.get('password')||'')};
        const response = await customerRequest(registering?'/api/customer/register':'/api/customer/login','POST',payload);
        updateCustomerSession(await readResponse(response));
        toast(registering?'Conta criada. Você já pode comprar.':'Você entrou na sua conta.');
        return true;
      } catch (error) { toast(error.message); return false; }
    },registering?'Criar conta':'Entrar');
    mountGoogleButton();
  };

  window.handleCustomerGoogleCredential = async function(response) {
    try {
      requireApi();
      const result = await readResponse(await customerRequest('/api/customer/google','POST',{credential:response.credential,nonce:googleNonce}));
      updateCustomerSession(result); closeModal(); toast('Conta Google conectada. Você já pode comprar.');
    } catch (error) { toast(error.message); }
  };

  window.openCustomerAccount = function() {
    if (!state.authenticated || !state.customer) return window.openCustomerAuth('login');
    const body = `<div class="customer-account-card"><span class="customer-account-avatar">${esc((state.customer.name||'C').slice(0,1).toUpperCase())}</span><div><b>${esc(state.customer.name)}</b><small>${esc(state.customer.email)}</small></div></div><p class="helper">Sua conta está conectada à loja. Seus pedidos usam este nome e e-mail.</p><button type="button" class="btn btn-soft customer-signout" onclick="logoutCustomer()">Sair da conta</button>`;
    openModal('Minha conta',body,()=>true,'Fechar');
  };

  window.logoutCustomer = async function() {
    const token = state.token;
    localStorage.removeItem(tokenKey);
    state.token = ''; state.customer = null; state.authenticated = false;
    if (typeof db !== 'undefined') { db.cart = []; saveLocal(); updateCartCount(); }
    closeModal(); window.syncCartAccess?.(); toast('Você saiu da sua conta.');
    // Clear the local session immediately; the API may be unavailable or slow.
    if (token) {
      const base = (window.PROTEC_API_BASE_URL || '').replace(/\/$/, '');
      fetch(base + '/api/customer/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        keepalive: true
      }).catch(() => {});
    }
  };

  window.sendPublicOrder = function(data) {
    const kind = data?.order?.kind;
    if (!['Venda','Manutenção'].includes(kind)) {
      return originalSendPublicOrder ? originalSendPublicOrder(data) : Promise.resolve(true);
    }
    if (isTeamAccount()) return Promise.resolve(false);
    if (!state.authenticated || !state.token) {
      // Orçamento não exige conta; compra exige.
      if (kind !== 'Manutenção') return Promise.resolve(false);
      if (typeof API_ENABLED !== 'undefined' && !API_ENABLED) return Promise.resolve(true);
      return window.apiCall('/api/public/orders','POST',data).then(async response=>{
        if(!response.ok){let result={};try{result=await response.json()}catch{}throw new Error(result.error||'Não foi possível enviar a solicitação.')}
        return true;
      });
    }
    return customerRequest('/api/public/orders','POST',data).then(async response=>{
      if(response.status===401){localStorage.removeItem(tokenKey);state.token='';state.customer=null;state.authenticated=false;window.syncCartAccess?.();if(kind==='Manutenção')throw new Error('Sua sessão expirou. Entre novamente para solicitar o serviço.');toast('Sua sessão expirou. Entre novamente para continuar.');return false}
      let result={};try{result=await response.json()}catch{}if(!response.ok){const error=new Error(result.error||'Não foi possível enviar o pedido.');if(kind==='Manutenção')throw error;toast(error.message);return false}if(result.payment&&data?.order)Object.assign(data.order,result.payment);return true;
    }).catch(error=>{if(kind==='Manutenção')throw error;toast(error.message||'Não foi possível enviar o pedido.');return false});
  };

  async function restoreCustomerSession() {
    const token = localStorage.getItem(tokenKey);
    if (!token || isTeamAccount()) { window.syncCartAccess?.(); return; }
    state.token = token;
    try {
      const response = await customerRequest('/api/customer/session');
      if (response.status === 401 || response.status === 403) {
        // Sessão realmente inválida/expirada: só aqui o token é descartado.
        localStorage.removeItem(tokenKey); state.token=''; state.customer=null; state.authenticated=false;
      } else {
        const result = await readResponse(response);
        state.customer = result.customer; state.authenticated = true;
      }
    } catch {
      // Falha de rede/API fora do ar: mantém o token salvo para tentar de novo depois,
      // sem deixar o cliente como autenticado.
      state.customer=null; state.authenticated=false;
    }
    window.syncCartAccess?.();
  }

  window.addEventListener('storage', event => {
    if(event.key!==tokenKey)return;
    if(event.newValue){restoreCustomerSession();return}
    state.token='';state.customer=null;state.authenticated=false;window.syncCartAccess?.();
  });

  restoreCustomerSession();
})();

;

;/* SOURCE: customer-services.js */
/* Customer-facing catalog for fire safety products and quote-only services. */
(() => {
  const page = document.getElementById('produtos');
  const legacySection = document.getElementById('pedido-manutencao');
  if (!page || !legacySection) return;

  const style = document.createElement('style');
  style.textContent = `
    .customer-services-section{margin:34px -1px 0;padding:34px 28px;border:1px solid var(--ui-border,#c5d8e6);border-radius:24px;background:linear-gradient(150deg,var(--ui-panel,#f9fcff),var(--ui-panel,#f9fcff));box-shadow:0 16px 44px rgb(var(--ui-scrim-rgb,17 14 12) / 0.047)}
    .customer-services-heading{max-width:740px;margin:0 auto 24px;text-align:center}
    .customer-services-heading h2{margin:8px 0;font-size:clamp(24px,4vw,34px);color:var(--ui-text,#20374a)}
    .customer-services-heading p{margin:0;color:var(--ui-muted,#526b80);line-height:1.6}
    .customer-service-gate{max-width:650px;margin:0 auto;padding:25px;border:1px solid var(--ui-border,#c5d8e6);border-radius:18px;background:var(--ui-panel,#f9fcff);text-align:center;box-shadow:0 10px 28px rgb(var(--ui-scrim-rgb,17 14 12) / 0.043)}
    .customer-service-gate h3{margin:0 0 8px;color:var(--ui-text,#20374a)}.customer-service-gate p{margin:0 auto 17px;max-width:490px;color:var(--ui-muted,#526b80);line-height:1.55}
    .customer-service-form{max-width:1000px;margin:0 auto}.customer-service-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .customer-service-card{min-width:0;padding:15px;border:1px solid var(--ui-border,#c5d8e6);border-radius:15px;background:var(--ui-panel,#f9fcff);transition:border-color .18s,box-shadow .18s}
    .customer-service-card:has([data-customer-toggle]:checked){border-color:var(--ui-border,#c5d8e6);box-shadow:0 0 0 3px rgb(var(--ui-scrim-rgb,17 14 12) / 0.102)}
    .customer-service-choice{display:flex;align-items:flex-start;gap:11px;cursor:pointer;color:var(--ui-text,#20374a);font-weight:800;font-size:14px;line-height:1.35}
    .customer-service-choice input{width:19px;height:19px;flex:none;margin:1px 0 0;accent-color:var(--ui-accent,#226b99)}
    .customer-service-choice small{display:block;margin-top:4px;color:var(--ui-muted,#526b80);font-size:11px;font-weight:400;line-height:1.45}
    .customer-service-details{margin-top:13px;padding-top:12px;border-top:1px solid var(--ui-border,#c5d8e6)}
    .customer-service-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}
    .customer-service-fields .form-field{min-width:0;margin:7px 0}.customer-service-fields .span2{grid-column:1/-1}
    .customer-service-fields .form-field:has(input:required) label:after,.customer-service-fields .form-field:has(select:required) label:after{content:' *';color:var(--ui-text,#20374a);font-weight:800}
    .customer-service-help{margin:4px 0 0;color:var(--ui-muted,#526b80);font-size:11px;line-height:1.45}
    .customer-maintenance-row{display:grid;grid-template-columns:1.2fr .8fr .7fr auto;gap:8px;align-items:end;margin:0 0 10px}
    .customer-maintenance-row .form-field{min-width:0;margin:0}.customer-maintenance-row .form-field label{font-size:10px}
    .customer-service-remove{min-height:42px;padding:8px 11px;border:1px solid var(--ui-border,#c5d8e6);border-radius:10px;background:var(--ui-raised,#dce9f3);color:var(--ui-muted,#526b80);font-size:12px;font-weight:700}
    .customer-service-sign-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .customer-service-sign-list label{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid var(--ui-border,#c5d8e6);border-radius:10px;color:var(--ui-muted,#526b80);font-size:12px}
    .customer-service-sign-list input{width:17px;height:17px;accent-color:var(--ui-accent,#226b99)}
    .customer-service-contact{margin:19px 0 8px;padding:16px;border:1px solid var(--ui-border,#c5d8e6);border-radius:15px;background:var(--ui-panel,#f9fcff)}
    .customer-service-submit{display:flex;align-items:center;justify-content:center;width:100%;margin-top:14px;min-height:50px;border-radius:13px;background:var(--ui-panel,#f9fcff);color:var(--ui-text,#20374a)}
    .customer-service-submit:hover{background:var(--ui-panel,#f9fcff)}.customer-service-result{max-width:760px;margin:18px auto 0}
    .customer-service-result .tracking-card{border-color:var(--ui-border,#c5d8e6);background:var(--ui-raised,#dce9f3)}
    @media(max-width:680px){.customer-services-section{margin:24px -10px 0;padding:27px 15px;border-radius:18px}.customer-service-options{grid-template-columns:1fr}.customer-service-fields{grid-template-columns:1fr}.customer-service-fields .span2{grid-column:auto}.customer-maintenance-row{grid-template-columns:1fr 1fr}.customer-maintenance-row .customer-service-remove{grid-column:1/-1;width:100%}.customer-service-sign-list{grid-template-columns:1fr 1fr}.customer-service-gate{padding:20px 16px}}
  `;
  document.head.appendChild(style);

  const field = (label, key, type='text', attrs='', placeholder='') => `<div class="form-field"><label>${label}</label><input data-service-field="${key}" type="${type}" ${attrs} ${placeholder ? `placeholder="${placeholder}"` : ''}></div>`;
  const select = (label,key,options,required=true) => `<div class="form-field"><label>${label}</label><select data-service-field="${key}" ${required?'data-required="true"':''}>${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></div>${options.some(([value])=>value==='Outro')?`<div class="form-field hidden" data-other-field="${key}"><label>Informe o tipo</label><input data-service-field="otherType" maxlength="100" data-required="true"></div>`:''}`;
  const card = (code,title,subtitle,details) => `<article class="customer-service-card" data-customer-service="${code}"><label class="customer-service-choice"><input type="checkbox" data-customer-toggle><span>${title}<small>${subtitle}</small></span></label><div class="customer-service-details hidden" data-customer-details>${details}</div></article>`;
  const maintenanceRow = () => `<div class="customer-maintenance-row" data-maintenance-row>
    <div class="form-field"><label>Tipo de extintor</label><select data-maintenance-type data-required="true"><option value="">Selecione o tipo</option><option>Pó químico ABC</option><option>Pó químico BC</option><option>CO₂</option><option>Água pressurizada</option></select></div>
    <div class="form-field"><label>Peso / capacidade</label><select data-maintenance-weight data-required="true" disabled><option value="">Selecione o tipo</option></select></div>
    <div class="form-field"><label>Quantidade</label><input data-maintenance-quantity data-required="true" type="number" min="1" max="100" step="1" value="1"></div>
    <button type="button" class="customer-service-remove" data-remove-maintenance>Remover grupo</button>
  </div>`;

  legacySection.dataset.publicPage = 'products';
  legacySection.classList.add('customer-services-section');
  legacySection.innerHTML = `
    <div class="customer-services-heading"><div class="eyebrow" style="color:var(--ui-text,#20374a)">Atendimento ProtecExtintores</div><h2>Peça serviços e instalação</h2><p>Escolha manutenção de extintores, instalação e outros itens de segurança. A equipe confirma disponibilidade, visita e orçamento antes de qualquer serviço.</p></div>
    
    <form id="customerServiceRequestForm" class="customer-service-form"><p class="customer-service-help">* Campos obrigatórios. Selecione apenas os serviços necessários.</p>
      <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="customer-service-options">
        ${card('maintenance','Manutenção / inspeção de extintores','Recarga, revisão, inspeção ou manutenção preventiva e corretiva.',`<p class="customer-service-help">Adicione um grupo para cada tipo e peso de extintor.</p><div data-maintenance-groups>${maintenanceRow()}</div><button type="button" class="btn btn-soft btn-small" data-add-maintenance>＋ Adicionar tipo de extintor</button>`)}
        ${card('installation','Instalação de extintores','Instalação em parede ou em suporte de piso.',`<div class="customer-service-fields">${select('Forma de instalação','mounting',[['','Selecione'],['wall','Fixar na parede'],['floor','Em suporte de piso'],['both','Parede e suporte de piso'],['existing','Usar suporte existente']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local da instalação','location','text','data-required="true" maxlength="180"','Ex.: recepção, corredor')}${field('Observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('wall-support','Adicionar suporte de parede','Fornecimento de suporte para instalação em parede.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('floor-stand','Adicionar suporte de piso','Fornecimento de suporte de piso para extintor.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('demarcation','Faixa de demarcação','Solicite aplicação de faixa para delimitar equipamentos e áreas.',`<div class="customer-service-fields">${select('Cor da faixa','color',[['','Selecione'],['Amarela','Amarela'],['Vermelha','Vermelha'],['Branca','Branca'],['Outra','Outra']])}<div class="form-field hidden" data-other-color><label>Informe a cor</label><input data-service-field="otherColor" data-required="true" maxlength="50"></div>${field('Comprimento (m)','lengthMeters','number','data-required="true" min="0.1" step="any"','Ex.: 5')}${field('Largura (cm), se souber','widthCm','number','min="0.1" step="any"','')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('safety-signage','Placas de sinalização','Saídas, emergência, rotas de fuga, extintores, hidrantes e outras placas.',`<p class="customer-service-help">Marque os tipos desejados. A quantidade informada será aplicada a cada tipo marcado.</p><div class="customer-service-sign-list">${[['Saída'],['Saída de emergência'],['Rota de fuga'],['Extintor ABC'],['Extintor BC'],['Extintor CO₂'],['Extintor de água'],['Hidrante'],['Alarme de incêndio'],['Acionador manual'],['Ponto de encontro'],['Outra placa']].map(([label])=>`<label><input type="checkbox" data-sign-type value="${label}">${label}</label>`).join('')}</div><div class="customer-service-fields">${field('Quantidade por tipo de placa','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / outras placas','notes','text','maxlength="300"','Ex.: garagem, corredor')}</div>`)}
        ${card('hydrant-hose-test','Teste de mangueira de hidrante','Informe tipo/classe, diâmetro e comprimento.',`<div class="customer-service-fields">${select('Tipo / classe','type',[['','Selecione'],['Tipo 1','Tipo 1'],['Tipo 2','Tipo 2'],['Tipo 3','Tipo 3'],['Tipo 4','Tipo 4'],['Tipo 5','Tipo 5'],['Não sei','Não sei']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Diâmetro (mm)','diameterMm','number','data-required="true" min="0.1" step="any"','Ex.: 38')}${field('Comprimento (m)','lengthMeters','number','data-required="true" min="0.1" step="any"','Ex.: 15')}</div>`)}
        ${card('extinguisher-hose','Adicionar mangueira de extintor','Para pó químico, água ou CO₂.',`<div class="customer-service-fields">${select('Agente','type',[['','Selecione'],['Pó químico ABC','Pó químico ABC'],['Pó químico BC','Pó químico BC'],['Água pressurizada','Água pressurizada'],['CO₂','CO₂'],['Outro','Outro']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('diffuser','Adicionar difusor de extintor','Escolha o tipo de difusor que precisa.',`<div class="customer-service-fields">${select('Tipo','type',[['','Selecione'],['Pó químico ABC/BC','Pó químico ABC/BC'],['Água','Água'],['CO₂','CO₂'],['Outro','Outro']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('hydrant-cabinet','Abrigo de hidrante','Fornecimento ou instalação de abrigo de hidrante.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('hydrant-accessories','Acessórios de hidrante','Esguicho, adaptador, chave ou tampão Storz.',`<div class="customer-service-fields">${select('Acessório','type',[['','Selecione'],['Esguicho regulável','Esguicho regulável'],['Esguicho jato sólido','Esguicho jato sólido'],['Adaptador Storz','Adaptador Storz'],['Chave Storz','Chave Storz'],['Tampão Storz','Tampão Storz'],['Outro','Outro']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('emergency-light','Iluminação de emergência','Fornecimento ou instalação de luminárias de emergência.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('pressure-gauge','Adicionar manômetro','Peça e instalação para extintor.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('valve','Adicionar ou revisar válvula','Informe tipo, se souber.',`<div class="customer-service-fields">${field('Tipo / modelo','notes','text','data-required="true" maxlength="120"','Ex.: válvula M30')}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('extinguisher-wheels','Rodas ou carrinho para extintor','Para extintores sobre rodas.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Observações','notes','text','maxlength="200"','')}</div>`)}
        ${card('other-work','Outro serviço de prevenção','Descreva o que precisa e a equipe orientará.',`<div class="customer-service-fields">${field('Descreva o serviço','description','text','data-required="true" maxlength="200"','')}${field('Quantidade','quantity','number','min="1" max="100" step="1" value="1"')}</div>`)}
      </div>
      <div class="customer-service-contact"><h3>Seus dados para o orçamento</h3><div class="customer-service-fields"><div class="form-field"><label>Nome ou empresa</label><input type="text" data-contact-name required minlength="2" maxlength="100" autocomplete="name"></div>${field('Telefone / WhatsApp','phone','tel','required autocomplete="tel" maxlength="30"','(00) 00000-0000')}<div class="form-field span2"><label>E-mail (opcional)</label><input type="email" data-contact-email maxlength="254" autocomplete="email"></div></div></div><p class="customer-service-help">A equipe usa esses dados para confirmar endereço, visita e orçamento. Você não precisa criar conta. Enviar a solicitação não agenda nem cobra o serviço.</p></div>
      <div class="form-field"><label>Endereço do serviço / observações gerais</label><textarea name="details" maxlength="1500" placeholder="Informe o endereço do local e qualquer detalhe importante."></textarea></div>
      <button type="submit" class="btn customer-service-submit">Solicitar orçamento de produtos e serviços</button>
    </form>
    <div id="customerServiceRequestResult" class="customer-service-result" aria-live="polite"></div>`;

  const productHeading=page.querySelector('.section-head h2'),productIntro=page.querySelector('.section-head p');
  if(productHeading)productHeading.textContent='Produtos e serviços';
  if(productIntro)productIntro.textContent='Compre extintores e solicite instalação, manutenção e outros serviços de segurança.';
  const productLink = document.querySelector('#publicNav a');
  if (productLink) productLink.textContent = 'Produtos e serviços';
  const headerLinks = [...document.querySelectorAll('#publicNav a')];
  const serviceLink = headerLinks.find(link => (link.getAttribute('onclick')||'').includes("showPublicPage('service')"));
  if (serviceLink) serviceLink.textContent = 'Solicitar serviço';
  const footerLinks = [...document.querySelectorAll('footer .footer-links a')];
  if (footerLinks[0]) footerLinks[0].textContent = 'Produtos e serviços';
  if (footerLinks[1]) footerLinks[1].textContent = 'Solicitar serviço';
  document.querySelectorAll('.hero-actions .btn').forEach((link,index)=>{if(index===0)link.innerHTML='Explorar produtos e serviços <span aria-hidden="true">→</span>';else link.textContent='Solicitar serviço'});
  document.querySelectorAll('[onclick]').forEach(element=>{
    if(!(element.getAttribute('onclick')||'').includes("showPublicPage('service')"))return;
    element.onclick=event=>{event.preventDefault();window.openCustomerServices();return false};
  });
  page.appendChild(legacySection);

  const form = document.getElementById('customerServiceRequestForm');
  form.noValidate = true;
  const weightOptions = {'Pó químico ABC':['4','6','8','12'],'Pó químico BC':['4','6','8','12'],'CO₂':['4','6','8'],'Água pressurizada':['10 L']};
  function bindMaintenanceRow(row) {
    const type = row.querySelector('[data-maintenance-type]'), weight = row.querySelector('[data-maintenance-weight]');
    type.addEventListener('change',()=>{
      const options=weightOptions[type.value]||[];
      weight.innerHTML='<option value="">Selecione o peso</option>'+options.map(value=>`<option value="${value}">${value}${value==='10 L'?'':' kg'}</option>`).join('');
      weight.disabled=!type.value;
      weight.required=Boolean(type.value)&&form.querySelector('[data-customer-service="maintenance"] [data-customer-toggle]').checked;
    });
    row.querySelector('[data-remove-maintenance]').addEventListener('click',()=>{
      const groups=form.querySelectorAll('[data-maintenance-row]');
      if(groups.length===1){type.value='';type.dispatchEvent(new Event('change'));row.querySelector('[data-maintenance-quantity]').value='1';return}
      row.remove();
    });
  }
  form.querySelectorAll('[data-maintenance-row]').forEach(bindMaintenanceRow);
  form.querySelector('[data-add-maintenance]').addEventListener('click',()=>{
    const group=form.querySelector('[data-maintenance-groups]');
    if(group.querySelectorAll('[data-maintenance-row]').length>=20){toast('Adicione até 20 grupos por solicitação.');return}
    const holder=document.createElement('div');holder.innerHTML=maintenanceRow();const row=holder.firstElementChild;group.appendChild(row);bindMaintenanceRow(row);
    const enabled=form.querySelector('[data-customer-service="maintenance"] [data-customer-toggle]').checked;
    row.querySelectorAll('[data-required]').forEach(input=>input.required=enabled);
  });
  form.querySelectorAll('[data-customer-service]').forEach(serviceCard=>{
    const toggle=serviceCard.querySelector('[data-customer-toggle]'),details=serviceCard.querySelector('[data-customer-details]');
      toggle.addEventListener('change',()=>{
      const active=toggle.checked;details.classList.toggle('hidden',!active);
      details.querySelectorAll('[data-required]').forEach(input=>input.required=active&&!input.closest('[data-other-field],[data-other-color]')?.classList.contains('hidden'));
    });
  });
  form.querySelectorAll('select[data-service-field]').forEach(selectField=>selectField.addEventListener('change',()=>{
    const other=selectField.closest('[data-customer-service]')?.querySelector(`[data-other-field="${selectField.dataset.serviceField}"]`);
    if(!other)return;
    const active=selectField.value==='Outro'&&Boolean(selectField.closest('[data-customer-service]')?.querySelector('[data-customer-toggle]').checked);
    other.classList.toggle('hidden',!active);other.querySelector('input').required=active;
  }));
  form.querySelector('[data-service-field="color"]').addEventListener('change',event=>{
    const other=form.querySelector('[data-other-color]'),input=other.querySelector('input');
    other.classList.toggle('hidden',event.target.value!=='Outra');
    input.required=event.target.value==='Outra'&&form.querySelector('[data-customer-service="demarcation"] [data-customer-toggle]').checked;
  });

  window.openCustomerServices=function(){showPublicPage('products');setTimeout(()=>legacySection.scrollIntoView({behavior:'smooth',block:'start'}),80);window.closePublicMenu?.()};
  window.syncCustomerServiceAccess=function(){
    const account=window.customerAccountState||{},team=Boolean(localStorage.getItem('protecextintores_role')||sessionStorage.getItem('protecextintores_role'));
    const authenticated=Boolean(account.authenticated&&account.token&&account.customer&&!team);
    const nameInput=form.querySelector('[data-contact-name]'),emailInput=form.querySelector('[data-contact-email]');
    if(authenticated){if(!nameInput.value)nameInput.value=account.customer.name||'';if(!emailInput.value)emailInput.value=account.customer.email||''}
  };

  function selectedOptions(){return [...form.querySelectorAll('[data-customer-service]')].filter(card=>card.querySelector('[data-customer-toggle]').checked)}
  function collectExtras(cards){
    const result=[];
    for(const item of cards){
      const code=item.dataset.customerService,read=key=>item.querySelector(`[data-service-field="${key}"]`)?.value.trim()||'',qty=()=>Math.max(1,Math.min(100,Number(read('quantity'))||1));
      if(code==='maintenance'||code==='installation')continue;
      if(code==='demarcation'){
        const color=read('color')==='Outra'?read('otherColor'):read('color');
        result.push({code,title:'Faixa de demarcação',details:{color,lengthMeters:Number(read('lengthMeters')),widthCm:Number(read('widthCm'))||'',notes:read('notes')},price:0});
      }else if(code==='safety-signage'){
        const lines=[...item.querySelectorAll('[data-sign-type]:checked')].map(sign=>({type:sign.value,quantity:qty(),location:read('notes')}));
        const total=qty();
        if(lines.length)lines[0].quantity=total;
        result.push({code,title:'Placas de sinalização',lines,quantity:total,details:{notes:read('notes')},price:0});
      }else if(code==='hydrant-hose-test'){
        result.push({code,title:'Teste de mangueira de hidrante',lines:[{type:read('type'),diameterMm:Number(read('diameterMm')),lengthMeters:Number(read('lengthMeters')),quantity:qty()}],price:0});
      }else if(['extinguisher-hose','diffuser','hydrant-accessories'].includes(code)){
        const titleMap={'extinguisher-hose':'Mangueira de extintor',diffuser:'Difusor de extintor','hydrant-accessories':'Acessório de hidrante'};
        result.push({code,title:titleMap[code],lines:[{type:read('type')==='Outro'?read('otherType'):read('type'),quantity:qty()}],price:0});
      }else if(code==='other-work'){
        result.push({code,title:read('description'),quantity:qty(),details:{notes:''},price:0});
      }else{
        const titleMap={'wall-support':'Suporte de parede','floor-stand':'Suporte de piso','hydrant-cabinet':'Abrigo de hidrante','emergency-light':'Iluminação de emergência','pressure-gauge':'Manômetro',valve:'Válvula','extinguisher-wheels':'Rodas / carrinho para extintor'};
        result.push({code,title:titleMap[code]||'Serviço complementar',quantity:qty(),details:{notes:read('notes')},price:0});
      }
    }
    return result;
  }
  function maintenanceGroups(){
    const selected=form.querySelector('[data-customer-service="maintenance"] [data-customer-toggle]').checked;
    if(!selected)return [];
    return [...form.querySelectorAll('[data-maintenance-row]')].map(row=>({type:row.querySelector('[data-maintenance-type]').value,kg:row.querySelector('[data-maintenance-weight]').value,quantity:Math.max(1,Math.min(100,Number(row.querySelector('[data-maintenance-quantity]').value)||1))}));
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const selected=selectedOptions();
    if(!selected.length){toast('Selecione ao menos um serviço para solicitar orçamento.');return}
    const groups=maintenanceGroups();
    if(groups.length&&!groups.every(group=>group.type&&group.kg)){toast('Selecione o tipo e o peso de cada grupo de extintores.');return}
    const signCard=selected.find(item=>item.dataset.customerService==='safety-signage');
    if(signCard&&!signCard.querySelector('[data-sign-type]:checked')){toast('Selecione ao menos um tipo de placa.');return}
    const extraServices=collectExtras(selected),name=form.querySelector('[data-contact-name]').value.trim(),email=form.querySelector('[data-contact-email]').value.trim(),phone=form.querySelector('[data-service-field="phone"]').value.trim(),additionalNotes=form.elements.details.value.trim();
    const installation=selected.find(item=>item.dataset.customerService==='installation');
    const installationQuantity=installation?Math.max(1,Math.min(100,Number(installation.querySelector('[data-service-field="quantity"]').value)||1)):0;
    if(installation){const mount=installation.querySelector('[data-service-field="mounting"]').value;const location=installation.querySelector('[data-service-field="location"]').value.trim();const notes=installation.querySelector('[data-service-field="notes"]').value.trim();const mountText={wall:'Fixação na parede',floor:'Em suporte de piso',both:'Parede e suporte de piso',existing:'Usar suporte existente'}[mount]||mount;extraServices.unshift({code:'extinguisher-installation',title:'Instalação de extintores',quantity:installationQuantity,details:{notes:[mountText,location,notes].filter(Boolean).join(' · ')},price:0})}
    const totalMaintained=groups.reduce((sum,group)=>sum+group.quantity,0);
    if(totalMaintained>100){toast('A quantidade total de extintores por solicitação é de até 100.');return}
    const requestedCount=Math.max(totalMaintained,installationQuantity,1);
    const items=[];
    for(const group of groups)for(let i=0;i<group.quantity;i++)items.push({id:crypto.randomUUID(),serial:'',type:group.type,kg:group.kg==='10 L'?'':group.kg,status:'Solicitado',history:[{status:'Solicitado',at:new Date().toISOString()}]});
    while(items.length<requestedCount)items.push({id:crypto.randomUUID(),serial:'',type:installation?'Instalação de extintor':'Serviço complementar',kg:'',status:'Solicitado',history:[{status:'Solicitado',at:new Date().toISOString()}]});
    const hasMaintenance=groups.length>0,hasOther=extraServices.length>0;
    const serviceType=hasMaintenance&&installation?'Manutenção e instalação de extintores':hasMaintenance?'Manutenção de extintores':installation?'Instalação de extintores':'Serviços de prevenção contra incêndio';
    const serviceDetails=[...groups.map(group=>`${group.quantity} × ${group.type} ${group.kg==='10 L'?'10 L':group.kg+' kg'}`),...extraServices.map(item=>item.title+(item.quantity?` × ${item.quantity}`:'')),additionalNotes].filter(Boolean).join(' | ');
    const code='FS-'+Math.random().toString(36).slice(2,8).toUpperCase(),createdAt=new Date().toISOString();
    const service={id:crypto.randomUUID(),code,clientName:name,customerId:window.customerAccountState?.customer?.id,date:createdAt.slice(0,10),serviceType,employeeName:'A designar',maintenanceValid:'',items,extraServices,details:serviceDetails,serial:'',type:hasMaintenance?groups[0].type:'Serviços complementares',status:'Solicitado'};
    const order={id:crypto.randomUUID(),code,kind:'Manutenção',name,phone,email,website:form.elements.website.value,details:serviceDetails,items:[...groups.map(group=>({name:`${group.type} ${group.kg==='10 L'?'10 L':group.kg+' kg'}`,qty:group.quantity})),...extraServices.map(item=>({name:item.title,qty:item.quantity||1}))],status:'Solicitado · aguardando análise',createdAt};
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Enviando solicitação…';
    try{
      const ok=await window.sendPublicOrder({order,service});
      if(!ok)throw new Error('Não foi possível enviar. Verifique sua conexão e tente novamente.');
      const logged=Boolean(window.customerAccountState?.authenticated);
      const wa=window.fogoWhatsAppLink?window.fogoWhatsAppLink(`Olá! Acabei de pedir um orçamento pelo site. Meu código é ${code}.`):'';
      document.getElementById('customerServiceRequestResult').innerHTML=`<div class="tracking-card"><h4>Solicitação enviada</h4><p>Seu código de acompanhamento é <b>${code}</b>. Anote ou tire uma foto: é com ele que você acompanha cada etapa.</p><p>${logged?'O pedido ficou registrado na sua conta. ':''}A equipe confirma disponibilidade e valores antes de agendar qualquer serviço.</p><div class="result-actions"><button type="button" class="btn btn-small" onclick="document.getElementById('trackCode').value='${code}';showPublicPage('tracking')">Acompanhar solicitação</button>${wa?`<a class="btn btn-small btn-whatsapp" href="${wa}" target="_blank" rel="noopener">Avisar a equipe no WhatsApp</a>`:''}</div></div>`;
      form.reset();form.querySelectorAll('[data-customer-service]').forEach(card=>{card.querySelector('[data-customer-toggle]').dispatchEvent(new Event('change',{bubbles:true}))});form.querySelectorAll('select').forEach(select=>select.dispatchEvent(new Event('change',{bubbles:true})));form.querySelectorAll('[data-maintenance-row]').forEach(row=>{row.querySelectorAll('select,input').forEach(input=>{input.required=false});const weight=row.querySelector('[data-maintenance-weight]');weight.disabled=true;weight.innerHTML='<option value="">Selecione o tipo</option>'});window.syncCustomerServiceAccess?.();
      document.getElementById('customerServiceRequestResult').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){toast(error.message||'Não foi possível enviar a solicitação.');}
    finally{submit.disabled=false;window.syncCustomerServiceAccess?.()}
  });

  window.syncCustomerServiceAccess();
})();

;

;/* SOURCE: professional-updates.js */
/* Ajustes de clareza, acessibilidade e confirmação de pedidos. */
(() => {
  const makeId = () => window.crypto?.randomUUID?.() || `fs-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = './professional-updates.css?v=valve-art-21';
  document.head.append(style);

  const loginNote = document.querySelector('.login-note');
  if (loginNote) {
    loginNote.textContent = 'Use o usuário e a senha fornecidos pelo administrador da empresa.';
  }

  const requestForm = document.querySelector('form[onsubmit="submitMaintenanceRequest(event)"]');
  if (requestForm) {
    const phone = requestForm.elements.phone;
    if (phone) {
      phone.type = 'tel';
      phone.autocomplete = 'tel';
      phone.inputMode = 'tel';
      phone.setAttribute('aria-label', 'Telefone ou WhatsApp com DDD');
    }
    const note = document.createElement('p');
    note.className = 'privacy-inline-note';
    note.textContent = 'Usaremos esses dados para responder a esta solicitação. Informe apenas o necessário e não envie dados pessoais sensíveis.';
    requestForm.insertBefore(note, requestForm.querySelector('button[type="submit"], button:not([type])'));
    const result = document.getElementById('maintenanceRequestResult');
    if (result) result.setAttribute('aria-live', 'polite');
  }

  const productHost = document.getElementById('publicProducts');
  if (productHost) {
    const describeImages = () => productHost.querySelectorAll('.product-image img:not([alt])').forEach(img => {
      img.alt = img.closest('.product')?.querySelector('h3')?.textContent?.trim() || 'Imagem do produto';
      img.loading = 'lazy';
    });
    new MutationObserver(describeImages).observe(productHost, {childList: true, subtree: true});
    describeImages();
  }

  const faq = document.querySelectorAll('#perguntas details');
  faq.forEach(item => {
    const question = item.querySelector('summary')?.textContent || '';
    const answer = item.querySelector('p');
    if (!answer) return;
    if (question.includes('De quanto em quanto tempo')) {
      answer.textContent = 'A periodicidade depende do tipo de extintor, do fabricante, das condições de uso e das regras técnicas aplicáveis. Confira a etiqueta e a documentação do equipamento e peça uma avaliação de profissional habilitado para confirmar o serviço e o prazo adequados.';
    } else if (question.includes('O que acontece se o extintor vencer')) {
      answer.textContent = 'Um equipamento fora do prazo indicado deve ser avaliado antes de voltar a ser considerado pronto para uso. A equipe pode verificar a etiqueta, as condições do extintor e as exigências aplicáveis ao local e orientar sobre os próximos passos.';
    }
  });

  document.querySelectorAll('.live-dot').forEach(dot => {
    dot.hidden = true;
    dot.setAttribute('aria-hidden', 'true');
  });

  const staffRoot = document.getElementById('employeePortal');
  if (staffRoot) {
    let cardObserver;
    const addServiceSearch = () => {
      const host = staffRoot.querySelector('#employeeCards');
      if (!host) return;
      if (!staffRoot.querySelector('#employeeServiceSearch')) {
        const label = document.createElement('label');
        label.className = 'employee-service-search';
        label.htmlFor = 'employeeServiceSearch';
        label.textContent = 'Buscar serviço por código, cliente ou tipo de extintor';
        const input = document.createElement('input');
        input.id = 'employeeServiceSearch';
        input.type = 'search';
        input.autocomplete = 'off';
        input.placeholder = 'Ex.: FS-A1B2C3 ou empresa';
        label.append(input);
        host.before(label);
        const empty = document.createElement('p');
        empty.className = 'employee-search-empty';
        empty.hidden = true;
        empty.setAttribute('role', 'status');
        empty.textContent = 'Nenhum serviço corresponde à busca.';
        host.after(empty);
        input.addEventListener('input', () => filterServices(input.value, host, empty));
      }
      if (!cardObserver) {
        const input = staffRoot.querySelector('#employeeServiceSearch');
        const empty = staffRoot.querySelector('.employee-search-empty');
        cardObserver = new MutationObserver(() => filterServices(input.value, host, empty));
        cardObserver.observe(host, {childList: true});
      }
    };
    const filterServices = (query, host, empty) => {
      const needle = String(query || '').trim().toLocaleLowerCase('pt-BR');
      let visible = 0;
      host.querySelectorAll('.employee-service').forEach(card => {
        const match = !needle || card.textContent.toLocaleLowerCase('pt-BR').includes(needle);
        card.hidden = !match;
        if (match) visible++;
      });
      if (empty) empty.hidden = !needle || visible > 0;
    };
    new MutationObserver(addServiceSearch).observe(staffRoot, {childList: true, subtree: true});
  }

  window.submitMaintenanceRequest = async function(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = document.getElementById('maintenanceRequestResult');
    const submit = form.querySelector('button[type="submit"], button:not([type])');
    const originalLabel = submit?.textContent || '';
    const setMessage = (title, message, isError = false) => {
      if (!result) return;
      result.replaceChildren();
      const card = document.createElement('div');
      card.className = 'tracking-card request-result' + (isError ? ' request-result-error' : '');
      const heading = document.createElement('h4');
      heading.textContent = title;
      const paragraph = document.createElement('p');
      paragraph.textContent = message;
      card.append(heading, paragraph);
      result.append(card);
    };

    if (typeof API_ENABLED === 'undefined' || !API_ENABLED) {
      setMessage('Solicitação não enviada', 'O site ainda não está conectado ao sistema de pedidos. Seus dados foram mantidos no formulário. Entre em contato pelos canais informados no rodapé.', true);
      return;
    }

    const data = new FormData(form);
    const quantity = Math.max(1, Math.min(100, Number(data.get('quantity')) || 1));
    const code = 'FS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const now = new Date().toISOString();
    const name = String(data.get('name') || '').trim();
    const items = Array.from({length: quantity}, () => ({
      serial: '', type: 'Conforme descrição do cliente', status: 'Solicitado',
      history: [{status: 'Solicitado', at: now}]
    }));
    const service = {
      id: makeId(), code, clientName: name, date: now.slice(0, 10),
      serviceType: 'Solicitação de manutenção', employeeName: 'A designar',
      maintenanceValid: '', items, serial: '', type: 'A identificar'
    };
    const order = {
      id: makeId(), code, kind: 'Manutenção', name,
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      details: String(data.get('details') || '').trim(),
      items: items.map((_, index) => ({name: 'Extintor ' + (index + 1), qty: 1})),
      status: 'Solicitado · aguardando análise', createdAt: now
    };

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Enviando solicitação…';
    }
    if (result) result.replaceChildren();
    try {
      const response = await window.apiCall('/api/public/orders', 'POST', {order, service});
      const payload = await window.apiJson(response);
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar o pedido.');

      form.reset();
      const message = document.createElement('p');
      message.textContent = 'Seu código de acompanhamento é ';
      const codeLabel = document.createElement('strong');
      codeLabel.textContent = code;
      message.append(codeLabel, document.createTextNode('. Guarde este código para consultar o andamento.'));
      setMessage('Solicitação recebida', 'A equipe entrará em contato para confirmar escopo, orçamento e agendamento. O envio não agenda nem cobra o serviço.');
      result?.querySelector('.request-result p')?.replaceWith(message);
      const track = document.getElementById('trackCode');
      if (track) track.value = code;
      window.toast?.('Solicitação registrada');
    } catch (error) {
      setMessage('Não foi possível confirmar o envio', (error?.message || 'Verifique sua conexão e tente novamente. Seus dados continuam no formulário.'), true);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    }
  };
})();

;

;/* SOURCE: employee-video-upload.js */
/* Peças e evidências de vídeo por extintor para a área técnica. */
(() => {
  const allParts = ['Válvula M30','Válvula de CO₂','Sifão','Manômetro','Mangueira','Difusor','Outro'];
  const videoParts = new Set(allParts);
  const maxBytes = 50 * 1024 * 1024;

  function groups(items) {
    const grouped = new Map();
    (items || []).forEach((item, index) => {
      const type = item.type || 'Extintor';
      const kg = item.kg || '';
      const key = `${type.toLowerCase()}|${kg}`;
      if (!grouped.has(key)) grouped.set(key, {type, kg, items: [], indexes: []});
      grouped.get(key).items.push(item);
      grouped.get(key).indexes.push(index);
    });
    return [...grouped.values()];
  }

  function mimeFor(file) {
    if (file.type?.startsWith('video/')) return file.type;
    const extension = file.name.split('.').pop().toLowerCase();
    return ({mp4:'video/mp4',m4v:'video/x-m4v',mov:'video/quicktime',webm:'video/webm','3gp':'video/3gpp','3g2':'video/3gpp2'})[extension] || '';
  }

  function readDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      let settled = false;
      const finish = (error, duration) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute('src');
        video.load();
        error ? reject(error) : resolve(duration);
      };
      const timeout = setTimeout(() => finish(new Error('Não foi possível ler a duração. Escolha um MP4 ou MOV salvo no aparelho.')), 15000);
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = Number(video.duration);
        if (!Number.isFinite(duration) || duration <= 0) finish(new Error('Não foi possível ler a duração deste vídeo. Escolha outro arquivo.'));
        else finish(null, duration);
      };
      video.onerror = () => finish(new Error('Este navegador não conseguiu abrir o vídeo. Escolha um MP4 ou MOV.'));
      video.src = objectUrl;
    });
  }

  async function uploadVideo(serviceId, itemIndex, part, file, duration) {
    const params = new URLSearchParams({serviceId, itemIndex:String(itemIndex), part});
    const token = localStorage.getItem(window.API_TOKEN_KEY || 'protecextintores_session');
    const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : window.PROTEC_API_BASE_URL;
    const response = await fetch(`${base}/api/employee/media?${params}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token || ''}`,
        'Content-Type': mimeFor(file),
        'X-Video-Duration': String(duration)
      },
      body: file
    });
    const data = await window.apiJson(response);
    if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o vídeo.');
    return data.media;
  }

  window.employeeNote = async function(serviceId, groupIndex) {
    try {
      const response = await window.apiCall('/api/employee/services');
      const payload = await window.apiJson(response);
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o serviço.');
      for(const part of payload.partOptions || []){if(!allParts.includes(part))allParts.push(part);videoParts.add(part)}
      const service = (payload.services || []).find(item => item.id === serviceId);
      const group = service && groups(service.items)[groupIndex];
      if (!group) throw new Error('Este grupo de extintores não está disponível. Atualize a página e tente novamente.');

      const selectedParts = new Map(group.items.map((item, position) => [group.indexes[position], new Set(item.replacedParts || [])]));
      const selectedFiles = new Map();
      const durationByFile = new Map();
      const slotHostId = 'employeeReplacementVideoSlots';
      const slotKey = (itemIndex, part) => `${itemIndex}::${part}`;

      const pieceRows = group.items.map((item, position) => {
        const itemIndex = group.indexes[position];
        const serial = item.serial ? ` · ${item.serial}` : '';
        const capacity = item.kg ? ` · ${item.kg} kg` : '';
        const labels = allParts.map(part => `<label class="employee-part-checkbox"><input type="checkbox" data-item-index="${itemIndex}" data-part="${esc(part)}" ${selectedParts.get(itemIndex).has(part) ? 'checked' : ''}>${window.protecArtwork.artwork({name:part},'tiny')}<span>${esc(part)}</span></label>`).join('');
        return `<fieldset class="employee-item-parts"><legend>Extintor ${position + 1}${esc(serial)}${esc(capacity)}</legend><div class="employee-part-checkboxes">${labels}</div></fieldset>`;
      }).join('');

      const body = `<p class="helper">Marque as peças em cada extintor. Para cada peça substituída, envie um vídeo individual de até 60 segundos e 50 MB. Filme apenas o equipamento e a área necessária.</p><div class="form-field"><label for="employeeTechnicalNotes">Observação técnica</label><textarea id="employeeTechnicalNotes" name="notes" rows="4">${esc(group.items.map(item => item.notes || '').filter(Boolean).join('\n'))}</textarea></div><section class="employee-parts-section"><h3>Peças por extintor</h3>${pieceRows}</section><section class="replacement-video-section"><h3>Vídeos de cada peça trocada</h3><p class="helper">Marque as peças primeiro; cada substituição marcada terá seu próprio campo de vídeo.</p><div id="${slotHostId}"></div></section>`;

      window.openModal('Observações, peças e vídeos', body, async formData => {
        const notes = String(formData.get('notes') || '');
        const videoFiles = [];
        for (const itemIndex of group.indexes) {
          for (const part of videoParts) {
            if (!selectedParts.get(itemIndex)?.has(part)) continue;
            const file = selectedFiles.get(slotKey(itemIndex, part));
            if (file?.size) videoFiles.push({file, part, itemIndex});
          }
        }

        for (const itemIndex of group.indexes) {
          const pieces = selectedParts.get(itemIndex) || new Set();
          for (const part of videoParts) {
            if (!pieces.has(part)) continue;
            const item = group.items[group.indexes.indexOf(itemIndex)];
            const selected = videoFiles.find(video => video.part === part && video.itemIndex === itemIndex);
            if (!selected && !item.replacementMedia?.[part]?.url) {
              window.toast?.(`Escolha um vídeo para cada ${part.toLowerCase()} substituído.`);
              return false;
            }
            if (selected && selected.file.size > maxBytes) {
              window.toast?.('Cada vídeo pode ter no máximo 50 MB.');
              return false;
            }
            if (selected && !mimeFor(selected.file)) {
              window.toast?.('Formato inválido. Escolha MP4, MOV, WebM ou 3GP.');
              return false;
            }
            if (selected && !durationByFile.has(selected.file)) {
              window.toast?.('Aguarde a verificação da duração do vídeo e tente novamente.');
              return false;
            }
          }
        }

        for (let position = 0; !service.employeeCompletedAt && position < group.indexes.length; position++) {
          const itemIndex = group.indexes[position];
          const item = group.items[position];
          const request = await window.apiCall('/api/employee/status', 'POST', {
            serviceId,
            itemIndex,
            status: item.status || 'Recebido',
            notes,
            parts: [...(selectedParts.get(itemIndex) || [])]
          });
          const data = await window.apiJson(request);
          if (!request.ok) throw new Error(data.error || 'Não foi possível salvar as peças.');
        }

        for (const selected of videoFiles) {
          const media = await uploadVideo(serviceId, selected.itemIndex, selected.part, selected.file, durationByFile.get(selected.file));
          const position = group.indexes.indexOf(selected.itemIndex);
          group.items[position].replacementMedia = {...(group.items[position].replacementMedia || {}), [selected.part]:media};
        }
        group.items.forEach((item, position) => {
          item.notes = notes;
          item.replacedParts = [...(selectedParts.get(group.indexes[position]) || [])];
        });
        await window.refreshEmployeePortal?.();
        window.toast?.('Peças e vídeos individuais salvos.');
      });

      if(service.employeeCompletedAt){document.querySelectorAll('#editForm .employee-part-checkbox input,#employeeTechnicalNotes').forEach(input=>input.disabled=true);}
      const slotHost = document.getElementById(slotHostId);
      const renderVideoSlots = () => {
        if (!slotHost) return;
        slotHost.querySelectorAll('[data-replacement-video]').forEach(input => {
          const file = input.files?.[0];
          if (file) selectedFiles.set(slotKey(Number(input.dataset.itemIndex), input.dataset.part), file);
        });
        const rows = [];
        group.items.forEach((item, position) => {
          const itemIndex = group.indexes[position];
          for (const part of videoParts) {
            if (!selectedParts.get(itemIndex)?.has(part)) continue;
            const key = slotKey(itemIndex, part);
            const existing = item.replacementMedia?.[part];
            const inputId = `replacement-video-${position}-${allParts.indexOf(part)}`;
            const label = `${part} · ${item.serial ? 'extintor ' + item.serial : 'extintor ' + (position + 1)}`;
            rows.push(`<div class="replacement-video-slot"><label for="${inputId}"><b>${esc(label)}</b><small>Vídeo individual com até 60 segundos e 50 MB.</small></label>${existing?.url ? `<div class="saved-video"><small>Vídeo registrado · ${Math.ceil(Number(existing.durationSeconds)||0)} s</small><button type="button" class="btn btn-soft btn-small" data-load-private-video data-url="${esc(existing.url)}">Carregar vídeo para assistir</button><video controls playsinline preload="none" data-media-player hidden></video></div>` : ''}<input id="${inputId}" name="${inputId}" type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp,video/3gpp2,video/x-m4v" data-replacement-video data-part="${esc(part)}" data-item-index="${itemIndex}" data-hint="${inputId}-hint"><small id="${inputId}-hint" class="replacement-video-hint">${existing?.url ? 'Selecione outro vídeo apenas para substituir o atual.' : 'Vídeo obrigatório para esta peça.'}</small></div>`);
          }
        });
        slotHost.innerHTML = rows.join('') || '<p class="helper">Marque uma peça para adicionar o vídeo correspondente.</p>';
        slotHost.querySelectorAll('[data-replacement-video]').forEach(input => {
          const key = slotKey(Number(input.dataset.itemIndex), input.dataset.part);
          const retainedFile = selectedFiles.get(key);
          if (retainedFile) {
            try {
              const transfer = new DataTransfer();
              transfer.items.add(retainedFile);
              input.files = transfer.files;
            } catch {}
            const duration = durationByFile.get(retainedFile);
            const hint = document.getElementById(input.dataset.hint);
            if (duration && hint) hint.textContent = `Vídeo selecionado: ${retainedFile.name} · ${Math.ceil(duration)} s`;
          }
          input.addEventListener('change', async () => {
            const file = input.files?.[0];
            const hint = document.getElementById(input.dataset.hint);
            if (!file) return;
            selectedFiles.set(key, file);
            durationByFile.delete(file);
            if (file.size > maxBytes) {
              input.value = '';
              selectedFiles.delete(key);
              if (hint) hint.textContent = 'Arquivo acima de 50 MB. Grave em resolução menor ou escolha um vídeo mais leve.';
              return;
            }
            if (!mimeFor(file)) {
              input.value = '';
              selectedFiles.delete(key);
              if (hint) hint.textContent = 'Formato não aceito. Use MP4, MOV, WebM ou 3GP.';
              return;
            }
            if (hint) hint.textContent = 'Verificando duração…';
            try {
              const duration = await readDuration(file);
              if (duration > 60) {
                input.value = '';
                selectedFiles.delete(key);
                if (hint) hint.textContent = 'O vídeo tem mais de 60 segundos. Escolha um clipe mais curto.';
                return;
              }
              durationByFile.set(file, duration);
              if (hint) hint.textContent = `Vídeo selecionado: ${file.name} · ${Math.ceil(duration)} s`;
            } catch (error) {
              input.value = '';
              selectedFiles.delete(key);
              if (hint) hint.textContent = error.message;
            }
          });
        });
        slotHost.querySelectorAll('[data-load-private-video]').forEach(button => button.addEventListener('click', async () => {
          const player = button.parentElement.querySelector('[data-media-player]');
          button.disabled = true;
          button.textContent = 'Carregando vídeo…';
          try {
            const token = localStorage.getItem(window.API_TOKEN_KEY || 'protecextintores_session');
            const mediaResponse = await fetch(button.dataset.url, {headers:{Authorization:`Bearer ${token || ''}`}});
            if (!mediaResponse.ok) throw new Error(mediaResponse.status === 403 ? 'Sua conta não tem acesso a este vídeo.' : 'Não foi possível carregar o vídeo.');
            const objectUrl = URL.createObjectURL(await mediaResponse.blob());
            player.src = objectUrl;
            player.hidden = false;
            button.textContent = 'Vídeo carregado';
          } catch (error) {
            button.textContent = error.message || 'Falha ao carregar vídeo';
          } finally {
            button.disabled = false;
          }
        }));
      };

      document.querySelectorAll(`#editForm [data-item-index][data-part]:not([data-replacement-video])`).forEach(input => input.addEventListener('change', () => {
        const itemIndex = Number(input.dataset.itemIndex);
        const pieces = selectedParts.get(itemIndex) || new Set();
        input.checked ? pieces.add(input.dataset.part) : pieces.delete(input.dataset.part);
        selectedParts.set(itemIndex, pieces);
        renderVideoSlots();
      }));
      renderVideoSlots();
    } catch (error) {
      window.toast?.(error.message || 'Não foi possível abrir observações e peças.');
    }
  };
})();

;

;/* SOURCE: customer-orders.js */
/* Customer order history and administrator payment release. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const customerToken = () => window.customerAccountState?.token || localStorage.getItem('protecextintores_customer_session') || '';
  const apiBase = () => (window.PROTEC_API_BASE_URL || '').replace(/\/$/, '');
  const moneyText = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  async function customerOrders(){
    const response=await fetch(apiBase()+'/api/customer/orders',{headers:{Authorization:'Bearer '+customerToken()}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||'Não foi possível carregar seus pedidos.');
    return data.orders||[];
  }
  function orderCard(order){
    const rows=(order.items||[]).map(item=>`<li>${esc(item.qty)} × ${esc(item.name)}</li>`).join('');
    const qr=!isPaid(order)&&order.paymentQr?`<div class="customer-order-payment"><b>Pagamento via Pix</b><img class="customer-order-qr" src="${esc(order.paymentQr)}" alt="QR Code Pix do pedido ${esc(order.code)}"><p>Escaneie o QR Code no aplicativo do seu banco.</p>${order.pixPayload?`<div class="form-field"><label for="pix-${esc(order.id)}">Pix copia e cola</label><textarea readonly id="pix-${esc(order.id)}" rows="3" aria-label="Código Pix copia e cola do pedido ${esc(order.code)}">${esc(order.pixPayload)}</textarea><button class="btn btn-soft" type="button" onclick="copyOrderPix('${esc(order.id)}')">Copiar código Pix</button></div>`:''}</div>`:'';
    const delivery=order.fulfillmentMethod==='delivery'?`<section class="customer-delivery-tracking" aria-label="Acompanhamento da entrega"><div><small>ENTREGA</small><b>${esc(order.deliveryStatus||order.deliveryPreparationStatus||'Aguardando confirmação do pedido')}</b>${order.deliveryWindow?`<span>Previsão informada: ${esc(order.deliveryWindow)}</span>`:''}</div>${order.deliveryConfirmationCode?`<p>Quando o pedido chegar, informe este código ao funcionário: <strong>${esc(order.deliveryConfirmationCode)}</strong></p>`:''}${order.deliveryProblem?`<p class="delivery-problem-text">Ocorrência registrada: ${esc(order.deliveryProblem)}${order.deliveryAttemptAt?' · '+esc(new Date(order.deliveryAttemptAt).toLocaleString('pt-BR')):''}</p>`:''}${order.deliveryStatus==='Entregue'?`<p>Recebido por <b>${esc(order.deliveryRecipientName||'responsável no endereço')}</b>${order.deliveredAt?' · '+esc(new Date(order.deliveredAt).toLocaleString('pt-BR')):''}</p>`:''}</section>`:'';
    const tracking=order.kind==='Venda'||order.cancelled?'':`<button class="btn btn-soft" type="button" aria-expanded="false" onclick="openCustomerServiceTracking('${esc(order.code)}',this)">Acompanhar serviço</button>`;
    return `<article class="customer-order"><div class="customer-order-heading"><div><small>${esc(order.kind)} · ${esc(order.receivedAt?new Date(order.receivedAt).toLocaleDateString('pt-BR'):'Data não informada')}</small><h3>${esc(order.code)}</h3></div><span class="status ${order.cancelled?'':order.status==='Concluído'||order.paymentStatus==='Pago'?'success':'warn'}">${esc(order.status)}</span></div>${rows?`<ul>${rows}</ul>`:''}${order.details?`<p>${esc(order.details)}</p>`:''}${order.cancelled&&order.cancellationReason?`<p><b>Motivo do cancelamento:</b> ${esc(order.cancellationReason)}</p>`:''}<div class="customer-order-meta"><span>Total ${order.total?moneyText(order.total):'a confirmar'}</span><span>Pagamento: ${esc(order.paymentStatus)}</span></div>${delivery}${order.kind==='Manutenção'&&!order.cancelled&&!isPaid(order)&&!order.paymentQr?`<p class="customer-payment-hint">${order.closed?(order.paymentStatus==='Aguardando liberação do Pix'?'Serviço concluído. O administrador ainda precisa liberar o Pix para pagamento.':'O serviço foi concluído. O pagamento ficará disponível após a confirmação do pedido pelo administrador.'):'O pagamento ficará disponível depois da conclusão do serviço e da confirmação do pedido.'}</p>`:''}<div class="customer-order-actions">${tracking}<button class="btn btn-soft" type="button" onclick="copyOrderCode('${esc(order.code)}')">Copiar código</button></div>${qr}<div class="customer-order-tracking hidden" aria-live="polite"></div></article>`;
  }
  const normalizeStatus=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const isCancelled=order=>Boolean(order.cancelled||normalizeStatus(order.status)==='cancelado'||normalizeStatus(order.paymentStatus)==='cancelado');
  const isPaid=order=>{const payment=normalizeStatus(order.paymentStatus);return payment==='pago'||payment.includes('confirmado')||payment.includes('recebido')||normalizeStatus(order.status).includes('pagamento confirmado')};
  const isFinished=order=>Boolean(order.closed||/conclu|finaliz|encerrad/.test(normalizeStatus(order.status))||(order.items?.length&&order.items.every(item=>normalizeStatus(item.status)==='concluido')));
  const isAwaitingPayment=order=>/aguardando pagamento|pendente/.test(normalizeStatus(order.paymentStatus))||/aguardando pagamento/.test(normalizeStatus(order.status));
  const originalOpenAccount=window.openCustomerAccount;
  window.openCustomerAccount=async function(){
    if(!window.customerAccountState?.authenticated)return originalOpenAccount?.();
    let orders=[],error='';try{orders=await customerOrders()}catch(e){error=e.message}
    const purchases=orders.filter(order=>order.kind==='Venda'),services=orders.filter(order=>order.kind!=='Venda');
    const productsPaid=purchases.filter(isPaid),productsPending=purchases.filter(order=>!isPaid(order));
    const servicesCancelled=services.filter(isCancelled),servicesActive=services.filter(order=>!isCancelled(order));
    const servicesPaid=servicesActive.filter(isPaid),servicesInProgress=servicesActive.filter(order=>!isPaid(order)&&!isFinished(order)&&!isAwaitingPayment(order));
    const servicesPending=servicesActive.filter(order=>!isPaid(order)&&(isFinished(order)||isAwaitingPayment(order)));
    const paidOrders=[...productsPaid,...servicesPaid].sort((a,b)=>String(b.paymentConfirmedAt||b.receivedAt).localeCompare(String(a.paymentConfirmedAt||a.receivedAt)));
    const scheduledServices=services.filter(order=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(order.nextMaintenanceMonth||''))).sort((a,b)=>String(a.nextMaintenanceMonth).localeCompare(String(b.nextMaintenanceMonth)));
    const monthText=value=>{const [year,month]=String(value).split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month-1,1,12))};
    const dateText=value=>value?new Date(value).toLocaleDateString('pt-BR'):'Data não informada';
    const section=(title,items,emptyText,kind)=>`<section class="customer-order-group" data-order-group="${kind}"><div class="customer-group-heading"><div><h3>${title}</h3><p>${items.length?`${items.length} ${items.length===1?'pedido':'pedidos'}`:'Sem pedidos nesta categoria'}</p></div><span class="customer-group-count">${items.length}</span></div>${error?`<p class="helper" role="alert">${esc(error)}</p>`:items.length?`<div class="customer-orders-list">${items.map(orderCard).join('')}</div>`:`<div class="customer-panel-empty">${emptyText}</div>`}</section>`;
    const payments=paidOrders.length?`<div class="customer-payment-history">${paidOrders.map(order=>`<article class="customer-payment-record"><header><span class="customer-payment-check" aria-hidden="true">✓</span><div><b>${order.kind==='Venda'?'Compra':'Serviço'}</b><small>Pagamento confirmado · ${esc(dateText(order.paymentConfirmedAt))}</small></div><span class="customer-payment-paid">Pago</span></header><h3>${esc(order.code)}</h3><p>${(order.items||[]).map(item=>`${esc(item.qty||1)} × ${esc(item.name)}`).join(' · ')||esc(order.details||order.serviceType||'Serviço')}</p><footer><span>Pix · ${esc(order.paymentProvider==='API Pix'?'pagamento confirmado':'pagamento recebido')}</span><b>${moneyText(order.total)}</b></footer></article>`).join('')}</div>`:'<div class="customer-panel-empty">Os pagamentos confirmados aparecerão aqui, organizados por data.</div>';
    const maintenance=scheduledServices.length?`<div class="customer-upcoming-list">${scheduledServices.map(order=>`<article><div><b>${esc(order.code)}</b><span>${esc(order.serviceType||'Manutenção')}</span></div><strong>${esc(monthText(order.nextMaintenanceMonth))}</strong></article>`).join('')}</div>`:'<div class="customer-panel-empty">As próximas manutenções registradas aparecerão aqui.</div>';
    const customer=window.customerAccountState.customer||{id:'',name:'Cliente',email:''};
    const activeCount=productsPending.length+servicesInProgress.length+servicesPending.length;
    const body=`<div class="customer-account-card customer-account-header"><span class="customer-account-avatar">${esc((customer.name||'C').slice(0,1).toUpperCase())}</span><div><b>Olá, ${esc(customer.name)}</b><small>${esc(customer.email)} · ID ${esc(customer.id||'—')}</small></div><button type="button" class="btn btn-soft customer-signout" onclick="logoutCustomer()">Sair da conta</button></div><section class="customer-panel-welcome"><div><span class="customer-panel-eyebrow">Minha ProtecExtintores</span><h2>Sua conta, em um só lugar.</h2><p>Acompanhe pedidos, serviços, pagamentos e endereços.</p></div><span class="customer-panel-welcome-mark" aria-hidden="true">✓</span></section><div class="customer-dashboard-summary" aria-label="Resumo da conta"><span><b>${activeCount}</b><small>pedidos em aberto</small></span><span><b>${servicesInProgress.length}</b><small>serviços em andamento</small></span><span><b>${paidOrders.length}</b><small>pagamentos confirmados</small></span><span><b>${moneyText(paidOrders.reduce((sum,order)=>sum+Number(order.total||0),0))}</b><small>total pago</small></span></div><nav class="customer-panel-tabs" role="tablist" aria-label="Seções da conta"><button type="button" role="tab" aria-selected="true" data-account-tab="overview">Resumo</button><button type="button" role="tab" aria-selected="false" data-account-tab="orders">Pedidos e serviços</button><button type="button" role="tab" aria-selected="false" data-account-tab="payments">Pagamentos</button><button type="button" role="tab" aria-selected="false" data-account-tab="addresses">Endereços</button><button type="button" role="tab" aria-selected="false" data-account-tab="support">Garantia e avaliações</button><button type="button" role="tab" aria-selected="false" data-account-tab="maintenance">Manutenções</button></nav><div class="customer-panel-content">${error?`<p class="helper" role="alert">${esc(error)}</p>`:''}<section class="customer-tab-panel" role="tabpanel" data-account-panel="overview"><div class="customer-panel-section-heading"><div><span>Visão geral</span><h3>O que precisa da sua atenção</h3></div><span>${activeCount} em aberto</span></div>${productsPending.length||servicesPending.length||servicesInProgress.length?`<div class="customer-overview-cards">${[...productsPending,...servicesInProgress,...servicesPending].slice(0,3).map(orderCard).join('')}</div>`:'<div class="customer-panel-empty">Tudo em dia. Seus novos pedidos e serviços aparecerão aqui.</div>'}<div class="customer-overview-shortcuts"><button type="button" data-open-tab="orders">Ver pedidos e serviços <span>→</span></button><button type="button" data-open-tab="payments">Consultar pagamentos <span>→</span></button></div></section><section class="customer-tab-panel" role="tabpanel" data-account-panel="orders" hidden><div class="customer-panel-section-heading"><div><span>Pedidos</span><h3>Compras e serviços em aberto</h3></div></div>${section('Produtos aguardando pagamento',productsPending,'Você não tem compras aguardando pagamento.','products-pending')}${section('Serviços em andamento',servicesInProgress,'Você não tem serviços em andamento.','services-progress')}${section('Serviços aguardando pagamento',servicesPending,'Você não tem serviços aguardando pagamento.','services-pending')}${section('Serviços cancelados',servicesCancelled,'Você não tem serviços cancelados.','services-cancelled')}</section><section class="customer-tab-panel" role="tabpanel" data-account-panel="payments" hidden><div class="customer-panel-section-heading"><div><span>Histórico financeiro</span><h3>Pagamentos confirmados</h3><p>Os QR Codes e códigos Pix não aparecem mais depois da confirmação.</p></div><strong>${paidOrders.length} pagamentos</strong></div>${payments}</section><section class="customer-tab-panel" role="tabpanel" data-account-panel="addresses" hidden><div class="customer-panel-section-heading"><div><span>Entrega</span><h3>Meus endereços</h3><p>Salve endereços para selecionar no delivery.</p></div></div><div id="customerAddressMount"></div></section><section class="customer-tab-panel" role="tabpanel" data-account-panel="support" hidden><div class="customer-panel-section-heading"><div><span>Pós-venda</span><h3>Garantias e avaliações</h3><p>Consulte solicitações de garantia e avalie serviços concluídos.</p></div></div><div id="customerSupportMount"></div></section><section class="customer-tab-panel" role="tabpanel" data-account-panel="maintenance" hidden><div class="customer-panel-section-heading"><div><span>Agenda</span><h3>Próximas manutenções</h3><p>Datas previstas exibidas por mês e ano.</p></div></div>${maintenance}</section></div>`;
    openModal('Minha conta',body,()=>true,'Fechar');
    const modalBody=document.querySelector('#modalRoot .modal-body');modalBody?.classList.add('customer-panel-redesign');
    modalBody?.querySelectorAll('[data-account-tab],[data-open-tab]').forEach(button=>button.addEventListener('click',()=>window.switchCustomerAccountTab(button.dataset.accountTab||button.dataset.openTab)));
    window.switchCustomerAccountTab=function(key){const root=document.querySelector('#modalRoot .modal-body');if(!root)return;root.querySelectorAll('[data-account-tab]').forEach(tab=>{const selected=tab.dataset.accountTab===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1});root.querySelectorAll('[data-account-panel]').forEach(panel=>{panel.hidden=panel.dataset.accountPanel!==key});};
    modalBody?.querySelectorAll('[data-account-tab]').forEach(tab=>tab.tabIndex=tab.dataset.accountTab==='overview'?0:-1);
  };
  window.openCustomerServiceTracking=async function(code,button){const card=button?.closest('.customer-order'),host=card?.querySelector('.customer-order-tracking');if(!host)return;if(!host.classList.contains('hidden')){host.classList.add('hidden');host.innerHTML='';button.setAttribute('aria-expanded','false');button.textContent='Acompanhar serviço';return}host.classList.remove('hidden');host.innerHTML='<p class="helper">Carregando acompanhamento…</p>';button.setAttribute('aria-expanded','true');button.textContent='Ocultar acompanhamento';try{const response=await fetch(apiBase()+'/api/public/track?code='+encodeURIComponent(code)),data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Não foi possível carregar o acompanhamento.');const service=data.service;if(!service)throw Error('Este código não corresponde a um serviço.');const items=(service.items||[]).map(item=>`<li>${esc(item.type)}${item.kg?' · '+esc(item.kg)+' kg':''} — <b>${esc(item.status)}</b></li>`).join('');host.innerHTML=`<p><b>Status geral:</b> <span class="status ${service.status==='Concluído'?'success':'warn'}">${esc(service.status)}</span></p><p>Solicitado em ${esc(service.date?new Date(service.date).toLocaleDateString('pt-BR'):'data não informada')}</p><ul>${items||'<li>Detalhes indisponíveis.</li>'}</ul>`}catch(error){host.innerHTML=`<p role="alert">${esc(error.message)}</p>`}};
  window.copyOrderCode=async code=>{try{await navigator.clipboard.writeText(code);toast('Código copiado.')}catch{toast('Código do pedido: '+code)}};
  window.copyOrderPix=async id=>{let value=document.getElementById('pix-'+id)?.value||'';try{await navigator.clipboard.writeText(value);toast('Pix copia e cola copiado.')}catch{toast(value)}};

  window.cancelMaintenanceOrder=function(orderId){
    const order=(db.orders||[]).find(item=>item.id===orderId||item.code===orderId);if(!order)return;
    const body=`<p>Pedido <b>${esc(order.code)}</b>. O cancelamento ficará registrado no histórico e o cliente poderá fazer outro pedido.</p><div class="form-field"><label for="cancel-order-reason">Motivo do cancelamento</label><textarea id="cancel-order-reason" name="reason" required minlength="8" maxlength="1000" rows="4" placeholder="Descreva por que o serviço está sendo cancelado."></textarea></div>`;
    openModal('Cancelar pedido de manutenção',body,async form=>{
      const reason=String(form.get('reason')||'').trim();if(reason.length<8){toast('Informe um motivo com pelo menos 8 caracteres.');return false}
      try{const response=await apiCall('/api/admin/orders/cancel','POST',{orderId:order.id||order.code,reason}),data=await apiJson(response);if(!response.ok)throw Error(data.error||'Não foi possível cancelar o pedido.');db=data.state||db;saveLocal();closeModal();renderPage();toast('Pedido cancelado. O histórico foi preservado.')}catch(error){toast(error.message||'Não foi possível cancelar o pedido.')}
      return false;
    },'Cancelar pedido');
  };
  window.openServiceReviewFromOrder=function(serviceId,code){
    window.go?.('services');
    setTimeout(()=>{const input=document.querySelector('#content .panel-head input.search');if(input){input.value=String(code||'');input.dispatchEvent(new Event('input',{bubbles:true}))}},80);
  };
  const originalOrdersPage=window.ordersPage;
  if(typeof originalOrdersPage==='function')window.ordersPage=function(container){
    originalOrdersPage(container);
    const table=container.querySelector('.table-wrap table');if(!table)return;
    table.querySelector('thead tr').insertAdjacentHTML('beforeend','<th>Ações</th>');
    const finalStage=(db.settings.stages||[]).slice(-1)[0]||'Concluído';
    for(const [index,order] of [...(db.orders||[])].slice().reverse().entries()){
      const row=table.querySelectorAll('tbody tr')[index];if(!row)continue;
      const service=order.kind==='Manutenção'?(db.services||[]).find(item=>item.code===order.code):null;
      const allItemsDone=Boolean(service?.items?.length&&service.items.every(item=>item.status===finalStage||item.status==='Concluído'));
      const cancelled=Boolean(order.cancelledAt||service?.cancelledAt);
      const awaitingReview=Boolean(service&&!service.closed&&!cancelled&&(service.employeeCompletedAt||allItemsDone));
      if(cancelled){const status=row.cells[6]?.querySelector('.status');if(status){status.textContent='Cancelado';status.className='status'} }
      else if(awaitingReview){const status=row.cells[6]?.querySelector('.status');if(status){status.textContent='Aguardando conferência';status.className='status warn'}}
      const paid=isPaid(order),awaitingDelivery=Boolean(service&&service.closed&&order.fulfillmentMethod==='delivery'&&order.deliveryStatus!=='Entregue');
      const canMarkPaid=Boolean(!cancelled&&!paid&&order.paymentQr&&(!service||service.closed&&order.confirmedAt&&(order.fulfillmentMethod!=='delivery'||order.deliveryStatus==='Entregue')));
      let actionMarkup;
      if(cancelled)actionMarkup='<span class="status">Cancelado</span>';
      else if(paid)actionMarkup='<span class="status success">Pago</span>';
      else if(awaitingReview)actionMarkup=`<button type="button" class="btn btn-primary" onclick="openServiceReviewFromOrder('${esc(service.id)}','${esc(order.code)}')">Revisar manutenção</button>`;
      else if(awaitingDelivery)actionMarkup='<span class="status warn">Aguardando entrega</span>';
      else if(service&&!service.closed&&order.confirmedAt)actionMarkup='<span class="status warn">Confirmado · aguardando conclusão</span>';
      else if(service&&!service.closed)actionMarkup=`<button type="button" class="btn btn-primary" onclick="prepareOrderPayment('${esc(order.id||order.code)}')">Confirmar pedido</button>`;
      else if(service&&!order.paymentQr)actionMarkup=`<button type="button" class="btn btn-primary" onclick="prepareOrderPayment('${esc(order.id||order.code)}')">Definir valor e liberar Pix</button>`;
      else if(!service&&!order.paymentQr)actionMarkup=`<button type="button" class="btn btn-primary" onclick="prepareOrderPayment('${esc(order.id||order.code)}')">Gerar Pix</button>`;
      else actionMarkup='<span class="status success">Pix liberado</span>';
      const cancelButton=Boolean(service&&!service.closed&&!cancelled&&!paid)?`<button type="button" class="btn btn-soft btn-small cancel-maintenance-order" onclick="cancelMaintenanceOrder('${esc(order.id||order.code)}')">Cancelar pedido</button>`:'';
      row.insertAdjacentHTML('beforeend',`<td><div class="order-admin-actions">${actionMarkup}${cancelButton}${canMarkPaid?`<button type="button" class="btn btn-soft" onclick="markOrderPaid('${esc(order.id||order.code)}')">Marcar pago</button>`:''}</div></td>`);
    }
  };
  window.prepareOrderPayment=function(orderId){
    const order=(db.orders||[]).find(item=>item.id===orderId||item.code===orderId);if(!order)return;
    const amount=Number(order.total)||0,body=`<p>Revise o pedido <b>${esc(order.code)}</b>. Para serviços, o Pix será liberado após a conclusão e a confirmação administrativa; para compras, ele poderá ser liberado agora.</p>${order.kind==='Manutenção'&&!(db.services||[]).find(item=>item.code===order.code)?.closed?'<p class="helper">A confirmação registra o pedido. O QR Code só ficará visível ao cliente depois da finalização administrativa do serviço.</p>':''}<div class="form-grid">${order.kind==='Manutenção'||amount<=0?`<div class="form-field span2"><label for="order-payment-amount">${order.kind==='Manutenção'?'Valor do serviço':'Valor confirmado do pedido'} (R$)</label><input id="order-payment-amount" name="amount" type="number" min="0.01" step="0.01" required value="${amount>0?esc(amount):''}"></div>`:`<p class="helper span2">Valor do pedido: <b>${moneyText(amount)}</b>.</p>`}<p class="helper span2">Chave Pix: <b>${esc(db.settings.pixKey||'Não cadastrada')}</b><br>Cidade recebedora: <b>${esc(db.settings.pixCity||'Não cadastrada')}</b></p></div>`;
    const isOpenService=order.kind==='Manutenção'&&!(db.services||[]).find(item=>item.code===order.code)?.closed;
    openModal(isOpenService?'Confirmar pedido':'Confirmar pedido e gerar Pix',body,async form=>{const payload={orderId,action:'release-payment'};if(order.kind==='Manutenção'||Number(order.total)<=0)payload.amount=Number(form.get('amount'));try{const response=await apiCall('/api/admin/orders/payment','POST',payload),data=await apiJson(response);if(!response.ok)throw Error(data.error||'Não foi possível liberar o pagamento.');db=data.state;saveLocal();closeModal();renderPage();toast(order.kind==='Manutenção'&&!(db.services||[]).find(item=>item.code===order.code)?.closed?'Pedido confirmado. O Pix ficará disponível após a conclusão do serviço.':'Pedido confirmado e pagamento liberado para o cliente.')}catch(error){toast(error.message)}return false},isOpenService?'Confirmar pedido':'Gerar Pix e liberar');
  };
  window.markOrderPaid=async orderId=>{if(!confirm('Confirma que o pagamento deste pedido foi recebido?'))return;try{const response=await apiCall('/api/admin/orders/payment','POST',{orderId,action:'mark-paid'}),data=await apiJson(response);if(!response.ok)throw Error(data.error||'Não foi possível confirmar o pagamento.');db=data.state;saveLocal();renderPage();toast('Pagamento marcado como recebido.')}catch(error){toast(error.message)}};
})();

;

;/* SOURCE: pix-provider-settings.js */
/* Configuração segura para provedores com API Pix padronizada. */
(() => {
  const byId=id=>document.getElementById(id);
  const status=(message,error=false)=>{const node=byId('pixProviderStatus');if(node){node.textContent=message;node.setAttribute('role',error?'alert':'status');node.classList.toggle('error',error)}};
  async function load(){const form=byId('pixProviderForm');if(!form||form.dataset.loaded)return;form.dataset.loaded='1';try{const response=await apiCall('/api/admin/pix-provider'),data=await apiJson(response);if(!response.ok)throw Error(data.error||'Não foi possível carregar a integração.');for(const name of ['providerName','apiBaseUrl','tokenUrl','clientId','scope','pixKey','mtlsBinding'])if(form.elements[name])form.elements[name].value=data[name]||'';if(form.elements.enabled)form.elements.enabled.checked=Boolean(data.enabled);status(data.configured?`Configuração salva${data.clientSecretConfigured?' · segredo protegido':''}${data.enabled?' · integração ativa':' · integração desligada'}`:'Nenhuma integração configurada.');}catch(error){form.dataset.loaded='';status(error.message,true)}}
  window.savePixProviderConfig=async function(event){event.preventDefault();const form=event.currentTarget,values=new FormData(form),data={};for(const name of ['providerName','apiBaseUrl','tokenUrl','clientId','clientSecret','scope','pixKey','mtlsBinding'])data[name]=String(values.get(name)||'').trim();data.enabled=form.elements.enabled.checked;data.clearClientSecret=form.elements.clearClientSecret.checked;try{status('Salvando configuração…');const response=await apiCall('/api/admin/pix-provider','POST',data),result=await apiJson(response);if(!response.ok)throw Error(result.error||'Não foi possível salvar.');form.elements.clientSecret.value='';status(`${result.configured?'Configuração salva':'Configuração salva'}${result.enabled?' · integração ativa':' · integração desligada'}`);toast('Configuração Pix salva com proteção.');}catch(error){status(error.message,true);toast(error.message)}};
  window.testPixProvider=async function(){try{status('Validando credenciais e registrando o webhook no banco…');const response=await apiCall('/api/admin/pix-provider/test','POST',{}),result=await apiJson(response);if(!response.ok)throw Error(result.error||'Não foi possível validar a integração.');status(result.message||'Integração validada.');toast('Integração Pix validada.')}catch(error){status(error.message,true);toast(error.message)}};
  const observer=new MutationObserver(()=>{if(byId('pixProviderForm'))load()});observer.observe(document.body,{childList:true,subtree:true});load();
})();

;

;/* SOURCE: staff-maintenance.js */
/* Registo autenticado para vendedor/funcionário e edição restrita ao administrador. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Date().toISOString().slice(0,10);
  const lineMarkup = () => `<div class="team-service-line"><label>Tipo<input name="itemType" list="teamServiceTypes" required placeholder="Ex.: Pó químico ABC"></label><label>Peso (kg)<input name="itemKg" inputmode="decimal" placeholder="Ex.: 6"></label><label>Qtd.<input name="itemQty" type="number" min="1" max="50" step="1" value="1" required></label><button type="button" class="icon-btn" aria-label="Remover extintor" onclick="this.closest('.team-service-line').remove()">Remover</button></div>`;
  window.addTeamServiceLine = function(){document.querySelector('#teamServiceLines')?.insertAdjacentHTML('beforeend',lineMarkup());};
  window.openTeamMaintenanceForm = function(role){
    const isEmployee=role==='employee',body=`<p class="helper">Informe o nome do serviço e os extintores. Cliente e contato são opcionais. ${isEmployee?'O serviço ficará atribuído ao seu usuário.':'O serviço ficará identificado com seu usuário de vendedor e disponível para a equipe técnica.'}</p><datalist id="teamServiceTypes">${[...new Set((db.types||[]).map(x=>x.name))].map(name=>`<option value="${esc(name)}">`).join('')}</datalist><div class="form-grid"><div class="form-field"><label>Cliente / empresa (opcional)</label><input name="clientName" maxlength="100" autocomplete="organization"></div><div class="form-field"><label>Telefone / WhatsApp (opcional)</label><input name="clientPhone" type="tel" maxlength="30" autocomplete="tel"></div><div class="form-field"><label>E-mail (opcional)</label><input name="clientEmail" type="email" maxlength="254" autocomplete="email"></div><div class="form-field"><label>Nome do serviço *</label><input name="serviceType" list="teamServiceTypes" required maxlength="100" placeholder="Ex.: Manutenção preventiva"></div><div class="form-field"><label>Data *</label><input name="date" type="date" required value="${today()}"></div><div class="form-field"><label>Valor do serviço (R$)</label><input name="serviceAmount" type="number" min="0" max="1000000" step="0.01" placeholder="Usar preço de catálogo se vazio"></div><div class="form-field"><label>Próxima manutenção (mês e ano)</label><input name="nextMaintenanceMonth" type="month" aria-describedby="nextMaintenanceHelp"><small id="nextMaintenanceHelp">Informe somente o mês e o ano, se já estiver definido.</small></div><div class="form-field span2"><label>Extintores *</label><div id="teamServiceLines">${lineMarkup()}</div><button type="button" class="btn btn-soft btn-small" onclick="addTeamServiceLine()">＋ Adicionar tipo</button><small>Informe tipo, peso quando aplicável e quantidade. Você pode adicionar vários tipos.</small></div><div class="form-field"><label>Peças previstas</label><input name="parts" maxlength="1000"></div><div class="form-field span2"><label>Observações</label><textarea name="notes" rows="3" maxlength="3000"></textarea></div></div>`;
    openModal('Registrar manutenção',body,async form=>{
      const rows=[...document.querySelectorAll('#teamServiceLines .team-service-line')],items=rows.map(row=>({type:row.querySelector('[name="itemType"]').value.trim(),kg:row.querySelector('[name="itemKg"]').value.trim(),qty:Number(row.querySelector('[name="itemQty"]').value)}));
      if(!items.length||items.some(x=>!x.type||!Number.isInteger(x.qty)||x.qty<1||x.qty>50)){toast('Confira os dados dos extintores.');return false}
      const data={customerId:String(form.get('customerId')||''),clientName:String(form.get('clientName')||'').trim(),clientPhone:String(form.get('clientPhone')||'').trim(),clientEmail:String(form.get('clientEmail')||'').trim(),serviceType:String(form.get('serviceType')||''),date:String(form.get('date')||''),nextMaintenanceMonth:String(form.get('nextMaintenanceMonth')||''),serviceAmount:String(form.get('serviceAmount')||''),parts:String(form.get('parts')||''),notes:String(form.get('notes')||''),items};
      try{const response=await apiCall(`/api/${isEmployee?'employee':'seller'}/services`,'POST',data),result=await apiJson(response);if(!response.ok)throw Error(result.error||'Não foi possível registrar a manutenção.');closeModal();toast(`Manutenção registrada · ${result.service.code}`);if(isEmployee){const r=await apiCall('/api/employee/services'),latest=await apiJson(r);if(r.ok){const host=document.getElementById('employeePortal');host?.querySelector('h1')?.scrollIntoView({block:'start'});if(typeof window.refreshEmployeeAfterCreate==='function')window.refreshEmployeeAfterCreate(latest.services||[])}}else if(typeof window.loadSellerServices==='function')window.loadSellerServices();}catch(error){toast(error.message)}return false;
    },'Registrar manutenção');
  };
  function addTeamPanelButtons(){
    const root=document.getElementById('employeePortal');if(!root||root.classList.contains('hidden'))return;
    const role=localStorage.getItem('protecextintores_role');
    if(role==='employee'&&!root.querySelector('[data-team-register="employee"]')){const heading=root.querySelector('.employee-main h1');if(heading)heading.insertAdjacentHTML('afterend','<button type="button" class="btn team-register-service" data-team-register="employee" onclick="openTeamMaintenanceForm(\'employee\')">＋ Registrar serviço</button>')}
    if(role==='seller'&&!root.querySelector('[data-team-register="seller"]')){const header=root.querySelector('.seller-top');if(header)header.querySelector('button')?.insertAdjacentHTML('beforebegin','<button type="button" class="btn btn-small" data-team-register="seller" onclick="openTeamMaintenanceForm(\'seller\')">＋ Registrar serviço</button>')}
  }
  new MutationObserver(addTeamPanelButtons).observe(document.getElementById('employeePortal')||document.body,{childList:true,subtree:true});

  const oldServiceTable=window.serviceTable;
  if(typeof oldServiceTable==='function')window.serviceTable=function(list){
    const template=document.createElement('template');template.innerHTML=oldServiceTable(list);const table=template.content.querySelector('table');if(!table)return template.innerHTML;
    const headers=[...table.querySelectorAll('thead th')],employeeIndex=headers.findIndex(h=>h.textContent.trim()==='Funcionário'),actionIndex=headers.findIndex(h=>h.textContent.trim()==='Ações');
    const sellerHead=document.createElement('th');sellerHead.textContent='Vendedor responsável';headers[employeeIndex>=0?employeeIndex+1:headers.length-1]?.after(sellerHead);
    [...table.querySelectorAll('tbody tr')].forEach((row,index)=>{const service=list[index];if(!service)return;const cells=[...row.children],sellerCell=document.createElement('td');sellerCell.textContent=service.sellerName||'—';cells[employeeIndex>=0?employeeIndex+1:cells.length-1]?.after(sellerCell);const actions=row.querySelector('td:last-child');if(actions)actions.insertAdjacentHTML('beforeend',` <button type="button" class="icon-btn" onclick="editServiceRecord('${esc(service.id)}')">Editar cadastro</button>`)});
    return template.innerHTML;
  };
  window.editServiceRecord=function(serviceId){
    const service=(db.services||[]).find(x=>x.id===serviceId);if(!service)return;
    const equipment=(service.items||[]).map(item=>`${item.type||'Extintor'} | ${item.kg||''} | ${item.serial||''}`).join('\n');
    const body=`<p class="helper">Edição administrativa do cadastro. Use uma linha por extintor no formato: tipo | peso em kg | número de série. Os status e o histórico técnico existentes são preservados quando o extintor permanece na mesma posição.</p><div class="form-grid"><div class="form-field"><label>Cliente / empresa *</label><input name="clientName" value="${esc(service.clientName||'')}"></div><div class="form-field"><label>Telefone</label><input name="clientPhone" value="${esc(service.clientPhone)}"></div><div class="form-field"><label>E-mail</label><input name="clientEmail" type="email" value="${esc(service.clientEmail)}"></div><div class="form-field"><label>Tipo de serviço *</label><input name="serviceType" required value="${esc(service.serviceType)}"></div><div class="form-field"><label>Data *</label><input name="date" type="date" required value="${esc(service.date)}"></div><div class="form-field"><label>Vendedor responsável</label><input name="sellerName" value="${esc(service.sellerName)}"></div><div class="form-field"><label>Funcionário responsável</label><input name="employeeName" value="${esc(service.employeeName)}"></div><div class="form-field span2"><label>Extintores *</label><textarea name="equipment" rows="6" required>${esc(equipment)}</textarea></div><div class="form-field"><label>Peças previstas</label><input name="parts" value="${esc(service.parts)}"></div><div class="form-field span2"><label>Observações</label><textarea name="notes" rows="3">${esc(service.notes)}</textarea></div></div>`;
    openModal('Editar cadastro da manutenção · '+esc(service.code),body,async form=>{
      const items=String(form.get('equipment')||'').split(/\r?\n/).map(line=>{const [type='',kg='',serial='']=line.split('|');return{type:type.trim(),kg:kg.trim(),serial:serial.trim()}}).filter(item=>item.type);
      try{const response=await apiCall('/api/admin/services/update','POST',{serviceId,clientName:form.get('clientName'),clientPhone:form.get('clientPhone'),clientEmail:form.get('clientEmail'),serviceType:form.get('serviceType'),date:form.get('date'),sellerName:form.get('sellerName'),employeeName:form.get('employeeName'),parts:form.get('parts'),notes:form.get('notes'),items}),result=await apiJson(response);if(!response.ok)throw Error(result.error||'Não foi possível salvar as alterações.');db=result.state;saveLocal();closeModal();renderPage();toast('Cadastro da manutenção atualizado pelo administrador.')}catch(error){toast(error.message)}return false;
    },'Salvar alterações');
  };
})();

;

;/* SOURCE: customer-care.js */
/* Área de pós-venda: solicitações de garantia e avaliações de serviços. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const base=()=>(window.PROTEC_API_BASE_URL||'').replace(/\/$/,'');
  const token=()=>window.customerAccountState?.token||localStorage.getItem('protecextintores_customer_session')||'';
  async function get(path){const r=await fetch(base()+path,{headers:{Authorization:'Bearer '+token()}}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível carregar seus dados.');return d}
  async function post(path,payload){const r=await fetch(base()+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token()},body:JSON.stringify(payload)}),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível salvar.');return d}
  const priorOpen=window.openCustomerAccount;
  window.openCustomerAccount=async function(){await priorOpen?.();if(!window.customerAccountState?.authenticated)return;const body=document.querySelector('#modalRoot .modal-body');if(!body)return;const host=body.querySelector('#customerSupportMount')||body;host.insertAdjacentHTML('beforeend','<section class="customer-care" id="customerCare"><h3>Pós-venda</h3><p class="helper">Solicite análise de garantia e avalie serviços concluídos da sua conta.</p><div role="status">Carregando garantia e avaliações…</div></section>');try{const [care,orders]=await Promise.all([get('/api/customer/care'),get('/api/customer/orders')]);const claims=(care.claims||[]).map(c=>`<article class="care-card"><div class="care-card-head"><b>${esc(c.code)}</b><span class="status warn">${esc(c.status)}</span></div><p>${esc(c.issue_type)} · compra ${esc(c.order_code)}</p><ul>${(c.items||[]).map(i=>`<li>${esc(i.quantity)} × ${esc(i.productName)}${i.serial?' · série '+esc(i.serial):''} · ${esc(i.status||'Em análise')}${i.diagnosis?' — '+esc(i.diagnosis):''}</li>`).join('')}</ul>${c.admin_response?`<p><b>Resposta:</b> ${esc(c.admin_response)}</p>`:''}<details><summary>Histórico</summary>${(c.events||[]).map(e=>`<p><b>${esc(e.event)}</b> · ${esc(e.createdAt)}<br>${esc(e.message)}</p>`).join('')}</details></article>`).join('');const sales=(orders.orders||[]).filter(o=>o.kind==='Venda');const reviews=new Map((care.reviews||[]).map(r=>[r.serviceCode,r]));const eligible=(care.eligibleServices||[]).map(s=>{const r=reviews.get(s.code);return `<article class="care-card"><div class="care-card-head"><b>${esc(s.code)} · ${esc(s.serviceType)}</b><span>${r?`Avaliação: ${esc(r.status)}`:'Concluído'}</span></div><small>${esc(s.date)}</small>${r?`<p>Sua nota: ${esc(r.rating)}/5${r.adminResponse?` · Resposta: ${esc(r.adminResponse)}`:''}</p>`:`<button type="button" class="btn btn-soft btn-small" onclick="openServiceReview('${esc(s.code)}')">Avaliar atendimento</button>`}</article>`}).join('');const section=document.getElementById('customerCare');if(section)section.innerHTML=`<h3>Pós-venda</h3><p class="helper">O envio de uma solicitação abre uma análise; não confirma automaticamente cobertura ou troca.</p><button type="button" class="btn btn-small" onclick="openWarrantyRequest()">Solicitar garantia</button><h4>Minhas solicitações de garantia</h4>${claims||'<p class="empty">Nenhuma solicitação registrada.</p>'}<h4>Serviços que posso avaliar</h4>${eligible||'<p class="empty">Não há serviços concluídos disponíveis para avaliação.</p>'}<p class="helper">A garantia pode ser solicitada somente para produtos vendidos registrados nesta conta. Caso a compra não apareça, entre em contato com o atendimento.</p>`;window.customerCareOrders=sales;}catch(error){const section=document.getElementById('customerCare');if(section)section.innerHTML=`<h3>Pós-venda</h3><p role="alert">${esc(error.message)}</p>`}};
  window.openWarrantyRequest=async function(){try{const orders=window.customerCareOrders||((await get('/api/customer/orders')).orders||[]).filter(o=>o.kind==='Venda');if(!orders.length){toast('Não encontrei compras vinculadas à sua conta.');return}const body=`<p class="helper">Selecione cada produto afetado. A empresa analisará cada extintor e retornará pelo protocolo.</p><div class="form-field"><label>Compra *</label><select name="orderCode" required><option value="">Selecione…</option>${orders.map(o=>`<option value="${esc(o.code)}">${esc(o.code)} · ${esc(new Date(o.receivedAt).toLocaleDateString('pt-BR'))}</option>`).join('')}</select></div><div id="warrantyItems" class="form-field"><small>Selecione uma compra para listar os produtos.</small></div><div class="form-field"><label>Problema observado *</label><select name="issueType" required><option value="">Selecione…</option>${['Não funcionou','Sem pressão aparente','Vazamento','Avaria','Outro'].map(x=>`<option>${x}</option>`).join('')}</select></div><div class="form-field"><label>Descreva o que aconteceu *</label><textarea name="details" minlength="10" maxlength="2000" rows="4" required></textarea></div><p class="helper">Se o extintor parecer defeituoso, não o considere confiável até a avaliação. Em uma emergência, procure os serviços de emergência.</p>`;openModal('Solicitar análise de garantia',body,async form=>{const order=orders.find(o=>o.code===String(form.get('orderCode')||''));if(!order)return false;const items=[...(document.querySelectorAll('#warrantyItems input[data-warranty-index]:checked'))].map(input=>({itemIndex:Number(input.dataset.warrantyIndex),quantity:Number(document.querySelector(`[name="warrantyQty_${input.dataset.warrantyIndex}"]`)?.value)||1})),serials=Object.fromEntries(items.map(item=>[item.itemIndex,String(form.get(`warrantySerial_${item.itemIndex}`)||'').trim()]));try{const d=await post('/api/customer/care',{orderCode:order.code,issueType:form.get('issueType'),details:form.get('details'),items,serials});closeModal();toast('Solicitação registrada · '+d.claim.code);window.openCustomerAccount();}catch(error){toast(error.message)}return false},'Enviar solicitação');const select=document.querySelector('#editForm select[name="orderCode"]'),render=()=>{const order=orders.find(o=>o.code===select.value),target=document.getElementById('warrantyItems');if(!target)return;target.innerHTML=order?order.items.map((item,index)=>`<label class="warranty-select-item"><input type="checkbox" data-warranty-index="${index}"><span><b>${esc(item.name)}</b><small>Disponível na compra: ${esc(item.qty)}</small></span><span class=\"serial-input\"><input name=\"warrantySerial_${index}\" maxlength=100 placeholder=\"Nº de série (opcional)\" aria-label=\"Número de série de ${esc(item.name)}\"><span>Qtd.<input name="warrantyQty_${index}" type="number" min="1" max="${esc(item.qty)}" value="1"></span></label>`).join(''):'<small>Selecione uma compra para listar os produtos.</small>'};select?.addEventListener('change',render); }catch(error){toast(error.message)}};
  window.openServiceReview=function(serviceCode){const body=`<p>Conte como foi sua experiência com o serviço ${esc(serviceCode)}.</p><div class="form-grid">${[['rating','Nota geral'],['quality','Qualidade'],['punctuality','Pontualidade'],['communication','Comunicação']].map(([name,label])=>`<div class="form-field"><label>${label} (1 a 5)</label><select name="${name}" required>${[5,4,3,2,1].map(n=>`<option value="${n}" ${n===5?'selected':''}>${n} · ${n===5?'Ótimo':n===4?'Bom':n===3?'Regular':n===2?'Ruim':'Muito ruim'}</option>`).join('')}</select></div>`).join('')}<div class="form-field span2"><label>Comentário (opcional)</label><textarea name="comment" maxlength="1500" rows="4"></textarea></div><label class="form-field span2"><span><input type="checkbox" name="consentPublic"> Autorizo que o comentário seja publicado sem meu nome, após moderação.</span></label></div>`;openModal('Avaliar serviço concluído',body,async form=>{try{await post('/api/customer/care/review',{serviceCode,rating:Number(form.get('rating')),quality:Number(form.get('quality')),punctuality:Number(form.get('punctuality')),communication:Number(form.get('communication')),comment:form.get('comment'),consentPublic:form.has('consentPublic')});closeModal();toast('Avaliação enviada para moderação.');window.openCustomerAccount()}catch(error){toast(error.message)}return false},'Enviar avaliação')};
})();

;

;/* SOURCE: customer-care-admin.js */
/* Admin queue for warranty claims and moderated service reviews. */
(() => {
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stateLabels={warranties:'Garantias',reviews:'Avaliações'};
  async function request(path,method='GET',payload=null){const r=await apiCall(path,method,payload),d=await apiJson(r);if(!r.ok)throw Error(d.error||'Não foi possível carregar esta área.');return d}
  function loadPage(kind,container){container.innerHTML=`<div class="page-title"><div><h1>${stateLabels[kind]}</h1><p>${kind==='warranties'?'Triagem e decisão dos pedidos de garantia dos clientes.':'Avaliações enviadas pelos clientes após serviços concluídos.'}</p></div><button class="btn btn-soft btn-small" onclick="renderPage()">Atualizar</button></div><div class="panel-head care-admin-tools"><label for="careAdminSearch">Buscar por protocolo, cliente ou status</label><input id="careAdminSearch" type="search" placeholder="Digite para filtrar…" oninput="filterCareAdmin(this.value)"></div><div class="panel" id="careAdminList" aria-live="polite">Carregando…</div>`;request('/api/admin/care').then(data=>{const host=document.getElementById('careAdminList');if(!host)return;window.adminWarrantyClaims=Object.fromEntries((data.claims||[]).map(claim=>[claim.id,claim]));host.innerHTML=kind==='warranties'?renderClaims(data.claims||[]):renderReviews(data.reviews||[])}).catch(error=>{const host=document.getElementById('careAdminList');if(host)host.innerHTML=`<p role="alert">${esc(error.message)}</p>`})}
  window.filterCareAdmin=function(query=''){const value=String(query||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');document.querySelectorAll('#careAdminList .care-admin-card').forEach(card=>{card.hidden=!card.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').includes(value);});};
  function renderClaims(claims){return claims.length?claims.map(c=>`<article class="care-admin-card"><div class="care-card-head"><div><b>${esc(c.code)}</b><small> · ${esc(c.customer_name)} · ${esc(c.customer_email)}</small></div><span class="status warn">${esc(c.status)}</span></div><p>Compra ${esc(c.order_code)} · ${esc(c.issue_type)} · ${esc(new Date(c.created_at).toLocaleString('pt-BR'))}</p><p>${esc(c.details)}</p><ul>${(c.items||[]).map(i=>`<li>${esc(i.quantity)} × ${esc(i.productName)}${i.serial?' · série '+esc(i.serial):''} · <b>${esc(i.status||'Em análise')}</b>${i.diagnosis?' — '+esc(i.diagnosis):''}</li>`).join('')}</ul>${c.admin_response?`<p><b>Resposta enviada:</b> ${esc(c.admin_response)}</p>`:''}<button type="button" class="btn btn-small" onclick="editWarrantyClaim('${esc(c.id)}','${esc(c.status)}','${esc(c.admin_response||'')}')">Atualizar análise</button></article>`).join(''):'<div class="empty">Nenhum pedido de garantia.</div>'}
  function renderReviews(reviews){return reviews.length?reviews.map(r=>`<article class="care-admin-card"><div class="care-card-head"><div><b>${esc(r.service_code)}</b><small> · ${esc(r.customer_name)} · ${esc(r.customer_email)}</small></div><span class="status ${r.status==='published'?'success':'warn'}">${esc(r.status==='published'?'Publicada':r.status==='hidden'?'Oculta':'Pendente')}</span></div><p><b>${esc(r.rating)}/5</b> geral · Qualidade ${esc(r.quality)}/5 · Pontualidade ${esc(r.punctuality)}/5 · Comunicação ${esc(r.communication)}/5</p><p>${esc(r.comment||'Sem comentário.')}</p><p class="helper">${r.consent_public?'Cliente autorizou publicação.':'Sem autorização pública.'}</p>${r.admin_response?`<p><b>Resposta da empresa:</b> ${esc(r.admin_response)}</p>`:''}<button type="button" class="btn btn-small" onclick="editServiceReview('${esc(r.id)}','${esc(r.status)}','${esc(r.admin_response||'')}')">Moderar / responder</button></article>`).join(''):'<div class="empty">Ainda não há avaliações.</div>'}
  window.editWarrantyClaim=function(id,status,response){const claim=window.adminWarrantyClaims?.[id],items=claim?.items||[],itemStatuses=['Em análise','Aprovado','Recusado','Aguardando devolução','Substituído','Reparado','Encerrado'],itemFields=items.map((item,index)=>`<fieldset class="warranty-admin-item"><legend>${esc(item.quantity)} × ${esc(item.productName)}${item.serial?' · série '+esc(item.serial):''}</legend><div class="form-field"><label>Resultado deste extintor</label><select name="itemStatus_${index}">${itemStatuses.map(value=>`<option ${value===(item.status||'Em análise')?'selected':''}>${value}</option>`).join('')}</select></div><div class="form-field"><label>Resultado / orientação para o cliente</label><textarea name="itemDiagnosis_${index}" rows=2 maxlength=1000>${esc(item.diagnosis||'')}</textarea></div></fieldset>`).join('');const body=`<div class="form-field"><label>Status geral da solicitação</label><select name="status">${['Recebida','Em análise','Aguardando cliente','Agendada avaliação','Aprovada','Recusada','Resolvida'].map(x=>`<option ${x===status?'selected':''}>${x}</option>`).join('')}</select></div><section class="warranty-admin-items"><h3>Decisão por extintor</h3><p class="helper">Registre o resultado individual. Uma solicitação pode ter mais de um extintor e decisões diferentes.</p>${itemFields}</section><div class="form-field"><label>Resposta geral ao cliente</label><textarea name="response" rows=4 maxlength=2000>${esc(response)}</textarea><small>Obrigatória para aprovar, recusar ou resolver a solicitação.</small></div>`;openModal('Analisar garantia',body,async f=>{try{const updates=items.map((item,index)=>({id:item.id,status:f.get('itemStatus_'+index),diagnosis:f.get('itemDiagnosis_'+index)}));await request('/api/admin/care/warranty','POST',{claimId:id,status:f.get('status'),response:f.get('response'),items:updates});closeModal();toast('Análise e decisões por extintor salvas.');renderPage()}catch(error){toast(error.message)}return false},'Salvar análise')};
  window.editServiceReview=function(id,status,response){const body=`<div class="form-field"><label>Moderação</label><select name="status"><option value="pending" ${status==='pending'?'selected':''}>Pendente</option><option value="published" ${status==='published'?'selected':''}>Publicar</option><option value="hidden" ${status==='hidden'?'selected':''}>Ocultar</option></select></div><div class="form-field"><label>Resposta pública da empresa</label><textarea name="response" rows="4" maxlength="1500">${esc(response)}</textarea></div><p class="helper">A publicação só será permitida quando o cliente tiver dado autorização.</p>`;openModal('Moderar avaliação',body,async f=>{try{await request('/api/admin/care/review','POST',{reviewId:id,status:f.get('status'),response:f.get('response')});closeModal();toast('Moderação atualizada.');renderPage()}catch(error){toast(error.message)}return false},'Salvar')};
  const original=window.renderPage;
  window.renderPage=function(targetPage){const current=targetPage||window.page||document.querySelector('.side-nav button.active')?.dataset.page;if(current==='warranties')return loadPage('warranties',document.getElementById('content'));if(current==='reviews')return loadPage('reviews',document.getElementById('content'));return original?.apply(this,arguments)};
})();

;

;/* SOURCE: review-widget.js */
/* Public wall of verified, customer-authorized reviews. */
(() => {
  const host=document.getElementById('publicReviewList');if(!host)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  fetch((window.PROTEC_API_BASE_URL||'').replace(/\/$/,'')+'/api/public/reviews').then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw Error('');const reviews=data.reviews||[];if(!reviews.length){host.closest('#publicReviews')?.remove();return}host.innerHTML=reviews.map(review=>`<article class="public-review"><div aria-label="Nota ${esc(review.rating)} de 5" class="review-stars">${'★'.repeat(Number(review.rating)||0)}${'☆'.repeat(Math.max(0,5-(Number(review.rating)||0)))}</div><p>${esc(review.comment||'Atendimento avaliado por cliente.')}</p>${review.response?`<p class="review-response"><b>Resposta da equipe:</b> ${esc(review.response)}</p>`:''}<small>Cliente verificado · ${esc(review.createdAt?new Date(review.createdAt).toLocaleDateString('pt-BR'):'')}</small></article>`).join('')}).catch(()=>host.closest('#publicReviews')?.remove());
})();

;

;/* SOURCE: dashboard-rebrand.js */
(() => {
  'use strict';

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escText = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const stat = (icon, value, label, tone = 'blue') => `<div class="dashboard-stat" data-tone="${tone}"><span class="dashboard-stat-icon" aria-hidden="true">${icon}</span><span class="dashboard-stat-copy"><b>${value}</b><span>${label}</span></span></div>`;

  function addWelcome(main, role, message) {
    if (q('.dashboard-welcome', main)) return;
    const title = q(':scope > h1', main), description = title?.nextElementSibling;
    const welcome = document.createElement('section');
    welcome.className = 'dashboard-welcome';
    welcome.setAttribute('aria-label', 'Resumo do painel');
    const copy = document.createElement('div');
    copy.className = 'dashboard-welcome-copy';
    copy.innerHTML = `<div class="dashboard-eyebrow">${role}</div>`;
    if (title) copy.append(title);
    if (description?.tagName === 'P') copy.append(description);
    if (description?.tagName === 'P' && message) description.textContent = message;
    const badge = document.createElement('span');
    badge.className = 'dashboard-role-chip';
    badge.innerHTML = `<span aria-hidden="true">●</span>${role}`;
    welcome.append(copy, badge);
    main.prepend(welcome);
    main.classList.add('dashboard-main');
  }

  function updateEmployeeStats(root) {
    const host = q('#employeeCards', root);
    if (!host) return;
    let stats = q('#employeeDashboardStats', root);
    if (!stats) {
      stats = document.createElement('section');
      stats.id = 'employeeDashboardStats';
      stats.className = 'dashboard-stats';
      stats.setAttribute('aria-label', 'Resumo dos serviços');
      host.before(stats);
    }
    const services = window.employeePortalState?.services || [];
    const isDone = service => Boolean(service.closed || (service.items?.length && service.items.every(item => item.status === 'Concluído')));
    const available = services.filter(service => !isDone(service) && !service.employeeId).length;
    const ongoing = services.filter(service => !isDone(service) && Boolean(service.employeeId)).length;
    const tabFinished = Number(q('.employee-tabs button:nth-child(2) span', root)?.textContent || 0);
    const completed = services.filter(isDone).length;
    const markup = stat('＋', available, 'Disponíveis para aceitar', 'amber') + stat('↻', ongoing, 'Em andamento', 'blue') + stat('✓', Math.max(completed, tabFinished), 'Concluídos', 'green');
    if (stats.innerHTML !== markup) stats.innerHTML = markup;
    qa('.employee-tabs [role="tab"]', root).forEach(tab => {
      const selected = tab.classList.contains('active');
      if (tab.getAttribute('aria-selected') !== String(selected)) tab.setAttribute('aria-selected', String(selected));
      if (tab.tabIndex !== (selected ? 0 : -1)) tab.tabIndex = selected ? 0 : -1;
    });
  }

  function enhanceTeamPortal() {
    const root = q('#employeePortal');
    if (!root || root.classList.contains('hidden')) return;
    const main = q('.employee-main', root);
    if (!main) return;
    const isSeller = main.classList.contains('seller-dashboard') || root.querySelector('.seller-top');
    addWelcome(main, isSeller ? 'Painel comercial' : 'Área técnica', isSeller ? 'Acompanhe os serviços que você registrou e consulte cada atualização até a finalização.' : 'Veja os atendimentos disponíveis, acompanhe as etapas em andamento e consulte seu histórico.');
    if (isSeller) {
      let stats = q('#sellerDashboardStats', main);
      if (!stats) {
        stats = document.createElement('section');
        stats.id = 'sellerDashboardStats';
        stats.className = 'dashboard-stats';
        stats.setAttribute('aria-label', 'Resumo dos serviços registrados');
        const section = q('.seller-service-tabs', main);
        section?.before(stats);
      }
      const services = window.sellerPortalState?.services || [];
      const done = services.filter(item => item.closed || (item.items?.length && item.items.every(row => row.status === 'Concluído'))).length;
      const open = Math.max(0, services.length - done);
      const markup = stat('▤', services.length, 'Serviços registrados') + stat('↻', open, 'Em acompanhamento', 'amber') + stat('✓', done, 'Finalizados', 'green');
      if (stats.innerHTML !== markup) stats.innerHTML = markup;
      qa('.seller-service-tabs button', main).forEach(button => {
        const selected = button.classList.contains('active');
        if (button.getAttribute('aria-pressed') !== String(selected)) button.setAttribute('aria-pressed', String(selected));
      });
    } else {
      updateEmployeeStats(root);
      if (root.dataset.dashboardTabsBound !== 'true') {
        root.dataset.dashboardTabsBound = 'true';
        root.addEventListener('click', event => {
          if (event.target.closest('.employee-tabs button')) requestAnimationFrame(() => updateEmployeeStats(root));
        });
      }
    }
  }

  function enhanceCustomerModal() {
    const body = q('#modalRoot .modal-body');
    if (!body || !q('.customer-account-header', body)) return;
    const modal = body.closest('.modal');
    modal?.classList.add('customer-dashboard-modal');
    const heading = q('.modal-head h2', modal);
    if (heading && heading.textContent === 'Painel do cliente') heading.textContent = 'Minha conta';
    const summary = q('.customer-dashboard-summary', body);
    if (summary) summary.setAttribute('aria-label', 'Resumo da conta');
    qa('.customer-order-group, .customer-care', body).forEach(section => {
      const title = q('h3', section);
      if (title) title.tabIndex = -1;
    });
  }

  function refresh() {
    enhanceTeamPortal();
    enhanceCustomerModal();
  }

  const observer = new MutationObserver(() => requestAnimationFrame(refresh));
  const start = () => {
    ['employeePortal','modalRoot'].forEach(id => {
      const target = document.getElementById(id);
      if (target) observer.observe(target, {childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-selected']});
    });
    refresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

;

;/* SOURCE: next-maintenance.js */
(() => {
  'use strict';
  const validMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
  const escHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const monthLabel = value => {
    if (!validMonth(value)) return 'Mês não definido';
    const [year,month]=String(value).split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month-1,1,12));
  };
  const monthCard = (service, admin=false) => `<article class="next-maintenance-card"><div class="next-maintenance-month"><span aria-hidden="true">◷</span><b>${escHtml(monthLabel(service.nextMaintenanceMonth))}</b></div><div class="next-maintenance-info"><b>${escHtml(service.code||'Serviço')}</b><span>${escHtml(service.clientName||'Sem cliente vinculado')} · ${escHtml(service.serviceType||'Manutenção')}</span><small>Status: ${escHtml(service.status||'Registrado')}</small></div>${admin?`<button type="button" class="btn btn-soft" data-edit-maintenance="${escHtml(service.id)}">Alterar mês</button>`:''}</article>`;
  const sortByMonth = rows => [...rows].sort((a,b)=>String(a.nextMaintenanceMonth||'').localeCompare(String(b.nextMaintenanceMonth||'')));

  window.renderNextMaintenancePage = function(container=document.getElementById('content')) {
    if (!container) return;
    const rows=sortByMonth((db.services||[]).filter(service=>validMonth(service.nextMaintenanceMonth)));
    const unscheduled=(db.services||[]).filter(service=>!validMonth(service.nextMaintenanceMonth));
    const now=new Date(),thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const upcoming=rows.filter(service=>service.nextMaintenanceMonth>=thisMonth),past=rows.filter(service=>service.nextMaintenanceMonth<thisMonth);
    document.getElementById('crumb').textContent='Próximas manutenções';
    container.innerHTML=`<div class="page-title"><div><h1>Próximas manutenções</h1><p>Previsões exibidas somente por mês e ano.</p></div><button type="button" class="btn btn-soft btn-small" onclick="go('services')">Voltar para manutenções</button></div><section class="next-maintenance-section"><h2>Próximas datas</h2>${upcoming.length?`<div class="next-maintenance-list">${upcoming.map(row=>monthCard(row,true)).join('')}</div>`:'<div class="empty">Nenhuma próxima manutenção está programada.</div>'}</section>${past.length?`<section class="next-maintenance-section"><h2>Previsões anteriores</h2><div class="next-maintenance-list">${past.map(row=>monthCard(row,true)).join('')}</div></section>`:''}<section class="next-maintenance-section"><h2>Sem mês definido</h2><p>Cadastros sem previsão podem receber um mês e ano quando a data for confirmada.</p>${unscheduled.length?`<div class="next-maintenance-list">${unscheduled.map(row=>`<article class="next-maintenance-card"><div class="next-maintenance-month is-empty"><span aria-hidden="true">◷</span><b>A definir</b></div><div class="next-maintenance-info"><b>${escHtml(row.code||'Serviço')}</b><span>${escHtml(row.clientName||'Sem cliente vinculado')} · ${escHtml(row.serviceType||'Manutenção')}</span></div><button type="button" class="btn btn-soft" data-edit-maintenance="${escHtml(row.id)}">Definir mês</button></article>`).join('')}</div>`:'<div class="empty">Todos os serviços já têm mês definido.</div>'}</section>`;
    container.querySelectorAll('[data-edit-maintenance]').forEach(button=>button.addEventListener('click',()=>window.editNextMaintenance(button.dataset.editMaintenance)));
  };

  window.editNextMaintenance = function(serviceId) {
    const service=(db.services||[]).find(item=>item.id===serviceId);if(!service)return;
    const body=`<p class="helper">Escolha somente o mês e o ano da próxima manutenção. O dia não é solicitado nem exibido.</p><div class="form-field"><label for="nextMaintenanceMonthEdit">Próxima manutenção (mês e ano)</label><input id="nextMaintenanceMonthEdit" name="month" type="month" required value="${validMonth(service.nextMaintenanceMonth)?escHtml(service.nextMaintenanceMonth):''}"></div>`;
    openModal('Definir próxima manutenção',body,async form=>{
      const value=String(form.get('month')||'');if(!validMonth(value)){toast('Informe um mês e ano válidos.');return false}
      const previous=service.nextMaintenanceMonth;service.nextMaintenanceMonth=value;
      if(!await save()){service.nextMaintenanceMonth=previous;saveLocal();return false}
      renderNextMaintenancePage();toast('Próxima manutenção atualizada.');return true;
    },'Salvar mês');
  };

  // Admin's dedicated page is part of the existing sidebar and route system.
  function installAdminPage(){
    const servicesButton=document.querySelector('.side-nav button[data-page="services"]');
    if(servicesButton&&!document.querySelector('.side-nav button[data-page="next-maintenance"]')){
      const button=document.createElement('button');button.type='button';button.dataset.page='next-maintenance';button.innerHTML='<span aria-hidden="true">◷</span><span class="navtext">Próximas manutenções</span>';servicesButton.after(button);
    }
    if(!window.nextMaintenanceRenderWrapped&&typeof window.renderPage==='function'){
      const original=window.renderPage;window.renderPage=function(){if(window.page==='next-maintenance')return window.renderNextMaintenancePage();return original.apply(this,arguments)};window.nextMaintenanceRenderWrapped=true;
    }
  }

  function staffPanel(){
    const root=document.getElementById('employeePortal');if(!root||root.classList.contains('hidden'))return;
    const role=localStorage.getItem('protecextintores_role');if(!['employee','seller'].includes(role))return;
    const header=root.querySelector('.employee-header-actions,.seller-top');if(!header)return;
    const existing=root.querySelector('#teamNextMaintenancePage');
    if(!existing){const page=document.createElement('section');page.id='teamNextMaintenancePage';page.className='next-maintenance-page hidden';page.innerHTML='<button type="button" class="btn btn-soft next-maintenance-back" onclick="closeNextMaintenancePage()">← Voltar ao painel</button><header class="next-maintenance-page-head"><span class="dashboard-eyebrow">Agenda de serviços</span><h1>Próximas manutenções</h1><p>Consulte as previsões registradas, somente com mês e ano.</p></header><div class="next-maintenance-loading" role="status">Carregando agenda…</div><div class="next-maintenance-list" id="teamNextMaintenanceList"></div>';root.append(page)}
    if(!root.querySelector('[data-open-next-maintenance]')){
      const button=document.createElement('button');button.type='button';button.className='btn btn-soft btn-small';button.dataset.openNextMaintenance='true';button.setAttribute('aria-controls','teamNextMaintenancePage');button.textContent='Próximas manutenções';button.addEventListener('click',()=>window.openNextMaintenancePage(role));
      const logout=header.querySelector('[onclick*="logout"]');if(logout)logout.before(button);else header.append(button);
    }
  }
  window.closeNextMaintenancePage=function(){const root=document.getElementById('employeePortal');root?.querySelector('.employee-main')?.classList.remove('hidden');root?.querySelector('#teamNextMaintenancePage')?.classList.add('hidden')};
  window.openNextMaintenancePage=async function(role){
    const root=document.getElementById('employeePortal'),main=root?.querySelector('.employee-main'),page=root?.querySelector('#teamNextMaintenancePage');if(!root||!main||!page)return;
    main.classList.add('hidden');page.classList.remove('hidden');const list=page.querySelector('#teamNextMaintenanceList'),loading=page.querySelector('.next-maintenance-loading');list.innerHTML='';loading.hidden=false;loading.textContent='Carregando agenda…';
    try{const response=await apiCall(`/api/${role}/next-maintenance`),data=await apiJson(response);if(!response.ok)throw Error(data.error||'Não foi possível carregar as próximas manutenções.');const rows=sortByMonth(data.services||[]);loading.hidden=true;list.innerHTML=rows.length?rows.map(row=>monthCard(row)).join(''):'<div class="empty">Ainda não há próximas manutenções registradas por esta conta.</div>'}
    catch(error){loading.hidden=false;loading.setAttribute('role','alert');loading.textContent=error.message||'Falha ao carregar a agenda.'}
  };

  installAdminPage();staffPanel();
  const observer=new MutationObserver(()=>{installAdminPage();staffPanel()});
  const admin=document.getElementById('dashboard');if(admin)observer.observe(admin,{childList:true,subtree:true});
  const team=document.getElementById('employeePortal');if(team)observer.observe(team,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('DOMContentLoaded',()=>{installAdminPage();staffPanel()},{once:true});
})();

;

;/* SOURCE: admin-rebrand.js */
(() => {
  'use strict';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const itemsOf = service => Array.isArray(service.items) ? service.items : [];
  const isCancelled = service => Boolean(service.cancelledAt || service.status === 'Cancelado');
  const finalStatus = service => !isCancelled(service) && Boolean(service.closed || service.closedAt);
  const actorRole = service => service.registeredByRole === 'employee' || service.registeredByRole === 'seller' ? service.registeredByRole : service.registeredByRole ? '' : service.sellerId || service.sellerName ? 'seller' : '';
  const actorName = service => service.registeredBy || (actorRole(service) === 'employee' ? service.employeeName : service.sellerName) || (actorRole(service) === 'employee' ? 'Funcionário sem identificação' : actorRole(service) === 'seller' ? 'Vendedor sem identificação' : 'Administração');
  const actorId = service => actorRole(service) === 'employee' ? service.employeeId || '' : service.sellerId || '';
  const monthLabel = value => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) return '—';
    const [year,month]=String(value).split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month-1,1,12));
  };
  const statusLabel = service => isCancelled(service) ? 'Cancelado' : finalStatus(service) ? 'Finalizado' : service.employeeCompletedAt ? 'Aguardando revisão' : service.status || itemsOf(service)[0]?.status || 'Em andamento';
  const servicePerson = (service,role) => {
    if (role === 'employee') return Boolean(service.employeeId);
    if (actorRole(service) !== role) return false;
    return true;
  };
  const recordsFor = (role,id,name) => (db.services||[]).filter(service => servicePerson(service,role) && (!id || (role==='employee'?service.employeeId:service.sellerId) === id || (!(role==='employee'?service.employeeId:service.sellerId)&&name&&(role==='employee'?service.employeeName:actorName(service))===name)));

  function installSidebar(){
    const servicesNav=document.querySelector('.side-nav button[data-page="services"]')?.closest('.side-nav');
    if(!servicesNav)return;
    if(document.querySelector('.side-nav button[data-page="employee-history"]')){syncMobileNav();return}
    const label=document.createElement('div');label.className='side-label admin-team-label';label.textContent='HISTÓRICO DA EQUIPE';
    const nav=document.createElement('nav');nav.className='side-nav admin-team-nav';nav.setAttribute('aria-label','Histórico de serviços da equipe');
    nav.innerHTML='<button type="button" data-page="employee-history"><span aria-hidden="true">♙</span><span class="navtext">Por funcionário</span></button><button type="button" data-page="seller-history"><span aria-hidden="true">♧</span><span class="navtext">Por vendedor</span></button>';
    const commercialLabel=[...document.querySelectorAll('.sidebar .side-label')].find(item=>item.textContent.trim()==='COMERCIAL');
    if(commercialLabel){commercialLabel.before(label,nav)}else servicesNav.after(label,nav);
    syncMobileNav();
  }
  function syncMobileNav(){
    const mobile=document.getElementById('mobileAdminNav');if(!mobile)return;
    const logout=mobile.querySelector('.mobile-logout')?.outerHTML||'<button type="button" class="mobile-logout" onclick="logout()"><span aria-hidden="true">↪</span><span>Sair do painel</span></button>';
    const pages=[...document.querySelectorAll('#dashboard .side-nav button[data-page]')];
    mobile.innerHTML=pages.map(button=>{const icon=button.querySelector('span:not(.navtext)')?.textContent||'•',label=button.querySelector('.navtext')?.textContent?.trim()||button.textContent.trim(),active=button.classList.contains('active')||window.page===button.dataset.page;return `<button type="button" data-page="${safe(button.dataset.page)}" class="${active?'active':''}" onclick="go('${safe(button.dataset.page)}')"><span aria-hidden="true">${safe(icon)}</span><span>${safe(label)}</span></button>`}).join('')+logout;
  }

  function peopleFor(role){
    const list=role==='employee'?(db.employees||[]):(db.sellers||[]);
    const rows=recordsFor(role);
    const seen=new Set();
    const people=list.map(person=>({id:person.id,name:person.name||person.username||'Sem nome'}));
    people.forEach(person=>seen.add(person.id));
    rows.forEach(service=>{const id=role==='employee'?service.employeeId:service.sellerId;if(id&&!seen.has(id)){people.push({id,name:role==='employee'?service.employeeName||'Funcionário anterior':actorName(service)});seen.add(id)}});
    return people.map(person=>({...person,services:recordsFor(role,person.id,person.name)})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  }

  function personRoster(role,container){
    const employees=role==='employee',title=employees?'Serviços por funcionário':'Serviços por vendedor',people=peopleFor(role),count=people.reduce((sum,person)=>sum+person.services.length,0);
    document.getElementById('crumb').textContent=title;
    container.innerHTML=`<div class="admin-page-intro"><div><span class="admin-eyebrow">Histórico individual</span><h1>${title}</h1><p>Consulte cada serviço, seu andamento e quem fez o registro. Os serviços finalizados permanecem no histórico do responsável.</p></div><span class="admin-intro-total"><b>${count}</b><small>serviços registrados</small></span></div>${people.length?`<div class="admin-person-grid">${people.map(person=>{const finished=person.services.filter(finalStatus).length,active=person.services.filter(service=>!isCancelled(service)&&!finalStatus(service)).length;return `<article class="admin-person-card"><div class="admin-person-avatar" aria-hidden="true">${safe(person.name.trim().slice(0,1).toUpperCase()||'?')}</div><div class="admin-person-copy"><h2>${safe(person.name)}</h2><p>${employees?'Funcionário':'Vendedor'}</p></div><div class="admin-person-metrics"><span><b>${person.services.length}</b><small>Total</small></span><span><b>${finished}</b><small>Finalizados</small></span><span><b>${active}</b><small>Em aberto</small></span></div><button type="button" class="btn btn-primary" data-profile-role="${role}" data-profile-id="${safe(person.id)}">Abrir histórico <span aria-hidden="true">→</span></button></article>`}).join('')}</div>`:'<div class="admin-empty-state"><b>Nenhum cadastro encontrado</b><p>Cadastre um funcionário ou vendedor para ver os serviços registrados por ele.</p></div>'}`;
    container.querySelectorAll('[data-profile-id]').forEach(button=>button.addEventListener('click',()=>window.openAdminServiceProfile(button.dataset.profileRole,button.dataset.profileId)));
  }

  function serviceTableRows(services){
    if(!services.length)return '<div class="admin-empty-state"><b>Nenhum serviço neste filtro</b><p>Quando este perfil registrar serviços, eles aparecerão aqui.</p></div>';
    return `<div class="admin-record-list">${services.map(service=>{const done=finalStatus(service),cancelled=isCancelled(service),items=itemsOf(service),types=[...new Set(items.map(item=>item.type).filter(Boolean))].join(', ')||service.serviceType||'Serviço';return `<article class="admin-record-card"><div class="admin-record-top"><div><span class="admin-record-code">${safe(service.code||'Sem código')}</span><h3>${safe(service.clientName||'Sem cliente vinculado')}</h3><p>${safe(service.serviceType||'Manutenção')} · ${safe(types)}</p></div><span class="admin-record-status ${cancelled?'is-cancelled':done?'is-done':service.employeeCompletedAt?'is-review':'is-open'}">${safe(statusLabel(service))}</span></div><div class="admin-record-meta"><span><small>Registrado por</small><b>${safe(actorName(service))}</b></span><span><small>Data da próxima manutenção</small><b>${safe(monthLabel(service.nextMaintenanceMonth))}</b></span><span><small>Extintores</small><b>${items.length}</b></span><span><small>Finalizado em</small><b>${safe(cancelled?'Cancelado':done?service.closedAt?new Date(service.closedAt).toLocaleDateString('pt-BR'):'Concluído':'—')}</b></span></div><div class="admin-record-actions"><button type="button" class="btn btn-soft btn-small" data-service-history="${safe(service.id)}">Ver histórico</button><button type="button" class="btn btn-primary btn-small" data-service-order="${safe(service.id)}">Ordem de serviço</button></div></article>`}).join('')}</div>`;
  }

  function personProfile(role,id,container){
    const person=peopleFor(role).find(item=>item.id===id);
    if(!person){container.innerHTML='<div class="admin-empty-state"><b>Perfil não encontrado</b><button class="btn btn-soft" onclick="go(\''+(role==='employee'?'employee-history':'seller-history')+'\')">Voltar à equipe</button></div>';return}
    const all=person.services,finished=all.filter(finalStatus),pendingReview=all.filter(service=>!isCancelled(service)&&!finalStatus(service)&&service.employeeCompletedAt),active=all.filter(service=>!isCancelled(service)&&!finalStatus(service)&&!service.employeeCompletedAt);
    const filter=window.adminServiceProfileFilter||'all',shown=filter==='finished'?finished:filter==='review'?pendingReview:filter==='active'?active:all;
    document.getElementById('crumb').textContent=person.name;
    container.innerHTML=`<div class="admin-profile-back"><button type="button" class="btn btn-soft btn-small" data-back-role="${role}">← Todos ${role==='employee'?'os funcionários':'os vendedores'}</button></div><div class="admin-page-intro"><div><span class="admin-eyebrow">Página individual · ${role==='employee'?'Funcionário':'Vendedor'}</span><h1>${safe(person.name)}</h1><p>Serviços cadastrados neste perfil, incluindo o histórico finalizado.</p></div><span class="admin-intro-total"><b>${all.length}</b><small>serviços no histórico</small></span></div><div class="admin-history-stats"><button type="button" data-filter="all" class="${filter==='all'?'active':''}"><b>${all.length}</b><span>Todos</span></button><button type="button" data-filter="active" class="${filter==='active'?'active':''}"><b>${active.length}</b><span>Em andamento</span></button><button type="button" data-filter="review" class="${filter==='review'?'active':''}"><b>${pendingReview.length}</b><span>Aguardando revisão</span></button><button type="button" data-filter="finished" class="${filter==='finished'?'active':''}"><b>${finished.length}</b><span>Finalizados</span></button></div>${serviceTableRows(shown)}`;
    container.querySelector('[data-back-role]')?.addEventListener('click',event=>go(event.currentTarget.dataset.backRole==='employee'?'employee-history':'seller-history'));
    container.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{window.adminServiceProfileFilter=button.dataset.filter;personProfile(role,id,container)}));
    container.querySelectorAll('[data-service-history]').forEach(button=>button.addEventListener('click',()=>window.serviceHistory(button.dataset.serviceHistory)));
    container.querySelectorAll('[data-service-order]').forEach(button=>button.addEventListener('click',()=>window.serviceOrder(button.dataset.serviceOrder)));
  }

  window.openAdminServiceProfile=function(role,id){window.adminServiceProfileFilter='all';window.adminServiceProfile={role,id};go(role==='employee'?'employee-profile':'seller-profile')};
  window.renderAdminServiceRecords=function(container=document.getElementById('content')){
    if(!container)return;
    const route=window.page||'';
    if(route==='employee-history')return personRoster('employee',container);
    if(route==='seller-history')return personRoster('seller',container);
    if(route==='employee-profile'||route==='seller-profile'){
      const role=route==='employee-profile'?'employee':'seller';return personProfile(role,window.adminServiceProfile?.role===role?window.adminServiceProfile.id:'',container);
    }
  };

  function registrar(service){
    if(actorRole(service))return `${actorName(service)} · ${actorRole(service)==='employee'?'Funcionário':'Vendedor'}`;
    return service.registeredBy||'Administração';
  }
  function wrapServiceTable(){
    const original=window.serviceTable;if(typeof original!=='function'||original.__adminRegistrar)return;
    const wrapped=function(list){
      const html=original.apply(this,arguments),template=document.createElement('template');template.innerHTML=html;
      const table=template.content.querySelector('table');if(!table)return html;
      const head=table.querySelector('thead tr');if(!head||[...head.cells].some(cell=>cell.dataset.registrarColumn==='true'))return template.innerHTML;
      const action=[...head.cells].find(cell=>cell.textContent.trim()==='Ações'),th=document.createElement('th');th.dataset.registrarColumn='true';th.textContent='Registrado por';action?head.insertBefore(th,action):head.append(th);
      const rows=[...table.querySelectorAll('tbody tr')];rows.forEach((row,index)=>{const cell=document.createElement('td'),service=list[index];cell.textContent=service?registrar(service):'—';const actionCell=row.cells[row.cells.length-1];actionCell?row.insertBefore(cell,actionCell):row.append(cell)});
      return template.innerHTML;
    };
    wrapped.__adminRegistrar=true;window.serviceTable=wrapped;
  }
  function wrapRenderPage(){
    if(window.adminRebrandRoutesWrapped||typeof window.renderPage!=='function')return;
    const original=window.renderPage;window.renderPage=function(){const route=window.page||'';if(['employee-history','seller-history','employee-profile','seller-profile'].includes(route))return window.renderAdminServiceRecords();const result=original.apply(this,arguments);if(route==='overview')requestAnimationFrame(addOverviewShortcuts);return result};window.adminRebrandRoutesWrapped=true;
  }
  function addOverviewShortcuts(){
    const host=document.getElementById('content');if(!host||window.page!=='overview'||host.querySelector('.admin-team-shortcuts'))return;
    const employees=recordsFor('employee'),sellers=recordsFor('seller'),closed=services=>(services||[]).filter(finalStatus).length;
    const section=document.createElement('section');section.className='admin-team-shortcuts';
    section.innerHTML=`<header><div><h2>Atividade da equipe</h2><p>Abra o histórico individual dos serviços registrados por cada perfil.</p></div></header><div class="admin-team-shortcut-links"><button type="button" onclick="go('employee-history')">Funcionários · ${employees.length} serviços · ${closed(employees)} finalizados</button><button type="button" onclick="go('seller-history')">Vendedores · ${sellers.length} serviços · ${closed(sellers)} finalizados</button></div>`;
    host.append(section);
  }

  function init(){
    document.documentElement.classList.add('protecextintores-admin-modern');
    installSidebar();wrapRenderPage();wrapServiceTable();
  }
  init();
  const observer=new MutationObserver(()=>{installSidebar();wrapServiceTable()});
  const sidebar=document.querySelector('#dashboard .sidebar');if(sidebar)observer.observe(sidebar,{childList:true,subtree:true});
})();

;

;/* SOURCE: homepage-rebrand.js */
(() => {
  'use strict';
  const digits = value => String(value || '').replace(/\D/g, '');
  const instagramName = value => String(value || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '');
  const whatsappNumber = value => {
    const raw = digits(value);
    if (!raw) return '';
    return raw.startsWith('55') ? raw : `55${raw}`;
  };
  const contactData = () => ({
    whatsapp: db.settings.whatsapp || window.PROTEC_EMPRESA?.whatsapp || '',
    instagram: instagramName(db.settings.instagram || window.PROTEC_EMPRESA?.instagram || '')
  });

  window.fogoWhatsAppLink = (message = 'Olá! Vim pelo site da ProtecExtintores e gostaria de um orçamento.') => {
    const phone = whatsappNumber(contactData().whatsapp);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
  };

  window.refreshHomepageContacts = () => {
    const contacts = contactData();
    const hero = document.querySelector('#store .hero-copy');
    if (hero) {
      let links = hero.querySelector('.home-social-links');
      if (!links) {
        links = document.createElement('div');
        links.className = 'home-social-links';
        links.setAttribute('aria-label', 'Fale com a ProtecExtintores');
        hero.querySelector('.hero-actions')?.after(links);
      }
      links.replaceChildren();
      const wa = window.fogoWhatsAppLink();
      if (wa) {
        const anchor = document.createElement('a');
        anchor.href = wa;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'home-social-link home-whatsapp-link';
        anchor.textContent = 'Conversar pelo WhatsApp';
        links.append(anchor);
      }
      if (contacts.instagram) {
        const anchor = document.createElement('a');
        anchor.href = `https://www.instagram.com/${encodeURIComponent(contacts.instagram)}/`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'home-social-link home-instagram-link';
        anchor.textContent = `Instagram @${contacts.instagram}`;
        links.append(anchor);
      }
      links.hidden = !links.childElementCount;
    }

    const store = document.getElementById('store');
    if (store) {
      let floating = store.querySelector('.wa-float');
      const wa = window.fogoWhatsAppLink();
      if (wa && !floating) {
        floating = document.createElement('a');
        floating.className = 'wa-float';
        floating.setAttribute('aria-label', 'Falar com a equipe no WhatsApp');
        floating.target = '_blank';
        floating.rel = 'noopener noreferrer';
        floating.innerHTML = '<span aria-hidden="true">◉</span><span>WhatsApp</span>';
        store.append(floating);
      }
      if (floating) {
        floating.href = wa || '#';
        floating.hidden = !wa;
      }
    }

    const footer = document.getElementById('footerContact');
    if (footer) {
      footer.querySelectorAll('[data-configured-social], a[href*="wa.me/"], a[href*="instagram.com/"]').forEach(node => node.remove());
      const wa = window.fogoWhatsAppLink();
      if (wa) {
        const anchor = document.createElement('a');
        anchor.dataset.configuredSocial = 'whatsapp';
        anchor.href = wa;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'WhatsApp';
        footer.append(anchor);
      }
      if (contacts.instagram) {
        const anchor = document.createElement('a');
        anchor.dataset.configuredSocial = 'instagram';
        anchor.href = `https://www.instagram.com/${encodeURIComponent(contacts.instagram)}/`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = `Instagram @${contacts.instagram}`;
        footer.append(anchor);
      }
      footer.hidden = !footer.childElementCount;
    }
  };

  window.saveHomepageContacts = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const whatsapp = digits(data.get('whatsapp'));
    const instagram = instagramName(data.get('instagram'));
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) {
      toast('Informe um número com DDD e, se necessário, código do país.');
      return;
    }
    db.settings.whatsapp = whatsapp;
    db.settings.instagram = instagram;
    if (!await save()) return;
    window.refreshHomepageContacts();
    renderPage();
    toast('Contatos da página inicial salvos.');
  };

  const settingsBase = window.settings;
  window.settings = function (container) {
    settingsBase?.apply(this, arguments);
    const panel = document.createElement('section');
    panel.className = 'panel config-card homepage-contact-settings';
    panel.innerHTML = `<h3>Contato da página inicial</h3><p>Esses dados criam links diretos no destaque da página inicial, no rodapé e no botão de WhatsApp.</p><form onsubmit="saveHomepageContacts(event)"><div class="form-grid"><div class="form-field"><label for="homeWhatsapp">WhatsApp com DDD</label><input id="homeWhatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" value="${esc(db.settings.whatsapp || '')}" placeholder="(11) 99999-9999" aria-describedby="homeWhatsappHint"><small id="homeWhatsappHint">Pode incluir o código do país. O Brasil é incluído automaticamente quando omitido.</small></div><div class="form-field"><label for="homeInstagram">Usuário do Instagram</label><input id="homeInstagram" name="instagram" autocomplete="off" maxlength="30" value="${esc(db.settings.instagram || '')}" placeholder="@suaempresa" aria-describedby="homeInstagramHint"><small id="homeInstagramHint">Digite o usuário com ou sem @. O link do perfil será criado automaticamente.</small></div></div><button class="btn btn-small" type="submit">Salvar contatos</button></form>`;
    container.append(panel);
  };

  const bootstrapBase = window.bootstrap;
  if (typeof bootstrapBase === 'function') {
    window.bootstrap = async function () {
      const result = await bootstrapBase.apply(this, arguments);
      window.refreshHomepageContacts();
      return result;
    };
  }
  window.refreshHomepageContacts();
  if (typeof bootstrap === 'function' && location.protocol !== 'file:') bootstrap();
})();

;

;/* SOURCE: service-payment-lifecycle.js */
/* Automatic annual maintenance scheduling and customer service payment timing. */
(() => {
  'use strict';

  const monthFromDate = value => {
    const match = String(value || '').match(/^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/);
    return match ? `${Number(match[1]) + 1}-${match[2]}` : '';
  };

  function configureSchedule(form) {
    if (!form || form.dataset.automaticMaintenanceSchedule === 'true') return;
    const date = form.elements?.date;
    const next = form.elements?.nextMaintenanceMonth;
    if (!date || !next) return;
    form.dataset.automaticMaintenanceSchedule = 'true';
    next.readOnly = true;
    next.setAttribute('aria-readonly', 'true');
    next.setAttribute('aria-describedby', 'automaticMaintenanceHelp');
    const label = form.querySelector(`label[for="${next.id}"]`) || next.closest('.form-field')?.querySelector('label');
    if (label) label.textContent = 'Próxima manutenção calculada';
    let help = form.querySelector('#automaticMaintenanceHelp');
    if (!help) {
      help = document.createElement('small');
      help.id = 'automaticMaintenanceHelp';
      help.className = 'helper';
      next.closest('.form-field')?.append(help);
    }
    help.textContent = 'Calculada automaticamente para o mesmo mês do próximo ano, a partir da data deste serviço.';
    const sync = () => { next.value = monthFromDate(date.value); };
    date.addEventListener('input', sync);
    date.addEventListener('change', sync);
    sync();
  }

  function configureOpenForm() {
    setTimeout(() => configureSchedule(document.querySelector('#modalRoot #editForm') || document.querySelector('#modalRoot form')), 0);
  }

  function wrapFormOpener(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__autoMaintenanceWrapped) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      configureOpenForm();
      return result;
    };
    wrapped.__autoMaintenanceWrapped = true;
    window[name] = wrapped;
  }

  function backfillVisibleSchedule() {
    if (typeof db === 'undefined' || !Array.isArray(db.services)) return;
    for (const service of db.services) {
      if (!service.nextMaintenanceMonth) service.nextMaintenanceMonth = monthFromDate(service.date);
    }
  }

  window.copyCheckoutPix = async function () { const value=document.getElementById('checkoutPixPayload')?.value||''; if(!value)return; try{await navigator.clipboard.writeText(value);window.toast?.('Pix copia e cola copiado.')}catch{window.prompt('Copie o Pix copia e cola:',value)} };

  wrapFormOpener('openService');
  wrapFormOpener('openTeamMaintenanceForm');

  if (typeof window.renderNextMaintenancePage === 'function') {
    const original = window.renderNextMaintenancePage;
    window.renderNextMaintenancePage = function (...args) {
      backfillVisibleSchedule();
      return original.apply(this, args);
    };
  }

  const root = document.getElementById('modalRoot');
  if (root) new MutationObserver(() => configureSchedule(root.querySelector('#editForm') || root.querySelector('form')))
    .observe(root, { childList: true, subtree: true });
})();

;
