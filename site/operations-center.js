/* Centro operacional: agenda, alertas, relatórios e resumos de equipe. */
(() => {
  const specialPages = new Set(['calendar', 'alerts', 'reports']);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const serviceItems = service => Array.isArray(service?.items) ? service.items : [];
  const isClosed = service => Boolean(service?.closed);
  const isCancelled = service => Boolean(service?.cancelledAt || normalize(service?.status) === 'cancelado');
  const awaitingReview = service => !isClosed(service) && !isCancelled(service) && Boolean(service?.employeeCompletedAt || (serviceItems(service).length && serviceItems(service).every(item => normalize(item.status) === 'concluido')));
  const dateFromMonth = value => /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(value || '')) ? new Date(`${value}-01T12:00:00`) : null;
  const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'A definir';
  const formatMonth = value => {
    const date = dateFromMonth(value);
    return date ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Sem previsão';
  };
  const services = () => db.services || [];
  const moneyValue = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function addOperationsNavigation() {
    const operationNav = document.querySelector('.side-nav button[data-page="services"]')?.parentElement;
    if (!operationNav) return;
    const entries = [
      ['calendar', '◷', 'Agenda'],
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

  function setCurrentPage(page, label) {
    window.page = page;
    document.querySelectorAll('.side-nav button[data-page],#mobileAdminNav button[data-page]').forEach(button => {
      const active = button.dataset.page === page;
      button.classList.toggle('active', active);
      button.toggleAttribute('aria-current', active);
    });
    const crumb = document.getElementById('crumb');
    if (crumb) crumb.textContent = label;
  }

  function agendaPage(host) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const entries = services().filter(service => !isCancelled(service)).flatMap(service => {
      const result = [];
      if (service.date) result.push({ when: new Date(`${service.date}T12:00:00`), service, kind: 'Atendimento', label: service.serviceType || 'Manutenção' });
      const next = dateFromMonth(service.nextMaintenanceMonth);
      if (next) result.push({ when: next, service, kind: 'Próxima manutenção', label: 'Validade programada' });
      return result;
    }).filter(item => !Number.isNaN(item.when.getTime())).sort((a, b) => a.when - b.when);
    const upcoming = entries.filter(item => item.when >= now).slice(0, 20);
    const grouped = new Map();
    upcoming.forEach(item => {
      const key = item.when.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    host.innerHTML = `<div class="page-title"><div><div class="eyebrow">Planejamento operacional</div><h1>Agenda de manutenções</h1><p>Visualize atendimentos registrados e as próximas manutenções programadas.</p></div><button class="btn btn-small" type="button" onclick="openService()">＋ Registrar serviço</button></div><section class="ops-summary"><article><small>Próximos eventos</small><b>${upcoming.length}</b><span>atendimentos e validades</span></article><article><small>Em revisão</small><b>${services().filter(awaitingReview).length}</b><span>aguardando conferência</span></article><article><small>Sem previsão</small><b>${services().filter(service => !service.nextMaintenanceMonth && !isClosed(service)).length}</b><span>precisam de data</span></article></section><section class="ops-calendar">${grouped.size ? [...grouped.entries()].map(([month, items]) => `<article class="ops-month"><h2>${escapeHtml(month)}</h2>${items.map(item => `<button class="ops-event" type="button" onclick="go('services')"><time>${item.when.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</time><span><b>${escapeHtml(item.service.code || 'Serviço')}</b><small>${escapeHtml(item.service.clientName || 'Cliente não informado')} · ${escapeHtml(item.kind)}</small></span><em>${escapeHtml(item.label)}</em></button>`).join('')}</article>`).join('') : '<div class="panel empty">Nenhum evento futuro cadastrado. Defina a data do serviço e a próxima manutenção para montar a agenda.</div>'}</section>`;
  }

  function alertsPage(host) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(limit.getDate() + 60);
    const validity = services().filter(service => !isCancelled(service) && dateFromMonth(service.nextMaintenanceMonth)).map(service => ({ service, when: dateFromMonth(service.nextMaintenanceMonth) }));
    const expired = validity.filter(item => item.when < new Date(today.getFullYear(), today.getMonth(), 1));
    const dueSoon = validity.filter(item => item.when >= new Date(today.getFullYear(), today.getMonth(), 1) && item.when <= limit);
    const review = services().filter(awaitingReview);
    const stock = (db.inventory || []).filter(item => Number(item.qty || 0) <= Number(item.minQty || 0));
    const block = (title, text, rows, action, actionLabel) => `<section class="panel ops-alert-card"><header><div><h2>${title}</h2><p>${text}</p></div><span class="ops-count">${rows.length}</span></header>${rows.length ? `<div class="ops-alert-list">${rows.map(row => `<div>${row}</div>`).join('')}</div><button class="btn btn-soft btn-small" type="button" onclick="go('${action}')">${actionLabel}</button>` : '<p class="ops-ok">Nenhuma pendência encontrada.</p>'}</section>`;
    host.innerHTML = `<div class="page-title"><div><div class="eyebrow">Acompanhamento inteligente</div><h1>Alertas operacionais</h1><p>Priorize o que exige ação da administração sem depender de planilhas externas.</p></div><button class="btn btn-small" type="button" onclick="go('services')">Abrir manutenções</button></div><div class="ops-alert-grid">${block('Aguardando revisão', 'Serviços concluídos pela equipe e prontos para conferência.', review.map(service => `<b>${escapeHtml(service.code || 'Serviço')}</b><span>${escapeHtml(service.clientName || 'Cliente não informado')} · ${serviceItems(service).length} extintor(es)</span>`), 'services', 'Revisar serviços')}${block('Validades vencidas', 'Manutenções cujo mês programado já passou.', expired.map(item => `<b>${escapeHtml(item.service.code || 'Serviço')}</b><span>${escapeHtml(item.service.clientName || 'Cliente não informado')} · ${escapeHtml(formatMonth(item.service.nextMaintenanceMonth))}</span>`), 'services', 'Abrir serviços')}${block('Próximas em até 60 dias', 'Contate o cliente e organize a agenda com antecedência.', dueSoon.map(item => `<b>${escapeHtml(item.service.code || 'Serviço')}</b><span>${escapeHtml(item.service.clientName || 'Cliente não informado')} · ${escapeHtml(formatMonth(item.service.nextMaintenanceMonth))}</span>`), 'calendar', 'Ver agenda')}${block('Estoque baixo', 'Itens com quantidade igual ou abaixo do mínimo definido.', stock.map(item => `<b>${escapeHtml(item.name)}</b><span>${Number(item.qty || 0)} ${escapeHtml(item.unit || 'un')} disponíveis · mínimo ${Number(item.minQty || 0)}</span>`), 'inventory', 'Abrir estoque')}</div>`;
  }

  function reportsPage(host) {
    const all = services().filter(service => !isCancelled(service));
    const closed = all.filter(isClosed);
    const review = all.filter(awaitingReview);
    const open = all.filter(service => !isClosed(service) && !awaitingReview(service));
    const totals = closed.reduce((sum, service) => sum + Number(service.price || 0), 0);
    const byPerson = (key, fallback) => {
      const map = new Map();
      all.forEach(service => { const name = service[key] || fallback; if (!map.has(name)) map.set(name, []); map.get(name).push(service); });
      return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
    };
    const rows = ([name, list]) => `<tr><td><strong>${escapeHtml(name)}</strong></td><td>${list.length}</td><td>${list.filter(isClosed).length}</td><td>${list.filter(awaitingReview).length}</td><td>${moneyValue(list.reduce((sum, service) => sum + Number(service.price || 0), 0))}</td></tr>`;
    host.innerHTML = `<div class="page-title"><div><div class="eyebrow">Visão gerencial</div><h1>Relatórios operacionais</h1><p>Indicadores do histórico de manutenções e da atuação da equipe.</p></div><button class="btn btn-small" type="button" onclick="downloadOperationalReport()">↓ Exportar CSV</button></div><section class="ops-summary ops-summary-wide"><article><small>Serviços registrados</small><b>${all.length}</b><span>histórico total</span></article><article><small>Finalizados</small><b>${closed.length}</b><span>com comprovante liberado</span></article><article><small>Em andamento</small><b>${open.length}</b><span>aguardando execução</span></article><article><small>Aguardando revisão</small><b>${review.length}</b><span>pendências administrativas</span></article><article><small>Valor finalizado</small><b>${moneyValue(totals)}</b><span>soma dos serviços fechados</span></article></section><section class="ops-report-grid"><article class="panel table-wrap"><header class="panel-head"><div><h2>Por funcionário</h2><p>Volume registrado, fechamentos e pendências.</p></div></header><table><thead><tr><th>Funcionário</th><th>Serviços</th><th>Finalizados</th><th>Revisão</th><th>Valor</th></tr></thead><tbody>${byPerson('employeeName', 'Sem responsável').map(rows).join('') || '<tr><td colspan="5">Nenhum dado disponível.</td></tr>'}</tbody></table></article><article class="panel table-wrap"><header class="panel-head"><div><h2>Por vendedor</h2><p>Origem comercial dos serviços.</p></div></header><table><thead><tr><th>Vendedor</th><th>Serviços</th><th>Finalizados</th><th>Revisão</th><th>Valor</th></tr></thead><tbody>${byPerson('sellerName', 'Administração').map(rows).join('') || '<tr><td colspan="5">Nenhum dado disponível.</td></tr>'}</tbody></table></article></section>`;
  }

  window.downloadOperationalReport = function() {
    const head = ['Código', 'Cliente', 'Serviço', 'Data', 'Próxima manutenção', 'Funcionário', 'Vendedor', 'Status', 'Valor'];
    const rows = services().map(service => [service.code, service.clientName, service.serviceType, service.date, service.nextMaintenanceMonth, service.employeeName, service.sellerName, service.closed ? 'Finalizado' : awaitingReview(service) ? 'Aguardando revisão' : service.status, Number(service.price || 0).toFixed(2)]);
    const csv = [head, ...rows].map(row => row.map(value => `"${String(value || '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); link.download = `relatorio-protecextintores-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); toast('Relatório CSV preparado para download.');
  };

  function renderSpecial(target) {
    const host = document.getElementById('content'); if (!host) return;
    addOperationsNavigation();
    if (target === 'calendar') { setCurrentPage(target, 'Agenda'); agendaPage(host); }
    if (target === 'alerts') { setCurrentPage(target, 'Alertas'); alertsPage(host); }
    if (target === 'reports') { setCurrentPage(target, 'Relatórios'); reportsPage(host); }
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
    quick.innerHTML = `<div><div class="eyebrow">Centro operacional</div><h2>Atalhos da equipe</h2><p>${pending ? `${pending} serviço(s) aguardam sua revisão.` : 'Nenhum serviço aguarda revisão agora.'}</p></div><div><button class="btn btn-small" type="button" onclick="go('alerts')">Ver alertas</button><button class="btn btn-soft btn-small" type="button" onclick="go('calendar')">Agenda (${upcoming})</button><button class="btn btn-soft btn-small" type="button" onclick="go('reports')">Relatórios</button></div>`;
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
