/* Preserva sessão e dados locais criados antes do rebranding. */
(() => {
  'use strict';
  const legacy = ['fogo', 'seguro'].join('');
  const current = 'protecextintores';
  const suffixes = ['_db_v1', '_session', '_role', '_username', '_customer_session', '_service_contact_handoff'];
  for (const store of [localStorage, sessionStorage]) {
    for (const suffix of suffixes) {
      const oldKey = legacy + suffix;
      const newKey = current + suffix;
      try {
        if (store.getItem(newKey) === null && store.getItem(oldKey) !== null) store.setItem(newKey, store.getItem(oldKey));
      } catch { /* Armazenamento pode estar indisponível em navegação privada. */ }
    }
    try {
      const oldRoute = '__' + legacy + 'PendingRoute';
      const newRoute = '__protecPendingRoute';
      if (store.getItem(newRoute) === null && store.getItem(oldRoute) !== null) store.setItem(newRoute, store.getItem(oldRoute));
    } catch { /* Sem ação necessária. */ }
  }
})();

/* Identidade oficial fornecida pela empresa: a mesma marca nos dois temas. */
(() => {
  'use strict';
  const assetRoot=new URL('./',document.currentScript.src);
  const identity='official-logo-19',relative='icons/company-logo.png?v=registration-recovery-26';
  const official=new URL(relative,assetRoot).href;
  let current=official,scheduled=false;
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function image(size=42,alt=''){
    size=Math.max(16,Math.min(160,Number(size)||42));
    return `<img class="company-logo" src="${escape(current)}" alt="${escape(alt)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;vertical-align:middle;display:inline-block" decoding="async">`;
  }
  function apply(){
    if(!document.body)return;
    for(const header of document.querySelectorAll('.employee-top,.seller-top')){
      if(header.querySelector('.company-team-brand'))continue;
      const title=header.querySelector(':scope > b,:scope > div:not(.employee-header-actions)');if(!title)continue;
      const group=document.createElement('div');group.className='company-team-brand';
      const mark=document.createElement('span');mark.className='brand-mark';mark.setAttribute('aria-hidden','true');
      title.before(group);group.append(mark,title);
    }
    for(const crumb of document.querySelectorAll('.admin-top .crumb')){
      if(crumb.querySelector('.company-admin-logo'))continue;
      const mark=document.createElement('span');mark.className='brand-mark company-admin-logo';mark.setAttribute('aria-hidden','true');crumb.prepend(mark);
    }
    for(const section of document.querySelectorAll('.offline-locked')){
      if(section.querySelector('.company-access-logo'))continue;
      const mark=document.createElement('div');mark.className='company-access-logo';mark.innerHTML=image(76,'ProtecExtintores');section.prepend(mark);
    }
    for(const mark of document.querySelectorAll('.brand-mark')){
      let logo=mark.querySelector(':scope > img.company-logo');
      if(!logo){mark.innerHTML=image();logo=mark.firstElementChild;}
      if(logo.src!==current)logo.src=current;
    }
    for(const logo of document.querySelectorAll('img.company-logo'))if(logo.src!==current)logo.src=current;
  }
  function setSettings(settings){
    if(settings){
      if(settings.logoIdentity!==identity){settings.logo=relative;settings.logoIdentity=identity;}
      try{
        const url=new URL(settings.logo || relative,assetRoot);
        current=['https:','http:','blob:'].includes(url.protocol)||/^data:image\//i.test(url.href)?url.href:official;
      }catch{current=official;}
    }
    apply();
  }
  window.protecBrand={identity,official,get url(){return current},image,setSettings,apply};
  document.addEventListener('error',event=>{if(event.target.matches?.('img.company-logo')&&event.target.src!==official)event.target.src=official},true);
  const start=()=>{
    apply();new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}).observe(document.body,{childList:true,subtree:true});
  };
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
