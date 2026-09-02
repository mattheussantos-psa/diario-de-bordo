import { SEG_CLOSER } from "./config";

// Quem pode aprovar, reprovar e editar briefings: o admin em qualquer segmento,
// o líder apenas no time dele. Closer comum não gere ninguém.
export function ehGestor(user) {
  return !!user?.isAdmin || !!user?.lidera;
}

// Segmentos que a pessoa alcança. Admin vê os dois; líder, só o dele.
export function segmentosDe(user) {
  if (user?.isAdmin) return ["B2B", "B2C"];
  return user?.lidera ? [user.lidera] : [];
}

// O líder não decide sobre closer de outro segmento.
export function podeGerirCloser(user, ownerId) {
  if (user?.isAdmin) return true;
  if (!user?.lidera) return false;
  return SEG_CLOSER[String(ownerId)] === user.lidera;
}

// Regra única de quais briefings a pessoa enxerga. O contador e a tela usavam
// filtros diferentes — a tela exigia closer cadastrado em config.js, o contador
// não. Quem enviava sem estar no cadastro aparecia no número e em tela nenhuma,
// ficando impossível de aprovar.
export function briefingsGeriveis(user, briefings) {
  return briefings.filter((b) => podeGerirCloser(user, b.ownerId));
}
