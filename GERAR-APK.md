# Instalar a ProtecExtintores no Android

O projeto Android está na pasta `android-app`. A geração pela internet está preparada no workflow `.github/workflows/android-apk.yml`.

1. Publique o conteúdo atualizado deste projeto no repositório `eusouods/ProtecExtintores`, preservando a pasta `.github`.
2. No GitHub, selecione **Actions → Build Android APK → Run workflow → Run workflow**.
3. Quando terminar com sucesso, abra a execução e baixe **ProtecExtintores-APK** na seção **Artifacts**.
4. Extraia o download e abra **ProtecExtintores.apk** no Android para instalar.

Esse processo gera um APK de teste conectado ao site publicado e à API existente. Não exige comandos no PowerShell do seu computador. O pacote de código-fonte `ProtecExtintores.zip` não é o aplicativo compilado.

As instruções completas, os requisitos para compilar localmente e os limites da versão de teste estão em `android-app/README.md`.

O APK funciona somente no Android. Para iPhone é necessário outro tipo de distribuição.
