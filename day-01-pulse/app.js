// Devtober J1 · Pulse — testeur d'affinité façon Tomodachi Life, avec de vrais Mii 3D
import {
  initMii, MiiScene, EXPR, renderIcon, randomMii, toCharInfo, parseCode,
  getField, setField, getName, setName, FIELDS, bytesToB64, b64ToBytes,
} from './mii3d.js?v=1.3b';

const $ = (s, el = document) => el.querySelector(s);
const STORE = 'devtober-pulse-miis-v3';

/* ---------- Données de base ---------- */
const FAV = ['#d21e14', '#ff6e19', '#ffd820', '#78d220', '#00782d', '#0a48b4',
             '#3caade', '#f55a7d', '#7328ad', '#483818', '#e0e0e0', '#181814'];
const FAV_NAMES = ['rouge', 'orange', 'jaune', 'vert clair', 'vert', 'bleu',
                   'bleu ciel', 'rose', 'violet', 'marron', 'blanc', 'noir'];
const SKIN = ['#ffd3ad', '#ffb66b', '#de7a46', '#ffaa8c', '#ad5129', '#632c18'];
const HAIR = ['#1e1a18', '#401c0a', '#6c2410', '#7c3c1e', '#787878', '#4e3a1a', '#885c18', '#d0a04a'];
const EYE = ['#000000', '#787878', '#603c28', '#706830', '#3878c0', '#387050'];
const LIPS = ['#d85a42', '#f00c08', '#f45a5c', '#e8a080', '#1c1c1c'];
const GLASS = ['#000000', '#605e30', '#a42410', '#204890', '#c88800', '#808080'];

const AXES = [
  { k: 'energie',   l: 'Calme',     r: 'Énergique' },
  { k: 'bavard',    l: 'Discret',   r: 'Bavard' },
  { k: 'fantaisie', l: 'Sérieux',   r: 'Farfelu' },
  { k: 'social',    l: 'Solitaire', r: 'Sociable' },
];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const SIGNS = ['Bélier', 'Taureau', 'Gémeaux', 'Cancer', 'Lion', 'Vierge',
               'Balance', 'Scorpion', 'Sagittaire', 'Capricorne', 'Verseau', 'Poissons'];

const VERDICTS = {
  amour: [[15, 'Aucune étincelle…'], [30, 'Totalement friendzoné !'], [45, 'Ça reste tiède'],
          [60, 'Un petit quelque chose…'], [75, 'Ça papillonne !'], [90, 'Coup de foudre !'], [101, 'Âmes sœurs !!']],
  amitie: [[15, 'Eau et huile !'], [30, 'Ça grince un peu'], [45, 'Simples connaissances'],
           [60, 'Bonnes relations !'], [75, 'Copains comme cochons'], [90, 'Inséparables !'], [101, 'Amis pour la vie !']],
};
const SHAPES = {
  amour: 'M50 88 C20 66 4 48 4 30 C4 14 16 4 30 4 C40 4 47 10 50 18 C53 10 60 4 70 4 C84 4 96 14 96 30 C96 48 80 66 50 88Z',
  amitie: 'M50 4 L61 36 L95 36 L68 56 L78 89 L50 69 L22 89 L32 56 L5 36 L39 36Z',
};

/* ---------- Utilitaires ---------- */
const uid = () => Math.random().toString(36).slice(2, 10);
const rand = (n) => Math.floor(Math.random() * n);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const daysIn = (m) => new Date(2024, m, 0).getDate();
const randomPerso = () => Object.fromEntries(AXES.map((a) => [a.k, rand(9)]));

function hash(str) { // FNV-1a → 0..1, stable pour un même couple
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Habitants ----------
   Un habitant = { id, data (CharInfo du Mii en base64 : visage, prénom, anniversaire…), perso } */
let miis = [];
const info = (m) => {
  const b = b64ToBytes(m.data);
  return {
    name: getName(b) || 'Mii', gender: getField(b, 'gender') === 1 ? 'f' : 'm',
    month: getField(b, 'birthMonth'), day: getField(b, 'birthDay'), color: getField(b, 'favoriteColor'),
  };
};
function load() {
  try { miis = JSON.parse(localStorage.getItem(STORE)) || []; } catch { miis = []; }
  if (!Array.isArray(miis)) miis = [];
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(miis)); } catch { /* navigation privée */ }
}
// Trois habitants de base, créés une seule fois (si on les supprime, ils ne reviennent pas)
function seedOnce() {
  try {
    if (localStorage.getItem(STORE + '-seeded')) return;
    localStorage.setItem(STORE + '-seeded', '1');
  } catch { /* stockage indisponible : on les crée quand même */ }
  if (miis.length >= 3) return;
  const base = [['Alex', 0, 3, 14], ['Lou', 1, 7, 2], ['Sam', 0, 11, 23]];
  for (const [name, g, month, day] of base) {
    const b = randomMii(g);
    setName(b, name);
    setField(b, 'birthMonth', month);
    setField(b, 'birthDay', day);
    miis.push({ id: uid(), data: bytesToB64(b), perso: randomPerso() });
  }
  save();
}

// Ancienne version : des Mii d'exemple étaient créés au premier lancement. On les retire une fois.
function removeOldSeed() {
  try {
    if (localStorage.getItem(STORE + '-seed-cleared')) return;
    const names = ['Léa', 'Tom', 'Inès', 'Hugo', 'Jade', 'Malo'];
    miis = miis.filter((m) => !names.includes(info(m).name));
    save();
    localStorage.setItem(STORE + '-seed-cleared', '1');
  } catch { /* stockage indisponible */ }
}

/* ---------- Le calcul d'affinité ---------- */
const signOf = ({ month, day }) => {
  if (!month || !day) return null;
  const cuts = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  return day < cuts[month - 1] ? (month + 8) % 12 : (month + 9) % 12;
};
function persoLabel(p) {
  const hiE = p.energie >= 4, hiS = p.social >= 4;
  return hiE && hiS ? 'Boute-en-train' : hiE ? 'Aventurier' : hiS ? 'Confident' : 'Rêveur';
}

function compat(a, b, mode) {
  const ia = info(a), ib = info(b);
  // 1. Personnalité : en amitié on aime se ressembler,
  //    en amour un bavard + un discret ou un sérieux + un farfelu, ça se complète.
  const perso = AXES.reduce((sum, { k }, i) => {
    const d = Math.abs(a.perso[k] - b.perso[k]) / 8;
    const complementary = mode === 'amour' && (i === 1 || i === 2);
    return sum + (complementary ? 0.35 + 0.65 * d : 1 - d);
  }, 0) / AXES.length;
  // 2. Astres : mêmes éléments ou éléments amis (Feu/Air, Terre/Eau)
  const sa = signOf(ia), sb = signOf(ib);
  let stars = 0.5;
  if (sa !== null && sb !== null) {
    const ea = sa % 4, eb = sb % 4;
    stars = ea === eb ? 1 : (ea + eb) % 2 === 0 ? 0.8 : ea + eb === 3 ? 0.15 : 0.45;
  }
  // 3. Couleurs préférées : distance sur la roue
  const dc = Math.abs(ia.color - ib.color);
  const color = 1 - Math.min(dc, 12 - dc) / 6;
  // 4. Grain de folie : stable pour un même couple (le résultat ne change jamais, comme dans le jeu)
  const chaos = hash([a.data, b.data].sort().join('+') + mode);

  const w = mode === 'amour' ? [45, 25, 10, 20] : [55, 15, 15, 15];
  const raw = perso * w[0] + stars * w[1] + color * w[2] + chaos * w[3];
  // 5. Plus de drame : la somme brute tombe presque toujours entre 30 et 89.
  //    On la recentre puis on l'étire avec une courbe qui pousse vers les extrêmes,
  //    pour avoir de vrais coups de foudre (90 %+) et de vrais désastres (moins de 15 %).
  const x = clamp((raw - 58) / 21, -1, 1);
  const score = clamp(Math.round(50 + 50 * Math.sign(x) * Math.pow(Math.abs(x), 0.72)), 1, 100);
  return { score, verdict: VERDICTS[mode].find(([max]) => score < max)[1], ia, ib };
}

/* ---------- Son : un battement de cœur ---------- */
let actx = null;
let muted = false;
function tone(freq, start, dur, vol, type = 'sine', end = null) {
  if (muted) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + start;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* pas d'audio */ }
}
const thump = (s = 1) => { tone(95, 0, 0.16, 0.5 * s, 'sine', 40); tone(80, 0.13, 0.14, 0.3 * s, 'sine', 38); };
const blip = () => tone(880, 0, 0.06, 0.08, 'square');

/** Note avec vibrato (pour le trombone raté). */
function wobble(freq, start, dur, vol, end) {
  if (muted) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + start;
    const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), depth = actx.createGain();
    const lp = actx.createBiquadFilter();
    o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 900;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(end, t + dur);
    lfo.frequency.value = 6; depth.gain.value = freq * 0.03;
    lfo.connect(depth).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(actx.destination);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  } catch { /* pas d'audio */ }
}

const note = (semi) => 523.25 * Math.pow(2, semi / 12);   // demi-tons au-dessus du do5

/**
 * Musique de suspense pendant que le compteur tourne : une petite boîte à musique
 * qui monte avec le score, puis un trémolo nerveux quand le compteur hésite.
 */
const music = {
  timer: null, step: 0, level: 0, mode: 'rise',
  start() {
    this.stop();
    this.step = 0; this.level = 0; this.mode = 'rise';
    this.timer = setInterval(() => this.tick(), 150);
  },
  rise(level) { this.level = level; if (this.mode !== 'rise') { this.mode = 'rise'; this.restart(150); } },
  hesitate() { if (this.mode !== 'hesitate') { this.mode = 'hesitate'; this.restart(95); } },
  restart(ms) { clearInterval(this.timer); this.timer = setInterval(() => this.tick(), ms); },
  stop() { clearInterval(this.timer); clearTimeout(this.timer); this.timer = null; },

  /**
   * Après le résultat : une petite boucle dont le tempo suit l'affinité (lente et triste en bas,
   * rapide et joyeuse en haut). Le cœur bat sur chaque temps, et onBeat fait rebondir les Mii.
   */
  groove(score, onBeat) {
    this.stop();
    const bpm = 64 + score * 0.72;
    const half = 60000 / bpm / 2;   // une croche
    const prog = score >= 70 ? [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]   // majeur, joyeux
      : score >= 40 ? [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14]]              // tranquille
      : [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-5, -2, 2]];                           // mineur, triste
    const low = score < 40 ? -12 : 0;
    let step = 0, next = performance.now();
    const loop = () => {
      const s = step++, chord = prog[Math.floor(s / 8) % 4];
      if (score >= 40 || s % 2 === 0) tone(note(chord[[0, 1, 2, 1][s % 4]] + low), 0, 0.2, score >= 40 ? 0.045 : 0.05, 'triangle');
      if (score >= 90 && s % 8 === 7) tone(note(chord[2] + 24), 0, 0.12, 0.03, 'sine');
      if (s % 2 === 0) {
        const strong = s % 8 === 0;
        tone(note(chord[0] - 24 + low), 0, 0.35, strong ? 0.07 : 0.045, 'sine');
        thump(strong ? 0.35 : 0.22);   // le cœur bat sur le temps
        onBeat(strong);
      }
      next += half;
      this.timer = setTimeout(loop, Math.max(0, next - performance.now()));
    };
    loop();
  },
  tick() {
    const s = this.step++;
    if (this.mode === 'rise') {
      const arp = [0, 4, 7, 9, 12, 9, 7, 4];
      const lift = Math.floor(this.level * 6);          // la mélodie grimpe avec le score
      tone(note(arp[s % 8] + lift - 12), 0, 0.14, 0.05, 'triangle');
      if (s % 4 === 0) tone(note(lift - 24), 0, 0.3, 0.06, 'sine');
    } else {
      tone(note(s % 2 ? -1 : 0), 0, 0.08, 0.035, 'square');   // si-do-si-do… ça stresse
    }
  },
};

/** Jingle du résultat, selon le score : du coup de foudre au trombone raté. */
function jingle(score) {
  music.stop();
  if (score >= 90) {
    [0, 4, 7, 12, 16].forEach((n, i) => tone(note(n), i * 0.09, 0.3, 0.12, 'triangle'));
    [0, 4, 7].forEach((n) => tone(note(n + 12), 0.5, 1.1, 0.07, 'triangle'));
    [24, 28, 31, 36].forEach((n, i) => tone(note(n), 0.65 + i * 0.07, 0.15, 0.04, 'sine'));
  } else if (score >= 75) {
    [4, 7, 12].forEach((n, i) => tone(note(n), i * 0.11, 0.28, 0.12, 'triangle'));
    [0, 4, 7].forEach((n) => tone(note(n), 0.36, 0.7, 0.06, 'triangle'));
  } else if (score >= 45) {
    tone(note(7), 0, 0.5, 0.11, 'sine');
    tone(note(3), 0.22, 0.7, 0.11, 'sine');
  } else if (score >= 15) {
    [7, 6, 5].forEach((n, i) => tone(note(n - 12), i * 0.28, 0.3, 0.1, 'triangle'));
    tone(note(4 - 12), 0.84, 0.9, 0.1, 'triangle', note(1 - 12));
  } else {
    // le trombone raté : wah… wah… wah… waaaah
    [[-5, -6], [-6, -7], [-7, -8]].forEach(([a, b], i) => wobble(note(a - 12), i * 0.42, 0.36, 0.12, note(b - 12)));
    wobble(note(-8 - 12), 1.26, 1.3, 0.12, note(-11 - 12));
  }
}

/* =====================================================================
   Écran tactile : grille des Mii + deux emplacements
   ===================================================================== */
const picked = [null, null];
let activeSlot = 0;
let focusId = null;   // le Mii sélectionné (celui que « Modifier » ouvre)

function renderGrid() {
  $('#grid').innerHTML = miis.map((m) => {
    const sel = picked.indexOf(m.id);
    return `<li><button type="button" class="tile ${sel >= 0 ? 'sel-' + sel : ''} ${m.id === focusId ? 'focus' : ''}" data-id="${m.id}">
      <img src="${renderIcon(m.data)}" alt=""><span>${esc(info(m).name)}</span></button></li>`;
  }).join('') + `<li><button type="button" class="tile add" id="add-mii" aria-label="Créer un Mii"><svg class="ic"><use href="#i-plus"/></svg><span>Nouveau</span></button></li>`;
  renderSlots();
}
function renderSlots() {
  document.querySelectorAll('.slot').forEach((el, i) => {
    const m = miis.find((x) => x.id === picked[i]);
    const img = $('img', el);
    if (m) img.src = renderIcon(m.data); else img.removeAttribute('src');
    $('.slot-name', el).textContent = m ? info(m).name : '?';
    el.classList.toggle('active', i === activeSlot);
  });
  const f = miis.find((x) => x.id === focusId);
  $('#edit-sel').hidden = !f;
  if (f) $('#edit-name').textContent = info(f).name;
  $('#touch-hint').textContent = `Touche un Mii pour le placer ${activeSlot === 0 ? 'à gauche' : 'à droite'}`;
}

$('#grid').addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  if (!tile) return;
  if (tile.id === 'add-mii') return openMaker();
  blip();
  const id = tile.dataset.id;
  const other = 1 - activeSlot;
  if (picked[other] === id) picked[other] = picked[activeSlot]; // échange si déjà pris de l'autre côté
  picked[activeSlot] = id;
  focusId = id;
  activeSlot = other;
  renderGrid();
  showPicked();
});

/** Avant le test : les Mii choisis attendent sur l'écran du haut. */
function showPicked() {
  runToken++;
  music.stop();
  stage.className = `stage ${mode()}`;
  heart.classList.remove('alive');
  const n = picked.filter(Boolean).length;
  const msg = !miis.length ? 'Crée ton premier Mii avec « Nouveau »'
    : n < 2 ? (miis.length < 2 ? 'Crée un deuxième Mii pour tester' : 'Choisis deux Mii')
    : 'Appuie sur « Tester ! »';
  overlay.innerHTML = `<p class="placeholder bottom">${msg}</p>`;
  const changed = scene3d.set(picked.map((id) => miis.find((m) => m.id === id)).filter(Boolean).map((m) => b64ToBytes(m.data)));
  scene3d.calm();
  scene3d.idle(EXPR.SMILE);
  scene3d.lively(true);
  clearBubbles();
  if (changed) scene3d.enter();
}
document.querySelectorAll('.slot').forEach((el) => el.addEventListener('click', () => {
  activeSlot = Number(el.dataset.slot);
  if (picked[activeSlot]) focusId = picked[activeSlot];
  renderGrid();
}));
$('#edit-sel').addEventListener('click', () => {
  const m = miis.find((x) => x.id === focusId);
  if (m) openMaker(m); else toast('Choisis d\'abord un Mii');
});

/* =====================================================================
   Mii Maker
   ===================================================================== */
const maker = $('#maker');
const form = $('#maker-form');
let preview = null;     // MiiScene de l'aperçu
let editing = null;     // habitant modifié (ou null = nouveau)
let draft = null;       // octets CharInfo en cours d'édition
let draftPerso = null;
let tab = 'profil';

// Chaque onglet = une liste de réglages. [type, champ, libellé, (couleurs | min)]
const TABS = [
  { id: 'profil', icon: 'user', label: 'Profil', zoom: 'body' },
  { id: 'visage', icon: 'face', label: 'Visage', zoom: 'face', ctrls: [
    ['step', 'faceType', 'Forme'], ['color', 'faceColor', 'Teint', SKIN],
    ['step', 'faceMake', 'Maquillage'], ['step', 'faceTex', 'Traits'] ] },
  { id: 'cheveux', icon: 'hair', label: 'Coiffure', zoom: 'face', ctrls: [
    ['step', 'hairType', 'Coupe'], ['color', 'hairColor', 'Couleur', HAIR], ['toggle', 'hairFlip', 'Raie inversée'] ] },
  { id: 'sourcils', icon: 'brow', label: 'Sourcils', zoom: 'face', ctrls: [
    ['step', 'eyebrowType', 'Forme'], ['color', 'eyebrowColor', 'Couleur', HAIR],
    ['range', 'eyebrowScale', 'Taille'], ['range', 'eyebrowY', 'Hauteur', 3, true], ['range', 'eyebrowX', 'Écart'] ] },
  { id: 'yeux', icon: 'eye', label: 'Yeux', zoom: 'face', ctrls: [
    ['step', 'eyeType', 'Forme'], ['color', 'eyeColor', 'Couleur', EYE],
    ['range', 'eyeScale', 'Taille'], ['range', 'eyeY', 'Hauteur', 0, true], ['range', 'eyeX', 'Écart'] ] },
  { id: 'nez', icon: 'nose', label: 'Nez', zoom: 'face', ctrls: [
    ['step', 'noseType', 'Forme'], ['range', 'noseScale', 'Taille'], ['range', 'noseY', 'Hauteur', 0, true] ] },
  { id: 'bouche', icon: 'mouth', label: 'Bouche', zoom: 'face', ctrls: [
    ['step', 'mouthType', 'Forme'], ['color', 'mouthColor', 'Couleur', LIPS],
    ['range', 'mouthScale', 'Taille'], ['range', 'mouthY', 'Hauteur', 0, true] ] },
  { id: 'extras', icon: 'glasses', label: 'Extras', zoom: 'face', ctrls: [
    ['step', 'glassType', 'Lunettes'], ['color', 'glassColor', 'Monture', GLASS],
    ['step', 'beardMustache', 'Moustache'], ['step', 'beardType', 'Barbe'], ['color', 'beardColor', 'Pilosité', HAIR],
    ['toggle', 'moleType', 'Grain de beauté'] ] },
  { id: 'corps', icon: 'body', label: 'Silhouette', zoom: 'body', ctrls: [
    ['range', 'height', 'Taille'], ['range', 'build', 'Corpulence'] ] },
];

function renderTabs() {
  $('#tabs').innerHTML = TABS.map((t) =>
    `<button type="button" role="tab" data-tab="${t.id}" aria-selected="${t.id === tab}"><svg class="ic"><use href="#i-${t.icon}"/></svg><small>${t.label}</small></button>`).join('');
}
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  renderTabs(); renderPanel();
});

function renderPanel() {
  const t = TABS.find((x) => x.id === tab);
  preview.frame(t.zoom);
  if (t.id === 'profil') return renderProfil();
  $('#panel').innerHTML = t.ctrls.map(([type, key, label, extra, invert]) => {
    const v = getField(draft, key), max = FIELDS[key][1];
    if (type === 'step') return `<div class="ctrl"><b>${label}</b><div class="stepper">
      <button type="button" data-step="${key}" data-d="-1" aria-label="${label} précédent"><svg class="ic"><use href="#i-left"/></svg></button>
      <output>${v + 1} / ${max + 1}</output>
      <button type="button" data-step="${key}" data-d="1" aria-label="${label} suivant"><svg class="ic"><use href="#i-right"/></svg></button></div></div>`;
    if (type === 'color') return `<div class="ctrl"><b>${label}</b><div class="swatches">${extra.map((c, i) =>
      `<button type="button" data-set="${key}" data-v="${i}" aria-pressed="${i === v}" aria-label="${label} ${i + 1}" style="background:${c}"></button>`).join('')}</div></div>`;
    if (type === 'range') {
      const min = extra ?? 0;
      // pour les hauteurs, la valeur Mii augmente vers le bas : on inverse le curseur
      const shown = invert ? max + min - v : v;
      return `<div class="ctrl"><b>${label}</b><input type="range" data-range="${key}" data-inv="${invert ? 1 : 0}" min="${min}" max="${max}" value="${shown}"></div>`;
    }
    if (type === 'toggle') return `<div class="ctrl"><b>${label}</b><div class="seg">
      <button type="button" data-set="${key}" data-v="0" aria-pressed="${v === 0}">Non</button>
      <button type="button" data-set="${key}" data-v="1" aria-pressed="${v === 1}">Oui</button></div></div>`;
    return '';
  }).join('');
}

function renderProfil() {
  const month = getField(draft, 'birthMonth') || 1, day = getField(draft, 'birthDay') || 1;
  const g = getField(draft, 'gender'), fav = getField(draft, 'favoriteColor');
  const s = signOf({ month, day });
  $('#panel').innerHTML = `
    <div class="ctrl"><b>Prénom</b><input type="text" id="f-name" maxlength="10" value="${esc(getName(draft))}" placeholder="Prénom du Mii" autocomplete="off"></div>
    <div class="ctrl"><b>Genre</b><div class="seg">
      <button type="button" data-set="gender" data-v="0" aria-pressed="${g === 0}">Garçon</button>
      <button type="button" data-set="gender" data-v="1" aria-pressed="${g === 1}">Fille</button></div></div>
    <div class="ctrl"><b>Anniversaire</b><div class="row2">
      <select id="f-day">${Array.from({ length: daysIn(month) }, (_, i) => `<option value="${i + 1}" ${i + 1 === day ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select id="f-month">${MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === month ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="ctrl"><b>Couleur préférée</b><div class="swatches">${FAV.map((c, i) =>
      `<button type="button" data-set="favoriteColor" data-v="${i}" aria-pressed="${i === fav}" aria-label="${FAV_NAMES[i]}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="ctrl"><b>Personnalité</b>
      ${AXES.map((a) => `<label class="perso-row"><span>${a.l}</span><input type="range" data-perso="${a.k}" min="0" max="8" value="${draftPerso[a.k]}"><span>${a.r}</span></label>`).join('')}
      <p class="perso-label">${persoLabel(draftPerso)} · ${SIGNS[s]}</p></div>
    <details class="import-box"><summary>Importer un Mii existant</summary>
      <p class="hint">Un fichier <code>.ffsd</code> / <code>.charinfo</code> (depuis <a href="https://joshuathenewuser.github.io/mii-creator/" target="_blank" rel="noopener">Mii Creator</a>) ou un code hex/base64.</p>
      <div class="inline"><label class="mini-btn"><svg class="ic"><use href="#i-file"/></svg>Fichier<input id="mii-file" type="file" hidden></label>
      <input type="text" id="mii-code" placeholder="Code Mii…" autocomplete="off" spellcheck="false"><button type="button" id="load-code" class="mini-btn">OK</button></div>
      <p id="import-error" class="error" hidden></p></details>`;
  // birthMonth/birthDay doivent être valides pour l'anniversaire affiché
  setField(draft, 'birthMonth', month); setField(draft, 'birthDay', day);
}

/** Applique un changement au Mii en cours et met l'aperçu à jour. */
function change(key, value, rerender = true) {
  setField(draft, key, value);
  preview.update(draft);
  if (rerender) renderPanel();
}

$('#panel').addEventListener('click', (e) => {
  const step = e.target.closest('[data-step]');
  const set = e.target.closest('[data-set]');
  if (step) {
    const key = step.dataset.step, max = FIELDS[key][1];
    blip();
    change(key, (getField(draft, key) + Number(step.dataset.d) + max + 1) % (max + 1));
  } else if (set) {
    blip();
    change(set.dataset.set, Number(set.dataset.v));
  } else if (e.target.id === 'load-code') {
    importBytes(() => parseCode($('#mii-code').value));
  }
});
$('#panel').addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.range) {
    const key = el.dataset.range, max = FIELDS[key][1], min = Number(el.min);
    const v = Number(el.value);
    change(key, el.dataset.inv === '1' ? max + min - v : v, false);
  } else if (el.dataset.perso) {
    draftPerso[el.dataset.perso] = Number(el.value);
    const s = signOf({ month: getField(draft, 'birthMonth'), day: getField(draft, 'birthDay') });
    $('.perso-label').textContent = `${persoLabel(draftPerso)} · ${SIGNS[s]}`;
  } else if (el.id === 'f-name') {
    setName(draft, el.value);
  } else if (el.id === 'f-month' || el.id === 'f-day') {
    const m = Number($('#f-month').value);
    setField(draft, 'birthMonth', m);
    setField(draft, 'birthDay', Math.min(Number($('#f-day').value), daysIn(m)));
    renderPanel();
  }
});
$('#panel').addEventListener('change', async (e) => {
  if (e.target.id !== 'mii-file') return;
  const file = e.target.files[0];
  if (file) { const buf = new Uint8Array(await file.arrayBuffer()); importBytes(() => buf); }
});

function importBytes(getBytes) {
  try {
    const name = getName(draft);
    draft = toCharInfo(getBytes());
    if (!getName(draft)) setName(draft, name);
    if (!getField(draft, 'birthMonth')) { setField(draft, 'birthMonth', 1); setField(draft, 'birthDay', 1); }
    preview.update(draft);
    renderPanel();
    toast('Mii importé !');
  } catch (err) {
    console.error(err);
    const el = $('#import-error');
    el.textContent = 'Ce Mii n\'a pas pu être lu.';
    el.hidden = false;
  }
}

function openMaker(m = null) {
  editing = m;
  if (m) {
    draft = b64ToBytes(m.data);
    draftPerso = { ...m.perso };
  } else {
    draft = randomMii();
    const month = rand(12) + 1;
    setField(draft, 'birthMonth', month);
    setField(draft, 'birthDay', rand(daysIn(month)) + 1);
    draftPerso = randomPerso();
  }
  tab = 'profil';
  $('#maker-title').textContent = m ? `Mii Maker · ${getName(draft)}` : 'Mii Maker · Nouveau Mii';
  $('#delete').hidden = !m;
  maker.showModal();
  preview.spin = 0;
  preview.resize();
  preview.set([draft]);
  preview.idle(EXPR.SMILE);
  renderTabs();
  renderPanel();
  if (!m) $('#f-name')?.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = getName(draft).trim();
  if (!name) { tab = 'profil'; renderTabs(); renderPanel(); $('#f-name').focus(); toast('Donne un prénom à ton Mii !'); return; }
  const m = { id: editing?.id ?? uid(), data: bytesToB64(draft), perso: draftPerso };
  const i = miis.findIndex((x) => x.id === m.id);
  if (i >= 0) miis[i] = m; else miis.push(m);
  save();
  if (!editing) { picked[activeSlot] = m.id; activeSlot = 1 - activeSlot; }
  focusId = m.id;
  renderGrid(); showPicked();
  maker.close();
  toast(editing ? `${name} a été modifié !` : `${name} a emménagé sur l'île !`);
});
$('#cancel').addEventListener('click', () => maker.close());
$('#delete').addEventListener('click', () => {
  if (!editing || !confirm(`Supprimer ${getName(draft)} de l'île ?`)) return;
  miis = miis.filter((x) => x.id !== editing.id);
  picked.forEach((id, i) => { if (id === editing.id) picked[i] = null; });
  save(); renderGrid(); showPicked();
  maker.close();
});
$('#randomize').addEventListener('click', () => {
  const name = getName(draft), month = getField(draft, 'birthMonth'), day = getField(draft, 'birthDay');
  const gender = getField(draft, 'gender');
  draft = randomMii(gender);
  setName(draft, name); setField(draft, 'birthMonth', month); setField(draft, 'birthDay', day);
  preview.update(draft);
  renderPanel();
});
document.querySelectorAll('[data-turn]').forEach((b) => b.addEventListener('click', () => {
  preview.spin += Number(b.dataset.turn) * Math.PI / 4;
}));
maker.addEventListener('close', () => preview.clear());

/* =====================================================================
   Le test (le cœur du "Pulse")
   ===================================================================== */
const stage = $('#stage');
const overlay = $('#overlay');
const heart = $('.heart', stage);
let scene3d = null;
let runToken = 0;
const mode = () => document.querySelector('[name="mode"]:checked').value;

function runTest() {
  const a = miis.find((m) => m.id === picked[0]);
  const b = miis.find((m) => m.id === picked[1]);
  if (!a || !b) return toast('Choisis deux Mii !');

  const md = mode();
  const r = compat(a, b, md);
  const token = ++runToken;
  music.stop();

  stage.className = `stage ${md} running`;
  heart.querySelector('path').setAttribute('d', SHAPES[md]);
  heart.classList.remove('alive');
  overlay.innerHTML = `
    <p class="title-line outline-w">${md === 'amour' ? 'Affinité amoureuse' : 'Affinité amicale'} entre
      <span class="n-${r.ia.gender}">${esc(r.ia.name)}</span> et <span class="n-${r.ib.gender}">${esc(r.ib.name)}</span> :</p>
    <p class="score"><span class="num">0</span><small>%</small></p>
    <p class="verdict">${esc(r.verdict)}</p>`;

  scene3d.set([b64ToBytes(a.data), b64ToBytes(b.data)]);
  scene3d.lively(false);
  scene3d.watch();   // ils regardent le score
  scene3d.idle(EXPR.NORMAL);
  scene3d.enter();   // les deux Mii arrivent chacun de leur côté
  clearBubbles();

  const num = $('.num', overlay);
  const steps = countSequence(r.score);
  let i = 0;

  // Le score avance au rythme d'un cœur : chaque battement = un palier.
  // Il dépasse, redescend, hésite… puis s'arrête sur le vrai résultat.
  const beat = () => {
    if (token !== runToken) return;
    const st = steps[i++];
    num.textContent = st.v;
    if (st.hes) music.hesitate(); else music.rise(i / steps.length);
    heart.classList.remove('beat'); void heart.getBoundingClientRect(); heart.classList.add('beat');
    scene3d.beat();
    thump(st.strength);
    if (i < steps.length) setTimeout(beat, steps[i].delay);
    else setTimeout(finish, 700);
  };
  setTimeout(() => { if (token === runToken) { music.start(); beat(); } }, 1600);   // on attend la fin de l'entrée en scène

  function finish() {
    if (token !== runToken) return;
    num.textContent = r.score;
    $('.score', overlay).classList.add('pop');
    $('.verdict', overlay).classList.add('show');
    jingle(r.score);

    // Les Mii jouent leur petite scène (une par palier de 10 %), puis le cœur bat avec la musique
    scene3d.skit(r.score, md);
    if (r.score >= 75) sparkles(md);
    showBubbles(r.score, md, token);
    afterResult(r.score, token);
  }
}

/**
 * Après le résultat : le cœur bat tout de suite au rythme de l'affinité,
 * puis, à la fin du jingle, il se cale sur la petite musique avec les Mii.
 */
function afterResult(score, token) {
  heart.classList.remove('beat');
  heart.style.setProperty('--period', `${60 / (64 + score * 0.72)}s`);
  heart.classList.add('alive');
  setTimeout(() => {
    if (token !== runToken) return;
    heart.classList.remove('alive');
    music.groove(score, (strong) => {
      if (token !== runToken) return music.stop();
      heart.classList.remove('beat'); void heart.getBoundingClientRect(); heart.classList.add('beat');
      if (strong) scene3d.beat(); else scene3d.bump = Math.max(scene3d.bump, 0.55);
    });
  }, score >= 15 ? 1700 : 2700);   // le trombone raté est plus long
}

/** Les petits événements des scènes : une tape dans la main, une poussée. */
function sceneEvent(kind) {
  if (kind === 'clap') {
    tone(1500, 0, 0.05, 0.12, 'square'); tone(2200, 0.02, 0.08, 0.06, 'triangle');
    const heads = scene3d.headScreen();
    if (heads.length < 2) return;
    const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ic.setAttribute('class', 'float-icon ic fill amitie');
    ic.innerHTML = '<use href="#i-star"/>';
    ic.style.left = `${(heads[0].x + heads[1].x) / 2}%`;
    ic.style.top = `${Math.min(heads[0].y, heads[1].y)}%`;
    overlay.append(ic);
    setTimeout(() => ic.remove(), 1800);
  } else if (kind === 'push') {
    tone(160, 0, 0.18, 0.3, 'sine', 70);
  }
}

/* ---------- Bulles de réaction au-dessus des Mii ---------- */
const LINES = {
  amour: [
    [90, ['Mon âme sœur !', '♥ ♥ ♥', "C'était écrit !", 'Enfin toi…']],
    [75, ['Hihi…', 'Trop mignon !', 'Mon cœur !', '♥']],
    [60, ['Oh ?', 'Pas mal…', 'Hé hé.', 'Intéressant…']],
    [45, ['Hmm…', 'Bon.', 'Peut-être ?', 'Ah.']],
    [30, ['…', 'Mouais.', 'Sans plus.', 'Ah bon.']],
    [15, ['Hmph !', 'Pff…', 'Non merci.', 'Gênant…']],
    [0, ['Beurk !', 'JAMAIS !', 'Hmph !!', 'Au secours…']],
  ],
  amitie: [
    [90, ['Meilleurs potes !', 'À la vie !', '★ ★ ★', 'Inséparables !']],
    [75, ['Trop forts !', 'Les copains !', 'Top !', '★']],
    [60, ['Sympa !', 'Cool.', "On s'entend bien.", 'Hé hé !']],
    [45, ['Salut…', 'Ouais.', 'Bof ?', 'Hmm.']],
    [30, ['…', 'Hum.', 'On se connaît ?', 'Euh…']],
    [15, ['Hmph !', 'Pff…', 'Lui ?!', 'Grr…']],
    [0, ['Jamais !', 'Grr…', 'Hmph !!', "Va-t'en !"]],
  ],
};
let bubbleRaf = 0, bubbleTimers = [];

function clearBubbles() {
  cancelAnimationFrame(bubbleRaf);
  bubbleTimers.forEach(clearTimeout); bubbleTimers = [];
  overlay.querySelectorAll('.bubble, .float-icon').forEach((el) => el.remove());
  overlay.classList.remove('talking');
}

function showBubbles(score, md, token) {
  const lines = LINES[md].find(([min]) => score >= min)[1];
  const shuffled = [...lines].sort(() => Math.random() - 0.5);
  const mood = score >= 75 ? 'good' : score < 30 ? 'bad' : '';
  const bubbles = [];
  const later = (ms, fn) => bubbleTimers.push(setTimeout(() => { if (token === runToken) fn(); }, ms));

  // le titre s'efface le temps que les Mii parlent (les bulles sont juste au-dessus des têtes)
  later(400, () => overlay.classList.add('talking'));
  later(5400, () => overlay.classList.remove('talking'));

  [0, 1].forEach((i) => later(500 + i * 700, () => {
    const b = document.createElement('p');
    b.className = `bubble ${mood}`;
    b.textContent = shuffled[i];
    overlay.append(b);
    bubbles[i] = b;
    later(3800, () => { b.classList.add('out'); later(400, () => b.remove()); });
  }));

  // très bon score : des cœurs (ou des étoiles) s'envolent au-dessus des têtes
  if (score >= 90) {
    for (let k = 0; k < 10; k++) later(700 + k * 420, () => {
      const pos = scene3d.headScreen()[k % 2];
      if (!pos) return;
      const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ic.setAttribute('class', `float-icon ic fill ${md}`);
      ic.innerHTML = `<use href="#i-${md === 'amour' ? 'heart' : 'star'}"/>`;
      ic.style.left = `${pos.x + (Math.random() * 6 - 3)}%`;
      ic.style.top = `${pos.y}%`;
      overlay.append(ic);
      later(1800, () => ic.remove());
    });
  }

  // les bulles suivent la tête des Mii (ils bougent : sautillent, s'éloignent…)
  const follow = () => {
    const heads = scene3d.headScreen();
    bubbles.forEach((b, i) => {
      if (!b || !heads[i]) return;
      // la bulle reste dans l'écran, même quand le Mii saute ou que sa tête dépasse en haut
      const half = (b.offsetWidth / overlay.clientWidth) * 50 + 2;
      const minTop = (b.offsetHeight / overlay.clientHeight) * 100 + 4;
      b.style.left = `${Math.min(100 - half, Math.max(half, heads[i].x))}%`;
      b.style.top = `${Math.min(70, Math.max(minTop, heads[i].y))}%`;
    });
    if (token === runToken) bubbleRaf = requestAnimationFrame(follow);
  };
  cancelAnimationFrame(bubbleRaf);
  bubbleRaf = requestAnimationFrame(follow);
}

/**
 * Les étapes du compteur, façon Tomodachi Life : ça monte de plus en plus vite,
 * ça dépasse le vrai score, ça redescend en dessous, ça hésite, et ça s'arrête.
 * Pour un score très bas, il monte bien haut avant de s'effondrer (c'est plus drôle).
 */
function countSequence(score) {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const peak = score < 20 ? r(38, 60) : Math.min(100, score + r(6, 14));
  const dip = Math.max(0, Math.min(score - r(4, 10), peak - 8));
  const rise = 9 + Math.round(peak / 10);
  const steps = [];
  for (let k = 1; k <= rise; k++) {
    const t = k / rise;
    steps.push({ v: Math.round(peak * (1 - Math.pow(1 - t, 2))), delay: Math.round(420 - 250 * t), strength: 0.5 + t * 0.5 });
  }
  // l'hésitation : plus lente, pour le suspense
  steps.push({ v: dip, delay: 760, strength: 0.7, hes: true });
  if (Math.abs(score - dip) > 6) steps.push({ v: Math.round((score + dip) / 2) + r(-2, 2), delay: 620, strength: 0.8, hes: true });
  steps.push({ v: score, delay: 680, strength: 1.1, hes: true });
  return steps;
}

function sparkles(md) {
  for (let k = 0; k < 10; k++) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', `sparkle ic fill ${md}`);
    s.innerHTML = `<use href="#i-${md === 'amour' ? 'heart' : 'star'}"/>`;
    s.style.left = `${15 + Math.random() * 70}%`;
    s.style.top = `${30 + Math.random() * 40}%`;
    s.style.animationDelay = `${Math.random() * 0.6}s`;
    overlay.append(s);
    setTimeout(() => s.remove(), 2400);
  }
}

$('#run').addEventListener('click', runTest);
document.querySelectorAll('[name="mode"]').forEach((el) => el.addEventListener('change', () => {
  // Changer de mode ne lance rien : on efface le résultat affiché, les Mii restent en place
  // (mêmes Mii = pas de nouvelle entrée en scène), et on attend « Tester ! ».
  if (stage.classList.contains('running')) return showPicked();
  stage.classList.remove('amour', 'amitie');
  stage.classList.add(mode());
}));

/* ---------- Partage par lien + import/export ---------- */
const b64d = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

function adopt({ data, perso }) { // ajoute un habitant s'il n'existe pas déjà, renvoie son id
  const existing = miis.find((m) => m.data === data);
  if (existing) return existing.id;
  const m = { id: uid(), data, perso: { ...randomPerso(), ...perso } };
  miis.push(m);
  return m.id;
}

/* ---------- Capture de l'écran du haut (PNG) ----------
   On redessine l'écran sur un canvas 2D : cadre doré, fond, cœur, Mii (rendu 3D) et textes. */
async function screenshot() {
  await document.fonts.ready;
  const W = 1200, H = 720;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  const md = mode();

  // cadre doré
  const gold = g.createLinearGradient(0, 0, W, H);
  [['#6b3e0c', 0], ['#f7d774', .18], ['#a8701c', .36], ['#ffe89a', .52], ['#8a5a14', .7], ['#f2c95a', .86], ['#6b3e0c', 1]]
    .forEach(([col, o]) => gold.addColorStop(o, col));
  g.fillStyle = gold; g.fillRect(0, 0, W, H);
  const p = Math.round(W * 0.042), sw = W - 2 * p, sh = H - 2 * p;
  g.save(); g.translate(p, p);
  g.beginPath(); g.rect(0, 0, sw, sh); g.clip();

  // fond rose à vagues / doré à losanges
  if (md === 'amour') {
    g.fillStyle = '#ee84ab'; g.fillRect(0, 0, sw, sh);
    g.strokeStyle = '#f7aac6'; g.lineWidth = 6;
    for (let y = 10; y < sh + 20; y += 24) {
      g.beginPath();
      for (let x = 0; x <= sw; x += 4) g.lineTo(x, y + Math.sin(x / 54 * Math.PI * 2) * 6);
      g.stroke();
    }
  } else {
    const t = 36, cols = ['#f8dc82', '#d6a033', '#fbe8a6', '#c48c22'];
    for (let y = 0; y < sh; y += t) for (let x = 0; x < sw; x += t) {
      for (let q = 0; q < 4; q++) {
        g.fillStyle = cols[q]; g.beginPath(); g.moveTo(x + t / 2, y + t / 2);
        const pts = [[x + t, y], [x + t, y + t], [x, y + t], [x, y], [x + t, y]];
        g.lineTo(...pts[q]); g.lineTo(...pts[q + 1]); g.fill();
      }
    }
  }
  const glow = g.createRadialGradient(sw / 2, sh * .55, 0, sw / 2, sh * .55, sw * .45);
  glow.addColorStop(0, 'rgba(255,255,255,.5)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, sw, sh);

  // cœur / étoile (si un résultat est affiché)
  const running = stage.classList.contains('running');
  if (running) {
    const hw = W * 0.26, s = hw / 100;
    g.save(); g.translate(sw / 2 - hw / 2, sh / 2 - 46 * s); g.scale(s, s);
    const path = new Path2D(SHAPES[md]);
    g.globalAlpha = .9; g.fillStyle = md === 'amour' ? '#ff4f86' : '#ffd34d'; g.fill(path);
    g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke(path);
    g.restore();
  }

  // les Mii : on rend la scène 3D et on la copie tout de suite
  scene3d.renderer.render(scene3d.scene, scene3d.camera);
  g.drawImage(scene3d.canvas, 0, 0, sw, sh);

  const outlined = (text, x, y, fill, stroke, lw) => {
    g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(text, x, y);
    g.fillStyle = fill; g.fillText(text, x, y);
  };
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';

  if (running) {
    // titre avec les prénoms en couleur
    const title = $('.title-line', overlay);
    g.font = `900 ${W * 0.036}px Nunito`;
    const parts = [...title.childNodes].map((n) => ({ t: n.textContent.replace(/\s+/g, ' '), col: n.classList?.contains('n-f') ? '#e32b43' : n.classList?.contains('n-m') ? '#1d5fd8' : '#1e1410' }));
    const total = parts.reduce((s, q) => s + g.measureText(q.t).width, 0);
    let x = sw / 2 - total / 2;
    g.textAlign = 'left';
    for (const q of parts) { outlined(q.t, x, H * 0.045 + W * 0.036, q.col, '#fff', W * 0.008); x += g.measureText(q.t).width; }
    g.textAlign = 'center';

    // score doré
    const num = $('.num', overlay).textContent;
    const big = W * 0.19, yBase = sh - H * 0.18 - big * 0.12;
    g.font = `900 ${big}px Cinzel`;
    const wNum = g.measureText(num).width;
    g.font = `900 ${big * 0.5}px Cinzel`;
    const wPct = g.measureText('%').width;
    const x0 = sw / 2 - (wNum + wPct) / 2;
    const goldTxt = g.createLinearGradient(0, yBase - big * .75, 0, yBase);
    [['#fff7c8', 0], ['#f7d054', .35], ['#b67a14', .6], ['#f5d070', .8], ['#8a5a0c', 1]].forEach(([col, o]) => goldTxt.addColorStop(o, col));
    g.textAlign = 'left';
    g.font = `900 ${big}px Cinzel`; outlined(num, x0, yBase, goldTxt, '#5a3606', W * 0.008);
    g.font = `900 ${big * 0.5}px Cinzel`; outlined('%', x0 + wNum, yBase, goldTxt, '#5a3606', W * 0.006);
    g.textAlign = 'center';

    // verdict
    const verdict = $('.verdict', overlay);
    if (verdict.classList.contains('show')) {
      g.font = `900 ${W * 0.056}px Nunito`;
      outlined(verdict.textContent, sw / 2, sh - H * 0.055 - W * 0.01, '#e5232f', '#fff', W * 0.012);
    }
  }
  g.restore();

  const names = picked.map((id) => miis.find((m) => m.id === id)).filter(Boolean).map((m) => info(m).name);
  const link = Object.assign(document.createElement('a'), {
    href: c.toDataURL('image/png'),
    download: `affinite-${names.join('-') || 'mii'}.png`.replace(/[^\w.-]+/g, '_'),
  });
  link.click();
  toast('Capture enregistrée !');
}
$('#shot').addEventListener('click', screenshot);

function readHash() {
  if (location.hash.length < 2) return false;
  try {
    const { m, a, b } = JSON.parse(b64d(location.hash.slice(1)));
    picked[0] = adopt(a);
    picked[1] = adopt(b);
    save();
    const radio = document.querySelector(`[name="mode"][value="${m}"]`);
    if (radio) { radio.checked = true; stage.className = `stage ${m}`; }
    history.replaceState(null, '', location.pathname);
    return true;
  } catch { return false; }
}

$('#export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(miis, null, 2)], { type: 'application/json' });
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'mes-mii.json' });
  link.click();
  URL.revokeObjectURL(link.href);
});
$('#import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const list = JSON.parse(await file.text());
    if (!Array.isArray(list)) throw new Error();
    const ok = list.filter((m) => m && typeof m.data === 'string');
    ok.forEach(adopt);
    save(); renderGrid();
    toast(`${ok.length} Mii importé(s) !`);
  } catch { toast('Fichier invalide'); }
  e.target.value = '';
});
$('#mute').addEventListener('click', (e) => {
  muted = !muted;
  e.currentTarget.setAttribute('aria-pressed', String(muted));
  e.currentTarget.querySelector('use').setAttribute('href', muted ? '#i-mute' : '#i-sound');
  e.currentTarget.setAttribute('aria-label', muted ? 'Remettre le son' : 'Couper le son');
});

/* ---------- Démarrage ---------- */
try {
  await initMii();
} catch (e) {
  console.error(e);
  $('.placeholder', overlay).textContent = 'Impossible de charger les Mii.';
  throw e;
}
preview = new MiiScene($('#preview-canvas'), { duo: false });
scene3d = new MiiScene($('#stage-canvas'));
scene3d.onEvent = sceneEvent;
// Demande au navigateur de ne pas effacer de lui-même les Mii sauvegardés
navigator.storage?.persist?.().catch(() => {});
load();
removeOldSeed();
seedOnce();
const fromLink = readHash();
if (!fromLink) { picked[0] = miis[0]?.id ?? null; picked[1] = miis[1]?.id ?? null; activeSlot = 0; }
focusId = picked[0];
renderGrid();
$('#grid').scrollTop = 0;
$('#run').disabled = false;
if (fromLink) runTest();
else showPicked();
