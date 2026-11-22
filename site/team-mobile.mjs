// The mobile shell presents the existing team modules without replacing their controls.
const tabs = {
  employee: [
    ['overview', 'Painel', 'grid'],
    ['orders', 'Serviços', 'wrench'],
    ['agenda', 'Agenda', 'clock'],
    ['payments', 'Acertos', 'chart'],
    ['more', 'Mais', 'dots']
  ],
  seller: [
    ['overview', 'Painel', 'grid'],
    ['orders', 'Ordens', 'wrench'],
    ['agenda', 'Agenda', 'clock'],
    ['payments', 'Acertos', 'chart'],
    ['more', 'Mais', 'dots']
  ]
};

const paths = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z',
  clock: 'M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  chart: 'M5 19V11m6 8V5m6 14V8M3 20h18',
  dots: 'M5 12h.1M12 12h.1M19 12h.1',
  gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
  out: 'M9 4H5v16h4m7-12 4 4-4 4m4-4H9',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2 6m2-12v6h-6'
};

const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const options = [
  ['register', 'Nova ordem de serviço', 'plus'],
  ['refresh', 'Atualizar serviços', 'refresh'],
  ['theme', 'Alternar tema', 'gear'],
  ['logout', 'Sair da conta', 'out']
];

const root = typeof document === 'undefined' ? null : document.getElementById('employeePortal');
const mobile = root && matchMedia('(max-width: 650px)');
let account = '';
let current = 'overview';
let bar;
let sheet;
let queued = false;

function setSections(main) {
  const sectionFor = element => {
    if (element.matches('[data-workspace-heading], #opsTeamSummary, #employeePowderStock')) return 'overview';
    if (element.matches('#opsBillingWallet')) return 'payments';
    if (element.matches('#offlineToolbar')) return '';
    if (element.matches('#employeeCards, .seller-service-tabs') || element.querySelector('#sellerServices')) return 'orders';
    if (element.matches('.ops-team-register')) return 'overview';
    if (element.querySelector('[data-offline-workbench]')) return 'orders';
    return '';
  };
  for (const element of main.children) {
    const section = sectionFor(element);
    if (section && element.dataset.teamSection !== section) element.dataset.teamSection = section;
  }
  const title = main.querySelector(':scope > h1');
  if (title && main.querySelector('[data-workspace-heading]') && !title.hasAttribute('data-team-legacy-title')) {
    title.dataset.teamLegacyTitle = '';
    if (title.nextElementSibling?.tagName === 'P') title.nextElementSibling.dataset.teamLegacyTitle = '';
  }
}

function updatePill() {
  const active = bar?.querySelector('[aria-current="page"]');
  if (!active || !bar.offsetWidth) return;
  const pill = bar.firstElementChild;
  const bounds = bar.getBoundingClientRect();
  const target = active.getBoundingClientRect();
  pill.style.width = target.width + 'px';
  pill.style.height = target.height + 'px';
  pill.style.transform = `translate(${target.left - bounds.left - bar.clientLeft}px, ${target.top - bounds.top - bar.clientTop}px)`;
}

function show(tab) {
  if (tab === 'more') {
    const theme = root.querySelector('.theme-toggle');
    sheet.querySelector('[data-option="theme"]').hidden = !theme;
    sheet.querySelector('[data-option="register"]').hidden = !root.querySelector('[data-team-register]');
    bar.querySelector('[data-destination="more"]').setAttribute('aria-expanded', 'true');
    sheet.showModal();
    return;
  }
  if (tab === 'agenda' && !root.querySelector('#teamNextMaintenancePage')) return;
  current = tab;
  if (tab === 'agenda') window.openNextMaintenancePage?.(root.dataset.teamMobileRole);
  else window.closeNextMaintenancePage?.();
  sync();
  const section = root.querySelector(tab === 'agenda' ? '#teamNextMaintenancePage' : '.employee-main');
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    section?.animate([{ opacity: .55, transform: 'translateY(9px)' }, { opacity: 1, transform: 'none' }],
      { duration: 230, easing: 'cubic-bezier(.2,.75,.2,1)' });
  }
  window.scrollTo(0, 0);
}

function mount(role) {
  if (bar?.dataset.role === role && bar.isConnected && sheet?.isConnected) return;
  bar?.remove();
  sheet?.remove();
  bar = document.createElement('nav');
  bar.className = 'team-mobile-bar';
  bar.dataset.role = role;
  bar.setAttribute('aria-label', 'Navegação principal da equipe');
  bar.innerHTML = '<span class="team-mobile-pill" aria-hidden="true"></span>' +
    tabs[role].map(([id, label, mark]) => `<button type="button" data-destination="${id}" ${id === 'more' ? 'aria-haspopup="dialog" aria-expanded="false" aria-controls="teamMobileMore"' : ''}>${icon(mark)}<span>${label}</span></button>`).join('');
  bar.addEventListener('click', event => {
    const button = event.target.closest('[data-destination]');
    if (button) show(button.dataset.destination);
  });
  root.append(bar);

  sheet = document.createElement('dialog');
  sheet.id = 'teamMobileMore';
  sheet.className = 'team-mobile-more';
  sheet.setAttribute('aria-labelledby', 'teamMobileMoreTitle');
  sheet.innerHTML = '<header><h2 id="teamMobileMoreTitle">Mais</h2><form method="dialog"><button type="submit" autofocus aria-label="Fechar">×</button></form></header>' +
    options.map(([action, label, mark]) => `<button type="button" data-option="${action}"><span>${icon(mark)}</span>${label}</button>`).join('');
  sheet.addEventListener('close', () => bar.querySelector('[data-destination="more"]')?.setAttribute('aria-expanded', 'false'));
  sheet.addEventListener('click', event => {
    if (event.target === sheet) {
      const rect = sheet.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) sheet.close();
      return;
    }
    const action = event.target.closest('[data-option]')?.dataset.option;
    if (!action) return;
    sheet.close();
    if (action === 'theme') root.querySelector('.theme-toggle')?.click();
    if (action === 'register') root.querySelector('[data-team-register]')?.click();
    if (action === 'refresh') {
      if (role === 'employee') window.refreshEmployeePortal?.();
      else window.loadSellerServices?.();
    }
    if (action === 'logout') window.logout?.();
  });
  root.append(sheet);
}

function sync() {
  queued = false;
  const role = localStorage.getItem('protecextintores_role');
  const main = root.querySelector('.employee-main');
  if (!['employee', 'seller'].includes(role) || !main || root.classList.contains('hidden') || root.querySelector('[data-offline-locked]')) {
    if (sheet?.open) sheet.close();
    delete root.dataset.teamMobileRole;
    account = '';
    return;
  }
  const nextAccount = role + ':' + (localStorage.getItem('protecextintores_username') || '');
  if (account !== nextAccount) current = 'overview';
  account = nextAccount;
  root.dataset.teamMobileRole = role;
  const header = root.querySelector('.employee-top');
  if (header && !header.querySelector('[data-team-mobile-title]')) {
    const title = document.createElement('span');
    title.dataset.teamMobileTitle = '';
    title.innerHTML = '<span class="mobile-team-brand"><img src="./icons/company-logo.png" alt="">ProtecExtintores</span><b></b>';
    header.prepend(title);
  }
  mount(role);
  const agenda = root.querySelector('#teamNextMaintenancePage');
  if (current === 'agenda' && agenda?.classList.contains('hidden')) current = 'overview';
  else if (agenda && !agenda.classList.contains('hidden')) current = 'agenda';
  root.dataset.teamMobilePage = current;
  const title = root.querySelector('[data-team-mobile-title] b');
  const label = tabs[role].find(([id]) => id === current)[1];
  if (title && title.textContent !== label) title.textContent = label;
  setSections(main);
  for (const button of bar.querySelectorAll('[data-destination]')) {
    if (button.dataset.destination === current) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    if (button.dataset.destination === 'agenda') button.disabled = !agenda;
  }
  updatePill();
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(sync);
}

if (root) {
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  root.addEventListener('click', event => {
    if (!mobile.matches) return;
    if (event.target.closest('[data-ops-assigned], [data-team-last]')) show('orders');
  });
  window.addEventListener('resize', () => {
    if (!mobile.matches && sheet?.open) sheet.close();
    updatePill();
  });
  schedule();
}
