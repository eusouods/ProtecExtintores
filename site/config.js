// URL base do Worker de API do ProtecExtintores, sem barra no final.
// Exemplo: https://nome-do-worker.sua-conta.workers.dev
window.PROTEC_API_BASE_URL = 'https://protecextintores.eusouods.workers.dev';
// Client ID OAuth público do Google. Preencha após criar o cliente OAuth Web.
window.PROTEC_GOOGLE_CLIENT_ID = '';

// ─────────────────────────────────────────────────────────────
// DADOS DA EMPRESA — preencha o que tiver. O que ficar vazio ('' ou [])
// simplesmente não aparece no site (nada de texto "preencher aqui" na vitrine).
// ─────────────────────────────────────────────────────────────
window.PROTEC_EMPRESA = {
  // WhatsApp só com números, com país e DDD. Ex.: '5586999999999'.
  // Ao preencher, aparecem o botão fixo no canto, o link no rodapé e o envio do código do pedido.
  whatsapp: '',
  telefone: '',            // Ex.: '(86) 99999-9999'
  email: '',
  endereco: '',            // Ex.: 'Rua Exemplo, 123 — Bairro, Teresina/PI'
  horario: '',             // Ex.: 'Seg. a sex., 8h às 18h'  (aparece também no cartão da página inicial)
  cnpj: '',
  instagram: '',           // Só o usuário, sem @. Ex.: 'protecextintores'

  // Três fatos curtos logo abaixo do título da página inicial. Só deixe o que for verdade.
  destaques: [
    ['Orçamento sem compromisso', 'enviar o pedido não agenda nem cobra'],
    ['Manutenção de extintores', 'solicite uma avaliação da equipe'],
    ['Acompanhe cada etapa', 'pelo código do seu pedido']
  ],

  // Provas de confiança. Só aparecem quando preenchidas. Use apenas dados reais.
  certificacoes: [],       // Ex.: ['Selo INMETRO', 'Corpo de Bombeiros — alvará 123/2026']
  avaliacoes: [],          // Ex.: [{nome:'Maria S.', empresa:'Padaria X', texto:'Atendimento rápido…'}]

  // "A partir de" por serviço, aparece no cartão do serviço. Ex.: {maintenance:'R$ 45', installation:'R$ 30'}
  // Códigos: maintenance, installation, wall-support, floor-stand, demarcation, safety-signage,
  // hydrant-hose-test, extinguisher-hose, diffuser, hydrant-cabinet, hydrant-accessories,
  // emergency-light, pressure-gauge, valve, extinguisher-wheels, other-work
  precosAPartirDe: {}
};
