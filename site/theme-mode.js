/* Alternância global e persistente de tema claro/escuro. */
(() => {
  'use strict';
  const key = 'protec-theme-mode';
  const assetRoot=new URL('./',document.currentScript.src);
  const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
  const validMode = value => value === 'dark' || value === 'light' ? value : null;
  const defaultMode = () => systemTheme.matches ? 'dark' : 'light';
  let savedMode = null;
  try { savedMode = validMode(localStorage.getItem(key)); } catch {}
  let mode = savedMode ?? defaultMode();

  function host() {
    const selectors = [
      '#modalRoot .customer-panel-tabs',
      '#dashboard.app:not(.hidden) .admin-top-right',
      '.employee-portal:not(.hidden) .ops-team-header',
      '.employee-portal:not(.hidden) .employee-header-actions',
      '.employee-portal:not(.hidden) .employee-top',
      '#employeePortal:not(.hidden) .seller-top .employee-header-actions',
      '#employeePortal:not(.hidden) .seller-top',
      '#login.admin-entry:not(.hidden) .login-main',
      '#store:not(.hidden) .topbar'
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.getClientRects().length) return element;
    }
    return document.body;
  }

  function apply() {
    if(document.documentElement.dataset.theme!==mode){document.documentElement.classList.add('theme-changing');document.documentElement.dataset.theme = mode;requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.classList.remove('theme-changing')));}
    document.documentElement.style.colorScheme=mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = mode === 'dark' ? '#1d293e' : '#e8eef8';
    const appleBar=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(appleBar)appleBar.content=mode==='dark'?'black-translucent':'default';
    document.querySelectorAll('link[rel=icon],link[rel=apple-touch-icon]').forEach(link=>{const icon=link.rel==='apple-touch-icon'?'icon-192':link.sizes.value==='16x16'?'favicon-16':'favicon-32';const href=new URL('./icons/'+icon+'.png?v=protec-interface-67',assetRoot).href;if(link.href!==href)link.href=href;});
    const manifest=document.querySelector('link[rel=manifest]'),manifestHref=new URL('./manifest'+(mode==='dark'?'-dark':'')+'.webmanifest?v=protec-interface-67',assetRoot).href;if(manifest&&manifest.href!==manifestHref)manifest.href=manifestHref;
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    const dark = mode === 'dark';
    button.setAttribute('aria-pressed', String(dark));
    button.setAttribute('aria-label', dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    button.title = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
    if (button.dataset.themePresentation === mode) return;
    const symbol = dark
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
      : '<path d="M20.7 14.2A8.6 8.6 0 0 1 9.8 3.3 9 9 0 1 0 20.7 14.2Z"/>';
    button.dataset.themePresentation = mode;
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${symbol}</svg>`;
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
        savedMode = mode;
        try { localStorage.setItem(key, savedMode); } catch {}
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
      if (event.key !== key && event.key !== null) return;
      savedMode = validMode(event.newValue);
      mode = savedMode ?? defaultMode();
      apply();
    });
    systemTheme.addEventListener?.('change', () => {
      if (savedMode) return;
      mode = defaultMode();
      apply();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
