(() => {
  'use strict';
  const digits = value => String(value || '').replace(/\D/g, '');
  const instagramName = value => String(value || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '');
  const whatsappNumber = value => {
    const raw = digits(value);
    if (!raw) return '';
    return raw.startsWith('55') ? raw : `55${raw}`;
  };
  const contactData = () => ({
    whatsapp: db.settings.whatsapp || window.PROTEC_EMPRESA?.whatsapp || '',
    instagram: instagramName(db.settings.instagram || window.PROTEC_EMPRESA?.instagram || '')
  });

  window.fogoWhatsAppLink = (message = 'Olá! Vim pelo site da ProtecExtintores e gostaria de um orçamento.') => {
    const phone = whatsappNumber(contactData().whatsapp);
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : '';
  };

  window.refreshHomepageContacts = () => {
    const contacts = contactData();
    const hero = document.querySelector('#store .hero-copy');
    if (hero) {
      let links = hero.querySelector('.home-social-links');
      if (!links) {
        links = document.createElement('div');
        links.className = 'home-social-links';
        links.setAttribute('aria-label', 'Fale com a ProtecExtintores');
        hero.querySelector('.hero-actions')?.after(links);
      }
      links.replaceChildren();
      const wa = window.fogoWhatsAppLink();
      if (wa) {
        const anchor = document.createElement('a');
        anchor.href = wa;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'home-social-link home-whatsapp-link';
        anchor.textContent = 'Conversar pelo WhatsApp';
        links.append(anchor);
      }
      if (contacts.instagram) {
        const anchor = document.createElement('a');
        anchor.href = `https://www.instagram.com/${encodeURIComponent(contacts.instagram)}/`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'home-social-link home-instagram-link';
        anchor.textContent = `Instagram @${contacts.instagram}`;
        links.append(anchor);
      }
      links.hidden = !links.childElementCount;
    }

    const store = document.getElementById('store');
    if (store) {
      let floating = store.querySelector('.wa-float');
      const wa = window.fogoWhatsAppLink();
      if (wa && !floating) {
        floating = document.createElement('a');
        floating.className = 'wa-float';
        floating.setAttribute('aria-label', 'Falar com a equipe no WhatsApp');
        floating.target = '_blank';
        floating.rel = 'noopener noreferrer';
        floating.innerHTML = '<span aria-hidden="true">◉</span><span>WhatsApp</span>';
        store.append(floating);
      }
      if (floating) {
        floating.href = wa || '#';
        floating.hidden = !wa;
      }
    }

    const footer = document.getElementById('footerContact');
    if (footer) {
      footer.querySelectorAll('[data-configured-social], a[href*="wa.me/"], a[href*="instagram.com/"]').forEach(node => node.remove());
      const wa = window.fogoWhatsAppLink();
      if (wa) {
        const anchor = document.createElement('a');
        anchor.dataset.configuredSocial = 'whatsapp';
        anchor.href = wa;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = 'WhatsApp';
        footer.append(anchor);
      }
      if (contacts.instagram) {
        const anchor = document.createElement('a');
        anchor.dataset.configuredSocial = 'instagram';
        anchor.href = `https://www.instagram.com/${encodeURIComponent(contacts.instagram)}/`;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.textContent = `Instagram @${contacts.instagram}`;
        footer.append(anchor);
      }
      footer.hidden = !footer.childElementCount;
    }
  };

  window.saveHomepageContacts = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const whatsapp = digits(data.get('whatsapp'));
    const instagram = instagramName(data.get('instagram'));
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) {
      toast('Informe um número com DDD e, se necessário, código do país.');
      return;
    }
    db.settings.whatsapp = whatsapp;
    db.settings.instagram = instagram;
    if (!await save()) return;
    window.refreshHomepageContacts();
    renderPage();
    toast('Contatos da página inicial salvos.');
  };

  const settingsBase = window.settings;
  window.settings = function (container) {
    settingsBase?.apply(this, arguments);
    const panel = document.createElement('section');
    panel.className = 'panel config-card homepage-contact-settings';
    panel.innerHTML = `<h3>Contato da página inicial</h3><p>Esses dados criam links diretos no destaque da página inicial, no rodapé e no botão de WhatsApp.</p><form onsubmit="saveHomepageContacts(event)"><div class="form-grid"><div class="form-field"><label for="homeWhatsapp">WhatsApp com DDD</label><input id="homeWhatsapp" name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="18" value="${esc(db.settings.whatsapp || '')}" placeholder="(11) 99999-9999" aria-describedby="homeWhatsappHint"><small id="homeWhatsappHint">Pode incluir o código do país. O Brasil é incluído automaticamente quando omitido.</small></div><div class="form-field"><label for="homeInstagram">Usuário do Instagram</label><input id="homeInstagram" name="instagram" autocomplete="off" maxlength="30" value="${esc(db.settings.instagram || '')}" placeholder="@suaempresa" aria-describedby="homeInstagramHint"><small id="homeInstagramHint">Digite o usuário com ou sem @. O link do perfil será criado automaticamente.</small></div></div><button class="btn btn-small" type="submit">Salvar contatos</button></form>`;
    container.append(panel);
  };

  const bootstrapBase = window.bootstrap;
  if (typeof bootstrapBase === 'function') {
    window.bootstrap = async function () {
      const result = await bootstrapBase.apply(this, arguments);
      window.refreshHomepageContacts();
      return result;
    };
  }
  window.refreshHomepageContacts();
  if (typeof bootstrap === 'function' && location.protocol !== 'file:') bootstrap();
})();
