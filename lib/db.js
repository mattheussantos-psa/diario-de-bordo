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

      // Fechamento do dia: o que de fato aconteceu em cada negócio marcado.
      // Fica fora de briefing_items de propósito — saveBriefing apaga e
      // reinsere os itens, e uma edição do gestor levaria o fechamento junto.
      await sql`CREATE TABLE IF NOT EXISTS fechamentos (
        owner_id TEXT NOT NULL,
        dia DATE NOT NULL,
        deal_id TEXT NOT NULL,
        resultado TEXT NOT NULL,
        observacao TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, dia, deal_id)
      )`;

      // Lista do dia do farmer. Gravada na primeira abertura e congelada:
      // atualizar a página não pode reembaralhar o compromisso do dia.
      // O resultado fica na mesma linha porque é dele que sai o histórico que
      // decide o descanso e a sequência de tentativas.
      await sql`CREATE TABLE IF NOT EXISTS carteira_dia (
        owner_id TEXT NOT NULL,
        dia DATE NOT NULL,
        company_id TEXT NOT NULL,
        nome TEXT,
        balde TEXT NOT NULL,
        extra BOOLEAN NOT NULL DEFAULT false,
        posicao INT NOT NULL,
        ultima_compra DATE,
        ultimo_contato DATE,
        abordagem TEXT,
        resultado TEXT,
        observacao TEXT,
        PRIMARY KEY (owner_id, dia, company_id)
      )`;

      // Pedido de troca de segmento: a empresa está na carteira errada. Fica
      // fora do rodízio enquanto o líder não decide — por isso é tabela, e não
      // só o resultado do dia: a decisão vale para além daquele dia.
      await sql`CREATE TABLE IF NOT EXISTS carteira_troca (
        owner_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        nome TEXT,
        motivo TEXT,
        status TEXT NOT NULL DEFAULT ('pendente'),
        pedido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        decidido_por TEXT,
        decidido_em TIMESTAMPTZ,
        PRIMARY KEY (owner_id, company_id)
      )`;

      // Orientação do líder para uma empresa travada. Aparece no card do
      // farmer assinada, porque conselho sem dono ninguém segue.
      await sql`CREATE TABLE IF NOT EXISTS carteira_orientacao (
        owner_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        texto TEXT NOT NULL,
        autor TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_id, company_id)
      )`;

      // Como a tramitação evoluiu no dia. Fica por dia, e não na tramitação,
      // porque uma pendência atravessa vários dias e cada um tem sua história.
      await sql`CREATE TABLE IF NOT EXISTS tramitacao_dia (
        ticket_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        dia DATE NOT NULL,
        resultado TEXT NOT NULL,
        observacao TEXT,
        quem TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (ticket_id, tipo, dia)
      )`;

      // Tramitações: baixa em duas mãos. O responsável marca, o líder confirma
      // ou devolve. A pendência em si é calculada do HubSpot; aqui fica só a
      // decisão humana sobre ela.
      await sql`CREATE TABLE IF NOT EXISTS tramitacoes (
        ticket_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        status TEXT NOT NULL,
        marcado_por TEXT,
        marcado_em TIMESTAMPTZ,
        decidido_por TEXT,
        decidido_em TIMESTAMPTZ,
        motivo TEXT,
        PRIMARY KEY (ticket_id, tipo)
      )`;
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

// ---------------------------------------------------------------- fechamento

// Resultados possíveis. A observação é exigida onde o número sozinho não
// explica nada: o que saiu da conversa, ou por que o negócio não foi tocado.
// Em tentativa não se pede — a atividade registrada no CRM já é a evidência.
export const RESULTADOS = {
  efetivo: { label: "Contato efetivo", exigeObs: true },
  tentativa: { label: "Tentei, sem sucesso", exigeObs: false },
  nao_atuei: { label: "Não atuei", exigeObs: true },
};
export const MIN_OBS = 50;

// { [dealId]: { resultado, observacao } }
export async function getFechamento(ownerId, dia) {
  if (!dbReady()) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT deal_id, resultado, observacao FROM fechamentos
      WHERE owner_id=${String(ownerId)} AND dia=${dia}`;
    const out = {};
    for (const r of rows) out[r.deal_id] = { resultado: r.resultado, observacao: r.observacao || "" };
    return out;
  } catch (e) {
    console.error("[fechamento] falha ao ler:", e?.message);
    return {};
  }
}

// Grava um negócio de cada vez: o closer fecha conforme termina, não no fim.
export async function salvarFechamento(ownerId, dia, dealId, resultado, observacao) {
  await init();
  const sql = db();
  await sql`INSERT INTO fechamentos (owner_id, dia, deal_id, resultado, observacao, updated_at)
    VALUES (${String(ownerId)}, ${dia}, ${String(dealId)}, ${resultado}, ${observacao || null}, now())
    ON CONFLICT (owner_id, dia, deal_id) DO UPDATE
    SET resultado=${resultado}, observacao=${observacao || null}, updated_at=now()`;
}

// Fechamentos de um dia inteiro (agenda e evolução).
export async function getFechamentosDoDia(dia) {
  if (!dbReady()) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT owner_id, deal_id, resultado FROM fechamentos WHERE dia=${dia}`;
    const out = {};
    for (const r of rows) (out[r.owner_id] ||= {})[r.deal_id] = r.resultado;
    return out;
  } catch (e) {
    console.error("[fechamento] falha ao listar dia:", e?.message);
    return {};
  }
}

// ----------------------------------------------------------------- evolução

// Uma linha por dia e closer: quantos negócios foram marcados no briefing e
// como terminaram. O denominador é o marcado, não o preenchido — medir só o
// preenchido premiaria quem fecha menos negócios do que planejou.
export async function getEvolucao(dias) {
  if (!dbReady() || dias.length === 0) return [];
  try {
    await init();
    const sql = db();
    const rows = await sql`
      SELECT i.owner_id, i.dia, i.deal_id, f.resultado
      FROM briefing_items i
      LEFT JOIN fechamentos f
        ON f.owner_id = i.owner_id AND f.dia = i.dia AND f.deal_id = i.deal_id
      WHERE i.dia = ANY(${dias}::date[])`;
    const mapa = {};
    for (const r of rows) {
      const k = `${r.owner_id}|${toKey(r.dia)}`;
      mapa[k] ||= { ownerId: r.owner_id, dia: toKey(r.dia), marcados: 0, efetivo: 0, tentativa: 0, nao_atuei: 0, sem_registro: 0 };
      mapa[k].marcados++;
      mapa[k][r.resultado && r.resultado in RESULTADOS ? r.resultado : "sem_registro"]++;
    }
    return Object.values(mapa);
  } catch (e) {
    console.error("[evolucao] falha ao apurar:", e?.message);
    return [];
  }
}

// -------------------------------------------------------------- tramitações

// { [`${ticketId}|${tipo}`]: { status, marcadoPor, decididoPor, motivo } }
export async function getTramitacoes(ticketIds) {
  if (!dbReady() || ticketIds.length === 0) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT ticket_id, tipo, status, marcado_por, decidido_por, motivo
      FROM tramitacoes WHERE ticket_id = ANY(${ticketIds.map(String)}::text[])`;
    const out = {};
    for (const r of rows) {
      out[`${r.ticket_id}|${r.tipo}`] = {
        status: r.status,
        marcadoPor: r.marcado_por || "",
        decididoPor: r.decidido_por || "",
        motivo: r.motivo || "",
      };
    }
    return out;
  } catch (e) {
    console.error("[tramitacoes] falha ao ler:", e?.message);
    return {};
  }
}

// "aguardando" = o responsável marcou e espera o líder.
export async function marcarTramitacao(ticketId, tipo, quem) {
  await init();
  const sql = db();
  await sql`INSERT INTO tramitacoes (ticket_id, tipo, status, marcado_por, marcado_em)
    VALUES (${String(ticketId)}, ${tipo}, 'aguardando', ${quem}, now())
    ON CONFLICT (ticket_id, tipo) DO UPDATE
    SET status='aguardando', marcado_por=${quem}, marcado_em=now(),
        decidido_por=NULL, decidido_em=NULL, motivo=NULL`;
}

// Negar devolve a pendência ao board com o prazo original — vencida volta
// vencida. É o que impede que "marcar como feito" vire atalho para sumir.
export async function decidirTramitacao(ticketId, tipo, decisao, quem, motivo) {
  await init();
  const sql = db();
  await sql`INSERT INTO tramitacoes (ticket_id, tipo, status, decidido_por, decidido_em, motivo)
    VALUES (${String(ticketId)}, ${tipo}, ${decisao}, ${quem}, now(), ${motivo || null})
    ON CONFLICT (ticket_id, tipo) DO UPDATE
    SET status=${decisao}, decidido_por=${quem}, decidido_em=now(), motivo=${motivo || null}`;
}

// ------------------------------------------------- lista do dia do farmer

// A lista já gravada para o dia, na ordem em que foi montada.
export async function getListaDia(ownerId, dia) {
  if (!dbReady()) return [];
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT company_id, nome, balde, extra, ultima_compra, ultimo_contato,
        abordagem, resultado, observacao
      FROM carteira_dia WHERE owner_id=${String(ownerId)} AND dia=${dia}
      ORDER BY extra, posicao`;
    return rows.map((r) => ({
      id: r.company_id,
      nome: r.nome || `Empresa ${r.company_id}`,
      balde: r.balde,
      extra: r.extra,
      ultimaCompra: r.ultima_compra ? toKey(r.ultima_compra) : null,
      ultimoContato: r.ultimo_contato ? toKey(r.ultimo_contato) : null,
      abordagem: r.abordagem || null,
      resultado: r.resultado || null,
      observacao: r.observacao || "",
    }));
  } catch (e) {
    console.error("[carteira] falha ao ler a lista do dia:", e?.message);
    return [];
  }
}

// Grava a lista do dia. DO NOTHING no conflito: uma vez sorteada, é ela que
// vale — reabrir a tela não pode trocar o compromisso do farmer.
export async function salvarListaDia(ownerId, dia, empresas) {
  if (empresas.length === 0) return;
  await init();
  const sql = db();
  const ids = empresas.map((e) => String(e.id));
  const nomes = empresas.map((e) => e.nome || null);
  const baldes = empresas.map((e) => e.balde);
  const extras = empresas.map((e) => !!e.extra);
  const pos = empresas.map((_, i) => i);
  const compras = empresas.map((e) => e.ultimaCompra || null);
  const contatos = empresas.map((e) => e.ultimoContato || null);
  await sql`INSERT INTO carteira_dia
      (owner_id, dia, company_id, nome, balde, extra, posicao, ultima_compra, ultimo_contato)
    SELECT ${String(ownerId)}, ${dia}, c, n, b, x, p, uc, ut
    FROM unnest(${ids}::text[], ${nomes}::text[], ${baldes}::text[], ${extras}::boolean[],
                ${pos}::int[], ${compras}::date[], ${contatos}::date[])
      AS t(c, n, b, x, p, uc, ut)
    ON CONFLICT (owner_id, dia, company_id) DO NOTHING`;
}

// Dias anteriores já registrados, para montar o histórico que decide o
// descanso e a sequência de tentativas. Ordenado como montaHistorico espera.
export async function getHistoricoCarteira(ownerId, hoje) {
  if (!dbReady()) return [];
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT company_id, dia, resultado FROM carteira_dia
      WHERE owner_id=${String(ownerId)} AND dia < ${hoje}::date
      ORDER BY company_id, dia DESC`;
    return rows.map((r) => ({
      companyId: r.company_id,
      data: toKey(r.dia),
      resultado: r.resultado || null,
    }));
  } catch (e) {
    console.error("[carteira] falha ao ler o histórico:", e?.message);
    return [];
  }
}

// Abordagem escolhida de manhã para uma empresa da lista.
export async function salvarAbordagem(ownerId, dia, companyId, abordagem) {
  await init();
  const sql = db();
  const r = await sql`UPDATE carteira_dia SET abordagem=${abordagem || null}
    WHERE owner_id=${String(ownerId)} AND dia=${dia} AND company_id=${String(companyId)}
    RETURNING company_id`;
  // Empresa fora da lista do dia não recebe abordagem: a lista é o compromisso.
  return r.length > 0;
}

// Fechamento de uma empresa da lista: o que aconteceu e por quê.
export async function salvarResultadoCarteira(ownerId, dia, companyId, resultado, observacao) {
  await init();
  const sql = db();
  const r = await sql`UPDATE carteira_dia
    SET resultado=${resultado || null}, observacao=${observacao || null}
    WHERE owner_id=${String(ownerId)} AND dia=${dia} AND company_id=${String(companyId)}
    RETURNING company_id`;
  return r.length > 0;
}

// Situação do dia de vários farmers — a agenda do líder. O estado é derivado
// do que foi preenchido: sem abordagem é dia não começado, sem resultado em
// alguma empresa é dia em aberto.
export async function getDiasDosFarmers(ownerIds, dia) {
  if (!dbReady() || ownerIds.length === 0) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT owner_id, company_id, nome, balde, extra, abordagem, resultado, observacao
      FROM carteira_dia
      WHERE dia=${dia} AND owner_id = ANY(${ownerIds.map(String)}::text[])
      ORDER BY owner_id, extra, posicao`;
    const out = {};
    for (const r of rows) {
      (out[r.owner_id] ||= []).push({
        id: r.company_id,
        nome: r.nome || `Empresa ${r.company_id}`,
        balde: r.balde,
        extra: r.extra,
        abordagem: r.abordagem || null,
        resultado: r.resultado || null,
        observacao: r.observacao || "",
      });
    }
    return out;
  } catch (e) {
    console.error("[carteira] falha ao ler o dia dos farmers:", e?.message);
    return {};
  }
}

// ------------------------------------------- troca de segmento e orientação

// Abre o pedido quando o farmer marca "trocar de segmento". Se já existe
// pendente, atualiza o motivo — o farmer pode ter reescrito.
export async function pedirTroca(ownerId, companyId, nome, motivo) {
  await init();
  const sql = db();
  await sql`INSERT INTO carteira_troca (owner_id, company_id, nome, motivo, status)
    VALUES (${String(ownerId)}, ${String(companyId)}, ${nome || null}, ${motivo || null}, 'pendente')
    ON CONFLICT (owner_id, company_id) DO UPDATE
    SET motivo=${motivo || null}, status='pendente', pedido_em=now(),
        decidido_por=NULL, decidido_em=NULL`;
}

// Pedidos em aberto. Enquanto existirem, a empresa não volta ao rodízio.
export async function getTrocasPendentes(ownerIds) {
  if (!dbReady() || ownerIds.length === 0) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT owner_id, company_id, nome, motivo, pedido_em
      FROM carteira_troca
      WHERE status='pendente' AND owner_id = ANY(${ownerIds.map(String)}::text[])
      ORDER BY pedido_em`;
    const out = {};
    for (const r of rows) {
      (out[r.owner_id] ||= []).push({
        id: r.company_id,
        nome: r.nome || `Empresa ${r.company_id}`,
        motivo: r.motivo || "",
      });
    }
    return out;
  } catch (e) {
    console.error("[carteira] falha ao ler as trocas:", e?.message);
    return {};
  }
}

// "trocado" fecha o pedido (a empresa saiu da carteira no HubSpot);
// "mantido" devolve a empresa ao rodízio do farmer.
export async function decidirTroca(ownerId, companyId, decisao, quem) {
  await init();
  const sql = db();
  await sql`UPDATE carteira_troca
    SET status=${decisao}, decidido_por=${quem}, decidido_em=now()
    WHERE owner_id=${String(ownerId)} AND company_id=${String(companyId)}`;
}

export async function salvarOrientacao(ownerId, companyId, texto, autor) {
  await init();
  const sql = db();
  await sql`INSERT INTO carteira_orientacao (owner_id, company_id, texto, autor, criado_em)
    VALUES (${String(ownerId)}, ${String(companyId)}, ${texto}, ${autor}, now())
    ON CONFLICT (owner_id, company_id) DO UPDATE
    SET texto=${texto}, autor=${autor}, criado_em=now()`;
}

export async function getOrientacoes(ownerIds) {
  if (!dbReady() || ownerIds.length === 0) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT owner_id, company_id, texto, autor FROM carteira_orientacao
      WHERE owner_id = ANY(${ownerIds.map(String)}::text[])`;
    const out = {};
    for (const r of rows) {
      (out[r.owner_id] ||= {})[r.company_id] = { texto: r.texto, autor: r.autor || "" };
    }
    return out;
  } catch (e) {
    console.error("[carteira] falha ao ler as orientações:", e?.message);
    return {};
  }
}

// Evolução da tramitação no dia: resolvi, avancei ou travado.
export async function salvarEvolucaoTramitacao(ticketId, tipo, dia, resultado, observacao, quem) {
  await init();
  const sql = db();
  await sql`INSERT INTO tramitacao_dia (ticket_id, tipo, dia, resultado, observacao, quem, updated_at)
    VALUES (${String(ticketId)}, ${tipo}, ${dia}, ${resultado}, ${observacao || null}, ${quem}, now())
    ON CONFLICT (ticket_id, tipo, dia) DO UPDATE
    SET resultado=${resultado}, observacao=${observacao || null}, quem=${quem}, updated_at=now()`;
}

export async function getEvolucaoTramitacoes(ticketIds, dia) {
  if (!dbReady() || ticketIds.length === 0) return {};
  try {
    await init();
    const sql = db();
    const rows = await sql`SELECT ticket_id, tipo, resultado, observacao FROM tramitacao_dia
      WHERE dia=${dia} AND ticket_id = ANY(${ticketIds.map(String)}::text[])`;
    const out = {};
    for (const r of rows) {
      out[`${r.ticket_id}|${r.tipo}`] = { resultado: r.resultado, observacao: r.observacao || "" };
    }
    return out;
  } catch (e) {
    console.error("[tramitacoes] falha ao ler a evolução:", e?.message);
    return {};
  }
}
