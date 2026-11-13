# ProtecExtintores para Android

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

O primeiro login e a sincronização exigem internet. A versão 1.1 permite registrar serviços offline após preparar a conta, com SQLite e vídeos privados criptografados, fila de envio pelo WorkManager e bloqueio opcional pelo Android. Leia `../ATUALIZACAO-OFFLINE.md` antes de atualizar um aparelho com pendências.

## Aparência e uso

O APK 1.1.1 usa azul e cinza claro no modo claro, e verde com tons de floresta no modo escuro. O ícone, a barra de carregamento, a tela de falha de conexão e as barras do aplicativo usam a mesma identidade. O tema selecionado no site também atualiza a aparência nativa. A área do site respeita as barras do sistema e o recorte de tela no Android 15.

O catálogo e os painéis de administrador, funcionário e vendedor continuam sendo os do site publicado. Atualizações publicadas no site chegam ao aplicativo pelo mesmo endereço, sujeitas ao cache do site. Um ZIP de código-fonte não instala no celular: primeiro gere o APK pelo fluxo acima.

O seletor permite anexar vídeos e imagens já disponíveis no aparelho. Gravação direta com a câmera, notificações nativas, downloads de relatórios e impressão não foram acrescentados. O código nativo offline passou pela verificação de compilação Java, mas ainda precisa de teste em aparelho físico. Teste login, modo avião, reinício, anexos, desbloqueio e sincronização antes de distribuir à equipe.
