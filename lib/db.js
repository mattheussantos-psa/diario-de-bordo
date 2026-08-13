import "server-only";
import { neon } from "@neondatabase/serverless";
import { buildItemsInsert } from "./plan-insert";

// O Neon injeta DATABASE_URL; POSTGRES_URL cobre o naming legado da Vercel.
// Driver nativo do Neon: aceita tanto a string pooled quanto a direta.
const CONN = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

// Sem banco configurado o painel segue funcionando; só o plano fica indisponível.
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
      await sql`CREATE TABLE IF NOT EXISTS plans (
        owner_id TEXT NOT NULL,
        week TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'rascunho',
        motivo TEXT,
        revisado_por TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, week)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS plan_items (
        owner_id TEXT NOT NULL,
        week TEXT NOT NULL,
        deal_id TEXT NOT NULL,
        dia SMALLINT,
        PRIMARY KEY (owner_id, week, deal_id)
      )`;
    })();
  }
  return ready;
}

// { status, motivo, revisadoPor, items: { [dealId]: dia|null } }
export async function getPlan(ownerId, week) {
  if (!dbReady()) return null;
  try {
    await init();
    const sql = db();
    const [plan, items] = await Promise.all([
      sql`SELECT status, motivo, revisado_por FROM plans WHERE owner_id=${String(ownerId)} AND week=${week}`,
      sql`SELECT deal_id, dia FROM plan_items WHERE owner_id=${String(ownerId)} AND week=${week}`,
    ]);
    const row = plan[0];
    const map = {};
    for (const it of items) map[it.deal_id] = it.dia;
    return {
      status: row?.status || "rascunho",
      motivo: row?.motivo || "",
      revisadoPor: row?.revisado_por || "",
      items: map,
    };
  } catch (e) {
    // Banco indisponível não derruba o painel: só esconde o plano.
    console.error("[plano] falha ao ler:", e?.message);
    return null;
  }
}

// Todos os planos da semana (para a tela de aprovações do gestor).
export async function getWeekPlans(week) {
  if (!dbReady()) return [];
  try {
    await init();
    const sql = db();
    const [plans, items] = await Promise.all([
      sql`SELECT owner_id, status, motivo, revisado_por FROM plans WHERE week=${week}`,
      sql`SELECT owner_id, deal_id, dia FROM plan_items WHERE week=${week}`,
    ]);
    const byOwner = {};
    for (const p of plans) {
      byOwner[p.owner_id] = {
        ownerId: p.owner_id,
        status: p.status,
        motivo: p.motivo || "",
        revisadoPor: p.revisado_por || "",
        items: {},
      };
    }
    for (const it of items) {
      if (byOwner[it.owner_id]) byOwner[it.owner_id].items[it.deal_id] = it.dia;
    }
    return Object.values(byOwner);
  } catch (e) {
    console.error("[plano] falha ao listar semana:", e?.message);
    return [];
  }
}

// Substitui os itens do plano e define o status.
export async function savePlan(ownerId, week, items, status) {
  await init();
  const sql = db();
  await sql`INSERT INTO plans (owner_id, week, status, updated_at)
    VALUES (${String(ownerId)}, ${week}, ${status}, now())
    ON CONFLICT (owner_id, week) DO UPDATE SET status=${status}, updated_at=now()`;
  await sql`DELETE FROM plan_items WHERE owner_id=${String(ownerId)} AND week=${week}`;

  // Um único INSERT com todos os itens — evita dezenas de round-trips por envio.
  const ins = buildItemsInsert(ownerId, week, items);
  if (ins) await sql.query(ins.text, ins.params);
}

export async function reviewPlan(ownerId, week, status, motivo, revisor) {
  await init();
  const sql = db();
  await sql`INSERT INTO plans (owner_id, week, status, motivo, revisado_por, updated_at)
    VALUES (${String(ownerId)}, ${week}, ${status}, ${motivo || null}, ${revisor}, now())
    ON CONFLICT (owner_id, week) DO UPDATE
    SET status=${status}, motivo=${motivo || null}, revisado_por=${revisor}, updated_at=now()`;
}
