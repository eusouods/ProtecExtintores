import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),site=path.join(root,'site');
const {version,light,dark}=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'theme-palette.json'),'utf8'));
const tokens=values=>Object.entries(values).map(([key,value])=>`--ui-${key}:${value}`).join(';');
const stylesheet=path.join(site,'theme-system.css');let css=fs.readFileSync(stylesheet,'utf8');
css=css.replace(/:root\{color-scheme:light;[^}]+\}/,`:root{color-scheme:light;${tokens(light)}}`).replace(/:root\[data-theme="dark"\]\{color-scheme:dark;[^}]+\}/,`:root[data-theme="dark"]{color-scheme:dark;${tokens(dark)}}`);
css=css.replace(/@media print\{[^\n]+\}/,`@media print{:root,:root[data-theme="dark"]{${Object.entries(light).map(([key,value])=>`--ui-${key}:${value}!important`).join(';')}}html:root body{background:#fff!important;color:${light.text}!important}html:root body :is(.receipt-paper,.service-order){background:#fff!important;color:${light.text}!important;box-shadow:none!important}}`);
fs.writeFileSync(stylesheet,css);
for(const name of fs.readdirSync(site)){
 if(!/\.(?:html|js|mjs)$/.test(name))continue;
 const file=path.join(site,name);let text=fs.readFileSync(file,'utf8');text=text.replace(/(\.(?:css|js|mjs|png|svg)\?v=)[a-zA-Z0-9._-]+/g,'$1'+version);fs.writeFileSync(file,text);
}
const manifestFile=path.join(site,'manifest.webmanifest'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));manifest.theme_color=light.bg;manifest.background_color=light.bg;manifest.icons.forEach(icon=>icon.src=icon.src.split('?')[0]+'?v='+version);fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
const darkManifest={...manifest,theme_color:dark.bg,background_color:dark.bg,icons:manifest.icons.map(icon=>({...icon,src:icon.src.replace(/(icon-(?:maskable-)?(?:192|512))\.png/,'$1-dark.png')}))};fs.writeFileSync(path.join(site,'manifest-dark.webmanifest'),JSON.stringify(darkManifest,null,2)+'\n');
console.log('Identidade '+version+' e referências de cache atualizadas.');
