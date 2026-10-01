// Tout ce qui touche aux vrais Mii 3D :
// FFL.js (le moteur Mii de la Wii U, décompilé) pour la tête + les corps Mii officiels (glTF) + three.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { FFL, CharModel, FFLExpression, getRandomCharInfo, pantsColors, PantsColor } from './lib/ffl/ffl.js';
import FFLShaderMaterial from './lib/ffl/materials/FFLShaderMaterial.js';

export const EXPR = FFLExpression;
const EXPRESSIONS = [EXPR.NORMAL, EXPR.SMILE, EXPR.HAPPY, EXPR.SORROW, EXPR.BLINK, EXPR.SURPRISE_OPEN_MOUTH, EXPR.ANGER, EXPR.ANGER_OPEN_MOUTH, EXPR.LIKE];
const HEAD_SCALE = 0.14;   // échelle tête → corps (valeur utilisée par Mii Maker / Mii Creator)

let ffl = null;
const bodies = {};         // { m: gltf, f: gltf }

/** Charge le moteur, le fichier de ressources (~4,5 Mo) et les deux corps. */
export async function initMii() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [f] = await Promise.all([
    // On lit tout le fichier avant de le donner à FFL : GitHub Pages l'envoie compressé (gzip),
    // et FFL réserverait sinon la mémoire d'après la taille compressée (trop petite).
    fetch('assets/FFLResHigh.dat').then((r) => r.arrayBuffer())
      .then((buf) => FFL.initWithResource(new Uint8Array(buf), globalThis.ModuleFFL)),
    loader.loadAsync('assets/miiBodyM_wiiu.glb').then((g) => { bodies.m = g; }),
    loader.loadAsync('assets/miiBodyF_wiiu.glb').then((g) => { bodies.f = g; }),
  ]);
  ffl = f;
}

/* =====================================================================
   Données d'un Mii (FFLiCharInfo, 288 octets) : lecture / écriture
   ===================================================================== */
export const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));
export const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Position (en octets) de chaque réglage dans le CharInfo, et sa valeur max. */
export const FIELDS = {
  faceType: [4, 11], faceColor: [8, 5], faceTex: [12, 11], faceMake: [16, 11],
  hairType: [20, 131], hairColor: [24, 7], hairFlip: [28, 1],
  eyeType: [32, 59], eyeColor: [36, 5], eyeScale: [40, 7], eyeAspect: [44, 6], eyeRotate: [48, 7], eyeX: [52, 12], eyeY: [56, 18],
  eyebrowType: [60, 23], eyebrowColor: [64, 7], eyebrowScale: [68, 8], eyebrowAspect: [72, 6], eyebrowRotate: [76, 11], eyebrowX: [80, 12], eyebrowY: [84, 18],
  noseType: [88, 17], noseScale: [92, 8], noseY: [96, 18],
  mouthType: [100, 35], mouthColor: [104, 4], mouthScale: [108, 8], mouthAspect: [112, 6], mouthY: [116, 18],
  beardMustache: [120, 5], beardType: [124, 5], beardColor: [128, 7], beardScale: [132, 8], beardY: [136, 16],
  glassType: [140, 8], glassColor: [144, 5], glassScale: [148, 7], glassY: [152, 20],
  moleType: [156, 1], moleScale: [160, 8], moleX: [164, 16], moleY: [168, 30],
  height: [172, 127], build: [176, 127],
  gender: [224, 1], birthMonth: [228, 12], birthDay: [232, 31], favoriteColor: [236, 11],
};

export function getField(bytes, key) {
  return new DataView(bytes.buffer, bytes.byteOffset).getInt32(FIELDS[key][0], true);
}
export function setField(bytes, key, value) {
  const [off, max] = FIELDS[key];
  new DataView(bytes.buffer, bytes.byteOffset).setInt32(off, Math.max(0, Math.min(max, value)), true);
}
export function getName(bytes) {
  return new TextDecoder('utf-16le').decode(bytes.subarray(180, 200)).replace(/\0.*$/s, '').replace(/^no name$/, '');
}
export function setName(bytes, name) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  for (let i = 0; i < 11; i++) view.setUint16(180 + i * 2, i < 10 ? (name.charCodeAt(i) || 0) : 0, true);
}

let _scratch = null;
const scratchRenderer = () => (_scratch ??= new THREE.WebGLRenderer({ alpha: true }));

/** N'importe quel format accepté par FFL (.ffsd 3DS/Wii U, .charinfo Switch, code Studio…) → CharInfo modifiable. */
export function toCharInfo(bytes) {
  if (bytes.length === 288) return new Uint8Array(bytes);
  const m = new CharModel(ffl, bytes, [EXPR.NORMAL], FFLShaderMaterial, scratchRenderer(), false);
  const out = new Uint8Array(m.charInfoBytes);
  m.dispose();
  return out;
}
/** Accepte de l'hexadécimal ou du base64. */
export function parseCode(text) {
  const t = text.replace(/\s+/g, '');
  if (/^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0) {
    return Uint8Array.from({ length: t.length / 2 }, (_, i) => parseInt(t.slice(i * 2, i * 2 + 2), 16));
  }
  return b64ToBytes(t.replace(/-/g, '+').replace(/_/g, '/'));
}

/** Mii au hasard (surtout des jeunes adultes : le hasard total donne beaucoup de papis/mamies). */
export function randomMii(gender = 2) {
  const bytes = new Uint8Array(getRandomCharInfo(ffl, gender, Math.random() < .8 ? 1 : 0));
  setField(bytes, 'favoriteColor', Math.floor(Math.random() * 12));
  setField(bytes, 'height', 40 + Math.floor(Math.random() * 50));
  setField(bytes, 'build', 40 + Math.floor(Math.random() * 50));
  setName(bytes, '');
  return bytes;
}

/* =====================================================================
   Icônes (tête de face) pour la grille des habitants
   ===================================================================== */
let iconRenderer = null;
const iconCache = new Map();
export function renderIcon(b64) {
  if (iconCache.has(b64)) return iconCache.get(b64);
  if (!iconRenderer) {
    iconRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    iconRenderer.setSize(128, 128);
    ffl.setRenderer(iconRenderer);
  }
  const scene = new THREE.Scene();
  const model = new CharModel(ffl, b64ToBytes(b64), [EXPR.NORMAL], FFLShaderMaterial, iconRenderer, false);
  scene.add(model.meshes);
  const cam = new THREE.PerspectiveCamera(15, 1, 1, 2000);
  cam.position.set(0, 42, 360);
  cam.lookAt(0, 40, 0);
  iconRenderer.render(scene, cam);
  const url = iconRenderer.domElement.toDataURL('image/png');
  model.dispose();
  iconCache.set(b64, url);
  return url;
}

/* =====================================================================
   Un Mii en entier : corps animé (glTF) + tête FFL qui suit l'os "head"
   ===================================================================== */
const _pos = new THREE.Vector3(), _quat = new THREE.Quaternion(), _scl = new THREE.Vector3(), _rootQ = new THREE.Quaternion();

class MiiActor {
  constructor(renderer, bytes) {
    this.renderer = renderer;
    this.root = new THREE.Group();       // on bouge/tourne ce groupe librement
    this.gender = null;
    this.idleExpr = EXPR.NORMAL;
    this.blinkPhase = 0;
    this.setData(bytes);
  }

  setData(bytes) {
    const gender = getField(bytes, 'gender') === 1 ? 'f' : 'm';

    // --- tête
    if (this.model) { this.root.remove(this.head); this.model.dispose(); }
    this.model = new CharModel(ffl, bytes, EXPRESSIONS, FFLShaderMaterial, this.renderer, false);
    this.head = this.model.meshes;
    this.head.scale.setScalar(HEAD_SCALE);
    this.root.add(this.head);

    // --- corps (recréé seulement si le genre change)
    if (gender !== this.gender) {
      if (this.body) { this.root.remove(this.body); this.mixer.stopAllAction(); this.disposeBodyMaterials(); }
      const gltf = bodies[gender];
      this.body = cloneSkinned(gltf.scene);
      this.root.add(this.body);
      this.mixer = new THREE.AnimationMixer(this.body);
      this.action = null;
      this.clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
      this.headBone = this.body.getObjectByName('head');
      this.bodyMesh = this.body.getObjectByName(`body_${gender}`);
      this.legsMesh = this.body.getObjectByName(`legs_${gender}`);
      this.bodyMesh.material = new FFLShaderMaterial({ modulateMode: 0, modulateType: 9, lightEnable: true });
      this.legsMesh.material = new FFLShaderMaterial({ modulateMode: 0, modulateType: 10, lightEnable: true });
      this.gender = gender;
      this.play('Wait');
    }
    this.bodyMesh.material.color = this.model.favoriteColor;
    this.legsMesh.material.color = pantsColors[PantsColor.GrayNormal];

    // --- taille et corpulence du Mii
    const s = this.model.getBodyScale();
    this.body.scale.set(s.x, s.y, s.z);
    this.setExpression(this.idleExpr);
  }

  play(name, fade = 0.35) {
    const clip = this.clips[name] ?? this.clips.Wait;
    const action = this.mixer.clipAction(clip);
    if (this.action === action) return;
    action.reset();
    action.setLoop(name === 'Wait' ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.play();
    if (this.action) this.action.crossFadeTo(action, fade, false);
    this.action = action;
  }

  setExpression(e) { try { this.model.setExpression(e); } catch { /* expression absente */ } }
  idle(e) { this.idleExpr = e; this.setExpression(e); }

  update(dt, t) {
    this.mixer.update(dt);
    // la tête suit l'os "head" du corps (position + rotation)
    this.root.updateMatrixWorld(true);
    this.headBone.matrixWorld.decompose(_pos, _quat, _scl);
    this.root.worldToLocal(_pos);
    this.root.getWorldQuaternion(_rootQ).invert();
    this.head.position.copy(_pos);
    this.head.position.y += 0.1;
    this.head.quaternion.copy(_rootQ.multiply(_quat));
    // clignement des yeux de temps en temps
    const blink = (t + this.blinkPhase) % 3.7 < 0.12;
    if (blink !== this.blinking) { this.blinking = blink; this.setExpression(blink ? EXPR.BLINK : this.idleExpr); }
  }

  disposeBodyMaterials() {
    this.bodyMesh.material.dispose();
    this.legsMesh.material.dispose();
  }
  dispose() {
    this.model.dispose();
    this.disposeBodyMaterials();
  }
}

/* =====================================================================
   Une scène 3D vivante : le duo du test, ou l'aperçu du Mii Maker
   ===================================================================== */
export class MiiScene {
  constructor(canvas, { duo = true } = {}) {
    this.canvas = canvas;
    this.duo = duo;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    ffl.setRenderer(this.renderer);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(15, 1, 1, 500);
    this.actors = [];
    this.bump = 0;
    this.mood = null;   // réaction en cours (voir react())
    this.spin = 0;
    this.zoom = 'body';
    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.frame();
  }

  /** Cadrage : le duo est cadré à mi-cuisses comme dans Tomodachi Life ; l'aperçu montre le Mii en entier. */
  frame(zoom = this.zoom) {
    this.zoom = zoom;
    if (this.duo) { this.camera.position.set(0, 14.5, 86); this.camera.lookAt(0, 12.6, 0); }
    else if (zoom === 'face') { this.camera.position.set(0, 14.5, 78); this.camera.lookAt(0, 14, 0); }
    else { this.camera.position.set(0, 12, 100); this.camera.lookAt(0, 11.5, 0); }
    this.camera.updateProjectionMatrix();
  }

  /** Remplace les Mii affichés (tableau d'octets CharInfo). */
  set(list) {
    // mêmes Mii qu'à l'écran : on les garde (pas de rechargement ni de saut d'animation)
    const key = list.map((b) => bytesToB64(b)).join('|');
    if (key && key === this.key && this.actors.length === list.length) return false;
    this.key = key;
    this.clear();
    list.forEach((bytes, i) => {
      const a = new MiiActor(this.renderer, bytes);
      a.blinkPhase = i * 1.3;
      if (this.duo) {
        const side = i === 0 ? -1 : 1;
        a.root.position.set(side * 8.6, 0, 0);
        a.root.rotation.y = -side * 0.42;   // ils se regardent, comme dans le jeu
        a.side = side;
      }
      this.scene.add(a.root);
      this.actors.push(a);
    });
    return true;
  }

  /**
   * Entrée en scène, comme dans Tomodachi Life : chaque Mii arrive de son côté de l'écran
   * en trottinant, tourné vers le centre, puis se met face à l'autre.
   */
  enter() {
    if (!this.duo) return;
    const t = this.clock.elapsedTime;
    this.actors.forEach((a, i) => {
      if (!a.side) return;
      a.walk = { t0: t + i * 0.18, from: a.side * 23, dur: 1.15 };
      a.root.position.set(a.side * 23, 0, 0);
      a.root.rotation.set(0, -a.side * 1.25, 0);
    });
  }

  /** Met à jour le Mii de l'aperçu sans tout recréer (Mii Maker). */
  update(bytes) {
    if (!this.actors.length) this.set([bytes]);
    else this.actors[0].setData(bytes);
  }

  clear() {
    this.key = null;
    for (const a of this.actors) { this.scene.remove(a.root); a.dispose(); }
    this.actors = [];
  }

  idle(e) { this.actors.forEach((a) => a.idle(e)); }

  /**
   * Réaction des deux Mii selon le score (0-100).
   * Plus c'est bas, plus ils se tournent le dos et s'énervent ;
   * plus c'est haut, plus ils se rapprochent, sautillent et se font les yeux doux.
   */
  react(score) {
    const k = score / 100;
    let expr, pose = 'Wait';
    if (score < 15) { expr = EXPR.ANGER_OPEN_MOUTH; pose = 'Pose.07'; }
    else if (score < 30) expr = EXPR.ANGER;
    else if (score < 45) expr = EXPR.SORROW;
    else if (score < 60) expr = EXPR.NORMAL;
    else if (score < 75) { expr = EXPR.SMILE; pose = 'Pose.02'; }
    else if (score < 90) { expr = EXPR.HAPPY; pose = 'Pose.05'; }
    else { expr = EXPR.LIKE; pose = 'Pose.05'; }
    this.mood = {
      // écart entre eux : loin quand ça va mal, collés quand c'est l'amour
      x: 10.2 - k * 3.6,
      // regard : dos tourné (<0) → face à face (0.42) → tournés l'un vers l'autre
      turn: score < 15 ? -1.9 : score < 30 ? -0.5 : 0.25 + k * 0.35,
      lean: score < 30 ? -0.12 : score >= 75 ? 0.14 : 0,     // penchés l'un vers l'autre ou non
      shake: score < 30 ? (30 - score) / 30 : 0,              // tremblent de colère
      hop: score >= 75 ? (score - 70) / 30 : 0,               // sautillent de joie
    };
    this.actors.forEach((a) => { a.idle(expr); a.play(pose); });
  }

  /** Revient à la position neutre (face à face). */
  calm() { this.mood = null; }

  /** Pendant le comptage : ils se tournent un peu vers nous pour regarder le score. */
  watch() { this.mood = { x: 8.6, turn: 0.16, lean: 0, shake: 0, hop: 0 }; }

  /**
   * Vie au repos (avant le test) : de temps en temps, chaque Mii prend une pose,
   * change d'expression, regarde vers nous ou fait un petit saut.
   */
  lively(on) {
    this.alive = on;
    const t = this.clock.elapsedTime;
    this.actors.forEach((a, i) => {
      // on annule une action en cours (sinon un Mii resterait figé dans une pose pendant le test)
      if (a.backToWait) a.play('Wait');
      a.backToWait = a.exprBack = a.glanceUntil = a.hopUntil = 0;
      a.nextAct = t + 2 + i * 1.3 + Math.random() * 2;
    });
  }

  idleAction(a, t) {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const kind = pick(['pose', 'pose', 'face', 'glance', 'hop']);
    if (kind === 'pose') {
      a.play(pick(['Pose.01', 'Pose.03', 'Pose.04', 'Pose.06', 'Pose.08']));
      a.backToWait = t + 2.4;
    } else if (kind === 'face') {
      a.setExpression(pick([EXPR.SMILE, EXPR.HAPPY, EXPR.SURPRISE_OPEN_MOUTH]));
      a.exprBack = t + 1.4;
    } else if (kind === 'glance') {
      a.glanceUntil = t + 1.8;
    } else {
      a.hopUntil = t + 0.45;
    }
    a.nextAct = t + 3 + Math.random() * 3.5;
  }

  /** Position à l'écran (en %) juste au-dessus de la tête de chaque Mii, pour les bulles. */
  headScreen() {
    const box = new THREE.Box3(), v = new THREE.Vector3();
    return this.actors.map((a) => {
      box.setFromObject(a.head);
      v.set((box.min.x + box.max.x) / 2, box.max.y + 0.6, (box.min.z + box.max.z) / 2).project(this.camera);
      return { x: (v.x + 1) * 50, y: (1 - v.y) * 50 };
    });
  }
  play(name) { this.actors.forEach((a) => a.play(name)); }
  beat() { this.bump = 1; }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    const t = this.clock.elapsedTime;
    this.bump = Math.max(0, this.bump - dt * 6);
    for (const a of this.actors) {
      if (!this.duo) a.root.rotation.y = this.spin;
      a.root.scale.setScalar(1 + this.bump * 0.03);
      if (this.duo && a.side && a.walk) {
        // en train d'arriver : petits pas sautillants, tourné vers le centre
        const w = a.walk, p = Math.min(1, Math.max(0, (t - w.t0) / w.dur));
        const k = 1 - (1 - p) * (1 - p);
        const step = Math.sin(p * Math.PI * 7);
        a.root.position.x = w.from + (a.side * 8.6 - w.from) * k;
        a.root.position.y = Math.abs(step) * 0.55 * (1 - p * 0.6);
        a.root.rotation.z = step * 0.05;
        a.root.rotation.y = -a.side * (1.25 - 0.83 * Math.max(0, (p - 0.75) / 0.25));
        if (p >= 1) { a.walk = null; a.root.position.y = 0; a.root.rotation.z = 0; }
      } else if (this.duo && a.side) {
        // vie au repos
        if (this.alive && !this.mood) {
          if (t > (a.nextAct ?? Infinity)) this.idleAction(a, t);
          if (a.backToWait && t > a.backToWait) { a.backToWait = 0; a.play('Wait'); }
          if (a.exprBack && t > a.exprBack) { a.exprBack = 0; a.setExpression(a.idleExpr); }
        }
        const base = this.mood ?? { x: 8.6, turn: 0.42, lean: 0, shake: 0, hop: 0 };
        const m = !this.mood && t < (a.glanceUntil ?? 0) ? { ...base, turn: 0.05 } : base;
        const ease = 1 - Math.exp(-dt * 5);   // transition douce vers la nouvelle pose
        const tx = a.side * m.x + Math.sin(t * 40 + a.side) * m.shake * 0.12;
        const ty = Math.abs(Math.sin(t * 7 + (a.side > 0 ? 1.2 : 0))) * m.hop * 0.8;
        a.root.position.x += (tx - a.root.position.x) * ease;
        a.root.position.y += (ty - a.root.position.y) * ease * 2;
        if (!this.mood && t < (a.hopUntil ?? 0)) a.root.position.y = Math.sin(((a.hopUntil - t) / 0.45) * Math.PI) * 0.9;
        a.root.rotation.y += (-a.side * m.turn - a.root.rotation.y) * ease;
        a.root.rotation.z += (a.side * -m.lean - a.root.rotation.z) * ease;
      }
      a.update(dt, t);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
