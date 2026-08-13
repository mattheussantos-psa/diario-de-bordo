import "server-only";
import { createPool } from "@vercel/postgres";

const CONN = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

// Sem banco configurado o painel segue funcionando; só o plano fica indisponível.
export const dbReady = () => !!CONN;

let pool;
let ready;

function getPool() {
  if (!pool) pool = createPool({ connectionString: CONN });
  return pool;
}

// Cria as tabelas na primeira consulta. ponytail: migração é isto; se o schema
// crescer, trocar por arquivos de migração versionados.
function init() {
  if (!ready) {
    const p = getPool();
    ready = (async () => {
      await p.sql`CREATE TABLE IF NOT EXISTS plans (
        owner_id TEXT NOT NULL,
        week TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'rascunho',
        motivo TEXT,
        revisado_por TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, week)
      )`;
      await p.sql`CREATE TABLE IF NOT EXISTS plan_items (
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
  await init();
  const p = getPool();
  const [plan, items] = await Promise.all([
    p.sql`SELECT status, motivo, revisado_por FROM plans WHERE owner_id=${String(ownerId)} AND week=${week}`,
    p.sql`SELECT deal_id, dia FROM plan_items WHERE owner_id=${String(ownerId)} AND week=${week}`,
  ]);
  const row = plan.rows[0];
  const map = {};
  for (const it of items.rows) map[it.deal_id] = it.dia;
  return {
    status: row?.status || "rascunho",
    motivo: row?.motivo || "",
    revisadoPor: row?.revisado_por || "",
    items: map,
  };
}

// Substitui os itens do plano e define o status.
export async function savePlan(ownerId, week, items, status) {
  await init();
  const p = getPool();
  await p.sql`INSERT INTO plans (owner_id, week, status, updated_at)
    VALUES (${String(ownerId)}, ${week}, ${status}, now())
    ON CONFLICT (owner_id, week) DO UPDATE SET status=${status}, updated_at=now()`;
  await p.sql`DELETE FROM plan_items WHERE owner_id=${String(ownerId)} AND week=${week}`;

  // Um único INSERT com todos os itens — evita dezenas de round-trips por envio.
  const entries = Object.entries(items);
  if (entries.length) {
    const tuples = entries.map((_, i) => `($1, $2, $${i * 2 + 3}, $${i * 2 + 4})`).join(",");
    const params = [
      String(ownerId),
      week,
      ...entries.flatMap(([dealId, dia]) => [String(dealId), dia ?? null]),
    ];
    await p.query(`INSERT INTO plan_items (owner_id, week, deal_id, dia) VALUES ${tuples}`, params);
  }
}

export async function reviewPlan(ownerId, week, status, motivo, revisor) {
  await init();
  const p = getPool();
  await p.sql`INSERT INTO plans (owner_id, week, status, motivo, revisado_por, updated_at)
    VALUES (${String(ownerId)}, ${week}, ${status}, ${motivo || null}, ${revisor}, now())
    ON CONFLICT (owner_id, week) DO UPDATE
    SET status=${status}, motivo=${motivo || null}, revisado_por=${revisor}, updated_at=now()`;
}
