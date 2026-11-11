/* Tema vibrante único, carregado após os módulos funcionais. */
(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('./theme-system.css?v=vibrant-13.1', document.currentScript.src).href;
  link.id = 'protec-theme-system';
  document.head.append(link);
  const decorateStatuses = root => {
    if(!root)return;
    const selector='.status,.admin-record-status,.badge';
    const elements=root instanceof Element&&root.matches(selector)?[root,...root.querySelectorAll(selector)]:root.querySelectorAll?.(selector)||[];
    for(const element of elements){const label=element.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const state=/cancel|pend|revis|aguard|venc|atras|erro/.test(label)?'warning':/finaliz|conclu|pago|quitad|confirm/.test(label)?'success':'active';if(element.dataset.state!==state)element.dataset.state=state}
  };
  decorateStatuses(document);
  new MutationObserver(records=>records.forEach(record=>{if(record.type==='characterData')decorateStatuses(record.target.parentElement);else{decorateStatuses(record.target);record.addedNodes.forEach(node=>{if(node.nodeType===1)decorateStatuses(node)})}})).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
