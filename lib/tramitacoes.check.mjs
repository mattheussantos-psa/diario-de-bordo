// node lib/tramitacoes.check.mjs — prazos e baixa das tramitações.
// Errar uma data aqui cobra alguém no dia errado, ou deixa de cobrar.
const { pendenciasDoTicket, somaDias, somaDiasUteis, diasEntre } = await import("./tramitacoes.js");

let falhou = false;
const ok = (cond, msg) => {
  console[cond ? "log" : "error"](cond ? "ok:" : "FALHOU:", msg);
  if (!cond) falhou = true;
};
const tipos = (ps) => ps.map((p) => p.tipo).sort().join(",");
const acha = (ps, t) => ps.find((p) => p.tipo === t);

// --- aritmética de data
ok(somaDias("2026-09-23", 20) === "2026-10-13", "20 dias corridos atravessam o mês");
ok(somaDiasUteis("2026-09-25", 1) === "2026-09-28", "1 dia útil após sexta cai na segunda");
ok(somaDiasUteis("2026-09-23", 1) === "2026-09-24", "1 dia útil no meio da semana é o dia seguinte");
ok(diasEntre("2026-09-23", "2026-09-25") === 2, "diferença de dias");
ok(diasEntre("2026-09-25", "2026-09-23") === -2, "diferença negativa quando o prazo passou");

// --- minuta: 1 dia útil após o onboarding
const onboardSexta = { id: "1", onboarding: "2026-09-25", statusContrato: "Pendente" };
const m = acha(pendenciasDoTicket(onboardSexta, "2026-09-25"), "minuta");
ok(m?.prazo === "2026-09-28", "minuta de onboarding na sexta vence na segunda");
ok(m?.atrasada === false, "no dia do onboarding a minuta ainda não está atrasada");
ok(acha(pendenciasDoTicket(onboardSexta, "2026-09-30"), "minuta")?.atrasada === true, "passou da segunda, minuta atrasada");

// --- assinatura: 20 dias, entra faltando 5
const t2 = { id: "2", onboarding: "2026-09-01", statusContrato: "Pendente" };
ok(acha(pendenciasDoTicket(t2, "2026-09-10"), "assinatura") === undefined, "faltando 11 dias, assinatura ainda não aparece");
ok(acha(pendenciasDoTicket(t2, "2026-09-16"), "assinatura")?.prazo === "2026-09-21", "faltando 5 dias, assinatura entra na lista");
ok(acha(pendenciasDoTicket(t2, "2026-09-25"), "assinatura")?.atrasada === true, "após 20 dias, assinatura vencida");

// --- contrato assinado baixa assinatura e minuta
const assinado = { ...t2, statusContrato: "Assinado" };
ok(tipos(pendenciasDoTicket(assinado, "2026-09-25")) === "", "contrato assinado baixa assinatura e minuta");

// --- checklist: 2 dias antes do evento
const t3 = { id: "3", evento: "2026-10-10", statusContrato: "Pendente" };
ok(acha(pendenciasDoTicket(t3, "2026-10-01"), "checklist") === undefined, "checklist não aparece com 9 dias de sobra");
ok(acha(pendenciasDoTicket(t3, "2026-10-06"), "checklist")?.prazo === "2026-10-08", "checklist vence 2 dias antes do evento");
ok(acha(pendenciasDoTicket(t3, "2026-10-09"), "checklist")?.atrasada === true, "passou do prazo, checklist atrasado");

// --- estado vindo do banco
const registros = { "3|checklist": { status: "aguardando", marcadoPor: "Fulano" } };
ok(acha(pendenciasDoTicket(t3, "2026-10-08", registros), "checklist")?.status === "aguardando", "marcada aparece aguardando o líder");
ok(
  acha(pendenciasDoTicket(t3, "2026-10-08", { "3|checklist": { status: "confirmado" } }), "checklist") === undefined,
  "confirmada pelo líder sai do board"
);
// Devolver não pode virar prorrogação: o prazo é o mesmo de antes.
const devolvida = acha(pendenciasDoTicket(t3, "2026-10-09", { "3|checklist": { status: "devolvido", motivo: "faltou anexo" } }), "checklist");
ok(devolvida?.atrasada === true && devolvida?.prazo === "2026-10-08", "devolvida volta com o prazo original, vencida");

// --- ticket sem as datas não gera pendência nenhuma
ok(pendenciasDoTicket({ id: "4", statusContrato: "" }, "2026-10-09").length === 0, "ticket sem datas não cobra nada");

process.exit(falhou ? 1 : 0);
