# Atualização dos painéis — versão 23

## Atualização operacional — versão 23 / Android 1.1.9

As instruções desta seção são as da versão atual. As notas abaixo dela registram atualizações anteriores.

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

Não há migração nova de banco nem mudança das credenciais ou da paleta. O pacote tem **98 arquivos** antes de instalar dependências. O registro de recebimentos diretos depende da API desta versão; publique-a antes do site.

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
