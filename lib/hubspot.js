import "server-only";
import { CLOSED_STAGES } from "./config";

const BASE = "https://api.hubapi.com";

function token() {
  const t = process.env.HUBSPOT_TOKEN;
  if (!t) throw new Error("HUBSPOT_TOKEN não configurado no ambiente.");
  return t;
}

async function hs(path, init = {}, tentativa = 0) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    // O HubSpot limita a busca a poucas chamadas por segundo. Esse 429 passa
    // sozinho em menos de um segundo — esperar resolve. Já o limite diário
    // não adianta retentar.
    if (res.status === 429 && tentativa < 3 && !/DAILY/i.test(body)) {
      const espera = Number(res.headers.get("Retry-After") || 0) * 1000 || 400 * (tentativa + 1);
      await new Promise((r) => setTimeout(r, espera));
      return hs(path, init, tentativa + 1);
    }
    throw new Error(`HubSpot ${res.status} em ${path}: ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
}

// Consumo diário da API. O limite vale para a conta toda — outras integrações
// da empresa dividem a mesma cota.
export async function getApiUsage() {
  const d = await hs(`/account-info/v3/api-usage/daily`);
  const linha = Array.isArray(d) ? d[0] : d?.results?.[0] || d;
  const usadas = linha?.currentUsage ?? null;
  const limite = linha?.usageLimit ?? null;
  return {
    usadas,
    limite,
    restantes: usadas != null && limite != null ? limite - usadas : null,
    percentual: usadas != null && limite ? Math.round((usadas / limite) * 1000) / 10 : null,
    reseta: linha?.collectedAt || linha?.fetchedAt || null,
    bruto: d,
  };
}

export async function getOwnerByEmail(email) {
  const data = await hs(`/crm/v3/owners?email=${encodeURIComponent(email)}`);
  const o = data.results?.[0];
  if (!o) return null;
  return { ownerId: o.id, name: `${o.firstName || ""} ${o.lastName || ""}`.trim() || email };
}

// Lista os owners (closers) ativos do HubSpot para o seletor do admin.
// ponytail: traz todos os owners; se a lista crescer demais, filtrar por quem tem deals nas pipelines de closer.
export async function getAllOwners() {
  const out = [];
  let after;
  do {
    const q = after ? `?after=${after}&limit=100` : `?limit=100`;
    const d = await hs(`/crm/v3/owners${q}`);
    for (const o of d.results || []) {
      const name = `${o.firstName || ""} ${o.lastName || ""}`.trim() || o.email;
      if (name) out.push({ ownerId: o.id, name, email: (o.email || "").toLowerCase() });
    }
    after = d.paging?.next?.after;
  } while (after);
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// Cache em memória para dados que quase não mudam (opções de propriedade, nomes
// de etapa). Sem isso, cada tela repetia as mesmas chamadas e consumia a cota
// diária da API do HubSpot.
const cache = new Map();
async function cached(chave, ttlMs, fn) {
  const hit = cache.get(chave);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v;
  const v = await fn();
  cache.set(chave, { t: Date.now(), v });
  return v;
}
const UMA_HORA = 60 * 60 * 1000;

async function enumProp(prop) {
  const d = await hs(`/crm/v3/properties/deals/${prop}`);
  const map = {};
  (d.options || []).forEach((o) => (map[o.value] = o.label));
  return { map, options: d.options || [] };
}

export async function getTemperaturaOptions() {
  return cached("temp-options", UMA_HORA, async () => (await enumProp("temperatura_atual")).options);
}

const DEAL_PROPS = [
  "dealname",
  "amount",
  "pipeline",
  "dealstage",
  "notes_next_activity_date",
  "hs_next_step",
  "temperatura_atual",
  "observacoes",
];

// Rótulos das etapas vêm da API de PIPELINES (fonte que o HubSpot usa na UI).
// A propriedade dealstage pode devolver rótulos vazios, caindo no id cru.
async function getStageLabels() {
  return cached("stage-labels", UMA_HORA, _getStageLabels);
}

async function _getStageLabels() {
  try {
    const d = await hs(`/crm/v3/pipelines/deals`);
    const m = {};
    for (const p of d.results || []) for (const s of p.stages || []) m[s.id] = s.label;
    if (Object.keys(m).length) return m;
  } catch {
    /* fallback abaixo */
  }
  return (await enumProp("dealstage")).map;
}

// withTasks=false pula a leitura de tarefas (mais rápido quando só os ids importam).
export async function getOpenDeals(ownerId, pipelineIds, { withTasks = true } = {}) {
  const labelById = await getStageLabels();
  const out = [];
  let after;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "hubspot_owner_id", operator: "EQ", value: String(ownerId) },
            { propertyName: "pipeline", operator: "IN", values: pipelineIds },
            { propertyName: "dealstage", operator: "NOT_IN", values: CLOSED_STAGES },
          ],
        },
      ],
      properties: DEAL_PROPS,
      sorts: [{ propertyName: "hs_next_activity_date", direction: "ASCENDING" }],
      limit: 100,
      ...(after ? { after } : {}),
    };
    const d = await hs(`/crm/v3/objects/deals/search`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    for (const r of d.results || []) {
      const p = r.properties;
      out.push({
        id: r.id,
        name: p.dealname || "(sem nome)",
        amount: p.amount ? Number(p.amount) : null,
        pipeline: p.pipeline,
        stageLabel: labelById[p.dealstage] || p.dealstage || "",
        nextActivity: p.notes_next_activity_date || null,
        nextStep: p.hs_next_step || "",
        temperatura: p.temperatura_atual || "",
        observacoes: p.observacoes || "",
      });
    }
    after = d.paging?.next?.after;
  } while (after);
  return withTasks ? attachOpenTasks(out) : out;
}

// Tarefas ABERTAS associadas aos negócios — a ação pendente real, incluindo as ATRASADAS.
// notes_next_activity_date só guarda atividade futura: o HubSpot limpa o campo quando a
// tarefa vence, então sozinho ele nunca acusa atraso.
// Requer o escopo crm.objects.tasks.read no App Privado; sem ele, degrada para a data nativa.
async function attachOpenTasks(deals) {
  if (deals.length === 0) return deals;
  try {
    const byDeal = {};
    for (let i = 0; i < deals.length; i += 100) {
      const chunk = deals.slice(i, i + 100);
      const r = await hs(`/crm/v4/associations/deals/tasks/batch/read`, {
        method: "POST",
        body: JSON.stringify({ inputs: chunk.map((d) => ({ id: String(d.id) })) }),
      });
      for (const row of r.results || []) {
        byDeal[row.from?.id] = (row.to || []).map((t) => String(t.toObjectId));
      }
    }

    const taskIds = [...new Set(Object.values(byDeal).flat())];
    if (taskIds.length === 0) return deals;

    const taskById = {};
    for (let i = 0; i < taskIds.length; i += 100) {
      const chunk = taskIds.slice(i, i + 100);
      const r = await hs(`/crm/v3/objects/tasks/batch/read`, {
        method: "POST",
        body: JSON.stringify({
          properties: ["hs_task_subject", "hs_task_status", "hs_timestamp"],
          inputs: chunk.map((id) => ({ id })),
        }),
      });
      for (const t of r.results || []) taskById[t.id] = t.properties;
    }

    for (const d of deals) {
      const open = (byDeal[String(d.id)] || [])
        .map((id) => taskById[id])
        .filter((t) => t && t.hs_task_status !== "COMPLETED" && t.hs_timestamp)
        .sort((a, b) => new Date(a.hs_timestamp) - new Date(b.hs_timestamp));
      if (open.length) {
        d.nextActivity = open[0].hs_timestamp;
        d.nextStep = open[0].hs_task_subject || d.nextStep;
      }
    }
  } catch {
    // Sem escopo de tarefas: mantém notes_next_activity_date (só atividades futuras).
  }
  return deals;
}

// Lê negócios por id (usado pela tela de aprovações, que parte do plano salvo).
// Dono de um negócio. Leitura direta pelo id: não passa pela API de busca,
// que é a limitada por segundo.
export async function getDealOwner(id) {
  const d = await hs(`/crm/v3/objects/deals/${id}?properties=hubspot_owner_id`);
  return d?.properties?.hubspot_owner_id || null;
}

export async function getDealsByIds(ids, { withTasks = false } = {}) {
  const out = {};
  const list = [...new Set(ids.map(String))];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const r = await hs(`/crm/v3/objects/deals/batch/read`, {
      method: "POST",
      body: JSON.stringify({
        properties: [
          "dealname",
          "amount",
          "temperatura_atual",
          "dealstage",
          "notes_next_activity_date",
          "hs_next_step",
        ],
        inputs: chunk.map((id) => ({ id })),
      }),
    });
    for (const d of r.results || []) {
      out[d.id] = {
        id: d.id,
        name: d.properties.dealname || "(sem nome)",
        amount: d.properties.amount ? Number(d.properties.amount) : null,
        temperatura: d.properties.temperatura_atual || "",
        nextActivity: d.properties.notes_next_activity_date || null,
        nextStep: d.properties.hs_next_step || "",
      };
    }
  }
  // Tarefas trazem também as atividades ATRASADAS, que a propriedade não guarda.
  if (withTasks) await attachOpenTasks(Object.values(out));
  return out;
}

export async function updateDeal(id, { temperatura_atual, observacoes }) {
  const properties = {};
  if (temperatura_atual !== undefined) properties.temperatura_atual = temperatura_atual;
  if (observacoes !== undefined) properties.observacoes = observacoes;
  return hs(`/crm/v3/objects/deals/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}
