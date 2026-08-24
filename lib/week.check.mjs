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
