import {readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const site=resolve(import.meta.dirname,'../site');
function walk(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(dir,entry.name),prefix+entry.name+'/'):[prefix+entry.name])}
const release=JSON.parse(readFileSync(resolve(import.meta.dirname,'theme-palette.json'),'utf8')).version;
const files=walk(site).filter(path=>/\.(?:css|js|mjs|svg|png|webmanifest|woff2?)$/.test(path));
const assets=[...new Set([...files,...files.filter(p=>/\.(?:css|m?js)$/.test(p)).map(p=>p+'?v='+release)])];
writeFileSync(resolve(site,'offline-assets.json'),JSON.stringify({version:55,assets},null,2)+'\n');
console.log(`Manifesto offline gerado: ${assets.length} arquivos locais.`);
