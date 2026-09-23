// Pendências de tramitação calculadas das datas do ticket no HubSpot.
// Nada aqui toca rede: recebe o ticket já lido e devolve o que está pendente,
// para a regra poder ser conferida sem depender do CRM.

export const PIPELINE_CS = "748675953";

// Como a tramitação evoluiu no dia. "Travado" exige explicação: é o que mostra
// ao líder o que depende de terceiro — cliente, jurídico, palestrante — e não
// de esforço do farmer.
export const RESULTADOS_TRAMITACAO = [
  { key: "resolvi", label: "Resolvi", cls: "ok" },
  { key: "avancei", label: "Avancei", cls: "meio" },
  { key: "travado", label: "Travado", cls: "nao" },
];
export const TRAMITACAO_EXIGE_OBSERVACAO = ["travado"];

// Etapas por lista fechada, não por exclusão: listar o que entra evita que uma
// etapa nova do funil comece a cobrar o farmer sem ninguém decidir isso.
export const ETAPAS_TICKET = {
  "1088360203": "Etapa de conferência",
  "1088360204": "Iniciar trâmites",
  "1088360205": "Em andamento",
  "1088361911": "Pagamento pós-palestra",
  "1333136740": "Aguardando NF palestrante",
};

// Evento contratado em execução — é o que conta como "ticket ativo".
export const ETAPAS_ATIVAS = Object.keys(ETAPAS_TICKET);

// Depois do evento o palestrante já subiu ao palco: minuta, assinatura e
// checklist não fazem mais sentido. O ticket segue aberto para o CS acertar
// nota e pagamento, trabalho que não é do farmer.
export const ETAPAS_POS_EVENTO = ["1088361911", "1333136740"];

// Onde o farmer ainda tem tramitação a fazer.
export const ETAPAS_TRAMITACAO = ETAPAS_ATIVAS.filter((e) => !ETAPAS_POS_EVENTO.includes(e));

export const TIPOS = {
  minuta: {
    label: "Enviar minuta contratual",
    // 1 dia útil após a realização do onboarding.
    prazo: (t) => (t.onboarding ? somaDiasUteis(t.onboarding, 1) : null),
    // Entra assim que o onboarding acontece. Contar a partir do prazo faria a
    // minuta de uma sexta só aparecer na segunda, o próprio dia de vencer.
    desde: (t) => (t.onboarding ? somaDias(t.onboarding, 0) : null),
  },
  assinatura: {
    label: "Assinatura do contrato",
    // 20 dias corridos após o onboarding.
    prazo: (t) => (t.onboarding ? somaDias(t.onboarding, 20) : null),
    // Regra do processo: só entra na lista faltando 5 dias.
    antecedencia: 5,
  },
  checklist: {
    label: "Checklist do evento",
    // 2 dias antes do evento.
    prazo: (t) => (t.evento ? somaDias(t.evento, -2) : null),
    // ponytail: 2 dias de antecedência é escolha nossa, não veio do processo.
    antecedencia: 2,
  },
};

const DIA = 86400000;
const asDate = (s) => (s instanceof Date ? new Date(s) : new Date(String(s).slice(0, 10) + "T12:00:00"));
const chave = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function somaDias(data, n) {
  const d = asDate(data);
  d.setDate(d.getDate() + n);
  return chave(d);
}

// Sábado e domingo não contam. Usado no prazo da minuta, que é em dia útil.
export function somaDiasUteis(data, n) {
  const d = asDate(data);
  let faltam = n;
  while (faltam > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) faltam--;
  }
  return chave(d);
}

export const diasEntre = (de, ate) => Math.round((asDate(ate) - asDate(de)) / DIA);

// Pendências visíveis de um ticket hoje, já cruzadas com o que foi marcado.
// registro: { status, marcadoPor, decididoPor, motivo } vindo do banco.
export function pendenciasDoTicket(ticket, hoje, registros = {}) {
  const out = [];
  // Contrato assinado baixa a assinatura e, com ela, a minuta: não faz sentido
  // cobrar o envio de uma minuta que já virou contrato assinado.
  const assinado = ticket.statusContrato === "Assinado";

  for (const [tipo, regra] of Object.entries(TIPOS)) {
    const prazo = regra.prazo(ticket);
    if (!prazo) continue;

    const reg = registros[`${ticket.id}|${tipo}`] || null;
    if (reg?.status === "confirmado") continue; // já baixada pelo líder

    if (assinado && (tipo === "assinatura" || tipo === "minuta")) continue;

    // A partir de quando a pendência é problema de hoje: uma data própria
    // (minuta) ou a antecedência contada do prazo.
    const desde = regra.desde ? regra.desde(ticket) : somaDias(prazo, -regra.antecedencia);
    if (!desde || diasEntre(hoje, desde) > 0) continue;

    const faltam = diasEntre(hoje, prazo);

    out.push({
      ticketId: ticket.id,
      tipo,
      label: regra.label,
      prazo,
      faltam,
      atrasada: faltam < 0,
      // O ticket segue aberto, mas o evento já passou: a ação perdeu a hora e
      // não pode disputar atenção com o que ainda dá para resolver.
      eventoPassado: !!ticket.evento && diasEntre(hoje, ticket.evento) < 0,
      // Devolvida pelo líder volta com o prazo original: vencida volta vencida.
      status: reg?.status || "aberta",
      marcadoPor: reg?.marcadoPor || "",
      decididoPor: reg?.decididoPor || "",
      motivo: reg?.motivo || "",
    });
  }

  // Mais urgente primeiro.
  return out.sort((a, b) => a.faltam - b.faltam);
}

// Ordena por urgência e agrupa por dono, para a tela do líder.
export function agrupaPorDono(pendencias, ticketsById) {
  const porDono = {};
  for (const p of pendencias) {
    const dono = ticketsById[p.ticketId]?.ownerId || "sem-dono";
    (porDono[dono] ||= []).push(p);
  }
  return porDono;
}
