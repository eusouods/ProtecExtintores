# Históricos, peças, pintura e cobranças

Esta versão mantém o tema neutro e os painéis de administrador, funcionário e vendedor.

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
