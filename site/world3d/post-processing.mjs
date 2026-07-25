// Sanctum & Shadow — post-processing stack.
//
// The renderer drew straight to the canvas with no post at all, which is why
// torches, holy auras and the whole divinity FX layer never GLOWED — they were
// just bright pixels — and why objects never got contact shading where they
// meet the ground.
//
// The chain (in order):
//   RenderPass   → the scene
//   GTAO         → ambient occlusion: contact darkening in crevices and where
//                  objects meet the ground. Shadow maps cannot do this.
//   UnrealBloom  → light bleed on anything brighter than the threshold, so
//                  flames, emissive trim and divine FX actually radiate.
//   OutputPass   → tone mapping + colour space (replaces the renderer's own,
//                  which must be neutralised while the composer is active).
//   Grade        → filmic grade + vignette in one cheap fragment pass.
//   SMAA         → edge antialiasing (MSAA does not survive a composer chain).
//
// COST CONTROL: the whole stack is gated on the existing quality setting.
//   low    → disabled entirely, renderer draws direct (identical to today)
//   medium → bloom + grade + SMAA, no AO
//   high   → everything
// Any failure anywhere falls back to direct rendering, so the worst case is
// exactly the current look rather than a black screen.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

// Filmic grade + vignette. Deliberately gentle: this is a mood pass, not a
// repaint. Shadows get a cool lift, highlights a warm one — the classic
// candle-in-a-cold-city split that suits the setting.
const GradeShader = {
  uniforms: {
    tDiffuse:      { value: null },
    uVignette:     { value: 0.62 },   // 0 = none, 1 = heavy
    uShadowTint:   { value: new THREE.Color(0x1d2a3a) },
    uHighlightTint:{ value: new THREE.Color(0xffd9a8) },
    uGradeAmount:  { value: 0.16 },
    uSaturation:   { value: 1.12 },
    uContrast:     { value: 1.06 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette, uGradeAmount, uSaturation, uContrast;
    uniform vec3 uShadowTint, uHighlightTint;
    varying vec2 vUv;
    void main(){
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;

      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // Split-tone: push shadows cool, highlights warm.
      vec3 tint = mix(uShadowTint, uHighlightTint, smoothstep(0.15, 0.85, luma));
      c = mix(c, c * tint * 2.0, uGradeAmount);

      // Saturation and contrast around mid grey.
      c = mix(vec3(luma), c, uSaturation);
      c = (c - 0.5) * uContrast + 0.5;

      // Vignette: radial falloff from centre.
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * uVignette * 2.0;
      c *= clamp(vig, 0.0, 1.0);

      gl_FragColor = vec4(max(c, 0.0), texel.a);
    }
  `,
};

export class PostProcessing {
  constructor(engine) {
    this.engine = engine;
    this.composer = null;
    this.bloom = null;
    this.gtao = null;
    this.grade = null;
    this.smaa = null;
    this.enabled = false;
    this.quality = null;
    this._originalToneMapping = engine.renderer.toneMapping;
    this._originalExposure = engine.renderer.toneMappingExposure;
  }

  // Build (or rebuild) the chain for the current quality level.
  build() {
    const engine = this.engine;
    const quality = engine.worldPolish?.quality || 'medium';
    if (quality === this.quality && this.composer) return this;
    this.quality = quality;
    this.dispose();

    if (quality === 'low') { this.restoreDirect(); return this; }

    try {
      const renderer = engine.renderer;
      const size = renderer.getSize(new THREE.Vector2());
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(size.x, size.y);

      composer.addPass(new RenderPass(engine.scene, engine.camera));

      // Ambient occlusion — high only; it is the most expensive pass here.
      if (quality === 'high') {
        try {
          const gtao = new GTAOPass(engine.scene, engine.camera, size.x, size.y);
          gtao.output = GTAOPass.OUTPUT.Default;
          if (gtao.updateGtaoMaterial) {
            gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.0, thickness: 1.0, scale: 1.0, samples: 12 });
          }
          gtao.blendIntensity = 0.85;
          composer.addPass(gtao);
          this.gtao = gtao;
        } catch (e) { /* AO is optional */ }
      }

      // Bloom: threshold high enough that only flames, emissive trim and the
      // divinity FX bleed — never the whole scene.
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(size.x, size.y),
        quality === 'high' ? 0.62 : 0.5,   // strength
        0.72,                              // radius
        0.78                               // threshold
      );
      composer.addPass(bloom);
      this.bloom = bloom;

      // Tone mapping now happens in the chain, so the renderer must stop
      // doing it or the image is tone mapped twice (washed out).
      const output = new OutputPass();
      composer.addPass(output);
      renderer.toneMapping = THREE.NoToneMapping;

      const grade = new ShaderPass(GradeShader);
      composer.addPass(grade);
      this.grade = grade;

      const smaa = new SMAAPass(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio());
      composer.addPass(smaa);
      this.smaa = smaa;

      this.composer = composer;
      this.enabled = true;
    } catch (e) {
      console.warn('post-processing unavailable; rendering direct', e);
      this.restoreDirect();
    }
    return this;
  }

  // Interiors are authored dark and moody; a heavy vignette on top of that
  // crushes them. Soften the grade indoors instead of disabling the chain.
  applyZoneMood() {
    if (!this.grade) return;
    const interior = !!(this.engine.zone?.root?.userData?.interior);
    this.grade.uniforms.uVignette.value = interior ? 0.34 : 0.62;
    this.grade.uniforms.uGradeAmount.value = interior ? 0.10 : 0.16;
    if (this.bloom) this.bloom.threshold = interior ? 0.68 : 0.78;  // let hearths bloom
  }

  restoreDirect() {
    const renderer = this.engine.renderer;
    renderer.toneMapping = this._originalToneMapping;
    renderer.toneMappingExposure = this._originalExposure;
    this.enabled = false;
  }

  setSize(width, height) {
    if (!this.composer) return;
    const pr = this.engine.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(width, height);
    if (this.smaa && this.smaa.setSize) this.smaa.setSize(width * pr, height * pr);
    if (this.gtao && this.gtao.setSize) this.gtao.setSize(width, height);
  }

  render() {
    if (!this.enabled || !this.composer) return false;
    try { this.composer.render(); return true; }
    catch (e) { console.warn('post chain failed; falling back to direct render', e); this.restoreDirect(); return false; }
  }

  dispose() {
    if (this.composer) {
      try {
        for (const pass of this.composer.passes) pass.dispose && pass.dispose();
        this.composer.renderTarget1?.dispose();
        this.composer.renderTarget2?.dispose();
      } catch (e) { /* ignore */ }
    }
    this.composer = null; this.bloom = null; this.gtao = null; this.grade = null; this.smaa = null;
  }
}
