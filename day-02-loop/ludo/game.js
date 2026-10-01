// Devtober J2 · Loop — Ludo des Mii : un vrai jeu de Ludo en 3D, toi contre trois bots.
// La boucle : chaque pion fait le tour complet du plateau (52 cases) avant de rentrer chez lui.
import { initMii, randomMii, getName, setName, renderIcon, b64ToBytes, bytesToB64 } from '../../day-01-pulse/mii3d.js?v=2';
import { Board, COLORS, START, SAFE, LAST, GOAL, trackIndex } from './board.js?v=6';
import { Dice } from './dice.js?v=5';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MII_STORE = 'devtober-pulse-miis-v3';   // les Mii créés dans le jour 1 (même site)

/* =====================================================================
   Sons (Web Audio, rien à charger)
   ===================================================================== */
const sfx = {
  ctx: null, muted: false,
  init() { try { this.ctx ??= new (window.AudioContext || window.webkitAudioContext)(); } catch { /* pas d'audio */ } },
  tone(f, start, dur, vol, type = 'sine', end) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + start, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(start, dur, vol, freq) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + start;
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4; g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  },
  clack(v) {
    const now = performance.now();
    if (now - (this.lastClack || 0) < 45) return;   // pas plus d'un « clac » toutes les 45 ms
    this.lastClack = now;
    this.noise(0, 0.05, 0.5 * v, 2400 + Math.random() * 1500); this.tone(700 + Math.random() * 300, 0, 0.03, 0.05 * v, 'square');
  },
  hop() { this.tone(520 + Math.random() * 60, 0, 0.07, 0.07, 'triangle', 380); this.noise(0.05, 0.03, 0.15, 1800); },
  capture() { this.tone(900, 0, 0.45, 0.09, 'sawtooth', 120); this.noise(0, 0.4, 0.3, 900); },
  six() { [0, 4, 7, 12].forEach((n, i) => this.tone(523 * 2 ** (n / 12), i * 0.06, 0.16, 0.08, 'triangle')); },
  home() { [7, 12, 16].forEach((n, i) => this.tone(523 * 2 ** (n / 12), i * 0.09, 0.4, 0.08, 'sine')); },
  turn() { this.tone(660, 0, 0.08, 0.05, 'sine'); this.tone(880, 0.07, 0.1, 0.05, 'sine'); },
  sad() { [5, 4, 2].forEach((n, i) => this.tone(330 * 2 ** (n / 12), i * 0.18, 0.25, 0.07, 'triangle')); },
  win() { [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => this.tone(523 * 2 ** (n / 12), i * 0.11, 0.3, 0.09, 'triangle')); },
};

/* =====================================================================
   Les Mii : ceux du jour 1 si tu en as créé, sinon des Mii au hasard
   ===================================================================== */
let pool = [];   // { b64, name }
function loadPool() {
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem(MII_STORE)) || []; } catch { /* rien */ }
  pool = saved.filter((m) => m && m.data).map((m) => ({ b64: m.data, name: getName(b64ToBytes(m.data)) || 'Mii' }));
  // on complète avec des Mii au hasard, pour toujours avoir du choix pour les 4 places
  const taken = new Set(pool.map((m) => m.name));
  const fill = ['Alex', 'Lou', 'Sam', 'Noa', 'Jade', 'Malo', 'Léo', 'Inès', 'Hugo', 'Zoé', 'Tom', 'Lina'].filter((n) => !taken.has(n));
  for (let i = 0; pool.length < 10 && i < fill.length; i++) {
    const b = randomMii(i % 2);
    setName(b, fill[i]);
    pool.push({ b64: bytesToB64(b), name: fill[i] });
  }
}

/* =====================================================================
   État de la partie
   ===================================================================== */
let board, dice;
let seats = [0, 1, 2, 3];   // index dans pool du Mii de chaque place (0 = toi, 1 à 3 = les bots)
let players = [];    // { name, b64, bytes, human, pawns: [rel x4] }
let current = 0;
let gameId = 0;
let fast = false;
let waitingRoll = null, waitingChoice = null, legalNow = [];

function setupPlayers() {
  players = seats.map((k, p) => ({
    name: pool[k].name, b64: pool[k].b64, bytes: b64ToBytes(pool[k].b64), human: p === 0, pawns: [-1, -1, -1, -1],
  }));
}

/* ---------- Règles ---------- */
const legal = (p, roll) => players[p].pawns
  .map((rel, i) => [i, rel])
  .filter(([, rel]) => (rel < 0 ? roll === 6 : rel + roll <= GOAL))
  .map(([i]) => i);

function capturesAt(p, rel) {
  if (rel < 0 || rel > LAST) return [];
  const idx = trackIndex(p, rel);
  if (SAFE.has(idx)) return [];
  const hits = [];
  players.forEach((pl, q) => { if (q !== p) pl.pawns.forEach((r, j) => { if (trackIndex(q, r) === idx) hits.push([q, j]); }); });
  return hits;
}

/** Les bots : on note chaque coup possible et on prend le meilleur. */
function botChoose(p, roll, moves) {
  const danger = (idx) => {
    let n = 0;
    players.forEach((pl, q) => { if (q !== p) pl.pawns.forEach((r) => {
      if (r < 0 || r > LAST) return;
      const d = (idx - trackIndex(q, r) + 52) % 52;
      if (d >= 1 && d <= 6) n++;
    }); });
    return n;
  };
  let best = moves[0], bestScore = -Infinity;
  for (const i of moves) {
    const from = players[p].pawns[i], to = from < 0 ? 0 : from + roll;
    let s = to * 0.4 + Math.random() * 3;
    if (from < 0) s += 45;
    if (to === GOAL) s += 70;
    s += capturesAt(p, to).length * 110;
    if (to <= LAST) {
      const idx = trackIndex(p, to);
      if (SAFE.has(idx)) s += 22; else s -= danger(idx) * 35;
    } else s += 20;   // dans le couloir de sa couleur, plus personne ne peut le prendre
    if (from >= 0 && from <= LAST && !SAFE.has(trackIndex(p, from))) s += danger(trackIndex(p, from)) * 25;
    if (s > bestScore) { bestScore = s; best = i; }
  }
  return best;
}

/* =====================================================================
   Affichage de l'écran tactile
   ===================================================================== */
function renderPlayers() {
  $('#players').innerHTML = players.map((pl, p) => {
    const home = pl.pawns.filter((r) => r === GOAL).length;
    return `<div class="player ${p === current ? 'turn' : ''} ${pl.human ? 'me' : ''}" style="--c:${COLORS[p].css}">
      <img src="${renderIcon(pl.b64)}" alt="">
      <span class="who"><b>${esc(pl.name)}</b><span class="home">${[0, 1, 2, 3].map((k) => `<i class="${k < home ? 'in' : ''}"></i>`).join('')}</span></span>
    </div>`;
  }).join('');
}
function status(html) { $('#status').innerHTML = html; }
const who = (p) => `<span class="who" style="--c:${COLORS[p].css}">${esc(players[p].name)}</span>`;

let captionTimer;
function caption(html, ms = 2200) {
  const el = $('#caption');
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => el.classList.remove('show'), ms);
}
const cinema = (on) => $('#film').classList.toggle('cinema', on);

function renderChoices(p, moves) {
  legalNow = moves.map((i) => [p, i]);
  $('#choices').innerHTML = [0, 1, 2, 3].map((i) =>
    `<button type="button" data-i="${i}" style="--c:${COLORS[p].css}" ${moves.includes(i) ? '' : 'disabled'} aria-label="Pion ${i + 1}">${i + 1}</button>`).join('');
  board.highlight(legalNow);
}
function clearChoices() { $('#choices').innerHTML = ''; legalNow = []; board.highlight([]); }

/* =====================================================================
   Les réactions : bulles de phrases au-dessus des Mii
   ===================================================================== */
const SAY = {
  six: ['Un 6 !', 'Yes !', 'Parfait !', 'Hop hop !'],
  one: ['Bof…', 'Un seul ?', 'Mouais.'],
  none: ['Pff…', 'Rien à jouer…', 'Sérieux ?'],
  capture: ['À la maison !', 'Hé hé !', 'Désolé ! (pas vraiment)', 'Bye bye !'],
  captured: ['NOOON !', 'Hé !!', 'Hmph !', 'Vengeance…'],
  watchCapture: ['Ouch !', 'Aïe…', 'Ha ha !', 'Bien joué !'],
  home: ['Rentré !', 'Et de un !', 'À l\u2019abri !'],
  cheer: ['Bravo !', 'Pas mal !'],
  win: ['J\u2019ai gagné !!', 'Champion !', 'Trop fort !'],
  lose: ['Bien joué…', 'La revanche !', 'Grr…'],
  tense: ['…', 'Allez…', 'Pas moi, pas moi…'],
  hello: ['Salut !', 'On joue ?', 'Je vais gagner !', 'Prêt·e ?', 'Hé hé…', 'Pas de pitié !', 'Bonne chance !', 'C\u2019est parti ?', 'Je suis chaud !', 'Revanche ?'],
  picked: ['Me voilà !', 'C\u2019est moi !', 'Coucou !', 'Présent !'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const bubbles = new Map();   // p -> { el, until }
function say(p, kind, ms = 2200) {
  const film = $('#film');
  let b = bubbles.get(p);
  if (!b) { b = { el: document.createElement('p') }; b.el.className = 'bubble'; film.append(b.el); bubbles.set(p, b); }
  b.el.textContent = pick(SAY[kind]);
  b.el.style.setProperty('--c', COLORS[p].css);
  b.el.classList.remove('show'); void b.el.offsetWidth; b.el.classList.add('show');
  b.until = performance.now() + ms;
}
function clearBubbles() { bubbles.forEach((b) => b.el.remove()); bubbles.clear(); }
// les bulles suivent la tête des Mii, et restent dans l'écran
(function followBubbles() {
  const now = performance.now();
  bubbles.forEach((b, p) => {
    if (!board?.actors[p]) return;
    const h = board.headScreen(p);
    const show = now < b.until && h.visible;
    b.el.classList.toggle('show', show);
    if (!show) return;
    const fw = $('#film').clientWidth, fh = $('#film').clientHeight;
    const half = (b.el.offsetWidth / fw) * 50 + 1.5, top = (b.el.offsetHeight / fh) * 100 + 3;
    b.el.style.left = `${Math.min(100 - half, Math.max(half, h.x))}%`;
    b.el.style.top = `${Math.min(92, Math.max(top, h.y))}%`;
  });
  requestAnimationFrame(followBubbles);
})();
/** Les autres Mii réagissent aussi (pas tous, et pas tous pareil). */
function crowd(except, kind, react, chance = 0.6) {
  players.forEach((_, q) => {
    if (except.includes(q) || Math.random() > chance) return;
    setTimeout(() => { say(q, kind, 1800); if (react) board.react(q, react); }, 250 + Math.random() * 500);
  });
}

/* =====================================================================
   La caméra : des plans choisis automatiquement
   ===================================================================== */
function corner(p) { const d = board.actors[p].home, l = Math.hypot(d.x, d.z); return { x: d.x / l, z: d.z / l }; }

function shotBehind(p) {      // vue par-dessus l'épaule de ton Mii
  cinema(false);
  const d = corner(p);
  board.director.shot(vec(d.x * 32, 25, d.z * 32), vec(-d.x * 2, -2, -d.z * 2), 1.6);
}
function shotFace(p) {        // gros plan sur le visage d'un Mii
  cinema(true);
  const h = board.actorHead(p), d = corner(p);
  board.director.shot(vec(h.x - d.x * 15, h.y + 3, h.z - d.z * 15), vec(h.x, h.y - 3.5, h.z), 2.2);
}
function shotFollow(mesh, p) {  // la caméra suit le pion qui avance
  cinema(false);
  const pos = mesh.position, len = Math.hypot(pos.x, pos.z);
  const d = len > 1.5 ? { x: pos.x / len, z: pos.z / len } : corner(p);
  board.director.track(() => mesh.position, vec(d.x * 10, 11, d.z * 10), 3);
}
function shotChoose(p) {      // vue fixe et haute depuis ton côté, pour bien lire les numéros des pions
  cinema(false);
  const d = corner(p);
  board.director.shot(vec(d.x * 10, 21, d.z * 10), vec(-d.x * 1.5, -1, -d.z * 1.5), 2);
}
function shotOverview() { cinema(false); board.director.overview(board.director.orbit?.angle ?? Math.PI * 0.25); }
let vec;   // fabrique de Vector3 (fournie par board.js une fois chargé)

/* =====================================================================
   Un tour de jeu
   ===================================================================== */
const speed = (p) => (fast && !players[p].human ? 0.45 : 1);

async function play() {
  const id = ++gameId;
  current = 0;
  renderPlayers();
  board.setPawns(players);
  caption('Que la partie commence !', 2000);
  shotOverview();
  await wait(1800);
  while (id === gameId) {
    const result = await turn(current, id);
    if (id !== gameId) return;
    if (result === 'win') return;
    if (result !== 'again') current = (current + 1) % 4;
  }
}

async function turn(p, id) {
  const pl = players[p], k = speed(p);
  renderPlayers();
  dice.tint(COLORS[p].hex);
  sfx.turn();
  board.lookAt(board.actors[p].root.position, p);   // tout le monde se tourne vers celui qui joue
  if (pl.human) { shotBehind(p); status('À toi ! Touche le dé pour lancer.'); }
  else { shotFace(p); status(`Au tour de ${who(p)}…`); }
  caption(pl.human ? 'À toi de jouer !' : `Au tour de ${who(p)}`, 1600);

  // --- lancer le dé
  if (pl.human) {
    $('#tray-hint').hidden = false;
    await new Promise((r) => { waitingRoll = r; });
    $('#tray-hint').hidden = true;
  } else await wait(900 * k);
  if (id !== gameId) return;
  board.react(p, 'roll');
  const roll = await dice.roll();
  if (id !== gameId) return;
  status(`${who(p)} fait <b>${roll}</b>${roll === 6 ? ' !' : '.'}`);
  if (roll === 6) { sfx.six(); board.react(p, 'six'); say(p, 'six'); caption(`${who(p)} fait un 6 !`, 1500); }
  else if (roll === 1) { board.react(p, 'meh'); say(p, 'one'); }

  // --- choisir un pion
  const moves = legal(p, roll);
  if (!moves.length) {
    board.react(p, 'none');
    say(p, 'none');
    status(`${who(p)} fait ${roll} : aucun pion ne peut bouger.`);
    if (!pl.human) shotFace(p);
    await wait(1300 * k);
    return 'next';
  }
  let i;
  if (pl.human) {
    if (moves.length === 1) { i = moves[0]; await wait(350); }
    else {
      status(`Tu as fait <b>${roll}</b> : choisis un pion (touche-le ou utilise les boutons 1 à 4).`);
      shotChoose(p);
      renderChoices(p, moves);
      i = await new Promise((r) => { waitingChoice = r; });
      clearChoices();
    }
  } else {
    await wait(500 * k);
    i = botChoose(p, roll, moves);
  }
  if (id !== gameId) return;

  // --- déplacer
  const { captured, finished } = await move(p, i, roll, k, id);
  if (id !== gameId) return;
  renderPlayers();

  if (pl.pawns.every((r) => r === GOAL)) { await victory(p); return 'win'; }
  if (roll === 6 || captured || finished) {
    caption(`${who(p)} rejoue !`, 1400);
    await wait(700 * k);
    return 'again';
  }
  shotOverview();
  board.lookAt(null);
  await wait(600 * k);
  return 'next';
}

async function move(p, i, roll, k, id) {
  const pl = players[p], from = pl.pawns[i], pawn = board.pawn(p, i), mesh = pawn.mesh;
  shotFollow(mesh, p);
  board.lookAt(mesh.position);
  if (from < 0) {
    pl.pawns[i] = 0;
    sfx.hop();
    await board.hop(mesh, board.spot(p, i, 0), 0.5 * k, 1.6);
  } else {
    for (let s = 1; s <= roll; s++) {
      if (id !== gameId) return {};
      pl.pawns[i] = from + s;
      sfx.hop();
      await board.hop(mesh, board.spot(p, i, from + s), 0.22 * k);
    }
  }
  const to = pl.pawns[i];
  board.lookAt(mesh.position);
  // un pion qui s'arrête juste derrière un pion adverse : son propriétaire s'inquiète
  if (to <= LAST) {
    const idx = trackIndex(p, to);
    players.forEach((other, q) => { if (q !== p && other.pawns.some((r) => r >= 0 && r <= LAST && ((trackIndex(q, r) - idx + 52) % 52) >= 1 && ((trackIndex(q, r) - idx + 52) % 52) <= 6) && Math.random() < 0.5) { say(q, 'tense', 1600); board.react(q, 'worry'); } });
  }

  // capture : les pions adverses sur la case repartent dans leur cour
  const hits = capturesAt(p, to);
  for (const [q, j] of hits) {
    players[q].pawns[j] = -1;
    const victim = board.pawn(q, j).mesh;
    sfx.capture();
    caption(`${who(p)} renvoie ${who(q)} à la maison !`, 2400);
    board.react(p, 'capture');
    board.react(q, 'captured');
    say(p, 'capture', 2600);
    setTimeout(() => say(q, 'captured', 2600), 450);
    crowd([p, q], 'watchCapture', 'laugh', 0.8);
    await board.fly(victim, board.spot(q, j, -1), 0.9 * k);
  }
  if (hits.length) { shotFace(hits[0][0]); await wait(1300 * k); shotFace(p); await wait(1100 * k); }

  let finished = false;
  if (to === GOAL) {
    finished = true;
    sfx.home();
    board.react(p, 'finish');
    say(p, 'home');
    crowd([p], 'cheer', 'clap', 0.5);
    caption(`${who(p)} rentre un pion !`, 1800);
    await wait(800 * k);
  }
  await board.restack({ players });
  return { captured: hits.length > 0, finished };
}

async function victory(p) {
  sfx.win();
  players.forEach((_, q) => { board.react(q, q === p ? 'win' : 'lose'); setTimeout(() => say(q, q === p ? 'win' : 'lose', 5000), q === p ? 0 : 600 + q * 250); });
  status(`${who(p)} a fait le tour complet avec ses quatre pions. Victoire !`);
  caption(`${who(p)} gagne la partie !`, 6000);
  shotFace(p);
  await wait(4500);
  shotOverview();
  $('#play').textContent = 'Rejouer';
  $('#start h2').textContent = players[p].human ? 'Tu as gagné !' : `${players[p].name} a gagné`;
  $('#start').hidden = false;
}

/* =====================================================================
   Entrées : dé, pions, boutons
   ===================================================================== */
function tryRoll() {
  sfx.init();
  if (waitingRoll) { const r = waitingRoll; waitingRoll = null; r(); }
}
function tryChoose(i) {
  if (!waitingChoice || !legalNow.some(([, j]) => j === i)) return;
  const r = waitingChoice; waitingChoice = null; r(i);
}
$('#tray').addEventListener('click', tryRoll);
$('#tray').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryRoll(); } });
$('#choices').addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (b) tryChoose(Number(b.dataset.i)); });
$('#board').addEventListener('click', (e) => {
  const hit = board?.pick(e.clientX, e.clientY);
  if (hit && hit[0] === 0) tryChoose(hit[1]);
});
document.addEventListener('keydown', (e) => {
  if (e.target.closest('button, input')) return;
  if (e.key === ' ' || e.key === 'Enter') { if (waitingRoll) { e.preventDefault(); tryRoll(); } }
  if (/^[1-4]$/.test(e.key)) tryChoose(Number(e.key) - 1);
});
$('#fast').addEventListener('click', (e) => { fast = !fast; e.currentTarget.setAttribute('aria-pressed', String(fast)); });
$('#mute').addEventListener('click', (e) => {
  sfx.muted = !sfx.muted;
  e.currentTarget.setAttribute('aria-pressed', String(sfx.muted));
  e.currentTarget.querySelector('use').setAttribute('href', sfx.muted ? '#i-mute' : '#i-sound');
});
$('#restart').addEventListener('click', () => {
  gameId++; waitingRoll = waitingChoice = null; clearChoices();
  $('#tray-hint').hidden = true;
  $('#play').textContent = 'Jouer';
  $('#start h2').textContent = 'Ludo des Mii';
  $('#start').hidden = false;
  preview();
});

/* ---------- Écran de départ : choisir les 4 Mii ---------- */
function renderLineup() {
  $('#lineup').innerHTML = seats.map((k, p) => `
    <div class="seat" style="--c:${COLORS[p].css}">
      <span class="seat-label">${p === 0 ? 'Toi' : `Bot ${p}`}</span>
      <img src="${renderIcon(pool[k].b64)}" alt="">
      <b>${esc(pool[k].name)}</b>
      <span class="seat-nav">
        <button type="button" class="icon-btn" data-seat="${p}" data-d="-1" aria-label="Mii précédent pour ${p === 0 ? 'toi' : `le bot ${p}`}"><svg class="ic"><use href="#i-left"/></svg></button>
        <button type="button" class="icon-btn" data-seat="${p}" data-d="1" aria-label="Mii suivant pour ${p === 0 ? 'toi' : `le bot ${p}`}"><svg class="ic"><use href="#i-right"/></svg></button>
      </span>
    </div>`).join('');
}
/** Change le Mii d'une place (en sautant ceux déjà pris par une autre place). */
function cycleSeat(p, d) {
  let k = seats[p];
  for (let n = 0; n < pool.length; n++) {
    k = (k + d + pool.length) % pool.length;
    if (!seats.some((other, q) => q !== p && other === k)) break;
  }
  seats[p] = k;
  renderLineup();
  preview();
  sfx.init(); sfx.turn();
  setTimeout(() => { say(p, 'picked', 1600); board.react(p, 'six'); }, 300);
}
$('#lineup').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-seat]');
  if (b) cycleSeat(Number(b.dataset.seat), Number(b.dataset.d));
});
$('#shuffle').addEventListener('click', () => {
  const free = pool.map((_, k) => k).filter((k) => k !== seats[0]).sort(() => Math.random() - 0.5);
  seats = [seats[0], ...free.slice(0, 3)];
  renderLineup(); preview();
  sfx.init(); sfx.six();
  [1, 2, 3].forEach((p) => setTimeout(() => { say(p, 'picked', 1500); board.react(p, 'laugh'); }, 300 + p * 220));
});

/** Pendant l'écran de départ, les Mii vivent : ils se saluent, se chambrent, se regardent. */
setInterval(() => {
  if (!board || $('#start').hidden || !players.length) return;
  const q = Math.floor(Math.random() * 4);
  const other = (q + 1 + Math.floor(Math.random() * 3)) % 4;
  board.lookAt(board.actors[other].root.position, -1);
  board.react(q, pick(['laugh', 'wow', 'clap', 'six', 'meh', 'roll']));
  if (Math.random() < 0.75) say(q, 'hello', 2000);
  if (Math.random() < 0.35) setTimeout(() => { board.react(other, pick(['laugh', 'wow', 'meh'])); say(other, 'hello', 1800); }, 900);
}, 2300);

$('#play').addEventListener('click', () => {
  sfx.init();
  $('#start').hidden = true;
  clearBubbles();
  setupPlayers();
  board.setPlayers(players);
  play();
});

/** Avant la partie : les quatre Mii attendent autour de la table, la caméra tourne. */
function preview() {
  clearBubbles();
  setupPlayers();
  board.setPlayers(players);
  board.setPawns(players);
  renderPlayers();
  status('Choisis ton Mii, puis appuie sur Jouer.');
  shotOverview();
}

/* =====================================================================
   Démarrage
   ===================================================================== */
try {
  await initMii('../../day-01-pulse/');
} catch (e) {
  console.error(e);
  $('#loading').textContent = 'Impossible de charger les Mii.';
  throw e;
}
const THREE = await import('three');
vec = (x, y, z) => new THREE.Vector3(x, y, z);
loadPool();
board = new Board($('#board'));
dice = new Dice($('#dice'), sfx);
renderLineup();
preview();
$('#loading').classList.add('done');
$('#play').disabled = false;
$('#play').textContent = 'Jouer';
