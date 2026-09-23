"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AdminBar({
  owners,
  selected,
  seg,
  segs = [],
  papel = "Admin",
  equipes = [],
  equipe = "",
  semEquipe = 0,
}) {
  const router = useRouter();
  const sp = useSearchParams();


  function nav(next) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push("/?" + p.toString());
  }

  return (
    <div className="bar">
      <div className="admin-controls">
        <span className="admin-tag">{papel}</span>
        <div className="select-wrap">
          <select
            className="closer-select"
            value={selected || ""}
            onChange={(e) => nav({ closer: e.target.value })}
          >
            <option value="">Selecione um closer…</option>
            {owners.map((o) => (
              <option key={o.ownerId} value={o.ownerId}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        {segs.length > 1 && (
        <div className="seg-toggle">
          {segs.map((val) => (
            <button
              key={val}
              className={seg === val ? "on" : ""}
              // Trocar de segmento zera a equipe: as equipes são de cada um.
              onClick={() => nav({ seg: val, equipe: "", closer: "" })}
            >
              {val}
            </button>
          ))}
        </div>
        )}

        {equipes.length > 0 && (
          <div className="seg-toggle">
            <button
              className={equipe ? "" : "on"}
              onClick={() => nav({ equipe: "", closer: "" })}
            >
              Todas
            </button>
            {equipes.map((val) => (
              <button
                key={val}
                className={equipe === val ? "on" : ""}
                onClick={() => nav({ equipe: val, closer: "" })}
              >
                {val}
              </button>
            ))}
          </div>
        )}

        {/* Sem isto, quem ficou sem equipe sumiria do filtro sem explicação. */}
        {!equipe && semEquipe > 0 && (
          <span className="plan-motivo">
            {semEquipe} sem equipe — aparecem só em “Todas”
          </span>
        )}
      </div>
    </div>
  );
}
