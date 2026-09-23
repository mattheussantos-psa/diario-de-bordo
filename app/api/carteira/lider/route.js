import { auth } from "../../../../auth";
import { decidirTroca, salvarOrientacao, dbReady } from "../../../../lib/db";
import { podeGerirCloser } from "../../../../lib/permissoes";

const quem = (s) => s.user.name || s.user.email;

// Decisões que só o líder toma sobre a carteira de um farmer: resolver um
// pedido de troca de segmento e escrever a orientação de uma empresa travada.
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const { acao, ownerId, companyId, decisao, texto } = await req.json().catch(() => ({}));
  if (!ownerId || !companyId) return Response.json({ error: "Dados incompletos." }, { status: 400 });
  if (!podeGerirCloser(session.user, ownerId)) {
    return Response.json({ error: "Esse farmer não é do seu time." }, { status: 403 });
  }

  try {
    if (acao === "troca") {
      // "trocado": saiu da carteira no HubSpot. "mantido": volta ao rodízio.
      if (!["trocado", "mantido"].includes(decisao)) {
        return Response.json({ error: "Decisão inválida." }, { status: 400 });
      }
      await decidirTroca(ownerId, companyId, decisao, quem(session));
      return Response.json({ ok: true });
    }

    if (acao === "orientacao") {
      const t = String(texto || "").trim();
      // Orientação vazia não ajuda ninguém e ocuparia espaço no card.
      if (t.length < 10) {
        return Response.json({ error: "Escreva a orientação." }, { status: 400 });
      }
      await salvarOrientacao(ownerId, companyId, t, quem(session));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    console.error("[carteira] falha na ação do líder:", e);
    return Response.json({ error: "Falha ao registrar." }, { status: 500 });
  }
}
