"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function AdminBar({ owners, selected, seg }) {
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
      </div>
    </div>
  );
}
