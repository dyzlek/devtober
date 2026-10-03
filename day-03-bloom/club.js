// Bloom · la boîte de nuit en 3D (écran du haut).
// Le « bloom » (halo autour des lumières vives) fait briller la piste, les néons et les lasers.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { MiiActor, useRenderer, EXPR, bytesToB64, getName } from '../day-01-pulse/mii3d.js?v=3';
import { affinity } from '../day-02-loop/ludo/affinity.js?v=1';

const COLS = 10, ROWS = 8, TILE = 2;          // la piste : 10 × 8 dalles de 2 unités
const PALETTE = [0xff2d95, 0x7b2dff, 0x2de2ff, 0xffd02d, 0x2dff8a, 0xff6a2d].map((c) => new THREE.Color(c));
// seulement des poses debout (certaines poses du corps Mii sont assises ou couchées)
const MOVES = ['Pose.01', 'Pose.02', 'Pose.03', 'Pose.04', 'Pose.05', 'Pose.06', 'Pose.08', 'Wait'];
const MII_SCALE = 0.2;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// bras posés à la main (par-dessus l'animation) : [avant, bas, coude, avant-bras levé]
const ARMS_UP = { l: [0.2, -0.45, 0.1, -0.9], r: [0.2, -0.45, 0.1, -0.9] };
const ARMS_CROSSED = { l: [1.45, 0.75, 1.7], r: [1.45, 0.75, 1.7] };
const clapArms = (t) => { const v = [1.25, 0.45, 0.6 + Math.sin(t * 18) * 0.25]; return { l: v, r: v }; };

function softDot(size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Le shader des Mii (FFL) sort des couleurs déjà prêtes pour l'écran. Avec le halo (post-traitement),
 * l'image passe une fois de plus par la conversion vers l'écran : les Mii devenaient trop clairs.
 * On remet donc leurs couleurs dans le même espace que le reste de la scène.
 */
function fixMiiColors(root) {
  root.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    mats.forEach((m) => {
      if (!m.isShaderMaterial || m.userData.linearFix) return;
      m.userData.linearFix = true;
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(/}\s*$/, '  gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2)) * 0.62;\n}');
      };
      m.needsUpdate = true;
    });
  });
}

export class Club {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    useRenderer(r);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07040c);
    scene.fog = new THREE.FogExp2(0x0a0612, 0.022);
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 200);

    // post-traitement : le halo lumineux
    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.6, 0.55);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.ambient = new THREE.AmbientLight(0x6040a0, 0.5);
    this.strobeLight = new THREE.PointLight(0xffffff, 0, 60, 1.2);
    this.strobeLight.position.set(0, 12, 0);
    scene.add(this.ambient, this.strobeLight);
    this.spots = [0xff2d95, 0x2de2ff, 0x7b2dff].map((c, i) => {
      const s = new THREE.SpotLight(c, 260, 50, 0.5, 0.6, 1.5);
      s.position.set(-8 + i * 8, 13, -2);
      scene.add(s, s.target);
      return s;
    });

    this.buildRoom();
    this.buildFloor();
    this.buildBooth();
    this.buildLasers();
    this.buildBall();
    this.buildSmoke();
    this.buildLedWall();
    this.buildCones();
    this.buildConfetti();
    this.buildFlower();

    this.dancers = [];      // { actor, spot, yaw, pose }
    this.fx = { lasers: false, strobe: false, ball: true, smoke: false };
    this.hype = 0;
    this.blooms = [];       // ondes « fleur » sur la piste
    this.dropUntil = 0;
    this.clock = new THREE.Clock();
    this.shots = this.makeShots();
    this.shotIndex = 0; this.shotStart = 0; this.lastBar = -1;
    this.flowers = [];

    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* =====================================================================
     Construction de la salle
     ===================================================================== */
  buildRoom() {
    const s = this.scene;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x15101f, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.35, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01;
    s.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), wallMat); back.position.set(0, 9, -16);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), wallMat); left.rotation.y = Math.PI / 2; left.position.set(-16, 9, 0);
    const right = left.clone(); right.rotation.y = -Math.PI / 2; right.position.x = 16;
    s.add(back, left, right);
    // néons (ils brillent grâce au bloom)
    this.neons = [];
    const neon = (w, h, d, x, y, z, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z); s.add(m); this.neons.push(m);
      return m;
    };
    neon(28, 0.12, 0.12, 0, 11, -15.9, 0xff2d95);
    neon(28, 0.12, 0.12, 0, 2.2, -15.9, 0x2de2ff);
    [-1, 1].forEach((sd) => {
      neon(0.12, 0.12, 30, sd * 15.9, 10, -1, 0x7b2dff);
      neon(0.12, 0.12, 30, sd * 15.9, 1.4, -1, 0xff2d95);
      for (let k = 0; k < 4; k++) neon(0.1, 6, 0.1, sd * 15.9, 5.6, -12 + k * 7, PALETTE[k % PALETTE.length].getHex());
    });
    // un grand mot en néon au fond
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
    const g = cv.getContext('2d');
    g.font = '900 190px "Nunito", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff7ad1'; g.shadowBlur = 30; g.fillStyle = '#ffd6f0'; g.fillText('BLOOM', 512, 135);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xffffff }));
    this.sign.position.set(0, 13.6, -15.8);
    s.add(this.sign);
  }

  buildFloor() {
    const geo = new THREE.BoxGeometry(TILE * 0.94, 0.12, TILE * 0.94);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.tiles = new THREE.InstancedMesh(geo, mat, COLS * ROWS);
    const m = new THREE.Matrix4();
    this.tileInfo = [];
    for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
      const x = (i - (COLS - 1) / 2) * TILE, z = (j - (ROWS - 1) / 2) * TILE;
      m.makeTranslation(x, 0.06, z);
      const k = j * COLS + i;
      this.tiles.setMatrixAt(k, m);
      this.tiles.setColorAt(k, new THREE.Color(0x111111));
      this.tileInfo.push({ x, z, glow: 0, color: PALETTE[(i + j) % PALETTE.length].clone() });
    }
    this.scene.add(this.tiles);
  }

  buildBooth() {
    const s = this.scene;
    const booth = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a1426, roughness: 0.4, metalness: 0.4 }));
    body.position.y = 1.2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(9.02, 0.18, 0.05), new THREE.MeshBasicMaterial({ color: 0x2de2ff }));
    strip.position.set(0, 1.9, 1.11);
    this.boothStrip = strip;
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, roughness: 0.3, metalness: 0.6 });
    const deckL = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 40), deckMat); deckL.position.set(-2.6, 2.48, 0);
    const deckR = deckL.clone(); deckR.position.x = 2.6;
    const lightDisc = (x) => { const d = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff2d95 })); d.rotation.x = Math.PI / 2; d.position.set(x, 2.56, 0); return d; };
    this.discs = [lightDisc(-2.6), lightDisc(2.6)];
    const mixer = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.2, 1.3), deckMat); mixer.position.set(0, 2.5, 0);
    booth.add(body, strip, deckL, deckR, mixer, ...this.discs);
    this.decks = [deckL, deckR];
    booth.position.set(0, 0, -11);
    s.add(booth);
    // estrade
    const stage = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0x120e1a, roughness: 0.6 }));
    stage.position.set(0, -0.3, -11.8);
    const step = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 2.6), stage.material);   // la marche du DJ
    step.position.set(0, 0.7, -12.6);
    s.add(stage, step);
    // enceintes
    [-6.2, 6.2].forEach((x) => {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5, 2), new THREE.MeshStandardMaterial({ color: 0x0d0d10, roughness: 0.5 }));
      sp.position.set(x, 2.5, -11.5);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshBasicMaterial({ color: 0x2a2a35 }));
      cone.position.set(x, 1.6, -10.49);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0x7b2dff }));
      ring.position.set(x, 1.6, -10.48);
      s.add(sp, cone, ring);
      (this.speakers ??= []).push(cone);
    });
  }

  buildLasers() {
    this.lasers = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);   // la base du rayon à l'émetteur
    for (let k = 0; k < 10; k++) {
      const mat = new THREE.MeshBasicMaterial({ color: PALETTE[k % 3 === 0 ? 2 : k % 3 === 1 ? 0 : 4], transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.set(k < 5 ? -5 : 5, 11.5, -12);
      beam.scale.y = 40;
      beam.userData.k = k;
      this.lasers.add(beam);
    }
    this.lasers.visible = false;
    this.scene.add(this.lasers);
  }

  buildBall() {
    const ball = this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2),
      new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.85, roughness: 0.2, flatShading: true, emissive: 0x55557a }));
    ball.position.set(0, 12.5, -1);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    wire.position.set(0, 15, -1);
    this.scene.add(ball, wire);
    // les reflets de la boule : des points de lumière qui tournent sur les murs et le sol
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 1.6 - 1);
      const rr = 14 + Math.random() * 3;
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * rr;
      pos[i * 3 + 1] = Math.max(0.2, 12.5 + Math.cos(ph) * rr);
      pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * rr;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.sparkles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, map: softDot(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparkles.position.set(0, 0, -1);
    this.scene.add(this.sparkles);
  }

  buildSmoke() {
    this.smoke = new THREE.Group();
    const tex = softDot(128);
    for (let k = 0; k < 26; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x9a7ad6, transparent: true, opacity: 0, depthWrite: false }));
      sp.position.set((Math.random() - 0.5) * 26, 0.8 + Math.random() * 1.5, (Math.random() - 0.5) * 20);
      sp.scale.setScalar(5 + Math.random() * 5);
      sp.userData = { vx: (Math.random() - 0.5) * 0.4, vz: (Math.random() - 0.5) * 0.3, phase: Math.random() * 6 };
      this.smoke.add(sp);
    }
    this.scene.add(this.smoke);
  }

  /** Un mur LED derrière le DJ : un égaliseur qui bat avec la musique. */
  buildLedWall() {
    const cv = this.ledCanvas = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    this.ledCtx = cv.getContext('2d');
    this.ledTex = new THREE.CanvasTexture(cv);
    this.ledTex.colorSpace = THREE.SRGBColorSpace;
    this.ledTex.magFilter = THREE.NearestFilter;   // effet « pixels de LED »
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ map: this.ledTex }));
    wall.position.set(0, 7.2, -15.85);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16.6, 6.6, 0.2), new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.4, metalness: 0.6 }));
    frame.position.set(0, 7.2, -15.98);
    this.scene.add(frame, wall);
    this.eq = new Array(32).fill(0);
  }

  drawLedWall(beats, energy, pulse, hue) {
    const g = this.ledCtx, W = 256, H = 96, n = this.eq.length, bw = W / n;
    g.fillStyle = '#05030a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      // chaque barre suit un peu le kick (au centre) et un peu le hasard (sur les côtés)
      const center = 1 - Math.abs(i - n / 2) / (n / 2);
      const target = (0.15 + energy * 0.7) * (0.35 + 0.65 * pulse * center + Math.random() * 0.35);
      this.eq[i] += (target - this.eq[i]) * 0.35;
      const h = Math.max(2, this.eq[i] * H);
      for (let y = 0; y < h; y += 4) {
        const col = new THREE.Color().setHSL((hue + i / n * 0.5 + y / H * 0.15) % 1, 1, 0.55);
        g.fillStyle = `#${col.getHexString()}`;
        g.fillRect(i * bw + 1, H - y - 3, bw - 2, 3);
      }
    }
    this.ledTex.needsUpdate = true;
  }

  /** Des cônes de lumière sous les projecteurs (on « voit » le faisceau dans la fumée). */
  buildCones() {
    const geo = new THREE.ConeGeometry(3.2, 1, 32, 1, true);
    geo.translate(0, -0.5, 0);   // la pointe à l'origine (au projecteur)
    this.cones = this.spots.map((spot) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: spot.color, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
      }));
      this.scene.add(m);
      // le projecteur lui-même : un petit boîtier qui brille
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0x15151a, metalness: 0.7, roughness: 0.3 }));
      head.position.copy(spot.position);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: spot.color }));
      this.scene.add(head, lens);
      return { m, lens, spot };
    });
    // la poutre qui porte les projecteurs
    const truss = new THREE.Mesh(new THREE.BoxGeometry(22, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0x2a2a33, metalness: 0.8, roughness: 0.35 }));
    truss.position.set(0, 13.45, -2);
    this.scene.add(truss);
  }

  updateCones(energy) {
    const up = new THREE.Vector3(0, 1, 0);
    for (const c of this.cones) {
      const from = c.spot.position, to = c.spot.target.position;
      const dir = new THREE.Vector3().subVectors(to, from);
      const len = dir.length();
      c.m.position.copy(from);
      c.m.quaternion.setFromUnitVectors(up, dir.normalize().negate());   // la pointe vers le haut, le cône vers la cible
      c.m.scale.set(1, len, 1);
      c.m.material.color.copy(c.spot.color);
      c.m.material.opacity = 0.025 + energy * 0.045;
      c.lens.position.copy(from).addScaledVector(dir, 0.4);
      c.lens.lookAt(to);
      c.lens.material.color.copy(c.spot.color);
    }
  }

  /**
   * La grande fleur de néon, sur le mur derrière le DJ : un pétale s'allume et s'ouvre à chaque palier d'ambiance,
   * et au drop elle s'épanouit complètement (une deuxième couronne de pétales, elle tourne et change de couleur).
   */
  buildFlower() {
    const flower = this.flower = new THREE.Group();
    flower.position.set(0, 7.6, -15.55);
    flower.scale.setScalar(1.55);
    const petalCurve = (len, wid) => {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 2;
        // une goutte : étroite au centre, large au bout
        const y = (1 - Math.cos(a)) / 2 * len, x = Math.sin(a) * wid * Math.sin((1 - Math.cos(a)) / 2 * Math.PI * 0.9);
        pts.push(new THREE.Vector3(x, y, 0));
      }
      return new THREE.CatmullRomCurve3(pts, true);
    };
    const make = (n, len, wid, radius, offset) => Array.from({ length: n }, (_, i) => {
      const pivot = new THREE.Group();
      pivot.rotation.z = offset + (i / n) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({ color: 0xff2d95, transparent: true, opacity: 0 });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(petalCurve(len, wid), 80, radius, 6, true), mat);
      tube.position.y = 0.45;
      pivot.add(tube);
      pivot.scale.setScalar(0.001);
      flower.add(pivot);
      return { pivot, mat, open: 0 };
    });
    this.petals = make(8, 2.5, 0.75, 0.085, 0);
    this.outerPetals = make(8, 3.3, 0.9, 0.065, Math.PI / 8);
    const heart = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd02d }));
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    flower.add(heart, core);
    this.flowerCore = [heart, core];
    this.scene.add(flower);
  }

  updateFlower(dt, t, beats, drop, pulse) {
    const lit = Math.floor(this.hype / 12);   // un pétale de plus tous les 12 % d'ambiance (8 pétales)
    const hue = (beats * 0.03) % 1;
    this.petals.forEach((p, i) => {
      const target = drop || i < lit ? 1 : 0;
      p.open += (target - p.open) * Math.min(1, dt * 3);
      p.pivot.scale.setScalar(Math.max(0.001, p.open * (1 + pulse * 0.06)));
      p.mat.opacity = p.open;
      p.mat.color.setHSL(drop ? (hue + i / 8) % 1 : 0.92 - i * 0.015, 1, 0.55 + pulse * 0.15);
    });
    // au drop : la deuxième couronne s'ouvre, la fleur tourne
    this.outerPetals.forEach((p, i) => {
      p.open += ((drop ? 1 : 0) - p.open) * Math.min(1, dt * 2.5);
      p.pivot.scale.setScalar(Math.max(0.001, p.open));
      p.mat.opacity = p.open;
      p.mat.color.setHSL((hue + 0.5 + i / 8) % 1, 1, 0.6);
    });
    this.flower.rotation.z += dt * (drop ? 0.8 : 0.05);
    this.flowerCore[0].material.color.setHSL(0.13, 1, 0.5 + pulse * 0.3);
  }

  /** Des confettis qui tombent pendant le drop et la pleine floraison. */
  buildConfetti() {
    const n = 360;
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.24), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), n);
    this.confettiData = [];
    for (let i = 0; i < n; i++) {
      this.confettiData.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 26, Math.random() * 14, (Math.random() - 0.5) * 20),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        fall: 1 + Math.random() * 1.5,
      });
      this.confetti.setColorAt(i, PALETTE[i % PALETTE.length]);
    }
    this.confetti.visible = false;
    this.scene.add(this.confetti);
  }

  updateConfetti(dt, on) {
    this.confettiOn = on;
    if (!on && !this.confetti.visible) return;
    this.confetti.visible = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    let alive = 0;
    this.confettiData.forEach((c, i) => {
      c.p.y -= c.fall * dt;
      c.p.x += Math.sin(c.r.x) * dt * 0.6;
      c.r.x += c.spin.x * dt; c.r.y += c.spin.y * dt;
      if (c.p.y < 0.1) { if (on) { c.p.y = 14 + Math.random() * 3; } else c.p.y = -10; }
      if (c.p.y > -5) alive++;
      m.compose(c.p, q.setFromEuler(c.r), new THREE.Vector3(1, 1, 1));
      this.confetti.setMatrixAt(i, m);
    });
    this.confetti.instanceMatrix.needsUpdate = true;
    if (!on && !alive) this.confetti.visible = false;
  }

  /* =====================================================================
     Les Mii : le DJ et les danseurs
     ===================================================================== */
  setDJ(bytes) {
    if (this.dj) this.scene.remove(this.dj.root);
    const a = this.dj = new MiiActor(this.renderer, bytes);
    a.root.scale.setScalar(MII_SCALE * 1.1);
    a.root.position.set(0, 1.4, -12.4);   // sur une marche derrière les platines
    a.idle(EXPR.HAPPY);
    fixMiiColors(a.root);
    this.scene.add(a.root);
  }

  /** Ajoute un danseur sur une place libre de la piste (il arrive en sautant). */
  addDancer(bytes) {
    // un Mii qui a une grande affinité (jour 1) avec un danseur seul vient danser en duo avec lui
    const me = { b64: bytesToB64(bytes), bytes };
    const duos = this.dancers.filter((d) => d.partner).length / 2;
    const partner = duos < 3 && this.dancers.find((d) => !d.leaving && !d.partner && d.me.b64 !== me.b64 && affinity(me, d.me) >= 75);
    if (partner) {
      const p = partner.actor.root.position;
      const a = new MiiActor(this.renderer, bytes);
      a.root.scale.setScalar(0.001);
      const side = p.x > 0 ? -1 : 1;
      a.root.position.set(p.x + side * 1.5, 0.12, p.z + 0.2);
      a.idle(EXPR.HAPPY); a.blinkPhase = Math.random() * 3;
      fixMiiColors(a.root);
      this.scene.add(a.root);
      const d = { actor: a, me, spot: `duo${this.dancers.length}`, yaw: Math.atan2(p.x - a.root.position.x, p.z - a.root.position.z), grow: 0, phase: partner.phase, style: partner.style, partner };
      partner.partner = d;
      partner.yaw = Math.atan2(a.root.position.x - p.x, a.root.position.z - p.z);
      this.dancers.push(d);
      return { duo: [getName(partner.me.bytes) || 'Mii', getName(bytes) || 'Mii'] };
    }
    const taken = this.dancers.map((d) => d.spot);
    const spots = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) spots.push([(i - 2) * 3.6 + (j % 2) * 1.2, (j - 1.5) * 3.3 + 0.5]);
    const free = spots.filter((s) => !taken.includes(s.join()));
    if (!free.length) return;
    const [x, z] = free[Math.floor(Math.random() * Math.min(free.length, 8))];
    const a = new MiiActor(this.renderer, bytes);
    a.root.scale.setScalar(0.001);
    a.root.position.set(x + (Math.random() - 0.5) * 0.6, 0.12, z);
    a.idle(pick([EXPR.SMILE, EXPR.HAPPY, EXPR.NORMAL]));
    a.blinkPhase = Math.random() * 3;
    const yaw = Math.atan2(-x, -11 - z) + (Math.random() - 0.5) * 1.6;   // plutôt tourné vers le DJ
    fixMiiColors(a.root);
    this.scene.add(a.root);
    this.dancers.push({ actor: a, me, spot: [x, z].join(), yaw, grow: 0, phase: Math.random(), style: Math.floor(Math.random() * 3) });
    return null;
  }

  /** Les danseurs réagissent : 'cheer' (bras en l'air), 'clap' (ils applaudissent), 'sulk' (un danseur s'arrête et boude). */
  crowdReact(kind, seconds = 2.2) {
    const t = this.clock.elapsedTime;
    const list = this.dancers.filter((d) => !d.leaving && d.grow > 0.9);
    if (kind === 'sulk') {
      const d = pick(list.filter((x) => !x.react || x.react.until < t) .length ? list.filter((x) => !x.react || x.react.until < t) : list);
      if (d) { d.react = { kind, until: t + seconds }; d.actor.play('Wait', 0.2); d.actor.idle(pick([EXPR.ANGER, EXPR.SORROW])); }
      return;
    }
    list.forEach((d, i) => {
      d.react = { kind, until: t + seconds + i * 0.03 };
      d.actor.play(kind === 'cheer' ? 'Pose.05' : 'Wait', 0.15);
      d.actor.idle(kind === 'cheer' ? EXPR.LIKE : EXPR.HAPPY);
    });
  }

  /** Le DJ fait un geste (les bras en l'air) pendant quelques temps. */
  djCheer(seconds = 2.4) {
    if (!this.dj) return;
    this.dj.cheerUntil = this.clock.elapsedTime + seconds;
    this.dj.play('Pose.05', 0.15);
    this.dj.idle(EXPR.LIKE);
  }

  /** Demande une photo souvenir de la piste (prise juste après le prochain rendu). */
  snapshot() { this.snapWanted = true; }

  removeDancer() {
    const d = this.dancers.find((x) => !x.leaving);
    if (d) d.leaving = true;
  }

  /** Une « éclosion » de lumière sur la piste, depuis un point (une fleur qui s'ouvre). */
  bloomAt(x, z, color, strength = 1) {
    this.blooms.push({ x, z, t0: this.clock.elapsedTime, color: color ?? pick(PALETTE).clone(), strength });
  }

  drop(seconds) { this.dropUntil = this.clock.elapsedTime + seconds; }

  /* =====================================================================
     La caméra « clip » : un plan différent toutes les 2 mesures
     ===================================================================== */
  makeShots() {
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    return [
      { name: 'large', from: V(-14, 9, 18), to: V(14, 8, 17), look: V(0, 2.5, -4) },
      { name: 'dj', from: V(-5, 5.2, -1.5), to: V(5, 5.6, -2), look: V(0, 5.6, -13) },   // le DJ et la fleur de néon derrière lui
      { name: 'piste', from: V(12, 2.2, 11), to: V(-12, 2.6, 10), look: V(0, 1.8, -3) },
      { name: 'plongée', from: V(0, 24, 4), to: V(0, 22, -2), look: V(0, 0, -2), roll: true },
      { name: 'foule', from: V(-3, 4.5, -9.5), to: V(3, 5.5, -9), look: V(0, 1.5, 4) },
      { name: 'côté', from: V(15, 6, -6), to: V(13, 7, 6), look: V(-2, 2.5, -2) },
    ];
  }

  /* =====================================================================
     Chaque image : tout bouge au rythme de la musique
     ===================================================================== */
  update(beats) {
    const dt = Math.min(this.clock.getDelta(), 0.1), t = this.clock.elapsedTime;
    const h = this.hype / 100, drop = t < this.dropUntil;
    const energy = drop ? 1 : h;
    const beat = Math.floor(beats), phase = beats - beat;           // phase dans le temps (0 → 1)
    const pulse = Math.pow(1 - phase, 3);                            // fort sur le temps, puis retombe

    // caméra : une coupe franche toutes les 2 mesures (8 temps), un léger travelling pendant le plan
    const bar2 = Math.floor(beats / 8);
    if (bar2 !== this.lastBar) {
      this.lastBar = bar2;
      let next = Math.floor(Math.random() * this.shots.length);
      if (next === this.shotIndex) next = (next + 1) % this.shots.length;
      this.shotIndex = next; this.shotStart = beats;
    }
    const shot = this.shots[this.shotIndex], k = Math.min(1, (beats - this.shotStart) / 8);
    this.camera.position.lerpVectors(shot.from, shot.to, k);
    this.camera.position.y += drop ? Math.sin(t * 40) * 0.08 : 0;    // ça tremble pendant le drop
    this.camera.lookAt(shot.look);
    if (shot.roll) this.camera.rotateZ(t * 0.15);

    // la piste : chaque dalle s'allume selon l'ambiance, et les « fleurs » de lumière s'ouvrent
    const col = new THREE.Color();
    this.blooms = this.blooms.filter((b) => t - b.t0 < 1.6);
    this.tileInfo.forEach((tile, k2) => {
      const i = k2 % COLS, j = Math.floor(k2 / COLS);
      // motif de base : damier qui alterne à chaque temps + vague qui part du centre
      const checker = (i + j + beat) % 2 === 0 ? 1 : 0.25;
      const dist = Math.hypot(tile.x, tile.z);
      const wave = Math.max(0, Math.cos(dist * 0.5 - beats * Math.PI)) ** 4;
      let glow = energy * (0.25 + 0.55 * checker * pulse + 0.4 * wave);
      col.copy(tile.color);
      for (const b of this.blooms) {
        const age = t - b.t0, ring = age * 9, d = Math.hypot(tile.x - b.x, tile.z - b.z);
        const petal = Math.max(0, 1 - Math.abs(d - ring) / 1.6) * (1 - age / 1.6) * b.strength;
        if (petal > 0) { glow += petal * 1.6; col.lerp(b.color, Math.min(1, petal)); }
      }
      glow = Math.max(0.04, glow);
      if (k2 % 7 === beat % 7 && energy > 0.6) col.lerp(PALETTE[(beat + k2) % PALETTE.length], 0.6);
      this.tiles.setColorAt(k2, col.multiplyScalar(glow * 1.25));
    });
    this.tiles.instanceColor.needsUpdate = true;

    // néons, enceintes, platines
    const hue = (beats * 0.02) % 1;
    this.neons.forEach((n, i) => { n.material.color.setHSL((hue + i * 0.13) % 1, 1, 0.35 + energy * 0.35 + pulse * 0.15 * energy); });
    this.sign.material.color.setScalar(0.45 + energy * 0.9 + pulse * 0.4 * energy);
    this.boothStrip.material.color.setHSL((hue + 0.5) % 1, 1, 0.4 + pulse * 0.3);
    this.discs.forEach((d, i) => d.material.color.setHSL((hue + i * 0.3) % 1, 1, 0.5));
    this.decks.forEach((d) => { d.rotation.y += dt * 4; });
    this.speakers.forEach((c) => c.scale.setScalar(1 + pulse * 0.12 * (0.3 + energy)));

    // spots qui balaient, boule à facettes, lasers, fumée, stroboscope
    this.spots.forEach((s, i) => {
      s.target.position.set(Math.sin(t * (0.6 + i * 0.2) + i * 2) * 9, 0, Math.cos(t * (0.5 + i * 0.15)) * 6);
      s.intensity = 60 + energy * 170 * (0.6 + pulse * 0.4);
      s.color.setHSL((hue + i * 0.33) % 1, 1, 0.55);
    });
    this.ambient.intensity = 0.35 + energy * 0.4;
    this.ball.visible = this.sparkles.visible = this.fx.ball;
    this.ball.rotation.y += dt * 0.6;
    this.sparkles.rotation.y += dt * 0.25;
    this.sparkles.material.opacity = 0.3 + energy * 0.7;
    this.lasers.visible = this.fx.lasers || drop;
    if (this.lasers.visible) this.lasers.children.forEach((b) => {
      const k3 = b.userData.k, side = k3 < 5 ? 1 : -1;
      b.rotation.z = side * (0.5 + Math.sin(t * 1.3 + k3) * 0.45) + (drop ? Math.sin(t * 6 + k3) * 0.3 : 0);
      b.rotation.x = 1.15 + Math.sin(t * 0.9 + k3 * 0.7) * 0.35;
      b.material.opacity = 0.35 + pulse * 0.5;
    });
    this.smoke.children.forEach((sp) => {
      const u = sp.userData;
      sp.position.x += u.vx * dt; sp.position.z += u.vz * dt;
      if (Math.abs(sp.position.x) > 14) u.vx *= -1;
      if (Math.abs(sp.position.z) > 11) u.vz *= -1;
      const target = this.fx.smoke || drop ? 0.05 + Math.sin(t * 0.5 + u.phase) * 0.02 : 0;
      sp.material.opacity += (target - sp.material.opacity) * Math.min(1, dt * 1.5);
      sp.material.color.setHSL((hue + u.phase * 0.1) % 1, 0.6, 0.6);
    });
    const strobeOn = (this.fx.strobe || drop) && Math.floor(beats * 4) % 2 === 0 && (beats * 4) % 1 < 0.35;
    this.strobeLight.intensity = strobeOn ? 900 : 0;

    // mur LED, faisceaux, confettis
    this.drawLedWall(beats, energy, pulse, hue);
    this.updateCones(energy);
    this.updateConfetti(dt, drop || this.hype >= 95);

    this.updateFlower(dt, t, beats, drop, pulse);

    // le halo : il « éclot » avec l'ambiance
    this.bloom.strength = 0.45 + energy * 0.7 + (drop ? 0.3 : 0) + pulse * 0.2 * energy;
    this.bloom.threshold = 0.78 - energy * 0.08;   // seules les vraies lumières (dalles, néons, lasers) brillent

    // le DJ : il hoche la tête sur chaque temps, lève les bras pendant le drop
    if (this.dj) {
      const a = this.dj;
      a.root.position.y = 1.4 + Math.abs(Math.sin(phase * Math.PI)) * 0.12;
      a.root.rotation.y = Math.sin(beats * Math.PI / 2) * 0.15;
      const cheering = t < (a.cheerUntil ?? 0);
      if (cheering) a.mode = 'cheer';
      else if (drop && a.mode !== 'drop') { a.mode = 'drop'; a.play('Pose.05'); a.idle(EXPR.HAPPY); }
      else if (!drop && beat % 8 === 0 && a.lastSwap !== beat) { a.lastSwap = beat; a.mode = 'mix'; a.play(pick(['Wait', 'Pose.03', 'Pose.02', 'Pose.04'])); }
      a.update(dt, t);
      if (cheering) a.pose(ARMS_UP);
    }

    // les danseurs : ils sautent sur le temps et changent de pas toutes les 2 mesures… ou à chaque temps quand c'est la folie
    this.dancers = this.dancers.filter((d) => {
      const a = d.actor;
      d.grow = d.leaving ? Math.max(0, d.grow - dt * 3) : Math.min(1, d.grow + dt * 2.5);
      if (d.leaving && d.grow <= 0) { this.scene.remove(a.root); if (d.partner) d.partner.partner = null; return false; }
      const react = d.react && t < d.react.until ? d.react.kind : null;
      if (d.react && !react) { d.react = null; d.lastMove = -1; }
      const amp = react === 'sulk' ? 0 : react === 'cheer' ? 0.9 : 0.18 + energy * 0.6;
      const ph = (phase + d.phase * 0.15) % 1;
      const bounce = d.style === 0 ? Math.abs(Math.sin(ph * Math.PI)) : d.style === 1 ? Math.max(0, Math.sin(ph * Math.PI * 2)) : Math.abs(Math.sin(ph * Math.PI)) ** 2;
      a.root.position.y = 0.12 + bounce * amp + (1 - d.grow) * 2;
      a.root.scale.setScalar(MII_SCALE * Math.max(0.001, d.grow));
      let yaw = d.yaw + (react === 'sulk' ? 2.4 : Math.sin(beats * Math.PI / 2 + d.phase * 6) * (d.partner ? 0.1 : 0.2 + energy * 0.35));
      if (!react && !d.partner && (drop || (energy > 0.85 && beat % 16 === Math.floor(d.phase * 16)))) yaw += phase * Math.PI * 2;   // pirouette
      a.root.rotation.set(0, yaw, Math.sin(beats * Math.PI + d.phase * 6) * 0.08 * energy);
      const every = energy > 0.7 ? 1 : energy > 0.35 ? 2 : 4;
      // en duo, les deux font le même pas en même temps
      if (!react && beat % every === 0 && d.lastMove !== beat) {
        d.lastMove = beat;
        a.play(d.partner ? MOVES[(beat * 7 + 3) % MOVES.length] : pick(MOVES), 0.12);
      }
      if (!react && beat % 8 === 0 && d.lastFace !== beat) {
        d.lastFace = beat;
        a.idle(energy > 0.7 ? pick([EXPR.HAPPY, EXPR.LIKE, EXPR.SMILE_OPEN_MOUTH ?? EXPR.HAPPY]) : pick([EXPR.SMILE, EXPR.NORMAL, EXPR.HAPPY]));
      }
      a.update(dt, t);
      if (react) a.pose(react === 'cheer' ? ARMS_UP : react === 'clap' ? clapArms(t) : ARMS_CROSSED);
      return true;
    });

    this.composer.render(dt);
    if (this.snapWanted) { this.snapWanted = false; this.snap = this.canvas.toDataURL('image/jpeg', 0.85); }
  }

  /** Position à l'écran (en %) au-dessus de la tête d'un danseur (pour les bulles). */
  headScreen(actor) {
    const box = new THREE.Box3().setFromObject(actor.head);
    const v = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.2, (box.min.z + box.max.z) / 2).project(this.camera);
    return { x: (v.x + 1) * 50, y: (1 - v.y) * 50, visible: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
  }
}
