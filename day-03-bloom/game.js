// Devtober J3 · Bloom — la boîte des Mii : un jeu de rythme façon osu! sur l'écran tactile.
// Touche chaque cercle pile quand l'anneau le rejoint : il s'ouvre en fleur, et la fête « éclot » là-haut.
import { initMii, randomMii, setName, b64ToBytes } from '../day-01-pulse/mii3d.js?v=2';
import { Club } from './club.js?v=8';
import { Music, SECONDS_PER_BEAT as SPB } from './music.js?v=3';

const $ = (s) => document.querySelector(s);
const MII_STORE = 'devtober-pulse-miis-v3';
const MAX_DANCERS = 14;
const SONG_BEATS = 256;          // 64 mesures ≈ 2 minutes
const FIRST_NOTE = 8;            // 2 mesures pour se mettre dans le rythme
const APPROACH = 1.6;            // l'anneau met 1,6 temps à rejoindre le cercle
const WIN = { 300: 0.07, 100: 0.13, 50: 0.19 };   // fenêtres de timing (secondes)
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
    // nouveau groupe (nouvelle couleur, on recompte à partir de 1) toutes les 4 notes ou après une pause
    if (gen.inGroup >= (step < 1 ? 8 : 4) || gen.lastStep === 2) { gen.group++; gen.inGroup = 0; }
    // la position suit un chemin fluide : on tourne un peu à chaque note, on rebondit sur les bords
    gen.angle += (Math.random() - 0.5) * (step < 1 ? 0.7 : 1.8);
    const dist = step < 1 ? 0.11 : 0.24;
    let x = gen.x + Math.cos(gen.angle) * dist, y = gen.y + Math.sin(gen.angle) * dist * 1.3;
    if (x < 0.12 || x > 0.88) { gen.angle = Math.PI - gen.angle; x = Math.min(0.88, Math.max(0.12, x)); }
    if (y < 0.24 || y > 0.76) { gen.angle = -gen.angle; y = Math.min(0.76, Math.max(0.24, y)); }
    gen.x = x; gen.y = y; gen.inGroup++; gen.lastStep = step;
    notes.push({ t, x, y, n: gen.inGroup, color: NOTE_COLORS[gen.group % NOTE_COLORS.length], group: gen.group, done: false });
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
  R = Math.min(W, H) * 0.085;
}
new ResizeObserver(resizeField).observe(field);

function toField(e) {
  const r = field.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
}
field.addEventListener('pointermove', (e) => { pointer = toField(e); });
field.addEventListener('pointerdown', (e) => { e.preventDefault(); pointer = toField(e); hit(pointer); });
document.addEventListener('keydown', (e) => {
  if (!playing || e.repeat) return;
  if (['KeyX', 'KeyC', 'KeyZ', 'KeyW', 'Space'].includes(e.code)) { e.preventDefault(); hit(pointer); }
});

function hit(p) {
  if (!playing) return;
  const now = music.beats();
  // la note la plus ancienne encore jouable, sous le doigt, dans la fenêtre de timing
  const candidate = notes.find((n) => !n.done && Math.abs(n.t - now) * SPB <= WIN[50]
    && Math.hypot((n.x - p.x) * W, (n.y - p.y) * H) <= R * 1.2);
  if (!candidate) return;
  const err = Math.abs(candidate.t - now) * SPB;
  judge(candidate, err <= WIN[300] ? 300 : err <= WIN[100] ? 100 : 50);
}

function judge(note, kind) {
  note.done = true;
  if (kind === 'miss') {
    counts.miss++;
    if (combo >= 10) caption(`Combo perdu (${combo})`, 1200);
    combo = 0;
    hype = Math.max(0, hype - 5);
  } else {
    counts[kind]++;
    combo++; maxCombo = Math.max(maxCombo, combo);
    score += Math.round(kind * (1 + combo / 25));
    hype = Math.min(100, hype + (kind === 300 ? 2.4 : kind === 100 ? 1.2 : 0.3));
    // le cercle s'ouvre en fleur… et une fleur de lumière éclot sur la piste, au même endroit
    club.bloomAt((note.x - 0.5) * 18, (note.y - 0.5) * 14, null, kind === 300 ? 1.2 : 0.7);
  }
  effects.push({ x: note.x, y: note.y, t0: performance.now(), kind, color: note.color });
  updateHud();
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
  const visible = notes.filter((n) => !n.done && n.t - beats <= APPROACH && n.t - beats > -0.5);
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
  // les cercles : les plus lointains d'abord, le prochain à toucher par-dessus
  for (let i = visible.length - 1; i >= 0; i--) {
    const n = visible[i], left = n.t - beats, x = n.x * W, y = n.y * H;
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
    for (const n of notes) if (!n.done && (beats - n.t) * SPB > WIN[50]) judge(n, 'miss');
    notes = notes.filter((n) => !n.done || beats - n.t < 2);
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
  if (s !== stage) { if (s > stage && playing) caption(STAGES[s][2], 1800); stage = s; $('#stage-name').textContent = STAGES[s][1]; }
  for (const [fx, at] of Object.entries(FX_AT)) club.fx[fx] = hype >= at;

  // la foule : plus l'ambiance monte, plus il y a de Mii sur la piste
  const target = Math.min(MAX_DANCERS, 2 + Math.round((hype / 100) * (MAX_DANCERS - 2)));
  crowdTimer -= 1 / 60;
  const count = club.dancers.filter((d) => !d.leaving).length;
  if (crowdTimer <= 0 && count !== target) {
    if (count < target) club.addDancer(pool[nextMii++ % pool.length]);
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
  $('#results').hidden = false;
  caption(rank.startsWith('S') ? 'Soirée légendaire !' : 'Merci d’être venu·e !', 3000);
}

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
