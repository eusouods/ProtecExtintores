# Documentação da ProtecExtintores

**Identidade atual: azul no modo claro e verde no modo escuro — Android 1.1.1.** Leia `ATUALIZACAO-VISUAL.md` para as cores e instruções de publicação. O pacote preserva os recursos de ordens offline e pausa/retomada descritos em `ATUALIZACAO-OFFLINE.md`.

**Recursos operacionais: ordens offline e pausa de serviço.** A configuração inicial desses recursos está em `ATUALIZACAO-OFFLINE.md`. Os textos consolidados abaixo descrevem versões anteriores.

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
