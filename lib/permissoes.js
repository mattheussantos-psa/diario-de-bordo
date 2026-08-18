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
