// Devtober J2 · Loop — « Gratte la Boucle » : un jeu de tickets à gratter incrémental, en Phaser 3.
// La boucle : acheter → gratter → gagner → racheter… puis « Recommencer la boucle » pour un bonus permanent.

const W = 960, H = 540;
const FONT = '"Pixelify Sans", monospace';
const SAVE_KEY = 'devtober-j2-gratte-la-boucle';

/* ======================= Données du jeu ======================= */

// Symboles dessinés en pixel art (palette Arne16 de Phaser : 3 rouge, 4 rose, 7 orange, 8 jaune, A vert, E bleu…)
const SYMBOLS = [
  { key: 'coin',  name: 'Pièce',   value: 2,  data: ['..8888..', '.888888.', '88866888', '88688888', '88688888', '88866888', '.888888.', '..8888..'] },
  { key: 'ring',  name: 'Anneau',  value: 3,  data: ['..EEEE..', '.EFFFFE.', 'EF....EE', 'E......E', 'E......E', 'EE....EE', '.EEEEEE.', '..EEEE..'] },
  { key: 'arrow', name: 'Retour',  value: 5,  data: ['..AAA.A.', '.A...AA.', 'A...AAA.', 'A.......', 'A......A', 'A......A', '.A....A.', '..AAAA..'] },
  { key: 'star',  name: 'Étoile',  value: 10, data: ['...77...', '...77...', '77777777', '.777777.', '..7777..', '.77..77.', '77....77', '........'] },
  { key: 'loop',  name: 'Infini',  value: 20, data: ['........', '........', '.44..44.', '4..44..4', '4..44..4', '.44..44.', '........', '........'] },
];
const LOOP_SYMBOL = 4; // ∞∞∞ = le ticket se rejoue gratuitement

const TICKETS = [
  { id: 'petite', name: 'Petite Boucle', cost: 1,   mult: 1,  win: 0.32, weights: [45, 28, 15, 9, 3],   color: 0x6fc3df },
  { id: 'grande', name: 'Grande Boucle', cost: 10,  mult: 10, win: 0.30, weights: [45, 28, 15, 9, 3],   color: 0xe0b44c },
  { id: 'ouro',   name: 'Ouroboros',     cost: 100, mult: 80, win: 0.40, weights: [30, 25, 15, 10, 20], color: 0xd65a7a, minLoop: 2 },
];

const UPGRADES = [
  { id: 'brush', name: 'Grattoir XL',  desc: 'Gratte plus large',      base: 8,  growth: 2.0, max: 5 },
  { id: 'luck',  name: 'Trèfle',       desc: '+4 % de chance de gain', base: 15, growth: 2.2, max: 8 },
  { id: 'bot',   name: 'Gratt-o-bot',  desc: 'Achète et gratte seul',  base: 40, growth: 1,   max: 1 },
  { id: 'turbo', name: 'Bot turbo',    desc: 'Le robot va plus vite',  base: 60, growth: 2.0, max: 5, needs: 'bot' },
];

const PRESTIGE_MIN = 1000; // gains de la boucle nécessaires pour recommencer

// Petites phrases en bas de l'écran : la boucle te garde (doucement)
const TICKER = [
  [0, 'Un petit ticket, pour voir.'],
  [3, 'Encore un. Juste un.'],
  [10, 'Acheter, gratter, recommencer. Tu connais la chanson.'],
  [25, 'Le grattoir commence à chauffer.'],
  [50, 'Il est quelle heure, au fait ?'],
  [100, 'Cent tickets. La boucle te remercie.'],
  [250, 'Tu pourrais arrêter. Tu ne vas pas arrêter.'],
];

/* ======================= Sauvegarde ======================= */

const fresh = () => ({
  money: 5, earned: 0, tickets: 0, loop: 1, points: 0, time: 0,
  lv: { brush: 0, luck: 0, bot: 0, turbo: 0 }, botOn: true, botTicket: 'petite', totalTickets: 0,
});
function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(SAVE_KEY)) }; } catch { return fresh(); }
}
function save(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* navigation privée */ } }

const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + ' M' : n >= 1e4 ? (n / 1e3).toFixed(1) + ' k' : Math.floor(n).toString()) + ' €';
const costOf = (u, lv) => Math.round(u.base * Math.pow(u.growth, lv));
const bonusOf = (s) => 1 + s.points * 0.1;

/* ======================= Son (Web Audio, rien à charger) ======================= */

const Sfx = {
  ctx: null, noise: null, lastScratch: 0,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = this.ctx.sampleRate * 0.2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  },
  scratch() {
    const now = performance.now();
    if (!this.ctx || now - this.lastScratch < 45) return;
    this.lastScratch = now;
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noise;
    f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 2500; f.Q.value = 1.2;
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t, Math.random() * 0.1, 0.07);
  },
  tone(freq, start, dur, vol = 0.12, type = 'square') {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime + start;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  buy() { this.tone(660, 0, 0.08); this.tone(990, 0.06, 0.1); },
  reveal() { this.tone(520 + Math.random() * 80, 0, 0.05, 0.06); },
  win(big) { (big ? [523, 659, 784, 1047, 1319] : [523, 659, 784]).forEach((f, i) => this.tone(f, i * 0.08, 0.18, 0.1)); },
  lose() { [330, 262].forEach((f, i) => this.tone(f, i * 0.12, 0.2, 0.08, 'triangle')); },
  loop() { [392, 523, 659, 784, 659, 523, 392].forEach((f, i) => this.tone(f, i * 0.06, 0.12, 0.09)); },
};

/* ======================= La scène ======================= */

class Game extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    this.s = load();
    this.ticket = null;     // ticket en cours
    this.bot = null;        // déplacement du robot
    this.makeTextures();
    this.drawBackground();
    this.buildHeader();
    this.buildTicketArea();
    this.buildShop();

    // grattage à la souris / au doigt
    this.last = null;
    this.input.on('pointerdown', (p) => { Sfx.init(); this.last = { x: p.x, y: p.y }; this.scratchAt(p.x, p.y, this.brushR()); });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || !this.last) return;
      this.scratchLine(this.last.x, this.last.y, p.x, p.y, this.brushR());
      this.last = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => { this.last = null; });

    this.time.addEvent({ delay: 1000, loop: true, callback: () => { this.s.time++; } });
    this.time.addEvent({ delay: 3000, loop: true, callback: () => save(this.s) });
    this.refresh();
    this.showEmptyTicket();
  }

  /* ---------- Textures générées (pas d'image à charger) ---------- */
  makeTextures() {
    for (const sym of SYMBOLS) this.textures.generate(sym.key, { data: sym.data, pixelWidth: 6 });
    this.textures.generate('robot', { pixelWidth: 4, data: [
      '...EE...', '..EEEE..', '.E2EE2E.', '.EEEEEE.', '..1111..', '.E1111E.', 'E.1111.E', '..1..1..'] });

    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // feuille argentée à gratter, avec un grain pixel
    g.fillStyle(0xb9bfd0); g.fillRect(0, 0, 304, 286);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle([0xa3a9bb, 0xcfd4e2, 0x9097ab, 0xdfe3ee][i % 4]);
      g.fillRect(Math.floor(Math.random() * 76) * 4, Math.floor(Math.random() * 72) * 4, 4, 4);
    }
    g.generateTexture('foil', 304, 286); g.clear();
    // masque d'une case entière (pour finir de la découvrir d'un coup)
    g.fillStyle(0xffffff); g.fillRect(0, 0, 96, 90); g.generateTexture('cellmask', 96, 90); g.clear();
    // pinceaux ronds pixelisés, un par taille
    for (const r of [14, 20, 26, 32, 38, 44]) {
      for (let y = -r; y < r; y += 2) for (let x = -r; x < r; x += 2) if (x * x + y * y < r * r) { g.fillStyle(0xffffff); g.fillRect(x + r, y + r, 2, 2); }
      g.generateTexture('brush' + r, r * 2, r * 2); g.clear();
    }
    g.destroy();
  }

  drawBackground() {
    const g = this.add.graphics();
    g.fillStyle(0x14172b); g.fillRect(0, 0, W, H);
    g.fillStyle(0x1b2040);
    for (let y = 0; y < H; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < W; x += 32) g.fillRect(x, y, 16, 16);
    // panneau boutique
    g.fillStyle(0x0f1222, 0.9); g.fillRoundedRect(592, 60, 352, 466, 10);
    g.lineStyle(2, 0x343b66); g.strokeRoundedRect(592, 60, 352, 466, 10);
  }

  /* ---------- En-tête : argent, boucle ---------- */
  buildHeader() {
    this.add.text(24, 18, 'GRATTE LA BOUCLE', { fontFamily: FONT, fontSize: 20, fontStyle: '700', color: '#ffd166' });
    this.moneyText = this.add.text(300, 30, '', { fontFamily: FONT, fontSize: 30, fontStyle: '700', color: '#ffffff' }).setOrigin(0.5);
    this.loopText = this.add.text(936, 18, '', { fontFamily: FONT, fontSize: 16, color: '#c9cdf2', align: 'right' }).setOrigin(1, 0);
    this.ticker = this.add.text(300, 520, '', { fontFamily: FONT, fontSize: 14, color: '#8a90b8' }).setOrigin(0.5);
  }

  /* ---------- Le ticket ---------- */
  buildTicketArea() {
    this.tx = 130; this.ty = 70;               // coin du ticket (340 x 430)
    this.gx = this.tx + 18; this.gy = this.ty + 70; // coin de la grille 3x3 (304 x 286)
    this.ticketBg = this.add.graphics();
    this.ticketTitle = this.add.text(this.tx + 170, this.ty + 34, '', { fontFamily: FONT, fontSize: 24, fontStyle: '700', color: '#2b2140' }).setOrigin(0.5);
    this.ticketFoot = this.add.text(this.tx + 170, this.ty + 386, '', { fontFamily: FONT, fontSize: 13, color: '#4a4060', align: 'center' }).setOrigin(0.5);
    this.cells = [];
    for (let i = 0; i < 9; i++) {
      const cx = this.gx + (i % 3) * 104, cy = this.gy + Math.floor(i / 3) * 98;
      const img = this.add.image(cx + 48, cy + 38, 'coin').setVisible(false);
      const val = this.add.text(cx + 48, cy + 76, '', { fontFamily: FONT, fontSize: 12, color: '#4a4060' }).setOrigin(0.5);
      this.cells.push({ x: cx, y: cy, img, val });
    }
    this.cover = this.add.renderTexture(this.gx, this.gy, 304, 286).setOrigin(0);
    this.coverLabel = this.add.text(0, 0, 'GRATTE-MOI', { fontFamily: FONT, fontSize: 28, fontStyle: '700', color: '#8e95ad' }).setVisible(false);
    this.botSprite = this.add.image(0, 0, 'robot').setVisible(false).setDepth(5);
    this.overlay = this.add.text(this.tx + 170, this.gy + 143, '', {
      fontFamily: FONT, fontSize: 18, fontStyle: '700', color: '#ffffff', align: 'center', backgroundColor: '#14172bdd', padding: { x: 14, y: 10 },
    }).setOrigin(0.5).setDepth(6).setVisible(false);
  }

  drawTicketFrame(type) {
    const g = this.ticketBg;
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillRoundedRect(this.tx + 6, this.ty + 8, 340, 430, 14);
    g.fillStyle(0xfff4dc); g.fillRoundedRect(this.tx, this.ty, 340, 430, 14);
    g.fillStyle(type ? type.color : 0x8a90b8); g.fillRoundedRect(this.tx, this.ty, 340, 62, { tl: 14, tr: 14, bl: 0, br: 0 });
    g.lineStyle(4, 0x2b2140); g.strokeRoundedRect(this.tx, this.ty, 340, 430, 14);
    // cases
    for (const c of this.cells) { g.fillStyle(0xffffff); g.fillRoundedRect(c.x, c.y, 96, 90, 8); g.lineStyle(2, 0xe2d6bd); g.strokeRoundedRect(c.x, c.y, 96, 90, 8); }
    // dents du ticket
    g.fillStyle(0x14172b);
    for (let y = this.ty + 20; y < this.ty + 420; y += 22) { g.fillCircle(this.tx, y, 5); g.fillCircle(this.tx + 340, y, 5); }
  }

  showEmptyTicket() {
    this.drawTicketFrame(null);
    this.ticketTitle.setText('?');
    this.ticketFoot.setText('Achète un ticket à droite →');
    this.cells.forEach((c) => { c.img.setVisible(false); c.val.setText(''); });
    this.resetCover();
  }

  resetCover() {
    this.cover.clear();
    this.cover.draw('foil', 0, 0);
    this.coverLabel.setVisible(true);
    this.cover.draw(this.coverLabel, 152 - this.coverLabel.width / 2, 143 - this.coverLabel.height / 2);
    this.coverLabel.setVisible(false);
  }

  /** Tire les 9 symboles d'un ticket (gagnant ou non selon la chance). */
  roll(type) {
    const winChance = type.win + this.s.lv.luck * 0.04;
    const pickWeighted = () => {
      const total = type.weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      return type.weights.findIndex((w) => (r -= w) < 0);
    };
    const grid = new Array(9).fill(-1);
    const count = new Array(SYMBOLS.length).fill(0);
    if (Math.random() < winChance) {
      const s = pickWeighted();
      Phaser.Utils.Array.Shuffle([...Array(9).keys()]).slice(0, 3).forEach((i) => { grid[i] = s; });
      count[s] = 3;
    }
    for (let i = 0; i < 9; i++) {
      if (grid[i] >= 0) continue;
      let s, guard = 0;
      do { s = pickWeighted(); guard++; } while ((count[s] >= 2) && guard < 50);
      if (count[s] >= 2) s = count.findIndex((n) => n < 2);
      grid[i] = s; count[s]++;
    }
    return grid;
  }

  buy(type) {
    if (this.ticket && !this.ticket.done) return this.flash('Finis d\'abord ce ticket !');
    if (this.s.money < type.cost) return this.flash('Pas assez d\'argent…');
    Sfx.init(); Sfx.buy();
    this.s.money -= type.cost;
    this.s.tickets++; this.s.totalTickets++;
    this.s.botTicket = type.id;
    this.startTicket(type);
    this.refresh();
  }

  startTicket(type, replay = false) {
    const grid = this.roll(type);
    this.ticket = {
      type, grid, done: false, revealed: new Array(9).fill(false),
      // 16 points de contrôle par case : une case est découverte quand 65 % sont grattés
      hits: this.cells.map(() => new Array(16).fill(false)),
    };
    this.drawTicketFrame(type);
    this.ticketTitle.setText(replay ? 'ÇA REBOUCLE !' : type.name.toUpperCase());
    this.ticketFoot.setText('3 symboles identiques = gain\n∞ ∞ ∞ = le ticket se rejoue gratuitement');
    this.cells.forEach((c, i) => {
      const sym = SYMBOLS[grid[i]];
      c.img.setTexture(sym.key).setVisible(true).setScale(1).setAlpha(1);
      c.val.setText(fmt(sym.value * type.mult * bonusOf(this.s)));
    });
    this.overlay.setVisible(false);
    this.resetCover();
  }

  brushR() { return [14, 20, 26, 32, 38, 44][this.s.lv.brush]; }

  scratchLine(x1, y1, x2, y2, r) {
    const d = Phaser.Math.Distance.Between(x1, y1, x2, y2), steps = Math.max(1, Math.ceil(d / (r * 0.4)));
    for (let i = 1; i <= steps; i++) this.scratchAt(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, r);
  }

  scratchAt(x, y, r, silent = false) {
    const t = this.ticket;
    if (!t || t.done) return;
    const lx = x - this.gx, ly = y - this.gy;
    if (lx < -r || ly < -r || lx > 304 + r || ly > 286 + r) return;
    this.cover.erase('brush' + r, lx - r, ly - r);
    if (!silent) Sfx.scratch();
    this.cells.forEach((c, i) => {
      if (t.revealed[i]) return;
      const ox = c.x - this.gx, oy = c.y - this.gy;
      let changed = false;
      for (let k = 0; k < 16; k++) {
        if (t.hits[i][k]) continue;
        const px = ox + 12 + (k % 4) * 24, py = oy + 11 + Math.floor(k / 4) * 22.5;
        if ((px - lx) ** 2 + (py - ly) ** 2 < r * r) { t.hits[i][k] = true; changed = true; }
      }
      if (changed && t.hits[i].filter(Boolean).length >= 11) this.revealCell(i);
    });
  }

  revealCell(i) {
    const t = this.ticket, c = this.cells[i];
    t.revealed[i] = true;
    this.cover.erase('cellmask', c.x - this.gx, c.y - this.gy);
    Sfx.reveal();
    this.tweens.add({ targets: c.img, scale: { from: 1.3, to: 1 }, duration: 180, ease: 'Back.Out' });
    if (t.revealed.every(Boolean)) this.time.delayedCall(250, () => this.resolve());
  }

  /** Ticket entièrement gratté : on paie, et ∞∞∞ relance la boucle. */
  resolve() {
    const t = this.ticket;
    if (t.done) return;
    t.done = true;
    this.cover.clear();
    const count = new Array(SYMBOLS.length).fill(0);
    t.grid.forEach((s) => count[s]++);
    let gain = 0, looped = false;
    count.forEach((n, s) => {
      if (n < 3) return;
      gain += SYMBOLS[s].value * t.type.mult * bonusOf(this.s);
      if (s === LOOP_SYMBOL) looped = true;
      this.cells.forEach((c, i) => {
        if (t.grid[i] === s) this.tweens.add({ targets: c.img, scale: 1.35, yoyo: true, repeat: 3, duration: 160 });
      });
    });
    this.cells.forEach((c, i) => { if (count[t.grid[i]] < 3) c.img.setAlpha(0.35); });

    if (gain > 0) {
      this.s.money += gain; this.s.earned += gain;
      Sfx.win(gain >= t.type.cost * 5);
      this.floatText(`+${fmt(gain)}`, this.tx + 170, this.gy + 143, '#ffd166');
      if (gain >= t.type.cost * 10) this.cameras.main.shake(200, 0.006);
    } else {
      Sfx.lose();
      this.showOverlay('Perdu…');
    }
    this.refresh();
    save(this.s);

    if (looped) {
      // le cœur du thème : le ticket se rejoue lui-même
      this.time.delayedCall(900, () => {
        Sfx.loop();
        this.showOverlay('∞ ∞ ∞\nLE TICKET REBOUCLE !');
        this.cameras.main.flash(250, 255, 120, 180);
        this.time.delayedCall(1100, () => this.startTicket(t.type, true));
      });
    } else if (this.s.lv.bot && this.s.botOn) {
      this.time.delayedCall(900, () => this.botBuy());
    }
  }

  /* ---------- Le robot ---------- */
  botBuy() {
    if (!this.s.lv.bot || !this.s.botOn || (this.ticket && !this.ticket.done)) return;
    const type = TICKETS.find((x) => x.id === this.s.botTicket) ?? TICKETS[0];
    const pick = this.s.money >= type.cost ? type : TICKETS.filter((x) => x.cost <= this.s.money && this.unlocked(x)).pop();
    if (!pick) return;
    this.buy(pick);
  }

  botPath() {
    // aller-retour sur chaque rangée, deux passages par rangée
    const pts = [];
    for (let row = 0; row < 3; row++) {
      const cy = this.gy + row * 98 + 45;
      pts.push([this.gx - 10, cy - 18], [this.gx + 314, cy - 18], [this.gx + 314, cy + 18], [this.gx - 10, cy + 18]);
    }
    return pts;
  }

  update(_, dt) {
    const t = this.ticket;
    if (this.s.lv.bot && this.s.botOn && t && !t.done) {
      if (!this.bot || this.bot.ticket !== t) this.bot = { ticket: t, path: this.botPath(), i: 0, x: this.gx - 10, y: this.gy + 27 };
      const b = this.bot, target = b.path[b.i];
      if (target) {
        const speed = 260 * (1 + 0.6 * this.s.lv.turbo) * dt / 1000;
        const dx = target[0] - b.x, dy = target[1] - b.y, d = Math.hypot(dx, dy);
        const nx = d <= speed ? target[0] : b.x + dx / d * speed, ny = d <= speed ? target[1] : b.y + dy / d * speed;
        this.scratchLine(b.x, b.y, nx, ny, 26);
        b.x = nx; b.y = ny;
        if (d <= speed) b.i++;
        this.botSprite.setVisible(true).setPosition(b.x, b.y - 22);
      }
    } else this.botSprite.setVisible(false);
  }

  /* ---------- Boutique ---------- */
  unlocked(type) { return !type.minLoop || this.s.loop >= type.minLoop; }

  buildShop() {
    const label = (y, txt) => this.add.text(612, y, txt, { fontFamily: FONT, fontSize: 14, fontStyle: '700', color: '#8a90b8' });
    label(72, 'TICKETS');
    this.ticketBtns = TICKETS.map((type, i) => this.button(612, 94 + i * 52, 312, 44, () => this.buy(type)));
    label(254, 'AMÉLIORATIONS');
    this.upBtns = UPGRADES.map((u, i) => this.button(612, 276 + i * 52, 312, 44, () => this.buyUpgrade(u)));
    this.prestigeBtn = this.button(612, 486, 312, 30, () => this.prestige(), 0x4b2a5c);
  }

  button(x, y, w, h, onClick, fill = 0x232a52) {
    const bg = this.add.rectangle(x, y, w, h, fill).setOrigin(0).setStrokeStyle(2, 0x3e4785).setInteractive({ useHandCursor: true });
    const title = this.add.text(x + 12, y + (h > 34 ? 6 : 6), '', { fontFamily: FONT, fontSize: 15, fontStyle: '700', color: '#ffffff' });
    const sub = this.add.text(x + 12, y + 24, '', { fontFamily: FONT, fontSize: 12, color: '#9aa0cc' });
    const price = this.add.text(x + w - 12, y + h / 2, '', { fontFamily: FONT, fontSize: 15, fontStyle: '700', color: '#ffd166' }).setOrigin(1, 0.5);
    const btn = { bg, title, sub, price, fill, enabled: true };
    bg.on('pointerover', () => btn.enabled && bg.setFillStyle(0x323c75));
    bg.on('pointerout', () => bg.setFillStyle(btn.fill));
    bg.on('pointerdown', (p, lx, ly, e) => { e.stopPropagation(); Sfx.init(); if (btn.enabled) { this.tweens.add({ targets: [bg], scaleY: 0.94, yoyo: true, duration: 60 }); onClick(); } });
    return btn;
  }

  setBtn(btn, { title, sub = '', price = '', enabled = true }) {
    btn.title.setText(title); btn.sub.setText(sub); btn.price.setText(price);
    btn.enabled = enabled;
    const a = enabled ? 1 : 0.45;
    [btn.bg, btn.title, btn.sub, btn.price].forEach((o) => o.setAlpha(a));
  }

  buyUpgrade(u) {
    const lv = this.s.lv[u.id];
    if (u.id === 'bot' && lv) { this.s.botOn = !this.s.botOn; this.refresh(); if (this.s.botOn) this.botBuy(); return; }
    const cost = costOf(u, lv);
    if (lv >= u.max || this.s.money < cost || (u.needs && !this.s.lv[u.needs])) return;
    this.s.money -= cost; this.s.lv[u.id]++;
    Sfx.buy();
    this.floatText(`${u.name} !`, 768, 300, '#9ee6a8');
    this.refresh(); save(this.s);
    if (u.id === 'bot') this.botBuy();
  }

  /* ---------- Recommencer la boucle (prestige) ---------- */
  prestigeGain() { return Math.floor(Math.sqrt(this.s.earned / 100)); }

  prestige() {
    if (this.s.earned < PRESTIGE_MIN) return;
    const pts = this.prestigeGain();
    const keep = { loop: this.s.loop + 1, points: this.s.points + pts, totalTickets: this.s.totalTickets, time: this.s.time };
    this.s = { ...fresh(), ...keep };
    this.ticket = null; this.bot = null;
    save(this.s);
    Sfx.loop();
    this.cameras.main.fadeOut(400, 20, 23, 43);
    this.time.delayedCall(450, () => {
      this.cameras.main.fadeIn(600, 20, 23, 43);
      this.showEmptyTicket();
      this.refresh();
      this.flash(`Boucle n°${this.s.loop} : tout recommence, +${pts * 10} % de gains pour toujours.`, 4000);
    });
  }

  /* ---------- Affichage ---------- */
  refresh() {
    const s = this.s;
    this.moneyText.setText(fmt(s.money));
    this.loopText.setText(`Boucle n°${s.loop}\nBonus +${Math.round((bonusOf(s) - 1) * 100)} %`);
    TICKETS.forEach((type, i) => {
      const ok = this.unlocked(type);
      this.setBtn(this.ticketBtns[i], ok
        ? { title: type.name, sub: `Gains x${type.mult}${type.id === 'ouro' ? ', beaucoup de ∞' : ''}`, price: fmt(type.cost), enabled: s.money >= type.cost }
        : { title: type.name, sub: `Débloqué à la boucle n°${type.minLoop}`, price: '', enabled: false });
      this.ticketBtns[i].bg.setStrokeStyle(2, ok ? type.color : 0x3e4785);
    });
    UPGRADES.forEach((u, i) => {
      const lv = s.lv[u.id], btn = this.upBtns[i];
      if (u.id === 'bot' && lv) return this.setBtn(btn, { title: `Gratt-o-bot : ${s.botOn ? 'ON' : 'OFF'}`, sub: 'Clique pour l\'allumer ou l\'éteindre', price: '' });
      if (u.needs && !s.lv[u.needs]) return this.setBtn(btn, { title: u.name, sub: `Nécessite ${UPGRADES.find((x) => x.id === u.needs).name}`, enabled: false });
      if (lv >= u.max) return this.setBtn(btn, { title: `${u.name} (max)`, sub: u.desc, enabled: false });
      const cost = costOf(u, lv);
      this.setBtn(btn, { title: u.max > 1 ? `${u.name} niv. ${lv + 1}` : u.name, sub: u.desc, price: fmt(cost), enabled: s.money >= cost });
    });
    const canP = s.earned >= PRESTIGE_MIN;
    this.setBtn(this.prestigeBtn, canP
      ? { title: `Recommencer la boucle (+${this.prestigeGain() * 10} %)`, enabled: true }
      : { title: `Recommencer la boucle : ${fmt(s.earned)} / ${fmt(PRESTIGE_MIN)}`, enabled: false });
    this.prestigeBtn.title.setFontSize(14);

    const line = [...TICKER].reverse().find(([n]) => s.tickets >= n);
    if (!this.flashing) this.ticker.setText(s.loop > 1 && s.tickets < 3 ? 'Tout recommence. Mais en mieux, non ?' : line[1]);
  }

  flash(msg, ms = 1600) {
    this.flashing = true;
    this.ticker.setText(msg).setColor('#ffd166');
    this.time.delayedCall(ms, () => { this.flashing = false; this.ticker.setColor('#8a90b8'); this.refresh(); });
  }

  showOverlay(msg) {
    this.overlay.setText(msg).setVisible(true).setScale(0.6);
    this.tweens.add({ targets: this.overlay, scale: 1, duration: 220, ease: 'Back.Out' });
  }

  floatText(msg, x, y, color) {
    const t = this.add.text(x, y, msg, { fontFamily: FONT, fontSize: 28, fontStyle: '700', color, stroke: '#14172b', strokeThickness: 6 }).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1300, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }
}

/* ======================= Lancement ======================= */
document.fonts.load(`700 20px ${FONT}`).finally(() => {
  document.getElementById('loading').remove();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W, height: H,
    backgroundColor: '#14172b',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: Game,
  });
});
