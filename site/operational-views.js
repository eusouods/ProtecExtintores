(() => {
  const { clientDirectory, normalize, escape: esc } = window.protecRecords;
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatQty = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const cancelled = order => Boolean(order.cancelledAt || normalize(order.status) === 'cancelado');
  const inReview = order => !order.closed && !cancelled(order) && (order.employeeCompletedAt || (order.items?.length && order.items.every(item => normalize(item.status) === 'concluido')));
  const status = order => cancelled(order) ? 'Cancelado' : order.closed ? 'Finalizado' : inReview(order) ? 'Em revisão' : 'Em andamento';
  const orderDate = order => String(order.date || order.createdAt || '').slice(0, 10);
  const orderValue = order => Number(order.finance?.revenueCents != null ? Number(order.finance.revenueCents) / 100 : order.price) || 0;
  const isAdmin = () => localStorage.getItem('protecextintores_role') === 'admin' && !document.getElementById('dashboard').classList.contains('hidden');
  const monthLabel = month => new Date(month + '-01T12:00:00').toLocaleDateString('pt-BR', {month:'long',year:'numeric'});
  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const buttonRow = (type, id, name, caption) => `<button type="button" class="record-row" data-alert-kind="${type}" data-alert-key="${esc(id)}"><span><b>${esc(name)}</b><small>${esc(caption)}</small></span><span aria-hidden="true">›</span></button>`;

  function alerts(host) {
    const today = new Date(), current = monthKey(today), limit = monthKey(new Date(today.getFullYear(), today.getMonth() + 2, 1));
    const valid = (db.services || []).filter(order => !cancelled(order));
    const scheduled = valid.filter(order => /^\d{4}-(0[1-9]|1[0-2])$/.test(order.nextMaintenanceMonth || '')).sort((a, b) => a.nextMaintenanceMonth.localeCompare(b.nextMaintenanceMonth));
    const maintenanceRow = order => buttonRow('order', order.id, order.clientName || order.code || 'Ordem', `${order.code || 'Ordem'} · ${monthLabel(order.nextMaintenanceMonth)}`);
    const lowStock = (db.inventory || []).filter(item => item?.id && item.minQty != null && Number(item.qty) <= Number(item.minQty));
    const groups = [
      { type: 'review', title: 'Aguardando revisão', rows: valid.filter(inReview).map(order => buttonRow('order', order.id, order.clientName || order.code || 'Ordem', `${order.code || 'Ordem'} · ${order.serviceType || 'Manutenção'}`)) },
      { type: 'maintenance', title: 'Manutenções vencidas', rows: scheduled.filter(order => order.nextMaintenanceMonth < current).map(maintenanceRow) },
      { type: 'maintenance', title: 'Manutenções próximas', rows: scheduled.filter(order => order.nextMaintenanceMonth >= current && order.nextMaintenanceMonth <= limit).map(maintenanceRow) },
      { type: 'stock', title: 'Estoque baixo', rows: lowStock.map(item => buttonRow('stock', item.id, item.name, `${formatQty.format(item.qty)} ${item.unit || 'un.'} disponíveis · mínimo ${formatQty.format(item.minQty)}`)) },
      { type: 'sync', title: 'Sincronização', rows: window.adminOffline?.conflicts ? [buttonRow('sync', '', 'Envios para revisar', `${window.adminOffline.conflicts} registro(s) neste aparelho`)] : [] }
    ];
    host.innerHTML = '<div class="page-title"><div><h1>Alertas operacionais</h1><p>Abra o registro que precisa da sua atenção.</p></div></div><div class="record-filters" role="group" aria-label="Tipo de alerta"></div><div class="record-alerts"></div>';
    const filters = host.querySelector('.record-filters'), list = host.querySelector('.record-alerts');
    const options = [['all','Todos'],['review','Revisão'],['maintenance','Manutenções'],['stock','Estoque'],['sync','Sincronização']];
    filters.innerHTML = options.map(([key, title]) => `<button class="btn btn-soft btn-small" type="button" data-alert-filter="${key}" aria-pressed="${key === 'all'}">${title}</button>`).join('');
    function show(which) {
      list.innerHTML = groups.filter(group => group.rows.length && (which === 'all' || group.type === which)).map(group => `<section class="panel record-section"><h2>${group.title} <small>${group.rows.length}</small></h2><div class="record-list">${group.rows.join('')}</div></section>`).join('') || '<p class="panel record-empty">Nenhum alerta nesta categoria.</p>';
    }
    filters.onclick = event => {
      const active = event.target.closest('[data-alert-filter]');
      if (!active) return;
      filters.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === active)));
      show(active.dataset.alertFilter);
    };
    list.onclick = event => {
      const row = event.target.closest('[data-alert-kind]');
      if (!row || !isAdmin()) return;
      if (row.dataset.alertKind === 'order') window.openServiceDetails(row.dataset.alertKey);
      if (row.dataset.alertKind === 'stock') { window.protecInventorySelection = row.dataset.alertKey; window.go('inventory'); }
      if (row.dataset.alertKind === 'sync') window.adminOffline?.showSync();
    };
    show('all');
  }

  const quoteCSV = (value, numericColumn) => {
    let text = String(value ?? '');
    if (/^\s*[=+@-]/.test(text) && !(numericColumn && /^-?\d+,\d{2}$/.test(text))) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  function exportReport(rows) {
    if (!isAdmin()) return;
    const head = ['Código','Cliente','Serviço','Data','Próxima manutenção','Funcionário','Vendedor','Situação','Valor (R$)'];
    const entries = rows.map(order => [order.code, order.clientName, order.serviceType, orderDate(order), order.nextMaintenanceMonth, order.employeeName, order.sellerName, status(order), orderValue(order).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })]);
    const csv = '\ufeff' + [head, ...entries].map(values => values.map((value,index) => quoteCSV(value,index === head.length-1)).join(';')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    link.download = `relatorio-protecextintores-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    window.toast('Relatório CSV preparado para download.');
  }

  let reportFilters = {};
  function reports(host) {
    const clients = clientDirectory(db).filter(client => client.services.length);
    const all = db.services || [];
    const people = ['employeeName','sellerName'].flatMap(key => [...new Set(all.map(order => order[key]).filter(Boolean))].sort((a,b) => String(a).localeCompare(String(b),'pt-BR')).map(name => ({ key: JSON.stringify([key,name]), name: name + (key === 'employeeName' ? ' · funcionário' : ' · vendedor') })));
    const opts = (list, fallback) => `<option value="">${fallback}</option>${list.map(entry => `<option value="${esc(entry.key)}">${esc(entry.name)}</option>`).join('')}`;
    const situations = ['Em andamento','Em revisão','Finalizado','Cancelado'];
    host.innerHTML = `<div class="page-title"><div><h1>Relatórios operacionais</h1><p>Consulte as ordens e exporte os resultados da seleção.</p></div><button type="button" class="btn btn-small" data-report-export>Exportar CSV</button></div><form class="panel record-report-filters"><label>De<input name="from" type="date"></label><label>Até<input name="to" type="date"></label><label>Cliente<select name="client">${opts(clients,'Todos os clientes')}</select></label><label>Responsável<select name="person">${opts(people,'Todos os responsáveis')}</select></label><label>Situação<select name="status"><option value="active">Todas, exceto canceladas</option><option value="">Todas, incluindo canceladas</option>${situations.map(name => `<option>${name}</option>`).join('')}</select></label><button class="btn btn-soft btn-small" type="reset">Limpar filtros</button></form><div data-report-results></div>`;
    const form = host.querySelector('form'), results = host.querySelector('[data-report-results]');
    for (const [name,value] of Object.entries(reportFilters)) if (form.elements[name]) form.elements[name].value = value;
    let rows = [];
    function render() {
      const { from, to, client, person, status: selectedStatus } = reportFilters = Object.fromEntries(new FormData(form));
      const clientIds = client ? new Set(clients.find(row => row.key === client)?.services.map(order => order.id) || []) : null;
      const [role,name] = person ? JSON.parse(person) : [];
      rows = all.filter(order => (!from || orderDate(order) >= from) && (!to || (orderDate(order) && orderDate(order) <= to))
        && (!clientIds || clientIds.has(order.id)) && (!role || order[role] === name)
        && (selectedStatus === 'active' ? !cancelled(order) : (!selectedStatus || status(order) === selectedStatus))).sort((a,b) => orderDate(b).localeCompare(orderDate(a)));
      const finalized = rows.filter(order => order.closed && !cancelled(order));
      const summary = [['Ordens', rows.length], ['Finalizadas', finalized.length], ['Em revisão', rows.filter(inReview).length], ['Valor finalizado', currency.format(finalized.reduce((sum,order) => sum + orderValue(order), 0))]];
      const records = rows.length ? `<section class="panel record-section"><h2>Ordens do relatório</h2><div class="record-list">${rows.map(order => buttonRow('order',order.id, `${order.code || 'Ordem'} · ${order.clientName || 'Cliente não informado'}`, `${orderDate(order).split('-').reverse().join('/') || 'Sem data'} · ${status(order)} · ${currency.format(orderValue(order))}`)).join('')}</div></section>` : '<p class="panel record-empty">Nenhuma ordem com os filtros selecionados.</p>';
      const byPerson = (key, fallback, title) => {
        const groups = new Map();
        for (const order of rows) {
          const keyName = order[key] || fallback;
          if (!groups.has(keyName)) groups.set(keyName, []);
          groups.get(keyName).push(order);
        }
        return `<section class="panel record-section"><h2>${title}</h2><div class="record-list">${[...groups.entries()].sort((a,b) => b[1].length - a[1].length).map(([name, orders]) => `<div class="record-row"><span><b>${esc(name)}</b><small>${orders.filter(inReview).length} em revisão</small></span><span>${orders.length} ordens</span></div>`).join('')}</div></section>`;
      };
      results.innerHTML = `<section class="ops-summary record-report-summary" aria-label="Resumo do relatório">${summary.map(([name, value]) => `<article><small>${name}</small><b>${esc(value)}</b></article>`).join('')}</section>${rows.length ? `<div class="record-alerts">${byPerson('employeeName','Sem responsável','Por funcionário')}${byPerson('sellerName','Administração','Por vendedor')}</div>` : ''}${records}`;
    }
    form.onsubmit = event => event.preventDefault();
    form.onchange = render;
    form.onreset = () => setTimeout(render, 0);
    host.querySelector('[data-report-export]').onclick = () => exportReport(rows);
    window.downloadOperationalReport = () => exportReport(rows);
    results.onclick = event => {
      const button = event.target.closest('[data-alert-key]');
      if (button && isAdmin()) window.openServiceDetails(button.dataset.alertKey);
    };
    render();
  }

  window.protecOperationalViews = Object.freeze({ alerts, reports });
})();
