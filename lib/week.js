// Chave do briefing: um dia. "2026-08-14".
export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Último dia útil antes da data: na segunda, volta para a sexta.
export function diaUtilAnterior(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(date + "T12:00:00");
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return dayKey(d);
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
