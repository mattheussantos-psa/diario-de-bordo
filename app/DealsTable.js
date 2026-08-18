"use client";

import { useMemo, useState } from "react";
import { TEMP_STYLE } from "../lib/config";
import { ESTRATEGIAS, numeroDa } from "../lib/estrategias";

const STATUS_LABEL = {
  rascunho: "Rascunho",
  enviado: "Aguardando aprovação",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

export default function DealsTable({ deals, options, closerName, emptyLabel, briefing, ctx, seg = "B2B" }) {
  const estrategias = ESTRATEGIAS[seg] || [];
  const [rows, setRows] = useState(() => deals.map((d) => ({ ...d, _obs: d.observacoes })));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [page, setPage] = useState(0);

  // Briefing do dia: { [dealId]: { de, para } }. Ausente = fora do briefing.
  const [items, setItems] = useState(() => ({ ...(briefing?.items || {}) }));
  const [status, setStatus] = useState(briefing?.status || "rascunho");
  const [briefMsg, setBriefMsg] = useState(null);
  const [briefBusy, setBriefBusy] = useState(false);

  const aprovado = status === "aprovado";
  const isAdmin = !!ctx?.isAdmin;
  // Aprovado, o closer só acompanha; o admin continua ajustando.
  const podeEditar = ctx?.ownerId && ctx?.dbReady && (!aprovado || isAdmin);
  const total = Object.keys(items).length;

  const PAGE_SIZE = 10;
  // Fechado o briefing, o que será trabalhado hoje vem primeiro.
  const ordered = useMemo(() => {
    if (status !== "aprovado") return rows;
    const dentro = (r) => r.id in items;
    return [...rows].sort((a, b) => (dentro(a) === dentro(b) ? 0 : dentro(a) ? -1 : 1));
  }, [rows, items, status]);

  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const visible = ordered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const dirty = useMemo(() => rows.filter((r) => r._obs !== r.observacoes), [rows]);

  // Estratégia e evolução são obrigatórias para enviar.
  const incompletos = useMemo(
    () => Object.entries(items).filter(([, v]) => !v.para || !v.estrategia).map(([id]) => id),
    [items]
  );
  const falta = (id) => incompletos.includes(String(id));

  function toggle(r) {
    setItems((it) => {
      const next = { ...it };
      if (r.id in next) delete next[r.id];
      // "de" congela a temperatura de hoje; "para" o closer escolhe.
      else next[r.id] = { de: r.temperatura || "", para: "", estrategia: "" };
      return next;
    });
    setBriefMsg(null);
  }

  function setPara(id, para) {
    setItems((it) => ({ ...it, [id]: { ...it[id], para } }));
    setBriefMsg(null);
  }

  function setEstrategia(id, estrategia) {
    setItems((it) => ({ ...it, [id]: { ...it[id], estrategia } }));
    setBriefMsg(null);
  }

  async function salvarObs() {
    setSaving(true);
    setMsg(null);
    try {
      await Promise.all(
        dirty.map((r) =>
          fetch(`/api/deals/${r.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ observacoes: r._obs }),
          }).then((res) => {
            if (!res.ok) throw new Error();
          })
        )
      );
      setRows((rs) => rs.map((r) => ({ ...r, observacoes: r._obs })));
      setMsg({ ok: true, text: "Observações salvas no HubSpot ✓" });
    } catch {
      setMsg({ ok: false, text: "Erro ao salvar. Tente de novo." });
    } finally {
      setSaving(false);
    }
  }

  async function enviarBriefing() {
    setBriefBusy(true);
    setBriefMsg(null);
    try {
      const res = await fetch("/api/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: ctx.ownerId, dia: ctx.dia, items, manterStatus: isAdmin }),
      });
      if (!res.ok) throw new Error();
      if (!isAdmin) setStatus("enviado");
      setBriefMsg({ ok: true, text: isAdmin ? "Briefing atualizado ✓" : "Briefing enviado ✓" });
    } catch {
      setBriefMsg({ ok: false, text: "Erro ao enviar o briefing." });
    } finally {
      setBriefBusy(false);
    }
  }

  const label = (v) => options.find((o) => o.value === v)?.label || v;

  return (
    <div className="card">
      {aprovado && !isAdmin && ctx?.ownerId && (
        <div className="planbar st-aprovado">
          <div className="planbar-info">
            <span className="plan-badge">Briefing aprovado</span>
            <span className="plan-week">{ctx.diaLabel}</span>
            <span className="plan-count"><b>{total}</b> negócio{total === 1 ? "" : "s"} para hoje</span>
          </div>
        </div>
      )}

      {podeEditar && (
        <div className={"planbar st-" + status}>
          <div className="planbar-info">
            <span className="plan-badge">{STATUS_LABEL[status]}</span>
            <span className="plan-week">{ctx.diaLabel}</span>
            <span className="plan-count"><b>{total}</b> negócio{total === 1 ? "" : "s"} para hoje</span>
            {incompletos.length > 0 && (
              <span className="plan-motivo">
                {incompletos.length} sem estratégia ou evolução
              </span>
            )}
            {status === "reprovado" && briefing?.motivo && (
              <span className="plan-motivo">Motivo: {briefing.motivo}</span>
            )}
          </div>
          <div className="planbar-actions">
            {briefMsg && <span className={briefMsg.ok ? "saved" : "err"}>{briefMsg.text}</span>}
            <button
              className="btn-primary"
              onClick={enviarBriefing}
              disabled={briefBusy || incompletos.length > 0 || (!isAdmin && total === 0)}
              title={
                incompletos.length > 0
                  ? "Defina estratégia e evolução em todos os negócios marcados"
                  : undefined
              }
            >
              {briefBusy
                ? "Salvando…"
                : isAdmin
                ? "Salvar briefing do closer"
                : status === "rascunho"
                ? "Enviar briefing do dia"
                : "Reenviar briefing"}
            </button>
          </div>
        </div>
      )}

      <div className="tscroll">
        <table>
          <thead>
            <tr>
              {podeEditar && <th style={{ width: "11%" }}>Atuar hoje</th>}
              <th style={{ width: "18%" }}>Nome do negócio</th>
              <th style={{ width: "11%" }}>Etapa atual</th>
              <th style={{ width: "13%" }}>Próxima atividade</th>
              <th style={{ width: "18%" }}>Estratégia</th>
              <th style={{ width: "17%" }}>Evolução pretendida</th>
              <th style={{ width: "12%" }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const item = items[r.id];
              const dentro = !!item;
              return (
                <tr key={r.id} className={dentro ? "in-plan" + (falta(r.id) ? " incompleto" : "") : ""}>
                  {podeEditar && (
                    <td>
                      <label className="plan-check">
                        <input type="checkbox" checked={dentro} onChange={() => toggle(r)} />
                        <span>Atuar</span>
                      </label>
                    </td>
                  )}
                  <td className="deal">
                    {dentro && <span className="plan-flag">Hoje</span>}
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
                    {/* Estratégia que o closer vai usar neste negócio hoje. */}
                    {dentro && podeEditar ? (
                      <div className="select-wrap">
                        <select
                          className={"estrat-select" + (!item.estrategia ? " falta" : "")}
                          value={item.estrategia || ""}
                          onChange={(e) => setEstrategia(r.id, e.target.value)}
                        >
                          <option value="">Escolher estratégia…</option>
                          {estrategias.map((e) => (
                            <option key={e.id} value={e.id} title={e.desc}>
                              {numeroDa(e.id)}. {e.titulo}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : dentro && item.estrategia ? (
                      <span className="estrat-tag" title={estrategias.find((e) => e.id === item.estrategia)?.desc}>
                        <b>{numeroDa(item.estrategia)}</b>
                        {estrategias.find((e) => e.id === item.estrategia)?.titulo || ""}
                      </span>
                    ) : (
                      <span className="evo-vazio">—</span>
                    )}
                  </td>
                  <td>
                    {/* Empilhado com rótulos: na coluna estreita, a seta solta
                        parecia quebra de linha acidental. */}
                    <div className="evo">
                      <div className="evo-linha">
                        <span className="evo-lab">de</span>
                        <span className={"temp-atual t-" + (TEMP_STYLE[r.temperatura] || "none")}>
                          {r.temperatura ? label(r.temperatura) : "sem temperatura"}
                        </span>
                      </div>
                      <div className="evo-linha">
                        <span className="evo-lab">para</span>
                        {dentro && podeEditar ? (
                          <div className={"act" + (!item.para ? " falta" : "")} data-v={TEMP_STYLE[item.para] || ""}>
                            <select value={item.para} onChange={(e) => setPara(r.id, e.target.value)}>
                              <option value="">definir…</option>
                              {options
                                .filter((o) => o.value !== r.temperatura)
                                .map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : dentro && item.para ? (
                          <span className={"temp-alvo t-" + (TEMP_STYLE[item.para] || "none")}>
                            {label(item.para)}
                          </span>
                        ) : (
                          <span className="evo-vazio">—</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <textarea
                      className="obs"
                      placeholder="Escrever observação…"
                      value={r._obs}
                      onChange={(e) => {
                        const v = e.target.value;
                        setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, _obs: v } : x)));
                        setMsg(null);
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={podeEditar ? 7 : 6} style={{ textAlign: "center", color: "var(--muted)", padding: "40px" }}>
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
          <button className="save" onClick={salvarObs} disabled={saving || dirty.length === 0}>
            {saving ? "Salvando…" : dirty.length ? `Salvar observações (${dirty.length})` : "Tudo salvo"}
          </button>
        </div>
      </div>
    </div>
  );
}
