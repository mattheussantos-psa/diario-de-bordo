import { redirect } from "next/navigation";
import { auth, signOut } from "../auth";
import {
  getOwnerByEmail,
  getAllOwners,
  getOpenDeals,
  getTemperaturaOptions,
} from "../lib/hubspot";
import { CLOSER_PIPELINES, AVATARS } from "../lib/config";
import DealsTable from "./DealsTable";
import AdminBar from "./AdminBar";

export const dynamic = "force-dynamic";

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
  const seg = searchParams?.seg || "";

  let viewOwner = null;
  let owners = [];
  let deals = [];

  const tempOptions = await getTemperaturaOptions();

  if (isAdmin) {
    owners = await getAllOwners();
    const selId = searchParams?.closer || "";
    if (selId) {
      viewOwner = owners.find((o) => String(o.ownerId) === String(selId)) || null;
      if (viewOwner) deals = await getOpenDeals(viewOwner.ownerId, pipelinesForSeg(seg));
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
    deals = await getOpenDeals(viewOwner.ownerId, pipelinesForSeg(seg));
  }

  const rows = deals.map((d) => ({
    ...d,
    next: nextActivity(d.nextActivity),
    amountText: brl(d.amount),
    adv: /avanç/i.test(d.stageLabel),
  }));

  const segs = [...new Set(rows.map((d) => CLOSER_PIPELINES[d.pipeline]).filter(Boolean))];
  const segLabel = seg || (segs.length ? segs.join(" + ") : "—");
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
        <AdminBar owners={owners} selected={searchParams?.closer || ""} seg={seg} />
      ) : (
        <div className="bar">
          <div className="ctx"><span className="ctx-dot" />Segmento: {segLabel}</div>
        </div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="lab">Negócios ativos</div><div className="val">{rows.length}</div><div className="sub">{viewOwner ? `funil ${seg || "B2B + B2C"}` : "selecione um closer"}</div></div>
        <div className="kpi"><div className="lab">Atividades próximas</div><div className="val a">{hoje}</div><div className="sub">hoje ou nos próximos 3 dias</div></div>
        <div className="kpi"><div className="lab">Atrasadas</div><div className="val o">{atrasadas}</div><div className="sub">próxima atividade vencida</div></div>
        <div className="kpi"><div className="lab">Valor no funil</div><div className="val">{brl(valor)}</div><div className="sub">soma dos negócios abertos</div></div>
      </div>

      <DealsTable
        key={`${searchParams?.closer || "me"}-${seg || "all"}`}
        deals={rows}
        options={tempOptions}
        closerName={viewOwner ? viewOwner.name : ""}
        emptyLabel={isAdmin && !viewOwner ? "Selecione um closer acima para ver o diário." : "Nenhum negócio ativo no funil."}
      />
    </div>
  );
}
