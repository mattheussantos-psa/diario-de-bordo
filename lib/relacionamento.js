import "server-only";
import { hsSearch, associacoesPara, associacoesEntre, lerEmLote } from "./hubspot";

// Selo de relacionamento: a empresa tem história construída com o dono ATUAL
// da carteira — ele registrou negócio e já realizou mais de uma reunião de
// relacionamento com ela. O sinal é da pessoa, não da empresa: herdar uma
// carteira não herda o relacionamento de quem veio antes.
export const MINIMO_REUNIOES = 2;
const TIPO_REUNIAO = "Reunião de Relacionamento";

// Parte das reuniões, que são poucas, e só então confere o negócio. O caminho
// inverso varreria a carteira inteira de negócios a cada abertura do diário.
export async function empresasComSelo(farmerId, companyIds) {
  const selo = new Set();
  if (!companyIds || companyIds.length === 0) return selo;

  const reunioes = await hsSearch(
    "meetings",
    [{ filters: [
      { propertyName: "hubspot_owner_id", operator: "EQ", value: String(farmerId) },
      { propertyName: "hs_activity_type", operator: "EQ", value: TIPO_REUNIAO },
      { propertyName: "hs_meeting_outcome", operator: "EQ", value: "COMPLETED" },
    ] }],
    ["hs_meeting_title"]
  ).catch(() => []);
  if (reunioes.length === 0) return selo;

  const assoc = await associacoesPara("meetings", reunioes.map((r) => r.id)).catch(() => ({}));
  const porEmpresa = {};
  for (const empresas of Object.values(assoc)) {
    for (const e of empresas) porEmpresa[e] = (porEmpresa[e] || 0) + 1;
  }

  const naLista = new Set(companyIds.map(String));
  const candidatas = Object.entries(porEmpresa)
    .filter(([empresa, total]) => total >= MINIMO_REUNIOES && naLista.has(empresa))
    .map(([empresa]) => empresa);
  if (candidatas.length === 0) return selo;

  const negociosPorEmpresa = await associacoesEntre("companies", "deals", candidatas).catch(() => ({}));
  const dealIds = [...new Set(Object.values(negociosPorEmpresa).flat())];
  if (dealIds.length === 0) return selo;

  const donos = await lerEmLote("deals", dealIds, ["sdrfarmer_responsavel"]).catch(() => ({}));

  for (const empresa of candidatas) {
    const negocios = negociosPorEmpresa[empresa] || [];
    if (negocios.some((id) => donos[id]?.sdrfarmer_responsavel === String(farmerId))) {
      selo.add(empresa);
    }
  }
  return selo;
}
