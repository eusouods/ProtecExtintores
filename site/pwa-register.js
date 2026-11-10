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
