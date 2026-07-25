// Sanctum & Shadow — player-following sun shadows.
//
// WHY: the sun's shadow camera was a fixed 48x48 box centred on the world
// origin, while Vaelthar spans 84x108. Roughly 75% of the city therefore had
// NO shadows at all — walk away from the fountain and every object stops
// casting, which is what made props read as "pasted on" rather than standing
// on the ground.
//
// Rather than widen the frustum to cover the whole city (which would spread
// the same 2048 texels over 4x the area and make every shadow blocky), the
// box FOLLOWS the player. Same texel density, shadows everywhere.
//
// The classic artifact with a moving shadow camera is edge shimmer/crawl as
// the frustum slides. Fixed by snapping the camera origin to whole shadow
// texels, so the projected texel grid never moves sub-pixel between frames.
import * as THREE from 'three';

const EXTENT = { low: 26, medium: 34, high: 42 };   // half-size, in world units

export class ShadowFollow {
  constructor(engine) {
    this.engine = engine;
    this.target = new THREE.Vector3();
    this.lightOffset = new THREE.Vector3();
    this.elapsed = 0;
    this.extent = 0;
    const sun = engine.sunLight;
    // Remember the authored sun direction; we move the light but preserve it.
    if (sun) this.lightOffset.copy(sun.position);
  }

  applyExtent() {
    const engine = this.engine, sun = engine.sunLight;
    if (!sun || !sun.shadow) return;
    const quality = engine.worldPolish?.quality || 'medium';
    const extent = EXTENT[quality] ?? EXTENT.medium;
    if (extent === this.extent) return;
    this.extent = extent;
    const cam = sun.shadow.camera;
    cam.left = -extent; cam.right = extent;
    cam.top = extent; cam.bottom = -extent;
    cam.near = 0.5;
    cam.far = Math.max(120, this.lightOffset.length() * 2 + extent * 2);
    cam.updateProjectionMatrix();
  }

  update() {
    const engine = this.engine, sun = engine.sunLight;
    if (!sun || !sun.shadow || !engine.actor) return;
    this.applyExtent();

    // Snap the focus point to whole shadow texels to stop edge crawl.
    const mapSize = sun.shadow.mapSize.x || 2048;
    const texelWorldSize = (this.extent * 2) / mapSize;
    const p = engine.actor.position;
    const snappedX = Math.round(p.x / texelWorldSize) * texelWorldSize;
    const snappedZ = Math.round(p.z / texelWorldSize) * texelWorldSize;
    if (snappedX === this.target.x && snappedZ === this.target.z) return;
    this.target.set(snappedX, 0, snappedZ);

    // Keep the authored sun angle: light sits at focus + original offset.
    sun.position.copy(this.target).add(this.lightOffset);
    sun.target.position.copy(this.target);
    sun.target.updateMatrixWorld();
    sun.shadow.camera.updateProjectionMatrix();
  }
}
