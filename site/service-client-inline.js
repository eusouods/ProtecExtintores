/* Register a client or seller from a service, then restore the service draft. */
(() => {
  const draftKey = 'protecextintores_service_contact_handoff';

  const style = document.createElement('style');
  style.textContent = `
    .service-draft-return{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px;padding:14px 16px;border:1px solid var(--ui-border,#c8d8e3);border-radius:12px;background:var(--ui-raised,#e0eaf2);color:var(--ui-text,#193142)}
    .service-draft-return p{margin:0;font-size:13px}
    .service-draft-return button{flex:none}
    @media(max-width:620px){.service-draft-return{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  function readDraft() {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || 'null'); }
    catch { return null; }
  }

  function captureServiceDraft(contactType) {
    const form = document.getElementById('editForm');
    if (!form) return {contactType};
    const read = name => form.querySelector(`[name="${name}"]`)?.value || '';
    const clientSelect = form.querySelector('[name="clientId"]');
    const sellerSelect = form.querySelector('[name="sellerId"]');
    const rows = [...document.querySelectorAll('#serviceExtRows .service-ext-row')].map(row => ({
      type: row.querySelector('[name="extType"]')?.value || '',
      kg: row.querySelector('[name="extKg"]')?.value || '',
      qty: row.querySelector('[name="extQty"]')?.value || '1'
    }));
    return {
      contactType,
      clientId: clientSelect?.value === '__create_client__' ? clientSelect.dataset.lastClientValue || '' : clientSelect?.value || '',
      sellerId: sellerSelect?.value === '__create_seller__' ? sellerSelect.dataset.lastSellerValue || '' : sellerSelect?.value || '',
      serviceType: read('serviceType'),
      date: read('date'),
      parts: read('parts'),
      notes: read('notes'),
      extraServicesDraft: window.captureServiceExtrasDraft?.() || null,
      rows
    };
  }

  function restoreServiceDraft(draft) {
    const form = document.getElementById('editForm');
    if (!form || !draft) return;
    for (const name of ['clientId', 'sellerId', 'serviceType', 'date', 'parts', 'notes']) {
      const control = form.querySelector(`[name="${name}"]`);
      if (control && draft[name] != null) control.value = draft[name];
    }
    const host = document.getElementById('serviceExtRows');
    if (!host) return;
    host.replaceChildren();
    const rows = Array.isArray(draft.rows) ? draft.rows : [];
    if (rows.length) rows.forEach(row => addServiceExtRow(row.type || '', row.kg || '', row.qty || 1));
    else addServiceExtRow();
    refreshServicePrice();
  }

  function showReturnBanner() {
    if (!readDraft()) return;
    const host = document.getElementById('content');
    if (!host || document.getElementById('serviceContactDraftReturn')) return;
    const banner = document.createElement('div');
    banner.id = 'serviceContactDraftReturn';
    banner.className = 'service-draft-return';
    banner.innerHTML = '<p>O serviço está salvo como rascunho enquanto você cadastra o contato.</p><button type="button" class="btn btn-small">Voltar ao serviço</button>';
    banner.querySelector('button').addEventListener('click', () => window.resumeServiceRegistration());
    host.prepend(banner);
  }

  function openContactRegistration(kind) {
    const isClient = kind === 'client';
    const collection = isClient ? 'clients' : 'sellers';
    const body = isClient
      ? `<div class="form-grid">
          ${field('Nome / Empresa','name',{required:true})}
          ${field('CPF / CNPJ','document')}
          ${field('Telefone','phone',{type:'tel'})}
          ${field('E-mail','email',{type:'email'})}
          ${field('Endereço','address',{cls:'span2'})}
          ${field('Observações','notes',{cls:'span2'})}
        </div><p class="helper">O cliente será salvo em Clientes e vendedores. Depois, o serviço será retomado com ele selecionado.</p>`
      : `<div class="form-grid">
          ${field('Nome completo','name',{required:true})}
          ${field('Telefone / WhatsApp','phone',{type:'tel'})}
          ${field('E-mail','email',{type:'email'})}
        </div><p class="helper">O vendedor será salvo em Clientes e vendedores. Depois, o serviço será retomado com ele selecionado.</p>`;

    openModal(isClient ? 'Cadastrar novo cliente' : 'Cadastrar novo vendedor', body, async form => {
      const contact = {
        id: id(),
        name: val(form, 'name'),
        phone: val(form, 'phone'),
        email: val(form, 'email')
      };
      if (isClient) {
        contact.document = val(form, 'document');
        contact.address = val(form, 'address');
        contact.notes = val(form, 'notes');
      }
      if (!contact.name || contact.name.length < 2) {
        toast('Informe o nome com pelo menos 2 caracteres.');
        return false;
      }

      db[collection] ||= [];
      db[collection].push(contact);
      if (!await save()) {
        db[collection] = db[collection].filter(item => item.id !== contact.id);
        saveLocal();
        return false;
      }
      renderPage();
      toast(isClient ? 'Cliente cadastrado. Retomando o serviço.' : 'Vendedor cadastrado. Retomando o serviço.');
      return {afterClose: () => window.resumeServiceRegistration(isClient ? contact.id : '', isClient ? '' : contact.id)};
    }, isClient ? 'Salvar cliente' : 'Salvar vendedor');
  }

  const originalOpenClient = window.openClient;
  window.openClient = function(...args) {
    if (readDraft()?.contactType === 'client') return openContactRegistration('client');
    return originalOpenClient.apply(this, args);
  };

  const originalOpenSeller = window.openSeller;
  window.openSeller = function(...args) {
    if (readDraft()?.contactType === 'seller') return openContactRegistration('seller');
    return originalOpenSeller.apply(this, args);
  };

  window.resumeServiceRegistration = function(clientId = '', sellerId = '') {
    const draft = readDraft();
    if (!draft) return;
    if (clientId) draft.clientId = clientId;
    if (sellerId) draft.sellerId = sellerId;
    sessionStorage.removeItem(draftKey);
    go('services');
    setTimeout(() => window.openService(draft), 60);
  };

  function openContactPageFromService(kind) {
    sessionStorage.setItem(draftKey, JSON.stringify(captureServiceDraft(kind)));
    closeModal();
    go('clients');
    setTimeout(() => {
      showReturnBanner();
      if (kind === 'seller') window.openSeller();
      else window.openClient();
    }, 60);
  }

  function installContactOptions() {
    const form = document.getElementById('editForm');
    const clientSelect = form?.querySelector('select[name="clientId"]');
    const sellerSelect = form?.querySelector('select[name="sellerId"]');
    if (!form) return;

    if (clientSelect && ![...clientSelect.options].some(option => option.value === '__create_client__')) {
      clientSelect.add(new Option('+ Cadastrar cliente', '__create_client__'));
      clientSelect.dataset.lastClientValue = clientSelect.value;
      clientSelect.addEventListener('change', () => {
        if (clientSelect.value === '__create_client__') {
          clientSelect.value = clientSelect.dataset.lastClientValue || '';
          openContactPageFromService('client');
          return;
        }
        clientSelect.dataset.lastClientValue = clientSelect.value;
      });
    }

    if (sellerSelect && ![...sellerSelect.options].some(option => option.value === '__create_seller__')) {
      sellerSelect.add(new Option('+ Cadastrar vendedor', '__create_seller__'));
      sellerSelect.dataset.lastSellerValue = sellerSelect.value;
      sellerSelect.addEventListener('change', () => {
        if (sellerSelect.value === '__create_seller__') {
          sellerSelect.value = sellerSelect.dataset.lastSellerValue || '';
          openContactPageFromService('seller');
          return;
        }
        sellerSelect.dataset.lastSellerValue = sellerSelect.value;
      });
    }
  }

  const originalOpenService = window.openService;
  window.openService = function(draft, ...args) {
    const result = originalOpenService.apply(this, args);
    installContactOptions();
    if (draft && typeof draft === 'object') restoreServiceDraft(draft);
    return result;
  };

  const originalGo = window.go;
  window.go = function(target, ...args) {
    const result = originalGo.call(this, target, ...args);
    if (target === 'clients') setTimeout(showReturnBanner, 0);
    return result;
  };
})();
