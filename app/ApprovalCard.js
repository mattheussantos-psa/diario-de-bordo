"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMP_STYLE, dealUrl } from "../lib/config";
import { formatNextActivity } from "../lib/activity";

const STATUS_LABEL = {
  rascunho: "Rascunho",
  enviado: "Aguardando aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

const brl = (n) =>
  n == null ? "—" : "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function ApprovalCard({ plano, deals, dia, options = [] }) {
  const router = useRouter();
  const [status, setStatus] = useState(plano.status);
  const [motivo, setMotivo] = useState(plano.motivo || "");
  const [abrirReprova, setAbrirReprova] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Edição do gestor: incluir, retirar e trocar a evolução pretendida.
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState({ ...plano.items });
  const [catalogo, setCatalogo] = useState(null);

  const itens = editando ? rascunho : plano.items;
  const entries = Object.entries(itens);

  const info = (id) =>
    deals[id] || catalogo?.find((d) => String(d.id) === String(id)) || { id, name: `Negócio ${id}` };

  const total = entries.reduce((s, [id]) => s + (info(id).amount || 0), 0);
  const label = (v) => options.find((o) => o.value === v)?.label || v;

  async function abrirEdicao() {
    setEditando(true);
    setRascunho({ ...plano.items });
    setMsg(null);
    if (!catalogo) {
      try {
        const res = await fetch(`/api/deals?owner=${plano.ownerId}`);
        const d = await res.json();
        setCatalogo(d.deals || []);
      } catch {
        setCatalogo([]);
      }
    }
  }

  async function salvarEdicao() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: plano.ownerId, dia, items: rascunho, manterStatus: true }),
      });
      if (!res.ok) throw new Error();
      setEditando(false);
      setMsg({ ok: true, text: "Briefing atualizado ✓" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Erro ao salvar." });
    } finally {
      setBusy(false);
    }
  }

  async function decidir(novo) {
    if (novo === "reprovado" && !motivo.trim()) {
      setMsg({ ok: false, text: "Escreva o motivo." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/briefing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: plano.ownerId, dia, status: novo, motivo }),
      });
      if (!res.ok) throw new Error();
      setStatus(novo);
      setAbrirReprova(false);
      setMsg({ ok: true, text: novo === "aprovado" ? "Aprovado ✓" : "Reprovado ✓" });
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Erro ao registrar." });
    } finally {
      setBusy(false);
    }
  }

  const disponiveis = (catalogo || []).filter((d) => !(String(d.id) in rascunho));

  return (
    <div className={"aprov-card st-" + status}>
      <div className="aprov-head">
        <div className="aprov-quem">
          <span className="aprov-pfp">
            {plano.foto ? <img src={plano.foto} alt={plano.nome} /> : plano.nome.slice(0, 2).toUpperCase()}
          </span>
          <span className="aprov-nome">{plano.nome}</span>
          <span className="aprov-seg">{plano.seg}</span>
          <span className="plan-badge">{STATUS_LABEL[status]}</span>
        </div>
        <div className="aprov-resumo">
          <span><b>{entries.length}</b> negócio{entries.length === 1 ? "" : "s"} hoje</span>
          <span><b>{brl(total)}</b> em jogo</span>
        </div>
      </div>

      <div className="brief-lista">
        {entries.length === 0 && <div className="aprov-vazio">Nenhum negócio no briefing.</div>}
        {entries.map(([id, v]) => {
          const n = info(id);
          const at = formatNextActivity(n.nextActivity);
          return (
            <div className={"brief-item v-" + (TEMP_STYLE[v.de] || "none")} key={id}>
              <div className="brief-principal">
                <a className="brief-nome" href={dealUrl(id)} target="_blank" rel="noreferrer">
                  {n.name}
                </a>
                <span className="brief-val">{brl(n.amount)}</span>
              </div>

              <div className="brief-evo">
                <span className={"temp-atual t-" + (TEMP_STYLE[v.de] || "none")}>
                  {v.de ? label(v.de) : "sem temperatura"}
                </span>
                <span className="evo-seta">→</span>
                {editando ? (
                  <div className="act" data-v={TEMP_STYLE[v.para] || ""}>
                    <select
                      value={v.para || ""}
                      onChange={(e) =>
                        setRascunho((r) => ({ ...r, [id]: { ...r[id], para: e.target.value } }))
                      }
                    >
                      <option value="">Levar para…</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className={"temp-alvo t-" + (TEMP_STYLE[v.para] || "none")}>
                    {v.para ? label(v.para) : "—"}
                  </span>
                )}
                {editando && (
                  <button
                    className="aprov-x"
                    onClick={() =>
                      setRascunho((r) => {
                        const c = { ...r };
                        delete c[id];
                        return c;
                      })
                    }
                    title="Retirar do briefing"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="brief-ativ">
                <span className={"aprov-ativ-data" + (at.none ? " none" : "")}>
                  {at.dateText}
                  {at.pill && <b className={"pill-date " + at.pill.cls}>{at.pill.text}</b>}
                </span>
                {n.nextStep && <span className="aprov-ativ-desc">{n.nextStep}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {editando && (
        <div className="aprov-add">
          {catalogo === null ? (
            <span className="aprov-add-lab">Carregando negócios…</span>
          ) : (
            <>
              <span className="aprov-add-lab">Adicionar negócio:</span>
              <div className="select-wrap">
                <select
                  className="closer-select"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) {
                      const d = catalogo.find((x) => String(x.id) === id);
                      setRascunho((r) => ({ ...r, [id]: { de: d?.temperatura || "", para: "" } }));
                    }
                  }}
                >
                  <option value="">Selecione…</option>
                  {disponiveis.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {status === "reprovado" && plano.motivo && !editando && (
        <div className="aprov-motivo">Motivo: {plano.motivo}</div>
      )}

      <div className="aprov-acoes">
        {msg && <span className={msg.ok ? "saved" : "err"}>{msg.text}</span>}
        {plano.revisadoPor && status !== "enviado" && !editando && (
          <span className="aprov-por">por {plano.revisadoPor}</span>
        )}
        {editando ? (
          <>
            <button className="btn-ghost" onClick={() => setEditando(false)} disabled={busy}>Cancelar</button>
            <button className="btn-primary" onClick={salvarEdicao} disabled={busy}>
              {busy ? "Salvando…" : "Salvar alterações"}
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={abrirEdicao} disabled={busy}>Editar briefing</button>
            <button className="btn-ghost" onClick={() => setAbrirReprova((v) => !v)} disabled={busy}>Reprovar</button>
            <button className="btn-primary" onClick={() => decidir("aprovado")} disabled={busy || status === "aprovado"}>
              {busy ? "…" : status === "aprovado" ? "Aprovado" : "Aprovar"}
            </button>
          </>
        )}
      </div>

      {abrirReprova && !editando && (
        <div className="reprova">
          <input
            className="reprova-input"
            placeholder="Motivo da reprovação…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button className="btn-danger" onClick={() => decidir("reprovado")} disabled={busy}>
            Confirmar reprovação
          </button>
        </div>
      )}
    </div>
  );
}
