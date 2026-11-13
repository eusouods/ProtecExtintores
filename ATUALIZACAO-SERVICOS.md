# Atualização dos painéis — versão 23

## Cobrança interna com Pix — versão 24 / Android 1.2.0

**Esta é a instrução da versão atual.** Os blocos seguintes registram o histórico de versões anteriores.

### Como funciona

- Tanto funcionário quanto vendedor pagam as ordens que criam. A dívida fica vinculada ao criador, não a quem apenas executa o atendimento. Ordens da empresa atribuídas a um técnico não geram uma dívida pessoal para ele.
- O preço interno é calculado no servidor com o desconto definido pelo admin sobre a tabela de manutenção e os itens adicionais. Há padrão para cada perfil e condições individuais opcionais. Nenhum desconto comercial foi inventado: o administrador precisa configurar seus percentuais, maiores que zero e menores que 100%.
- O campo **Valor que você cobrará do cliente** é opcional e livre. Ele não reduz nem substitui a cobrança interna. Exemplo apenas ilustrativo, sem extras: tabela de R$ 100 e desconto de 20% geram R$ 80 devidos à Protec, independentemente do preço combinado entre parceiro e cliente.
- A cobrança é registrada na finalização administrativa, após a execução e revisão. Os valores finalizados são preservados quando preços e condições mudam depois.
- Após a finalização: a ordem fica disponível em **Ver pagamentos e Pix**, com QR Code, valor e copia e cola.
- No semanal: as ordens acumulam até o dia escolhido. O Pix é liberado a partir desse dia. Abrir o primeiro Pix fecha o conjunto e o valor daquele acerto. Ordens finalizadas depois entram no próximo período semanal. Um Pix emitido mantém as mesmas ordens e o mesmo total quando reaberto.
- O parceiro pode avisar que pagou e informar uma referência. Esse aviso não quita a dívida. Somente o administrador confirma o recebimento, após conferir o banco, pelo acerto completo. O usuário e a referência ficam no histórico.
- Este fluxo gera **Pix estático com conferência manual**. Não é débito automático nem confirmação bancária automática; a integração bancária legada de pedidos não confirma estes acertos de equipe. Códigos antigos salvos fora do app não podem ser cancelados no banco pelo site. Não reutilize códigos já pagos.

### Configurar no admin

1. Em **Configurações → Pagamento via Pix**, cadastre a chave Pix realmente registrada no banco da empresa e a cidade do recebedor. O CNPJ da empresa só pode ser usado como chave se estiver cadastrado como Pix no banco. CPF/CNPJ e telefone formatados são normalizados; também são aceitos e-mail e chave aleatória.
2. Em **Custos e cobranças → Cobranças internas da equipe**, configure o desconto e o prazo padrão para funcionários e vendedores. Abra as condições individuais para definir uma exceção ou herdar o padrão.
3. Defina os preços de manutenção por tipo/peso e os custos reais da empresa. Para atendimento especial sem preço de tabela, abra a ordem e use **Definir valor interno base** antes de finalizar. Extras continuam separados.
4. Nos acertos individuais, abra o Pix ou confira o recebimento informado. Confirme somente o que efetivamente recebeu. Não marque uma ordem isolada como paga quando ela já estiver vinculada a um acerto Pix.

Ordens e pagamentos antigos já registrados no servidor mantêm seus valores. A atualização não cria retroativamente dívidas de funcionários em ordens anteriores sem identificação de criador pagante. Operações offline enviadas após a atualização passam pelas regras novas no servidor; atualize os aplicativos e revise o valor interno antes de finalizar. Rascunhos e vídeos são preservados.

### Publicar

Extraia o projeto completo. No PowerShell dentro da pasta **ProtecExtintores/api-cloudflare**, execute:

```powershell
npm.cmd install
npx.cmd wrangler deploy
```

Depois atualize o repositório com os arquivos deste ZIP, sem `node_modules`, mantendo a estrutura. Aguarde a publicação do site. Gere o APK **1.2.0** no GitHub Actions para atualizar a cópia offline. Atualizar sobre uma instalação existente exige a mesma assinatura; preserve o app e seus dados enquanto houver registros pendentes.

O ZIP contém **99 arquivos**, antes de instalar dependências. Não há nova migração de banco nem troca de credenciais. API, arquivos compartilhados da pasta `site` e interface precisam ser publicados juntos. No registro offline, o Pix só pode ser consultado após sincronizar e finalizar a ordem.

### Validação desta entrega

Testes verificam os dois perfis, criador diferente do executor, preços internos separados do preço ao cliente, descontos, extras, fechamento semanal e período seguinte, valores antigos preservados, geração concorrente sem duplicação, recusa de quitação pelo parceiro, aviso sem baixa, confirmação admin e chave Pix ausente. O QR foi decodificado dos pixels renderizados nos dois temas, conferindo o valor, o código copiado e o CRC. Também são verificados os fluxos offline, a restauração de sessão e a interface responsiva. Nenhuma transferência bancária foi realizada nos testes e não houve teste em aparelho físico.

Referência técnica de formatação: [Manual de Padrões para Iniciação do Pix — Banco Central](https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf).

---

## Histórico: atualização operacional — versão 23 / Android 1.1.9

Notas históricas da versão 23. Para publicar a versão atual, siga a seção Cobrança interna com Pix — versão 24.

- Admin: resumo de revisões, atendimentos, pausas, valores a receber e atalhos para ordens, equipe, agenda, alertas e relatórios.
- Funcionário: serviço atual, pausados, histórico individual, menu compacto e ações da execução dentro da consulta da ordem.
- Vendedor: acompanhamento, saldo e vencimentos; dados de custos internos permanecem exclusivos do administrador.
- Consulta da ordem por seções: resumo, etapas, equipamentos e vídeos, custos/pagamento e linha do tempo com responsáveis. Vídeos locais também podem ser assistidos antes do envio.
- No celular, tabelas administrativas viram cartões com rótulos, e os diálogos têm cabeçalho e fechamento acessíveis, navegação por teclado e rolagem própria.
- Cada ordem informa se está no aparelho, em envio, confirmada ou precisa de atenção. Vídeos têm progresso por bytes no navegador e no Android novo. A última confirmação é mantida por conta; fechar o app preserva os registros.
- O financeiro separa receitas de ordens, recebimentos confirmados, valores a receber, resultado bruto previsto e realizado. Só ordens pagas com custos completos entram no realizado. Ordens com custos incompletos são identificadas. Recebimentos diretos também podem ser confirmados, com referência, usuário e histórico.
- Formulários bloqueiam envio simultâneo repetido. Quitação duplicada continua recusada pelo servidor. Ao sair, expirar ou trocar de conta, o cache administrativo é limpo sem apagar o cofre criptografado de rascunhos e vídeos da equipe.

### Publicação desta versão

1. Extraia `ProtecExtintores.zip`. Abra o PowerShell na pasta `ProtecExtintores/api-cloudflare` extraída e publique a API:

```powershell
npm.cmd install
npx.cmd wrangler deploy
```

2. Substitua os arquivos correspondentes no repositório pelo conteúdo da pasta `ProtecExtintores`, mantendo a estrutura. Aguarde a publicação do site no GitHub Actions. Não envie a pasta `node_modules` criada no passo anterior.
3. Gere o APK **1.1.9** no workflow Android para atualizar o site embutido e o progresso nativo. Atualizações sobre o app instalado exigem a mesma assinatura. Preserve a instalação e os dados enquanto houver envios pendentes.

Não há migração nova de banco nem mudança das credenciais ou da paleta. O pacote tem **99 arquivos** antes de instalar dependências. O registro de recebimentos diretos depende da API desta versão; publique-a antes do site.

### Validação

As verificações cobrem cálculo financeiro e permissões, recebimento direto sem duplicação, envio duplo de formulário, consulta e reprodução de vídeo protegido real, pausa pelo detalhe, restauração da sessão, tabelas em celular e isolamento entre perfis. O fluxo offline inclui reinício, vídeo, conclusão, expiração e revisão de conflitos. Os dois temas passam por auditoria de contraste, cores e largura. Java compilado contra API 35/AndroidX; não foi executado APK em aparelho físico.


---

## Histórico de implementação

# Históricos, peças, pintura e cobranças

Esta versão mantém os painéis de administrador, funcionário e vendedor. A identidade visual atual está descrita em `ATUALIZACAO-VISUAL.md`.

## Publicar

1. Substitua os arquivos do projeto no repositório e publique a pasta `site` como antes.
2. No PowerShell, entre na pasta `api-cloudflare` do projeto extraído e execute:

   ```powershell
   npm.cmd ci
   npx.cmd wrangler deploy --config .\wrangler.jsonc
   ```

Não é necessário recriar o D1 nem apagar dados. Os novos registros financeiros são armazenados no estado existente. Não publique `node_modules`, `.wrangler` ou os testes como página inicial.

## Preparar os custos

Abra **Custos e cobranças** no painel admin. Adicione nome, capacidade/peso quando aplicável, categoria, custo unitário pago e valor cobrado.

- Para os insumos/custo de recarga ou manutenção automática, use a categoria **Serviço**, com nome e peso iguais ao tipo de extintor da ordem. Esse custo representa o atendimento, não a compra de um extintor novo.
- Cadastre válvulas e outras peças com o nome usado pela equipe. Marque **Disponível como peça para o técnico** para acrescentar uma opção personalizada.
- Cadastre **Pintura** com esse nome exato para cobrar e contabilizar automaticamente cada pintura registrada.
- Extintores novos, placas, fretes de compra, mão de obra extra e outros itens podem ser adicionados à ordem pelo botão **Itens adicionais**. Não repita peças já registradas pelo técnico.
- O botão **Remover** desativa uma opção. Os valores de ordens fechadas permanecem no histórico.

Não são inventados valores de custo. Se faltar algum custo, o sistema mostra **resultado parcial**. O resultado mostrado é bruto: despesas fixas, impostos e demais gastos só são descontados quando cadastrados. Prepare os custos antes de fechar as ordens.

## Execução e vídeos

O funcionário vê **Em execução** e **Meu histórico**. Cada serviço permanece associado ao responsável após concluir. Nos detalhes aparecem extintores, peças, pintura e histórico.

Cada peça trocada exige um vídeo individual no respectivo extintor, inclusive peças personalizadas. São aceitos vídeos de até 60 segundos e 50 MB. O técnico pode assistir, e admin e vendedor vinculado à ordem podem consultar os mesmos vídeos. O acesso exige sessão e vínculo com o serviço.

Ao concluir a execução, o técnico informa quantos extintores receberam pintura (zero é permitido). A opção **Aguardando peça** foi removida. Registros abertos antigos nessa etapa são migrados para **Em manutenção**, preservando o histórico.

Serviços antigos já executados com vídeos pendentes oferecem **Completar vídeos pendentes** enquanto aguardam a finalização do admin. A ordem só é finalizada depois de todas as evidências exigidas.

## Cobrança dos vendedores

Em **Custos e cobranças**, o admin define a regra padrão ou uma regra por vendedor:

- **Após a conclusão administrativa**: a ordem vence na data da finalização.
- **Acumulado semanal**: a ordem vence no próximo dia escolhido da semana; se finalizada nesse dia, vence no mesmo dia. As ordens do mesmo vendedor e vencimento formam um único acerto.

Datas são calculadas em **America/Sao_Paulo**. Regras novas valem para ordens finalizadas dali em diante. Ordens já fechadas preservam valores e prazo. O vendedor vê o saldo, os vencimentos e o histórico de cada serviço, sem acesso aos custos internos e à margem do admin.

O admin usa **Registrar recebimento** depois de receber o pagamento e informa uma referência ou observação do comprovante. Essa confirmação é manual; não movimenta dinheiro nem consulta o banco automaticamente.

Ordens antigas finalizadas não geram cobranças retroativas automaticamente. O admin pode usar **Importar ordem anterior**, depois de revisar os custos e a regra atual.

## Verificação local

```powershell
node .\scripts\test-service-rules.mjs
node .\scripts\verify-site.mjs
```

Os testes usam dados isolados e não alteram o banco de produção. A página `tests/service-workflows.html` é uma demonstração local com dados fictícios.
