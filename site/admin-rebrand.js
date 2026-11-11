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
