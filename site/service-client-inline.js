/* Client registration handoff from the service form, with service draft restore. */
(() => {
  const draftKey = 'fogoseguro_service_client_handoff';

  const style = document.createElement('style');
  style.textContent = `
    .service-client-page-link{display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:4px 0;border:0;background:transparent;color:#1769d1;font-size:12px;font-weight:700;text-align:left}
    .service-client-page-link:hover{text-decoration:underline}
    .service-draft-return{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 18px;padding:14px 16px;border:1px solid #cbdcf2;border-radius:12px;background:#f3f8ff;color:#173b68}
    .service-draft-return p{margin:0;font-size:13px}
    .service-draft-return button{flex:none}
    @media(max-width:620px){.service-draft-return{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);

  function captureServiceDraft() {
    const form = document.getElementById('editForm');
    if (!form) return {};
    const read = name => form.querySelector(`[name="${name}"]`)?.value || '';
    const clientSelect = form.querySelector('[name="clientId"]');
    const clientId = clientSelect?.value === '__create_client__'
      ? clientSelect.dataset.lastClientValue || ''
      : clientSelect?.value || '';
    const rows = [...document.querySelectorAll('#serviceExtRows .service-ext-row')].map(row => ({
      type: row.querySelector('[name="extType"]')?.value || '',
      kg: row.querySelector('[name="extKg"]')?.value || '',
      qty: row.querySelector('[name="extQty"]')?.value || '1'
    }));
    return {
      clientId,
      sellerId: read('sellerId'),
      serviceType: read('serviceType'),
      date: read('date'),
      parts: read('parts'),
      notes: read('notes'),
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
    if (!sessionStorage.getItem(draftKey)) return;
    const host = document.getElementById('content');
    if (!host || document.getElementById('serviceDraftReturn')) return;
    const banner = document.createElement('div');
    banner.id = 'serviceDraftReturn';
    banner.className = 'service-draft-return';
    banner.innerHTML = '<p>Seu serviço está salvo como rascunho enquanto você cadastra o cliente.</p><button type="button" class="btn btn-small">Voltar ao serviço</button>';
    banner.querySelector('button').addEventListener('click', () => window.resumeServiceRegistration());
    host.prepend(banner);
  }

  function openClientRegistration() {
    const body = `<div class="form-grid">
      ${field('Nome / Empresa','name',{required:true})}
      ${field('CPF / CNPJ','document')}
      ${field('Telefone','phone',{type:'tel'})}
      ${field('E-mail','email',{type:'email'})}
      ${field('Endereço','address',{cls:'span2'})}
      ${field('Observações','notes',{cls:'span2'})}
    </div><p class="helper">Depois de salvar, o sistema volta ao serviço e seleciona este cliente automaticamente.</p>`;
    openModal('Cadastrar novo cliente', body, async form => {
      const client = {
        id: id(),
        name: val(form, 'name'),
        document: val(form, 'document'),
        phone: val(form, 'phone'),
        email: val(form, 'email'),
        address: val(form, 'address'),
        notes: val(form, 'notes')
      };
      if (!client.name || client.name.length < 2) {
        toast('Informe o nome do cliente com pelo menos 2 caracteres.');
        return false;
      }
      db.clients ||= [];
      db.clients.push(client);
      if (!await save()) {
        db.clients = db.clients.filter(item => item.id !== client.id);
        saveLocal();
        return false;
      }
      renderPage();
      toast('Cliente cadastrado. Retomando o serviço.');
      return {afterClose: () => window.resumeServiceRegistration(client.id)};
    }, 'Salvar cliente');
  }

  const originalOpenClient = window.openClient;
  window.openClient = function(...args) {
    if (sessionStorage.getItem(draftKey)) return openClientRegistration();
    return originalOpenClient.apply(this, args);
  };

  window.resumeServiceRegistration = function(clientId = '') {
    let draft;
    try { draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); } catch { draft = null; }
    if (!draft) return;
    if (clientId) draft.clientId = clientId;
    sessionStorage.removeItem(draftKey);
    go('services');
    setTimeout(() => window.openService(draft), 60);
  };

  function openClientPageFromService() {
    sessionStorage.setItem(draftKey, JSON.stringify(captureServiceDraft()));
    closeModal();
    go('clients');
    setTimeout(() => {
      showReturnBanner();
      window.openClient();
    }, 60);
  }

  function installClientPageAction() {
    const form = document.getElementById('editForm');
    const clientSelect = form?.querySelector('select[name="clientId"]');
    const clientField = clientSelect?.closest('.form-field');
    if (!form || !clientSelect || !clientField || form.querySelector('.service-client-page-link')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'service-client-page-link';
    button.textContent = '+ Cadastrar cliente';
    button.addEventListener('click', openClientPageFromService);
    clientField.appendChild(button);

    const createClientOption = new Option('+ Cadastrar cliente', '__create_client__');
    clientSelect.add(createClientOption);
    clientSelect.dataset.lastClientValue = clientSelect.value;
    clientSelect.addEventListener('change', () => {
      if (clientSelect.value === '__create_client__') {
        clientSelect.value = clientSelect.dataset.lastClientValue || '';
        openClientPageFromService();
        return;
      }
      clientSelect.dataset.lastClientValue = clientSelect.value;
    });
  }

  const originalOpenService = window.openService;
  window.openService = function(draft, ...args) {
    const result = originalOpenService.apply(this, args);
    installClientPageAction();
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
