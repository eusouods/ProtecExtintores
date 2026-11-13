/* Customer-facing catalog for fire safety products and quote-only services. */
(() => {
  const page = document.getElementById('produtos');
  const legacySection = document.getElementById('pedido-manutencao');
  if (!page || !legacySection) return;

  const style = document.createElement('style');
  style.textContent = `
    .customer-services-section{margin:34px -1px 0;padding:34px 28px;border:1px solid var(--ui-border,#c8d8e3);border-radius:24px;background:linear-gradient(150deg,var(--ui-panel,#f9fcff),var(--ui-panel,#f9fcff));box-shadow:0 16px 44px rgb(6 20 12 / 0.047)}
    .customer-services-heading{max-width:740px;margin:0 auto 24px;text-align:center}
    .customer-services-heading h2{margin:8px 0;font-size:clamp(24px,4vw,34px);color:var(--ui-text,#193142)}
    .customer-services-heading p{margin:0;color:var(--ui-muted,#466173);line-height:1.6}
    .customer-service-gate{max-width:650px;margin:0 auto;padding:25px;border:1px solid var(--ui-border,#c8d8e3);border-radius:18px;background:var(--ui-panel,#f9fcff);text-align:center;box-shadow:0 10px 28px rgb(6 20 12 / 0.043)}
    .customer-service-gate h3{margin:0 0 8px;color:var(--ui-text,#193142)}.customer-service-gate p{margin:0 auto 17px;max-width:490px;color:var(--ui-muted,#466173);line-height:1.55}
    .customer-service-form{max-width:1000px;margin:0 auto}.customer-service-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .customer-service-card{min-width:0;padding:15px;border:1px solid var(--ui-border,#c8d8e3);border-radius:15px;background:var(--ui-panel,#f9fcff);transition:border-color .18s,box-shadow .18s}
    .customer-service-card:has([data-customer-toggle]:checked){border-color:var(--ui-border,#c8d8e3);box-shadow:0 0 0 3px rgb(6 20 12 / 0.102)}
    .customer-service-choice{display:flex;align-items:flex-start;gap:11px;cursor:pointer;color:var(--ui-text,#193142);font-weight:800;font-size:14px;line-height:1.35}
    .customer-service-choice input{width:19px;height:19px;flex:none;margin:1px 0 0;accent-color:var(--ui-accent,#075f98)}
    .customer-service-choice small{display:block;margin-top:4px;color:var(--ui-muted,#466173);font-size:11px;font-weight:400;line-height:1.45}
    .customer-service-details{margin-top:13px;padding-top:12px;border-top:1px solid var(--ui-border,#c8d8e3)}
    .customer-service-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}
    .customer-service-fields .form-field{min-width:0;margin:7px 0}.customer-service-fields .span2{grid-column:1/-1}
    .customer-service-fields .form-field:has(input:required) label:after,.customer-service-fields .form-field:has(select:required) label:after{content:' *';color:var(--ui-text,#193142);font-weight:800}
    .customer-service-help{margin:4px 0 0;color:var(--ui-muted,#466173);font-size:11px;line-height:1.45}
    .customer-maintenance-row{display:grid;grid-template-columns:1.2fr .8fr .7fr auto;gap:8px;align-items:end;margin:0 0 10px}
    .customer-maintenance-row .form-field{min-width:0;margin:0}.customer-maintenance-row .form-field label{font-size:10px}
    .customer-service-remove{min-height:42px;padding:8px 11px;border:1px solid var(--ui-border,#c8d8e3);border-radius:10px;background:var(--ui-raised,#e0eaf2);color:var(--ui-muted,#466173);font-size:12px;font-weight:700}
    .customer-service-sign-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .customer-service-sign-list label{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid var(--ui-border,#c8d8e3);border-radius:10px;color:var(--ui-muted,#466173);font-size:12px}
    .customer-service-sign-list input{width:17px;height:17px;accent-color:var(--ui-accent,#075f98)}
    .customer-service-contact{margin:19px 0 8px;padding:16px;border:1px solid var(--ui-border,#c8d8e3);border-radius:15px;background:var(--ui-panel,#f9fcff)}
    .customer-service-submit{display:flex;align-items:center;justify-content:center;width:100%;margin-top:14px;min-height:50px;border-radius:13px;background:var(--ui-panel,#f9fcff);color:var(--ui-text,#193142)}
    .customer-service-submit:hover{background:var(--ui-panel,#f9fcff)}.customer-service-result{max-width:760px;margin:18px auto 0}
    .customer-service-result .tracking-card{border-color:var(--ui-border,#c8d8e3);background:var(--ui-raised,#e0eaf2)}
    @media(max-width:680px){.customer-services-section{margin:24px -10px 0;padding:27px 15px;border-radius:18px}.customer-service-options{grid-template-columns:1fr}.customer-service-fields{grid-template-columns:1fr}.customer-service-fields .span2{grid-column:auto}.customer-maintenance-row{grid-template-columns:1fr 1fr}.customer-maintenance-row .customer-service-remove{grid-column:1/-1;width:100%}.customer-service-sign-list{grid-template-columns:1fr 1fr}.customer-service-gate{padding:20px 16px}}
  `;
  document.head.appendChild(style);

  const field = (label, key, type='text', attrs='', placeholder='') => `<div class="form-field"><label>${label}</label><input data-service-field="${key}" type="${type}" ${attrs} ${placeholder ? `placeholder="${placeholder}"` : ''}></div>`;
  const select = (label,key,options,required=true) => `<div class="form-field"><label>${label}</label><select data-service-field="${key}" ${required?'data-required="true"':''}>${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></div>${options.some(([value])=>value==='Outro')?`<div class="form-field hidden" data-other-field="${key}"><label>Informe o tipo</label><input data-service-field="otherType" maxlength="100" data-required="true"></div>`:''}`;
  const card = (code,title,subtitle,details) => `<article class="customer-service-card" data-customer-service="${code}"><label class="customer-service-choice"><input type="checkbox" data-customer-toggle><span>${title}<small>${subtitle}</small></span></label><div class="customer-service-details hidden" data-customer-details>${details}</div></article>`;
  const maintenanceRow = () => `<div class="customer-maintenance-row" data-maintenance-row>
    <div class="form-field"><label>Tipo de extintor</label><select data-maintenance-type data-required="true"><option value="">Selecione o tipo</option><option>Pó químico ABC</option><option>Pó químico BC</option><option>CO₂</option><option>Água pressurizada</option></select></div>
    <div class="form-field"><label>Peso / capacidade</label><select data-maintenance-weight data-required="true" disabled><option value="">Selecione o tipo</option></select></div>
    <div class="form-field"><label>Quantidade</label><input data-maintenance-quantity data-required="true" type="number" min="1" max="100" step="1" value="1"></div>
    <button type="button" class="customer-service-remove" data-remove-maintenance>Remover grupo</button>
  </div>`;

  legacySection.dataset.publicPage = 'products';
  legacySection.classList.add('customer-services-section');
  legacySection.innerHTML = `
    <div class="customer-services-heading"><div class="eyebrow" style="color:var(--ui-text,#193142)">Atendimento ProtecExtintores</div><h2>Peça serviços e instalação</h2><p>Escolha manutenção de extintores, instalação e outros itens de segurança. A equipe confirma disponibilidade, visita e orçamento antes de qualquer serviço.</p></div>
    
    <form id="customerServiceRequestForm" class="customer-service-form"><p class="customer-service-help">* Campos obrigatórios. Selecione apenas os serviços necessários.</p>
      <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="customer-service-options">
        ${card('maintenance','Manutenção / inspeção de extintores','Recarga, revisão, inspeção ou manutenção preventiva e corretiva.',`<p class="customer-service-help">Adicione um grupo para cada tipo e peso de extintor.</p><div data-maintenance-groups>${maintenanceRow()}</div><button type="button" class="btn btn-soft btn-small" data-add-maintenance>＋ Adicionar tipo de extintor</button>`)}
        ${card('installation','Instalação de extintores','Instalação em parede ou em suporte de piso.',`<div class="customer-service-fields">${select('Forma de instalação','mounting',[['','Selecione'],['wall','Fixar na parede'],['floor','Em suporte de piso'],['both','Parede e suporte de piso'],['existing','Usar suporte existente']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local da instalação','location','text','data-required="true" maxlength="180"','Ex.: recepção, corredor')}${field('Observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('wall-support','Adicionar suporte de parede','Fornecimento de suporte para instalação em parede.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('floor-stand','Adicionar suporte de piso','Fornecimento de suporte de piso para extintor.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('demarcation','Faixa de demarcação','Solicite aplicação de faixa para delimitar equipamentos e áreas.',`<div class="customer-service-fields">${select('Cor da faixa','color',[['','Selecione'],['Amarela','Amarela'],['Vermelha','Vermelha'],['Branca','Branca'],['Outra','Outra']])}<div class="form-field hidden" data-other-color><label>Informe a cor</label><input data-service-field="otherColor" data-required="true" maxlength="50"></div>${field('Comprimento (m)','lengthMeters','number','data-required="true" min="0.1" step="any"','Ex.: 5')}${field('Largura (cm), se souber','widthCm','number','min="0.1" step="any"','')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('safety-signage','Placas de sinalização','Saídas, emergência, rotas de fuga, extintores, hidrantes e outras placas.',`<p class="customer-service-help">Marque os tipos desejados. A quantidade informada será aplicada a cada tipo marcado.</p><div class="customer-service-sign-list">${[['Saída'],['Saída de emergência'],['Rota de fuga'],['Extintor ABC'],['Extintor BC'],['Extintor CO₂'],['Extintor de água'],['Hidrante'],['Alarme de incêndio'],['Acionador manual'],['Ponto de encontro'],['Outra placa']].map(([label])=>`<label><input type="checkbox" data-sign-type value="${label}">${label}</label>`).join('')}</div><div class="customer-service-fields">${field('Quantidade por tipo de placa','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / outras placas','notes','text','maxlength="300"','Ex.: garagem, corredor')}</div>`)}
        ${card('hydrant-hose-test','Teste de mangueira de hidrante','Informe tipo/classe, diâmetro e comprimento.',`<div class="customer-service-fields">${select('Tipo / classe','type',[['','Selecione'],['Tipo 1','Tipo 1'],['Tipo 2','Tipo 2'],['Tipo 3','Tipo 3'],['Tipo 4','Tipo 4'],['Tipo 5','Tipo 5'],['Não sei','Não sei']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Diâmetro (mm)','diameterMm','number','data-required="true" min="0.1" step="any"','Ex.: 38')}${field('Comprimento (m)','lengthMeters','number','data-required="true" min="0.1" step="any"','Ex.: 15')}</div>`)}
        ${card('extinguisher-hose','Adicionar mangueira de extintor','Para pó químico, água ou CO₂.',`<div class="customer-service-fields">${select('Agente','type',[['','Selecione'],['Pó químico ABC','Pó químico ABC'],['Pó químico BC','Pó químico BC'],['Água pressurizada','Água pressurizada'],['CO₂','CO₂'],['Outro','Outro']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('diffuser','Adicionar difusor de extintor','Escolha o tipo de difusor que precisa.',`<div class="customer-service-fields">${select('Tipo','type',[['','Selecione'],['Pó químico ABC/BC','Pó químico ABC/BC'],['Água','Água'],['CO₂','CO₂'],['Outro','Outro']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('hydrant-cabinet','Abrigo de hidrante','Fornecimento ou instalação de abrigo de hidrante.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('hydrant-accessories','Acessórios de hidrante','Esguicho, adaptador, chave ou tampão Storz.',`<div class="customer-service-fields">${select('Acessório','type',[['','Selecione'],['Esguicho regulável','Esguicho regulável'],['Esguicho jato sólido','Esguicho jato sólido'],['Adaptador Storz','Adaptador Storz'],['Chave Storz','Chave Storz'],['Tampão Storz','Tampão Storz'],['Outro','Outro']])}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('emergency-light','Iluminação de emergência','Fornecimento ou instalação de luminárias de emergência.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Local / observações','notes','text','maxlength="300"','')}</div>`)}
        ${card('pressure-gauge','Adicionar manômetro','Peça e instalação para extintor.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('valve','Adicionar ou revisar válvula','Informe tipo, se souber.',`<div class="customer-service-fields">${field('Tipo / modelo','notes','text','data-required="true" maxlength="120"','Ex.: válvula M30')}${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}</div>`)}
        ${card('extinguisher-wheels','Rodas ou carrinho para extintor','Para extintores sobre rodas.',`<div class="customer-service-fields">${field('Quantidade','quantity','number','data-required="true" min="1" max="100" step="1" value="1"')}${field('Observações','notes','text','maxlength="200"','')}</div>`)}
        ${card('other-work','Outro serviço de prevenção','Descreva o que precisa e a equipe orientará.',`<div class="customer-service-fields">${field('Descreva o serviço','description','text','data-required="true" maxlength="200"','')}${field('Quantidade','quantity','number','min="1" max="100" step="1" value="1"')}</div>`)}
      </div>
      <div class="customer-service-contact"><h3>Seus dados para o orçamento</h3><div class="customer-service-fields"><div class="form-field"><label>Nome ou empresa</label><input type="text" data-contact-name required minlength="2" maxlength="100" autocomplete="name"></div>${field('Telefone / WhatsApp','phone','tel','required autocomplete="tel" maxlength="30"','(00) 00000-0000')}<div class="form-field span2"><label>E-mail (opcional)</label><input type="email" data-contact-email maxlength="254" autocomplete="email"></div></div></div><p class="customer-service-help">A equipe usa esses dados para confirmar endereço, visita e orçamento. Você não precisa criar conta. Enviar a solicitação não agenda nem cobra o serviço.</p></div>
      <div class="form-field"><label>Endereço do serviço / observações gerais</label><textarea name="details" maxlength="1500" placeholder="Informe o endereço do local e qualquer detalhe importante."></textarea></div>
      <button type="submit" class="btn customer-service-submit">Solicitar orçamento de produtos e serviços</button>
    </form>
    <div id="customerServiceRequestResult" class="customer-service-result" aria-live="polite"></div>`;

  const productHeading=page.querySelector('.section-head h2'),productIntro=page.querySelector('.section-head p');
  if(productHeading)productHeading.textContent='Produtos e serviços';
  if(productIntro)productIntro.textContent='Compre extintores e solicite instalação, manutenção e outros serviços de segurança.';
  const productLink = document.querySelector('#publicNav a');
  if (productLink) productLink.textContent = 'Produtos e serviços';
  const headerLinks = [...document.querySelectorAll('#publicNav a')];
  const serviceLink = headerLinks.find(link => (link.getAttribute('onclick')||'').includes("showPublicPage('service')"));
  if (serviceLink) serviceLink.textContent = 'Solicitar serviço';
  const footerLinks = [...document.querySelectorAll('footer .footer-links a')];
  if (footerLinks[0]) footerLinks[0].textContent = 'Produtos e serviços';
  if (footerLinks[1]) footerLinks[1].textContent = 'Solicitar serviço';
  document.querySelectorAll('.hero-actions .btn').forEach((link,index)=>{if(index===0)link.innerHTML='Explorar produtos e serviços <span aria-hidden="true">→</span>';else link.textContent='Solicitar serviço'});
  document.querySelectorAll('[onclick]').forEach(element=>{
    if(!(element.getAttribute('onclick')||'').includes("showPublicPage('service')"))return;
    element.onclick=event=>{event.preventDefault();window.openCustomerServices();return false};
  });
  page.appendChild(legacySection);

  const form = document.getElementById('customerServiceRequestForm');
  form.noValidate = true;
  const weightOptions = {'Pó químico ABC':['4','6','8','12'],'Pó químico BC':['4','6','8','12'],'CO₂':['4','6','8'],'Água pressurizada':['10 L']};
  function bindMaintenanceRow(row) {
    const type = row.querySelector('[data-maintenance-type]'), weight = row.querySelector('[data-maintenance-weight]');
    type.addEventListener('change',()=>{
      const options=weightOptions[type.value]||[];
      weight.innerHTML='<option value="">Selecione o peso</option>'+options.map(value=>`<option value="${value}">${value}${value==='10 L'?'':' kg'}</option>`).join('');
      weight.disabled=!type.value;
      weight.required=Boolean(type.value)&&form.querySelector('[data-customer-service="maintenance"] [data-customer-toggle]').checked;
    });
    row.querySelector('[data-remove-maintenance]').addEventListener('click',()=>{
      const groups=form.querySelectorAll('[data-maintenance-row]');
      if(groups.length===1){type.value='';type.dispatchEvent(new Event('change'));row.querySelector('[data-maintenance-quantity]').value='1';return}
      row.remove();
    });
  }
  form.querySelectorAll('[data-maintenance-row]').forEach(bindMaintenanceRow);
  form.querySelector('[data-add-maintenance]').addEventListener('click',()=>{
    const group=form.querySelector('[data-maintenance-groups]');
    if(group.querySelectorAll('[data-maintenance-row]').length>=20){toast('Adicione até 20 grupos por solicitação.');return}
    const holder=document.createElement('div');holder.innerHTML=maintenanceRow();const row=holder.firstElementChild;group.appendChild(row);bindMaintenanceRow(row);
    const enabled=form.querySelector('[data-customer-service="maintenance"] [data-customer-toggle]').checked;
    row.querySelectorAll('[data-required]').forEach(input=>input.required=enabled);
  });
  form.querySelectorAll('[data-customer-service]').forEach(serviceCard=>{
    const toggle=serviceCard.querySelector('[data-customer-toggle]'),details=serviceCard.querySelector('[data-customer-details]');
      toggle.addEventListener('change',()=>{
      const active=toggle.checked;details.classList.toggle('hidden',!active);
      details.querySelectorAll('[data-required]').forEach(input=>input.required=active&&!input.closest('[data-other-field],[data-other-color]')?.classList.contains('hidden'));
    });
  });
  form.querySelectorAll('select[data-service-field]').forEach(selectField=>selectField.addEventListener('change',()=>{
    const other=selectField.closest('[data-customer-service]')?.querySelector(`[data-other-field="${selectField.dataset.serviceField}"]`);
    if(!other)return;
    const active=selectField.value==='Outro'&&Boolean(selectField.closest('[data-customer-service]')?.querySelector('[data-customer-toggle]').checked);
    other.classList.toggle('hidden',!active);other.querySelector('input').required=active;
  }));
  form.querySelector('[data-service-field="color"]').addEventListener('change',event=>{
    const other=form.querySelector('[data-other-color]'),input=other.querySelector('input');
    other.classList.toggle('hidden',event.target.value!=='Outra');
    input.required=event.target.value==='Outra'&&form.querySelector('[data-customer-service="demarcation"] [data-customer-toggle]').checked;
  });

  window.openCustomerServices=function(){showPublicPage('products');setTimeout(()=>legacySection.scrollIntoView({behavior:'smooth',block:'start'}),80);window.closePublicMenu?.()};
  window.syncCustomerServiceAccess=function(){
    const account=window.customerAccountState||{},team=Boolean(localStorage.getItem('protecextintores_role')||sessionStorage.getItem('protecextintores_role'));
    const authenticated=Boolean(account.authenticated&&account.token&&account.customer&&!team);
    const nameInput=form.querySelector('[data-contact-name]'),emailInput=form.querySelector('[data-contact-email]');
    if(authenticated){if(!nameInput.value)nameInput.value=account.customer.name||'';if(!emailInput.value)emailInput.value=account.customer.email||''}
  };

  function selectedOptions(){return [...form.querySelectorAll('[data-customer-service]')].filter(card=>card.querySelector('[data-customer-toggle]').checked)}
  function collectExtras(cards){
    const result=[];
    for(const item of cards){
      const code=item.dataset.customerService,read=key=>item.querySelector(`[data-service-field="${key}"]`)?.value.trim()||'',qty=()=>Math.max(1,Math.min(100,Number(read('quantity'))||1));
      if(code==='maintenance'||code==='installation')continue;
      if(code==='demarcation'){
        const color=read('color')==='Outra'?read('otherColor'):read('color');
        result.push({code,title:'Faixa de demarcação',details:{color,lengthMeters:Number(read('lengthMeters')),widthCm:Number(read('widthCm'))||'',notes:read('notes')},price:0});
      }else if(code==='safety-signage'){
        const lines=[...item.querySelectorAll('[data-sign-type]:checked')].map(sign=>({type:sign.value,quantity:qty(),location:read('notes')}));
        const total=qty();
        if(lines.length)lines[0].quantity=total;
        result.push({code,title:'Placas de sinalização',lines,quantity:total,details:{notes:read('notes')},price:0});
      }else if(code==='hydrant-hose-test'){
        result.push({code,title:'Teste de mangueira de hidrante',lines:[{type:read('type'),diameterMm:Number(read('diameterMm')),lengthMeters:Number(read('lengthMeters')),quantity:qty()}],price:0});
      }else if(['extinguisher-hose','diffuser','hydrant-accessories'].includes(code)){
        const titleMap={'extinguisher-hose':'Mangueira de extintor',diffuser:'Difusor de extintor','hydrant-accessories':'Acessório de hidrante'};
        result.push({code,title:titleMap[code],lines:[{type:read('type')==='Outro'?read('otherType'):read('type'),quantity:qty()}],price:0});
      }else if(code==='other-work'){
        result.push({code,title:read('description'),quantity:qty(),details:{notes:''},price:0});
      }else{
        const titleMap={'wall-support':'Suporte de parede','floor-stand':'Suporte de piso','hydrant-cabinet':'Abrigo de hidrante','emergency-light':'Iluminação de emergência','pressure-gauge':'Manômetro',valve:'Válvula','extinguisher-wheels':'Rodas / carrinho para extintor'};
        result.push({code,title:titleMap[code]||'Serviço complementar',quantity:qty(),details:{notes:read('notes')},price:0});
      }
    }
    return result;
  }
  function maintenanceGroups(){
    const selected=form.querySelector('[data-customer-service="maintenance"] [data-customer-toggle]').checked;
    if(!selected)return [];
    return [...form.querySelectorAll('[data-maintenance-row]')].map(row=>({type:row.querySelector('[data-maintenance-type]').value,kg:row.querySelector('[data-maintenance-weight]').value,quantity:Math.max(1,Math.min(100,Number(row.querySelector('[data-maintenance-quantity]').value)||1))}));
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const selected=selectedOptions();
    if(!selected.length){toast('Selecione ao menos um serviço para solicitar orçamento.');return}
    const groups=maintenanceGroups();
    if(groups.length&&!groups.every(group=>group.type&&group.kg)){toast('Selecione o tipo e o peso de cada grupo de extintores.');return}
    const signCard=selected.find(item=>item.dataset.customerService==='safety-signage');
    if(signCard&&!signCard.querySelector('[data-sign-type]:checked')){toast('Selecione ao menos um tipo de placa.');return}
    const extraServices=collectExtras(selected),name=form.querySelector('[data-contact-name]').value.trim(),email=form.querySelector('[data-contact-email]').value.trim(),phone=form.querySelector('[data-service-field="phone"]').value.trim(),additionalNotes=form.elements.details.value.trim();
    const installation=selected.find(item=>item.dataset.customerService==='installation');
    const installationQuantity=installation?Math.max(1,Math.min(100,Number(installation.querySelector('[data-service-field="quantity"]').value)||1)):0;
    if(installation){const mount=installation.querySelector('[data-service-field="mounting"]').value;const location=installation.querySelector('[data-service-field="location"]').value.trim();const notes=installation.querySelector('[data-service-field="notes"]').value.trim();const mountText={wall:'Fixação na parede',floor:'Em suporte de piso',both:'Parede e suporte de piso',existing:'Usar suporte existente'}[mount]||mount;extraServices.unshift({code:'extinguisher-installation',title:'Instalação de extintores',quantity:installationQuantity,details:{notes:[mountText,location,notes].filter(Boolean).join(' · ')},price:0})}
    const totalMaintained=groups.reduce((sum,group)=>sum+group.quantity,0);
    if(totalMaintained>100){toast('A quantidade total de extintores por solicitação é de até 100.');return}
    const requestedCount=Math.max(totalMaintained,installationQuantity,1);
    const items=[];
    for(const group of groups)for(let i=0;i<group.quantity;i++)items.push({id:crypto.randomUUID(),serial:'',type:group.type,kg:group.kg==='10 L'?'':group.kg,status:'Solicitado',history:[{status:'Solicitado',at:new Date().toISOString()}]});
    while(items.length<requestedCount)items.push({id:crypto.randomUUID(),serial:'',type:installation?'Instalação de extintor':'Serviço complementar',kg:'',status:'Solicitado',history:[{status:'Solicitado',at:new Date().toISOString()}]});
    const hasMaintenance=groups.length>0,hasOther=extraServices.length>0;
    const serviceType=hasMaintenance&&installation?'Manutenção e instalação de extintores':hasMaintenance?'Manutenção de extintores':installation?'Instalação de extintores':'Serviços de prevenção contra incêndio';
    const serviceDetails=[...groups.map(group=>`${group.quantity} × ${group.type} ${group.kg==='10 L'?'10 L':group.kg+' kg'}`),...extraServices.map(item=>item.title+(item.quantity?` × ${item.quantity}`:'')),additionalNotes].filter(Boolean).join(' | ');
    const code='FS-'+Math.random().toString(36).slice(2,8).toUpperCase(),createdAt=new Date().toISOString();
    const service={id:crypto.randomUUID(),code,clientName:name,customerId:window.customerAccountState?.customer?.id,date:createdAt.slice(0,10),serviceType,employeeName:'A designar',maintenanceValid:'',items,extraServices,details:serviceDetails,serial:'',type:hasMaintenance?groups[0].type:'Serviços complementares',status:'Solicitado'};
    const order={id:crypto.randomUUID(),code,kind:'Manutenção',name,phone,email,website:form.elements.website.value,details:serviceDetails,items:[...groups.map(group=>({name:`${group.type} ${group.kg==='10 L'?'10 L':group.kg+' kg'}`,qty:group.quantity})),...extraServices.map(item=>({name:item.title,qty:item.quantity||1}))],status:'Solicitado · aguardando análise',createdAt};
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Enviando solicitação…';
    try{
      const ok=await window.sendPublicOrder({order,service});
      if(!ok)throw new Error('Não foi possível enviar. Verifique sua conexão e tente novamente.');
      const logged=Boolean(window.customerAccountState?.authenticated);
      const wa=window.fogoWhatsAppLink?window.fogoWhatsAppLink(`Olá! Acabei de pedir um orçamento pelo site. Meu código é ${code}.`):'';
      document.getElementById('customerServiceRequestResult').innerHTML=`<div class="tracking-card"><h4>Solicitação enviada</h4><p>Seu código de acompanhamento é <b>${code}</b>. Anote ou tire uma foto: é com ele que você acompanha cada etapa.</p><p>${logged?'O pedido ficou registrado na sua conta. ':''}A equipe confirma disponibilidade e valores antes de agendar qualquer serviço.</p><div class="result-actions"><button type="button" class="btn btn-small" onclick="document.getElementById('trackCode').value='${code}';showPublicPage('tracking')">Acompanhar solicitação</button>${wa?`<a class="btn btn-small btn-whatsapp" href="${wa}" target="_blank" rel="noopener">Avisar a equipe no WhatsApp</a>`:''}</div></div>`;
      form.reset();form.querySelectorAll('[data-customer-service]').forEach(card=>{card.querySelector('[data-customer-toggle]').dispatchEvent(new Event('change',{bubbles:true}))});form.querySelectorAll('select').forEach(select=>select.dispatchEvent(new Event('change',{bubbles:true})));form.querySelectorAll('[data-maintenance-row]').forEach(row=>{row.querySelectorAll('select,input').forEach(input=>{input.required=false});const weight=row.querySelector('[data-maintenance-weight]');weight.disabled=true;weight.innerHTML='<option value="">Selecione o tipo</option>'});window.syncCustomerServiceAccess?.();
      document.getElementById('customerServiceRequestResult').scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){toast(error.message||'Não foi possível enviar a solicitação.');}
    finally{submit.disabled=false;window.syncCustomerServiceAccess?.()}
  });

  window.syncCustomerServiceAccess();
})();
