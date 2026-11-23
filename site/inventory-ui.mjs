import { applyAdminChanges } from './offline-rules.mjs?v=protec-interface-75';

const labels = { parts: 'Peças', extinguishers: 'Extintores', powder: 'Pó' };
const agents = ['ABC', 'BC'];
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
const category = row => row.powderAgent ? 'powder' : normalize(row.category).startsWith('extintor') ? 'extinguishers' : 'parts';
const stock = () => (db.inventory || []).filter(row => row?.id);
const quantityText = (amount, unit) => `${number.format(amount)} ${unit}`;
const funds = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let filter = 'all';
let selectedId = '';
let deviceId;

function rows() {
  const items = stock();
  return [...items, ...agents.filter(agent => !items.some(row => row.powderAgent === agent)).map(agent => ({
    id: `powder-${agent}`, name: `Pó químico ${agent}`, qty: 0, unit: 'kg', powderAgent: agent
  }))];
}

function withInventoryRow(state, updated) {
  const inventory = state.inventory || [];
  return inventory.some(row => row?.id === updated.id)
    ? inventory.map(row => row?.id === updated.id ? updated : row)
    : [...inventory, updated];
}

function inventoryPage(host) {
  if (window.protecInventorySelection) {
    selectedId = window.protecInventorySelection;
    filter = 'all';
    delete window.protecInventorySelection;
  }
  const items = rows().filter(row => filter === 'all' || category(row) === filter);
  const selected = items.find(row => row.id === selectedId) || items[0];
  selectedId = selected?.id || '';
  host.innerHTML = `<section class="inventory-page">
    <header class="page-title stock-heading"><div><h1>Estoque</h1><p>Peças, extintores e pó para recarga.</p></div><button type="button" class="btn" data-stock-add>＋ Adicionar ao estoque</button></header>
    <div class="stock-tabs" role="group" aria-label="Categoria do estoque">${Object.entries({ all: 'Todos', ...labels }).map(([key,label]) => `<button class="btn btn-soft btn-small" type="button" aria-pressed="${filter === key}" data-stock-filter="${key}">${label}</button>`).join('')}</div>
    <div class="stock-layout"><table class="stock-table" aria-label="Itens em estoque"><thead><tr><th scope="col">Item</th><th scope="col">Saldo</th></tr></thead><tbody>${items.map((row, index) => `<tr><td><button type="button" aria-pressed="${row === selected}" data-stock-row="${index}">${esc(row.name)}<small>${esc(row.category || labels[category(row)])}${Number(row.qty) <= Number(row.minQty) ? ' · Estoque baixo' : ''}</small></button></td><td>${esc(quantityText(row.qty, row.unit || 'un.'))}</td></tr>`).join('') || '<tr><td colspan="2">Nenhum item nesta categoria.</td></tr>'}</tbody></table>
    ${selected ? `<aside class="stock-detail"><p>${esc(selected.category || labels[category(selected)])}</p><h2>${esc(selected.name)}</h2><dl><dt>Saldo atual</dt><dd>${esc(quantityText(selected.qty, selected.unit || 'un.'))}</dd>${selected.minQty != null ? `<dt>Estoque mínimo</dt><dd>${number.format(selected.minQty)}</dd>` : ''}${selected.unitCost != null ? `<dt>${selected.powderAgent ? 'Custo médio por kg' : 'Custo unitário'}</dt><dd>${funds(selected.unitCost)}</dd>` : ''}</dl><button class="btn btn-soft btn-small" type="button" data-stock-entry>Registrar entrada</button>${selected.powderAgent ? '<button class="icon-btn" type="button" data-stock-history>Ver movimentações de pó</button>' : '<button class="icon-btn" type="button" data-stock-edit>Editar item</button>'}</aside>` : ''}</div>
  </section>`;
  host.querySelector('[data-stock-add]').onclick = () => openInventoryEntry({ group: filter === 'all' ? 'parts' : filter });
  host.querySelectorAll('[data-stock-filter]').forEach(button => button.onclick = () => {
    filter = button.dataset.stockFilter;
    inventoryPage(host);
    host.querySelector(`[data-stock-filter="${filter}"]`)?.focus();
  });
  host.querySelectorAll('[data-stock-row]').forEach(button => button.onclick = () => {
    selectedId = items[Number(button.dataset.stockRow)].id;
    inventoryPage(host);
    host.querySelector(`[data-stock-row="${button.dataset.stockRow}"]`)?.focus();
  });
  const entry = host.querySelector('[data-stock-entry]');
  if (entry) entry.onclick = () => openInventoryEntry({ group: category(selected), itemId: selected.id, agent: selected.powderAgent });
  const edit = host.querySelector('[data-stock-edit]');
  if (edit) edit.onclick = () => window.editStock(selected.id);
  const history = host.querySelector('[data-stock-history]');
  if (history) history.onclick = () => window.go('workshop');
}

async function request(path, method = 'GET', payload) {
  const response = await window.apiCall(path, method, payload);
  const data = await window.apiJson(response);
  if (!response.ok) throw Object.assign(Error(data.error || 'Não foi possível registrar a entrada.'), { status: response.status });
  return data;
}

function stockOperation(kind, id, createdAt, fields) {
  deviceId ||= crypto.randomUUID();
  return { path: '/api/offline/admin/sync', payload: { accountKey: 'admin:1', serviceId: 'admin-state',
    dataEpoch: db.__dataEpoch || 'initial', kind, id, deviceId, createdAt, ...fields } };
}

async function itemKey(group, name) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${group}:${normalize(name)}`));
  return `stock-custom-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function parseNumber(input, digits, max, min = 0) {
  const value = String(input).trim();
  const rule = digits ? new RegExp(`^\\d+(?:[,.]\\d{1,${digits}})?$`) : /^\d+$/;
  const parsed = Number(value.replace(',', '.'));
  return rule.test(value) && parsed >= min && parsed <= max ? parsed : null;
}

export function openInventoryEntry({ group = 'parts', itemId = '', agent = '', afterClose = window.renderPage } = {}) {
  const source = document.activeElement;
  const stages = ['Categoria', 'Item', 'Quantidade', 'Revisão'];
  let step = 0;
  let item = agent ? `powder-${agent}` : itemId;
  let name = '', quantity = '', unitCost = '', minimum = '0', reference = '';
  let review;
  let pending;
  let saving = false;
  let previousStep = 0;
  window.openModal('Adicionar ao estoque', `<ol class="stock-steps" aria-label="Etapas">${stages.map(stage => `<li>${stage}</li>`).join('')}</ol><div data-stock-step></div><p class="stock-error" role="alert" hidden></p>`, () => false, 'Avançar');
  const form = document.getElementById('editForm');
  const body = form.querySelector('[data-stock-step]');
  const error = form.querySelector('.stock-error');
  const back = form.querySelector('.modal-actions button:first-child');
  const next = form.querySelector('.modal-actions button:last-child');
  const close = form.querySelector('.modal-head button');
  const modal = form.parentElement;
  form.classList.add('stock-wizard');
  form.setAttribute('role', 'dialog');
  form.setAttribute('aria-modal', 'true');
  close.setAttribute('aria-label', 'Fechar');
  const heading = form.querySelector('h2');
  heading.id = 'stock-wizard-title';
  form.setAttribute('aria-labelledby', heading.id);

  const field = (label, key, value, options = '') => `<label class="form-field">${label}<input name="${key}" value="${esc(value)}" ${options}></label>`;
  const relevant = () => rows().filter(row => category(row) === group);
  const current = () => relevant().find(row => row.id === item);
  function closeWizard() {
    if (saving) return;
    window.closeModal();
    if (source instanceof HTMLElement) source.focus();
  }
  function render() {
    error.hidden = true;
    form.querySelectorAll('.stock-steps li').forEach((marker, index) => {
      if (index === step) marker.setAttribute('aria-current', 'step');
      else marker.removeAttribute('aria-current');
    });
    back.textContent = step ? 'Voltar' : 'Cancelar';
    next.textContent = step === 3 ? 'Confirmar entrada' : 'Avançar';
    if (step === 0) {
      body.innerHTML = `<label class="form-field">Categoria<select name="group">${Object.entries(labels).map(([key,label]) => `<option value="${key}" ${group === key ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
    } else if (step === 1) {
      const options = relevant();
      if (!options.some(row => row.id === item) && item !== '__new__') item = options[0]?.id || '__new__';
      body.innerHTML = `<label class="form-field">Item<select name="item">${options.map(row => `<option value="${esc(row.id)}" ${row.id === item ? 'selected' : ''}>${esc(row.name)}</option>`).join('')}${group !== 'powder' ? `<option value="__new__" ${item === '__new__' ? 'selected' : ''}>Cadastrar novo item</option>` : ''}</select></label>${item === '__new__' ? field('Nome do novo item', 'name', name, 'maxlength="80"') : ''}`;
    } else if (step === 2) {
      const powder = group === 'powder';
      body.innerHTML = field(powder ? 'Quantidade (kg)' : 'Quantidade (unidades)', 'quantity', quantity, `inputmode="${powder ? 'decimal' : 'numeric'}" maxlength="14"`)
        + (powder || item === '__new__' ? field(powder ? 'Custo por kg (R$)' : 'Custo unitário (R$)', 'unitCost', unitCost, 'inputmode="decimal" maxlength="14"') : '')
        + (powder ? field('Nota, fornecedor ou referência', 'reference', reference, 'maxlength="300"') : item === '__new__' ? field('Estoque mínimo (unidades)', 'minimum', minimum, 'inputmode="numeric" maxlength="14"') : '');
    } else {
      const { title, old, received, unit } = review;
      body.innerHTML = `<h3>${esc(title)}</h3><dl class="stock-review"><div><dt>Saldo atual</dt><dd>${esc(quantityText(old, unit))}</dd></div><div><dt>Entrada</dt><dd>+${esc(quantityText(received, unit))}</dd></div><div><dt>Saldo previsto</dt><dd>${esc(quantityText(old + received, unit))}</dd></div></dl>`;
    }
    const direction = Math.sign(step - previousStep);
    if (direction) window.protecMotion?.transition(body, { axis: 'X', direction, duration: 255 });
    previousStep = step;
    (body.querySelector('select,input') || next).focus();
  }

  body.oninput = event => {
    const { name: key, value } = event.target;
    error.hidden = true;
    if (key === 'group' && value !== group) {
      group = value; item = ''; name = ''; quantity = ''; unitCost = ''; minimum = '0'; reference = '';
    } else if (key === 'item') {
      item = value;
      render();
      if (item === '__new__') body.querySelector('[name=name]').focus();
    } else if (key === 'name') name = value;
    else if (key === 'quantity') quantity = value;
    else if (key === 'unitCost') unitCost = value;
    else if (key === 'minimum') minimum = value;
    else if (key === 'reference') reference = value;
  };
  back.onclick = () => {
    if (pending) return;
    if (step) { step--; render(); }
    else closeWizard();
  };
  close.onclick = closeWizard;
  modal.onclick = event => { if (event.target === modal) closeWizard(); };
  form.onkeydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeWizard(); }
    if (event.key !== 'Tab') return;
    const controls = [...form.querySelectorAll('button:enabled, input:enabled, select:enabled')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (saving) return;
    try {
      if (step === 1 && item === '__new__') {
        if (!name.trim()) throw Error('Informe o nome do novo item.');
        if (relevant().some(row => normalize(row.name) === normalize(name))) throw Error('Este item já está cadastrado nesta categoria.');
      }
      if (step === 2) {
        const powder = group === 'powder';
        const creating = item === '__new__';
        const received = parseNumber(quantity, powder ? 3 : 0, powder ? 100_000 : 1_000_000, powder ? .001 : 1);
        if (received === null) throw Error(powder ? 'Informe de 0,001 a 100.000 kg, com até três casas decimais.' : 'Informe um número inteiro de unidades, de 1 a 1.000.000.');
        const cost = powder || creating ? parseNumber(unitCost, 2, 1_000_000) : null;
        if ((powder || creating) && cost === null) throw Error('Informe um custo válido. Use zero quando não houver custo.');
        const minQty = creating ? parseNumber(minimum, 0, 1_000_000) : null;
        if (creating && minQty === null) throw Error('Informe um estoque mínimo inteiro e não negativo.');
        if (powder && reference.trim().length < 3) throw Error('Informe pelo menos três caracteres na referência.');
        const row = current();
        const old = row ? Number(row.qty) : 0;
        if ((!row && !creating) || !Number.isFinite(old) || old < 0) throw Error('Confira o cadastro e o saldo antes de registrar a entrada.');
        review = { row: row && structuredClone(row), old, received, cost, minQty, unit: row?.unit || 'un.', title: row?.name || name.trim() };
      }
      if (step < 3) { step++; render(); return; }
      saving = true;
      back.disabled = close.disabled = next.disabled = true;
      next.textContent = 'Registrando…';
      if (!pending) {
        if (JSON.stringify(current()) !== JSON.stringify(review.row)) throw Object.assign(Error('O item mudou. Volte e confira o saldo atualizado.'), { status: 409 });
        if (item === '__new__' && relevant().some(row => normalize(row.name) === normalize(name))) throw Object.assign(Error('Este item já foi cadastrado. Volte e selecione-o.'), { status: 409 });
        const entryId = crypto.randomUUID(), at = new Date().toISOString();
        if (group === 'powder') {
          const payload = { action: 'powder-entry', entryId, agent: review.row.powderAgent, kg: review.received, unitCost: review.cost, reference: reference.trim() };
          const actual = stock().find(record => record.id === item);
          pending = window.adminOffline?.ready ? { path: '/api/admin/operations', payload }
            : stockOperation('admin-operation', entryId, at, { payload, guards: actual ? [{ group: 'inventory', id: item, value: review.row }] : [] });
        } else {
          const row = review.row || { id: await itemKey(group, name), name: name.trim(), category: labels[group], unit: 'un', minQty: review.minQty, unitCost: review.cost };
          const updated = { ...row, qty: review.old + review.received, stockEntries: [...(Array.isArray(row.stockEntries) ? row.stockEntries : []), { id: entryId, at, quantity: review.received }] };
          selectedId = updated.id;
          if (window.adminOffline?.ready) {
            const desired = { ...structuredClone(db), inventory: withInventoryRow(db, updated) };
            pending = { path: '/api/admin/state', method: 'PUT', payload: desired };
          } else {
            const changes = [{ path: ['inventory', updated.id], before: review.row ? { exists: true, value: review.row } : { exists: false }, after: { exists: true, value: updated } }];
            pending = stockOperation('admin-state', entryId, at, { changes });
          }
        }
      }
      const result = await request(pending.path, pending.method || 'POST', pending.payload);
      if (!result.ok) throw Error('O sistema não confirmou a entrada. Tente novamente.');
      if (result.state) db = result.state;
      else db = await request('/api/admin/state').catch(() => {
        if (!Array.isArray(result.delta) || Number(db.__rev) > Number(result.revision)) return db;
        return applyAdminChanges(structuredClone(db), result.delta, { force: true, canonical: true });
      });
      if (group === 'powder') selectedId = item;
      if (filter !== 'all') filter = group;
      window.saveLocal();
      saving = false;
      closeWizard();
      afterClose();
      window.toast(result.local ? 'Entrada salva neste aparelho e aguardando sincronização.' : 'Entrada registrada.');
    } catch (failure) {
      if (failure.status === 409) {
        pending = null;
        if (!window.adminOffline?.ready) db = await request('/api/admin/state').catch(() => db);
        step = 2;
        render();
      } else if (failure.status === 400) {
        pending = null;
        step = 2;
        render();
      }
      error.textContent = failure.message || 'Não foi possível registrar a entrada.';
      error.hidden = false;
    } finally {
      saving = false;
      if (form.isConnected) {
        close.disabled = next.disabled = false;
        back.disabled = Boolean(pending);
        next.textContent = pending ? 'Tentar novamente' : step === 3 ? 'Confirmar entrada' : 'Avançar';
      }
    }
  };
  render();
}

if (typeof window !== 'undefined') window.inventoryPage = inventoryPage;
