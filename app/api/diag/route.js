import { auth } from "../../../auth";
import { getDayBriefings, dbReady } from "../../../lib/db";
import { dayKey } from "../../../lib/week";
import { NOME_CLOSER, SEG_CLOSER } from "../../../lib/config";

// Diagnóstico: o que está gravado para o dia, exatamente como o banco devolve.
// ponytail: rota de apoio; remover quando o fluxo estiver estável.
export async function GET(req) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return Response.json({ error: "Apenas admin." }, { status: 403 });
  }

  const dia = new URL(req.url).searchParams.get("dia") || dayKey();
  const briefings = await getDayBriefings(dia);

  return Response.json({
    diaConsultado: dia,
    diaDoServidor: dayKey(),
    horaDoServidor: new Date().toISOString(),
    bancoConfigurado: dbReady(),
    total: briefings.length,
    briefings: briefings.map((b) => ({
      ownerId: b.ownerId,
      closer: NOME_CLOSER[b.ownerId] || "(fora da lista de closers)",
      segmento: SEG_CLOSER[b.ownerId] || "(sem segmento)",
      status: b.status,
      negocios: Object.keys(b.items).length,
      itens: b.items,
    })),
  });
}
