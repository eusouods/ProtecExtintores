/* Tema neutro único: remove cores chamativas e preserva contraste legível. */
(() => {
  const style = document.createElement('style');
  style.id = 'protec-neutral-theme';
  style.textContent = `
    :root,.protec-catalog-mode{
      --protec-surface:#f5f5f4!important;--protec-ink:#1c1917!important;--protec-accent:#44403c!important;--protec-deep:#292524!important;--protec-muted:#78716c!important;
      --primary:#44403c!important;--primary-dark:#292524!important;--primary-light:#e7e5e4!important;--accent:#44403c!important;--accent-soft:#e7e5e4!important;
      --ink:#1c1917!important;--muted:#78716c!important;--line:#e7e5e4!important;--paper:#f5f5f4!important;--white:#fff!important;
      --brand:#44403c!important;--brand-hover:#292524!important;--focus:#57534e!important;--success:#44403c!important;--success-bg:#f5f5f4!important;--warning:#57534e!important;
      --yellow:#57534e!important;--yellow2:#78716c!important;--green:#44403c!important;--lime:#78716c!important;--red:#44403c!important;
      --blue:#44403c!important;--blue-dark:#292524!important;--blue-light:#e7e5e4!important;--navy:#292524!important;--navy-2:#44403c!important;
      --dash-primary:#44403c!important;--dash-primary-hover:#292524!important;--dash-accent:#78716c!important;--dash-green:#44403c!important;--dash-blue-soft:#e7e5e4!important;
      --admin-ink:#1c1917!important;--admin-muted:#78716c!important;--admin-line:#e7e5e4!important;--admin-bg:#f5f5f4!important;--admin-panel:#fff!important;--admin-navy:#292524!important;--admin-navy-2:#44403c!important;--admin-accent:#44403c!important;--admin-blue-soft:#e7e5e4!important;
      --customer-brand:#44403c!important;--customer-lime:#78716c!important;
    }
    body,#store,#login,#dashboard.app,#dashboard .main,#dashboard .admin-content,.employee-portal,.seller-dashboard{background:#f5f5f4!important;color:#1c1917!important}
    #store .topbar,#dashboard .sidebar,.employee-top,.seller-top,.site-header,.public-header,.dashboard-header,.footer,.site-footer,#store footer,.public-footer{background:#292524!important;color:#fafaf9!important;border-color:#44403c!important}
    #store .hero,#login .login-aside,.login-aside{background:linear-gradient(135deg,#292524 0%,#44403c 100%)!important;color:#fafaf9!important}
    :is(.topbar,.sidebar,.employee-top,.seller-top,.site-header,.public-header,.dashboard-header,.footer,.site-footer,.public-footer,.login-aside) :is(h1,h2,h3,h4,h5,h6,p,a,strong,span,small){color:#fafaf9!important}
    :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)){background:#44403c!important;color:#fafaf9!important;border-color:#44403c!important;box-shadow:0 7px 16px rgb(28 25 23 / 14%)!important}
    :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)):hover{background:#292524!important;border-color:#292524!important;box-shadow:0 10px 20px rgb(28 25 23 / 22%)!important}
    :is(.btn-soft,.btn-secondary,.button-secondary,.btn-outline,.button-outline,.secondary-button){background:#fafaf9!important;color:#44403c!important;border-color:#d6d3d1!important;box-shadow:none!important}
    :is(.panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro,.card,.form-card,.employee-card,.seller-card,.service-card,.dashboard-card,.stat-card,.product-card,.public-product,.catalog-card,.modal,.modal-content,.ops-month,.ops-summary article,.ops-alert-card,.team-operations-summary article){background:#fff!important;color:#1c1917!important;border-color:#e7e5e4!important;box-shadow:0 10px 25px rgb(28 25 23 / 6%)!important}
    :is(.brand-mark,.dashboard-stat-icon,.dashboard-eyebrow:before,.employee-tabs button.active span,.seller-service-tabs button.active span){background:#44403c!important;color:#fafaf9!important}
    :is(.eyebrow,#store .hero h1 span,.dashboard-eyebrow,.dashboard-role-chip,.dashboard-stat-icon,.employee-tabs button.active,.seller-service-tabs button.active,.mobile-admin-nav button.active,.employee-group>strong small,.type-group,.receipt-brand,.receipt-code b,.price-from){color:#44403c!important}
    :is(.catalog-category,.badge,.tag,.pill,.chip,.status,.status-success,.success,.available,.active-badge,.inventory-low,.request-result-error,.notification-success,.alert,.alert-success,.alert-info,.notice,.notice-success,.empty-state,.info-box,.success-box){background:#f5f5f4!important;color:#44403c!important;border-color:#d6d3d1!important}
    :is(.employee-tabs,.seller-service-tabs,.mobile-admin-nav){background:#f5f5f4!important;border-color:#d6d3d1!important}
    :is(.employee-tabs button.active,.seller-service-tabs button.active,.mobile-admin-nav button.active,.tab.active,.tabs button.active,.filter.active){background:#e7e5e4!important;color:#292524!important;border-color:#78716c!important;box-shadow:inset 3px 0 #44403c!important}
    :is(.progress,.progress-bar,.meter-fill,.completion-bar,.timeline-dot,.step.active,.step.done,.toggle input:checked + span,.switch input:checked + span){background:#57534e!important;border-color:#57534e!important}
    :is(.fab,.floating-action,.whatsapp-button,.whatsapp-float,.contact-float){background:#44403c!important;color:#fafaf9!important;box-shadow:0 10px 20px rgb(28 25 23 / 18%)!important}
    :is(input,select,textarea,[contenteditable="true"]){background:#fff!important;color:#1c1917!important;border-color:#d6d3d1!important;caret-color:#44403c!important}
    :is(input,select,textarea)::placeholder{color:#78716c!important;opacity:1}
    :is(input,select,textarea):focus,:is(button,a,input,select,textarea):focus-visible{outline-color:#57534e!important;border-color:#57534e!important;box-shadow:0 0 0 3px rgb(87 83 78 / 16%)!important}
    #store :is(h1,h2,h3,h4,h5,h6,strong,th,legend),#login :is(h1,h2,h3,h4,h5,h6,strong,th,legend),#dashboard :is(h1,h2,h3,h4,h5,h6,strong,th,legend){color:#1c1917!important}
    #store :is(p,label,td,li,small,.helper,.muted,.subtitle,.description),#login :is(p,label,td,li,small,.helper,.muted,.subtitle,.description),#dashboard :is(p,label,td,li,small,.helper,.muted,.subtitle,.description){color:#57534e!important}
    #store a:not(.btn):not(.button),#login a:not(.btn):not(.button),#dashboard a:not(.btn):not(.button){color:#44403c!important}
    .toast{background:#292524!important;border-left-color:#a8a29e!important;color:#fafaf9!important}

    html[data-theme="dark"]{color-scheme:dark;--protec-surface:#18181b!important;--protec-ink:#e7e5e4!important;--protec-accent:#a8a29e!important;--protec-deep:#18181b!important;--protec-muted:#a1a1aa!important;--ink:#e7e5e4!important;--muted:#a1a1aa!important;--line:#3f3f46!important;--paper:#18181b!important;--white:#27272a!important;--brand:#a8a29e!important;--brand-hover:#d6d3d1!important;--focus:#d6d3d1!important;--success:#a8a29e!important;--success-bg:#27272a!important;--warning:#a1a1aa!important;--yellow:#a1a1aa!important;--yellow2:#d6d3d1!important;--green:#a8a29e!important;--lime:#d6d3d1!important;--red:#a8a29e!important;--blue:#a8a29e!important;--blue-dark:#d6d3d1!important;--blue-light:#27272a!important;--navy:#18181b!important;--navy-2:#27272a!important;--dash-primary:#a8a29e!important;--dash-primary-hover:#d6d3d1!important;--dash-accent:#d6d3d1!important;--dash-green:#a8a29e!important;--dash-blue-soft:#27272a!important;--admin-ink:#e7e5e4!important;--admin-muted:#a1a1aa!important;--admin-line:#3f3f46!important;--admin-bg:#18181b!important;--admin-panel:#27272a!important;--admin-navy:#18181b!important;--admin-navy-2:#27272a!important;--admin-accent:#a8a29e!important;--admin-blue-soft:#27272a!important;--customer-brand:#a8a29e!important;--customer-lime:#d6d3d1!important}
    html[data-theme="dark"] body,html[data-theme="dark"] #store,html[data-theme="dark"] #login,html[data-theme="dark"] #dashboard,html[data-theme="dark"] :is(.page,.page-shell,.page-content,.content,.content-area,.main,.main-content,.admin-content,.employee-portal,.seller-dashboard,.login-main){background:#18181b!important;color:#e7e5e4!important}
    html[data-theme="dark"] :is([class*="card"],[class*="panel"],[class*="modal"],[class*="table"],[class*="form"],[class*="drawer"],[class*="dropdown"],[class*="popover"],[class*="menu"],.panel,.stat,.product,.config-card,.table-wrap,.admin-page-intro,.catalog-card,.ops-month,.ops-summary article,.ops-alert-card,.team-operations-summary article){background:#27272a!important;color:#e7e5e4!important;border-color:#3f3f46!important;background-image:none!important;box-shadow:none!important}
    html[data-theme="dark"] :is(h1,h2,h3,h4,h5,h6,strong,th,legend){color:#e7e5e4!important}
    html[data-theme="dark"] :is(p,label,td,li,small,.helper,.muted,.subtitle,.description){color:#c4c4c7!important}
    html[data-theme="dark"] a:not(.btn):not(.button){color:#d6d3d1!important}
    html[data-theme="dark"] :is(input,select,textarea,[contenteditable="true"]){background:#202024!important;color:#e7e5e4!important;border-color:#52525b!important}
    html[data-theme="dark"] :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)){background:#3f3f46!important;color:#f5f5f4!important;border-color:#52525b!important;box-shadow:none!important}
    html[data-theme="dark"] :is(.btn,.btn-dark,.btn-primary,.button-primary,.primary-button,.save-button,.action-primary,.add-button,.submit-button,.btn-success,.button-success,.success-button,#dashboard #content .btn:not(.btn-soft)):hover{background:#52525b!important;border-color:#71717a!important}
    html[data-theme="dark"] :is(.btn-soft,.btn-secondary,.button-secondary,.btn-outline,.button-outline,.secondary-button){background:#303035!important;color:#e7e5e4!important;border-color:#52525b!important}
    html[data-theme="dark"] :is(.catalog-category,.badge,.tag,.pill,.chip,.status,.status-success,.success,.available,.active-badge,.inventory-low,.request-result-error,.notification-success,.alert,.alert-success,.alert-info,.notice,.notice-success,.empty-state,.info-box,.success-box,.employee-tabs,.seller-service-tabs,.mobile-admin-nav,.tab.active,.tabs button.active,.filter.active){background:#303035!important;color:#d6d3d1!important;border-color:#52525b!important}
    html[data-theme="dark"] :is(.topbar,.site-header,.public-header,.footer,.site-footer,.public-footer,.sidebar,.admin-sidebar,.app-sidebar,.dashboard-header,.employee-top,.seller-top,#login .login-aside){background:#18181b!important;color:#e7e5e4!important;border-color:#3f3f46!important}
    html[data-theme="dark"] :is(.topbar,.site-header,.public-header,.footer,.site-footer,.public-footer,.sidebar,.admin-sidebar,.app-sidebar,.dashboard-header,.employee-top,.seller-top,#login .login-aside) :is(h1,h2,h3,h4,h5,h6,p,a,strong,span,small){color:#e7e5e4!important}
    html[data-theme="dark"] :is(.ops-event time,.ops-count){background:#303035!important;color:#d6d3d1!important}
  `;
  document.head.append(style);

  const legacyColors = /#(?:0131cd|2f5cf0|174de4|10234f|102641|13233b|17365d|0d284b|14243b|1c9c69|31ba83|13945f|0e8052|72dfb2|129760|1f7a4d|1f9d57|17804a|55d4a8|386b4b|17633a|166534|176b55|254000|365400|b9fc01|caff45|e23d28|b82e20|ff6b35|f59e0b|fda4af|ffad91|9f1239|4c1021|2563eb|1d4ed8|60a5fa|93c5fd|dbeafe|172554|1e40af|bfdbfe)/ig;
  const neutralizeInlineColor = root => {
    const nodes = root instanceof Element && root.matches('[style]') ? [root, ...root.querySelectorAll('[style]')] : root.querySelectorAll?.('[style]') || [];
    nodes.forEach(node => {
      const current = node.getAttribute('style');
      if (current && legacyColors.test(current)) node.setAttribute('style', current.replace(legacyColors, '#44403c'));
      legacyColors.lastIndex = 0;
    });
  };
  neutralizeInlineColor(document);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) neutralizeInlineColor(node);
  }))).observe(document.body, { childList: true, subtree: true });
})();
