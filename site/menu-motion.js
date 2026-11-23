(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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
