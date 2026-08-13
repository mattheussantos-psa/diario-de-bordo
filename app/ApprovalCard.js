"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEMP_STYLE, dealUrl } from "../lib/config";
import { DIAS } from "../lib/week";

const STATUS_LABEL = {
  rascunho: "Rascunho",
  enviado: "Aguardando aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

const brl = (n) =>
  n == null ? "—" : "R$ " + n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function ApprovalCard({ plano, deals, week }) {
  const router = useRouter();
  const [status, setStatus] = useState(plano.status);
  const [motivo, setMotivo] = useState(plano.motivo || "");
  const [abrirReprova, setAbrirReprova] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // Edição do gestor: incluir, retirar e trocar o dia dos negócios.
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState({ ...plano.items });
  const [catalogo, setCatalogo] = useState(null);
  const [addId, setAddId] = useState("");

  const itens = editando ? rascunho : plano.items;
  const entries = Object.entries(itens);

  // Nome/valor vêm do lote já carregado ou do catálogo (negócios recém-incluídos).
  const info = (id) =>
    deals[id] || catalogo?.find((d) => String(d.id) === String(id)) || { id, name: `Negócio ${id}` };

  const total = entries.reduce((s, [id]) => s + (info(id).amount || 0), 0);

  const porDia = DIAS.map((d) => ({
    ...d,
    negocios: entries.filter(([, dia]) => dia === d.v).map(([id]) => info(id)),
  }));
  const semDia = entries.filter(([, dia]) => !dia).map(([id]) => info(id));

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
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: plano.ownerId, week, items: rascunho, manterStatus: true }),
      });
      if (!res.ok) throw new Error();
      setEditando(false);
      setMsg({ ok: true, text: "Plano atualizado ✓" });
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
      const res = await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: plano.ownerId, week, status: novo, motivo }),
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
          <span className="aprov-nome">{plano.nome}</span>
          <span className="aprov-seg">{plano.seg}</span>
          <span className="plan-badge">{STATUS_LABEL[status]}</span>
        </div>
        <div className="aprov-resumo">
          <span><b>{entries.length}</b> negócio{entries.length === 1 ? "" : "s"}</span>
          <span><b>{brl(total)}</b> no plano</span>
        </div>
      </div>

      <div className="aprov-dias">
        {porDia.map((d) => (
          <div className="aprov-dia" key={d.v}>
            <div className="aprov-dia-lab">{d.label}</div>
            {d.negocios.length === 0 && <div className="aprov-vazio">—</div>}
            {d.negocios.map((n) => (
              <NegocioItem
                key={n.id}
                n={n}
                dia={d.v}
                editando={editando}
                onDia={(dia) => setRascunho((r) => ({ ...r, [n.id]: dia }))}
                onRemover={() =>
                  setRascunho((r) => {
                    const c = { ...r };
                    delete c[n.id];
                    return c;
                  })
                }
              />
            ))}
          </div>
        ))}
      </div>

      {semDia.length > 0 && (
        <div className="aprov-semdia">
          <span className="aprov-semdia-lab">Sem dia definido:</span>
          {semDia.map((n) =>
            editando ? (
              <NegocioItem
                key={n.id}
                n={n}
                dia={null}
                editando
                onDia={(dia) => setRascunho((r) => ({ ...r, [n.id]: dia }))}
                onRemover={() =>
                  setRascunho((r) => {
                    const c = { ...r };
                    delete c[n.id];
                    return c;
                  })
                }
              />
            ) : (
              <a className="aprov-chip" key={n.id} href={dealUrl(n.id)} target="_blank" rel="noreferrer">
                {n.name}
              </a>
            )
          )}
        </div>
      )}

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
                  value={addId}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) setRascunho((r) => ({ ...r, [id]: null }));
                    setAddId("");
                  }}
                >
                  <option value="">Selecione…</option>
                  {disponiveis.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
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
            <button className="btn-ghost" onClick={() => setEditando(false)} disabled={busy}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={salvarEdicao} disabled={busy}>
              {busy ? "Salvando…" : "Salvar alterações"}
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={abrirEdicao} disabled={busy}>
              Editar plano
            </button>
            <button className="btn-ghost" onClick={() => setAbrirReprova((v) => !v)} disabled={busy}>
              Reprovar
            </button>
            <button
              className="btn-primary"
              onClick={() => decidir("aprovado")}
              disabled={busy || status === "aprovado"}
            >
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

function NegocioItem({ n, dia, editando, onDia, onRemover }) {
  if (!editando) {
    return (
      <a
        className={"aprov-item v-" + (TEMP_STYLE[n.temperatura] || "none")}
        href={dealUrl(n.id)}
        target="_blank"
        rel="noreferrer"
      >
        <span className="aprov-item-nome">{n.name}</span>
        <span className="aprov-item-val">{brl(n.amount)}</span>
      </a>
    );
  }
  return (
    <div className={"aprov-item edit v-" + (TEMP_STYLE[n.temperatura] || "none")}>
      <div className="aprov-item-top">
        <span className="aprov-item-nome">{n.name}</span>
        <button className="aprov-x" onClick={onRemover} title="Retirar do plano">×</button>
      </div>
      <div className="dias">
        {DIAS.map((d) => (
          <button
            key={d.v}
            type="button"
            className={"dia" + (dia === d.v ? " on" : "")}
            onClick={() => onDia(dia === d.v ? null : d.v)}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  );
}
