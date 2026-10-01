// Devtober J2 · Loop (bonus) — le téléphone arabe des traducteurs.
// Une phrase part du français, fait le tour des langues de la boucle, et revient… un peu déformée.

const $ = (s, el = document) => el.querySelector(s);
const STORE = 'devtober-j2-telephone';
const SOURCE = 'fr';

// gt = code pour le secours gratuit, lt = code LibreTranslate
const LANGS = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'Anglais' }, { code: 'ja', name: 'Japonais' }, { code: 'ru', name: 'Russe' },
  { code: 'ar', name: 'Arabe' }, { code: 'zh', name: 'Chinois', gt: 'zh-CN' }, { code: 'ko', name: 'Coréen' },
  { code: 'de', name: 'Allemand' }, { code: 'es', name: 'Espagnol' }, { code: 'it', name: 'Italien' },
  { code: 'pt', name: 'Portugais' }, { code: 'nl', name: 'Néerlandais' }, { code: 'pl', name: 'Polonais' },
  { code: 'tr', name: 'Turc' }, { code: 'hi', name: 'Hindi' }, { code: 'el', name: 'Grec' },
  { code: 'fi', name: 'Finnois' }, { code: 'sv', name: 'Suédois' }, { code: 'uk', name: 'Ukrainien' },
  { code: 'id', name: 'Indonésien' }, { code: 'vi', name: 'Vietnamien' }, { code: 'th', name: 'Thaï' },
];
const byCode = Object.fromEntries(LANGS.map((l) => [l.code, l]));

/* ---------- État (sauvegardé dans le navigateur) ---------- */
let state = { ring: ['en', 'ja', 'ru', 'ar'] };
try { state = { ...state, ...JSON.parse(localStorage.getItem(STORE)) }; } catch { /* rien */ }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* navigation privée */ } };

const results = {};   // code → texte obtenu au dernier tour
let running = false;
let tour = 0;
let original = '';

/* ---------- Traduction : une cascade de moteurs gratuits ----------
   Chaque étape essaie les moteurs dans l'ordre (Chrome → Google → MyMemory) ; si l'un échoue (ou renvoie la phrase sans la traduire),
   le suivant prend le relais. Tout part du navigateur du visiteur : pas de serveur, pas de clé. */

const ENGINES = [
  {
    // Traduction intégrée à Chrome (Translator API) : illimitée, calculée sur l'appareil
    id: 'chrome', name: 'Chrome',
    ok: () => 'Translator' in self,
    cache: {},
    async run(q, from, to) {
      const key = `${from}>${to}`;
      if (!this.cache[key]) {
        const pair = { sourceLanguage: from, targetLanguage: to };
        // seulement si le modèle est déjà sur l'appareil (sinon Chrome lance un long téléchargement)
        const av = await self.Translator.availability(pair);
        if (av !== 'available') throw new Error(`modèle ${av}`);
        this.cache[key] = self.Translator.create(pair);
      }
      try { return await (await this.cache[key]).translate(q); } catch (err) { delete this.cache[key]; throw err; }
    },
  },
  {
    // Google Traduction (adresse publique non officielle) : rapide, très large en pratique
    id: 'google', name: 'Google',
    ok: () => true,
    async run(q, from, to) {
      const sl = byCode[from].gt ?? from, tl = byCode[to].gt ?? to;
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${sl}&tl=${tl}&q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      return data[0].map((part) => part[0]).join('');
    },
  },
  {
    // MyMemory : 5 000 mots par jour et par visiteur
    id: 'mymemory', name: 'MyMemory',
    ok: () => true,
    async run(q, from, to) {
      const sl = byCode[from].gt ?? from, tl = byCode[to].gt ?? to;
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${sl}|${tl}`);
      const data = await res.json();
      if (!res.ok || data.responseStatus !== 200 || data.quotaFinished) throw new Error(data.responseDetails || `Erreur ${res.status}`);
      return data.responseData.translatedText;
    },
  },
];

/** Traduit avec le premier moteur qui répond correctement. Renvoie { text, engine }. */
async function translate(q, from, to) {
  const errors = [];
  for (const engine of ENGINES) {
    if (!engine.ok()) continue;
    try {
      const text = (await Promise.race([
        engine.run(q, from, to),
        new Promise((_, reject) => setTimeout(() => reject(new Error('trop long')), 7000)),
      ]))?.trim();
      // une « traduction » identique à l'original (avec des lettres) = le moteur n'a rien fait
      if (!text || (text === q.trim() && /\p{L}{3}/u.test(q))) throw new Error('pas traduit');
      return { text, engine: engine.name };
    } catch (err) {
      errors.push(`${engine.name} : ${err.message}`);
    }
  }
  throw new Error(errors.join(' · '));
}

/* ---------- Les puces ---------- */
const ringEl = $('#ring'), trayEl = $('#tray');
const chips = {};

function makeChip(lang) {
  const el = document.createElement('div');
  el.className = 'chip' + (lang.code === SOURCE ? ' source' : '');
  el.dataset.code = lang.code;
  el.tabIndex = lang.code === SOURCE ? -1 : 0;
  el.setAttribute('role', lang.code === SOURCE ? 'note' : 'button');
  el.innerHTML = `<div class="name"><span>${lang.name}</span><span class="code">${lang.code === SOURCE ? 'départ' : lang.code}</span></div><div class="text"></div><div class="via"></div>`;
  el.style.setProperty('--tilt', `${(Math.random() * 10 - 5).toFixed(1)}deg`);
  if (lang.code !== SOURCE) {
    el.addEventListener('pointerdown', (e) => startDrag(e, el));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(lang.code); } });
  }
  chips[lang.code] = el;
  return el;
}
LANGS.forEach(makeChip);

function setLabel(code) {
  const el = chips[code];
  const inRing = state.ring.includes(code);
  el.setAttribute('aria-label', code === SOURCE ? 'Français, langue de départ et d\'arrivée'
    : `${byCode[code].name} : ${inRing ? 'dans la boucle, cliquer pour retirer' : 'dans le bac, cliquer pour ajouter'}`);
}

/** Déplace les éléments en douceur entre deux mises en page (technique FLIP). */
function flip(mutate) {
  const before = new Map(Object.values(chips).map((el) => [el, el.getBoundingClientRect()]));
  mutate();
  for (const [el, a] of before) {
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    const end = getComputedStyle(el).transform;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: end === 'none' ? 'none' : end }],
      { duration: 420, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
  }
}

/* ---------- Mise en page de la boucle ---------- */
function nodes() { return [SOURCE, ...state.ring]; }
function angleOf(i, n) { return -Math.PI / 2 + (i / n) * Math.PI * 2; }

const mobile = () => matchMedia('(max-width: 640px)').matches;

/**
 * Centre de chaque puce de la boucle.
 * - Écran large : une ellipse qui grandit avec le nombre de langues.
 * - Téléphone : une piste en deux colonnes (on descend à droite, on remonte à gauche).
 * Fixe aussi la hauteur de la zone.
 */
function positions(n) {
  const w = ringEl.clientWidth;
  if (!mobile()) {
    const h = Math.min(780, Math.max(440, 160 + n * 56));
    ringEl.style.height = `${h}px`;
    const cw = 150, ch = 86;
    const rx = w / 2 - cw / 2 - 4, ry = h / 2 - ch / 2 - 4;
    return Array.from({ length: n }, (_, i) => {
      // avec deux puces seulement : gauche et droite, pour que les flèches contournent le texte du centre
      const a = n === 2 ? Math.PI + i * Math.PI : angleOf(i, n);
      return { x: w / 2 + rx * Math.cos(a), y: h / 2 + ry * Math.sin(a) };
    });
  }
  if (n === 2) {
    // une seule langue : les deux puces centrées l'une sous l'autre, la boucle passe par les côtés
    ringEl.style.height = '300px';
    return [{ x: w / 2, y: 60 }, { x: w / 2, y: 240 }];
  }
  const m = n - 1, right = Math.ceil(m / 2), left = m - right, rowH = 132;
  ringEl.style.height = `${(right + 1) * rowH + 60}px`;   // + place pour la flèche du bas
  const pts = [{ x: w / 2, y: rowH / 2 }];
  for (let i = 0; i < right; i++) pts.push({ x: w * 0.74, y: (i + 1.5) * rowH });
  for (let i = 0; i < left; i++) pts.push({ x: w * 0.26, y: (right - i + 0.5) * rowH });
  return pts;
}

function layout() {
  // place chaque puce : dans la boucle ou dans le bac
  for (const l of LANGS) {
    const el = chips[l.code];
    const inRing = l.code === SOURCE || state.ring.includes(l.code);
    const parent = inRing ? ringEl : trayEl;
    if (el.parentElement !== parent) parent.append(el);
    if (!inRing) { el.style.left = ''; el.style.top = ''; }
    setLabel(l.code);
  }
  // le bac garde l'ordre de la liste
  LANGS.filter((l) => l.code !== SOURCE && !state.ring.includes(l.code)).forEach((l) => trayEl.append(chips[l.code]));

  const list = nodes(), pts = positions(list.length);
  list.forEach((code, i) => {
    const el = chips[code];
    el.style.left = `${pts[i].x - el.offsetWidth / 2}px`;
    el.style.top = `${pts[i].y - el.offsetHeight / 2}px`;
  });
  drawArrows(pts);
}

/** Flèches courbes d'une puce à la suivante, légèrement bombées vers l'extérieur. */
function drawArrows(pts) {
  const list = nodes(), n = list.length;
  const w = ringEl.clientWidth, h = ringEl.clientHeight, cx = w / 2, cy = h / 2;
  $('#arrows').setAttribute('viewBox', `0 0 ${w} ${h}`);
  const inside = ([x, y], code) => {
    const el = chips[code], l = parseFloat(el.style.left), t = parseFloat(el.style.top), m = mobile() ? 8 : 14;
    return x > l - m && x < l + el.offsetWidth + m && y > t - m && y < t + el.offsetHeight + m;
  };
  const paths = [];
  for (let i = 0; n > 1 && i < n; i++) {
    const A = pts[i], B = pts[(i + 1) % n], from = list[i], to = list[(i + 1) % n];
    // point de contrôle : milieu du segment, poussé vers l'extérieur de la boucle
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, d = Math.hypot(B.x - A.x, B.y - A.y);
    let ox = mx - cx, oy = my - cy;
    // deux puces : l'aller et le retour partent de chaque côté (perpendiculaire au segment)
    if (n === 2) { ox = B.y - A.y; oy = A.x - B.x; }
    const ol = Math.hypot(ox, oy) || 1;
    // sur téléphone, les puces côte à côte sont proches : la flèche fait un détour plus large
    const sideBySide = mobile() && Math.abs(A.y - B.y) < 10 && n > 2;
    const bulge = n === 2 ? Math.min(d * 0.5, mobile() ? 150 : 300) : sideBySide ? 140 : d * 0.18;
    const C = { x: mx + (ox / ol) * bulge, y: my + (oy / ol) * bulge };
    const curve = [];
    for (let k = 0; k <= 60; k++) {
      const t = k / 60, u = 1 - t;
      const p = [u * u * A.x + 2 * u * t * C.x + t * t * B.x, u * u * A.y + 2 * u * t * C.y + t * t * B.y];
      if (!inside(p, from) && !inside(p, to)) curve.push(p);
    }
    paths.push(curve.length > 2 ? `<path data-step="${i}" d="M${curve.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')}"/>` : '');
  }
  $('#arrow-paths').innerHTML = paths.join('');
}

/* ---------- Ajouter / retirer / réordonner ---------- */
function toggle(code) {
  if (running) return;
  flip(() => {
    if (state.ring.includes(code)) state.ring = state.ring.filter((c) => c !== code);
    else state.ring = [...state.ring, code];
    delete results[code];
    chips[code].querySelector('.text').textContent = '';
    chips[code].querySelector('.via').textContent = '';
    layout();
  });
  save(); showIdle();
}

let drag = null;
function startDrag(e, el) {
  if (running || e.button > 0) return;
  e.preventDefault();   // pas de sélection de texte pendant le glisser
  drag = { el, code: el.dataset.code, x0: e.clientX, y0: e.clientY, moved: false };
  // écoute sur la fenêtre : la puce change de parent pendant le glisser (ce qui casserait une capture)
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', endDrag, { once: true });
  window.addEventListener('pointercancel', endDrag, { once: true });
}
function onDrag(e) {
  const d = drag;
  if (!d) return;
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (!d.moved && Math.hypot(dx, dy) < 6) return;
  if (!d.moved) {
    d.moved = true;
    const r = d.el.getBoundingClientRect();
    d.offX = d.x0 - r.left; d.offY = d.y0 - r.top;
    d.el.classList.add('dragging');
    Object.assign(d.el.style, { position: 'fixed', width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px`, transform: 'rotate(-3deg)' });
    document.body.append(d.el);
  }
  d.el.style.left = `${e.clientX - d.offX}px`;
  d.el.style.top = `${e.clientY - d.offY}px`;
  const over = overRing(e.clientX, e.clientY);
  ringEl.classList.toggle('over', over);
  trayEl.parentElement.classList.toggle('over', !over);
}
function overRing(x, y) {
  const r = ringEl.getBoundingClientRect();
  return x > r.left && x < r.right && y > r.top && y < r.bottom;
}
function endDrag(e) {
  const d = drag;
  if (!d) return;
  drag = null;
  window.removeEventListener('pointermove', onDrag);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  ringEl.classList.remove('over');
  trayEl.parentElement.classList.remove('over');
  if (!d.moved) return toggle(d.code);

  // insertion juste après la puce de la boucle la plus proche du point de dépôt
  let ring = state.ring.filter((c) => c !== d.code);
  if (overRing(e.clientX, e.clientY)) {
    let best = SOURCE, bestD = Infinity;
    for (const code of [SOURCE, ...ring]) {
      const r = chips[code].getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (dist < bestD) { bestD = dist; best = code; }
    }
    ring.splice(best === SOURCE ? 0 : ring.indexOf(best) + 1, 0, d.code);
  }
  flip(() => {
    d.el.classList.remove('dragging');
    Object.assign(d.el.style, { position: '', width: '', transform: '' });
    state.ring = ring;
    if (!ring.includes(d.code)) { delete results[d.code]; d.el.querySelector('.text').textContent = ''; d.el.querySelector('.via').textContent = ''; }
    layout();
  });
  save(); showIdle();
}

/* ---------- Le tour de boucle ---------- */
const center = $('#center');
function showIdle() {
  if (running) return;
  if (!tour) center.innerHTML = state.ring.length
    ? `<p class="center-hint">${state.ring.length} langue${state.ring.length > 1 ? 's' : ''} dans la boucle.<br>Lance-la avec le bouton en haut.</p>`
    : '<p class="center-hint">Ajoute des langues depuis le bac,<br>puis lance la boucle.</p>';
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Fidélité : part des mots de la phrase de départ qui ont survécu. */
function fidelity(a, b) {
  const words = (s) => new Set(s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || []);
  const A = words(a), B = words(b);
  if (!A.size) return 0;
  let same = 0;
  A.forEach((w) => { if (B.has(w)) same++; });
  return Math.round((same / A.size) * 100);
}

async function runLoop(text) {
  if (running || !state.ring.length || !text.trim()) {
    if (!state.ring.length) center.innerHTML = '<p class="center-hint error">Il faut au moins une langue dans la boucle.</p>';
    return;
  }
  running = true;
  $('#run').disabled = true;
  if (!tour) original = text;
  tour++;
  const path = [...nodes(), SOURCE];
  document.querySelectorAll('#arrow-paths path').forEach((p) => p.classList.remove('active', 'done'));
  Object.values(chips).forEach((el) => el.classList.remove('active'));
  chips[SOURCE].querySelector('.text').textContent = text;
  Object.values(chips).forEach((el) => { el.querySelector('.via').textContent = ''; });
  chips[SOURCE].classList.add('active');

  let current = text;
  try {
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i], to = path[i + 1];
      const arrow = $(`#arrow-paths path[data-step="${i}"]`);
      arrow?.classList.add('active');
      center.innerHTML = `<p class="status">TOUR ${tour} · ${from.toUpperCase()} → ${to.toUpperCase()}</p><p class="result">${esc(current)}</p>`;
      const [out] = await Promise.all([translate(current, from, to), wait(550)]);
      current = out.text;
      chips[to].querySelector('.via').textContent = `via ${out.engine}`;
      arrow?.classList.replace('active', 'done');
      chips[from].classList.remove('active');
      chips[to].classList.add('active');
      chips[to].querySelector('.text').textContent = current;
      results[to] = current;
    }
    const f = fidelity(original, current);
    center.innerHTML = `
      <p class="status">RETOUR AU FRANÇAIS · TOUR ${tour}</p>
      <p class="result">« ${esc(current)} »</p>
      <p class="drift">Fidélité à la phrase de départ : ${f} %</p>
      <button type="button" class="again" id="again">Encore un tour</button>`;
    $('#again').addEventListener('click', () => { $('#phrase').value = current; runLoop(current); });
  } catch (err) {
    console.error(err);
    center.innerHTML = `<p class="center-hint error">La traduction a échoué : ${esc(err.message)}.<br>Réessaie dans un instant.</p>`;
  } finally {
    running = false;
    $('#run').disabled = false;
    setTimeout(() => chips[SOURCE].classList.remove('active'), 1200);
  }
}

$('#phrase-form').addEventListener('submit', (e) => {
  e.preventDefault();
  tour = 0;   // nouvelle phrase = on repart de zéro
  runLoop($('#phrase').value);
});

/* ---------- Démarrage ---------- */
state.ring = state.ring.filter((c) => byCode[c] && c !== SOURCE);
layout();
showIdle();
chips[SOURCE].querySelector('.text').textContent = $('#phrase').value;
new ResizeObserver(() => { if (!drag) layout(); }).observe(ringEl);
