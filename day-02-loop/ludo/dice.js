// Ludo 3D · l'écran du bas : un vrai dé qui roule dans un plateau de feutre.
// Pas de résultat tiré à l'avance : on lance le dé (vitesse + rotation au hasard),
// la gravité et les rebonds font le reste, et on lit la face qui finit en haut.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Faces du cube dans l'ordre de three.js : +x, -x, +y, -y, +z, -z (les faces opposées font 7)
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => new THREE.Vector3(...n));
const PIPS = {
  1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

function faceTexture(n) {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S * 0.4, S * 0.35, S * 0.1, S / 2, S / 2, S * 0.75);
  grad.addColorStop(0, '#fffdf6'); grad.addColorStop(1, '#ece2cc');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  for (const [x, y] of PIPS[n]) {
    const r = n === 1 ? S * 0.12 : S * 0.085;
    const pg = g.createRadialGradient(x * S - r * 0.3, y * S - r * 0.3, r * 0.1, x * S, y * S, r);
    const red = n === 1;   // le « 1 » en rouge, comme les dés traditionnels
    pg.addColorStop(0, red ? '#e0303a' : '#3a2f2a'); pg.addColorStop(1, red ? '#8e0f17' : '#0d0a09');
    g.beginPath(); g.arc(x * S, y * S, r, 0, Math.PI * 2); g.fillStyle = pg; g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Dice {
  constructor(canvas, sound) {
    this.canvas = canvas;
    this.sound = sound;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = this.scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x203018, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 9, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5 });
    scene.add(key);

    // le plateau de feutre (W × D) avec un rebord en bois
    this.W = 5.4; this.D = 2.6;
    const felt = new THREE.Mesh(new THREE.PlaneGeometry(this.W * 2 + 1, this.D * 2 + 1),
      new THREE.MeshStandardMaterial({ color: 0x1f6b45, roughness: 0.95 }));
    felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true;
    scene.add(felt);
    this.felt = felt;

    this.cube = new THREE.Mesh(new RoundedBoxGeometry(1, 1, 1, 5, 0.14),
      FACE_VALUES.map((v) => new THREE.MeshPhysicalMaterial({ map: faceTexture(v), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 })));
    this.cube.castShadow = true;
    this.cube.position.set(0, 0.5, 0);
    this.cube.quaternion.setFromEuler(new THREE.Euler(0.2, 0.6, 0));
    this.settle(1);   // posé à plat
    scene.add(this.cube);

    this.camera = new THREE.PerspectiveCamera(32, 2, 0.1, 50);
    this.camera.position.set(0, 9.5, 5.2);
    this.camera.lookAt(0, 0, 0.3);

    this.vel = new THREE.Vector3(); this.spin = new THREE.Vector3();
    this.rolling = false;
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    r.setAnimationLoop(() => this.tick());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // on recule si l'écran est plus étroit, pour toujours voir tout le plateau
    this.camera.position.set(0, 9.5 * Math.max(1, 2.1 / this.camera.aspect), 5.2 * Math.max(1, 2.1 / this.camera.aspect));
    this.camera.lookAt(0, 0, 0.3);
    this.camera.updateProjectionMatrix();
  }

  /** Couleur du feutre = couleur du joueur qui lance. */
  tint(hex) { this.felt.material.color.set(hex).lerp(new THREE.Color(0x1d2a22), 0.55); }

  /** Lance le dé. Renvoie une promesse avec la valeur (1 à 6). */
  roll() {
    if (this.rolling) return this.pending;
    this.rolling = true;
    // lancé depuis un bord, bas et fort, avec beaucoup de rotation : il va rouler et rebondir
    const side = Math.random() < 0.5 ? -1 : 1;
    this.cube.position.set(side * (this.W - 1), 1.3 + Math.random() * 0.6, (Math.random() - 0.5) * this.D);
    this.cube.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
    this.vel.set(-side * (7 + Math.random() * 4), 1 + Math.random() * 2, (Math.random() - 0.5) * 4);
    this.spin.set((Math.random() - 0.5) * 24, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 24);
    this.phase = 'air';
    this.rollT = 0; this.restT = 0;
    this.pending = new Promise((resolve) => { this.resolve = resolve; });
    return this.pending;
  }

  /** Face actuellement tournée vers le haut. */
  topFace() {
    let best = 0, bestY = -2;
    FACE_NORMALS.forEach((n, i) => {
      const y = n.clone().applyQuaternion(this.cube.quaternion).y;
      if (y > bestY) { bestY = y; best = i; }
    });
    return best;
  }

  /** Remet le dé parfaitement à plat sur sa face du dessus (k = 1 : d'un coup). */
  settle(k) {
    const n = FACE_NORMALS[this.topFace()].clone().applyQuaternion(this.cube.quaternion);
    const fix = new THREE.Quaternion().setFromUnitVectors(n, new THREE.Vector3(0, 1, 0));
    this.cube.quaternion.slerp(fix.multiply(this.cube.quaternion.clone()), k);
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    if (this.rolling && this.phase === 'air') {
      const n = 10;   // petites sous-étapes : des chocs précis et stables
      for (let s = 0; s < n; s++) this.step(dt / n);
      this.rollT += dt;
      // au repos = presque immobile pendant un petit moment (le dé est forcément retombé sur une face)
      const calm = this.vel.length() < 0.08 && this.spin.length() < 0.25;
      this.restT = calm ? this.restT + dt : 0;
      if (this.restT > 0.15 || this.rollT > 6) { this.phase = 'settle'; this.settleT = 0; }
    } else if (this.rolling && this.phase === 'settle') {
      // dernière micro-correction (invisible) pour être parfaitement à plat
      this.settleT += dt;
      this.settle(Math.min(1, dt * 10));
      this.cube.position.y += (0.5 - this.cube.position.y) * Math.min(1, dt * 10);
      if (this.settleT > 0.12) {
        this.settle(1);
        this.cube.position.y = 0.5;
        this.rolling = false;
        this.resolve(FACE_VALUES[this.topFace()]);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Une petite étape de physique d'un cube rigide (masse 1, côté 1).
   * On teste les 8 coins : chaque coin qui s'enfonce dans le feutre ou un rebord reçoit une impulsion
   * (rebond + frottement) appliquée à ce coin. C'est ce qui fait basculer, rouler et retomber le dé
   * naturellement sur une face, comme un vrai.
   */
  step(dt) {
    const p = this.cube.position, v = this.vel, w = this.spin, q = this.cube.quaternion;
    const INV_I = 6;   // inverse du moment d'inertie d'un cube (m = 1, côté 1 : I = 1/6)
    v.y -= 30 * dt;
    p.addScaledVector(v, dt);
    const ang = w.length() * dt;
    if (ang > 1e-6) q.premultiply(new THREE.Quaternion().setFromAxisAngle(w.clone().normalize(), ang)).normalize();

    const walls = [
      { n: new THREE.Vector3(0, 1, 0), d: 0 },                 // le feutre
      { n: new THREE.Vector3(1, 0, 0), d: -this.W },          // rebords
      { n: new THREE.Vector3(-1, 0, 0), d: -this.W },
      { n: new THREE.Vector3(0, 0, 1), d: -this.D },
      { n: new THREE.Vector3(0, 0, -1), d: -this.D },
    ];
    const r = new THREE.Vector3(), vp = new THREE.Vector3(), rxn = new THREE.Vector3(), tmp = new THREE.Vector3();
    let hit = 0;
    for (const wall of walls) {
      let deepest = 0;
      for (let c = 0; c < 8; c++) {
        r.set(c & 1 ? 0.47 : -0.47, c & 2 ? 0.47 : -0.47, c & 4 ? 0.47 : -0.47).applyQuaternion(q);   // 0.47 : coins arrondis
        const depth = wall.n.dot(tmp.copy(p).add(r)) - wall.d;
        if (depth >= 0) continue;
        deepest = Math.min(deepest, depth);
        // vitesse du coin = vitesse du centre + rotation × bras de levier
        vp.copy(w).cross(r).add(v);
        const vn = vp.dot(wall.n);
        if (vn >= 0) continue;
        rxn.copy(r).cross(wall.n);
        const k = 1 + rxn.lengthSq() * INV_I;
        const restitution = vn < -2 ? 0.35 : 0;
        const jn = (-(1 + restitution) * vn) / k;
        v.addScaledVector(wall.n, jn);
        w.addScaledVector(rxn, jn * INV_I);
        // frottement (glissement → roulement), limité par le coefficient de friction
        vp.copy(w).cross(r).add(v);
        const vt = tmp.copy(vp).addScaledVector(wall.n, -vp.dot(wall.n));
        const vtLen = vt.length();
        if (vtLen > 1e-5) {
          const dir = vt.multiplyScalar(1 / vtLen);
          const rxt = r.clone().cross(dir);
          const jt = Math.min(vtLen / (1 + rxt.lengthSq() * INV_I), 0.45 * jn);
          v.addScaledVector(dir, -jt);
          w.addScaledVector(rxt, -jt * INV_I);
        }
        if (vn < -1.5) hit = Math.max(hit, -vn);
      }
      // on ressort le cube du feutre / du rebord
      if (deepest < 0) p.addScaledVector(wall.n, -deepest);
    }
    if (hit) this.sound?.clack(Math.min(1, hit / 8));
    // un peu d'amortissement (air, feutre)
    v.multiplyScalar(1 - 0.15 * dt);
    w.multiplyScalar(1 - 0.6 * dt);
  }
}
