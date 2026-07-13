/* =========================================================================
   fx.js — atmosphere: ground fog, drifting smoke, flickering fire lights
   ========================================================================= */
import * as THREE from 'three';

// soft round particle sprite drawn in code
let _smokeTex;
function smokeTexture() {
  if (_smokeTex) return _smokeTex;
  const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(180,176,166,0.55)');
  g.addColorStop(0.5, 'rgba(140,136,126,0.22)');
  g.addColorStop(1, 'rgba(120,116,108,0)');
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  _smokeTex = new THREE.CanvasTexture(cv);
  return _smokeTex;
}

export class Atmosphere {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.lights = [];
    this.disposables = [];

    // ---- distance fog (grey morning, smoke-laden) ----
    scene.fog = new THREE.Fog(opts.fogColor ?? 0x8d877a, opts.fogNear ?? 16, opts.fogFar ?? 62);

    // ---- drifting smoke particles ----
    const N = opts.smoke ?? 220;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this.seed = new Float32Array(N);
    const R = opts.radius ?? 34;
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2 * R;
      pos[i * 3 + 1] = Math.random() * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * R;
      this.seed[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({
      map: smokeTexture(), size: opts.smokeSize ?? 3.4, transparent: true,
      opacity: opts.smokeOpacity ?? 0.16, depthWrite: false, sizeAttenuation: true,
      blending: THREE.NormalBlending, color: 0xb7b1a3
    });
    this.smoke = new THREE.Points(geo, pm);
    this.smoke.renderOrder = 2;
    scene.add(this.smoke);
    this.disposables.push(geo, pm);
    this._R = R;

    // ---- low ground fog: a few stretched translucent planes ----
    this.fogPlanes = [];
    const fpMat = new THREE.MeshBasicMaterial({ color: 0xb9b3a4, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
    this.disposables.push(fpMat);
    for (let i = 0; i < 3; i++) {
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), fpMat);
      fp.rotation.x = -Math.PI / 2; fp.position.y = 0.4 + i * 0.4;
      this.fogPlanes.push(fp); scene.add(fp); this.disposables.push(fp.geometry);
    }
  }

  // register a flickering fire light at a world position
  addFireLight(worldPos, { color = 0xff9b46, intensity = 1.6, dist = 12, kind = 'brazier' } = {}) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.copy(worldPos);
    if (kind === 'hearth' || kind === 'brazier') { l.castShadow = false; }
    this.scene.add(l);
    this.lights.push({ light: l, base: intensity, seed: Math.random() * 100, kind });
    return l;
  }

  update(dt, t) {
    // smoke rises + wraps
    const p = this.smoke.geometry.attributes.position;
    const arr = p.array;
    for (let i = 0; i < this.seed.length; i++) {
      const s = this.seed[i];
      arr[i * 3] += Math.sin(t * 0.2 + s) * dt * 0.25 + dt * 0.15;
      arr[i * 3 + 1] += dt * (0.18 + (s % 1) * 0.2);
      arr[i * 3 + 2] += Math.cos(t * 0.18 + s) * dt * 0.2;
      if (arr[i * 3 + 1] > 10) { arr[i * 3 + 1] = 0; arr[i * 3] = (Math.random() - 0.5) * 2 * this._R; arr[i * 3 + 2] = (Math.random() - 0.5) * 2 * this._R; }
      if (arr[i * 3] > this._R) arr[i * 3] = -this._R;
    }
    p.needsUpdate = true;

    // fog planes drift
    for (let i = 0; i < this.fogPlanes.length; i++) { this.fogPlanes[i].rotation.z = t * 0.01 * (i % 2 ? 1 : -1); }

    // fire flicker (intensity + flame scale)
    for (const f of this.lights) {
      const flick = 0.75 + Math.sin(t * (9 + f.seed)) * 0.12 + Math.sin(t * (23 + f.seed)) * 0.08 + Math.random() * 0.06;
      f.light.intensity = f.base * flick;
    }
  }

  // recenter the FX field on the player so smoke always surrounds them
  follow(pos) {
    for (const fp of this.fogPlanes) { fp.position.x = pos.x; fp.position.z = pos.z; }
  }

  dispose() {
    this.scene.fog = null;
    if (this.smoke) this.scene.remove(this.smoke);
    for (const fp of this.fogPlanes) this.scene.remove(fp);
    for (const f of this.lights) this.scene.remove(f.light);
    for (const d of this.disposables) { if (d && d.dispose) d.dispose(); }
    this.lights = []; this.fogPlanes = []; this.disposables = [];
  }
}
