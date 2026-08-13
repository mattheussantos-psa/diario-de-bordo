// Checagem da gravação do plano: node test-plan-insert.mjs
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { buildItemArrays } from "./lib/plan-insert.js";

// --- arrays enviados ao unnest ---
assert.deepEqual(buildItemArrays({}), { dealIds: [], dias: [] });

const um = buildItemArrays({ "62615940256": 3 });
assert.deepEqual(um, { dealIds: ["62615940256"], dias: [3] });

// Ordem preservada e mesmo comprimento — unnest pareia por posição.
const tres = buildItemArrays({ a: 1, b: null, c: 5 });
assert.deepEqual(tres.dealIds, ["a", "b", "c"]);
assert.deepEqual(tres.dias, [1, null, 5]);
assert.equal(tres.dealIds.length, tres.dias.length);

// Negócio sem dia vira NULL, não undefined (o driver rejeitaria).
assert.equal(buildItemArrays({ x: undefined }).dias[0], null);

// --- a API do driver que realmente usamos existe ---
// Este check é o que faltava: sql.query() NÃO existe nesta versão do driver,
// e a gravação quebrava em produção com "is not a function".
const sql = neon("postgresql://u:p@ep-x-pooler.us-east-1.aws.neon.tech/db?sslmode=require");
assert.equal(typeof sql, "function", "template tag do neon indisponível");
assert.equal(typeof sql.transaction, "function", "sql.transaction indisponível");

console.log("ok: buildItemArrays + API do driver");
