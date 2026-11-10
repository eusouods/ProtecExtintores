/* Carrega a camada visual e funcional do catálogo antes do registro do PWA. */
(() => {
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = './catalog-professional.css?v=1';
  document.head.appendChild(stylesheet);
  const catalog = document.createElement('script');
  catalog.src = './catalog-professional.js?v=1';
  document.body.appendChild(catalog);
})();

/* Registra o service worker apenas em HTTPS (ou localhost). */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
})();
