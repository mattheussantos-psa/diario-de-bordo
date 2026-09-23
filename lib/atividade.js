import "server-only";
import { hsSearch, associacoesPara, disposicoesConectadas } from "./hubspot";

// Atividade registrada no HubSpot hoje, por empresa. É a fonte do fechamento:
// o farmer já registra ligação e reunião no CRM, e pedir para digitar de novo
// no diário é retrabalho que mata a adoção.
//
// Cada leitura falha para o lado seguro: sem o escopo, a atividade volta vazia
// e o farmer preenche à mão, como antes. Nunca inventa resultado.

const semHtml = (v) =>
  String(v || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// A janela é o dia em Brasília, não em UTC: senão o começo da manhã fica de
// fora e o fim do dia anterior entra.
function janelaDoDia(dia, farmerIds, prop) {
  return [
    { propertyName: "hubspot_owner_id", operator: "IN", values: farmerIds },
    { propertyName: prop, operator: "GTE", value: String(new Date(`${dia}T00:00:00-03:00`).getTime()) },
    { propertyName: prop, operator: "LTE", value: String(new Date(`${dia}T23:59:59-03:00`).getTime()) },
  ];
}

export async function atividadeDoDia(farmerIds, dia) {
  const porFarmer = {};
  for (const id of farmerIds) porFarmer[String(id)] = {};
  if (farmerIds.length === 0) return porFarmer;

  const ids = farmerIds.map(String);
  const [conectadas, ligacoes, reunioes, emails, notas] = await Promise.all([
    disposicoesConectadas().catch(() => new Set()),
    hsSearch("calls", [{ filters: janelaDoDia(dia, ids, "hs_timestamp") }],
      ["hs_call_disposition", "hs_call_body", "hubspot_owner_id"]).catch(() => []),
    hsSearch("meetings", [{ filters: janelaDoDia(dia, ids, "hs_timestamp") }],
      ["hs_meeting_outcome", "hs_meeting_body", "hubspot_owner_id"]).catch(() => []),
    hsSearch("emails", [{ filters: janelaDoDia(dia, ids, "hs_timestamp") }],
      ["hubspot_owner_id"]).catch(() => []),
    hsSearch("notes", [{ filters: janelaDoDia(dia, ids, "hs_timestamp") }],
      ["hs_note_body", "hubspot_owner_id"]).catch(() => []),
  ]);

  const [empLigacoes, empReunioes, empEmails, empNotas] = await Promise.all([
    associacoesPara("calls", ligacoes.map((c) => c.id)).catch(() => ({})),
    associacoesPara("meetings", reunioes.map((m) => m.id)).catch(() => ({})),
    associacoesPara("emails", emails.map((e) => e.id)).catch(() => ({})),
    associacoesPara("notes", notas.map((n) => n.id)).catch(() => ({})),
  ]);

  const registra = (dono, empresa) => {
    const mapa = porFarmer[String(dono)];
    if (!mapa) return null;
    mapa[empresa] ||= { ligacoes: 0, conectadas: 0, reunioes: 0, outras: 0, texto: "", sugerido: null };
    return mapa[empresa];
  };
  // A anotação mais longa costuma ser a que explica o contato.
  const guardaTexto = (a, t) => {
    if (t && t.length > a.texto.length) a.texto = t;
  };

  for (const c of ligacoes) {
    const p = c.properties || {};
    const conectou = conectadas.has(p.hs_call_disposition || "");
    const texto = semHtml(p.hs_call_body);
    for (const empresa of empLigacoes[c.id] || []) {
      const a = registra(p.hubspot_owner_id, empresa);
      if (!a) continue;
      a.ligacoes++;
      if (conectou) a.conectadas++;
      guardaTexto(a, texto);
    }
  }

  for (const m of reunioes) {
    const p = m.properties || {};
    const realizada = p.hs_meeting_outcome === "COMPLETED";
    const texto = semHtml(p.hs_meeting_body);
    for (const empresa of empReunioes[m.id] || []) {
      const a = registra(p.hubspot_owner_id, empresa);
      if (!a) continue;
      if (realizada) a.reunioes++;
      else a.outras++;
      guardaTexto(a, texto);
    }
  }

  for (const e of emails) {
    for (const empresa of empEmails[e.id] || []) {
      const a = registra(e.properties?.hubspot_owner_id, empresa);
      if (a) a.outras++;
    }
  }

  for (const n of notas) {
    const texto = semHtml(n.properties?.hs_note_body);
    for (const empresa of empNotas[n.id] || []) {
      const a = registra(n.properties?.hubspot_owner_id, empresa);
      if (!a) continue;
      a.outras++;
      guardaTexto(a, texto);
    }
  }

  // Ligação conectada ou reunião realizada é contato efetivo; ligação sem
  // resposta, e-mail ou nota é tentativa. Sem atividade, fica em branco —
  // e em branco é "não abordei", que o farmer confirma.
  for (const mapa of Object.values(porFarmer)) {
    for (const a of Object.values(mapa)) {
      if (a.conectadas > 0 || a.reunioes > 0) a.sugerido = "efetivo";
      else if (a.ligacoes > 0 || a.outras > 0) a.sugerido = "tentativa";
    }
  }

  return porFarmer;
}
