import { auth } from "../../../auth";
import { getOwnerByEmail } from "../../../lib/hubspot";
import { marcarTramitacao, decidirTramitacao, dbReady } from "../../../lib/db";
import { TIPOS } from "../../../lib/tramitacoes";
import { ehGestor } from "../../../lib/permissoes";

const quem = (session) => session.user.name || session.user.email;

// O responsável marca como feito. A pendência fica aguardando o líder — não
// sai do board sozinha, senão marcar viraria atalho para fazer sumir.
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const { ticketId, tipo } = await req.json().catch(() => ({}));
  if (!ticketId || !(tipo in TIPOS)) {
    return Response.json({ error: "Tramitação inválida." }, { status: 400 });
  }

  // Quem marca precisa estar vinculado a um owner: é o registro de autoria.
  try {
    if (!ehGestor(session.user)) {
      const owner = await getOwnerByEmail(session.user.email.toLowerCase());
      if (!owner) return Response.json({ error: "Seu e-mail não está vinculado a um owner do HubSpot." }, { status: 403 });
    }
  } catch (e) {
    console.error("[tramitacoes] HubSpot falhou ao identificar:", e);
    return Response.json({ error: "Não foi possível falar com o HubSpot agora." }, { status: 503 });
  }

  try {
    await marcarTramitacao(ticketId, tipo, quem(session));
  } catch (e) {
    console.error("[tramitacoes] falha ao marcar:", e);
    return Response.json({ error: "Falha ao registrar." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

// O líder confirma ou devolve. Devolver exige motivo: sem ele, a pendência
// volta ao board e ninguém sabe o que corrigir.
export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!ehGestor(session.user)) return Response.json({ error: "Só o líder confirma." }, { status: 403 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const { ticketId, tipo, decisao, motivo } = await req.json().catch(() => ({}));
  if (!ticketId || !(tipo in TIPOS) || !["confirmado", "devolvido"].includes(decisao)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (decisao === "devolvido" && !String(motivo || "").trim()) {
    return Response.json({ error: "Escreva o motivo da devolução." }, { status: 400 });
  }

  try {
    await decidirTramitacao(ticketId, tipo, decisao, quem(session), motivo);
  } catch (e) {
    console.error("[tramitacoes] falha ao decidir:", e);
    return Response.json({ error: "Falha ao registrar a decisão." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
