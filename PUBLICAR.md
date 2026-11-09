# Como publicar o site no GitHub Pages

O site fica na pasta `site/` e é publicado automaticamente pelo workflow `.github/workflows/pages.yml`.

## Primeira vez
1. Crie um repositório no GitHub chamado `ProtecExtintores` (o endereço final será `https://SEU-USUARIO.github.io/ProtecExtintores/`).
2. Envie **todo o conteúdo desta pasta** para o repositório (arrastando os arquivos em *Add file → Upload files*, ou com `git push`). A pasta `site/`, a pasta `.github/` e os demais arquivos precisam subir juntos.
3. No repositório, abra **Settings → Pages** e em **Source** escolha **GitHub Actions**.
4. Abra a aba **Actions**: o workflow "Publicar ProtecExtintores no GitHub Pages" roda sozinho. Quando ficar verde, o site está no ar.

## Próximas atualizações
Basta enviar os arquivos alterados para o ramo `main`. O workflow publica de novo e, se algum script tiver erro de sintaxe, a publicação é interrompida antes de ir ao ar.

## API (Cloudflare)
O Worker é publicado à parte, dentro de `api-cloudflare/`: `npm install` e depois `npm run deploy`. O endereço do site precisa estar em `ALLOWED_ORIGIN` no `wrangler.jsonc` (já inclui `https://eusouods.github.io`) e a URL da API em `site/config.js`.

## Antes de divulgar
- Preencha `site/config.js` (WhatsApp, telefone, endereço, horário).
- Se o seu usuário do GitHub não for `eusouods`, troque o endereço em `site/index.html` (canonical e og:image), `site/sitemap.xml`, `android-app/app/src/main/res/values/strings.xml` e `ALLOWED_ORIGIN` no `wrangler.jsonc`.
