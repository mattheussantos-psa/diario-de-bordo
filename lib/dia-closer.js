import "server-only";
import { ultimaCompraPorNegocio } from "./hubspot";
import { getListaFunil, salvarListaFunil, getHistoricoFunil } from "./db";
import { montaListaDoDia } from "./funil";
import { dayKey } from "./week";

// A lista do dia do closer, pelos critérios do B2B. Gera na primeira abertura
// e congela, como a do farmer: reabrir a tela não pode reembaralhar o
// compromisso do dia. Só gera para hoje — dia passado é registro.
//
// Recebe os negócios já lidos (getOpenDeals) em vez de buscar de novo: a página
// já os tem em mãos, e uma segunda varredura do funil foi o que estourou a cota
// do HubSpot antes.
export async function listaDoDiaCloser(ownerId, deals, dia = dayKey()) {
  const jaTem = await getListaFunil(ownerId, dia);
  if (jaTem.length > 0 || dia !== dayKey()) {
    const grupoDe = Object.fromEntries(jaTem.map((l) => [l.id, l.grupo]));
    // Mantém a ordem gravada, não a ordem em que o HubSpot devolveu.
    const itens = jaTem.map((l) => deals.find((d) => String(d.id) === l.id)).filter(Boolean);
    return { itens: itens.map((d) => ({ ...d, grupo: grupoDe[String(d.id)] })), gerada: false };
  }

  // Critério 6 mora na empresa: sem ele o grupo "cliente recente" fica vazio,
  // mas o dia continua de pé. Não derruba a lista por causa de um grupo.
  const compras = await ultimaCompraPorNegocio(deals.map((d) => d.id)).catch((e) => {
    console.error("[funil] não consegui apurar a última compra das empresas:", e?.message);
    return {};
  });

  const historico = await getHistoricoFunil(ownerId, dia);
  const escolhidos = montaListaDoDia(
    deals.map((d) => ({ ...d, ultimaCompra: compras[String(d.id)] || null })),
    dia,
    historico
  );

  await salvarListaFunil(ownerId, dia, escolhidos);
  return { itens: escolhidos, gerada: true };
}
