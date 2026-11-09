/* Optional fire-safety work attached to a service order. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .service-extra-section{grid-column:1/-1;margin:8px 0 18px;padding:16px;border:1px solid #dce4f7;border-radius:14px;background:#fbfcff}
    .service-extra-section>h3{margin:0 0 5px;font-size:14px}
    .service-extra-section>.helper{margin:0 0 12px}
    .service-extra-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .service-extra-card{min-width:0;padding:12px;border:1px solid #dce4f7;border-radius:11px;background:#fff}
    .service-extra-choice{display:flex;align-items:flex-start;gap:9px;cursor:pointer;font-size:12px;font-weight:700}
    .service-extra-choice input{width:17px;height:17px;flex:none;margin:1px 0 0;accent-color:#0131cd}
    .service-extra-choice span{display:grid;gap:3px}
    .service-extra-choice small{color:#83746f;font-size:10px;font-weight:400;line-height:1.4}
    .service-extra-details{padding-top:10px}
    .service-extra-details .form-field{margin:8px 0}
    .service-extra-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 10px}
    .service-extra-line{display:grid;grid-template-columns:repeat(4,minmax(72px,1fr)) auto;align-items:end;gap:8px;margin:0 0 9px}
    .service-extra-line .form-field{min-width:0;margin:0}
    .service-extra-line .form-field label{font-size:10px}
    .service-extra-remove{min-height:38px;padding:7px 11px;border:1px solid #fecaca;border-radius:9px;background:#fff7f7;color:#b42318;font-weight:700;white-space:nowrap}
    .service-extra-add{margin-top:4px}
    @media(max-width:680px){.service-extra-grid{grid-template-columns:1fr}.service-extra-line{grid-template-columns:repeat(2,minmax(0,1fr))}.service-extra-remove{grid-column:1/-1;width:100%}}
  `;
  document.head.appendChild(style);

  const panelMarkup = `
    <h3>Serviços complementares (opcionais)</h3>
    <p class="helper">Marque somente o que será realizado. Medidas de mangueiras aceitam valores personalizados.</p>
    <div class="service-extra-grid">
      <article class="service-extra-card" data-extra-card="hydrant-hose-test">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Testar mangueira de hidrante<small>Informe o tipo ou classe, diâmetro e comprimento. As medidas aceitam qualquer valor.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="hydrant-hose-test"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar mangueira</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="demarcation">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Aplicar faixa de demarcação<small>Registre cor e medidas para execução.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Cor</label><select data-field="color"><option value="Amarela">Amarela</option><option value="Vermelha">Vermelha</option><option value="Branca">Branca</option><option value="Outra">Outra</option></select></div>
          <div class="form-field hidden" data-other-color><label>Informe a cor</label><input data-field="otherColor" type="text"></div>
          <div class="form-field"><label>Comprimento (m)</label><input data-field="lengthMeters" type="number" min="0.1" step="any" placeholder="Metros"></div>
          <div class="form-field"><label>Largura (cm), se aplicável</label><input data-field="widthCm" type="number" min="0.1" step="any" placeholder="Centímetros"></div>
        </div><div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div></div>
      </article>
      <article class="service-extra-card" data-extra-card="wall-support">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar suporte de parede</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="floor-stand">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar suporte de piso</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="extinguisher-hose">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar mangueira de extintor<small>Adicione uma ou mais mangueiras por agente.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="extinguisher-hose"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar mangueira</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="diffuser">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar difusor de extintor<small>Adicione um ou mais tipos.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="diffuser"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar difusor</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="hydrant-cabinet">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar ou instalar abrigo de hidrante</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="safety-signage">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar placas de sinalização<small>Saídas, extintores, hidrantes, alarmes e placas personalizadas.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="safety-signage"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar placa</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="pressure-gauge">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar manômetro</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="valve">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar ou revisar válvula</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Tipo / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="hydrant-accessories">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar acessório de hidrante<small>Esguicho, adaptador, chave ou tampão Storz.</small></span></label>
        <div class="service-extra-details hidden" data-extra-details><div data-extra-list="hydrant-accessories"></div><button type="button" class="btn btn-soft btn-small service-extra-add" data-extra-add>＋ Adicionar acessório</button></div>
      </article>
      <article class="service-extra-card" data-extra-card="extinguisher-wheels">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar rodas / carrinho para extintor</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="emergency-light">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Adicionar iluminação de emergência</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
          <div class="form-field"><label>Local / observações</label><input data-field="notes" type="text"></div>
        </div></div>
      </article>
      <article class="service-extra-card" data-extra-card="other-work">
        <label class="service-extra-choice"><input type="checkbox" data-extra-toggle><span>Outro serviço complementar</span></label>
        <div class="service-extra-details hidden" data-extra-details><div class="service-extra-fields">
          <div class="form-field"><label>Descreva o serviço</label><input data-field="description" type="text"></div>
          <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
        </div></div>
      </article>
    </div>`;

  function hydrantLine() {
    return `<div class="service-extra-line" data-extra-line>
      <div class="form-field"><label>Tipo / modelo</label><input data-field="type" type="text" placeholder="Conforme identificação da mangueira"></div>
      <div class="form-field"><label>Diâmetro (mm)</label><input data-field="diameterMm" type="number" min="0.1" step="any" placeholder="mm"></div>
      <div class="form-field"><label>Comprimento (m)</label><input data-field="lengthMeters" type="number" min="0.1" step="any" placeholder="m"></div>
      <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
      <button type="button" class="service-extra-remove" data-remove-line aria-label="Remover mangueira de hidrante">Remover mangueira</button>
    </div>`;
  }

  function selectLine(kind) {
    const isHose = kind === 'extinguisher-hose';
    const isHydrantAccessory = kind === 'hydrant-accessories';
    const isSignage = kind === 'safety-signage';
    const options = isSignage
      ? [['','Selecione a placa'],['Saída','Saída'],['Saída de emergência','Saída de emergência'],['Rota de fuga','Rota de fuga'],['Extintor de incêndio','Extintor de incêndio'],['Extintor de pó químico ABC','Extintor de pó químico ABC'],['Extintor de pó químico BC','Extintor de pó químico BC'],['Extintor de CO₂','Extintor de CO₂'],['Extintor de água','Extintor de água'],['Hidrante','Hidrante'],['Alarme de incêndio','Alarme de incêndio'],['Acionador manual','Acionador manual'],['Ponto de encontro','Ponto de encontro'],['Proibido fumar','Proibido fumar'],['Não utilize elevador','Não utilize elevador'],['Porta corta-fogo','Porta corta-fogo'],['Risco elétrico','Risco elétrico'],['Outra','Outra']]
      : isHydrantAccessory
      ? [['','Selecione o acessório'],['Esguicho regulável','Esguicho regulável'],['Esguicho jato sólido','Esguicho jato sólido'],['Adaptador Storz','Adaptador Storz'],['Chave Storz','Chave Storz'],['Tampão Storz','Tampão Storz'],['Outro','Outro']]
      : isHose
      ? [['','Selecione o agente'],['Pó químico ABC','Pó químico ABC'],['Pó químico BC','Pó químico BC'],['Água pressurizada','Água pressurizada'],['CO₂','CO₂'],['Outro','Outro']]
      : [['','Selecione o tipo'],['Pó químico ABC/BC','Pó químico ABC/BC'],['Água','Água'],['CO₂','CO₂'],['Outro','Outro']];
    const label = isSignage ? 'Placa' : isHydrantAccessory ? 'Acessório' : isHose ? 'Mangueira' : 'Difusor';
    return `<div class="service-extra-line" data-extra-line>
      <div class="form-field"><label>${label}</label><select data-field="type">${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></div>
      <div class="form-field hidden" data-other-type><label>Informe o tipo</label><input data-field="otherType" type="text"></div>
      <div class="form-field"><label>Quantidade</label><input data-field="quantity" type="number" min="1" step="1" value="1"></div>
      ${isSignage ? '<div class="form-field"><label>Local de instalação</label><input data-field="location" type="text" placeholder="Ex.: corredor, recepção"></div>' : ''}
      <button type="button" class="service-extra-remove" data-remove-line aria-label="Remover ${label.toLocaleLowerCase('pt-BR')}">Remover ${label.toLocaleLowerCase('pt-BR')}</button>
    </div>`;
  }

  function addLine(card, kind) {
    const list = card.querySelector(`[data-extra-list="${kind}"]`);
    if (!list) return;
    const holder = document.createElement('div');
    holder.innerHTML = kind === 'hydrant-hose-test' ? hydrantLine() : selectLine(kind);
    const line = holder.firstElementChild;
    line.querySelector('[data-remove-line]').addEventListener('click', () => {
      line.remove();
      if (!list.querySelector('[data-extra-line]')) {
        const toggle = card.querySelector('[data-extra-toggle]');
        if (toggle?.checked) { toggle.checked = false; toggle.dispatchEvent(new Event('change', {bubbles:true})); }
      }
      window.refreshServicePrice();
    });
    line.querySelector('[data-field="type"]')?.addEventListener('change', event => {
      const other = line.querySelector('[data-other-type]');
      if (other) other.classList.toggle('hidden', event.target.value !== 'Outro');
    });
    list.appendChild(line);
  }

  function addAmountFields(section) {
    section.querySelectorAll('[data-extra-card]').forEach(card => {
      const details = card.querySelector('[data-extra-details]');
      if (!details || details.querySelector('[data-field="amount"]')) return;
      const field = document.createElement('div');
      field.className = 'form-field';
      field.innerHTML = '<label>Valor total adicional (R$), se aplicável</label><input data-field="amount" type="number" min="0" step="0.01" value="0">';
      details.appendChild(field);
    });
  }

  function install(form) {
    if (!form || form.querySelector('.service-extra-section')) return;
    const section = document.createElement('section');
    section.className = 'form-field span2 service-extra-section';
    section.innerHTML = panelMarkup;
    addAmountFields(section);
    const serviceTypeField = form.querySelector('[name="serviceType"]')?.closest('.form-field');
    const rows = form.querySelector('#serviceExtRows')?.closest('.form-field');
    (rows || serviceTypeField || form.querySelector('.form-grid')).insertAdjacentElement(rows ? 'afterend' : 'beforebegin', section);

    section.querySelectorAll('[data-extra-card]').forEach(card => {
      const toggle = card.querySelector('[data-extra-toggle]');
      const details = card.querySelector('[data-extra-details]');
      const kind = card.dataset.extraCard;
      toggle.addEventListener('change', () => {
        details.classList.toggle('hidden', !toggle.checked);
        if (toggle.checked && ['hydrant-hose-test','extinguisher-hose','diffuser','hydrant-accessories','safety-signage'].includes(kind) && !card.querySelector('[data-extra-line]')) addLine(card, kind);
      });
      card.querySelector('[data-extra-add]')?.addEventListener('click', () => addLine(card, kind));
      card.querySelector('[data-field="color"]')?.addEventListener('change', event => {
        card.querySelector('[data-other-color]')?.classList.toggle('hidden', event.target.value !== 'Outra');
      });
    });
    section.addEventListener('input', event => { if (event.target.matches('[data-field="amount"]')) window.refreshServicePrice(); });
    section.addEventListener('change', event => { if (event.target.matches('[data-extra-toggle]')) window.refreshServicePrice(); });
    window.refreshServicePrice();
    bindSubmit(form);
  }

  function readNumber(card, field) {
    return Number(card.querySelector(`[data-field="${field}"]`)?.value || 0);
  }

  function collectExtras(form) {
    const items = [];
    for (const card of form.querySelectorAll('[data-extra-card]')) {
      if (!card.querySelector('[data-extra-toggle]')?.checked) continue;
      const code = card.dataset.extraCard;
      const val = name => card.querySelector(`[data-field="${name}"]`)?.value.trim() || '';
      const positiveQty = () => Math.max(1, Math.floor(readNumber(card, 'quantity') || 1));
      const price = Math.max(0,readNumber(card,'amount'));
      if (code === 'hydrant-hose-test') {
        const lines = [...card.querySelectorAll('[data-extra-line]')].map(line => ({
          type: line.querySelector('[data-field="type"]')?.value.trim() || '',
          diameterMm: Number(line.querySelector('[data-field="diameterMm"]')?.value || 0),
          lengthMeters: Number(line.querySelector('[data-field="lengthMeters"]')?.value || 0),
          quantity: Math.max(1, Math.floor(Number(line.querySelector('[data-field="quantity"]')?.value || 1)))
        }));
        if (!lines.length || lines.some(line => !line.type || line.diameterMm <= 0 || line.lengthMeters <= 0)) return {items,error:'Informe tipo, diâmetro e comprimento de cada mangueira de hidrante.'};
        items.push({code,title:'Teste de mangueira de hidrante',lines,price});
      } else if (code === 'extinguisher-hose' || code === 'diffuser' || code === 'hydrant-accessories' || code === 'safety-signage') {
        const lines = [...card.querySelectorAll('[data-extra-line]')].map(line => ({
          type: line.querySelector('[data-field="type"]')?.value || '',
          otherType: line.querySelector('[data-field="otherType"]')?.value.trim() || '',
          location: line.querySelector('[data-field="location"]')?.value.trim() || '',
          quantity: Math.max(1, Math.floor(Number(line.querySelector('[data-field="quantity"]')?.value || 1)))
        }));
        const label = code === 'safety-signage' ? 'placa' : code === 'diffuser' ? 'difusor' : code === 'hydrant-accessories' ? 'acessório' : 'mangueira';
        if (!lines.length || lines.some(line => !line.type || (line.type === 'Outro' && !line.otherType))) return {items,error:`Selecione o tipo de ${label} ou informe o tipo personalizado.`};
        const title = code === 'safety-signage' ? 'Placa de sinalização' : code === 'diffuser' ? 'Difusor de extintor' : code === 'hydrant-accessories' ? 'Acessório de hidrante' : 'Mangueira de extintor';
        items.push({code,title,lines,price});
      } else if (code === 'demarcation') {
        const lengthMeters = readNumber(card, 'lengthMeters');
        if (lengthMeters <= 0) return {items,error:'Informe o comprimento da faixa de demarcação.'};
        const color = val('color') === 'Outra' ? val('otherColor') : val('color');
        if (!color) return {items,error:'Informe a cor da faixa de demarcação.'};
        items.push({code,title:'Faixa de demarcação',details:{color,lengthMeters,widthCm:readNumber(card,'widthCm')||'',notes:val('notes')},price});
      } else if (code === 'other-work') {
        if (val('description').length < 2) return {items,error:'Descreva o outro serviço complementar.'};
        items.push({code,title:val('description'),quantity:positiveQty(),price});
      } else {
        const titleMap={'wall-support':'Suporte de parede','floor-stand':'Suporte de piso','hydrant-cabinet':'Abrigo de hidrante','safety-signage':'Placa de sinalização','pressure-gauge':'Manômetro','valve':'Válvula','extinguisher-wheels':'Rodas / carrinho de extintor','emergency-light':'Iluminação de emergência'};
        items.push({code,title:titleMap[code]||'Serviço complementar',quantity:positiveQty(),details:{notes:val('notes')},price});
      }
    }
    return {items,error:''};
  }

  function bindSubmit(form) {
    if (form.dataset.extraServicesBound) return;
    const originalSubmit = form.onsubmit;
    if (typeof originalSubmit !== 'function') return;
    form.dataset.extraServicesBound = 'true';
    form.onsubmit = async function(event) {
      const result = collectExtras(form);
      if (result.error) {
        event.preventDefault();
        toast(result.error);
        return false;
      }
      const serviceList = db.services;
      const originalPush = serviceList.push;
      serviceList.push = function(...services) {
        const extrasTotal = result.items.reduce((sum,item)=>sum+Number(item.price||0),0);
        services.forEach(service => {
          if (service && typeof service === 'object') {
            service.extraServices = result.items;
            service.price = Math.round((Number(service.price||0)+extrasTotal)*100)/100;
          }
        });
        return originalPush.apply(this, services);
      };
      try { return await originalSubmit.call(this, event); }
      finally { serviceList.push = originalPush; }
    };
  }

  window.captureServiceExtrasDraft = function() {
    const form = document.getElementById('editForm');
    const section = form?.querySelector('.service-extra-section');
    if (!section) return null;
    return [...section.querySelectorAll('[data-extra-card]')].map(card => ({
      code:card.dataset.extraCard,
      checked:Boolean(card.querySelector('[data-extra-toggle]')?.checked),
      values:[...card.querySelectorAll('[data-field]')].map(field => ({
        key:field.dataset.field,
        value:field.value,
        line:field.closest('[data-extra-line]')?.sectionIndex ?? [...card.querySelectorAll('[data-extra-line]')].indexOf(field.closest('[data-extra-line]'))
      }))
    }));
  };

  const originalRefreshServicePrice = window.refreshServicePrice;
  window.refreshServicePrice = function(...args) {
    const result = originalRefreshServicePrice.apply(this,args);
    const form = document.getElementById('editForm');
    const section = form?.querySelector('.service-extra-section');
    if (!section) return result;
    const extraTotal = [...section.querySelectorAll('[data-extra-card]')].reduce((sum,card) => {
      if (!card.querySelector('[data-extra-toggle]')?.checked) return sum;
      return sum + Math.max(0,Number(card.querySelector('[data-field="amount"]')?.value||0));
    },0);
    const input = form.querySelector('[name="price"]');
    const display = form.querySelector('#serviceTotal');
    const total = (Number(input?.value||0)+extraTotal);
    if (input) input.value = total.toFixed(2);
    if (display) display.textContent = money(total);
    return result;
  };

  window.restoreServiceExtrasDraft = function(draft) {
    const form = document.getElementById('editForm');
    const section = form?.querySelector('.service-extra-section');
    if (!section || !Array.isArray(draft)) return;
    for (const savedCard of draft) {
      const card = section.querySelector(`[data-extra-card="${savedCard.code}"]`);
      if (!card) continue;
      const toggle = card.querySelector('[data-extra-toggle]');
      if (toggle) { toggle.checked = Boolean(savedCard.checked); toggle.dispatchEvent(new Event('change')); }
      const lineValues = new Map();
      for (const item of savedCard.values || []) {
        const index = Number(item.line);
        if (Number.isInteger(index) && index >= 0) {
          if (!lineValues.has(index)) lineValues.set(index, []);
          lineValues.get(index).push(item);
        } else {
          const field = [...card.querySelectorAll('[data-field]')].find(element => element.dataset.field === item.key && !element.closest('[data-extra-line]'));
          if (field) field.value = item.value;
        }
      }
      for (const [index, values] of lineValues) {
        let lines = [...card.querySelectorAll('[data-extra-line]')];
        const kind = card.dataset.extraCard;
        while (lines.length <= index) { addLine(card, kind); lines = [...card.querySelectorAll('[data-extra-line]')]; }
        for (const item of values) {
          const field = [...lines[index].querySelectorAll('[data-field]')].find(element => element.dataset.field === item.key);
          if (field) { field.value = item.value; field.dispatchEvent(new Event('change')); }
        }
      }
    }
  };

  function describeExtra(item) {
    const parts = [];
    if (Array.isArray(item.lines)) {
      item.lines.forEach(line => {
        if (item.code === 'hydrant-hose-test') parts.push(`${line.type} · ${line.diameterMm} mm · ${line.lengthMeters} m · qtd. ${line.quantity}`);
        else parts.push(`${line.type === 'Outro' ? line.otherType : line.type} · qtd. ${line.quantity}${line.location ? ` · local: ${line.location}` : ''}`);
      });
    }
    if (item.details) {
      const names={color:'Cor',lengthMeters:'Comprimento (m)',widthCm:'Largura (cm)',notes:'Local / observações'};
      Object.entries(item.details).forEach(([key,value]) => { if (value !== '' && value != null) parts.push(`${names[key]||key}: ${value}`); });
    }
    if (item.quantity) parts.push(`Quantidade: ${item.quantity}`);
    if (Number(item.price||0)>0) parts.push(`Valor: ${money(item.price)}`);
    return parts.join(' | ');
  }

  function appendExtras(container, service, heading) {
    const extras = service?.extraServices || [];
    if (!container || !extras.length || container.querySelector('.saved-service-extras')) return;
    const section = document.createElement('section');
    section.className = 'saved-service-extras';
    section.style.cssText = 'margin-top:18px;padding:14px;border:1px solid #dce4f7;border-radius:10px;background:#fbfcff';
    const title = document.createElement('h3'); title.textContent = heading; title.style.cssText = 'margin:0 0 8px;font-size:14px'; section.appendChild(title);
    const list = document.createElement('ul'); list.style.cssText = 'margin:0;padding-left:20px';
    extras.forEach(item => { const li = document.createElement('li'); li.style.cssText = 'margin:5px 0'; li.textContent = [item.title,describeExtra(item)].filter(Boolean).join(' — '); list.appendChild(li); });
    section.appendChild(list);
    const footer = container.querySelector('.receipt-footer');
    if (footer) footer.before(section); else container.appendChild(section);
  }

  const originalOpenService = window.openService;
  window.openService = function(draft, ...args) {
    const result = originalOpenService.apply(this, [draft, ...args]);
    const form = document.getElementById('editForm');
    if (!form) return result;
    const section = document.createElement('section');
    section.className = 'form-field span2 service-extra-section';
    section.innerHTML = panelMarkup;
    addAmountFields(section);
    const extinguisherField = form.querySelector('#serviceExtRows')?.closest('.form-field');
    const serviceTypeField = form.querySelector('[name="serviceType"]')?.closest('.form-field');
    const insertAfter = extinguisherField || serviceTypeField;
    if (insertAfter) insertAfter.insertAdjacentElement(extinguisherField ? 'afterend' : 'beforebegin', section);
    section.querySelectorAll('[data-extra-card]').forEach(card => {
      const toggle = card.querySelector('[data-extra-toggle]');
      const details = card.querySelector('[data-extra-details]');
      const kind = card.dataset.extraCard;
      toggle.addEventListener('change', () => {
        details.classList.toggle('hidden', !toggle.checked);
        if (toggle.checked && ['hydrant-hose-test','extinguisher-hose','diffuser','hydrant-accessories','safety-signage'].includes(kind) && !card.querySelector('[data-extra-line]')) addLine(card, kind);
      });
      card.querySelector('[data-extra-add]')?.addEventListener('click', () => addLine(card, kind));
      card.querySelector('[data-field="color"]')?.addEventListener('change', event => card.querySelector('[data-other-color]')?.classList.toggle('hidden', event.target.value !== 'Outra'));
    });
    section.addEventListener('input', event => { if (event.target.matches('[data-field="amount"]')) window.refreshServicePrice(); });
    section.addEventListener('change', event => { if (event.target.matches('[data-extra-toggle]')) window.refreshServicePrice(); });
    bindSubmit(form);
    if (draft?.extraServicesDraft) window.restoreServiceExtrasDraft(draft.extraServicesDraft);
    window.refreshServicePrice();
    return result;
  };

  const originalServiceOrder = window.serviceOrder;
  window.serviceOrder = function(serviceId, ...args) {
    const result = originalServiceOrder.apply(this, [serviceId, ...args]);
    const service = (db.services || []).find(item => item.id === serviceId);
    appendExtras(document.querySelector('.service-order'), service, 'Serviços complementares');
    return result;
  };

  const originalShowReceipt = window.showServiceReceipt;
  window.showServiceReceipt = function(serviceId, ...args) {
    const result = originalShowReceipt.apply(this, [serviceId, ...args]);
    const service = (db.services || []).find(item => item.id === serviceId);
    appendExtras(document.querySelector('.receipt-paper'), service, 'Serviços complementares realizados');
    return result;
  };

  const employeeExtrasByCode = new Map();
  function rememberEmployeeServices(services) {
    (services || []).forEach(service => {
      if (service.code) employeeExtrasByCode.set(service.code, service.extraServices || []);
    });
  }
  function renderEmployeeExtras() {
    document.querySelectorAll('#employeePortal .employee-service').forEach(card => {
      const code = card.querySelector('.employee-service-head b')?.textContent.trim();
      const extras = employeeExtrasByCode.get(code) || [];
      const body = card.querySelector('.employee-work, .employee-service-body');
      if (!body || !extras.length || body.querySelector('.employee-extra-summary')) return;
      const summary = document.createElement('section');
      summary.className = 'employee-extra-summary';
      summary.style.cssText = 'margin-top:10px;padding:10px 12px;border:1px solid #dce4f7;border-radius:10px;background:#fbfcff';
      const heading = document.createElement('strong'); heading.textContent = 'Serviços complementares'; heading.style.cssText = 'font-size:12px'; summary.appendChild(heading);
      const list = document.createElement('ul'); list.style.cssText = 'margin:6px 0 0;padding-left:18px;font-size:11px';
      extras.forEach(item => { const line = document.createElement('li'); line.textContent = [item.title,describeExtra(item)].filter(Boolean).join(' — '); list.appendChild(line); });
      summary.appendChild(list);
      body.appendChild(summary);
    });
  }

  const originalApiCall = window.apiCall;
  window.apiCall = async function(path, ...args) {
    const response = await originalApiCall.call(this, path, ...args);
    if (response.ok && (path === '/api/login' || path === '/api/employee/services')) {
      try {
        const data = await response.clone().json();
        if (path === '/api/login' && data.role === 'employee') rememberEmployeeServices(data.services);
        if (path === '/api/employee/services') rememberEmployeeServices(data.services);
        renderEmployeeExtras();
      } catch {}
    }
    return response;
  };

  const employeeCardsHost = document.getElementById('employeePortal');
  if (employeeCardsHost) new MutationObserver(renderEmployeeExtras).observe(employeeCardsHost,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('employeePortal');
    if (host) new MutationObserver(renderEmployeeExtras).observe(host,{childList:true,subtree:true});
  }, {once:true});
})();
