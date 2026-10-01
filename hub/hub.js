// Le cadre commun : accueil (grille des 31 jours) + page d'un jour (iframe, navigation, README).
import { DAYS, statusOf } from '../days.js';

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABELS = { done: 'Publié', today: "Aujourd'hui", upcoming: 'À venir', missed: 'Passé' };
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/* ---------- Accueil ---------- */
function renderHome() {
  const done = DAYS.filter((d) => statusOf(d) === 'done').length;
  $('#progress').innerHTML = `<b>${done}</b> / 31 jours publiés`;
  $('#grid').innerHTML = DAYS.map((d) => {
    const st = statusOf(d);
    const inner = `
      <span class="num">${pad(d.number)}</span>
      <span class="word">${d.word}</span>
      ${d.entry ? `<span class="title">${esc(d.entry.title)}</span><span class="pitch">${esc(d.entry.pitch)}</span>` : `<span class="date">${dateFmt.format(d.date)}</span>`}
      ${d.projects.length > 1 ? `<span class="more">+ ${d.projects.slice(1).map((p) => esc(p.title)).join(', ')}</span>` : ''}
      <span class="badge ${st}">${LABELS[st]}</span>`;
    return `<li class="card ${st}">${d.entry ? `<a href="#/${d.slug}">${inner}</a>` : `<div>${inner}</div>`}</li>`;
  }).join('');
}

/* ---------- Page d'un jour ---------- */
let current = null;
let project = null;

function showDay(day, path = '') {
  current = day;
  project = day.projects.find((p) => p.path === path) ?? day.projects[0] ?? null;
  document.title = `${pad(day.number)} · ${day.word} · Devtober 2026`;
  $('#crumb-day').textContent = `${pad(day.number)} · ${day.word}`;
  const prev = DAYS[day.number - 2], next = DAYS[day.number];
  for (const [el, d] of [[$('#prev'), prev], [$('#next'), next]]) {
    el.toggleAttribute('aria-disabled', !d);
    if (d) { el.href = `#/${d.slug}`; el.title = `${pad(d.number)} · ${d.word}`; } else el.removeAttribute('href');
  }
  $('#readme-btn').hidden = !day.entry;

  // plusieurs projets ce jour-là : un sélecteur dans la barre
  const sw = $('#switch');
  sw.hidden = day.projects.length < 2;
  sw.innerHTML = day.projects.map((p) => `<a href="#/${day.slug}${p.path ? '/' + p.path : ''}" ${p === project ? 'aria-current="page"' : ''}>${esc(p.title)}</a>`).join('');

  const frame = $('#frame');
  if (day.entry) {
    $('#empty').hidden = true;
    frame.hidden = false;
    const src = `${day.slug}/${project.path ? project.path + '/' : ''}index.html`;
    if (!frame.src.endsWith(src)) frame.src = src;
  } else {
    frame.hidden = true;
    frame.removeAttribute('src');
    const st = statusOf(day);
    $('#empty').hidden = false;
    $('.empty-num').textContent = `Jour ${pad(day.number)} · ${dateFmt.format(day.date)}`;
    $('.empty-word').textContent = day.word;
    $('.empty-text').textContent = st === 'missed' ? 'Ce jour-là, rien de publié (et ce n\'est pas grave).' : 'Pas encore publié. Rendez-vous ce jour-là !';
  }
}

/* ---------- README dans une modale ---------- */
let marked = null;
async function openReadme() {
  if (!current?.entry) return;
  const dialog = $('#readme'), body = $('#readme-body');
  $('#readme-title').textContent = `${pad(current.number)} · ${current.word} · ${project.title}`;
  body.innerHTML = '<p class="muted">Chargement…</p>';
  dialog.showModal();
  try {
    marked ??= (await import('https://cdn.jsdelivr.net/npm/marked@15/lib/marked.esm.js')).marked;
    const base = `${current.slug}/${project.path ? project.path + '/' : ''}`;
    const md = await (await fetch(`${base}README.md`)).text();
    body.innerHTML = marked.parse(md);
    // liens et images relatifs : relatifs au dossier du jour (comme sur GitHub)
    body.querySelectorAll('a[href], img[src]').forEach((el) => {
      const attr = el.tagName === 'A' ? 'href' : 'src';
      const v = el.getAttribute(attr);
      if (!/^([a-z]+:|#|\/)/i.test(v)) el.setAttribute(attr, `${base}${v}`);
      if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener'; }
    });
  } catch {
    body.innerHTML = '<p class="muted">Impossible de charger le README.</p>';
  }
}
$('#readme-btn').addEventListener('click', openReadme);
$('#readme-close').addEventListener('click', () => $('#readme').close());
$('#readme').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------- Routage (#/day-01-pulse) ---------- */
function route() {
  const [slug, path = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const day = DAYS.find((d) => d.slug === slug);
  $('#home').hidden = !!day;
  $('#day').hidden = !day;
  $('#bar').hidden = !day;
  document.body.classList.toggle('in-day', !!day);
  if (day) showDay(day, path);
  else { document.title = 'Devtober 2026'; $('#frame').removeAttribute('src'); current = null; }
}
window.addEventListener('hashchange', route);
renderHome();
route();
