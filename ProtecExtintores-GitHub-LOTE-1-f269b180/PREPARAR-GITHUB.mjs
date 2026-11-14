// Gera uma cópia nova para upload manual. Não instala pacotes nem altera a origem.
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync} from 'node:fs';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';

export const uploadFiles = [
  ".github/workflows/android-apk.yml",
  ".github/workflows/check.yml",
  ".github/workflows/pages.yml",
  ".gitignore",
  "PREPARAR-GITHUB.mjs",
  "README.md",
  "android-app/app/build.gradle",
  "android-app/app/src/main/AndroidManifest.xml",
  "android-app/app/src/main/java/br/com/protecextintores/app/MainActivity.java",
  "android-app/app/src/main/java/br/com/protecextintores/app/OfflineBridge.java",
  "android-app/app/src/main/java/br/com/protecextintores/app/OfflineSyncWorker.java",
  "android-app/app/src/main/java/br/com/protecextintores/app/OfflineVault.java",
  "android-app/app/src/main/res/drawable-nodpi/company_logo.png",
  "android-app/app/src/main/res/drawable-nodpi/company_logo_foreground.png",
  "android-app/app/src/main/res/drawable/ic_launcher_foreground.xml",
  "android-app/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",
  "android-app/app/src/main/res/mipmap-anydpi/ic_launcher.xml",
  "android-app/app/src/main/res/values-night/colors.xml",
  "android-app/app/src/main/res/values-night/styles.xml",
  "android-app/app/src/main/res/values/colors.xml",
  "android-app/app/src/main/res/values/strings.xml",
  "android-app/app/src/main/res/values/styles.xml",
  "android-app/app/src/main/res/xml/network_security_config.xml",
  "android-app/build.gradle",
  "android-app/gradle.properties",
  "android-app/gradle/wrapper/gradle-wrapper.jar",
  "android-app/gradle/wrapper/gradle-wrapper.properties",
  "android-app/gradlew",
  "android-app/gradlew.bat",
  "android-app/settings.gradle",
  "api-cloudflare/.gitignore",
  "api-cloudflare/migrations/0001_init.sql",
  "api-cloudflare/migrations/0002_sellers_and_service_claims.sql",
  "api-cloudflare/migrations/0003_customer_care.sql",
  "api-cloudflare/migrations/0004_pix_provider.sql",
  "api-cloudflare/migrations/0005_offline_receipts.sql",
  "api-cloudflare/package-lock.json",
  "api-cloudflare/package.json",
  "api-cloudflare/src/index.js",
  "api-cloudflare/src/offline.mjs",
  "api-cloudflare/src/operations.mjs",
  "api-cloudflare/src/team-billing.mjs",
  "api-cloudflare/wrangler.jsonc",
  "scripts/release-offline.mjs",
  "scripts/release-theme.mjs",
  "scripts/test-offline-api.mjs",
  "scripts/test-offline-rules.mjs",
  "scripts/test-service-rules.mjs",
  "scripts/theme-palette.json",
  "scripts/verify-site.mjs",
  "scripts/verify-theme.mjs",
  "site/.nojekyll",
  "site/404.html",
  "site/_redirects",
  "site/app-features.js",
  "site/brand-migration.js",
  "site/commerce-no-logistics.js",
  "site/config.js",
  "site/extintor-original.svg",
  "site/icons/company-logo.png",
  "site/icons/favicon-16.png",
  "site/icons/favicon-32.png",
  "site/icons/icon-192-dark.png",
  "site/icons/icon-192.png",
  "site/icons/icon-512-dark.png",
  "site/icons/icon-512.png",
  "site/icons/icon-maskable-512-dark.png",
  "site/icons/icon-maskable-512.png",
  "site/icons/protec-icon-dark.svg",
  "site/icons/protec-icon.svg",
  "site/index.html",
  "site/manifest-dark.webmanifest",
  "site/manifest.webmanifest",
  "site/offline-assets.json",
  "site/offline-rules.mjs",
  "site/offline-services.css",
  "site/offline-services.mjs",
  "site/offline-vault.mjs",
  "site/operations-center.js",
  "site/operations-ui.css",
  "site/operations-ui.mjs",
  "site/product-art.js",
  "site/professional-updates.css",
  "site/pwa-register.js",
  "site/robots.txt",
  "site/service-management.mjs",
  "site/service-rules.mjs",
  "site/site-styles.css",
  "site/sitemap.xml",
  "site/sw.js",
  "site/theme-mode.js",
  "site/theme-system.css",
  "site/theme-system.js",
  "tests/service-workflows.html"
];

export const uploadBatches={
 1:uploadFiles.filter(name=>!name.startsWith('site/')&&!name.startsWith('tests/')),
 2:uploadFiles.filter(name=>name.startsWith('site/')||name.startsWith('tests/'))
};

export function prepareGitHubCopy(batch=1){
 const source=realpathSync(dirname(fileURLToPath(import.meta.url)));
 if(![1,2].includes(Number(batch)))throw Error('Escolha o lote 1 ou 2: node PREPARAR-GITHUB.mjs 1 ou node PREPARAR-GITHUB.mjs 2');
 batch=Number(batch);
 if(!existsSync(resolve(source,'site/index.html'))||!existsSync(resolve(source,'api-cloudflare/src/index.js')))throw Error('Execute o gerador na pasta original completa extraída do ZIP, onde estão site e api-cloudflare.');
 const files=uploadBatches[batch],folders=new Set();
 for(const name of files){const parts=name.split('/');for(let i=1;i<parts.length;i++)folders.add(parts.slice(0,i).join('/'));}
 // Count folders as well, even when an uploader reports a combined item count.
 const total=files.length+folders.size+1;
 if(total>=100)throw Error('Este lote ultrapassou o limite conservador de itens. Atualize o pacote.');
 const parent=dirname(source),target=resolve(parent,'ProtecExtintores-GitHub-LOTE-'+batch+'-'+randomUUID().slice(0,8));
 if(target===source||relative(parent,target).startsWith('..')||existsSync(target))throw Error('Não foi possível criar uma pasta nova para envio.');
 // Copy only the versioned files in this manifest. Dependency trees, build
 // directories and local environment files are absent from the list.
 const inputs=files.map(name=>{
  const input=resolve(source,name),rel=relative(source,input);
  if(isAbsolute(name)||rel.startsWith('..'+sep)||rel==='..'||rel.split(sep).some(p=>['node_modules','.git','.wrangler','.gradle','build','dist'].includes(p)))throw Error('Caminho não permitido: '+name);
  const stat=lstatSync(input);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Arquivo ausente ou inválido: '+name);
  const actual=relative(source,realpathSync(input));if(actual==='..'||actual.startsWith('..'+sep)||isAbsolute(actual))throw Error('Arquivo fora da pasta do projeto: '+name);
  return {name,input};
 });
 mkdirSync(target);
 const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
 for(const {name,input} of inputs){
  const output=resolve(target,name);if(relative(target,output).startsWith('..'+sep))throw Error('Destino inválido.');
  mkdirSync(dirname(output),{recursive:true});copyFileSync(input,output);
  if(digest(input)!==digest(output))throw Error('Falha ao conferir o arquivo: '+name);
 }
 console.log('Pasta pronta: '+target);
 console.log('ENVIO '+batch+' DE 2: '+files.length+' arquivos + '+folders.size+' pastas internas. Contagem com a pasta externa: '+total+' itens.');
 console.log('Abra SOMENTE essa pasta e envie o CONTEÚDO dela na raiz do GitHub. Não envie as duas pastas de lotes juntas.');
 if(batch===1)console.log('Depois de confirmar este envio, volte ao mesmo terminal na pasta original e execute: node PREPARAR-GITHUB.mjs 2');
 else console.log('Confirme o segundo envio no GitHub. Com os dois lotes enviados, a estrutura completa estará atualizada.');
 console.log('Use a pasta original para npm install e deploy; mantenha os lotes limpos.');
 return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{prepareGitHubCopy(process.argv[2]||1);}catch(error){console.error('Não foi possível preparar o envio: '+error.message);process.exitCode=1;}
}
