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

export async function getOpenDeals(ownerId, pipelineIds) {
  const stage = await enumProp("dealstage");
  const out = [];
  let after;
  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "hubspot_owner_id", operator: "EQ", value: String(ownerId) },
            { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
            { propertyName: "pipeline", operator: "IN", values: pipelineIds },
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
        stageLabel: stage.map[p.dealstage] || p.dealstage || "",
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
