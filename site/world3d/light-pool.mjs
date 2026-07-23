// Sanctum & Shadow — torch light pool, v2.
//
// The open city authors one PointLight per torch (20 in Vaelthar); in a
// forward renderer every lit fragment pays for every light, and changing the
// light COUNT recompiles shaders. This keeps a small FIXED pool re-aimed at
// the nearest torches: constant cost, no recompiles, distant torches keep
// their emissive flame cones.
//
// V2: the pool only engages when it actually reduces the light count
// (sources > pool size). Interiors with a handful of mood-critical lights
// (the tavern hearth, temple candles) are left completely untouched.
import * as THREE from 'three';

const POOL_SIZE = { low: 3, medium: 6, high: 10 };

export class TorchLightPool {
  constructor(engine) {
    this.engine = engine;
    this.sources = [];
    this.pool = [];
    this.elapsed = 0;
    this.tmp = new THREE.Vector3();
  }

  initialize() {
    const root = this.engine.zone && this.engine.zone.root;
    if (!root) return this;
    const found = [];
    root.traverse(o => { if (o.isPointLight) found.push(o); });
    const size = Math.min(found.length, POOL_SIZE[this.engine.worldPolish?.quality] ?? POOL_SIZE.medium);
    if (found.length <= size) return this;    // no win → leave the zone's lighting alone
    for (const o of found) {
      o.getWorldPosition(this.tmp);
      this.sources.push({
        position: this.tmp.clone(), color: o.color.clone(),
        intensity: o.intensity, distance: o.distance || 8, decay: o.decay ?? 2,
      });
      o.visible = false;
    }
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xff8b43, 0, 8, 2);
      light.castShadow = false;
      this.engine.scene.add(light);
      this.pool.push(light);
    }
    this.update(1, 0);                        // aim immediately — never a dark first frame
    return this;
  }

  update(dt, time) {
    if (!this.pool.length) return;
    this.elapsed += dt;
    const anchor = this.engine.actor ? this.engine.actor.position : this.engine.camera.position;
    if (this.elapsed >= 0.25) {
      this.elapsed = 0;
      const nearest = this.sources
        .map(s => ({ s, d: s.position.distanceToSquared(anchor) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, this.pool.length);
      for (let i = 0; i < this.pool.length; i++) {
        const light = this.pool[i], src = nearest[i] && nearest[i].s;
        if (!src) { light.intensity = 0; continue; }
        light.position.copy(src.position);
        light.color.copy(src.color);
        light.distance = src.distance;
        light.decay = src.decay;
        light.userData.base = src.intensity;
        light.userData.phase = (src.position.x * 7.13 + src.position.z * 3.71) % Math.PI;
      }
    }
    for (const light of this.pool) {
      const base = light.userData.base || 0;
      if (base) light.intensity = base + Math.sin(time * 8 + light.userData.phase) * base * 0.27;
    }
  }
}
