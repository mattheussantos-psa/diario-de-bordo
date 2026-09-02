// node lib/config.check.mjs — coerência do cadastro de segmentos.
// Um segmento sem funil abre a tabela vazia; sem estratégias, o closer não
// consegue enviar (o campo é obrigatório); e um ownerId repetido em dois
// segmentos torna SEG_CLOSER ambíguo, o que decide permissão de líder.
const { CLOSERS, SEGMENTOS, PIPELINES_POR_SEG, SEG_CLOSER } = await import("./config.js");
const { ESTRATEGIAS } = await import("./estrategias.js");

let falhou = false;
const ok = (cond, msg) => {
  console[cond ? "log" : "error"](cond ? "ok:" : "FALHOU:", msg);
  if (!cond) falhou = true;
};

for (const seg of SEGMENTOS) {
  ok(PIPELINES_POR_SEG[seg]?.length > 0, `${seg} tem funil definido`);
  ok(ESTRATEGIAS[seg]?.length > 0, `${seg} tem estratégias`);
}

const ids = SEGMENTOS.flatMap((s) => CLOSERS[s].map((c) => c.id));
ok(ids.length === new Set(ids).size, "nenhum closer em dois segmentos");
ok(Object.keys(SEG_CLOSER).length === ids.length, "todo closer tem segmento");

process.exit(falhou ? 1 : 0);
