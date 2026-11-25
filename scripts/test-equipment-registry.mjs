import assert from 'node:assert/strict';
import { adminChanges, applyAdminChanges, applyOperation } from '../site/offline-rules.mjs';
import { applyAdminOperation, registrationContacts } from '../site/service-rules.mjs';
import { equipmentCode, protectEquipmentOrderLinks } from '../site/equipment-registry.mjs';
import { resetClientsAndServices } from '../api-cloudflare/src/data-tools.mjs';

const at = '2026-11-25T15:00:00Z', later = '2026-11-25T15:10:00Z';
const admin = { role:'admin', id:'admin-one', name:'Gestor', username:'admin' };
const technician = { role:'employee', id:'employee-one', name:'Técnico', username:'tecnico' };
const state = {
  clients: [{ id:'client-one', name:'Condomínio do teste' }, { id:'client-two', name:'Outro cliente' }],
  services: [], types: [], settings: {}
};
const before = structuredClone(state);
const location = { action:'equipment-location', id:'location-one', clientId:'client-one', name:'Bloco A', address:'Endereço do teste' };
const asset = { action:'equipment-save', id:'asset-fixture-001', clientId:location.clientId, locationId:location.id,
  type:'Pó químico ABC', kg:'6', serial:'ABC-123', area:'2º andar', nextMonth:'2027-11' };
assert.throws(() => applyAdminOperation(state, asset, admin.username, at), /Selecione um local/);
applyAdminOperation(state, location, admin.username, at);
applyAdminOperation(state, {...location, id:'location-two', clientId:'client-two'}, admin.username, at);
assert.throws(() => applyAdminOperation(state, {...asset, locationId:'location-two'}, admin.username, at), /neste cliente/);
assert.throws(() => applyAdminOperation(state, {...asset, nextMonth:'2027-11-01'}, admin.username, at), /AAAA-MM/);
assert.deepEqual(applyAdminOperation(state, asset, admin.username, at), { equipmentRegistryChange:true });
assert.throws(() => applyAdminOperation(state, {...asset, id:'asset-another-002', serial:'abc-123'}, admin.username, at), /mesma série/);
assert.throws(() => applyAdminOperation(state, {...asset, id:'asset-fixture-002', serial:'DIF-123'}, admin.username, at), /código de etiqueta/);
assert.throws(() => applyAdminOperation(state, {...asset, area:'Cobertura'}, admin.username, later), /mudou em outro aparelho/);
assert.match(equipmentCode(asset.id), /^PX-[A-Z0-9_]{8,12}$/);
assert.equal(adminChanges(before,state).length, 0);
assert.deepEqual(applyAdminChanges(before,adminChanges(before,state,true),{canonical:true}).equipmentRegistry,state.equipmentRegistry);

const create = (id, clientChoice, items) => ({ id:'operation-' + id, serviceId:id, kind:'create', createdAt:at,
  payload:{ registrationVersion:8, date:'2026-11-25', serviceType:'Manutenção', clientChoice, items } });
const item = { type:asset.type, kg:asset.kg, qty:1, equipmentId:asset.id };
assert.equal(registrationContacts(state, technician).equipment.length, 0);
assert.throws(() => applyOperation(state,admin,create('other-order','client-two',[item]),at), /outro cliente/);
assert.throws(() => applyOperation(state,admin,create('repeat-order','client-one',[item,item]),at), /uma única vez/);
assert.throws(() => applyOperation(state,admin,create('incorrect-order','client-one',[{...item,kg:'4'}]),at), /capacidade.*mudou/);
assert.equal(state.services.length, 0);
const order = applyOperation(state,admin,create('valid-order','client-one',[item,{type:asset.type,kg:asset.kg,qty:2}]),at);
assert.equal(order.items.length, 3);
assert.equal(order.items[0].equipmentId, asset.id);
assert.equal(order.items[0].serial, asset.serial);
assert.equal(order.items[0].equipmentLocation, 'Bloco A · 2º andar');
order.employeeId = technician.id;
order.closed = true;
assert.deepEqual(registrationContacts(state, technician).equipment.map(row => row.id), [asset.id]);

const snapshot = structuredClone(state);
applyAdminOperation(state,{action:'equipment-archive',id:asset.id,clientId:asset.clientId,expectedUpdatedAt:at},admin.username,later);
assert.equal(registrationContacts(state, technician).equipment.length, 0);
assert.throws(() => applyOperation(state,admin,create('archived-order','client-one',[item]),at), /indisponível/);
order.items[0].serial = 'Tentativa de alterar o histórico';
protectEquipmentOrderLinks(state,snapshot);
assert.equal(order.items[0].serial, asset.serial);
const removed = structuredClone(state);
delete removed.services[0].items[0].equipmentId;
assert.throws(() => protectEquipmentOrderLinks(removed,snapshot), /vínculos/);
assert.equal(resetClientsAndServices(state,later).equipmentRegistry, undefined);
console.log('Ficha de equipamentos: locais, permissões, vínculo único, histórico, arquivamento e reset verificados.');
