import { auth } from "../../../../auth";
import { getOwnerByEmail, getOpenDeals, updateDeal } from "../../../../lib/hubspot";
import { CLOSER_PIPELINES } from "../../../../lib/config";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = params;
  const body = await req.json().catch(() => ({}));

  // Um closer só edita os próprios negócios; admin edita qualquer um.
  // ponytail: refaz a busca por PATCH em vez de cachear — ok no volume atual (dezenas de negócios).
  if (!session.user.isAdmin) {
    const owner = await getOwnerByEmail(session.user.email.toLowerCase());
    if (!owner) return Response.json({ error: "Closer não encontrado no HubSpot." }, { status: 403 });
    const deals = await getOpenDeals(owner.ownerId, Object.keys(CLOSER_PIPELINES));
    if (!deals.some((d) => d.id === id)) {
      return Response.json({ error: "Negócio não pertence a você." }, { status: 403 });
    }
  }

  const patch = {};
  if (typeof body.temperatura_atual === "string") patch.temperatura_atual = body.temperatura_atual;
  if (typeof body.observacoes === "string") patch.observacoes = body.observacoes;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  await updateDeal(id, patch);
  return Response.json({ ok: true });
}
