// Extensão explícita: assim o lib/config.check.mjs consegue importar este
// módulo direto no Node, sem passar pelo bundler.
import { SEG_CLOSER, SEGMENTOS } from "./config.js";

// Quem pode aprovar, reprovar e editar briefings: o admin em qualquer segmento,
// o líder apenas no time dele. Closer comum não gere ninguém.
// Um líder pode responder por mais de um segmento, então "lidera" é sempre
// tratado como lista.
const lidera = (user) => {
  const v = user?.lidera;
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
};

export function ehGestor(user) {
  return !!user?.isAdmin || lidera(user).length > 0;
}

// Segmentos que a pessoa alcança. Admin vê todos; líder, os dele.
export function segmentosDe(user) {
  if (user?.isAdmin) return SEGMENTOS;
  // Na ordem do cadastro, para as abas não dançarem entre as telas.
  return SEGMENTOS.filter((s) => lidera(user).includes(s));
}

// O líder não decide sobre closer de segmento que não é dele.
export function podeGerirCloser(user, ownerId) {
  if (user?.isAdmin) return true;
  return lidera(user).includes(SEG_CLOSER[String(ownerId)]);
}

// Regra única de quais briefings a pessoa enxerga. O contador e a tela usavam
// filtros diferentes — a tela exigia closer cadastrado em config.js, o contador
// não. Quem enviava sem estar no cadastro aparecia no número e em tela nenhuma,
// ficando impossível de aprovar.
export function briefingsGeriveis(user, briefings) {
  return briefings.filter((b) => podeGerirCloser(user, b.ownerId));
}
