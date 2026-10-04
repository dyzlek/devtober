// Bloom · la musique : un morceau électro (124 BPM) joué en direct avec Web Audio.
// Il sert aussi d'horloge : toute la boîte de nuit danse sur ses temps.
// Plus l'ambiance monte, plus il y a d'instruments (le morceau « éclot » lui aussi).

export const BPM = 124;
const SPB = 60 / BPM;                      // secondes par temps
const ROOTS = [55, 43.65, 65.41, 49];      // la, fa, do, sol (graves) : une mesure chacune
const CHORDS = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];

export class Music {
  constructor() {
    this.ctx = null;
    this.hype = 0;          // 0..100, fixé par le jeu
    this.drop = false;      // pendant le drop : tout à fond
    this.muted = false;
    this.started = false;
  }

  /** À appeler sur un clic (les navigateurs exigent un geste pour lancer le son). */
  start() {
    if (this.started) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const c = this.ctx;
    this.out = c.createGain(); this.out.gain.value = this.muted || this.override ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.out.connect(comp).connect(c.destination);
    // un filtre général qui s'ouvre avec l'ambiance (son étouffé au début, brillant à la fin)
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 900;
    this.filter.connect(this.out);
    this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.t0 = c.currentTime + 0.1;   // l'instant du tout premier temps
    this.next = 0;                    // prochain double-croche à programmer
    this.started = true;
    c.resume?.();
    document.addEventListener('pointerdown', () => { if (c.state !== 'running') c.resume(); });
    this.timer = setInterval(() => this.schedule(), 25);
  }

  /** Arrête le morceau (fin de la partie). */
  stop() { clearInterval(this.timer); this.timer = null; this.drop = false; }

  /** Relance le morceau depuis le début (nouvelle partie). */
  restart() {
    if (!this.started) return this.start();
    this.stop();
    this.t0 = this.ctx.currentTime + 0.15;
    this.next = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  setMuted(m) {
    this.muted = m;
    this.applyGain();
  }
  /** Easter egg : une autre musique joue à la place (le morceau continue, sans le son, pour garder le tempo). */
  setOverride(on) {
    this.override = on;
    this.applyGain();
  }
  applyGain() {
    if (this.out) this.out.gain.setTargetAtTime(this.muted || this.override ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Temps écoulé en « temps musicaux » (1 = un temps), basé sur l'horloge audio. */
  beats() {
    if (!this.started) return performance.now() / 1000 / SPB;
    return (this.ctx.currentTime - this.t0) / SPB;
  }

  /** Écart (en secondes) entre maintenant et le temps le plus proche, pour juger un tap. */
  offset() {
    const b = this.beats();
    return (b - Math.round(b)) * SPB;
  }

  /** Programme les notes un peu à l'avance (méthode « lookahead »). */
  schedule() {
    const c = this.ctx, ahead = c.currentTime + 0.12;
    const f = 400 + (this.drop ? 9000 : this.hype * 90);
    this.filter.frequency.setTargetAtTime(f, c.currentTime, 0.3);
    while (this.t0 + this.next * SPB / 4 < ahead) {
      this.step(this.next, this.t0 + this.next * SPB / 4);
      this.next++;
    }
  }

  step(n, t) {
    const h = this.drop ? 100 : this.hype;
    const beat = Math.floor(n / 4), sub = n % 4, bar = Math.floor(beat / 4) % 4, inBar = beat % 4;
    const root = ROOTS[bar];
    if (sub === 0) this.kick(t);
    if (h > 12 && sub === 2) this.hat(t, 0.16);
    if (h > 45 && sub % 2 === 1) this.hat(t, 0.05);
    if (h > 28 && sub === 0 && inBar % 2 === 1) this.clap(t);
    if (h > 5 && sub % 2 === 0) this.bass(t, root * (sub === 2 ? 2 : 1), SPB / 2.2, h);
    if (h > 55 && sub === 2) this.stab(t, root * 4, CHORDS[bar]);
    if (h > 78) this.arp(t, root * 8, CHORDS[bar][n % 3] + (Math.floor(n / 3) % 2) * 12);
  }

  /* ---------- les instruments ---------- */
  env(node, t, vol, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g);
    return g;
  }
  kick(t) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(o, t, 1, 0.3).connect(this.out);   // le kick ne passe pas dans le filtre : toujours présent
    o.start(t); o.stop(t + 0.32);
  }
  noise(t, vol, dur, type, freq) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
    s.connect(f);
    this.env(f, t, vol, dur).connect(this.filter);
    s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  /** La foule qui crie et applaudit (combo 50, 100…). */
  cheer() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(t, 0.28, 1.4, 'bandpass', 1100);
    for (let k = 0; k < 18; k++) this.noise(t + Math.random() * 1.1, 0.12 + Math.random() * 0.1, 0.08, 'bandpass', 1400 + Math.random() * 900);
  }
  hat(t, vol) { this.noise(t, vol, 0.05, 'highpass', 7000); }
  clap(t) { [0, 0.012, 0.024].forEach((d) => this.noise(t + d, 0.35, 0.14, 'bandpass', 1500)); }
  bass(t, f, dur, h) {
    const o = this.ctx.createOscillator(), lp = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(300 + h * 12, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    o.connect(lp);
    this.env(lp, t, 0.35, dur).connect(this.filter);
    o.start(t); o.stop(t + dur + 0.02);
  }
  stab(t, f, chord) {
    chord.forEach((semi) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f * 2 ** (semi / 12);
      this.env(o, t, 0.08, 0.22).connect(this.filter);
      o.start(t); o.stop(t + 0.25);
    });
  }
  arp(t, f, semi) {
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = f * 2 ** (semi / 12);
    this.env(o, t, 0.035, 0.11).connect(this.filter);
    o.start(t); o.stop(t + 0.12);
  }

  /* ---------- petits effets ---------- */
  riser() {   // la montée avant le drop
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + SPB * 8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + SPB * 8); g.gain.exponentialRampToValueAtTime(0.0001, t + SPB * 8 + 0.1);
    s.connect(f).connect(g).connect(this.out); s.start(t); s.stop(t + SPB * 8 + 0.2);
  }
  blip(ok) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = ok ? 1320 : 220;
    this.env(o, t, 0.08, 0.08).connect(this.out);
    o.start(t); o.stop(t + 0.1);
  }
}

export const SECONDS_PER_BEAT = SPB;
