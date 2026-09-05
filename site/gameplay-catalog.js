// Canonical catalogs shared by browser and multiplayer server.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.GameplayCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CLASS_SPELLS = {
  cleric: [
    { id:'cure_wounds',    level:1,  name:'Cure Wounds',      icon:'💚', ap:2, mp:20, damage:null,        heal:'2d8+WIS', type:'heal',    desc:'Restore 2d8+WIS HP to one ally.' },
    { id:'spirit_weapon',  level:3,  name:'Spiritual Weapon', icon:'👻', ap:2, mp:35, damage:'2d8+WIS',   heal:null,      type:'holy',    desc:'Summon a floating spectral blade. Attacks each round.' },
    { id:'mass_heal',      level:5,  name:'Mass Heal',        icon:'💫', ap:2, mp:60, damage:null,        heal:'2d6+WIS', type:'heal',    holy_cost:8,  desc:'Heal ALL allies for 2d6+WIS. Costs 8 Holy Points.' },
    { id:'divine_strike',  level:7,  name:'Divine Strike',    icon:'⚡', ap:2, mp:45, damage:'4d8+WIS',   heal:null,      type:'holy',    desc:'Channel divinity into a strike. Deals holy damage.' },
    { id:'revivify',       level:10, name:'Revivify',         icon:'❤', ap:2, mp:80, damage:null,        heal:'1',       type:'revive',  desc:'Restore a fallen ally to 1 HP. Must use within 3 turns.' },
  ],
  paladin: [
    { id:'holy_smite',    level:1,  name:'Holy Smite',    icon:'✝', ap:2, mp:30, damage:'3d6+WIS', heal:'1d4', type:'holy',  desc:'Radiant damage + heal yourself 1d4. Costs 5 Holy.' },
    { id:'lay_on_hands',  level:3,  name:'Lay on Hands',  icon:'🙏', ap:2, mp:25, damage:null,      heal:'3d8', type:'heal',  desc:'Touch an ally to heal 3d8+WIS. Not self.' },
    { id:'divine_shield', level:5,  name:'Divine Shield', icon:'🔆', ap:2, mp:50, damage:null,      heal:null,  type:'buff',  holy_cost:10, desc:'Absorb up to 30 damage for self or ally. 10 Holy.' },
    { id:'judgment',      level:7,  name:'Judgment',      icon:'⚖', ap:2, mp:60, damage:'5d10+WIS',heal:null,  type:'holy',  holy_cost:15, desc:'Devastating holy strike. Costs 15 Holy Points.' },
    { id:'wrath_divine',  level:10, name:'Wrath of God',  icon:'☀', ap:3, mp:90, damage:'8d10+WIS',heal:null,  type:'holy',  holy_cost:25, desc:'Annihilate one target with divine fury. 25 Holy.' },
  ],
  mage: [
    { id:'magic_missile', level:1,  name:'Magic Missile', icon:'✨', ap:2, mp:20, damage:'3d4+INT', heal:null, type:'arcane', desc:'Auto-hit magic bolts. Never misses.' },
    { id:'fireball',      level:3,  name:'Fireball',      icon:'🔥', ap:2, mp:40, damage:'6d6',     heal:null, type:'fire',   desc:'AOE explosion. Hits ALL in range — allies too!', aoe:true },
    { id:'mirror_image',  level:5,  name:'Mirror Image',  icon:'👁', ap:2, mp:30, damage:null,      heal:null, type:'buff',   desc:'3 illusions absorb hits before you.' },
    { id:'chain_lightning',level:7, name:'Chain Lightning',icon:'⚡',ap:2, mp:45, damage:'4d10',    heal:null, type:'lightning',desc:'Chains between targets. 50% ally splash.', aoe:true },
    { id:'disintegrate',  level:10, name:'Disintegrate',  icon:'💀', ap:3, mp:80, damage:'10d6+INT',heal:null, type:'arcane', desc:'CON save or disintegrated. 20% ally splash.' },
  ],
  warrior: [
    { id:'war_cry',       level:1,  name:'War Cry',         icon:'😤', ap:1, mp:20, damage:null,      heal:null, type:'buff',     desc:'+2 ATK for all allies for 3 turns.' },
    { id:'whirlwind',     level:3,  name:'Whirlwind Strike',icon:'🌀', ap:2, mp:35, damage:'3d8',     heal:null, type:'physical', desc:'Hit ALL nearby — including allies!', aoe:true },
    { id:'last_stand',    level:5,  name:'Last Stand',      icon:'🛡', ap:1, mp:40, damage:null,      heal:null, type:'buff',     desc:'Below 20 HP: +50% damage, immune to knockback.' },
    { id:'execute',       level:7,  name:'Execute',         icon:'⚔', ap:2, mp:50, damage:'5d10+STR',heal:null, type:'physical', desc:'Massive strike vs targets below 25% HP.' },
    { id:'avatar_war',    level:10, name:'Avatar of War',   icon:'🔥', ap:3, mp:80, damage:'6d12+STR',heal:null, type:'physical', desc:'Become unstoppable for 3 turns. +100% damage.' },
  ],
  rogue: [
    { id:'sneak_attack',  level:1,  name:'Sneak Attack',  icon:'🗡', ap:1, mp:15, damage:'3d6+DEX', heal:null, type:'physical', desc:'Bonus damage from stealth or flanking.' },
    { id:'smoke_bomb',    level:3,  name:'Smoke Bomb',    icon:'💨', ap:1, mp:20, damage:null,      heal:null, type:'debuff',   desc:'All in area get -4 to attacks. Allies too.' },
    { id:'shadow_step',   level:5,  name:'Shadow Step',   icon:'🌑', ap:1, mp:25, damage:null,      heal:null, type:'movement', desc:'Teleport to any shadow within 60ft.' },
    { id:'garrote',       level:7,  name:'Garrote',       icon:'🩸', ap:2, mp:30, damage:'4d6+DEX', heal:null, type:'physical', desc:'Silence target (no spells) for 3 turns.' },
    { id:'phantom_kill',  level:10, name:'Phantom Kill',  icon:'👤', ap:3, mp:60, damage:'8d8+DEX', heal:null, type:'physical', desc:'Assassinate from darkness. Instant kill if target <30% HP.' },
  ],
  ranger: [
    { id:'hunters_mark',  level:1,  name:"Hunter's Mark", icon:'🎯', ap:1, mp:20, damage:'+2d6 bonus',heal:null,type:'buff',     desc:'Mark one target. All attacks vs them deal extra damage.' },
    { id:'multi_shot',    level:3,  name:'Multi-Shot',    icon:'🏹', ap:2, mp:35, damage:'2d8 x3',  heal:null, type:'physical', desc:'3 arrows at different targets. Can hit allies.' },
    { id:'vine_trap',     level:5,  name:'Vine Trap',     icon:'🌿', ap:2, mp:30, damage:null,      heal:null, type:'debuff',   desc:'Root target for 2 turns. Cannot move or dash.' },
    { id:'volley',        level:7,  name:'Volley',        icon:'☄', ap:2, mp:50, damage:'3d10',    heal:null, type:'physical', desc:'Rain arrows on an area. No exceptions.', aoe:true },
    { id:'apex_predator', level:10, name:'Apex Predator', icon:'🐺', ap:3, mp:70, damage:'6d10+DEX',heal:null,type:'physical', desc:'Summon a spirit beast. Attacks with you each turn.' },
  ],
};
const SHOP_ITEMS = {

  // CONSUMABLES
  health_potion_sm:  { id:'health_potion_sm',  name:'Vial of Mending',       icon:'🧪', type:'consumable', effect:'heal_30',  price:18,  desc:'Restores 30 HP. Bitter taste of iron.' },
  health_potion_lg:  { id:'health_potion_lg',  name:'Draught of Mending',     icon:'⚗️', type:'consumable', effect:'heal_60',  price:40,  desc:'Restores 60 HP. Warm in the throat.' },
  mp_potion:         { id:'mp_potion',          name:'Essence of Focus',       icon:'💧', type:'consumable', effect:'mp_40',    price:30,  desc:'Restores 40 MP. Smells of ozone.' },
  antidote:          { id:'antidote',           name:'Antidote Tincture',      icon:'🌿', type:'consumable', effect:'cure_poison', price:22, desc:'Cures poison. Tastes of ash.' },
  holy_water:        { id:'holy_water',          name:'Holy Water',            icon:'✝',  type:'consumable', effect:'holy_dmg_undead', price:25, desc:'Burns undead and demons. +20 DMG vs unholy.' },
  bandage:           { id:'bandage',             name:'Field Bandage',         icon:'🩹', type:'consumable', effect:'heal_15',  price:8,   desc:'Restores 15 HP. Crude but effective.' },
  smoke_bomb:        { id:'smoke_bomb',          name:'Smoke Bomb',            icon:'💨', type:'consumable', effect:'escape',   price:35,  desc:'Creates cover. Allows retreat from combat.' },
  strength_draft:    { id:'strength_draft',      name:'Draft of Might',        icon:'🍺', type:'consumable', effect:'str_buff', price:45,  desc:'+4 STR for 3 turns. Smells like a forge.' },
  shadow_oil:        { id:'shadow_oil',          name:'Shadow Oil',            icon:'🌑', type:'consumable', effect:'sneak_buff', price:55, desc:'+4 DEX for 3 turns. Reeks of void.' },
  rations:           { id:'rations',             name:'Iron Rations',          icon:'🥩', type:'consumable', effect:'heal_10',  price:5,   desc:'Trail food. Restores 10 HP during rest.' },

  // WEAPONS
  iron_dagger:       { id:'iron_dagger',         name:'Iron Dagger',           icon:'🗡', type:'weapon', atk:2,  price:30,  desc:'+2 ATK. Fast and concealable.' },
  shortsword:        { id:'shortsword',           name:'Shortsword',            icon:'⚔', type:'weapon', atk:3,  price:55,  desc:'+3 ATK. Standard city guard issue.' },
  longsword:         { id:'longsword',            name:'Longsword',             icon:'⚔', type:'weapon', atk:5,  price:110, desc:'+5 ATK. A knight\'s blade.' },
  war_axe:           { id:'war_axe',              name:'War Axe',               icon:'🪓', type:'weapon', atk:6,  price:130, desc:'+6 ATK. Brutal and unsubtle.' },
  holy_blade:        { id:'holy_blade',           name:'Blessed Blade',         icon:'✝', type:'weapon', atk:4,  price:180, desc:'+4 ATK, +10 DMG vs undead. Church-forged.' },
  shadow_knife:      { id:'shadow_knife',         name:'Shadow Knife',          icon:'🌑', type:'weapon', atk:4,  price:160, desc:'+4 ATK, ignores 2 AC. Void-touched steel.' },
  staff_of_ruin:     { id:'staff_of_ruin',        name:'Staff of Ruin',         icon:'🔮', type:'weapon', atk:3,  price:150, desc:'+3 ATK, +4 spell damage. Humming with energy.' },
  crossbow:          { id:'crossbow',             name:'Crossbow',              icon:'🏹', type:'weapon', atk:4,  price:95,  desc:'+4 ATK ranged. Requires bolts.' },

  // ARMOR
  leather_armor:     { id:'leather_armor',        name:'Leather Armor',         icon:'🥋', type:'armor', ac:1,   price:40,  desc:'+1 AC. Light and flexible.' },
  chain_shirt:       { id:'chain_shirt',          name:'Chain Shirt',           icon:'🪖', type:'armor', ac:2,   price:90,  desc:'+2 AC. Rings of tested steel.' },
  half_plate:        { id:'half_plate',           name:'Half-Plate',            icon:'🛡', type:'armor', ac:3,   price:200, desc:'+3 AC. Heavy but reliable.' },
  shield:            { id:'shield',               name:'Iron Shield',           icon:'🛡', type:'armor', ac:2,   price:65,  desc:'+2 AC. Block and push.' },
  void_cloak:        { id:'void_cloak',           name:'Void Cloak',            icon:'🌑', type:'armor', ac:1,   price:140, desc:'+1 AC, +2 DEX. Woven from shadow.' },
  church_vestments:  { id:'church_vestments',     name:'Church Vestments',      icon:'✝', type:'armor', ac:1,   price:80,  desc:'+1 AC, +2 WIS. Holy protection.' },

  // KEY ITEMS / LORE
  city_pass:         { id:'city_pass',            name:'City Watch Pass',       icon:'📜', type:'key_item', price:120, desc:'Grants access to restricted districts. Forged.' },
  false_identity:    { id:'false_identity',       name:'False Papers',          icon:'🪪', type:'key_item', price:200, desc:'A complete false identity. Dangerous to carry.' },
  thieves_tools:     { id:'thieves_tools',        name:'Thieves\' Tools',       icon:'🔧', type:'key_item', price:50,  desc:'+4 DEX on lock-picking and trap disarming.' },
  torch:             { id:'torch',                name:'Alchemical Torch',      icon:'🔦', type:'key_item', price:12,  desc:'Burns for 6 hours. Reveals hidden doors.' },
  rope:              { id:'rope',                 name:'Silk Rope (50ft)',      icon:'🪢', type:'key_item', price:15,  desc:'Strong and silent. Endless uses.' },
  poison_vial:       { id:'poison_vial',          name:'Vial of Nightshade',    icon:'☠', type:'consumable', effect:'poison_weapon', price:75, desc:'Coats weapon for 3 strikes. -5 HP/turn for 3 turns.' },
};
function spellsFor(classId,level=1){return (CLASS_SPELLS[classId]||[]).filter(spell=>spell.level<=level).map(spell=>({...spell}));}
const LEGACY_CONSUMABLES={
  'Health Potion':{name:'Health Potion',effect:'heal_30'},
  'Healing Potion':{name:'Healing Potion',effect:'heal_30'},
  'MP Tonic':{name:'MP Tonic',effect:'mp_40'},
};
function consumable(name){return Object.values(SHOP_ITEMS).find(item=>item.name===name&&/^(heal|mp)_\d+$/.test(item.effect||''))||(Object.hasOwn(LEGACY_CONSUMABLES,name)?LEGACY_CONSUMABLES[name]:null);}
return {CLASS_SPELLS,SHOP_ITEMS,spellsFor,consumable};
});
