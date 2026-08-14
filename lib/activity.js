// Formata a próxima atividade em rótulo curto + urgência.
// Usada no diário, na agenda e nos cartões de aprovação.
export function formatNextActivity(ts) {
  if (!ts) return { dateText: "Sem atividade", none: true };
  const d = /^\d+$/.test(String(ts)) ? new Date(Number(ts)) : new Date(ts);
  if (isNaN(d)) return { dateText: "Sem atividade", none: true };
  const dateText = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  const now = new Date();
  const dia = 86400000;
  const diff = Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / dia
  );
  if (diff < 0) return { dateText, pill: { cls: "late", text: "atrasada" } };
  if (diff === 0) return { dateText, pill: { cls: "today", text: "hoje" } };
  if (diff <= 3) return { dateText, pill: { cls: "today", text: `em ${diff}d` } };
  return { dateText };
}
