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
    :root{--protec-surface:#f4f6f8;--protec-ink:#1f2937;--protec-accent:#e11d48;--protec-deep:#111827;--protec-muted:#6b7280;--ink:#1f2937!important;--muted:#6b7280!important;--line:#d1d5db!important;--paper:#f4f6f8!important;--white:#fff!important;--yellow:#e11d48!important;--yellow2:#fb7185!important;--green:#e11d48!important;--red:#e11d48!important;--brand:#e11d48!important;--brand-hover:#be123c!important;--focus:#e11d48!important;--success:#e11d48!important;--warning:#6b7280!important;--dash-primary:#e11d48!important;--dash-primary-hover:#be123c!important;--dash-accent:#e11d48!important;--dash-green:#e11d48!important;--dash-blue-soft:#ffe4e6!important;--admin-ink:#1f2937!important;--admin-muted:#6b7280!important;--admin-line:#d1d5db!important;--admin-bg:#f4f6f8!important;--admin-panel:#fff!important;--admin-navy:#111827!important;--admin-navy-2:#1f2937!important;--admin-accent:#e11d48!important;--admin-blue-soft:#ffe4e6!important;--customer-brand:#e11d48!important;--customer-lime:#fb7185!important}
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
    :is(button,input,select,textarea){accent-color:#e11d48!important}:is(button,a,input,select,textarea):focus-visible{outline-color:#e11d48!important;box-shadow:0 0 0 3px #fda4af!important}.dashboard-eyebrow,.dashboard-role-chip,.dashboard-stat-icon,.employee-tabs button.active,.seller-service-tabs button.active,.employee-tabs button.active span,.seller-service-tabs button.active span,.mobile-admin-nav button.active,.employee-group>strong small,.type-group{color:#be123c!important}.dashboard-eyebrow:before,.dashboard-stat-icon,.employee-tabs button.active span,.seller-service-tabs button.active span{background:#ffe4e6!important}.employee-tabs,.seller-service-tabs,.mobile-admin-nav{background:#fce7f3!important;border-color:#f9a8d4!important}.employee-tabs button.active,.seller-service-tabs button.active,.mobile-admin-nav button.active{border-color:#e11d48!important;box-shadow:inset 3px 0 #e11d48!important}.status.success,.status.warn,.status.expired,.inventory-low,.request-result-error{border-color:#e11d48!important;color:#be123c!important;background:#ffe4e6!important}.employee-top .btn,.seller-top .btn{background:#e11d48!important;color:#fff!important}.receipt-brand,.receipt-code b,.price-from{color:#e11d48!important}
    #customerCartButton,#customerAccountButton,.customer-account-button,.customer-panel-redesign,.checkout-confirmation,.customer-order-panel{display:none!important}
    #login .login-aside{background:linear-gradient(145deg,#111827,#1f2937)!important;color:#f4f6f8!important}#login .login-main,#dashboard.app,#dashboard .main,#dashboard .admin-content{background:#f4f6f8!important;color:#1f2937!important}#dashboard .admin-top{background:#fff!important;border-color:#e5e7eb!important}.sidebar .side-nav button.active,#dashboard .side-nav button.active{background:#e11d48!important;color:#fff!important;box-shadow:inset 4px 0 #fda4af!important}.sidebar .side-nav button:hover,#dashboard .side-nav button:hover{background:#374151!important;color:#fff!important}.toast{background:#111827!important;border-left-color:#e11d48!important}.status,.tag,.pill{background:#ffe4e6!important;color:#be123c!important}
    html[data-theme="dark"]{color-scheme:dark;--protec-surface:#111827;--protec-ink:#f4f6f8;--protec-accent:#fb7185;--protec-deep:#111827;--protec-muted:#9ca3af;--ink:#f4f6f8!important;--muted:#9ca3af!important;--line:#374151!important;--paper:#111827!important;--white:#1f2937!important;--yellow:#e11d48!important;--yellow2:#fb7185!important;--green:#e11d48!important;--red:#fb7185!important;--brand:#e11d48!important;--brand-hover:#fb7185!important;--dash-primary:#e11d48!important;--dash-primary-hover:#fb7185!important;--dash-accent:#e11d48!important;--dash-green:#e11d48!important;--dash-blue-soft:#4c1021!important;--admin-ink:#f4f6f8!important;--admin-muted:#9ca3af!important;--admin-line:#374151!important;--admin-bg:#111827!important;--admin-panel:#1f2937!important;--admin-navy:#111827!important;--admin-navy-2:#1f2937!important;--admin-accent:#e11d48!important;--admin-blue-soft:#4c1021!important;--customer-brand:#e11d48!important;--customer-lime:#fb7185!important}html[data-theme="dark"] body,html[data-theme="dark"] #store,html[data-theme="dark"] #dashboard.app,html[data-theme="dark"] #dashboard .main,html[data-theme="dark"] #dashboard .admin-content,html[data-theme="dark"] #login .login-main,html[data-theme="dark"] .employee-portal{background:#111827!important;color:#f4f6f8!important}html[data-theme="dark"] :is(.panel,.stat,.config-card,.table-wrap,.admin-page-intro,.modal,.catalog-card,.employee-service,.seller-dashboard){background:#1f2937!important;color:#f4f6f8!important;border-color:#374151!important}html[data-theme="dark"] :is(.panel h1,.panel h2,.panel h3,.stat strong,.catalog-body h3,.admin-page-intro h1,#dashboard #content td,#dashboard #content th){color:#f4f6f8!important}html[data-theme="dark"] :is(.helper,.catalog-body p,.page-title p,.admin-top,.crumb,.tracking-meta){color:#9ca3af!important}html[data-theme="dark"] :is(input,select,textarea,.search,.icon-btn){background:#111827!important;color:#f4f6f8!important;border-color:#4b5563!important}html[data-theme="dark"] #dashboard .admin-top,html[data-theme="dark"] .mobile-admin-nav,html[data-theme="dark"] .modal-head,html[data-theme="dark"] .modal-actions{background:#1f2937!important;border-color:#374151!important}html[data-theme="dark"] #store .topbar,html[data-theme="dark"] #dashboard .sidebar,html[data-theme="dark"] .employee-top,html[data-theme="dark"] .seller-top{background:#111827!important;border-color:#374151!important}html[data-theme="dark"] .btn,html[data-theme="dark"] #dashboard #content .btn:not(.btn-soft){background:#e11d48!important;color:#fff!important;border-color:#e11d48!important}html[data-theme="dark"] .btn-soft{background:#374151!important;color:#f4f6f8!important;border-color:#4b5563!important}html[data-theme="dark"] .catalog-category,html[data-theme="dark"] .status,html[data-theme="dark"] .tag,html[data-theme="dark"] .pill,html[data-theme="dark"] .employee-tabs,html[data-theme="dark"] .seller-service-tabs{background:#4c1021!important;color:#fda4af!important;border-color:#9f1239!important}html[data-theme="dark"] .catalog-media{background:#111827!important}html[data-theme="dark"] .sidebar .side-nav button.active,html[data-theme="dark"] #dashboard .side-nav button.active{background:#e11d48!important;color:#fff!important;box-shadow:inset 4px 0 #fda4af!important}
    @media(max-width:650px){.catalog-media{height:205px}.catalog-body{padding:17px}.catalog-body .btn{width:100%}}
  `;
  document.head.append(style);
  /* Camada final: neutraliza cores legadas em componentes montados por outros scripts. */
  const paletteGuard = document.createElement('style');
  paletteGuard.id = 'protec-final-palette-guard';
  paletteGuard.textContent = `
    :root,.protec-catalog-mode{--primary:#e11d48!important;--primary-dark:#be123c!important;--primary-light:#ffe4e6!important;--accent:#e11d48!important;--accent-soft:#ffe4e6!important;--blue:#e11d48!important;--blue-dark:#be123c!important;--blue-light:#ffe4e6!important;--navy:#111827!important;--navy-2:#1f2937!important;--success:#e11d48!important;--success-bg:#ffe4e6!important;--green:#e11d48!important;--lime:#fb7185!important;--yellow:#e11d48!important;--yellow2:#fb7185!important;--warning:#6b7280!important}
    :is(.topbar,.site-header,.public-header,.employee-top,.seller-top,.dashboard-header,.sidebar,.admin-sidebar,.app-sidebar){background-color:#111827!important;border-color:#374151!important;color:#f4f6f8!important}
    :is(.topbar,.site-header,.public-header,.employee-top,.seller-top,.dashboard-header,.sidebar,.admin-sidebar,.app-sidebar) :is(a,button,h1,h2,h3,strong,span,p){color:inherit}
    :is(.page,.page-shell,.page-content,.content,.content-area,.main,.main-content,.admin-content,.employee-portal,.seller-dashboard,.login-main,#store,#dashboard.app){background:#f4f6f8!important;color:#1f2937!important}
    :is(.card,.panel,.modal,.modal-content,.table-wrap,.config-card,.form-card,.employee-card,.seller-card,.service-card,.dashboard-card,.stat-card,.product-card,.public-product,.catalog-card){background:#fff!important;color:#1f2937!important;border-color:#d1d5db!important}
    :is(.badge,.tag,.pill,.chip,.status,.status-success,.success,.available,.active-badge,.inventory-low,.request-result-error,.notification-success){background:#ffe4e6!important;color:#be123c!important;border-color:#fda4af!important}
    :is(.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button){background:#e11d48!important;color:#fff!important;border-color:#e11d48!important}
    :is(.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button):hover{background:#be123c!important;border-color:#be123c!important}
    :is(.btn-secondary,.button-secondary,.btn-outline,.button-outline,.btn-soft,.secondary-button){background:#fff!important;color:#1f2937!important;border-color:#d1d5db!important}
    :is(.alert,.alert-success,.alert-info,.notice,.notice-success,.empty-state,.info-box,.success-box){background:#ffe4e6!important;color:#1f2937!important;border-color:#fda4af!important}
    :is(.progress,.progress-bar,.meter-fill,.completion-bar,.timeline-dot,.step.active,.step.done,.toggle input:checked + span,.switch input:checked + span){background:#e11d48!important;border-color:#e11d48!important}
    :is(.link,.text-link,.nav-link.active,.menu-link.active,.tab.active,.tabs button.active,.filter.active){color:#be123c!important;border-color:#e11d48!important}
    :is(.tab.active,.tabs button.active,.filter.active){background:#ffe4e6!important}
    :is(.fab,.floating-action,.whatsapp-button,.whatsapp-float,.contact-float){background:#e11d48!important;color:#fff!important}
    :is(.fab,.floating-action,.whatsapp-button,.whatsapp-float,.contact-float) svg{fill:currentColor!important;stroke:currentColor!important}
    :is(.footer,.site-footer,#store footer,.public-footer){background:#111827!important;color:#f4f6f8!important;border-color:#374151!important}
    :is(.footer,.site-footer,#store footer,.public-footer) :is(a,p,span,h1,h2,h3,strong){color:inherit!important}
    :is(input,select,textarea){background:#fff!important;color:#1f2937!important;border-color:#d1d5db!important;caret-color:#e11d48!important}
    :is(input,select,textarea)::placeholder{color:#6b7280!important;opacity:1}
    :is(input,select,textarea):focus{border-color:#e11d48!important;box-shadow:0 0 0 3px rgb(225 29 72 / 18%)!important}
    html[data-theme="dark"] :is(.page,.page-shell,.page-content,.content,.content-area,.main,.main-content,.admin-content,.employee-portal,.seller-dashboard,.login-main,#store,#dashboard.app){background:#111827!important;color:#f4f6f8!important}
    html[data-theme="dark"] :is(.card,.panel,.modal,.modal-content,.table-wrap,.config-card,.form-card,.employee-card,.seller-card,.service-card,.dashboard-card,.stat-card,.product-card,.public-product,.catalog-card){background:#1f2937!important;color:#f4f6f8!important;border-color:#374151!important}
    html[data-theme="dark"] :is(.btn-secondary,.button-secondary,.btn-outline,.button-outline,.btn-soft,.secondary-button){background:#1f2937!important;color:#f4f6f8!important;border-color:#4b5563!important}
    html[data-theme="dark"] :is(input,select,textarea){background:#111827!important;color:#f4f6f8!important;border-color:#4b5563!important}
    html[data-theme="dark"] :is(.badge,.tag,.pill,.chip,.status,.status-success,.success,.available,.active-badge,.inventory-low,.request-result-error,.notification-success,.alert,.alert-success,.alert-info,.notice,.notice-success,.empty-state,.info-box,.success-box,.tab.active,.tabs button.active,.filter.active){background:#4c1021!important;color:#fda4af!important;border-color:#9f1239!important}
  `;
  document.head.append(paletteGuard);
  /* Identidade final: grafite, brasa e chama. Esta camada é a última a carregar. */
  const firePalette = document.createElement('style');
  firePalette.id = 'protec-fire-safety-palette';
  firePalette.textContent = `
    :root,.protec-catalog-mode{
      --protec-surface:#f7f7f5!important;--protec-ink:#24282e!important;--protec-accent:#e23d28!important;--protec-deep:#171a20!important;--protec-muted:#667085!important;
      --primary:#e23d28!important;--primary-dark:#b82e20!important;--primary-light:#fff0ec!important;--accent:#e23d28!important;--accent-soft:#fff0ec!important;
      --ink:#24282e!important;--muted:#667085!important;--line:#e6d8d2!important;--paper:#f7f7f5!important;--white:#fff!important;
      --brand:#e23d28!important;--brand-hover:#b82e20!important;--focus:#e23d28!important;--success:#e23d28!important;--success-bg:#fff0ec!important;--warning:#f59e0b!important;
      --yellow:#f59e0b!important;--yellow2:#ff6b35!important;--green:#e23d28!important;--lime:#ff6b35!important;--red:#e23d28!important;
      --blue:#e23d28!important;--blue-dark:#b82e20!important;--blue-light:#fff0ec!important;--navy:#171a20!important;--navy-2:#24282e!important;
      --dash-primary:#e23d28!important;--dash-primary-hover:#b82e20!important;--dash-accent:#ff6b35!important;--dash-green:#e23d28!important;--dash-blue-soft:#fff0ec!important;
      --admin-ink:#24282e!important;--admin-muted:#667085!important;--admin-line:#e6d8d2!important;--admin-bg:#f7f7f5!important;--admin-panel:#fff!important;--admin-navy:#171a20!important;--admin-navy-2:#24282e!important;--admin-accent:#e23d28!important;--admin-blue-soft:#fff0ec!important;
      --customer-brand:#e23d28!important;--customer-lime:#ff6b35!important;
    }
    body{background:#f7f7f5!important;color:#24282e!important}
    #store .topbar,#dashboard .sidebar,.employee-top,.seller-top,.site-header,.public-header,.dashboard-header,.footer,.site-footer,#store footer,.public-footer{background:#171a20!important;color:#fff!important;border-color:#343a40!important}
    #store .hero,.login-aside{background:radial-gradient(circle at 82% 16%,rgb(255 107 53 / 28%),transparent 28%),linear-gradient(135deg,#171a20 0%,#24282e 62%,#5c1d18 100%)!important}
    :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)){background:#e23d28!important;color:#fff!important;border-color:#e23d28!important;box-shadow:0 8px 18px rgb(226 61 40 / 18%)}
    :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)):hover{background:#b82e20!important;border-color:#b82e20!important;box-shadow:0 12px 24px rgb(184 46 32 / 24%)!important}
    :is(.btn-soft,.btn-secondary,.button-secondary,.btn-outline,.button-outline,.secondary-button){background:#fff7f4!important;color:#9e2d20!important;border-color:#efd2c9!important;box-shadow:none!important}
    :is(.brand-mark,.dashboard-stat-icon,.dashboard-eyebrow:before,.employee-tabs button.active span,.seller-service-tabs button.active span){background:#e23d28!important;color:#fff!important}
    :is(.eyebrow,#store .hero h1 span,.dashboard-eyebrow,.dashboard-role-chip,.dashboard-stat-icon,.employee-tabs button.active,.seller-service-tabs button.active,.mobile-admin-nav button.active,.employee-group>strong small,.type-group,.receipt-brand,.receipt-code b,.price-from){color:#e23d28!important}
    :is(.panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro,.card,.form-card,.employee-card,.seller-card,.service-card,.dashboard-card,.stat-card,.product-card,.public-product,.catalog-card,.modal,.modal-content){background:#fff!important;color:#24282e!important;border-color:#e6d8d2!important;box-shadow:0 12px 28px rgb(34 24 20 / 7%)!important}
    :is(.catalog-category,.badge,.tag,.pill,.chip,.status,.status-success,.success,.available,.active-badge,.inventory-low,.request-result-error,.notification-success,.alert,.alert-success,.alert-info,.notice,.notice-success,.empty-state,.info-box,.success-box){background:#fff0ec!important;color:#a52d20!important;border-color:#f3b8a9!important}
    :is(.employee-tabs,.seller-service-tabs,.mobile-admin-nav){background:#fff3ed!important;border-color:#f1cabe!important}
    :is(.employee-tabs button.active,.seller-service-tabs button.active,.mobile-admin-nav button.active,.tab.active,.tabs button.active,.filter.active){background:#fff0ec!important;border-color:#e23d28!important;box-shadow:inset 3px 0 #e23d28!important}
    :is(.progress,.progress-bar,.meter-fill,.completion-bar,.timeline-dot,.step.active,.step.done,.toggle input:checked + span,.switch input:checked + span){background:#e23d28!important;border-color:#e23d28!important}
    :is(.fab,.floating-action,.whatsapp-button,.whatsapp-float,.contact-float){background:#e23d28!important;color:#fff!important;box-shadow:0 12px 24px rgb(226 61 40 / 28%)!important}
    :is(input,select,textarea){background:#fff!important;color:#24282e!important;border-color:#e6d8d2!important;caret-color:#e23d28!important}
    :is(input,select,textarea):focus,:is(button,a,input,select,textarea):focus-visible{outline-color:#e23d28!important;border-color:#e23d28!important;box-shadow:0 0 0 3px rgb(226 61 40 / 18%)!important}
    :is(input,select,textarea)::placeholder{color:#667085!important;opacity:1}
    .toast{background:#171a20!important;border-left-color:#ff6b35!important;color:#fff!important}
    html[data-theme="dark"]{color-scheme:dark;--protec-surface:#171a20!important;--protec-ink:#f7f7f5!important;--protec-accent:#ff6b35!important;--protec-deep:#171a20!important;--protec-muted:#a9afb8!important;--ink:#f7f7f5!important;--muted:#a9afb8!important;--line:#3b4048!important;--paper:#171a20!important;--white:#24282e!important;--brand:#ff6b35!important;--brand-hover:#ff8a5b!important;--dash-primary:#ff6b35!important;--dash-primary-hover:#ff8a5b!important;--dash-accent:#f59e0b!important;--dash-green:#ff6b35!important;--dash-blue-soft:#442019!important;--admin-ink:#f7f7f5!important;--admin-muted:#a9afb8!important;--admin-line:#3b4048!important;--admin-bg:#171a20!important;--admin-panel:#24282e!important;--admin-navy:#171a20!important;--admin-navy-2:#24282e!important;--admin-accent:#ff6b35!important;--admin-blue-soft:#442019!important;--customer-brand:#ff6b35!important;--customer-lime:#f59e0b!important}
    html[data-theme="dark"] body,html[data-theme="dark"] :is(.page,.page-shell,.page-content,.content,.content-area,.main,.main-content,.admin-content,.employee-portal,.seller-dashboard,.login-main,#store,#dashboard.app){background:#171a20!important;color:#f7f7f5!important}
    html[data-theme="dark"] :is(.panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro,.card,.form-card,.employee-card,.seller-card,.service-card,.dashboard-card,.stat-card,.product-card,.public-product,.catalog-card,.modal,.modal-content){background:#24282e!important;color:#f7f7f5!important;border-color:#3b4048!important;box-shadow:none!important}
    html[data-theme="dark"] :is(.btn-soft,.btn-secondary,.button-secondary,.btn-outline,.button-outline,.secondary-button){background:#30353d!important;color:#f7f7f5!important;border-color:#4b515b!important}
    html[data-theme="dark"] :is(.catalog-category,.badge,.tag,.pill,.chip,.status,.status-success,.success,.available,.active-badge,.inventory-low,.request-result-error,.notification-success,.alert,.alert-success,.alert-info,.notice,.notice-success,.empty-state,.info-box,.success-box,.employee-tabs,.seller-service-tabs,.mobile-admin-nav,.tab.active,.tabs button.active,.filter.active){background:#442019!important;color:#ffad91!important;border-color:#8f3b2b!important}
    html[data-theme="dark"] :is(input,select,textarea){background:#171a20!important;color:#f7f7f5!important;border-color:#4b515b!important}
  `;
  document.head.append(firePalette);
  /* Contraste e neutralização final de cores antigas inseridas por telas dinâmicas. */
  const contrastGuard = document.createElement('style');
  contrastGuard.id = 'protec-contrast-and-neutral-palette';
  contrastGuard.textContent = `
    #store :is(h1,h2,h3,h4,h5,h6,strong,th,legend),#login :is(h1,h2,h3,h4,h5,h6,strong,th,legend),#dashboard :is(h1,h2,h3,h4,h5,h6,strong,th,legend){color:#24282e!important}
    #store :is(p,label,td,li,small,.helper,.muted,.subtitle,.description),#login :is(p,label,td,li,small,.helper,.muted,.subtitle,.description),#dashboard :is(p,label,td,li,small,.helper,.muted,.subtitle,.description){color:#4b5563!important}
    #store a:not(.btn):not(.button),#login a:not(.btn):not(.button),#dashboard a:not(.btn):not(.button){color:#b82e20!important}
    :is([class*="success"],[class*="info"],[class*="green"],[class*="blue"],[class*="available"],[class*="confirmed"]){background-color:#fff0ec!important;color:#a52d20!important;border-color:#f3b8a9!important}
    :is([class*="success"],[class*="info"],[class*="green"],[class*="blue"],[class*="available"],[class*="confirmed"]) :is(svg,path){fill:currentColor!important;stroke:currentColor!important}
    #store :is(.topbar,.site-header,.public-header,.footer,.site-footer,.public-footer),#dashboard :is(.sidebar,.admin-sidebar,.app-sidebar,.dashboard-header),#login .login-aside,.employee-top,.seller-top{background:#171a20!important;color:#fff1eb!important}
    #store :is(.topbar,.site-header,.public-header,.footer,.site-footer,.public-footer) :is(h1,h2,h3,h4,h5,h6,p,a,strong,span),#dashboard :is(.sidebar,.admin-sidebar,.app-sidebar,.dashboard-header) :is(h1,h2,h3,h4,h5,h6,p,a,strong,span),#login .login-aside :is(h1,h2,h3,h4,h5,h6,p,a,strong,span),.employee-top :is(h1,h2,h3,h4,h5,h6,p,a,strong,span),.seller-top :is(h1,h2,h3,h4,h5,h6,p,a,strong,span){color:#fff1eb!important}
    html[data-theme="dark"] body,html[data-theme="dark"] #store,html[data-theme="dark"] #login,html[data-theme="dark"] #dashboard,html[data-theme="dark"] :is(.page,.page-shell,.page-content,.content,.content-area,.main,.main-content,.admin-content,.employee-portal,.seller-dashboard,.login-main){background:#171a20!important;color:#f4e5e1!important}
    html[data-theme="dark"] :is([class*="card"],[class*="panel"],[class*="modal"],[class*="table"],[class*="form"],[class*="drawer"],[class*="dropdown"],[class*="popover"],[class*="menu"],.panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro,.catalog-card){background:#24282e!important;color:#f4e5e1!important;border-color:#3b4048!important;background-image:none!important}
    html[data-theme="dark"] :is(h1,h2,h3,h4,h5,h6,strong,th,legend){color:#f4e5e1!important}
    html[data-theme="dark"] :is(p,label,td,li,small,.helper,.muted,.subtitle,.description){color:#cfc2be!important}
    html[data-theme="dark"] a:not(.btn):not(.button){color:#ffad91!important}
    html[data-theme="dark"] :is(input,select,textarea,[contenteditable="true"]){background:#1b1e24!important;color:#f4e5e1!important;border-color:#4b515b!important}
    html[data-theme="dark"] :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)){background:#e23d28!important;color:#fff1eb!important;border-color:#e23d28!important}
    html[data-theme="dark"] :is(.btn-soft,.btn-secondary,.button-secondary,.btn-outline,.button-outline,.secondary-button){background:#30353d!important;color:#f4e5e1!important;border-color:#4b515b!important}
    html[data-theme="dark"] :is([class*="success"],[class*="info"],[class*="green"],[class*="blue"],[class*="available"],[class*="confirmed"],.badge,.tag,.pill,.chip,.status,.alert,.notice,.empty-state,.info-box,.success-box){background:#442019!important;color:#ffb49a!important;border-color:#8f3b2b!important}
    html[data-theme="dark"] :is(.topbar,.site-header,.public-header,.footer,.site-footer,.public-footer,.sidebar,.admin-sidebar,.app-sidebar,.dashboard-header,.employee-top,.seller-top,#login .login-aside){background:#111419!important;color:#fff1eb!important;border-color:#343a40!important}
    html[data-theme="dark"] :is(.topbar,.site-header,.public-header,.footer,.site-footer,.public-footer,.sidebar,.admin-sidebar,.app-sidebar,.dashboard-header,.employee-top,.seller-top,#login .login-aside) :is(h1,h2,h3,h4,h5,h6,p,a,strong,span){color:#fff1eb!important}
  `;
  document.head.append(contrastGuard);
  const legacyInlineColor = /#(?:0131cd|2f5cf0|174de4|10234f|102641|13233b|17365d|0d284b|14243b|1c9c69|31ba83|13945f|0e8052|72dfb2|129760|1f7a4d|1f9d57|17804a|55d4a8|386b4b|17633a|166534|176b55|254000|365400|b9fc01|caff45)/ig;
  const neutralizeInlineColors = root => {
    const nodes = root instanceof Element && root.matches('[style]') ? [root, ...root.querySelectorAll('[style]')] : root.querySelectorAll?.('[style]') || [];
    nodes.forEach(node => {
      const current = node.getAttribute('style');
      if (current && legacyInlineColor.test(current)) node.setAttribute('style', current.replace(legacyInlineColor, '#e23d28'));
      legacyInlineColor.lastIndex = 0;
    });
  };
  neutralizeInlineColors(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) neutralizeInlineColors(node);
  }))).observe(document.body, { childList: true, subtree: true });
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
