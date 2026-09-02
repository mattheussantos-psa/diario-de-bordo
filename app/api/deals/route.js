import { auth } from "../../../auth";
import { getOpenDeals } from "../../../lib/hubspot";
import { CLOSERS_BY_SEG, PIPELINES_POR_SEG } from "../../../lib/config";
import { ehGestor, podeGerirCloser } from "../../../lib/permissoes";

// Negócios ativos de um closer — usado pelo gestor ao adicionar negócios a um plano.
export async function GET(req) {
  const session = await auth();
  if (!ehGestor(session?.user)) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }
  const ownerId = new URL(req.url).searchParams.get("owner");
  if (!ownerId) return Response.json({ error: "Informe o closer." }, { status: 400 });
  if (!podeGerirCloser(session.user, ownerId)) {
    return Response.json({ error: "Closer fora do seu time." }, { status: 403 });
  }

  const seg = Object.keys(CLOSERS_BY_SEG).find((s) =>
    CLOSERS_BY_SEG[s].includes(String(ownerId))
  );
  const pipelines = PIPELINES_POR_SEG[seg] || PIPELINES_POR_SEG.B2B;

  const deals = await getOpenDeals(ownerId, pipelines, { withTasks: false });
  return Response.json({
    deals: deals.map((d) => ({ id: d.id, name: d.name, amount: d.amount })),
  });
}
