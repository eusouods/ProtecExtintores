# Protec Funcionário (app nativo)

App Android de verdade (Kotlin + Jetpack Compose), sem navegador embutido (WebView).
Conversa com a mesma API do site (Cloudflare), então os dados são os mesmos.

## Etapa 1 (esta versão)
- Entrar com a conta de funcionário (a sessão dura 12 horas, como no site).
- Lista de serviços: "Meus serviços" e "Para aceitar".
- Ordem de serviço: andamento, equipamentos, resumo e últimos registros.
- Aceitar serviço, atualizar etapa (respeitando as opções das Configurações), pausar e retomar.
- Conclusão em passos: pintura, peças, pó, vídeos e conferência, com os mesmos limites do site
  (número de extintores e estoque) e o vídeo obrigatório para cada peça trocada.
- Tema claro, escuro ou automático, com as cores novas.

## Ainda não tem (próximas etapas)
- Trabalhar sem internet e enviar depois (esta versão precisa de internet para cada ação;
  a última lista fica guardada para consulta).
- Painel do admin, vendedor e acompanhamento do cliente (continuam no site).

## Como gerar o APK
No GitHub: aba Actions > "Build Android APK Nativo" > Run workflow.
Baixe o artefato "ProtecFuncionario-APK". O app tem identificador próprio
(`br.com.protecextintores.nativo`) e convive com o app antigo.

## Assinatura
O APK usa uma chave fixa (`app/protec-fixa.p12`), então cada versão nova instala por cima da anterior.
Essa chave serve só para instalar o app direto, sem loja. Não use essa chave para publicar na Play Store.
