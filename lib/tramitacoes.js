// Pendências de tramitação calculadas das datas do ticket no HubSpot.
// Nada aqui toca rede: recebe o ticket já lido e devolve o que está pendente,
// para a regra poder ser conferida sem depender do CRM.

export const PIPELINE_CS = "748675953";

// Etapas de encerramento do funil de CS. Sem excluir estas, o board puxava os
// 4742 tickets do funil inteiro — a maioria concluída ou cancelada há muito —
// e cada um virava pendência vencida. Só ativos são 865. Medido na conta:
//   1088360203 Etapa de conferência · 1088360204 Iniciar Trâmites
//   1088360205 Em andamento · 1088361911 Pagamento Pós-Palestra
//   1333136740 Aguardando NF Palestrante · 1088361912 Aprovação Arquivo
//   1088361913 Stand by · 1088360206 Concluído · 1108384635 Cancelado
export const ETAPAS_ENCERRADAS = ["1088360206", "1108384635"];

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
