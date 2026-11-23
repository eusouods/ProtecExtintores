/* Centro operacional: alertas, relatórios e resumos de equipe. */
(() => {
  const specialPages = new Set(['alerts', 'reports', 'service-clients']);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const serviceItems = service => Array.isArray(service?.items) ? service.items : [];
  const isClosed = service => Boolean(service?.closed);
  const isCancelled = service => Boolean(service?.cancelledAt || normalize(service?.status) === 'cancelado');
  const awaitingReview = service => !isClosed(service) && !isCancelled(service) && Boolean(service?.employeeCompletedAt || (serviceItems(service).length && serviceItems(service).every(item => normalize(item.status) === 'concluido')));
  const dateFromMonth = value => /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? new Date(`${value}-01T12:00:00`) : null;
  const services = () => db.services || [];

  function addOperationsNavigation() {
    const operationNav = document.querySelector('.side-nav button[data-page="services"]')?.parentElement;
    if (!operationNav) return;
    const entries = [
      ['alerts', '!', 'Alertas'],
      ['reports', '▤', 'Relatórios']
    ];
    entries.forEach(([page, icon, label]) => {
      if (!operationNav.querySelector(`[data-page="${page}"]`)) {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.page = page;
        button.innerHTML = `<span>${icon}</span><span class="navtext">${label}</span>`;
        button.addEventListener('click', () => window.go(page));
        operationNav.appendChild(button);
      }
      const mobile = document.getElementById('mobileAdminNav');
      if (mobile && !mobile.querySelector(`[data-page="${page}"]`)) {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.page = page;
        button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
        button.addEventListener('click', () => window.go(page));
        mobile.insertBefore(button, mobile.querySelector('.mobile-logout'));
      }
    });
  }

  function setCurrentPage(target, label) {
    page = target;
    window.page = target;
    document.querySelectorAll('.side-nav button[data-page],#mobileAdminNav button[data-page]').forEach(button => {
      const active = button.dataset.page === target;
      button.classList.toggle('active', active);
      button.toggleAttribute('aria-current', active);
    });
    const crumb = document.getElementById('crumb');
    if (crumb) crumb.textContent = label;
  }

  function renderSpecial(target) {
    const host = document.getElementById('content');
    if (!host || localStorage.getItem('protecextintores_role') !== 'admin' || document.getElementById('dashboard').classList.contains('hidden')) return;
    addOperationsNavigation();
    if (target === 'alerts') { setCurrentPage(target, 'Alertas'); window.protecOperationalViews.alerts(host); }
    if (target === 'reports') { setCurrentPage(target, 'Relatórios'); window.protecOperationalViews.reports(host); }
    if (target === 'service-clients') { setCurrentPage(target, 'Serviços por cliente'); window.protecClientView.directory(host); }
  }

  const nativeGo = window.go;
  window.go = function(target, ...rest) {
    if (specialPages.has(target)) return renderSpecial(target);
    const result = nativeGo?.call(this, target, ...rest);
    setTimeout(() => { addOperationsNavigation(); if (target === 'overview') mountAdminOverview(); }, 0);
    return result;
  };
  const nativeRenderPage = window.renderPage;
  window.renderPage = function(target, ...rest) {
    const current = target || window.page;
    if (specialPages.has(current)) return renderSpecial(current);
    const result = nativeRenderPage?.call(this, target, ...rest);
    setTimeout(() => { addOperationsNavigation(); if ((target || window.page) === 'overview') mountAdminOverview(); }, 0);
    return result;
  };

  function mountAdminOverview() {
    const host = document.getElementById('content');
    if (!host || window.page !== 'overview' || host.querySelector('.ops-quick-actions,.ops-admin-home')) return;
    const pending = services().filter(awaitingReview).length;
    const upcoming = services().filter(service => dateFromMonth(service.nextMaintenanceMonth)).length;
    const quick = document.createElement('section'); quick.className = 'panel ops-quick-actions';
    quick.innerHTML = `<div><div class="eyebrow">Centro operacional</div><h2>Atalhos da equipe</h2><p>${pending ? `${pending} serviço(s) aguardam sua revisão.` : 'Nenhum serviço aguarda revisão agora.'}</p></div><div><button class="btn btn-small" type="button" onclick="go('alerts')">Ver alertas</button><button class="btn btn-soft btn-small" type="button" onclick="go('next-maintenance')">Próximas manutenções (${upcoming})</button><button class="btn btn-soft btn-small" type="button" onclick="go('reports')">Relatórios</button></div>`;
    host.prepend(quick);
  }

  function mountTeamSummary() {
    const root = document.getElementById('employeePortal');
    if (!root || root.classList.contains('hidden')) return;
    const role = sessionStorage.getItem('protecextintores_role');
    const main = root.querySelector('.employee-main');
    if (!main || main.querySelector('.team-operations-summary')) return;
    let stats;
    if (role === 'employee') {
      const list = window.employeePortalState?.services || [];
      stats = [['Disponíveis', list.filter(service => !service.employeeId && !isClosed(service)).length], ['Em andamento', list.filter(service => service.employeeId && !isClosed(service)).length], ['Concluídos', list.filter(service => isClosed(service) || normalize(service.status) === 'concluido').length]];
    } else if (role === 'seller') {
      const list = window.sellerPortalState?.services || [];
      stats = [['Solicitações', list.filter(service => !isClosed(service)).length], ['Em revisão', list.filter(awaitingReview).length], ['Finalizados', list.filter(isClosed).length]];
    } else return;
    const section = document.createElement('section'); section.className = 'team-operations-summary';
    section.innerHTML = stats.map(([label, count]) => `<article><small>${escapeHtml(label)}</small><b>${count}</b></article>`).join('');
    main.querySelector('h1')?.insertAdjacentElement('afterend', section);
  }

  const portal = document.getElementById('employeePortal');
  if (portal) new MutationObserver(() => requestAnimationFrame(mountTeamSummary)).observe(portal, { childList: true, subtree: true });
  setTimeout(() => { addOperationsNavigation(); mountAdminOverview(); mountTeamSummary(); }, 0);

  const style = document.createElement('style');
  style.textContent = `.ops-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:0 0 20px}.ops-summary-wide{grid-template-columns:repeat(5,minmax(0,1fr))}.ops-summary article,.team-operations-summary article{padding:17px;border:1px solid var(--line);border-radius:14px;background:var(--ui-panel,#f9fcff);display:grid;gap:5px}.ops-summary small,.team-operations-summary small{font-weight:800;color:var(--muted);text-transform:uppercase;font-size:10px;letter-spacing:.06em}.ops-summary b,.team-operations-summary b{font-size:26px;color:var(--ink)}.ops-summary span{font-size:12px;color:var(--muted)}.ops-calendar{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.ops-month{padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--ui-panel,#f9fcff)}.ops-month h2{margin:0 0 12px;font-size:16px;text-transform:capitalize}.ops-event{width:100%;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;text-align:left;padding:11px 0;border:0;border-top:1px solid var(--line);background:transparent;color:inherit}.ops-event time{display:grid;place-items:center;width:44px;height:38px;border-radius:10px;background:var(--dash-blue-soft);color:var(--dash-primary);font-weight:900;font-size:12px}.ops-event span{display:grid;gap:3px}.ops-event small{color:var(--muted)}.ops-event em{grid-column:2;font-size:11px;color:var(--muted);font-style:normal}.ops-alert-grid,.ops-report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.ops-alert-card{padding:18px}.ops-alert-card header{display:flex;justify-content:space-between;gap:14px;align-items:start}.ops-alert-card h2{margin:0;font-size:17px}.ops-alert-card p{margin:5px 0 0;color:var(--muted);font-size:13px}.ops-count{display:grid;place-items:center;min-width:34px;height:34px;border-radius:50%;background:var(--dash-blue-soft);color:var(--dash-primary);font-weight:900}.ops-alert-list{display:grid;gap:0;margin:14px 0}.ops-alert-list>div{display:grid;gap:3px;padding:10px 0;border-top:1px solid var(--line);font-size:13px}.ops-alert-list span{color:var(--muted)}.ops-ok{padding:14px 0!important;color:var(--muted)!important}.ops-quick-actions{display:flex;justify-content:space-between;gap:18px;align-items:center;margin-bottom:18px}.ops-quick-actions h2{margin:4px 0}.ops-quick-actions p{margin:0;color:var(--muted)}.ops-quick-actions>div:last-child{display:flex;gap:8px;flex-wrap:wrap}.team-operations-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:16px 0}.team-operations-summary article{padding:13px}.team-operations-summary b{font-size:22px}@media(max-width:850px){.ops-summary-wide{grid-template-columns:repeat(2,minmax(0,1fr))}.ops-alert-grid,.ops-report-grid{grid-template-columns:1fr}}@media(max-width:620px){.ops-summary,.ops-summary-wide,.team-operations-summary{grid-template-columns:1fr}.ops-quick-actions{display:grid}.ops-quick-actions>div:last-child .btn{flex:1}.ops-event{grid-template-columns:42px 1fr}.ops-alert-card{padding:15px}}html[data-theme="dark"] :is(.ops-summary article,.ops-month,.ops-alert-card,.team-operations-summary article){background:var(--ui-panel,#f9fcff)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] .ops-event{border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] .ops-event time,html[data-theme="dark"] .ops-count{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important}`;
  document.head.append(style);
})();

/* Menu fixo do painel: barra inferior no celular, lateral sempre aberta no computador e abas dentro dos grupos.
   Não apaga nenhuma tela: cada entrada abre as mesmas páginas de antes, só que organizadas. */
(() => {
  const I = {
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>',
    flame:'<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    dots:'<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    box:'<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    person:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    wallet:'<path d="M20 8H5a2 2 0 0 1 0-4h13m2 4v12H5a2 2 0 0 1-2-2V6m17 6h-5a2 2 0 0 0 0 4h5"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
    chart:'<path d="M5 20V11M11 20V4M17 20v-6M3 20h18"/>',
    cart:'<path d="M6 7h14l-1.5 9H8z"/><path d="M6 7 5 3H2"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/>',
    shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.100 2.100M17 17l2.100 2.100M4.900 19.100 7 17M17 7l2.100-2.100"/>',
    out:'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
    chev:'<path d="m9 6 6 6-6 6"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.500-3.500"/>'
  };
  const G = [
    {id:'overview',label:'Painel',icon:'grid',pages:[['overview','Painel']]},
    {id:'services',label:'Manutenções',icon:'wrench',pages:[['services','Histórico'],['service-clients','Por cliente'],['next-maintenance','Próximas manutenções']]},
    {id:'extinguishers',label:'Extintores',icon:'flame',pages:[['extinguishers','Extintores']]},
    {id:'clients',label:'Clientes e vendedores',short:'Clientes',icon:'users',pages:[['clients','Clientes e vendedores']]},
    {id:'stock',label:'Estoque e preços',icon:'box',pages:[['inventory','Estoque'],['parts','Peças e preços'],['workshop','Pó e envios']]},
    {id:'insights',label:'Alertas e relatórios',icon:'chart',pages:[['alerts','Alertas'],['reports','Relatórios'],['finance','Custos e cobranças']]},
    {id:'team',label:'Funcionários e acessos',icon:'person',pages:[['employees','Funcionários'],['users','Acessos']]},
    {id:'history',label:'Histórico da equipe',icon:'clock',pages:[['employee-history','Por funcionário'],['seller-history','Por vendedor']]},
    {id:'shop',label:'Loja e pedidos',icon:'cart',pages:[['products','Produtos da loja'],['orders','Pedidos']]},
    {id:'after',label:'Garantias e avaliações',icon:'shield',pages:[['warranties','Garantias'],['reviews','Avaliações']]},
    {id:'data',label:'Dados e backup',icon:'db',pages:[['data-tools','Dados e backup']]},
    {id:'settings',label:'Configurações',icon:'gear',pages:[['settings','Configurações']]}
  ];
  const gmap = Object.fromEntries(G.map(g => [g.id, g])), byPage = {};
  G.forEach(g => g.pages.forEach(([p]) => { byPage[p] = g; }));
  const PRIMARY = [['overview','grid','Visão geral','Painel'],['services','wrench','Serviços'],['finance','wallet','Recebimentos'],['settings','gear','Configurações','Ajustes']];
  const MORE = ['extinguishers','clients','stock','insights','team','history','shop','after','data','logout'];
  const svg = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
  const norm = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entry = ([id,icon,label,short],mobile=false) => `<button type="button" class="${mobile?'admin-tab':'admin-nav-item'}" data-admin-destination="${id}" data-go="${id}">${svg(icon)}<span>${mobile&&short?short:label}</span></button>`;
  const moreButton = (cls) => `<button type="button" class="${cls}" data-nav-more aria-haspopup="dialog" aria-controls="adminMore" aria-expanded="false">${svg('dots')}<span>Mais</span></button>`;

  let closeMore;
  function mount() {
    const header=document.querySelector('#dashboard .admin-top');
    if(header&&!header.querySelector('.mobile-panel-brand')){
      const brand=document.createElement('span');brand.className='mobile-panel-brand';
      brand.innerHTML=`<span class="brand-mark" aria-hidden="true">${window.protecBrand.image(31)}</span><span id="mobilePanelBrandName"></span>`;
      brand.lastElementChild.textContent=db.settings.company||'ProtecExtintores';
      header.prepend(brand);
      const alert=document.createElement('button');alert.type='button';alert.className='mobile-panel-alert';alert.dataset.go='alerts';
      alert.setAttribute('aria-label','Alertas');alert.innerHTML=svg('bell');header.querySelector('.admin-top-right')?.prepend(alert);
      const searchToggle=document.createElement('button');searchToggle.type='button';searchToggle.className='protec-search-toggle';
      searchToggle.setAttribute('aria-label','Buscar no painel');searchToggle.setAttribute('aria-controls','adminSearch');searchToggle.setAttribute('aria-expanded','false');
      searchToggle.innerHTML=svg('search');header.querySelector('.admin-top-right')?.prepend(searchToggle);
      searchToggle.onclick=()=>{
        if((window.page||'overview')!=='overview')window.go('overview');
        search();
        const box=document.getElementById('adminSearch');
        box.hidden=!box.hidden;
        searchToggle.setAttribute('aria-expanded',String(!box.hidden));
        if(!box.hidden)box.querySelector('input').focus();
      };
      const title=document.createElement('span');title.className='mobile-receipts-title';title.textContent='Recebimentos';header.querySelector('.crumb')?.append(title);
    }
    const sidebar = document.querySelector('#dashboard .sidebar');
    if (sidebar && !document.getElementById('adminNav')) {
      const nav = document.createElement('nav');
      nav.id = 'adminNav'; nav.setAttribute('aria-label', 'Menu do painel');
      nav.innerHTML = PRIMARY.map(item=>entry(item)).join('') + moreButton('admin-nav-item');
      (sidebar.querySelector('.brand') || sidebar.firstElementChild)?.insertAdjacentElement('afterend', nav);
    }
    if (!document.getElementById('adminTabbar')) {
      const bar = document.createElement('nav');
      bar.id = 'adminTabbar'; bar.setAttribute('aria-label', 'Navegação principal');
      bar.innerHTML = '<span class="admin-tab-pill" aria-hidden="true"></span>' + PRIMARY.map(item=>entry(item,true)).join('') + moreButton('admin-tab');
      document.body.appendChild(bar);
      const sheet = document.createElement('dialog');
      sheet.id = 'adminMore'; sheet.hidden = true; sheet.setAttribute('aria-labelledby', 'adminMobileMoreTitle');
      sheet.innerHTML = '<header><h2 id="adminMobileMoreTitle">Mais</h2><form method="dialog"><button type="submit" autofocus aria-label="Fechar">×</button></form></header>' + MORE.map(id => id === 'logout'
        ? `<button type="button" class="admin-more-row" data-nav-logout><span class="ic">${svg('out')}</span><b>Sair do painel</b></button>`
        : `<button type="button" class="admin-more-row" data-nav-group="${id}" data-go="${gmap[id].pages[0][0]}"><span class="ic">${svg(gmap[id].icon)}</span><b>${gmap[id].label}</b><span class="ch">${svg('chev')}</span></button>`).join('');
      document.body.appendChild(sheet);
      sheet.addEventListener('close',()=>{sheet.hidden=true;document.querySelectorAll('[data-nav-more]').forEach(button=>button.setAttribute('aria-expanded','false'));last=null;sync();});
      closeMore = window.bindProtecMenuMotion(sheet);
    }
  }

  function tabs(group, current) {
    let el = document.getElementById('pageTabs');
    if (!el) { const c = document.getElementById('content'); if (!c) return; el = document.createElement('nav'); el.id = 'pageTabs'; el.setAttribute('aria-label', 'Seções'); c.insertAdjacentElement('beforebegin', el); }
    if (!group || group.pages.length < 2 || current==='finance') { el.hidden = true; el.innerHTML = ''; el.dataset.key = ''; return; }
    const key = group.id + ':' + current;
    if (el.dataset.key === key) return;
    const cs = getComputedStyle(document.getElementById('content'));
    el.style.paddingLeft = cs.paddingLeft; el.style.paddingRight = cs.paddingRight; el.style.paddingTop = '14px';
    el.dataset.key = key; el.hidden = false;
    el.innerHTML = group.pages.map(([p, l]) => `<button type="button" data-go="${p}" ${p === current ? 'aria-current="page"' : ''}>${l}</button>`).join('');
  }

  function search() {
    const c = document.getElementById('content');
    if (!c || document.getElementById('adminSearch')) return;
    const box = document.createElement('div');
    box.id = 'adminSearch'; box.hidden = true;
    document.querySelector('.protec-search-toggle')?.setAttribute('aria-expanded','false');
    box.innerHTML = `<label class="admin-search-field">${svg('search')}<input type="search" placeholder="Buscar cliente, ordem ou nº de série" aria-label="Buscar cliente, ordem, série ou responsável" autocomplete="off"></label><div class="admin-search-results" hidden></div>`;
    c.prepend(box);
    const input = box.querySelector('input'), out = box.querySelector('.admin-search-results');
    box.addEventListener('keydown',event=>{
      if(event.key!=='Escape')return;
      box.hidden=true;
      const button=document.querySelector('.protec-search-toggle');
      button?.setAttribute('aria-expanded','false');button?.focus();
    });
    window.protecClientView.bindSearch(input, out);
  }

  /* Configurações: como o funcionário avança as etapas do serviço */
  const HIDDEN_STAGES = ['Concluído', 'Solicitado', 'Aguardando peça'], DEFAULT_EMP = ['Recebido', 'Em manutenção', 'Pintando', 'Inspeção final'];
  function currentFlow() {
    const st = (typeof db !== 'undefined' && db.settings) || {}, raw = st.stageFlow || {};
    const all = (st.stages || []).filter(x => !HIDDEN_STAGES.includes(x));
    const chosen = (Array.isArray(raw.employeeStages) ? raw.employeeStages : DEFAULT_EMP).filter(x => all.includes(x));
    const emp = all.filter(x => (chosen.length ? chosen : all).includes(x));
    const completeAt = emp.includes(raw.completeAt) ? raw.completeAt : (emp.includes('Inspeção final') ? 'Inspeção final' : emp[emp.length - 1]);
    return {all, emp, completeAt, requireCompleteStage: raw.requireCompleteStage !== false, allowSkip: raw.allowSkip !== false};
  }
  function stagePanel() {
    const c = document.getElementById('content');
    if (!c || document.getElementById('stageFlowPanel') || typeof db === 'undefined' || !db.settings) return;
    const f = currentFlow();
    const form = document.createElement('form');
    form.id = 'stageFlowPanel'; form.className = 'panel config-card';
    form.innerHTML = `<h3>Avanço das etapas pelo funcionário</h3><p>Defina como o funcionário avança o serviço e em que etapa ele pode concluir a execução.</p>
<div class="stage-flow-body">
<fieldset><legend>Etapas que o funcionário pode usar</legend><div class="stage-flow-checks">${f.all.map(x => `<label><input type="checkbox" name="stage" value="${esc(x)}" ${f.emp.includes(x) ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div></fieldset>
<label class="form-field">Pode concluir a execução a partir de<select name="completeAt"></select></label>
<label class="stage-flow-switch"><input type="checkbox" name="requireCompleteStage" ${f.requireCompleteStage ? 'checked' : ''}><span><b>Exigir chegar nessa etapa antes de concluir</b><small>O botão “Concluir execução” só aparece depois que o serviço chegar nela.</small></span></label>
<label class="stage-flow-switch"><input type="checkbox" name="allowSkip" ${f.allowSkip ? 'checked' : ''}><span><b>Permitir pular etapas</b><small>Desligado, o funcionário avança uma etapa de cada vez.</small></span></label>
</div>
<div class="panel-actions"><button class="btn" type="submit">Salvar etapas</button></div>`;
    const select = form.elements.completeAt;
    const fill = () => {
      const on = [...form.querySelectorAll('input[name=stage]:checked')].map(i => i.value), keep = select.value || f.completeAt;
      select.innerHTML = on.map(x => `<option ${x === keep || (!on.includes(keep) && x === on[on.length - 1]) ? 'selected' : ''}>${esc(x)}</option>`).join('');
    };
    fill();
    form.addEventListener('change', e => { if (e.target.name === 'stage') fill(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const on = [...form.querySelectorAll('input[name=stage]:checked')].map(i => i.value);
      if (!on.length) { if (typeof toast === 'function') toast('Marque pelo menos uma etapa.'); return; }
      const before = db.settings.stageFlow;
      db.settings.stageFlow = {employeeStages: on, completeAt: select.value, requireCompleteStage: form.elements.requireCompleteStage.checked, allowSkip: form.elements.allowSkip.checked};
      if (typeof save === 'function' && !(await save())) { db.settings.stageFlow = before; return; }
      if (typeof toast === 'function') toast('Etapas do funcionário salvas');
    });
    const mine = [...c.querySelectorAll('.config-card')].find(x => x !== form && /^Etapas do serviço/.test((x.querySelector('h3')?.textContent || '').trim()));
    if (mine) mine.insertAdjacentElement('afterend', form); else c.append(form);
  }

  /* Manutenções: ações em ícones; só mostra o que tem utilidade naquele serviço */
  Object.assign(I, {
    flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    review:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m9 12 2 2 4-4"/>',
    done:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9.5"/>',
    doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>'
  });
  const ICON_ACTIONS = {
    'Atualizar status': {icon: 'flag', short: 'Status'}, 'Revisar dados': {icon: 'review', short: 'Revisar'},
    'Finalizar serviço': {icon: 'done', short: 'Finalizar'}, 'Histórico': {icon: 'clock', short: 'Histórico'},
    'Ordem de serviço': {icon: 'doc', short: 'Ordem'}, 'Editar cadastro': {icon: 'edit', short: 'Editar'},
    'Peças, vídeos e resultado': {icon: 'video', short: 'Peças e vídeos', onlyWithParts: true},
    'Aguardando funcionário': {hide: true}, 'Serviço concluído': {hide: true}
  };
  function serviceOfRow(row) {
    const d = row.querySelector('[data-service-details]');
    let id = d && d.dataset.serviceDetails;
    if (!id) { const m = [...row.querySelectorAll('[onclick]')].map(b => b.getAttribute('onclick')).join(' ').match(/\(\s*['"]([^'"]+)['"]/); id = m && m[1]; }
    return (typeof db !== 'undefined' && db.services || []).find(x => x.id === id);
  }
  function tidyServices() {
    document.querySelectorAll('#servicesTable table').forEach(table => {
      if (!table.dataset.tidy) {
        const heads = [...table.querySelectorAll('thead th')], idx = heads.findIndex(h => /^Funcion/i.test(h.textContent.trim()));
        table.dataset.tidy = '1';
        if (idx >= 0) heads[idx].classList.add('svc-hide');
      }
      table.querySelectorAll('tbody tr').forEach(row => {
        const emp = row.querySelector('td[data-label="Funcionário"]'), client = row.querySelector('td[data-label="Cliente"]');
        if (emp && client && !client.querySelector('.svc-employee')) { const t = document.createElement('small'); t.className = 'svc-employee'; t.textContent = emp.textContent.trim(); client.append(t); emp.classList.add('svc-hide'); }
        const group = row.querySelector('.panel-button-group'), extra = row.querySelector('[data-service-details]');
        if (group && extra && extra.parentElement !== group) group.append(extra);
        const svc = serviceOfRow(row), hasParts = !svc || (svc.items || []).some(i => (i.replacedParts || []).length > 0);
        row.querySelectorAll('.ops-cell-actions button').forEach(b => {
          if (b.dataset.ib) { if (b.dataset.ib === 'parts') b.hidden = !hasParts; return; }
          const full = b.textContent.replace(/\s+/g, ' ').trim(), meta = ICON_ACTIONS[full];
          if (!meta) return;
          if (meta.hide) { b.dataset.ib = 'x'; b.hidden = true; b.style.display = 'none'; return; }
          b.dataset.ib = meta.onlyWithParts ? 'parts' : '1';
          b.classList.add('ibtn'); b.dataset.tip = full; b.setAttribute('aria-label', full); b.removeAttribute('title');
          b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${I[meta.icon]}</svg><span class="ibtn-label">${meta.short}</span>`;
          if (meta.onlyWithParts) b.hidden = !hasParts;
        });
        const btns = [...row.querySelectorAll('.ibtn')], hasFinal = btns.some(x => x.dataset.tip === 'Finalizar serviço');
        btns.forEach(x => x.classList.toggle('is-primary', x.dataset.tip === (hasFinal ? 'Finalizar serviço' : 'Ordem de serviço')));
      });
    });
  }

  let last = null;
  function sync() {
    mount();
    const dash = document.getElementById('dashboard'), open = Boolean(dash && !dash.classList.contains('hidden'));
    document.body.classList.toggle('admin-open', open);
    if (!open) { last=null;document.getElementById('adminMore')?.close();delete document.body.dataset.mobileAdminPage;return; }
    const cur = window.page || 'overview', group = byPage[cur];
    if(document.body.dataset.mobileAdminPage!==cur)document.body.dataset.mobileAdminPage=cur;
    if (cur !== last) {
      last = cur;
      window.protecPanelHistory?.(cur);
      document.querySelectorAll('[data-nav-group]').forEach(b => {
        const on = b.dataset.navGroup === group?.id;
        b.classList.toggle('active', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
      });
      const destination = ['next-maintenance','service-clients'].includes(cur)?'services':cur;
      const mainDestination=PRIMARY.some(([id])=>id===destination);
      document.querySelectorAll('#adminNav button,#adminTabbar button').forEach(button=>{
        const active=button.dataset.adminDestination===destination||(!mainDestination&&button.hasAttribute('data-nav-more'));
        button.classList.toggle('active',active);
        if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
      });
      if(cur!=='overview') document.querySelector('.protec-search-toggle')?.setAttribute('aria-expanded','false');
      if(cur==='services') document.getElementById('crumb').textContent='Serviços';
      if(cur==='finance') document.getElementById('crumb').textContent='Recebimentos';
    }
    tabs(group, cur);
    if (cur === 'overview') search();
    if (window.__protecPill) window.__protecPill();
    if (cur === 'settings') stagePanel();
    if (cur === 'services') tidyServices();
  }

  document.addEventListener('click', event => {
    const t = event.target.closest('button, a'); if (!t) return;
    if (t.dataset.go) {
      closeMore(() => { if (typeof go === 'function') go(t.dataset.go);setTimeout(sync,60); });
      return;
    }
    if (t.dataset.navLogout !== undefined) { closeMore(() => { if (typeof logout === 'function') logout(); });return; }
    if (t.dataset.navMore !== undefined) {
      const sheet=document.getElementById('adminMore');
      if(sheet.open)closeMore();else{sheet.hidden=false;sheet.showModal();t.setAttribute('aria-expanded','true');}
      return;
    }
  });
  let frame;
  const scheduleSync = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); }); };
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target.id === 'dashboard' || [...record.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE))) scheduleSync();
  });
  observer.observe(document.getElementById('dashboard'), { attributes: true, attributeFilter: ['class'] });
  observer.observe(document.getElementById('content'), { childList: true, subtree: true });
  window.addEventListener('resize', scheduleSync, { passive: true });
  sync();
})();

/* Movimento: troca de tela, revelar ao rolar, marcador da barra inferior e toque nos botões. */
(() => {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 1) painel: animar a troca de tela */
  const wrapGo = () => {
    if (typeof window.go !== 'function' || window.go.__mv) return;
    const base = window.go;
    const fn = function () {
      const before = window.page;
      const result = base.apply(this, arguments);
      if (before !== window.page) window.protecMotion.transition(document.getElementById('content'));
      return result;
    };
    fn.__mv = true; window.go = fn;
  };
  wrapGo(); setTimeout(wrapGo, 1200);
  /* 2) site: revelar blocos ao rolar */
  const REVEAL = '#store .home-equipment .section-head,#store .home-family,#store #servicos .section-head,#store #servicos .feature,#store #como-funciona .section-head,#store #como-funciona .how-steps li,#store #perguntas .section-head,#store #perguntas .faq-list details,#store #perguntas .faq-foot,#store .catalog-card,#store .customer-services-heading,#store .customer-service-card';
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el); el.classList.add('in');
      setTimeout(() => { el.classList.remove('reveal', 'in'); el.style.removeProperty('--rv-d'); }, 1200);
    }), {threshold: .1, rootMargin: '0px 0px -5% 0px'});
    let n = 0, timer = null;
    const scan = () => {
      timer = null;
      document.querySelectorAll(REVEAL).forEach(el => {
        if (el.dataset.rv) return;
        el.dataset.rv = '1'; el.classList.add('reveal'); el.style.setProperty('--rv-d', (n++ % 4) * 70 + 'ms'); io.observe(el);
      });
    };
    scan();
    new MutationObserver(() => { if (!timer) timer = setTimeout(scan, 120); }).observe(document.body, {childList: true, subtree: true});
  }
  /* 3) cabeçalho com sombra ao rolar */
  window.addEventListener('scroll', () => document.body.classList.toggle('is-scrolled', window.scrollY > 6), {passive: true});
  /* 4) efeito de toque nos botões */
  document.addEventListener('pointerdown', e => {
    if (reduce) return;
    const b = e.target.closest && e.target.closest('.btn:not(.ibtn)');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height), sp = document.createElement('span');
    sp.className = 'rip'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden'; b.append(sp); setTimeout(() => sp.remove(), 650);
  }, {passive: true});
  /* 6) pílula que desliza na barra inferior */
  window.__protecPill = function () {
    const bar = document.getElementById('adminTabbar'), pill = bar && bar.querySelector('.admin-tab-pill');
    if (!bar || !pill || getComputedStyle(bar).display === 'none') return;
    const svg = bar.querySelector('.admin-tab.active');
    if (!svg) { pill.style.opacity = '0'; return; }
    const b = bar.getBoundingClientRect(), r = svg.getBoundingClientRect();
    pill.style.opacity = '1'; pill.style.width = r.width + 'px'; pill.style.height = r.height + 'px';
    pill.style.transform = `translate(${r.left - b.left - bar.clientLeft}px,${r.top - b.top - bar.clientTop}px)`;
  };
  window.addEventListener('resize', () => window.__protecPill && window.__protecPill());
})();
