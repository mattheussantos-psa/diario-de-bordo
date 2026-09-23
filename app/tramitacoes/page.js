import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "../../auth";
import { getTicketsCS, getOwnerByEmail, getOwnerNames } from "../../lib/hubspot";
import { getTramitacoes, dbReady } from "../../lib/db";
import { dayKey, dayLabel } from "../../lib/week";
import { NOME_CLOSER } from "../../lib/config";
import { ehGestor, podeVerTramitacoes } from "../../lib/permissoes";
import { PIPELINE_CS, pendenciasDoTicket, TIPOS } from "../../lib/tramitacoes";
import TramitacaoCard from "../TramitacaoCard";

export const dynamic = "force-dynamic";

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default async function Tramitacoes({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const userName = session.user.name || session.user.email;
  const gestor = ehGestor(session.user);
  const hoje = dayKey();
  const filtro = searchParams?.f || "abertas";

  // Tramitação é trabalho do time de CS. Resolve o owner antes de qualquer
  // chamada pesada: sem permissão, a pessoa nem chega a consultar o HubSpot.
  let meuOwnerId = null;
  if (!session.user.isAdmin) {
    const owner = await getOwnerByEmail(session.user.email.toLowerCase()).catch(() => null);
    meuOwnerId = owner ? String(owner.ownerId) : null;
  }
  if (!podeVerTramitacoes(session.user, meuOwnerId)) redirect("/");

  let tickets = [];
  let erro = null;
  try {
    tickets = await getTicketsCS(PIPELINE_CS);
  } catch (e) {
    console.error("[tramitacoes] falha ao buscar tickets:", e);
    erro = e;
  }

  // Quem não é gestor vê só o que é dele.
  if (!gestor) tickets = tickets.filter((t) => String(t.ownerId) === meuOwnerId);

  const registros = await getTramitacoes(tickets.map((t) => t.id));

  const todas = tickets.flatMap((t) => pendenciasDoTicket(t, hoje, registros));
  const abertas = todas.filter((p) => p.status !== "aguardando");
  const aguardando = todas.filter((p) => p.status === "aguardando");
  const lista = filtro === "aguardando" ? aguardando : filtro === "todas" ? todas : abertas;

  // Nome do dono só para quem aparece na tela, e só se não estiver no cadastro.
  const donos = [...new Set(lista.map((p) => tickets.find((t) => t.id === p.ticketId)?.ownerId).filter(Boolean))];
  const faltamNome = donos.filter((id) => !NOME_CLOSER[id]);
  const nomesHub = faltamNome.length ? await getOwnerNames(faltamNome).catch(() => ({})) : {};
  const ticketsById = Object.fromEntries(
    tickets.map((t) => [t.id, { ...t, donoNome: NOME_CLOSER[t.ownerId] || nomesHub[t.ownerId] || "" }])
  );

  const atrasadas = todas.filter((p) => p.atrasada && p.status !== "aguardando").length;

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="logo" src="/logo-psa.png" alt="PSA" />
          <div className="divider" />
          <div>
            <div className="title">Tramitações</div>
            <div className="subtitle">
              Pendências de CS · {dayLabel(hoje)}
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
          {gestor && <Link href="/aprovacoes">Aprovações</Link>}
          {gestor && <Link href="/agenda">Agenda geral</Link>}
          {gestor && <Link href="/evolucao">Evolução</Link>}
          <Link href="/tramitacoes" className="on">
            Tramitações{abertas.length ? ` (${abertas.length})` : ""}
          </Link>
        </div>
        <div className="seg-toggle">
          {[["abertas", `A fazer (${abertas.length})`], ["aguardando", `Aguardando líder (${aguardando.length})`], ["todas", "Todas"]].map(
            ([v, l]) => (
              <Link key={v} href={`/tramitacoes?f=${v}`} className={filtro === v ? "on" : ""}>{l}</Link>
            )
          )}
        </div>
      </div>

      {erro && (
        <div className="card">
          <div className="cal-empty">
            Não foi possível ler os tickets do HubSpot agora. Atualize em alguns instantes.
          </div>
        </div>
      )}

      {!dbReady() && <div className="card"><div className="cal-empty">Banco não configurado.</div></div>}

      {!erro && (
        <div className="kpis">
          <div className="kpi">
            <div className="lab">A fazer</div>
            <div className="val">{abertas.length}</div>
            <div className="sub">pendências na janela de prazo</div>
          </div>
          <div className="kpi">
            <div className="lab">Atrasadas</div>
            <div className="val o">{atrasadas}</div>
            <div className="sub">prazo já vencido</div>
          </div>
          <div className="kpi">
            <div className="lab">Aguardando líder</div>
            <div className="val a">{aguardando.length}</div>
            <div className="sub">marcadas, esperando confirmação</div>
          </div>
          <div className="kpi">
            <div className="lab">Tickets no funil</div>
            <div className="val">{tickets.length}</div>
            <div className="sub">{gestor ? "CS inteiro" : "seus tickets"}</div>
          </div>
        </div>
      )}

      {!erro && lista.length === 0 ? (
        <div className="card">
          <div className="cal-empty">
            {filtro === "abertas"
              ? "Nenhuma pendência dentro do prazo hoje."
              : filtro === "aguardando"
              ? "Nada esperando confirmação do líder."
              : "Nenhuma tramitação para mostrar."}
          </div>
        </div>
      ) : (
        <div className="tram-grid">
          {lista.map((p) => (
            <TramitacaoCard
              key={p.ticketId + p.tipo}
              p={p}
              ticket={ticketsById[p.ticketId]}
              ehGestor={gestor}
            />
          ))}
        </div>
      )}

      <div className="evo-nota">
        <b>Os prazos.</b> {TIPOS.minuta.label}: 1 dia útil após o onboarding. {TIPOS.assinatura.label}:
        20 dias após o onboarding, entrando na lista faltando 5. {TIPOS.checklist.label}: 2 dias
        antes do evento. A baixa é em duas mãos — quem executa marca, o líder confirma. Devolver
        traz a pendência de volta com o prazo original, então vencida volta vencida. Contrato com
        status <b>Assinado</b> baixa a assinatura e a minuta sozinho.
      </div>
    </div>
  );
}
