"use client";

import { useState } from "react";
import { resumoWhatsApp } from "../lib/resumo";

// Gera o resumo do briefing aprovado para o closer mandar no WhatsApp.
export default function BotaoWhats({ closer, diaLabel, itens }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const texto = resumoWhatsApp({ closer, diaLabel, itens });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sem permissão de área de transferência: o texto fica visível para
      // seleção manual.
      setAberto(true);
    }
  }

  return (
    <div className="whats">
      <div className="whats-acoes">
        <button className="btn-whats" onClick={copiar}>
          {copiado ? "Copiado ✓" : "Copiar resumo do dia"}
        </button>
        <a
          className="btn-ghost"
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
        >
          Abrir no WhatsApp
        </a>
        <button className="whats-ver" onClick={() => setAberto((v) => !v)}>
          {aberto ? "ocultar" : "ver texto"}
        </button>
      </div>
      {aberto && <pre className="whats-previa">{texto}</pre>}
    </div>
  );
}
