import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '../site');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + sep)) { response.writeHead(404).end(); return; }
  try {
    const content = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(content);
  } catch { response.writeHead(404).end(); }
});
const profilePrefix = join(resolve(tmpdir()), 'protec-nav-');
const profile = await mkdtemp(profilePrefix);
let browser, socket;

async function until(check, description) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const value = await check();
    if (value) return value;
    await delay(100);
  }
  assert.fail(description);
}

try {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const chrome = process.env.PROTEC_TEST_CHROME || (process.platform === 'win32'
    ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : 'google-chrome');
  browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  await once(browser, 'spawn');
  const port = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(() => '')).split(/\r?\n/)[0], 'Chrome não abriu sua porta local');
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(result => result.json());
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await once(socket, 'open', { signal: AbortSignal.timeout(10000) });
  let id = 0;
  const calls = new Map();
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); calls.get(message.id)?.(message); calls.delete(message.id); });
  async function send(method, params = {}) {
    const next = ++id;
    const response = await new Promise(done => { calls.set(next, done); socket.send(JSON.stringify({ id: next, method, params })); });
    assert.ok(!response.error, JSON.stringify(response.error));
    return response.result;
  }
  async function evaluate(fn, ...args) {
    const response = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  const show = selector => evaluate(sel => Boolean(document.querySelector(sel)?.getClientRects().length), selector);
  async function click(selector) {
    await until(() => show(selector), `Controle invisível: ${selector}`);
    await evaluate(sel => document.querySelector(sel).click(), selector);
  }
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const networkFetch = window.fetch;
    window.fetch = (input, options) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href), path = url.pathname;
      if (path === '/api/public/track') return Promise.resolve(Response.json({ order: { code: url.searchParams.get('code'), kind: 'Manutenção', status: 'Recebido' } }));
      if (path.startsWith('/api/')) return Promise.resolve(Response.json({ counts: {}, services: [], balanceCents: 0 }));
      return networkFetch(input, options);
    };` });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url });
  await until(() => evaluate(() => Boolean(window.offlineServices && window.openServiceDetails && window.protecClientView)), 'Módulos do site não iniciaram');

  await evaluate(() => {
    const prior = window.apiCall;
    window.apiCall = (path, ...args) => {
      const url = new URL(path, location.href);
      if (url.pathname === '/api/public/track') return Promise.resolve(Response.json({ order: { code: url.searchParams.get('code'), kind: 'Manutenção', status: 'Recebido' } }));
      return prior(path, ...args);
    };
  });
  await evaluate(() => window.openPublicTracking('FS-DEMO'));
  const visibleTracking = () => evaluate(() => {
    const tracking = document.getElementById('publicTracking'), code = document.getElementById('trackCode').value;
    return { code, shown: tracking.getClientRects().length, content: tracking.textContent, active: document.getElementById('acompanhar').className };
  });
  try { await until(async () => { const state = await visibleTracking(); return state.code.startsWith('FS-') && state.shown && state.content.includes(state.code); }, 'O botão não abriu o rastreio'); }
  catch (error) { console.error(await visibleTracking()); throw error; }

  await evaluate(() => {
    localStorage.setItem('protecextintores_role', 'admin');
    db.clients = [{ id:'c1', name:'Condomínio Aurora', phone:'11911111111' }, { id:'c2', name:'Condomínio Aurora', phone:'11922222222' }];
    const unit = { type:'Pó ABC', kg:'6', serial:'ABC-01', status:'Concluído', history:[] };
    db.services = [
      { id:'s1', clientId:'c1', clientName:'Condomínio Aurora', code:'OS-001', date:'2026-11-22', closed:true, price:100, items:[unit, { ...unit, kg:'6 kg', serial:'ABC-02' }], soldExtinguishers:[{type:'Pó ABC',kg:'6',condition:'new',quantity:1},{type:'Pó ABC',kg:'6',condition:'new',quantity:2}], finance:{revenueCents:10000, payment:{status:'pending'}}, history:[] },
      { id:'s2', clientId:'c1', clientName:'Condomínio Aurora', code:'OS-002', date:'2026-10-12', employeeCompletedAt:'2026-10-12', items:[unit], history:[] },
      { id:'s3', clientId:'c2', clientName:'Condomínio Aurora', code:'OS-003', date:'2026-11-15', status:'Cancelado', cancelledAt:'2026-11-16', items:[], history:[] }
    ];
    showDashboard();
  });
  await click('.protec-search-toggle');
  await evaluate(() => { const input = document.querySelector('#adminSearch input'); input.value = 'condominio aurora'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await evaluate(() => document.querySelectorAll('#adminSearch [data-open-client-record]').length), 2, 'homônimos precisam de cadastros separados');
  assert.equal(await evaluate(() => document.querySelectorAll('#adminSearch [data-client-order]').length), 0, 'a busca deve escolher o cliente primeiro');
  await click('#adminSearch [data-open-client-record="id:c1"]');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
  await until(() => evaluate(() => {
    const dialog = document.querySelector('.client-record-dialog').getBoundingClientRect();
    return dialog.left >= 0 && dialog.right <= innerWidth + 1 && dialog.bottom <= innerHeight + 1;
  }), 'Histórico do cliente não coube em 320 px');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.deepEqual(await evaluate(() => [...document.querySelectorAll('.record-subsection [data-client-order]')].map(button => button.dataset.clientOrder).sort()), ['s1', 's2']);
  await click('.record-equipment > summary');
  assert.match(await evaluate(() => document.querySelector('.record-series > summary').textContent), /ABC-01.*2 registros/);
  await click('.record-subsection [data-client-order=s1]');
  assert.equal(await evaluate(() => document.querySelectorAll('.order-group:first-child li').length), 1);
  await click('[data-ops-receipt]');
  assert.match(await evaluate(() => document.querySelector('.receipt-table tbody').textContent), /Extintores em manutenção.*Pó ABC · 6 kg2.*Fornecimento de extintores.*Novo lacrado · sem argola3/s);
  await evaluate(() => closeModal());

  await click('#adminTabbar [data-go=services]');
  await click('#pageTabs [data-go=service-clients]');
  await until(() => evaluate(() => location.pathname.endsWith('/servicos-por-cliente')), 'A rota Serviços por cliente não foi atualizada');
  await evaluate(() => { window.testBackCalls = 0; const prior = window.go; window.go = (...args) => { window.testBackCalls++; return prior(...args); }; history.back(); });
  await until(() => evaluate(() => window.page === 'services' && window.testBackCalls === 1), 'Voltar repetiu ou perdeu a navegação');

  await evaluate(() => go('alerts'));
  await click('[data-alert-key=s2]');
  assert.equal(await evaluate(() => document.querySelector('.ops-order-detail').dataset.opsDetail), 's2');
  await evaluate(() => { closeModal(); go('reports'); });
  const report = await evaluate(async () => {
    const original = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
    let file;
    URL.createObjectURL = blob => { file = blob; return original.call(URL, blob); };
    HTMLAnchorElement.prototype.click = () => {};
    try { document.querySelector('[data-report-export]').click(); }
    finally { URL.createObjectURL = original; HTMLAnchorElement.prototype.click = click; }
    return [(await file.text()).trim().split('\n').length - 1, document.querySelectorAll('[data-report-results] [data-alert-kind=order]').length];
  });
  assert.deepEqual(report, [2, 2]);
  await evaluate(() => { const status = document.querySelector('[name=status]'); status.value='Cancelado'; status.dispatchEvent(new Event('change', { bubbles:true })); });
  assert.equal(await evaluate(() => document.querySelector('[data-report-results] [data-alert-kind=order]').dataset.alertKey), 's3');

  await click('#adminTabbar [data-go=finance]');
  await until(() => show('.record-finance-layout'), 'Recebimentos não carregou');
  await click('[data-mobile-receipt="s1"]');
  assert.equal(await evaluate(() => document.querySelector('.ops-order-detail').dataset.opsDetail), 's1');
  await evaluate(() => closeModal());
  await click('#adminTabbar [data-go=overview]');
  await evaluate(() => { localStorage.setItem('protecextintores_session', 'test-admin'); db.__registrationProtocol = 8; });
  await click('#opsNewService');
  await until(() => show('.maintenance-registration-form [aria-current=step]'), 'Registrar serviço não abriu');
  await evaluate(() => closeModal());
  assert.equal(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log('Site no navegador: rastreio, homônimos, agrupamento, comprovante, histórico, alertas e CSV conferidos.');
} finally {
  socket?.close();
  if (browser?.pid) {
    const exited = once(browser, 'exit').catch(() => {});
    browser.kill();
    await Promise.race([exited, delay(1000)]);
  }
  server.close();
  if (resolve(profile).startsWith(profilePrefix)) await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }).catch(() => {});
}
