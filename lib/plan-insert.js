// Monta o INSERT em lote dos itens do plano.
// Separado de db.js para poder ser testado sem banco (ver test-plan-insert.mjs).
export function buildItemsInsert(ownerId, week, items) {
  const entries = Object.entries(items);
  if (entries.length === 0) return null;
  const tuples = entries.map((_, i) => `($1, $2, $${i * 2 + 3}, $${i * 2 + 4})`).join(",");
  return {
    text: `INSERT INTO plan_items (owner_id, week, deal_id, dia) VALUES ${tuples}`,
    params: [
      String(ownerId),
      week,
      ...entries.flatMap(([dealId, dia]) => [String(dealId), dia ?? null]),
    ],
  };
}
