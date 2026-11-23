(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new WeakMap();
  window.protecMotion = Object.freeze({
    transition(element, { axis = 'Y', direction = 1, duration = 285 } = {}) {
      if (!element) return;
      animations.get(element)?.cancel();
      if (reducedMotion.matches || !element.animate) return;
      const animation = element.animate([
        { opacity: .78, transform: `translate${axis}(${direction * 10}px)` },
        { opacity: 1, transform: 'none' }
      ], { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
      animations.set(element, animation);
    },
    dismiss() {
      const backdrop = document.querySelector('#modalRoot > .modal-back');
      const modal = backdrop?.querySelector('.modal');
      if (modal?.dataset.saving === 'true') return;
      if (!modal || reducedMotion.matches || !modal.animate) return window.closeModal();
      if (backdrop.dataset.closing) return;
      backdrop.dataset.closing = 'true';
      backdrop.animate([{opacity: 1}, {opacity: 0}], {duration: 205, fill: 'forwards'});
      const animation = modal.animate([
        { opacity: 1, transform: getComputedStyle(modal).transform },
        { opacity: 0, transform: 'translateY(12px) scale(.98)' }
      ], { duration: 205, easing: 'cubic-bezier(.4,0,.7,.3)', fill: 'forwards' });
      const finish = () => { if (document.querySelector('#modalRoot > .modal-back') === backdrop) window.closeModal(); };
      animation.finished.then(finish, finish);
    }
  });

  window.bindProtecMenuMotion = sheet => {
    let closing = false;

    function close(afterClose) {
      if (!sheet.isConnected || closing) return;
      if (!sheet.open) {
        afterClose?.();
        return;
      }
      if (reducedMotion.matches || typeof sheet.getAnimations !== 'function') {
        sheet.close();
        afterClose?.();
        return;
      }

      closing = true;
      const transform = getComputedStyle(sheet).transform;
      sheet.style.setProperty('--protec-sheet-exit-from', transform);
      sheet.style.setProperty('--protec-backdrop-exit-from', getComputedStyle(sheet, '::backdrop').opacity);
      sheet.dataset.sheetClosing = '';
      const animation = sheet.getAnimations().find(item => item.animationName === 'protec-more-exit');
      const finish = () => {
        if (!closing) return;
        closing = false;
        const proceed = sheet.open && sheet.isConnected;
        if (sheet.open) sheet.close();
        delete sheet.dataset.sheetClosing;
        sheet.style.removeProperty('--protec-sheet-exit-from');
        sheet.style.removeProperty('--protec-backdrop-exit-from');
        if (proceed) afterClose?.();
      };
      if (!animation) {
        finish();
        return;
      }
      animation.finished.then(finish, finish);
    }

    sheet.addEventListener('cancel', event => {
      event.preventDefault();
      close();
    });
    sheet.addEventListener('submit', event => {
      if (event.target.method !== 'dialog') return;
      event.preventDefault();
      close();
    });
    sheet.addEventListener('click', event => {
      if (event.target !== sheet) return;
      const { left, right, top, bottom } = sheet.getBoundingClientRect();
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) close();
    });
    return close;
  };
})();
