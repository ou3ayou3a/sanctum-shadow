(function portraitLibraryFactory(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.PortraitLibrary = api;
    root.getPortraitPath = api.getPortraitPath;
    root.getPlayerPortrait = api.getPlayerPortrait;
    root.NPC_PORTRAITS = api.BESPOKE_PORTRAITS;
  }
})(typeof window !== 'undefined' ? window : globalThis, function createPortraitLibrary() {
  'use strict';

  const RACE_PORTRAITS = Object.freeze({
    human: 'art/portraits/races/human.jpg',
    dwarf: 'art/portraits/races/dwarf.jpg',
    elf: 'art/portraits/races/elf.jpg',
    high_elf: 'art/portraits/races/high_elf.jpg',
    dark_elf: 'art/portraits/races/dark_elf.jpg',
    orc: 'art/portraits/races/orc.jpg',
    goblin: 'art/portraits/races/goblin.jpg',
  });

  const BESPOKE_PORTRAITS = Object.freeze({
    captain_rhael: { path: 'art/portraits/captain_rhael.jpg', race: 'human', role: 'guard' },
    sister_mourne: { path: 'art/portraits/sister_mourne.jpg', race: 'human', role: 'cleric' },
    elder_varek: { path: 'art/portraits/elder_varek.jpg', race: 'human', role: 'boss' },
  });

  const PROFILES = Object.freeze({
    vaelthar_guard: ['human', 'guard'], trembling_scribe: ['human', 'scholar'],
    bresker: ['dwarf', 'smith'], lyra_innkeeper: ['human', 'innkeeper'],
    drunk_cartographer: ['human', 'scholar'], nervous_merchant: ['human', 'merchant'],
    screaming_preacher: ['human', 'cleric'], deacon_voss: ['human', 'cleric'],
    gatewarden_pol: ['human', 'guard'], soldier_wont_speak: ['human', 'guard'],
    heretic_preacher_aldran: ['human', 'cleric'], elder_mosswick: ['human', 'elder'],
    last_monk: ['human', 'monk'], sir_harren: ['human', 'knight'],
    harren_fallen: ['human', 'fallen'], merchant_widow_sera: ['human', 'merchant'],
    head_archivist_theones: ['high_elf', 'scholar'], doubting_deacon: ['human', 'cleric'],
    donal_barkeep: ['human', 'innkeeper'], man_came_back_wrong: ['human', 'fallen'],
    breta_host: ['dwarf', 'innkeeper'], tomas_innkeeper_road: ['human', 'innkeeper'],
    royal_investigator: ['human', 'noble'], grisel_barkeep: ['orc', 'innkeeper'],
    forsaken_squire: ['human', 'knight'], wandering_scholar: ['high_elf', 'scholar'],
    changed_cartographer: ['human', 'fallen'], vesna_wine_house: ['human', 'innkeeper'],
    pilgrim_saw_too_much: ['human', 'pilgrim'], sealed_in_apprentice: ['human', 'mage'],
    mira_archivist: ['human', 'scholar'], origin_steward_elira: ['human', 'noble'],
    origin_sergeant_dain: ['human', 'guard'], origin_bloodkeeper_ysra: ['dark_elf', 'mage'],
    origin_pilgrim_oren: ['human', 'pilgrim'], origin_recorder_cael: ['high_elf', 'scholar'],
    origin_hunter_veyra: ['elf', 'hunter'], origin_confessor_ilyan: ['human', 'cleric'],
    origin_senna_vale: ['human', 'rogue'], merchant_old_brennan: ['human', 'merchant'],
    merchant_sylva: ['elf', 'merchant'], merchant_brother_edric: ['human', 'cleric'],
    merchant_mira: ['human', 'rogue'], merchant_big_kes: ['orc', 'merchant'],
    merchant_osric: ['human', 'occult'], merchant_novice_tael: ['human', 'monk'],
    merchant_traveling: ['human', 'merchant'], the_voice_below: ['dark_elf', 'void'],
    voice_below: ['dark_elf', 'void'], shattered_god: ['human', 'void'],
  });

  const ROLE_COLORS = Object.freeze({
    guard: ['#253746', '#a7884f'], knight: ['#27323d', '#9a8356'], fallen: ['#211a22', '#7e3037'],
    cleric: ['#3b2630', '#bd9c52'], monk: ['#49382a', '#ba955f'], scholar: ['#26384a', '#8ca5b7'],
    mage: ['#352548', '#9e79c5'], occult: ['#261d31', '#7c567f'], void: ['#171321', '#674879'],
    merchant: ['#4a3422', '#bc8b45'], innkeeper: ['#4b3025', '#a86f42'], smith: ['#322b29', '#b4693c'],
    noble: ['#302844', '#c3a45d'], hunter: ['#243a2c', '#78905b'], rogue: ['#252b31', '#64788a'],
    pilgrim: ['#433a30', '#a69672'], elder: ['#3b3027', '#9d825f'], adventurer: ['#29333b', '#9a7547'],
  });

  const SKIN = Object.freeze({
    human: ['#d9a77e', '#9f674d'], dwarf: ['#d29a70', '#8d573e'], elf: ['#ddb38e', '#9a715a'],
    high_elf: ['#e5c5a1', '#a9876c'], dark_elf: ['#635d79', '#39364e'], orc: ['#778355', '#465336'],
    goblin: ['#76904d', '#40532d'],
  });

  const cache = new Map();

  function hashIdentity(value) {
    let hash = 2166136261;
    const text = String(value || 'unknown');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalizeRace(race) {
    const value = String(race || '').toLowerCase().replace(/[ -]+/g, '_');
    return RACE_PORTRAITS[value] ? value : 'human';
  }

  function getPlayerPortrait(race) {
    return RACE_PORTRAITS[normalizeRace(race)];
  }

  function inferProfile(id, options) {
    const known = PROFILES[id];
    if (known) return { race: known[0], role: known[1] };
    const text = `${id} ${options.name || ''} ${options.role || ''}`.toLowerCase();
    let race = normalizeRace(options.race);
    if (!options.race) {
      if (text.includes('goblin')) race = 'goblin';
      else if (text.includes('orc')) race = 'orc';
      else if (text.includes('dark elf') || text.includes('drow')) race = 'dark_elf';
      else if (text.includes('high elf')) race = 'high_elf';
      else if (text.includes('elf')) race = 'elf';
      else if (text.includes('dwarf')) race = 'dwarf';
    }
    let role = options.role || 'adventurer';
    for (const candidate of Object.keys(ROLE_COLORS)) {
      if (text.includes(candidate)) { role = candidate; break; }
    }
    return { race, role: ROLE_COLORS[role] ? role : 'adventurer' };
  }

  function portraitSvg(id, options = {}) {
    const key = `${id}|${options.name || ''}|${options.race || ''}|${options.role || ''}`;
    if (cache.has(key)) return cache.get(key);
    const h = hashIdentity(key);
    const profile = inferProfile(String(id || 'unknown'), options);
    const race = normalizeRace(profile.race);
    const [cloth, trim] = ROLE_COLORS[profile.role] || ROLE_COLORS.adventurer;
    const [skin, shade] = SKIN[race];
    const hairColors = ['#201712', '#493020', '#7b4b27', '#b5a68b', '#ded7c7', '#352a23'];
    const hair = race === 'dark_elf' ? '#ddd9e5' : hairColors[h % hairColors.length];
    const eyeColors = ['#8fa8b8', '#6d8b62', '#a88c48', '#7d614f', '#b7a7d0'];
    const eyes = eyeColors[(h >>> 4) % eyeColors.length];
    const faceWidth = 28 + (h % 7);
    const faceX = 64 - faceWidth / 2;
    const beard = race === 'dwarf' || ((h >>> 7) % 4 === 0);
    const hood = ['rogue', 'cleric', 'occult', 'void'].includes(profile.role) && ((h >>> 9) % 2 === 0);
    const pointed = ['elf', 'high_elf', 'dark_elf', 'orc', 'goblin'].includes(race);
    const tusks = race === 'orc' || race === 'goblin';
    const scar = (h >>> 12) % 3 === 0;
    const bg2 = ['#172027', '#211820', '#17221d', '#231e17'][(h >>> 14) % 4];
    const earPath = pointed
      ? `<path d="M${faceX + 2} 52 L${faceX - 13} 43 L${faceX + 3} 67 M${faceX + faceWidth - 2} 52 L${faceX + faceWidth + 13} 43 L${faceX + faceWidth - 3} 67" fill="${skin}" stroke="${shade}" stroke-width="2"/>`
      : `<ellipse cx="${faceX - 1}" cy="58" rx="5" ry="9" fill="${skin}"/><ellipse cx="${faceX + faceWidth + 1}" cy="58" rx="5" ry="9" fill="${skin}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs><radialGradient id="b"><stop stop-color="${bg2}"/><stop offset="1" stop-color="#08090b"/></radialGradient><linearGradient id="c" x2="0" y2="1"><stop stop-color="${trim}"/><stop offset=".18" stop-color="${cloth}"/><stop offset="1" stop-color="#101216"/></linearGradient><linearGradient id="s"><stop stop-color="${skin}"/><stop offset="1" stop-color="${shade}"/></linearGradient></defs>
      <rect width="128" height="128" fill="url(#b)"/><circle cx="64" cy="48" r="44" fill="${trim}" opacity=".07"/>
      <path d="M14 128 Q18 96 45 90 L83 90 Q110 96 114 128" fill="url(#c)" stroke="${trim}" stroke-width="2"/>
      <path d="M48 82 L44 98 L64 113 L84 98 L80 82" fill="${shade}"/><path d="M46 94 L64 113 L31 105 M82 94 L64 113 L97 105" fill="none" stroke="${trim}" stroke-width="2"/>
      ${earPath}<rect x="${faceX}" y="27" width="${faceWidth}" height="64" rx="${faceWidth / 2}" fill="url(#s)" stroke="${shade}" stroke-width="2"/>
      ${hood ? `<path d="M32 87 Q29 18 64 12 Q99 18 96 87 L83 74 Q93 29 64 23 Q35 29 45 74Z" fill="${cloth}" stroke="${trim}" stroke-width="2"/>` : ''}
      <path d="M${faceX + 2} 44 Q${faceX + 5} 20 64 22 Q${faceX + faceWidth - 5} 20 ${faceX + faceWidth - 2} 44 Q64 29 ${faceX + 2} 44" fill="${hair}"/>
      <path d="M${faceX + 6} 50 Q${faceX + 12} 46 ${faceX + 16} 50 M${faceX + faceWidth - 16} 50 Q${faceX + faceWidth - 12} 46 ${faceX + faceWidth - 6} 50" fill="none" stroke="${hair}" stroke-width="3"/>
      <ellipse cx="${faceX + 11}" cy="54" rx="3" ry="2" fill="${eyes}"/><ellipse cx="${faceX + faceWidth - 11}" cy="54" rx="3" ry="2" fill="${eyes}"/><circle cx="${faceX + 11}" cy="54" r="1"/><circle cx="${faceX + faceWidth - 11}" cy="54" r="1"/>
      <path d="M64 55 L60 69 L66 70" fill="none" stroke="${shade}" stroke-width="2"/><path d="M56 77 Q64 ${75 + (h % 4)} 72 77" fill="none" stroke="#5d3935" stroke-width="2"/>
      ${beard ? `<path d="M48 68 Q49 99 64 105 Q79 99 80 68 Q72 84 64 84 Q56 84 48 68" fill="${hair}" opacity=".92"/>` : ''}
      ${tusks ? `<path d="M55 78 l3 -8 l3 9 M73 78 l-3 -8 l-3 9" fill="#d8d0b4" stroke="${shade}"/>` : ''}
      ${scar ? `<path d="M${faceX + 8} 45 L${faceX + 18} 69" stroke="#7d5148" stroke-width="1.5" opacity=".8"/>` : ''}
      <rect x="2" y="2" width="124" height="124" fill="none" stroke="${trim}" stroke-width="2" opacity=".65"/>
    </svg>`;
    const uri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    cache.set(key, uri);
    return uri;
  }

  function getPortraitPath(id, nameOrOptions, maybeOptions) {
    const options = typeof nameOrOptions === 'object'
      ? { ...nameOrOptions }
      : { ...(maybeOptions || {}), name: nameOrOptions || maybeOptions?.name || '' };
    const identity = String(id || options.name || 'unknown').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (BESPOKE_PORTRAITS[identity]) return BESPOKE_PORTRAITS[identity].path;
    if (options.isPlayer || options.kind === 'player') return getPlayerPortrait(options.race);
    return portraitSvg(identity, options);
  }

  return Object.freeze({ RACE_PORTRAITS, BESPOKE_PORTRAITS, PROFILES, getPlayerPortrait, getPortraitPath, portraitSvg, hashIdentity });
});
