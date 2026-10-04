// Drift · Mii Kart : une course de karts à 8 Mii sur 3 tours. Le dérapage charge un turbo.
import * as THREE from 'three';
import { initMii, useRenderer, randomMii, setName, getName, b64ToBytes, bytesToB64, renderIcon, MiiActor, EXPR } from '../day-01-pulse/mii3d.js?v=3';
import { Track, WALL } from './track.js?v=2';
import { Kart, SPARK_COLORS } from './kart.js?v=8';
import { Fx } from './fx.js?v=2';
import { Audio } from './audio.js?v=2';
import { Items } from './items.js?v=2';
import { affinity, relationOf } from '../day-02-loop/ludo/affinity.js?v=2';

const $ = (s) => document.querySelector(s);
const MII_STORE = 'devtober-pulse-miis-v3';
const RACERS = 8, LAPS = 3, PLAYER_SLOT = 5;
const CC = { 50: { speed: 0.8, bot: 0.88 }, 100: { speed: 1, bot: 0.94 }, 150: { speed: 1.2, bot: 0.985 } };
const NAMES = ['Alex', 'Lou', 'Sam', 'Noa', 'Jade', 'Malo', 'Léo', 'Inès', 'Hugo', 'Zoé', 'Tom', 'Lina'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ord = (n) => (n === 1 ? '1<sup>er</sup>' : `${n}<sup>e</sup>`);
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

/* =====================================================================
   Les Mii : ceux du jour 1 si tu en as créé, sinon des Mii au hasard
   ===================================================================== */
let pool = [];   // { b64, name, icon }
function loadPool() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(MII_STORE)) || []; } catch { /* rien */ }
  pool = saved.filter((m) => m && m.data).map((m) => ({ b64: m.data, name: getName(b64ToBytes(m.data)) || 'Mii', perso: m.perso }));
  const taken = new Set(pool.map((m) => m.name));
  const fill = NAMES.filter((n) => !taken.has(n));
  for (let i = 0; pool.length < RACERS + 2 && i < fill.length; i++) {
    const b = randomMii(i % 2);
    setName(b, fill[i]);
    pool.push({ b64: bytesToB64(b), name: fill[i] });
  }
}

/* =====================================================================
   La scène 3D
   ===================================================================== */
const canvas = $('#race');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfeaff, 140, 420);
const camera = new THREE.PerspectiveCamera(62, 5 / 3, 0.1, 1500);
scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6a9a4a, 1.5));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
sun.position.set(80, 120, 40);
scene.add(sun);

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  resizeMap();
}
new ResizeObserver(resize).observe(canvas.parentElement);

/* ---------- état ---------- */
let track, fx, items, karts = [], player, spectators = [];
let podium = null, fireworkT = 0, lastOrder = [];
const audio = new Audio();
let state = 'loading';     // loading → menu → intro → count → race → done → results
let stateT = 0, raceT = 0, camYaw = 0, cc = 100, pick = 0, lastPos = 0, rocket = 0;
const clock = new THREE.Clock();

/* =====================================================================
   Commandes : clavier + boutons de l'écran tactile
   ===================================================================== */
const keys = new Set();
const touch = { left: false, right: false, drift: false };
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if ((e.code === 'Space' || e.code === 'Enter') && state === 'menu' && !$('#go').disabled && e.target === document.body) startRace();
});
addEventListener('keyup', (e) => keys.delete(e.code));
// utiliser son objet : flèche du haut, E, W, ou le bouton de l'écran du bas
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'KeyE', 'KeyW', 'KeyZ'].includes(e.code) && !e.repeat && state === 'race' && !player.finished) { e.preventDefault(); items.use(player); }
});
$('#use').addEventListener('pointerdown', (e) => { e.preventDefault(); audio.init(); if (state === 'race' && !player.finished) items.use(player); });
addEventListener('blur', () => { keys.clear(); touch.left = touch.right = touch.drift = false; });
for (const id of ['left', 'right', 'drift']) {
  const el = $(`#${id}`);
  const on = (v) => (e) => { e.preventDefault(); touch[id] = v; el.classList.toggle('on', v); if (v) audio.init(); };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture?.(e.pointerId); on(true)(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, on(false));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
let steerSmooth = 0;
function playerInput(dt) {
  const l = keys.has('ArrowLeft') || keys.has('KeyA') || keys.has('KeyQ') || touch.left;
  const r = keys.has('ArrowRight') || keys.has('KeyD') || touch.right;
  const target = (r ? 1 : 0) - (l ? 1 : 0);
  steerSmooth += (target - steerSmooth) * Math.min(1, dt * 9);
  if (!target && Math.abs(steerSmooth) < 0.02) steerSmooth = 0;
  return {
    steer: steerSmooth,
    drift: keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyX') || touch.drift,
    brake: keys.has('ArrowDown') || keys.has('KeyS'),
  };
}

/* =====================================================================
   Les pilotes ordinateur : ils suivent la route, changent de file, et dérapent dans les virages
   ===================================================================== */
const _t = new THREE.Vector3();
function botInput(k, dt) {
  const n = track.n;
  k.laneT -= dt;
  if (k.laneT < 0) { k.laneTarget = (Math.random() * 2 - 1) * 4.2; k.laneT = 2 + Math.random() * 3; }
  k.lane += (k.laneTarget - k.lane) * Math.min(1, dt * 0.8);
  // affinités du jour 1 : un rival te colle aux roues, un ami te laisse passer
  const gapToPlayer = player.progress - k.progress;
  if (k.rel === 'ennemi' && gapToPlayer > 0 && gapToPlayer < 70) k.laneTarget = clamp(track.lateral(player.root.position, player.idx), -5, 5);
  if (k.rel === 'ami' && gapToPlayer < 0 && gapToPlayer > -25) {
    const pl = track.lateral(player.root.position, player.idx);
    k.laneTarget = pl > 0 ? -4 : 4;   // il se pousse sur le côté
  }
  const look = Math.round((9 + k.speed * 0.42) / track.step);
  // dans un virage, on prend la corde (le côté intérieur)
  const curve = track.turn[(k.idx + Math.round(look * 0.6)) % n];
  const lane = clamp(k.lane - curve * 5, -5, 5);   // virage à droite (curve > 0) → corde à droite
  track.at(k.idx + look, lane, _t);
  const want = Math.atan2(_t.x - k.root.position.x, _t.z - k.root.position.z);
  let steer = clamp(-wrap(want - k.heading) * 2.6, -1, 1);

  // dérapage : dans les virages serrés, on garde le bouton et on lâche à la sortie
  const sharp = Math.abs(curve);
  if (!k.botDrift && sharp > 0.6 && k.speed > 16 && Math.random() < dt * 4 * k.driftSkill) k.botDrift = Math.sign(curve);
  let drift = false;
  if (k.botDrift) {
    drift = true;
    if (!k.drift) steer = k.botDrift * 0.8;                       // pour lancer le dérapage du bon côté
    else if (k.drift !== k.botDrift || sharp < 0.3 || (k.level >= 2 && sharp < 0.45)) { drift = false; k.botDrift = 0; }
    if (k.drift && k.charge > 3.4) { drift = false; k.botDrift = 0; }
  }
  if (k.drift && !k.botDrift) drift = false;
  return { steer, drift, brake: false, assist: true };
}

/* =====================================================================
   Mise en place de la course
   ===================================================================== */
function gridSpot(slot) {
  const idx = track.n - 10 - slot * 7;
  return { idx, pos: track.at(idx, slot % 2 ? -3 : 3) };
}

function lineup() {
  // toi + les 7 premiers Mii de la liste (sans toi)
  const others = pool.map((_, i) => i).filter((i) => i !== pick).slice(0, RACERS - 1);
  const order = [];
  for (let s = 0, o = 0; s < RACERS; s++) order.push(s === PLAYER_SLOT ? pick : others[o++]);
  return order;
}

function placeKarts() {
  const order = lineup();
  order.forEach((pi, slot) => {
    const k = karts[slot];
    if (k.poolIndex !== pi) { k.setMii(b64ToBytes(pool[pi].b64)); k.poolIndex = pi; }
    k.name = pool[pi].name;
    k.icon = iconImage(pi);
    k.human = slot === PLAYER_SLOT;
    const { idx, pos } = gridSpot(slot);
    k.reset(pos, track.heading(idx), idx);
    k.lane = slot % 2 ? -3 : 3; k.laneTarget = k.lane; k.laneT = 2 + Math.random() * 3;
    k.botDrift = 0;
    k.skill = 0.97 + Math.random() * 0.05;
    k.driftSkill = 0.6 + Math.random() * 0.6;
    k.lapStart = 0;
    k.place = 0;   // forcera l'affichage de la position au départ
    k.b64 = pool[pi].b64;
  });
  player = karts[PLAYER_SLOT];
  // les affinités du jour 1 entre toi et chaque pilote : ami (≥ 70), rival (< 30)
  const me = { b64: player.b64, bytes: b64ToBytes(player.b64), perso: pool[pick].perso };
  for (const k of karts) {
    if (k === player) { k.rel = null; continue; }
    k.rel = relationOf(affinity(me, { b64: k.b64, bytes: b64ToBytes(k.b64), perso: pool[k.poolIndex].perso }));
    k.friendOf = k.rel === 'ami' ? player : null;
  }
}

const icons = new Map();
function iconImage(pi) {
  if (!icons.has(pi)) { const img = new Image(); img.src = renderIcon(pool[pi].b64); icons.set(pi, img); }
  return icons.get(pi);
}

/* =====================================================================
   Messages de l'écran du haut
   ===================================================================== */
let msgTimer = 0;
function say(text, { cls = '', time = 1.2 } = {}) {
  const el = $('#msg');
  el.className = `msg outline ${cls}`;
  el.textContent = text;
  void el.offsetWidth;
  el.classList.add('show');
  msgTimer = time;
}
function pop(text, color) {
  const el = $('#pop');
  el.textContent = text;
  el.style.setProperty('--c', color);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

/* =====================================================================
   Déroulé : menu → intro → compte à rebours → course → arrivée → résultats
   ===================================================================== */
function setState(s) { state = s; stateT = 0; }

function toMenu() {
  setState('menu');
  audio.stopMusic(); audio.normal();
  placeKarts();
  renderPicker();
  $('#start').hidden = false;
  $('#results').hidden = true;
  $('#race-hud').hidden = true;
  track.setLights(0);
}

function startRace() {
  audio.init();
  audio.select();
  placeKarts();
  $('#start').hidden = true;
  $('#results').hidden = true;
  $('#race-hud').hidden = true;
  $('#cc-label').textContent = `${cc}cc`;
  raceT = 0; rocket = 0; lastPos = 0;
  items.reset(karts);
  fx.skids.clear();
  removePodium();
  lastOrder = [];
  updateSlot();
  setState('intro');
  say('Circuit Mii', { cls: 'small', time: 2.4 });
  renderBoard();
}

function finishPlayer() {
  setState('done');
  const place = standings().indexOf(player) + 1;
  say(place === 1 ? 'Victoire !' : 'Arrivée !', { cls: place === 1 ? 'gold' : '', time: 3 });
  audio.stopMusic();
  audio.fanfare(place <= 3);
  player.feel(place <= 3 ? EXPR.HAPPY : place >= 6 ? EXPR.SORROW : EXPR.SMILE, 99);
  cheer(place <= 3);
  track.cheer(6);
  fireworkT = 0.2;   // feux d'artifice au-dessus de la ligne d'arrivée
}

function showResults() {
  setState('results');
  $('#race-hud').hidden = true;
  const list = standings();
  const place = list.indexOf(player) + 1;
  $('#r-title').innerHTML = place === 1 ? 'Victoire&nbsp;!' : `Tu finis ${ord(place)}&nbsp;!`;
  $('#ranking').innerHTML = list.map((k, i) => {
    const t = k.finished ? k.finishTime : estimate(k);
    return `<li class="${k === player ? 'me' : ''}" style="--c:#${k.color.getHexString()}"><b>${i + 1}</b><img src="${k.icon.src}" alt=""><span>${esc(k.name)}</span><time>${fmt(t)}</time></li>`;
  }).join('');
  $('#r-stats').textContent = `Meilleur tour : ${fmt(player.stats.best || 0)} · Mini-turbos : ${player.stats.turbos} · Pièces : ${player.coins}`;
  $('#results').hidden = false;
  buildPodium(list.slice(0, 3));
}

/* ---------- le podium : les trois premiers, le gagnant fait une pose et les autres applaudissent ---------- */
function removePodium() {
  if (!podium) return;
  scene.remove(podium.group);
  podium.miis.forEach((a) => a.dispose());
  podium = null;
}
function buildPodium(top3) {
  removePodium();
  const i = 30, h = track.heading(i);
  const group = new THREE.Group();
  group.position.copy(track.at(i, WALL + 9));
  group.rotation.y = h - Math.PI / 2;   // il regarde la piste
  const colors = [0xffd23a, 0xd8dde3, 0xe0a060];
  const slots = [[0, 1.5], [-2.3, 1.0], [2.3, 0.65]];   // 1er au centre, 2e à gauche, 3e à droite
  const miis = [];
  top3.forEach((k, r) => {
    const [x, hgt] = slots[r];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.font = '900 48px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(r + 1), 32, 36);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const side = new THREE.MeshLambertMaterial({ color: colors[r] });
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.1, hgt, 2), [side, side, side, side, new THREE.MeshLambertMaterial({ color: colors[r], map: tex }), side]);
    block.position.set(x, hgt / 2, 0);
    group.add(block);
    const a = new MiiActor(renderer, b64ToBytes(k.b64));
    a.root.scale.setScalar(0.09);
    a.root.position.set(x, hgt, 0);
    a.root.traverse((o) => { o.frustumCulled = false; });
    a.blinkPhase = r;
    if (r === 0) { a.play('Pose.05', 0.2); a.idle(EXPR.LIKE); } else { a.idle(EXPR.HAPPY); }
    group.add(a.root);
    miis.push(a);
  });
  scene.add(group);
  podium = { group, miis, center: group.position.clone() };
  fireworkT = 0.3;
}
function updatePodium(dt, t) {
  if (!podium) return;
  podium.miis.forEach((a, r) => {
    a.update(dt, t);
    if (r === 0) { if (Math.floor(t / 2.4) % 2) a.pose({ l: [0.2, -0.45, 0.1, -0.9], r: [0.2, -0.45, 0.1, -0.9] }); }   // le gagnant lève les bras
    else { const v = [1.25, 0.45, 0.6 + Math.sin(t * 18 + r) * 0.25]; a.pose({ l: v, r: v }); }   // les autres applaudissent
  });
}

/** Temps estimé pour ceux qui n'ont pas encore fini (d'après ce qu'il leur reste à rouler). */
function estimate(k) {
  const left = (LAPS + 1 - k.lap) * track.n - k.idx;
  return raceT + (left * track.step) / Math.max(20, 26 * CC[cc].speed);
}

function standings() {
  return [...karts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.progress - a.progress;
  });
}

/* ---------- le public dans les gradins ---------- */
function buildSpectators() {
  const picks = [0, 1, 2, 3].map((i) => randomMii(i % 2));
  picks.forEach((b, i) => {
    const a = new MiiActor(renderer, b);
    a.root.scale.setScalar(0.06);
    a.root.position.set(-6 + i * 4, 0.7 + (i % 2) * 0.9, -(i % 2) * 2.2);
    a.blinkPhase = i;
    track.stand.add(a.root);
    spectators.push(a);
  });
}
function cheer(big) {
  spectators.forEach((a, i) => setTimeout(() => {
    a.play(big ? (i % 2 ? 'Pose.05' : 'Pose.01') : 'Pose.02', 0.2);
    a.setExpression(big ? EXPR.HAPPY : EXPR.SMILE);
    setTimeout(() => { a.play('Wait'); a.setExpression(EXPR.NORMAL); }, 2200);
  }, i * 120));
}

/* =====================================================================
   La boucle
   ===================================================================== */
const _f = new THREE.Vector3(), _look = new THREE.Vector3(), _cam = new THREE.Vector3();
let camSide = 0;

/** Qui a doublé qui ? Le Mii doublé se retourne et réagit (selon son affinité avec toi). */
function overtakes() {
  const order = standings();
  if (lastOrder.length === order.length) {
    const before = lastOrder.indexOf(player), now = order.indexOf(player);
    if (now < before) {   // tu viens de doubler quelqu'un
      for (const k of lastOrder.slice(now, before)) {
        if (k === player) continue;
        k.lookBack = 1.2;
        k.feel(k.rel === 'ami' ? EXPR.SMILE : k.rel === 'ennemi' ? EXPR.ANGER_OPEN_MOUTH : EXPR.SURPRISE_OPEN_MOUTH, 1.6);
      }
      player.feel(EXPR.HAPPY, 1);
    } else if (now > before) {
      player.feel(EXPR.SORROW, 1);
      for (const k of order.slice(before, now)) if (k !== player) k.feel(EXPR.HAPPY, 1.2);
    }
  }
  lastOrder = order;
}

/** L'objet en main (en haut) et le bouton « objet » (en bas). */
let slotKey = '';
function updateSlot() {
  const rolling = player.rolling > 0;
  const shown = rolling ? ['banana', 'shell', 'mushroom', 'star'][Math.floor(performance.now() / 90) % 4] : player.item;
  const key = `${rolling}|${shown}`;
  if (key === slotKey) return;
  const was = slotKey; slotKey = key;
  const href = shown ? `#o-${shown}` : '';
  $('#slot-icon').setAttribute('href', href);
  $('#use-icon').setAttribute('href', href);
  $('#slot').classList.toggle('rolling', rolling);
  $('#use').disabled = !player.item || rolling;
  if (!rolling && shown && was.startsWith('true')) { const s = $('#slot'); s.classList.remove('ready'); void s.offsetWidth; s.classList.add('ready'); }
}

/* ---------- l'effet de vitesse : des traits sur les bords de l'écran ---------- */
const speedCv = $('#speed'), sctx = speedCv.getContext('2d');
const streaks = Array.from({ length: 46 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), l: 0.1 + Math.random() * 0.15 }));
function drawSpeed(dt) {
  const w = speedCv.clientWidth, h = speedCv.clientHeight;
  if (speedCv.width !== w) { speedCv.width = w; speedCv.height = h; }
  sctx.clearRect(0, 0, w, h);
  if (state !== 'race' && state !== 'done') return;
  const k = player;
  const strength = clamp((k.speed - 27) / 14, 0, 1) * 0.6 + (k.boost > 0 ? 0.5 : 0) + (k.starT > 0 ? 0.3 : 0);
  if (strength <= 0.02) return;
  const cx = w / 2, cy = h * 0.45, R = Math.hypot(w, h) / 2;
  sctx.lineCap = 'round';
  for (const s of streaks) {
    s.r += dt * (1.6 + strength * 2.5);
    if (s.r > 1) { s.r = 0.55 + Math.random() * 0.1; s.a = Math.random() * Math.PI * 2; s.l = 0.1 + Math.random() * 0.15; }
    const r0 = R * s.r, r1 = R * Math.min(1.1, s.r + s.l);
    sctx.strokeStyle = k.boost > 0 ? `rgba(255, 220, 160, ${0.5 * strength})` : `rgba(255, 255, 255, ${0.45 * strength})`;
    sctx.lineWidth = 1.5 + strength * 2.5;
    sctx.beginPath();
    sctx.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0 * 0.75);
    sctx.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1 * 0.75);
    sctx.stroke();
  }
  // un léger voile sur les bords (impression de flou de vitesse)
  const g = sctx.createRadialGradient(cx, cy, R * 0.45, cx, cy, R);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,255,255,${0.22 * strength})`);
  sctx.fillStyle = g; sctx.fillRect(0, 0, w, h);
}

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const t = clock.elapsedTime;
  stateT += dt;
  if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('#msg').classList.remove('show'); }

  if (state === 'intro' && stateT > 3) {
    setState('count');
    lastPos = -1;
    $('#race-hud').hidden = false;
  }
  if (state === 'count') {
    const n = Math.floor(stateT / 0.9);
    if (n !== lastPos && n <= 3) {
      lastPos = n;
      if (n < 3) { say(String(3 - n)); audio.beep(false); track.setLights(n + 1); }
      else { say('Partez !', { cls: 'gold', time: 0.9 }); audio.beep(true); track.setLights(3); audio.startMusic(); setState('race'); lastPos = 0; }
    }
    // turbo de départ : appuyer sur Drift pendant le « 1 », pas avant
    const press = playerInput(0).drift;
    if (press && !rocket) rocket = stateT > 1.95 && stateT < 2.7 ? 1 : -1;
    if (state === 'race' && rocket === 1) { player.boost = 1.2; pop('Turbo de départ !', '#4cc8ff'); audio.turbo(2); }
  }

  const racing = state === 'race' || state === 'done';
  if (racing) raceT += dt;
  const opts = { speedMul: CC[cc].speed };

  for (const k of karts) {
    if (racing) {
      const auto = !k.human || k.finished;
      const input = auto ? botInput(k, dt) : playerInput(dt);
      // les pilotes ordinateur s'adaptent un peu à toi (pour que la course reste serrée)
      const gap = (player.progress - k.progress) / track.n;
      opts.botMul = auto ? CC[cc].bot * k.skill * clamp(1 + gap * 0.18, 0.9, 1.1) : 1;
      if (k.finished) opts.botMul *= 0.8;
      const ev = k.drive(dt, input, track, opts);
      if (k === player && !k.finished) playerEvents(ev);
      else if (ev.includes('lap') && k.lap > LAPS && !k.finished) { k.finished = true; k.finishTime = raceT; k.feel(EXPR.HAPPY, 3); }
    } else if (k.human) {
      playerInput(dt);   // garde le volant à jour pendant le compte à rebours
    }
    k.animate(dt, t, fx);
  }
  if (racing) {
    collide();
    items.update(dt, t, karts, (k) => standings().indexOf(k) + 1);
    overtakes();
  }
  // feux d'artifice (arrivée, podium)
  if ((state === 'done' || state === 'results') && (fireworkT -= dt) <= 0) {
    fireworkT = 0.45 + Math.random() * 0.5;
    const base = podium ? podium.center.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16)) : track.at(Math.random() * 20 - 10, (Math.random() - 0.5) * 24);
    fx.firework(base);
  }
  fx.update(dt);
  track.update(dt, t, racing ? player.root.position : null);
  updatePodium(dt, t);
  if (racing || state === 'count') updateSlot();
  drawSpeed(dt);
  for (const a of spectators) a.update(dt, t);

  if (state === 'done' && stateT > 3.2) showResults();

  // son du moteur
  audio.engine(player.speed, !!player.drift, player.level, player.boost > 0, state !== 'menu' && state !== 'loading');

  updateCamera(dt, t);
  if (racing || state === 'count') updateHud();
  drawMap();
  renderer.render(scene, camera);
requestAnimationFrame(frame);
}

function playerEvents(ev) {
  for (const e of ev) {
    if (e === 'hop') audio.hop();
    if (e === 'level') {
      audio.level(player.level);
      if (player.level === 3) { pop('Ultra mini-turbo', '#d060ff'); player.feel(EXPR.LIKE, 1.6); }
    }
    if (e === 'ramp') audio.hop();
    if (e === 'trick') { audio.trick(); pop('Figure !', '#ffd23a'); player.feel(EXPR.HAPPY, 1.2); }
    if (e === 'trickBoost') audio.turbo(1);
    if (e === 'turbo') { audio.turbo(Math.max(1, lastLevel)); pop(['', 'Mini-turbo', 'Super mini-turbo', 'Ultra mini-turbo'][Math.max(1, lastLevel)], `#${SPARK_COLORS[Math.max(1, lastLevel)].getHexString()}`); }
    if (e === 'pad') audio.pad();
    if (e === 'bump') audio.bump();
    if (e === 'lap') {
      const lapTime = raceT - player.lapStart;
      if (player.lap > 1) player.stats.best = player.stats.best ? Math.min(player.stats.best, lapTime) : lapTime;
      player.lapStart = raceT;
      if (player.lap > LAPS) {
        player.finished = true; player.finishTime = raceT;
        finishPlayer();
      } else if (player.lap === LAPS) {
        say('Tour final !', { cls: 'pink', time: 1.6 });
        audio.lap(true); audio.finalLap();
      } else if (player.lap > 1) {
        say(`Tour ${player.lap}`, { cls: 'small', time: 1.2 });
        audio.lap(false);
      }
    }
  }
  if (player.drift) lastLevel = player.level;
}
let lastLevel = 0;

/** Les karts se bousculent un peu quand ils se touchent. */
function collide() {
  for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {
    const a = karts[i].root.position, b = karts[j].root.position;
    const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
    if (d2 > 2.6 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), push = (1.62 - d) / 2;
    a.x -= dx / d * push; a.z -= dz / d * push;
    b.x += dx / d * push; b.z += dz / d * push;
    const ka = karts[i], kb = karts[j];
    // l'étoile renverse tout le monde
    if (ka.starT > 0 && kb.starT <= 0) { items.hit(kb, ka); continue; }
    if (kb.starT > 0 && ka.starT <= 0) { items.hit(ka, kb); continue; }
    // celui de derrière perd un peu de vitesse
    const behind = ka.progress < kb.progress ? ka : kb;
    behind.speed *= 0.985;
    if ((ka === player || kb === player) && !player.bumpCd) {
      player.bumpCd = 0.5; audio.tone(140, 0.12, { type: 'square', vol: 0.12, slide: 0.6 });
      (ka === player ? kb : ka).feel(EXPR.ANGER, 1);
    }
  }
  if (player.bumpCd) player.bumpCd = Math.max(0, player.bumpCd - 1 / 60);
}

/* ---------- caméra ---------- */
function updateCamera(dt, t) {
  const k = player, p = k.root.position;
  if (state === 'results' && podium) {
    // le podium, vu de face, la caméra tourne doucement autour
    const c = podium.center, a = podium.group.rotation.y + Math.sin(t * 0.4) * 0.5;
    camera.position.set(c.x + Math.sin(a) * 7.5, 3.4, c.z + Math.cos(a) * 7.5);
    camera.lookAt(c.x, 2.2, c.z);
    camera.fov = 50;
  } else if (state === 'menu' || state === 'loading' || state === 'results') {
    // on tourne doucement autour de ton kart
    const a = t * 0.35;
    camera.position.set(p.x + Math.sin(a) * 6.5, 2.4, p.z + Math.cos(a) * 6.5);
    camera.lookAt(p.x, 1, p.z);
    camera.fov = 50;
  } else if (state === 'intro') {
    // plan d'ouverture : on survole la grille de départ puis on se place derrière toi
    // (on part de devant la grille, en hauteur, et on la longe jusqu'à se placer derrière toi)
    const e = 0.5 - Math.cos(Math.min(1, stateT / 3) * Math.PI) / 2;
    const h = track.heading(k.idx);
    const from = _cam.copy(track.at(k.idx + 45, 8)).setY(9);
    const to = new THREE.Vector3(p.x - Math.sin(h) * 5.6, 2.35, p.z - Math.cos(h) * 5.6);
    camera.position.lerpVectors(from, to, e);
    camera.position.y += Math.sin(e * Math.PI) * 3;
    const lookA = track.at(k.idx - 12, 0).setY(0.5);
    const lookB = new THREE.Vector3(p.x + Math.sin(h) * 4, 1.15, p.z + Math.cos(h) * 4);
    camera.lookAt(_look.lerpVectors(lookA, lookB, e));
    camYaw = h;
    camera.fov = 62;
  } else if (state === 'done' && stateT > 1.2) {
    // l'arrivée : la caméra passe devant le Mii
    const a = k.heading + Math.PI + Math.sin(stateT * 0.5) * 0.6;
    camera.position.lerp(_cam.set(p.x + Math.sin(a) * 5, 2, p.z + Math.cos(a) * 5), 1 - Math.exp(-dt * 3));
    camera.lookAt(p.x, 1.1, p.z);
  } else {
    // derrière le kart ; la caméra suit un peu la glisse du dérapage
    camYaw += wrap(k.heading + k.slide * 0.45 - camYaw) * (1 - Math.exp(-dt * 6));
    const f = _f.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    const dist = 5.6 + k.speed * 0.025;
    // pendant un dérapage, la caméra se décale vers l'extérieur et regarde l'intérieur du virage
    camSide += ((k.drift ? k.drift * 1.5 : 0) - camSide) * Math.min(1, dt * 2.5);
    const lx = f.z, lz = -f.x;   // vers la gauche
    camera.position.set(p.x - f.x * dist + lx * camSide, 2.35 + k.visual.position.y * 0.5, p.z - f.z * dist + lz * camSide);
    camera.lookAt(_look.set(p.x + f.x * 4 - lx * camSide * 0.8, 1.15, p.z + f.z * 4 - lz * camSide * 0.8));
    const fov = 60 + (k.boost > 0 ? 10 : 0) + k.speed * 0.08;
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
  }
  camera.updateProjectionMatrix();
}

/* ---------- HUD ---------- */
let boardKey = '';
function updateHud() {
  $('#lap').textContent = clamp(player.lap, 1, LAPS);
  $('#time').textContent = fmt(raceT);
  const list = standings();
  const place = list.indexOf(player) + 1;
  const posEl = $('#pos');
  if (place !== player.place) {
    player.place = place;
    posEl.innerHTML = ord(place);
    posEl.style.setProperty('--c', ['#ffd23a', '#e6eef5', '#ffb36b'][place - 1] ?? '#fff');
    posEl.classList.remove('pop'); void posEl.offsetWidth; posEl.classList.add('pop');
  }
  document.querySelectorAll('.gauge i').forEach((g, i) => g.classList.toggle('on', player.drift && player.level > i));
  $('#coins').textContent = player.coins;
  const key = list.map((k) => k.name + k.finished).join();
  if (key !== boardKey) { boardKey = key; renderBoard(list); }
}
function renderBoard(list = standings()) {
  // un cœur à côté de tes amis (affinité du jour 1), une flamme à côté de tes rivaux
  const rel = (k) => (k.rel === 'ami' ? '<svg class="rel" aria-label="ami"><use href="#i-heart"/></svg>' : k.rel === 'ennemi' ? '<svg class="rel" aria-label="rival"><use href="#i-flame"/></svg>' : '');
  $('#board').innerHTML = list.map((k, i) => `<li class="${k === player ? 'me' : ''} ${k.finished ? 'done' : ''}" style="--c:#${k.color.getHexString()}"><b>${i + 1}</b><img src="${k.icon.src}" alt=""><span>${esc(k.name)}</span>${rel(k)}</li>`).join('');
}

/* ---------- la carte du circuit (écran du bas) ---------- */
const map = $('#map'), mctx = map.getContext('2d');
let mapView = null, mapBase = null;
function resizeMap() {
  if (!track) return;
  const r = map.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  map.width = Math.max(1, Math.round(r.width * dpr)); map.height = Math.max(1, Math.round(r.height * dpr));
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of track.p) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const pad = map.width * 0.08;
  const s = Math.min((map.width - pad * 2) / (maxX - minX), (map.height - pad * 2) / (maxZ - minZ));
  // vu du dessus, avec la caméra « au sud » : x vers la gauche (comme à l'écran du haut au départ)
  mapView = { s, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: map.width, h: map.height, dpr };
  // le tracé ne bouge pas : on le dessine une fois
  mapBase = document.createElement('canvas');
  mapBase.width = map.width; mapBase.height = map.height;
  const g = mapBase.getContext('2d');
  const path = () => { g.beginPath(); track.p.forEach((p, i) => { const [x, y] = toMap(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
  g.lineJoin = g.lineCap = 'round';
  path(); g.strokeStyle = '#4a3324'; g.lineWidth = s * 20; g.stroke();
  path(); g.strokeStyle = '#ffffff'; g.lineWidth = s * 14; g.stroke();
  path(); g.strokeStyle = '#ffe9a8'; g.lineWidth = s * 3; g.setLineDash([s * 8, s * 8]); g.stroke(); g.setLineDash([]);
  // ligne d'arrivée
  const a = toMap(track.at(0, 9)), b = toMap(track.at(0, -9));
  g.strokeStyle = '#222'; g.lineWidth = s * 4; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
  g.strokeStyle = '#fff'; g.setLineDash([s * 3, s * 3]); g.stroke(); g.setLineDash([]);
  // dalles d'accélération
  g.fillStyle = '#ff9b1f';
  for (const pad of track.pads) { const [x, y] = toMap(track.at(pad.i, pad.off)); g.beginPath(); g.arc(x, y, s * 4, 0, 7); g.fill(); }
}
function toMap(p) {
  const v = mapView;
  return [v.w / 2 - (p.x - v.cx) * v.s, v.h / 2 - (p.z - v.cz) * v.s];
}
function drawMap() {
  if (!mapView) return;
  const g = mctx, v = mapView;
  g.clearRect(0, 0, v.w, v.h);
  g.drawImage(mapBase, 0, 0);
  const r = Math.max(7, v.w * 0.032);
  // les autres d'abord, toi par-dessus
  for (const k of [...karts.filter((x) => x !== player), player]) {
    const [x, y] = toMap(k.root.position);
    const me = k === player, rr = me ? r * 1.35 : r;
    g.beginPath(); g.arc(x, y, rr + v.dpr * 2, 0, 7);
    g.fillStyle = me ? '#ff5b8d' : `#${k.color.getHexString()}`; g.fill();
    g.save(); g.beginPath(); g.arc(x, y, rr, 0, 7); g.clip();
    g.fillStyle = '#fff'; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    if (k.icon?.complete) g.drawImage(k.icon, x - rr, y - rr, rr * 2, rr * 2);
    g.restore();
  }
}

/* ---------- écran de départ ---------- */
function renderPicker() {
  const p = pool[pick];
  $('#pick-img').src = iconImage(pick).src;
  $('#pick-name').textContent = p.name;
  $('#picker').style.setProperty('--c', `#${player.color.getHexString()}`);
}
$('#picker').addEventListener('click', (e) => {
  const b = e.target.closest('[data-d]');
  if (!b || state !== 'menu') return;
  audio.init(); audio.select();
  pick = (pick + Number(b.dataset.d) + pool.length) % pool.length;
  placeKarts();
  renderPicker();
  player.feel(EXPR.HAPPY, 1.5);
});
document.querySelector('.cc').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cc]');
  if (!b) return;
  audio.init(); audio.select();
  cc = Number(b.dataset.cc);
  document.querySelectorAll('.cc button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
});
$('#go').addEventListener('click', startRace);
$('#again').addEventListener('click', startRace);
$('#menu').addEventListener('click', () => { audio.init(); audio.select(); toMenu(); });
$('#mute').addEventListener('click', (e) => {
  audio.init();
  audio.setMuted(!audio.muted);
  e.currentTarget.setAttribute('aria-pressed', String(audio.muted));
  e.currentTarget.querySelector('use').setAttribute('href', audio.muted ? '#i-mute' : '#i-sound');
});

/* =====================================================================
   Démarrage
   ===================================================================== */
await initMii('../day-01-pulse/');
useRenderer(renderer);
loadPool();
track = new Track(scene);
fx = new Fx(scene);
fx.onBoom = () => { audio.boom(); track.cheer(1.5); };
items = new Items(scene, track, fx, audio);
// ce qui arrive avec les objets : sons et messages pour toi, réactions des Mii
items.onEvent = (kind, k, extra) => {
  if (kind === 'coin' && k === player) audio.coin();
  if (kind === 'box' && k === player) audio.box();
  if (kind === 'got' && k === player) audio.got();
  if (kind === 'hit') {
    if (k === player) { audio.hit(); pop('Aïe !', '#ff5b8d'); }
    else if (extra === player) { pop(`Touché : ${k.name} !`, '#39c27a'); audio.tone(880, 0.12, { vol: 0.12 }); }
    if (extra && extra !== k) extra.feel(EXPR.HAPPY, 1.2);
  }
  if (kind === 'use' && k === player && extra === 'star') pop('Étoile !', '#ffd23a');
  if (kind === 'use' && k === player && extra === 'mushroom') pop('Champignon !', '#e8323c');
};
track.buildCrowd(pool.map((_, i) => iconImage(i).src));
for (let s = 0; s < RACERS; s++) karts.push(new Kart(renderer, scene, b64ToBytes(pool[s].b64), { name: pool[s].name }));
karts.forEach((k, s) => { k.poolIndex = s; });
buildSpectators();
toMenu();
resize();
$('#loading').classList.add('done');
$('#go').disabled = false;
$('#go').textContent = "C'est parti !";
requestAnimationFrame(frame);
