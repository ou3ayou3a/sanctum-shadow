// ============================================
//   SANCTUM & SHADOW — VISUALS ENGINE
//   Phase 1: NPC Portraits
//   Phase 2: Spell / Combat VFX (Lottie)
//   Phase 3: Location Background Art
// ============================================

// ─── PHASE 3: LOCATION BACKGROUNDS ──────────
// Maps location IDs to background images.
// DROP your Midjourney images into site/art/locations/
// Filenames must match the keys below exactly.
// Until you have real art, atmospheric CSS gradients are used as fallbacks.

const LOCATION_BACKGROUNDS = {
  vaelthar_city:     { img: 'art/locations/vaelthar_city.jpg',    gradient: 'linear-gradient(160deg, #0a0604 0%, #1a0e08 40%, #0d0906 100%)',       prompt: 'dark gothic medieval city at night, crumbling spires, torchlight, fog, Divinity Original Sin art style' },
  vaelthar_slums:    { img: 'art/locations/vaelthar_city.jpg',    gradient: 'linear-gradient(160deg, #050305 0%, #120a14 40%, #060308 100%)',       prompt: 'dark fantasy slum district, rain-soaked cobblestones, shadowy alleys, desperate faces, torches' },
  vaelthar_docks:    { img: 'art/locations/vaelthar_city.jpg',    gradient: 'linear-gradient(160deg, #040608 0%, #08111a 40%, #040507 100%)',       prompt: 'dark harbour at night, black water, moored ships, fog rolling in, ominous lanterns' },
  temple_quarter:    { img: 'art/locations/vaelthar_city.jpg',    gradient: 'linear-gradient(160deg, #080608 0%, #160d10 40%, #090508 100%)',       prompt: 'oppressive gothic cathedral quarter, blood-red stained glass, flagellant monks, heavy incense smoke' },
  covenant_hall:     { img: 'art/locations/vaelthar_city.jpg',    gradient: 'linear-gradient(160deg, #100608 0%, #1e0a0d 40%, #0c0507 100%)',       prompt: 'vast cathedral interior, candle-lit altar, dark ceremony, sinister religious iconography, stone columns' },
  thornwood_gate:    { img: 'art/locations/thornwood_forest.jpg', gradient: 'linear-gradient(160deg, #040806 0%, #0a1408 40%, #040705 100%)',       prompt: 'fortified gate at the edge of a dark forest, guards, fog, old stone walls, threatening sky' },
  thornwood_forest:  { img: 'art/locations/thornwood_forest.jpg', gradient: 'linear-gradient(160deg, #030703 0%, #071008 40%, #040804 100%)',       prompt: 'ancient dark forest, gnarled roots, mist between black trees, bioluminescent fungi, eerie silence' },
  thornwood_passage: { img: 'art/locations/thornwood_forest.jpg', gradient: 'linear-gradient(160deg, #030703 0%, #071008 40%, #040804 100%)',       prompt: 'dark forest passage' },
  thornwood_hut:     { img: 'art/locations/thornwood_forest.jpg', gradient: 'linear-gradient(160deg, #030703 0%, #071008 40%, #040804 100%)',       prompt: 'isolated hut deep in cursed forest' },
  monastery_aldric:  { img: 'art/locations/catacombs.jpg',        gradient: 'linear-gradient(160deg, #080808 0%, #121012 40%, #080608 100%)',       prompt: 'abandoned monastery on a clifftop, broken arches, moonlight through stone windows, overgrown courtyard' },
  monastery_cellar:  { img: 'art/locations/catacombs.jpg',        gradient: 'linear-gradient(160deg, #020202 0%, #0a0608 40%, #030202 100%)',       prompt: 'dark monastery cellar, stone vaults, candles, forbidden relics' },
  catacombs:         { img: 'art/locations/catacombs.jpg',        gradient: 'linear-gradient(160deg, #020202 0%, #0a0608 40%, #030202 100%)',       prompt: 'deep underground catacombs, skull-lined walls, torchlight, dripping water, ancient carvings' },
  shadow_reaches:    { img: 'art/locations/shadow_reaches.jpg',   gradient: 'linear-gradient(160deg, #020206 0%, #06060f 40%, #020205 100%)',       prompt: 'dark corrupted wasteland, void tears in sky, floating rocks, purple-black energy, desolate ruins' },
  void_citadel:      { img: 'art/locations/void_citadel.jpg',     gradient: 'linear-gradient(160deg, #030108 0%, #0a0415 40%, #040108 100%)',       prompt: 'impossible citadel floating in void, obsidian towers, crackling dark energy, eternal twilight' },
  shattered_realm:   { img: 'art/locations/shattered_realm.jpg',  gradient: 'linear-gradient(160deg, #080404 0%, #180808 40%, #090404 100%)',       prompt: 'fractured divine realm, broken golden architecture, divine light corrupted red, chaos and order colliding' },
};

function applyLocationBackground(locationId) {
  const bg = LOCATION_BACKGROUNDS[locationId];
  if (!bg) return;

  const gameLog = document.getElementById('game-log');
  const centerPanel = document.querySelector('.center-panel');
  if (!centerPanel) return;

  // Try real image first, fall back to gradient
  const img = new Image();
  img.onload = () => {
    centerPanel.style.setProperty('--loc-bg', `url('${bg.img}')`);
    centerPanel.classList.add('has-bg-image');
  };
  img.onerror = () => {
    centerPanel.style.setProperty('--loc-bg', bg.gradient);
    centerPanel.classList.remove('has-bg-image');
  };
  img.src = bg.img;

  // Animate transition
  centerPanel.classList.add('bg-transitioning');
  setTimeout(() => centerPanel.classList.remove('bg-transitioning'), 600);
}

// Hook into travelToLocation
const _origTravelVisuals = window.travelToLocation;
window.travelToLocation = function(loc) {
  if (_origTravelVisuals) _origTravelVisuals(loc);
  applyLocationBackground(loc?.id || loc);
};

// Apply on load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const locId = window.mapState?.currentLocation || 'vaelthar_city';
    applyLocationBackground(locId);
  }, 1000);
});

// ─── PHASE 1: NPC PORTRAITS ──────────────────
// Maps NPC IDs to portrait images.
// DROP your Midjourney portraits into site/art/portraits/
// Each should be ~300×400px, dark fantasy painterly style.

const NPC_PORTRAITS = {
  captain_rhael:    { img: 'art/portraits/captain_rhael.jpg',    prompt: 'stern weathered male city guard captain, dark armour with city crest, piercing grey eyes, scar on jaw, oil painting style, dark fantasy' },
  sister_mourne:    { img: 'art/portraits/sister_mourne.jpg',    prompt: 'pale haunted female cleric, black robes with blood-red trim, hollow dark eyes, candle shadows, sinister beauty, oil painting dark fantasy' },
  elder_varek:      { img: 'art/portraits/elder_varek.jpg',      prompt: 'powerful menacing elder, deep crimson robes, shaved head with ritual tattoos, orange fire in eyes, commanding and terrifying, oil painting' },
  the_voice_below:  { img: 'art/portraits/voice_below.jpg',      prompt: 'faceless void entity, swirling darkness where face should be, tendrils of shadow, ancient cosmic horror, dark fantasy art' },
  harren_fallen:    { img: 'art/portraits/harren_fallen.jpg',    prompt: 'corrupted fallen knight, cracked black plate armour, bleeding eyes, holy symbols defaced, tragic nobility, oil painting dark fantasy' },
  trembling_scribe: { img: 'art/portraits/trembling_scribe.jpg', prompt: 'nervous terrified young scribe, ink-stained fingers, wide fearful eyes, crumpled documents, candlelight, dark fantasy' },
};

// Called from dialogue.js conv panel render — upgrade emoji to real portrait
function getPortraitHTML(npcIdOrPortrait, npcName) {
  // Look up by id first
  const entry = NPC_PORTRAITS[npcIdOrPortrait] || NPC_PORTRAITS[
    Object.keys(NPC_PORTRAITS).find(k => npcName?.toLowerCase().includes(k.replace(/_/g,' ')))
  ];

  if (!entry) {
    // Fallback: big emoji in styled frame
    return `<div class="npc-portrait-emoji">${npcIdOrPortrait || '👤'}</div>`;
  }

  return `
    <div class="npc-portrait-wrap">
      <img src="${entry.img}"
           alt="${npcName}"
           class="npc-portrait-img"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="npc-portrait-emoji" style="display:none">${npcIdOrPortrait || '👤'}</div>
      <div class="npc-portrait-vignette"></div>
    </div>
  `;
}
window.getPortraitHTML = getPortraitHTML;

// ─── PHASE 2: SPELL / COMBAT VFX ─────────────
// Uses LottieFiles CDN for zero-install animations.
// Falls back to pure CSS if CDN unavailable.

// VFX map: spell id / trigger → animation config
const VFX_MAP = {
  // Player spells
  fireball:          { type: 'lottie', src: 'https://assets2.lottiefiles.com/packages/lf20_sy6aqxft.json', color: '#ff4400', duration: 1200, css: 'vfx-fire' },
  magic_missile:     { type: 'lottie', src: 'https://assets2.lottiefiles.com/packages/lf20_xvmprldh.json', color: '#7b68ee', duration: 800,  css: 'vfx-arcane' },
  chain_lightning:   { type: 'lottie', src: 'https://assets9.lottiefiles.com/packages/lf20_jbrw3hcz.json', color: '#00cfff', duration: 1000, css: 'vfx-lightning' },
  divine_strike:     { type: 'css',    color: '#fff9c4', duration: 700,  css: 'vfx-holy' },
  holy_smite:        { type: 'css',    color: '#fff9c4', duration: 700,  css: 'vfx-holy' },
  judgment:          { type: 'css',    color: '#ffd700', duration: 900,  css: 'vfx-holy' },
  wrath_divine:      { type: 'css',    color: '#ffff00', duration: 1100, css: 'vfx-holy-big' },
  cure_wounds:       { type: 'css',    color: '#4caf50', duration: 700,  css: 'vfx-heal' },
  mass_heal:         { type: 'css',    color: '#81c784', duration: 900,  css: 'vfx-heal-big' },
  lay_on_hands:      { type: 'css',    color: '#4caf50', duration: 700,  css: 'vfx-heal' },
  war_cry:           { type: 'css',    color: '#ff6b35', duration: 600,  css: 'vfx-buff' },
  execute:           { type: 'css',    color: '#c0392b', duration: 500,  css: 'vfx-slash' },
  phantom_kill:      { type: 'css',    color: '#2c2c54', duration: 800,  css: 'vfx-shadow' },
  smoke_bomb:        { type: 'css',    color: '#95a5a6', duration: 900,  css: 'vfx-smoke' },
  shadow_step:       { type: 'css',    color: '#1a1a2e', duration: 600,  css: 'vfx-shadow' },
  vine_trap:         { type: 'css',    color: '#27ae60', duration: 700,  css: 'vfx-nature' },
  mirror_image:      { type: 'css',    color: '#8e44ad', duration: 800,  css: 'vfx-arcane' },
  whirlwind:         { type: 'css',    color: '#e67e22', duration: 700,  css: 'vfx-slash' },
  disintegrate:      { type: 'css',    color: '#8e44ad', duration: 1200, css: 'vfx-arcane-big' },
  // Enemy spells
  hellfire_bolt:     { type: 'css',    color: '#c0392b', duration: 700,  css: 'vfx-fire' },
  shadow_drain:      { type: 'css',    color: '#2c2c54', duration: 800,  css: 'vfx-shadow' },
  soul_rend:         { type: 'css',    color: '#8e44ad', duration: 900,  css: 'vfx-shadow-big' },
  void_scream:       { type: 'css',    color: '#1a1a2e', duration: 1000, css: 'vfx-shadow-big' },
  divine_wrath:      { type: 'css',    color: '#ffd700', duration: 900,  css: 'vfx-holy' },
  // Combat hits
  hit:               { type: 'css',    color: '#c0392b', duration: 400,  css: 'vfx-hit' },
  miss:              { type: 'css',    color: '#666',    duration: 300,  css: 'vfx-miss' },
  crit:              { type: 'css',    color: '#ff0000', duration: 600,  css: 'vfx-crit' },
};

let _lottieReady = false;
function ensureLottie(cb) {
  if (window.lottie) { cb(); return; }
  if (_lottieReady === 'loading') { setTimeout(() => ensureLottie(cb), 200); return; }
  _lottieReady = 'loading';
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
  s.onload = () => { _lottieReady = true; cb(); };
  s.onerror = () => { _lottieReady = false; cb(); }; // fall back to CSS
  document.head.appendChild(s);
}

function playVFX(spellId, targetEl) {
  const vfx = VFX_MAP[spellId];
  if (!vfx) return;

  // Anchor to combat panel or game log
  const anchor = targetEl
    || document.querySelector('.combat-enemy.targeted')
    || document.getElementById('combat-panel')
    || document.getElementById('game-log');
  if (!anchor) return;

  if (vfx.type === 'lottie') {
    ensureLottie(() => {
      if (!window.lottie) { playCSSVFX(vfx, anchor); return; }
      const container = document.createElement('div');
      container.className = 'vfx-lottie-container';
      container.style.cssText = `
        position:absolute; inset:0; z-index:2000; pointer-events:none;
        display:flex; align-items:center; justify-content:center;
      `;
      anchor.style.position = 'relative';
      anchor.appendChild(container);
      const anim = lottie.loadAnimation({
        container, renderer: 'svg', loop: false, autoplay: true,
        path: vfx.src,
      });
      anim.addEventListener('complete', () => container.remove());
      setTimeout(() => container.remove(), vfx.duration + 500);
    });
  } else {
    playCSSVFX(vfx, anchor);
  }
}

function playCSSVFX(vfx, anchor) {
  const el = document.createElement('div');
  el.className = `vfx-overlay ${vfx.css || ''}`;
  el.style.setProperty('--vfx-color', vfx.color || '#fff');
  el.style.setProperty('--vfx-duration', (vfx.duration || 600) + 'ms');
  anchor.style.position = 'relative';
  anchor.appendChild(el);
  setTimeout(() => el.remove(), (vfx.duration || 600) + 200);
}

// Screen flash for big hits and crits
function screenFlash(color = '#c0392b', duration = 300) {
  let flash = document.getElementById('screen-flash');
  if (!flash) {
    flash = document.createElement('div');
    flash.id = 'screen-flash';
    flash.style.cssText = `
      position:fixed; inset:0; z-index:9999; pointer-events:none;
      opacity:0; transition:opacity 0.1s;
    `;
    document.body.appendChild(flash);
  }
  flash.style.background = color;
  flash.style.opacity = '0.18';
  setTimeout(() => { flash.style.opacity = '0'; }, duration);
}
window.screenFlash = screenFlash;

// Hook into castSelectedSpell to trigger VFX
const _origCastForVFX = window.castSelectedSpell;
window.castSelectedSpell = function() {
  const spell = window.combatState?.selectedSpell;
  if (spell) {
    setTimeout(() => playVFX(spell.id), 100);
    // Screen flash for holy/big spells
    if (['fireball','chain_lightning','wrath_divine','disintegrate','void_scream','soul_rend'].includes(spell.id)) {
      setTimeout(() => screenFlash('#ff4400', 400), 200);
    }
  }
  if (_origCastForVFX) _origCastForVFX();
};

// Hook into combatAttack for hit/miss flash
const _origAttackForVFX = window.combatAttack;
window.combatAttack = function() {
  if (_origAttackForVFX) _origAttackForVFX();
  // Listen for combat log to detect hit/miss/crit — simple timing
  setTimeout(() => {
    const lastLog = document.querySelector('#game-log .log-entry:last-child');
    if (!lastLog) return;
    const txt = lastLog.textContent;
    if (txt.includes('CRITICAL')) { playVFX('crit'); screenFlash('#ff0000', 500); }
    else if (txt.includes('HIT')) { playVFX('hit'); }
    else if (txt.includes('MISS')) { playVFX('miss'); }
  }, 150);
};
window.combatAttack = window.combatAttack;

window.playVFX = playVFX;

// ─── PROMPT REFERENCE ─────────────────────────
// When you're ready to generate art, use these prompts in Midjourney:
// Command: /imagine [prompt below] --ar 16:9 --style raw --v 6
//
// LOCATION BACKGROUNDS (16:9, dark fantasy painterly):
// Each LOCATION_BACKGROUNDS entry has a .prompt field
//
// NPC PORTRAITS (3:4, dark fantasy oil painting):
// Each NPC_PORTRAITS entry has a .prompt field
// Suggested suffix for all portraits:
// "--ar 3:4 --style raw --v 6 --q 2 dark fantasy RPG portrait, painterly, dramatic lighting"
//
// Run: Object.entries(NPC_PORTRAITS).forEach(([k,v]) => console.log(k + ':\n' + v.prompt))
// in browser console to dump all prompts

console.log('🎨 Visuals engine loaded — portraits, backgrounds, VFX ready');
