// Drift · un kart : la carrosserie, le Mii au volant, et la conduite (accélération, virages, dérapage, turbo).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiiActor, EXPR } from '../day-01-pulse/mii3d.js?v=3';
import { ROAD, WALL } from './track.js?v=2';

export const MAX_SPEED = 30;          // vitesse de pointe (unités/s), ×cylindrée
const ACCEL = 15;
const GRASS_SPEED = 12;               // l'herbe ralentit beaucoup
const BOOST_SPEED = 38;            // vitesse pendant un turbo (était 44 : trop fort)
const TURN = 1.95;                    // vitesse de rotation (rad/s)
// dérapage : temps de charge pour chaque niveau d'étincelles, et durée du turbo qu'il donne
export const SPARK_LEVELS = [0.85, 1.9, 3.1];
const TURBO = [0, 0.6, 0.95, 1.35];
export const SPARK_COLORS = [null, new THREE.Color(0x4cc8ff), new THREE.Color(0xffa020), new THREE.Color(0xd060ff)];
const MII_SCALE = 0.078;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** Un petit emblème rond (étoile) pour le nez du kart. */
let emblemTex = null;
function emblem() {
  if (emblemTex) return emblemTex;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); g.fill();
  g.lineWidth = 10; g.strokeStyle = '#ffd23a'; g.stroke();
  g.fillStyle = '#ff5b8d'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 18 : 42; g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  emblemTex = new THREE.CanvasTexture(cv); emblemTex.colorSpace = THREE.SRGBColorSpace;
  return emblemTex;
}

/** Le profil d'un pneu arrondi (on le fait tourner autour de l'axe pour obtenir le pneu). */
function tireGeometry(r, w) {
  const pts = [];
  for (let k = 0; k <= 12; k++) {
    const a = -Math.PI / 2 + (k / 12) * Math.PI;   // un demi-cercle pour l'épaulement du pneu
    pts.push(new THREE.Vector2(r - w * 0.35 + Math.cos(a) * w * 0.35, Math.sin(a) * w / 2));
  }
  pts.unshift(new THREE.Vector2(r * 0.62, -w / 2)); pts.push(new THREE.Vector2(r * 0.62, w / 2));
  const geo = new THREE.LatheGeometry(pts, 28);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

function buildBody(color) {
  const g = new THREE.Group();
  // peinture brillante (vernis), une teinte plus claire pour les détails, et le noir mat du châssis
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
  const accent = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.75 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe2e6ea, roughness: 0.18, metalness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.4 });
  const add = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh; };

  // le plancher (noir) et la coque centrale
  add(new THREE.Mesh(new RoundedBoxGeometry(1.35, 0.12, 2.55, 2, 0.05), dark), 0, 0.24, -0.05);
  add(new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.36, 1.55, 4, 0.16), paint), 0, 0.46, -0.2);

  // le nez profilé : un profil de côté (une goutte qui s'abaisse vers l'avant), extrudé sur la largeur
  const side = new THREE.Shape();
  side.moveTo(-0.15, 0.28); side.lineTo(1.42, 0.24);
  side.quadraticCurveTo(1.56, 0.3, 1.38, 0.42);
  side.quadraticCurveTo(0.9, 0.56, 0.35, 0.66);
  side.lineTo(-0.15, 0.66); side.closePath();
  const noseGeo = new THREE.ExtrudeGeometry(side, { depth: 0.82, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 4, curveSegments: 16 });
  noseGeo.translate(0, 0, -0.41);
  noseGeo.rotateY(-Math.PI / 2);          // le profil était dans le plan (z, y) : on le tourne vers l'avant (+z)
  add(new THREE.Mesh(noseGeo, paint), 0, 0, 0);
  // l'emblème sur le nez
  add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshStandardMaterial({ map: emblem(), roughness: 0.4 })), 0, 0.5, 1.47, -0.35);
  // phares
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xfff0b0, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), lamp), s * 0.3, 0.38, 1.47);

  // pare-chocs avant (deux couleurs) et bas de caisse
  add(new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.18, 0.26, 3, 0.08), dark), 0, 0.27, 1.5);
  add(new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.06, 0.08, 2, 0.03), accent), 0, 0.38, 1.6);

  // pontons latéraux (avec une bande claire) et garde-boue au-dessus des roues avant
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 1.05, 3, 0.12), paint), s * 0.66, 0.42, -0.2);
    add(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.95, 2, 0.03), accent), s * 0.82, 0.45, -0.2);
    const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.36, 20, 1, true, Math.PI / 2 - 1.15, 2.3), paint);
    // (la peinture est double face pour voir l'intérieur du garde-boue)
    add(fender, s * 0.86, 0.36, 0.85, 0, 0, Math.PI / 2);
  }

  // le siège baquet avec appui-tête
  add(new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.18, 0.62, 3, 0.07), dark), 0, 0.64, -0.62);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.78, 0.18, 3, 0.08), dark), 0, 0.98, -0.95, -0.2);
  add(new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.26, 0.14, 3, 0.06), paint), 0, 1.42, -1.03, -0.2);

  // le moteur à l'arrière, et l'aileron sur deux mâts
  add(new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.38, 0.5, 3, 0.08), chrome), 0, 0.58, -1.2);
  for (let k = -1; k <= 1; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.06), dark), 0, 0.62 + k * 0.1, -1.46);
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.1), dark), s * 0.45, 0.98, -1.38, 0.15);
  add(new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.07, 0.38, 2, 0.03), paint), 0, 1.24, -1.45, 0.12);
  add(new THREE.Mesh(new RoundedBoxGeometry(1.56, 0.03, 0.1, 2, 0.012), accent), 0, 1.27, -1.33, 0.12);
  for (const s of [-1, 1]) add(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.3, 0.42, 2, 0.02), accent), s * 0.78, 1.2, -1.45);

  // le volant : couronne, trois branches, moyeu
  const column = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5), dark), 0, 0.72, 0.5, -1.1);
  void column;
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 10, 28), dark));
  for (let k = 0; k < 3; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.02), chrome);
    spoke.rotation.z = (k / 3) * Math.PI * 2; spoke.translateY(0.1); wheel.add(spoke);
  }
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16).rotateX(Math.PI / 2), paint));
  add(wheel, 0, 0.84, 0.3, -0.9);
  g.userData.steeringWheel = wheel;

  // pots d'échappement : c'est de là que sortent les flammes du turbo
  const pipes = [-0.3, 0.3].map((x) => {
    const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 16, 1, true), chrome), x, 0.66, -1.5, Math.PI / 2 - 0.3);
    const inside = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    inside.rotation.x = Math.PI / 2; inside.position.y = -0.2; p.add(inside);
    return p;
  });
  g.userData.pipes = pipes;

  // les roues : pneu arrondi, jante de la couleur du kart, enjoliveur chromé (celles de devant tournent avec le volant)
  const tireF = tireGeometry(0.36, 0.34), tireR = tireGeometry(0.4, 0.44);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 20).rotateZ(Math.PI / 2);
  const capGeo = new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2);
  const wheels = [];
  for (const [x, z, front] of [[-0.86, 0.85, 1], [0.86, 0.85, 1], [-0.88, -0.85, 0], [0.88, -0.85, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, front ? 0.36 : 0.4, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(front ? tireF : tireR, rubber));
    const rim = new THREE.Mesh(rimGeo, paint); if (!front) rim.scale.set(1.3, 1.1, 1.1);
    const cap = new THREE.Mesh(capGeo, chrome); cap.position.x = Math.sign(x) * (front ? 0.15 : 0.2); if (x < 0) cap.rotation.z = Math.PI;
    // des « rayons » : quatre petites barres qui montrent que la roue tourne
    for (let k = 0; k < 4; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.05), chrome);
      bar.position.x = Math.sign(x) * (front ? 0.155 : 0.2); bar.rotation.x = (k / 4) * Math.PI; spin.add(bar);
    }
    spin.add(rim, cap);
    pivot.add(spin);
    g.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  g.userData.wheels = wheels;

  // ombres portées sur la piste
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // pour changer de couleur quand on change de pilote
  g.userData.recolor = (c) => {
    paint.color.copy(c);
    const hsl = {}; c.getHSL(hsl);
    accent.color.setHSL(hsl.h, Math.min(1, hsl.s * 0.6), Math.min(0.92, hsl.l + 0.35));
  };
  g.userData.recolor(new THREE.Color(color));
  return g;
}

export class Kart {
  constructor(renderer, scene, bytes, { name = 'Mii', human = false } = {}) {
    this.name = name;
    this.human = human;
    this.root = new THREE.Group();        // position + cap (direction de déplacement)
    this.visual = new THREE.Group();      // + glisse du dérapage, sauts, secousses
    this.root.add(this.visual);
    this.mii = new MiiActor(renderer, bytes);
    this.color = this.mii.model.favoriteColor.clone();
    this.body = buildBody(this.color);
    this.visual.add(this.body);

    // le Mii, assis : on cache ses jambes (elles sont dans la coque) et on le pose sur le siège
    this.mii.legsMesh.visible = false;
    this.mii.root.scale.setScalar(MII_SCALE);
    this.mii.root.position.set(0, 0.28, -0.5);
    this.visual.add(this.mii.root);
    this.armL = this.mii.body.getObjectByName('arm_l1');
    this.armR = this.mii.body.getObjectByName('arm_r1');

    // ombre ronde sous le kart
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1.25, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(0.8, 1.15, 1);
    this.shadow.position.y = 0.02;
    this.root.add(this.shadow);
    scene.add(this.root);

    this.reset(new THREE.Vector3(), 0, 0);
  }

  setMii(bytes) {
    this.mii.setData(bytes);
    this.mii.legsMesh.visible = false;
    this.armL = this.mii.body.getObjectByName('arm_l1');
    this.armR = this.mii.body.getObjectByName('arm_r1');
    this.color = this.mii.model.favoriteColor.clone();
    this.body.userData.recolor(this.color);
  }

  reset(pos, heading, idx) {
    this.root.position.copy(pos);
    this.heading = heading;
    this.speed = 0;
    this.y = 0; this.vy = 0;
    this.driftYaw = 0;       // rotation pendant le dérapage (lissée)
    this.drift = 0;          // 0 = pas de dérapage, sinon −1 (gauche) ou 1 (droite)
    this.charge = 0;         // temps passé à déraper
    this.level = 0;          // niveau des étincelles (0 à 3)
    this.boost = 0;          // temps de turbo restant
    this.slide = 0;          // angle de glisse affiché
    this.steerShown = 0;
    this.idx = idx;
    this.lap = 0; this.halfway = true;
    this.finished = false; this.finishTime = 0;
    this.offroad = false;
    this.bump = 0;
    this.wasDrift = false;
    this.stats = { turbos: 0, best: 0 };
    this.mood = 0;
    this.coins = 0;          // pièces ramassées (0 à 10) : chacune ajoute un peu de vitesse de pointe
    this.item = null;        // objet en main
    this.starT = 0;          // temps d'invincibilité restant (étoile)
    this.spinT = 0;          // tête-à-queue en cours (touché par une banane ou une carapace)
    this.air = false;        // en l'air après une rampe
    this.trickDone = false;
    this.trickT = 0;         // figure en cours (animation)
    this.lookBack = 0;       // le Mii se retourne (on vient de le doubler)
    this.mii.idle(EXPR.NORMAL);
    this.root.rotation.y = heading;
  }

  get progress() { return this.lap * (this.n ?? 1200) + this.idx; }
  forward(out = _v) { return out.set(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  /** Fait ressentir quelque chose au pilote (une expression pendant un moment). */
  feel(expr, time = 1.2) { this.mii.setExpression(expr); this.mii.idleExpr = expr; this.mood = time; }

  /**
   * Un pas de conduite.
   * input = { steer: −1 (gauche) … 1 (droite), drift: bouton du saut / dérapage, brake }
   * Renvoie les événements utiles au son et à l'écran : 'hop', 'level', 'turbo', 'bump', 'pad'.
   */
  drive(dt, input, track, opts) {
    const ev = [];
    this.n = track.n;
    this.wallCd = Math.max(0, (this.wallCd ?? 0) - dt);
    // vitesse de pointe : +1,2 % par pièce, +12 % avec l'étoile
    const top = MAX_SPEED * opts.speedMul * (this.human ? 1 : opts.botMul ?? 1) * (1 + 0.012 * (this.coins ?? 0)) * (this.starT > 0 ? 1.12 : 1);

    // --- tête-à-queue : on ne contrôle plus rien pendant un moment, et on freine
    if (this.spinT > 0) {
      this.spinT -= dt;
      input = { steer: 0, drift: false, brake: true, assist: input.assist };
      this.drift = 0; this.charge = 0; this.level = 0;
    }

    // --- saut et début du dérapage (comme dans les jeux de kart : on saute, on atterrit en glissant)
    const press = input.drift && !this.wasDrift;
    if (press && this.y <= 0 && !this.air && this.speed > 6) {
      this.vy = 4.6; ev.push('hop');
    }
    // une figure en l'air (après une rampe) : appuyer sur Drift → petit turbo à l'atterrissage
    if (press && this.air && !this.trickDone) { this.trickDone = true; this.trickT = 0.55; ev.push('trick'); }
    this.wasDrift = input.drift;
    this.vy -= 22 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    const grounded = this.y <= 0;
    if (grounded) {
      this.vy = 0;
      if (this.air) {
        this.air = false;
        if (this.trickDone) { this.boost = Math.max(this.boost, 0.8); ev.push('trickBoost'); }
      }
    }
    if (grounded && input.drift && !this.drift && Math.abs(input.steer) > 0.3 && this.speed > 11) {
      this.drift = Math.sign(input.steer);
      this.charge = 0; this.level = 0;
    }

    // --- fin du dérapage : on lâche le bouton → turbo selon les étincelles
    if (this.drift && (!input.drift || this.speed < 8)) {
      if (this.level > 0 && input.drift === false) {
        this.boost = Math.max(this.boost, TURBO[this.level]);
        this.stats.turbos++;
        ev.push('turbo');
        if (this.level >= 2) this.feel(EXPR.HAPPY, 1);
      }
      this.drift = 0; this.charge = 0; this.level = 0;
    }

    // --- virage
    const grip = clamp(this.speed / 10, 0, 1);
    let yaw;
    if (this.drift) {
      // braquer vers l'intérieur serre le virage, braquer vers l'extérieur l'élargit
      const inward = input.steer * this.drift;
      if (input.assist) yaw = -input.steer * TURN * 1.35 * grip;   // pilote ordinateur : il garde sa trajectoire
      else {
        // le joueur : un virage large et régulier (0 à 1,95 rad/s selon qu'on braque vers l'extérieur ou l'intérieur),
        // qui s'installe en douceur au lieu de tourner d'un coup
        const target = -this.drift * TURN * (0.5 + 0.5 * inward) * grip;
        this.driftYaw += (target - this.driftYaw) * Math.min(1, dt * 3.5);
        yaw = this.driftYaw;
      }
      this.charge += dt * (1 + 0.5 * Math.max(0, inward));
      const lvl = SPARK_LEVELS.filter((s) => this.charge >= s).length;
      if (lvl > this.level) { this.level = lvl; ev.push('level'); }
    } else {
      yaw = -input.steer * TURN * grip * (1 - 0.3 * this.speed / BOOST_SPEED);
      if (!grounded) yaw *= 0.6;
      this.driftYaw = yaw;   // le dérapage partira de la rotation actuelle
    }
    this.heading += yaw * dt;

    // --- vitesse
    this.offroad = Math.abs(track.lateral(this.root.position, this.idx)) > ROAD + 1.3 && this.boost <= 0;
    // turbo : 25 % plus vite que la vitesse de pointe (quelle que soit la cylindrée)
    let target = this.boost > 0 ? top * 1.25 : this.offroad ? GRASS_SPEED : top;
    if (input.brake) target = 0;
    if (this.drift) target *= 0.97;
    if (this.boost > 0) { this.speed = Math.max(this.speed, target * 0.92); this.boost -= dt; }
    if (this.speed < target) this.speed = Math.min(target, this.speed + ACCEL * dt * (this.speed < 10 ? 1.4 : 1));
    else this.speed = Math.max(target, this.speed - (this.offroad ? 30 : input.brake ? 26 : 9) * dt);

    // --- déplacement
    const f = this.forward();
    this.root.position.addScaledVector(f, this.speed * dt);
    // pendant le dérapage, l'arrière chasse un peu vers l'extérieur
    if (this.drift) this.root.position.addScaledVector(_w.set(f.z, 0, -f.x), this.drift * this.speed * 0.06 * dt);

    // --- où en est-on sur le circuit ?
    const prev = this.idx;
    this.idx = track.nearest(this.root.position, this.idx);
    const n = track.n;
    if (this.idx > n * 0.4 && this.idx < n * 0.6) this.halfway = true;
    if (prev > n * 0.8 && this.idx < n * 0.2 && this.halfway) { this.lap++; this.halfway = false; ev.push('lap'); }
    else if (prev < n * 0.2 && this.idx > n * 0.8) { this.lap--; this.halfway = true; }

    // --- murets : on rebondit et on perd de la vitesse
    const lat = track.lateral(this.root.position, this.idx);
    if (Math.abs(lat) > WALL - 0.8) {
      const nrm = track.nrm[this.idx];
      this.root.position.addScaledVector(nrm, (Math.sign(lat) * (WALL - 0.8) - lat));
      // on glisse le long du muret : seule la partie de la vitesse « dans » le mur est perdue
      const along = track.heading(this.idx);
      let d = along - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const into = Math.abs(Math.sin(d)) * this.speed;
      if (into > 5 && !this.wallCd) { ev.push('bump'); this.bump = 0.35; this.feel(EXPR.SURPRISE_OPEN_MOUTH, 0.8); this.wallCd = 0.4; }
      this.speed *= Math.max(0.5, Math.abs(Math.cos(d))) * 0.985;
      // on remet le kart dans le sens de la route (ou à contresens si on roulait à l'envers)
      if (Math.abs(d) < Math.PI / 2) this.heading += d * 0.3;
      else this.heading -= Math.sign(d) * (Math.PI - Math.abs(d)) * 0.3;
      if (into > 2) { this.drift = 0; this.charge = 0; this.level = 0; }
    }

    // --- rampes : on décolle (et on peut faire une figure)
    for (const r of track.ramps ?? []) {
      let di = this.idx - r.i;
      if (di > n / 2) di -= n; else if (di < -n / 2) di += n;
      if (di >= 0 && di <= 4 && grounded && !this.air && this.speed > 12 && Math.abs(lat) < 8) {
        this.vy = 7 + this.speed * 0.06; this.air = true; this.trickDone = false; this.y = 0.01;
        ev.push('ramp');
      }
    }

    // --- dalles d'accélération
    for (const pad of track.pads) {
      let di = this.idx - pad.i;
      if (di > n / 2) di -= n; else if (di < -n / 2) di += n;
      if (di >= -3 && di <= 3 && Math.abs(lat - pad.off) < 2 && this.boost < 0.9) {
        this.boost = 1.0; ev.push('pad');
      }
    }

    this.steerShown += (input.steer - this.steerShown) * Math.min(1, dt * 10);
    return ev;
  }

  /** L'animation : glisse, rebonds, roues, Mii qui tient le volant, effets. */
  animate(dt, t, fx) {
    this.root.rotation.y = this.heading;
    const slideTarget = this.drift ? -this.drift * 0.42 : 0;
    this.slide += (slideTarget - this.slide) * Math.min(1, dt * 8);
    // tête-à-queue : deux tours sur lui-même ; figure : une vrille
    this.visual.rotation.y = this.slide + (this.spinT > 0 ? (0.95 - this.spinT) * Math.PI * 4.2 : 0);
    this.trickT = Math.max(0, this.trickT - dt);
    // secousses : moteur, herbe, choc
    const shake = (this.offroad ? 0.05 : 0.012) * Math.min(1, this.speed / 10) + this.bump * 0.15;
    this.bump = Math.max(0, this.bump - dt);
    this.visual.position.y = this.y + Math.sin(t * 38 + this.idx) * shake;
    this.visual.rotation.z = (this.drift ? this.drift * 0.08 : this.steerShown * 0.05) + Math.sin(t * 31) * shake * 0.5
      + (this.trickT > 0 ? (1 - this.trickT / 0.55) * Math.PI * 2 : 0);
    // étoile : le kart clignote aux couleurs de l'arc-en-ciel
    if (this.starT > 0) { this.body.userData.recolor(new THREE.Color().setHSL((t * 2.5) % 1, 1, 0.55)); this.starred = true; }
    else if (this.starred) { this.body.userData.recolor(this.color); this.starred = false; }
    this.visual.rotation.x = this.boost > 0 ? -0.05 : 0;
    this.shadow.scale.setScalar(1 - Math.min(0.4, this.y * 0.25));
    this.shadow.scale.y *= 1.15;

    const ud = this.body.userData;
    for (const w of ud.wheels) {
      w.spin.rotation.x += this.speed * dt / 0.36;
      if (w.front) w.pivot.rotation.y = -this.steerShown * 0.4;
    }
    ud.steeringWheel.rotation.z = this.steerShown * 0.9;

    // le Mii
    this.mii.update(dt, t);
    if (this.armL && this.armR) {
      // les bras tendus vers le volant
      this.armL.rotation.set(this.steerShown * 0.2, -1.2, -0.5);
      this.armR.rotation.set(-this.steerShown * 0.2, 1.2, 0.5);
    }
    this.lookBack = Math.max(0, this.lookBack - dt);
    // il se penche dans le virage… ou se retourne quand on vient de le doubler
    this.mii.root.rotation.y = -this.steerShown * 0.25 + (this.lookBack > 0 ? Math.sin(Math.min(1, this.lookBack) * Math.PI) * 1.4 : 0);
    this.mii.root.rotation.z = (this.drift ? this.drift : this.steerShown) * 0.12;
    if (this.mood > 0) { this.mood -= dt; if (this.mood <= 0) this.mii.idle(EXPR.NORMAL); }

    if (!fx) return;
    const back = _w.set(-0.6, 0.15, -0.95).applyMatrix4(this.visual.matrixWorld);
    const back2 = new THREE.Vector3(0.6, 0.15, -0.95).applyMatrix4(this.visual.matrixWorld);
    // traces de pneus sur la piste pendant le dérapage (et pendant un tête-à-queue)
    if (fx.skids) {
      if ((this.drift || this.spinT > 0) && this.y <= 0 && !this.offroad) fx.skids.mark(this, back, back2);
      else fx.skids.lift(this);
    }
    // étoile : des étincelles dorées partout
    if (this.starT > 0 && Math.random() < 0.7) fx.spark(back, new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.5) * 3), new THREE.Color().setHSL(Math.random(), 1, 0.65), 0.4, 0.4);
    // étincelles du dérapage, sous les roues arrière
    if (this.drift && this.y <= 0) {
      const c = SPARK_COLORS[this.level];
      for (const p of [back, back2]) {
        if (c && Math.random() < 0.9) fx.spark(p, new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3), c, this.level === 3 ? 0.45 : 0.32, 0.25);
        if (Math.random() < 0.18) fx.puff(p, new THREE.Vector3(0, 0.5, 0), new THREE.Color(0xf2f2f2), 0.55, 0.45);
      }
    }
    // poussière sur l'herbe
    if (this.offroad && this.speed > 5 && Math.random() < 0.6) fx.puff(Math.random() < 0.5 ? back : back2, new THREE.Vector3(0, 1, 0), new THREE.Color(0xa88a55), 0.6, 0.5);
    // flammes du turbo
    if (this.boost > 0) {
      for (const pipe of ud.pipes) {
        const p = new THREE.Vector3(0, -0.3, 0).applyMatrix4(pipe.matrixWorld);
        const v = this.forward(new THREE.Vector3()).multiplyScalar(-4 + this.speed * 0.6);
        fx.spark(p, v.add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.5, (Math.random() - 0.5))), Math.random() < 0.5 ? new THREE.Color(0xff7a1a) : new THREE.Color(0x4cc8ff), 0.55, 0.16);
      }
    }
  }
}
