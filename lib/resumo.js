import { estrategiaPorId, numeroDa } from "./estrategias";

const brl = (n) =>
  n == null ? "" : "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

// Resumo do briefing aprovado, no formato do WhatsApp (*negrito*).
// Texto puro: sem link nem markdown, para colar em qualquer conversa.
export function resumoWhatsApp({ closer, diaLabel, itens }) {
  const total = itens.reduce((s, i) => s + (i.valor || 0), 0);
  const linhas = [
    `*Diário de bordo — ${diaLabel}*`,
    closer,
    "",
    `${itens.length} negócio${itens.length === 1 ? "" : "s"} para hoje${total ? ` · ${brl(total)}` : ""}`,
    "",
  ];

  itens.forEach((i, n) => {
    linhas.push(`${n + 1}. *${i.nome}*${i.valor ? ` — ${brl(i.valor)}` : ""}`);
    if (i.de || i.para) linhas.push(`   ${i.de || "—"} → ${i.para || "—"}`);
    const e = estrategiaPorId[i.estrategia];
    if (e) linhas.push(`   Estratégia ${numeroDa(i.estrategia)}: ${e.titulo}`);
    if (i.atrasada) linhas.push(`   ⚠️ atividade atrasada`);
    linhas.push("");
  });

  return linhas.join("\n").trim();
}
