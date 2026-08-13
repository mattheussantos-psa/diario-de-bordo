"use client";

import { useMemo, useState } from "react";
import { TEMP_STYLE } from "../lib/config";

export default function DealsTable({ deals, options, closerName, emptyLabel }) {
  const [rows, setRows] = useState(() =>
    deals.map((d) => ({ ...d, _temp: d.temperatura, _obs: d.observacoes }))
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {ok:bool, text}
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const visible = rows.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  const dirty = useMemo(
    () => rows.filter((r) => r._temp !== r.temperatura || r._obs !== r.observacoes),
    [rows]
  );

  function edit(id, patch) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setMsg(null);
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

  return (
    <div className="card">
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              <th style={{ width: "24%" }}>Nome do negócio</th>
              <th style={{ width: "18%" }}>Etapa atual</th>
              <th style={{ width: "17%" }}>Próxima atividade</th>
              <th style={{ width: "20%" }}>Evolução buscada</th>
              <th style={{ width: "23%" }}>Observação</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
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
                    <select
                      value={r._temp}
                      onChange={(e) => edit(r.id, { _temp: e.target.value })}
                    >
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
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: "40px" }}>
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
