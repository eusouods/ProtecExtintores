/* Alternância global e persistente de tema claro/escuro. */
(() => {
  'use strict';
  const key = 'protec-theme-mode';
  const assetRoot=new URL('./',document.currentScript.src);
  const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
  let mode = systemTheme.matches ? 'dark' : 'light';
  try { const saved=localStorage.getItem(key);if(saved==='dark'||saved==='light')mode=saved; } catch {}

  function host() {
    const selectors = [
      '#modalRoot .customer-panel-tabs',
      '#dashboard.app:not(.hidden) .admin-top-right',
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
    if (meta) meta.content = mode === 'dark' ? '#1d1815' : '#edf4fa';
    const appleBar=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(appleBar)appleBar.content=mode==='dark'?'black-translucent':'default';
    document.querySelectorAll('link[rel=icon],link[rel=apple-touch-icon]').forEach(link=>{const icon=link.rel==='apple-touch-icon'?'icon-192':link.sizes.value==='16x16'?'favicon-16':'favicon-32';const href=new URL('./icons/'+icon+'.png?v=session-restore-22',assetRoot).href;if(link.href!==href)link.href=href;});
    const manifest=document.querySelector('link[rel=manifest]'),manifestHref=new URL('./manifest'+(mode==='dark'?'-dark':'')+'.webmanifest?v=session-restore-22',assetRoot).href;if(manifest&&manifest.href!==manifestHref)manifest.href=manifestHref;
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
    systemTheme.addEventListener?.('change',event=>{try{if(localStorage.getItem(key))return;}catch{}mode=event.matches?'dark':'light';apply();});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
