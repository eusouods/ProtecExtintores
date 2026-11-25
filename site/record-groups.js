(() => {
  const text = value => String(value ?? '').trim();
  const normalize = value => text(value).normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLowerCase();
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const phone = value => text(value).replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  const email = value => text(value).toLowerCase();
  const byDate = (a, b) => text(b.date || b.createdAt).localeCompare(text(a.date || a.createdAt));
  const brNumber = new Intl.NumberFormat('pt-BR');

  function capacity(type, value) {
    const raw = text(value);
    if (!raw) return /agua/.test(normalize(type)) ? '10 L' : '';
    const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(kg|l)?$/i);
    if (!match) return raw;
    const unit = (match[2] || (/agua/.test(normalize(type)) ? 'L' : 'kg')).toLowerCase() === 'l' ? 'L' : 'kg';
    return `${brNumber.format(Number(match[1].replace(',', '.')))} ${unit}`;
  }

  function equipmentName(item) {
    const type = text(item.type) || 'Extintor';
    return [type, capacity(type, item.kg)].filter(Boolean).join(' · ');
  }

  function equipmentItems(service) {
    if (Array.isArray(service.items)) return service.items.filter(item => item && typeof item === 'object');
    return service.type ? [{ type: service.type, kg: service.kg, serial: service.serial }] : [];
  }

  function grouped(rows, describe) {
    const result = new Map();
    for (const row of rows || []) {
      if (!row) continue;
      const { name, detail = '', quantity = 1, key = [normalize(name), normalize(detail)], item = row } = describe(row);
      const amount = Number(quantity);
      if (!name || !Number.isFinite(amount) || amount <= 0) continue;
      const id = JSON.stringify(key);
      if (!result.has(id)) result.set(id, { name, detail, quantity: 0, items: [] });
      const group = result.get(id);
      group.quantity += amount;
      group.items.push(item);
    }
    return [...result.values()];
  }

  function orderGroups(service, { planned = false } = {}) {
    const parameters = { lengthMeters: 'm', widthCm: 'cm', diameterMm: 'mm' };
    const maintenance = [], other = [];
    for (const item of equipmentItems(service)) {
      if (/^(instalacao de extintor|servico complementar)$/.test(normalize(item.type))) other.push(item);
      else maintenance.push(item);
    }
    return [
      { label: 'Extintores em manutenção', rows: grouped(maintenance, item => ({ name: equipmentName(item) })) },
      { label: 'Fornecimento de extintores', rows: grouped(service.soldExtinguishers, row => ({ name: equipmentName(row), detail: row.condition === 'new' ? 'Novo lacrado · sem argola' : row.condition === 'refurbished' ? 'Seminovo revisado · com argola' : text(row.condition), quantity: row.quantity })) },
      { label: 'Mangueiras de hidrante', rows: grouped(service.hydrantHoses, row => ({ name: text(row.type) || 'Mangueira', detail: [row.diameterMm && `${row.diameterMm} mm`, row.lengthMeters && `${row.lengthMeters} m`].filter(Boolean).join(' · '), quantity: row.quantity })) },
      { label: 'Serviços complementares', rows: grouped([...(service.complementaryServices || []), ...(service.extraServices || []), ...(service.complementaryServices?.length || service.extraServices?.length ? [] : other)], row => ({
        name: text(row.name || row.title || row.type),
        detail: [row.variant, ...Object.entries(row.parameters || {}).sort().map(([key, value]) => [value, parameters[key] || key].join(' '))].filter(Boolean).join(' · '),
        quantity: row.quantity ?? 1
      })) },
      ...(planned ? [{ label: 'Peças previstas', rows: grouped(service.plannedParts, row => ({ name: text(row.name), quantity: row.quantity })) }] : [])
    ].filter(section => section.rows.length);
  }

  function clientDirectory(state) {
    const groups = new Map(), contacts = new Map(), accountIds = new Map(), orderByCode = new Map();
    function index(map, key, id) {
      if (!key) return;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(id);
    }
    function add(key, record) {
      if (!groups.has(key)) groups.set(key, { key, ...record, services: [] });
      return groups.get(key);
    }
    for (const client of state.clients || []) {
      if (!client?.id) continue;
      const key = 'id:' + client.id;
      add(key, { name: text(client.name) || 'Cliente', phone: text(client.phone), email: text(client.email), clientId: client.id, source: 'registered' });
      index(accountIds, text(client.accountId || client.customerId), key);
      index(contacts, email(client.email) && 'e:' + email(client.email), key);
      index(contacts, phone(client.phone) && 'p:' + phone(client.phone), key);
    }
    for (const order of state.orders || []) if (order?.code) orderByCode.set(order.code, order);
    for (const s of state.services || []) {
      if (!s?.id) continue;
      const order = orderByCode.get(s.code);
      const name = text(s.clientName || order?.name) || 'Cliente não informado';
      const address = text(s.clientEmail || order?.email), number = text(s.clientPhone || order?.phone);
      const contactKeys = [email(address) && 'e:' + email(address), phone(number) && 'p:' + phone(number)].filter(Boolean);
      const known = new Set(contactKeys.flatMap(key => [...(contacts.get(key) || [])]));
      const account = text(s.customerId || order?.customerId), linkedAccounts = accountIds.get(account);
      const self = ['creator','self'].includes(s.clientSource);
      const explicit = text(s.clientId) && 'id:' + text(s.clientId);
      const candidate = known.size === 1 ? groups.get([...known][0]) : null;
      const contactMatch = candidate && (normalize(candidate.name) === normalize(name) || name === 'Cliente não informado') ? candidate.key : '';
      const key = self ? 'self:' + JSON.stringify([s.registeredByRole, s.registeredById || s.registeredBy || normalize(name)])
        : explicit || (linkedAccounts?.size === 1 ? [...linkedAccounts][0] : '') || contactMatch
          || (account ? 'account:' + account : contactKeys.length ? 'contact:' + JSON.stringify([normalize(name), contactKeys[0]])
            : (name === 'Cliente não informado' ? 'unknown:' : 'name:' + normalize(name)));
      add(key, { name, phone: number, email: address, source: self ? 'self' : 'historical' }).services.push(s);
    }
    return [...groups.values()].map(group => ({ ...group, services: [...group.services].sort(byDate) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.key.localeCompare(b.key));
  }

  function equipmentHistory(client) {
    return grouped(client.services.filter(s => !s.cancelledAt && normalize(s.status) !== 'cancelado')
      .flatMap(service => equipmentItems(service).filter(item => !/^(instalacao de extintor|servico complementar)$/.test(normalize(item.type)))
        .map(item => ({ item, service }))), ({ item, service }) => ({
      name: equipmentName(item), item: { item, service }
    }));
  }

  function orderTableRows(groups, formatMoney) {
    return groups.map(group => `<tr class="receipt-section"><th colspan="3">${escape(group.label)}</th></tr>${group.rows.map(row => {
      const known = row.items.every(item => item.unitPrice !== '' && item.unitPrice != null && Number.isFinite(Number(item.unitPrice)));
      const subtotal = known ? formatMoney(row.items.reduce((total,item) => total + Number(item.unitPrice) * (Number(item.quantity) || 1), 0)) : '—';
      const units = row.items.filter(item => item.equipmentId).map(item =>
        [globalThis.protecEquipmentRecords?.code(item.equipmentId), item.serial && 'Série ' + item.serial, item.equipmentLocation].filter(Boolean).join(' · '));
      const references = units.map(unit => `<br><small>${escape(unit)}</small>`).join('');
      return `<tr><td>${escape([row.name,row.detail].filter(Boolean).join(' · '))}${references}</td><td>${escape(row.quantity)}</td><td>${escape(subtotal)}</td></tr>`;
    }).join('')}`).join('');
  }

  globalThis.protecRecords = Object.freeze({ normalize, escape, grouped, orderGroups, clientDirectory, equipmentHistory, orderTableRows });
})();
