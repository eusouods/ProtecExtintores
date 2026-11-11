import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const site=path.resolve(import.meta.dirname,'../site');
let files=0;const errors=[];
function walk(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
 const file=path.join(folder,entry.name);if(entry.isDirectory()){walk(file);continue}
 if(!/\.(css|html|js|svg|webmanifest)$/.test(file))continue;
 const text=fs.readFileSync(file,'utf8');files++;
 for(const match of text.matchAll(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/ig)){
  let hex=match[1];if(hex.length<5)hex=[...hex].map(c=>c+c).join('');
  if(hex.slice(0,2)!==hex.slice(2,4)||hex.slice(2,4)!==hex.slice(4,6))errors.push(`${path.relative(site,file)}: ${match[0]}`);
 }
 if(file.endsWith('.js'))new vm.Script(text,{filename:file});
 if(file.endsWith('.html'))for(const match of text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1],{filename:file});
}}
walk(site);
function lum(hex){let n=parseInt(hex,16)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}
const pairs=[['texto claro','20','ff'],['texto secundário claro','62','f6'],['botão claro','ff','30'],['texto escuro','ed','1e'],['texto secundário escuro','b0','25'],['botão escuro','f5','3d']];
for(const [label,a,b] of pairs){const ratio=(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);if(ratio<4.5)errors.push(`${label}: contraste ${ratio}`);console.log(`${label}: ${ratio.toFixed(2)}:1`)}
if(errors.length)throw Error(errors.join('\n'));
console.log(`${files} arquivos verificados: cores hexadecimais neutras e JavaScript válido.`);
