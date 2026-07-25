// Sanctum & Shadow — sky dome + image-based lighting.
//
// WHY: the scene background was a flat colour and scene.environment was null.
// A flat background gives no horizon, and with no environment map every PBR
// material is lit by the sun + hemisphere alone — stone and metal read as flat
// plastic. (character-actor.js already sets envMapIntensity=1.15, which did
// nothing without an environment.)
//
// SAFETY RULES:
//   · INTERIORS ARE NEVER TOUCHED. Every interior zone sets
//     root.userData.interior = true; those keep their authored flat backdrop
//     and lighting exactly as before. A sky inside a tavern would be absurd
//     and would fight the authored mood lighting.
//   · The gradient is DERIVED from the zone's own authored fog/background
//     colour, so each location keeps its identity (green-grey capital,
//     ochre wastes, etc). We add depth, we do not repaint the art direction.
//   · Everything is wrapped so a failure degrades to exactly today's look.
import * as THREE from 'three';

// Vertical gradient: zenith (darker, cooler) → horizon (the zone's own colour,
// lifted slightly) → ground haze (warmer). Painted into a 2xN canvas and
// mapped equirectangularly, so it costs one tiny texture and no geometry.
function gradientTexture(baseHex) {
  const base = new THREE.Color(baseHex);

  const zenith = base.clone().multiplyScalar(1.00);          // hold the authored tone overhead
  zenith.offsetHSL(0.02, 0.10, 0);                           // slightly cooler/bluer

  const horizon = base.clone().multiplyScalar(2.40);         // luminous horizon band
  horizon.offsetHSL(0, 0.05, 0.02);

  const nadir = base.clone().multiplyScalar(1.20);
  nadir.offsetHSL(-0.03, 0.02, 0);                           // warmer toward ground

  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#' + zenith.getHexString());
  grad.addColorStop(0.46, '#' + zenith.clone().lerp(horizon, 0.55).getHexString());
  grad.addColorStop(0.58, '#' + horizon.getHexString());     // horizon band
  grad.addColorStop(0.70, '#' + horizon.clone().lerp(nadir, 0.7).getHexString());
  grad.addColorStop(1.00, '#' + nadir.getHexString());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

export class SkyEnvironment {
  constructor(engine) {
    this.engine = engine;
    this.sky = null;
    this.envRT = null;
  }

  install() {
    const engine = this.engine, zone = engine.zone;
    if (!zone || !zone.root) return this;
    // Interiors keep their authored look, untouched.
    if (zone.root.userData && zone.root.userData.interior) return this;

    const baseHex = (zone.scene && zone.scene.background) || 0x1b2422;

    // 1. Sky dome behind the world.
    try {
      this.sky = gradientTexture(baseHex);
      engine.scene.background = this.sky;
    } catch (e) { /* keep the flat colour */ }

    // 2. Image-based lighting derived from that same sky, so reflections and
    //    ambient bounce agree with the backdrop. PMREM runs once at load.
    try {
      const pmrem = new THREE.PMREMGenerator(engine.renderer);
      pmrem.compileEquirectangularShader();
      this.envRT = pmrem.fromEquirectangular(this.sky || gradientTexture(baseHex));
      engine.scene.environment = this.envRT.texture;
      // IBL fills shadowed faces; the authored key lights are left untouched.
      engine.scene.environmentIntensity = 1.0;
      pmrem.dispose();
    } catch (e) { /* no IBL — exactly today's behaviour */ }

    return this;
  }

  dispose() {
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    if (this.sky) { this.sky.dispose(); this.sky = null; }
  }
}
