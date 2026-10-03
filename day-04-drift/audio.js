// Drift · tout le son est fabriqué en direct (Web Audio) : moteur, crissement des pneus, turbo, musique de course.
const BPM = 150;
const STEP = 60 / BPM / 4;   // une double-croche
// grille d'accords (I – vi – IV – V), puis un pont
const PROG = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [2, 5, 9], [7, 11, 14]];
// le motif de la mélodie (indices dans l'accord, null = silence), sur 16 doubles-croches
const LEAD = [
  [0, null, 1, null, 2, null, 1, 2, null, 2, 3, null, 2, null, 1, null],
  [2, null, 1, null, 0, null, 1, null, 2, 3, null, 2, 1, null, 0, null],
];

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.playing = false;
    this.tempo = 1;
    this.key = 0;
  }

  /** Le navigateur n'autorise le son qu'après un geste de l'utilisateur. */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const c = this.ctx = new AudioContext();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);

    // bruit blanc (pneus, souffle, caisse claire)
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // le moteur : deux oscillateurs filtrés, la hauteur suit la vitesse
    this.engA = c.createOscillator(); this.engA.type = 'sawtooth';
    this.engB = c.createOscillator(); this.engB.type = 'square';
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 600;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    const bG = c.createGain(); bG.gain.value = 0.5;
    this.engA.connect(this.engF); this.engB.connect(bG).connect(this.engF);
    this.engF.connect(this.engG).connect(this.sfxBus);
    this.engA.start(); this.engB.start();

    // les pneus qui crissent pendant le dérapage
    this.skid = c.createBufferSource(); this.skid.buffer = this.noise; this.skid.loop = true;
    this.skidF = c.createBiquadFilter(); this.skidF.type = 'bandpass'; this.skidF.frequency.value = 1800; this.skidF.Q.value = 3;
    this.skidG = c.createGain(); this.skidG.gain.value = 0;
    this.skid.connect(this.skidF).connect(this.skidG).connect(this.sfxBus);
    this.skid.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  /** Appelé à chaque image : le moteur et les pneus du joueur. */
  engine(speed, drifting, level, boost, on = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 48 + speed * 4.2 + (boost ? 40 : 0);
    this.engA.frequency.setTargetAtTime(f, t, 0.05);
    this.engB.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engF.frequency.setTargetAtTime(400 + speed * 40, t, 0.08);
    this.engG.gain.setTargetAtTime(on ? 0.07 + Math.min(speed, 40) * 0.0016 : 0, t, 0.1);
    this.skidG.gain.setTargetAtTime(on && drifting ? 0.07 : 0, t, 0.04);
    this.skidF.frequency.setTargetAtTime(1500 + level * 450, t, 0.05);
  }

  tone(freq, dur, { type = 'square', vol = 0.2, at = 0, slide = 0, bus = this.sfxBus } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = (at || c.currentTime);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  hiss(dur, { vol = 0.3, freq = 1200, to = 4000, at = 0, q = 1, bus = this.sfxBus } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, t = at || c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /* ---------- effets ---------- */
  hop() { this.tone(300, 0.12, { type: 'triangle', vol: 0.25, slide: 2 }); }
  level(n) { this.tone([0, 880, 1175, 1568][n], 0.14, { type: 'triangle', vol: 0.22 }); }
  turbo(n = 1) { this.hiss(0.6 + n * 0.15, { vol: 0.45, freq: 500, to: 3500 }); this.tone(180, 0.5, { type: 'sawtooth', vol: 0.12, slide: 2.5 }); }
  pad() { this.turbo(1); this.tone(660, 0.1, { vol: 0.12 }); this.tone(990, 0.15, { vol: 0.12, at: this.ctx?.currentTime + 0.07 }); }
  bump() { this.tone(90, 0.25, { type: 'sine', vol: 0.6, slide: 0.5 }); this.hiss(0.15, { vol: 0.3, freq: 400, to: 200 }); }
  coin() { const t = this.ctx?.currentTime ?? 0; this.tone(988, 0.08, { vol: 0.12, at: t }); this.tone(1319, 0.25, { vol: 0.12, at: t + 0.07 }); }
  box() { const t = this.ctx?.currentTime ?? 0; for (let k = 0; k < 6; k++) this.tone(600 + k * 120, 0.06, { type: 'triangle', vol: 0.08, at: t + k * 0.13 }); }
  got() { this.tone(1175, 0.18, { type: 'triangle', vol: 0.14 }); }
  hit() { this.tone(700, 0.6, { type: 'sawtooth', vol: 0.1, slide: 0.25 }); this.hiss(0.3, { vol: 0.3, freq: 1500, to: 400 }); }
  star() { const t = this.ctx?.currentTime ?? 0; [0, 4, 7, 12, 7, 4].forEach((n, k) => this.tone(784 * 2 ** (n / 12), 0.12, { type: 'square', vol: 0.07, at: t + k * 0.08 })); }
  trick() { this.tone(500, 0.25, { type: 'triangle', vol: 0.18, slide: 2.2 }); this.hiss(0.25, { vol: 0.2, freq: 2000, to: 5000 }); }
  boom() { this.hiss(0.6, { vol: 0.35, freq: 300, to: 120, q: 0.6 }); this.tone(70, 0.4, { type: 'sine', vol: 0.4, slide: 0.5 }); }
  beep(go) { this.tone(go ? 880 : 440, go ? 0.7 : 0.25, { vol: 0.22 }); }
  select() { this.tone(660, 0.07, { vol: 0.12 }); this.tone(990, 0.09, { vol: 0.12, at: this.ctx?.currentTime + 0.06 }); }
  lap(final) {
    const t = this.ctx?.currentTime ?? 0;
    (final ? [784, 988, 1175, 1568] : [784, 1047]).forEach((f, i) => this.tone(f, 0.18, { vol: 0.16, at: t + i * 0.1 }));
  }
  fanfare(first) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    const notes = first ? [523, 659, 784, 1047, 784, 1047, 1319] : [523, 659, 784, 659, 523];
    notes.forEach((f, i) => this.tone(f, i === notes.length - 1 ? 0.9 : 0.2, { vol: 0.2, at: t + i * 0.14, type: 'square' }));
    notes.forEach((f, i) => this.tone(f / 2, 0.2, { vol: 0.12, at: t + i * 0.14, type: 'triangle' }));
  }

  /* ---------- musique (programmée un peu en avance, sur l'horloge audio) ---------- */
  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stopMusic() { this.playing = false; clearInterval(this.timer); }
  /** Le dernier tour : la musique accélère et monte d'un ton, comme dans les vrais jeux de kart. */
  finalLap() { this.tempo = 1.12; this.key = 1; }
  normal() { this.tempo = 1; this.key = 0; }

  schedule() {
    while (this.next < this.ctx.currentTime + 0.12) {
      this.play(this.step, this.next);
      this.next += STEP / this.tempo;
      this.step++;
    }
  }

  play(step, t) {
    const s = step % 16, bar = Math.floor(step / 16) % PROG.length;
    const chord = PROG[bar].map((n) => n + this.key);
    const hz = (n, oct) => 130.81 * 2 ** ((n + oct * 12) / 12);
    const bus = this.musicBus;
    // batterie
    if (s % 4 === 0) this.tone(150, 0.16, { type: 'sine', vol: 0.7, slide: 0.3, at: t, bus });
    if (s === 4 || s === 12) this.hiss(0.12, { vol: 0.35, freq: 2500, to: 1500, at: t, bus });
    if (s % 2 === 1) this.hiss(0.03, { vol: 0.12, freq: 8000, to: 9000, at: t, q: 0.5, bus });
    // basse qui saute d'octave
    if (s % 2 === 0) this.tone(hz(chord[0], -1) * (s % 4 ? 2 : 1), 0.12, { type: 'triangle', vol: 0.4, at: t, bus });
    // accords en contretemps
    if (s % 4 === 2) chord.forEach((n) => this.tone(hz(n, 1), 0.08, { type: 'square', vol: 0.035, at: t, bus }));
    // mélodie
    const k = LEAD[Math.floor(step / 64) % 2][s];
    if (k !== null && k !== undefined) {
      const n = k < 3 ? chord[k] + 12 : chord[0] + 24;
      this.tone(hz(n, 1), 0.13, { type: 'square', vol: 0.07, at: t, bus });
    }
  }
}
