// Ludo · les décors autour de la table : salon, pique-nique, plage, nuit avec des lampions.
// Chaque décor change le sol, le ciel (fond + brouillard), les lumières, et ajoute ses objets.
import * as THREE from 'three';

const FLOOR = -7.2;

export const DECORS = [
  { id: 'salon', name: 'Salon' },
  { id: 'picnic', name: 'Pique-nique' },
  { id: 'plage', name: 'Plage' },
  { id: 'nuit', name: 'Nuit' },
];

function canvasTex(w, h, draw, repeat = 1) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}
const grassTex = (a = '#5fae45', b = '#529c3b') => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) { g.fillStyle = Math.random() < 0.5 ? b : 'rgba(170,220,120,.35)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 4); }
}, 16);
const sandTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#ecd29a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '180,140,80' : '255,245,210'},${Math.random() * 0.5})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
}, 14);
const checkerTex = (c1, c2) => canvasTex(128, 128, (g, w, h) => {
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { g.fillStyle = (x + y) % 2 ? c1 : c2; g.fillRect(x * 16, y * 16, 16, 16); }
  g.fillStyle = 'rgba(255,255,255,.18)';
  for (let k = 0; k < 8; k++) { g.fillRect(k * 16 + 7, 0, 2, h); g.fillRect(0, k * 16 + 7, w, 2); }
}, 3);

/** Un arbre rond, façon jouet. */
function tree(x, z, s = 1, colors = [0x3f9f3a, 0x4cb847, 0x2f8a3a]) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.8 * s, 5 * s, 8), new THREE.MeshStandardMaterial({ color: 0x7a4f2c, roughness: 0.9 }));
  trunk.position.y = 2.5 * s;
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6 * s, 1), new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.8, flatShading: true }));
  crown.position.y = 7 * s;
  g.add(trunk, crown);
  g.position.set(x, FLOOR, z);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Un palmier. */
function palm(x, z, s = 1) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x9a7246, roughness: 0.9 });
  let y = 0, bend = 0;
  for (let k = 0; k < 7; k++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.6 * s, 1.6 * s, 8), trunkMat);
    bend += 0.06;
    seg.position.set(bend * k * s, y + 0.8 * s, 0); seg.rotation.z = -bend;
    g.add(seg); y += 1.5 * s;
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3c9a3c, roughness: 0.7, side: THREE.DoubleSide });
  for (let k = 0; k < 7; k++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * s, 6 * s), leafMat);
    leaf.position.set(bend * 7 * s, y, 0);
    leaf.rotation.set(-1.0, (k / 7) * Math.PI * 2, 0, 'YXZ');
    leaf.translateY(2.6 * s);
    g.add(leaf);
  }
  g.position.set(x, FLOOR, z);
  g.rotation.y = Math.random() * 6;
  return g;
}

/** Un parasol rayé. */
function parasol(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 11, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  pole.position.y = 5.5;
  const tex = canvasTex(256, 32, (c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#ff5b8d' : '#ffffff'; c.fillRect(k * 32, 0, 32, h); } });
  tex.repeat.set(1, 1);
  const top = new THREE.Mesh(new THREE.ConeGeometry(6, 2, 16, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
  top.position.y = 11;
  g.add(pole, top);
  g.position.set(x, FLOOR, z);
  g.rotation.z = 0.12;
  return g;
}

export function buildDecor(board, id) {
  const { scene, hemi, lamp, rim, floor, rug } = board;
  const group = new THREE.Group();
  const out = { group, update: null };
  // valeurs du salon (le décor de départ)
  floor.material.map = board.floorWood; floor.material.color.set(0xffffff); floor.material.needsUpdate = true;
  rug.visible = true;
  scene.background = new THREE.Color(0x1d1612);
  scene.fog = new THREE.Fog(0x1d1612, 55, 110);
  hemi.color.set(0xffe9cc); hemi.groundColor.set(0x2a1d14); hemi.intensity = 0.55;
  lamp.color.set(0xfff1dc); lamp.intensity = 1300;
  rim.color.set(0xb9c8ff); rim.intensity = 0.5;

  if (id === 'salon') {
    // une bibliothèque, une plante et une fenêtre au loin
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 3), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 }));
    shelf.position.set(-12, FLOOR + 8, -34);
    const books = new THREE.Group();
    const bookCols = [0xd7333b, 0x2068cf, 0xf0b40c, 0x2f9a48, 0xf3ead6, 0x7b4bb3];
    for (let row = 0; row < 3; row++) for (let k = 0; k < 10; k++) {
      const h = 2.6 + Math.random() * 1.2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, h, 2.2), new THREE.MeshStandardMaterial({ color: bookCols[(row * 10 + k) % bookCols.length], roughness: 0.6 }));
      b.position.set(-12 - 6 + k * 1.25, FLOOR + 1.8 + row * 5 + h / 2, -32.6);
      books.add(b);
    }
    const win = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ color: 0x24324a }));
    win.position.set(16, FLOOR + 12, -35.4);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ color: 0xfff4c8 }));
    moon.position.set(19, FLOOR + 14, -35.3);
    group.add(shelf, books, win, moon, tree(28, -22, 0.55, [0x3d8a3d]));
  }

  if (id === 'picnic') {
    floor.material.map = grassTex(); floor.material.needsUpdate = true;
    rug.visible = false;
    scene.background = new THREE.Color(0x9fd6ff);
    scene.fog = new THREE.Fog(0xcfeaff, 60, 150);
    hemi.color.set(0xffffff); hemi.groundColor.set(0x4a7a3a); hemi.intensity = 1.1;
    lamp.color.set(0xfff6e0); lamp.intensity = 1600;
    rim.color.set(0xffe2a8); rim.intensity = 1;
    // la nappe à carreaux sous la table
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshStandardMaterial({ map: checkerTex('#d7333b', '#fbf6ea'), roughness: 0.95 }));
    cloth.rotation.x = -Math.PI / 2; cloth.position.y = FLOOR + 0.03; cloth.receiveShadow = true;
    group.add(cloth);
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * Math.PI * 2 + Math.random() * 0.2, r = 40 + Math.random() * 30;
      group.add(tree(Math.cos(a) * r, Math.sin(a) * r, 0.8 + Math.random() * 0.6));
    }
    // des fleurs
    const flowerCols = [0xff5b8d, 0xffd34d, 0xffffff, 0xb38bff];
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 30;
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshStandardMaterial({ color: flowerCols[k % 4] }));
      f.position.set(Math.cos(a) * r, FLOOR + 0.3, Math.sin(a) * r);
      group.add(f);
    }
    // un panier
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.6, 2.2, 16), new THREE.MeshStandardMaterial({ color: 0xc08a4a, roughness: 0.9 }));
    basket.position.set(-20, FLOOR + 1.1, 12);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.15, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x9a6a34 }));
    handle.position.set(-20, FLOOR + 2.2, 12);
    group.add(basket, handle);
    // des nuages qui passent
    const clouds = [];
    for (let k = 0; k < 8; k++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + Math.random() * 3, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, emissive: 0x99aabb }));
        b.position.set(j * 5 - 7, Math.random() * 2, Math.random() * 3);
        c.add(b);
      }
      c.position.set(-120 + Math.random() * 240, 40 + Math.random() * 20, -90 + Math.random() * 60);
      c.scale.y = 0.6;
      clouds.push(c); group.add(c);
    }
    out.update = (dt) => clouds.forEach((c) => { c.position.x += dt * 2; if (c.position.x > 130) c.position.x = -130; });
  }

  if (id === 'plage') {
    floor.material.map = sandTex(); floor.material.needsUpdate = true;
    rug.visible = false;
    scene.background = new THREE.Color(0x7cc8f5);
    scene.fog = new THREE.Fog(0xbfe6ff, 70, 170);
    hemi.color.set(0xffffff); hemi.groundColor.set(0xd8b878); hemi.intensity = 1.2;
    lamp.color.set(0xfff4dc); lamp.intensity = 1700;
    rim.color.set(0xffd9a0); rim.intensity = 1.1;
    // la mer, avec des vagues qui bougent
    const seaGeo = new THREE.PlaneGeometry(400, 160, 80, 30);
    const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: 0x1e8fd0, roughness: 0.25, metalness: 0.1, flatShading: true }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, FLOOR - 0.3, -110);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(400, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    foam.rotation.x = -Math.PI / 2; foam.position.set(0, FLOOR + 0.02, -31);
    group.add(sea, foam);
    const base = seaGeo.attributes.position.array.slice();
    out.update = (dt, t) => {
      const pos = seaGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        pos.setZ(i, Math.sin(x * 0.08 + t * 1.3) * 0.5 + Math.cos(y * 0.12 + t) * 0.4);
      }
      pos.needsUpdate = true;
      foam.position.z = -31 + Math.sin(t * 0.8) * 1.5;
      foam.material.opacity = 0.45 + Math.sin(t * 0.8) * 0.25;
    };
    group.add(parasol(-22, 14), palm(26, -18, 1.2), palm(-30, -20, 1), palm(34, 20, 0.9));
    // une serviette et un ballon
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(6, 12), new THREE.MeshStandardMaterial({ map: checkerTex('#2068cf', '#ffffff') }));
    towel.rotation.set(-Math.PI / 2, 0, 0.4); towel.position.set(-24, FLOOR + 0.03, 6);
    const ballTex = canvasTex(128, 64, (c, w, h) => { ['#ff5b8d', '#ffffff', '#ffd34d', '#ffffff', '#2068cf', '#ffffff'].forEach((col, k) => { c.fillStyle = col; c.fillRect(k * w / 6, 0, w / 6 + 1, h); }); });
    ballTex.repeat.set(1, 1);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4 }));
    ball.position.set(22, FLOOR + 1.4, 8);
    group.add(towel, ball);
    // le soleil
    const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false }));
    sun.position.set(-60, 45, -150);
    group.add(sun);
  }

  if (id === 'nuit') {
    floor.material.map = grassTex('#1f3a24', '#18301d'); floor.material.needsUpdate = true;
    rug.visible = false;
    scene.background = new THREE.Color(0x0b1026);
    scene.fog = new THREE.Fog(0x0b1026, 50, 130);
    hemi.color.set(0x8090ff); hemi.groundColor.set(0x101820); hemi.intensity = 0.35;
    lamp.color.set(0xffd9a0); lamp.intensity = 900;
    rim.color.set(0x6a7cff); rim.intensity = 0.35;
    // des étoiles
    const starPos = [];
    for (let k = 0; k < 700; k++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, r = 180;
      starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false, transparent: true }));
    group.add(stars);
    // des guirlandes de lampions autour de la table
    const cols = [0xff5b8d, 0xffd34d, 0x4cc8ff, 0x7cff8a, 0xff9b1f];
    const lanterns = [];
    const poles = 6;
    for (let k = 0; k < poles; k++) {
      const a = (k / poles) * Math.PI * 2 + 0.3;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 16, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c }));
      pole.position.set(Math.cos(a) * 25, FLOOR + 8, Math.sin(a) * 25);
      group.add(pole);
      const b = ((k + 1) / poles) * Math.PI * 2 + 0.3;
      for (let j = 1; j < 8; j++) {
        const u = j / 8;
        const x = Math.cos(a) * 25 * (1 - u) + Math.cos(b) * 25 * u, z = Math.sin(a) * 25 * (1 - u) + Math.sin(b) * 25 * u;
        const y = FLOOR + 15.5 - Math.sin(u * Math.PI) * 3;
        const col = cols[(k * 7 + j) % cols.length];
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), new THREE.MeshBasicMaterial({ color: col }));
        l.position.set(x, y, z); l.scale.y = 1.25;
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false }));
        halo.position.copy(l.position);
        group.add(l, halo);
        lanterns.push({ l, halo, phase: Math.random() * 6 });
      }
    }
    // quelques lumières colorées sur la table
    [[0xff5b8d, 1], [0x4cc8ff, -1]].forEach(([c, s]) => {
      const pl = new THREE.PointLight(c, 120, 45, 1.6);
      pl.position.set(s * 14, 6, s * 6);
      group.add(pl);
    });
    // des lucioles
    const flies = [];
    for (let k = 0; k < 40; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0xeaff8a, transparent: true }));
      f.userData = { a: Math.random() * 6, r: 20 + Math.random() * 20, y: FLOOR + 1 + Math.random() * 6, s: 0.2 + Math.random() * 0.3 };
      flies.push(f); group.add(f);
    }
    out.update = (dt, t) => {
      lanterns.forEach((o) => { o.halo.material.opacity = 0.14 + Math.sin(t * 2 + o.phase) * 0.06; });
      flies.forEach((f) => {
        const u = f.userData; u.a += dt * u.s;
        f.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 1.7 + u.r) * 0.8, Math.sin(u.a) * u.r);
        f.material.opacity = 0.5 + Math.sin(t * 5 + u.r) * 0.5;
      });
      stars.material.opacity = 0.8 + Math.sin(t * 0.7) * 0.15;
    };
  }

  out.dispose = () => group.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
  return out;
}
