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
