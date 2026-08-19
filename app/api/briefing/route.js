import { auth } from "../../../auth";
import { getOwnerByEmail, getDealsByIds } from "../../../lib/hubspot";
import { saveBriefing, reviewBriefing, getBriefing, dbReady } from "../../../lib/db";
import { dayKey } from "../../../lib/week";
import { ehGestor, podeGerirCloser } from "../../../lib/permissoes";

// Closer só mexe no próprio briefing; admin mexe no de qualquer closer.
async function resolveOwner(session, bodyOwnerId) {
  if (bodyOwnerId && podeGerirCloser(session.user, bodyOwnerId)) return String(bodyOwnerId);
  const owner = await getOwnerByEmail(session.user.email.toLowerCase());
  return owner ? String(owner.ownerId) : null;
}

// Aceita { [dealId]: { de, para } } e descarta qualquer coisa fora do formato.
function normalizar(items) {
  const out = {};
  if (!items || typeof items !== "object") return out;
  for (const [id, v] of Object.entries(items)) {
    out[String(id)] = {
      de: typeof v?.de === "string" ? v.de : "",
      para: typeof v?.para === "string" ? v.para : "",
      estrategia: typeof v?.estrategia === "string" ? v.estrategia : "",
    };
  }
  return out;
}

// Conteúdo de um briefing (usado ao expandir uma linha do histórico).
// Carregado sob demanda para não buscar dezenas de negócios de uma vez.
export async function GET(req) {
  const session = await auth();
  if (!ehGestor(session?.user)) {
    return Response.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("owner");
  const dia = searchParams.get("dia");
  if (!ownerId || !dia) return Response.json({ error: "Informe closer e dia." }, { status: 400 });
  if (!podeGerirCloser(session.user, ownerId)) {
    return Response.json({ error: "Closer fora do seu time." }, { status: 403 });
  }

  const briefing = await getBriefing(ownerId, dia);
  const ids = Object.keys(briefing?.items || {});
  const deals = ids.length ? await getDealsByIds(ids) : {};

  return Response.json({
    status: briefing?.status || "rascunho",
    motivo: briefing?.motivo || "",
    revisadoPor: briefing?.revisadoPor || "",
    itens: ids.map((id) => ({
      id,
      nome: deals[id]?.name || `Negócio ${id}`,
      valor: deals[id]?.amount ?? null,
      ...briefing.items[id],
    })),
  });
}

export async function POST(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const ownerId = await resolveOwner(session, body.ownerId);
  if (!ownerId) return Response.json({ error: "Closer não encontrado." }, { status: 403 });

  const dia = body.dia || dayKey();
  // Admin ajustando preserva a situação; closer enviando manda para aprovação.
  const status = body.manterStatus && ehGestor(session.user) ? null : "enviado";

  // Estratégia e evolução são obrigatórias: um briefing sem elas não diz nada
  // ao gestor. Validado aqui também, não só na tela.
  const items = normalizar(body.items);

  // Briefing sem nenhum negócio não é briefing: com a lista vazia, a checagem
  // de campos obrigatórios abaixo não acusa nada e o envio passava zerado.
  if (Object.keys(items).length === 0) {
    return Response.json(
      { error: "Marque ao menos um negócio para atuar hoje." },
      { status: 400 }
    );
  }

  const incompletos = Object.values(items).filter((v) => !v.para || !v.estrategia).length;
  if (incompletos > 0) {
    return Response.json(
      {
        error: `${incompletos} negócio(s) sem estratégia ou evolução pretendida.`,
      },
      { status: 400 }
    );
  }

  try {
    await saveBriefing(ownerId, dia, items, status);
  } catch (e) {
    console.error("[briefing] falha ao salvar:", e);
    return Response.json({ error: "Falha ao salvar o briefing." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.email) return Response.json({ error: "Não autenticado." }, { status: 401 });
  if (!ehGestor(session.user)) return Response.json({ error: "Sem permissão para aprovar." }, { status: 403 });
  if (!dbReady()) return Response.json({ error: "Banco não configurado." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { ownerId, status, motivo } = body;
  if (!ownerId || !["aprovado", "reprovado"].includes(status)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!podeGerirCloser(session.user, ownerId)) {
    return Response.json({ error: "Closer fora do seu time." }, { status: 403 });
  }
  if (status === "reprovado" && !String(motivo || "").trim()) {
    return Response.json({ error: "Motivo é obrigatório ao reprovar." }, { status: 400 });
  }

  await reviewBriefing(String(ownerId), body.dia || dayKey(), status, motivo, session.user.name || session.user.email);
  return Response.json({ ok: true });
}
