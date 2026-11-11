/* Tema único, carregado após os módulos funcionais. */
(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./neutral-theme.css?v=2', document.currentScript.src).href;
  link.id = 'protec-neutral-theme';
  document.head.append(link);
})();
