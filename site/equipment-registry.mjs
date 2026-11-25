const idPattern = /^[A-Za-z0-9_-]{8,80}$/;
const monthPattern = /^20\d{2}-(0[1-9]|1[0-2])$/;
const text = (value, size) => String(value ?? '').trim().slice(0, size);
const conflict = message => Object.assign(Error(message), { status: 409 });
const emptyRegistry = () => ({ locations: [], equipment: [] });
export const equipmentCode = id => 'PX-' + String(id).replaceAll('-', '').slice(0, 12).toUpperCase();
export const equipmentRegistry = state => state.equipmentRegistry || emptyRegistry();

export function registryChoices(state, clients) {
  const registry = equipmentRegistry(state);
  const allowed = new Set(clients.map(client => client.id));
  const locations = new Map(registry.locations.map(location => [location.id, location]));
  return registry.equipment.flatMap(asset => {
    const location = locations.get(asset.locationId);
    if (asset.archivedAt || !location || location.clientId !== asset.clientId || !allowed.has(asset.clientId)) return [];
    const { id, clientId, type, kg, serial, area } = asset;
    return [{ id, clientId, type, kg, serial, area, location: location.name }];
  });
}

export function applyRegistryChange(state, data, username, at, catalog) {
  const clientId = text(data.clientId, 80);
  if (!(state.clients || []).some(client => client.id === clientId && client.active !== false)) {
    throw conflict('Cadastre ou reative o cliente antes de alterar seus equipamentos.');
  }
  const registry = state.equipmentRegistry ||= emptyRegistry();
  const id = text(data.id, 80);
  if (!idPattern.test(id)) throw Error('Identificador da ficha inválido.');
  const records = data.action === 'equipment-location' ? registry.locations : registry.equipment;
  const current = records.find(record => record.id === id);
  if (current && current.clientId !== clientId) throw conflict('Este registro pertence a outro cliente.');
  if ((current?.updatedAt || '') !== text(data.expectedUpdatedAt, 40)) {
    throw conflict('Esta ficha mudou em outro aparelho. Reabra para conferir os dados.');
  }
  const stamp = { updatedAt: at, updatedBy: username };
  if (data.action === 'equipment-location') {
    const name = text(data.name, 100), address = text(data.address, 200);
    if (!name || !address) throw Error('Informe o nome e o endereço do local.');
    if (registry.locations.some(row => row.id !== id && row.clientId === clientId &&
        row.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      throw conflict('Já existe um local desse cliente com esse nome.');
    }
    const location = { id, clientId, name, address, ...stamp };
    if (current) Object.assign(current, location);
    else records.push(location);
    return;
  }
  if (data.action === 'equipment-archive') {
    if (!current) throw conflict('Equipamento não encontrado.');
    Object.assign(current, stamp, { archivedAt: at });
    return;
  }
  if (!current && records.some(record => equipmentCode(record.id) === equipmentCode(id))) {
    throw conflict('Esse código de etiqueta já existe. Reabra o cadastro para gerar outro.');
  }
  const locationId = text(data.locationId, 80), type = text(data.type, 100), kg = text(data.kg, 12);
  const serial = text(data.serial, 100), area = text(data.area, 100), nextMonth = String(data.nextMonth ?? '').trim();
  if (!registry.locations.some(location => location.id === locationId && location.clientId === clientId)) {
    throw conflict('Selecione um local cadastrado neste cliente.');
  }
  if (!catalog.equipment.some(row => row.type === type && row.kg === kg && row.maintenanceAllowed !== false)) {
    throw Error('Selecione o tipo e a capacidade do equipamento.');
  }
  if (!area) throw Error('Informe o ponto de instalação do equipamento.');
  if (nextMonth && !monthPattern.test(nextMonth)) throw Error('Informe o mês da próxima manutenção no formato AAAA-MM.');
  if (serial && registry.equipment.some(row => !row.archivedAt && row.id !== id && row.clientId === clientId &&
      row.type === type && row.kg === kg && row.serial?.toLocaleUpperCase('pt-BR') === serial.toLocaleUpperCase('pt-BR'))) {
    throw conflict('Já existe um equipamento deste tipo e capacidade com a mesma série neste cliente.');
  }
  const asset = { id, clientId, locationId, type, kg, serial, area, nextMonth, notes: text(data.notes, 600), ...stamp };
  if (current) Object.assign(current, asset);
  else records.push({ ...asset, createdAt: at });
}

export function registrationAsset(choices, clientId, row, used) {
  if (!row.equipmentId) return null;
  const asset = choices.find(item => item.id === row.equipmentId && item.clientId === clientId);
  if (!asset) throw conflict('Há um equipamento indisponível ou de outro cliente. Revise a ordem.');
  if (Number(row.qty) !== 1 || used.has(asset.id)) {
    throw Error('Adicione cada equipamento da ficha uma única vez, com quantidade 1.');
  }
  if (asset.type !== row.type || asset.kg !== String(row.kg ?? '')) {
    throw conflict('O tipo ou a capacidade do equipamento mudou. Reabra a ficha antes de usar.');
  }
  used.add(asset.id);
  return asset;
}

export function attachRegistryData(item, asset) {
  if (asset) Object.assign(item, {
    equipmentId: asset.id,
    serial: asset.serial,
    equipmentLocation: [asset.location, asset.area].filter(Boolean).join(' · ')
  });
  return item;
}

export function protectEquipmentOrderLinks(state, previous) {
  const oldOrders = new Map((previous.services || []).map(service => [service.id, service]));
  let choices;
  for (const service of state.services || []) {
    const oldOrder = oldOrders.get(service.id);
    const oldItems = new Map((oldOrder?.items || []).filter(item => item.equipmentId).map(item => [item.equipmentId, item]));
    const used = new Set();
    for (const item of service.items || []) {
      if (!item.equipmentId) {
        delete item.equipmentLocation;
        continue;
      }
      const historical = oldItems.get(item.equipmentId);
      if (historical && oldOrder.clientId === service.clientId && !used.has(item.equipmentId)) {
        for (const key of ['type', 'kg', 'serial', 'equipmentLocation']) item[key] = historical[key];
        used.add(item.equipmentId);
        continue;
      }
      choices ||= registryChoices(state, (state.clients || []).filter(client => client.active !== false));
      attachRegistryData(item, registrationAsset(choices, service.clientId, { ...item, qty: 1 }, used));
    }
    if (oldOrder?.closed && [...oldItems.keys()].some(id => !used.has(id))) {
      throw conflict('A ordem foi finalizada. Os vínculos com as fichas devem ser preservados.');
    }
  }
}
