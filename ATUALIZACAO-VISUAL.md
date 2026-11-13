# Ilustrações refinadas, catálogo e temas — versão 22 / Android 1.1.8

A combinação aprovada na prévia foi aplicada ao site: azul-gelo e azul-petróleo no claro; café, cobre e âmbar suave no escuro.

## Correção das válvulas do extintor

As ilustrações da M30 e da válvula de CO₂ foram corrigidas para representar o conjunto de acionamento no topo do extintor: alças, gatilho, pino com argola, corpo, conexões e rosca de fixação. O desenho anterior lembrava um registro de tubulação. As versões detalhadas, miniaturas e ícones compactos receberam a correção.

As proporções foram orientadas pelas referências de [M30](https://itaindustrial.com.br/produto/valvula-p4-m30-vermelha/) e [CO₂ de gatilho](https://itaindustrial.com.br/en/product/co2-trigger-valve-3-4-ngt/) da ITA Industrial. A válvula angular para hidrante usa uma variação própria, para distinguir esse componente do cabeçote de um extintor. As ilustrações são referências visuais do catálogo.

## Refinamento dos desenhos

As referências foram redesenhadas com proporções mais equilibradas, contornos consistentes, preenchimentos suaves, detalhes secundários e uma base de sombra discreta. Extintores têm cilindro, válvula, mangueira e identificação mais claros; manômetros, conexões, roscas, iluminação, placas, hidrantes e outros componentes recebem desenhos próprios.

- Desenhos maiores usam a versão detalhada no catálogo e no destaque da página inicial.
- Miniaturas do admin mantêm a silhueta e reduzem os detalhes finos.
- Ícones de listas e seleção de peças usam a versão compacta para preservar a leitura.
- ABC e BC têm identificações próprias. Suporte de piso, acionador manual e detector de fumaça recebem variações automáticas pelo nome.
- Os mesmos nomes de ilustração do admin foram preservados, mantendo as escolhas já cadastradas.

Foram revisadas 26 referências selecionáveis e cinco variações automáticas. As 78 combinações de desenho e tamanho foram verificadas nos dois temas, de 320 a 1280 pixels, sem figuras cortadas ou transbordamento. A revisão de 66 telas e pop-ups e os testes do catálogo agrupado também passaram. O logo oficial e suas cores foram preservados.

O pacote continua com **96 arquivos**. Os desenhos são vetoriais e locais; esta atualização não adiciona arquivos de imagens por produto. Gere o APK 1.1.8 para atualizar também a cópia offline embutida no aplicativo.

## Logo oficial da empresa

O logo enviado pela empresa foi aplicado preservando suas cores e composição. Foram ajustadas apenas a margem transparente e as dimensões para os diferentes usos.

- Página inicial, rodapé, login, painel admin e cabeçalhos de funcionário e vendedor.
- Identificação do admin no celular e tela de bloqueio do acesso offline.
- Ordem de serviço, comprovante, impressão e notificações do navegador.
- Favicons de 16 e 32 pixels, ícones de instalação e atalho no iPhone/iPad.
- Metadados de compartilhamento do site.
- Ícone Android tradicional e adaptativo, além da tela de erro de conexão.

O logo tem as mesmas cores nos dois temas. O desenho técnico usado no catálogo continua sendo uma referência do equipamento; a marca da empresa identifica a interface e os documentos.

`site/icons/company-logo.png` é o arquivo central de 1024 × 1024 pixels. As versões menores e os recursos Android foram exportados dessa mesma imagem. Ícones adaptativos e maskable têm área de segurança para o recorte do sistema.

A revisão foi feita em 66 telas e pop-ups nos dois temas. Também foram conferidos o carregamento dos logos, os favicons, o cabeçalho admin em 320 pixels, a ordem de serviço e o logo dentro da janela de impressão. As referências dos recursos XML Android foram verificadas e o Java compilou contra API 35/AndroidX. A geração completa do APK e a aparência no aparelho dependem do workflow e de teste no dispositivo.

Para atualizar o ícone de um aplicativo já instalado, publique o projeto e gere **um novo APK 1.1.8** pelo GitHub Actions. O ZIP continua sendo código-fonte.

## Catálogo agrupado

O catálogo começa pelas famílias de produtos. Ao abrir **Extintores**, aparecem **Pó químico ABC**, **Pó químico BC**, **Água pressurizada** e **CO₂**, conforme os itens ativos. Ao abrir um tipo, aparecem os pesos e capacidades cadastrados, em ordem crescente.

**Placas e sinalização** abre os modelos de placas. Mangueiras e hidrantes são separados por tipo e componente. Peças e acessórios são reunidos por componente, como válvulas, manômetros, sifões ou suportes. Iluminação aparece quando há produtos ativos dessa família. Não são criadas opções fictícias ou famílias vazias.

Os botões **Todas as categorias** e o nome da família permitem voltar sem sair do catálogo. As imagens padronizadas e fotos cadastradas continuam sendo usadas. O orçamento pelo WhatsApp inclui a opção, o peso e o modelo escolhidos. Sem WhatsApp configurado, o produto preenche o campo de observações do formulário quando ele ainda está vazio.

### Cadastrar pesos, modelos e variações

No admin, abra **Produtos → Adicionar produto** ou **Editar**:

1. Cadastre cada peso ou modelo como uma opção individual. Exemplo: um produto ABC de 4 kg e outro ABC de 6 kg.
2. Informe o tipo em **Tipo / especificação** e o peso em **Peso do extintor em kg**. ABC, BC, água e CO₂ são identificados automaticamente.
3. Use **Grupo / linha no catálogo** para reunir opções em um grupo com nome próprio; deixe vazio para agrupamento automático.
4. Use **Nome da opção** para capacidades em litros, medidas de placas, diâmetros, comprimentos e outras especificações. Exemplo: `10 L`, `20 × 30 cm` ou `15 m · 1½ pol`.
5. Ative ou oculte cada opção separadamente. Se um grupo ficar sem opções ativas, ele desaparece da vitrine.

Não é necessário atualizar ou migrar a API para estes campos. O pacote completo continua com **96 arquivos**. Para atualizar também a cópia offline embutida no aplicativo, gere o APK 1.1.8 pelo workflow Android.

A navegação nova foi verificada em 36 combinações de tela, tema e largura, incluindo 320 pixels. Foram conferidos agrupamento sem perda ou repetição de itens, ordenação dos pesos, ocultação de opções, navegação de retorno, referência do orçamento e gravação dos novos campos pela API local. A revisão visual completa cobriu 66 telas e pop-ups nos dois temas, sem falhas de contraste detectadas, cores fora da paleta ou transbordamento horizontal.

## Ilustrações de produtos e peças

As referências seguem o desenho aprovado: contornos arredondados, círculo de fundo e cores ligadas ao tema. O catálogo identifica o desenho pelo nome e pela categoria. Extintores ABC, CO₂ e água, placas, mangueiras, esguichos, iluminação, válvulas, manômetros, sifões, suportes e demais componentes usam a mesma família visual.

No painel admin, abra **Produtos → Adicionar produto** ou **Editar**. Em **Estilo da imagem de referência**, escolha **Ilustração padronizada** ou **Foto cadastrada**. Em **Desenho do produto**, use a identificação automática ou selecione o desenho. A prévia acompanha as alterações antes de salvar. As fotos anteriores ficam guardadas quando você seleciona uma ilustração. Imagens que não carregam usam um desenho de referência como alternativa.

O destaque da página inicial, as referências do catálogo, o estoque, a tabela de peças, os custos e a seleção de peças pelo funcionário compartilham essa identidade. Vídeos e evidências do serviço continuam exibindo os registros reais.

O cadastro foi conferido com gravação e recarga pela API local: criação, seleção do desenho, envio de foto, retorno à ilustração, preservação da foto e ativação/desativação no catálogo. As referências foram conferidas em larguras de 320, 390 e 1365 pixels nos dois temas. O aviso de restauração da sessão também foi ajustado para não cobrir os controles de um painel offline já preparado.

## Pacote com menos de 100 arquivos

`ProtecExtintores.zip` contém **96 arquivos**, incluindo o site, a API, o projeto Android e os workflows. Vinte scripts foram reunidos em `site/app-features.js` e onze folhas de estilo em `site/site-styles.css`, preservando a ordem de execução e de estilos. Os comentários `SOURCE` identificam cada seção para manutenção. As ilustrações ficam em `site/product-art.js`; todas são vetoriais e locais, sem bibliotecas ou imagens baixadas da internet.

Extraia o ZIP e envie os arquivos e as pastas que estão dentro de `ProtecExtintores` para a raiz do repositório. Inclua a pasta `.github`. O ZIP é o pacote de código, não deve ser enviado como substituto dos arquivos extraídos. Ao atualizar um clone local, substitua a pasta `site` pela nova para retirar os arquivos antigos já consolidados; eles não são necessários nesta versão.

## Paleta

| Uso | Modo claro | Modo escuro |
| --- | --- | --- |
| Fundo principal | `#EDF4FA` | `#1D1815` |
| Painéis | `#F9FCFF` | `#29211C` |
| Superfícies de apoio | `#DCE9F3` | `#3C2E24` |
| Texto principal | `#20374A` | `#F5E9DC` |
| Texto secundário | `#526B80` | `#C7B09B` |
| Ação principal | `#226B99` | `#E7AA74` |
| Texto sobre a ação | `#FFFFFF` | `#2C1D12` |
| Bordas | `#C5D8E6` | `#5B4636` |

## Abrangência

- Página inicial, catálogo, solicitação e acompanhamento de serviço, login e painéis de administrador, funcionário e vendedor.
- Formulários, tabelas, navegação, cards, filtros, foco de teclado, mensagens, pop-ups e estados de seleção.
- Ordens, peças, vídeos, pinturas, pausa/retomada, histórico, custos e pendências offline.
- Cabeçalhos de apresentação claros no tema claro e escuros no tema escuro, com texto ajustado ao fundo.
- Ícones de instalação, manifestos, favoritos e cache `session-restore-22`.
- Fundo de carregamento, tela de erro, progresso e barras nativas do Android 1.1.8.
- A preferência do sistema é usada no primeiro acesso; a seleção manual fica salva.
- Impressões usam papel claro e texto escuro para manter a legibilidade.

## Publicar

1. Extraia `ProtecExtintores.zip` e abra a pasta `ProtecExtintores`.
2. Atualize o conteúdo do repositório, preservando os nomes das pastas `site`, `android-app`, `scripts`, `api-cloudflare` e `.github`. Envie os arquivos extraídos, não o ZIP.
3. Aguarde o workflow de publicação do site terminar.
4. Para atualizar também os recursos e cores nativas do app, gere um APK em **Actions → Build Android APK → Run workflow**, na branch `main`.
5. Baixe **ProtecExtintores-APK** em **Artifacts**, extraia e instale o APK.

O envio de arquivos pelo navegador GitHub aceita menos de 100 por lote. Divida o envio por pasta ou use Git/GitHub Desktop para atualizar tudo de uma vez.

Sincronize as ordens pendentes antes de atualizar o APK. Desinstalar o app remove dados locais ainda não enviados; builds de teste podem usar assinaturas diferentes.

Esta atualização visual não exige migração do banco nem novo deploy da API. Se os recursos offline anteriores ainda não foram publicados, siga também `ATUALIZACAO-OFFLINE.md`.

## Conferência

As combinações principais de texto e fundo passam pelo contraste de 4,5:1. A revisão em navegador cobriu 66 telas e pop-ups nos dois temas, em computador e celular, sem cores renderizadas fora da paleta, falhas de contraste detectadas ou transbordamento horizontal. As regras de serviços e de trabalho offline também foram verificadas.

A regressão na API local e no navegador passou por preparo offline, rascunho, modo avião, pausa/urgência/retomada, reinício, vídeo real, conclusão, expiração de sessão, reenvio, conflitos e isolamento das contas. Os arquivos Java compilaram contra API 35 e AndroidX; os recursos XML e a correspondência entre a paleta nativa e a do site foram conferidos. O APK completo e um aparelho físico não foram testados nesta atualização.

Os tokens ficam em `scripts/theme-palette.json`. Execute `node scripts/release-theme.mjs` para atualizar o CSS principal, os estilos de impressão, os manifestos e as referências de versão. Execute `node scripts/release-offline.mjs` após mudanças nos arquivos locais. As cores de inicialização e recursos Android devem acompanhar esses tokens.

O pacote contém código-fonte. A compilação completa do APK e a instalação no aparelho devem ser feitas pelo workflow Android.
