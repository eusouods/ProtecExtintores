/* Keep the shopping cart available to storefront customers, not team accounts. */
(() => {
  const teamRoles = new Set(['admin', 'employee', 'seller']);
  const isTeamAccount = () => teamRoles.has(localStorage.getItem('fogoseguro_role'));

  function syncCartAccess() {
    const blocked = isTeamAccount();
    document.querySelectorAll('#publicProducts [data-product-id]').forEach(button => {
      button.hidden = blocked;
      button.disabled = blocked || db.settings.shopEnabled === false;
      button.setAttribute('aria-hidden', String(blocked));
    });
    const cartButton = document.querySelector('.topbar .navlinks button[onclick*="openCart"]');
    if (cartButton) cartButton.hidden = blocked;
    const cartCount = document.getElementById('cartCount');
    if (cartCount) cartCount.hidden = blocked;
  }

  const originalAddToCart = window.addToCart;
  window.addToCart = function(productId, ...args) {
    if (isTeamAccount()) {
      toast('O carrinho está disponível para clientes da loja.');
      return false;
    }
    return originalAddToCart.call(this, productId, ...args);
  };

  const originalOpenCart = window.openCart;
  window.openCart = function(...args) {
    if (isTeamAccount()) {
      toast('O carrinho está disponível para clientes da loja.');
      return false;
    }
    return originalOpenCart.apply(this, args);
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
  if (products) new MutationObserver(syncCartAccess).observe(products, {childList:true,subtree:true});
  for (const id of ['login','dashboard','employeePortal']) {
    const panel = document.getElementById(id);
    if (panel) new MutationObserver(syncCartAccess).observe(panel, {attributes:true,attributeFilter:['class']});
  }
  window.addEventListener('storage', syncCartAccess);
  syncCartAccess();
})();
