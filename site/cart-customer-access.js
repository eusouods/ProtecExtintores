/* Require an authenticated customer account for shopping cart actions. */
(() => {
  const teamRoles = new Set(['admin', 'employee', 'seller']);
  const isTeamAccount = () => teamRoles.has(localStorage.getItem('protecextintores_role')) || teamRoles.has(sessionStorage.getItem('protecextintores_role'));
  window.customerAccountState = window.customerAccountState || {authenticated:false,customer:null,token:''};
  const isCustomer = () => Boolean(window.customerAccountState.authenticated && window.customerAccountState.token && !isTeamAccount());

  function syncCartAccess() {
    const team = isTeamAccount();
    const customer = isCustomer();
    document.querySelectorAll('#publicProducts .product-foot > button').forEach(button => {
      const label = customer ? 'Adicionar ao carrinho' : 'Entrar para comprar';
      const disabled = team || db.settings.shopEnabled === false;
      // Só escreve quando o valor muda: reescrever textContent (mesmo igual) gera
      // mutação de childList e fazia o MutationObserver abaixo entrar em loop infinito.
      if (button.hidden !== team) button.hidden = team;
      if (button.disabled !== disabled) button.disabled = disabled;
      if (button.textContent !== label) button.textContent = label;
      if (button.getAttribute('aria-hidden') !== String(team)) button.setAttribute('aria-hidden', String(team));
    });
    const cartButton = document.getElementById('customerCartButton');
    if (cartButton && cartButton.hidden === customer) cartButton.hidden = !customer;
    const cartCount = document.getElementById('cartCount');
    if (cartCount && cartCount.hidden === customer) cartCount.hidden = !customer;
    const teamLink = document.querySelector('.team-login-link');
    if (teamLink) {
      teamLink.hidden = customer;
      teamLink.style.display = customer ? 'none' : '';
      teamLink.setAttribute('aria-hidden', String(customer));
    }
    const accountButton = document.getElementById('customerAccountButton');
    if (accountButton) {
      if (accountButton.hidden !== team) accountButton.hidden = team;
      const accountLabel = customer ? 'Painel do cliente' : 'Entrar';
      if (accountButton.textContent !== accountLabel) accountButton.textContent = accountLabel;
      accountButton.onclick = event => {
        event.preventDefault();
        if (customer) window.openCustomerAccount?.(); else window.openCustomerAuth?.('login');
        window.closePublicMenu?.();
      };
    }
    window.syncCustomerServiceAccess?.();
  }

  const originalAddToCart = window.addToCart;
  window.addToCart = function(productId, ...args) {
    if (isTeamAccount()) {
      toast('A compra está disponível para contas de cliente.');
      return false;
    }
    if (!isCustomer()) {
      window.openCustomerAuth?.('login');
      return false;
    }
    return originalAddToCart.call(this, productId, ...args);
  };

  const originalOpenCart = window.openCart;
  window.openCart = function(...args) {
    if (isTeamAccount()) {
      toast('A compra está disponível para contas de cliente.');
      return false;
    }
    if (!isCustomer()) {
      window.openCustomerAuth?.('login');
      return false;
    }
    const result = originalOpenCart.apply(this, args);
    const form = document.getElementById('editForm'), customer = window.customerAccountState.customer;
    if (form && customer) {
      for (const [name,value] of [['name',customer.name],['email',customer.email]]) {
        const input = form.elements[name];
        if (!input) continue;
        input.value = value || '';
        input.required = false;
        input.closest('.form-field')?.classList.add('hidden');
      }
    }
    return result;
  };

  const originalRenderPublic = window.renderPublic;
  window.renderPublic = function(...args) {
    const result = originalRenderPublic.apply(this, args);
    syncCartAccess();
    return result;
  };

  const originalShowStore = window.showStore;
  window.showStore = function(...args) {
    const result = originalShowStore.apply(this, args);
    syncCartAccess();
    return result;
  };

  const products = document.getElementById('publicProducts');
  if (products) {
    const productsOptions = {childList:true,subtree:true};
    const productsObserver = new MutationObserver(() => {
      // Pausa o observer enquanto sincroniza, para as próprias alterações não o reativarem.
      productsObserver.disconnect();
      try { syncCartAccess(); } finally { productsObserver.observe(products, productsOptions); }
    });
    productsObserver.observe(products, productsOptions);
  }
  for (const id of ['login','dashboard','employeePortal']) {
    const panel = document.getElementById(id);
    if (panel) new MutationObserver(syncCartAccess).observe(panel, {attributes:true,attributeFilter:['class']});
  }
  window.addEventListener('storage', syncCartAccess);
  window.syncCartAccess = syncCartAccess;
  syncCartAccess();
})();
