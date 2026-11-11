import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'site/index.html');
let html=fs.readFileSync(file,'utf8').replaceAll('./neutral-theme.js','./theme-system.js');
html=html.replace(/((?:src|href)="\.\/[^"?]+\.(?:css|js|mjs))\?v=[^" ]+/g,'$1?v=vibrant-13.1');
html=html.replace(/(<meta name="theme-color" content=")[^"]+/, '$1#6d28d9');
fs.writeFileSync(file,html);
const theme=path.join(root,'site/theme-system.css');
fs.writeFileSync(theme,fs.readFileSync(theme,'utf8').replaceAll('--ui-hero-muted:#e9ddff','--ui-hero-muted:#f0eaff'));
for(const name of ['index.html','homepage-rebrand.js']){
 const target=path.join(root,'site',name);let text=fs.readFileSync(target,'utf8');
 text=text.replaceAll('Compre extintores e solicite instalação, manutenção e outros serviços de segurança.','Consulte extintores e solicite instalação, manutenção e outros serviços de segurança.');
 text=text.replaceAll('Compre extintores e peça recarga','Consulte extintores e peça recarga');
 if(name==='index.html')text=text.replace(/(href="\.\/icons\/[^"?]+\.png)(?:\?[^" ]*)?/g,'$1?v=vibrant-13.1');
 fs.writeFileSync(target,text);
}
const manifestPath=path.join(root,'site/manifest.webmanifest'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
manifest.icons.forEach(icon=>icon.src=icon.src.split('?')[0]+'?v=vibrant-13.1');
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const videos=path.join(root,'site/employee-video-upload.js');fs.writeFileSync(videos,fs.readFileSync(videos,'utf8').replaceAll('Para cada peça substituído','Para cada peça substituída'));
console.log('Tema vibrante conectado; referências de cache atualizadas.');
