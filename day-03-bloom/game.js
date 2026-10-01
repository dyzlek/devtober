// Devtober J3 · Bloom — la boîte des Mii : tu es le DJ, tape en rythme et fais éclore la fête.
import { initMii, randomMii, setName, b64ToBytes } from '../day-01-pulse/mii3d.js?v=2';
import { Club } from './club.js?v=6';
import { Music, SECONDS_PER_BEAT } from './music.js?v=2';

const $ = (s) => document.querySelector(s);
const MII_STORE = 'devtober-pulse-miis-v3';
const MAX_DANCERS = 14;

const STAGES = [
  [0, 'Calme', 'La soirée commence…'],
  [20, 'Ça s’anime', 'Ça s’anime !'],
  [45, 'Ça chauffe', 'Ça chauffe !'],
  [70, 'En feu', 'La piste est en feu !'],
  [90, 'Pleine floraison', 'PLEINE FLORAISON'],
];
const FX = [
  { id: 'ball', label: 'Boule', icon: 'i-ball', at: 0 },
  { id: 'smoke', label: 'Fumée', icon: 'i-smoke', at: 15 },
  { id: 'lasers', label: 'Lasers', icon: 'i-laser', at: 35 },
  { id: 'strobe', label: 'Strobo', icon: 'i-strobe', at: 60 },
];

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
let hype = 0, combo = 0, lastTapBeat = -1, lastTapTime = 0, stage = 0;
const unlocked = new Set(['ball']);
let dropState = null;   // { start (en temps), until }
let crowdTimer = 0;

function caption(text, ms = 1800) {
  const el = $('#caption');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(caption.t);
  caption.t = setTimeout(() => el.classList.remove('show'), ms);
}
function rating(text, color) {
  const el = $('#rating');
  el.textContent = text;
  el.style.setProperty('--glow', color);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

/* ---------- taper en rythme ---------- */
function tap() {
  if (!music?.started || dropState?.countdown) return;
  const beats = music.beats(), nearest = Math.round(beats), off = Math.abs(music.offset());
  const pad = $('#pad');
  pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90);
  lastTapTime = performance.now();
  if (nearest === lastTapBeat) return;   // un seul tap compte par temps
  lastTapBeat = nearest;
  let gain, label, color;
  if (off <= 0.07) { gain = 1.8; label = 'PARFAIT !'; color = '#ffd02d'; combo++; }
  else if (off <= 0.13) { gain = 1.1; label = 'Bien !'; color = '#2dff8a'; combo++; }
  else if (off <= 0.2) { gain = 0.3; label = 'Ok'; color = '#2de2ff'; }
  else { gain = -4; label = 'Raté…'; color = '#ff5a5a'; combo = 0; }
  hype = Math.max(0, Math.min(100, hype + gain + (gain > 0 ? Math.min(combo, 30) * 0.03 : 0)));
  rating(combo > 3 && gain > 0 ? `${label} ×${combo}` : label, color);
  $('#combo').textContent = combo;
  $('#feedback').textContent = gain > 0
    ? (combo >= 8 ? `Quelle série ! La foule adore (${combo} d'affilée).` : 'Garde le rythme !')
    : 'Écoute le kick (boum, boum…) et tape pile dessus.';
  // chaque bon tap fait éclore une fleur de lumière sur la piste
  if (gain >= 1) club.bloomAt((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, null, gain > 1.5 ? 1.2 : 0.8);
}
$('#pad').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') { if (!$('#start').hidden) return; e.preventDefault(); if (!e.repeat) tap(); }
});

/* ---------- effets ---------- */
function renderFx() {
  $('#fx').innerHTML = FX.map((f) => {
    const ok = unlocked.has(f.id);
    return `<button type="button" data-fx="${f.id}" aria-pressed="${!!club.fx[f.id]}" ${ok ? '' : 'disabled'} title="${ok ? f.label : `Débloqué à ${f.at} % d'ambiance`}">
      <svg class="ic"><use href="#${ok ? f.icon : 'i-lock'}"/></svg>${f.label}</button>`;
  }).join('');
}
$('#fx').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fx]');
  if (!b) return;
  club.fx[b.dataset.fx] = !club.fx[b.dataset.fx];
  renderFx();
});

/* ---------- le drop ---------- */
$('#drop').addEventListener('click', () => {
  if (hype < 90 || dropState) return;
  const now = music.beats();
  const start = Math.ceil(now / 4) * 4 + 8;    // 8 temps de montée, puis BOUM sur une mesure
  dropState = { countdown: true, start, until: start + 32 };
  music.riser();
  caption('Préparez-vous…', 2500);
  $('#drop').disabled = true;
});

function updateDrop(beats) {
  if (!dropState) return;
  const left = dropState.start - beats;
  if (dropState.countdown) {
    if (left <= 3 && left > 0) caption(`${Math.ceil(left)}…`, 600);
    if (left <= 0) {
      dropState.countdown = false;
      music.drop = true;
      club.drop((dropState.until - dropState.start) * SECONDS_PER_BEAT);
      caption('DROP !', 2200);
      for (let k = 0; k < 6; k++) setTimeout(() => club.bloomAt((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 12, null, 1.5), k * 120);
    }
  } else {
    hype = 100;
    if (Math.floor(beats) % 2 === 0 && Math.floor(beats) !== dropState.lastBloom) {
      dropState.lastBloom = Math.floor(beats);
      club.bloomAt((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 12, null, 1.3);
    }
    if (beats >= dropState.until) {
      music.drop = false;
      dropState = null;
      hype = 78;
      caption('Quelle soirée !', 2000);
    }
  }
}

/* ---------- la boucle d'affichage ---------- */
function frame() {
  const beats = music.beats(), now = performance.now();
  // l'ambiance retombe doucement si on arrête de taper
  if (!dropState) {
    const idle = (now - lastTapTime) / 1000;
    hype = Math.max(0, hype - (idle > 1.5 ? 4 : 0.6) * (1 / 60));
    if (idle > 1.5 && combo) { combo = 0; $('#combo').textContent = 0; }
  }
  updateDrop(beats);
  club.hype = hype;
  music.hype = hype;

  // jauge, étapes, effets débloqués, bouton drop
  $('#meter-fill').style.width = `${hype}%`;
  const s = STAGES.filter(([min]) => hype >= min).length - 1;
  if (s !== stage) {
    if (s > stage) caption(STAGES[s][2], 2000);
    stage = s;
    $('#stage-name').textContent = STAGES[s][1];
  }
  FX.forEach((f) => {
    if (!unlocked.has(f.id) && hype >= f.at) {
      unlocked.add(f.id);
      club.fx[f.id] = true;
      caption(`${f.label} débloqué${f.id === 'smoke' ? 'e' : f.id === 'lasers' ? 's' : ''} !`, 1600);
      renderFx();
    }
  });
  $('#drop').disabled = !!dropState || hype < 90;

  // la foule : plus l'ambiance monte, plus il y a de Mii sur la piste
  const target = Math.min(MAX_DANCERS, 2 + Math.round((hype / 100) * (MAX_DANCERS - 2)));
  crowdTimer -= 1 / 60;
  const count = club.dancers.filter((d) => !d.leaving).length;
  if (crowdTimer <= 0 && count !== target) {
    if (count < target) club.addDancer(pool[nextMii++ % pool.length]);
    else club.removeDancer();
    crowdTimer = count < target ? 0.35 : 1.4;
  }
  $('#crowd').textContent = club.dancers.filter((d) => !d.leaving).length;

  // l'anneau du pad bat sur chaque temps
  const phase = beats - Math.floor(beats);
  $('#pad').style.setProperty('--p', Math.pow(1 - phase, 3).toFixed(3));

  club.update(beats);
  requestAnimationFrame(frame);
}

/* ---------- son ---------- */
$('#mute').addEventListener('click', (e) => {
  music.setMuted(!music.muted);
  e.currentTarget.setAttribute('aria-pressed', String(music.muted));
  e.currentTarget.querySelector('use').setAttribute('href', music.muted ? '#i-mute' : '#i-sound');
});

/* ---------- démarrage ---------- */
$('#open').addEventListener('click', () => {
  music.start();
  $('#start').hidden = true;
  caption('Ouverture des portes !', 2200);
  $('#pad').focus();
});

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
renderFx();
$('#loading').classList.add('done');
$('#open').disabled = false;
$('#open').textContent = 'Ouvrir la boîte';
requestAnimationFrame(frame);
