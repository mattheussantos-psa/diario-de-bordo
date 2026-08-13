import { auth } from "../../../auth";
import { getOpenDeals } from "../../../lib/hubspot";
import { savePlan, dbReady } from "../../../lib/db";
import { CLOSERS_BY_SEG } from "../../../lib/config";
import { weekKey } from "../../../lib/week";

// Gera planos de TESTE (status "enviado") para os closers do segmento, para o admin
// exercitar aprovar/reprovar. Só admin. Não cria nada no HubSpot — grava apenas o
// plano no nosso banco.
// ponytail: rota de apoio; apagar quando o fluxo estiver validado em produção.
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return Response.json({ error: "Apenas admin." }, { status: 403 });
  }
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const seg = new URL(req.url).searchParams.get("seg") === "B2C" ? "B2C" : "B2B";
  const pipelines = seg === "B2B" ? ["default"] : ["725182862"];
  const week = weekKey();

  const feitos = await Promise.all(
    CLOSERS_BY_SEG[seg].map(async (ownerId) => {
      const deals = await getOpenDeals(ownerId, pipelines, { withTasks: false });
      const items = {};
      // Pega até 4 negócios e espalha entre segunda e quinta.
      deals.slice(0, 4).forEach((d, i) => (items[d.id] = (i % 4) + 1));
      if (Object.keys(items).length === 0) return { ownerId, negocios: 0 };
      await savePlan(ownerId, week, items, "enviado");
      return { ownerId, negocios: Object.keys(items).length };
    })
  );

  return Response.json({ ok: true, semana: week, segmento: seg, planos: feitos });
}
