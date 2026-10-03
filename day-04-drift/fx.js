// Drift · les particules : étincelles du dérapage, flammes du turbo, poussière sur l'herbe, fumée des pneus.
import * as THREE from 'three';

function softDot(size = 64) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

/** Un nuage de points : chaque particule a une position, une vitesse, une durée de vie, une couleur. */
class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.additive = additive;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.rgb = new Float32Array(max * 3);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: softDot() }, scale: { value: 400 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vColor; varying float vAlpha; uniform float scale;
        void main() {
          vColor = color; vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, gl_PointCoord);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(vColor, t.a * vAlpha);
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p, v, color, size, life, grow = 0) {
    const i = this.next; this.next = (i + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.rgb.set([color.r, color.g, color.b], i * 3);
    this.life[i] = this.maxLife[i] = life;
    this.base[i] = size; this.grow[i] = grow;
  }

  update(dt, gravity) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= gravity * dt;
      for (let a = 0; a < 3; a++) this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      this.size[i] = this.base[i] * (1 + this.grow[i] * (1 - k)) * (this.additive ? 0.3 + 0.7 * k : 1);
      this.alpha[i] = this.additive ? 1 : k * 0.55;
      for (let a = 0; a < 3; a++) this.col[i * 3 + a] = this.rgb[i * 3 + a] * (this.additive ? k : 1);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = g.attributes.alpha.needsUpdate = true;
  }
}

/**
 * Les traces de pneus : des bandes sombres posées sur la route derrière les roues arrière,
 * qui s'effacent doucement. Un seul maillage (un anneau de quads réutilisés).
 */
class Skids {
  constructor(scene, max = 1400) {
    this.max = max; this.next = 0;
    this.pos = new Float32Array(max * 4 * 3);
    this.alpha = new Float32Array(max * 4);
    this.age = new Float32Array(max).fill(99);
    const idx = [];
    for (let q = 0; q < max; q++) { const a = q * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'attribute float alpha; varying float vA; void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main() { gl_FragColor = vec4(0.12, 0.12, 0.14, vA); }',
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.last = new Map();   // kart → dernières positions des deux roues
  }
  quad(a, b) {   // une bande entre deux points au sol
    const q = this.next; this.next = (q + 1) % this.max;
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, w = 0.13;
    const nx = -dz / l * w, nz = dx / l * w, y = 0.025;
    this.pos.set([a.x + nx, y, a.z + nz, a.x - nx, y, a.z - nz, b.x + nx, y, b.z + nz, b.x - nx, y, b.z - nz], q * 12);
    this.age[q] = 0;
  }
  mark(kart, w1, w2) {
    const prev = this.last.get(kart);
    const now = [w1.clone(), w2.clone()];
    if (prev && prev[0].distanceToSquared(now[0]) > 0.04) { this.quad(prev[0], now[0]); this.quad(prev[1], now[1]); this.last.set(kart, now); }
    else if (!prev) this.last.set(kart, now);
  }
  lift(kart) { this.last.delete(kart); }
  update(dt) {
    for (let q = 0; q < this.max; q++) {
      this.age[q] += dt;
      const a = Math.max(0, 0.45 * (1 - this.age[q] / 7));   // 7 secondes pour disparaître
      for (let v = 0; v < 4; v++) this.alpha[q * 4 + v] = a;
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = g.attributes.alpha.needsUpdate = true;
  }
  clear() { this.age.fill(99); this.last.clear(); }
}

export class Fx {
  constructor(scene) {
    this.glow = new Pool(scene, 1400, true);   // étincelles, flammes, feux d'artifice
    this.dust = new Pool(scene, 500, false);   // poussière, fumée
    this.skids = new Skids(scene);
    this.rockets = [];
  }
  spark(p, v, color, size = 0.35, life = 0.35) { this.glow.emit(p, v, color, size, life); }
  puff(p, v, color, size = 0.8, life = 0.7) { this.dust.emit(p, v, color, size, life, 1.5); }
  /** Un feu d'artifice : une fusée monte puis éclate en étoile colorée. Renvoie la hauteur de l'explosion. */
  firework(at, color = new THREE.Color().setHSL(Math.random(), 1, 0.6)) {
    this.rockets.push({ p: at.clone(), v: new THREE.Vector3((Math.random() - 0.5) * 2, 22 + Math.random() * 6, (Math.random() - 0.5) * 2), t: 0.75 + Math.random() * 0.3, color });
  }
  update(dt) {
    this.rockets = this.rockets.filter((r) => {
      r.t -= dt; r.v.y -= 9 * dt; r.p.addScaledVector(r.v, dt);
      this.glow.emit(r.p, new THREE.Vector3(0, -2, 0), new THREE.Color(0xfff0c0), 0.5, 0.25);   // la traînée
      if (r.t > 0) return true;
      for (let k = 0; k < 70; k++) {   // l'explosion : une sphère de particules
        const v = new THREE.Vector3().randomDirection().multiplyScalar(9 + Math.random() * 4);
        this.glow.emit(r.p, v, k % 5 ? r.color : new THREE.Color(0xffffff), 0.9, 1.1 + Math.random() * 0.5);
      }
      this.onBoom?.();
      return false;
    });
    this.glow.update(dt, 9); this.dust.update(dt, -0.6); this.skids.update(dt);
  }
}
