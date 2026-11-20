# ProtecExtintores — versão 55 / Android 1.8.5

## Agenda removida — versão 53

A tela **Agenda** foi retirada do menu e dos atalhos do admin. Ela mostrava os mesmos dados de **Próximas manutenções** (a previsão de cada serviço) e ainda exibia um dia inventado (dia 1 do mês), contra a regra de mostrar somente mês e ano. **Próximas manutenções** continua completa, com as previsões futuras, as anteriores e a opção de definir o mês dos serviços sem previsão. Os atalhos que levavam à Agenda (Alertas e visão geral) agora abrem Próximas manutenções. Nenhum dado foi apagado.

## Correção visual das páginas públicas — versão 52

O cabeçalho da loja é fixo no topo e cobria o início do conteúdo: na página inicial o rótulo acima do título ficava escondido (principalmente no celular) e em **Produtos** e **Acompanhar** o primeiro título encostava no cabeçalho. O espaçamento superior agora considera a altura do cabeçalho em todas as larguras de tela. Só o CSS foi alterado; a API, o banco e as regras de serviço continuam os mesmos da versão 51.

Publique o **site** e gere o **APK 1.8.3** pelo Actions. Não é necessário publicar a API nem rodar migração. A versão do cache offline foi atualizada para 53 para que aparelhos que já usam o app recebam a correção.

## Versão 51 (anterior)

## Pó em kg, dados centrais e backup portátil — versão 51

**Publique a API E o site e gere o APK 1.8.1.** O pacote tem 99 arquivos de código e recursos, sem dependências, caches ou dados reais da empresa. Não há comando que resetará sua base durante a atualização. O reset só ocorre quando o administrador usa a tela, apresenta um backup atualizado e confirma com sua senha.

### Registro em quatro etapas e limpeza dos registros de pó — versão 51

O cadastro é o mesmo nos três painéis: **Cliente → Equipamentos → Complementos → Conferir**. Cliente é opcional. Por padrão, **Serviço próprio** usa o nome da conta autenticada, sem criar um cliente fictício. Também é possível selecionar um cliente já disponível para a conta ou informar um novo cliente. Funcionários passam a ter essas escolhas na versão 8 do protocolo; filas antigas conservam o comportamento anterior. A escolha do cliente não muda a autoria nem transfere a cobrança interna.

Funcionário e vendedor continuam responsáveis pela tarifa interna definida pelo admin, enquanto o valor cobrado de seus clientes é separado. Novas ordens registradas pelo admin pertencem à empresa e não geram cobrança interna, mesmo com vendedor responsável. O valor combinado da ordem do admin entra na receita da empresa; os custos determinam lucro ou prejuízo. Custos incompletos continuam sinalizados e lucro realizado depende da confirmação do recebimento.

Voltar e Avançar mantêm as escolhas, e o rascunho também guarda a etapa atual. O nome é obrigatório apenas quando a opção escolhida é informar um novo cliente. Tipos, pesos, quantidades, vendas e complementos continuam nas listas selecionáveis.

No admin, **Pó, preços e envios → Movimentações de pó → Limpar registros** esvazia a lista após confirmação, sem zerar saldos ABC/BC nem alterar custos das ordens. O histórico necessário para custos e correções é preservado em arquivo interno e nos backups. Entradas antigas retiradas da lista não podem ser estornadas por um aparelho desatualizado. A API recusa a limpeza se a lista mudar entre a conferência e o recebimento do pedido.

O reset de **clientes, serviços e pó** continua separado: ele zera os saldos e limpa tanto a lista quanto seu arquivo. Nenhuma limpeza ou reset é executado ao publicar esta atualização. Publique a **API e o site**, depois gere o **APK 1.8.1** para incluir as novas telas offline. Não há migração SQL adicional.

### Abertura offline e espaço de trabalho — versão 50

- O app abre pelas telas do aparelho. No site instalado, o primeiro acesso prepara as telas automaticamente; no Android, o pacote embarcado atende a abertura inicial sem esperar a rede. O primeiro login exige conexão e uma conta previamente autenticada é necessária para consultar os registros locais.
- O service worker entrega a cópia completa local antes de tentar a rede. Uma nova versão só é ativada depois de baixar todas as telas, mantendo também a versão anterior para abas abertas. Atualizações são verificadas em segundo plano, sem recarregar um formulário em preenchimento.
- Envios são automáticos: falhas transitórias recebem novas tentativas e registros independentes continuam sendo enviados mesmo quando outro exige revisão. IDs e recibos existentes impedem duplicações. Conflitos não são sobrescritos automaticamente.
- O aviso grande virou um indicador compacto no cabeçalho. Toque nele para consultar pendências e detalhes. A permissão de armazenamento persistente não é solicitada para enviar dados. Pagamentos, senhas e primeiro login continuam exigindo confirmação online.
- Menu agrupado, histórico secundário recolhido, foco na próxima ação e formulário compartilhado em Equipamentos, Complementos e Conferir, com rascunho automático e validação nas três funções.

Publique o site e gere o **APK 1.8.0** para os ajustes nativos de abertura e sincronização. A API da versão 48 continua compatível. Android controla a execução em segundo plano; no iOS/navegador, envios retomam quando o aplicativo é aberto ou o sistema permite. Apagar os dados do navegador/aplicativo também apaga as cópias locais; guarde backups e confira pendências antes de limpar um aparelho.

### Navegação para Estoque corrigida

A entrada em Estoque agora atualiza os dois estados usados pelos módulos de navegação antes de renderizar a tela. Agenda, Alertas, Relatórios, Custos, históricos e outras páginas não permanecem abertas quando Estoque é selecionado. A correção foi validada com 42 transições pelos botões reais dos menus no desktop e no celular, incluindo nova renderização e recuperação da sessão.

Esta correção de navegação é publicada pelo site. A API permanece com as funções da versão 48. O código Android está preparado como 1.7.4 para incluir a correção também no pacote offline embarcado; gere o APK pelo Actions.

### Reset inclui o estoque de pó

O botão em **Dados e backup** agora se chama **Resetar clientes, serviços e pó**. Além dos clientes e serviços, zera os saldos ABC/BC, limpa seus custos médios e esvazia a tabela de movimentações de pó, incluindo entradas, consumos e estornos. O estoque de peças e dos demais itens continua preservado.

O reset só ocorre depois da verificação de um backup completo atualizado, da senha do admin e da confirmação **RESETAR CLIENTES SERVICOS E PO**. A API exige também o escopo explícito desta versão; a confirmação antiga é recusada. Filas e cópias locais anteriores continuam impedidas de recriar os dados após o reset. O arquivo de backup mantém os saldos e históricos anteriores para restauração, se necessário.

Publicar a atualização não executa nenhum reset. Publique a API e o site antes de usar o botão. Não há migração SQL adicional.

### Corrigir uma entrada de pó lançada por engano

No admin, abra **Pó, preços e envios → Pó químico → Movimentações de pó**. Na linha da entrada errada, clique em **Estornar entrada**, confira a quantidade e o saldo previsto e confirme. O botão desfaz a entrada inteira; depois cadastre a quantidade correta, se necessário. Cancelar a confirmação não modifica o estoque.

O lançamento original permanece marcado como estornado e uma nova movimentação registra a correção, data e administrador. O mesmo lançamento não pode ser estornado duas vezes. Estornos não entram no total de consumo das recargas e não alteram consumos nem custos das ordens já registradas. Quando a quantidade disponível não comporta retirar a entrada inteira, ou a retirada prejudicaria a contabilização de custos já consumidos, o sistema recusa a operação e explica o motivo.

A operação pode ser guardada offline e fica pendente até o servidor conferir saldo e permissões. Publique a API junto do site para disponibilizar esta ação. Não há nova migração de banco de dados. O código Android está preparado como 1.7.2; gere o APK pelo Actions para atualizar também os arquivos offline embarcados.

### Correção da página Estoque

- Listas de quantidades têm tamanho limitado, mesmo para saldos altos. O saldo atual continua selecionado, inclusive em itens com quantidade fracionada.
- Registros incompletos não interrompem a abertura da tela. Estoque vazio mostra uma orientação para cadastrar itens.
- A restauração da sessão mantém a página aberta, sem retornar ao início enquanto o estoque está em uso. Navegação conferida no desktop e no celular, com acesso direto ao estoque de pó. Campos numéricos recusam valores negativos.
- Uma gravação recusada não exibe confirmação de sucesso nem mantém uma alteração que o servidor rejeitou.

### Pó químico

- Somente kg inteiros, sem seletor de gramas. Um ABC de 6 kg permite de 0 a 6 kg; dois ABC de 6 kg permitem de 0 a 12 kg. O limite é validado também na API, sem a tolerância anterior de 25%.
- As capacidades são somadas por agente: ABC e BC não compartilham estoque. A ordem com dois ABC de 6 kg e um BC de 4 kg permite até 12 kg de ABC e 4 kg de BC, nunca 16 kg de ABC.
- O funcionário vê o saldo confirmado de ambos os pós e a data da última conferência. Sem internet, esse é o último saldo recebido; novas baixas são conferidas no servidor.
- Registros antigos com frações ou quantidades acima do limite permanecem no histórico, sem quebrar outros cadastros. Ao revisar o consumo, a nova quantidade precisa respeitar a regra atual; a diferença é devolvida ao estoque com o custo registrado originalmente.

### Enviar os dados do aparelho

O botão **Enviar dados ao admin** envia as alterações e vídeos guardados neste aparelho para a base central. Está disponível no painel do funcionário e na área Dados e backup do admin. Aguarde a confirmação em Pendências. Antes de gerar um backup da empresa, envie as pendências de todos os aparelhos: um servidor não consegue copiar registros que ainda estão somente em um celular sem conexão.

### Dados e backup no admin

Uma área reúne a conferência da base central, exportação, restauração e reset. Clientes, serviços, vendas, preços, estoque, perfis, configurações e credenciais da equipe permanecem no mesmo D1. Imagens e vídeos ficam no R2 e são incluídos no arquivo portátil. Não coloque banco, arquivos de backup ou credenciais no repositório GitHub.

A criptografia em repouso e o transporte do D1 são gerenciados pela Cloudflare: [documentação de segurança](https://developers.cloudflare.com/d1/reference/data-security/). O backup baixado tem uma camada própria: **AES-256-GCM**, chave derivada da senha com PBKDF2-SHA256, 600 mil iterações, salt e IVs aleatórios. Cada bloco é autenticado; o arquivo só é considerado completo quando a estrutura, os dados e todas as partes da mídia passam na conferência. A senha do arquivo não é enviada à API nem armazenada pelo aplicativo. Guarde-a em local seguro: o sistema não consegue recuperá-la.

**Salvar backup criptografado:** gera um único arquivo .protecbackup com a base, tabelas, hashes de acesso da equipe, configurações e mídias próprias do R2. Não inclui sessões abertas, tentativas de login, segredos externos da hospedagem ou cópias antigas redundantes de backup. Links de imagens externas continuam como links; o ZIP do projeto preserva os recursos estáticos e o código dos painéis. No APK 1.7.1, o arquivo é preparado em armazenamento criptografado e salvo pelo seletor de arquivos do Android. No navegador compatível, é gravado diretamente no arquivo escolhido; nos demais, é baixado como arquivo.

**Enviar backup ao painel admin:** abre uma cópia anterior, pede sua senha e confere todos os blocos antes de oferecer a restauração. A prévia mostra clientes, serviços, equipe, produtos e mídias. Para substituir a base, confirme a senha atual do administrador e digite RESTAURAR BACKUP. Os arquivos são enviados para novas chaves, sem sobrescrever as mídias em uso. O banco só muda depois que todas as mídias estiverem recebidas; as tabelas e o estado são substituídos em uma transação. URLs de mídias próprias são atualizadas para a API de destino. É preciso entrar novamente com os acessos preservados no arquivo.

**Resetar clientes, serviços e pó:** exige um backup completo recém-gerado nesta base, a senha desse arquivo, a senha atual do admin e a confirmação RESETAR CLIENTES SERVICOS E PO. São removidos clientes, ordens de serviço, registros de atendimento associados e seus vínculos/pendências. Os saldos ABC e BC ficam em zero, seus custos médios são limpos e todas as movimentações de pó (entradas, consumos e estornos) são apagadas. Vendas e seus históricos, funcionários, vendedores, acessos, produtos, preços e o estoque dos demais itens são preservados. Se a base mudar depois da cópia, o reset é recusado até haver um backup atualizado.

Depois de resetar ou restaurar, a base recebe um novo identificador. Filas antigas dos aparelhos não podem recriar automaticamente os clientes e serviços apagados ou alterar uma base restaurada. Os registros locais pendentes permanecem guardados para consulta e revisão. Reconecte e atualize os aparelhos antes de continuar o trabalho.

### Recuperar em outra hospedagem

Guarde o .protecbackup, sua senha e este ZIP do projeto. Prepare a API compatível e suas migrações, configure o D1/banco, R2/armazenamento e a URL pública de destino. Configure novamente segredos e integrações externos da hospedagem; eles não fazem parte do banco exportado. Entre no admin de destino e use Dados e backup → Enviar backup ao painel admin. Confira a prévia antes de confirmar. O arquivo mantém dados e metadados das tabelas em formato portátil; uma infraestrutura com outro banco precisa de uma API/importador compatível, sem redigitar os cadastros.

O exportador confere até 24 MiB de dados estruturados por cópia e transfere a mídia em blocos de 6 MiB. Se a base estruturada ultrapassar esse limite, ele informa o problema, sem apresentar um arquivo parcial como backup completo. Mídias e arquivos não são convertidos para texto ou omitidos para reduzir tamanho.

### Publicar esta atualização

```powershell
cd "C:\Users\eusouds\Desktop\ProtecExtintores\api-cloudflare"
npm.cmd ci
npx.cmd wrangler deploy
cd ..
git add -- .gitignore site api-cloudflare/src scripts android-app PREPARAR-GITHUB.mjs README.md
git commit -m "Corrige po em kg e adiciona backup protegido"
git push origin main
```

Depois gere o APK **1.7.1** pelo Actions. As tabelas de trabalho do exportador são criadas pela própria API; não há nova migração SQL manual. Não envie node_modules, .wrangler, .gradle, pastas build, arquivos .protecbackup ou credenciais.


## Oficina, preços e autoria — versão 44

**Publique o site E a API Cloudflare antes de usar estas funções. Gere também o APK 1.7.0.** Não há migração SQL adicional: o estoque e o histórico usam o estado já transacionado no D1. O pacote completo contém 97 arquivos; node_modules e caches não são enviados ao GitHub.

- Admin: abra **Pó, preços e envios**. Cadastre o saldo físico inicial de ABC e BC como entrada, com quantidade em kg, custo por kg e referência. O saldo inicial começa em zero; nenhum estoque fictício é criado.
- Funcionário: na ordem, registre o **Consumo de pó**, separando ABC e BC e confirmando o valor real usado, inclusive zero. A capacidade somada serve apenas de referência. Os quilos e gramas são selecionados. A baixa é confirmada no servidor; sem saldo, o envio fica para revisão, sem saldo negativo. Reenvios não baixam duas vezes. Correções devolvem a diferença e preservam o custo do consumo original.
- Pinturas: há uma quantidade total de zero ao número de extintores em manutenção, sem marcar qual unidade foi pintada. A conclusão não repete esse campo. O botão Equipamentos e vídeos aparece com pinturas; vídeos das peças continuam acessíveis no resumo mesmo sem pinturas. Equipamentos são agrupados por tipo e capacidade, com unidades e evidências preservadas dentro do grupo.
- Faixa de demarcação: uma única opção **Amarela e vermelha**, com quantidade, sem medidas ou cores digitadas. Registros antigos permanecem no histórico.
- Preços: sugestões preenchidas para manutenção, compra de novos/seminovos, peças, mangueiras, complementos e produtos. O registro mostra o detalhamento e o total sugeridos. Admin pode editar cada preço em Pó, preços e envios → Preços sugeridos. Preços existentes da empresa são preservados; ordens finalizadas preservam sua fotografia financeira.
- Equipe: em Custos e cobranças → Configurar padrão/Condições, admin define valores mínimos fixos por tipo e capacidade para manutenção, venda de novos e venda de seminovos, com regra semanal ou após conclusão. Ajustes individuais podem herdar o padrão. Não há desconto percentual aplicado às ordens abertas. O valor negociado com o cliente continua independente.
- Autoria: quem criou a ordem usa Detalhes → **Enviar para administração**. Até o aceite a cobrança permanece com o criador. Admin aceita ou recusa em Pó, preços e envios → Envios da equipe. O aceite transfere a responsabilidade comercial para a empresa, zera a cobrança interna ao criador e mantém sua autoria original e a execução no histórico. A solicitação pode ser cancelada antes do aceite; ordens encerradas não são transferidas. O admin não pode assumir por simples edição do cadastro. Envios podem ser preparados offline; a confirmação e eventuais conflitos aparecem na sincronização.
- Histórico: ordens recentes primeiro, filtro por mês no histórico do funcionário, equipamentos agrupados e eventos repetidos de etapa condensados. Ordens assumidas pela empresa ficam identificadas e mantêm o rastro para quem as enviou.

### Referências de preços e limites

Consulta em 15/11/2026. Não existe uma tabela pública única que comprove todos os preços de varejo de Teresina. As fontes abaixo têm condições próprias; frete, capacidade, estado, volume e instalação alteram o preço. Capacidades sem oferta equivalente usam **estimativas iniciais editáveis**, que devem ser revisadas pela empresa. Os mínimos internos são propostas comerciais editáveis, não custos comprovados da Protec.

- [COREN-PI, referência jan/2026](https://coren-pi.org.br/wp-content/uploads/2026/01/Termo_de_Referencia.pdf): manutenção BC 6 kg R$ 77,58, água 10 L R$ 69,33, CO₂ 6 kg R$ 103,33; venda BC 6 kg R$ 230, água R$ 152,43, CO₂ 6 kg R$ 671,67; placas R$ 26,48 e suporte instalado R$ 10,17. Estimativas de contratação, não tabela de varejo.
- [TRE-PI, OF 55/2026](https://www.tre-pi.jus.br/transparencia-e-prestacao-de-contas/licitacoes-e-contratos/contratos/compras): peças e pintura com preços contratados em volume, usados como referências iniciais.
- [DigFire](https://digfire.com.br/categoria-produto/extintores/) e [Promax](https://www.promaxextintores.com.br/extintores): anúncios nacionais de novos e recondicionados, usados onde não havia oferta local comparável. Demais capacidades, faixa, acessórios sem oferta equivalente e materiais especiais são estimativas.

### Publicar esta versão pelo terminal

Na cópia atualizada em C:\Users\eusouds\Desktop\ProtecExtintores:

```powershell
git add -- site api-cloudflare/src scripts android-app/app/build.gradle PREPARAR-GITHUB.mjs README.md
git commit -m "Adiciona estoque de po, precos minimos e envio de ordens"
git push origin main
cd api-cloudflare
npm.cmd ci
npx.cmd wrangler deploy
```

Depois gere o APK 1.7.0 pelo Actions. Use a pasta original para instalar dependências e publicar a API; os lotes de upload são cópias limpas. Nunca envie node_modules, .wrangler ou chaves de assinatura.


## Página inicial e login — versão 43

A página inicial tem hierarquia de orçamento e catálogo, categorias com ilustrações compartilhadas e atalhos que respeitam os produtos ativos. A mangueira do desenho do extintor foi reposicionada. Tipografia, espaçamento, botões, etapas e perguntas frequentes foram revisados nos temas claro e escuro, no desktop e no celular.

O login da equipe usa campos de 52 px, senha visível pelo botão de olho, aviso de Caps Lock e ajuda para redefinir acesso com o administrador. O botão mostra o carregamento e bloqueia envios duplicados; erros de conexão permitem tentar novamente. Os três perfis continuam identificados automaticamente pela API.

Publique o site e gere o APK 1.6.9 pelo Actions. Esta atualização não altera a API; se você já publicou a API 41, não exige novo deploy. O pacote completo contém 94 arquivos de código e recursos, sem node_modules ou caches. Para publicar pelo terminal, use a cópia atualizada em C:\Users\eusouds\Desktop\ProtecExtintores e adicione site, scripts, android-app/app/build.gradle e README.md ao commit.


## Painéis reorganizados — versão 42

O funcionário tem sincronização compacta com detalhes expansíveis, cabeçalho com ações alinhadas, atendimento atual com ações Continuar/Pausar e indicadores simples sem caixas internas repetidas. Meus serviços e Serviços para executar permanecem separados. Pagamentos ficam depois da área de ordens. Os atalhos de rascunho e última ordem preservam seus comportamentos e o agrupamento de autoria da versão 41.

Tipografia e botões compartilhados foram padronizados nos três painéis. A composição do vendedor foi ajustada ao mesmo padrão. Os temas claro e escuro mantêm a paleta aprovada; no celular os controles se reorganizam sem sair da tela. A sincronização manual fica em Conexão e acesso offline na faixa de status do celular.

Publique o site e gere o APK 1.6.8 pelo Actions. A API permanece a da versão 41; esta mudança visual não exige novo deploy se você já publicou a API 41. Se ainda não publicou a separação dos serviços e as permissões do funcionário, siga a seção da versão 41 abaixo e publique a API também.


## Serviços do funcionário — versão 41

O painel separa “Meus serviços” (criados pela própria conta) e “Serviços para executar” (recebidos de outras pessoas), com andamento, pausados e histórico em cada grupo. A autoria acompanha o criador mesmo quando outro funcionário executa a ordem.

Funcionários registram ordens automaticamente em seu próprio nome, sem campos de cliente ou vendedor. A API ignora tentativas de substituir esse nome no cadastro. O admin vê o nome real cadastrado para o funcionário. Vendedores e admin mantêm seus cadastros de cliente.

Validades, anos de manutenção e teste hidrostático de ordens de outras pessoas ficam fora das respostas do funcionário e das cópias offline exibidas no aparelho. A agenda mostra somente ordens criadas pela própria conta, inclusive se foram executadas por outra pessoa. Registros antigos sem criador identificável não são presumidos como próprios a partir do executor.

**Esta atualização exige publicar o site E a API Cloudflare.** Execute npm.cmd ci e npx.cmd wrangler deploy dentro de api-cloudflare após copiar o projeto atualizado. Não há nova migração de banco. Para o aplicativo, gere o APK 1.6.7 pelo Actions. As instruções da correção visual versão 40 abaixo são históricas; para a versão 41 publique também a API.


## Seleção visível — correção da versão 40

O reset geral dos campos do tema encobria a cor de fundo dos checkboxes. A opção era marcada internamente, mas o visto ficava quase invisível nos dois temas. Checkboxes e rádios agora mantêm sua pintura de estado separada dos campos de texto. Os quadrados do cadastro têm 20 px, os cabeçalhos têm área mínima de clique de 44 px e os cartões selecionados ganham contorno de destaque.

Correção compartilhada por admin, funcionário e vendedor: mangueiras de hidrante, todos os serviços complementares e compra de extintores. Clique no quadrado ou no texto, toque no celular e barra de espaço funcionam; desmarcar fecha os campos. O rascunho preserva as escolhas offline.

Para ESTA correção visual, publique os arquivos do site. A API continua com as regras e o catálogo da versão 39, protocolo 7; não há nova migração de banco nem necessidade de republicar a API apenas por esta correção. Se ainda usa API anterior à versão 39, siga a seção de publicação da API abaixo. Para o aplicativo, gere o APK 1.6.6 pelo Actions.


Projeto completo com 94 arquivos-fonte: site, API Cloudflare, aplicativo Android, imagens, testes e automações. As dependências instaladas e os caches ficam somente no PC e não fazem parte da distribuição.

## Publicar o site

Extraia `ProtecExtintores.zip` e abra `ProtecExtintores-COMPLETO`.

Pelo GitHub Desktop: copie o CONTEÚDO dessa pasta para a raiz do repositório clonado, mesclando as pastas e substituindo os arquivos correspondentes. Faça Commit e Push. As pastas `site`, `api-cloudflare`, `android-app`, `scripts` e `.github` ficam diretamente na raiz. Aguarde Actions → Publicar ProtecExtintores no GitHub Pages terminar.

Não envie a pasta externa `ProtecExtintores-COMPLETO` para dentro do repositório. Pastas antigas com nomes `COMPLETO`, `ENVIAR` ou `LOTE` dentro da raiz são cópias de upload; os workflows atuais usam as pastas originais diretamente na raiz.

### Enviar pelo navegador em dois lotes limpos

Abra o PowerShell na pasta `ProtecExtintores-COMPLETO`, onde está `PREPARAR-GITHUB.mjs`, e execute:

```powershell
node PREPARAR-GITHUB.mjs --all
```

O script cria DUAS pastas novas ao lado da pasta completa. Abra o LOTE 1 e arraste apenas o seu CONTEÚDO para a raiz do GitHub. Confirme o envio. Depois faça o mesmo com o CONTEÚDO do LOTE 2. Não envie as duas pastas juntas nem a pasta externa com o nome do lote. Inclua a pasta `.github` no primeiro lote.

Lote 1: 51 arquivos e 25 subpastas; lote 2: 43 arquivos e 3 subpastas. Ambos ficam abaixo de 100 mesmo contando pastas. Juntos contêm os 94 arquivos completos, sem duplicação.

`node_modules`, `.wrangler`, `.gradle`, arquivos de ambiente e dependências geradas ficam fora dos lotes automaticamente. Use os lotes apenas para upload. Execute instalações e publicações na pasta completa de trabalho; não instale dependências dentro dos lotes.

## Publicar a API Cloudflare

Abra o PowerShell dentro de `ProtecExtintores-COMPLETO/api-cloudflare` e execute:

```powershell
npm.cmd ci
npx.cmd wrangler d1 migrations apply protecextintores-db --remote
npx.cmd wrangler deploy
```

O `npm.cmd ci` cria muitos arquivos em `node_modules`. Eles são necessários para as ferramentas locais e não vão para os lotes nem para o ZIP. Não recrie banco, bucket ou segredos existentes. Confira o endereço exibido pelo Wrangler. Esta entrega mantém os nomes dos recursos e o database_id configurados.

Atualize o site E a API. Publicar apenas um deles deixa as telas e as regras do servidor em versões diferentes. O endpoint `/api/capabilities` passa a indicar catálogo 39 e protocolo de registro 7.

## Atualizar o APK

Depois de publicar os arquivos, abra Actions → Build Android APK → Run workflow → main. Baixe o artefato ProtecExtintores-APK da nova execução. Versão Android 1.6.8, código 30. A atualização sobre um aplicativo instalado requer a mesma assinatura. Preserve o aplicativo e seus dados enquanto houver envios offline pendentes.

## Correções anteriores incluídas (versão 39)

- Edição, revisão e finalização de ordens que têm somente compra, mangueiras ou serviços complementares.
- Revisão de registros antigos sem lista de extintores, sem erro interno.
- Datas reais, e-mail e telefone validados ao revisar o cadastro; ordens finalizadas/canceladas ficam protegidas.
- Data inicial do cadastro acompanha o dia local do aparelho.
- Uma atualização de lista interrompida depois da confirmação não provoca repetição da ordem.
- Rascunhos confirmados deixam de reaparecer por gravações atrasadas do formulário.
- A criação de um contato não provoca falso conflito ao editar uma ordem recém-registrada.
- Serviços próprios deixam de criar cadastros artificiais de cliente.
- Revisões antigas e normalizações do banco não podem sobrescrever gravações mais recentes.

Admin, funcionário e vendedor continuam usando o mesmo formulário. A paleta e as listas de equipamentos foram preservadas. As operações offline continuam na fila do aparelho até a confirmação do servidor. Entrar na conta, alterar credenciais, gerar um novo Pix e confirmar recebimentos exigem internet.

## Verificações

Na raiz completa, com Node.js 22 ou mais recente:

```powershell
node scripts/verify-site.mjs
node scripts/verify-theme.mjs
node scripts/test-service-rules.mjs
node scripts/test-offline-rules.mjs
```

`scripts/test-offline-api.mjs` usa exclusivamente uma API LOCAL de testes com D1/R2 isolados. Não aponte testes para dados reais da empresa.

As correções foram verificadas localmente. O envio destes arquivos ao GitHub e a publicação da API são necessários para alterar o ambiente usado pela empresa. Valide também o APK em um aparelho físico antes de substituir a versão utilizada pela equipe.
