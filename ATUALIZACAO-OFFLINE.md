# Offline automático — versão 25 / Android 1.3.0

Esta entrega contém o site, a API e o projeto Android completos. O arquivo continua sendo `ProtecExtintores.zip`, com 99 arquivos. O ZIP contém código-fonte; o APK é gerado no GitHub Actions.

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

Entre com internet uma vez. Os dados permitidos à sua conta são guardados automaticamente. As telas do navegador são baixadas em segundo plano; aguarde **Telas disponíveis offline**. O APK 1.3.0 já inclui as telas. O login continua online: sair da conta exige conexão para entrar de novo.

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
