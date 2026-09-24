// Lista do dia do closer: negócios abertos onde ele é proprietário no HubSpot.
// Mesma mecânica da carteira do farmer (ver lib/carteira.js) — grupos com cota,
// cascata quando um grupo seca, descanso depois de atuar e lista congelada no
// dia. Aqui não há rede: recebe os negócios já lidos e devolve a lista, para a
// regra poder ser conferida sem depender do CRM.
//
// A diferença é o que define o grupo. No farmer é o tempo desde a última
// contratação; aqui são os sete critérios do B2B, cada um com sua fila.

// Com extensão: o check roda no Node puro, que não resolve import sem ela.
import { diasEntre } from "./carteira.js";

export const NEGOCIOS_DO_DIA = 10;

// Janelas, em dias.
export const LIMITE_DIAS = {
  semAtividade: 7, // critério 1
  fup: 7, // critério 3 — a janela de follow-up conta a partir da reunião
  evento: 30, // critério 5
};

export const LIMITE_MESES = { ultimaCompra: 18 }; // critério 6

// Faixas de budget a partir de 30k. O valor guardado no HubSpot não bate com o
// rótulo exibido (o valor "21k à 40k" aparece como "21k à 30k"), e é o rótulo
// que forma a escala correta — por isso a lista é de valores internos, apurada
// nas opções reais da propriedade.
export const BUDGET_ALTO = ["31k à 40k", "41k à 60k", "51k à 60k", "61k à 80k", "71k à 80k", "+ de 80k"];

// Os grupos, na ordem de prioridade: o primeiro que casar leva o negócio.
// Um negócio ocupa uma vaga só, senão o mesmo card come três das dez.
export const GRUPOS = {
  proposta_hoje: { label: "Proposta de hoje", motivo: "reunião foi hoje e a proposta não saiu" },
  fup: { label: "FUP da proposta", motivo: "reunião há até 7 dias, follow-up pendente" },
  evento_30d: { label: "Evento em 30 dias", motivo: "data prevista do evento está chegando" },
  sem_atividade: { label: "Parado", motivo: "mais de 7 dias sem nenhuma atividade" },
  compra_18m: { label: "Cliente recente", motivo: "a empresa comprou nos últimos 18 meses" },
  budget_alto: { label: "Budget alto", motivo: "budget a partir de 30k" },
};

// Somam os 10 do dia. Concentra onde há volume, como no farmer: "proposta de
// hoje" é fila pequena por natureza — só entra quem teve reunião hoje.
export const COTA_DIARIA = {
  proposta_hoje: 1,
  fup: 2,
  evento_30d: 2,
  sem_atividade: 3,
  compra_18m: 1,
  budget_alto: 1,
};

// Grupo seco não encolhe o dia: as vagas sobram para os outros, nesta ordem.
const CASCATA = ["sem_atividade", "fup", "evento_30d", "compra_18m", "budget_alto", "proposta_hoje"];

// Quantos dias o negócio descansa antes de voltar à lista.
// "efetivo" descansa 7, não 30 como no farmer: aqui o próprio critério 3 manda
// fazer follow-up em até 7 dias — dormir um mês contrariaria a regra do dia.
export const COOLDOWN_POR_RESULTADO = {
  nao_atuei: 1,
  tentativa: 3,
  efetivo: 7,
};
export const COOLDOWN_SEM_RESULTADO = 1;

const menosMeses = (iso, meses) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString().slice(0, 10);
};
const maisDias = (iso, dias) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

// Em que grupo o negócio cai. Datas chegam como YYYY-MM-DD: a ordem alfabética
// é a cronológica, então dá para comparar como texto.
//   n: { reuniaoEm, propostaEm, eventoEm, ultimaAtividade, budget, ultimaCompra }
export function classifica(n, hoje) {
  if (n.reuniaoEm === hoje && n.propostaEm !== hoje) return "proposta_hoje";

  if (n.reuniaoEm) {
    const dias = diasEntre(n.reuniaoEm, hoje);
    // Dentro da janela de follow-up e sem proposta enviada depois da reunião.
    if (dias > 0 && dias <= LIMITE_DIAS.fup && !(n.propostaEm && n.propostaEm >= n.reuniaoEm)) {
      return "fup";
    }
  }

  if (n.eventoEm && n.eventoEm >= hoje && n.eventoEm <= maisDias(hoje, LIMITE_DIAS.evento)) {
    return "evento_30d";
  }

  // Negócio sem nenhuma atividade registrada conta como parado: não ter registro
  // é justamente o caso que precisa aparecer.
  if (!n.ultimaAtividade || diasEntre(n.ultimaAtividade, hoje) > LIMITE_DIAS.semAtividade) {
    return "sem_atividade";
  }

  if (n.ultimaCompra && n.ultimaCompra > menosMeses(hoje, LIMITE_MESES.ultimaCompra)) {
    return "compra_18m";
  }

  if (BUDGET_ALTO.includes(n.budget)) return "budget_alto";

  return null;
}

export function emDescanso(hist, hoje) {
  if (!hist?.ultimaData) return false;
  const exigido = hist.ultimoResultado
    ? COOLDOWN_POR_RESULTADO[hist.ultimoResultado] ?? COOLDOWN_SEM_RESULTADO
    : COOLDOWN_SEM_RESULTADO;
  return diasEntre(hist.ultimaData, hoje) < exigido;
}

// Ordem dentro do grupo: o mais urgente primeiro.
function ordena(grupo, a, b) {
  if (grupo === "evento_30d") return (a.eventoEm ?? "").localeCompare(b.eventoEm ?? "");
  if (grupo === "fup" || grupo === "proposta_hoje") {
    // Reunião mais antiga primeiro: é a que está mais perto de esfriar.
    return (a.reuniaoEm ?? "").localeCompare(b.reuniaoEm ?? "");
  }
  if (grupo === "compra_18m") {
    // Compra mais recente primeiro: cliente quente vale mais que cliente morno.
    return (b.ultimaCompra ?? "").localeCompare(a.ultimaCompra ?? "");
  }
  if (grupo === "budget_alto") return (b.amount ?? 0) - (a.amount ?? 0);
  // Parado: quem está parado há mais tempo primeiro.
  return (a.ultimaAtividade ?? "").localeCompare(b.ultimaAtividade ?? "");
}

// A lista do dia: 10 negócios.
//   negocios: [{ id, nome, amount, reuniaoEm, propostaEm, eventoEm, ultimaAtividade, budget, ultimaCompra }]
//   historico: Map id -> { ultimaData, ultimoResultado }
export function montaListaDoDia(negocios, hoje, historico = new Map()) {
  const comGrupo = negocios
    .map((n) => ({ ...n, grupo: classifica(n, hoje) }))
    .filter((n) => n.grupo);

  const disponiveis = comGrupo.filter((n) => !emDescanso(historico.get(String(n.id)), hoje));

  const pools = {};
  for (const g of Object.keys(GRUPOS)) {
    pools[g] = disponiveis.filter((n) => n.grupo === g).sort((x, y) => ordena(g, x, y));
  }

  const escolhidos = [];
  const usados = new Set();
  const puxa = (grupo, quantidade) => {
    let pegos = 0;
    for (const n of pools[grupo] || []) {
      if (pegos >= quantidade) break;
      if (usados.has(n.id)) continue;
      usados.add(n.id);
      escolhidos.push(n);
      pegos++;
    }
    return pegos;
  };

  for (const grupo of Object.keys(GRUPOS)) puxa(grupo, COTA_DIARIA[grupo]);

  for (const grupo of CASCATA) {
    const falta = NEGOCIOS_DO_DIA - escolhidos.length;
    if (falta <= 0) break;
    puxa(grupo, falta);
  }

  return escolhidos;
}
