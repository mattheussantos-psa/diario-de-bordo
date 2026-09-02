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

// Funil do HubSpot de cada segmento. Farmer atua sobre o mesmo funil do B2B:
// o time é um agrupamento de pessoas, não um pipeline separado — não existe
// funil "Farmer" no HubSpot (conferido na conta).
export const PIPELINES_POR_SEG = {
  B2B: ["default"],
  B2C: ["725182862"],
  Farmer: ["default"],
};

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
    { id: "80454576", nome: "Eduardo Vince" },
    { id: "80454584", nome: "Cesar Luiz dos Santos Filho" },
    { id: "79760744", nome: "Diego Iram Conceição da Silva" },
  ],
  // Time de Farmer atuando como closer em paralelo, no funil B2B.
  // ponytail: lista vazia até os ownerIds serem confirmados no /api/diag.
  Farmer: [],
  B2C: [
    { id: "79760676", nome: "Amanda de Oliveira" },
    { id: "79760746", nome: "Mayda Quadros" },
    { id: "89632494", nome: "Willker Santos Belous" },
    { id: "88628309", nome: "João Paulo da Silveira Araújo" },
    { id: "88628313", nome: "Gabrielly Milani da Silva" },
    { id: "88200239", nome: "Luiza Rodriguez" },
  ],
};

// Derivados de CLOSERS: acrescentar um segmento acima basta, sem mexer aqui.
export const SEGMENTOS = Object.keys(CLOSERS);

export const CLOSERS_BY_SEG = Object.fromEntries(
  SEGMENTOS.map((s) => [s, CLOSERS[s].map((c) => c.id)])
);

// Líderes são closers com funil próprio que também aprovam, reprovam e editam
// os briefings do time deles — diferente do admin, que alcança todos os
// segmentos. O valor é o segmento que a pessoa lidera.
// Eduardo, Cesar e Diego também são closers do B2B (constam em CLOSERS); o Nicollas
// apenas lidera o B2C, sem funil próprio.
export const LIDERES = {
  "eduardo.vince@profissionaissa.com": "B2B",
  "cesar.filho@profissionaissa.com": "B2B",
  "diego.conceicao@profissionaissa.com": "B2B",
  "nicollas.lenuzza@profissionaissa.com": "B2C",
  "daniel.sias@profissionaissa.com": "Farmer",
};

export const segLideradoPor = (email) => LIDERES[String(email || "").toLowerCase()] || null;

export const NOME_CLOSER = Object.fromEntries(
  SEGMENTOS.flatMap((s) => CLOSERS[s].map((c) => [c.id, c.nome]))
);

export const SEG_CLOSER = Object.fromEntries(
  SEGMENTOS.flatMap((s) => CLOSERS[s].map((c) => [c.id, s]))
);

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
  "80454588": "/avatars/joao-gabriel.jpg", // João Gabriel Marins Pereira
  "89632494": "/avatars/willker.jpg", // Willker Santos Belous
  "79760676": "/avatars/amanda.jpg", // Amanda de Oliveira
  "79760746": "/avatars/mayda.jpg", // Mayda Quadros
  "88628309": "/avatars/joao-paulo.jpg", // João Paulo da Silveira Araújo
  "88628313": "/avatars/gabrielly.jpg", // Gabrielly Milani da Silva
  "88200239": "/avatars/luiza.jpg", // Luiza Rodriguez
  "80454576": "/avatars/eduardo-vince.jpg", // Eduardo Vince (líder B2B)
  "80454584": "/avatars/cesar.jpg", // Cesar Luiz dos Santos Filho (líder B2B)
  "79760744": "/avatars/diego.jpg", // Diego Iram Conceição da Silva (líder B2B)
};

export const fotoDe = (ownerId) => FOTOS[String(ownerId)] || null;
