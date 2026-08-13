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
