import { redirect } from "next/navigation";
import { auth, signOut } from "../auth";
import {
  getOwnerByEmail,
  getOpenDeals,
  getTemperaturaOptions,
} from "../lib/hubspot";
import { fotoDe, dealUrl, CLOSERS_BY_SEG, CLOSER_PIPELINES, CLOSERS, SEG_CLOSER } from "../lib/config";
import DealsTable from "./DealsTable";
import AdminBar from "./AdminBar";
import Link from "next/link";
import { getBriefing, getDayBriefings, dbReady } from "../lib/db";
import { dayKey, dayLabel } from "../lib/week";
import { formatNextActivity } from "../lib/activity";

export const dynamic = "force-dynamic";

// Segmento a que o closer pertence (B2B/B2C), pelo cadastro dos times.
function segOf(ownerId) {
  return SEG_CLOSER[String(ownerId)];
}

function pipelinesForSeg(seg) {
  if (seg === "B2B") return ["default"];
  if (seg === "B2C") return ["725182862"];
  return Object.keys(CLOSER_PIPELINES);
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function brl(n) {
  if (n == null) return "—";
  return "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

// Aviso claro quando a API do HubSpot recusa (cota diária é o caso mais comum).
function ErroHubspot({ erro }) {
  const cota = /429|daily limit/i.test(String(erro?.message || ""));
  return (
    <div className="empty">
      <h2>{cota ? "Limite diário do HubSpot atingido" : "HubSpot indisponível"}</h2>
      <p>
        {cota
          ? "A conta atingiu o limite de chamadas à API do HubSpot por hoje. Os dados voltam assim que a cota renovar (no início do próximo dia)."
          : "Não foi possível falar com o HubSpot agora. Tente novamente em alguns minutos."}
      </p>
    </div>
  );
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

  // Falha do HubSpot (cota diária, indisponibilidade) vira aviso, não tela de erro.
  let erroHubspot = null;
  let tempOptions = [];
  try {
    tempOptions = await getTemperaturaOptions();
  } catch (e) {
    erroHubspot = e;
  }

  if (isAdmin) {
    // Lista fixa dos closers do segmento (evita varrer os owners do HubSpot).
    owners = CLOSERS[seg].map((c) => ({ ownerId: c.id, name: c.nome }));
    const selId = searchParams?.closer || "";
    // Seleção que não pertence ao segmento é descartada.
    if (selId && owners.some((o) => String(o.ownerId) === String(selId))) {
      const sel = owners.find((o) => String(o.ownerId) === String(selId));
      viewOwner = { ownerId: sel.ownerId, name: sel.name };
      try {
        deals = await getOpenDeals(viewOwner.ownerId, pipelinesForSeg(seg));
      } catch (e) {
        erroHubspot = e;
      }
    }
  } else {
    try {
      viewOwner = await getOwnerByEmail(email);
    } catch (e) {
      erroHubspot = e;
    }
    if (!viewOwner && erroHubspot) {
      return <ErroHubspot erro={erroHubspot} />;
    }
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
    try {
      deals = await getOpenDeals(viewOwner.ownerId, pipelinesForSeg(seg));
    } catch (e) {
      erroHubspot = e;
    }
  }

  if (erroHubspot && deals.length === 0) return <ErroHubspot erro={erroHubspot} />;

  const dia = dayKey();
  const briefing = viewOwner ? await getBriefing(viewOwner.ownerId, dia) : null;
  const pendentes = isAdmin
    ? (await getDayBriefings(dia)).filter((b) => b.status === "enviado").length
    : 0;

  const rows = deals.map((d) => ({
    ...d,
    next: formatNextActivity(d.nextActivity),
    amountText: brl(d.amount),
    adv: /avanç/i.test(d.stageLabel),
    url: dealUrl(d.id),
  }));

  const hoje = rows.filter((d) => d.next.pill?.cls === "today").length;
  const atrasadas = rows.filter((d) => d.next.pill?.cls === "late").length;
  const valor = rows.reduce((s, d) => s + (d.amount || 0), 0);
  // Foto do closer logado; admin sem funil próprio cai nas iniciais.
  const avatar = !isAdmin && viewOwner ? fotoDe(viewOwner.ownerId) : null;

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
              <Link href="/agenda">Agenda geral</Link>
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

            <DealsTable

        deals={rows}
        options={tempOptions}
        closerName={viewOwner ? viewOwner.name : ""}
        emptyLabel={isAdmin && !viewOwner ? "Selecione um closer acima para ver o diário." : "Nenhum negócio ativo no funil."}
        briefing={briefing}
        ctx={{
          ownerId: viewOwner ? String(viewOwner.ownerId) : "",
          dia,
          diaLabel: dayLabel(dia),
          isAdmin,
          dbReady: dbReady(),
        }}
      />
    </div>
  );
}
