/* Ajustes de clareza, acessibilidade e confirmação de pedidos. */
(() => {
  const makeId = () => window.crypto?.randomUUID?.() || `fs-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = './professional-updates.css?v=2';
  document.head.append(style);

  const loginNote = document.querySelector('.login-note');
  if (loginNote) {
    loginNote.textContent = 'Use o usuário e a senha fornecidos pelo administrador da empresa.';
  }

  const requestForm = document.querySelector('form[onsubmit="submitMaintenanceRequest(event)"]');
  if (requestForm) {
    const phone = requestForm.elements.phone;
    if (phone) {
      phone.type = 'tel';
      phone.autocomplete = 'tel';
      phone.inputMode = 'tel';
      phone.setAttribute('aria-label', 'Telefone ou WhatsApp com DDD');
    }
    const note = document.createElement('p');
    note.className = 'privacy-inline-note';
    note.textContent = 'Usaremos esses dados para responder a esta solicitação. Informe apenas o necessário e não envie dados pessoais sensíveis.';
    requestForm.insertBefore(note, requestForm.querySelector('button[type="submit"], button:not([type])'));
    const result = document.getElementById('maintenanceRequestResult');
    if (result) result.setAttribute('aria-live', 'polite');
  }

  const productHost = document.getElementById('publicProducts');
  if (productHost) {
    const describeImages = () => productHost.querySelectorAll('.product-image img:not([alt])').forEach(img => {
      img.alt = img.closest('.product')?.querySelector('h3')?.textContent?.trim() || 'Imagem do produto';
      img.loading = 'lazy';
    });
    new MutationObserver(describeImages).observe(productHost, {childList: true, subtree: true});
    describeImages();
  }

  const faq = document.querySelectorAll('#perguntas details');
  faq.forEach(item => {
    const question = item.querySelector('summary')?.textContent || '';
    const answer = item.querySelector('p');
    if (!answer) return;
    if (question.includes('De quanto em quanto tempo')) {
      answer.textContent = 'A periodicidade depende do tipo de extintor, do fabricante, das condições de uso e das regras técnicas aplicáveis. Confira a etiqueta e a documentação do equipamento e peça uma avaliação de profissional habilitado para confirmar o serviço e o prazo adequados.';
    } else if (question.includes('O que acontece se o extintor vencer')) {
      answer.textContent = 'Um equipamento fora do prazo indicado deve ser avaliado antes de voltar a ser considerado pronto para uso. A equipe pode verificar a etiqueta, as condições do extintor e as exigências aplicáveis ao local e orientar sobre os próximos passos.';
    }
  });

  document.querySelectorAll('.live-dot').forEach(dot => {
    dot.hidden = true;
    dot.setAttribute('aria-hidden', 'true');
  });

  const staffRoot = document.getElementById('employeePortal');
  if (staffRoot) {
    let cardObserver;
    const addServiceSearch = () => {
      const host = staffRoot.querySelector('#employeeCards');
      if (!host) return;
      if (!staffRoot.querySelector('#employeeServiceSearch')) {
        const label = document.createElement('label');
        label.className = 'employee-service-search';
        label.htmlFor = 'employeeServiceSearch';
        label.textContent = 'Buscar serviço por código, cliente ou tipo de extintor';
        const input = document.createElement('input');
        input.id = 'employeeServiceSearch';
        input.type = 'search';
        input.autocomplete = 'off';
        input.placeholder = 'Ex.: FS-A1B2C3 ou empresa';
        label.append(input);
        host.before(label);
        const empty = document.createElement('p');
        empty.className = 'employee-search-empty';
        empty.hidden = true;
        empty.setAttribute('role', 'status');
        empty.textContent = 'Nenhum serviço corresponde à busca.';
        host.after(empty);
        input.addEventListener('input', () => filterServices(input.value, host, empty));
      }
      if (!cardObserver) {
        const input = staffRoot.querySelector('#employeeServiceSearch');
        const empty = staffRoot.querySelector('.employee-search-empty');
        cardObserver = new MutationObserver(() => filterServices(input.value, host, empty));
        cardObserver.observe(host, {childList: true});
      }
    };
    const filterServices = (query, host, empty) => {
      const needle = String(query || '').trim().toLocaleLowerCase('pt-BR');
      let visible = 0;
      host.querySelectorAll('.employee-service').forEach(card => {
        const match = !needle || card.textContent.toLocaleLowerCase('pt-BR').includes(needle);
        card.hidden = !match;
        if (match) visible++;
      });
      if (empty) empty.hidden = !needle || visible > 0;
    };
    new MutationObserver(addServiceSearch).observe(staffRoot, {childList: true, subtree: true});
  }

  window.submitMaintenanceRequest = async function(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = document.getElementById('maintenanceRequestResult');
    const submit = form.querySelector('button[type="submit"], button:not([type])');
    const originalLabel = submit?.textContent || '';
    const setMessage = (title, message, isError = false) => {
      if (!result) return;
      result.replaceChildren();
      const card = document.createElement('div');
      card.className = 'tracking-card request-result' + (isError ? ' request-result-error' : '');
      const heading = document.createElement('h4');
      heading.textContent = title;
      const paragraph = document.createElement('p');
      paragraph.textContent = message;
      card.append(heading, paragraph);
      result.append(card);
    };

    if (typeof API_ENABLED === 'undefined' || !API_ENABLED) {
      setMessage('Solicitação não enviada', 'O site ainda não está conectado ao sistema de pedidos. Seus dados foram mantidos no formulário. Entre em contato pelos canais informados no rodapé.', true);
      return;
    }

    const data = new FormData(form);
    const quantity = Math.max(1, Math.min(100, Number(data.get('quantity')) || 1));
    const code = 'FS-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const now = new Date().toISOString();
    const name = String(data.get('name') || '').trim();
    const items = Array.from({length: quantity}, () => ({
      serial: '', type: 'Conforme descrição do cliente', status: 'Solicitado',
      history: [{status: 'Solicitado', at: now}]
    }));
    const service = {
      id: makeId(), code, clientName: name, date: now.slice(0, 10),
      serviceType: 'Solicitação de manutenção', employeeName: 'A designar',
      maintenanceValid: '', items, serial: '', type: 'A identificar'
    };
    const order = {
      id: makeId(), code, kind: 'Manutenção', name,
      phone: String(data.get('phone') || '').trim(),
      email: String(data.get('email') || '').trim(),
      details: String(data.get('details') || '').trim(),
      items: items.map((_, index) => ({name: 'Extintor ' + (index + 1), qty: 1})),
      status: 'Solicitado · aguardando análise', createdAt: now
    };

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Enviando solicitação…';
    }
    if (result) result.replaceChildren();
    try {
      const response = await window.apiCall('/api/public/orders', 'POST', {order, service});
      const payload = await window.apiJson(response);
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar o pedido.');

      form.reset();
      const message = document.createElement('p');
      message.textContent = 'Seu código de acompanhamento é ';
      const codeLabel = document.createElement('strong');
      codeLabel.textContent = code;
      message.append(codeLabel, document.createTextNode('. Guarde este código para consultar o andamento.'));
      setMessage('Solicitação recebida', 'A equipe entrará em contato para confirmar escopo, orçamento e agendamento. O envio não agenda nem cobra o serviço.');
      result?.querySelector('.request-result p')?.replaceWith(message);
      const track = document.getElementById('trackCode');
      if (track) track.value = code;
      window.toast?.('Solicitação registrada');
    } catch (error) {
      setMessage('Não foi possível confirmar o envio', (error?.message || 'Verifique sua conexão e tente novamente. Seus dados continuam no formulário.'), true);
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    }
  };
})();
