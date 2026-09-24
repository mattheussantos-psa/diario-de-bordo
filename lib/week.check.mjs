// node lib/week.check.mjs — roda em UTC, como a Vercel.
// Garante que o dia do briefing é o dia de Brasília, não o do servidor.
process.env.TZ = "UTC";
const { dayKey, diaUtilAnterior, dayLabel } = await import("./week.js");

const ok = (cond, msg) => {
  if (!cond) {
    console.error("FALHOU:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
};

ok(dayKey(new Date("2026-08-25T00:30:00Z")) === "2026-08-24", "21h30 de Brasília ainda é o dia 24");
ok(dayKey(new Date("2026-08-24T13:00:00Z")) === "2026-08-24", "10h de Brasília é o dia 24");
ok(dayKey(new Date("2026-08-25T03:05:00Z")) === "2026-08-25", "00h05 de Brasília já é o dia 25");
ok(diaUtilAnterior("2026-08-24") === "2026-08-21", "segunda volta para a sexta");
ok(dayLabel("2026-08-24") === "segunda-feira, 24/08", "rótulo do dia intacto");

// Janela do relatório de Evolução. Sábado e domingo entrariam como barra
// vazia e espremeriam os dias que importam.
const { ultimosDiasUteis } = await import("./week.js");
const janela = ultimosDiasUteis(10, "2026-09-23");
ok(janela.length === 10, "a janela tem os 10 dias pedidos");
ok(janela[janela.length - 1] === "2026-09-23", "termina no dia pedido");
ok(
  janela.every((d) => ![0, 6].includes(new Date(d + "T12:00:00").getDay())),
  "nenhum fim de semana na janela"
);
ok(janela.join() === [...janela].sort().join(), "dias em ordem crescente");
ok(ultimosDiasUteis(3, "2026-09-21").join() === "2026-09-17,2026-09-18,2026-09-21", "segunda pula o fim de semana");

// Prazo da tarefa criada a partir da estratégia aprovada.
const { prazoDoDia } = await import("./week.js");
const emSP = (ms) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ms));

ok(emSP(prazoDoDia("2026-09-24")) === "24/09/2026, 18:00", "prazo cai às 18h de Brasília, no dia certo");
ok(new Date(prazoDoDia("2026-09-24")).toISOString() === "2026-09-24T21:00:00.000Z", "18h BRT é 21h UTC");

// Os dois formatos de data do HubSpot.
const { diaDeCampoHora, diaDeCampoData } = await import("./week.js");
ok(diaDeCampoHora("2026-09-25T01:30:00Z") === "2026-09-24", "22h30 de Brasília ainda é o dia 24");
ok(diaDeCampoHora("2026-09-24T13:58:23.741Z") === "2026-09-24", "meio da tarde fica no mesmo dia");
ok(diaDeCampoHora("1790823600000") === "2026-10-01", "timestamp em ms também vira dia de Brasília");
ok(diaDeCampoData("2026-11-13T00:00:00Z") === "2026-11-13", "data pura não anda um dia para trás");
ok(diaDeCampoData("2026-11-13") === "2026-11-13", "data pura sem hora fica intacta");
ok(diaDeCampoHora(null) === null && diaDeCampoData("") === null, "campo vazio devolve nulo, não hoje");
