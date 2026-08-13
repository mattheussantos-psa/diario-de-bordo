"use client";

import { useMemo, useState } from "react";
import { TEMP_STYLE } from "../lib/config";
import { DIAS } from "../lib/week";

const STATUS_LABEL = {
  rascunho: "Rascunho",
  enviado: "Aguardando aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export default function DealsTable({ deals, options, closerName, emptyLabel, plan, planCtx }) {
  const [rows, setRows] = useState(() =>
    deals.map((d) => ({ ...d, _temp: d.temperatura, _obs: d.observacoes }))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {ok:bool, text}
  const [page, setPage] = useState(0);

  // Plano da semana: { [dealId]: dia|null }. Ausente = fora do plano.
  const [items, setItems] = useState(() => ({ ...(plan?.items || {}) }));
  const [status, setStatus] = useState(plan?.status || "rascunho");
  const [motivo, setMotivo] = useState(plan?.motivo || "");
  const [showReprova, setShowReprova] = useState(false);
  const [planMsg, setPlanMsg] = useState(null);
  const [planBusy, setPlanBusy] = useState(false);

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const visible = rows.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const dirty = useMemo(
    () => rows.filter((r) => r._temp !== r.temperatura || r._obs !== r.observacoes),
    [rows]
  );
  const planCount = Object.keys(items).length;
  const canPlan = planCtx?.ownerId && planCtx?.dbReady;
  const locked = status === "aprovado" && !planCtx?.isAdmin;

  function edit(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setMsg(null);
  }

  function togglePlan(id) {
    setItems((it) => {
      const next = { ...it };
      if (id in next) delete next[id];
      else next[id] = null;
      return next;
    });
    setPlanMsg(null);
  }

  function setDia(id, dia) {
    setItems((it) => ({ ...it, [id]: dia === "" ? null : Number(dia) }));
    setPlanMsg(null);
  }

  async function saveAll() {
    setSaving(true);
    setMsg(null);
    try {
      await Promise.all(
        dirty.map((r) =>
          fetch(`/api/deals/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ temperatura_atual: r._temp, observacoes: r._obs }),
          }).then((res) => {
            if (!res.ok) throw new Error();
          })
        )
      );
      setRows((rs) => rs.map((r) => ({ ...r, temperatura: r._temp, observacoes: r._obs })));
      setMsg({ ok: true, text: "Salvo no HubSpot ✓" });
    } catch {
      setMsg({ ok: false, text: "Erro ao salvar. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  async function enviarPlano() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: planCtx.ownerId, week: planCtx.week, items }),
      });
      if (!res.ok) throw new Error();
      setStatus("enviado");
      setPlanMsg({ ok: true, text: "Plano enviado para aprovação ✓" });
    } catch {
      setPlanMsg({ ok: false, text: "Erro ao enviar o plano." });
    } finally {
      setPlanBusy(false);
    }
  }

  async function revisar(novoStatus) {
    if (novoStatus === "reprovado" && !motivo.trim()) {
      setPlanMsg({ ok: false, text: "Escreva o motivo da reprovação." });
      return;
    }
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      // Guarda eventuais ajustes do supervisor antes de decidir.
      await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: planCtx.ownerId, week: planCtx.week, items }),
      });
      const res = await fetch("/api/plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: planCtx.ownerId,
          week: planCtx.week,
          status: novoStatus,
          motivo,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus(novoStatus);
      setShowReprova(false);
      setPlanMsg({ ok: true, text: novoStatus === "aprovado" ? "Plano aprovado ✓" : "Plano reprovado ✓" });
    } catch {
      setPlanMsg({ ok: false, text: "Erro ao registrar a decisão." });
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <div className="card">
      {canPlan && (
        <div className={"planbar st-" + status}>
          <div className="planbar-info">
            <span className="plan-badge">{STATUS_LABEL[status]}</span>
            <span className="plan-week">Semana {planCtx.weekLabel}</span>
            <span className="plan-count">
              <b>{planCount}</b> negócio{planCount === 1 ? "" : "s"} no plano
            </span>
            {status === "reprovado" && plan?.motivo && (
              <span className="plan-motivo">Motivo: {plan.motivo}</span>
            )}
          </div>
          <div className="planbar-actions">
            {planMsg && <span className={planMsg.ok ? "saved" : "err"}>{planMsg.text}</span>}
            {planCtx.isAdmin ? (
              <>
                <button className="btn-ghost" onClick={() => setShowReprova((v) => !v)} disabled={planBusy}>
                  Reprovar
                </button>
                <button className="btn-primary" onClick={() => revisar("aprovado")} disabled={planBusy}>
                  {planBusy ? "…" : "Aprovar plano"}
                </button>
              </>
            ) : (
              <button className="btn-primary" onClick={enviarPlano} disabled={planBusy || locked}>
                {planBusy ? "Enviando…" : status === "rascunho" ? "Enviar plano da semana" : "Reenviar plano"}
              </button>
            )}
          </div>
          {showReprova && planCtx.isAdmin && (
            <div className="reprova">
              <input
                className="reprova-input"
                placeholder="Motivo da reprovação…"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <button className="btn-danger" onClick={() => revisar("reprovado")} disabled={planBusy}>
                Confirmar reprovação
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tscroll">
        <table>
          <thead>
            <tr>
              {canPlan && <th style={{ width: "17%" }}>Plano da semana</th>}
              <th style={{ width: "19%" }}>Nome do negócio</th>
              <th style={{ width: "13%" }}>Etapa atual</th>
              <th style={{ width: "15%" }}>Próxima atividade</th>
              <th style={{ width: "18%" }}>Evolução buscada</th>
              <th style={{ width: "18%" }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id} className={r.id in items ? "in-plan" : ""}>
                {canPlan && (
                  <td>
                    <label className="plan-check">
                      <input
                        type="checkbox"
                        checked={r.id in items}
                        onChange={() => togglePlan(r.id)}
                        disabled={locked}
                      />
                      <span>Vou trabalhar</span>
                    </label>
                    {r.id in items && (
                      <div className="dias" role="group" aria-label="Dia da semana">
                        {DIAS.map((d) => (
                          <button
                            key={d.v}
                            type="button"
                            className={"dia" + (items[r.id] === d.v ? " on" : "")}
                            onClick={() => setDia(r.id, items[r.id] === d.v ? "" : d.v)}
                            disabled={locked}
                            aria-pressed={items[r.id] === d.v}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                )}
                <td className="deal">
                  <a className="deal-link" href={r.url} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                  <small>{r.amountText}</small>
                </td>
                <td>
                  <span className="stage">
                    <span className={"dot" + (r.adv ? " adv" : "")} />
                    {r.stageLabel}
                  </span>
                </td>
                <td>
                  <div className="next">
                    <span className={"date" + (r.next.none ? " none" : "")}>
                      {r.next.dateText}
                      {r.next.pill && (
                        <span className={"pill-date " + r.next.pill.cls}>{r.next.pill.text}</span>
                      )}
                    </span>
                    {r.nextStep && <span className="activity">{r.nextStep}</span>}
                  </div>
                </td>
                <td>
                  <div className="act" data-v={TEMP_STYLE[r._temp] || ""}>
                    <select value={r._temp} onChange={(e) => edit(r.id, { _temp: e.target.value })}>
                      <option value="">— definir —</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>
                  <textarea
                    className="obs"
                    placeholder="Escrever observação…"
                    value={r._obs}
                    onChange={(e) => edit(r.id, { _obs: e.target.value })}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canPlan ? 6 : 5} style={{ textAlign: "center", color: "var(--muted)", padding: "40px" }}>
                  {emptyLabel || "Nenhum negócio ativo no funil."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="foot">
        <span>
          {rows.length} negócio{rows.length === 1 ? "" : "s"}
          {closerName ? ` · ${closerName}` : ""}
          {msg && <> · <span className={msg.ok ? "saved" : "err"}>{msg.text}</span></>}
        </span>
        <div className="foot-actions">
          {pageCount > 1 && (
            <div className="pager">
              <button onClick={() => setPage(pageSafe - 1)} disabled={pageSafe === 0}>‹</button>
              <span>Página {pageSafe + 1} de {pageCount}</span>
              <button onClick={() => setPage(pageSafe + 1)} disabled={pageSafe >= pageCount - 1}>›</button>
            </div>
          )}
          <button className="save" onClick={saveAll} disabled={saving || dirty.length === 0}>
            {saving ? "Salvando…" : dirty.length ? `Salvar diário do dia (${dirty.length})` : "Tudo salvo"}
          </button>
        </div>
      </div>
    </div>
  );
}
