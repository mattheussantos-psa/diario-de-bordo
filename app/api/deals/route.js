import { auth } from "../../../auth";
import { getOpenDeals } from "../../../lib/hubspot";
import { CLOSERS_BY_SEG } from "../../../lib/config";

// Negócios ativos de um closer — usado pelo gestor ao adicionar negócios a um plano.
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return Response.json({ error: "Apenas admin." }, { status: 403 });
  }
  const ownerId = new URL(req.url).searchParams.get("owner");
  if (!ownerId) return Response.json({ error: "Informe o closer." }, { status: 400 });

  const seg = Object.keys(CLOSERS_BY_SEG).find((s) =>
    CLOSERS_BY_SEG[s].includes(String(ownerId))
  );
  const pipelines = seg === "B2C" ? ["725182862"] : ["default"];

  const deals = await getOpenDeals(ownerId, pipelines, { withTasks: false });
  return Response.json({
    deals: deals.map((d) => ({ id: d.id, name: d.name, amount: d.amount })),
  });
}
