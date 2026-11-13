import {readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const site=resolve(import.meta.dirname,'../site');
function walk(dir,prefix=''){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(resolve(dir,entry.name),prefix+entry.name+'/'):[prefix+entry.name])}
const assets=walk(site).filter(path=>/\.(?:css|js|mjs|svg|png|webmanifest|woff2?)$/.test(path));
writeFileSync(resolve(site,'offline-assets.json'),JSON.stringify({version:24,assets},null,2)+'\n');
console.log(`Manifesto offline gerado: ${assets.length} arquivos locais.`);
