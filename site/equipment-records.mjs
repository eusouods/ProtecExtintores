import { equipmentCode, equipmentRegistry } from './equipment-registry.mjs?v=protec-interface-80';
import { registrationCatalog } from './service-rules.mjs?v=protec-interface-80';

const esc = value => window.protecRecords.escape(value ?? '');
const button = (label, action, id = '') =>
  `<button type="button" class="btn btn-soft btn-small" data-registry-action="${action}" data-registry-id="${esc(id)}">${label}</button>`;
const field = (name, label, value, limit, attributes = '') =>
  `<label class="form-field">${label}<input name="${name}" value="${esc(value)}" maxlength="${limit}" ${attributes}></label>`;
const option = (value, label, selected) =>
  `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
const equipmentName = item => [item.type, item.kg ? item.kg + ' kg' : item.type === 'Água pressurizada' ? '10 L' : ''].filter(Boolean).join(' · ');
const month = value => value ? value.slice(5) + '/' + value.slice(0, 4) : 'Sem previsão';
const activeClient = id => (db.clients || []).some(client => client.id === id && client.active !== false);

function render(client) {
  if (!client.clientId || !db.equipmentRegistry || !activeClient(client.clientId)) return '';
  const registry = equipmentRegistry(db);
  const sites = registry.locations.filter(site => site.clientId === client.clientId);
  const assets = registry.equipment.filter(asset => asset.clientId === client.clientId);
  const record = asset => {
    const history = client.services.filter(order => order.items?.some(item => item.equipmentId === asset.id));
    return `<details class="record-series"><summary><span>${esc(equipmentName(asset))} · ${esc(asset.area)}</span>
      <small>${asset.archivedAt ? 'Arquivado' : esc(month(asset.nextMonth))}</small></summary>
      <p class="record-note">${esc(equipmentCode(asset.id))}${asset.serial ? ' · Série ' + esc(asset.serial) : ''}</p>
      ${asset.notes ? `<p class="record-note">${esc(asset.notes)}</p>` : ''}
      <div class="record-list">${history.map(order => `<button type="button" class="record-row" data-client-order="${esc(order.id)}"><b>${esc(order.code || 'Ordem local')}</b><small>${esc(order.date || '')}</small></button>`).join('') || '<p class="record-note">Nenhuma ordem vinculada.</p>'}</div>
      <div class="equipment-registry-actions">${asset.archivedAt ? '' : button('Editar', 'equipment-save', asset.id) + button('Imprimir etiqueta', 'print', asset.id) + button('Arquivar', 'equipment-archive', asset.id)}</div></details>`;
  };
  return `<section class="record-subsection" data-equipment-registry><h3>Equipamentos cadastrados</h3>
    <div class="equipment-registry-actions">${button('Novo local', 'equipment-location')}${sites.length ? button('Novo equipamento', 'equipment-save') : ''}</div>
    ${sites.map(site => `<details class="record-equipment"><summary><b>${esc(site.name)}</b><span>${assets.filter(asset => asset.locationId === site.id && !asset.archivedAt).length} ativos</span></summary>
      <p class="record-note">${esc(site.address)}</p>${button('Editar local', 'equipment-location', site.id)}
      ${assets.filter(asset => asset.locationId === site.id).map(record).join('') || '<p class="record-note">Nenhum equipamento neste local.</p>'}</details>`).join('') || '<p class="record-note">Cadastre o primeiro endereço para adicionar equipamentos.</p>'}</section>`;
}

async function save(data, back) {
  const response = await window.apiCall('/api/admin/operations', 'POST', data);
  const result = await window.apiJson(response);
  if (!response.ok || !result.state) throw Error(result.error || 'Não foi possível salvar a ficha.');
  db = result.state;
  window.saveLocal();
  window.toast(result.local ? 'Alteração guardada neste aparelho.' : 'Ficha atualizada.');
  return { afterClose: back };
}

function edit(action, record, client, back) {
  const location = action === 'equipment-location', archiving = action === 'equipment-archive';
  const data = { action, id: record?.id || crypto.randomUUID(), clientId: client.clientId, expectedUpdatedAt: record?.updatedAt || '' };
  const catalog = registrationCatalog(db).equipment.filter(row => row.maintenanceAllowed !== false);
  const sites = equipmentRegistry(db).locations.filter(site => site.clientId === client.clientId);
  const selected = catalog.findIndex(row => row.type === record?.type && row.kg === record?.kg);
  const title = archiving ? 'Arquivar equipamento' : location ? (record ? 'Editar local' : 'Novo local') : (record ? 'Editar equipamento' : 'Novo equipamento');
  let body;
  if (archiving) {
    body = '<p>O equipamento sairá da seleção de novas ordens. As ordens vinculadas continuarão no histórico.</p>';
  } else if (location) {
    body = field('name', 'Nome do local', record?.name, 100, 'required') +
      field('address', 'Endereço', record?.address, 200, 'required');
  } else {
    body = `<label class="form-field">Local<select name="locationId" required>${sites.map(site => option(site.id, site.name, record?.locationId)).join('')}</select></label>
      <label class="form-field">Tipo e capacidade<select name="model" required>${option('', 'Selecione', selected < 0 ? '' : null)}${catalog.map((row, index) => option(index, row.type + ' · ' + row.label, selected)).join('')}</select></label>` +
      field('area', 'Ponto de instalação', record?.area, 100, 'required placeholder="Ex.: Bloco A, 2º andar"') +
      field('serial', 'Número de série', record?.serial, 100) +
      field('nextMonth', 'Próxima manutenção (AAAA-MM)', record?.nextMonth, 7, 'placeholder="2027-06" pattern="20[0-9]{2}-(0[1-9]|1[0-2])"') +
      field('notes', 'Observações', record?.notes, 600);
  }
  window.openModal(title, body, form => {
    const fields = Object.fromEntries(form);
    if (!location && !archiving) {
      const model = catalog[Number(fields.model)];
      if (fields.model === '' || !model) throw Error('Selecione o tipo e a capacidade.');
      Object.assign(fields, { type: model.type, kg: model.kg });
      delete fields.model;
    }
    return save({ ...fields, ...data }, back);
  }, archiving ? 'Arquivar' : 'Salvar');
  const cancel = document.querySelector('#editForm .modal-actions button[type=button]');
  cancel.textContent = 'Voltar à ficha';
  cancel.onclick = back;
}

async function print(asset) {
  const page = window.open('', '_blank', 'width=510,height=460');
  if (!page) return window.toast('Permita a abertura da janela para imprimir a etiqueta.');
  page.opener = null;
  page.document.body.textContent = 'Preparando etiqueta…';
  try {
    const response = await window.apiCall('/api/admin/equipment-label?id=' + encodeURIComponent(asset.id));
    const data = await window.apiJson(response);
    if (!response.ok || !data.qr?.startsWith('data:image/svg+xml;base64,')) {
      throw Error(data.error || 'Sincronize a ficha com internet antes de imprimir.');
    }
    const site = equipmentRegistry(db).locations.find(location => location.id === asset.locationId);
    page.document.open();
    page.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Etiqueta de equipamento</title>
      <style>body{font:12px system-ui;color:#111}article{display:flex;align-items:center;gap:4mm;width:76mm;padding:3mm;border:1px solid #111}img{width:24mm;height:24mm}h1,p{margin:2px 0}h1{font-size:13px}code{font-size:8px;overflow-wrap:anywhere}</style>
      <article><img alt="QR da ficha" src="${esc(data.qr)}"><div><h1>${esc(equipmentName(asset))}</h1><p>${esc([site?.name, asset.area].filter(Boolean).join(' · '))}</p>
      ${asset.serial ? `<p>Série ${esc(asset.serial)}</p>` : ''}<code>${esc(data.code)}</code></div></article></html>`);
    page.document.close();
    const qr = page.document.querySelector('img');
    await qr.decode();
    if (!page.closed) { page.focus(); page.print(); }
  } catch (error) {
    page.close();
    window.toast(error.message || 'Não foi possível imprimir a etiqueta.');
  }
}

function bind(form, client, back) {
  form.querySelector('[data-equipment-registry]')?.addEventListener('click', event => {
    const target = event.target.closest('[data-registry-action]');
    if (!target) return;
    const { registryAction: action, registryId: id } = target.dataset;
    const registry = equipmentRegistry(db);
    const collection = action === 'equipment-location' ? registry.locations : registry.equipment;
    const record = collection.find(row => row.id === id && row.clientId === client.clientId);
    if (id && !record) return window.toast('Atualize a ficha para continuar.');
    if (action === 'print') return void print(record);
    edit(action, record, client, back);
  });
}

function matches(client, query) {
  if (!client.clientId) return false;
  const normalize = window.protecRecords.normalize;
  return equipmentRegistry(db).equipment.some(asset => asset.clientId === client.clientId &&
    [asset.serial, asset.area, equipmentCode(asset.id)].some(value => value && normalize(value).includes(query)));
}

window.protecEquipmentRecords = Object.freeze({ render, bind, matches, code: equipmentCode });
