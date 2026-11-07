/* Inline customer creation in the service registration dialog. */
(() => {
  const styles = document.createElement('style');
  styles.textContent = `
    .service-client-inline-trigger{margin-top:8px;padding:4px 0;border:0;background:transparent;color:#1769d1;font-size:12px;font-weight:700;text-align:left}
    .service-client-inline-trigger:hover{text-decoration:underline}
    .service-client-inline-panel{grid-column:1/-1;margin:2px 0 14px;padding:16px;border:1px solid #d9e4f2;border-radius:14px;background:#f7faff}
    .service-client-inline-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}
    .service-client-inline-head strong{display:block;font-size:14px}
    .service-client-inline-head p{margin:4px 0 0;color:#68758a;font-size:11px;line-height:1.5}
    .service-client-inline-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}
    .service-client-inline-grid .form-field{margin:8px 0}
    .service-client-inline-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
    @media(max-width:620px){.service-client-inline-grid{grid-template-columns:1fr}.service-client-inline-panel{padding:13px}}
  `;
  document.head.appendChild(styles);

  function getForm() {
    return document.getElementById('editForm');
  }

  function installInlineClientForm() {
    const form = getForm();
    const clientSelect = form?.querySelector('select[name="clientId"]');
    const clientField = clientSelect?.closest('.form-field');
    if (!form || !clientSelect || !clientField || form.querySelector('#serviceClientInlinePanel')) return;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'service-client-inline-trigger';
    trigger.id = 'serviceClientInlineTrigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'serviceClientInlinePanel');
    trigger.textContent = '+ Cadastrar novo cliente';
    trigger.addEventListener('click', toggleInlineClientForm);
    clientField.appendChild(trigger);

    const createClientOption = new Option('+ Cadastrar novo cliente', '__create_client__');
    select.add(createClientOption);
    select.dataset.lastClientValue = select.value;
    select.addEventListener('change', () => {
      if (select.value === '__create_client__') {
        select.value = select.dataset.lastClientValue || '';
        openInlineClientForm();
        return;
      }
      select.dataset.lastClientValue = select.value;
    });

    const panel = document.createElement('section');
    panel.id = 'serviceClientInlinePanel';
    panel.className = 'service-client-inline-panel hidden';
    panel.setAttribute('aria-label', 'Cadastro de novo cliente');
    panel.innerHTML = `
      <div class="service-client-inline-head">
        <div><strong>Novo cliente</strong><p>Cadastre aqui e ele já ficará selecionado nesta ordem de serviço.</p></div>
        <button type="button" class="icon-btn" id="closeServiceClientInline" aria-label="Fechar cadastro">✕</button>
      </div>
      <div class="service-client-inline-grid">
        <div class="form-field"><label for="inlineClientName">Nome / empresa <span aria-hidden="true">*</span></label><input id="inlineClientName" name="inlineClientName" autocomplete="organization" placeholder="Nome do cliente" aria-required="true"></div>
        <div class="form-field"><label for="inlineClientDocument">CPF / CNPJ</label><input id="inlineClientDocument" name="inlineClientDocument" autocomplete="off"></div>
        <div class="form-field"><label for="inlineClientPhone">Telefone</label><input id="inlineClientPhone" name="inlineClientPhone" type="tel" autocomplete="tel" placeholder="(00) 00000-0000"></div>
        <div class="form-field"><label for="inlineClientEmail">E-mail</label><input id="inlineClientEmail" name="inlineClientEmail" type="email" autocomplete="email" placeholder="cliente@exemplo.com"></div>
        <div class="form-field" style="grid-column:1/-1"><label for="inlineClientAddress">Endereço</label><input id="inlineClientAddress" name="inlineClientAddress" autocomplete="street-address"></div>
        <div class="form-field" style="grid-column:1/-1"><label for="inlineClientNotes">Observações</label><textarea id="inlineClientNotes" name="inlineClientNotes" rows="2"></textarea></div>
      </div>
      <div class="service-client-inline-actions">
        <button type="button" class="btn btn-small" id="saveServiceClientInline">Salvar cliente e selecionar</button>
      </div>`;

    const sellerField = form.querySelector('[name="sellerId"]')?.closest('.form-field');
    (sellerField || clientField).insertAdjacentElement('afterend', panel);
    panel.querySelector('#closeServiceClientInline').addEventListener('click', toggleInlineClientForm);
    panel.querySelector('#saveServiceClientInline').addEventListener('click', saveInlineClient);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        saveInlineClient();
      }
    });
  }

  function toggleInlineClientForm() {
    const panel = document.getElementById('serviceClientInlinePanel');
    const trigger = document.getElementById('serviceClientInlineTrigger');
    if (!panel || !trigger) return;
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    trigger.setAttribute('aria-expanded', String(opening));
    if (opening) panel.querySelector('#inlineClientName')?.focus();
  }

  function openInlineClientForm() {
    const panel = document.getElementById('serviceClientInlinePanel');
    const trigger = document.getElementById('serviceClientInlineTrigger');
    if (!panel || !trigger) return;
    panel.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    panel.querySelector('#inlineClientName')?.focus();
  }

  async function saveInlineClient() {
    const form = getForm();
    const panel = document.getElementById('serviceClientInlinePanel');
    const select = form?.querySelector('select[name="clientId"]');
    if (!form || !panel || !select) return;

    const read = name => panel.querySelector(`[name="${name}"]`)?.value.trim() || '';
    const name = read('inlineClientName');
    if (name.length < 2) {
      toast('Informe o nome do cliente com pelo menos 2 caracteres.');
      panel.querySelector('#inlineClientName')?.focus();
      return;
    }

    const previousClients = [...(db.clients || [])];
    const client = {
      id: id(),
      name,
      document: read('inlineClientDocument'),
      phone: read('inlineClientPhone'),
      email: read('inlineClientEmail'),
      address: read('inlineClientAddress'),
      notes: read('inlineClientNotes')
    };
    db.clients ||= [];
    db.clients.push(client);

    const saveButton = panel.querySelector('#saveServiceClientInline');
    saveButton.disabled = true;
    saveButton.textContent = 'Salvando…';
    try {
      const saved = await save();
      if (!saved) {
        db.clients = previousClients;
        saveLocal();
        return;
      }
      let option = [...select.options].find(item => item.value === client.id);
      if (!option) {
        option = new Option(client.name, client.id);
        select.add(option);
      }
      select.value = client.id;
      select.dataset.lastClientValue = client.id;
      panel.querySelectorAll('input,textarea').forEach(input => { input.value = ''; });
      panel.classList.add('hidden');
      document.getElementById('serviceClientInlineTrigger')?.setAttribute('aria-expanded', 'false');
      toast('Cliente cadastrado e selecionado para este serviço.');
    } catch (error) {
      db.clients = previousClients;
      saveLocal();
      toast(error.message || 'Não foi possível cadastrar o cliente.');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Salvar cliente e selecionar';
    }
  }

  const originalOpenService = window.openService;
  window.openService = function(...args) {
    const result = originalOpenService.apply(this, args);
    installInlineClientForm();
    return result;
  };
})();
