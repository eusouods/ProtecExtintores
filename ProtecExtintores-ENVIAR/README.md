# ProtecExtintores — pacote mínimo de 5 arquivos

O site, a API, o Android, os testes, as imagens e a documentação técnica completos estão empacotados em `ProtecExtintores.mjs`. A extração confere o SHA-256 de cada arquivo. Não são necessários lotes nem PREPARAR-GITHUB.

## Enviar ao GitHub

1. Extraia este ZIP em uma **pasta nova**, sem misturar com as versões anteriores.
2. Abra a pasta extraída **ProtecExtintores-ENVIAR**. Ela contém **3 arquivos na raiz e a pasta `.github`**, com 2 workflows: são **5 arquivos no total**, ou 8 itens contando todas as pastas.
3. No GitHub, cancele o envio antigo e abra **Add file → Upload files** na raiz do repositório.
4. Arraste **somente o conteúdo desta pasta pequena**: `ProtecExtintores.mjs`, `README.md`, `.gitignore` e `.github`. Confirme em **Commit changes**.

O Actions **Publicar ProtecExtintores no GitHub Pages** extrai o projeto, verifica os fontes e publica o site. Os arquivos antigos que já existem no repositório podem permanecer; o workflow usa o projeto empacotado desta entrega. O upload completo cabe em uma operação.

Nenhum comando precisa ser executado para preparar os arquivos de upload. A pasta pequena permanece com os mesmos 5 arquivos ao executar os comandos abaixo: o projeto expandido e as dependências ficam em outra pasta.

## Quando o navegador ignora a pasta .github

Use o GitHub Desktop: clone `eusouods/ProtecExtintores`, abra Repository → Show in Explorer e copie o **conteúdo** da pasta mínima para a raiz clonada, mesclando `.github` e substituindo os arquivos correspondentes. Faça Commit to main e Push origin.

No GitHub, os caminhos precisam ser `ProtecExtintores.mjs`, `.github/workflows/pages.yml` e `.github/workflows/android-apk.yml`. Arquivos YAML soltos na raiz ou dentro de `ProtecExtintores-ENVIAR` não substituem os workflows antigos. Um check verde no workflow antigo Publicar site pode estar publicando os fontes anteriores.

Confira o envio no PowerShell da pasta mínima:

```powershell
node ProtecExtintores.mjs conferir-github
```

A checagem compara o arquivo empacotado e os dois workflows com a main pública, sem autenticação, gravações ou publicação. Só considera o envio correto quando os três arquivos têm os mesmos conteúdos nos caminhos exatos. A conferência offline `verificar` continua disponível.

## Publicar a API no Cloudflare

O site publicado estava novo e a API antiga respondia 404 nas rotas offline. Publique a API atualizada para liberar todos os recursos. Abra o PowerShell na pasta pequena que contém `ProtecExtintores.mjs` e execute:

```powershell
node ProtecExtintores.mjs api
```

Esse comando extrai os fontes em outra pasta, instala as dependências com `npm ci`, aplica as migrações existentes e publica o Worker pelo Wrangler. Usa sua autenticação Cloudflare; se necessário, conclua o login solicitado pelo Wrangler. O `database_id`, os bindings e o endereço da API foram preservados. Os segredos existentes continuam no Cloudflare. Confira a URL final mostrada no terminal.

Para apenas ver e editar o projeto completo, sem publicar:

```powershell
node ProtecExtintores.mjs extrair
```

O caminho da pasta expandida aparece no terminal. Você pode editar o `api-cloudflare/wrangler.jsonc` nessa cópia e executar os comandos de instalação, migração e deploy manualmente dentro de `api-cloudflare`, como nas versões anteriores.

## Gerar o APK

Depois de concluir o envio, abra **Actions → Build Android APK → Run workflow → main**. Inicie uma execução nova. Baixe o artefato **ProtecExtintores-APK**, que contém o APK. O workflow extrai os fontes completos do pacote antes de compilar.

O APK continua sendo uma compilação de teste e precisa de validação em aparelho físico. Preserve os dados do aplicativo com pendências. A atualização do aplicativo deve manter a mesma assinatura; uma assinatura definitiva de lançamento ainda precisa ser configurada antes da distribuição final.

## Desenvolvimento e próximas alterações

Node.js 22 ou mais recente é recomendado. Os workflows usam Node 22 e Java 17. A extração padrão cria uma pasta nova no diretório temporário do sistema, fora da pasta de upload. O destino existente nunca é sobrescrito.

Depois de editar os fontes na cópia expandida, volte ao terminal na pasta pequena e atualize o arquivo empacotado:

```powershell
node ProtecExtintores.mjs reempacotar "CAMINHO_DA_PASTA_EXPANDIDA"
```

O manifesto preserva os arquivos desta versão e deixa dependências e arquivos locais fora do pacote. Para adicionar um arquivo-fonte novo ao manifesto, solicite uma nova geração do pacote. Envie os mesmos 5 arquivos ao GitHub depois de reempacotar.

Para conferir a integridade sem criar pastas:

```powershell
node ProtecExtintores.mjs verificar
```

## Novidades do cadastro — versão 28 / Android 1.4.1

Funcionário e vendedor selecionam serviço, extintor, capacidade, quantidade e peças previstas em listas. Mangueiras de hidrante são opcionais, com tipo, diâmetro, metros e quantidade selecionáveis. A sugestão de preço é exibida sem edição e aplicada se o valor combinado ficar vazio. Os preços vêm da tabela do admin; itens sem preço ficam a definir. A cotação offline é conferida no envio. O valor ao cliente permanece separado da cobrança interna.

O admin também seleciona peças previstas e as quantidades/comprimentos nos serviços adicionais, preservando seus fluxos de clientes, preços e impressão. A tela traz a identificação Cadastro por seleção · versão 28.

Sem nome de cliente, a ordem fica identificada como serviço próprio de quem a registrou. O vendedor ganha busca, filtros, valores e margem bruta estimada quando existe cobrança; os dois perfis recebem atalhos para rascunho e última ordem.

Em Acessos da equipe, o admin redefine o acesso e visualiza a senha nova uma vez, com botão de olho e opção de copiar. As senhas antigas não são recuperáveis dos hashes. A redefinição exige internet e encerra as sessões do titular no servidor, preservando seus registros offline. Os campos de senha também têm o olho para conferir a digitação.

Em Configurações → Preços sugeridos da equipe, o admin define preços de extintores e mangueiras. Peças previstas não representam consumo de estoque nem troca já realizada.

As funções de offline automático, permissões, pausa, vídeos, preços internos, cobranças e temas são preservadas. Este formato muda a entrega e a preparação dos builds. Novos dados de outros aparelhos, login, credenciais e pagamentos continuam dependendo da conexão conforme o fluxo já documentado nos fontes expandidos.
