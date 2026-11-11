# Paleta vibrante

Aplicação da paleta aprovada: violeta para ações e seleção, ciano para conclusão e confirmação, âmbar para avisos e pendências.

O sistema visual fica em `site/theme-system.css`. Seus tokens possuem pares próprios para tema claro e escuro. `site/theme-system.js` carrega esse arquivo e identifica estados de componentes dinâmicos. As regras antigas de layout permanecem compatíveis, enquanto o tema principal define os papéis de cor.

Foram revisados página inicial, catálogo, solicitação pública, login, painéis admin/técnico/vendedor, menu móvel, históricos individuais, revisão de serviço, peças e vídeos, custos, cobranças, configurações, agenda, alertas e relatórios. A conferência visual foi feita com dados fictícios em ambiente local. Não houve alteração no banco de produção.

Os pares principais de texto/fundo foram verificados com contraste de pelo menos 4,5:1. Cores de fotografias, vídeos e imagens enviados pelo usuário permanecem originais. Documentos para impressão mantêm fundo branco e texto escuro para facilitar a leitura.

## Publicar

Substitua a pasta `site` pela versão deste pacote e publique pelo processo habitual do seu repositório. Inclua `theme-system.css`, `theme-system.js` e a pasta `icons`. As referências dos arquivos e o cache do PWA foram atualizados.

O pacote completo também mantém as alterações de serviços e cobranças da versão anterior. Se ainda não publicou essa API, siga `ATUALIZACAO-SERVICOS.md` para publicar o Worker. Esta atualização visual, isoladamente, não exige migração de banco nem configuração de credenciais.

## Verificar

```powershell
node .\scripts\verify-theme.mjs
node .\scripts\verify-site.mjs
node .\scripts\test-service-rules.mjs
```
