"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminBar({ owners, selected, seg }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [seeding, setSeeding] = useState(false);

  // ponytail: apoio para testar aprovação; remover quando o fluxo estiver validado.
  async function gerarTestes() {
    if (!confirm(`Criar cronogramas de teste para os closers ${seg}?\n\nIsso substitui o plano desta semana deles (não altera nada no HubSpot).`)) return;
    setSeeding(true);
    try {
      const res = await fetch(`/api/seed?seg=${seg}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "falhou");
      const n = (data.planos || []).filter((p) => p.negocios > 0).length;
      alert(`${n} cronograma(s) criados e aguardando aprovação.`);
      router.refresh();
    } catch (e) {
      alert("Erro ao gerar: " + e.message);
    } finally {
      setSeeding(false);
    }
  }

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
        <span className="admin-tag">Admin</span>
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
        <div className="seg-toggle">
          {["B2B", "B2C"].map((val) => (
            <button
              key={val}
              className={seg === val ? "on" : ""}
              onClick={() => nav({ seg: val })}
            >
              {val}
            </button>
          ))}
        </div>
        <button className="btn-seed" onClick={gerarTestes} disabled={seeding}>
          {seeding ? "Gerando…" : "Gerar cronogramas de teste"}
        </button>
      </div>
    </div>
  );
}
