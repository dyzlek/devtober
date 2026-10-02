// Ludo · les affinités entre les Mii, calculées comme dans le Testeur d'affinité du jour 1 (mode amitié).
// Deux Mii qui s'entendent bien s'encouragent pendant la partie ; deux qui se détestent se narguent.
import { getField } from '../../day-01-pulse/mii3d.js?v=3';

const AXES = ['energie', 'bavard', 'fantaisie', 'social'];

function hash(str) { // FNV-1a → 0..1, stable pour un même couple
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const signOf = (month, day) => {
  if (!month || !day) return null;
  const cuts = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  return day < cuts[month - 1] ? (month + 8) % 12 : (month + 9) % 12;
};

/** Personnalité d'un Mii : celle du jour 1 si elle existe, sinon une personnalité stable tirée de ses données. */
export function persoOf(m) {
  if (m.perso) return m.perso;
  return Object.fromEntries(AXES.map((k, i) => [k, Math.floor(hash(m.b64 + k + i) * 9)]));
}

/** Affinité amicale (1 à 100) entre deux Mii { b64, bytes, perso }. Même formule que le jour 1. */
export function affinity(a, b) {
  const pa = persoOf(a), pb = persoOf(b);
  const perso = AXES.reduce((s, k) => s + 1 - Math.abs(pa[k] - pb[k]) / 8, 0) / AXES.length;
  const sa = signOf(getField(a.bytes, 'birthMonth'), getField(a.bytes, 'birthDay'));
  const sb = signOf(getField(b.bytes, 'birthMonth'), getField(b.bytes, 'birthDay'));
  let stars = 0.5;
  if (sa !== null && sb !== null) {
    const ea = sa % 4, eb = sb % 4;
    stars = ea === eb ? 1 : (ea + eb) % 2 === 0 ? 0.8 : ea + eb === 3 ? 0.15 : 0.45;
  }
  const dc = Math.abs(getField(a.bytes, 'favoriteColor') - getField(b.bytes, 'favoriteColor'));
  const color = 1 - Math.min(dc, 12 - dc) / 6;
  const chaos = hash([a.b64, b.b64].sort().join('+') + 'amitie');
  const raw = perso * 55 + stars * 15 + color * 15 + chaos * 15;
  const x = clamp((raw - 58) / 21, -1, 1);
  return clamp(Math.round(50 + 50 * Math.sign(x) * Math.pow(Math.abs(x), 0.72)), 1, 100);
}

/** Relation entre deux Mii : 'ami' (≥ 70), 'ennemi' (< 30) ou 'neutre'. */
export const relationOf = (score) => (score >= 70 ? 'ami' : score < 30 ? 'ennemi' : 'neutre');
