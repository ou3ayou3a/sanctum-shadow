// Sanctum & Shadow — torch light pool.
//
// The city authors one PointLight per torch (20 in Vaelthar). In a forward
// renderer every lit fragment pays for every light in range, and any change
// to the NUMBER of lights forces a shader recompile. So instead of 20
// always-on lights, we keep a small FIXED pool that is re-aimed at the
// nearest torches each few frames: constant shader cost, no recompiles,
// identical look — distant torches keep their emissive flame cones, which
// is all you can see from far away anyway.
import * as THREE from 'three';

const POOL_SIZE = { low: 3, medium: 6, high: 10 };

export class TorchLightPool {
  constructor(engine) {
    this.engine = engine;
    this.sources = [];      // {position, color, intensity, distance, decay}
    this.pool = [];
    this.elapsed = 0;
    this.tmp = new THREE.Vector3();
  }

  // Adopt every PointLight in the zone: record it as a source, hide the
  // original. Zone flicker code that mutates the originals becomes a no-op.
  initialize() {
    const root = this.engine.zone && this.engine.zone.root;
    if (!root) return this;
    root.traverse(o => {
      if (o.isPointLight) {
        o.getWorldPosition(this.tmp);
        this.sources.push({
          position: this.tmp.clone(), color: o.color.clone(),
          intensity: o.intensity, distance: o.distance || 8, decay: o.decay ?? 2,
        });
        o.visible = false;
      }
    });
    const size = Math.min(this.sources.length,
      POOL_SIZE[this.engine.worldPolish?.quality] ?? POOL_SIZE.medium);
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xff8b43, 0, 8, 2);
      light.castShadow = false;
      this.engine.scene.add(light);
      this.pool.push(light);
    }
    return this;
  }

  update(dt, time) {
    if (!this.pool.length) return;
    this.elapsed += dt;
    const anchor = this.engine.actor ? this.engine.actor.position : this.engine.camera.position;
    if (this.elapsed >= 0.25) {
      this.elapsed = 0;
      // Re-aim the pool at the nearest sources.
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
    // Cheap per-frame flicker (replaces the zone's own, which now drives hidden lights).
    for (const light of this.pool) {
      const base = light.userData.base || 0;
      if (base) light.intensity = base + Math.sin(time * 8 + light.userData.phase) * base * 0.27;
    }
  }
}
