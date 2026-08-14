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
// Nome fica aqui de propósito: buscar os owners no HubSpot a cada tela pagina
// centenas de registros e consome a cota diária da API à toa.
export const CLOSERS = {
  B2B: [
    { id: "80651489", nome: "Catarina Varoni Borges" },
    { id: "92704130", nome: "Talita Santos Cruz" },
    { id: "80454588", nome: "João Gabriel Marins Pereira" },
    { id: "92333469", nome: "Rafael Oliveira Alves" },
    { id: "80454586", nome: "Rafael Teixeira" },
    { id: "86859895", nome: "Mateus Mariano" },
  ],
  B2C: [
    { id: "79760676", nome: "Amanda de Oliveira" },
    { id: "79760746", nome: "Mayda Quadros" },
    { id: "89632494", nome: "Willker Santos Belous" },
    { id: "88628309", nome: "João Paulo da Silveira Araújo" },
    { id: "88628313", nome: "Gabrielly Milani da Silva" },
    { id: "88200239", nome: "Luiza Rodriguez" },
  ],
};

export const CLOSERS_BY_SEG = {
  B2B: CLOSERS.B2B.map((c) => c.id),
  B2C: CLOSERS.B2C.map((c) => c.id),
};

export const NOME_CLOSER = Object.fromEntries(
  [...CLOSERS.B2B, ...CLOSERS.B2C].map((c) => [c.id, c.nome])
);

export const SEG_CLOSER = Object.fromEntries([
  ...CLOSERS.B2B.map((c) => [c.id, "B2B"]),
  ...CLOSERS.B2C.map((c) => [c.id, "B2C"]),
]);

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
// Foto por ownerId (o HubSpot não expõe avatar pela API). Vinculado ao id, não
// ao e-mail, para não depender de adivinhar endereços.
export const FOTOS = {
  "80454586": "/avatars/rafael.jpg", // Rafael Teixeira
  "80651489": "/avatars/catarina.jpg", // Catarina Varoni Borges
  "92704130": "/avatars/talita.jpg", // Talita Santos Cruz
  "92333469": "/avatars/rafael-alves.jpg", // Rafael Oliveira Alves
  "86859895": "/avatars/mateus.jpg", // Mateus Mariano
  "80454588": "/avatars/gabriel.jpg", // João Gabriel Marins Pereira
  "89632494": "/avatars/willker.jpg", // Willker Santos Belous
  "79760676": "/avatars/amanda.jpg", // Amanda de Oliveira
};

export const fotoDe = (ownerId) => FOTOS[String(ownerId)] || null;
