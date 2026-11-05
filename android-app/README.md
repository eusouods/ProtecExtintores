# FogoSeguro para Android

Aplicativo Android leve que abre o site oficial `https://eusouods.github.io/ProtecExtintores/` em uma WebView. Login, dados e atualizações continuam usando o mesmo site e a API já configurada.

## Gerar o APK no Android Studio

1. Instale o Android Studio com JDK 17 e Android SDK Platform 35.
2. Abra a pasta `android-app` no Android Studio e aguarde a sincronização do Gradle.
3. Selecione **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
4. O APK de teste ficará em `app/build/outputs/apk/debug/app-debug.apk`.

Para instalar no aparelho, transfira o APK e autorize a instalação desse arquivo nas configurações do Android. O APK de depuração serve para instalação direta; publicação na Play Store pede assinatura de lançamento.

## Gerar pelo GitHub Actions

O workflow `Build Android APK` pode ser iniciado manualmente na aba **Actions** do GitHub. Ele compila o APK de depuração e disponibiliza `FogoSeguro-android-debug-apk` como artefato para baixar.

O app requer conexão com a internet. Ele mantém login/sessão via armazenamento do navegador e aceita envio de imagens e vídeos do aparelho.
