/* Registra o service worker apenas em HTTPS (ou localhost). */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  const workerUrl=new URL('./sw.js',document.currentScript.src);window.addEventListener('load', () => { navigator.serviceWorker.register(workerUrl).catch(() => {}); });
})();

/* Revisão administrativa antes do fechamento definitivo da manutenção. */
(() => {
  const validYear = value => /^20\d{2}$/.test(String(value || '').trim());
  const reviewStyle = document.createElement('style');
  reviewStyle.textContent = `.admin-review-list{display:grid;gap:14px}.admin-review-item{padding:16px;border:1px solid var(--line,var(--ui-border,#c5d8e6));border-radius:14px;background:var(--paper,var(--ui-panel,#f9fcff))}.admin-review-item h3{margin:0 0 13px;font-size:14px}.admin-review-item h3 small{font-weight:600;color:var(--muted,var(--ui-muted,#526b80))}html[data-theme="dark"] .admin-review-item{background:var(--ui-panel,#f9fcff)!important;border-color:var(--ui-border,#c5d8e6)!important}`;
  document.head.append(reviewStyle);
  const reviewYear = service => {
    const dateYear = String(service?.date || '').match(/^(20\d{2})-/)?.[1];
    return dateYear || String(new Date().getFullYear());
  };
  const escReview = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

  window.openAdminServiceReview = function(serviceId, finalizeAfterReview = false) {
    const service = (db.services || []).find(item => item.id === serviceId);
    if (!service) return toast('Serviço não encontrado. Atualize o painel e tente novamente.');
    const items = service.items || [];
    if (!items.length) return toast('Este serviço não possui extintores para revisar.');
    const body = `<p class="helper">Confira os dados registrados pelo técnico. O ano da manutenção é obrigatório para cada extintor; o ano hidrostático é opcional.</p><div class="admin-review-list">${items.map((item, index) => `<section class="admin-review-item"><h3>${escReview(item.type || 'Extintor')}${item.kg ? ` · ${escReview(item.kg)} kg` : ''} <small>Item ${index + 1}</small></h3><div class="form-grid"><div class="form-field"><label>Número de série / patrimônio</label><input name="serial_${index}" maxlength="100" value="${escReview(item.serial || '')}" placeholder="Opcional"></div><div class="form-field"><label>Ano da manutenção *</label><input name="maintenanceYear_${index}" inputmode="numeric" pattern="20[0-9]{2}" maxlength="4" required value="${escReview(item.maintenanceYear || service.maintenanceValid || reviewYear(service))}" placeholder="2026"></div><div class="form-field"><label>Ano hidrostático</label><input name="hydroYear_${index}" inputmode="numeric" pattern="20[0-9]{2}" maxlength="4" value="${escReview(item.hydroYear || service.hydroValid || '')}" placeholder="Opcional"></div><div class="form-field"><label>Selo / lacre</label><input name="seal_${index}" maxlength="100" value="${escReview(item.seal || '')}" placeholder="Opcional"></div></div></section>`).join('')}</div><div class="form-field"><label>Observação da revisão</label><textarea name="reviewNotes" rows="3" maxlength="1500" placeholder="Opcional: conferência, pendências ou recomendações."></textarea></div>`;
    openModal(finalizeAfterReview ? 'Conferir dados para finalizar' : 'Revisar dados do serviço', body, async form => {
      const before = structuredClone(service);
      const reviewNotes = String(form.get('reviewNotes') || '').trim();
      for (let index = 0; index < items.length; index++) {
        const maintenanceYear = String(form.get(`maintenanceYear_${index}`) || '').trim();
        const hydroYear = String(form.get(`hydroYear_${index}`) || '').trim();
        if (!validYear(maintenanceYear)) throw Error(`Informe um ano de manutenção válido no item ${index + 1}.`);
        if (hydroYear && !validYear(hydroYear)) throw Error(`Informe um ano hidrostático válido no item ${index + 1} ou deixe-o vazio.`);
        Object.assign(items[index], {
          serial: String(form.get(`serial_${index}`) || '').trim(),
          maintenanceYear,
          hydroYear,
          seal: String(form.get(`seal_${index}`) || '').trim()
        });
      }
      service.maintenanceValid = String(items[0].maintenanceYear || '');
      service.hydroValid = String(items[0].hydroYear || '');
      service.history = service.history || [];
      service.history.push({ at: new Date().toISOString(), action: 'Dados revisados pelo administrador', description: reviewNotes || 'Validades e identificação dos extintores conferidas antes do fechamento.' });
      if (!await save()) {
        Object.assign(service, before);
        saveLocal();
        return false;
      }
      window.renderServicesPage?.();
      toast(finalizeAfterReview ? 'Dados conferidos. Confirme o fechamento do serviço.' : 'Dados da manutenção revisados e salvos.');
      if (finalizeAfterReview) return { afterClose: () => setTimeout(() => window.finalizeService(serviceId), 80) };
      return true;
    }, finalizeAfterReview ? 'Salvar e finalizar' : 'Salvar revisão');
  };

  window.manageProcess = function(serviceId) {
    return window.openAdminServiceReview(serviceId, false);
  };

  window.finalizeService = async function(serviceId) {
    const service = (db.services || []).find(item => item.id === serviceId);
    if (!service) return toast('Serviço não encontrado. Atualize o painel e tente novamente.');
    if (service.closed) return toast('Este serviço já está finalizado.');
    const missingValidity = (service.items || []).some(item => !validYear(item.maintenanceYear) || (item.hydroYear && !validYear(item.hydroYear)));
    if (missingValidity) {
      toast('Revise as validades antes de finalizar o serviço.');
      return window.openAdminServiceReview(serviceId, true);
    }
    if (!confirm(`Finalizar definitivamente o serviço ${service.code || ''}? Esta ação gera o comprovante e não poderá ser desfeita.`)) return;
    try {
      const response = await apiCall('/api/admin/finalize', 'POST', { serviceId });
      const data = await apiJson(response);
      if (!response.ok) throw Error(data.error || 'Não foi possível finalizar o serviço.');
      db = data.state || db;
      db.settings = db.settings || {};
      delete db.settings.password;
      saveLocal();
      window.renderServicesPage?.();
      toast('Serviço finalizado e comprovante liberado.');
    } catch (error) {
      toast(error.message || 'Não foi possível finalizar o serviço.');
    }
  };
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
    :root{--protec-surface:var(--ui-panel,#f9fcff);--protec-ink:var(--ui-text,#20374a);--protec-accent:var(--ui-action,#226b99);--protec-deep:var(--ui-text,#20374a);--protec-muted:var(--ui-muted,#526b80);--ink:var(--ui-text,#20374a)!important;--muted:var(--ui-muted,#526b80)!important;--line:var(--ui-border,#c5d8e6)!important;--paper:var(--ui-bg,#edf4fa)!important;--white:var(--ui-panel,#f9fcff)!important;--yellow:var(--ui-action,#226b99)!important;--yellow2:var(--ui-action,#226b99)!important;--green:var(--ui-success,#226b99)!important;--red:var(--ui-warning,#20374a)!important;--brand:var(--ui-action,#226b99)!important;--brand-hover:var(--ui-action,#226b99)!important;--focus:var(--ui-action,#226b99)!important;--success:var(--ui-success,#226b99)!important;--warning:var(--ui-warning,#20374a)!important;--dash-primary:var(--ui-action,#226b99)!important;--dash-primary-hover:var(--ui-action,#226b99)!important;--dash-accent:var(--ui-action,#226b99)!important;--dash-green:var(--ui-success,#226b99)!important;--dash-blue-soft:var(--ui-selected,#dce9f3)!important;--admin-ink:var(--ui-text,#20374a)!important;--admin-muted:var(--ui-muted,#526b80)!important;--admin-line:var(--ui-border,#c5d8e6)!important;--admin-bg:var(--ui-bg,#edf4fa)!important;--admin-panel:var(--ui-panel,#f9fcff)!important;--admin-navy:var(--ui-text,#20374a)!important;--admin-navy-2:var(--ui-text,#20374a)!important;--admin-accent:var(--ui-action,#226b99)!important;--admin-blue-soft:var(--ui-selected,#dce9f3)!important;--customer-brand:var(--ui-action,#226b99)!important;--customer-lime:var(--ui-success,#226b99)!important}
    body{background:var(--protec-surface)!important;color:var(--protec-ink)!important}
    #store .topbar,#dashboard .sidebar,.employee-top,.seller-top{background:var(--protec-deep)!important;color:var(--ui-text,#20374a)!important;border-color:var(--ui-border,#c5d8e6)!important}
    #store .hero{background:linear-gradient(135deg,var(--ui-panel,#f9fcff) 0%,var(--ui-panel,#f9fcff) 66%,var(--ui-panel,#f9fcff) 100%)!important}
    #store .hero h1 span,.eyebrow{color:var(--ui-muted,#526b80)!important}.brand-mark{background:var(--protec-accent)!important;color:var(--ui-text,#20374a)!important}
    .btn,.btn-dark,#dashboard #content .btn:not(.btn-soft){background:var(--protec-accent)!important;color:var(--ui-text,#20374a)!important;border-color:var(--protec-accent)!important}
    .btn:hover,#dashboard #content .btn:not(.btn-soft):hover{background:var(--ui-panel,#f9fcff)!important}.btn-soft{background:var(--ui-raised,#dce9f3)!important;color:var(--protec-ink)!important;border-color:var(--ui-border,#c5d8e6)!important}
    .panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro{border-color:var(--ui-border,#c5d8e6)!important;box-shadow:0 10px 28px rgb(24 24 24 / 7%)!important}
    .catalog-card{position:relative;display:flex;flex-direction:column;min-height:100%;overflow:hidden;border:1px solid var(--ui-border,#c5d8e6);border-radius:18px;background:var(--ui-panel,#f9fcff);box-shadow:0 10px 30px rgb(24 24 24 / 8%)}
    .catalog-card:hover{transform:translateY(-3px);box-shadow:0 18px 38px rgb(24 24 24 / 14%)}
    .catalog-media{height:230px;background:linear-gradient(145deg,var(--ui-raised,#dce9f3),var(--ui-panel,#f9fcff));display:grid;place-items:center;overflow:hidden}.catalog-media img{width:100%;height:100%;object-fit:cover}.catalog-placeholder{font-size:58px}
    .catalog-body{display:flex;flex:1;flex-direction:column;gap:10px;padding:20px}.catalog-category{align-self:flex-start;border-radius:999px;background:var(--ui-raised,#dce9f3);color:var(--ui-text,#20374a);padding:5px 9px;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.catalog-body h3{margin:0;color:var(--protec-deep);font-size:18px}.catalog-body p{margin:0;color:var(--protec-muted);font-size:13px;line-height:1.55}.catalog-body .btn{margin-top:auto;align-self:flex-start}
    .catalog-admin-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800}.catalog-admin-status input{accent-color:var(--protec-accent)}
    :is(button,input,select,textarea){accent-color:var(--ui-accent,#226b99)!important}:is(button,a,input,select,textarea):focus-visible{outline-color:var(--ui-border,#c5d8e6)!important;box-shadow:0 0 0 3px rgb(var(--ui-scrim-rgb,17 14 12) / 18%)!important}.dashboard-eyebrow,.dashboard-role-chip,.dashboard-stat-icon,.employee-tabs button.active,.seller-service-tabs button.active,.employee-tabs button.active span,.seller-service-tabs button.active span,.mobile-admin-nav button.active,.employee-group>strong small,.type-group{color:var(--ui-text,#20374a)!important}.dashboard-eyebrow:before,.dashboard-stat-icon,.employee-tabs button.active span,.seller-service-tabs button.active span{background:var(--ui-raised,#dce9f3)!important}.employee-tabs,.seller-service-tabs,.mobile-admin-nav{background:var(--ui-raised,#dce9f3)!important;border-color:var(--ui-border,#c5d8e6)!important}.employee-tabs button.active,.seller-service-tabs button.active,.mobile-admin-nav button.active{border-color:var(--ui-border,#c5d8e6)!important;box-shadow:inset 3px 0 rgb(var(--ui-scrim-rgb,17 14 12) / 18%)!important}.status.success,.status.warn,.status.expired,.inventory-low,.request-result-error{border-color:var(--ui-border,#c5d8e6)!important;color:var(--ui-text,#20374a)!important;background:var(--ui-raised,#dce9f3)!important}.employee-top .btn,.seller-top .btn{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important}.receipt-brand,.receipt-code b,.price-from{color:var(--ui-muted,#526b80)!important}
    #customerCartButton,#customerAccountButton,.customer-account-button,.customer-panel-redesign,.checkout-confirmation,.customer-order-panel{display:none!important}
    #login .login-aside{background:linear-gradient(145deg,var(--ui-panel,#f9fcff),var(--ui-panel,#f9fcff))!important;color:var(--ui-text,#20374a)!important}#login .login-main,#dashboard.app,#dashboard .main,#dashboard .admin-content{background:var(--ui-raised,#dce9f3)!important;color:var(--ui-text,#20374a)!important}#dashboard .admin-top{background:var(--ui-panel,#f9fcff)!important;border-color:var(--ui-border,#c5d8e6)!important}.sidebar .side-nav button.active,#dashboard .side-nav button.active{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important;box-shadow:inset 4px 0 rgb(var(--ui-scrim-rgb,17 14 12) / 18%)!important}.sidebar .side-nav button:hover,#dashboard .side-nav button:hover{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important}.toast{background:var(--ui-panel,#f9fcff)!important;border-left-color:var(--ui-border,#c5d8e6)!important}.status,.tag,.pill{background:var(--ui-raised,#dce9f3)!important;color:var(--ui-text,#20374a)!important}
    html[data-theme="dark"]{color-scheme:dark;--protec-surface:var(--ui-panel,#f9fcff);--protec-ink:var(--ui-text,#20374a);--protec-accent:var(--ui-action,#226b99);--protec-deep:var(--ui-text,#20374a);--protec-muted:var(--ui-muted,#526b80);--ink:var(--ui-text,#20374a)!important;--muted:var(--ui-muted,#526b80)!important;--line:var(--ui-border,#c5d8e6)!important;--paper:var(--ui-bg,#edf4fa)!important;--white:var(--ui-panel,#f9fcff)!important;--yellow:var(--ui-action,#226b99)!important;--yellow2:var(--ui-action,#226b99)!important;--green:var(--ui-success,#226b99)!important;--red:var(--ui-warning,#20374a)!important;--brand:var(--ui-action,#226b99)!important;--brand-hover:var(--ui-action,#226b99)!important;--dash-primary:var(--ui-action,#226b99)!important;--dash-primary-hover:var(--ui-action,#226b99)!important;--dash-accent:var(--ui-action,#226b99)!important;--dash-green:var(--ui-success,#226b99)!important;--dash-blue-soft:var(--ui-selected,#dce9f3)!important;--admin-ink:var(--ui-text,#20374a)!important;--admin-muted:var(--ui-muted,#526b80)!important;--admin-line:var(--ui-border,#c5d8e6)!important;--admin-bg:var(--ui-bg,#edf4fa)!important;--admin-panel:var(--ui-panel,#f9fcff)!important;--admin-navy:var(--ui-text,#20374a)!important;--admin-navy-2:var(--ui-text,#20374a)!important;--admin-accent:var(--ui-action,#226b99)!important;--admin-blue-soft:var(--ui-selected,#dce9f3)!important;--customer-brand:var(--ui-action,#226b99)!important;--customer-lime:var(--ui-success,#226b99)!important}html[data-theme="dark"] body,html[data-theme="dark"] #store,html[data-theme="dark"] #dashboard.app,html[data-theme="dark"] #dashboard .main,html[data-theme="dark"] #dashboard .admin-content,html[data-theme="dark"] #login .login-main,html[data-theme="dark"] .employee-portal{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important}html[data-theme="dark"] :is(.panel,.stat,.config-card,.table-wrap,.admin-page-intro,.modal,.catalog-card,.employee-service,.seller-dashboard){background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] :is(.panel h1,.panel h2,.panel h3,.stat strong,.catalog-body h3,.admin-page-intro h1,#dashboard #content td,#dashboard #content th){color:var(--ui-text,#20374a)!important}html[data-theme="dark"] :is(.helper,.catalog-body p,.page-title p,.admin-top,.crumb,.tracking-meta){color:var(--ui-muted,#526b80)!important}html[data-theme="dark"] :is(input,select,textarea,.search,.icon-btn){background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] #dashboard .admin-top,html[data-theme="dark"] .mobile-admin-nav,html[data-theme="dark"] .modal-head,html[data-theme="dark"] .modal-actions{background:var(--ui-panel,#f9fcff)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] #store .topbar,html[data-theme="dark"] #dashboard .sidebar,html[data-theme="dark"] .employee-top,html[data-theme="dark"] .seller-top{background:var(--ui-panel,#f9fcff)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] .btn,html[data-theme="dark"] #dashboard #content .btn:not(.btn-soft){background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] .btn-soft{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] .catalog-category,html[data-theme="dark"] .status,html[data-theme="dark"] .tag,html[data-theme="dark"] .pill,html[data-theme="dark"] .employee-tabs,html[data-theme="dark"] .seller-service-tabs{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-muted,#526b80)!important;border-color:var(--ui-border,#c5d8e6)!important}html[data-theme="dark"] .catalog-media{background:var(--ui-panel,#f9fcff)!important}html[data-theme="dark"] .sidebar .side-nav button.active,html[data-theme="dark"] #dashboard .side-nav button.active{background:var(--ui-panel,#f9fcff)!important;color:var(--ui-text,#20374a)!important;box-shadow:inset 4px 0 rgb(var(--ui-scrim-rgb,17 14 12) / 18%)!important}
    @media(max-width:650px){.catalog-media{height:205px}.catalog-body{padding:17px}.catalog-body .btn{width:100%}}
  `;
  document.head.append(style);
  document.documentElement.classList.add('protec-catalog-mode');

  const categoryOptions = ['Extintores','Placas e sinalização','Hidrantes e mangueiras','Iluminação de emergência','Peças e componentes','Acessórios de prevenção'];
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
    if(!product || product.catalogEnabled===false)return toast('Esta opção não está disponível no catálogo.');
    const variant=catalogVariant(product,catalogIdentity(product).family);
    const selection=[product.name,variant!==product.name?variant:'',product.model?'Modelo: '+product.model:'',product.sku?'Referência: '+product.sku:''].filter(Boolean).join(' · ');
    const message = `Olá! Gostaria de solicitar informações sobre: ${selection}.`;
    const link = window.fogoWhatsAppLink?.(message);
    if (link) return window.open(link, '_blank', 'noopener');
    window.showPublicPage?.('service');
    const details=document.querySelector('#customerServiceRequestForm [name="details"],form[onsubmit="submitMaintenanceRequest(event)"] [name="details"]');
    if(details && !details.value.trim()){
      details.value='Produto de interesse: '+selection+'.';details.dispatchEvent(new Event('input',{bubbles:true}));
    }
    toast('Informe seus dados para solicitar um orçamento.');
  };
  const catalogLocation={family:'',group:''};
  const catalogText=value=>String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/₂/g,'2').toLowerCase().trim();
  const catalogFamilies={
    extinguishers:{name:'Extintores',description:'Escolha o agente extintor e depois o peso ou a capacidade.',art:{name:'Extintor ABC'}},
    signs:{name:'Placas e sinalização',description:'Saídas, rotas de fuga, identificação e avisos.',art:{name:'Placa de sinalização'}},
    hoses:{name:'Mangueiras e hidrantes',description:'Tipos, comprimentos, conexões e componentes.',art:{name:'Mangueira de incêndio'}},
    lighting:{name:'Iluminação de emergência',description:'Consulte os modelos e as especificações disponíveis.',art:{name:'Iluminação de emergência'}},
    parts:{name:'Peças e acessórios',description:'Válvulas, manômetros, suportes e outros componentes.',art:{name:'Válvula M30'}}
  };
  const catalogCount=(count,one,many)=>`${count} ${count===1?one:many}`;
  const catalogOrder=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
  function catalogIdentity(product){
    const category=catalogText(product.category),name=catalogText([product.name,product.type].filter(Boolean).join(' '));
    const kind=window.protecArtwork.infer({...product,illustrationKind:'auto'});
    let family,group,groupName,rank=10;
    if(/placa|sinaliza/.test(category) || /^(?:placa|sinaliza)/.test(name)){family='signs';group='signs';groupName='Modelos de placas';}
    else if(/ilumina|luminaria|luz de emergencia/.test(category+' '+name)){family='lighting';group='lighting';groupName='Iluminação de emergência';}
    else if(/hidrante/.test(category) || /^(?:mangueira de incendio|esguicho|chave storz|adaptador storz|abrigo)/.test(name)){
      family='hoses';
      if(kind==='hose' || /^mangueira/.test(name)){
        const type=name.match(/tipo\s*(\d+)/)?.[1];group=type?'hose-'+type:'hose';groupName=type?'Mangueira tipo '+type:'Mangueiras';rank=type?Number(type):0;
      }else if(kind==='nozzle'){group='nozzles';groupName='Esguichos e difusores';}
      else if(kind==='wrench'){group='keys';groupName='Chaves Storz';}
      else if(kind==='valve'||kind==='valveCo2'){group='hydrant-valves';groupName='Válvulas para hidrante';}
      else if(kind==='cabinet'){group='cabinets';groupName='Abrigos para mangueira';}
      else{group='connections';groupName='Conexões e adaptadores';}
    }else if(['extinguisher','co2','water'].includes(kind) || (/extintor/.test(category)&&!['valve','valveCo2','gauge','siphon','bracket','seal','nozzle'].includes(kind))){
      family='extinguishers';
      if(/\babc\b/.test(name)){group='abc';groupName='Pó químico ABC';rank=0;}
      else if(/\bbc\b/.test(name)){group='bc';groupName='Pó químico BC';rank=1;}
      else if(kind==='water'||/agua/.test(name)){group='water';groupName='Água pressurizada';rank=2;}
      else if(kind==='co2'||/co\s*2|carbono/.test(name)){group='co2';groupName='CO₂';rank=3;}
      else{groupName=product.type || 'Outros extintores';group='ext-'+catalogText(groupName);}
    }else{
      family='parts';
      const groups={valve:['valve','Válvulas M30'],valveCo2:['valve-co2','Válvulas de CO₂'],gauge:['gauge','Manômetros'],siphon:['siphon','Sifões'],hose:['hoses','Mangueiras para extintor'],nozzle:['nozzles','Difusores'],seal:['seals','Vedações e lacres'],bracket:['brackets','Suportes para extintor'],alarm:['alarms','Alarmes e acionadores'],door:['doors','Portas corta-fogo'],wrench:['tools','Ferramentas']};
      [group,groupName]=groups[kind] || ['other','Outros equipamentos e acessórios'];
    }
    if(String(product.catalogGroup || '').trim()){groupName=String(product.catalogGroup).trim();group='custom-'+catalogText(groupName);rank=10;}
    return {family,group,groupName,rank};
  }
  function catalogVariant(product,family){
    if(String(product.variantLabel || '').trim())return String(product.variantLabel).trim();
    if(family==='extinguishers'){
      if(String(product.kg ?? '').trim() && Number(product.kg)>0)return `${String(product.kg).replace('.',',')} kg`;
      const capacity=String(product.name || '').match(/\b(\d+(?:[.,]\d+)?)\s*(kg|litros?|l)\b/i);
      if(capacity)return capacity[1].replace('.',',')+' '+(/kg/i.test(capacity[2])?'kg':'L');
    }
    return product.name || product.model || 'Consultar especificação';
  }
  function groupCatalog(products){
    const families=new Map();
    for(const product of products || []){
      if(product.catalogEnabled===false)continue;
      const identity=catalogIdentity(product),definition=catalogFamilies[identity.family];
      if(!families.has(identity.family))families.set(identity.family,{key:identity.family,...definition,items:[],groups:[]});
      const family=families.get(identity.family);family.items.push(product);
      let group=family.groups.find(item=>item.key===identity.group);
      if(!group){group={key:identity.group,name:identity.groupName,rank:identity.rank,items:[]};family.groups.push(group);}
      group.items.push(product);
    }
    return Object.keys(catalogFamilies).filter(key=>families.has(key)).map(key=>{
      const family=families.get(key);family.groups.sort((a,b)=>a.rank-b.rank||catalogOrder.compare(a.name,b.name));
      const quantity=product=>{
        const weight=Number(String(product.kg || '').replace(',','.'));if(weight>0)return weight;
        const capacity=String(product.variantLabel || product.name || '').match(/\b(\d+(?:[.,]\d+)?)\s*(?:kg|litros?|l)\b/i);return capacity?Number(capacity[1].replace(',','.')):Infinity;
      };
      for(const group of family.groups)group.items.sort((a,b)=>(key==='extinguishers' && quantity(a)!==quantity(b)?quantity(a)-quantity(b):0)||catalogOrder.compare(catalogVariant(a,key),catalogVariant(b,key))||catalogOrder.compare(a.model || a.name,b.model || b.name));
      return family;
    });
  }
  const catalogOptionFields=product=>`<div class="form-field"><label>Grupo / linha no catálogo (opcional)</label><input name="catalogGroup" maxlength="120" value="${esc(product?.catalogGroup || '')}" placeholder="Automático pelo tipo do produto"><small>Use o mesmo grupo nas opções que devem aparecer juntas.</small></div><div class="form-field"><label>Nome da opção (opcional)</label><input name="variantLabel" maxlength="160" value="${esc(product?.variantLabel || '')}" placeholder="Ex.: 6 kg, 20 × 30 cm ou 15 m · 1½ pol"></div><div class="form-field"><label>Peso do extintor em kg (opcional)</label><input name="kg" type="number" min="0.1" step="0.1" value="${esc(product?.kg || '')}" placeholder="Ex.: 6"><small>Para água, placas e outros itens, use o nome da opção com a unidade correta.</small></div>`;
  const catalogOptionValues=form=>({catalogGroup:String(form.get('catalogGroup') || '').trim(),variantLabel:String(form.get('variantLabel') || '').trim(),kg:String(form.get('kg') || '').trim()});
  function navigateCatalog(family='',group=''){
    catalogLocation.family=family;catalogLocation.group=group;renderCatalog();
    requestAnimationFrame(()=>{
      const heading=document.querySelector('#publicProducts [data-catalog-heading]');heading?.focus({preventScroll:true});
      document.getElementById('publicProducts')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
  }
  const renderCatalog = () => {
    const host = document.getElementById('publicProducts');
    if (!host) return;
    const families=groupCatalog(db.products),family=families.find(item=>item.key===catalogLocation.family);
    if(!family){catalogLocation.family='';catalogLocation.group='';}
    let group=family?.groups.find(item=>item.key===catalogLocation.group);
    if(!group)catalogLocation.group='';
    const direct=family && (family.key==='signs'||family.key==='lighting'||family.groups.length===1);
    if(direct && family.groups.length===1)group=family.groups[0];
    const products=group?.items || (direct?family.items:null);
    const heading=group && !direct?group.name:family?.name || 'Explore por categoria';
    const summary=products?`${catalogCount(products.length,'opção disponível','opções disponíveis')}. Escolha o peso, modelo ou especificação desejada.`:family?`${catalogCount(family.groups.length,'tipo disponível','tipos disponíveis')}. Selecione uma linha para ver as opções.`:'Selecione uma categoria para conhecer os tipos e modelos disponíveis.';
    const crumbs=`<nav class="catalog-breadcrumb" aria-label="Navegação do catálogo">${family?'<button type="button" class="btn btn-soft btn-small" data-catalog-home>← Todas as categorias</button>':'<span>Catálogo de produtos</span>'}${family && group && !direct?`<span aria-hidden="true">/</span><button type="button" class="btn btn-soft btn-small" data-catalog-family="${family.key}">${esc(family.name)}</button>`:''}${family?`<span aria-current="page">${esc(heading)}</span>`:''}</nav>`;
    let cards;
    if(products)cards=products.map(product=>`<article class="catalog-card" data-catalog-option="${esc(product.id)}"><div class="catalog-media">${window.protecArtwork.media(product)}</div><div class="catalog-body"><span class="catalog-category">${esc(group?.name || family.name)}</span><h3>${esc(catalogVariant(product,family.key))}</h3>${catalogVariant(product,family.key)!==product.name?`<p class="catalog-product-name">${esc(product.name)}</p>`:''}<p>${esc(product.description || product.type || 'Equipamento de prevenção')}${product.model?` · ${esc(product.model)}`:''}</p><button class="btn btn-small" type="button" data-catalog-product="${esc(product.id)}">Solicitar orçamento</button></div></article>`).join('');
    else if(family)cards=family.groups.map(item=>`<article class="catalog-card"><div class="catalog-media">${window.protecArtwork.media(item.items[0])}</div><div class="catalog-body"><span class="catalog-category">${esc(family.name)}</span><h3>${esc(item.name)}</h3><p>${catalogCount(item.items.length,'opção','opções')} de peso, capacidade ou modelo.</p><button class="btn btn-small" type="button" data-catalog-group="${esc(item.key)}">Ver opções <span aria-hidden="true">→</span></button></div></article>`).join('');
    else cards=families.map(item=>`<article class="catalog-card"><div class="catalog-media">${window.protecArtwork.artwork(item.art)}</div><div class="catalog-body"><span class="catalog-category">${catalogCount(item.items.length,'opção','opções')}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><button class="btn btn-small" type="button" data-catalog-family="${item.key}">Explorar ${esc(item.name.toLowerCase())} <span aria-hidden="true">→</span></button></div></article>`).join('');
    host.className='catalog-browser';
    host.innerHTML=families.length?`${crumbs}<div class="catalog-browser-heading"><h3 data-catalog-heading tabindex="-1">${esc(heading)}</h3><p aria-live="polite">${esc(summary)}</p></div><div class="products catalog-grid">${cards}</div>`:'<div class="empty">O catálogo está sendo atualizado. Fale com a equipe para solicitar informações.</div>';
    host.querySelector('[data-catalog-home]')?.addEventListener('click',()=>navigateCatalog());
    host.querySelectorAll('[data-catalog-family]').forEach(button=>button.addEventListener('click',()=>navigateCatalog(button.dataset.catalogFamily)));
    host.querySelectorAll('[data-catalog-group]').forEach(button=>button.addEventListener('click',()=>navigateCatalog(family.key,button.dataset.catalogGroup)));
    host.querySelectorAll('[data-catalog-product]').forEach(button => button.addEventListener('click', () => quote((db.products || []).find(product => product.id === button.dataset.catalogProduct && product.catalogEnabled!==false))));
  };
  window.protecCatalog={group:groupCatalog,navigate:navigateCatalog,location:()=>({...catalogLocation})};
  const originalRenderPublic = window.renderPublic;
  window.renderPublic = function() { originalRenderPublic?.apply(this, arguments); renderCatalog(); };
  window.addToCart = () => toast('Este catálogo é exclusivo para consulta. Solicite um orçamento à equipe.');
  window.openCart = () => toast('Compras online foram removidas. Solicite um orçamento para receber atendimento personalizado.');
  window.openCustomerAuth = () => toast('A área de cliente foi removida. Use o catálogo para solicitar um orçamento.');
  window.openCustomerAccount = window.openCustomerAuth;

  const catalogAdmin = host => {
    const products = db.products || [], active = products.filter(product => product.catalogEnabled !== false).length;
    host.innerHTML = `<div class="page-title"><div><div class="eyebrow">Catálogo profissional</div><h1>Produtos em catálogo</h1><p>Organize grupos, pesos, modelos, imagens e visibilidade das opções do catálogo.</p></div><button class="btn btn-small" onclick="openProduct()">＋ Adicionar produto</button></div><div class="panel"><div class="panel-head"><div><h3>${active} produto(s) ativo(s)</h3><p>${products.length - active} item(ns) oculto(s) da vitrine.</p></div><button class="btn btn-soft btn-small" onclick="showStore('home')">Ver catálogo ↗</button></div>${products.length ? `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Imagem</th><th>Vitrine</th><th>Ações</th></tr></thead><tbody>${products.map(product => `<tr><td><strong>${esc(product.name)}</strong><small>${esc(product.model || product.type || 'Sem referência')}</small></td><td>${esc(product.category || 'Catálogo')}</td><td><span class="product-reference-label">${window.protecArtwork.media(product,'small')}<span>${product.referenceStyle==='photo' && product.image ? 'Foto cadastrada' : 'Ilustração padronizada'}</span></span></td><td><label class="catalog-admin-status"><input type="checkbox" ${product.catalogEnabled !== false ? 'checked' : ''} onchange="toggleCatalogProduct('${esc(product.id)}',this.checked)">${product.catalogEnabled !== false ? 'Ativo' : 'Oculto'}</label></td><td><button class="icon-btn" onclick="editProduct('${esc(product.id)}')">Editar</button> <button class="icon-btn" onclick="del('products','${esc(product.id)}')">Excluir</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum produto cadastrado no catálogo.</div>'}</div>`;
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
    const body = `<div class="form-grid">${field('Nome do produto','name',{required:true})}${field('Categoria','category',{options:categoryOptions.map(value => ({value,label:value}))})}${field('Tipo / especificação','type')}${field('Modelo ou referência','model')}${field('Código / SKU','sku')}${field('Descrição','description',{cls:'span2'})}${catalogOptionFields()}${window.protecArtwork.editorFields()}<div class="form-field span2"><label>URL da imagem de referência</label><input name="imageUrl" type="url" placeholder="https://exemplo.com/imagem.jpg"><small>Opcional. Para exibir uma foto, selecione “Foto cadastrada” no estilo da referência. A ilustração funciona sem enviar arquivos.</small></div><div class="form-field span2"><label>Enviar imagem</label><label class="upload">Selecionar imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div><label class="form-field span2"><span><input name="catalogEnabled" type="checkbox" checked> Exibir este produto no catálogo público</span></label></div>`;
    openModal('Adicionar produto ao catálogo', body, async form => {
      const product = {id:id(),name:val(form,'name'),category:val(form,'category'),type:val(form,'type'),kg:'',model:val(form,'model'),sku:val(form,'sku'),description:val(form,'description'),price:0,image:await imageSource(form),video:'',catalogEnabled:form.get('catalogEnabled') === 'on'};
      Object.assign(product,window.protecArtwork.editorValues(form,product.image),catalogOptionValues(form));
      db.products = db.products || []; db.products.push(product);
      if (!await save()) { db.products = db.products.filter(item => item.id !== product.id); saveLocal(); return false; }
      window.renderPage('products'); window.renderPublic(); toast('Produto adicionado ao catálogo.');
    });
    window.protecArtwork.bindEditor();
  };
  window.editProduct = function(id) {
    const product = (db.products || []).find(item => item.id === id); if (!product) return;
    const body = `<div class="form-grid">${field('Nome do produto','name',{required:true,value:product.name})}${field('Categoria','category',{options:categoryOptions.map(value => ({value,label:value,selected:value === product.category}))})}${field('Tipo / especificação','type',{value:product.type})}${field('Modelo ou referência','model',{value:product.model})}${field('Código / SKU','sku',{value:product.sku})}${field('Descrição','description',{cls:'span2',value:product.description})}${catalogOptionFields(product)}${window.protecArtwork.editorFields(product)}<div class="form-field span2"><label>Nova URL da imagem</label><input name="imageUrl" type="url" placeholder="Mantenha vazio para preservar a imagem atual"></div><div class="form-field span2"><label>Atualizar imagem por arquivo</label><label class="upload">Selecionar imagem<input type="file" hidden accept="image/*" name="imageFile"></label></div><label class="form-field span2"><span><input name="catalogEnabled" type="checkbox" ${product.catalogEnabled !== false ? 'checked' : ''}> Exibir no catálogo público</span></label></div>`;
    openModal('Editar produto do catálogo', body, async form => {
      const image = await imageSource(form);
      const reference=window.protecArtwork.editorValues(form,image || product.image);
      Object.assign(product,reference,catalogOptionValues(form));
      product.name = val(form,'name'); product.category = val(form,'category'); product.type = val(form,'type'); product.model = val(form,'model'); product.sku = val(form,'sku'); product.description = val(form,'description'); product.catalogEnabled = form.get('catalogEnabled') === 'on'; if (image) product.image = image;
      if (!await save()) return false;
      window.renderPage('products'); window.renderPublic(); toast('Produto atualizado.');
    });
    window.protecArtwork.bindEditor(product);
  };
  setTimeout(() => { window.renderPublic(); document.querySelectorAll('#customerCartButton,#customerAccountButton').forEach(node => node.remove()); }, 0);
})();
