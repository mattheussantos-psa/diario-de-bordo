import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "../../auth";
import { getDealsByIds } from "../../lib/hubspot";
import { getBriefingsForDays, dbReady } from "../../lib/db";
import { weekLabel, weekDays, DIAS } from "../../lib/week";
import { CLOSERS_BY_SEG, AVATARS, TEMP_STYLE, dealUrl, NOME_CLOSER } from "../../lib/config";

export const dynamic = "force-dynamic";

const DIA_LONGO = ["SEG.", "TER.", "QUA.", "QUI.", "SEX."];

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
const brl = (n) => (n == null ? "" : "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

export default async function AgendaGeral({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!session.user.isAdmin) redirect("/");

  const userName = session.user.name || session.user.email;
  const avatar = AVATARS[session.user.email.toLowerCase()];
  const dias = weekDays();
  const seg = searchParams?.seg === "B2C" ? "B2C" : "B2B";

  const plans = await getBriefingsForDays(dias);
  const nomeDe = NOME_CLOSER;

  // Só os closers do segmento escolhido, na ordem cadastrada.
  const doSeg = CLOSERS_BY_SEG[seg];
  const planos = plans.filter(
    (p) => doSeg.includes(String(p.ownerId)) && Object.keys(p.items).length
  );

  const ids = planos.flatMap((p) => Object.keys(p.items));
  const dealsById = ids.length ? await getDealsByIds(ids) : {};

  // Cada briefing já pertence a um dia; agrupa por data.
  const porDia = {};
  for (const d of dias) porDia[d] = [];
  for (const p of planos) {
    const nome = nomeDe[p.ownerId] || `Closer ${p.ownerId}`;
    for (const [dealId, v] of Object.entries(p.items)) {
      const negocio = dealsById[dealId];
      if (!negocio) continue;
      (porDia[p.dia] ||= []).push({ closer: nome, status: p.status, evo: v, ...negocio });
    }
  }


  const hojeStr = new Date().toDateString();
  const totalNeg = ids.length;

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="logo" src="/logo-psa.png" alt="PSA" />
          <div className="divider" />
          <div>
            <div className="title">Agenda geral</div>
            <div className="subtitle">
              Semana {weekLabel()} · {totalNeg} negócio{totalNeg === 1 ? "" : "s"} nos briefings
            </div>
          </div>
        </div>
        <div className="who">
          <div className="pfp">{avatar ? <img src={avatar} alt={userName} /> : initials(userName)}</div>
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
          <Link href="/agenda" className="on">Agenda geral</Link>
        </div>
        <div className="seg-toggle">
          {["B2B", "B2C"].map((s) => (
            <Link key={s} href={`/agenda?seg=${s}`} className={seg === s ? "on" : ""}>{s}</Link>
          ))}
        </div>
      </div>

      {!dbReady() && <div className="card"><div className="cal-empty">Banco não configurado.</div></div>}

      {dbReady() && planos.length === 0 && (
        <div className="card"><div className="cal-empty">Nenhum briefing registrado nesta semana no {seg}.</div></div>
      )}

      {planos.length > 0 && (
        <div className="card">
          <div className="cal-grid">
            {DIAS.map((d, i) => {
              const data = new Date(dias[i] + "T12:00:00");
              const isHoje = data.toDateString() === hojeStr;
              const lista = porDia[dias[i]] || [];
              return (
                <div className={"cal-col" + (isHoje ? " hoje" : "")} key={dias[i]}>
                  <div className="cal-head">
                    <span className="cal-dow">{DIA_LONGO[i]}</span>
                    <span className={"cal-day" + (isHoje ? " badge" : "")}>{data.getDate()}</span>
                    <span className="cal-qtd">{lista.length} negócio{lista.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="cal-body">
                    {lista.length === 0 && <div className="cal-vazio">—</div>}
                    {lista.map((n, k) => (
                      <a
                        className={"cal-card v-" + (TEMP_STYLE[n.temperatura] || "none")}
                        key={n.id + "-" + k}
                        href={dealUrl(n.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="cal-closer">{n.closer}</span>
                        <span className="cal-nome">{n.name}</span>
                        <span className="cal-meta">{brl(n.amount)}</span>
                        {n.evo?.para && (
                          <span className="cal-evo">{n.evo.de || "—"} → <b>{n.evo.para}</b></span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}
    </div>
  );
}
