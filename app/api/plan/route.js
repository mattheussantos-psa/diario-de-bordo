import { auth } from "../../../auth";
import { getOwnerByEmail } from "../../../lib/hubspot";
import { savePlan, reviewPlan, dbReady } from "../../../lib/db";
import { weekKey } from "../../../lib/week";

// Closer só mexe no próprio plano; admin mexe no de qualquer closer.
async function resolveOwner(session, bodyOwnerId) {
  if (session.user.isAdmin && bodyOwnerId) return String(bodyOwnerId);
  const owner = await getOwnerByEmail(session.user.email.toLowerCase());
  return owner ? String(owner.ownerId) : null;
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const ownerId = await resolveOwner(session, body.ownerId);
  if (!ownerId) return Response.json({ error: "Closer não encontrado." }, { status: 403 });

  const week = body.week || weekKey();
  const items = body.items && typeof body.items === "object" ? body.items : {};
  // Closer envia para aprovação; admin editando mantém como enviado.
  const status = body.status === "rascunho" ? "rascunho" : "enviado";

  await savePlan(ownerId, week, items, status);
  return Response.json({ ok: true, status });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!session.user.isAdmin) return Response.json({ error: "Apenas admin aprova." }, { status: 403 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { ownerId, status, motivo } = body;
  if (!ownerId || !["aprovado", "reprovado"].includes(status)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (status === "reprovado" && !String(motivo || "").trim()) {
    return Response.json({ error: "Motivo é obrigatório ao reprovar." }, { status: 400 });
  }

  await reviewPlan(String(ownerId), body.week || weekKey(), status, motivo, session.user.name || session.user.email);
  return Response.json({ ok: true });
}
