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
