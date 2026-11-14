# Documentação da ProtecExtintores

## Envio ao GitHub — dois lotes pequenos

O ZIP completo contém **94 arquivos**. O gerador prepara **um lote por execução**, para enviar em duas operações separadas no navegador. O lote 1 contém 51 arquivos e 25 pastas internas; o lote 2 contém 43 arquivos e 3 pastas internas. Mesmo contando a pasta externa, cada lote fica abaixo de 100 itens.

1. Extraia o ZIP atualizado. Abra o PowerShell na pasta **ProtecExtintores** original, onde estão este README, o gerador, `site` e `api-cloudflare`.
2. Prepare o primeiro envio:

   ```powershell
   node PREPARAR-GITHUB.mjs 1
   ```

   O comando sem número também prepara somente o lote 1. Ele cria uma pasta nova **ProtecExtintores-GitHub-LOTE-1-…** ao lado do projeto e mostra o caminho. Esse lote contém API, Android, scripts, workflows e arquivos da raiz.

3. Abra **somente a pasta LOTE-1**. No GitHub, entre na raiz do repositório, use **Add file → Upload files**, arraste **o conteúdo do lote 1** e confirme em **Commit changes**. As pastas `api-cloudflare`, `android-app`, `scripts` e `.github` devem ficar diretamente na raiz do repositório.
4. No mesmo terminal, ainda na pasta original completa, execute:

   ```powershell
   node PREPARAR-GITHUB.mjs 2
   ```

   Será criada **ProtecExtintores-GitHub-LOTE-2-…**, contendo `site` e `tests`.

5. Faça **outro envio**, na raiz do mesmo repositório, com **somente o conteúdo do lote 2**. Confirme novamente em **Commit changes**. A pasta `site` deve ficar na raiz do repositório.
6. Com os dois envios concluídos, o projeto estará completo. Só então gere o novo APK pelo GitHub Actions.

**Não selecione as duas pastas de lotes juntas, a pasta original inteira ou a pasta que contém todas elas.** Cada lote deve ser um envio separado. A pasta externa `LOTE-1`/`LOTE-2` não deve aparecer dentro do repositório: envie seu conteúdo.

As dependências geradas por `npm.cmd install` não são copiadas para os lotes. Use a pasta original para instalar dependências e publicar a API. Quando editar o projeto, gere lotes novos. As cópias são verificadas por SHA-256, sem alterar os arquivos originais.

O gerador só aceita os dois lotes conhecidos e recusa um lote com 100 itens ou mais, contando arquivos, pastas internas e a pasta externa. Toda a documentação está reunida neste README; funções, temas e dados do aplicativo permanecem os mesmos.

A publicação do Worker Cloudflare continua separada do envio ao GitHub. O cadastro offline precisa da API atualizada; consulte as instruções da versão 26 abaixo.

## Cadastro recuperado — versão 26 / Android 1.3.1

**Instruções da versão atual.** A versão 25 permanece documentada abaixo como histórico.

### Correção do aviso que bloqueava o cadastro

O site novo exige rotas de sincronização que a API antiga não possui. Na conferência do ambiente publicado, o site estava na versão 25 e a rota `/api/offline/bootstrap` retornava 404. Isso deixava o usuário autenticado sem perfil offline e bloqueava o formulário.

- Funcionário e vendedor agora tentam recuperar o preparo automaticamente ao abrir o cadastro. Se a API de sincronização ainda não estiver publicada, podem cadastrar **online**, aguardando a confirmação do servidor. A ausência do cache não é tratada como ausência de login.
- O admin abre o formulário administrativo. Sem suporte de sincronização na API, usa o salvamento online e exibe um aviso; não cria uma fila nova que a API antiga não consegue receber.
- Falha de armazenamento também mantém o formulário online disponível, sem prometer salvamento offline. O offline volta automaticamente quando a API e o cofre estiverem disponíveis.
- Filas já existentes são preservadas quando o servidor retorna 404 por falta da rota. Isso não transforma todos os registros em conflitos de negócio. Login expirado, conta bloqueada e bloqueio do aparelho continuam sendo respeitados.

### Atualizar a API é necessário

No PowerShell, dentro da pasta **ProtecExtintores/api-cloudflare** extraída deste ZIP:

```powershell
npm.cmd install
npx.cmd wrangler d1 migrations apply protecextintores-db --remote
npx.cmd wrangler deploy
```

Preserve seu `database_id`, bindings e segredos. Depois publique os arquivos novos do site no GitHub e gere uma **nova execução** do workflow **Build Android APK** para usar o APK 1.3.1. Não desinstale nem limpe o aplicativo com pendências.

Até publicar a API atualizada, o modo offline completo e as funções novas de cobrança não estarão disponíveis no servidor antigo. O ZIP traz o código completo da API; alterar apenas os arquivos do GitHub não publica o Worker Cloudflare.

Testado em API local e navegador móvel: criação online com rota offline ausente, recuperação de preparo, uso sem conexão após recuperação, envio duplo bloqueado, formulário correto para o admin e falha de armazenamento. Android físico ainda requer validação.

## Offline automático — versão 25 / Android 1.3.0

**Histórico da versão 25.** O guia da versão 26 acima descreve a correção do cadastro.

- Entre com internet uma vez. A preparação das telas e dos dados acontece automaticamente; não existe mais a etapa de apertar **Preparar offline**. No navegador, aguarde a indicação de telas disponíveis antes de sair da rede. O APK novo já inclui as telas.
- O acesso local permanece até sair da conta, inclusive quando a sessão do servidor expira. A senha não é armazenada. Entrar novamente requer internet; uma sessão vencida impede o envio até nova autenticação, sem apagar o trabalho local.
- Administrador: ordens, revisão, finalização local, clientes, produtos, estoque, preços, custos, condições da equipe e configurações gerais podem ser registrados offline. A finalização só chega aos outros aparelhos e libera a cobrança depois de aceita no servidor.
- Funcionário e vendedor: criação, consulta do histórico baixado e registros permitidos ao perfil. O funcionário pode aceitar uma ordem disponível que já esteja no aparelho, registrar peças/vídeos/pinturas, pausar, retomar e concluir a execução.
- Os dados são guardados de forma criptografada no aparelho, com fila persistente e sincronização automática. No navegador, mantenha o site aberto ao reconectar; no APK atualizado, o WorkManager também agenda os envios conforme as restrições do Android.
- Campos diferentes editados em aparelhos diferentes podem ser combinados. Alterações concorrentes no mesmo campo, atribuições disputadas ou preços usados no fechamento alterados no servidor ficam em **Pendências**, para revisão. Os registros não são substituídos silenciosamente.
- Login, criação/alteração de credenciais, integração bancária, geração de um novo Pix, aviso de pagamento e confirmação de recebimento exigem internet. Vídeos enviados por outros aparelhos precisam ser carregados uma vez para assistir offline. Dados novos de outros aparelhos e bloqueios de conta só são conhecidos ao reconectar.

Para publicar: atualize **API, site e APK**. Abra o PowerShell em `ProtecExtintores/api-cloudflare` e execute `npm.cmd install`, `npx.cmd wrangler d1 migrations apply protecextintores-db --remote` e `npx.cmd wrangler deploy`. Depois envie a estrutura completa ao GitHub e gere uma **nova execução** de **Build Android APK**. Não desinstale nem limpe o aplicativo com envios pendentes.

Verificado em API D1/R2 local e navegador móvel automatizado, incluindo reinício offline, conflitos, autorização e pagamentos. Classes Java compiladas com API 35/AndroidX. O APK completo e o comportamento em aparelho físico ainda precisam ser validados pelo workflow e no celular.

## Cobrança interna com Pix — versão 24 / Android 1.2.0

**Histórico da versão 24.** Para preparar e usar o offline, siga a versão 25 acima.

### Como funciona

- Tanto funcionário quanto vendedor pagam as ordens que criam. A dívida fica vinculada ao criador, não a quem apenas executa o atendimento. Ordens da empresa atribuídas a um técnico não geram uma dívida pessoal para ele.
- O preço interno é calculado no servidor com o desconto definido pelo admin sobre a tabela de manutenção e os itens adicionais. Há padrão para cada perfil e condições individuais opcionais. Nenhum desconto comercial foi inventado: o administrador precisa configurar seus percentuais, maiores que zero e menores que 100%.
- O campo **Valor que você cobrará do cliente** é opcional e livre. Ele não reduz nem substitui a cobrança interna. Exemplo apenas ilustrativo, sem extras: tabela de R$ 100 e desconto de 20% geram R$ 80 devidos à Protec, independentemente do preço combinado entre parceiro e cliente.
- A cobrança é registrada na finalização administrativa, após a execução e revisão. Os valores finalizados são preservados quando preços e condições mudam depois.
- Após a finalização: a ordem fica disponível em **Ver pagamentos e Pix**, com QR Code, valor e copia e cola.
- No semanal: as ordens acumulam até o dia escolhido. O Pix é liberado a partir desse dia. Abrir o primeiro Pix fecha o conjunto e o valor daquele acerto. Ordens finalizadas depois entram no próximo período semanal. Um Pix emitido mantém as mesmas ordens e o mesmo total quando reaberto.
- O parceiro pode avisar que pagou e informar uma referência. Esse aviso não quita a dívida. Somente o administrador confirma o recebimento, após conferir o banco, pelo acerto completo. O usuário e a referência ficam no histórico.
- Este fluxo gera **Pix estático com conferência manual**. Não é débito automático nem confirmação bancária automática; a integração bancária legada de pedidos não confirma estes acertos de equipe. Códigos antigos salvos fora do app não podem ser cancelados no banco pelo site. Não reutilize códigos já pagos.

### Configurar no admin

1. Em **Configurações → Pagamento via Pix**, cadastre a chave Pix realmente registrada no banco da empresa e a cidade do recebedor. O CNPJ da empresa só pode ser usado como chave se estiver cadastrado como Pix no banco. CPF/CNPJ e telefone formatados são normalizados; também são aceitos e-mail e chave aleatória.
2. Em **Custos e cobranças → Cobranças internas da equipe**, configure o desconto e o prazo padrão para funcionários e vendedores. Abra as condições individuais para definir uma exceção ou herdar o padrão.
3. Defina os preços de manutenção por tipo/peso e os custos reais da empresa. Para atendimento especial sem preço de tabela, abra a ordem e use **Definir valor interno base** antes de finalizar. Extras continuam separados.
4. Nos acertos individuais, abra o Pix ou confira o recebimento informado. Confirme somente o que efetivamente recebeu. Não marque uma ordem isolada como paga quando ela já estiver vinculada a um acerto Pix.

Ordens e pagamentos antigos já registrados no servidor mantêm seus valores. A atualização não cria retroativamente dívidas de funcionários em ordens anteriores sem identificação de criador pagante. Operações offline enviadas após a atualização passam pelas regras novas no servidor; atualize os aplicativos e revise o valor interno antes de finalizar. Rascunhos e vídeos são preservados.

### Publicar

Extraia o projeto completo. No PowerShell dentro da pasta **ProtecExtintores/api-cloudflare**, execute:

```powershell
npm.cmd install
npx.cmd wrangler deploy
```

Depois atualize o repositório com os arquivos deste ZIP, sem `node_modules`, mantendo a estrutura. Aguarde a publicação do site. Gere o APK **1.2.0** no GitHub Actions para atualizar a cópia offline. Atualizar sobre uma instalação existente exige a mesma assinatura; preserve o app e seus dados enquanto houver registros pendentes.

O ZIP contém **94 arquivos**, antes de instalar dependências. Não há nova migração de banco nem troca de credenciais. API, arquivos compartilhados da pasta `site` e interface precisam ser publicados juntos. No registro offline, o Pix só pode ser consultado após sincronizar e finalizar a ordem.

### Validação desta entrega

Testes verificam os dois perfis, criador diferente do executor, preços internos separados do preço ao cliente, descontos, extras, fechamento semanal e período seguinte, valores antigos preservados, geração concorrente sem duplicação, recusa de quitação pelo parceiro, aviso sem baixa, confirmação admin e chave Pix ausente. O QR foi decodificado dos pixels renderizados nos dois temas, conferindo o valor, o código copiado e o CRC. Também são verificados os fluxos offline, a restauração de sessão e a interface responsiva. Nenhuma transferência bancária foi realizada nos testes e não houve teste em aparelho físico.

Referência técnica de formatação: [Manual de Padrões para Iniciação do Pix — Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).

---

**Identidade atual: azul-gelo e petróleo no modo claro; café, cobre e âmbar no modo escuro — Android 1.2.0.** Ilustrações vetoriais padronizadas para equipamentos e peças. O pacote completo contém **94 arquivos**, abaixo do limite de 100 arquivos por envio. Leia `README.md — Guia visual` para as imagens e instruções de publicação. O pacote preserva os recursos de ordens offline e pausa/retomada descritos em `README.md — Guia offline e recuperação do cadastro`.

## Histórico: atualização operacional — versão 23 / Android 1.1.9

Notas históricas da versão 23. Para publicar a versão atual, siga a seção Cobrança interna com Pix — versão 24.

- Admin: resumo de revisões, atendimentos, pausas, valores a receber e atalhos para ordens, equipe, agenda, alertas e relatórios.
- Funcionário: serviço atual, pausados, histórico individual, menu compacto e ações da execução dentro da consulta da ordem.
- Vendedor: acompanhamento, saldo e vencimentos; dados de custos internos permanecem exclusivos do administrador.
- Consulta da ordem por seções: resumo, etapas, equipamentos e vídeos, custos/pagamento e linha do tempo com responsáveis. Vídeos locais também podem ser assistidos antes do envio.
- No celular, tabelas administrativas viram cartões com rótulos, e os diálogos têm cabeçalho e fechamento acessíveis, navegação por teclado e rolagem própria.
- Cada ordem informa se está no aparelho, em envio, confirmada ou precisa de atenção. Vídeos têm progresso por bytes no navegador e no Android novo. A última confirmação é mantida por conta; fechar o app preserva os registros.
- O financeiro separa receitas de ordens, recebimentos confirmados, valores a receber, resultado bruto previsto e realizado. Só ordens pagas com custos completos entram no realizado. Ordens com custos incompletos são identificadas. Recebimentos diretos também podem ser confirmados, com referência, usuário e histórico.
- Formulários bloqueiam envio simultâneo repetido. Quitação duplicada continua recusada pelo servidor. Ao sair, expirar ou trocar de conta, o cache administrativo é limpo sem apagar o cofre criptografado de rascunhos e vídeos da equipe.

### Publicação desta versão

1. Extraia `ProtecExtintores.zip`. Abra o PowerShell na pasta `ProtecExtintores/api-cloudflare` extraída e publique a API:

```powershell
npm.cmd install
npx.cmd wrangler deploy
```

2. Substitua os arquivos correspondentes no repositório pelo conteúdo da pasta `ProtecExtintores`, mantendo a estrutura. Aguarde a publicação do site no GitHub Actions. Não envie a pasta `node_modules` criada no passo anterior.
3. Gere o APK **1.1.9** no workflow Android para atualizar o site embutido e o progresso nativo. Atualizações sobre o app instalado exigem a mesma assinatura. Preserve a instalação e os dados enquanto houver envios pendentes.

Não há migração nova de banco nem mudança das credenciais ou da paleta. O pacote tem **94 arquivos** antes de instalar dependências. O registro de recebimentos diretos depende da API desta versão; publique-a antes do site.

### Validação

As verificações cobrem cálculo financeiro e permissões, recebimento direto sem duplicação, envio duplo de formulário, consulta e reprodução de vídeo protegido real, pausa pelo detalhe, restauração da sessão, tabelas em celular e isolamento entre perfis. O fluxo offline inclui reinício, vídeo, conclusão, expiração e revisão de conflitos. Os dois temas passam por auditoria de contraste, cores e largura. Java compilado contra API 35/AndroidX; não foi executado APK em aparelho físico.

## Histórico: correção de acesso ao painel — versão 22 / Android 1.1.8

O cache do navegador deixou de ser uma condição para abrir o painel administrativo ou salvar no servidor. Uma falha de espaço no cache podia produzir o aviso “Não foi possível confirmar sua sessão agora”, mesmo com a API confirmando o acesso. O painel também aceita coleções opcionais ausentes em estados antigos.

A restauração repete consultas interrompidas, limita o tempo de espera e tenta novamente quando a conexão retorna ou o aplicativo volta ao primeiro plano. O aviso permite repetir a consulta, fechar ou entrar novamente. Respostas antigas não encerram uma conta recém-autenticada. Uma sessão realmente expirada abre o login e oculta o painel, preservando os registros locais da equipe. Falhas na preparação offline não invalidam um login confirmado.

Para publicar esta correção:

1. Extraia `ProtecExtintores.zip` e substitua os arquivos correspondentes do repositório pelo conteúdo da pasta `ProtecExtintores`, mantendo sua estrutura. Aguarde o workflow de publicação do site terminar.
2. Abra o site conectado à internet para receber a atualização. Não apague os dados do navegador ou do aplicativo: os rascunhos e vídeos offline permanecem no aparelho.
3. Para atualizar a cópia embutida no Android, gere o APK 1.1.8 pelo GitHub Actions e instale a atualização sobre a versão existente, com a mesma assinatura. Não desinstale o aplicativo se houver registros pendentes.

Esta correção não altera a API, as credenciais, os dados do banco, as ilustrações ou as cores. Não exige comandos no Cloudflare nem migração. O ZIP contém o código-fonte; o APK é gerado pelo workflow Android.

Validação: restauração, recarga, cache indisponível, repetição e reconexão, novo login durante uma consulta anterior, expiração de acesso e estado legado foram testados em navegador com telas de computador e celular. O fluxo de ordens offline, vídeos e sincronização também é verificado localmente. Não foi realizado teste em aparelho físico nesta atualização.

**Recursos operacionais: ordens offline e pausa de serviço.** A configuração inicial desses recursos está em `README.md — Guia offline e recuperação do cadastro`. Os textos consolidados abaixo descrevem versões anteriores.

Compilação dos documentos do projeto.



---

## ATUALIZACAO REGISTRO DE MANUTENCOES


# Registro de manutenções nos painéis

## O que mudou

- O painel administrativo mantém a ação para registrar serviço e agora permite editar os dados do cadastro, incluindo cliente, contato, data, tipo de serviço, extintores, vendedor, funcionário, peças e observações.
- O painel de vendedor tem a ação **Registrar manutenção**. Cada serviço criado fica vinculado ao vendedor autenticado e aparece no painel administrativo com o nome do vendedor.
- O painel de funcionário tem a ação **Registrar manutenção**. O novo serviço fica atribuído ao funcionário autenticado e aparece no painel administrativo com o nome do funcionário.
- A API valida o perfil em cada gravação. Somente uma sessão de administrador pode chamar a rota de edição do cadastro. A interface do funcionário continua registrando o andamento técnico do trabalho, como status, peças substituídas e evidências.
- Os novos registros entram no histórico de serviços, com código de acompanhamento e identificação de quem registrou.

## Causa identificada

O fluxo existente de manutenção era voltado ao formulário público e os painéis de equipe não tinham uma rota autenticada de criação. Algumas solicitações públicas sinalizadas como provenientes do site podiam receber uma resposta de sucesso sem gravar o serviço. Os novos formulários dos painéis usam rotas de criação protegidas por perfil e gravam diretamente no estado persistente do Worker.

## Publicação

Publique juntos os arquivos do site e o Worker atualizado em `api-cloudflare/src/index.js`. Não há migração de banco de dados: o registro é salvo na estrutura de serviços já existente em `app_state`.

## Build do Cloudflare

O cron semanal do Wrangler está configurado como `0 6 * * 1` (domingo às 06:00 UTC). O Cloudflare interpreta os dias da semana como 1 = domingo a 7 = sábado; `0 6 * * 0` é rejeitado como cron inválido.

## Correção de salvamento no painel administrativo

O salvamento do painel administrativo criava uma cópia do estado com `structuredClone`. Se uma propriedade de função entrasse no estado em memória, o navegador interrompia a gravação com `function object could not be cloned`. A rotina agora copia o estado pelo formato JSON, que é o mesmo formato usado para persistir e enviar os dados. A cópia de segurança de alterações de status também usa essa serialização.

## Permissão para o status “Recebido”

O painel administrativo não avança serviços para “Recebido”, e a API recusa essa transição quando solicitada por uma sessão de administrador. Funcionários continuam podendo atualizar o status pelo endpoint técnico.


---

## ATUALIZACOES PROFISSIONAIS


# Atualizações profissionais aplicadas

Esta versão inclui ajustes seguros que não dependem de dados comerciais ainda não fornecidos:

- A tela de acesso deixou de divulgar `admin / admin`; agora orienta a usar as credenciais fornecidas pelo administrador.
- O pedido público de manutenção só é confirmado depois que a API responde com sucesso. Se o envio falhar ou a API não estiver configurada, o formulário permanece preenchido e a tela explica o problema.
- O botão de envio mostra o estado de processamento e evita envios duplicados.
- O formulário identifica o campo de telefone como telefone/WhatsApp e informa como os dados serão usados no pedido.
- O resultado do pedido anuncia o código de acompanhamento com leitura acessível por leitor de tela.
- As imagens de produtos recebem texto alternativo e carregamento sob demanda.
- A FAQ evita prometer prazos universais ou conclusões automáticas sobre extintores vencidos; direciona a conferência para a etiqueta, documentação e avaliação técnica.
- O destaque padrão não afirma conformidade com norma sem confirmação da empresa.
- O indicador decorativo “ao vivo” foi ocultado para não sugerir monitoramento em tempo real.
- O painel técnico ganhou busca por código, cliente e tipo de extintor.
- A seleção de peças passou a ser feita por extintor, evitando associar o vídeo ao equipamento errado.
- Cada válvula M30, válvula de CO₂ ou manômetro marcado exige seu próprio vídeo; o aparelho verifica duração máxima de 60 segundos.
- A API verifica novamente a duração pelos metadados MP4/MOV/WebM, limita cada clipe a 50 MB e grava os arquivos diretamente no R2, sem converter o vídeo em JSON.
- O histórico técnico devolve a referência do vídeo apenas aos funcionários e administradores autorizados; o acompanhamento público não recebe a referência do arquivo.
- O seletor de arquivos do app Android segue os tipos de mídia solicitados pelo site, e a tela do app mostra a falha de abertura com opção para tentar novamente.
- O endereço inicial do APK pode ser alterado em `android-app/app/src/main/res/values/strings.xml`.

## Completar antes de publicar

Preencha os dados reais em `site/config.js` (contatos, localização/área atendida, horário e canais). Revise preço, estoque, fotos, informações técnicas, certificações e textos com o responsável da empresa. Configure e teste a URL da API, as origens permitidas no Cloudflare e o segredo de administrador. Acrescente política de privacidade, termos, condições de venda e regras de cancelamento com os dados verdadeiros do negócio.

Depois de publicar esta versão, aplique novamente o deploy da API Cloudflare para disponibilizar a rota de upload de vídeo. O bucket R2 `protecextintores-media` é o binding esperado no `wrangler.jsonc`; não é necessária uma migração D1 para este recurso.

Os vídeos podem conter informações pessoais. Oriente a equipe a filmar apenas a peça e a área indispensável, e mantenha a URL de produção da API corretamente configurada para que a rota autenticada proteja o acesso.

Esta atualização não inventa endereço, certificações, preços, políticas legais, prazos ou condições comerciais.


## Pós-venda e segurança (2026-11-07)

- Área autenticada do cliente para abrir e acompanhar solicitações de garantia de extintores comprados na conta, informando quantidade afetada, número de série opcional e tipo do problema.
- Fila exclusiva do administrador para analisar solicitações, registrar resposta e manter histórico de decisões.
- Avaliação de serviços concluídos com notas de atendimento, qualidade, pontualidade e comunicação. A publicação pública exige autorização do cliente e aprovação do administrador.
- Rastreio público retorna apenas dados operacionais mínimos e limita consultas por endereço de rede.
- Sessões internas passam a expirar após 12 horas. Na primeira execução da versão nova, sessões internas existentes são revogadas; cada funcionário deve entrar novamente.
- A inicialização do Worker cria as tabelas necessárias automaticamente. A migration `0003_customer_care.sql` também acompanha o projeto para instalação controlada em ambientes novos.

Antes de publicar, confirme que o D1 e o bucket R2 existentes seguem vinculados ao Worker e configure as variáveis de ambiente documentadas no guia de implantação.


---

## CATALOGO SEGURANCA


# Catálogo de produtos de segurança

A loja agora organiza produtos em Extintores, Placas e sinalização, Hidrantes e mangueiras e Acessórios de prevenção. O catálogo inicial inclui placas de saída, rota de fuga, extintores, hidrante, alarme e avisos; mangueiras em variações de tipo, diâmetro e comprimento; esguichos, chaves Storz, adaptador, válvula angular, abrigo, suportes, manta antichamas e acionador manual.

Os novos itens começam com preço zero e aparecem como “Sob consulta”. O administrador pode definir o preço ao editar o produto. Para liberar Pix de um pedido cujo valor ainda não foi definido, o administrador informa o valor confirmado; esse valor fica registrado no pedido antes de gerar o QR Code e o Pix copia e cola.

Confirme especificação, certificação, dimensões e compatibilidade técnica de cada SKU com o fornecedor antes de vender.

As imagens 3D fotorrealistas com fundo transparente ainda precisam ser geradas e adicionadas como arquivos de produto. A sessão atual não oferece ferramenta de geração de imagem.


---

## CORRECAO PAGINAS PAINEL


# Correção das páginas do painel

O console do site publicado apontou `ReferenceError: addInventoryNav is not defined` durante o carregamento de `enhancements.js`. A função estava em um escopo fechado e era chamada pelo construtor do menu móvel. Essa exceção interrompia o restante do script, impedindo o registro de renderizadores e rotas do painel.

O construtor do menu agora inclui Estoque diretamente na navegação compartilhada, sem depender daquela função fora do escopo. A versão do arquivo foi atualizada para `enhancements.js?v=24`, evitando o cache do script com erro.

O fallback `404.html` também reconhece as rotas de Estoque, Garantias e Avaliações. O arquivo `_redirects` inclui o fallback de SPA para Cloudflare Pages.

## Publicação

Substitua os arquivos da pasta `site/` no repositório que publica o GitHub Pages e envie o commit. A API e o APK não precisam ser recompilados para esta correção de navegação do site.


---

## PAINEIS CLIENTE VENDEDOR


# Painéis de cliente e vendedor

## Cliente

- A conta autenticada abre o painel do cliente; o link da área da equipe fica oculto enquanto o cliente está conectado.
- Compras e serviços solicitados aparecem em listas separadas, com código, situação e pagamento.
- O cliente pode expandir o acompanhamento do serviço dentro do próprio pedido, inclusive depois de concluído.
- Garantias e avaliações concluídas continuam disponíveis na seção de pós-venda.
- A loja continua acessível ao fechar o painel; a sessão do cliente permanece conectada até ele sair.

## Vendedor

- O painel mostra as solicitações registradas por aquele vendedor, separadas em serviços encomendados e finalizados.
- O acompanhamento funciona nas duas listas e mostra o histórico de etapas dos extintores.
- Os dados continuam limitados aos serviços associados ao vendedor autenticado.
- O andamento é atualizado automaticamente a cada 45 segundos.
- A tela oferece somente as duas listas e a saída da conta; atalhos de compra e cadastro foram removidos.

## Publicação

Publique os arquivos da pasta `site/` no GitHub Pages e atualize o Worker pela pasta `api-cloudflare`, pois esta versão acrescenta o histórico resumido ao retorno protegido dos serviços do vendedor. O APK Android usa o site publicado e não precisa ser recompilado.


---

## PARIDADE DESKTOP MOBILE


# Paridade entre desktop e celular

O painel usa o mesmo site e as mesmas rotas em computador, Android e iOS. Em telas pequenas, o menu lateral desktop é substituído pelo menu móvel.

## Ajustes desta versão

- O menu móvel é montado a partir dos próprios itens do menu desktop, incluindo Estoque, Garantias e Avaliações.
- As páginas de Garantias e Avaliações também têm rotas diretas (`/garantias` e `/avaliacoes`); Estoque usa `/estoque`.
- A seleção atual fica marcada nos dois menus e permanece sincronizada ao usar o histórico do navegador.
- O código de telas mobile continua usando controles adaptados para toque, rolagem horizontal em tabelas e formulários compatíveis com telas estreitas.

Como os dois formatos carregam o mesmo front-end e a mesma API, publique a pasta `site/` no GitHub Pages. O APK Android abre esse endereço do site; não exige recompilação quando somente arquivos da pasta `site/` mudam. No iPhone/iPad, abra o endereço do site no Safari.


---

## PIX AUTOMATICO API


# Integração de confirmação automática Pix

O painel permite configurar instituições que implementem os endpoints da API Pix do Banco Central para cobranças imediatas (`PUT /cob/{txid}`), webhooks (`PUT /webhook/{chave}`) e consulta de pagamentos recebidos (`GET /pix/{e2eid}`). Isso cobre bancos e provedores compatíveis com esse padrão, mas não qualquer API proprietária apenas informando o nome do banco. Se a instituição usar rotas, autenticação ou payloads próprios, será necessário um adaptador específico.

## Preparação única do Worker

1. Aplique a migração D1 antes de salvar a integração:

   ```powershell
   cd api-cloudflare
   npx wrangler d1 migrations apply protecextintores-db --remote
   ```

2. Gere uma chave mestra aleatória de 32 bytes no PowerShell:

   ```powershell
   [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

3. Cadastre o resultado como **Secret** no Cloudflare Worker, com o nome `PIX_CONFIG_ENCRYPTION_KEY`. A chave precisa ter 64 caracteres hexadecimais. Não coloque esse valor no repositório, no ZIP, no campo de Client Secret nem em mensagens.

4. Se o banco exigir mTLS, obtenha o certificado cliente e a chave privada no portal do banco. Envie-os como certificado mTLS ao Cloudflare e crie um binding no Worker, por exemplo `PIX_MTLS`. O campo “Binding mTLS” no painel deve conter exatamente esse nome. O certificado e sua chave privada ficam na configuração do Worker; não são enviados no formulário do site.

## Configuração no painel admin

Em **Configurações → Verificação automática de Pix**, informe nome do banco/provedor, URL base da API Pix, URL OAuth, Client ID, Client Secret, escopos, chave Pix e, quando aplicável, o binding mTLS. Ative a integração, salve e use **Testar conexão e registrar webhook**.

Ao liberar Pix de um pedido, o sistema solicitará uma cobrança imediata com txid próprio e o valor do pedido. O QR e o copia e cola retornados pelo PSP serão exibidos ao cliente. Quando chegar um webhook, o Worker consulta o PSP usando o E2E ID e só marca como pago se o txid e o valor conferirem com o pedido.

## Limites

- A automação só funciona para contas que tenham acesso contratado à API Pix de recebimento no PSP. Uma chave Pix pessoal ou QR estático, por si só, não fornece notificação ao sistema.
- O formulário segue o padrão da API Pix do Banco Central. Escopos, URL OAuth, certificado mTLS, habilitação de cobrança e disponibilidade de webhook variam por instituição.
- O botão de teste confirma autenticação e tenta registrar o webhook; o primeiro pagamento real deve ser validado na conta e no painel do banco.
- A configuração de API é criptografada com AES-GCM no D1. O Worker precisa da chave mestra em seu Secret para descriptografar; se ela for perdida, a integração deverá ser cadastrada novamente.


---

## REVISAO ESTRUTURA E PRIORIDADES


# Revisão estrutural e prioridades — ProtecExtintores

## Escopo

Revisei os arquivos do site, os scripts de área pública e painel, a API Cloudflare, as migrações D1, o binding R2, o fluxo Android e os arquivos de publicação. Esta revisão é estática: não tive acesso ao painel Cloudflare, a uma conta de funcionário, ao aparelho Android/iPhone nem a um endereço publicado acessível para confirmar o erro de navegação em produção.

## O que foi corrigido nesta versão

- **Funcionário:** passou a buscar os serviços por código, cliente ou tipo de extintor.
- **Peças:** o funcionário marca a peça no extintor correspondente; deixou de atribuir automaticamente as primeiras unidades de um grupo.
- **Vídeos:** cada válvula M30, válvula de CO₂ ou manômetro selecionado abre seu campo individual. O funcionário precisa enviar um clipe por peça substituída.
- **Duração e tamanho:** a tela rejeita clipes acima de 60 segundos ou 50 MB; a API confere os metadados do arquivo e aplica o mesmo limite.
- **Armazenamento:** os clipes são enviados como binário ao R2, associados ao item e à peça, sem converter o vídeo em texto/base64 dentro do estado do sistema.
- **Acesso ao vídeo:** apenas funcionário atribuído ou administrador pode carregar o clipe. O acompanhamento público não recebe a URL. Remover a substituição remove a associação e tenta apagar o objeto anterior do R2.
- **Android:** o endereço inicial saiu de um literal no Java e foi para `android-app/app/src/main/res/values/strings.xml`; o seletor do WebView respeita os tipos de arquivo do site; falhas HTTP, de rede e de certificado agora mostram uma tela persistente com tentativa de recarga.
- **Acesso inicial e orçamento:** preservadas as correções da versão anterior: credenciais reais em vez de `admin/admin` e confirmação do pedido somente após a resposta positiva da API.

## Urgente antes de usar em produção

1. **Publicar a API atualizada no Cloudflare.** A nova rota autenticada de vídeos e o cabeçalho CORS `X-Video-Duration` só existem no código desta versão. Sem novo deploy do Worker, o envio de vídeo falhará. Não há migração D1 nova; o binding R2 `MEDIA` deve continuar apontando para `protecextintores-media`.
2. **Publicar o site atualizado no GitHub Pages.** Envie a pasta `site/` pelo fluxo de publicação do repositório. Confirme que `PROTEC_API_BASE_URL`, `PUBLIC_API_URL` e `ALLOWED_ORIGIN` correspondem ao domínio real usado no telefone.
3. **Confirmar o endereço do APK.** O app Android segue apontando para `https://eusouods.github.io/ProtecExtintores/`. Se o site estiver em outro domínio/nome de repositório, ajuste `start_url` em `strings.xml` e gere um APK novo. Abrir o link no navegador Chrome é um fluxo separado do APK; este pacote não revelou o endereço digitado nem a mensagem exata do navegador.
4. **Conferir armazenamento e espaço no R2.** Um minuto de vídeo pode ocupar dezenas de megabytes. O limite atual é 50 MB por arquivo; se o vídeo de um minuto gravado pelo aparelho ultrapassar esse tamanho, reduzir a resolução/qualidade no aparelho antes do envio.
5. **Orientar a equipe sobre enquadramento.** Gravar somente a peça e o necessário para identificar o serviço, evitando rostos, placas, documentos ou conversas. O armazenamento dos clipes segue o mesmo bucket da mídia da empresa.

## Pontos de atenção encontrados na estrutura

### Site e navegação

- O site concentra a vitrine e vários painéis num único `index.html`, com funções globais e múltiplas extensões. Isso torna o carregamento dependente da ordem dos scripts e dificulta localizar erros. A evolução natural é separar páginas/módulos por público (vitrine, cliente, técnico, vendedor e administrador) e agrupar os módulos JavaScript por função.
- Há CSS histórico com muitas sobrescritas e tokens de cor repetidos. Consolidar paleta, espaçamento, escala tipográfica, botões e estados de alerta para reduzir divergência entre telas.
- A área de funcionário agora tem busca; para o administrador ainda vale adicionar busca global, filtros por vencimento/status/região, exportação CSV e alertas de tarefas atrasadas.
- Concluir estados de carregamento, erro recuperável, confirmação e “sem resultados” em todos os formulários e listas; os dados devem continuar preservados quando a API estiver indisponível.
- Revisar textos técnicos e dados reais da empresa, catálogo, preço, estoque, entrega, política de troca e privacidade antes de publicar. O pacote não tem esses dados preenchidos e não os inventei.

### Perfis e permissões

- **Cliente:** priorizar histórico de pedidos, recuperação de senha, confirmação de e-mail, privacidade e suporte.
- **Técnico:** ampliar o checklist de execução, fotos antes/depois, assinatura/aceite e trilha de quem alterou cada etapa. As evidências de troca agora têm vídeo separado por item.
- **Vendedor:** acrescentar propostas, alçadas de desconto e acompanhamento de comissão apenas depois de definir as regras comerciais reais.
- **Administrador:** adicionar permissões por função, trilha de auditoria para preço/exclusão/usuários e exportação de dados.

### Segurança e operação

- Contas internas aceitam senha mínima de cinco caracteres; elevar esse requisito e habilitar MFA para administradores.
- Sessões de painel têm duração muito longa no desenho atual. Definir expiração, revogação remota e encerramento após troca de credenciais.
- Criar rotina de teste de restauração dos backups e alerta de falha; “backup agendado” só é confiável quando a restauração também funciona.
- Proteger dados pessoais com política de privacidade, retenção definida e canal de atendimento. Os vídeos também podem conter dados identificáveis.
- Separar homologação e produção, conferir CORS e limitar origens a domínios realmente usados.

## Acessibilidade que deve continuar sendo validada

- Usar teclado para navegar pelo menu, formulários, busca, checkboxes, vídeos e modais.
- Conferir foco visível, contraste em cada tema, zoom de 200% e telas de 320 px.
- Testar leitor de tela nos rótulos de upload, mensagens de erro, estados de envio e vídeo associado ao extintor correto.
- No iOS Safari, conferir a seleção de vídeo MOV/MP4 e o carregamento dos metadados. No Android Chrome/WebView, conferir câmera/galeria e vídeos MP4. A duração é novamente validada pela API, então formatos sem metadados reconhecidos são recusados com mensagem clara.

## Limite do diagnóstico Android

Não encontrei no HTML uma regra de viewport ausente: a página já declara largura de dispositivo e suporte a safe area. O fluxo Android que acompanha o ZIP era um WebView com URL fixa e avisos de falha temporários; isso agora é configurável e mostra o motivo HTTP/rede. Como não foi possível abrir o endereço externo pelo ambiente de análise, não posso afirmar se a falha original vem de publicação pendente, URL incorreta, conexão/certificado do aparelho ou erro dentro do navegador. A nova tela torna o motivo específico visível no próximo acesso.


---

## REVISAO PAINEIS E PRIORIDADES


# Revisão dos painéis e prioridades

Esta revisão acompanha a versão atualizada do ProtecExtintores. Ela resume os recursos implementados nesta entrega e organiza melhorias de produto por prioridade.

## Cliente

### Fundamental
- Acesso direto a compras e serviços vinculados à conta.
- Código, status, pagamento e rastreio disponíveis no pedido/serviço.
- Botão **Sair da conta** no cabeçalho fixo do painel, visível mesmo ao rolar a página.
- Navegação pública sem atalhos de “Minha conta” e “Área da equipe” enquanto a sessão do cliente estiver ativa.
- Solicitação de garantia e avaliação de serviço disponíveis no fluxo de pós-venda.
- Resultado e orientação da garantia mostrados por extintor, para solicitações com vários itens.

### Essencial
- Acompanhar serviços em qualquer estado, incluindo os concluídos, e consultar o histórico.
- Separação visual entre compras e serviços, com contagem e estados legíveis.
- Mensagens vazias com orientação sobre como iniciar uma compra ou solicitar serviço.

### Básico
- Busca e filtros por pedido, código e status; manter esta melhoria em evolução conforme o volume de pedidos crescer.
- Acesso responsivo com controles grandes e navegação por teclado.

### Opcional recomendado
- Editar telefone/endereço e preferências de contato.
- Notificações de mudança de status por e-mail/WhatsApp, com consentimento e integração configurada.
- Baixar comprovante, ordem de serviço e certificado em PDF.

## Funcionário

### Fundamental
- Painel focado em atendimentos, com **Em processo** e **Concluídos**, contagem e atualização manual.
- Busca de serviço por código, cliente ou extintor.
- Ações de andamento e encerramento preservando a identificação de quem executou o serviço.
- Registro de peças substituídas com evidência em vídeo limitado a um minuto por peça, conforme o fluxo existente.
- Botão **Sair da conta** visível no cabeçalho.

### Essencial
- Separar atendimentos disponíveis, atribuídos e concluídos para reduzir erros de seleção.
- Mostrar código, cliente, endereço, itens, prioridade e próximo passo em cada cartão.
- Confirmar ações irreversíveis de conclusão e dar retorno claro quando o salvamento falhar.

### Básico
- Busca acessível, cartões responsivos, rótulos de status com texto além de cor e mensagens para lista vazia.
- Histórico de atualizações do atendimento para consulta operacional.

### Opcional recomendado
- Rota/agenda do dia, navegação até o cliente e checklist técnico configurável.
- Captura de assinatura e fotos antes/depois, com política de retenção e permissões.
- Trabalho temporário sem conexão com sincronização posterior, se a equipe atuar em áreas sem sinal.

## Vendedor

### Fundamental
- Navegação restrita a serviços encomendados, serviços finalizados e saída da conta.
- Acompanhamento disponível tanto para serviços em andamento quanto para consulta de finalizados.
- Identificação do vendedor que registrou a manutenção visível para administração.

### Essencial
- Cartões de serviço com código, cliente, data e status atualizado.
- Atualização periódica e estado vazio compreensível.

### Básico
- Controles de navegação e saída consistentes com os demais painéis.

### Opcional recomendado
- Relatório de serviços originados pelo vendedor e exportação, sujeito às permissões da empresa.

## Administrador

### Fundamental
- Visão geral de serviços, pedidos, clientes, estoque, garantias e avaliações.
- Pesquisa de pedidos por código, cliente ou tipo.
- Administração de usuários, catálogo, preços, configurações, pagamentos e dados de operação.
- Registro de manutenção com origem (vendedor ou funcionário) e edição administrativa dos dados registrados.
- Garantias com decisão e diagnóstico por item/extintor, além do status e resposta geral; histórico/auditoria das decisões.
- Controle de status de pedido respeitando permissões: somente funcionário confirma recebimento.
- Configuração opcional de API Pix compatível com o padrão do Banco Central, com credenciais criptografadas, criação de cobrança identificada e confirmação validada via PSP/webhook.
- Saída da conta disponível na navegação desktop e mobile.

### Essencial
- Pesquisa nas listas de garantias e avaliações para localizar solicitações.
- Resumo do que aguarda ação: pedidos, serviços, garantias e estoque baixo.
- Confirmação de ações sensíveis e registro de usuário/data da alteração.

### Básico
- Filtros por período, status e responsável; paginação quando as listas crescerem.
- Mensagens de erro acionáveis e salvamento com confirmação visível.
- Navegação e formulários equivalentes em celular e desktop.

### Opcional recomendado
- Exportação CSV/PDF de relatórios e trilha de auditoria com filtros.
- Alertas configuráveis de vencimento, estoque mínimo e solicitações sem resposta.
- Autenticação em dois fatores e recuperação de acesso com política segura.

## Prioridade após esta entrega

1. Validar a configuração de produção e implantar o Worker atualizado. Para Pix automático, aplique a migração `0004_pix_provider.sql`, configure o Secret `PIX_CONFIG_ENCRYPTION_KEY` e, quando exigido, o binding mTLS; veja [PIX-AUTOMATICO-API.md](PIX-AUTOMATICO-API.md).
2. Confirmar em produção os perfis de acesso e os fluxos de compra, manutenção, garantia e saída de conta em Android, iOS e desktop.
3. Priorizar edição de perfil do cliente, notificações e documentos de serviço após definir provedores, consentimentos e regras de retenção.

Integrações externas, notificações e documentos assinados dependem de configuração de serviços e regras comerciais; não são simulados nesta entrega.


## Guia offline e recuperação do cadastro

# Offline automático — versão 26 / Android 1.3.1

Esta entrega contém o site, a API e o projeto Android completos. O arquivo continua sendo `ProtecExtintores.zip`, com 94 arquivos. O ZIP contém código-fonte; o APK é gerado no GitHub Actions.

## Correção do cadastro nesta versão

O formulário não exige mais um preparo offline prévio. Ele tenta recuperar os dados automaticamente. Se a API antiga não tiver as rotas offline ou o armazenamento falhar, permite cadastro online, com confirmação do servidor. No admin, o formulário e o salvamento online corretos são preservados. Um aviso informa quando o modo offline depende da atualização do sistema. As permissões e o bloqueio da conta não são contornados.

**Atualize o Worker Cloudflare com a API deste ZIP. Publicar o site no GitHub não atualiza a API.** O erro 404 na rota de preparo foi confirmado na API publicada. Os envios locais existentes permanecem preservados até o servidor ser atualizado.

## Atualizar

1. Antes de atualizar, confirme o envio das pendências da versão anterior. Não desinstale o aplicativo nem apague dados locais com registros por enviar.
2. Extraia o ZIP. Abra o PowerShell em **ProtecExtintores/api-cloudflare**:

   ```powershell
   npm.cmd install
   npx.cmd wrangler d1 migrations apply protecextintores-db --remote
   npx.cmd wrangler deploy
   ```

   A tabela de comprovantes de sincronização, incluída na migração `0005_offline_receipts.sql`, é reutilizada. Não há migração destrutiva nesta versão. Preserve seu `database_id`, os bindings e os segredos Cloudflare já configurados.

3. Atualize o conteúdo do GitHub preservando `site`, `api-cloudflare`, `android-app`, `scripts` e `.github`. Publique a API antes do site.
4. Execute **Actions → Build Android APK → Run workflow → main**. Baixe o artefato **ProtecExtintores-APK** e extraia o APK. Reexecutar uma compilação de um commit antigo não usa o código novo.
5. Instale a atualização preservando os dados e valide o fluxo em modo avião antes de usar com serviços reais. O workflow ainda gera um APK de teste; a assinatura pode mudar entre execuções. Se o Android exigir desinstalar, sincronize primeiro. Para distribuição definitiva, configure uma chave de assinatura permanente.

## Usar sem apertar botão de preparação

Entre com internet uma vez. Os dados permitidos à sua conta são guardados automaticamente. As telas do navegador são baixadas em segundo plano; aguarde **Telas disponíveis offline**. O APK 1.3.1 já inclui as telas. O login continua online: sair da conta exige conexão para entrar de novo.

O padrão passa a ser acesso local até sair da conta, sem expirar em 72 horas. Contas com política limitada explicitamente configurada na API continuam respeitando esse limite. Uma sessão do servidor vencida impede o envio, mas permite continuar registrando no aparelho já autorizado. O painel indicará quando é necessário entrar novamente para sincronizar. A senha nunca é guardada no banco offline.

No APK, os registros e arquivos ficam criptografados em armazenamento privado com Android Keystore. No navegador, o cofre usa IndexedDB com AES-GCM. Os dados privados não vão para o cache público do service worker.

## O que pode fazer offline

- **Admin:** criar ordens, revisar o cadastro, finalizar localmente após a validação, gerenciar clientes, produtos e visibilidade no catálogo, estoque, custos, preços, etapas, contatos e configurações gerais. Configure também descontos e condições internas dos dois perfis. Os dados técnicos e valores de uma ordem já finalizada permanecem protegidos.
- **Funcionário:** criar ordens, aceitar uma ordem disponível já baixada, registrar notas/peças/vídeos, quantidade de pinturas, etapa, pausa, retomada e conclusão local. Um único serviço pode ficar em execução por vez.
- **Vendedor:** criar ordens e consultar o histórico da própria conta já baixado. O valor cobrado do cliente continua livre e separado da cobrança à empresa.
- **Todos:** alternar o tema, consultar os dados baixados e fechar/reabrir o aplicativo mantendo os registros salvos. Rascunhos da equipe são guardados durante o preenchimento; para confirmar uma alteração administrativa, use o botão Salvar do próprio formulário.

Vídeos de peças novos podem ser guardados antes da conexão, até 60 segundos e 50 MB. Um vídeo de outro aparelho precisa ser aberto online uma vez para ser guardado para reprodução offline; não se baixam automaticamente todos os vídeos antigos. O app informa quando falta arquivo ou espaço. Use arquivos disponíveis no aparelho; gravação direta pela câmera não foi acrescentada.

## Confirmação e sincronização

**Salvo neste aparelho** significa que os outros usuários ainda não receberam a alteração. A finalização administrativa offline só libera cobrança no servidor depois que o fechamento e seus dados forem aceitos. Não representa confirmação de pagamento.

Ao reconectar, o envio começa automaticamente. No navegador, mantenha o painel aberto; o APK também agenda envios pelo WorkManager. O Android controla a execução em segundo plano conforme rede, bateria e restrições do aparelho. Não é garantia de envio instantâneo com o app fechado.

Cada operação tem identificador único. O comprovante e a alteração são gravados juntos no D1, permitindo repetir uma requisição perdida sem criar outra ordem ou movimentar estoque duas vezes. Alterações do admin são aplicadas por campo, preservando edições independentes de outros aparelhos. Preços, condições e a ordem usados no fechamento são conferidos novamente.

Se houver disputa pelo mesmo dado, consulte **Pendências**. No admin, revise os campos locais e atuais: mantenha o servidor ou reaplique os campos da alteração administrativa. Comandos que precisam de nova validação, como fechamento ou alteração de preço, devem ser refeitos sobre a versão atual depois de manter o servidor. A versão anterior permanece no arquivo criptografado de revisão. Na equipe, use **Revisar ordem e reenvio** e confirme a reaplicação depois de conferir a ordem atual.

Uma ordem disponível aceita por dois funcionários offline será atribuída ao primeiro envio válido. O outro envio fica preservado para revisão. O app não pode reservar uma ordem nos outros aparelhos enquanto está sem rede.

## O que continua online

Login, criar/remover acessos ou alterar senhas/usuários, configurar/testar integrações bancárias, gerar um novo Pix, avisar que pagou e confirmar recebimento dependem do servidor. Ordens antigas vinculadas ao pagamento integrado de pedidos também exigem internet para finalizar. As telas indicam essa necessidade; essas operações não são apresentadas como concluídas offline.

Consultas adicionais mostram a última cópia carregada quando disponível. Não é possível descobrir novas atribuições, alterações de outros aparelhos ou revogação de acesso sem conexão. O servidor revalida permissões, conta ativa e responsáveis ao receber a fila; uma conta desativada não consegue enviar. O acesso local até sair da conta é uma escolha para permitir trabalho continuado no aparelho já autorizado.

## Verificações

Testados em ambiente local: preparo automático após login, telas em modo avião, criação e revisão, configurações, fechamento local com financeiro, reinício e recuperação, envio automático, duplicidade, alteração concorrente em campos diferentes, conflito no mesmo campo, reautenticação sem perder pendências, pausa/urgência/retomada, vídeo WebM real, permissões e separação de contas. As cobranças e o QR Pix continuam verificados nos dois temas. Java compilado com API 35/AndroidX e XML validado.

Sem teste em Android físico nesta sessão. O APK completo deve ser compilado pelo GitHub Actions e validado no celular, incluindo Keystore, desbloqueio e WorkManager.


## Guia de serviços e financeiro

# Atualização dos painéis — versão 23

## Cobrança interna com Pix — versão 24 / Android 1.2.0

**Esta é a instrução da versão atual.** Os blocos seguintes registram o histórico de versões anteriores.

### Como funciona

- Tanto funcionário quanto vendedor pagam as ordens que criam. A dívida fica vinculada ao criador, não a quem apenas executa o atendimento. Ordens da empresa atribuídas a um técnico não geram uma dívida pessoal para ele.
- O preço interno é calculado no servidor com o desconto definido pelo admin sobre a tabela de manutenção e os itens adicionais. Há padrão para cada perfil e condições individuais opcionais. Nenhum desconto comercial foi inventado: o administrador precisa configurar seus percentuais, maiores que zero e menores que 100%.
- O campo **Valor que você cobrará do cliente** é opcional e livre. Ele não reduz nem substitui a cobrança interna. Exemplo apenas ilustrativo, sem extras: tabela de R$ 100 e desconto de 20% geram R$ 80 devidos à Protec, independentemente do preço combinado entre parceiro e cliente.
- A cobrança é registrada na finalização administrativa, após a execução e revisão. Os valores finalizados são preservados quando preços e condições mudam depois.
- Após a finalização: a ordem fica disponível em **Ver pagamentos e Pix**, com QR Code, valor e copia e cola.
- No semanal: as ordens acumulam até o dia escolhido. O Pix é liberado a partir desse dia. Abrir o primeiro Pix fecha o conjunto e o valor daquele acerto. Ordens finalizadas depois entram no próximo período semanal. Um Pix emitido mantém as mesmas ordens e o mesmo total quando reaberto.
- O parceiro pode avisar que pagou e informar uma referência. Esse aviso não quita a dívida. Somente o administrador confirma o recebimento, após conferir o banco, pelo acerto completo. O usuário e a referência ficam no histórico.
- Este fluxo gera **Pix estático com conferência manual**. Não é débito automático nem confirmação bancária automática; a integração bancária legada de pedidos não confirma estes acertos de equipe. Códigos antigos salvos fora do app não podem ser cancelados no banco pelo site. Não reutilize códigos já pagos.

### Configurar no admin

1. Em **Configurações → Pagamento via Pix**, cadastre a chave Pix realmente registrada no banco da empresa e a cidade do recebedor. O CNPJ da empresa só pode ser usado como chave se estiver cadastrado como Pix no banco. CPF/CNPJ e telefone formatados são normalizados; também são aceitos e-mail e chave aleatória.
2. Em **Custos e cobranças → Cobranças internas da equipe**, configure o desconto e o prazo padrão para funcionários e vendedores. Abra as condições individuais para definir uma exceção ou herdar o padrão.
3. Defina os preços de manutenção por tipo/peso e os custos reais da empresa. Para atendimento especial sem preço de tabela, abra a ordem e use **Definir valor interno base** antes de finalizar. Extras continuam separados.
4. Nos acertos individuais, abra o Pix ou confira o recebimento informado. Confirme somente o que efetivamente recebeu. Não marque uma ordem isolada como paga quando ela já estiver vinculada a um acerto Pix.

Ordens e pagamentos antigos já registrados no servidor mantêm seus valores. A atualização não cria retroativamente dívidas de funcionários em ordens anteriores sem identificação de criador pagante. Operações offline enviadas após a atualização passam pelas regras novas no servidor; atualize os aplicativos e revise o valor interno antes de finalizar. Rascunhos e vídeos são preservados.

### Publicar

Extraia o projeto completo. No PowerShell dentro da pasta **ProtecExtintores/api-cloudflare**, execute:

```powershell
npm.cmd install
npx.cmd wrangler deploy
```

Depois atualize o repositório com os arquivos deste ZIP, sem `node_modules`, mantendo a estrutura. Aguarde a publicação do site. Gere o APK **1.2.0** no GitHub Actions para atualizar a cópia offline. Atualizar sobre uma instalação existente exige a mesma assinatura; preserve o app e seus dados enquanto houver registros pendentes.

O ZIP contém **94 arquivos**, antes de instalar dependências. Não há nova migração de banco nem troca de credenciais. API, arquivos compartilhados da pasta `site` e interface precisam ser publicados juntos. No registro offline, o Pix só pode ser consultado após sincronizar e finalizar a ordem.

### Validação desta entrega

Testes verificam os dois perfis, criador diferente do executor, preços internos separados do preço ao cliente, descontos, extras, fechamento semanal e período seguinte, valores antigos preservados, geração concorrente sem duplicação, recusa de quitação pelo parceiro, aviso sem baixa, confirmação admin e chave Pix ausente. O QR foi decodificado dos pixels renderizados nos dois temas, conferindo o valor, o código copiado e o CRC. Também são verificados os fluxos offline, a restauração de sessão e a interface responsiva. Nenhuma transferência bancária foi realizada nos testes e não houve teste em aparelho físico.

Referência técnica de formatação: [Manual de Padrões para Iniciação do Pix — Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).

---

## Histórico: atualização operacional — versão 23 / Android 1.1.9

Notas históricas da versão 23. Para publicar a versão atual, siga a seção Cobrança interna com Pix — versão 24.

- Admin: resumo de revisões, atendimentos, pausas, valores a receber e atalhos para ordens, equipe, agenda, alertas e relatórios.
- Funcionário: serviço atual, pausados, histórico individual, menu compacto e ações da execução dentro da consulta da ordem.
- Vendedor: acompanhamento, saldo e vencimentos; dados de custos internos permanecem exclusivos do administrador.
- Consulta da ordem por seções: resumo, etapas, equipamentos e vídeos, custos/pagamento e linha do tempo com responsáveis. Vídeos locais também podem ser assistidos antes do envio.
- No celular, tabelas administrativas viram cartões com rótulos, e os diálogos têm cabeçalho e fechamento acessíveis, navegação por teclado e rolagem própria.
- Cada ordem informa se está no aparelho, em envio, confirmada ou precisa de atenção. Vídeos têm progresso por bytes no navegador e no Android novo. A última confirmação é mantida por conta; fechar o app preserva os registros.
- O financeiro separa receitas de ordens, recebimentos confirmados, valores a receber, resultado bruto previsto e realizado. Só ordens pagas com custos completos entram no realizado. Ordens com custos incompletos são identificadas. Recebimentos diretos também podem ser confirmados, com referência, usuário e histórico.
- Formulários bloqueiam envio simultâneo repetido. Quitação duplicada continua recusada pelo servidor. Ao sair, expirar ou trocar de conta, o cache administrativo é limpo sem apagar o cofre criptografado de rascunhos e vídeos da equipe.

### Publicação desta versão

1. Extraia `ProtecExtintores.zip`. Abra o PowerShell na pasta `ProtecExtintores/api-cloudflare` extraída e publique a API:

```powershell
npm.cmd install
npx.cmd wrangler deploy
```

2. Substitua os arquivos correspondentes no repositório pelo conteúdo da pasta `ProtecExtintores`, mantendo a estrutura. Aguarde a publicação do site no GitHub Actions. Não envie a pasta `node_modules` criada no passo anterior.
3. Gere o APK **1.1.9** no workflow Android para atualizar o site embutido e o progresso nativo. Atualizações sobre o app instalado exigem a mesma assinatura. Preserve a instalação e os dados enquanto houver envios pendentes.

Não há migração nova de banco nem mudança das credenciais ou da paleta. O pacote tem **94 arquivos** antes de instalar dependências. O registro de recebimentos diretos depende da API desta versão; publique-a antes do site.

### Validação

As verificações cobrem cálculo financeiro e permissões, recebimento direto sem duplicação, envio duplo de formulário, consulta e reprodução de vídeo protegido real, pausa pelo detalhe, restauração da sessão, tabelas em celular e isolamento entre perfis. O fluxo offline inclui reinício, vídeo, conclusão, expiração e revisão de conflitos. Os dois temas passam por auditoria de contraste, cores e largura. Java compilado contra API 35/AndroidX; não foi executado APK em aparelho físico.


---

## Histórico de implementação

# Históricos, peças, pintura e cobranças

Esta versão mantém os painéis de administrador, funcionário e vendedor. A identidade visual atual está descrita em `README.md — Guia visual`.

## Publicar

1. Substitua os arquivos do projeto no repositório e publique a pasta `site` como antes.
2. No PowerShell, entre na pasta `api-cloudflare` do projeto extraído e execute:

   ```powershell
   npm.cmd ci
   npx.cmd wrangler deploy --config .\wrangler.jsonc
   ```

Não é necessário recriar o D1 nem apagar dados. Os novos registros financeiros são armazenados no estado existente. Não publique `node_modules`, `.wrangler` ou os testes como página inicial.

## Preparar os custos

Abra **Custos e cobranças** no painel admin. Adicione nome, capacidade/peso quando aplicável, categoria, custo unitário pago e valor cobrado.

- Para os insumos/custo de recarga ou manutenção automática, use a categoria **Serviço**, com nome e peso iguais ao tipo de extintor da ordem. Esse custo representa o atendimento, não a compra de um extintor novo.
- Cadastre válvulas e outras peças com o nome usado pela equipe. Marque **Disponível como peça para o técnico** para acrescentar uma opção personalizada.
- Cadastre **Pintura** com esse nome exato para cobrar e contabilizar automaticamente cada pintura registrada.
- Extintores novos, placas, fretes de compra, mão de obra extra e outros itens podem ser adicionados à ordem pelo botão **Itens adicionais**. Não repita peças já registradas pelo técnico.
- O botão **Remover** desativa uma opção. Os valores de ordens fechadas permanecem no histórico.

Não são inventados valores de custo. Se faltar algum custo, o sistema mostra **resultado parcial**. O resultado mostrado é bruto: despesas fixas, impostos e demais gastos só são descontados quando cadastrados. Prepare os custos antes de fechar as ordens.

## Execução e vídeos

O funcionário vê **Em execução** e **Meu histórico**. Cada serviço permanece associado ao responsável após concluir. Nos detalhes aparecem extintores, peças, pintura e histórico.

Cada peça trocada exige um vídeo individual no respectivo extintor, inclusive peças personalizadas. São aceitos vídeos de até 60 segundos e 50 MB. O técnico pode assistir, e admin e vendedor vinculado à ordem podem consultar os mesmos vídeos. O acesso exige sessão e vínculo com o serviço.

Ao concluir a execução, o técnico informa quantos extintores receberam pintura (zero é permitido). A opção **Aguardando peça** foi removida. Registros abertos antigos nessa etapa são migrados para **Em manutenção**, preservando o histórico.

Serviços antigos já executados com vídeos pendentes oferecem **Completar vídeos pendentes** enquanto aguardam a finalização do admin. A ordem só é finalizada depois de todas as evidências exigidas.

## Cobrança dos vendedores

Em **Custos e cobranças**, o admin define a regra padrão ou uma regra por vendedor:

- **Após a conclusão administrativa**: a ordem vence na data da finalização.
- **Acumulado semanal**: a ordem vence no próximo dia escolhido da semana; se finalizada nesse dia, vence no mesmo dia. As ordens do mesmo vendedor e vencimento formam um único acerto.

Datas são calculadas em **America/Sao_Paulo**. Regras novas valem para ordens finalizadas dali em diante. Ordens já fechadas preservam valores e prazo. O vendedor vê o saldo, os vencimentos e o histórico de cada serviço, sem acesso aos custos internos e à margem do admin.

O admin usa **Registrar recebimento** depois de receber o pagamento e informa uma referência ou observação do comprovante. Essa confirmação é manual; não movimenta dinheiro nem consulta o banco automaticamente.

Ordens antigas finalizadas não geram cobranças retroativas automaticamente. O admin pode usar **Importar ordem anterior**, depois de revisar os custos e a regra atual.

## Verificação local

```powershell
node .\scripts\test-service-rules.mjs
node .\scripts\verify-site.mjs
```

Os testes usam dados isolados e não alteram o banco de produção. A página `tests/service-workflows.html` é uma demonstração local com dados fictícios.


## Guia visual

# Ilustrações refinadas, catálogo e temas — versão 24 / Android 1.2.0

> Versão operacional atual: 24 / Android 1.2.0. Publique também a API conforme a seção inicial de `README.md`; as cobranças internas e o Pix precisam dela.

A combinação aprovada na prévia foi aplicada ao site: azul-gelo e azul-petróleo no claro; café, cobre e âmbar suave no escuro.

## Correção das válvulas do extintor

As ilustrações da M30 e da válvula de CO₂ foram corrigidas para representar o conjunto de acionamento no topo do extintor: alças, gatilho, pino com argola, corpo, conexões e rosca de fixação. O desenho anterior lembrava um registro de tubulação. As versões detalhadas, miniaturas e ícones compactos receberam a correção.

As proporções foram orientadas pelas referências de [M30](https://itaindustrial.com.br/produto/valvula-p4-m30-vermelha/) e [CO₂ de gatilho](https://itaindustrial.com.br/en/product/co2-trigger-valve-3-4-ngt/) da ITA Industrial. A válvula angular para hidrante usa uma variação própria, para distinguir esse componente do cabeçote de um extintor. As ilustrações são referências visuais do catálogo.

## Refinamento dos desenhos

As referências foram redesenhadas com proporções mais equilibradas, contornos consistentes, preenchimentos suaves, detalhes secundários e uma base de sombra discreta. Extintores têm cilindro, válvula, mangueira e identificação mais claros; manômetros, conexões, roscas, iluminação, placas, hidrantes e outros componentes recebem desenhos próprios.

- Desenhos maiores usam a versão detalhada no catálogo e no destaque da página inicial.
- Miniaturas do admin mantêm a silhueta e reduzem os detalhes finos.
- Ícones de listas e seleção de peças usam a versão compacta para preservar a leitura.
- ABC e BC têm identificações próprias. Suporte de piso, acionador manual e detector de fumaça recebem variações automáticas pelo nome.
- Os mesmos nomes de ilustração do admin foram preservados, mantendo as escolhas já cadastradas.

Foram revisadas 26 referências selecionáveis e cinco variações automáticas. As 78 combinações de desenho e tamanho foram verificadas nos dois temas, de 320 a 1280 pixels, sem figuras cortadas ou transbordamento. A revisão de 66 telas e pop-ups e os testes do catálogo agrupado também passaram. O logo oficial e suas cores foram preservados.

O pacote continua com **94 arquivos**. Os desenhos são vetoriais e locais; esta atualização não adiciona arquivos de imagens por produto. Gere o APK 1.2.0 para atualizar também a cópia offline embutida no aplicativo.

## Logo oficial da empresa

O logo enviado pela empresa foi aplicado preservando suas cores e composição. Foram ajustadas apenas a margem transparente e as dimensões para os diferentes usos.

- Página inicial, rodapé, login, painel admin e cabeçalhos de funcionário e vendedor.
- Identificação do admin no celular e tela de bloqueio do acesso offline.
- Ordem de serviço, comprovante, impressão e notificações do navegador.
- Favicons de 16 e 32 pixels, ícones de instalação e atalho no iPhone/iPad.
- Metadados de compartilhamento do site.
- Ícone Android tradicional e adaptativo, além da tela de erro de conexão.

O logo tem as mesmas cores nos dois temas. O desenho técnico usado no catálogo continua sendo uma referência do equipamento; a marca da empresa identifica a interface e os documentos.

`site/icons/company-logo.png` é o arquivo central de 1024 × 1024 pixels. As versões menores e os recursos Android foram exportados dessa mesma imagem. Ícones adaptativos e maskable têm área de segurança para o recorte do sistema.

A revisão foi feita em 66 telas e pop-ups nos dois temas. Também foram conferidos o carregamento dos logos, os favicons, o cabeçalho admin em 320 pixels, a ordem de serviço e o logo dentro da janela de impressão. As referências dos recursos XML Android foram verificadas e o Java compilou contra API 35/AndroidX. A geração completa do APK e a aparência no aparelho dependem do workflow e de teste no dispositivo.

Para atualizar o ícone de um aplicativo já instalado, publique o projeto e gere **um novo APK 1.2.0** pelo GitHub Actions. O ZIP continua sendo código-fonte.

## Catálogo agrupado

O catálogo começa pelas famílias de produtos. Ao abrir **Extintores**, aparecem **Pó químico ABC**, **Pó químico BC**, **Água pressurizada** e **CO₂**, conforme os itens ativos. Ao abrir um tipo, aparecem os pesos e capacidades cadastrados, em ordem crescente.

**Placas e sinalização** abre os modelos de placas. Mangueiras e hidrantes são separados por tipo e componente. Peças e acessórios são reunidos por componente, como válvulas, manômetros, sifões ou suportes. Iluminação aparece quando há produtos ativos dessa família. Não são criadas opções fictícias ou famílias vazias.

Os botões **Todas as categorias** e o nome da família permitem voltar sem sair do catálogo. As imagens padronizadas e fotos cadastradas continuam sendo usadas. O orçamento pelo WhatsApp inclui a opção, o peso e o modelo escolhidos. Sem WhatsApp configurado, o produto preenche o campo de observações do formulário quando ele ainda está vazio.

### Cadastrar pesos, modelos e variações

No admin, abra **Produtos → Adicionar produto** ou **Editar**:

1. Cadastre cada peso ou modelo como uma opção individual. Exemplo: um produto ABC de 4 kg e outro ABC de 6 kg.
2. Informe o tipo em **Tipo / especificação** e o peso em **Peso do extintor em kg**. ABC, BC, água e CO₂ são identificados automaticamente.
3. Use **Grupo / linha no catálogo** para reunir opções em um grupo com nome próprio; deixe vazio para agrupamento automático.
4. Use **Nome da opção** para capacidades em litros, medidas de placas, diâmetros, comprimentos e outras especificações. Exemplo: `10 L`, `20 × 30 cm` ou `15 m · 1½ pol`.
5. Ative ou oculte cada opção separadamente. Se um grupo ficar sem opções ativas, ele desaparece da vitrine.

Não é necessário atualizar ou migrar a API para estes campos. O pacote completo continua com **94 arquivos**. Para atualizar também a cópia offline embutida no aplicativo, gere o APK 1.2.0 pelo workflow Android.

A navegação nova foi verificada em 36 combinações de tela, tema e largura, incluindo 320 pixels. Foram conferidos agrupamento sem perda ou repetição de itens, ordenação dos pesos, ocultação de opções, navegação de retorno, referência do orçamento e gravação dos novos campos pela API local. A revisão visual completa cobriu 66 telas e pop-ups nos dois temas, sem falhas de contraste detectadas, cores fora da paleta ou transbordamento horizontal.

## Ilustrações de produtos e peças

As referências seguem o desenho aprovado: contornos arredondados, círculo de fundo e cores ligadas ao tema. O catálogo identifica o desenho pelo nome e pela categoria. Extintores ABC, CO₂ e água, placas, mangueiras, esguichos, iluminação, válvulas, manômetros, sifões, suportes e demais componentes usam a mesma família visual.

No painel admin, abra **Produtos → Adicionar produto** ou **Editar**. Em **Estilo da imagem de referência**, escolha **Ilustração padronizada** ou **Foto cadastrada**. Em **Desenho do produto**, use a identificação automática ou selecione o desenho. A prévia acompanha as alterações antes de salvar. As fotos anteriores ficam guardadas quando você seleciona uma ilustração. Imagens que não carregam usam um desenho de referência como alternativa.

O destaque da página inicial, as referências do catálogo, o estoque, a tabela de peças, os custos e a seleção de peças pelo funcionário compartilham essa identidade. Vídeos e evidências do serviço continuam exibindo os registros reais.

O cadastro foi conferido com gravação e recarga pela API local: criação, seleção do desenho, envio de foto, retorno à ilustração, preservação da foto e ativação/desativação no catálogo. As referências foram conferidas em larguras de 320, 390 e 1365 pixels nos dois temas. O aviso de restauração da sessão também foi ajustado para não cobrir os controles de um painel offline já preparado.

## Pacote com menos de 100 arquivos

`ProtecExtintores.zip` contém **94 arquivos**, incluindo o site, a API, o projeto Android e os workflows. Vinte scripts foram reunidos em `site/app-features.js` e onze folhas de estilo em `site/site-styles.css`, preservando a ordem de execução e de estilos. Os comentários `SOURCE` identificam cada seção para manutenção. As ilustrações ficam em `site/product-art.js`; todas são vetoriais e locais, sem bibliotecas ou imagens baixadas da internet.

Extraia o ZIP e envie os arquivos e as pastas que estão dentro de `ProtecExtintores` para a raiz do repositório. Inclua a pasta `.github`. O ZIP é o pacote de código, não deve ser enviado como substituto dos arquivos extraídos. Ao atualizar um clone local, substitua a pasta `site` pela nova para retirar os arquivos antigos já consolidados; eles não são necessários nesta versão.

## Paleta

| Uso | Modo claro | Modo escuro |
| --- | --- | --- |
| Fundo principal | `#EDF4FA` | `#1D1815` |
| Painéis | `#F9FCFF` | `#29211C` |
| Superfícies de apoio | `#DCE9F3` | `#3C2E24` |
| Texto principal | `#20374A` | `#F5E9DC` |
| Texto secundário | `#526B80` | `#C7B09B` |
| Ação principal | `#226B99` | `#E7AA74` |
| Texto sobre a ação | `#FFFFFF` | `#2C1D12` |
| Bordas | `#C5D8E6` | `#5B4636` |

## Abrangência

- Página inicial, catálogo, solicitação e acompanhamento de serviço, login e painéis de administrador, funcionário e vendedor.
- Formulários, tabelas, navegação, cards, filtros, foco de teclado, mensagens, pop-ups e estados de seleção.
- Ordens, peças, vídeos, pinturas, pausa/retomada, histórico, custos e pendências offline.
- Cabeçalhos de apresentação claros no tema claro e escuros no tema escuro, com texto ajustado ao fundo.
- Ícones de instalação, manifestos, favoritos e cache `session-restore-22`.
- Fundo de carregamento, tela de erro, progresso e barras nativas do Android 1.2.0.
- A preferência do sistema é usada no primeiro acesso; a seleção manual fica salva.
- Impressões usam papel claro e texto escuro para manter a legibilidade.

## Publicar

1. Extraia `ProtecExtintores.zip` e abra a pasta `ProtecExtintores`.
2. Atualize o conteúdo do repositório, preservando os nomes das pastas `site`, `android-app`, `scripts`, `api-cloudflare` e `.github`. Envie os arquivos extraídos, não o ZIP.
3. Aguarde o workflow de publicação do site terminar.
4. Para atualizar também os recursos e cores nativas do app, gere um APK em **Actions → Build Android APK → Run workflow**, na branch `main`.
5. Baixe **ProtecExtintores-APK** em **Artifacts**, extraia e instale o APK.

O envio de arquivos pelo navegador GitHub aceita menos de 100 por lote. Divida o envio por pasta ou use Git/GitHub Desktop para atualizar tudo de uma vez.

Sincronize as ordens pendentes antes de atualizar o APK. Desinstalar o app remove dados locais ainda não enviados; builds de teste podem usar assinaturas diferentes.

Esta atualização visual não exige migração do banco nem novo deploy da API. Se os recursos offline anteriores ainda não foram publicados, siga também `README.md — Guia offline e recuperação do cadastro`.

## Conferência

As combinações principais de texto e fundo passam pelo contraste de 4,5:1. A revisão em navegador cobriu 66 telas e pop-ups nos dois temas, em computador e celular, sem cores renderizadas fora da paleta, falhas de contraste detectadas ou transbordamento horizontal. As regras de serviços e de trabalho offline também foram verificadas.

A regressão na API local e no navegador passou por preparo offline, rascunho, modo avião, pausa/urgência/retomada, reinício, vídeo real, conclusão, expiração de sessão, reenvio, conflitos e isolamento das contas. Os arquivos Java compilaram contra API 35 e AndroidX; os recursos XML e a correspondência entre a paleta nativa e a do site foram conferidos. O APK completo e um aparelho físico não foram testados nesta atualização.

Os tokens ficam em `scripts/theme-palette.json`. Execute `node scripts/release-theme.mjs` para atualizar o CSS principal, os estilos de impressão, os manifestos e as referências de versão. Execute `node scripts/release-offline.mjs` após mudanças nos arquivos locais. As cores de inicialização e recursos Android devem acompanhar esses tokens.

O pacote contém código-fonte. A compilação completa do APK e a instalação no aparelho devem ser feitas pelo workflow Android.


## Guia de geração do APK

# Instalar a ProtecExtintores no Android

> Versão operacional atual: 24 / Android 1.2.0. Publique também a API conforme a seção inicial de `README.md`; as cobranças internas e o Pix precisam dela.

O projeto Android está na pasta `android-app`. A geração pela internet está preparada no workflow `.github/workflows/android-apk.yml`.

Para ativar os recursos offline, publique a API conforme `README.md — Guia offline e recuperação do cadastro`. A versão Android 1.2.0 inclui o site e as ilustrações atualizadas no pacote offline e exige um APK novo para atualizar essa cópia; as instruções estão em `README.md — Guia visual`.

1. Publique o conteúdo atualizado deste projeto no repositório `eusouods/ProtecExtintores`, preservando a pasta `.github`.
2. No GitHub, selecione **Actions → Build Android APK → Run workflow → Run workflow**.
3. Quando terminar com sucesso, abra a execução e baixe **ProtecExtintores-APK** na seção **Artifacts**.
4. Extraia o download e abra **ProtecExtintores.apk** no Android para instalar.

Esse processo gera um APK de teste conectado ao site publicado e à API existente. Não exige comandos no PowerShell do seu computador. O pacote de código-fonte `ProtecExtintores.zip` não é o aplicativo compilado.

As instruções completas, os requisitos para compilar localmente e os limites da versão de teste estão em `README.md — Referência do projeto Android`.

O APK funciona somente no Android. Para iPhone é necessário outro tipo de distribuição.


## Guia de publicação

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


## Referência do projeto Android

# ProtecExtintores para Android

> Versão operacional atual: 24 / Android 1.2.0. Publique também a API conforme a seção inicial de `README.md`; as cobranças internas e o Pix precisam dela.

## Endereço e diagnóstico de abertura

O endereço inicial do aplicativo fica em `app/src/main/res/values/strings.xml`, no valor `start_url`. Ele está configurado para `https://eusouods.github.io/ProtecExtintores/`. Se o GitHub Pages da empresa usar outro domínio ou nome de repositório, atualize esse valor antes de compilar o APK. A tela do app agora mostra o erro HTTP/conexão e permite tentar novamente, em vez de deixar apenas um aviso temporário.

O endereço usado para enviar em segundo plano fica no mesmo arquivo, em `api_base_url`, e deve corresponder à API configurada em `site/config.js`.

O seletor de arquivos do WebView usa os tipos aceitos pelo campo de upload e tem alternativa pelo seletor de documentos do Android.

Aplicativo Android leve que abre o site oficial `https://eusouods.github.io/ProtecExtintores/` em uma WebView. Login, dados e atualizações continuam usando o mesmo site e a API já configurada.

## Gerar o APK no Android Studio

1. Instale o Android Studio com JDK 17 e Android SDK Platform 35.
2. Abra a pasta `android-app` no Android Studio e aguarde a sincronização do Gradle.
3. Selecione **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. O APK de teste ficará em `app/build/outputs/apk/debug/app-debug.apk`.

Para instalar no aparelho, transfira o APK e autorize a instalação desse arquivo nas configurações do Android. O APK de depuração serve para instalação direta; publicação na Play Store pede assinatura de lançamento.

## Gerar pelo GitHub Actions

Não precisa abrir o PowerShell nem instalar Java no computador para usar esta opção.

1. Envie os arquivos atualizados para a raiz do repositório `eusouods/ProtecExtintores`, incluindo a pasta oculta `.github` e a pasta `android-app`. Não envie o ZIP como se fosse o código do projeto.
2. No GitHub, abra **Actions > Build Android APK > Run workflow** e confirme **Run workflow**.
3. Aguarde a execução ficar verde e abra essa execução.
4. Em **Artifacts**, baixe **ProtecExtintores-APK**.
5. Extraia o arquivo baixado e transfira **ProtecExtintores.apk** para o Android.
6. Abra o APK no aparelho e permita a instalação por essa fonte, se o Android solicitar.

O workflow verifica o projeto com Android Lint antes de gerar o APK. O arquivo `SHA256SUMS.txt` acompanha o APK para conferência de integridade.

O ambiente de compilação está fixado em Ubuntu 24.04 e utiliza Android SDK Platform 35 e Build Tools 35.0.0 pré-instalados no servidor do GitHub. Não depende da etapa `android-actions/setup-android`, que falhou na execução anterior. O Gradle 8.13 é iniciado pelo wrapper incluído no projeto.

Este é um APK de teste, com assinatura de depuração. A chave de teste pode mudar entre execuções do GitHub; nesse caso, será necessário desinstalar a versão de teste anterior para instalar a nova. A sessão local será removida. Para distribuição definitiva e atualizações por cima da versão instalada, configure uma chave de lançamento permanente e mantenha uma cópia segura. Nenhuma chave de produção foi criada ou publicada neste projeto.

O primeiro login e a sincronização exigem internet. A versão 1.1 permite registrar serviços offline após preparar a conta, com SQLite e vídeos privados criptografados, fila de envio pelo WorkManager e bloqueio opcional pelo Android. Leia `README.md — Guia offline e recuperação do cadastro` antes de atualizar um aparelho com pendências.

## Aparência e uso

O APK 1.2.0 usa azul-gelo e azul-petróleo no modo claro, e café, cobre e âmbar suave no modo escuro. Inclui as novas ilustrações vetoriais e os arquivos consolidados na cópia offline do site. O ícone, a barra de carregamento, a tela de falha de conexão e as barras do aplicativo usam a mesma identidade. O tema selecionado no site também atualiza a aparência nativa. A área do site respeita as barras do sistema e o recorte de tela no Android 15.

O catálogo e os painéis de administrador, funcionário e vendedor continuam sendo os do site publicado. Atualizações publicadas no site chegam ao aplicativo pelo mesmo endereço, sujeitas ao cache do site. Um ZIP de código-fonte não instala no celular: primeiro gere o APK pelo fluxo acima.

O seletor permite anexar vídeos e imagens já disponíveis no aparelho. Gravação direta com a câmera, notificações nativas, downloads de relatórios e impressão não foram acrescentados. O código nativo offline passou pela verificação de compilação Java, mas ainda precisa de teste em aparelho físico. Teste login, modo avião, reinício, anexos, desbloqueio e sincronização antes de distribuir à equipe.
