import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const site=path.resolve(import.meta.dirname,'../site'),css=fs.readFileSync(path.join(site,'theme-system.css'),'utf8');
function luminance(hex){hex=hex.slice(1);if(hex.length===3)hex=[...hex].map(c=>c+c).join('');const channels=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels.reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0)}
const pairs=[['text','bg'],['text','panel'],['text','raised'],['muted','bg'],['muted','panel'],['muted','raised'],['action-text','action'],['action-text','action-hover'],['accent','selected'],['accent','panel'],['success','success-bg'],['warning','warning-bg'],['on-hero','hero'],['on-hero','hero-end'],['hero-muted','hero'],['hero-muted','hero-end']];
for(const theme of ['light','dark']){
 const pattern=theme==='light'?/:root\{color-scheme:light;([^}]+)\}/:/:root\[data-theme="dark"\]\{color-scheme:dark;([^}]+)\}/;
 const match=css.match(pattern);if(!match)throw Error('Tema ausente: '+theme);
 const tokens=Object.fromEntries([...match[1].matchAll(/--ui-([a-z-]+):\s*(#[a-f0-9]{3,6})/gi)].map(m=>[m[1],m[2]]));let lowest=Infinity;
 for(const [foreground,background] of pairs){const a=luminance(tokens[foreground]),b=luminance(tokens[background]),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);if(ratio<4.5)throw Error(`${theme}: ${foreground}/${background} = ${ratio.toFixed(2)}:1`);lowest=Math.min(lowest,ratio)}
 console.log(`${theme}: ${pairs.length} pares verificados; contraste mínimo ${lowest.toFixed(2)}:1.`);
}
let checked=0;
for(const name of fs.readdirSync(site)){
 if(!/\.(html|js|mjs)$/.test(name))continue;const file=path.join(site,name),text=fs.readFileSync(file,'utf8');
 if(name.endsWith('.js'))new vm.Script(text,{filename:file});
 if(name.endsWith('.html'))for(const script of text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script[1],{filename:file});
 if(/--[\w-]*var\(/.test(text))throw Error('Referência de variável CSS inválida em '+name);
 checked++;
}
const index=fs.readFileSync(path.join(site,'index.html'),'utf8');if(index.includes('neutral-theme.js'))throw Error('Referência ao tema anterior.');if(!index.includes('theme-system.js'))throw Error('Tema principal desconectado.');
for(const [open,close] of [['{','}']])if(css.split(open).length!==css.split(close).length)throw Error('CSS com delimitadores incompletos.');
console.log(`${checked} arquivos da interface conferidos. Tema único conectado.`);
