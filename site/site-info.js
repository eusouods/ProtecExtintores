/* Dados da empresa, WhatsApp, confiança e perguntas frequentes. Tudo vem de config.js (window.PROTEC_EMPRESA). */
(() => {
  const info = Object.assign({destaques:[],certificacoes:[],avaliacoes:[],precosAPartirDe:{}}, window.PROTEC_EMPRESA || {});
  const digits = value => String(value || '').replace(/\D/g, '');
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value; else if (value !== false && value != null) node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) if (child) node.append(child);
    return node;
  };

  const whatsapp = digits(info.whatsapp);
  window.fogoWhatsAppLink = (message = 'Olá! Vim pelo site da ProtecExtintores e gostaria de um orçamento.') =>
    whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}` : '';

  const store = document.getElementById('store');
  if (!store) return;

  // Cartão da página inicial: horário real, ou uma frase neutra quando não há horário.
  const status = document.getElementById('heroStatus');
  if (status && info.horario) status.textContent = 'Atendimento ' + info.horario;

  // Três fatos sob o título (ficam os padrões do HTML se o config não trouxer nenhum).
  const trust = document.getElementById('heroTrust');
  if (trust && info.destaques.length) {
    trust.replaceChildren(...info.destaques.slice(0, 3).map(([title, detail]) =>
      el('span', {}, [el('b', {text: title}), detail ? el('small', {text: ' ' + detail}) : null])));
  }

  // Botão fixo de WhatsApp.
  const link = window.fogoWhatsAppLink();
  if (link) {
    const icon = '<svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.04 3C9.4 3 4 8.38 4 15c0 2.27.64 4.4 1.75 6.2L4 29l8.02-1.7A12.1 12.1 0 0 0 16.04 27C22.66 27 28 21.62 28 15S22.66 3 16.04 3Zm0 21.9c-1.2 0-2.37-.3-3.4-.86l-.5-.27-4.76 1 1.02-4.6-.3-.5A9.7 9.7 0 0 1 6.3 15c0-5.3 4.4-9.6 9.74-9.6S25.7 9.7 25.7 15s-4.4 9.9-9.66 9.9Zm5.3-7.26c-.3-.15-1.7-.84-1.96-.94-.26-.1-.45-.15-.64.15-.2.3-.74.94-.9 1.13-.17.2-.33.22-.62.07-.3-.15-1.2-.44-2.3-1.4-.85-.76-1.42-1.7-1.6-1.98-.16-.3-.02-.45.13-.6l.43-.5c.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.65-1.57-.9-2.14-.23-.56-.47-.48-.65-.49h-.55c-.2 0-.5.07-.76.37s-1 .98-1 2.4 1.03 2.77 1.17 2.96c.15.2 2.03 3.1 4.9 4.34.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.7-.7 1.94-1.37.24-.67.24-1.25.17-1.37-.07-.12-.26-.2-.56-.35Z"/></svg>';
    const button = el('a', {class: 'wa-float', href: link, target: '_blank', rel: 'noopener', 'aria-label': 'Falar com a equipe no WhatsApp'});
    button.innerHTML = icon + '<span>WhatsApp</span>';
    store.append(button);
  }

  // Dados no rodapé.
  const footer = document.getElementById('footerContact');
  if (footer) {
    const rows = [];
    if (info.horario) rows.push(el('span', {text: 'Atendimento: ' + info.horario}));
    if (info.areaAtendida) rows.push(el('span', {text: 'Área atendida: ' + info.areaAtendida}));
    if (info.endereco) rows.push(el('a', {href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(info.endereco), target: '_blank', rel: 'noopener', text: info.endereco}));
    if (info.telefone) rows.push(el('a', {href: 'tel:+' + (digits(info.telefone).startsWith('55') ? '' : '55') + digits(info.telefone), text: info.telefone}));
    if (link) rows.push(el('a', {href: link, target: '_blank', rel: 'noopener', text: 'WhatsApp'}));
    if (info.email) rows.push(el('a', {href: 'mailto:' + info.email, text: info.email}));
    if (info.instagram) rows.push(el('a', {href: 'https://instagram.com/' + String(info.instagram).replace(/^@/, ''), target: '_blank', rel: 'noopener', text: 'Instagram @' + String(info.instagram).replace(/^@/, '')}));
    if (info.cnpj) rows.push(el('span', {text: 'CNPJ ' + info.cnpj}));
    if (rows.length) { footer.replaceChildren(...rows); footer.hidden = false; }
  }

  // "A partir de" nos cartões de serviço.
  for (const [code, price] of Object.entries(info.precosAPartirDe || {})) {
    const label = document.querySelector(`[data-customer-service="${CSS.escape(code)}"] .customer-service-choice span`);
    if (label && price) label.append(el('em', {class: 'price-from', text: 'a partir de ' + price}));
  }


  // Ícones reais nos três cartões (antes eram "01/02/03", que não indicam sequência).
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const icons = [
    svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>'),
    svg('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>'),
    svg('<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-5.2A8 8 0 1 1 21 12z"/>')
  ];
  document.querySelectorAll('#servicos .feature-icon').forEach((node, i) => { if (icons[i]) node.innerHTML = icons[i]; });

  // Seções da página inicial: como funciona, confiança e perguntas frequentes.
  const anchor = document.getElementById('servicos');
  if (!anchor) return;
  const go = (page, text, cls = 'btn btn-small') => {
    const a = el('a', {href: '#', class: cls, text});
    a.addEventListener('click', event => { event.preventDefault(); window.showPublicPage?.(page); });
    return a;
  };
  const section = (id, title, intro, body) => {
    const node = el('section', {class: 'section home-extra public-view', 'data-public-page': 'home', id}, [
      el('div', {class: 'section-head'}, [el('div', {}, [el('h2', {text: title}), intro ? el('p', {text: intro}) : null])]), body]);
    if (document.querySelector('.hero.active')) node.classList.add('active');
    return node;
  };
  const sections = [];

  sections.push(section('como-funciona', 'Como funciona', 'Do pedido ao serviço concluído, sem precisar criar conta.',
    el('ol', {class: 'how-steps'}, [
      ['Peça o orçamento', 'Escolha o serviço e informe seu nome e WhatsApp. Leva poucos minutos.'],
      ['A equipe confirma', 'Combinamos endereço, visita e valores. Nada é agendado nem cobrado antes disso.'],
      ['Acompanhe pelo código', 'Você recebe um código e vê cada etapa do serviço na aba Acompanhar.']
    ].map(([title, text]) => el('li', {}, [el('h3', {text: title}), el('p', {text})])))));

  if (info.certificacoes.length) {
    sections.push(section('certificacoes', 'Certificações e normas', null,
      el('ul', {class: 'proof-list'}, info.certificacoes.map(item => el('li', {text: String(item)})))));
  }
  if (info.avaliacoes.length) {
    sections.push(section('avaliacoes', 'O que dizem os clientes', null,
      el('div', {class: 'proof-quotes'}, info.avaliacoes.slice(0, 5).map(item => el('figure', {}, [
        el('blockquote', {text: item.texto}),
        el('figcaption', {text: [item.nome, item.empresa].filter(Boolean).join(' — ')})])))));
  }

  const faq = [
    ['Preciso criar conta para pedir orçamento?', 'Não. Para o orçamento você informa só nome e WhatsApp. A conta é necessária apenas para comprar na loja e guardar seu histórico de pedidos.'],
    ['Enviar o pedido já agenda ou cobra alguma coisa?', 'Não. O pedido apenas avisa a equipe. Endereço, visita e valores são confirmados com você antes de qualquer serviço.'],
    ['De quanto em quanto tempo o extintor precisa de recarga?', 'Em geral, a cada 12 meses para extintores de pó químico e de água, com inspeções periódicas no intervalo. O teste hidrostático costuma ser exigido a cada 5 anos. A data exata está na etiqueta do seu extintor e depende do tipo e do fabricante.'],
    ['O que acontece se o extintor vencer?', 'Com o prazo vencido, o extintor deixa de ter garantia de funcionamento e pode ser apontado em vistorias, como as do Corpo de Bombeiros ou do seguro. O ideal é pedir a recarga antes da data de vencimento.'],
    ['Como acompanho meu serviço?', 'Ao enviar o pedido você recebe um código, como FS-A1B2C3. Digite esse código na aba Acompanhar para ver em que etapa o serviço está.'],
    ['Quais serviços vocês fazem?', 'Recarga e manutenção de extintores, instalação, suportes de parede e de piso, faixas de demarcação, placas de sinalização, teste de mangueira de hidrante, abrigos e acessórios de hidrante e iluminação de emergência.']
  ];
  const faqList = el('div', {class: 'faq-list'}, faq.map(([question, answer]) =>
    el('details', {}, [el('summary', {text: question}), el('p', {text: answer})])));
  const faqFoot = el('div', {class: 'faq-foot'}, [go('service', 'Pedir orçamento', 'btn')]);
  if (link) faqFoot.append(el('a', {class: 'btn btn-soft', href: link, target: '_blank', rel: 'noopener', text: 'Tirar dúvidas no WhatsApp'}));
  sections.push(section('perguntas', 'Perguntas frequentes', null, el('div', {}, [faqList, faqFoot])));

  anchor.after(...sections);
})();
