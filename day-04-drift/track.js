// Drift · le circuit : une route fermée (courbe lisse), des vibreurs, des murets, et le décor autour.
import * as THREE from 'three';

export const ROAD = 7;      // demi-largeur de la route
export const WALL = 12.5;   // distance du centre aux murets (entre les deux : l'herbe, qui ralentit)
/** Où se dresse le podium : à côté de la piste, au point n° i. */
export const PODIUM = { i: 30, off: WALL + 9 };
const N = 1200;             // nombre de points de la ligne centrale

// le tracé, vu du ciel (x, z) : une longue ligne droite, un grand virage, des S et une épingle
const POINTS = [
  [-70, 92], [10, 95], [80, 90], [125, 62], [132, 18], [104, -10], [62, -6], [42, -36], [64, -72],
  [56, -112], [8, -128], [-40, -110], [-50, -70], [-22, -40], [-60, -12], [-112, -18], [-140, 22], [-124, 70],
];

function canvasTex(w, h, draw, repeat = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

export class Track {
  constructor(scene) {
    this.scene = scene;
    const curve = new THREE.CatmullRomCurve3(POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    this.length = curve.getLength();
    this.n = N;
    this.p = curve.getSpacedPoints(N).slice(0, N);
    this.t = this.p.map((_, i) => new THREE.Vector3().subVectors(this.p[(i + 1) % N], this.p[(i - 1 + N) % N]).normalize());
    this.nrm = this.t.map((t) => new THREE.Vector3(t.z, 0, -t.x));   // vers la gauche de la route
    this.step = this.length / N;
    // virages : de combien la route tourne dans les ~25 m à venir (signé)
    this.turn = this.t.map((t, i) => {
      const a = this.t[(i + Math.round(25 / this.step)) % N];
      return Math.atan2(t.x * a.z - t.z * a.x, t.x * a.x + t.z * a.z);
    });
    // les dalles d'accélération : [indice, décalage latéral]
    this.pads = [[0.06, -2.5], [0.1, 2.5], [0.43, 0], [0.71, -2], [0.88, 2.5]].map(([f, off]) => ({ i: Math.round(f * N), off }));

    this.buildSky();
    this.buildGround();
    this.buildRoad();
    this.buildWalls();
    this.buildStart();
    this.buildPads();
    // une rampe de saut (on peut y faire une figure)
    this.ramps = [{ i: Math.round(0.56 * N) }];
    this.buildRamps();
    this.buildBalloons();
    this.buildBunting();
    this.crowd = [];
    this.buildTrees();
    this.buildHills();
    this.buildClouds();
  }

  /** Le point de la ligne centrale le plus proche, en cherchant autour du dernier connu. */
  nearest(pos, hint = 0, span = 50) {
    let best = hint, bd = Infinity;
    for (let k = -span; k <= span; k++) {
      const i = (hint + k + N) % N, p = this.p[i];
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  /** Décalage latéral (positif = à gauche) par rapport à la ligne centrale. */
  lateral(pos, i) { return (pos.x - this.p[i].x) * this.nrm[i].x + (pos.z - this.p[i].z) * this.nrm[i].z; }
  /** Un point de la route : indice + décalage latéral. */
  at(i, off = 0, out = new THREE.Vector3()) {
    i = ((Math.round(i) % N) + N) % N;
    return out.copy(this.p[i]).addScaledVector(this.nrm[i], off);
  }
  heading(i) { const t = this.t[((Math.round(i) % N) + N) % N]; return Math.atan2(t.x, t.z); }

  /* ------------------------------------------------------------------ décor ------ */
  buildSky() {
    const geo = new THREE.SphereGeometry(600, 32, 16);
    const col = [], top = new THREE.Color(0x3d8fe8), mid = new THREE.Color(0x9fd6ff), low = new THREE.Color(0xe8f6ff);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 600;
      const c = y > 0.15 ? mid.clone().lerp(top, Math.min(1, (y - 0.15) / 0.6)) : low.clone().lerp(mid, Math.max(0, (y + 0.05) / 0.2));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.scene.add(this.sky);
  }

  buildGround() {
    // herbe tondue en bandes, comme dans les jeux de kart
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#62c24a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#58b442'; g.fillRect(0, 0, w, h / 2);
      for (let k = 0; k < 900; k++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '40,120,40' : '150,220,110'},${Math.random() * 0.25})`;
        g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
      }
    });
    tex.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    this.scene.add(ground);
  }

  /** Un ruban le long de la ligne centrale, entre deux décalages latéraux. */
  ribbon(offA, offB, y, vScale, colorAt) {
    const pos = [], uv = [], col = [], idx = [];
    let v = 0;
    for (let i = 0; i <= N; i++) {
      const k = i % N, p = this.p[k], n = this.nrm[k];
      pos.push(p.x + n.x * offA, y, p.z + n.z * offA, p.x + n.x * offB, y, p.z + n.z * offB);
      uv.push(0, v, 1, v);
      v += this.step / vScale;
      if (colorAt) { const c = colorAt(k); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (colorAt) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  buildRoad() {
    const asphalt = canvasTex(128, 512, (g, w, h) => {
      g.fillStyle = '#6d7480'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 2600; k++) {
        const s = 60 + Math.random() * 90;
        g.fillStyle = `rgba(${s},${s + 4},${s + 12},.35)`;
        g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      // lignes blanches sur les bords
      g.fillStyle = '#f4f4f0'; g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h);
    });
    const road = new THREE.Mesh(this.ribbon(ROAD, -ROAD, 0, 14), new THREE.MeshLambertMaterial({ map: asphalt, side: THREE.DoubleSide }));
    this.scene.add(road);
    // vibreurs rouges et blancs, des deux côtés
    const red = new THREE.Color(0xe8323c), white = new THREE.Color(0xf6f6f6);
    const stripe = (k) => (Math.floor(k / 3) % 2 ? red : white);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.scene.add(new THREE.Mesh(this.ribbon(ROAD + 1.3, ROAD, 0.012, 1, stripe), mat));
    this.scene.add(new THREE.Mesh(this.ribbon(-ROAD, -ROAD - 1.3, 0.012, 1, stripe), mat));
  }

  buildWalls() {
    // des murets bas, bleus et blancs (on rebondit dessus)
    const blue = new THREE.Color(0x2f6fe0), white = new THREE.Color(0xffffff);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (const side of [1, -1]) {
      const pos = [], col = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const k = i % N, p = this.p[k], n = this.nrm[k], o = side * (WALL + 0.4);
        const c = Math.floor(k / 6) % 2 ? blue : white;
        pos.push(p.x + n.x * o, 0, p.z + n.z * o, p.x + n.x * o, 0.9, p.z + n.z * o);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      this.scene.add(new THREE.Mesh(g, mat));
    }
  }

  buildStart() {
    // la ligne de départ en damier
    const checker = canvasTex(64, 16, (g, w, h) => {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) {
        g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 4, y * 4, 4, 4);
      }
    }, false);
    checker.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(ROAD * 2, 1.6), new THREE.MeshLambertMaterial({ map: checker }));
    line.rotation.set(-Math.PI / 2, 0, 0);
    const holder = new THREE.Group();
    holder.position.copy(this.p[0]).setY(0.02);
    holder.rotation.y = this.heading(0);
    line.rotation.z = 0;
    holder.add(line);

    // l'arche, avec la bannière et les feux du départ
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 7, 1), pillarMat);
      pillar.position.set(s * (WALL + 1), 3.5, 0);
      holder.add(pillar);
    }
    const banner = canvasTex(1024, 66, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#ff5b8d'); grd.addColorStop(1, '#e8325f');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.font = 'italic 900 50px Nunito, system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = '#a3123a';
      for (const [x, txt] of [[w / 2, 'MII KART'], [w * 0.16, 'DEVTOBER'], [w * 0.84, 'DRIFT']]) {
        g.fillStyle = txt === 'MII KART' ? '#fff' : '#ffe9a8';
        g.strokeText(txt, x, h / 2 + 3); g.fillText(txt, x, h / 2 + 3);
      }
    }, false);
    const top = new THREE.Mesh(new THREE.BoxGeometry(WALL * 2 + 3, 1.8, 0.5), [
      pillarMat, pillarMat, pillarMat, pillarMat,
      new THREE.MeshBasicMaterial({ map: banner }), new THREE.MeshBasicMaterial({ map: banner }),
    ]);
    top.position.set(0, 7.4, 0);
    holder.add(top);
    // les trois feux (rouge, rouge, vert) sous la bannière
    this.lights = [-1.4, 0, 1.4].map((x) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshBasicMaterial({ color: 0x331111 }));
      m.position.set(x, 6, -0.3);
      holder.add(m);
      return m;
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.3, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    box.position.set(0, 6, 0);
    holder.add(box);
    this.scene.add(holder);

    // la tribune, à droite de la ligne droite
    const stand = new THREE.Group();
    const steps = new THREE.MeshLambertMaterial({ color: 0xd8dde3 });
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(22, 0.7 + k * 0.9, 2.2), steps);
      b.position.set(0, (0.7 + k * 0.9) / 2, -k * 2.2);
      stand.add(b);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(23, 0.3, 8), new THREE.MeshLambertMaterial({ color: 0xff9b1f }));
    roof.position.set(0, 6.4, -2.4);
    stand.add(roof);
    for (const x of [-11, 11]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.4, 0.3), steps);
      post.position.set(x, 3.2, -5.6);
      stand.add(post);
    }
    const i = Math.round(N * 0.985);
    stand.position.copy(this.at(i, -(WALL + 4)));
    stand.rotation.y = this.heading(i) + Math.PI / 2;   // les gradins regardent la route
    this.stand = stand;
    this.scene.add(stand);
  }

  /** Allume les feux : n = nombre de feux allumés (3 = vert). */
  setLights(n) {
    this.lights.forEach((m, k) => {
      m.material.color.setHex(n >= 3 ? 0x33ff66 : k < n ? 0xff3030 : 0x331111);
    });
  }

  buildPads() {
    // dalles orange avec des chevrons qui défilent
    this.padTex = canvasTex(64, 128, (g, w, h) => {
      g.fillStyle = '#ff9b1f'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#fff3c8'; g.lineWidth = 9; g.lineJoin = 'round';
      for (const y of [30, 90]) { g.beginPath(); g.moveTo(10, y + 18); g.lineTo(32, y - 6); g.lineTo(54, y + 18); g.stroke(); }
    });
    this.padTex.repeat.set(1, 2);
    const mat = new THREE.MeshBasicMaterial({ map: this.padTex });
    for (const pad of this.pads) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), mat);
      m.rotation.x = -Math.PI / 2;
      const holder = new THREE.Group();
      holder.position.copy(this.at(pad.i, pad.off)).setY(0.03);
      holder.rotation.y = this.heading(pad.i);
      holder.add(m);
      this.scene.add(holder);
    }
  }

  /** Une fonction rapide : est-on loin de toute la route ? (pour placer le décor) */
  clearOfRoad(x, z, margin) {
    for (let i = 0; i < N; i += 6) {
      const p = this.p[i];
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < margin * margin) return false;
    }
    return true;
  }

  buildTrees() {
    // des arbres ronds, façon jouet
    const spots = [];
    let tries = 0;
    // pas d'arbre sur le podium de l'arrivée (ni dans le cercle de la caméra qui tourne autour)
    const podium = this.at(PODIUM.i, PODIUM.off);
    while (spots.length < 220 && tries++ < 6000) {
      const x = -230 + Math.random() * 420, z = -210 + Math.random() * 370;
      if (this.clearOfRoad(x, z, WALL + 5) && Math.hypot(x - podium.x, z - podium.z) > 15) spots.push([x, z, 0.8 + Math.random() * 0.8]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 7), new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), spots.length);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshLambertMaterial({ flatShading: true }), spots.length);
    const m = new THREE.Matrix4(), greens = [0x3f9f3a, 0x4cb847, 0x2f8a3a, 0x6cc24a, 0x2a7a40];
    spots.forEach(([x, z, s], k) => {
      m.makeScale(s, s, s).setPosition(x, 1.2 * s, z); trunk.setMatrixAt(k, m);
      m.makeScale(s, s * 1.1, s).setPosition(x, 3.6 * s, z); crown.setMatrixAt(k, m);
      crown.setColorAt(k, new THREE.Color(greens[k % greens.length]));
    });
    this.scene.add(trunk, crown);
    // petite ombre ronde sous chaque arbre
    const shade = new THREE.InstancedMesh(new THREE.CircleGeometry(2, 16), new THREE.MeshBasicMaterial({ color: 0x1d5a1d, transparent: true, opacity: 0.35, depthWrite: false }), spots.length);
    spots.forEach(([x, z, s], k) => {
      m.makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(s, 1, s)).setPosition(x, 0.01, z);
      shade.setMatrixAt(k, m);
    });
    this.scene.add(shade);
  }

  buildHills() {
    // des collines au loin, tout autour
    const cols = [0x5fb34f, 0x4d9f48, 0x7cc35a, 0x8fb8d8];
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2 + Math.random() * 0.2, r = 300 + Math.random() * 80;
      const far = k % 3 === 0;
      const h = far ? 90 + Math.random() * 60 : 30 + Math.random() * 40;
      const hill = new THREE.Mesh(
        far ? new THREE.ConeGeometry(70 + Math.random() * 40, h, 7) : new THREE.SphereGeometry(55 + Math.random() * 30, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: far ? cols[3] : cols[k % 3], flatShading: true }),
      );
      hill.position.set(Math.cos(a) * r - 10, far ? h / 2 - 5 : -5, Math.sin(a) * r - 20);
      if (!far) hill.scale.y = h / 60;
      this.scene.add(hill);
    }
  }

  buildClouds() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8899aa, flatShading: true });
    this.clouds = [];
    for (let k = 0; k < 14; k++) {
      const c = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + Math.random() * 5, 1), mat);
        s.position.set(j * 8 - 12, Math.random() * 3, Math.random() * 5);
        c.add(s);
      }
      c.position.set(-300 + Math.random() * 600, 70 + Math.random() * 40, -300 + Math.random() * 600);
      c.scale.y = 0.6;
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  /** La rampe : un plan incliné rayé jaune et noir, sur toute la largeur de la route. */
  buildRamps() {
    const tex = canvasTex(64, 64, (g, w, h) => {
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#1d1d22' : '#ffc21a'; g.fillRect(k * 8, 0, 8, h); }
    });
    tex.repeat.set(4, 1);
    const side = new THREE.Shape();
    side.moveTo(0, 0); side.lineTo(4.5, 0); side.lineTo(4.5, 0.6); side.closePath();
    const geo = new THREE.ExtrudeGeometry(side, { depth: ROAD * 2 + 1, bevelEnabled: false });
    geo.translate(0, 0, -(ROAD * 2 + 1) / 2);
    geo.rotateY(-Math.PI / 2);
    for (const r of this.ramps) {
      const m = new THREE.Mesh(geo, [new THREE.MeshLambertMaterial({ map: tex }), new THREE.MeshLambertMaterial({ color: 0x3a3a44 })]);
      m.position.copy(this.at(r.i, 0)).setY(0.01);
      m.rotation.y = this.heading(r.i);
      this.scene.add(m);
    }
  }

  /** Des grappes de ballons le long de la ligne droite du départ. */
  buildBalloons() {
    const cols = [0xff5b8d, 0xffd23a, 0x4aa8ff, 0x39c27a, 0x9a6bff, 0xff9b1f];
    this.balloons = [];
    const string = new THREE.LineBasicMaterial({ color: 0xffffff });
    for (let k = -6; k <= 6; k++) {
      const i = (k * 22 + N) % N;
      for (const s of [1, -1]) {
        const base = this.at(i, s * (WALL + 1.2));
        const group = new THREE.Group();
        group.position.copy(base);
        for (let b = 0; b < 3; b++) {
          const top = new THREE.Vector3((b - 1) * 0.6, 4.2 + b * 0.5, (b % 2) * 0.4);
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), new THREE.MeshStandardMaterial({ color: cols[(k + b + 6 + (s > 0 ? 3 : 0)) % cols.length], roughness: 0.25 }));
          ball.scale.y = 1.2; ball.position.copy(top);
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.9, 0), top.clone().setY(top.y - 0.6)]), string);
          group.add(ball, line);
        }
        this.scene.add(group);
        this.balloons.push({ group, phase: Math.random() * 6 });
      }
    }
  }

  /** Des guirlandes de petits drapeaux tendues au-dessus de la piste. */
  buildBunting() {
    const cols = [0xff5b8d, 0xffd23a, 0x4aa8ff, 0x39c27a, 0xffffff];
    const pole = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const flagGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.35, 0, 0), new THREE.Vector3(0.35, 0, 0), new THREE.Vector3(0, -0.8, 0)]);
    flagGeo.computeVertexNormals();
    this.flags = [];
    for (const f of [0.25, 0.42, 0.66, 0.84]) {
      const i = Math.round(f * N);
      const a = this.at(i, WALL + 0.8), b = this.at(i, -(WALL + 0.8));
      for (const p of [a, b]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7.5, 8), pole);
        m.position.copy(p).setY(3.75); this.scene.add(m);
      }
      const n = 18;
      for (let k = 1; k < n; k++) {
        const u = k / n;
        const p = new THREE.Vector3().lerpVectors(a, b, u);
        p.y = 7.2 - Math.sin(u * Math.PI) * 1.4;   // la guirlande pend au milieu
        const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: cols[k % cols.length], side: THREE.DoubleSide }));
        flag.position.copy(p);
        flag.rotation.y = this.heading(i);
        this.scene.add(flag);
        this.flags.push({ flag, phase: k * 0.7 });
      }
    }
  }

  /** Le public le long de la piste : des Mii (leur tête en image) qui sautent quand tu passes. */
  buildCrowd(icons) {
    const loader = new THREE.TextureLoader();
    const textures = icons.map((src) => { const t = loader.load(src); t.colorSpace = THREE.SRGBColorSpace; return t; });
    const bodyGeo = new THREE.CapsuleGeometry(0.45, 0.7, 4, 10);
    const cols = [0xff5b8d, 0xffd23a, 0x4aa8ff, 0x39c27a, 0x9a6bff, 0xff9b1f, 0xffffff];
    let n = 0;
    for (const [f, side] of [[0.15, 1], [0.15, -1], [0.45, -1], [0.7, 1], [0.93, 1]]) {
      const i0 = Math.round(f * N);
      for (let k = 0; k < 9; k++) {
        const p = this.at(i0 + k * 4, side * (WALL + 2.2 + (k % 2) * 1.3));
        const g = new THREE.Group();
        const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: cols[n % cols.length] }));
        body.position.y = 0.9;
        const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[n % textures.length] }));
        head.scale.setScalar(1.5); head.position.y = 2.3;
        g.add(body, head);
        g.position.copy(p);
        this.scene.add(g);
        this.crowd.push({ g, base: p.clone(), phase: Math.random() * 6, excite: 0 });
        n++;
      }
    }
  }

  /** Le public saute quand un kart précis (le joueur) passe près de lui ; le feu d'artifice le fait aussi sauter. */
  cheer(seconds = 3) { for (const c of this.crowd) c.excite = Math.max(c.excite, seconds); }

  update(dt, t, focus = null) {
    this.padTex.offset.y = -t * 2.2;
    for (const c of this.clouds) { c.position.x += dt * 2; if (c.position.x > 320) c.position.x = -320; }
    for (const b of this.balloons) { b.group.position.y = Math.sin(t * 1.3 + b.phase) * 0.25; b.group.rotation.z = Math.sin(t * 0.9 + b.phase) * 0.06; }
    for (const f of this.flags) f.flag.rotation.x = Math.sin(t * 3 + f.phase) * 0.35;
    for (const c of this.crowd) {
      if (focus && c.base.distanceToSquared(focus) < 28 * 28) c.excite = Math.max(c.excite, 1.2);
      c.excite = Math.max(0, c.excite - dt);
      const jump = c.excite > 0 ? Math.abs(Math.sin(t * 9 + c.phase)) * 0.9 : Math.abs(Math.sin(t * 2 + c.phase)) * 0.08;
      c.g.position.y = c.base.y + jump;
    }
  }
}
