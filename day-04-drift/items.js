// Drift · les boîtes à objets « ? », les objets (banane, carapace, champignon, étoile) et les pièces.
import * as THREE from 'three';
import { WALL } from './track.js?v=2';
import { EXPR } from '../day-01-pulse/mii3d.js?v=3';

export const ITEMS = ['banana', 'shell', 'mushroom', 'star'];
export const ITEM_NAMES = { banana: 'Banane', shell: 'Carapace', mushroom: 'Champignon', star: 'Étoile' };
const MAX_COINS = 10;
const BOX_ROWS = [0.2, 0.5, 0.79];                      // où sont les rangées de boîtes (fraction du tour)
const COIN_LINES = [[0.08, 3], [0.3, -3], [0.62, 2.5], [0.9, -2.5]];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const _v = new THREE.Vector3();

/** L'objet tiré dans une boîte dépend de la place : les derniers ont plus de chances d'avoir un bon objet. */
function roll(place) {
  const w = place <= 2 ? [5, 4, 1, 0] : place <= 5 ? [3, 3.5, 3, 0.5] : [1, 3, 4, 2];
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 4; i++) { r -= w[i]; if (r < 0) return ITEMS[i]; }
  return 'mushroom';
}

function canvasTex(size, draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Les modèles 3D des objets. */
function bananaMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.5 });
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.35, 0.15, 0), new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0.35, 0.18, 0));
  const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.12, 10), mat);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a1a }));
  tip.position.set(0.38, 0.22, 0); tip.rotation.z = -0.6;
  g.add(body, tip);
  g.scale.setScalar(1.3);
  return g;
}
function shellMesh() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2fbf4a, roughness: 0.35 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  rim.rotation.x = Math.PI / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.14, 18), new THREE.MeshStandardMaterial({ color: 0xfff3c4 }));
  base.position.y = -0.07;
  g.add(top, rim, base);
  return g;
}

export class Items {
  constructor(scene, track, fx, audio) {
    this.scene = scene; this.track = track; this.fx = fx; this.audio = audio;
    this.live = [];      // bananes et carapaces sur la piste
    this.onEvent = () => {};

    // les boîtes « ? » : un cube translucide arc-en-ciel avec un point d'interrogation
    const qTex = canvasTex(128, (g, S) => {
      g.clearRect(0, 0, S, S);
      g.font = '900 96px Nunito, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#7a3cff'; g.strokeText('?', S / 2, S / 2 + 6);
      g.fillStyle = '#ffffff'; g.fillText('?', S / 2, S / 2 + 6);
    });
    const boxGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    this.boxMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, roughness: 0.1, clearcoat: 1, emissive: 0x6a5cff, emissiveIntensity: 0.35 });
    const qMat = new THREE.MeshBasicMaterial({ map: qTex, transparent: true, depthWrite: false });
    this.boxes = [];
    for (const f of BOX_ROWS) {
      const i = Math.round(f * track.n);
      for (const off of [-4.5, -1.5, 1.5, 4.5]) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(boxGeo, this.boxMat));
        for (let s = 0; s < 4; s++) {   // le « ? » sur les quatre côtés
          const q = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), qMat);
          q.rotation.y = s * Math.PI / 2; q.translateZ(0.56); g.add(q);
        }
        g.position.copy(track.at(i, off)).setY(1.1);
        scene.add(g);
        this.boxes.push({ g, pos: g.position.clone(), back: 0 });
      }
    }

    // les pièces : des rangées de 5
    const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.6, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
    this.coins = [];
    for (const [f, off] of COIN_LINES) {
      const i0 = Math.round(f * track.n);
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(coinGeo, coinMat);
        m.position.copy(track.at(i0 + k * 8, off)).setY(0.75);
        scene.add(m);
        this.coins.push({ m, pos: m.position.clone(), back: 0 });
      }
    }
  }

  reset(karts) {
    for (const o of this.live) this.scene.remove(o.mesh);
    this.live = [];
    for (const b of this.boxes) { b.back = 0; b.g.visible = true; }
    for (const c of this.coins) { c.back = 0; c.m.visible = true; }
    for (const k of karts) { k.item = null; k.rolling = 0; k.coins = 0; k.starT = 0; k.spinT = 0; k.itemT = 0; }
  }

  /** Utilise l'objet d'un kart. */
  use(k) {
    if (!k.item || k.rolling > 0) return;
    const type = k.item; k.item = null;
    const f = k.forward(new THREE.Vector3());
    if (type === 'banana') {
      const mesh = bananaMesh();
      mesh.position.copy(k.root.position).addScaledVector(f, -1.9).setY(0.2);
      mesh.rotation.y = Math.random() * 6;
      this.scene.add(mesh);
      this.live.push({ type, mesh, owner: k, t: 0, idx: k.idx });
      this.audio.tone(500, 0.12, { type: 'triangle', vol: 0.15, slide: 0.6 });
    } else if (type === 'shell') {
      const mesh = shellMesh();
      mesh.position.copy(k.root.position).addScaledVector(f, 1.9).setY(0.45);
      this.scene.add(mesh);
      this.live.push({ type, mesh, owner: k, t: 0, idx: k.idx, heading: k.heading, speed: Math.max(46, k.speed + 16) });
      this.audio.tone(320, 0.2, { type: 'square', vol: 0.12, slide: 2 });
    } else if (type === 'mushroom') {
      k.boost = Math.max(k.boost, 1.1);
      this.audio.turbo(2);
    } else if (type === 'star') {
      k.starT = 6.5;
      this.audio.star?.();
    }
    this.onEvent('use', k, type);
  }

  /** Un kart est touché : il fait un tête-à-queue et perd 3 pièces (sauf s'il a une étoile). */
  hit(k, by) {
    if (k.starT > 0 || k.spinT > 0) return false;
    k.spinT = 0.95;
    const lost = Math.min(3, k.coins);
    k.coins -= lost;
    k.feel(EXPR.SURPRISE_OPEN_MOUTH, 1.6);
    for (let s = 0; s < 10 + lost * 6; s++) {
      this.fx.spark(_v.copy(k.root.position).setY(0.8), new THREE.Vector3((Math.random() - 0.5) * 7, 3 + Math.random() * 4, (Math.random() - 0.5) * 7), new THREE.Color(s % 3 ? 0xffc21a : 0xffffff), 0.4, 0.6);
    }
    this.onEvent('hit', k, by);
    return true;
  }

  update(dt, t, karts, placeOf) {
    // boîtes : elles tournent, et réapparaissent après 2,5 s
    this.boxMat.emissive.setHSL((t * 0.2) % 1, 0.8, 0.45);
    for (const b of this.boxes) {
      if (b.back > 0) { b.back -= dt; if (b.back <= 0) b.g.visible = true; }
      b.g.rotation.y = t * 1.4; b.g.rotation.x = Math.sin(t * 1.1) * 0.3;
      b.g.position.y = b.pos.y + Math.sin(t * 2 + b.pos.x) * 0.15;
    }
    for (const c of this.coins) {
      if (c.back > 0) { c.back -= dt; if (c.back <= 0) c.m.visible = true; }
      c.m.rotation.y = t * 3;
    }

    for (const k of karts) {
      k.starT = Math.max(0, (k.starT ?? 0) - dt);
      // roulette de l'objet (le joueur la voit tourner)
      if (k.rolling > 0) { k.rolling -= dt; if (k.rolling <= 0) { k.item = k.pendingItem; this.onEvent('got', k, k.item); } }
      const p = k.root.position;
      for (const b of this.boxes) {
        if (!b.g.visible || (p.x - b.pos.x) ** 2 + (p.z - b.pos.z) ** 2 > 1.9) continue;
        b.g.visible = false; b.back = 2.5;
        for (let s = 0; s < 16; s++) this.fx.spark(b.pos, new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8), new THREE.Color().setHSL(Math.random(), 1, 0.6), 0.35, 0.45);
        if (!k.item && !(k.rolling > 0)) {
          k.pendingItem = roll(placeOf(k));
          k.rolling = k.human ? 1.1 : 0.01;
          k.itemT = 1.5 + Math.random() * 4;   // les bots attendent un peu avant de s'en servir
          this.onEvent('box', k);
        }
      }
      for (const c of this.coins) {
        if (!c.m.visible || (p.x - c.pos.x) ** 2 + (p.z - c.pos.z) ** 2 > 1.6) continue;
        c.m.visible = false; c.back = 8;
        if (k.coins < MAX_COINS) { k.coins++; this.onEvent('coin', k); }
      }
    }

    // bananes et carapaces
    this.live = this.live.filter((o) => {
      o.t += dt;
      if (o.type === 'shell') {
        o.mesh.position.x += Math.sin(o.heading) * o.speed * dt;
        o.mesh.position.z += Math.cos(o.heading) * o.speed * dt;
        o.mesh.rotation.y += dt * 12;
        o.idx = this.track.nearest(o.mesh.position, o.idx);
        const lat = this.track.lateral(o.mesh.position, o.idx);
        if (Math.abs(lat) > WALL - 0.7) {   // elle rebondit sur les murets
          o.heading = 2 * this.track.heading(o.idx) - o.heading;
          o.mesh.position.addScaledVector(this.track.nrm[o.idx], Math.sign(lat) * (WALL - 0.7) - lat);
          this.audio.tone(900, 0.05, { type: 'square', vol: 0.06 });
        }
        if (o.t > 4.5) { this.scene.remove(o.mesh); return false; }
      } else {
        o.mesh.rotation.y += dt * 0.5;
        if (o.t > 40) { this.scene.remove(o.mesh); return false; }
      }
      for (const k of karts) {
        if (k === o.owner && o.t < 0.6) continue;
        const d2 = (k.root.position.x - o.mesh.position.x) ** 2 + (k.root.position.z - o.mesh.position.z) ** 2;
        if (d2 < (o.type === 'shell' ? 1.6 : 1.3) && k.y < 0.8) {
          this.hit(k, o.owner);
          this.scene.remove(o.mesh);
          return false;
        }
      }
      return true;
    });

    // les pilotes ordinateur se servent de leurs objets
    for (const k of karts) {
      if (k.human && !k.finished) continue;
      if (!k.item || k.rolling > 0) continue;
      k.itemT -= dt;
      if (k.item === 'star' || k.item === 'mushroom') { if (k.itemT < 0 && Math.abs(this.track.turn[k.idx]) < 0.35) this.use(k); continue; }
      if (k.item === 'shell') {
        // vise un kart juste devant (mais pas un ami du jour 1, s'il en a un)
        const ahead = karts.find((o) => o !== k && !(k.friendOf === o) && o.progress - k.progress > 6 && o.progress - k.progress < 45
          && Math.abs(this.track.lateral(o.root.position, o.idx) - this.track.lateral(k.root.position, k.idx)) < 3);
        if (ahead || k.itemT < -6) this.use(k);
        continue;
      }
      if (k.itemT < 0) this.use(k);   // banane : posée au bout d'un moment
    }
  }
}
