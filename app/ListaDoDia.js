"use client";

import { useMemo, useState } from "react";
import { ABORDAGENS, BALDES } from "../lib/carteira";

// Contexto de quem já apareceu antes: é o que responde "por que ela voltou?".
function historicoTexto(h) {
  if (!h?.ultimaData) return "";
  const dia = h.ultimaData.slice(8, 10) + "/" + h.ultimaData.slice(5, 7);
  const r = {
    efetivo: "falaram em " + dia,
    tentativa: `${h.tentativasSeguidas || 1}ª tentativa · sem contato desde ${dia}`,
    nao_abordei: "não abordada em " + dia,
    trocar_segmento: "troca pedida em " + dia,
  };
  return r[h.ultimoResultado] || `apareceu em ${dia}, sem fechamento`;
}

function Card({ e, ctx, onAbordagem }) {
  const [abordagem, setAbordagem] = useState(e.abordagem || "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function escolher(valor) {
    const anterior = abordagem;
    setAbordagem(valor);
    setBusy(true);
    setErro("");
    try {
      const res = await fetch("/api/carteira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: ctx.ownerId, dia: ctx.dia, companyId: e.id, abordagem: valor }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Falha ao salvar.");
      }
      onAbordagem(e.id, valor);
    } catch (err) {
      setAbordagem(anterior); // não finge que salvou
      setErro(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hist = historicoTexto(e.historico);

  return (
    <div className={"emp-card b-" + e.balde + (e.extra ? " extra" : "") + (abordagem ? " pronta" : "")}>
      <div className="emp-topo">
        <span className={"emp-balde b-" + e.balde}>{BALDES[e.balde]?.label || e.balde}</span>
        {e.extra && <span className="emp-tag">extra</span>}
        {e.precisaAuxilio && <span className="emp-tag auxilio">auxílio do líder</span>}
      </div>

      <a className="emp-nome" href={e.url} target="_blank" rel="noreferrer">{e.nome}</a>

      <div className="emp-meta">
        {e.ultimaCompra ? (
          <span>última compra {e.ultimaCompra.slice(8, 10)}/{e.ultimaCompra.slice(5, 7)}/{e.ultimaCompra.slice(0, 4)}</span>
        ) : (
          <span>nunca contratou</span>
        )}
        {hist && <span className="emp-hist">· {hist}</span>}
      </div>

      {e.orientacao && (
        <div className="emp-orientacao">
          {e.orientacao.texto}
          <span className="emp-orientacao-autor">— {e.orientacao.autor}</span>
        </div>
      )}

      <div className="select-wrap">
        <select
          className="emp-abordagem"
          value={abordagem}
          disabled={busy}
          onChange={(ev) => escolher(ev.target.value)}
        >
          <option value="">Como vai abordar…</option>
          {ABORDAGENS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      {erro && <span className="err">{erro}</span>}
    </div>
  );
}

export default function ListaDoDia({ itens, ctx }) {
  const [abordagens, setAbordagens] = useState(() => {
    const m = {};
    for (const e of itens) if (e.abordagem) m[e.id] = e.abordagem;
    return m;
  });

  const doCompromisso = useMemo(() => itens.filter((e) => !e.extra), [itens]);
  const extras = useMemo(() => itens.filter((e) => e.extra), [itens]);

  // A lista inteira é o compromisso, extras inclusive: o dia só começa com
  // todas mapeadas.
  const faltam = itens.filter((e) => !abordagens[e.id]).length;

  if (itens.length === 0) {
    return (
      <div className="card">
        <div className="foco-vazio">
          <h3>Sem lista para hoje</h3>
          <p>
            A lista é montada a partir das empresas em que você é proprietário no HubSpot.
            Se ela veio vazia, quase sempre é proprietário errado no CRM — corrigir lá corrige
            aqui no dia seguinte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="foco">
      <div className="foco-topo">
        <div className="foco-resumo">
          <span className="foco-dia">{ctx.diaLabel}</span>
          <span className="foco-status">{doCompromisso.length} empresas + {extras.length} extras</span>
        </div>
        <div className="foco-nums">
          {faltam > 0 ? (
            <span className="foco-alerta"><b>{faltam}</b> sem abordagem definida</span>
          ) : (
            <span className="fech-ok">todas mapeadas</span>
          )}
          <button className="btn-primary" disabled={faltam > 0} title={faltam > 0 ? "Defina a abordagem de todas antes de iniciar" : undefined}>
            Iniciar o dia
          </button>
        </div>
      </div>

      <div className="foco-grid">
        {doCompromisso.map((e) => (
          <Card key={e.id} e={e} ctx={ctx} onAbordagem={(id, v) => setAbordagens((a) => ({ ...a, [id]: v }))} />
        ))}
      </div>

      {extras.length > 0 && (
        <>
          <div className="emp-secao">
            Extras — clientes recentes, fora da conta das {doCompromisso.length}
          </div>
          <div className="foco-grid">
            {extras.map((e) => (
              <Card key={e.id} e={e} ctx={ctx} onAbordagem={(id, v) => setAbordagens((a) => ({ ...a, [id]: v }))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
