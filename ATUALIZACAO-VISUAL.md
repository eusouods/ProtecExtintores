# Identidade azul e verde — versão visual 15 / Android 1.1.1

## Cores aplicadas

| Uso | Modo claro | Modo escuro |
| --- | --- | --- |
| Cor de referência | Azul `#0E90ED` | Verde `#41E887` |
| Fundo principal | `#E9F0F5` | `#14241C` |
| Painéis | `#F9FCFF` | `#203329` |
| Superfícies de apoio | `#E0EAF2` | `#2A3D32` |
| Texto principal | `#193142` | `#EDFFF5` |
| Texto secundário | `#466173` | `#ACC9B7` |
| Ação principal | `#0876BD`, com texto branco | `#41E887`, com texto `#12271C` |
| Bordas | `#C8D8E3` | `#456152` |

O azul dos botões foi aprofundado para manter a leitura do texto branco. As referências escolhidas foram preservadas nos elementos de marca, nas superfícies, nos títulos e nos destaques. Os estados do sistema usam variações da mesma família de cores, acompanhados de texto para informar o significado.

## Abrangência

- Página inicial, catálogo, acompanhamento, login e os painéis de administrador, funcionário e vendedor.
- Tabelas, navegação, cards, formulários, focos, mensagens, pop-ups, peças, vídeos, pintura, pausa, retomada e pendências offline.
- Cores de contingência dos módulos antigos e estilos inseridos dinamicamente revisados para usar os mesmos tokens.
- Ícones claros e escuros, favoritos, manifestos de instalação e cache visual atualizado para `blue-mint-15`.
- Impressão mantém papel claro e texto escuro para facilitar a leitura.
- O tema usa a preferência do sistema no primeiro acesso. A escolha manual fica salva. O estilo dos controles do navegador acompanha a seleção.
- No APK 1.1.1, fundo de carregamento, erro de conexão, botões, barra de progresso, ícone e barras do aplicativo seguem a nova identidade. O tema escolhido no site é comunicado ao Android.

## Publicar

1. Extraia `ProtecExtintores.zip`.
2. Na raiz do repositório GitHub, envie os arquivos atualizados. Se o GitHub limitar o envio, envie uma pasta por vez: `site`, `android-app`, `scripts` e `.github`. Mantenha cada pasta com o próprio nome e conclua cada envio com **Commit changes**.
3. Aguarde o workflow de publicação do site terminar.
4. Gere um APK novo em **Actions → Build Android APK → Run workflow**, na branch `main`.
5. Baixe **ProtecExtintores-APK** em **Artifacts**, extraia e instale o APK.

Sincronize as ordens pendentes antes de trocar de APK. A assinatura de teste pode mudar entre builds; desinstalar o aplicativo remove os dados locais ainda não enviados.

Esta alteração visual não exige uma nova migração na API. Caso ainda não tenha publicado os recursos offline da atualização anterior, siga também `ATUALIZACAO-OFFLINE.md`.

## Verificação

As combinações principais de texto e fundo foram verificadas nos dois temas: contraste mínimo de 4,84:1 no claro e 6,51:1 no escuro. A revisão em navegador cobriu 38 telas e pop-ups em computador e celular, verificando cores renderizadas, contraste de textos, erros de JavaScript e transbordamento horizontal. O fluxo offline também passou por teste de regressão, incluindo vídeo real, reinício, sessão expirada, conflitos e troca entre contas. O projeto Android passa pela verificação de compilação Java e dos recursos XML; a instalação e as barras do sistema ainda precisam ser conferidas no aparelho.

Os tokens de referência ficam em `scripts/theme-palette.json`; `scripts/release-theme.mjs` mantém os arquivos de tema e as referências de cache alinhados.
