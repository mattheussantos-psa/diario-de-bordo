import "server-only";
import { hsSearch, hsConta } from "./hubspot";
import { PIPELINE_CS, ETAPAS_ATIVAS } from "./tramitacoes";

// Regras iguais às dos outros painéis do time, para o número do diário não
// brigar com o número que eles já usam.
// De julho/26 em diante, só conta no resultado do farmer o lead com origem na
// lista ou qualificado como Farmer. Antes disso, o histórico vale inteiro.
export const ORIGIN_CUTOVER = "2026-07-01";
export const ORIGEM_DO_LEAD_OK = [
  "Ação de CRM",
  "Ação de CRM (Carteira)",
  "Carteira do Farmer",
  "CARTEIRA (Executivos em foco)",
];
export const ORIGEM_QUALIFICACAO_OK = ["Farmer"];

// Etapas de negócio ganho.
const WON_STAGES = ["1076664462", "1076664460"];

const normaliza = (v) =>
  String(v || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "_");

// "Fora do MOA" aparece em dois campos diferentes e com grafias variadas.
const foraDoMOA = (...valores) =>
  valores.some((v) => {
    const n = normaliza(v);
    return n.includes("fora") && n.includes("moa");
  });

// Filtros de data na REST do HubSpot só aceitam timestamp em milissegundos.
// Passar "2026-09-01" devolve 400, e o número zera sem ninguém perceber.
function limitesDoMes(hoje) {
  const inicio = `${hoje.slice(0, 7)}-01`;
  const d = new Date(`${inicio}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const fim = d.toISOString().slice(0, 10);
  return {
    inicioMs: String(new Date(`${inicio}T00:00:00Z`).getTime()),
    fimMs: String(new Date(`${fim}T00:00:00Z`).getTime()),
  };
}

export async function resumoDoMes(farmerIds, hoje) {
  const vazio = {
    oportunidades: 0, ticketsAtivos: 0, receita: 0,
    carteira: 0, comContato: 0, pctContato: 0, mes: hoje.slice(0, 7),
  };
  if (!farmerIds || farmerIds.length === 0) return vazio;

  const { inicioMs, fimMs } = limitesDoMes(hoje);
  const cutoverMs = new Date(ORIGIN_CUTOVER).getTime();

  const [criados, ganhos, ticketsAtivos, carteira, comContato] = await Promise.all([
    hsSearch("deals",
      [{ filters: [
        { propertyName: "sdrfarmer_responsavel", operator: "IN", values: farmerIds },
        { propertyName: "pipedrive___data_de_qualificacao", operator: "GTE", value: inicioMs },
        { propertyName: "pipedrive___data_de_qualificacao", operator: "LT", value: fimMs },
      ] }],
      ["origem_do_lead", "origem_da_qualificacao", "closed_lost_reason",
       "motivo_de_sinalizacao_de_perda", "pipedrive___data_de_qualificacao"]
    ).catch(() => []),

    hsSearch("deals",
      [{ filters: [
        { propertyName: "sdrfarmer_responsavel", operator: "IN", values: farmerIds },
        { propertyName: "closedate", operator: "GTE", value: inicioMs },
        { propertyName: "closedate", operator: "LT", value: fimMs },
        { propertyName: "dealstage", operator: "IN", values: WON_STAGES },
      ] }],
      ["amount_in_home_currency"]
    ).catch(() => []),

    hsConta("tickets", [
      { propertyName: "hubspot_owner_id", operator: "IN", values: farmerIds },
      { propertyName: "hs_pipeline", operator: "EQ", value: PIPELINE_CS },
      { propertyName: "hs_pipeline_stage", operator: "IN", values: ETAPAS_ATIVAS },
    ]).catch(() => 0),

    hsConta("companies", [
      { propertyName: "hubspot_owner_id", operator: "IN", values: farmerIds },
    ]).catch(() => 0),

    hsConta("companies", [
      { propertyName: "hubspot_owner_id", operator: "IN", values: farmerIds },
      { propertyName: "ultimo_contato_efetivo", operator: "GTE", value: inicioMs },
    ]).catch(() => 0),
  ]);

  const oportunidades = criados.filter((d) => {
    const p = d.properties || {};
    if (foraDoMOA(p.closed_lost_reason, p.motivo_de_sinalizacao_de_perda)) return false;
    const bruto = p.pipedrive___data_de_qualificacao || "";
    const ts = /^\d{10,}$/.test(bruto) ? parseInt(bruto, 10) : new Date(bruto).getTime();
    if (ts >= cutoverMs) {
      const okLead = ORIGEM_DO_LEAD_OK.includes(p.origem_do_lead || "");
      const okQual = ORIGEM_QUALIFICACAO_OK.includes(p.origem_da_qualificacao || "");
      if (!okLead && !okQual) return false;
    }
    return true;
  }).length;

  const receita = ganhos.reduce(
    (s, d) => s + (parseFloat(d.properties?.amount_in_home_currency || "0") || 0),
    0
  );

  return {
    oportunidades,
    ticketsAtivos,
    receita,
    carteira,
    comContato,
    // Régua de cobertura: quanto da carteira foi realmente tocada no mês.
    pctContato: carteira > 0 ? Math.round((comContato / carteira) * 100) : 0,
    mes: hoje.slice(0, 7),
  };
}
