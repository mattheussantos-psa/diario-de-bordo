import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "../../auth";
import { hsSearch, getOwnerNames } from "../../lib/hubspot";
import { NOME_CLOSER, dealUrl } from "../../lib/config";
import { ehGestor } from "../../lib/permissoes";

export const dynamic = "force-dynamic";

// Etapas do funil B2B. Os ids "closedwon"/"closedlost" são herança do pipeline
// padrão do HubSpot e hoje rotulam outra coisa — por isso o mapa é explícito.
const ETAPAS = {
  decisionmakerboughtin: "Reunião agendada / Qualificado",
  closedwon: "Proposta enviada | 1º Follow",
  closedlost: "Em negociação",
  1167445770: "Negociação avançada",
  1076664462: "Negócio fechado",
  1076664460: "Ganho / Contrato assinado",
  1076664461: "Perdido",
  1406850078: "Base de clientes",
};

// Fora da lista do dia por definição: já fecharam.
const FECHADAS = ["1076664462", "1076664460"];
const PERDIDA = "1076664461";

// Cada critério do B2B e a propriedade sem a qual ele não roda.
const CRITERIOS = [
  { prop: "notes_last_updated", titulo: "Sem última atividade", regra: "Critério 1 — tempo sem atividade" },
  { prop: "hs_latest_meeting_activity", titulo: "Sem reunião registrada", regra: "Critérios 2 e 3 — proposta no dia da reunião e FUP" },
  { prop: "data_de_envio_da_ultima_proposta", titulo: "Sem data de envio da proposta", regra: "Critérios 2 e 3 — proposta no dia da reunião e FUP" },
  { prop: "data_prevista_do_evento", titulo: "Sem data prevista do evento", regra: "Critério 5 — evento nos próximos 30 dias" },
  { prop: "budget", titulo: "Sem budget", regra: "Critério 7 — budget a partir de 30k" },
];

// Mês em horário de Brasília: o HubSpot só aceita timestamp em ms no filtro.
function limitesDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const ini = Date.UTC(ano, m - 1, 1, 3);
  const fim = Date.UTC(m === 12 ? ano + 1 : ano, m === 12 ? 0 : m, 1, 3);
  return [String(ini), String(fim)];
}

const mesAtual = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);

const mesLabel = (mes) => {
  const [ano, m] = mes.split("-");
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${nomes[Number(m) - 1]} de ${ano}`;
};

export default async function Preenchimento({ searchParams }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  // Diagnóstico de CRM: decisão de gestor, não tarefa do closer.
  if (!ehGestor(session.user)) redirect("/");

  const mes = /^\d{4}-\d{2}$/.test(searchParams?.mes || "") ? searchParams.mes : mesAtual();
  const [ini, fim] = limitesDoMes(mes);
  const comPerdidos = searchParams?.perdidos === "1";

  let deals = [];
  let erro = null;
  try {
    deals = await hsSearch(
      "deals",
      [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: "default" },
            { propertyName: "createdate", operator: "BETWEEN", value: ini, highValue: fim },
            { propertyName: "dealstage", operator: "NOT_IN", values: FECHADAS },
          ],
        },
      ],
      ["dealname", "dealstage", "hubspot_owner_id", ...CRITERIOS.map((c) => c.prop)]
    );
  } catch (e) {
    // Sem isto a tela mentiria "tudo preenchido" quando o HubSpot falhou.
    erro = e.message;
  }

  const visiveis = comPerdidos ? deals : deals.filter((d) => d.properties.dealstage !== PERDIDA);
  const perdidos = deals.filter((d) => d.properties.dealstage === PERDIDA).length;

  const semNome = [
    ...new Set(
      visiveis.map((d) => String(d.properties.hubspot_owner_id || "")).filter((id) => id && !NOME_CLOSER[id])
    ),
  ];
  const extras = semNome.length ? await getOwnerNames(semNome).catch(() => ({})) : {};
  const donoDe = (id) => NOME_CLOSER[String(id)] || extras[String(id)] || (id ? `Owner ${id}` : "sem dono");

  const blocos = CRITERIOS.map((c) => ({
    ...c,
    faltam: visiveis.filter((d) => !d.properties[c.prop]),
  }));

  // Um negócio conta uma vez aqui, mesmo que falte campo em vários critérios.
  const incompletos = visiveis.filter((d) => CRITERIOS.some((c) => !d.properties[c.prop])).length;

  return (
    <div className="wrap">
      <div className="top">
        <div className="brand">
          <img className="logo" src="/logo-psa.png" alt="PSA" />
          <div className="divider" />
          <div>
            <div className="title">Preenchimento</div>
            <div className="subtitle">Funil B2B · {mesLabel(mes)}</div>
          </div>
        </div>
      </div>

      <div className="viewbar">
        <div className="viewtoggle">
          <Link href="/">Diário de bordo</Link>
          <Link href="/agenda">Agenda do dia</Link>
          <Link href="/preenchimento" className="on">Preenchimento</Link>
        </div>
      </div>

      {erro && (
        <div className="card">
          <div className="foco-vazio">
            <h3>Não deu para consultar o HubSpot</h3>
            <p>{erro}</p>
          </div>
        </div>
      )}

      <div className="ctxbar">
        <span className="admin-tag">{mesLabel(mes)}</span>
        <span className="plan-badge">{visiveis.length} negócios na base</span>
        <span className="plan-motivo">
          {incompletos} com pelo menos um campo vazio · {visiveis.length - incompletos} completos
        </span>
        <Link className="btn-ghost" href={`/preenchimento?mes=${mes}&perdidos=${comPerdidos ? "0" : "1"}`}>
          {comPerdidos ? `Esconder perdidos (${perdidos})` : `Incluir perdidos (${perdidos})`}
        </Link>
      </div>

      <p className="fech-opcional">
        Negócios criados no mês, no funil B2B, fora das etapas “Negócio fechado” e “Ganho / Contrato assinado”.
        Cada bloco lista quem está sem a propriedade que o critério precisa para rodar.
      </p>

      {blocos.map((b) => (
        <details className="card" key={b.prop} open={b.faltam.length > 0 && b.faltam.length <= 60}>
          <summary className="planbar">
            <span className="plan-week">{b.titulo}</span>
            <span className={b.faltam.length ? "plan-badge" : "fech-ok"}>
              {b.faltam.length} de {visiveis.length}
              {visiveis.length ? ` · ${Math.round((b.faltam.length / visiveis.length) * 100)}% vazio` : ""}
            </span>
            <span className="plan-motivo">{b.regra}</span>
          </summary>

          {b.faltam.length === 0 ? (
            <div className="foco-vazio"><p>Todos preenchidos.</p></div>
          ) : (
            <div className="tscroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "52%" }}>Negócio</th>
                    <th style={{ width: "26%" }}>Etapa</th>
                    <th style={{ width: "22%" }}>Dono</th>
                  </tr>
                </thead>
                <tbody>
                  {b.faltam.map((d) => (
                    <tr key={d.id} className={d.properties.dealstage === PERDIDA ? "linha-perdida" : ""}>
                      <td className="deal">
                        <a className="deal-link" href={dealUrl(d.id)} target="_blank" rel="noreferrer">
                          {d.properties.dealname || `Negócio ${d.id}`}
                        </a>
                      </td>
                      <td>{ETAPAS[d.properties.dealstage] || d.properties.dealstage}</td>
                      <td>{donoDe(d.properties.hubspot_owner_id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
