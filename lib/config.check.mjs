// node lib/config.check.mjs — coerência do cadastro de segmentos e permissões.
const { CLOSERS, SEGMENTOS, PIPELINES_POR_SEG, SEG_CLOSER, segLideradoPor } =
  await import("./config.js");
const { ESTRATEGIAS } = await import("./estrategias.js");
const { ehGestor, segmentosDe, podeGerirCloser } = await import("./permissoes.js");

let falhou = false;
const ok = (cond, msg) => {
  console[cond ? "log" : "error"](cond ? "ok:" : "FALHOU:", msg);
  if (!cond) falhou = true;
};

// Um segmento sem funil abre a tabela vazia; sem estratégias, o closer não
// consegue enviar (o campo é obrigatório); e um ownerId repetido em dois
// segmentos torna SEG_CLOSER ambíguo, o que decide permissão de líder.
for (const seg of SEGMENTOS) {
  ok(PIPELINES_POR_SEG[seg]?.length > 0, `${seg} tem funil definido`);
  ok(ESTRATEGIAS[seg]?.length > 0, `${seg} tem estratégias`);
}

const ids = SEGMENTOS.flatMap((s) => CLOSERS[s].map((c) => c.id));
ok(ids.length === new Set(ids).size, "nenhum closer em dois segmentos");
ok(Object.keys(SEG_CLOSER).length === ids.length, "todo closer tem segmento");

// Quem aprova quem. Um erro aqui deixa alguém decidindo sobre time que não é
// seu, ou um briefing sem ninguém que possa aprová-lo.
const usuario = (email) => ({ lidera: segLideradoPor(email) });
const cesar = usuario("cesar.filho@profissionaissa.com");
const daniel = usuario("daniel.sias@profissionaissa.com");
const nicollas = usuario("nicollas.lenuzza@profissionaissa.com");
const closerComum = usuario("nao.e.lider@profissionaissa.com");
const admin = { isAdmin: true };
const umDe = (seg) => CLOSERS[seg][0].id;

ok(segmentosDe(cesar).join() === "B2B,Farmer", "Cesar lidera B2B e Farmer");
ok(podeGerirCloser(cesar, umDe("Farmer")), "Cesar aprova closer do Farmer");
ok(podeGerirCloser(cesar, umDe("B2B")), "Cesar aprova closer do B2B");
ok(!podeGerirCloser(cesar, umDe("B2C")), "Cesar não aprova closer do B2C");
ok(
  podeGerirCloser(daniel, umDe("Farmer")) && !podeGerirCloser(daniel, umDe("B2B")),
  "Daniel decide só no Farmer"
);
ok(
  podeGerirCloser(nicollas, umDe("B2C")) && !podeGerirCloser(nicollas, umDe("Farmer")),
  "Nicollas decide só no B2C"
);
ok(
  !ehGestor(closerComum) && !podeGerirCloser(closerComum, umDe("B2B")),
  "closer comum não gere ninguém"
);
ok(SEGMENTOS.every((s) => podeGerirCloser(admin, umDe(s))), "admin alcança todos os segmentos");

process.exit(falhou ? 1 : 0);
