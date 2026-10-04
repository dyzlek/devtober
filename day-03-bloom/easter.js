// Bloom · easter egg : DJ Rémi prend les platines.
// Tape 5 fois vite sur le titre « La boîte des Mii » (ou écris « remi » au clavier) :
// la musique de la boîte se coupe et « Boite en nuit » de DJ Rémi passe à la place.
// Le jeu continue sur son tempo à lui… donc plus rien n'est en rythme. C'est le but.
export function setupEasterEgg({ music, caption, title, screen, muteBtn }) {
  let on = false, taps = [];
  const song = new Audio('assets/remi.mp3');
  song.loop = true;
  song.preload = 'none';   // 5,7 Mo : chargé seulement si on trouve l'easter egg

  // une petite étiquette dans l'écran du haut
  const tag = document.createElement('span');
  tag.className = 'remi-tag';
  tag.textContent = 'DJ Rémi aux platines';
  tag.hidden = true;
  screen.appendChild(tag);

  function toggle() {
    on = !on;
    music.start();                 // le tempo du jeu continue de tourner, même sans le son
    music.setOverride(on);
    tag.hidden = !on;
    title.classList.toggle('remi', on);
    if (on) {
      caption('DJ Rémi prend les platines !', 2600);
      song.muted = music.muted;
      song.currentTime = 0;
      song.play().catch(() => {});
    } else {
      caption('Retour à la musique de la boîte', 2000);
      song.pause();
    }
  }

  // 5 taps en moins de 2 s sur le titre
  title.addEventListener('pointerdown', () => {
    const now = performance.now();
    taps = taps.filter((t) => now - t < 2000).concat(now);
    if (taps.length >= 5) { taps = []; toggle(); }
  });
  // ou « remi » au clavier
  let typed = '';
  addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-4);
    if (typed === 'remi') { typed = ''; toggle(); }
  });
  // le bouton son coupe aussi DJ Rémi
  muteBtn.addEventListener('click', () => { song.muted = music.muted; });
}
