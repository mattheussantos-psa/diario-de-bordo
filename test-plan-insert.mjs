// Checagem do INSERT em lote do plano: node test-plan-insert.mjs
import assert from "node:assert/strict";
import { buildItemsInsert } from "./lib/plan-insert.js";

// Sem itens: nada a inserir.
assert.equal(buildItemsInsert("80454586", "2026-W33", {}), null);

// Um item com dia definido.
const um = buildItemsInsert("80454586", "2026-W33", { "62615940256": 3 });
assert.equal(um.text, "INSERT INTO plan_items (owner_id, week, deal_id, dia) VALUES ($1, $2, $3, $4)");
assert.deepEqual(um.params, ["80454586", "2026-W33", "62615940256", 3]);

// Vários itens: placeholders não podem se repetir nem pular número.
const tres = buildItemsInsert("1", "2026-W33", { a: 1, b: null, c: 5 });
assert.equal(
  tres.text,
  "INSERT INTO plan_items (owner_id, week, deal_id, dia) VALUES ($1, $2, $3, $4),($1, $2, $5, $6),($1, $2, $7, $8)"
);
assert.deepEqual(tres.params, ["1", "2026-W33", "a", 1, "b", null, "c", 5]);

// Todo placeholder do texto precisa existir em params.
const maior = Math.max(...[...tres.text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
assert.equal(maior, tres.params.length, "placeholder sem parâmetro correspondente");

// Negócio sem dia escolhido vira NULL, não undefined (o driver rejeitaria).
assert.equal(buildItemsInsert("1", "w", { x: undefined }).params[3], null);

console.log("ok: buildItemsInsert");
