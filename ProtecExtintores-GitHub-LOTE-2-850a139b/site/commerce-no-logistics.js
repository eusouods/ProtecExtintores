/* Checkout presencial: logística será habilitada apenas quando a empresa decidir operar entregas. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const submitOrder = async order => {
    if (!API_ENABLED) return true;
    try {
      const response = await apiCall('/api/public/orders','POST',{ order });
      const data = await apiJson(response);
      if (!response.ok) throw Error(data.error || 'Não foi possível concluir a compra.');
      Object.assign(order, data.payment || {});
      saveLocal();
      return true;
    } catch (error) { toast(error.message || 'Não foi possível concluir a compra.'); return false; }
  };
  const checkout = () => {
    const items = (db.cart || []).map(line => ({ ...line, product: db.products.find(product => product.id === line.productId) })).filter(line => line.product);
    const total = items.reduce((sum, line) => sum + Number(line.product.price || 0) * Number(line.qty || 0), 0);
    const rows = items.map(line => `<tr><td>${esc(line.product.name)}</td><td>${money(line.product.price)}</td><td><select aria-label="Quantidade de ${esc(line.product.name)}" onchange="cartQty('${esc(line.product.id)}',this.value)">${Array.from({ length: 100 }, (_, index) => index + 1).map(quantity => `<option value="${quantity}" ${Number(line.qty) === quantity ? 'selected' : ''}>${quantity}</option>`).join('')}</select></td><td>${money(Number(line.product.price || 0) * Number(line.qty || 0))}</td><td><button class="icon-btn" type="button" onclick="removeCart('${esc(line.product.id)}')">Remover</button></td></tr>`).join('');
    const body = items.length ? `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Preço</th><th>Qtd.</th><th>Subtotal</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><h3 class="checkout-total">Total: ${money(total)}</h3><p class="helper">Após confirmar, o Pix é gerado automaticamente. A equipe entrará em contato sobre os próximos passos.</p><div class="form-grid">${field('Nome completo','name',{required:true})}${field('Telefone / WhatsApp','phone',{required:true})}${field('E-mail','email',{type:'email'})}${field('CPF / CNPJ','document')}</div>` : '<div class="empty">Seu carrinho está vazio.</div>';
    openModal('Seu carrinho', body, async form => {
      if (!items.length) return false;
      const order = { id:id(), code:'PV-'+Math.random().toString(36).slice(2,8).toUpperCase(), kind:'Venda', name:val(form,'name'), phone:val(form,'phone'), email:val(form,'email'), document:val(form,'document'), items:items.map(line => ({ productId:line.product.id, name:line.product.name, qty:line.qty, price:line.product.price })), total, status:'Aguardando confirmação', createdAt:new Date().toISOString() };
      db.orders = db.orders || []; db.orders.push(order); db.cart = []; save(); updateCartCount();
      const accepted = await submitOrder(order);
      if (!accepted && API_ENABLED) { db.orders = db.orders.filter(item => item.id !== order.id); db.cart = items.map(item => ({ productId:item.product.id, qty:item.qty })); saveLocal(); renderPublic(); updateCartCount(); toast('Compra não concluída. Confira o pagamento em aberto ou tente novamente.'); return false; }
      setTimeout(() => showOrderConfirmation(order), 20);
    });
  };
  window.openCart = checkout;
  window.showOrderConfirmation = order => {
    const payment = order.paymentQr ? `<div class="checkout-pix"><b>Pix liberado para pagamento</b><img class="customer-order-qr" src="${esc(order.paymentQr)}" alt="QR Code Pix do pedido ${esc(order.code)}"><p>Escaneie o QR Code no aplicativo do seu banco.</p><label for="checkoutPixPayload">Pix copia e cola</label><textarea readonly id="checkoutPixPayload" rows="3">${esc(order.pixPayload || '')}</textarea><button type="button" class="btn btn-soft" onclick="copyCheckoutPix()">Copiar Pix</button><p class="helper">Total: ${money(order.total)}.</p></div>` : `<div class="tracking-card"><b>Pagamento Pix</b><p>Total: ${money(order.total)}</p><p class="helper">O QR Pix não ficou disponível. Fale com a equipe antes de pagar.</p></div>`;
    document.getElementById('modalRoot').innerHTML = `<div class="modal-back"><div class="modal checkout-confirmation"><div class="eyebrow">Pedido recebido</div><h2>Obrigado, ${esc(order.name)}.</h2><p>Seu pedido <b>${esc(order.code)}</b> foi registrado. Guarde este código para acompanhar a compra.</p>${payment}<div class="modal-actions"><button class="btn" onclick="closeModal();document.getElementById('trackCode').value='${esc(order.code)}';document.getElementById('acompanhar').scrollIntoView({behavior:'smooth'})">Acompanhar pedido</button><button class="btn btn-soft" onclick="closeModal()">Fechar</button></div></div></div>`;
  };
  const previousAccount = window.openCustomerAccount;
  window.openCustomerAccount = async function (...args) {
    const result = await previousAccount?.apply(this, args);
    requestAnimationFrame(() => {
      const root = document.querySelector('#modalRoot .customer-panel-redesign'); if (!root) return;
      root.querySelector('[data-account-tab="addresses"]')?.remove(); root.querySelector('[data-account-panel="addresses"]')?.remove();
      root.querySelector('.customer-panel-welcome p')?.replaceChildren('Acompanhe pedidos, serviços e pagamentos em um só lugar.');
      root.querySelectorAll('.customer-delivery-tracking').forEach(element => element.remove());
    });
    return result;
  };
  if (location.pathname.replace(/\/$/, '') === '/entregas') {
    history.replaceState({}, '', '/painel');
    setTimeout(() => window.go?.('overview'), 0);
  }
})();
