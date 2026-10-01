// Registre du Devtober : les 31 mots, et les jours publiés.
// Pour publier un jour : crée le dossier day-XX-mot/ (avec index.html + README.md), puis ajoute-le dans PUBLISHED.

export const YEAR = 2026;

export const WORDS = [
  'Pulse', 'Loop', 'Bloom', 'Drift', 'Chaos', 'Tiny', 'Swarm', 'Maze', 'Gravity', 'Fold', 'Ripple',
  'Lost', 'Tangle', 'Bounce', 'Shadow', 'Tide', 'Orbit', 'Glitch', 'Echo', 'Fragile', 'Signal',
  'Mirror', 'Spark', 'Hidden', 'Melt', 'Machine', 'Haunted', 'Grow', 'Infinite', 'Collapse', 'Wake',
];

/** Jours publiés : numéro → titre et phrase d'accroche affichés sur l'accueil. */
export const PUBLISHED = {
  1: { title: "Testeur d'affinité", pitch: 'Des Mii en 3D, une 3DS, et un cœur qui bat de plus en plus vite.' },
};

export const slugOf = (n) => `day-${String(n).padStart(2, '0')}-${WORDS[n - 1].toLowerCase()}`;

export const DAYS = WORDS.map((word, i) => {
  const number = i + 1;
  return { number, word, slug: slugOf(number), date: new Date(YEAR, 9, number), entry: PUBLISHED[number] ?? null };
});

/** done = publié · today = c'est le jour · missed = passé sans publication · upcoming = à venir */
export function statusOf(day, now = new Date()) {
  if (day.entry) return 'done';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (+day.date === +today) return 'today';
  return day.date < today ? 'missed' : 'upcoming';
}
