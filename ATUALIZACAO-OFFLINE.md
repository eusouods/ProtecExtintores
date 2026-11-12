# Ordens offline, pausas e retomadas — versão 1.1

Esta atualização envolve o site, a API e o projeto Android. O ZIP é o código completo; gere um APK novo depois de publicar os arquivos.

## Como atualizar

1. Extraia `ProtecExtintores.zip`. Na pasta extraída `ProtecExtintores/api-cloudflare`, abra o PowerShell e execute:

   ```powershell
   npm.cmd install
   npx.cmd wrangler d1 migrations apply protecextintores-db --remote
   npx.cmd wrangler deploy
   ```

   A migração `0005_offline_receipts.sql` acrescenta a tabela de confirmações de sincronização. Não exclui os serviços existentes. As credenciais Cloudflare e a senha administrativa existentes continuam sendo usadas.

2. Atualize o conteúdo do repositório GitHub, preservando a estrutura da raiz: `site`, `api-cloudflare`, `android-app`, `scripts` e `.github`. A publicação do site continua pelo workflow de Pages.
3. Em **Actions → Build Android APK → Run workflow**, escolha **main** e inicie uma execução nova. Baixe **ProtecExtintores-APK** em **Artifacts** e extraia `ProtecExtintores.apk`.
4. Instale a nova versão e faça os testes no aparelho antes de usar com serviços reais.

Publique a API antes do site para que os novos painéis encontrem as rotas de sincronização.

## Preparar o aparelho

- Entre como funcionário ou vendedor com internet. O primeiro acesso exige autenticação online.
- No painel, pressione **Preparar offline** e aguarde a confirmação.
- Serão baixados os registros da conta, as etapas e as referências necessárias ao cadastro. Não é baixado o banco administrativo inteiro.
- O aplicativo guarda o rascunho enquanto você preenche. Reabra **Registrar serviço** para continuar um cadastro; rascunhos também aparecem em **Pendências**.
- O prazo offline padrão é de 72 horas. O administrador pode escolher de 1 a 168 horas em **Configurações → Acesso offline da equipe**. O novo prazo chega ao aparelho na próxima conexão.

O APK 1.1 inclui uma cópia das telas para abertura sem rede e guarda os dados da equipe em SQLite privado, criptografado com uma chave do Android Keystore. Os vídeos pendentes ficam em arquivos privados criptografados. No navegador e em APKs anteriores, o armazenamento usa IndexedDB criptografado e a abertura offline depende do cache preparado.

## Registrar sem conexão

- O funcionário pode cadastrar uma ordem, registrar notas, peças, pintura, etapa, pausa, retomada e conclusão local.
- O vendedor pode cadastrar ordens e consultar os registros da própria conta que já foram baixados.
- Cada peça trocada recebe seu vídeo, de até 60 segundos e 50 MB. O painel confirma quando o arquivo foi realmente guardado.
- Escolha vídeos disponíveis no aparelho. Gravação direta pela câmera não foi acrescentada.
- **Salvo neste aparelho** significa que ainda pode faltar enviar. **Recebido · aguardando revisão** significa que o servidor recebeu a execução e os anexos obrigatórios. O fechamento definitivo continua com o administrador.
- Ordens novas são vinculadas à conta autenticada. Sair da conta preserva os rascunhos e envios pendentes separados por conta; para voltar a essa conta após sair, faça login online.

## Pausar para atender uma urgência

1. No serviço em execução, pressione **Pausar serviço**.
2. Informe o motivo. A ordem permanece atribuída a você e vai para **Pausados**.
3. Aceite outro serviço disponível com internet ou registre outro atendimento.
4. Depois de concluir ou pausar o novo atendimento, abra **Pausados → Retomar serviço**.

A etapa anterior, peças e vídeos ficam preservados. O histórico registra quem pausou, o motivo, o horário recebido pelo sistema e a retomada. Somente um serviço pode ficar em execução por funcionário; serviços pausados não bloqueiam o atendimento urgente. O administrador pode acompanhar a pausa e consultar os vídeos recebidos em **Peças, vídeos e resultado**.

Aceitar uma ordem ainda não atribuída exige internet, para impedir que dois funcionários assumam o mesmo atendimento offline.

## Envio, conflitos e acesso

- Use **Sincronizar agora** ou mantenha o painel aberto quando a rede voltar. O APK 1.1 também agenda o envio pelo WorkManager; o Android decide quando o trabalho em segundo plano pode executar, respeitando rede, bateria e restrições do aparelho.
- Uma sessão vencida não apaga os registros. O painel pede novo login antes de enviar. A senha da conta não é guardada no banco offline.
- Opcionalmente, ative **Bloqueio do aparelho** no APK. O Android confirma o PIN, padrão ou senha de tela ao retornar ao app após ficar em segundo plano. Use o mesmo botão para desativar, após confirmar o desbloqueio.
- O servidor verifica novamente a conta, o responsável pela ordem e a versão do registro. Uma conta removida ou desativada não consegue enviar operações.
- Se o admin alterou a ordem enquanto o aparelho estava offline, o envio é interrompido para essa ordem. Em **Pendências → Revisar ordem e reenvio**, confira a versão atual e confirme explicitamente a reaplicação. Os registros originais ficam preservados.
- Cada envio tem uma identificação única e um comprovante persistente no D1, gravado na mesma transação do serviço. Uma conexão interrompida pode repetir o envio sem cadastrar outra ordem ou descontar peças duas vezes.
- A fila local confirmada é compactada depois que os dados já aparecem em uma nova consulta ao servidor. Pendências e dependências de rascunhos são preservadas.

Pagamentos, aprovações administrativas, fechamento financeiro e consultas de vídeos já enviados continuam dependendo da API online. O app não consegue descobrir novas atribuições ou bloqueios enquanto está sem conexão.

## Cuidados ao atualizar o APK

Até sincronizar, a única cópia dos novos registros está no aparelho. Não desinstale o app nem apague os dados do navegador com pendências.

O workflow continua gerando um APK de teste, cuja assinatura pode mudar entre execuções do GitHub. Se o Android exigir desinstalar a versão anterior, primeiro confirme que todas as pendências foram recebidas. Antes de distribuir como aplicativo definitivo, configure uma chave de lançamento permanente e guarde-a com segurança.

## Verificações desta entrega

- Testes das regras e da API em D1/R2 locais: idempotência, gravação concorrente, permissões, pausas, retomadas, quantidade de pinturas, integridade de arquivos, vídeos obrigatórios, revisão e conta desativada.
- Teste automatizado em navegador com tela móvel: preparo, rascunho, modo avião, reinício, atendimento urgente, vídeo WebM real, conclusão, sessão expirada, sincronização, revisão de conflito e separação entre funcionário e vendedor.
- Verificação de compilação das classes Java com API 35 e dependências AndroidX reais, além da validação dos recursos XML e do build do Worker.
- Sem teste em aparelho Android físico nesta sessão. O WorkManager, o desbloqueio do aparelho e o armazenamento Keystore ainda precisam da validação no seu aparelho. A compilação completa e o APK serão gerados pelo GitHub Actions.

O conteúdo anterior dos documentos consolidados do projeto é histórico; para esta versão, siga estas instruções.
