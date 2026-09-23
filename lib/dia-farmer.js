import "server-only";
import { getCarteira, empresasNoFunil } from "./hubspot";
import { getListaDia, salvarListaDia, getHistoricoCarteira, getTrocasPendentes, registrarAcesso } from "./db";
import { montaListaDoDia, montaHistorico, classifica, precisaAuxilio, emDescanso } from "./carteira";
import { dayKey } from "./week";

// A lista do dia do farmer. Gera na primeira abertura e congela: reabrir a
// tela não pode reembaralhar o compromisso do dia.
// Só gera para hoje — dia passado é registro, não se remonta.
export async function listaDoDia(ownerId, dia = dayKey(), { registraAcesso = false } = {}) {
  // Só conta como acesso quando é o próprio farmer abrindo: líder navegando
  // pelo seletor não pode parecer que o farmer entrou.
  if (registraAcesso && dia === dayKey()) {
    await registrarAcesso(ownerId, dia).catch(() => {});
  }
  const jaTem = await getListaDia(ownerId, dia);
  if (jaTem.length > 0 || dia !== dayKey()) return { itens: jaTem, gerada: false };

  const [carteira, noFunil, linhas, trocas] = await Promise.all([
    getCarteira(ownerId),
    empresasNoFunil(ownerId).catch((e) => {
      // Sem esta lista o farmer receberia empresas já em negociação. Melhor
      // falhar alto do que entregar a lista errada em silêncio.
      console.error("[carteira] não consegui apurar os negócios abertos:", e?.message);
      throw e;
    }),
    getHistoricoCarteira(ownerId, dia),
    getTrocasPendentes([ownerId]),
  ]);

  const historico = montaHistorico(linhas);
  // Empresa com troca em aberto é o problema, não a tarefa: só volta quando
  // o líder disser que o segmento está certo.
  const pendentes = new Set((trocas[String(ownerId)] || []).map((t) => String(t.id)));
  const escolhidas = montaListaDoDia(
    carteira.map((e) => ({ ...e, noFunil: noFunil.has(String(e.id)) })),
    dia,
    historico,
    pendentes
  );

  await salvarListaDia(ownerId, dia, escolhidas);
  return { itens: await getListaDia(ownerId, dia), gerada: true };
}

// Números que explicam a lista: de onde ela saiu e o que ficou de fora.
export async function resumoDaCarteira(ownerId, dia = dayKey()) {
  const [carteira, noFunil, linhas] = await Promise.all([
    getCarteira(ownerId),
    empresasNoFunil(ownerId).catch(() => new Set()),
    getHistoricoCarteira(ownerId, dia),
  ]);
  const historico = montaHistorico(linhas);
  const inicioMes = dia.slice(0, 7) + "-01";

  const porBalde = {};
  for (const e of carteira) {
    const { balde } = classifica(e.ultimaCompra, dia);
    porBalde[balde] = (porBalde[balde] || 0) + 1;
  }

  return {
    carteira: carteira.length,
    comHistorico: carteira.filter((e) => e.ultimaCompra).length,
    porBalde,
    noFunil: carteira.filter((e) => noFunil.has(String(e.id))).length,
    emDescanso: carteira.filter((e) => emDescanso(historico.get(String(e.id)), dia)).length,
    precisandoAuxilio: carteira.filter((e) => precisaAuxilio(historico.get(String(e.id)))).length,
    // Régua de cobertura: quanto da carteira foi realmente tocada no mês.
    contatoNoMes: carteira.filter((e) => e.ultimoContato && e.ultimoContato >= inicioMes).length,
  };
}
