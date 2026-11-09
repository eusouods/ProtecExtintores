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
