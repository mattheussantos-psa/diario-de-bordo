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

  const entries = Object.entries(plano.items);
  const total = entries.reduce((s, [id]) => s + (deals[id]?.amount || 0), 0);

  // Agrupa por dia da semana; o que não tem dia vai para o fim.
  const porDia = DIAS.map((d) => ({
    ...d,
    negocios: entries.filter(([, dia]) => dia === d.v).map(([id]) => deals[id]).filter(Boolean),
  }));
  const semDia = entries.filter(([, dia]) => !dia).map(([id]) => deals[id]).filter(Boolean);

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
              <a className={"aprov-item v-" + (TEMP_STYLE[n.temperatura] || "none")}
                 key={n.id} href={dealUrl(n.id)} target="_blank" rel="noreferrer">
                <span className="aprov-item-nome">{n.name}</span>
                <span className="aprov-item-val">{brl(n.amount)}</span>
              </a>
            ))}
          </div>
        ))}
      </div>

      {semDia.length > 0 && (
        <div className="aprov-semdia">
          <span className="aprov-semdia-lab">Sem dia definido:</span>
          {semDia.map((n) => (
            <a className="aprov-chip" key={n.id} href={dealUrl(n.id)} target="_blank" rel="noreferrer">
              {n.name}
            </a>
          ))}
        </div>
      )}

      {status === "reprovado" && plano.motivo && (
        <div className="aprov-motivo">Motivo: {plano.motivo}</div>
      )}

      <div className="aprov-acoes">
        {msg && <span className={msg.ok ? "saved" : "err"}>{msg.text}</span>}
        {plano.revisadoPor && status !== "enviado" && (
          <span className="aprov-por">por {plano.revisadoPor}</span>
        )}
        <button className="btn-ghost" onClick={() => setAbrirReprova((v) => !v)} disabled={busy}>
          Reprovar
        </button>
        <button className="btn-primary" onClick={() => decidir("aprovado")} disabled={busy || status === "aprovado"}>
          {busy ? "…" : status === "aprovado" ? "Aprovado" : "Aprovar"}
        </button>
      </div>

      {abrirReprova && (
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
