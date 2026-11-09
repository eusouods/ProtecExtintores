/* Customer registration, sign-in, Google identity and session restore. */
(() => {
  const tokenKey = 'protecextintores_customer_session';
  const state = window.customerAccountState = window.customerAccountState || {authenticated:false,customer:null,token:''};
  let googleNonce = '';
  let googleScriptPromise = null;
  const originalSendPublicOrder = window.sendPublicOrder;

  function isTeamAccount() {
    return ['admin','employee','seller'].includes(localStorage.getItem('protecextintores_role')) || ['admin','employee','seller'].includes(sessionStorage.getItem('protecextintores_role'));
  }

  function customerRequest(path, method='GET', data=null) {
    const headers = {'Content-Type':'application/json'};
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    return fetch((window.PROTEC_API_BASE_URL||'').replace(/\/$/,'') + path, {
      method, headers, ...(data ? {body:JSON.stringify(data)} : {})
    });
  }

  async function readResponse(response) {
    let data;
    try { data = await response.json(); }
    catch { throw new Error('Não foi possível conversar com o servidor.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir o acesso.');
    return data;
  }

  function updateCustomerSession(data) {
    state.token = data.token;
    state.customer = data.customer;
    state.authenticated = true;
    localStorage.setItem(tokenKey, data.token);
    window.syncCartAccess?.();
  }

  function requireApi() {
    if (location.protocol === 'file:') throw new Error('Contas de cliente precisam do site publicado e da API online.');
  }

  function authBody(mode) {
    const registering = mode === 'register';
    return `<div class="customer-auth-copy"><p>${registering?'Crie sua conta para comprar e acompanhar seus pedidos.':'Entre para adicionar produtos ao carrinho e concluir seu pedido.'}</p></div>
      ${registering?'<div class="form-field"><label>Nome completo</label><input name="name" autocomplete="name" minlength="2" maxlength="100" required></div>':''}
      <div class="form-field"><label>E-mail</label><input name="email" type="email" autocomplete="email" maxlength="254" required></div>
      <div class="form-field"><label>Senha</label><input name="password" type="password" autocomplete="${registering?'new-password':'current-password'}" minlength="${registering?8:1}" maxlength="128" required>${registering?'<small class="helper">Use pelo menos 8 caracteres.</small>':''}</div>
      <button type="button" class="customer-auth-switch" onclick="openCustomerAuth('${registering?'login':'register'}')">${registering?'Já tem uma conta? Entrar':'Ainda não tem conta? Criar conta'}</button>
      <div class="customer-auth-divider"><span>ou</span></div>
      <div id="googleCustomerSignIn"></div>`;
  }

  function mountGoogleButton() {
    const host = document.getElementById('googleCustomerSignIn');
    if (!host) return;
    const clientId = String(window.PROTEC_GOOGLE_CLIENT_ID||'').trim();
    if (!clientId) {
      const divider = host.previousElementSibling;
      if (divider?.classList.contains('customer-auth-divider')) divider.remove();
      host.remove();
      return;
    }
    host.innerHTML = '<div class="google-button-mount"></div>';
    const render = () => {
      if (!window.google?.accounts?.id) return;
      googleNonce = crypto.randomUUID();
      window.google.accounts.id.initialize({client_id:clientId,nonce:googleNonce,callback:window.handleCustomerGoogleCredential});
      window.google.accounts.id.renderButton(host.querySelector('.google-button-mount'),{type:'standard',theme:'outline',size:'large',shape:'pill',text:'continue_with',width:340,locale:'pt-BR'});
    };
    if (window.google?.accounts?.id) { render(); return; }
    if (!googleScriptPromise) googleScriptPromise = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
      script.onload = resolve; script.onerror = () => reject(new Error('Não foi possível carregar o login Google.'));
      document.head.appendChild(script);
    });
    googleScriptPromise.then(render).catch(error => { if (host.isConnected) host.innerHTML = `<small>${esc(error.message)}</small>`; });
  }

  window.openCustomerAuth = function(mode='login') {
    if (isTeamAccount()) { toast('Saia do painel da equipe antes de entrar como cliente.'); return; }
    const registering = mode === 'register';
    openModal(registering?'Criar conta de cliente':'Entrar na loja',authBody(registering?'register':'login'),async form => {
      try {
        requireApi();
        const payload = registering
          ? {name:String(form.get('name')||'').trim(),email:String(form.get('email')||'').trim(),password:String(form.get('password')||'')}
          : {email:String(form.get('email')||'').trim(),password:String(form.get('password')||'')};
        const response = await customerRequest(registering?'/api/customer/register':'/api/customer/login','POST',payload);
        updateCustomerSession(await readResponse(response));
        toast(registering?'Conta criada. Você já pode comprar.':'Você entrou na sua conta.');
        return true;
      } catch (error) { toast(error.message); return false; }
    },registering?'Criar conta':'Entrar');
    mountGoogleButton();
  };

  window.handleCustomerGoogleCredential = async function(response) {
    try {
      requireApi();
      const result = await readResponse(await customerRequest('/api/customer/google','POST',{credential:response.credential,nonce:googleNonce}));
      updateCustomerSession(result); closeModal(); toast('Conta Google conectada. Você já pode comprar.');
    } catch (error) { toast(error.message); }
  };

  window.openCustomerAccount = function() {
    if (!state.authenticated || !state.customer) return window.openCustomerAuth('login');
    const body = `<div class="customer-account-card"><span class="customer-account-avatar">${esc((state.customer.name||'C').slice(0,1).toUpperCase())}</span><div><b>${esc(state.customer.name)}</b><small>${esc(state.customer.email)}</small></div></div><p class="helper">Sua conta está conectada à loja. Seus pedidos usam este nome e e-mail.</p><button type="button" class="btn btn-soft customer-signout" onclick="logoutCustomer()">Sair da conta</button>`;
    openModal('Minha conta',body,()=>true,'Fechar');
  };

  window.logoutCustomer = async function() {
    const token = state.token;
    localStorage.removeItem(tokenKey);
    state.token = ''; state.customer = null; state.authenticated = false;
    if (typeof db !== 'undefined') { db.cart = []; saveLocal(); updateCartCount(); }
    closeModal(); window.syncCartAccess?.(); toast('Você saiu da sua conta.');
    // Clear the local session immediately; the API may be unavailable or slow.
    if (token) {
      const base = (window.PROTEC_API_BASE_URL || '').replace(/\/$/, '');
      fetch(base + '/api/customer/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        keepalive: true
      }).catch(() => {});
    }
  };

  window.sendPublicOrder = function(data) {
    const kind = data?.order?.kind;
    if (!['Venda','Manutenção'].includes(kind)) {
      return originalSendPublicOrder ? originalSendPublicOrder(data) : Promise.resolve(true);
    }
    if (isTeamAccount()) return Promise.resolve(false);
    if (!state.authenticated || !state.token) {
      // Orçamento não exige conta; compra exige.
      if (kind !== 'Manutenção') return Promise.resolve(false);
      if (typeof API_ENABLED !== 'undefined' && !API_ENABLED) return Promise.resolve(true);
      return window.apiCall('/api/public/orders','POST',data).then(async response=>{
        if(!response.ok){let result={};try{result=await response.json()}catch{}throw new Error(result.error||'Não foi possível enviar a solicitação.')}
        return true;
      });
    }
    return customerRequest('/api/public/orders','POST',data).then(async response=>{
      if(response.status===401){localStorage.removeItem(tokenKey);state.token='';state.customer=null;state.authenticated=false;window.syncCartAccess?.();if(kind==='Manutenção')throw new Error('Sua sessão expirou. Entre novamente para solicitar o serviço.');toast('Sua sessão expirou. Entre novamente para continuar.');return false}
      let result={};try{result=await response.json()}catch{}if(!response.ok){const error=new Error(result.error||'Não foi possível enviar o pedido.');if(kind==='Manutenção')throw error;toast(error.message);return false}if(result.payment&&data?.order)Object.assign(data.order,result.payment);return true;
    }).catch(error=>{if(kind==='Manutenção')throw error;toast(error.message||'Não foi possível enviar o pedido.');return false});
  };

  async function restoreCustomerSession() {
    const token = localStorage.getItem(tokenKey);
    if (!token || isTeamAccount()) { window.syncCartAccess?.(); return; }
    state.token = token;
    try {
      const response = await customerRequest('/api/customer/session');
      if (response.status === 401 || response.status === 403) {
        // Sessão realmente inválida/expirada: só aqui o token é descartado.
        localStorage.removeItem(tokenKey); state.token=''; state.customer=null; state.authenticated=false;
      } else {
        const result = await readResponse(response);
        state.customer = result.customer; state.authenticated = true;
      }
    } catch {
      // Falha de rede/API fora do ar: mantém o token salvo para tentar de novo depois,
      // sem deixar o cliente como autenticado.
      state.customer=null; state.authenticated=false;
    }
    window.syncCartAccess?.();
  }

  window.addEventListener('storage', event => {
    if(event.key!==tokenKey)return;
    if(event.newValue){restoreCustomerSession();return}
    state.token='';state.customer=null;state.authenticated=false;window.syncCartAccess?.();
  });

  restoreCustomerSession();
})();
