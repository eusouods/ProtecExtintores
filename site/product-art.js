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
  // Grade de 96 unidades: contorno, volume suave e detalhes secundários separados.
  const ground='<ellipse class="art-ground" cx="48" cy="85" rx="25" ry="3.5"/>';
  const label=(title,x=38,y=48,w=23,h=17)=>`<rect class="art-label" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.2"/><text class="art-letter art-fine" x="${x+w/2}" y="${y+h/2+2.3}" text-anchor="middle">${title}</text>`;
  const plate=symbol=>ground+`<path class="art-fill" d="M17 25h62a5 5 0 0 1 5 5v37a5 5 0 0 1-5 5H17a5 5 0 0 1-5-5V30a5 5 0 0 1 5-5Z"/><rect x="12" y="23" width="72" height="47" rx="5"/><rect class="art-detail" x="17" y="28" width="62" height="37" rx="2.5"/><circle class="art-dot" cx="19" cy="30" r="1"/><circle class="art-dot" cx="77" cy="30" r="1"/>${symbol}`;
  const powder=title=>ground+'<rect class="art-fill" x="34" y="29" width="30" height="53" rx="11"/><path d="M34 42V40c0-8 6-13 15-13s15 5 15 13v32c0 7-4 11-11 11h-8c-7 0-11-4-11-11Z"/><path class="art-detail" d="M39 43v25m0 5v2m-4 1h28"/><path class="art-fill-strong" d="M43 20h12v8H43z"/><path d="M43 20v8m12-8v8M40 17h22l4-4H44l-4 4Z"/><circle class="art-label" cx="39" cy="25" r="6"/><path class="art-detail" d="m39 25 2-2"/><path d="M57 24c15 0 21 6 21 19v18"/><path class="art-fill-strong" d="M74 59h8v16h-8z"/><path class="art-detail" d="M74 64h8m-8 7h8"/>'+label(title);
  const detailed={
    extinguisher:powder('ABC'),
    extinguisherBc:powder('BC'),
    co2:ground+'<path class="art-fill" d="M31 43c0-10 4-15 13-15s13 5 13 15v30c0 7-4 10-10 10h-6c-6 0-10-3-10-10Z"/><path d="M31 43c0-10 4-15 13-15s13 5 13 15v30c0 7-4 10-10 10h-6c-6 0-10-3-10-10Z"/><path class="art-detail" d="M36 45v25m-4 6h24"/><path class="art-fill-strong" d="M39 19h10v10H39z"/><path d="M35 16h24l3-4H37l-2 4Zm14 6c15 0 24 6 24 18"/><path class="art-fill" d="m68 39-7 27c7 4 16 4 23 0l-7-27Z"/><path class="art-detail" d="M65 58h15m-19 8c7-3 16-3 23 0"/>'+label('CO₂',35,48,18,17),
    water:ground+'<path class="art-fill" d="M34 41c0-9 5-14 15-14s15 5 15 14v31c0 7-4 11-11 11h-8c-7 0-11-4-11-11Z"/><path d="M34 41c0-9 5-14 15-14s15 5 15 14v31c0 7-4 11-11 11h-8c-7 0-11-4-11-11Z"/><path class="art-detail" d="M39 42v28m-4 7h28"/><path class="art-fill-strong" d="M43 19h12v9H43z"/><path d="M40 16h23l3-4H43l-3 4ZM56 23c15 0 21 6 21 20v20"/><path class="art-fill-strong" d="M73 61h8v14h-8z"/><rect class="art-label" x="38" y="45" width="23" height="23" rx="3"/><path class="art-fill-strong" d="M49.5 49s-6 7-6 10a6 6 0 0 0 12 0c0-3-6-10-6-10Z"/>',
    sign:plate('<path class="art-symbol" d="M28 46h37M54 35l12 11-12 11"/>'),
    signLeft:plate('<path class="art-symbol" d="M68 46H31m11-11L30 46l12 11"/>'),
    signExtinguisher:plate('<path class="art-fill" d="M41 42a8 8 0 0 1 16 0v16H41Z"/><path d="M41 42a8 8 0 0 1 16 0v16H41Zm4-8v-4h8m-3 0v4m-9 7h-6v14m6-5h16"/>'),
    signHydrant:plate('<circle class="art-fill" cx="45" cy="45" r="13"/><circle cx="45" cy="45" r="8"/><circle cx="45" cy="45" r="3"/><path d="M45 58h17c5 0 7-3 7-8V37m-3-4h6v7h-6Z"/>'),
    signAlarm:plate('<path class="art-fill" d="M37 48v-8a11 11 0 0 1 22 0v8l4 7H33Z"/><path d="M37 48v-8a11 11 0 0 1 22 0v8l4 7H33Zm7 12h8m-4-31v-3"/><path class="art-detail" d="m31 34-4-3m38 3 4-3"/>'),
    noSmoking:plate('<path class="art-fill" d="M29 48h38v7H29z"/><path d="M29 48h38v7H29Zm29 0v7"/><path class="art-detail" d="M55 42c-5-3 3-5 0-9m7 9c-5-3 3-5 0-9"/><circle cx="48" cy="46" r="18"/><path class="art-symbol" d="m35 33 26 26"/>'),
    stairs:plate('<path class="art-symbol" d="M27 60h12V49h12V38h15"/><path d="M29 36h13m-5-5 5 5-5 5"/>'),
    warning:ground+'<path class="art-fill" d="M44 17a4.5 4.5 0 0 1 8 0l30 53a4.5 4.5 0 0 1-4 7H18a4.5 4.5 0 0 1-4-7Z"/><path d="M44 17a4.5 4.5 0 0 1 8 0l30 53a4.5 4.5 0 0 1-4 7H18a4.5 4.5 0 0 1-4-7Z"/><path class="art-detail" d="M25 67 48 27l23 40"/><path class="art-symbol" d="M48 39v17"/><circle class="art-dot" cx="48" cy="65" r="2"/>',
    hose:ground+'<circle class="art-fill" cx="39" cy="46" r="27"/><circle cx="39" cy="46" r="21"/><circle class="art-detail" cx="39" cy="46" r="15"/><circle cx="39" cy="46" r="8"/><path d="M39 73h30c11 0 14-5 14-15V34"/><path class="art-fill-strong" d="M77 18h12v18H77z"/><path class="art-detail" d="M77 23h12m-12 7h12M17 76h48"/>',
    nozzle:ground+'<path class="art-fill" d="m20 68 10 10 31-32-10-10Z"/><path d="m20 68 10 10 31-32-10-10ZM18 64l16 16-6 6-16-16Z"/><path class="art-fill-strong" d="m51 36 10 10 18-12-16-16-12 18Z"/><path d="m62 18 5-5 17 17-5 5"/><path class="art-detail" d="m27 59 10 10m-4-16 10 10m-4-16 10 10m-4-16 10 10m12-18 8-8"/><path d="m43 43-2-8 10-10 7 1"/>',
    light:ground+'<rect class="art-fill" x="12" y="33" width="72" height="39" rx="6"/><rect x="18" y="39" width="60" height="24" rx="3"/><path d="M25 33v-5h10v5m26 0v-5h10v5m-31 41h16"/><circle class="art-dot" cx="69" cy="67" r="1.3"/>'+Array.from({length:12},(_,i)=>`<rect class="art-led" x="${25+(i%6)*8}" y="${44+Math.floor(i/6)*9}" width="4" height="4" rx="1"/>`).join('')+'<path class="art-detail art-fine" d="M48 15v7m-23-4 3 6m43-6-3 6M7 39l-5-3m87 3 5-3"/>',
    valve:ground+'<path class="art-fill" d="M35 38h27v21H35z"/><path d="M35 38h27v21H35Zm9-14v14m10-14v14M27 19h34l5 5H32l-5-5Z"/><path class="art-fill-strong" d="M43 59h13v21H43z"/><path class="art-detail" d="M43 65h13m-13 6h13m-13 5h13"/><circle class="art-label" cx="26" cy="45" r="10"/><path class="art-detail" d="m26 45 4-4"/><path d="M62 43h17v12H62m10-12v12m5-12v12"/>',
    valveCo2:ground+'<path class="art-fill" d="M34 38h28v22H34z"/><path d="M34 38h28v22H34Zm14-15v15M28 18h40m-35-4v8m10-8v8m10-8v8m10-8v8"/><path class="art-fill-strong" d="M42 60h13v21H42z"/><path class="art-detail" d="M42 66h13m-13 6h13m-13 5h13"/><path d="M62 43h18v12H62m11-12v12m5-12v12M34 46H23v8h11"/>',
    gauge:ground+'<circle class="art-fill" cx="48" cy="39" r="26"/><circle cx="48" cy="39" r="21"/><path class="art-detail" d="m31 39 4 1m0-13 3 3m10-10v5m13 2-3 3m7 9-4 1"/><path class="art-symbol" d="m48 40 12-12"/><circle class="art-dot" cx="48" cy="40" r="3"/><path class="art-fill-strong" d="M41 65h14v10H41z"/><path d="M44 75h8v8h-8"/><path class="art-detail" d="M44 79h8"/>',
    siphon:ground+'<path class="art-fill-strong" d="M38 13h20v14H38z"/><path class="art-detail" d="M38 17h20m-20 5h20"/><path class="art-fill" d="M43 27h10v51l-10 6Z"/><path d="M43 27v57l10-6V27"/><path class="art-detail" d="M47 31v42m-4 11 10-6"/>',
    seal:ground+'<path class="art-fill" fill-rule="evenodd" d="M79 47a31 25 0 1 1-62 0 31 25 0 1 1 62 0Zm-9 0a22 16 0 1 0-44 0 22 16 0 1 0 44 0Z"/><ellipse cx="48" cy="47" rx="31" ry="25"/><ellipse cx="48" cy="47" rx="22" ry="16"/><path class="art-detail" d="M24 39c4-8 12-12 22-12m12 2 6 3M72 57c-5 6-12 9-20 10"/>',
    bracket:ground+'<rect class="art-fill" x="30" y="12" width="18" height="68" rx="4"/><circle cx="39" cy="22" r="3"/><circle cx="39" cy="66" r="3"/><path class="art-fill-strong" d="M39 74h35v9H30v-9Z"/><path d="M47 42h20v13H47m20-13 7 5v12l-7 5H48"/><path class="art-detail" d="M34 34h9m-9 5h9"/>',
    bracketFloor:ground+'<ellipse class="art-fill" cx="48" cy="78" rx="27" ry="7"/><path d="M21 78v4c0 9 54 9 54 0v-4M44 32v44h8V32"/><path class="art-fill" d="M28 27c0-8 40-8 40 0v15c0 8-40 8-40 0Z"/><ellipse cx="48" cy="27" rx="20" ry="6"/><path class="art-detail" d="M33 43c8 4 22 4 30 0"/>',
    wrench:ground+'<path class="art-fill" d="M55 16c11-7 25-2 28 9l-9-3-10 11 3 9 11 3c-10 9-25 5-30-3L24 79a6 6 0 0 1-9-8l31-34c-3-8 1-16 9-21Z"/><path class="art-detail" d="m23 70 22-25m9-25 8 3m-6 17 8 2"/><circle class="art-detail" cx="22" cy="74" r="2"/>',
    cabinet:ground+'<path class="art-fill-strong" d="m70 14 7 5v63l-7-4Z"/><rect class="art-fill" x="21" y="12" width="49" height="66" rx="3"/><rect x="27" y="18" width="37" height="54" rx="2"/><rect class="art-label" x="32" y="24" width="27" height="24" rx="2"/><circle cx="44" cy="36" r="8"/><circle class="art-detail" cx="44" cy="36" r="4"/><path d="M44 44h11V32M60 54v8"/><path class="art-detail" d="M33 59h19m-19 5h19"/>',
    alarm:ground+'<path class="art-fill" d="M29 60V40a19 19 0 0 1 38 0v20l7 11H22Z"/><path d="M29 60V40a19 19 0 0 1 38 0v20l7 11H22Zm12 18h14m-7-57v-7"/><path class="art-detail" d="M35 40c0-7 3-11 9-13M17 31l-6-4m68 4 6-4M20 20l-4-5m60 5 4-5"/>',
    callpoint:ground+'<rect class="art-fill" x="23" y="17" width="50" height="61" rx="5"/><rect x="29" y="25" width="38" height="34" rx="3"/><circle class="art-fill-strong" cx="48" cy="42" r="10"/><path d="m39 42 9 5 9-5m-9-8v13"/><path class="art-detail" d="M34 67h28m-23 5h18"/>',
    detector:ground+'<path class="art-fill" d="M17 43v13c0 23 62 23 62 0V43Z"/><ellipse cx="48" cy="43" rx="31" ry="16"/><ellipse class="art-detail" cx="48" cy="43" rx="22" ry="10"/><path class="art-detail" d="M25 48v9m8-6v11m30-11v11m8-14v9"/><circle class="art-dot" cx="48" cy="43" r="2.5"/>',
    sprinkler:ground+'<path class="art-fill-strong" d="M40 12h16v14H40z"/><path class="art-detail" d="M40 17h16m-16 5h16"/><path d="m40 26-7 6 4 30h22l4-30-7-6ZM40 32v24m16-24v24"/><ellipse class="art-fill-strong" cx="48" cy="44" rx="4" ry="13"/><path d="M48 58v11"/><ellipse class="art-fill" cx="48" cy="72" rx="22" ry="4"/><path class="art-detail" d="M32 73v5m8-4v6m8-5v6m8-7v6m8-7v5"/>',
    door:ground+'<path class="art-fill-strong" d="M23 11h52v73H23z"/><rect class="art-fill" x="29" y="17" width="40" height="67" rx="1"/><path d="M21 84h56M30 31h-4m4 32h-4"/><rect class="art-label" x="37" y="45" width="25" height="5" rx="1"/><path d="M36 52h27M36 46v8m27-8v8"/><path class="art-detail" d="M40 24h19l5 6m-25 0 5-6m-10 53h29"/>',
    equipment:ground+'<path class="art-fill" d="m17 31 31-16 31 16v37L48 84 17 68Z"/><path d="m17 31 31 16 31-16M48 47v37M32 23l31 16v12"/><path class="art-detail" d="m25 54 13 7m-13 0 8 5"/>'
  };
  // Em listas densas, reduza o detalhe e preserve uma silhueta legível.
  drawings.extinguisher[1]='<rect x="7" y="7" width="9" height="15" rx="3"/><path d="M10 7V4h4v3M9 3h8l1-1h-8L9 3Zm5 2c5 0 7 2 7 6v4m-1 0h2v5h-2ZM9 17h5"/>';
  drawings.valve[1]='<rect x="8" y="10" width="9" height="6" rx="1"/><path d="M11 7v3m3-3v3M6 6h11l2-2H8L6 6Zm5 10v6h4v-6m2-5h5v4h-5M11 19h4"/><circle cx="5" cy="12" r="3"/>';
  drawings.valveCo2[1]='<rect x="7" y="10" width="10" height="6" rx="1"/><path d="M12 6v4M5 5h14M8 3v4m8-4v4m-7 9v6h6v-6m2-5h5v4h-5M9 19h6"/>';
  drawings.siphon[1]='<path d="M9 2h6v5H9Zm1 5v15l4-2V7M9 4h6"/>';
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
    let variant=kind;
    const description=text([product.name,product.type,product.model].filter(Boolean).join(' '));
    if(kind==='extinguisher'&&/\bbc\b/.test(description)&&!/\babc\b/.test(description))variant='extinguisherBc';
    if(kind==='bracket'&&/piso/.test(description))variant='bracketFloor';
    if(kind==='alarm'&&/acionador|manual/.test(description))variant='callpoint';
    if(kind==='alarm'&&/detector/.test(description))variant='detector';
    const full=scale!=='tiny',drawing=full?detailed[variant] || detailed[kind] || detailed.equipment:paths;
    const accessibility=scale==='large'?`role="img" aria-label="${escape(label)} — ilustração de referência"`:'aria-hidden="true"';
    return `<span class="product-art product-art-${scale}" data-art-kind="${kind}" data-art-variant="${variant}" ${accessibility}><span class="product-art-disc"><svg class="product-art-figure" viewBox="0 0 ${full?'96 96':'24 24'}" fill="none" stroke="currentColor" stroke-width="${full?'2.2':'1.6'}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawing}</svg></span></span>`;
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
