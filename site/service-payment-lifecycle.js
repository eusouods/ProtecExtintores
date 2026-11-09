/* Automatic annual maintenance scheduling and customer service payment timing. */
(() => {
  'use strict';

  const monthFromDate = value => {
    const match = String(value || '').match(/^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/);
    return match ? `${Number(match[1]) + 1}-${match[2]}` : '';
  };

  function configureSchedule(form) {
    if (!form || form.dataset.automaticMaintenanceSchedule === 'true') return;
    const date = form.elements?.date;
    const next = form.elements?.nextMaintenanceMonth;
    if (!date || !next) return;
    form.dataset.automaticMaintenanceSchedule = 'true';
    next.readOnly = true;
    next.setAttribute('aria-readonly', 'true');
    next.setAttribute('aria-describedby', 'automaticMaintenanceHelp');
    const label = form.querySelector(`label[for="${next.id}"]`) || next.closest('.form-field')?.querySelector('label');
    if (label) label.textContent = 'Próxima manutenção calculada';
    let help = form.querySelector('#automaticMaintenanceHelp');
    if (!help) {
      help = document.createElement('small');
      help.id = 'automaticMaintenanceHelp';
      help.className = 'helper';
      next.closest('.form-field')?.append(help);
    }
    help.textContent = 'Calculada automaticamente para o mesmo mês do próximo ano, a partir da data deste serviço.';
    const sync = () => { next.value = monthFromDate(date.value); };
    date.addEventListener('input', sync);
    date.addEventListener('change', sync);
    sync();
  }

  function configureOpenForm() {
    setTimeout(() => configureSchedule(document.querySelector('#modalRoot #editForm') || document.querySelector('#modalRoot form')), 0);
  }

  function wrapFormOpener(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__autoMaintenanceWrapped) return;
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      configureOpenForm();
      return result;
    };
    wrapped.__autoMaintenanceWrapped = true;
    window[name] = wrapped;
  }

  function backfillVisibleSchedule() {
    if (typeof db === 'undefined' || !Array.isArray(db.services)) return;
    for (const service of db.services) {
      if (!service.nextMaintenanceMonth) service.nextMaintenanceMonth = monthFromDate(service.date);
    }
  }

  window.copyCheckoutPix = async function () { const value=document.getElementById('checkoutPixPayload')?.value||''; if(!value)return; try{await navigator.clipboard.writeText(value);window.toast?.('Pix copia e cola copiado.')}catch{window.prompt('Copie o Pix copia e cola:',value)} };

  wrapFormOpener('openService');
  wrapFormOpener('openTeamMaintenanceForm');

  if (typeof window.renderNextMaintenancePage === 'function') {
    const original = window.renderNextMaintenancePage;
    window.renderNextMaintenancePage = function (...args) {
      backfillVisibleSchedule();
      return original.apply(this, args);
    };
  }

  const root = document.getElementById('modalRoot');
  if (root) new MutationObserver(() => configureSchedule(root.querySelector('#editForm') || root.querySelector('form')))
    .observe(root, { childList: true, subtree: true });
})();
