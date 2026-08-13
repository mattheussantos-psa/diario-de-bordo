// Converte os itens do plano em dois arrays paralelos, para gravar tudo em um
// único INSERT via unnest (o driver do Neon só expõe template tags — não há
// sql.query() para montar placeholders dinâmicos).
// Testado em test-plan-insert.mjs.
export function buildItemArrays(items) {
  const entries = Object.entries(items);
  return {
    dealIds: entries.map(([id]) => String(id)),
    dias: entries.map(([, dia]) => (dia == null ? null : Number(dia))),
  };
}
