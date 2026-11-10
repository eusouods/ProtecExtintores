/* Alternância global e persistente de tema claro/escuro. */
(() => {
  'use strict';
  const key = 'protec-theme-mode';
  let mode = 'light';
  try { mode = localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch {}

  function host() {
    const selectors = [
      '#modalRoot .customer-panel-tabs',
      '#dashboard.app:not(.hidden) .admin-top-right',
      '.employee-portal:not(.hidden) .employee-header-actions',
      '.employee-portal:not(.hidden) .employee-top',
      '.seller-top .employee-header-actions',
      '.seller-top',
      '#login.admin-entry:not(.hidden) .login-main',
      '#store:not(.hidden) .topbar'
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return document.body;
  }

  function apply() {
    document.documentElement.dataset.theme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = mode === 'dark' ? '#111827' : '#e11d48';
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    const dark = mode === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
    const markup = dark ? '<span aria-hidden="true">☀</span><span>Tema claro</span>' : '<span aria-hidden="true">◐</span><span>Tema escuro</span>';
    if (button.innerHTML !== markup) button.innerHTML = markup;
  }

  function mount() {
    if (!document.body) return;
    const parent = host();
    let button = document.querySelector('.theme-toggle');
    if (button && button.parentElement !== parent) {
      if (parent === document.body) return;
      button.remove();
      button = null;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-toggle';
      button.addEventListener('click', () => {
        mode = mode === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, mode); } catch {}
        apply();
      });
      parent.append(button);
    }
    apply();
  }

  function start() {
    apply();
    mount();
    if (document.body) new MutationObserver(() => mount()).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    window.addEventListener('storage', event => {
      if (event.key !== key) return;
      mode = event.newValue === 'dark' ? 'dark' : 'light';
      apply();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
