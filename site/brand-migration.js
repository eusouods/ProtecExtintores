/* Preserva sessão e dados locais criados antes do rebranding. */
(() => {
  'use strict';
  const legacy = ['fogo', 'seguro'].join('');
  const current = 'protecextintores';
  const suffixes = ['_db_v1', '_session', '_role', '_username', '_customer_session', '_service_contact_handoff'];
  for (const store of [localStorage, sessionStorage]) {
    for (const suffix of suffixes) {
      const oldKey = legacy + suffix;
      const newKey = current + suffix;
      try {
        if (store.getItem(newKey) === null && store.getItem(oldKey) !== null) store.setItem(newKey, store.getItem(oldKey));
      } catch { /* Armazenamento pode estar indisponível em navegação privada. */ }
    }
    try {
      const oldRoute = '__' + legacy + 'PendingRoute';
      const newRoute = '__protecPendingRoute';
      if (store.getItem(newRoute) === null && store.getItem(oldRoute) !== null) store.setItem(newRoute, store.getItem(oldRoute));
    } catch { /* Sem ação necessária. */ }
  }
})();
