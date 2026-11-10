/* Registra o service worker apenas em HTTPS (ou localhost). */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
})();

/* Painel administrativo no celular: a navegação abre apenas pelo botão ☰. */
(() => {
  const mobile = matchMedia('(max-width: 650px), (hover: none) and (pointer: coarse)');
  const close = () => {
    if (!mobile.matches) return;
    const nav = document.getElementById('mobileAdminNav');
    const button = document.querySelector('.mobile-admin-menu');
    nav?.classList.add('is-collapsed');
    button?.setAttribute('aria-expanded', 'false');
  };

  const prepare = () => {
    const nav = document.getElementById('mobileAdminNav');
    const button = document.querySelector('.mobile-admin-menu');
    if (!nav || !button) return false;
    close();
    return true;
  };

  if (!prepare()) {
    const observer = new MutationObserver(() => {
      if (prepare()) observer.disconnect();
    });
    observer.observe(document.body, {childList: true, subtree: true});
  }

  document.addEventListener('click', event => {
    if (event.target.closest('#mobileAdminNav [data-page], #mobileAdminNav .mobile-logout')) close();
  }, true);
  mobile.addEventListener?.('change', event => { if (event.matches) close(); });
})();

/* Cadastro da equipe no painel administrativo. */
(() => {
  window.openEmployee = function() {
    const form = `<div class="form-grid">
      ${field('Nome completo', 'name', {required:true})}
      ${field('Função', 'role', {required:true, placeholder:'Ex.: Técnico de manutenção'})}
      ${field('Telefone / WhatsApp', 'phone', {type:'tel'})}
      ${field('E-mail', 'email', {type:'email'})}
    </div>
    <p class="helper">Depois do cadastro, crie o usuário e a senha em <b>Acessos funcionários</b> para liberar o login do membro da equipe.</p>`;

    openModal('Cadastrar funcionário', form, async data => {
      const name = val(data, 'name');
      const role = val(data, 'role');
      if (!name || !role) {
        toast('Informe o nome e a função do funcionário.');
        return false;
      }
      const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      if ((db.employees || []).some(item => String(item.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') === normalized)) {
        toast('Já existe um funcionário cadastrado com esse nome.');
        return false;
      }

      const employee = {id:id(), name, role, phone:val(data, 'phone'), email:val(data, 'email')};
      db.employees = db.employees || [];
      db.employees.push(employee);
      if (!await save()) {
        db.employees = db.employees.filter(item => item.id !== employee.id);
        saveLocal();
        return false;
      }
      renderPage('employees');
      toast('Funcionário cadastrado. Agora crie o acesso dele em Acessos funcionários.');
    });
  };
})();

/* Validações de cadastro compartilhadas por loja e painel administrativo. */
(() => {
  const digits = value => String(value || '').replace(/\D/g, '');
  const repeated = value => /^(\d)\1+$/.test(value);
  const validCpf = value => {
    const cpf = digits(value);
    if (cpf.length !== 11 || repeated(cpf)) return false;
    const digit = length => {
      const sum = cpf.slice(0, length).split('').reduce((total, item, index) => total + Number(item) * (length + 1 - index), 0);
      const rest = (sum * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
  };
  const validCnpj = value => {
    const cnpj = digits(value);
    if (cnpj.length !== 14 || repeated(cnpj)) return false;
    const digit = size => {
      let weight = size - 7;
      const sum = cnpj.slice(0, size).split('').reduce((total, item) => {
        const next = total + Number(item) * weight;
        weight = weight === 2 ? 9 : weight - 1;
        return next;
      }, 0);
      const rest = sum % 11;
      return rest < 2 ? 0 : 11 - rest;
    };
    return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
  };
  const validDocument = value => {
    const valueDigits = digits(value);
    return valueDigits.length === 11 ? validCpf(valueDigits) : valueDigits.length === 14 && validCnpj(valueDigits);
  };
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(String(value || '').trim());
  const validPhone = value => {
    const phone = digits(value).replace(/^55(?=\d{10,11}$)/, '');
    return /^(?:[1-9]\d)(?:9\d{8}|[2-8]\d{7})$/.test(phone);
  };
  window.protecValidation = {validCpf, validCnpj, validDocument, validEmail, validPhone};

  const validateField = input => {
    const value = input.value.trim();
    if (!value) { input.setCustomValidity(''); return ''; }
    if (input.matches('[name="document"]') && !validDocument(value)) return 'Informe um CPF ou CNPJ válido.';
    if ((input.type === 'email' || input.matches('[data-contact-email]')) && !validEmail(value)) return 'Informe um e-mail válido.';
    if ((input.type === 'tel' || input.matches('[name="phone"],[data-service-field="phone"]')) && !validPhone(value)) return 'Informe um telefone com DDD válido.';
    return '';
  };
  const updateValidity = input => input.setCustomValidity(validateField(input));
  document.addEventListener('input', event => {
    if (event.target.matches?.('input[name="document"], input[type="email"], input[type="tel"], input[name="phone"], input[data-contact-email], input[data-service-field="phone"]')) updateValidity(event.target);
  });
  document.addEventListener('submit', event => {
    const fields = [...event.target.querySelectorAll?.('input[name="document"], input[type="email"], input[type="tel"], input[name="phone"], input[data-contact-email], input[data-service-field="phone"]') || []];
    const invalid = fields.find(input => {
      updateValidity(input);
      return !input.checkValidity();
    });
    if (!invalid) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    invalid.reportValidity();
    invalid.focus();
  }, true);
})();

/* Rebranding corporativo e catálogo público — sem carrinho ou conta de cliente. */
(() => {
  const style = document.createElement('style');
  style.textContent = `
    :root{--protec-surface:#f4f6f8;--protec-ink:#1f2937;--protec-accent:#e11d48;--protec-deep:#111827;--protec-muted:#6b7280}
    body{background:var(--protec-surface)!important;color:var(--protec-ink)!important}
    #store .topbar,#dashboard .sidebar,.employee-top,.seller-top{background:var(--protec-deep)!important;color:#fff!important;border-color:#374151!important}
    #store .hero{background:linear-gradient(135deg,#111827 0%,#1f2937 66%,#3a1020 100%)!important}
    #store .hero h1 span,.eyebrow{color:#fb7185!important}.brand-mark{background:var(--protec-accent)!important;color:#fff!important}
    .btn,.btn-dark,#dashboard #content .btn:not(.btn-soft){background:var(--protec-accent)!important;color:#fff!important;border-color:var(--protec-accent)!important}
    .btn:hover,#dashboard #content .btn:not(.btn-soft):hover{background:#be123c!important}.btn-soft{background:#e5e7eb!important;color:var(--protec-ink)!important;border-color:#d1d5db!important}
    .panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro{border-color:#e5e7eb!important;box-shadow:0 10px 28px rgb(17 24 39 / 7%)!important}
    .catalog-card{position:relative;display:flex;flex-direction:column;min-height:100%;overflow:hidden;border:1px solid #e5e7eb;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgb(17 24 39 / 8%)}
    .catalog-card:hover{transform:translateY(-3px);box-shadow:0 18px 38px rgb(17 24 39 / 14%)}
    .catalog-media{height:230px;background:linear-gradient(145deg,#e5e7eb,#f9fafb);display:grid;place-items:center;overflow:hidden}.catalog-media img{width:100%;height:100%;object-fit:cover}.catalog-placeholder{font-size:58px}
    .catalog-body{display:flex;flex:1;flex-direction:column;gap:10px;padding:20px}.catalog-category{align-self:flex-start;border-radius:999px;background:#ffe4e6;color:#be123c;padding:5px 9px;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.catalog-body h3{margin:0;color:var(--protec-deep);font-size:18px}.catalog-body p{margin:0;color:var(--protec-muted);font-size:13px;line-height:1.55}.catalog-body .btn{margin-top:auto;align-self:flex-start}
    .catalog-admin-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800}.catalog-admin-status input{accent-color:var(--protec-accent)}
    #customerCartButton,#customerAccountButton,.customer-account-button,.customer-panel-redesign,.checkout-confirmation,.customer-order-panel{display:none!important}
    #login .login-aside{background:linear-gradient(145deg,#111827,#1f2937)!important;color:#f4f6f8!important}#login .login-main,#dashboard.app,#dashboard .main,#dashboard .admin-content{background:#f4f6f8!important;color:#1f2937!important}#dashboard .admin-top{background:#fff!important;border-color:#e5e7eb!important}.sidebar .side-nav button.active,#dashboard .side-nav button.active{background:#e11d48!important;color:#fff!important;box-shadow:inset 4px 0 #fda4af!important}.sidebar .side-nav button:hover,#dashboard .side-nav button:hover{background:#374151!important;color:#fff!important}.toast{background:#111827!important;border-left-color:#e11d48!important}.status,.tag,.pill{background:#ffe4e6!important;color:#be123c!important}
    html[data-theme="dark"]{color-scheme:dark;--protec-surface:#111827;--protec-ink:#f4f6f8;--protec-accent:#fb7185;--protec-deep:#111827;--protec-muted:#9ca3af}html[data-theme="dark"] body,html[data-theme="dark"] #store,html[data-theme="dark"] #dashboard.app,html[data-theme="dark"] #dashboard .main,html[data-theme="dark"] #dashboard .admin-content,html[data-theme="dark"] #login .login-main,html[data-theme="dark"] .employee-portal{background:#111827!important;color:#f4f6f8!important}html[data-theme="dark"] :is(.panel,.stat,.config-card,.table-wrap,.admin-page-intro,.modal,.catalog-card,.employee-service,.seller-dashboard){background:#1f2937!important;color:#f4f6f8!important;border-color:#374151!important}html[data-theme="dark"] :is(.panel h1,.panel h2,.panel h3,.stat strong,.catalog-body h3,.admin-page-intro h1,#dashboard #content td,#dashboard #content th){color:#f4f6f8!important}html[data-theme="dark"] :is(.helper,.catalog-body p,.page-title p,.admin-top,.crumb,.tracking-meta){color:#9ca3af!important}html[data-theme="dark"] :is(input,select,textarea,.search,.icon-btn){background:#111827!important;color:#f4f6f8!important;border-color:#4b5563!important}html[data-theme="dark"] #dashboard .admin-top,html[data-theme="dark"] .mobile-admin-nav,html[data-theme="dark"] .modal-head,html[data-theme="dark"] .modal-actions{background:#1f2937!important;border-color:#374151!important}html[data-theme="dark"] #store .topbar,html[data-theme="dark"] #dashboard .sidebar,html[data-theme="dark"] .employee-top,html[data-theme="dark"] .seller-top{background:#111827!important;border-color:#374151!important}html[data-theme="dark"] .btn,html[data-theme="dark"] #dashboard #content .btn:not(.btn-soft){background:#e11d48!important;color:#fff!important;border-color:#e11d48!important}html[data-theme="dark"] .btn-soft{background:#374151!important;color:#f4f6f8!important;border-color:#4b5563!important}html[data-theme="dark"] .catalog-category,html[data-theme="dark"] .status,html[data-theme="dark"] .tag,html[data-theme="dark"] .pill{background:#4c1021!important;color:#fda4af!important}html[data-theme="dark"] .catalog-media{background:#111827!important}html[data-theme="dark"] .sidebar .side-nav button.active,html[data-theme="dark"] #dashboard .side-nav button.active{background:#e11d48!important;color:#fff!important;box-shadow:inset 4px 0 #fda4af!important}
    @media(max-width:650px){.catalog-media{height:205px}.catalog-body{padding:17px}.catalog-body .btn{width:100%}}
  `;
  document.head.append(style);
  document.documentElement.classList.add('protec-catalog-mode');

  const categoryOptions = ['Extintores','Placas e sinalização','Hidrantes e mangueiras','Iluminação de emergência','Acessórios de prevenção'];
  const imageSource = async form => {
    const file = form.get('imageFile');
    const uploaded = await fileData(file);
    if (uploaded) return uploaded;
    const url = String(form.get('imageUrl') || '').trim();
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (!['https:','http:'].includes(parsed.protocol)) throw Error();
      return parsed.href;
    } catch { throw Error('Use uma URL de imagem válida, iniciada por https:// ou http://.'); }
  };
  const quote = product => {
    const message = `Olá! Gostaria de solicitar informações sobre: ${product.name}.`;
    const link = window.fogoWhatsAppLink?.(message);
    if (link) return window.open(link, '_blank', 'noopener');
    window.showPublicPage?.('service');
    toast('Informe seus dados para solicitar um orçamento.');
  };
  const renderCatalog = () => {
    const host = document.getElementById('publicProducts');
    if (!host) return;
    const visible = (db.products || []).filter(product => product.catalogEnabled !== false);
    host.className = 'products catalog-grid';
    host.innerHTML = visible.length ? visible.map(product => `<article class="catalog-card"><div class="catalog-media">${product.image ? `<img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">` : '<span class="catalog-placeholder">🧯</span>'}</div><div class="catalog-body"><span class="catalog-category">${esc(product.category || 'Catálogo')}</span><h3>${esc(product.name)}</h3><p>${esc(product.description || product.type || 'Equipamento de prevenção')}${product.model ? ` · ${esc(product.model)}` : ''}</p><button class="btn btn-small" type="button" data-catalog-product="${esc(product.id)}">Solicitar orçamento</button></div></article>`).join('') : '<div class="empty">O catálogo está sendo atualizado. Fale com a equipe para solicitar informações.</div>';
    host.querySelectorAll('[data-catalog-product]').forEach(button => button.addEventListener('click', () => quote((db.products || []).find(product => product.id === button.dataset.catalogProduct))));
  };
  const originalRenderPublic = window.renderPublic;
  window.renderPublic = function() { originalRenderPublic?.apply(this, arguments); renderCatalog(); };
  window.addToCart = () => toast('Este catálogo é exclusivo para consulta. Solicite um orçamento à equipe.');
  window.openCart = () => toast('Compras online foram removidas. Solicite um orçamento para receber atendimento personalizado.');
  window.openCustomerAuth = () => toast('A área de cliente foi removida. Use o catálogo para solicitar um orçamento.');
  window.openCustomerAccount = window.openCustomerAuth;

  const catalogAdmin = host => {
    const products = db.products || [], active = products.filter(product => product.catalogEnabled !== false).length;
    host.innerHTML = `<div class="page-title"><div><div class="eyebrow">Catálogo profissional</div><h1>Produtos em catálogo</h1><p>Controle a visibilidade e as imagens de referência da vitrine pública.</p></div><button class="btn btn-small" onclick="openProduct()">＋ Adicionar produto</button></div><div class="panel"><div class="panel-head"><div><h3>${active} produto(s) ativo(s)</h3><p>${products.length - active} item(ns) oculto(s) da vitrine.</p></div><button class="btn btn-soft btn-small" onclick="showStore('home')">Ver catálogo ↗</button></div>${products.length ? `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Imagem</th><th>Vitrine</th><th>Ações</th></tr></thead><tbody>${products.map(product => `<tr><td><strong>${esc(product.name)}</strong><small>${esc(product.model || product.type || 'Sem referência')}</small></td><td>${esc(product.category || 'Catálogo')}</td><td>${product.image ? 'Imagem definida' : 'Sem imagem'}</td><td><label class="catalog-admin-status"><input type="checkbox" ${product.catalogEnabled !== false ? 'checked' : ''} onchange="toggleCatalogProduct('${esc(product.id)}',this.checked)">${product.catalogEnabled !== false ? 'Ativo' : 'Oculto'}</label></td><td><button class="icon-btn" onclick="editProduct('${esc(product.id)}')">Editar</button> <button class="icon-btn" onclick="del('products','${esc(product.id)}')">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum produto cadastrado no catálogo.</div>'}</div>`;
  };
  const originalRenderPage = window.renderPage;
  window.renderPage = function(target) {
    const current = target || window.page;
    if (current === 'products') return catalogAdmin(document.getElementById('content'));
    return originalRenderPage?.apply(this, arguments);
  };
  window.toggleCatalogProduct = async (id, enabled) => {
    const product = (db.products || []).find(item => item.id === id);
    if (!product) return;
    const previous = product.catalogEnabled !== false;
    product.catalogEnabled = Boolean(enabled);
    if (!await save()) { product.catalogEnabled = previous; return window.renderPage('products'); }
    window.renderPage('products'); window.renderPublic(); toast(enabled ? 'Produto exibido no catálogo.' : 'Produto ocultado do catálogo.');
  };
  window.openProduct = function() {
    const body = `<div class="form-grid">${field('Nome do produto','name',{required:true})}${field('Categoria','category',{options:categoryOptions.map(value => ({value,label:value}))})}${field('Tipo / especificação','type')}${field('Modelo ou referência','model')}${field('Código / SKU','sku')}${field('Descrição','description',{cls:'span2'})}<div class="form-field span2"><label>URL da imagem de referência</label><input name="imageUrl" type="url" placeholder="https://exemplo.com/imagem.jpg"><small>Use uma imagem pública do fabricante ou forneça um arquivo abaixo.</small></div><div class="form-field span2"><label>Enviar imagem</label><label class="upload">Selecionar imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div><label class="form-field span2"><span><input name="catalogEnabled" type="checkbox" checked> Exibir este produto no catálogo público</span></label></div>`;
    openModal('Adicionar produto ao catálogo', body, async form => {
      const product = {id:id(),name:val(form,'name'),category:val(form,'category'),type:val(form,'type'),kg:'',model:val(form,'model'),sku:val(form,'sku'),description:val(form,'description'),price:0,image:await imageSource(form),video:'',catalogEnabled:form.get('catalogEnabled') === 'on'};
      db.products = db.products || []; db.products.push(product);
      if (!await save()) { db.products = db.products.filter(item => item.id !== product.id); saveLocal(); return false; }
      window.renderPage('products'); window.renderPublic(); toast('Produto adicionado ao catálogo.');
    });
  };
  window.editProduct = function(id) {
    const product = (db.products || []).find(item => item.id === id); if (!product) return;
    const body = `<div class="form-grid">${field('Nome do produto','name',{required:true,value:product.name})}${field('Categoria','category',{options:categoryOptions.map(value => ({value,label:value,selected:value === product.category}))})}${field('Tipo / especificação','type',{value:product.type})}${field('Modelo ou referência','model',{value:product.model})}${field('Código / SKU','sku',{value:product.sku})}${field('Descrição','description',{cls:'span2',value:product.description})}<div class="form-field span2"><label>Nova URL da imagem</label><input name="imageUrl" type="url" placeholder="Mantenha vazio para preservar a imagem atual"></div><div class="form-field span2"><label>Atualizar imagem por arquivo</label><label class="upload">Selecionar imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div><label class="form-field span2"><span><input name="catalogEnabled" type="checkbox" ${product.catalogEnabled !== false ? 'checked' : ''}> Exibir no catálogo público</span></label></div>`;
    openModal('Editar produto do catálogo', body, async form => {
      const image = await imageSource(form);
      product.name = val(form,'name'); product.category = val(form,'category'); product.type = val(form,'type'); product.model = val(form,'model'); product.sku = val(form,'sku'); product.description = val(form,'description'); product.catalogEnabled = form.get('catalogEnabled') === 'on'; if (image) product.image = image;
      if (!await save()) return false;
      window.renderPage('products'); window.renderPublic(); toast('Produto atualizado.');
    });
  };
  setTimeout(() => { window.renderPublic(); document.querySelectorAll('#customerCartButton,#customerAccountButton').forEach(node => node.remove()); }, 0);
})();
