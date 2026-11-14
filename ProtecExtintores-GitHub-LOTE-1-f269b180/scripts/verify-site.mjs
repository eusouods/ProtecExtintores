import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {runInNewContext} from 'node:vm';

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

try {
  const source=readFileSync(resolve(site,'pwa-register.js'),'utf8'),end=source.indexOf('})();');
  const loaded=[],registered=[];
  runInNewContext(source.slice(0,end+5),{URL,location:{protocol:'https:',hostname:'example.com',href:'https://example.com/ProtecExtintores/painel/configuracoes'},document:{currentScript:{src:'https://example.com/ProtecExtintores/pwa-register.js'}},window:{addEventListener:(type,callback)=>{if(type==='load')loaded.push(callback)}},navigator:{serviceWorker:{register:url=>{registered.push(String(url));return Promise.resolve({})}}}});
  loaded.forEach(callback=>callback());
  if(registered[0]!=='https://example.com/ProtecExtintores/sw.js')fail('O service worker precisa continuar na raiz do projeto ao navegar entre os painéis.');
}catch(error){fail('Não foi possível validar o registro do service worker: '+error.message)}

const offlineManifest=JSON.parse(readFileSync(resolve(site,'offline-assets.json'),'utf8'));
for(const asset of offlineManifest.assets)check(asset,'offline-assets.json');

if (!process.exitCode) console.log('Validação de publicação concluída.');
