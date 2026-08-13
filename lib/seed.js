import "server-only";
import { getOpenDeals } from "./hubspot";
import { savePlan } from "./db";
import { CLOSERS_BY_SEG } from "./config";

// Cria cronogramas de demonstração (status "enviado") para os closers, como se
// eles tivessem montado e enviado o plano da semana.
// ponytail: apoio para validar o fluxo de aprovação; remover quando os closers
// estiverem usando o sistema de verdade.
export async function seedWeek(week, segs = ["B2B", "B2C"]) {
  const feitos = [];
  for (const seg of segs) {
    const pipelines = seg === "B2B" ? ["default"] : ["725182862"];
    const res = await Promise.all(
      CLOSERS_BY_SEG[seg].map(async (ownerId) => {
        try {
          const deals = await getOpenDeals(ownerId, pipelines, { withTasks: false });
          const items = {};
          // Até 5 negócios espalhados de segunda a sexta.
          deals.slice(0, 5).forEach((d, i) => (items[d.id] = (i % 5) + 1));
          if (Object.keys(items).length === 0) return { ownerId, seg, negocios: 0 };
          await savePlan(ownerId, week, items, "enviado");
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
