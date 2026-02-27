// ============================================
//   SANCTUM & SHADOW — SKILL TREE ENGINE
//   Functional skill trees: spend points,
//   unlock abilities, track progression
// ============================================

// ─── FULL SKILL DEFINITIONS ──────────────────
// Each skill has: id, name, icon, desc, effect, cost, requires (prev skill id or null)
// Effects are applied immediately on unlock OR triggered in combat

const SKILL_TREES = {
  // ── WARRIOR ────────────────────────────────
  warrior: {
    berserker: {
      name: 'Berserker', icon: '🔥',
      skills: [
        { id:'rage_strike',   name:'Rage Strike',    icon:'💢', tier:1, cost:1, requires:null,
          desc:'Basic attacks deal +2 bonus damage per 10 Rage. Passive.',
          passive: true, effect: 'atk_per_rage' },
        { id:'blood_frenzy',  name:'Blood Frenzy',   icon:'🩸', tier:2, cost:1, requires:'rage_strike',
          desc:'Killing an enemy restores 30 Rage instantly.',
          passive: true, effect: 'kill_rage_restore' },
        { id:'war_cry_skill', name:'War Cry',         icon:'😤', tier:3, cost:2, requires:'blood_frenzy',
          desc:'Unleash a War Cry. +3 ATK for 4 turns. (Replaces base War Cry)',
          passive: false, effect: 'war_cry_upgraded' },
        { id:'unstoppable',   name:'Unstoppable',     icon:'🛑', tier:4, cost:2, requires:'war_cry_skill',
          desc:'While above 50 Rage, you cannot be Rooted or Stunned. Passive.',
          passive: true, effect: 'rage_unstoppable' },
        { id:'avatar_war_skill', name:'Avatar of War', icon:'⚡', tier:5, cost:3, requires:'unstoppable',
          desc:'Avatar of War now costs 50 Rage instead of MP. Duration: 4 turns.',
          passive: true, effect: 'avatar_rage_cost' },
      ]
    },
    guardian: {
      name: 'Guardian', icon: '🛡',
      skills: [
        { id:'shield_wall',   name:'Shield Wall',    icon:'🛡', tier:1, cost:1, requires:null,
          desc:'+2 base AC permanently. Passive.',
          passive: true, effect: 'ac_plus_2' },
        { id:'iron_skin',     name:'Iron Skin',      icon:'⚙', tier:2, cost:1, requires:'shield_wall',
          desc:'+20 max HP permanently.',
          passive: true, effect: 'hp_plus_20' },
        { id:'provoke',       name:'Provoke',        icon:'😡', tier:3, cost:2, requires:'iron_skin',
          desc:'Force all enemies to target you for 2 turns. 0 AP cost.',
          passive: false, effect: 'provoke_taunt' },
        { id:'last_stand_skill', name:'Last Stand',  icon:'⚔', tier:4, cost:2, requires:'provoke',
          desc:'Last Stand now triggers at 30% HP instead of 20%.',
          passive: true, effect: 'last_stand_upgraded' },
        { id:'immortal_bastion', name:'Immortal Bastion', icon:'🏰', tier:5, cost:3, requires:'last_stand_skill',
          desc:'Once per combat, survive a lethal hit at 1 HP.',
          passive: true, effect: 'death_save' },
      ]
    },
    warlord: {
      name: 'Warlord', icon: '👑',
      skills: [
        { id:'battle_orders', name:'Battle Orders',  icon:'📢', tier:1, cost:1, requires:null,
          desc:'+1 to all allies\' attack rolls. Passive (MP aura).',
          passive: true, effect: 'party_atk_bonus' },
        { id:'flanking',      name:'Flanking Strike', icon:'↙', tier:2, cost:1, requires:'battle_orders',
          desc:'Attacking same target twice in one turn deals +50% on second hit.',
          passive: true, effect: 'flanking_bonus' },
        { id:'inspire',       name:'Inspire Troops', icon:'🎖', tier:3, cost:2, requires:'flanking',
          desc:'Grant all allies +15 temp HP for 3 turns. 2 AP.',
          passive: false, effect: 'inspire_troops' },
        { id:'death_mark',    name:'Death Mark',     icon:'💀', tier:4, cost:2, requires:'inspire',
          desc:'Mark a target: all attacks vs them crit on 17+.',
          passive: false, effect: 'death_mark_skill' },
        { id:'conqueror',     name:'Conqueror',      icon:'🏆', tier:5, cost:3, requires:'death_mark',
          desc:'Execute threshold raised to 35% HP. Executioner deals 8d12+STR.',
          passive: true, effect: 'execute_upgraded' },
      ]
    }
  },

  // ── PALADIN ────────────────────────────────
  paladin: {
    crusader: {
      name: 'Crusader', icon: '⚔',
      skills: [
        { id:'holy_smite_skill', name:'Holy Smite',   icon:'✝', tier:1, cost:1, requires:null,
          desc:'Holy Smite now also applies Burning to target for 2 turns. Passive upgrade.',
          passive: true, effect: 'smite_burning' },
        { id:'consecrate',    name:'Consecrate',     icon:'🔆', tier:2, cost:1, requires:'holy_smite_skill',
          desc:'Consecrate the ground. Enemies entering take 8 holy damage/turn for 3 turns.',
          passive: false, effect: 'consecrate_ground' },
        { id:'divine_charge', name:'Divine Charge',  icon:'⚡', tier:3, cost:2, requires:'consecrate',
          desc:'Charge an enemy: guaranteed hit + stun for 1 turn. 2 AP.',
          passive: false, effect: 'divine_charge_skill' },
        { id:'judgment_skill', name:'Judgment',      icon:'⚖', tier:4, cost:2, requires:'divine_charge',
          desc:'Judgment now strips 1 buff from target before damage.',
          passive: true, effect: 'judgment_dispel' },
        { id:'wrath_divine_skill', name:'Wrath of the Divine', icon:'☀', tier:5, cost:3, requires:'judgment_skill',
          desc:'Wrath of God now hits ALL enemies at 60% damage each.',
          passive: true, effect: 'wrath_aoe' },
      ]
    },
    protector: {
      name: 'Protector', icon: '✝',
      skills: [
        { id:'lay_on_hands_skill', name:'Lay on Hands', icon:'🙏', tier:1, cost:1, requires:null,
          desc:'Lay on Hands now also removes one negative status effect. Passive upgrade.',
          passive: true, effect: 'loh_cleanse' },
        { id:'aura_protection', name:'Aura of Protection', icon:'🌟', tier:2, cost:1, requires:'lay_on_hands_skill',
          desc:'Passive aura reduces incoming damage by 2+WIS for all nearby allies.',
          passive: true, effect: 'aura_passive' },
        { id:'divine_shield_skill', name:'Divine Shield', icon:'🔆', tier:3, cost:2, requires:'aura_protection',
          desc:'Divine Shield now absorbs 50 damage (up from 30).',
          passive: true, effect: 'shield_upgraded' },
        { id:'sacred_barrier', name:'Sacred Barrier', icon:'🏛', tier:4, cost:2, requires:'divine_shield_skill',
          desc:'Once per combat, reflect 50% of blocked damage back to attacker.',
          passive: true, effect: 'barrier_reflect' },
        { id:'miracle',       name:'Miracle',         icon:'✨', tier:5, cost:3, requires:'sacred_barrier',
          desc:'Fully restore HP of one ally. 25 Holy Points. Once per combat.',
          passive: false, effect: 'miracle_heal' },
      ]
    },
    inquisitor: {
      name: 'Inquisitor', icon: '⚖',
      skills: [
        { id:'detect_evil',   name:'Detect Evil',    icon:'👁', tier:1, cost:1, requires:null,
          desc:'At combat start, reveal all enemy HP and spells. Passive.',
          passive: true, effect: 'reveal_enemies' },
        { id:'mark_heresy',   name:'Mark of Heresy', icon:'🔴', tier:2, cost:1, requires:'detect_evil',
          desc:'Mark of Heresy reduces target\'s AC by 3 for 3 turns.',
          passive: true, effect: 'heresy_mark_upgraded' },
        { id:'righteous_fury', name:'Righteous Fury', icon:'💥', tier:3, cost:2, requires:'mark_heresy',
          desc:'+4 ATK against marked or burning targets. Passive.',
          passive: true, effect: 'fury_vs_marked' },
        { id:'trial_combat',  name:'Trial by Combat', icon:'⚔', tier:4, cost:2, requires:'righteous_fury',
          desc:'Challenge one enemy to a duel: no others may interfere for 3 turns.',
          passive: false, effect: 'trial_duel' },
        { id:'execution',     name:'Execution',       icon:'🩸', tier:5, cost:3, requires:'trial_combat',
          desc:'Instantly execute enemies below 20% HP as a free action. Costs 10 Holy.',
          passive: false, effect: 'inquisitor_execute' },
      ]
    }
  },

  // ── CLERIC ─────────────────────────────────
  cleric: {
    healer: {
      name: 'Life Domain', icon: '💚',
      skills: [
        { id:'empowered_heal', name:'Empowered Healing', icon:'💚', tier:1, cost:1, requires:null,
          desc:'All heals restore +WIS bonus HP. Passive.',
          passive: true, effect: 'heal_wis_bonus' },
        { id:'mass_heal_skill', name:'Mass Heal',        icon:'💫', tier:2, cost:1, requires:'empowered_heal',
          desc:'Mass Heal now heals 3d6+WIS (up from 2d6).',
          passive: true, effect: 'mass_heal_upgraded' },
        { id:'revivify_skill', name:'Revivify',          icon:'❤', tier:3, cost:2, requires:'mass_heal_skill',
          desc:'Revivify restores target to 25% HP (not 1). Costs a Prayer Charge.',
          passive: true, effect: 'revivify_upgraded' },
        { id:'sacred_ground',  name:'Sacred Ground',    icon:'🌿', tier:4, cost:2, requires:'revivify_skill',
          desc:'Bless the battlefield. All allies heal 5 HP at start of each of their turns for 3 rounds.',
          passive: false, effect: 'sacred_ground_skill' },
        { id:'resurrection',   name:'Resurrection',     icon:'✨', tier:5, cost:3, requires:'sacred_ground',
          desc:'Once per combat, bring a fallen ally back at 50% HP.',
          passive: false, effect: 'resurrection_skill' },
      ]
    },
    war_cleric: {
      name: 'War Domain', icon: '⚔',
      skills: [
        { id:'spirit_weapon_skill', name:'Spiritual Weapon', icon:'👻', tier:1, cost:1, requires:null,
          desc:'Spirit Weapon persists 5 turns (up from 3). Passive upgrade.',
          passive: true, effect: 'spirit_weapon_extended' },
        { id:'divine_strike_skill', name:'Divine Strike',    icon:'⚡', tier:2, cost:1, requires:'spirit_weapon_skill',
          desc:'Divine Strike now has a 25% chance to stun for 1 turn.',
          passive: true, effect: 'strike_stun_chance' },
        { id:'guided_strike',  name:'Guided Strike',         icon:'🎯', tier:3, cost:2, requires:'divine_strike_skill',
          desc:'Once per turn, reroll one missed attack. Take the second result.',
          passive: true, effect: 'guided_strike_reroll' },
        { id:'war_blessing',   name:'War God\'s Blessing',   icon:'⚔', tier:4, cost:2, requires:'guided_strike',
          desc:'+2 to all attack rolls permanently. Passive.',
          passive: true, effect: 'atk_plus_2' },
        { id:'avatar_battle',  name:'Avatar of Battle',      icon:'🔥', tier:5, cost:3, requires:'war_blessing',
          desc:'Become Avatar: +5 ATK, +4 AC, and Spirit Weapon auto-summons for 4 turns.',
          passive: false, effect: 'avatar_battle_skill' },
      ]
    },
    shadow_cleric: {
      name: 'Twilight Domain', icon: '🌑',
      skills: [
        { id:'eyes_dark',     name:'Eyes of the Dark',  icon:'👁', tier:1, cost:1, requires:null,
          desc:'See through enemy Mirror Image and Shadow Step effects. Passive.',
          passive: true, effect: 'see_through_illusions' },
        { id:'veil_twilight', name:'Veil of Twilight',  icon:'🌑', tier:2, cost:1, requires:'eyes_dark',
          desc:'On your turn: gain 2 AC until your next turn. Free action.',
          passive: false, effect: 'twilight_veil' },
        { id:'darkness_ward', name:'Darkness Ward',     icon:'🛡', tier:3, cost:2, requires:'veil_twilight',
          desc:'Absorb the first negative status each combat. Passive.',
          passive: true, effect: 'absorb_first_status' },
        { id:'steps_night',   name:'Steps of Night',    icon:'👣', tier:4, cost:2, requires:'darkness_ward',
          desc:'Move costs 0 AP. You may move freely each turn without spending AP.',
          passive: true, effect: 'free_movement' },
        { id:'deepest_dark',  name:'Deepest Dark',      icon:'🕳', tier:5, cost:3, requires:'steps_night',
          desc:'Once per combat: plunge into Deepest Dark. Untargetable for 2 turns, then return dealing 6d10 shadow damage.',
          passive: false, effect: 'deepest_dark_skill' },
      ]
    }
  },

  // ── MAGE ───────────────────────────────────
  mage: {
    destruction: {
      name: 'Destruction', icon: '💥',
      skills: [
        { id:'arcane_power',  name:'Arcane Power',   icon:'✨', tier:1, cost:1, requires:null,
          desc:'All spells deal +INT bonus damage. Passive.',
          passive: true, effect: 'spell_int_bonus' },
        { id:'fireball_skill', name:'Fireball',      icon:'🔥', tier:2, cost:1, requires:'arcane_power',
          desc:'Fireball now applies Burning (4 dmg/turn) to all hit targets. Passive upgrade.',
          passive: true, effect: 'fireball_burning' },
        { id:'meteor_swarm',  name:'Meteor Swarm',   icon:'☄', tier:3, cost:2, requires:'fireball_skill',
          desc:'AOE nuke: 8d8 damage to all enemies. 3 AP, high MP cost.',
          passive: false, effect: 'meteor_swarm_skill' },
        { id:'disintegrate_skill', name:'Disintegrate', icon:'💀', tier:4, cost:2, requires:'meteor_swarm',
          desc:'Disintegrate CON DC raised to 18. On fail: instakill below 50% HP.',
          passive: true, effect: 'disintegrate_upgraded' },
        { id:'apocalypse',    name:'Apocalypse',     icon:'💥', tier:5, cost:3, requires:'disintegrate_skill',
          desc:'Channel for 1 turn, then release: 12d10+INT damage to everything in combat.',
          passive: false, effect: 'apocalypse_skill' },
      ]
    },
    illusion: {
      name: 'Illusion', icon: '👁',
      skills: [
        { id:'mirror_image_skill', name:'Mirror Image', icon:'👁', tier:1, cost:1, requires:null,
          desc:'Mirror Image spawns 4 copies (up from 3). Passive upgrade.',
          passive: true, effect: 'mirror_extra_copy' },
        { id:'phantasm',      name:'Phantasm',        icon:'👻', tier:2, cost:1, requires:'mirror_image_skill',
          desc:'Create a phantasm that deals 2d6 psychic damage/turn for 3 turns. Auto-hit.',
          passive: false, effect: 'phantasm_skill' },
        { id:'mass_hallucination', name:'Mass Hallucination', icon:'🌀', tier:3, cost:2, requires:'phantasm',
          desc:'All enemies make WIS save (DC 14) or attack a random target for 2 turns.',
          passive: false, effect: 'mass_hallucination_skill' },
        { id:'mind_maze',     name:'Mind Maze',        icon:'🧩', tier:4, cost:2, requires:'mass_hallucination',
          desc:'Target one enemy: they skip their next 2 turns (WIS save DC 16).',
          passive: false, effect: 'mind_maze_skill' },
        { id:'reality_break', name:'Reality Break',   icon:'💫', tier:5, cost:3, requires:'mind_maze',
          desc:'Shatter reality around all enemies: -4 AC, -4 ATK, 25% miss chance for 3 turns.',
          passive: false, effect: 'reality_break_skill' },
      ]
    },
    arcane: {
      name: 'Arcane Mastery', icon: '⚗',
      skills: [
        { id:'counterspell',  name:'Counterspell',   icon:'❌', tier:1, cost:1, requires:null,
          desc:'30% chance to automatically counter enemy spells. Passive.',
          passive: true, effect: 'counterspell_passive' },
        { id:'arcane_surge_skill', name:'Arcane Surge', icon:'⚗', tier:2, cost:1, requires:'counterspell',
          desc:'Arcane Surge builds +2 per spell (up from +1). Max charge reached faster.',
          passive: true, effect: 'surge_faster' },
        { id:'spell_weaving', name:'Spell Weaving',  icon:'🌀', tier:3, cost:2, requires:'arcane_surge_skill',
          desc:'Casting 2+ spells in one turn reduces 2nd spell MP cost by 50%.',
          passive: true, effect: 'spell_weaving_discount' },
        { id:'mana_void',     name:'Mana Void',      icon:'🕳', tier:4, cost:2, requires:'spell_weaving',
          desc:'Drain 30 MP from one enemy and gain 15 MP. 2 AP.',
          passive: false, effect: 'mana_void_skill' },
        { id:'archmage_will', name:'Archmage\'s Will', icon:'👑', tier:5, cost:3, requires:'mana_void',
          desc:'MP regenerates 15 per turn. Never fall below 20 MP. Passive.',
          passive: true, effect: 'mp_regen_passive' },
      ]
    }
  },

  // ── ROGUE ──────────────────────────────────
  rogue: {
    assassin: {
      name: 'Assassin', icon: '🎯',
      skills: [
        { id:'sneak_attack_skill', name:'Sneak Attack', icon:'🗡', tier:1, cost:1, requires:null,
          desc:'Sneak Attack now deals +DEX bonus damage. Passive upgrade.',
          passive: true, effect: 'sneak_dex_bonus' },
        { id:'garrote_skill', name:'Garrote',           icon:'🩸', tier:2, cost:1, requires:'sneak_attack_skill',
          desc:'Garrote now silences for 4 turns and applies Bleeding (3/turn).',
          passive: true, effect: 'garrote_upgraded' },
        { id:'poison_blade',  name:'Poison Blade',      icon:'☠', tier:3, cost:2, requires:'garrote_skill',
          desc:'All basic attacks have 35% chance to apply Poison (4 damage/turn, 3 turns).',
          passive: true, effect: 'poison_on_attack' },
        { id:'death_mark_rogue', name:'Death Mark',     icon:'💀', tier:4, cost:2, requires:'poison_blade',
          desc:'Mark a target: Sneak Attack and Phantom Kill deal +50% against them.',
          passive: false, effect: 'death_mark_rogue' },
        { id:'one_shot_kill', name:'One-Shot Kill',     icon:'🎯', tier:5, cost:3, requires:'death_mark_rogue',
          desc:'Once per combat: from stealth, instantly kill any non-boss target (Stealth check DC 15).',
          passive: false, effect: 'one_shot_kill_skill' },
      ]
    },
    trickster: {
      name: 'Trickster', icon: '🃏',
      skills: [
        { id:'distraction',   name:'Distraction',    icon:'🎭', tier:1, cost:1, requires:null,
          desc:'Once per combat, force an enemy to waste their turn on a distraction. Free action.',
          passive: false, effect: 'distraction_skill' },
        { id:'pickpocket',    name:'Pickpocket',     icon:'💰', tier:2, cost:1, requires:'distraction',
          desc:'Steal one consumable from enemies during combat. 0 AP.',
          passive: false, effect: 'pickpocket_skill' },
        { id:'disguise',      name:'Disguise',       icon:'🎭', tier:3, cost:2, requires:'pickpocket',
          desc:'Disguise yourself mid-combat: enemies randomly retarget for 2 turns.',
          passive: false, effect: 'disguise_skill' },
        { id:'bamboozle',     name:'Bamboozle',      icon:'🌀', tier:4, cost:2, requires:'disguise',
          desc:'Confuse one enemy: they attack a random combatant for 2 turns.',
          passive: false, effect: 'bamboozle_skill' },
        { id:'con_artist',    name:'Con Artist',     icon:'🎪', tier:5, cost:3, requires:'bamboozle',
          desc:'After combat: steal 25-75 gold from the area if enemies were present.',
          passive: true, effect: 'post_combat_loot' },
      ]
    },
    shadowblade: {
      name: 'Shadowblade', icon: '🌑',
      skills: [
        { id:'shadow_step_skill', name:'Shadow Step', icon:'🌑', tier:1, cost:1, requires:null,
          desc:'Shadow Step bonus AC increased to +6. Next attack auto-crits (2x).',
          passive: true, effect: 'shadow_step_upgraded' },
        { id:'umbra_strike',  name:'Umbra Strike',   icon:'🌑', tier:2, cost:1, requires:'shadow_step_skill',
          desc:'From Shadow Step, deal 5d8+DEX guaranteed hit shadow damage.',
          passive: false, effect: 'umbra_strike_skill' },
        { id:'darkness_cloak', name:'Darkness Cloak', icon:'🌑', tier:3, cost:2, requires:'umbra_strike',
          desc:'Wrap yourself in Darkness: 30% dodge chance for 3 turns.',
          passive: false, effect: 'darkness_cloak_skill' },
        { id:'void_blade',    name:'Void Blade',      icon:'🌌', tier:4, cost:2, requires:'darkness_cloak',
          desc:'Your blade ignores 4 AC and deals bonus void damage equal to DEX.',
          passive: true, effect: 'void_blade_passive' },
        { id:'phantom_kill_skill', name:'Phantom Kill', icon:'👤', tier:5, cost:3, requires:'void_blade',
          desc:'Phantom Kill threshold raised to 40% HP. At 5 Combo Points: always instant kill.',
          passive: true, effect: 'phantom_kill_upgraded' },
      ]
    }
  },

  // ── RANGER ─────────────────────────────────
  ranger: {
    hunter: {
      name: 'Hunter', icon: '🎯',
      skills: [
        { id:'hunters_mark_skill', name:'Hunter\'s Mark', icon:'🎯', tier:1, cost:1, requires:null,
          desc:'Hunter\'s Mark bonus damage increased to +3d6. Lasts 8 turns.',
          passive: true, effect: 'hunters_mark_upgraded' },
        { id:'multi_shot_skill', name:'Multi-Shot',      icon:'🏹', tier:2, cost:1, requires:'hunters_mark_skill',
          desc:'Multi-Shot fires at up to 4 targets (up from 3).',
          passive: true, effect: 'multi_shot_upgraded' },
        { id:'volley_skill',  name:'Volley',             icon:'☄', tier:3, cost:2, requires:'multi_shot_skill',
          desc:'Volley damage increased to 4d12. Also applies Pinned (-2 ATK) for 2 turns.',
          passive: true, effect: 'volley_upgraded' },
        { id:'colossus_slayer', name:'Colossus Slayer',  icon:'🗡', tier:4, cost:2, requires:'volley_skill',
          desc:'+2d8 bonus damage against enemies above 50% HP. Passive.',
          passive: true, effect: 'colossus_slayer' },
        { id:'apex_predator_skill', name:'Apex Predator', icon:'🐺', tier:5, cost:3, requires:'colossus_slayer',
          desc:'Spirit beast persists entire combat and attacks twice per round.',
          passive: true, effect: 'apex_predator_upgraded' },
      ]
    },
    beastmaster: {
      name: 'Beast Master', icon: '🐺',
      skills: [
        { id:'animal_companion', name:'Animal Companion', icon:'🐺', tier:1, cost:1, requires:null,
          desc:'A spirit wolf fights alongside you in every combat. Deals 1d8/turn.',
          passive: true, effect: 'wolf_companion' },
        { id:'beast_bond',    name:'Beast Bond',         icon:'💚', tier:2, cost:1, requires:'animal_companion',
          desc:'Companion damage increases to 2d8+DEX. Heals 5 HP when it kills.',
          passive: true, effect: 'beast_bond_upgraded' },
        { id:'pack_tactics',  name:'Pack Tactics',       icon:'🐺', tier:3, cost:2, requires:'beast_bond',
          desc:'When you and companion both attack same target: +4 ATK each.',
          passive: true, effect: 'pack_tactics_passive' },
        { id:'primal_strike', name:'Primal Strike',      icon:'⚡', tier:4, cost:2, requires:'pack_tactics',
          desc:'Command companion to make a ferocious attack: 4d10, 30% chance to Stun.',
          passive: false, effect: 'primal_strike_skill' },
        { id:'call_wild',     name:'Call of the Wild',   icon:'🌿', tier:5, cost:3, requires:'primal_strike',
          desc:'Call a second beast companion. Two allies fight for you.',
          passive: false, effect: 'second_companion' },
      ]
    },
    warden: {
      name: 'Warden', icon: '🌿',
      skills: [
        { id:'natures_step',  name:'Nature\'s Step',    icon:'🌿', tier:1, cost:1, requires:null,
          desc:'Movement costs 0 AP (same as Twilight Cleric\'s Steps of Night). Passive.',
          passive: true, effect: 'free_movement' },
        { id:'vine_trap_skill', name:'Vine Trap',       icon:'🌿', tier:2, cost:1, requires:'natures_step',
          desc:'Vine Trap now Roots for 3 turns and deals 2d6 thorn damage/turn.',
          passive: true, effect: 'vine_trap_upgraded' },
        { id:'camouflage',    name:'Camouflage',        icon:'🌲', tier:3, cost:2, requires:'vine_trap_skill',
          desc:'Once per combat, become invisible for 2 turns. Next attack auto-crits.',
          passive: false, effect: 'camouflage_skill' },
        { id:'terrain_reading', name:'Terrain Reading', icon:'🗺', tier:4, cost:2, requires:'camouflage',
          desc:'+3 AC in non-city locations. +1 ATK. Passive.',
          passive: true, effect: 'terrain_advantage' },
        { id:'earthwarden',   name:'Earthwarden',       icon:'🌍', tier:5, cost:3, requires:'terrain_reading',
          desc:'Roots erupt from the ground: all enemies Rooted for 2 turns, take 3d8 thorn damage. 3 AP.',
          passive: false, effect: 'earthwarden_skill' },
      ]
    }
  }
};

window.SKILL_TREES = SKILL_TREES;

// ─── SKILL STATE ─────────────────────────────
// character.unlockedSkills = Set of skill IDs
// character.skillPoints = number of unspent points
// character.skillPointsTotal = total earned

function getUnlockedSkills(char) {
  return new Set(char.unlockedSkills || []);
}

function canUnlockSkill(char, skillId) {
  const cls = char.class;
  const treeData = SKILL_TREES[cls];
  if (!treeData) return { can: false, reason: 'Unknown class' };

  let skill = null;
  for (const tree of Object.values(treeData)) {
    const found = tree.skills.find(s => s.id === skillId);
    if (found) { skill = found; break; }
  }
  if (!skill) return { can: false, reason: 'Skill not found' };

  const unlocked = getUnlockedSkills(char);
  if (unlocked.has(skillId)) return { can: false, reason: 'Already unlocked' };

  // Must have prerequisite
  if (skill.requires && !unlocked.has(skill.requires)) {
    return { can: false, reason: `Requires ${skill.requires} first` };
  }

  // Must have enough points
  if ((char.skillPoints || 0) < skill.cost) {
    return { can: false, reason: `Need ${skill.cost} skill points (have ${char.skillPoints || 0})` };
  }

  // Must be in chosen tree OR the base tree matches their chosen tree
  // Player can only unlock skills in their chosen tree
  const chosenTree = char.tree;
  const clsTreeData = SKILL_TREES[cls];
  const skillTree = Object.keys(clsTreeData).find(treeId => 
    clsTreeData[treeId].skills.some(s => s.id === skillId)
  );
  if (skillTree && chosenTree && skillTree !== chosenTree) {
    return { can: false, reason: 'Not in your chosen skill tree' };
  }

  return { can: true };
}

function unlockSkill(skillId) {
  const char = gameState.character;
  if (!char) return;

  const { can, reason } = canUnlockSkill(char, skillId);
  if (!can) { toast(reason, 'error'); return; }

  if (!char.unlockedSkills) char.unlockedSkills = [];
  char.unlockedSkills.push(skillId);

  const cls = char.class;
  let skill = null;
  for (const tree of Object.values(SKILL_TREES[cls] || {})) {
    skill = tree.skills.find(s => s.id === skillId);
    if (skill) break;
  }

  char.skillPoints = (char.skillPoints || 0) - (skill?.cost || 1);
  applySkillPassive(char, skill);

  addLog(`✨ SKILL UNLOCKED: ${skill?.icon} ${skill?.name}!`, 'holy');
  toast(`${skill?.icon} ${skill?.name} unlocked!`, 'success');

  if (window.autoSave) autoSave();
  if (typeof renderSkillTreeSheet === 'function') renderSkillTreeSheet();
}
window.unlockSkill = unlockSkill;

// ─── APPLY PASSIVE EFFECTS ON UNLOCK ─────────
function applySkillPassive(char, skill) {
  if (!skill || !skill.passive) return;
  const e = skill.effect;
  if (e === 'ac_plus_2')     { char.ac = (char.ac || 10) + 2; }
  if (e === 'hp_plus_20')    { char.maxHp += 20; char.hp = Math.min(char.hp + 20, char.maxHp); }
  if (e === 'atk_plus_2')    { char.atkBonus = (char.atkBonus || 0) + 2; }
  if (e === 'free_movement') { char._freeMovement = true; }
  if (e === 'mp_regen_passive') { char._mpRegenPerTurn = 15; }
  if (e === 'wolf_companion')   { char._hasWolfCompanion = true; }
  // Most other passives are checked at combat time via getUnlockedSkills
}
window.applySkillPassive = applySkillPassive;

// ─── GRANT SKILL POINTS ON LEVEL UP ──────────
function grantSkillPoint(char) {
  char.skillPoints = (char.skillPoints || 0) + 1;
  char.skillPointsTotal = (char.skillPointsTotal || 0) + 1;
  addLog(`✨ Skill Point gained! (${char.skillPoints} available — open Character Sheet)`, 'holy');
}
window.grantSkillPoint = grantSkillPoint;

// ─── SKILL TREE RENDER (for Character Sheet) ─
function renderSkillTreeSheet() {
  const container = document.getElementById('char-sheet-skilltree');
  if (!container) return;
  const char = gameState.character;
  if (!char) return;

  const cls = char.class;
  const treeData = SKILL_TREES[cls];
  if (!treeData) { container.innerHTML = '<div style="color:var(--text-dim)">No skill tree data.</div>'; return; }

  const unlocked = getUnlockedSkills(char);
  const chosenTree = char.tree;
  const points = char.skillPoints || 0;

  let html = `<div class="skt-header">
    <span class="skt-points">${points > 0 ? `<span style="color:#8bc87a;animation:pulse 1s infinite">✨ ${points} point${points!==1?'s':''} to spend</span>` : `<span style="color:var(--text-dim)">0 points available</span>`}</span>
  </div>`;

  // Only show the chosen tree
  const tree = treeData[chosenTree];
  if (!tree) {
    container.innerHTML = '<div style="color:var(--text-dim)">Select a skill tree at character creation.</div>';
    return;
  }

  html += `<div class="skt-tree">
    <div class="skt-tree-name">${tree.icon} ${tree.name}</div>
    <div class="skt-skills-row">`;

  tree.skills.forEach((skill, i) => {
    const isUnlocked = unlocked.has(skill.id);
    const { can } = canUnlockSkill(char, skill.id);
    const prereqUnlocked = !skill.requires || unlocked.has(skill.requires);

    let state = 'locked';
    if (isUnlocked) state = 'unlocked';
    else if (can) state = 'available';
    else if (prereqUnlocked && points < skill.cost) state = 'need-points';

    html += `
      <div class="skt-skill-wrap">
        ${i > 0 ? '<div class="skt-connector"></div>' : ''}
        <div class="skt-skill ${state}" onclick="unlockSkill('${skill.id}')" title="${skill.desc}">
          <div class="skt-skill-icon">${skill.icon}</div>
          <div class="skt-skill-name">${skill.name}</div>
          <div class="skt-skill-cost">${isUnlocked ? '✓' : `${skill.cost}pt`}</div>
        </div>
      </div>`;
  });

  html += `</div></div>`;
  container.innerHTML = html;
}
window.renderSkillTreeSheet = renderSkillTreeSheet;

// ─── SKILL TREE CSS ───────────────────────────
const skillTreeCSS = `
.skt-header { display:flex; justify-content:flex-end; margin-bottom:12px; }
.skt-tree { margin-bottom:16px; }
.skt-tree-name { font-family:'Cinzel',serif; font-size:0.75rem; color:var(--gold); letter-spacing:0.1em; margin-bottom:10px; }
.skt-skills-row { display:flex; align-items:center; gap:0; overflow-x:auto; padding-bottom:6px; }
.skt-skill-wrap { display:flex; align-items:center; }
.skt-connector { width:24px; height:2px; background:rgba(201,168,76,0.25); flex-shrink:0; }
.skt-skill {
  width:72px; min-width:72px; padding:8px 4px;
  border-radius:4px; cursor:pointer;
  text-align:center; transition:all 0.2s;
  border:1px solid rgba(201,168,76,0.15);
  background:rgba(0,0,0,0.4);
}
.skt-skill.unlocked {
  border-color:var(--gold); background:rgba(201,168,76,0.12);
  box-shadow:0 0 8px rgba(201,168,76,0.2);
}
.skt-skill.available {
  border-color:rgba(139,200,122,0.5); background:rgba(139,200,122,0.08);
  animation:pulseGlow 2s infinite;
}
.skt-skill.need-points { border-color:rgba(200,150,50,0.3); opacity:0.6; cursor:not-allowed; }
.skt-skill.locked { opacity:0.35; cursor:not-allowed; }
.skt-skill:hover.available { border-color:#8bc87a; background:rgba(139,200,122,0.15); transform:translateY(-2px); }
.skt-skill:hover.unlocked { background:rgba(201,168,76,0.18); }
.skt-skill-icon { font-size:1.2rem; margin-bottom:2px; }
.skt-skill-name { font-family:'Cinzel',serif; font-size:0.52rem; color:var(--text-secondary); letter-spacing:0.04em; line-height:1.3; }
.skt-skill-cost { font-size:0.6rem; color:var(--text-dim); margin-top:2px; }
.skt-skill.unlocked .skt-skill-cost { color:#8bc87a; }
.skt-skill.available .skt-skill-cost { color:#8bc87a; }
@keyframes pulseGlow { 0%,100%{box-shadow:0 0 4px rgba(139,200,122,0.3)} 50%{box-shadow:0 0 12px rgba(139,200,122,0.6)} }
`;
const stStyle = document.createElement('style');
stStyle.textContent = skillTreeCSS;
document.head.appendChild(stStyle);

