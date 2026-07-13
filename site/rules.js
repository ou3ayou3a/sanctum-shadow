// Sanctum & Shadow — authoritative, deterministic D&D-style action rules.
// This file deliberately has no DOM dependencies so the browser and tests use
// the exact same mechanics.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SanctumRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RULES_VERSION = 2;
  const SKILLS = Object.freeze({
    acrobatics:'dex', animal_handling:'wis', arcana:'int', athletics:'str',
    deception:'cha', history:'int', insight:'wis', intimidation:'cha',
    investigation:'int', medicine:'wis', nature:'int', perception:'wis',
    performance:'cha', persuasion:'cha', religion:'int', sleight_of_hand:'dex',
    stealth:'dex', survival:'wis',
  });
  const CLASS_PROFICIENCIES = Object.freeze({
    warrior: ['athletics','intimidation','perception'],
    paladin: ['athletics','insight','medicine','persuasion','religion'],
    cleric: ['history','insight','medicine','persuasion','religion'],
    mage: ['arcana','history','investigation','nature','religion'],
    rogue: ['acrobatics','deception','investigation','perception','sleight_of_hand','stealth'],
    ranger: ['animal_handling','athletics','nature','perception','stealth','survival'],
  });
  const CLASS_SAVING_THROWS = Object.freeze({
    warrior:['str','con'], paladin:['wis','cha'], cleric:['wis','cha'],
    mage:['int','wis'], rogue:['dex','int'], ranger:['str','dex'],
  });
  const CLASS_ATTACK_ABILITIES = Object.freeze({
    warrior:'str', paladin:'str', cleric:'str', mage:'int', rogue:'dex', ranger:'dex',
  });
  const SKILL_PATTERNS = [
    ['sleight_of_hand', /pickpocket|plant (?:an? |the )?item|palm |conceal |steal .*pocket/],
    ['stealth', /\bsneak|\bhide|unseen|silently|without being seen|shadow/],
    ['acrobatics', /balance|tumble|dodge|escape|slip free|vault|somersault/],
    ['athletics', /climb|jump|swim|grapple|shove|force|break|lift|kick down|smash/],
    ['investigation', /investigate|examine|search|inspect|analy[sz]e|decipher|clue|study the scene/],
    ['perception', /look around|notice|spot|listen|scan|keep watch|sense danger/],
    ['insight', /read (?:him|her|them|the room)|motive|lying|trust|intentions|insight/],
    ['persuasion', /persuade|convince|negotiate|reason with|appeal to|ask .* help/],
    ['deception', /deceive|bluff|lie to|disguise|mislead|pretend/],
    ['intimidation', /intimidate|threaten|coerce|frighten|command presence/],
    ['medicine', /heal|stabili[sz]e|treat .*wound|diagnose|first aid/],
    ['survival', /track|forage|navigate|follow .*trail|make camp|survival/],
    ['arcana', /arcane|magic|spell|rune|enchantment|curse/],
    ['religion', /religion|holy|divine|ritual|prayer|church doctrine/],
    ['history', /history|recall|ancient|heraldry|who was|what happened/],
    ['nature', /plant|animal|beast|weather|poison|herb|nature/],
    ['animal_handling', /calm .*animal|handle .*animal|ride |tame |soothe .*beast/],
    ['performance', /perform|sing|dance|recite|entertain/],
  ];

  function hashSeed(seed) {
    let hash = 2166136261;
    for (const char of String(seed ?? 'sanctum-shadow')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRng(seed) {
    let state = hashSeed(seed);
    return function seededRandom() {
      state += 0x6D2B79F5;
      let n = state;
      n = Math.imul(n ^ (n >>> 15), n | 1);
      n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
  }

  function abilityModifier(score) { return Math.floor((Number(score) - 10) / 2); }
  function proficiencyBonus(level) { return 2 + Math.floor((Math.max(1, Number(level) || 1) - 1) / 4); }
  function getClassProficiencies(classId) { return [...(CLASS_PROFICIENCIES[classId] || ['perception'])]; }
  function getClassSavingThrows(classId) { return [...(CLASS_SAVING_THROWS[classId] || [])]; }
  function getAttackAbility(classId) { return CLASS_ATTACK_ABILITIES[classId] || 'str'; }
  function inferSkill(text) {
    const value = String(text || '').toLowerCase();
    return SKILL_PATTERNS.find(([, pattern]) => pattern.test(value))?.[0] || null;
  }
  function inferDC(text, skill) {
    const value = String(text || '').toLowerCase();
    if (/nearly impossible|impossible|without any trace|masterwork|ancient seal/.test(value)) return 18;
    if (/very hard|heavily guarded|pitch dark|expert|complex/.test(value)) return 16;
    if (['stealth','sleight_of_hand','deception','intimidation'].includes(skill)) return 13;
    if (['investigation','insight','survival','arcana','religion'].includes(skill)) return 12;
    return 10;
  }
  function rollDie(sides, rng = Math.random) {
    return Math.floor(rng() * Math.max(1, Number(sides) || 1)) + 1;
  }

  function rollFormula(formula, options = {}) {
    if (formula == null || formula === '') return { total:0, dice:[], modifier:0, formula:String(formula || '') };
    const text = String(formula).trim().toUpperCase();
    const rng = typeof options.rng === 'function' ? options.rng
      : options.seed !== undefined ? createRng(options.seed) : Math.random;
    const flat = /^\d+$/.test(text) ? Number(text) : null;
    if (flat !== null) return { total:flat, dice:[], modifier:0, formula:text };
    const match = text.match(/^(\d{1,2})D(\d{1,3})(?:([+-])(\d{1,3}|STR|DEX|CON|INT|WIS|CHA))?$/);
    if (!match) throw new Error(`Invalid dice formula: ${formula}`);
    const baseCount = Number(match[1]);
    const sides = Number(match[2]);
    const count = baseCount * (options.critical ? 2 : 1);
    const dice = Array.from({ length:count }, () => rollDie(sides, rng));
    let modifier = Number(options.modifier) || 0;
    if (match[4]) {
      const token = match[4].toLowerCase();
      const value = /^\d+$/.test(token) ? Number(token) : Number(options.statMods?.[token]) || 0;
      modifier += match[3] === '-' ? -value : value;
    }
    return { total:Math.max(0, dice.reduce((sum, die) => sum + die, 0) + modifier), dice, modifier, formula:text };
  }

  function combatRollMode({ advantage = false, disadvantage = false, attackerConditions = [], targetConditions = [] } = {}) {
    const attacker = new Set(attackerConditions || []);
    const target = new Set(targetConditions || []);
    if (attacker.has('invisible') || target.has('blinded') || target.has('restrained') || target.has('paralyzed')) advantage = true;
    if (attacker.has('blinded') || attacker.has('poisoned') || attacker.has('poison') || attacker.has('frightened') || target.has('invisible')) disadvantage = true;
    if (advantage && disadvantage) return 'normal';
    return advantage ? 'advantage' : disadvantage ? 'disadvantage' : 'normal';
  }

  function resolveAttack(options = {}) {
    const mode = combatRollMode(options);
    const rng = typeof options.rng === 'function' ? options.rng
      : options.seed !== undefined ? createRng(options.seed) : Math.random;
    const rolls = [rollDie(20, rng)];
    if (mode !== 'normal') rolls.push(rollDie(20, rng));
    const roll = mode === 'advantage' ? Math.max(...rolls)
      : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
    const attackBonus = Number(options.attackBonus) || 0;
    const targetAC = Math.max(0, Number(options.targetAC) || 10);
    const total = roll + attackBonus;
    const crit = roll === 20;
    const fumble = roll === 1;
    const hit = !fumble && (!!options.autoHit || crit || total >= targetAC);
    return { rulesVersion:RULES_VERSION, rolls, roll, mode, attackBonus, targetAC, total, crit, fumble, hit };
  }

  function rollInitiative(options = {}) {
    const mode = combatRollMode({ advantage:options.advantage, disadvantage:options.disadvantage });
    const rng = typeof options.rng === 'function' ? options.rng
      : options.seed !== undefined ? createRng(options.seed) : Math.random;
    const rolls = [rollDie(20, rng)];
    if (mode !== 'normal') rolls.push(rollDie(20, rng));
    const roll = mode === 'advantage' ? Math.max(...rolls)
      : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
    const bonus = Number(options.bonus) || 0;
    return { rolls, roll, mode, bonus, total:roll + bonus };
  }

  function resolveSavingThrow(options = {}) {
    const character = options.character || {};
    const ability = String(options.ability || 'con').toLowerCase();
    const abilityMod = options.abilityMod != null
      ? Number(options.abilityMod) || 0 : abilityModifier(character.stats?.[ability] ?? 10);
    const proficient = !!options.proficient || (character.savingThrowProficiencies || []).includes(ability);
    const proficiency = proficient ? proficiencyBonus(character.level) : 0;
    const attack = resolveAttack({
      attackBonus:abilityMod + proficiency, targetAC:Number(options.dc) || 10,
      advantage:options.advantage, disadvantage:options.disadvantage,
      attackerConditions:options.conditions || character.conditions, rng:options.rng, seed:options.seed,
    });
    // In 5e, ordinary saving throws do not automatically fail on 1 or succeed on 20.
    return { ...attack, ability, abilityMod, proficiency, proficient, dc:attack.targetAC, success:attack.total >= attack.targetAC };
  }
  function getRollMode({ advantage = false, disadvantage = false, conditions = [], skill, drunk = false } = {}) {
    const active = new Set(Array.isArray(conditions) ? conditions : []);
    if (active.has('inspired')) advantage = true;
    if (active.has('poisoned') || active.has('exhausted')) disadvantage = true;
    if (active.has('frightened') && ['persuasion','intimidation','performance'].includes(skill)) disadvantage = true;
    if (drunk && ['acrobatics','perception','sleight_of_hand','stealth'].includes(skill)) disadvantage = true;
    if (advantage && disadvantage) return 'normal';
    return advantage ? 'advantage' : disadvantage ? 'disadvantage' : 'normal';
  }

  function rollCheck(options = {}) {
    const character = options.character || {};
    const text = String(options.text || '');
    const skill = options.skill || inferSkill(text);
    const ability = String(options.ability || SKILLS[skill] || 'wis').toLowerCase();
    const numericDC = Number(options.dc);
    const dc = Number.isFinite(numericDC) && numericDC > 0 ? numericDC : inferDC(text, skill);
    const abilityMod = abilityModifier(character.stats?.[ability] ?? 10);
    const known = Array.isArray(character.proficiencies)
      ? character.proficiencies : getClassProficiencies(character.class);
    const proficient = !!skill && known.includes(skill);
    const proficiency = proficient ? proficiencyBonus(character.level) : 0;
    const mode = getRollMode({
      advantage:options.advantage, disadvantage:options.disadvantage,
      conditions:character.conditions, skill, drunk:options.drunk,
    });
    const rng = typeof options.rng === 'function' ? options.rng
      : options.seed !== undefined ? createRng(options.seed) : Math.random;
    const rolls = [rollDie(20, rng)];
    if (mode !== 'normal') rolls.push(rollDie(20, rng));
    const roll = mode === 'advantage' ? Math.max(...rolls)
      : mode === 'disadvantage' ? Math.min(...rolls) : rolls[0];
    const modifier = abilityMod + proficiency;
    const total = roll + modifier;
    const crit = roll === 20;
    const fumble = roll === 1;
    return {
      rulesVersion:RULES_VERSION, text, skill, ability, dc, rolls, roll,
      abilityMod, proficiency, proficient, modifier, total, mode, crit, fumble,
      consumeCondition: mode === 'advantage' && character.conditions?.includes('inspired') ? 'inspired' : null,
      success: crit || (!fumble && total >= dc),
    };
  }

  return Object.freeze({
    RULES_VERSION, SKILLS, CLASS_PROFICIENCIES, CLASS_SAVING_THROWS, CLASS_ATTACK_ABILITIES,
    createRng, rollDie, rollFormula, abilityModifier, proficiencyBonus,
    getClassProficiencies, getClassSavingThrows, getAttackAbility, inferSkill,
    inferDC, getRollMode, rollCheck, combatRollMode, resolveAttack,
    rollInitiative, resolveSavingThrow,
  });
});
