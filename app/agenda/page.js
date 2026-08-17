import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "../../auth";
import { getDealsByIds } from "../../lib/hubspot";
import { getDayBriefings, dbReady } from "../../lib/db";
import { dayKey, dayLabel } from "../../lib/week";
import { CLOSERS, TEMP_STYLE, dealUrl, fotoDe } from "../../lib/config";

export const dynamic = "force-dynamic";

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
const brl = (n) => (n == null ? "" : "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

const STATUS_LABEL = {
  rascunho: "Rascunho",
  enviado: "Aguardando",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export default async function AgendaGeral({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!session.user.isAdmin) redirect("/");

  const userName = session.user.name || session.user.email;
  const dia = searchParams?.dia || dayKey();
  const seg = searchParams?.seg === "B2C" ? "B2C" : "B2B";

  const briefings = await getDayBriefings(dia);
  const porOwner = Object.fromEntries(briefings.map((b) => [String(b.ownerId), b]));

  // Todos os closers do time aparecem — inclusive quem ainda não enviou nada.
  // Ordem por urgência para o gestor: o que espera decisão primeiro, quem não
  // enviou por último. Dentro do mesmo grupo, mantém a ordem do cadastro.
  const PESO = { enviado: 0, reprovado: 1, aprovado: 2, rascunho: 3 };
  const time = CLOSERS[seg]
    .map((c, i) => {
      const briefing = porOwner[c.id] || null;
      const temItens = briefing && Object.keys(briefing.items).length > 0;
      return {
        ...c,
        i,
        foto: fotoDe(c.id),
        briefing,
        peso: temItens ? PESO[briefing.status] ?? 3 : 4, // sem briefing: por último
      };
    })
    .sort((a, b) => a.peso - b.peso || a.i - b.i);

  const ids = briefings.flatMap((b) => Object.keys(b.items));
  const dealsById = ids.length ? await getDealsByIds(ids) : {};

  const totalNeg = time.reduce((s, c) => s + Object.keys(c.briefing?.items || {}).length, 0);
  const enviaram = time.filter((c) => c.briefing && Object.keys(c.briefing.items).length).length;

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="logo" src="/logo-psa.png" alt="PSA" />
          <div className="divider" />
          <div>
            <div className="title">Agenda do dia</div>
            <div className="subtitle">
              {dayLabel(dia)} · {enviaram} de {time.length} closers · {totalNeg} negócio{totalNeg === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="who">
          <div className="pfp">{initials(userName)}</div>
          <div className="who-name">{userName}</div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
            <button className="signout" type="submit">Sair</button>
          </form>
        </div>
      </div>

      <div className="viewbar">
        <div className="viewtoggle">
          <Link href="/">Diário de bordo</Link>
          <Link href="/aprovacoes">Aprovações</Link>
          <Link href="/agenda" className="on">Agenda do dia</Link>
        </div>
        <div className="seg-toggle">
          {["B2B", "B2C"].map((s) => (
            <Link key={s} href={`/agenda?seg=${s}`} className={seg === s ? "on" : ""}>{s}</Link>
          ))}
        </div>
      </div>

      {!dbReady() && <div className="card"><div className="cal-empty">Banco não configurado.</div></div>}

      {dbReady() && (
        <div className="dia-grid">
          {time.map((c) => {
            const itens = Object.entries(c.briefing?.items || {});
            const valor = itens.reduce((s, [id]) => s + (dealsById[id]?.amount || 0), 0);
            const st = c.briefing?.status;
            return (
              <div className={"dia-card" + (itens.length ? " st-" + st : " vazio")} key={c.id}>
                <div className="dia-head">
                  <span className="aprov-pfp">
                    {c.foto ? <img src={c.foto} alt={c.nome} /> : initials(c.nome)}
                  </span>
                  <div className="dia-quem">
                    <span className="dia-nome">{c.nome}</span>
                    <span className="dia-meta">
                      {itens.length
                        ? `${itens.length} negócio${itens.length === 1 ? "" : "s"} · ${brl(valor)}`
                        : "sem briefing hoje"}
                    </span>
                  </div>
                  {itens.length > 0 && <span className="plan-badge">{STATUS_LABEL[st]}</span>}
                </div>

                {itens.length > 0 && (
                  <div className="dia-itens">
                    {itens.map(([id, v]) => {
                      const n = dealsById[id];
                      if (!n) return null;
                      return (
                        <a
                          className={"dia-item v-" + (TEMP_STYLE[v.de] || "none")}
                          key={id}
                          href={dealUrl(id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className="dia-item-nome">{n.name}</span>
                          <span className="dia-item-evo">
                            <span className={"mini t-" + (TEMP_STYLE[v.de] || "none")}>{v.de || "—"}</span>
                            <span className="evo-seta">→</span>
                            <span className={"mini forte t-" + (TEMP_STYLE[v.para] || "none")}>
                              {v.para || "—"}
                            </span>
                            <span className="dia-item-val">{brl(n.amount)}</span>
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
