import { auth } from "../../../auth";
import { getOwnerByEmail } from "../../../lib/hubspot";
import { salvarAbordagem, salvarResultadoCarteira, pedirTroca, dbReady } from "../../../lib/db";
import { ABORDAGENS, RESULTADOS, EXIGE_OBSERVACAO, MINIMO_OBSERVACAO } from "../../../lib/carteira";
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

// Fechamento: o que aconteceu na empresa. Observação é exigida onde o CRM não
// tem a resposta — em tentativa a ligação registrada já é a evidência.
export async function PATCH(req) {
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

  const { companyId, resultado } = body;
  const observacao = String(body.observacao || "").trim();
  if (!companyId) return Response.json({ error: "Informe a empresa." }, { status: 400 });
  if (!RESULTADOS.some((r) => r.key === resultado)) {
    return Response.json({ error: "Resultado inválido." }, { status: 400 });
  }
  if (EXIGE_OBSERVACAO.includes(resultado) && observacao.length < MINIMO_OBSERVACAO) {
    const faltam = MINIMO_OBSERVACAO - observacao.length;
    return Response.json(
      { error: `Este resultado precisa de observação com pelo menos ${MINIMO_OBSERVACAO} caracteres (faltam ${faltam}).` },
      { status: 400 }
    );
  }

  try {
    const achou = await salvarResultadoCarteira(ownerId, body.dia || dayKey(), companyId, resultado, observacao);
    if (!achou) return Response.json({ error: "Essa empresa não está na lista de hoje." }, { status: 400 });
    // O pedido é o que segura a empresa fora do rodízio até o líder decidir.
    if (resultado === "trocar_segmento") {
      await pedirTroca(ownerId, companyId, body.nome || null, observacao);
    }
  } catch (e) {
    console.error("[carteira] falha ao salvar o resultado:", e);
    return Response.json({ error: "Falha ao salvar." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
