// Devtober · easter egg : le bouton HOME de la 3DS ouvre un menu HOME, comme sur la vraie console.
// En haut : la bannière du logiciel choisi. En bas : les icônes de tous les projets publiés.
// À inclure dans une page « 3DS » : <script type="module" src="../shared/home.js"></script>
import { DAYS } from '../days.js?v=8';

const ROOT = new URL('../', import.meta.url);
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* ---------- Les icônes des logiciels (dessinées en SVG, pas d'emoji) ---------- */
const ICONS = {
  'day-01-pulse': `<path d="M12 21s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.4-7 10-7 10z" fill="#fff"/><path d="M4 12h3l1.5-3 3 6 2-4H20" stroke="#ff4f86" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  'day-02-loop': `<path d="M5 9a7 7 0 0 1 12-3l2 2M19 15a7 7 0 0 1-12 3l-2-2" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M19 4v4h-4M5 20v-4h4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  'day-02-loop/ludo': `<rect x="4" y="4" width="16" height="16" rx="4" fill="#fff"/><g fill="#2f9a48"><circle cx="8.5" cy="8.5" r="1.6"/><circle cx="15.5" cy="8.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="8.5" cy="15.5" r="1.6"/><circle cx="15.5" cy="15.5" r="1.6"/></g>`,
  'day-03-bloom': `<g fill="#fff">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="12" cy="6.5" rx="3" ry="4.5" transform="rotate(${a} 12 12)"/>`).join('')}</g><circle cx="12" cy="12" r="3" fill="#ffd34d"/>`,
  'day-04-drift': `<circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="2.4" fill="none"/><circle cx="12" cy="12" r="2.4" fill="#fff"/><path d="M12 9.6V4.5M9.9 13.2l-5 2.6M14.1 13.2l5 2.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  hub: `<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill="#fff"/>`,
};
const COLORS = {
  'day-01-pulse': ['#ff7aa5', '#ff4f86'], 'day-02-loop': ['#7cc3ff', '#2f86e0'], 'day-02-loop/ludo': ['#7fd88f', '#2f9a48'],
  'day-03-bloom': ['#c08bff', '#7b2dff'], 'day-04-drift': ['#ffb04a', '#ff6a1f'], hub: ['#b8c2cc', '#7d8a96'],
};
const fallbackIcon = (n) => `<text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="Nunito, sans-serif">${n}</text>`;

/** Tous les logiciels : l'accueil du Devtober, puis chaque projet publié (et ses bonus). */
const APPS = [
  { key: 'hub', title: 'Devtober 2026', sub: 'Les 31 jours', pitch: 'Le calendrier de tous les projets du mois.', hash: '#/' },
  ...DAYS.filter((d) => d.entry).flatMap((d) => d.projects.map((p) => {
    const key = p.path ? `${d.slug}/${p.path}` : d.slug;
    return {
      key, n: d.number, title: p.title, pitch: p.pitch,
      sub: `Jour ${String(d.number).padStart(2, '0')} · ${d.word}${p.path ? ' · bonus' : ''}`,
      hash: `#/${key}`,
    };
  })),
];
const here = location.pathname.replace(/\/index\.html$/, '/').replace(new URL('.', ROOT).pathname, '').replace(/\/$/, '');
const iconOf = (app) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[app.key] ?? fallbackIcon(app.n)}</svg>`;
const bg = (app) => { const [a, b] = COLORS[app.key] ?? ['#9fb4c8', '#5f7890']; return `linear-gradient(160deg, ${a}, ${b})`; };

/* ---------- Petits sons (comme le menu de la 3DS) ---------- */
let actx;
function tone(f, t0, dur, vol = 0.05, type = 'sine') {
  try {
    actx ??= new AudioContext();
    const t = actx.currentTime + t0, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* pas d'audio */ }
}
const sfx = {
  open: () => { tone(988, 0, 0.12); tone(1319, 0.08, 0.18); },
  close: () => { tone(1319, 0, 0.1); tone(988, 0.07, 0.15); },
  move: () => tone(1760, 0, 0.05, 0.03, 'triangle'),
  launch: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.2, 0.05, 'triangle')),
};

/* ---------- Le style du menu (injecté une seule fois) ---------- */
const css = `
.home-top, .home-touch { position: absolute; inset: 0; z-index: 50; font-family: Nunito, system-ui, sans-serif; color: #333c45; overflow: hidden;
  opacity: 0; pointer-events: none; transition: opacity .25s; user-select: none; -webkit-user-select: none; }
.home-open .home-top, .home-open .home-touch { opacity: 1; pointer-events: auto; }
.home-top { background: radial-gradient(circle at 50% 120%, #ffffff 0, #eef2f5 45%, #d4dbe2 100%); }
.home-top::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(#c9d2da 1px, transparent 1.2px); background-size: 2.4cqw 2.4cqw; opacity: .5; }
.home-status { position: absolute; left: 0; right: 0; top: 0; height: 6cqw; display: flex; align-items: center; justify-content: space-between; padding: 0 2.4cqw;
  background: linear-gradient(#ffffff, #e3e8ed); border-bottom: .3cqw solid #c8d0d8; font-weight: 900; font-size: 2.6cqw; color: #59636d; }
.home-status .bars { display: flex; gap: .5cqw; align-items: flex-end; }
.home-status .bars i { display: block; width: .8cqw; background: #4aa8ff; border-radius: .2cqw; }
.home-status .batt { width: 6cqw; height: 2.8cqw; border: .4cqw solid #59636d; border-radius: .6cqw; position: relative; padding: .3cqw; }
.home-status .batt::after { content: ""; position: absolute; right: -1.1cqw; top: .6cqw; width: .7cqw; height: 1cqw; background: #59636d; border-radius: 0 .2cqw .2cqw 0; }
.home-status .batt i { display: block; height: 100%; width: 80%; background: #3ac46a; border-radius: .2cqw; }
.home-banner { position: absolute; left: 6cqw; right: 6cqw; top: 13cqw; display: flex; align-items: center; gap: 3cqw; padding: 2.6cqw 3cqw;
  background: #fff; border-radius: 2.4cqw; box-shadow: 0 1cqw 2.4cqw rgba(40, 60, 80, .18), inset 0 -.6cqw 0 #e7ecf0; animation: home-in .35s cubic-bezier(.3, 1.6, .5, 1); }
.home-banner .ico { width: 16cqw; height: 16cqw; border-radius: 3.6cqw; display: grid; place-items: center; flex: none; box-shadow: inset 0 -.6cqw 0 rgba(0,0,0,.15), 0 .5cqw 1cqw rgba(0,0,0,.15); }
.home-banner .ico svg { width: 70%; height: 70%; }
.home-banner h3 { margin: 0; font-size: 4.6cqw; font-weight: 900; line-height: 1.05; }
.home-banner small { display: block; font-size: 2.5cqw; font-weight: 900; color: #4aa8ff; text-transform: uppercase; letter-spacing: .08em; margin-bottom: .6cqw; }
.home-banner p { margin: .8cqw 0 0; font-size: 2.6cqw; font-weight: 700; color: #6c7782; line-height: 1.25; }
.home-hint { position: absolute; left: 0; right: 0; bottom: 3.4cqw; text-align: center; font-weight: 900; font-size: 2.6cqw; color: #7d8a96; }
.home-hint b { display: inline-grid; place-items: center; width: 4cqw; height: 4cqw; border-radius: 50%; background: #e2433c; color: #fff; font-size: 2.4cqw; margin-right: .6cqw; vertical-align: middle; }
@keyframes home-in { from { opacity: 0; transform: translateY(2cqw) scale(.94); } }

.home-touch { background: #e9edf1; display: grid; grid-template-rows: auto 1fr auto; }
.home-touch::before { content: ""; position: absolute; inset: 0; background-image: radial-gradient(#d3dae1 1.2px, transparent 1.4px); background-size: 3.2cqw 3.2cqw; }
.home-bar { position: relative; display: flex; align-items: center; gap: 1.6cqw; padding: 1.6cqw 2.4cqw; background: linear-gradient(#fdfdfe, #e1e6eb); border-bottom: .4cqw solid #c8d0d8; }
.home-bar span { width: 7cqw; height: 7cqw; border-radius: 50%; background: linear-gradient(#fff, #e6ebf0); box-shadow: inset 0 0 0 .4cqw #cfd7df; display: grid; place-items: center; }
.home-bar span svg { width: 55%; height: 55%; }
.home-bar .grow { flex: 1; width: auto; height: auto; background: none; box-shadow: none; font-weight: 900; font-size: 3.2cqw; color: #7d8a96; text-align: center; }
.home-grid { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3cqw; padding: 4cqw 5cqw; align-content: start; overflow-y: auto; }
.home-app { aspect-ratio: 1; border: none; padding: 0; border-radius: 3.6cqw; background: #fff; display: grid; place-items: center; cursor: pointer; position: relative;
  box-shadow: 0 .8cqw 0 #c5cdd5, 0 1.2cqw 1.6cqw rgba(40, 60, 80, .15); transition: transform .15s; }
.home-app .ico { width: 78%; height: 78%; border-radius: 2.8cqw; display: grid; place-items: center; box-shadow: inset 0 -.6cqw 0 rgba(0,0,0,.15); }
.home-app .ico svg { width: 68%; height: 68%; }
.home-app.sel { box-shadow: 0 0 0 .9cqw #4aa8ff, 0 .8cqw 0 #c5cdd5, 0 0 3cqw rgba(74, 168, 255, .8); animation: home-glow 1.2s ease-in-out infinite; }
.home-app:active { transform: translateY(.6cqw); }
.home-app .now { position: absolute; top: -1.4cqw; right: -1.4cqw; padding: .4cqw 1.2cqw; border-radius: 99px; background: #ff5b8d; color: #fff; font-size: 2.2cqw; font-weight: 900; }
@keyframes home-glow { 50% { box-shadow: 0 0 0 .9cqw #8cc8ff, 0 .8cqw 0 #c5cdd5, 0 0 4.5cqw rgba(74, 168, 255, .9); } }
.home-foot { position: relative; display: flex; gap: 2.4cqw; padding: 2cqw 3cqw 2.6cqw; }
.home-foot button { flex: 1; border: none; border-radius: 99px; padding: 2cqw 0; font: inherit; font-size: 3.6cqw; font-weight: 900; cursor: pointer; }
.home-foot .go { background: linear-gradient(#6cc0ff, #2f86e0); color: #fff; box-shadow: 0 .8cqw 0 #1f63ad; }
.home-foot .back { background: linear-gradient(#fff, #e3e8ed); color: #59636d; box-shadow: 0 .8cqw 0 #c3ccd4; }
.home-foot button:active { transform: translateY(.6cqw); box-shadow: none; }
.sys-btns .home { cursor: pointer; }
.home-flash { animation: home-flash .45s ease-out; }
@keyframes home-flash { 0% { filter: brightness(1); } 40% { filter: brightness(1.8) saturate(.4); } 100% { filter: brightness(1); } }
`;

/* ---------- Construction ---------- */
function setup() {
  const top = $('.screen-top'), touch = $('.touch'), btn = $('.sys-btns .home');
  if (!top || !touch || !btn) return;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  if (getComputedStyle(touch).position === 'static') touch.style.position = 'relative';
  if (getComputedStyle(top).position === 'static') top.style.position = 'relative';
  const ds = $('.ds') ?? document.body;

  const homeTop = document.createElement('div');
  homeTop.className = 'home-top';
  homeTop.innerHTML = `
    <div class="home-status"><span class="clock"></span><span style="display:flex;gap:2cqw;align-items:center"><span class="bars"><i style="height:1cqw"></i><i style="height:1.6cqw"></i><i style="height:2.2cqw"></i></span><span class="batt"><i></i></span></span></div>
    <div class="home-banner"></div>
    <p class="home-hint"><b>A</b>Toucher deux fois pour ouvrir</p>`;
  const homeTouch = document.createElement('div');
  homeTouch.className = 'home-touch';
  homeTouch.innerHTML = `
    <div class="home-bar">
      <span title="Luminosité"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="#f0b40c"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#f0b40c" stroke-width="2" stroke-linecap="round"/></svg></span>
      <span title="Carnet"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="#ff8a3d"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg></span>
      <span class="grow">MENU HOME</span>
      <span title="Amis"><svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.4" fill="#ff5b8d"/><circle cx="16" cy="10" r="2.8" fill="#4aa8ff"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M13 20c.3-3 2-4.6 4-4.6s3.6 1.6 4 4.6" fill="#ff5b8d"/></svg></span>
      <span title="Notifications"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" fill="#3ac46a"/><circle cx="12" cy="21" r="1.6" fill="#3ac46a"/></svg></span>
    </div>
    <div class="home-grid"></div>
    <div class="home-foot"><button type="button" class="back">Fermer</button><button type="button" class="go">Ouvrir</button></div>`;
  top.append(homeTop);
  touch.append(homeTouch);

  let sel = Math.max(0, APPS.findIndex((a) => a.key === here));
  const grid = $('.home-grid', homeTouch);
  grid.innerHTML = APPS.map((a, i) => `<button type="button" class="home-app" data-i="${i}" aria-label="${esc(a.title)}">
      <span class="ico" style="background:${bg(a)}">${iconOf(a)}</span>${a.key === here ? '<span class="now">En cours</span>' : ''}</button>`).join('');

  const render = () => {
    const a = APPS[sel];
    grid.querySelectorAll('.home-app').forEach((b, i) => b.classList.toggle('sel', i === sel));
    const banner = $('.home-banner', homeTop);
    banner.innerHTML = `<span class="ico" style="background:${bg(a)}">${iconOf(a)}</span>
      <div><small>${esc(a.sub)}</small><h3>${esc(a.title)}</h3><p>${esc(a.pitch)}</p></div>`;
    banner.style.animation = 'none'; void banner.offsetWidth; banner.style.animation = '';
    $('.go', homeTouch).textContent = a.key === here ? 'Reprendre' : 'Ouvrir';
  };
  const clock = () => {
    const d = new Date();
    $('.clock', homeTop).textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const isOpen = () => ds.classList.contains('home-open');
  const open = () => {
    clock(); render();
    ds.classList.add('home-open', 'home-flash');
    setTimeout(() => ds.classList.remove('home-flash'), 460);
    sfx.open();
  };
  const close = () => { ds.classList.remove('home-open'); sfx.close(); };
  const launch = (a) => {
    if (a.key === here) return close();
    sfx.launch();
    ds.classList.add('home-flash');
    setTimeout(() => {
      // dans l'accueil du Devtober (iframe) : on change de projet dans la page parente ; sinon on y va directement
      try {
        if (window.top !== window && window.top.location.origin === location.origin) { window.top.location.hash = a.hash; return; }
      } catch { /* autre origine */ }
      location.href = new URL(`index.html${a.hash}`, ROOT).href;
    }, 380);
  };

  btn.removeAttribute('aria-hidden');
  btn.setAttribute('role', 'button');
  btn.setAttribute('tabindex', '0');
  btn.setAttribute('aria-label', 'Menu HOME');
  btn.parentElement.removeAttribute('aria-hidden');
  btn.parentElement.querySelectorAll('span:not(.home)').forEach((s) => s.setAttribute('aria-hidden', 'true'));
  const toggle = () => (isOpen() ? close() : open());
  btn.addEventListener('click', toggle);
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('.home-app');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (i === sel) return launch(APPS[i]);   // deuxième toucher : on ouvre
    sel = i; sfx.move(); render();
  });
  $('.go', homeTouch).addEventListener('click', () => launch(APPS[sel]));
  $('.back', homeTouch).addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { sel = (sel + (e.key === 'ArrowRight' ? 1 : -1) + APPS.length) % APPS.length; sfx.move(); render(); }
    else if (e.key === 'Enter' && !e.target.closest('button')) launch(APPS[sel]);
  });
}
setup();
