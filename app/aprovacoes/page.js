import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "../../auth";
import { getAllOwners, getDealsByIds } from "../../lib/hubspot";
import { getWeekPlans, getPlansHistory, dbReady } from "../../lib/db";
import { weekKey, weekLabel } from "../../lib/week";
import { CLOSERS_BY_SEG, AVATARS } from "../../lib/config";
import { seedWeek } from "../../lib/seed";
import ApprovalCard from "../ApprovalCard";

export const dynamic = "force-dynamic";

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function Aprovacoes({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!session.user.isAdmin) redirect("/");

  const userName = session.user.name || session.user.email;
  const avatar = AVATARS[session.user.email.toLowerCase()];
  const week = weekKey();
  const filtro = searchParams?.st || "pendentes";

  // Popula cronogramas de demonstração e volta para a lista.
  if (searchParams?.simular === "1") {
    await seedWeek(week);
    redirect("/aprovacoes");
  }

  const [owners, plans] = await Promise.all([getAllOwners(), getWeekPlans(week)]);

  // Só closers cadastrados nos times B2B/B2C.
  const segOf = (id) =>
    Object.keys(CLOSERS_BY_SEG).find((s) => CLOSERS_BY_SEG[s].includes(String(id)));

  const nomeDe = {};
  for (const o of owners) nomeDe[String(o.ownerId)] = o.name;

  const todos = plans
    .filter((p) => segOf(p.ownerId))
    .map((p) => ({ ...p, nome: nomeDe[p.ownerId] || `Closer ${p.ownerId}`, seg: segOf(p.ownerId) }));

  const pendentes = todos.filter((p) => p.status === "enviado");
  const decididos = todos.filter((p) => p.status === "aprovado" || p.status === "reprovado");
  const isHistorico = filtro === "historico";
  const lista = isHistorico
    ? []
    : filtro === "todos"
    ? todos
    : filtro === "decididos"
    ? decididos
    : pendentes;

  // Histórico: semanas anteriores, agrupadas.
  const historico = isHistorico ? await getPlansHistory(week) : [];
  const porSemana = {};
  for (const h of historico) {
    if (!segOf(h.ownerId)) continue;
    (porSemana[h.week] ||= []).push({ ...h, nome: nomeDe[h.ownerId] || `Closer ${h.ownerId}` });
  }

  // Um único batch para todos os negócios citados nos planos exibidos.
  const ids = lista.flatMap((p) => Object.keys(p.items));
  const dealsById = ids.length ? await getDealsByIds(ids) : {};

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="logo" src="/logo-psa.png" alt="PSA" />
          <div className="divider" />
          <div>
            <div className="title">Aprovações</div>
            <div className="subtitle">Cronogramas da semana {weekLabel()} · {pendentes.length} aguardando</div>
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
          <Link href="/" className="">Diário de bordo</Link>
          <Link href="/aprovacoes" className="on">Aprovações{pendentes.length ? ` (${pendentes.length})` : ""}</Link>
          <Link href="/agenda">Agenda geral</Link>
        </div>
        <div className="seg-toggle">
          {[["pendentes", "Aguardando"], ["decididos", "Decididos"], ["todos", "Todos"], ["historico", "Histórico"]].map(([v, l]) => (
            <Link key={v} href={`/aprovacoes?st=${v}`} className={filtro === v ? "on" : ""}>{l}</Link>
          ))}
        </div>
      </div>

      {!dbReady() && <div className="card"><div className="cal-empty">Banco não configurado.</div></div>}

      {isHistorico && (
        Object.keys(porSemana).length === 0 ? (
          <div className="card"><div className="cal-empty">Ainda não há semanas anteriores registradas.</div></div>
        ) : (
          <div className="aprov-list">
            {Object.entries(porSemana).map(([sem, planos]) => (
              <div className="hist-bloco" key={sem}>
                <div className="hist-semana">Semana {sem.replace("-W", " · semana ")}</div>
                <div className="hist-linhas">
                  {planos.map((p) => (
                    <div className={"hist-linha st-" + p.status} key={p.ownerId + sem}>
                      <span className="hist-nome">{p.nome}</span>
                      <span className="hist-n">{p.negocios} negócio{p.negocios === 1 ? "" : "s"}</span>
                      <span className="plan-badge">{p.status === "aprovado" ? "Aprovado" : p.status === "reprovado" ? "Reprovado" : p.status === "enviado" ? "Não decidido" : "Rascunho"}</span>
                      {p.revisadoPor && <span className="hist-por">por {p.revisadoPor}</span>}
                      {p.motivo && <span className="hist-motivo">{p.motivo}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {!isHistorico && dbReady() && lista.length === 0 && (
        <div className="card">
          <div className="cal-empty">
            <p style={{ margin: "0 0 18px" }}>
              {filtro === "pendentes"
                ? "Nenhum cronograma aguardando aprovação nesta semana."
                : "Nada por aqui nesta semana."}
            </p>
            {todos.length === 0 && (
              <Link className="btn-primary" href="/aprovacoes?simular=1">
                Simular cronogramas dos closers
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="aprov-list">
        {lista.map((p) => (
          <ApprovalCard key={p.ownerId} plano={p} deals={dealsById} week={week} />
        ))}
      </div>
    </div>
  );
}
