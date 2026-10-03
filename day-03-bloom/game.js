// Devtober J3 · Bloom — la boîte des Mii : un jeu de rythme façon osu! sur l'écran tactile.
// Touche chaque cercle pile quand l'anneau le rejoint : il s'ouvre en fleur, et la fête « éclot » là-haut.
import { initMii, randomMii, setName, b64ToBytes } from '../day-01-pulse/mii3d.js?v=3';
import { Club } from './club.js?v=12';
import { Music, SECONDS_PER_BEAT as SPB } from './music.js?v=4';

const $ = (s) => document.querySelector(s);
const MII_STORE = 'devtober-pulse-miis-v3';
const MAX_DANCERS = 14;
const SONG_BEATS = 256;          // 64 mesures ≈ 2 minutes
const FIRST_NOTE = 8;            // 2 mesures pour se mettre dans le rythme
// les trois niveaux : le temps que met l'anneau à arriver (en temps), les fenêtres de timing (secondes),
// la taille des cercles, la densité des notes, ce que rapporte une note et ce que coûte un raté
const LEVELS = {
  facile: { name: 'Facile', approach: 2.1, win: { 300: 0.09, 100: 0.16, 50: 0.23 }, size: 1.18, density: 'sparse', gain: 1.35, miss: 3, sliders: 0.18 },
  moyen: { name: 'Moyen', approach: 1.6, win: { 300: 0.07, 100: 0.13, 50: 0.19 }, size: 1, density: 'normal', gain: 1, miss: 5, sliders: 0.25 },
  difficile: { name: 'Difficile', approach: 1.25, win: { 300: 0.05, 100: 0.1, 50: 0.15 }, size: 0.86, density: 'dense', gain: 0.85, miss: 7, sliders: 0.3 },
};
const LEVEL_STORE = 'devtober-bloom-level';
let level = 'moyen';
try { if (LEVELS[localStorage.getItem(LEVEL_STORE)]) level = localStorage.getItem(LEVEL_STORE); } catch { /* rien */ }
let APPROACH = LEVELS[level].approach;   // l'anneau met ce nombre de temps à rejoindre le cercle
let WIN = LEVELS[level].win;
const NOTE_COLORS = ['#ff5b8d', '#ffb02e', '#4aa8ff', '#39c27a', '#9a6bff'];
const STAGES = [
  [0, 'Calme', 'La soirée commence…'],
  [20, 'Ça s’anime', 'Ça s’anime !'],
  [45, 'Ça chauffe', 'Ça chauffe !'],
  [70, 'En feu', 'La piste est en feu !'],
  [90, 'Pleine floraison', 'PLEINE FLORAISON'],
];
const FX_AT = { smoke: 15, lasers: 35, strobe: 60 };

/* ---------- les Mii : ceux du jour 1, complétés au hasard ---------- */
function loadPool() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(MII_STORE)) || []; } catch { /* rien */ }
  const pool = saved.filter((m) => m && m.data).map((m) => b64ToBytes(m.data));
  const names = ['Alex', 'Lou', 'Sam', 'Noa', 'Jade', 'Malo', 'Léo', 'Inès', 'Hugo', 'Zoé', 'Tom', 'Lina', 'Nils', 'Rose', 'Yanis', 'Mia'];
  for (let i = 0; pool.length < MAX_DANCERS + 2; i++) {
    const b = randomMii(i % 2);
    setName(b, names[i % names.length]);
    pool.push(b);
  }
  return pool;
}

/* ---------- état ---------- */
let club, music, pool = [], nextMii = 1;
let notes = [], effects = [];
let hype = 0, combo = 0, maxCombo = 0, score = 0, stage = 0;
const counts = { 300: 0, 100: 0, 50: 0, miss: 0 };
let playing = false;
let gen = null;              // générateur de la partition
let dropState = null, lastDropAt = -999;
let crowdTimer = 0;
let pointer = { x: 0.5, y: 0.5 };
let pointerDown = false;
const keysHeld = new Set();
const holding = () => pointerDown || keysHeld.size > 0;
let bestSnapStage = -1;

function caption(text, ms = 1800) {
  const el = $('#caption');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(caption.t);
  caption.t = setTimeout(() => el.classList.remove('show'), ms);
}

/* =====================================================================
   La partition : générée en direct, au rythme du morceau
   ===================================================================== */
function newGame() {
  notes = []; effects = [];
  hype = 0; combo = 0; maxCombo = 0; score = 0; stage = 0;
  Object.keys(counts).forEach((k) => { counts[k] = 0; });
  gen = { t: FIRST_NOTE, x: 0.5, y: 0.5, angle: Math.random() * Math.PI * 2, group: 0, inGroup: 0, lastStep: 1 };
  dropState = null; lastDropAt = -999;
  bestSnapStage = -1;
  $('#souvenir').hidden = true;
  playing = true;
  updateHud();
}

/** Ajoute les notes des prochains temps (on garde toujours un peu d'avance). */
function generate(beats) {
  while (gen.t < Math.min(SONG_BEATS, beats + APPROACH + 4)) {
    const t = gen.t;
    const inDrop = dropState && t >= dropState.start && t < dropState.until;
    // densité : plus l'ambiance est haute, plus il y a de notes ; une respiration toutes les 4 mesures
    const breath = t % 16 >= 14;
    let step = breath ? 2 : hype < 25 ? (t < 24 ? 2 : 1) : hype < 55 ? 1 : hype < 85 ? (t % 4 === 3 ? 0.5 : 1) : (t % 2 === 1 ? 0.5 : 1);
    if (inDrop) step = t % 8 >= 6 ? 1 : 0.5;
    // le niveau change la densité : moins de notes en facile, plus de doubles croches en difficile
    const d = LEVELS[level].density;
    if (d === 'sparse') step = inDrop ? 1 : step < 1 ? 1 : hype < 45 && !breath ? 2 : step;
    if (d === 'dense') step = breath ? 1 : step >= 2 ? 1 : step === 1 && hype >= 25 && t % 2 === 1 ? 0.5 : step;
    // nouveau groupe (nouvelle couleur, on recompte à partir de 1) toutes les 4 notes ou après une pause
    if (gen.inGroup >= (step < 1 ? 8 : 4) || gen.lastStep === 2) { gen.group++; gen.inGroup = 0; }
    // la position suit un chemin fluide : on tourne un peu à chaque note, on rebondit sur les bords
    gen.angle += (Math.random() - 0.5) * (step < 1 ? 0.7 : 1.8);
    const dist = step < 1 ? 0.11 : 0.24;
    let x = gen.x + Math.cos(gen.angle) * dist, y = gen.y + Math.sin(gen.angle) * dist * 1.3;
    if (x < 0.12 || x > 0.88) { gen.angle = Math.PI - gen.angle; x = Math.min(0.88, Math.max(0.12, x)); }
    if (y < 0.24 || y > 0.76) { gen.angle = -gen.angle; y = Math.min(0.76, Math.max(0.24, y)); }
    gen.x = x; gen.y = y; gen.inGroup++; gen.lastStep = step;
    const note = { t, x, y, n: gen.inGroup, color: NOTE_COLORS[gen.group % NOTE_COLORS.length], group: gen.group, done: false };
    notes.push(note);
    // une note longue : de temps en temps, sur un temps « calme » (pas pendant le drop)
    if (step >= 1 && !inDrop && t > FIRST_NOTE + 4 && t < SONG_BEATS - 6 && Math.random() < LEVELS[level].sliders) {
      const len = step >= 2 ? 2 : 1;
      gen.angle += (Math.random() - 0.5) * 1.2;
      let x2 = x + Math.cos(gen.angle) * 0.3, y2 = y + Math.sin(gen.angle) * 0.36;
      x2 = Math.min(0.86, Math.max(0.14, x2)); y2 = Math.min(0.74, Math.max(0.26, y2));
      // un point de contrôle décalé sur le côté : le chemin est une jolie courbe
      const bend = (Math.random() < 0.5 ? -1 : 1) * 0.12;
      Object.assign(note, { slider: true, len, x2, y2, cx: (x + x2) / 2 - (y2 - y) * bend * 2.2, cy: (y + y2) / 2 + (x2 - x) * bend * 2.2 });
      gen.x = x2; gen.y = y2;
      gen.t += len + 1;
      continue;
    }
    gen.t += step;
  }
}

/* =====================================================================
   Toucher un cercle
   ===================================================================== */
const field = $('#field');
const fctx = field.getContext('2d');
let W = 1, H = 1, R = 20;
function resizeField() {
  const r = field.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  if (!r.width) return;
  W = r.width; H = r.height;
  field.width = Math.round(W * dpr); field.height = Math.round(H * dpr);
  fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  R = Math.min(W, H) * 0.085 * LEVELS[level].size;
}
new ResizeObserver(resizeField).observe(field);

function toField(e) {
  const r = field.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}
field.addEventListener('pointermove', (e) => { pointer = toField(e); });
field.addEventListener('pointerdown', (e) => { e.preventDefault(); pointerDown = true; pointer = toField(e); hit(pointer); });
addEventListener('pointerup', () => { pointerDown = false; });
addEventListener('pointercancel', () => { pointerDown = false; });
addEventListener('keyup', (e) => keysHeld.delete(e.code));
addEventListener('blur', () => { pointerDown = false; keysHeld.clear(); });
document.addEventListener('keydown', (e) => {
  if (!playing || e.repeat) return;
  if (['KeyX', 'KeyC', 'KeyZ', 'KeyW', 'Space'].includes(e.code)) { e.preventDefault(); keysHeld.add(e.code); hit(pointer); }
});

function hit(p) {
  if (!playing) return;
  const now = music.beats();
  // la note la plus ancienne encore jouable, sous le doigt, dans la fenêtre de timing
  const candidate = notes.find((n) => !n.done && !n.holding && Math.abs(n.t - now) * SPB <= WIN[50]
    && Math.hypot((n.x - p.x) * W, (n.y - p.y) * H) <= R * 1.2);
  if (!candidate) return;
  const err = Math.abs(candidate.t - now) * SPB;
  judge(candidate, err <= WIN[300] ? 300 : err <= WIN[100] ? 100 : 50);
}

function judge(note, kind, at = note) {
  if (note.slider && kind !== 'miss' && !note.holding) note.holding = true;   // la tête est touchée : maintenant, il faut suivre
  else note.done = true;
  if (kind === 'miss') {
    counts.miss++;
    if (combo >= 10) caption(`Combo perdu (${combo})`, 1200);
    if (combo >= 5 || Math.random() < 0.5) club.crowdReact('sulk');   // un danseur s'arrête et boude
    combo = 0;
    hype = Math.max(0, hype - LEVELS[level].miss);
  } else {
    counts[kind]++;
    combo++; maxCombo = Math.max(maxCombo, combo);
    // retour sur le combo : à 50, puis tous les 100, le DJ lève les bras et la foule crie ; tous les 25, elle applaudit
    if (combo === 50 || combo % 100 === 0) {
      club.djCheer(); club.crowdReact('cheer'); music.cheer();
      caption(`Combo ${combo} !`, 1800);
    } else if (combo % 25 === 0) club.crowdReact('clap', 1.6);
    score += Math.round(kind * (1 + combo / 25) * (level === 'difficile' ? 1.5 : level === 'facile' ? 0.75 : 1));
    hype = Math.min(100, hype + (kind === 300 ? 2.4 : kind === 100 ? 1.2 : 0.3) * LEVELS[level].gain);
    // le cercle s'ouvre en fleur… et une fleur de lumière éclot sur la piste, au même endroit
    club.bloomAt((at.x - 0.5) * 18, (at.y - 0.5) * 14, null, kind === 300 ? 1.2 : 0.7);
  }
  effects.push({ x: at.x, y: at.y, t0: performance.now(), kind, color: note.color });
  updateHud();
}

/** Point du chemin d'une note longue (u de 0 à 1). */
function along(n, u) {
  const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
  return { x: a * n.x + b * n.cx + c * n.x2, y: a * n.y + b * n.cy + c * n.y2 };
}

/** Pendant une note longue : il faut garder le doigt appuyé sur la bille jusqu'au bout. */
function updateSliders(beats) {
  for (const n of notes) {
    if (!n.slider || !n.holding || n.done) continue;
    const u = Math.min(1, (beats - n.t) / n.len);
    const ball = along(n, Math.max(0, u));
    const near = Math.hypot((ball.x - pointer.x) * W, (ball.y - pointer.y) * H) <= R * 2.2;
    if (!holding() || !near) {
      // lâché en route : la note longue est cassée
      n.done = true;
      effects.push({ x: ball.x, y: ball.y, t0: performance.now(), kind: 'miss', color: n.color });
      counts.miss++;
      if (combo >= 10) caption(`Combo perdu (${combo})`, 1200);
      club.crowdReact('sulk');
      combo = 0;
      hype = Math.max(0, hype - LEVELS[level].miss);
      updateHud();
    } else if (u >= 1) {
      judge(n, 300, { x: n.x2, y: n.y2 });   // tenue jusqu'au bout : c'est un 300
    }
  }
}

function accuracy() {
  const total = counts[300] + counts[100] + counts[50] + counts.miss;
  return total ? (300 * counts[300] + 100 * counts[100] + 50 * counts[50]) / (300 * total) * 100 : 100;
}
function updateHud() {
  $('#score').textContent = score.toLocaleString('fr-FR');
  $('#acc').textContent = accuracy().toFixed(2).replace('.', ',');
  $('#combo').textContent = combo;
}

/* =====================================================================
   Dessin du terrain (canvas 2D)
   ===================================================================== */
function drawField(beats) {
  fctx.clearRect(0, 0, W, H);
  const visible = notes.filter((n) => !n.done && n.t - beats <= APPROACH && (n.slider ? n.t + n.len - beats > -0.5 : n.t - beats > -0.5));
  // les notes longues : le chemin (sous les cercles), le bout, et la bille à suivre
  for (const n of visible) {
    if (!n.slider) continue;
    const left = n.t - beats;
    fctx.globalAlpha = Math.max(0, Math.min(1, (APPROACH - left) / (APPROACH * 0.3)));
    const path = () => { fctx.beginPath(); fctx.moveTo(n.x * W, n.y * H); fctx.quadraticCurveTo(n.cx * W, n.cy * H, n.x2 * W, n.y2 * H); };
    fctx.lineCap = 'round';
    path(); fctx.lineWidth = R * 2.05; fctx.strokeStyle = '#ffffff'; fctx.stroke();
    path(); fctx.lineWidth = R * 1.7; fctx.strokeStyle = n.color; fctx.globalAlpha *= 0.35; fctx.stroke();
    fctx.globalAlpha = Math.max(0, Math.min(1, (APPROACH - left) / (APPROACH * 0.3)));
    // le bout du chemin
    fctx.lineWidth = R * 0.14; fctx.strokeStyle = '#fff';
    fctx.beginPath(); fctx.arc(n.x2 * W, n.y2 * H, R * 0.8, 0, Math.PI * 2); fctx.stroke();
    if (n.holding) {
      const u = Math.max(0, Math.min(1, (beats - n.t) / n.len)), b = along(n, u);
      fctx.fillStyle = n.color;
      fctx.beginPath(); fctx.arc(b.x * W, b.y * H, R * 0.78, 0, Math.PI * 2); fctx.fill();
      fctx.lineWidth = R * 0.16; fctx.strokeStyle = '#fff'; fctx.stroke();
      // l'anneau qui suit la bille : on doit rester dedans
      fctx.lineWidth = R * 0.1; fctx.strokeStyle = n.color;
      fctx.beginPath(); fctx.arc(b.x * W, b.y * H, R * (1.9 + Math.sin(performance.now() / 90) * 0.06), 0, Math.PI * 2); fctx.stroke();
    }
    fctx.globalAlpha = 1;
  }
  // traits pointillés entre les notes d'un même groupe (le chemin à suivre)
  fctx.save();
  fctx.setLineDash([R * 0.18, R * 0.22]); fctx.lineWidth = R * 0.12; fctx.lineCap = 'round';
  fctx.strokeStyle = 'rgba(154, 122, 74, .35)';
  for (let i = 0; i < visible.length - 1; i++) {
    const a = visible[i], b = visible[i + 1];
    if (a.group !== b.group) continue;
    fctx.beginPath(); fctx.moveTo(a.x * W, a.y * H); fctx.lineTo(b.x * W, b.y * H); fctx.stroke();
  }
  fctx.restore();
  // les cercles : les plus lointains d'abord, le prochain à toucher par-dessus (la tête d'une note longue déjà touchée disparaît)
  for (let i = visible.length - 1; i >= 0; i--) {
    const n = visible[i], left = n.t - beats, x = n.x * W, y = n.y * H;
    if (n.holding) continue;
    fctx.globalAlpha = Math.max(0, Math.min(1, (APPROACH - left) / (APPROACH * 0.3)));
    if (left > 0) {   // l'anneau d'approche
      fctx.lineWidth = R * 0.12; fctx.strokeStyle = n.color;
      fctx.beginPath(); fctx.arc(x, y, R * (1 + 2.3 * left / APPROACH), 0, Math.PI * 2); fctx.stroke();
    }
    // le cercle : ombre, bord blanc épais, couleur, reflet, numéro
    fctx.fillStyle = 'rgba(120, 80, 30, .22)';
    fctx.beginPath(); fctx.arc(x + R * 0.08, y + R * 0.14, R, 0, Math.PI * 2); fctx.fill();
    fctx.fillStyle = '#fff';
    fctx.beginPath(); fctx.arc(x, y, R, 0, Math.PI * 2); fctx.fill();
    const g = fctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R * 0.82);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, n.color); g.addColorStop(1, n.color);
    fctx.fillStyle = g;
    fctx.beginPath(); fctx.arc(x, y, R * 0.82, 0, Math.PI * 2); fctx.fill();
    fctx.font = `900 ${R * 0.95}px Nunito, sans-serif`;
    fctx.textAlign = 'center'; fctx.textBaseline = 'middle';
    fctx.lineWidth = R * 0.14; fctx.strokeStyle = 'rgba(74, 51, 36, .55)'; fctx.fillStyle = '#fff';
    fctx.strokeText(n.n, x, y + R * 0.05); fctx.fillText(n.n, x, y + R * 0.05);
    fctx.globalAlpha = 1;
  }
  // effets : la fleur qui s'ouvre (réussi) ou une croix (raté)
  const now = performance.now();
  effects = effects.filter((f) => now - f.t0 < 650);
  for (const f of effects) {
    const k = (now - f.t0) / 650, x = f.x * W, y = f.y * H;
    fctx.globalAlpha = 1 - k;
    if (f.kind === 'miss') {
      fctx.strokeStyle = '#e32b43'; fctx.lineWidth = R * 0.2; fctx.lineCap = 'round';
      const s = R * 0.5;
      fctx.beginPath(); fctx.moveTo(x - s, y - s); fctx.lineTo(x + s, y + s); fctx.moveTo(x + s, y - s); fctx.lineTo(x - s, y + s); fctx.stroke();
    } else {
      const petals = f.kind === 300 ? 8 : f.kind === 100 ? 6 : 4, open = R * (0.6 + k * 1.4);
      for (let p = 0; p < petals; p++) {
        const a = (p / petals) * Math.PI * 2 + k * 0.8;
        fctx.save(); fctx.translate(x + Math.cos(a) * open * 0.6, y + Math.sin(a) * open * 0.6); fctx.rotate(a);
        fctx.fillStyle = f.color; fctx.beginPath(); fctx.ellipse(0, 0, open * 0.55, open * 0.24, 0, 0, Math.PI * 2); fctx.fill();
        fctx.restore();
      }
      fctx.fillStyle = '#fff6d8'; fctx.beginPath(); fctx.arc(x, y, R * 0.35 * (1 - k * 0.5), 0, Math.PI * 2); fctx.fill();
    }
    fctx.fillStyle = f.kind === 'miss' ? '#e32b43' : f.kind === 300 ? '#ff5b8d' : f.kind === 100 ? '#39a96b' : '#9a7a4a';
    fctx.font = `900 ${R * 0.6}px Nunito, sans-serif`; fctx.textAlign = 'center'; fctx.textBaseline = 'middle';
    fctx.lineWidth = R * 0.14; fctx.strokeStyle = '#fff';
    const label = f.kind === 'miss' ? 'Raté' : String(f.kind), ly = y - R * (1.35 + k * 0.6);
    fctx.strokeText(label, x, ly); fctx.fillText(label, x, ly);
    fctx.globalAlpha = 1;
  }
}

/* =====================================================================
   Le drop : déclenché tout seul quand l'ambiance est à fond
   ===================================================================== */
function updateDrop(beats) {
  if (!dropState) {
    if (hype >= 96 && beats - lastDropAt > 64 && beats < SONG_BEATS - 48) {
      const start = Math.ceil(beats / 4) * 4 + 8;
      dropState = { countdown: true, start, until: start + 32 };
      lastDropAt = start;
      music.riser();
      caption('Le DJ prépare le drop…', 2600);
    }
    return;
  }
  const left = dropState.start - beats;
  if (dropState.countdown) {
    if (left <= 3 && left > 0) caption(`${Math.ceil(left)}…`, 600);
    if (left <= 0) {
      dropState.countdown = false;
      music.drop = true;
      club.drop((dropState.until - dropState.start) * SPB);
      caption('DROP !', 2200);
      bestSnapStage = 99;
      setTimeout(() => club.snapshot(), 1600);   // la photo souvenir : en plein drop
    }
  } else if (beats >= dropState.until) {
    music.drop = false;
    dropState = null;
    caption('Quelle soirée !', 1800);
  }
}

/* =====================================================================
   La boucle
   ===================================================================== */
function frame() {
  const beats = music.beats();
  if (playing) {
    generate(beats);
    // les notes qu'on a laissé passer
    updateSliders(beats);
    for (const n of notes) if (!n.done && !n.holding && (beats - n.t) * SPB > WIN[50]) judge(n, 'miss');
    notes = notes.filter((n) => !n.done || beats - n.t < 2 + (n.len ?? 0));
    hype = Math.max(0, hype - 0.35 / 60);
    updateDrop(beats);
    if (beats > SONG_BEATS + 2 && gen.t >= SONG_BEATS && !notes.some((n) => !n.done)) endGame();
  } else {
    hype = Math.max(0, hype - 2 / 60);
  }
  club.hype = hype;
  music.hype = hype;

  // ambiance, paliers, effets qui s'allument tout seuls
  $('#meter-fill').style.width = `${hype}%`;
  const s = STAGES.filter(([min]) => hype >= min).length - 1;
  if (s !== stage) {
    if (s > stage && playing) caption(STAGES[s][2], 1800);
    // photo souvenir : à chaque nouveau palier le plus haut de la soirée (le drop en prendra une meilleure)
    if (playing && s > bestSnapStage) { bestSnapStage = s; setTimeout(() => club.snapshot(), 900); }
    stage = s; $('#stage-name').textContent = STAGES[s][1];
  }
  for (const [fx, at] of Object.entries(FX_AT)) club.fx[fx] = hype >= at;

  // la foule : plus l'ambiance monte, plus il y a de Mii sur la piste
  const target = Math.min(MAX_DANCERS, 2 + Math.round((hype / 100) * (MAX_DANCERS - 2)));
  crowdTimer -= 1 / 60;
  const count = club.dancers.filter((d) => !d.leaving).length;
  if (crowdTimer <= 0 && count !== target) {
    if (count < target) {
      const r = club.addDancer(pool[nextMii++ % pool.length]);
      if (r?.duo && playing) caption(`${r.duo[0]} et ${r.duo[1]} dansent en duo !`, 2000);
    }
    else club.removeDancer();
    crowdTimer = count < target ? 0.35 : 1.2;
  }

  drawField(beats);
  club.update(beats);
  requestAnimationFrame(frame);
}

function endGame() {
  playing = false;
  music.stop();
  const acc = accuracy();
  updateHud();
  const rank = counts.miss === 0 && acc >= 98 ? 'S+' : acc >= 95 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : acc >= 70 ? 'C' : 'D';
  $('#rank').textContent = rank;
  $('#r-score').textContent = score.toLocaleString('fr-FR');
  $('#r-acc').textContent = `${acc.toFixed(2).replace('.', ',')} %`;
  $('#r-combo').textContent = maxCombo;
  $('#r-hits').textContent = `${counts[300]} / ${counts[100]} / ${counts[50]} / ${counts.miss}`;
  $('#r-level').textContent = LEVELS[level].name;
  $('#results').hidden = false;
  if (club.snap) {
    $('#souvenir-img').src = club.snap;
    const d = new Date();
    $('#souvenir-text').textContent = `La boîte des Mii · ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} · Rang ${rank}`;
    $('#souvenir').hidden = false;
  }
  caption(rank.startsWith('S') ? 'Soirée légendaire !' : 'Merci d’être venu·e !', 3000);
}

/* ---------- le choix du niveau (sur l'écran d'entrée et les résultats) ---------- */
function setLevel(id) {
  level = id;
  APPROACH = LEVELS[id].approach;
  WIN = LEVELS[id].win;
  resizeField();
  try { localStorage.setItem(LEVEL_STORE, id); } catch { /* rien */ }
  document.querySelectorAll('.levels button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.level === id)));
}
document.querySelectorAll('.levels').forEach((el) => el.addEventListener('click', (e) => {
  const b = e.target.closest('[data-level]');
  if (b) setLevel(b.dataset.level);
}));
setLevel(level);

/* ---------- son et boutons ---------- */
$('#mute').addEventListener('click', (e) => {
  music.setMuted(!music.muted);
  e.currentTarget.setAttribute('aria-pressed', String(music.muted));
  e.currentTarget.querySelector('use').setAttribute('href', music.muted ? '#i-mute' : '#i-sound');
});
$('#open').addEventListener('click', () => {
  music.start();
  newGame();
  $('#start').hidden = true;
  caption('Ouverture des portes !', 2200);
});
$('#again').addEventListener('click', () => {
  $('#souvenir').hidden = true;
  music.restart();
  newGame();
  $('#results').hidden = true;
  caption('C’est reparti !', 1800);
});

/* ---------- démarrage ---------- */
try {
  await initMii('../day-01-pulse/');
} catch (e) {
  $('#loading').textContent = 'Impossible de charger les Mii.';
  throw e;
}
pool = loadPool();
club = new Club($('#club'));
music = new Music();
club.setDJ(pool[0]);   // le DJ, c'est toi : ton premier Mii du jour 1
club.addDancer(pool[nextMii++]);
club.addDancer(pool[nextMii++]);
resizeField();
$('#loading').classList.add('done');
$('#open').disabled = false;
$('#open').textContent = 'Ouvrir la boîte';
requestAnimationFrame(frame);
