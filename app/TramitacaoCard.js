"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RESULTADOS_TRAMITACAO, TRAMITACAO_EXIGE_OBSERVACAO } from "../lib/tramitacoes";

const SELO = {
  aguardando: { txt: "Aguardando líder", cls: "aguardando" },
  devolvido: { txt: "Devolvida pelo líder", cls: "devolvido" },
};

function prazoTexto(faltam) {
  if (faltam < 0) return `${Math.abs(faltam)} dia${Math.abs(faltam) === 1 ? "" : "s"} em atraso`;
  if (faltam === 0) return "vence hoje";
  return `faltam ${faltam} dia${faltam === 1 ? "" : "s"}`;
}

export default function TramitacaoCard({ p, ticket, ehGestor, evolucao }) {
  const router = useRouter();
  const [resultado, setResultado] = useState(evolucao?.resultado || "");
  const [obsEvo, setObsEvo] = useState(evolucao?.observacao || "");
  const [evoSalva, setEvoSalva] = useState(!!evolucao?.resultado);
  const [evoErro, setEvoErro] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [abrirDevolver, setAbrirDevolver] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function registrarEvolucao() {
    setBusy(true);
    setEvoErro("");
    try {
      const res = await fetch("/api/tramitacoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: p.ticketId, tipo: p.tipo, resultado, observacao: obsEvo }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Falha ao registrar.");
      }
      setEvoSalva(true);
    } catch (e) {
      setEvoErro(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function chamar(metodo, corpo) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tramitacoes", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: p.ticketId, tipo: p.tipo, ...corpo }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Falha ao registrar.");
      }
      setAbrirDevolver(false);
      router.refresh();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const selo = SELO[p.status];

  return (
    <div className={"tram-card" + (p.atrasada ? " atrasada" : "") + (p.status === "aguardando" ? " esperando" : "")}>
      <div className="tram-topo">
        <span className="tram-tipo">{p.label}</span>
        <span className={"tram-prazo" + (p.atrasada ? " late" : p.faltam === 0 ? " hoje" : "")}>
          {prazoTexto(p.faltam)}
        </span>
      </div>

      <div className="tram-assunto">{ticket?.assunto || `Ticket ${p.ticketId}`}</div>
      <div className="tram-meta">
        <span>prazo {p.prazo.slice(8, 10)}/{p.prazo.slice(5, 7)}</span>
        {ticket?.donoNome && <span>· {ticket.donoNome}</span>}
        {selo && <span className={"tram-selo " + selo.cls}>{selo.txt}</span>}
      </div>

      {p.status === "devolvido" && p.motivo && (
        <div className="aprov-motivo">Devolvida: {p.motivo}</div>
      )}
      {p.status === "aguardando" && p.marcadoPor && (
        <div className="tram-por">marcada por {p.marcadoPor}</div>
      )}

      {/* Como andou hoje. Travado é o que sobe para o líder. */}
      <div className="tram-evo">
        <div className="fech-opcoes">
          {RESULTADOS_TRAMITACAO.map((r) => (
            <button
              key={r.key}
              className={"fech-op " + r.cls + (resultado === r.key ? " on" : "")}
              onClick={() => { setResultado(r.key); setEvoSalva(false); setEvoErro(""); }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {resultado && (
          <>
            {TRAMITACAO_EXIGE_OBSERVACAO.includes(resultado) && (
              <textarea
                className="obs"
                placeholder="O que travou? De quem depende?"
                value={obsEvo}
                onChange={(e) => { setObsEvo(e.target.value); setEvoSalva(false); }}
              />
            )}
            <div className="fech-rodape">
              {evoErro && <span className="err">{evoErro}</span>}
              {evoSalva && !evoErro && <span className="saved">registrado ✓</span>}
              <button className="btn-ghost" onClick={registrarEvolucao} disabled={busy || evoSalva}>
                {evoSalva ? "Registrado" : "Registrar evolução"}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="tram-acoes">
        {msg && <span className="err">{msg}</span>}
        {p.status === "aguardando" ? (
          ehGestor ? (
            <>
              <button className="btn-ghost" onClick={() => setAbrirDevolver((v) => !v)} disabled={busy}>
                Devolver
              </button>
              <button
                className="btn-primary"
                onClick={() => chamar("PATCH", { decisao: "confirmado" })}
                disabled={busy}
              >
                {busy ? "…" : "Confirmar baixa"}
              </button>
            </>
          ) : (
            <span className="tram-espera">esperando confirmação do líder</span>
          )
        ) : (
          <button className="btn-primary" onClick={() => chamar("POST", {})} disabled={busy}>
            {busy ? "…" : "Marcar como feito"}
          </button>
        )}
      </div>

      {abrirDevolver && (
        <div className="reprova">
          <input
            className="reprova-input"
            placeholder="Por que está voltando?"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <button
            className="btn-danger"
            onClick={() => chamar("PATCH", { decisao: "devolvido", motivo })}
            disabled={busy}
          >
            Devolver ao board
          </button>
        </div>
      )}
    </div>
  );
}
