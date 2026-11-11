import fs from 'node:fs';
import path from 'node:path';
const site = path.resolve(import.meta.dirname, '../site');
const pwa = path.join(site, 'pwa-register.js');
let source = fs.readFileSync(pwa, 'utf8');
const start = source.indexOf('  /* Camada final:');
const end = source.indexOf("  document.documentElement.classList.add('protec-catalog-mode');", start);
if (start >= 0 && end >= 0) source = source.slice(0, start) + source.slice(end);
fs.writeFileSync(pwa, source);
// Migração mecânica de cores: mantém luminosidade e transparência e remove saturação.
function hexToNeutral(match) {
  let hex = match.slice(1);
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
  const channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const gray = Math.round(channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722).toString(16).padStart(2, '0');
  return '#' + gray.repeat(3) + (hex.length === 8 ? hex.slice(6) : '');
}
function neutralize(text) {
  return text.replace(/#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b/ig, hexToNeutral)
    .replace(/(rgba?\(\s*)(\d+(?:\.\d+)?)(\s*[, ]\s*)(\d+(?:\.\d+)?)(\s*[, ]\s*)(\d+(?:\.\d+)?)/ig, (_, prefix, r, s1, g, s2, b) => {
      const gray = Math.round(Number(r) * .2126 + Number(g) * .7152 + Number(b) * .0722);
      return prefix + gray + s1 + gray + s2 + gray;
    })
    .replace(/(hsla?\(\s*[\d.]+(?:deg)?\s*[, ]\s*)[\d.]+%/ig, '$10%')
    .replace(/((?:color|background(?:-color)?|fill|stroke|border-color|outline-color)\s*:\s*)(red|green|blue|orange|yellow|lime|cyan|teal|purple|pink)\b/ig, '$1#525252');
}
let count = 0;
function visit(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) visit(filename);
    else if (/\.(css|html|js|svg|webmanifest)$/.test(filename) && !/neutral-theme\.(js|css)$/.test(filename)) {
      const before = fs.readFileSync(filename, 'utf8');
      const after = neutralize(before);
      if (after !== before) { fs.writeFileSync(filename, after); count++; }
    }
  }
}
visit(site);
const index = path.join(site, 'index.html');
fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(/((?:src|href)="\.\/[^"?]+\.(?:css|js))\?v=[^" ]+/g, '$1?v=neutral-11'));
console.log(`${count} arquivos migrados para cores neutras. Camadas antigas de tema removidas.`);
