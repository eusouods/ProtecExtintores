(() => {
  const { clientDirectory, equipmentHistory, normalize, escape: esc } = window.protecRecords;
  const number = new Intl.NumberFormat('pt-BR');
  const isAdmin = () => localStorage.getItem('protecextintores_role') === 'admin'
    && !document.getElementById('dashboard').classList.contains('hidden');
  const directory = () => clientDirectory(db);
  const label = (count, singular, plural) => `${number.format(count)} ${count === 1 ? singular : plural}`;
  function contact(client) {
    const phone = client.phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    const formatted = phone.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
    return [formatted || client.phone, client.email].filter(Boolean).join(' · ');
  }
  const source = client => ({ registered: 'Cadastro de cliente', historical: 'Histórico sem vínculo', self: 'Serviço próprio' })[client.source];
  const date = value => value ? new Date(String(value).length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('pt-BR') : 'Sem data';
  const cancelled = order => order.cancelledAt || normalize(order.status) === 'cancelado';
  const status = order => cancelled(order) ? 'Cancelado' : order.closed ? 'Finalizado' : order.employeeCompletedAt ? 'Em revisão' : order.status || 'Em aberto';
  const matches = (client, query) => normalize([client.name, client.email, client.phone].join(' ')).includes(query) || (
    /^\+?[\d .()-]{4,}$/.test(query) && client.phone.replace(/\D/g, '').includes(query.replace(/\D/g, ''))
  );
  const clientRow = client => `<button type="button" data-open-client-record="${esc(client.key)}" class="record-row"><span><b>${esc(client.name)}</b><small>${esc(contact(client) || source(client))}</small></span><span class="record-row-count">${label(client.services.length,'ordem','ordens')} <span aria-hidden="true">›</span></span></button>`;
  const orderRow = order => `<button type="button" data-client-order="${esc(order.id)}" class="record-row"><span><b>${esc(order.code || 'Ordem local')}</b><small>${esc(date(order.date || order.createdAt))} · ${esc(order.serviceType || 'Manutenção')}</small></span><span class="record-status">${esc(status(order))}</span></button>`;

  function openOrder(id, clientKey) {
    if (!isAdmin()) return;
    if (window.openServiceDetails) window.openServiceDetails(id);
    else window.serviceOrder?.(id);
    if (!clientKey) return;
    const actions = document.querySelector('#modalRoot .modal-actions');
    if (!actions) return;
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-soft btn-small';
    back.textContent = 'Voltar ao cliente';
    back.onclick = () => openClient(clientKey);
    actions.prepend(back);
  }

  function printLabel(client, group, serial) {
    const printWindow = window.open('', '_blank', 'width=540,height=450');
    if (!printWindow) return window.toast('Permita a abertura da janela para imprimir a etiqueta.');
    printWindow.opener = null;
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Etiqueta de manutenção</title><style>body{font:14px system-ui;margin:14mm;color:#17253a}article{max-width:85mm;border:1px solid #6a7892;border-radius:3mm;padding:5mm}h1{font-size:17px;margin:4mm 0}strong{font-size:16px}</style><article><small>${esc(db.settings.company || 'ProtecExtintores')}</small><h1>${esc(group.name)}</h1><p>Número de série <strong>${esc(serial)}</strong></p><p>${esc(client.name)}</p></article></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function equipmentSections(client) {
    return equipmentHistory(client).map(group => {
      const tracked = window.protecRecords.grouped(group.items.filter(entry => entry.item.serial), entry => ({ name: entry.item.serial }));
      const untracked = group.items.filter(entry => !entry.item.serial);
      const series = tracked.map(entry => `<details class="record-series"><summary><span>Série ${esc(entry.name)}</span><small>${label(entry.quantity,'registro','registros')}</small></summary><div class="record-list">${[...new Map(entry.items.map(({service}) => [service.id,service])).values()].map(orderRow).join('')}</div><button type="button" class="btn btn-soft btn-small" data-label-group="${esc(group.name)}" data-label-serial="${esc(entry.name)}">Imprimir etiqueta</button></details>`);
      return `<details class="record-equipment"><summary><b>${esc(group.name)}</b><span>${label(group.quantity,'registro','registros')}</span></summary>${series.join('')}${untracked.length ? `<p class="record-note">${label(untracked.length,'registro sem número de série','registros sem número de série')}</p><div class="record-list">${[...new Map(untracked.map(({service}) => [service.id,service])).values()].map(orderRow).join('')}</div>` : ''}</details>`;
    }).join('');
  }

  function openClient(key) {
    if (!isAdmin()) return;
    const client = directory().find(entry => entry.key === key);
    if (!client) return window.toast('Cliente não encontrado. Atualize a busca.');
    const count = client.services.length;
    const equipment = equipmentSections(client);
    const orders = [['Em andamento', client.services.filter(order => !order.closed && !order.employeeCompletedAt && !cancelled(order))],
      ['Em revisão', client.services.filter(order => !order.closed && order.employeeCompletedAt && !cancelled(order))],
      ['Finalizadas', client.services.filter(order => order.closed && !cancelled(order))], ['Canceladas', client.services.filter(cancelled)]];
    const serviceList = orders.filter(([, items]) => items.length).map(([title, items]) => `<section class="record-subsection"><h4>${title} <span>${items.length}</span></h4><div class="record-list">${items.map(orderRow).join('')}</div></section>`).join('');
    const registry = window.protecEquipmentRecords;
    window.openModal(esc(client.name), `<div class="client-record"><div class="record-contact"><p>${esc(contact(client) || source(client))}</p><span>${label(count,'ordem','ordens')}</span></div>${client.source === 'historical' && !contact(client) ? '<p class="record-note">Histórico sem vínculo cadastral. Os registros abaixo usam o nome informado nas ordens.</p>' : ''}${registry?.render(client) || ''}<section><h3>Serviços</h3>${serviceList || '<p class="record-note">Nenhuma ordem vinculada a este cliente.</p>'}</section><section><h3>Extintores por tipo e capacidade</h3>${equipment || '<p class="record-note">Nenhum extintor registrado nas ordens deste cliente.</p>'}</section></div>`, () => true, 'Fechar');
    const form = document.getElementById('editForm');
    form.classList.add('client-record-dialog');
    form.querySelector('.modal-actions button:first-child').hidden = true;
    registry?.bind(form, client, () => openClient(key));
    form.addEventListener('click', event => {
      const order = event.target.closest('[data-client-order]');
      if (order) return openOrder(order.dataset.clientOrder, key);
      const tag = event.target.closest('[data-label-serial]');
      if (tag) printLabel(client, {name: tag.dataset.labelGroup}, tag.dataset.labelSerial);
    });
  }

  function bindSearch(input, results) {
    results.setAttribute('role', 'region');
    results.setAttribute('aria-label', 'Resultados da busca');
    input.addEventListener('input', () => {
      const query = normalize(input.value);
      if (query.length < 2) { results.hidden = true; results.replaceChildren(); return; }
      const clients = directory().filter(client => matches(client, query) || window.protecEquipmentRecords?.matches(client, query) || client.services.some(order =>
        (order.items || []).some(item => normalize(item?.serial).includes(query))));
      const orders = (db.services || []).filter(order => normalize(order.code).includes(query) || (
        !clients.length && normalize([order.employeeName, order.sellerName].filter(Boolean).join(' ')).includes(query)
      ));
      results.innerHTML = `${clients.length ? `<h3>Clientes</h3>${clients.slice(0, 8).map(clientRow).join('')}${clients.length > 8 ? '<button type="button" class="record-row" data-go="service-clients">Ver diretório de clientes <span aria-hidden="true">›</span></button>' : ''}` : ''}${orders.length ? `<h3>Ordens</h3>${orders.slice(0, 6).map(orderRow).join('')}` : ''}` || '<p class="record-note">Nenhum resultado para esta busca.</p>';
      results.hidden = false;
    });
    results.addEventListener('click', event => {
      const order = event.target.closest('[data-client-order]');
      if (order) openOrder(order.dataset.clientOrder);
    });
  }

  function renderDirectory(host) {
    const clients = directory();
    host.innerHTML = '<div class="page-title"><div><h1>Serviços por cliente</h1><p>Selecione um cliente para consultar as ordens e o histórico dos extintores.</p></div></div><section class="panel record-directory"><label class="form-field">Buscar cliente<input type="search" data-directory-search placeholder="Nome, telefone ou e-mail"></label><div class="record-list" data-directory-results></div></section>';
    const input = host.querySelector('[data-directory-search]');
    const out = host.querySelector('[data-directory-results]');
    let limit = 30;
    function render() {
      const query = normalize(input.value), visible = clients.filter(client => matches(client,query) || window.protecEquipmentRecords?.matches(client,query));
      out.innerHTML = visible.slice(0, limit).map(clientRow).join('') || '<p class="record-note">Nenhum cliente encontrado.</p>';
      if (visible.length > limit) out.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn-soft btn-small" data-more-client-records>Mostrar mais clientes</button>');
    }
    input.oninput = () => { limit = 30; render(); };
    out.onclick = event => { if (event.target.closest('[data-more-client-records]')) { limit += 30; render(); } };
    render();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-open-client-record]');
    if (button) openClient(button.dataset.openClientRecord);
  });
  window.protecClientView = Object.freeze({ bindSearch, directory: renderDirectory });
})();
