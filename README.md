# Protec Funcionário — Android

Aplicativo Android nativo em Kotlin e Jetpack Compose para a equipe da Protec Extintores.

## Publicar no GitHub

1. Crie um repositório privado no GitHub e envie o conteúdo desta pasta.
2. No repositório, abra **Settings → Secrets and variables → Actions** e crie estes secrets:
   - `PROTEC_KEYSTORE_BASE64`: conteúdo Base64 do arquivo `.p12` original.
   - `PROTEC_STORE_PASSWORD`: senha do arquivo de assinatura.
   - `PROTEC_KEY_ALIAS`: alias da chave.
   - `PROTEC_KEY_PASSWORD`: senha da chave.
3. Abra **Actions → Build Android APK → Run workflow**.
4. Ao terminar, baixe `ProtecFuncionario-APK`; o arquivo instalável é `ProtecFuncionario.apk`.

O arquivo `.p12` e as senhas **não** devem ser enviados ao GitHub. Eles garantem que atualizações futuras instalem sobre a versão já instalada.

## Desenvolvimento local

Para testar sem chave de produção, use `./gradlew assembleDebug`. Para gerar a versão de distribuição, passe as quatro propriedades `PROTEC_*` usadas pelo workflow.
