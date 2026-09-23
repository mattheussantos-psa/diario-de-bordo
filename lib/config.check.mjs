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

// Texto que vai para o HubSpot na aprovação. b2b-3 e b2c-3 são estratégias
// diferentes: sem o segmento no rótulo, o CRM não distingue as duas.
const { rotuloDa } = await import("./estrategias.js");
ok(rotuloDa("b2b-3") === "B2B 3. Pré-briefing", "rótulo da estratégia leva segmento e número");
ok(rotuloDa("b2c-3") !== rotuloDa("b2b-3"), "b2c-3 não se confunde com b2b-3");
ok(rotuloDa("nao-existe") === "", "estratégia desconhecida não inventa texto");

// Num dropdown o HubSpot descarta valor fora da lista sem dar erro, então o
// valor enviado tem de ser resolvido contra as opções reais da propriedade.
const { valorDaEstrategia } = await import("./estrategias.js");
const texto = { tipo: "string", opcoes: [] };
const dropIds = { tipo: "enumeration", opcoes: [{ value: "b2b-3", label: "B2B 3. Pré-briefing" }] };
// Como a propriedade "estrategia" existe hoje na conta: valor = rótulo = só o
// título, sem prefixo nem número. Conferido com get_properties.
const comoEstaNaConta = {
  tipo: "enumeration",
  opcoes: [...ESTRATEGIAS.B2B, ...ESTRATEGIAS.B2C].map((e) => ({ value: e.titulo, label: e.titulo })),
};

ok(valorDaEstrategia(null, "b2b-3") === undefined, "propriedade inexistente: não envia nada");
ok(valorDaEstrategia(texto, "b2b-3") === "B2B 3. Pré-briefing", "campo de texto recebe o rótulo");
ok(valorDaEstrategia(dropIds, "b2b-3") === "b2b-3", "dropdown com o id casa direto");
ok(valorDaEstrategia(comoEstaNaConta, "b2b-3") === "Pré-briefing", "casa com a opção da conta (só o título)");
ok(
  valorDaEstrategia(comoEstaNaConta, "b2c-1") === "Demanda do B2B que ele poderia ser indicado",
  "estratégia de B2C também casa"
);
// A garantia que importa: toda estratégia do sistema encontra sua opção.
const semOpcao = [...ESTRATEGIAS.B2B, ...ESTRATEGIAS.B2C].filter(
  (e) => valorDaEstrategia(comoEstaNaConta, e.id) === undefined
);
ok(semOpcao.length === 0, "as 20 estratégias casam com as opções da propriedade");
// Se os rótulos ganharem o prefixo B2B/B2C depois, o valor interno continua
// sendo o título — a gravação não pode quebrar por causa disso.
const rotuloRenomeado = {
  tipo: "enumeration",
  opcoes: [{ value: "Pré-briefing", label: "B2B 3. Pré-briefing" }],
};
ok(valorDaEstrategia(rotuloRenomeado, "b2b-3") === "Pré-briefing", "renomear o rótulo não quebra a gravação");
ok(valorDaEstrategia(dropIds, "b2c-9") === undefined, "sem opção correspondente: não envia nada");

process.exit(falhou ? 1 : 0);
