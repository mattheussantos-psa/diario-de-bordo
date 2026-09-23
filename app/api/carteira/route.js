import { auth } from "../../../auth";
import { getOwnerByEmail } from "../../../lib/hubspot";
import { salvarAbordagem, dbReady } from "../../../lib/db";
import { ABORDAGENS } from "../../../lib/carteira";
import { dayKey } from "../../../lib/week";
import { podeGerirCloser } from "../../../lib/permissoes";

// De quem é o dia: o próprio farmer, ou o líder abrindo o dia de alguém dele.
async function resolveOwner(session, bodyOwnerId) {
  if (bodyOwnerId && podeGerirCloser(session.user, bodyOwnerId)) return String(bodyOwnerId);
  try {
    const owner = await getOwnerByEmail(session.user.email.toLowerCase());
    return owner ? String(owner.ownerId) : null;
  } catch (e) {
    console.error("[carteira] HubSpot falhou ao identificar o farmer:", e);
    throw new Error("Não foi possível falar com o HubSpot para identificar você.");
  }
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  let ownerId;
  try {
    ownerId = await resolveOwner(session, body.ownerId);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 503 });
  }
  if (!ownerId) return Response.json({ error: "Farmer não encontrado." }, { status: 403 });

  const { companyId, abordagem } = body;
  if (!companyId) return Response.json({ error: "Informe a empresa." }, { status: 400 });
  if (abordagem && !ABORDAGENS.includes(abordagem)) {
    return Response.json({ error: "Abordagem inválida." }, { status: 400 });
  }

  try {
    const achou = await salvarAbordagem(ownerId, body.dia || dayKey(), companyId, abordagem);
    if (!achou) {
      return Response.json({ error: "Essa empresa não está na lista de hoje." }, { status: 400 });
    }
  } catch (e) {
    console.error("[carteira] falha ao salvar a abordagem:", e);
    return Response.json({ error: "Falha ao salvar." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
