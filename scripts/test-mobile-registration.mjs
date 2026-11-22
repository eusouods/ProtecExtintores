import assert from 'node:assert/strict';
import { handleOffline } from '../api-cloudflare/src/offline.mjs';

const session = { role: 'admin', username: 'Gestor' };
const receipts = new Map();
let state = {
  __rev: 0, __dataEpoch: 'test', settings: {}, services: [], types: [], costCatalog: [],
  clients: [{ id: 'client-one', name: 'Cliente teste' }],
  sellers: [{ id: 'seller-one', name: 'Vendedora teste' }],
  employees: [{ id: 'employee-one', name: 'Funcionário teste' }]
};
const env = {
  DB: {
    prepare(sql) {
      if (sql.startsWith('CREATE TABLE')) return { run: async () => {} };
      if (sql.includes('FROM offline_receipts')) {
        return {
          bind(account, id) {
            return { first: async () => receipts.get(account + ':' + id) ?? null };
          }
        };
      }
      if (sql.includes('FROM admin_auth')) return { first: async () => ({ username: session.username }) };
      if (sql.includes('FROM employee_auth') || sql.includes('FROM seller_auth')) {
        return { bind: () => ({ first: async () => ({ username: role }) }) };
      }
      throw Error('Consulta não esperada no teste.');
    }
  }
};
let role = 'admin';
const context = {
  auth: async () => ({ ...session, role, employee_id: role === 'employee' ? 'employee-one' : null,
    seller_id: role === 'seller' ? 'seller-one' : null }),
  readState: async () => structuredClone(state),
  now: () => '2026-11-22T13:00:00Z',
  json: (data, status = 200) => Response.json(data, { status }),
  saveState: async (_, next, username, { offlineReceipt }) => {
    assert.equal(username, session.username);
    next.__rev++;
    receipts.set(offlineReceipt.account + ':' + offlineReceipt.id, {
      result: typeof offlineReceipt.result === 'function' ? offlineReceipt.result(next) : offlineReceipt.result,
      request_hash: offlineReceipt.hash
    });
    state = structuredClone(next);
  }
};
const request = (path, payload) => handleOffline(new Request('https://protec.test/api/offline/admin/' + path,
  payload ? { method: 'POST', body: JSON.stringify(payload) } : {}), env, context);

const catalog = await (await request('registration-catalog')).json();
assert.equal(catalog.accountKey, 'admin:1');
assert.equal(catalog.registrationVersion, 8);
assert.equal(catalog.registrationContacts.clients[0].id, 'client-one');
assert(catalog.registrationCatalog.equipment.some(item => item.type === 'Água pressurizada'));

const operation = {
  dataEpoch: 'test', accountKey: 'admin:1', id: 'operation-one', serviceId: 'admin-state',
  deviceId: 'device-one', createdAt: context.now(), kind: 'admin-create',
  payload: {
    serviceId: 'order-0000001', registrationVersion: 8, workshopVersion: 44,
    date: '2026-11-22', serviceType: 'Manutenção',
    clientChoice: 'client-one', sellerChoice: 'seller-one', serviceAmount: '120.50',
    items: [{ type: 'Água pressurizada', kg: '', qty: 1 }],
    plannedParts: [], soldExtinguishers: [], hydrantHoses: [], complementaryServices: []
  }
};
role = 'seller';
assert.equal((await request('registration-catalog')).status, 401);
assert.equal((await request('sync', operation)).status, 401);
role = 'admin';
const bad = structuredClone(operation);
bad.payload.items[0].kg = '30';
assert.equal((await request('sync', bad)).status, 409);
assert.equal(state.services.length, 0);
const result = await (await request('sync', operation)).json();
assert.equal(result.service.id, operation.payload.serviceId);
assert.equal(state.services[0].clientName, 'Cliente teste');
assert.equal(state.services[0].sellerId, 'seller-one');
assert.equal(state.services[0].retailAmount, 120.50);
assert.equal(state.services[0].registeredByRole, 'admin');
assert.equal((await (await request('sync', operation)).json()).duplicate, true);
assert.equal(state.services.length, 1);
assert.equal((await request('sync', { ...operation, payload: { ...operation.payload, serviceAmount: '999' } })).status, 409);
assert.equal((await (await request('sync', { ...operation, dataEpoch: 'old' })).json()).dataReset, true);
console.log('Cadastro móvel de Admin: catálogo, autenticação, validação, registro e reenvio sem duplicação verificados.');

const staffRequest = (path, payload) => handleOffline(new Request('https://protec.test/api/offline/' + path,
  payload ? { method: 'POST', body: JSON.stringify(payload) } : {}), env, context);
for (const staff of ['seller', 'employee']) {
  role = staff;
  const ctx = await (await staffRequest('bootstrap')).json();
  assert.equal(ctx.accountKey, staff + ':' + staff + '-one');
  const order = {
    ...operation,
    accountKey: ctx.accountKey,
    id: 'operation-' + staff,
    serviceId: 'service-' + staff,
    kind: 'create',
    payload: { ...operation.payload, clientChoice: '__self__', sellerChoice: '', serviceAmount: '' }
  };
  const res = await (await staffRequest('sync', order)).json();
  assert.equal(res.service.id, order.serviceId);
  assert.equal(res.service.registeredByRole, role);
  assert.equal(res.service.clientSource, 'creator');
  assert.equal((await (await staffRequest('sync', order)).json()).duplicate, true);
  assert.equal((await staffRequest('sync', { ...order, accountKey: 'admin:1' })).status, 403);
}
assert.equal(state.services.length, 3);
console.log('Cadastro móvel de Funcionário e Vendedor: autoria, separação de perfis e reenvio verificados.');
