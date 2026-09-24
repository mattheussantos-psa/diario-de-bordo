// Chave do briefing: um dia. "2026-08-14".
// Sempre no fuso de Brasília: o servidor da Vercel roda em UTC, e sem isso
// tudo que fosse enviado depois das 21h caía no dia seguinte.
const FUSO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function dayKey(date = new Date()) {
  return FUSO.format(new Date(date));
}

// Último dia útil antes da data: na segunda, volta para a sexta.
export function diaUtilAnterior(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(date + "T12:00:00");
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return dayKey(d);
}

// Os últimos n dias úteis terminando em "ate" (inclusive, se for dia útil).
// Fim de semana fora: barra vazia de sábado não diz nada e só espreme o resto.
export function ultimosDiasUteis(n = 10, ate = dayKey()) {
  const d = new Date(ate + "T12:00:00");
  const out = [];
  while (out.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(dayKey(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// "quinta-feira, 14/08"
export function dayLabel(dia) {
  const d = dia instanceof Date ? dia : new Date(dia + "T12:00:00");
  return `${SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Os 5 dias úteis da semana corrente, como chaves.
export function weekDays(date = new Date()) {
  const seg = mondayOf(date);
  return [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(seg);
    d.setDate(d.getDate() + i);
    return dayKey(d);
  });
}

// Semana ISO (segunda a domingo). Usada como chave do plano: "2026-W33".
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Quinta-feira da mesma semana define o ano ISO.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - jan1) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Segunda-feira da semana corrente.
export function mondayOf(date = new Date()) {
  const d = new Date(date);
  const diff = (d.getDay() || 7) - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DD = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

// "11/08 a 17/08"
export function weekLabel(date = new Date()) {
  const seg = mondayOf(date);
  const dom = new Date(seg);
  dom.setDate(dom.getDate() + 6);
  return `${DD(seg)} a ${DD(dom)}`;
}

export const DIAS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
];

// Prazo da tarefa do dia: 18h de Brasília, não do servidor. A Vercel roda em
// UTC, e "fim do dia" calculado lá cairia às 15h para quem trabalha aqui.
export function prazoDoDia(dia, hora = 18) {
  return new Date(`${dia}T${String(hora).padStart(2, "0")}:00:00-03:00`).getTime();
}

// Propriedades de data do HubSpot vêm em dois formatos, e tratar igual erra o
// dia. Data-e-hora (notes_last_updated, hs_latest_meeting_activity) é um
// instante: o dia é o de Brasília. Data pura (data_prevista_do_evento) já vem
// como meia-noite UTC e não pode ser convertida, senão o evento anda um dia
// para trás.
export function diaDeCampoHora(v) {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? new Date(String(v)) : new Date(Number(v));
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

export function diaDeCampoData(v) {
  if (!v) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const n = Number(s);
  return Number.isFinite(n) ? new Date(n).toISOString().slice(0, 10) : null;
}
