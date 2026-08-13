import { redirect } from "next/navigation";
import { auth, signOut } from "../auth";
import {
  getOwnerByEmail,
  getAllOwners,
  getOpenDeals,
  getTemperaturaOptions,
} from "../lib/hubspot";
import { AVATARS, dealUrl, CLOSERS_BY_SEG, CLOSER_PIPELINES } from "../lib/config";
import DealsTable from "./DealsTable";
import CalendarView from "./CalendarView";
import AdminBar from "./AdminBar";
import Link from "next/link";
import { getPlan, getWeekPlans, dbReady } from "../lib/db";
import { weekKey, weekLabel } from "../lib/week";

export const dynamic = "force-dynamic";

// Segmento a que o closer pertence (B2B/B2C), pelo cadastro dos times.
function segOf(ownerId) {
  return Object.keys(CLOSERS_BY_SEG).find((s) =>
    CLOSERS_BY_SEG[s].includes(String(ownerId))
  );
}

function pipelinesForSeg(seg) {
  if (seg === "B2B") return ["default"];
  if (seg === "B2C") return ["725182862"];
  return Object.keys(CLOSER_PIPELINES);
}

// Formata a próxima atividade em rótulo + urgência.
function nextActivity(ts) {
  if (!ts) return { dateText: "Sem atividade", none: true };
  const d = /^\d+$/.test(String(ts)) ? new Date(Number(ts)) : new Date(ts);
  if (isNaN(d)) return { dateText: "Sem atividade", none: true };
  const dateText = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const now = new Date();
  const day = 86400000;
  const diff = Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / day
  );
  if (diff < 0) return { dateText, pill: { cls: "late", text: "atrasada" } };
  if (diff === 0) return { dateText, pill: { cls: "today", text: "hoje" } };
  if (diff <= 3) return { dateText, pill: { cls: "today", text: `em ${diff}d` } };
  return { dateText };
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function brl(n) {
  if (n == null) return "—";
  return "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export default async function Page({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const email = session.user.email.toLowerCase();
  const userName = session.user.name || email;
  const isAdmin = !!session.user.isAdmin;
  // Sempre um segmento ativo: B2B é o padrão ao abrir o painel.
  let seg = searchParams?.seg === "B2C" ? "B2C" : "B2B";

  let viewOwner = null;
  let owners = [];
  let deals = [];

  const tempOptions = await getTemperaturaOptions();

  if (isAdmin) {
    owners = await getAllOwners();
    // Com um segmento selecionado, lista só os closers daquele time.
    const allowed = CLOSERS_BY_SEG[seg];
    if (allowed) {
      owners = allowed
        .map((id) => owners.find((o) => String(o.ownerId) === id))
        .filter(Boolean);
    }
    const selId = searchParams?.closer || "";
    // Seleção que não pertence ao segmento é descartada.
    if (selId && owners.some((o) => String(o.ownerId) === String(selId))) {
      viewOwner = owners.find((o) => String(o.ownerId) === String(selId));
      deals = await getOpenDeals(viewOwner.ownerId, pipelinesForSeg(seg));
    }
  } else {
    viewOwner = await getOwnerByEmail(email);
    if (!viewOwner) {
      return (
        <div className="empty">
          <h2>Sem cadastro no HubSpot</h2>
          <p>O e-mail <b>{email}</b> não está vinculado a nenhum closer no HubSpot. Fale com o RevOps.</p>
        </div>
      );
    }
    // O segmento do closer vem do time dele, não da URL.
    seg = segOf(viewOwner.ownerId) || seg;
    deals = await getOpenDeals(viewOwner.ownerId, pipelinesForSeg(seg));
  }

  const week = weekKey();
  const plan = viewOwner ? await getPlan(viewOwner.ownerId, week) : null;
  const isAgenda = searchParams?.view === "agenda";
  const pendentes = isAdmin
    ? (await getWeekPlans(week)).filter((p) => p.status === "enviado").length
    : 0;

  // Mantém closer/segmento ao alternar a visualização.
  const qs = (patch) => {
    const p = new URLSearchParams();
    if (searchParams?.closer) p.set("closer", searchParams.closer);
    p.set("seg", seg);
    for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k);
    return "/?" + p.toString();
  };

  const rows = deals.map((d) => ({
    ...d,
    next: nextActivity(d.nextActivity),
    amountText: brl(d.amount),
    adv: /avanç/i.test(d.stageLabel),
    url: dealUrl(d.id),
  }));

  const hoje = rows.filter((d) => d.next.pill?.cls === "today").length;
  const atrasadas = rows.filter((d) => d.next.pill?.cls === "late").length;
  const valor = rows.reduce((s, d) => s + (d.amount || 0), 0);
  const avatar = AVATARS[email];

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="logo" src="/logo-psa.png" alt="PSA" />
          <div className="divider" />
          <div>
            <div className="title">Diário de Bordo</div>
            <div className="subtitle">Negócios ativos no funil · sincronizado com o HubSpot</div>
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

      {isAdmin ? (
        <>
          <div className="viewbar">
            <div className="viewtoggle">
              <Link href="/" className="on">Diário de bordo</Link>
              <Link href="/aprovacoes">
                Aprovações{pendentes > 0 ? ` (${pendentes})` : ""}
              </Link>
            </div>
          </div>
          <AdminBar owners={owners} selected={viewOwner ? String(viewOwner.ownerId) : ""} seg={seg} />
        </>
      ) : (
        <div className="bar">
          <div className="ctx"><span className="ctx-dot" />Segmento: {seg}</div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="lab">Negócios ativos</div><div className="val">{rows.length}</div><div className="sub">{viewOwner ? `funil ${seg}` : "selecione um closer"}</div></div>
        <div className="kpi"><div className="lab">Atividades próximas</div><div className="val a">{hoje}</div><div className="sub">hoje ou nos próximos 3 dias</div></div>
        <div className="kpi"><div className="lab">Atrasadas</div><div className="val o">{atrasadas}</div><div className="sub">próxima atividade vencida</div></div>
        <div className="kpi"><div className="lab">Valor no funil</div><div className="val">{brl(valor)}</div><div className="sub">soma dos negócios abertos</div></div>
      </div>

      {viewOwner && (
        <div className="viewbar">
          <div className="viewtoggle">
            <Link href={qs({ view: "" })} className={isAgenda ? "" : "on"}>Tabela</Link>
            <Link href={qs({ view: "agenda" })} className={isAgenda ? "on" : ""}>Agenda da semana</Link>
          </div>
          {isAgenda && <span className="viewbar-week">Semana {weekLabel()}</span>}
        </div>
      )}

      {isAgenda ? (
        <CalendarView
          rows={rows}
          items={plan?.items || {}}
          emptyLabel="Nenhum negócio marcado no plano desta semana."
        />
      ) : (
      <DealsTable
        key={`${searchParams?.closer || "me"}-${seg || "all"}`}
        deals={rows}
        options={tempOptions}
        closerName={viewOwner ? viewOwner.name : ""}
        emptyLabel={isAdmin && !viewOwner ? "Selecione um closer acima para ver o diário." : "Nenhum negócio ativo no funil."}
        plan={plan}
        planCtx={{
          ownerId: viewOwner ? String(viewOwner.ownerId) : "",
          week,
          weekLabel: weekLabel(),
          isAdmin,
          dbReady: dbReady(),
        }}
      />
      )}
    </div>
  );
}
