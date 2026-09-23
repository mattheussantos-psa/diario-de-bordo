import { auth } from "../../../auth";
import { getOwnerByEmail } from "../../../lib/hubspot";
import {
  getBriefing,
  salvarFechamento,
  RESULTADOS,
  MIN_OBS,
  dbReady,
} from "../../../lib/db";
import { dayKey } from "../../../lib/week";
import { ehGestor, podeGerirCloser } from "../../../lib/permissoes";

// Quem está fechando: o próprio closer, ou o gestor pelo closer dele.
async function resolveOwner(session, bodyOwnerId) {
  if (bodyOwnerId && podeGerirCloser(session.user, bodyOwnerId)) return String(bodyOwnerId);
  try {
    const owner = await getOwnerByEmail(session.user.email.toLowerCase());
    return owner ? String(owner.ownerId) : null;
  } catch (e) {
    console.error("[fechamento] HubSpot falhou ao identificar o closer:", e);
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
  if (!ownerId) return Response.json({ error: "Closer não encontrado." }, { status: 403 });

  const dia = body.dia || dayKey();
  const dealId = String(body.dealId || "");
  const resultado = String(body.resultado || "");
  const observacao = String(body.observacao || "").trim();

  if (!dealId) return Response.json({ error: "Informe o negócio." }, { status: 400 });
  if (!(resultado in RESULTADOS)) {
    return Response.json({ error: "Resultado inválido." }, { status: 400 });
  }

  // Só fecha o que foi planejado: fechar negócio fora do briefing inflaria o
  // dia e tornaria a evolução incomparável entre closers.
  const briefing = await getBriefing(ownerId, dia);
  if (!briefing || !(dealId in (briefing.items || {}))) {
    return Response.json({ error: "Esse negócio não está no briefing de hoje." }, { status: 400 });
  }

  if (RESULTADOS[resultado].exigeObs && observacao.length < MIN_OBS) {
    return Response.json(
      {
        error: `"${RESULTADOS[resultado].label}" precisa de uma observação com pelo menos ${MIN_OBS} caracteres (faltam ${MIN_OBS - observacao.length}).`,
      },
      { status: 400 }
    );
  }

  try {
    await salvarFechamento(ownerId, dia, dealId, resultado, observacao);
  } catch (e) {
    console.error("[fechamento] falha ao salvar:", e);
    return Response.json({ error: "Falha ao salvar o fechamento." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
