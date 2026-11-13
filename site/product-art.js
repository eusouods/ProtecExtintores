/* Ilustrações vetoriais de referência. Uma única família visual, sem downloads externos. */
(() => {
  'use strict';
  const drawings = {
    extinguisher: ['Extintor', '<path d="M14 5V3a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v2m4-2h4M8 10V9a5 5 0 0 1 2-4M6 13V9a7 7 0 0 1 4-6M6 13h4M6 13v7"/><path d="M10 10a4 4 0 0 1 8 0v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2Z"/><path d="M10 18h8"/>'],
    co2: ['Extintor CO₂', '<path d="M11 5V3h4m-4 0H8m5 0v3m-2 0a4 4 0 0 0-4 4v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V10a4 4 0 0 0-4-4Zm4-1c4 0 5 2 5 5m-1 0-2 6h5l-1-6ZM7 18h8"/>'],
    water: ['Extintor de água', '<path d="M10 5V2h4v3m0-2h4M8 7a4 4 0 0 1 8 0v13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2ZM8 8H5v9"/><path d="M12 11s-2 2.4-2 3.5a2 2 0 0 0 4 0C14 13.4 12 11 12 11Z"/>'],
    sign: ['Placa de sinalização', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 12h11m-4-4 4 4-4 4M7 5V3m10 2V3"/>'],
    signLeft: ['Placa com seta à esquerda', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M18 12H7m4-4-4 4 4 4M7 5V3m10 2V3"/>'],
    signExtinguisher: ['Placa de localização de extintor', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M11 8V6h3m-2 0v2m-1 0a2 2 0 0 0-2 2v6h6v-6a2 2 0 0 0-2-2ZM9 13h6M9 8H7v7"/>'],
    signHydrant: ['Placa de localização de hidrante', '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="11" cy="11" r="4"/><circle cx="11" cy="11" r="1.5"/><path d="M11 15h5V7"/>'],
    signAlarm: ['Placa de alarme', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 13v-3a4 4 0 0 1 8 0v3l1 2H7Zm3 3h2"/>'],
    noSmoking: ['Placa de proibição de fumar', '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m6 6 12 12M6 13h12v3H6Zm9-7v2m3-1v3"/>'],
    stairs: ['Placa de escada', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 16h4v-4h4V8h4M6 8h3m-1-1 1 1-1 1"/>'],
    warning: ['Placa de alerta', '<path d="M10.3 4a2 2 0 0 1 3.4 0l7.6 13a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3ZM12 9v4m0 3h.01"/>'],
    hose: ['Mangueira de incêndio', '<circle cx="10" cy="11" r="7"/><circle cx="10" cy="11" r="3"/><path d="M10 18h7a4 4 0 0 0 4-4V6m-2-3h4v3h-4ZM3 20h14"/>'],
    nozzle: ['Esguicho ou difusor', '<path d="m4 17 5-5 3 3-5 5ZM8 11l3-3 5 5-3 3ZM10 7l3-3 7 7-3 3Zm6-2 3-3m0 5 3-3"/>'],
    light: ['Iluminação de emergência', '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M7 9V6l-2-2m12 5V6l2-2M7 14h3m4 0h3M9 20v2m6-2v2M12 2v3M3 8 1 7m20 1 2-1"/>'],
    valve: ['Válvula', '<path d="M4 9h16M7 6v6m10-6v6M12 4v5m0 0v8m-4 0h8v4H8ZM3 3h8m3 6 4-4h3"/><circle cx="12" cy="11" r="2"/>'],
    valveCo2: ['Válvula de CO₂', '<path d="M3 5h12m-8 0v4m6-4v4M6 10h10v7H6ZM16 12h5v3h-5M9 17v4h4v-4M4 8v5H2"/><path d="m15 5 4-3"/>'],
    gauge: ['Manômetro', '<circle cx="12" cy="10" r="8"/><path d="M12 10l4-4M6 10h1m5-6v1m5 5h1m-9 8v4h6v-4"/><circle cx="12" cy="10" r="1"/>'],
    siphon: ['Sifão', '<path d="M7 21V7a5 5 0 0 1 10 0v5m-6 9V7a1 1 0 0 1 2 0v5m0 0h4m-10 9h4"/>'],
    seal: ['Anel de vedação ou lacre', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m17 5 2-2m-1 3 3-1"/>'],
    bracket: ['Suporte', '<path d="M6 3v17h12v-5m-8 1h5V6H9M4 7h4m-4 5h4"/><circle cx="6" cy="5" r=".5"/><circle cx="6" cy="17" r=".5"/>'],
    wrench: ['Chave Storz ou ferramenta', '<path d="M14 3a6 6 0 0 0-7 8L3 17a2.8 2.8 0 0 0 4 4l6-5a6 6 0 0 0 8-7l-4 4-4-4 4-4Z"/>'],
    cabinet: ['Abrigo de hidrante', '<rect x="4" y="2" width="16" height="20" rx="2"/><rect x="7" y="5" width="10" height="11" rx="1"/><circle cx="12" cy="10" r="3"/><path d="M10 19h4"/>'],
    alarm: ['Alarme de incêndio', '<path d="M6 15v-5a6 6 0 0 1 12 0v5l2 3H4ZM10 21h4M12 2V1M3 5 1 3m20 2 2-2"/>'],
    sprinkler: ['Sprinkler', '<path d="M8 2h8v4H8Zm2 4v6m4-6v6m-7 0h10m-5 0v4m-5 0h10m-10 3-2 3m7-3v3m5-3 2 3"/>'],
    door: ['Porta corta-fogo', '<path d="M4 22V3h15v19M7 22V5l9 2v15ZM12 14h.01M2 22h20"/>'],
    equipment: ['Equipamento ou peça', '<path d="m12 3 9 5-9 5-9-5Zm-9 5v9l9 5 9-5V8m-9 5v9M8 5l9 5"/>']
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/₂/g,'2').toLowerCase();
  function infer(product={}) {
    if (drawings[product.illustrationKind]) return product.illustrationKind;
    const specific=text([product.name,product.type,product.model].filter(Boolean).join(' '));
    const category=text(product.category);
    if (/placa|sinaliza/.test(specific) || /placa|sinaliza/.test(category)) {
      if (/fumar/.test(specific)) return 'noSmoking';
      if (/extintor/.test(specific)) return 'signExtinguisher';
      if (/hidrante/.test(specific)) return 'signHydrant';
      if (/alarme/.test(specific)) return 'signAlarm';
      return /esquerda/.test(specific)?'signLeft':/escada/.test(specific)?'stairs':/perigo|risco|proibid/.test(specific)?'warning':'sign';
    }
    if (/valvula/.test(specific)) return /co.?2|carbono/.test(specific)?'valveCo2':'valve';
    if (/manometro/.test(specific)) return 'gauge';
    if (/sifao/.test(specific)) return 'siphon';
    if (/difusor|esguicho/.test(specific)) return 'nozzle';
    if (/anel|vedac|lacre|oring|o-ring/.test(specific)) return 'seal';
    if (/suporte/.test(specific)) return 'bracket';
    if (/chave|storz|ferramenta/.test(specific)) return 'wrench';
    if (/abrigo/.test(specific)) return 'cabinet';
    if (/ilumina|luminaria|bloco autonomo|lampada|luz de emergencia/.test(specific+' '+category)) return 'light';
    if (/sprinkler|aspersor/.test(specific)) return 'sprinkler';
    if (/alarme|acionador|detector/.test(specific)) return 'alarm';
    if (/porta.*fogo/.test(specific)) return 'door';
    if (/mangueira|hidrante/.test(specific+' '+category)) return 'hose';
    if (/extintor|quimico|abc|co.?2|carbono|pressurizada/.test(specific+' '+category)) return /co.?2|carbono/.test(specific)?'co2':/agua|pressurizada/.test(specific)?'water':'extinguisher';
    return 'equipment';
  }
  function artwork(product={},size='large') {
    const kind=infer(product),[label,paths]=drawings[kind];
    const scale=['large','small','tiny'].includes(size)?size:'large';
    const accessibility=scale==='large'?`role="img" aria-label="${escape(label)} — ilustração de referência"`:'aria-hidden="true"';
    return `<span class="product-art product-art-${scale}" data-art-kind="${kind}" ${accessibility}><span class="product-art-disc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg></span></span>`;
  }
  function media(product={},size='large') {
    if (product.referenceStyle==='photo' && product.image) return `<span class="product-photo product-photo-${size}"><img src="${escape(product.image)}" alt="${escape(product.name || 'Produto')}" loading="lazy" data-product-photo></span>`;
    return artwork(product,size);
  }
  function editorFields(product={}) {
    const style=product.referenceStyle==='photo'?'photo':'illustration';
    return `<div class="form-field"><label for="productReferenceStyle">Estilo da imagem de referência</label><select name="referenceStyle" id="productReferenceStyle"><option value="illustration" ${style==='illustration'?'selected':''}>Ilustração padronizada</option><option value="photo" ${style==='photo'?'selected':''}>Foto cadastrada</option></select></div><div class="form-field"><label for="productIllustrationKind">Desenho do produto</label><select name="illustrationKind" id="productIllustrationKind"><option value="auto">Identificar pelo nome e categoria</option>${Object.entries(drawings).map(([key,[label]])=>`<option value="${key}" ${product.illustrationKind===key?'selected':''}>${label}</option>`).join('')}</select></div><div class="product-art-editor span2" data-art-preview aria-live="polite"></div>`;
  }
  function editorValues(form,image) {
    const referenceStyle=form.get('referenceStyle')==='photo'?'photo':'illustration';
    if (referenceStyle==='photo' && !image) throw Error('Envie uma foto, informe a URL ou selecione a ilustração padronizada.');
    const kind=form.get('illustrationKind') || document.getElementById('editForm')?.elements.illustrationKind?.value;
    return {referenceStyle,illustrationKind:drawings[kind]?kind:'auto'};
  }
  function bindEditor(product={}) {
    const form=document.getElementById('editForm'),preview=form?.querySelector('[data-art-preview]');if(!preview)return;
    let photo=product.image || '',temporary='';
    const update=()=>{
      const data=new FormData(form),next={...product,name:data.get('name'),category:data.get('category'),type:data.get('type'),referenceStyle:data.get('referenceStyle'),illustrationKind:form.elements.illustrationKind.value,image:photo};
      form.elements.illustrationKind.disabled=next.referenceStyle==='photo';
      preview.innerHTML=media(next,'small')+`<div><strong>${escape(next.name || 'Referência do produto')}</strong><small>${next.referenceStyle==='photo'?'Foto cadastrada':'Ilustração de referência · não substitui a ficha técnica'}</small></div>`;
    };
    form.addEventListener('input',event=>{if(event.target.name==='imageUrl')photo=event.target.value.trim() || product.image || '';update()});
    form.addEventListener('change',event=>{if(event.target.name==='imageFile'){if(temporary)URL.revokeObjectURL(temporary);temporary=event.target.files[0]?URL.createObjectURL(event.target.files[0]):'';photo=temporary || product.image || '';}update()});
    new MutationObserver((_,observer)=>{if(!form.isConnected){if(temporary)URL.revokeObjectURL(temporary);observer.disconnect()}}).observe(document.getElementById('modalRoot'),{childList:true});
    update();
  }
  document.addEventListener('error',event=>{
    if(!event.target.matches?.('[data-product-photo]'))return;
    const image=event.target,wrapper=document.createElement('span');wrapper.innerHTML=artwork({name:image.alt},image.closest('.product-photo-small')?'small':'large');image.parentElement.replaceWith(wrapper.firstElementChild);
  },true);
  window.protecArtwork={infer,artwork,media,editorFields,editorValues,bindEditor,options:Object.keys(drawings)};
  document.querySelectorAll('[data-feature-art]').forEach(host=>{host.innerHTML=artwork({name:'Extintor ABC'});});
})();
