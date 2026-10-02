// Ludo 3D · l'écran du haut : la table, le plateau, les pions, les Mii et la caméra « cinéma ».
// Le joueur ne contrôle jamais la caméra : un réalisateur choisit les plans tout seul.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MiiActor, useRenderer, EXPR } from '../../day-01-pulse/mii3d.js?v=3';
import { buildDecor } from './decor.js?v=2';

/* =====================================================================
   Le plateau de Ludo (grille 15 × 15)
   ===================================================================== */
export const COLORS = [
  { name: 'Rouge', hex: 0xd7333b, css: '#d7333b' },
  { name: 'Vert', hex: 0x2f9a48, css: '#2f9a48' },
  { name: 'Jaune', hex: 0xf0b40c, css: '#f0b40c' },
  { name: 'Bleu', hex: 0x2068cf, css: '#2068cf' },
];

// Le parcours commun : 52 cases, dans le sens des aiguilles d'une montre. [colonne, rangée]
export const TRACK = (() => {
  const t = [];
  const seg = (c0, r0, dc, dr, n) => { for (let i = 0; i < n; i++) t.push([c0 + dc * i, r0 + dr * i]); };
  seg(1, 6, 1, 0, 5); seg(6, 5, 0, -1, 6); seg(7, 0, 1, 0, 2);
  seg(8, 1, 0, 1, 5); seg(9, 6, 1, 0, 6); seg(14, 7, 0, 1, 2);
  seg(13, 8, -1, 0, 5); seg(8, 9, 0, 1, 6); seg(7, 14, -1, 0, 2);
  seg(6, 13, 0, -1, 5); seg(5, 8, -1, 0, 6); seg(0, 7, 0, -1, 2);
  return t;
})();
export const START = [0, 13, 26, 39];                       // case de sortie de chaque couleur
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]); // cases protégées (départs + étoiles)
export const LAST = 50;   // dernière case du parcours commun pour un pion (puis le couloir de sa couleur)
export const GOAL = 56;   // 51..55 = couloir de couleur, 56 = arrivée au centre
const HOME_LANE = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];
const YARD = [[2.5, 2.5], [11.5, 2.5], [11.5, 11.5], [2.5, 11.5]];
const FINISH = [[6.35, 7], [7, 6.35], [7.65, 7], [7, 7.65]];
const TOP = 0.02;   // hauteur du dessus du plateau
const FLOOR = -7.2; // le sol de la pièce (la table arrive à la taille des Mii)
const MII_SCALE = 0.7, MII_DIST = 16.5;

const toWorld = (c, r, y = TOP) => new THREE.Vector3(c - 7, y, r - 7);

/** Case (en coordonnées de grille) d'un pion selon sa progression. */
export function cellOf(player, rel, slot = 0) {
  if (rel < 0) {
    const [cx, cy] = YARD[player], o = [[-1, -1], [1, -1], [-1, 1], [1, 1]][slot];
    return [cx + o[0] * 1.15, cy + o[1] * 1.15];
  }
  if (rel <= LAST) return TRACK[(START[player] + rel) % 52];
  if (rel < GOAL) return HOME_LANE[player][rel - LAST - 1];
  return FINISH[player];
}
export const trackIndex = (player, rel) => (rel >= 0 && rel <= LAST ? (START[player] + rel) % 52 : -1);

/** Dessine le dessus du plateau (texture 2048 px). */
function boardTexture(renderer) {
  const S = 2048, k = S / 15, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  // papier crème avec un léger grain
  g.fillStyle = '#f3ead6'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(120,90,50,${Math.random() * 0.035})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  const cell = (c, r, fill) => { g.fillStyle = fill; g.fillRect(c * k, r * k, k, k); };
  const shade = (hex, a) => { const c = new THREE.Color(hex); return `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${a})`; };
  // cours (yards)
  COLORS.forEach((col, p) => {
    const [cx, cy] = YARD[p], x = (cx - 2.5) * k, y = (cy - 2.5) * k;
    g.fillStyle = col.css; g.fillRect(x, y, 6 * k, 6 * k);
    g.fillStyle = '#fbf6ea'; roundRect(g, x + k * 0.8, y + k * 0.8, k * 4.4, k * 4.4, k * 0.5); g.fill();
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ox, oy]) => {
      g.beginPath(); g.arc((cx + 0.5 + ox * 1.15) * k, (cy + 0.5 + oy * 1.15) * k, k * 0.62, 0, Math.PI * 2);
      g.fillStyle = shade(col.hex, 0.85); g.fill();
      g.lineWidth = k * 0.06; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
    });
  });
  // couloirs de couleur et cases de départ
  HOME_LANE.forEach((lane, p) => lane.forEach(([c, r]) => cell(c, r, COLORS[p].css)));
  START.forEach((s, p) => { const [c, r] = TRACK[s]; cell(c, r, COLORS[p].css); });
  // quadrillage du parcours
  g.strokeStyle = 'rgba(40,30,20,.55)'; g.lineWidth = k * 0.035;
  const strokeCell = ([c, r]) => g.strokeRect(c * k, r * k, k, k);
  TRACK.forEach(strokeCell); HOME_LANE.flat().forEach(strokeCell);
  // étoiles des cases protégées
  [...SAFE].filter((i) => !START.includes(i)).forEach((i) => { const [c, r] = TRACK[i]; star(g, (c + 0.5) * k, (r + 0.5) * k, k * 0.36, '#9c8a6a'); });
  START.forEach((s) => { const [c, r] = TRACK[s]; star(g, (c + 0.5) * k, (r + 0.5) * k, k * 0.36, 'rgba(255,255,255,.85)'); });
  // centre : quatre triangles
  const cx = 7.5 * k, cy = 7.5 * k, a = 6 * k, b = 9 * k;
  [[[a, a], [a, b]], [[a, a], [b, a]], [[b, a], [b, b]], [[a, b], [b, b]]].forEach(([p1, p2], p) => {
    g.beginPath(); g.moveTo(...p1); g.lineTo(...p2); g.lineTo(cx, cy); g.closePath(); g.fillStyle = COLORS[p].css; g.fill();
  });
  g.lineWidth = k * 0.05; g.strokeStyle = 'rgba(40,30,20,.6)'; g.strokeRect(a, a, 3 * k, 3 * k);
  // cadre
  g.lineWidth = k * 0.12; g.strokeStyle = '#3a2a1c'; g.strokeRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function star(g, x, y, r, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fillStyle = fill; g.fill();
}

/** Bois procédural (veines) pour la table et le cadre. */
function woodTexture(base = '#7a4a26', dark = '#5a3218', light = '#94603a', w = 1024, h = 1024) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = Math.random() * h, amp = 4 + Math.random() * 14, f = 0.004 + Math.random() * 0.01;
    g.strokeStyle = Math.random() < 0.5 ? dark : light; g.globalAlpha = 0.08 + Math.random() * 0.18; g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * f + i) * amp);
    g.stroke();
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Un pion de Ludo tourné (profil de révolution) en plastique brillant. */
function pawnMesh(hex) {
  const pts = [[0, 0], [0.34, 0], [0.36, 0.04], [0.33, 0.1], [0.24, 0.17], [0.17, 0.32], [0.13, 0.5], [0.18, 0.56], [0.12, 0.6], [0, 0.6]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const mat = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.15 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 20), mat);
  head.position.y = 0.72;
  const g = new THREE.Group();
  g.add(body, head);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Pastille ronde avec le numéro du pion (1 à 4), bordée de la couleur du joueur. */
function numberTexture(n, css) {
  const S = 128, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 6, 0, Math.PI * 2);
  g.fillStyle = '#fffaf0'; g.fill();
  g.lineWidth = 12; g.strokeStyle = css; g.stroke();
  g.fillStyle = '#2a1a12'; g.font = '900 76px Nunito, system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), S / 2, S / 2 + 5);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* =====================================================================
   La scène
   ===================================================================== */
export class Board {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    useRenderer(r);

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1612);
    scene.fog = new THREE.Fog(0x1d1612, 55, 110);
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    // lumière : une lampe au-dessus de la table + un peu d'ambiance chaude
    this.hemi = new THREE.HemisphereLight(0xffe9cc, 0x2a1d14, 0.55);
    scene.add(this.hemi);
    const lamp = new THREE.SpotLight(0xfff1dc, 1300, 80, 0.75, 0.6, 2);
    lamp.position.set(2, 26, 4);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.bias = -0.0004;
    lamp.shadow.camera.near = 5; lamp.shadow.camera.far = 50;
    scene.add(lamp, lamp.target);
    this.lamp = lamp;
    const rim = new THREE.DirectionalLight(0xb9c8ff, 0.5);
    rim.position.set(-14, 9, -12);
    scene.add(rim);
    this.rim = rim;

    this.buildTable();
    this.pawns = [];
    this.actors = [];
    this.anims = [];
    this.trail = [];
    this.clock = new THREE.Clock();
    this.now = 0;            // horloge du jeu (en ms) : elle ralentit pendant les ralentis
    this.timeScale = 1;
    this.decor = null;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 260);
    this.director = new Director(this.camera);
    this.raycaster = new THREE.Raycaster();

    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    r.setAnimationLoop(() => this.tick());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildTable() {
    const r = this.renderer;
    // le sol (parquet sombre) et un tapis sous la table
    const floorWood = woodTexture('#3a2617', '#24170d', '#4a3220');
    floorWood.repeat.set(10, 10); floorWood.anisotropy = r.capabilities.getMaxAnisotropy();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: floorWood, roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(24, 72), new THREE.MeshStandardMaterial({ color: 0x6e2a26, roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR + 0.02; rug.receiveShadow = true;
    this.scene.add(floor, rug);
    this.floor = floor; this.rug = rug; this.floorWood = floor.material.map;
    // une table ronde en bois, à hauteur de taille des Mii (ils restent debout autour, sans la traverser)
    const wood = woodTexture('#6b3f20', '#4a2a14', '#86532e');
    wood.repeat.set(2, 2); wood.anisotropy = r.capabilities.getMaxAnisotropy();
    const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.5 });
    const table = new THREE.Mesh(new THREE.CylinderGeometry(11.4, 11.4, 0.8, 72), woodMat);
    table.position.y = -0.75; table.receiveShadow = table.castShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, -0.75 - FLOOR - 0.4, 32), woodMat);
    leg.position.y = (FLOOR + -1.15) / 2; leg.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 0.4, 48), woodMat);
    foot.position.y = FLOOR + 0.2; foot.castShadow = foot.receiveShadow = true;
    this.scene.add(table, leg, foot);
    // le plateau : une planche épaisse avec la texture du jeu dessus
    const edge = woodTexture('#8a5a30', '#6a401f', '#a87442', 512, 512);
    const side = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.5 });
    const top = new THREE.MeshStandardMaterial({ map: boardTexture(r), roughness: 0.62 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(15, 0.32, 15), [side, side, top, side, side, side]);
    board.position.y = TOP - 0.16; board.receiveShadow = true; board.castShadow = true;
    this.scene.add(board);
    // un cadre en bois autour
    const frameMat = new THREE.MeshStandardMaterial({ map: edge, roughness: 0.45, color: 0xd9b48a });
    [[0, -7.85, 16.4, 0.7], [0, 7.85, 16.4, 0.7], [-7.85, 0, 0.7, 15], [7.85, 0, 0.7, 15]].forEach(([x, z, w, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), frameMat);
      m.position.set(x, 0.05, z); m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    });
    // anneau lumineux sous les pions jouables
    this.ringGeo = new THREE.TorusGeometry(0.42, 0.05, 12, 40);
  }

  /** Change le décor autour de la table : 'salon', 'picnic', 'plage' ou 'nuit'. */
  setDecor(name) {
    if (this.decor) { this.scene.remove(this.decor.group); this.decor.dispose?.(); }
    this.decor = buildDecor(this, name);
    this.scene.add(this.decor.group);
    this.decorName = name;
  }

  /* ---------- Les Mii autour de la table, chacun derrière sa cour ---------- */
  setPlayers(players) {
    this.actors.forEach((a) => this.scene.remove(a.root));
    this.actors = players.map((p, i) => {
      const a = new MiiActor(this.renderer, p.bytes);
      const [cx, cy] = YARD[i];
      const dir = new THREE.Vector3(cx - 7, 0, cy - 7).normalize();
      a.home = dir.clone().multiplyScalar(MII_DIST);
      a.root.position.set(a.home.x, FLOOR, a.home.z);   // debout sur le sol, la table à hauteur de taille
      a.root.scale.setScalar(MII_SCALE);
      a.root.lookAt(0, FLOOR, 0);
      // angle pour faire face au centre (le +z du Mii = son regard)
      a.baseYaw = Math.atan2(-a.home.x, -a.home.z); a.yaw = a.baseYaw; a.targetYaw = a.baseYaw;
      a.blinkPhase = i * 0.9;
      a.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(a.root);
      return a;
    });
  }

  setPawns(players) {
    this.pawns.forEach((p) => this.scene.remove(p.mesh));
    this.pawns = [];
    players.forEach((pl, p) => pl.pawns.forEach((rel, i) => {
      const mesh = pawnMesh(COLORS[p].hex);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; ring.visible = false;
      mesh.add(ring);
      // le numéro du pion, au-dessus de sa tête (toujours tourné vers la caméra)
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(i + 1, COLORS[p].css), depthTest: false, transparent: true }));
      tag.position.y = 1.35; tag.scale.setScalar(0.75); tag.renderOrder = 10;
      mesh.add(tag);
      mesh.userData = { player: p, index: i };
      this.scene.add(mesh);
      const pawn = { player: p, index: i, mesh, ring, tag };
      this.pawns.push(pawn);
      mesh.position.copy(this.spot(p, i, rel));
    }));
  }

  pawn(p, i) { return this.pawns.find((x) => x.player === p && x.index === i); }

  /** Position 3D d'un pion (avec un petit décalage si plusieurs pions partagent une case). */
  spot(p, i, rel, stack = 0, of = 1) {
    const [c, r] = cellOf(p, rel, i);
    const v = toWorld(c, r);
    if (of > 1 && rel >= 0) { const a = (stack / of) * Math.PI * 2; v.x += Math.cos(a) * 0.2; v.z += Math.sin(a) * 0.2; }
    return v;
  }

  /** Recalcule les décalages quand plusieurs pions sont sur la même case. */
  restack(state) {
    const groups = new Map();
    state.players.forEach((pl, p) => pl.pawns.forEach((rel, i) => {
      if (rel < 0) return;
      const [c, r] = cellOf(p, rel, i), key = `${c.toFixed(2)},${r.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push([p, i, rel]);
    }));
    const moves = [];
    for (const list of groups.values()) list.forEach(([p, i, rel], k) => {
      const target = this.spot(p, i, rel, k, list.length), m = this.pawn(p, i).mesh;
      if (m.position.distanceTo(target) > 0.01) moves.push(this.slide(m, target, 0.18));
    });
    return Promise.all(moves);
  }

  highlight(list) {
    this.pawns.forEach((pw) => { pw.ring.visible = list.some(([p, i]) => p === pw.player && i === pw.index); });
    this.choosing = list.length > 0;
  }

  /** Clic sur l'écran du haut : quel pion est sous le doigt ? */
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hit = this.raycaster.intersectObjects(this.pawns.map((p) => p.mesh), true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && o.userData.player === undefined) o = o.parent;
    return o ? [o.userData.player, o.userData.index] : null;
  }

  /* ---------- Petites animations (promesses) ---------- */
  tween(dur, fn) {
    return new Promise((resolve) => this.anims.push({ t0: this.now, dur: dur * 1000, fn, resolve }));
  }
  slide(mesh, to, dur) {
    const from = mesh.position.clone();
    return this.tween(dur, (k) => mesh.position.lerpVectors(from, to, 1 - (1 - k) * (1 - k)));
  }
  /** Un saut de case en case. */
  hop(mesh, to, dur, height = 0.55) {
    const from = mesh.position.clone();
    return this.tween(dur, (k) => {
      mesh.position.lerpVectors(from, to, k);
      mesh.position.y = from.y + (to.y - from.y) * k + Math.sin(k * Math.PI) * height;
      const sq = 1 - Math.sin(k * Math.PI) * 0.12; mesh.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    });
  }
  /** Le pion capturé est éjecté vers sa cour en tournoyant. */
  fly(mesh, to, dur, color = 0xffffff) {
    const from = mesh.position.clone();
    let last = -1;
    return this.tween(dur, (k) => {
      mesh.position.lerpVectors(from, to, k);
      mesh.position.y = from.y + Math.sin(k * Math.PI) * 4.5;
      mesh.rotation.z = k * Math.PI * 4;
      // une petite traînée de bulles colorées derrière le pion
      if (k - last > 0.025) { last = k; this.puff(mesh.position, color); }
    }).then(() => { mesh.rotation.z = 0; });
  }
  puff(pos, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
    m.position.copy(pos).y += 0.4;
    this.scene.add(m);
    this.trail.push({ m, born: this.now });
  }
  /** Ralenti : 1 = vitesse normale, 0.3 = trois fois plus lent. */
  slowMo(scale) { this.timeScale = scale; }

  /* ---------- Les Mii ---------- */
  /** Chaque Mii (sauf `except`) se tourne un peu vers un point de la table. */
  lookAt(target, except = -1) {
    this.actors.forEach((a, i) => {
      if (i === except || !target) { a.targetYaw = a.baseYaw; return; }
      const want = Math.atan2(target.x - a.root.position.x, target.z - a.root.position.z);
      let d = want - a.baseYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      a.targetYaw = a.baseYaw + Math.max(-0.75, Math.min(0.75, d));   // pas plus de 45° : ils tournent la tête et le buste
    });
  }
  /** Position à l'écran (en %) juste au-dessus de la tête d'un Mii, pour les bulles. */
  headScreen(p) {
    const box = new THREE.Box3().setFromObject(this.actors[p].head);
    const v = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y + 0.4, (box.min.z + box.max.z) / 2).project(this.camera);
    return { x: (v.x + 1) * 50, y: (1 - v.y) * 50, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }
  actorHead(p) {
    const box = new THREE.Box3().setFromObject(this.actors[p].head);
    return box.getCenter(new THREE.Vector3());
  }
  react(p, kind) {
    const a = this.actors[p];
    if (!a) return;
    const table = {
      roll: [EXPR.NORMAL, 'Pose.03'], six: [EXPR.HAPPY, 'Pose.05'], capture: [EXPR.HAPPY, 'Pose.05'],
      captured: [EXPR.ANGER_OPEN_MOUTH, 'Pose.07'], finish: [EXPR.SMILE, 'Pose.02'], win: [EXPR.LIKE, 'Pose.05'],
      lose: [EXPR.SORROW, 'Pose.07'], idle: [EXPR.SMILE, 'Wait'], none: [EXPR.SORROW, 'Pose.04'],
      laugh: [EXPR.HAPPY, 'Pose.06'], wow: [EXPR.SURPRISE_OPEN_MOUTH, 'Pose.01'], clap: [EXPR.SMILE, 'Pose.08'],
      worry: [EXPR.SORROW, 'Wait'], meh: [EXPR.NORMAL, 'Pose.04'],
      // réactions avec les bras posés à la main (par-dessus l'animation du corps)
      cheer: [EXPR.HAPPY, 'Wait', { l: [0.2, -0.45, 0.1, -0.9], r: [0.2, -0.45, 0.1, -0.9] }, true],
      facepalm: [EXPR.SORROW, 'Wait', { l: [0.5, -0.35, 0.3, -2.1], r: [0.5, -0.35, 0.3, -2.1] }],
      hmph: [EXPR.ANGER, 'Wait', { l: [1.45, 0.75, 1.7], r: [1.45, 0.75, 1.7] }],
      goodjob: [EXPR.SMILE, 'Wait', { r: [0.6, -0.3, 0.2, -1.4] }],
      applause: [EXPR.HAPPY, 'Wait', 'clap', true],
    }[kind];
    a.setExpression(table[0]);
    a.play(table[1]);
    a.armPose = table[2] ? { arms: table[2], until: this.now + 2600 } : null;
    a.hopUntil = table[3] ? this.now + 900 : 0;
    clearTimeout(a.backTimer);
    if (kind !== 'win' && kind !== 'lose') a.backTimer = setTimeout(() => { a.play('Wait'); a.setExpression(a.idleExpr); }, 2600);
  }

  tick() {
    const rdt = Math.min(this.clock.getDelta(), 0.1), dt = rdt * this.timeScale, t = this.clock.elapsedTime;
    this.now += dt * 1000;
    const now = this.now;
    this.anims = this.anims.filter((a) => {
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.fn(k);
      if (k >= 1) { a.resolve(); return false; }
      return true;
    });
    this.pawns.forEach((pw) => {
      if (pw.ring.visible) { const s = 1 + Math.sin(t * 6) * 0.12; pw.ring.scale.set(s, s, s); }
      // pendant un choix : les numéros des pions jouables grossissent, les autres s'effacent
      const big = pw.ring.visible, target = big ? 1.35 + Math.sin(t * 6) * 0.07 : 0.75;
      pw.tag.scale.setScalar(pw.tag.scale.x + (target - pw.tag.scale.x) * Math.min(1, dt * 10));
      pw.tag.position.y = big ? 1.9 : 1.35;
      pw.tag.material.opacity = this.choosing && !big ? 0.35 : 1;
    });
    this.actors.forEach((a) => {
      a.yaw += (a.targetYaw - a.yaw) * (1 - Math.exp(-dt * 4));
      a.root.rotation.set(0, a.yaw, 0);
      a.root.position.y = FLOOR + (now < (a.hopUntil ?? 0) ? Math.abs(Math.sin((a.hopUntil - now) / 900 * Math.PI * 3)) * 0.9 : 0);
      a.update(dt, t);
      if (a.armPose && now < a.armPose.until) {
        const arms = a.armPose.arms === 'clap'   // applaudir : les mains se rejoignent devant, en rythme
          ? (() => { const o = Math.sin(now / 1000 * 18) * 0.25; const v = [1.25, 0.45, 0.6 + o]; return { l: v, r: v }; })()
          : a.armPose.arms;
        a.pose(arms);
      }
    });
    this.trail = this.trail.filter((p) => {
      const k = (now - p.born) / 600;
      if (k >= 1) { this.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); return false; }
      p.m.material.opacity = 0.8 * (1 - k); p.m.scale.setScalar(1 - k * 0.6);
      return true;
    });
    this.decor?.update?.(rdt, t);
    this.director.update(rdt, t);   // la caméra garde sa vitesse, même au ralenti
    this.renderer.render(this.scene, this.camera);
  }
}

/* =====================================================================
   Le réalisateur : il choisit les plans, la caméra glisse doucement vers eux.
   ===================================================================== */
class Director {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 46, 40);
    this.look = new THREE.Vector3(0, 0, 0);
    this.tPos = this.pos.clone();
    this.tLook = this.look.clone();
    this.speed = 1.2;
    this.orbit = null;     // plan d'ensemble qui tourne lentement
    this.follow = null;    // fonction qui renvoie la cible à suivre
  }
  shot(pos, look, speed = 2.2) {
    this.orbit = null; this.follow = null;
    this.tPos.copy(pos); this.tLook.copy(look); this.speed = speed;
  }
  overview(angle = 0, speed = 1.4) {
    this.follow = null;
    this.orbit = { angle, speed: 0.05 };
    this.speed = speed;
  }
  track(getTarget, offset, speed = 3.5) {
    this.orbit = null;
    this.follow = { getTarget, offset };
    this.speed = speed;
  }
  update(dt) {
    if (this.orbit) {
      this.orbit.angle += dt * this.orbit.speed;
      const a = this.orbit.angle;
      this.tPos.set(Math.sin(a) * 33, 28, Math.cos(a) * 33);
      this.tLook.set(0, -2, 0);
    } else if (this.follow) {
      const p = this.follow.getTarget();
      this.tLook.copy(p);
      this.tPos.copy(p).add(this.follow.offset);
    }
    const k = 1 - Math.exp(-dt * this.speed);
    this.pos.lerp(this.tPos, k);
    this.look.lerp(this.tLook, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
