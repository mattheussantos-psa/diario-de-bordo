// Configuração de domínio, papéis e mapeamentos de negócio.

export const ALLOWED_DOMAIN = "profissionaissa.com";

// Admins veem todos os closers / ambos os segmentos.
// Padrão abaixo; env ADMIN_EMAILS (CSV) sobrescreve se definida.
const DEFAULT_ADMINS = [
  "marcio.spagnolo@profissionaissa.com",
  "crm.psa@profissionaissa.com",
  "mattheus.santos@profissionaissa.com",
  "leonardo.moreira@profissionaissa.com",
];
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",")
  : DEFAULT_ADMINS
)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Pipelines que contam como "funil de closer" (id do HubSpot -> rótulo do segmento).
export const CLOSER_PIPELINES = { default: "B2B", "725182862": "B2C" };

// Closers por segmento (ownerId do HubSpot). Define quem aparece no seletor do admin
// quando B2B ou B2C está selecionado. Ids confirmados na conta.
export const CLOSERS_BY_SEG = {
  B2B: [
    "80651489", // Catarina Varoni Borges
    "92704130", // Talita Santos Cruz
    "80454588", // João Gabriel Marins Pereira
    "92333469", // Rafael Oliveira Alves
    "80454586", // Rafael Teixeira
    "86859895", // Mateus Mariano
  ],
  B2C: [
    "79760676", // Amanda de Oliveira
    "79760746", // Mayda Quadros
    "89632494", // Willker Santos Belous
    "88628309", // João Paulo da Silveira Araújo
    "88628313", // Gabrielly Milani da Silva
    "88200239", // Luiza Rodriguez
  ],
};

// Etapas de Ganho/Fechado/Perdido a EXCLUIR da contagem de "ativo no funil".
// As flags nativas do HubSpot (hs_is_closed / isClosed) estão inconsistentes nesta
// conta (ex: a etapa "Ganho / Contrato assinado" não é marcada como fechada), então
// listamos explicitamente. Medido contra o HubSpot: sem estas, Rafael = 47 ativos no B2B.
//   B2B (default):  1076664460 Ganho/Contrato · 1076664462 Negócio fechado · 1076664461 Perdido
//   B2C (725182862): 1105295876 Ganho · 1059939760 Perdido
export const CLOSED_STAGES = [
  "1076664460",
  "1076664462",
  "1076664461",
  "1105295876",
  "1059939760",
];

// Estilo visual por valor da propriedade temperatura_atual (valor interno -> classe).
// Valores vêm do HubSpot; um valor sem estilo cai no visual neutro.
export const TEMP_STYLE = {
  Forecast: "fc",
  "Vou vender": "vv",
  "Não levo fé": "lm", // rótulo exibido: "Larguei de mão"
  "Café com leite": "cl",
};

// Link para o registro do negócio no HubSpot.
export const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || "49656171";
export const dealUrl = (id) =>
  `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-3/${id}`;

// HubSpot não expõe a foto do usuário pela API; guardamos uma por closer.
// e-mail -> caminho em /public. Sem entrada = avatar de iniciais.
export const AVATARS = {
  "rafael.teixeira@profissionaissa.com": "/avatars/rafael.jpg",
};
