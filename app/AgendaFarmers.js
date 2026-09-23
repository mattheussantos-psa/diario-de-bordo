"use client";

import { useState } from "react";
import { BALDES } from "../lib/carteira";

const STATUS_CLS = {
  fechado: "aprovado",
  iniciado: "enviado",
  mapeando: "enviado",
  nao_iniciado: "rascunho",
  sem_lista: "rascunho",
};

// Troca de segmento em aberto: a empresa está parada até alguém decidir.
function Troca({ t, ownerId, onDecidido }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function decidir(decisao) {
    setBusy(true);
    setErro("");
    try {
      const res = await fetch("/api/carteira/lider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "troca", ownerId, companyId: t.id, decisao }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Falha ao registrar.");
      }
      onDecidido(t.id);
    } catch (e) {
      setErro(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="troca-item">
      <div className="troca-cab">
        <a className="emp-nome" href={t.url} target="_blank" rel="noreferrer">{t.nome}</a>
        {erro && <span className="err">{erro}</span>}
      </div>
      {t.motivo && <div className="troca-motivo">{t.motivo}</div>}
      <div className="tram-acoes">
        <button className="btn-ghost" onClick={() => decidir("mantido")} disabled={busy}>
          Segmento está certo
        </button>
        <button className="btn-primary" onClick={() => decidir("trocado")} disabled={busy}>
          Troquei no HubSpot
        </button>
      </div>
    </div>
  );
}

// Empresa travada em três tentativas: o líder responde com uma orientação.
function Auxilio({ e, ownerId }) {
  const [texto, setTexto] = useState(e.orientacao?.texto || "");
  const [salvo, setSalvo] = useState(!!e.orientacao);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setBusy(true);
    setErro("");
    try {
      const res = await fetch("/api/carteira/lider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "orientacao", ownerId, companyId: e.id, texto }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Falha ao salvar.");
      }
      setSalvo(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="aux-item">
      <div className="troca-cab">
        <a className="emp-nome" href={e.url} target="_blank" rel="noreferrer">{e.nome}</a>
        <span className="emp-tag auxilio">{e.historico?.tentativasSeguidas || 3} tentativas</span>
      </div>
      <textarea
        className="obs"
        placeholder="O que o farmer deve fazer nesta empresa?"
        value={texto}
        onChange={(ev) => {
          setTexto(ev.target.value);
          setSalvo(false);
        }}
      />
      <div className="fech-rodape">
        {erro && <span className="err">{erro}</span>}
        {salvo && !erro && <span className="saved">orientação enviada ✓</span>}
        <button className="btn-primary" onClick={salvar} disabled={busy || salvo || texto.trim().length < 10}>
          {busy ? "Salvando…" : salvo ? "Enviada" : "Enviar orientação"}
        </button>
      </div>
    </div>
  );
}

export default function AgendaFarmers({ farmers, diaLabel }) {
  const [resolvidas, setResolvidas] = useState({});

  const trocas = farmers.flatMap((f) =>
    (f.trocas || [])
      .filter((t) => !resolvidas[f.ownerId + "|" + t.id])
      .map((t) => ({ ...t, ownerId: f.ownerId, farmer: f.nome }))
  );
  const auxilios = farmers.flatMap((f) =>
    (f.itens || []).filter((e) => e.precisaAuxilio).map((e) => ({ ...e, ownerId: f.ownerId, farmer: f.nome }))
  );

  return (
    <>
      {trocas.length > 0 && (
        <div className="painel-troca">
          <div className="painel-titulo">
            Trocas de segmento ({trocas.length}) — a empresa fica fora do rodízio até decidir
          </div>
          <div className="painel-lista">
            {trocas.map((t) => (
              <div key={t.ownerId + t.id}>
                <div className="painel-quem">{t.farmer}</div>
                <Troca
                  t={t}
                  ownerId={t.ownerId}
                  onDecidido={(id) => setResolvidas((r) => ({ ...r, [t.ownerId + "|" + id]: true }))}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {auxilios.length > 0 && (
        <div className="painel-aux">
          <div className="painel-titulo">
            Pedidos de auxílio ({auxilios.length}) — três tentativas sem contato
          </div>
          <div className="painel-lista">
            {auxilios.map((e) => (
              <div key={e.ownerId + e.id}>
                <div className="painel-quem">{e.farmer}</div>
                <Auxilio e={e} ownerId={e.ownerId} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dia-grid">
        {farmers.map((f) => (
          <div className={"dia-card st-" + (STATUS_CLS[f.situacao.chave] || "rascunho")} key={f.ownerId}>
            <div className="dia-cab">
              <span className="aprov-pfp">
                {f.foto ? <img src={f.foto} alt={f.nome} /> : f.nome.slice(0, 2).toUpperCase()}
              </span>
              <span className="dia-nome">{f.nome}</span>
              <span className="plan-badge">{f.situacao.label}</span>
            </div>

            <div className="dia-nums">
              <span><b>{f.placar.total}</b> empresas</span>
              <span><b>{f.placar.pct}%</b> efetivo</span>
              {f.placar.sem_registro > 0 && (
                <span className="foco-alerta"><b>{f.placar.sem_registro}</b> sem registro</span>
              )}
            </div>

            {f.itens.length > 0 ? (
              <div className="dia-empresas">
                {f.itens.slice(0, 6).map((e) => (
                  <span className={"dia-emp r-" + (e.resultado || "vazio")} key={e.id} title={BALDES[e.balde]?.label}>
                    {e.nome}
                  </span>
                ))}
                {f.itens.length > 6 && <span className="dia-emp mais">+{f.itens.length - 6}</span>}
              </div>
            ) : (
              <div className="dia-vazio">Ainda não abriu o diário hoje</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
