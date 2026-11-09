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
