import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const site = resolve(root, 'site');
const fail = message => {
  console.error(`Erro de publicação: ${message}`);
  process.exitCode = 1;
};

const html = readFileSync(resolve(site, 'index.html'), 'utf8');
const config = readFileSync(resolve(site, 'config.js'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(site, 'manifest.webmanifest'), 'utf8'));

const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
try {
  if (!inlineScript) throw new Error('script principal ausente');
  new Function(inlineScript);
} catch (error) {
  fail(`o script principal do index.html contém erro de sintaxe: ${error.message}`);
}

const baseUrl = config.match(/PROTEC_API_BASE_URL\s*=\s*['"]([^'"]*)/i)?.[1] || '';
try {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:') fail('PROTEC_API_BASE_URL precisa usar HTTPS.');
} catch {
  fail('PROTEC_API_BASE_URL não contém uma URL válida.');
}

const localReference = value => value && !value.includes('${') && !/^(?:https?:|data:|#|mailto:|tel:)/i.test(value);
const check = (value, label) => {
  if (!localReference(value)) return;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname || pathname.startsWith('/')) return;
  if (!existsSync(resolve(site, pathname))) fail(`${label} aponta para um arquivo inexistente: ${value}`);
};

for (const match of html.matchAll(/<(?:script|link|img)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)) check(match[1], 'index.html');
for (const icon of manifest.icons || []) check(icon.src, 'manifest.webmanifest');

if (!/serviceWorker\.register\(['"]\.\/sw\.js/.test(readFileSync(resolve(site, 'pwa-register.js'), 'utf8'))) {
  fail('O registro do service worker não aponta para ./sw.js.');
}

if (!process.exitCode) console.log('Validação de publicação concluída.');
