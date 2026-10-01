// Registre du Devtober : les 31 mots, et les jours publiés.
// Pour publier un jour : crée le dossier day-XX-mot/ (avec index.html + README.md), puis ajoute-le dans PUBLISHED.

export const YEAR = 2026;

export const WORDS = [
  'Pulse', 'Loop', 'Bloom', 'Drift', 'Chaos', 'Tiny', 'Swarm', 'Maze', 'Gravity', 'Fold', 'Ripple',
  'Lost', 'Tangle', 'Bounce', 'Shadow', 'Tide', 'Orbit', 'Glitch', 'Echo', 'Fragile', 'Signal',
  'Mirror', 'Spark', 'Hidden', 'Melt', 'Machine', 'Haunted', 'Grow', 'Infinite', 'Collapse', 'Wake',
];

/** Jours publiés : numéro → titre et phrase d'accroche affichés sur l'accueil (+ projets bonus dans `extras`). */
export const PUBLISHED = {
  1: { title: "Testeur d'affinité", pitch: 'Des Mii en 3D, une 3DS, et un cœur qui bat de plus en plus vite.' },
  2: {
    title: 'Téléphone traduit', pitch: 'Une phrase fait le tour des langues et revient… un peu déformée.',
    extras: [{ path: 'ludo', title: 'Ludo des Mii', pitch: 'Un Ludo en 3D dans la 3DS : toi et trois Mii bots, un dé qui roule vraiment.' }],
  },
  3: { title: 'La boîte des Mii', pitch: 'Tu es le DJ : tape en rythme et fais éclore la fête. Lasers, néons et halo lumineux.' },
};

export const slugOf = (n) => `day-${String(n).padStart(2, '0')}-${WORDS[n - 1].toLowerCase()}`;

export const DAYS = WORDS.map((word, i) => {
  const number = i + 1;
  const entry = PUBLISHED[number] ?? null;
  // tous les projets du jour : le principal (à la racine du dossier) puis les bonus
  const projects = entry ? [{ path: '', title: entry.title, pitch: entry.pitch }, ...(entry.extras ?? [])] : [];
  return { number, word, slug: slugOf(number), date: new Date(YEAR, 9, number), entry, projects };
});

/** done = publié · today = c'est le jour · missed = passé sans publication · upcoming = à venir */
export function statusOf(day, now = new Date()) {
  if (day.entry) return 'done';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (+day.date === +today) return 'today';
  return day.date < today ? 'missed' : 'upcoming';
}
