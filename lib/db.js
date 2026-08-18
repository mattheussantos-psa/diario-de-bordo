import "server-only";
import { neon } from "@neondatabase/serverless";

// O Neon injeta DATABASE_URL; POSTGRES_URL cobre o naming legado da Vercel.
const CONN = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// Sem banco configurado o painel segue funcionando; só o briefing fica indisponível.
export const dbReady = () => !!CONN;

let client;
let ready;

function db() {
  if (!client) client = neon(CONN);
  return client;
}

// Cria as tabelas na primeira consulta. ponytail: migração é isto; se o schema
// crescer, trocar por arquivos de migração versionados.
function init() {
  if (!ready) {
    const sql = db();
    ready = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS briefings (
        owner_id TEXT NOT NULL,
        dia DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'rascunho',
        motivo TEXT,
        revisado_por TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, dia)
      )`;
      // "de" guarda a temperatura no momento do briefing; "para", a pretendida.
      await sql`CREATE TABLE IF NOT EXISTS briefing_items (
        owner_id TEXT NOT NULL,
        dia DATE NOT NULL,
        deal_id TEXT NOT NULL,
        de TEXT,
        para TEXT,
        estrategia TEXT,
        PRIMARY KEY (owner_id, dia, deal_id)
      )`;
      // Tabela criada antes do campo estratégia continua válida.
      await sql`ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS estrategia TEXT`;
    })();
  }
  return ready;
}

// { status, motivo, revisadoPor, items: { [dealId]: {de, para} } }
export async function getBriefing(ownerId, dia) {
  if (!dbReady()) return null;
  try {
    await init();
    const sql = db();
    const [cab, itens] = await Promise.all([
      sql`SELECT status, motivo, revisado_por FROM briefings WHERE owner_id=${String(ownerId)} AND dia=${dia}`,
      sql`SELECT deal_id, de, para, estrategia FROM briefing_items WHERE owner_id=${String(ownerId)} AND dia=${dia}`,
    ]);
    const row = cab[0];
    const items = {};
    for (const it of itens) items[it.deal_id] = { de: it.de || "", para: it.para || "", estrategia: it.estrategia || "" };
    // Sem registro e sem itens, o closer ainda não enviou nada hoje.
    const existe = !!row || itens.length > 0;
    return {
      // Gravado = enviado. "rascunho" só existe antes do primeiro envio, e
      // registros legados com esse status ficariam invisíveis na aprovação.
      status: existe ? semRascunho(row?.status) : "rascunho",
      motivo: row?.motivo || "",
      revisadoPor: row?.revisado_por || "",
      items,
    };
  } catch (e) {
    console.error("[briefing] falha ao ler:", e?.message);
    return null;
  }
}

// Briefings de um dia (tela de aprovações).
export async function getDayBriefings(dia) {
  if (!dbReady()) return [];
  try {
    await init();
    const sql = db();
    const [cab, itens] = await Promise.all([
      sql`SELECT owner_id, status, motivo, revisado_por FROM briefings WHERE dia=${dia}`,
      sql`SELECT owner_id, deal_id, de, para, estrategia FROM briefing_items WHERE dia=${dia}`,
    ]);
    const porOwner = {};
    for (const c of cab) {
      porOwner[c.owner_id] = {
        ownerId: c.owner_id,
        status: semRascunho(c.status),
        motivo: c.motivo || "",
        revisadoPor: c.revisado_por || "",
        items: {},
      };
    }
    for (const it of itens) {
      if (porOwner[it.owner_id]) {
        porOwner[it.owner_id].items[it.deal_id] = { de: it.de || "", para: it.para || "", estrategia: it.estrategia || "" };
      }
    }
    return Object.values(porOwner);
  } catch (e) {
    console.error("[briefing] falha ao listar dia:", e?.message);
    return [];
  }
}

// Briefings de vários dias (agenda geral da semana).
export async function getBriefingsForDays(dias) {
  if (!dbReady() || dias.length === 0) return [];
  try {
    await init();
    const sql = db();
    const [cab, itens] = await Promise.all([
      sql`SELECT owner_id, dia, status FROM briefings WHERE dia = ANY(${dias}::date[])`,
      sql`SELECT owner_id, dia, deal_id, de, para, estrategia FROM briefing_items WHERE dia = ANY(${dias}::date[])`,
    ]);
    const chave = (o, d) => `${o}|${toKey(d)}`;
    const mapa = {};
    for (const c of cab) {
      mapa[chave(c.owner_id, c.dia)] = {
        ownerId: c.owner_id,
        dia: toKey(c.dia),
        status: semRascunho(c.status),
        items: {},
      };
    }
    for (const it of itens) {
      const k = chave(it.owner_id, it.dia);
      mapa[k] ||= { ownerId: it.owner_id, dia: toKey(it.dia), status: "enviado", items: {} };
      mapa[k].items[it.deal_id] = { de: it.de || "", para: it.para || "", estrategia: it.estrategia || "" };
    }
    return Object.values(mapa);
  } catch (e) {
    console.error("[briefing] falha ao listar semana:", e?.message);
    return [];
  }
}

const semRascunho = (s) => (!s || s === "rascunho" ? "enviado" : s);

// O driver devolve DATE como Date; a UI trabalha com "YYYY-MM-DD".
function toKey(d) {
  if (typeof d === "string") return d.slice(0, 10);
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Histórico: todos os dias registrados, do mais recente para trás. Inclui o dia
// atual — restrito a dias anteriores, ficava vazio no começo do uso.
export async function getBriefingHistory(_diaAtual, limit = 200) {
  if (!dbReady()) return [];
  try {
    await init();
    const sql = db();
    const rows = await sql`
      SELECT b.owner_id, b.dia, b.status, b.motivo, b.revisado_por,
        (SELECT COUNT(*) FROM briefing_items i WHERE i.owner_id = b.owner_id AND i.dia = b.dia) AS n
      FROM briefings b
      ORDER BY b.dia DESC, b.owner_id
      LIMIT ${limit}`;
    return rows.map((r) => ({
      ownerId: r.owner_id,
      dia: toKey(r.dia),
      status: semRascunho(r.status),
      motivo: r.motivo || "",
      revisadoPor: r.revisado_por || "",
      negocios: Number(r.n) || 0,
    }));
  } catch (e) {
    console.error("[briefing] falha no histórico:", e?.message);
    return [];
  }
}

// Substitui os itens do briefing. status null preserva o atual.
export async function saveBriefing(ownerId, dia, items, status) {
  await init();
  const sql = db();
  // status null = o gestor está apenas ajustando: preserva a situação, exceto
  // quando ainda é rascunho — aí o briefing precisa entrar na fila de aprovação,
  // senão fica invisível para todo mundo.
  await sql`INSERT INTO briefings (owner_id, dia, status, updated_at)
    VALUES (${String(ownerId)}, ${dia}, COALESCE(${status}, 'enviado'), now())
    ON CONFLICT (owner_id, dia) DO UPDATE
    SET status = COALESCE(${status}, NULLIF(briefings.status, 'rascunho'), 'enviado'),
        updated_at = now()`;
  await sql`DELETE FROM briefing_items WHERE owner_id=${String(ownerId)} AND dia=${dia}`;

  const entries = Object.entries(items);
  if (entries.length) {
    const ids = entries.map(([id]) => String(id));
    const des = entries.map(([, v]) => v?.de || null);
    const paras = entries.map(([, v]) => v?.para || null);
    const estrats = entries.map(([, v]) => v?.estrategia || null);
    await sql`INSERT INTO briefing_items (owner_id, dia, deal_id, de, para, estrategia)
      SELECT ${String(ownerId)}, ${dia}, d, x, y, z
      FROM unnest(${ids}::text[], ${des}::text[], ${paras}::text[], ${estrats}::text[]) AS t(d, x, y, z)`;
  }
}

export async function reviewBriefing(ownerId, dia, status, motivo, revisor) {
  await init();
  const sql = db();
  await sql`INSERT INTO briefings (owner_id, dia, status, motivo, revisado_por, updated_at)
    VALUES (${String(ownerId)}, ${dia}, ${status}, ${motivo || null}, ${revisor}, now())
    ON CONFLICT (owner_id, dia) DO UPDATE
    SET status=${status}, motivo=${motivo || null}, revisado_por=${revisor}, updated_at=now()`;
}
