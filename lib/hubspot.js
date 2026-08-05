import "server-only";

const BASE = "https://api.hubapi.com";

function token() {
  const t = process.env.HUBSPOT_TOKEN;
  if (!t) throw new Error("HUBSPOT_TOKEN não configurado no ambiente.");
  return t;
}

async function hs(path, init = {}) {
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
    throw new Error(`HubSpot ${res.status} em ${path}: ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
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

async function enumProp(prop) {
  const d = await hs(`/crm/v3/properties/deals/${prop}`);
  const map = {};
  (d.options || []).forEach((o) => (map[o.value] = o.label));
  return { map, options: d.options || [] };
}

export async function getTemperaturaOptions() {
  return (await enumProp("temperatura_atual")).options;
}

const DEAL_PROPS = [
  "dealname",
  "amount",
  "pipeline",
  "dealstage",
  "hs_next_activity_date",
  "temperatura_atual",
  "observacoes",
];

// Estágios ABERTOS (isClosed=false) e rótulos corretos por pipeline.
// Mais confiável que hs_is_closed em pipelines customizadas.
async function getStagesInfo(pipelineIds) {
  const d = await hs(`/crm/v3/pipelines/deals`);
  const openStageIds = [];
  const labelById = {};
  for (const p of d.results || []) {
    if (!pipelineIds.includes(p.id)) continue;
    for (const s of p.stages || []) {
      labelById[s.id] = s.label;
      const closed = s.metadata?.isClosed;
      if (closed !== "true" && closed !== true) openStageIds.push(s.id);
    }
  }
  return { openStageIds, labelById };
}

export async function getOpenDeals(ownerId, pipelineIds) {
  const { openStageIds, labelById } = await getStagesInfo(pipelineIds);
  if (openStageIds.length === 0) return [];
  const out = [];
  let after;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "hubspot_owner_id", operator: "EQ", value: String(ownerId) },
            { propertyName: "dealstage", operator: "IN", values: openStageIds },
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
        nextActivity: p.hs_next_activity_date || null,
        temperatura: p.temperatura_atual || "",
        observacoes: p.observacoes || "",
      });
    }
    after = d.paging?.next?.after;
  } while (after);
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
