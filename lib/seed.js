import "server-only";
import { getOpenDeals } from "./hubspot";
import { saveBriefing } from "./db";
import { CLOSERS_BY_SEG } from "./config";

// Ordem de evolução usada só na demonstração.
const ALVO = { "Café com leite": "Forecast", Forecast: "Vou vender", "Vou vender": "Vou vender" };

// Cria briefings de demonstração (status "enviado"), como se os closers
// tivessem enviado o que pretendem fazer hoje.
// ponytail: apoio para validar o fluxo; remover quando estiver em uso real.
export async function seedDia(dia, segs = ["B2B", "B2C"]) {
  const feitos = [];
  for (const seg of segs) {
    const pipelines = seg === "B2B" ? ["default"] : ["725182862"];
    const res = await Promise.all(
      CLOSERS_BY_SEG[seg].map(async (ownerId) => {
        try {
          const deals = await getOpenDeals(ownerId, pipelines, { withTasks: false });
          const items = {};
          for (const d of deals.slice(0, 4)) {
            const de = d.temperatura || "";
            items[d.id] = { de, para: ALVO[de] || "Vou vender", estrategia: (seg === "B2B" ? "b2b-" : "b2c-") + (((Object.keys(items).length) % 10) + 1) };
          }
          if (Object.keys(items).length === 0) return { ownerId, seg, negocios: 0 };
          await saveBriefing(ownerId, dia, items, "enviado");
          return { ownerId, seg, negocios: Object.keys(items).length };
        } catch (e) {
          return { ownerId, seg, erro: e?.message || "falhou" };
        }
      })
    );
    feitos.push(...res);
  }
  return feitos;
}
