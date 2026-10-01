// Drift · un kart : la carrosserie, le Mii au volant, et la conduite (accélération, virages, dérapage, turbo).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MiiActor, EXPR } from '../day-01-pulse/mii3d.js?v=2';
import { ROAD, WALL } from './track.js?v=1';

export const MAX_SPEED = 30;          // vitesse de pointe (unités/s), ×cylindrée
const ACCEL = 15;
const GRASS_SPEED = 12;               // l'herbe ralentit beaucoup
const BOOST_SPEED = 44;
const TURN = 1.75;                    // vitesse de rotation (rad/s)
// dérapage : temps de charge pour chaque niveau d'étincelles, et durée du turbo qu'il donne
export const SPARK_LEVELS = [0.85, 1.9, 3.1];
const TURBO = [0, 0.7, 1.15, 1.7];
export const SPARK_COLORS = [null, new THREE.Color(0x4cc8ff), new THREE.Color(0xffa020), new THREE.Color(0xd060ff)];
const MII_SCALE = 0.078;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

function buildBody(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.7 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.25, metalness: 0.8 });

  const tub = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.42, 2.3, 3, 0.16), paint);
  tub.position.set(0, 0.42, 0);
  const nose = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.34, 0.9, 3, 0.14), paint);
  nose.position.set(0, 0.5, 0.95);
  nose.rotation.x = 0.12;
  const bumper = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.22, 0.3, 2, 0.08), dark);
  bumper.position.set(0, 0.3, 1.35);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.75, 0.3, 2, 0.1), dark);
  seat.position.set(0, 0.85, -0.8);
  seat.rotation.x = -0.18;
  const engine = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.4, 0.5, 2, 0.08), chrome);
  engine.position.set(0, 0.62, -1.0);
  // le volant
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), dark);
  column.position.set(0, 0.72, 0.5); column.rotation.x = -1.1;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 20), dark);
  wheel.position.set(0, 0.84, 0.3); wheel.rotation.x = -0.9;
  g.add(tub, nose, bumper, seat, engine, column, wheel);
  g.userData.steeringWheel = wheel;

  // pots d'échappement : c'est de là que sortent les flammes du turbo
  const pipes = [-0.3, 0.3].map((x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.45, 12), chrome);
    p.rotation.x = Math.PI / 2 - 0.3;
    p.position.set(x, 0.7, -1.3);
    g.add(p);
    return p;
  });
  g.userData.pipes = pipes;

  // les roues (celles de devant tournent avec le volant)
  const tire = new THREE.CylinderGeometry(0.36, 0.36, 0.36, 18);
  tire.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.38, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z, front] of [[-0.86, 0.85, 1], [0.86, 0.85, 1], [-0.86, -0.85, 0], [0.86, -0.85, 0]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(tire, dark), new THREE.Mesh(hubGeo, chrome));
    if (!front) spin.scale.set(1.15, 1.08, 1.08);   // grosses roues arrière
    pivot.add(spin);
    g.add(pivot);
    wheels.push({ pivot, spin, front });
  }
  g.userData.wheels = wheels;
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
    this.body.children[0].material.color.copy(this.color);
  }

  reset(pos, heading, idx) {
    this.root.position.copy(pos);
    this.heading = heading;
    this.speed = 0;
    this.y = 0; this.vy = 0;
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
    const top = MAX_SPEED * opts.speedMul * (this.human ? 1 : opts.botMul ?? 1);

    // --- saut et début du dérapage (comme dans les jeux de kart : on saute, on atterrit en glissant)
    if (input.drift && !this.wasDrift && this.y <= 0 && this.speed > 6) {
      this.vy = 4.6; ev.push('hop');
    }
    this.wasDrift = input.drift;
    this.vy -= 22 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    const grounded = this.y <= 0;
    if (grounded) this.vy = 0;
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
      yaw = input.assist
        ? -input.steer * TURN * 1.35 * grip                       // pilote ordinateur : il garde sa trajectoire
        : -this.drift * TURN * (0.7 + 0.55 * inward) * grip;
      this.charge += dt * (1 + 0.5 * Math.max(0, inward));
      const lvl = SPARK_LEVELS.filter((s) => this.charge >= s).length;
      if (lvl > this.level) { this.level = lvl; ev.push('level'); }
    } else {
      yaw = -input.steer * TURN * grip * (1 - 0.3 * this.speed / BOOST_SPEED);
      if (!grounded) yaw *= 0.6;
    }
    this.heading += yaw * dt;

    // --- vitesse
    this.offroad = Math.abs(track.lateral(this.root.position, this.idx)) > ROAD + 1.3 && this.boost <= 0;
    let target = this.boost > 0 ? BOOST_SPEED * (0.9 + 0.1 * opts.speedMul) : this.offroad ? GRASS_SPEED : top;
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
    this.visual.rotation.y = this.slide;
    // secousses : moteur, herbe, choc
    const shake = (this.offroad ? 0.05 : 0.012) * Math.min(1, this.speed / 10) + this.bump * 0.15;
    this.bump = Math.max(0, this.bump - dt);
    this.visual.position.y = this.y + Math.sin(t * 38 + this.idx) * shake;
    this.visual.rotation.z = (this.drift ? this.drift * 0.08 : this.steerShown * 0.05) + Math.sin(t * 31) * shake * 0.5;
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
    this.mii.root.rotation.y = -this.steerShown * 0.25;   // il se penche dans le virage
    this.mii.root.rotation.z = (this.drift ? this.drift : this.steerShown) * 0.12;
    if (this.mood > 0) { this.mood -= dt; if (this.mood <= 0) this.mii.idle(EXPR.NORMAL); }

    if (!fx) return;
    const back = _w.set(-0.6, 0.15, -0.95).applyMatrix4(this.visual.matrixWorld);
    const back2 = new THREE.Vector3(0.6, 0.15, -0.95).applyMatrix4(this.visual.matrixWorld);
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
