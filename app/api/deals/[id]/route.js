import { auth } from "../../../../auth";
import { getOwnerByEmail, getDealOwner, updateDeal } from "../../../../lib/hubspot";

export async function PATCH(req, { params }) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id } = params;
  const body = await req.json().catch(() => ({}));

  // Um closer só edita os próprios negócios; admin edita qualquer um.
  // A checagem lê o dono deste negócio, e só dele: varrer o funil inteiro a
  // cada PATCH usava a busca do HubSpot, limitada a poucas chamadas por
  // segundo — salvar várias observações de uma vez estourava o limite e
  // derrubava os salvamentos com 429.
  if (!session.user.isAdmin) {
    const owner = await getOwnerByEmail(session.user.email.toLowerCase());
    if (!owner) return Response.json({ error: "Closer não encontrado no HubSpot." }, { status: 403 });
    const dono = await getDealOwner(id);
    if (String(dono) !== String(owner.ownerId)) {
      return Response.json({ error: "Negócio não pertence a você." }, { status: 403 });
    }
  }

  // Só a observação vai para o HubSpot. A evolução é intenção do briefing e
  // não altera temperatura_atual — quem move a temperatura é o closer no CRM.
  const patch = {};
  if (typeof body.observacoes === "string") patch.observacoes = body.observacoes;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  await updateDeal(id, patch);
  return Response.json({ ok: true });
}
