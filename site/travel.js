// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — TRAVEL ENCOUNTER SYSTEM
//  30% chance on any travel. 4 types: ambush, stranger,
//  chest, weather. Each forces a real decision.
// ═══════════════════════════════════════════════════════════

// ─── ENCOUNTER CATALOGUE ─────────────────────────────────

const TRAVEL_ENCOUNTERS = {

  // ── AMBUSHES ──────────────────────────────────────────
  ambush_bandits: {
    type: 'ambush',
    weight: 20,
    icon: '⚔',
    title: 'Ambush on the Road',
    scenes: [
      { from: null, to: null, // null = any route
        text: 'Three figures drop from the trees. Crossbows leveled. *"Coin or blood,"* the leader says. *"We accept both."*',
        enemy: 'bandit',
        enemyCount: 3,
      },
    ],
    options: [
      { text: 'Fight them off',       action: 'combat',    enemyKey: 'bandit' },
      { text: 'Throw them your coin purse and run', action: 'lose_gold', amount: 15, roll: null },
      { text: 'Intimidate them [STR DC12]', action: 'roll', stat: 'str', dc: 12,
        success: { text: 'Your gaze hardens. One of them steps back. The leader follows. They melt into the trees.', action: 'escape' },
        failure: { text: 'They laugh and attack anyway.', action: 'combat', enemyKey: 'bandit' }
      },
    ],
  },

  ambush_cultists: {
    type: 'ambush',
    weight: 15,
    icon: '🕯',
    title: 'Children of the Void',
    scenes: [{ text: 'Robed figures block the road. They\'re chanting. One points at you — *"The Covenant sees you. Kneel, or be made to."*' }],
    options: [
      { text: 'Fight them',             action: 'combat', enemyKey: 'cultist' },
      { text: 'Flee into the dark [DEX DC10]', action: 'roll', stat: 'dex', dc: 10,
        success: { text: 'You slip through a gap and vanish before they can follow.', action: 'escape' },
        failure: { text: 'They catch you. The chanting grows louder.', action: 'combat', enemyKey: 'cultist' }
      },
      { text: 'Tell them you serve the Covenant [CHA DC14]', action: 'roll', stat: 'cha', dc: 14,
        success: { text: 'They bow. *"Forgive the test, servant."* They part. One presses a scroll into your hand.', action: 'item', item: 'Covenant Scroll', icon: '📜', gold: 0 },
        failure: { text: 'They see through the lie immediately.', action: 'combat', enemyKey: 'cultist' }
      },
    ],
  },

  ambush_wolves: {
    type: 'ambush',
    weight: 12,
    icon: '🐺',
    title: 'Dire Wolves',
    scenes: [{ text: 'Low growling from both sides of the road. You count four sets of eyes in the dark. A pack — and you\'re between them.' }],
    options: [
      { text: 'Fight them off',    action: 'combat', enemyKey: 'wolf' },
      { text: 'Climb a tree [STR DC9]', action: 'roll', stat: 'str', dc: 9,
        success: { text: 'You haul yourself up. They circle below and eventually lose interest.', action: 'escape', hp_cost: 5 },
        failure: { text: 'You slip — they\'re on you before you recover.', action: 'combat', enemyKey: 'wolf' }
      },
      { text: 'Back away slowly and make yourself large', action: 'escape', hp_cost: 0,
        text_result: 'You back away, arms wide, maintaining eye contact. The alpha holds. The pack holds. After a long minute, they turn.' },
    ],
  },

  ambush_guard: {
    type: 'ambush',
    weight: 10,
    icon: '🛡',
    title: 'City Watch Checkpoint',
    scenes: [{ text: '*"You there. Papers."* Two city guards have set up a checkpoint. One has his hand on his sword already. The other is copying names into a ledger.' }],
    options: [
      { text: 'Show your papers and pass', action: 'escape',
        condition_flag: 'has_city_pass', condition_fail_text: 'You have no valid papers. They\'re not letting you through like this.' },
      { text: 'Bribe them [20 gold]',  action: 'spend_gold', amount: 20,
        success: { text: 'The ledger closes. One nods. You walk through.', action: 'escape' },
        fail_text: 'You don\'t have enough gold.' },
      { text: 'Use false papers [CHA DC13]', action: 'roll', stat: 'cha', dc: 13,
        condition_flag: 'has_false_papers',
        success: { text: 'They barely glance at the papers. *"Move along."*', action: 'escape' },
        failure: { text: 'The senior guard squints. *"These aren\'t right."* They reach for you.', action: 'combat', enemyKey: 'city_guard' }
      },
      { text: 'Attack and break through', action: 'combat', enemyKey: 'city_guard' },
    ],
  },

  // ── STRANGERS IN DISTRESS ──────────────────────────────
  stranger_wounded: {
    type: 'stranger',
    weight: 18,
    icon: '🩸',
    title: 'Someone Dying on the Road',
    scenes: [{ text: 'A figure slumped against a milestone. Breathing ragged. Arrows in the shoulder. Eyes that recognize you\'re not the ones who did this — not yet. *"Please... I have family in the city..."*' }],
    options: [
      { text: 'Use a bandage or potion to help [costs 1 bandage or potion]', action: 'use_consumable', item_type: 'heal',
        success: { text: 'You stabilize them. Their breathing steadies. *"Bless you. Find me at the Anchor Inn — I won\'t forget."* +5 Holy, +15 gold reward.', action: 'reward', holy: 5, gold: 15 },
        fail_text: 'You have nothing to treat them with.' },
      { text: 'Leave them. It\'s not your problem.', action: 'escape', hell: 3,
        text_result: 'You step past. Their eyes follow you down the road. You don\'t look back.' },
      { text: 'Search them while they\'re helpless', action: 'loot_npc', gold_range: [8, 22], hell: 8,
        text_result: 'Their pockets have a few coins. They try to grab your wrist and fail. You walk on.' },
    ],
  },

  stranger_merchant: {
    type: 'stranger',
    weight: 15,
    icon: '🧳',
    title: 'Stranded Merchant',
    scenes: [{ text: 'A merchant sits on an overturned cart, its wheel shattered. Crates of goods scattered across the road. He looks up — desperate, calculating. *"One hundred gold says you help me get this to the city. Bandits took my guards."*' }],
    options: [
      { text: 'Escort him to safety', action: 'escort',
        combat_chance: 0.5, enemyKey: 'bandit',
        success: { text: 'You get him through. He pays up — and throws in something from a locked crate.', action: 'reward', gold: 100, item: 'Merchant\'s Reserve Potion', icon: '⚗️' },
      },
      { text: 'Negotiate — 200 gold or nothing', action: 'roll', stat: 'cha', dc: 11,
        success: { text: 'He sputters, then agrees. Desperate men pay desperate prices.', action: 'escort',
          combat_chance: 0.5, enemyKey: 'bandit',
          reward: { gold: 200, item: 'Merchant\'s Reserve Potion', icon: '⚗️' }
        },
        failure: { text: 'He scoffs. *"Get away from me."* You walk on.', action: 'escape' }
      },
      { text: 'Steal his goods while he\'s distracted', action: 'steal', gold_range: [30, 60], hell: 5,
        text_result: 'You create a distraction, take what you can carry, and disappear down the road.' },
    ],
  },

  stranger_child: {
    type: 'stranger',
    weight: 8,
    icon: '👶',
    title: 'Lost Child',
    scenes: [{ text: 'A small figure sitting on a stone, crying quietly. Maybe eight years old. No wounds. Just... alone. Very alone. When they see you, they scramble back against the stone.' }],
    options: [
      { text: 'Sit down and speak to them gently', action: 'scene',
        text_result: 'It takes time. Slowly they talk — their family\'s cart was attacked. They hid. They don\'t know where anyone is. You escort them to the nearest settlement. +8 Holy.',
        action: 'reward', holy: 8, gold: 0 },
      { text: 'Leave them a ration and continue', action: 'escape', holy: 2,
        text_result: 'You set down a ration beside them. It\'s something. Not much.' },
      { text: 'Ignore them entirely', action: 'escape', hell: 5,
        text_result: 'You walk past. They watch you go. They stop crying — something else takes its place.' },
    ],
  },

  stranger_knight: {
    type: 'stranger',
    weight: 10,
    icon: '🛡',
    title: 'Fallen Knight',
    scenes: [{ text: 'A knight in shattered plate sits beside a dead horse. Sword unsheathed, pointed at no one. *"The Covenant had me hunting you. All of you."* He looks up. Something in his eyes has already broken. *"I don\'t anymore."*' }],
    options: [
      { text: 'Hear him out', action: 'dialogue',
        text_result: 'He tells you things. About the Covenant\'s reach. About orders he refused. He gives you a sealed letter. +flag: knows_covenant_structure.',
        action: 'reward', flag: 'knows_covenant_structure', item: 'Sealed Orders', icon: '📜' },
      { text: 'Disarm him and bind him — he\'s still an enemy', action: 'roll', stat: 'str', dc: 10,
        success: { text: 'He doesn\'t resist much. You bind him and leave him for the city watch.', action: 'escape', holy: 2 },
        failure: { text: 'He reacts faster than expected. His training takes over.', action: 'combat', enemyKey: 'city_guard' }
      },
      { text: 'Kill him. He\'s Covenant.', action: 'combat', enemyKey: 'harren_fallen' },
    ],
  },

  // ── LOCKED CHESTS & DISCOVERIES ───────────────────────
  chest_roadside: {
    type: 'chest',
    weight: 14,
    icon: '📦',
    title: 'Abandoned Chest',
    scenes: [{ text: 'An iron-banded chest sits off the road, half-hidden under leaves. No cart. No bodies. No explanation. The lock is good — someone valued what\'s inside.' }],
    options: [
      { text: 'Pick the lock [DEX DC12]', action: 'roll', stat: 'dex', dc: 12,
        success: { text: 'The lock yields. Inside: coin, wrapped cloth, something heavier at the bottom.', action: 'chest_loot', tier: 2 },
        failure: { text: 'The pick snaps. The chest holds. You can try forcing it.', action: 'chest_force' }
      },
      { text: 'Force it open [STR DC14]', action: 'roll', stat: 'str', dc: 14,
        success: { text: 'The hinges give. The lid bends back. Everything inside is intact.', action: 'chest_loot', tier: 2 },
        failure: { text: 'It doesn\'t budge. Whatever\'s in there stays in there.', action: 'escape' }
      },
      { text: 'Leave it. Could be a trap.', action: 'escape',
        text_result: 'You walk on. Could have been nothing. Could have been everything.' },
    ],
  },

  chest_cursed: {
    type: 'chest',
    weight: 8,
    icon: '💀',
    title: 'The Cursed Lockbox',
    scenes: [{ text: 'A small lockbox nailed to a post. On it, scratched in three languages: *DO NOT OPEN*. It\'s warm to the touch. Something inside shifts when you pick it up.' }],
    options: [
      { text: 'Open it anyway', action: 'roll', stat: 'wis', dc: 14,
        success: { text: 'A pulse of dark energy — you absorb it. Inside: three gold coins and a ring. +5 Hell. But the ring is extraordinary.', action: 'reward', gold: 3, item: 'Ring of the Shattered Covenant', icon: '💍', hell: 5 },
        failure: { text: 'A wave of rot hits you. Your vision blurs. You stagger back, -15 HP, and the box is empty.', action: 'damage', amount: 15 }
      },
      { text: 'Throw it in the nearest water and walk away', action: 'escape',
        text_result: 'Wise. You hear a distant splash and keep walking.' },
      { text: 'Pry it open from a distance with a stick', action: 'roll', stat: 'int', dc: 11,
        success: { text: 'You manage it. Gold coins scatter. No curse reaches you at this distance.', action: 'reward', gold: 12 },
        failure: { text: 'The stick catches whatever\'s in it. Your hand spasms from the residual energy. -8 HP.', action: 'damage', amount: 8 }
      },
    ],
  },

  chest_gravesite: {
    type: 'chest',
    weight: 7,
    icon: '⚰',
    title: 'Roadside Grave',
    scenes: [{ text: 'A fresh grave. Someone died here recently — the mound is still soft. A sword has been planted as a marker. The sword is fine work. Better than any soldier\'s blade.' }],
    options: [
      { text: 'Take the sword — the dead have no use for it', action: 'reward', item: 'Grave Sword', icon: '⚔', atk: 4, price: 110, hell: 4,
        text_result: 'You pull it free. The weight is good. Whatever soldier this was, they knew steel.' },
      { text: 'Leave it. Let the dead keep what was theirs.', action: 'escape', holy: 3,
        text_result: 'You pass. Some things should stay where they are.' },
      { text: 'Dig to see what else was buried with them [INT DC10]', action: 'roll', stat: 'int', dc: 10,
        success: { text: 'Wrapped leather — a coin purse and papers. The papers have names on them. A list. You recognize two.', action: 'reward', gold: 35, item: 'The List', icon: '📜', flag: 'found_the_list' },
        failure: { text: 'You disturb the earth and find nothing. And something about the air changes. Leave.', action: 'escape', hell: 2 }
      },
    ],
  },

  // ── WEATHER & ENVIRONMENT ─────────────────────────────
  weather_storm: {
    type: 'weather',
    weight: 12,
    icon: '⛈',
    title: 'The Storm Comes',
    scenes: [{ text: 'The sky turns wrong. Not gradually — just *wrong*, all at once. Lightning without thunder. Wind that smells of sulfur. The road ahead disappears into sheets of rain that move sideways.' }],
    options: [
      { text: 'Push through the storm', action: 'damage', amount: 12,
        text_result: 'You force through it. By the time you arrive you\'re soaked, bruised, and missing 12 HP — but you\'re there. Nothing in the storm touched you directly. Almost nothing.' },
      { text: 'Take shelter and wait it out', action: 'delay',
        text_result: 'You find a rocky overhang and wait. An hour. Two. The storm breaks as unnaturally as it started. You arrive later — but whole.' },
      { text: 'Pray for safe passage [WIS DC11]', action: 'roll', stat: 'wis', dc: 11,
        success: { text: 'Something listens. The storm parts around you. A path of stillness in the chaos, just wide enough for one. +3 Holy.', action: 'reward', holy: 3 },
        failure: { text: 'Nothing listens. Or something listens and decides against it. The storm hits harder. -18 HP.', action: 'damage', amount: 18 }
      },
    ],
  },

  weather_fog: {
    type: 'weather',
    weight: 14,
    icon: '🌫',
    title: 'The Unnatural Fog',
    scenes: [{ text: 'Fog rolls in from nowhere — thick, white, and wrong. Your hand disappears past your wrist. You can hear breathing that isn\'t yours. Something moves in the white. Close.' }],
    options: [
      { text: 'Draw your weapon and hold position', action: 'combat_chance',
        chance: 0.4, enemyKey: 'shadow',
        escape_text: 'Whatever was there decides against it. The fog lifts. You\'re standing in the middle of the road, weapon drawn, alone.' },
      { text: 'Move quickly and don\'t look at what\'s in the fog', action: 'roll', stat: 'wis', dc: 10,
        success: { text: 'You keep your eyes forward. You feel things passing close. You don\'t look. You arrive shaken but unharmed.', action: 'escape' },
        failure: { text: 'You look. You shouldn\'t have looked. -10 HP and a new memory you can\'t shake.', action: 'damage', amount: 10 }
      },
      { text: 'Use a torch to push the fog back', action: 'use_item', item: 'Alchemical Torch',
        success: { text: 'The alchemical light burns back the unnatural fog. You see the shapes retreat. You walk through clearly.', action: 'escape' },
        fail_text: 'You have no torch.' },
    ],
  },

  weather_heat: {
    type: 'weather',
    weight: 10,
    icon: '☀',
    title: 'Killing Heat',
    scenes: [{ text: 'The sun turns vicious. No shade on this road. Your armor becomes an oven. The air smells of hot iron and distant fires. After an hour you realize the road is longer than it should be.' }],
    options: [
      { text: 'Push through it', action: 'damage', amount: 8,
        text_result: 'You lose 8 HP to heat and exhaustion. You arrive depleted.' },
      { text: 'Eat your rations and rest mid-journey', action: 'use_consumable', item_type: 'rations',
        success: { text: 'The food helps. You pace yourself. You arrive tired but functional.', action: 'escape' },
        fail_text: 'You have no rations. You push through anyway and suffer for it.' },
      { text: 'Find water first [WIS DC9]', action: 'roll', stat: 'wis', dc: 9,
        success: { text: 'You read the land. A creek, hidden behind a ridge. You rest, drink, continue. +5 HP actually restored from the break.', action: 'reward', hp: 5 },
        failure: { text: 'You wander looking for water and find none. You arrive later, worse off. -10 HP.', action: 'damage', amount: 10 }
      },
    ],
  },

  weather_darkness: {
    type: 'weather',
    weight: 9,
    icon: '🌑',
    title: 'Sudden Darkness',
    scenes: [{ text: 'The light disappears. Not sunset — it\'s the wrong hour. Something vast passes between you and the sun. The animals go silent. The road goes dark. A voice in your head, not yours: *"You are seen."*' }],
    options: [
      { text: 'Run', action: 'roll', stat: 'dex', dc: 12,
        success: { text: 'You run blind and fast. You stumble twice, hit the road once, but you make it through.', action: 'damage', amount: 5 },
        failure: { text: 'You run into something solid in the dark. -15 HP. When the light returns, nothing is there.', action: 'damage', amount: 15 }
      },
      { text: 'Stand still and wait', action: 'escape',
        text_result: 'You freeze. The darkness passes. Whatever looked at you looked away. You continue, unchanged. Or mostly.' },
      { text: 'Speak back to the voice', action: 'roll', stat: 'cha', dc: 15,
        success: { text: 'It responds. Not in words — in knowledge. Something unlocks. +flag: touched_by_the_void. +8 Hell.', action: 'reward', hell: 8, flag: 'touched_by_the_void' },
        failure: { text: 'It doesn\'t like being spoken back to. -20 HP.', action: 'damage', amount: 20 }
      },
    ],
  },
};

// ─── CHEST LOOT TABLES ────────────────────────────────────
const CHEST_LOOT = {
  1: [ // Common
    { name: 'Vial of Mending',    icon: '🧪', type: 'consumable', effect: 'heal_30' },
    { name: 'Iron Dagger',        icon: '🗡', type: 'weapon', atk: 2 },
    { name: 'Field Bandage',      icon: '🩹', type: 'consumable', effect: 'heal_15' },
  ],
  2: [ // Uncommon
    { name: 'Draught of Mending', icon: '⚗️', type: 'consumable', effect: 'heal_60' },
    { name: 'Shortsword',         icon: '⚔', type: 'weapon', atk: 3 },
    { name: 'Chain Shirt',        icon: '🪖', type: 'armor', ac: 2 },
    { name: 'Essence of Focus',   icon: '💧', type: 'consumable', effect: 'mp_40' },
  ],
  3: [ // Rare
    { name: 'Longsword',          icon: '⚔', type: 'weapon', atk: 5 },
    { name: 'Half-Plate',         icon: '🛡', type: 'armor', ac: 3 },
    { name: 'Staff of Ruin',      icon: '🔮', type: 'weapon', atk: 3 },
    { name: 'Void Cloak',         icon: '🌑', type: 'armor', ac: 1 },
  ],
};

// ─── ENCOUNTER ROLL ───────────────────────────────────────
function rollTravelEncounter(fromLoc, toLoc) {
  // 30% base chance, bump to 50% for dangerous routes
  const isDangerous = (toLoc.danger || 0) >= 3 || (fromLoc.danger || 0) >= 3;
  const chance = isDangerous ? 0.50 : 0.30;

  if (Math.random() > chance) return null;

  // Don't trigger during combat or if already in an encounter
  if (window.combatState?.active) return null;
  if (document.getElementById('travel-encounter-panel')) return null;

  // Filter by route type — cities don't get ambushes, only checkpoints/weather
  const isSafeRoute = ['city', 'tavern', 'village'].includes(toLoc.type) &&
                      ['city', 'tavern', 'village'].includes(fromLoc.type);

  const pool = Object.entries(TRAVEL_ENCOUNTERS).filter(([, enc]) => {
    if (isSafeRoute && enc.type === 'ambush' && enc !== TRAVEL_ENCOUNTERS.ambush_guard) return false;
    return true;
  });

  // Weighted random
  const totalWeight = pool.reduce((s, [, e]) => s + e.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const [key, enc] of pool) {
    rand -= enc.weight;
    if (rand <= 0) return { key, enc };
  }
  return pool[pool.length - 1];
}

// ─── SHOW ENCOUNTER PANEL ────────────────────────────────
function showTravelEncounter(encObj, destination) {
  if (!encObj) return;
  const { enc } = encObj;
  const scene = enc.scenes[Math.floor(Math.random() * enc.scenes.length)];

  document.getElementById('travel-encounter-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'travel-encounter-panel';
  panel.className = 'travel-enc-panel';

  const typeColors = {
    ambush:  'rgba(200,60,60,0.85)',
    stranger:'rgba(100,160,220,0.85)',
    chest:   'rgba(201,168,76,0.85)',
    weather: 'rgba(100,100,180,0.85)',
  };
  const typeLabel = {
    ambush: '⚔ ENCOUNTER ON THE ROAD',
    stranger: '👤 A STRANGER APPEARS',
    chest: '📦 A DISCOVERY',
    weather: '🌩 THE ROAD TURNS AGAINST YOU',
  };

  panel.innerHTML = `
    <div class="tep-inner">
      <div class="tep-type-bar" style="color:${typeColors[enc.type]}">${typeLabel[enc.type]}</div>
      <div class="tep-icon">${enc.icon}</div>
      <h3 class="tep-title">${enc.title}</h3>
      <p class="tep-scene">${scene.text}</p>
      <div class="tep-options" id="tep-options">
        ${enc.options.map((opt, i) => `
          <button class="tep-option" onclick="resolveTravelOption(${i}, '${destination}')">
            ${opt.roll ? `<span class="tep-roll-badge">🎲 ${opt.roll?.toUpperCase() || opt.stat?.toUpperCase()} DC${opt.dc}</span>` : ''}
            ${opt.text}
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Store encounter on window for resolution
  window._currentTravelEncounter = encObj;

  const gameLog = document.getElementById('game-log');
  if (gameLog) {
    gameLog.appendChild(panel);
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  } else {
    document.body.appendChild(panel);
  }
  requestAnimationFrame(() => panel.style.opacity = '1');
}

// ─── RESOLVE OPTION ───────────────────────────────────────
function resolveTravelOption(index, destination) {
  const { enc } = window._currentTravelEncounter;
  const opt = enc.options[index];
  const char = gameState.character;
  if (!opt || !char) return;

  document.getElementById('travel-encounter-panel')?.remove();

  // ── ROLL ──
  if (opt.action === 'roll') {
    const stat = opt.stat;
    const dc = opt.dc;
    const statVal = char.stats?.[stat] || 10;
    const mod = Math.floor((statVal - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const success = total >= dc || roll === 20;
    const crit = roll === 20;
    const fumble = roll === 1;

    addLog(`🎲 ${stat.toUpperCase()} DC${dc}: [${roll}] ${mod >= 0 ? '+' : ''}${mod} = ${total} — ${crit ? '⭐ CRITICAL!' : fumble ? '💀 FUMBLE!' : success ? '✅ Success!' : '❌ Failure!'}`, 'dice');
    if (window.AudioEngine) AudioEngine.sfx?.dice?.();

    const result = success ? opt.success : opt.failure;
    if (!result) { arriveAtDestination(destination); return; }

    addLog(result.text, 'narrator');
    _applyTravelReward(result, destination);
    return;
  }

  // ── COMBAT ──
  if (opt.action === 'combat') {
    addLog(`⚔ ${opt.text}`, 'action');
    arriveAtDestination(destination);
    setTimeout(() => {
      if (window.generateEnemy && window.startCombat) {
        const enemies = [window.generateEnemy(opt.enemyKey, 1)];
        if (Math.random() > 0.5) enemies.push(window.generateEnemy(opt.enemyKey, 1));
        window.startCombat(enemies);
      }
    }, 600);
    return;
  }

  // ── SPEND GOLD ──
  if (opt.action === 'spend_gold' || opt.action === 'lose_gold') {
    const amount = opt.amount;
    if ((char.gold || 0) < amount) {
      if (opt.fail_text) {
        addLog(opt.fail_text, 'system');
        // Force combat instead
        setTimeout(() => {
          if (window.generateEnemy && window.startCombat) {
            const enemies = [window.generateEnemy('bandit', 1)];
            window.startCombat(enemies);
          }
        }, 1000);
        return;
      }
    }
    char.gold = Math.max(0, (char.gold || 0) - amount);
    addLog(opt.action === 'lose_gold'
      ? `💸 You toss them ${amount} gold and run. It stings.`
      : `🪙 You pay ${amount} gold. They let you through.`, 'system');
    addLog(opt.success?.text || opt.text_result || 'You continue on.', 'narrator');
    arriveAtDestination(destination);
    return;
  }

  // ── USE CONSUMABLE ──
  if (opt.action === 'use_consumable') {
    const inv = char.inventory || [];
    const hasItem = inv.some(i => i.toLowerCase().includes(opt.item_type === 'heal' ? 'mending' : opt.item_type)
      || i.toLowerCase().includes('bandage') || i.toLowerCase().includes('ration'));
    if (!hasItem) {
      addLog(opt.fail_text || 'You don\'t have what\'s needed.', 'system');
      arriveAtDestination(destination);
      return;
    }
    // Use the first matching item
    const itemIdx = inv.findIndex(i => i.toLowerCase().includes('mending') || i.toLowerCase().includes('bandage') || i.toLowerCase().includes('ration'));
    if (itemIdx !== -1) char.inventory.splice(itemIdx, 1);
    addLog(opt.success?.text || '', 'narrator');
    _applyTravelReward(opt.success || {}, destination);
    return;
  }

  // ── DAMAGE ──
  if (opt.action === 'damage') {
    const dmg = opt.amount || 10;
    char.hp = Math.max(1, (char.hp || 1) - dmg);
    addLog(opt.text_result || `The journey costs you ${dmg} HP.`, 'narrator');
    addLog(`💔 Lost ${dmg} HP. (${char.hp}/${char.maxHp})`, 'combat');
    if (window.updateCharacterPanel) updateCharacterPanel();
    arriveAtDestination(destination);
    return;
  }

  // ── CHEST LOOT ──
  if (opt.action === 'chest_loot') {
    const tier = opt.tier || 1;
    const table = CHEST_LOOT[tier] || CHEST_LOOT[1];
    const lootItem = table[Math.floor(Math.random() * table.length)];
    const goldBonus = Math.floor(Math.random() * 20) + tier * 10;
    char.inventory = char.inventory || [];
    char.inventory.push(lootItem.name);
    char.gold = (char.gold || 0) + goldBonus;
    if (lootItem.type === 'weapon' && lootItem.atk) char.atkBonus = (char.atkBonus || 0) + lootItem.atk;
    if (lootItem.type === 'armor' && lootItem.ac) char.ac = (char.ac || 10) + lootItem.ac;
    addLog(`📦 Found: ${lootItem.icon} ${lootItem.name} and 🪙 ${goldBonus} gold.`, 'holy');
    toast(`${lootItem.icon} ${lootItem.name} added to inventory!`, 'success');
    if (window.updateCharacterPanel) updateCharacterPanel();
    arriveAtDestination(destination);
    return;
  }

  // ── STEAL ──
  if (opt.action === 'steal' || opt.action === 'loot_npc') {
    const [min, max] = opt.gold_range || [5, 20];
    const gold = Math.floor(Math.random() * (max - min)) + min;
    char.gold = (char.gold || 0) + gold;
    if (opt.hell) { char.hellPoints = (char.hellPoints || 0) + opt.hell; addLog(`⛧ +${opt.hell} Hell Points`, 'hell'); }
    if (window.onHarmCitizen) onHarmCitizen();
    addLog(opt.text_result || `You take ${gold} gold.`, 'narrator');
    addLog(`🪙 +${gold} gold`, 'system');
    arriveAtDestination(destination);
    return;
  }

  // ── ESCAPE / GENERIC ──
  addLog(opt.text_result || opt.text || 'You continue on your way.', 'narrator');
  if (opt.holy) { char.holyPoints = (char.holyPoints || 0) + opt.holy; addLog(`✝ +${opt.holy} Holy Points`, 'holy'); }
  if (opt.hell) { char.hellPoints = (char.hellPoints || 0) + opt.hell; addLog(`⛧ +${opt.hell} Hell Points`, 'hell'); }
  // Rep hooks for generic outcomes
  if (opt.holy && opt.holy >= 5 && window.onHelpCitizen) onHelpCitizen();
  if (opt.hell && opt.hell >= 5 && window.onHarmCitizen) onHarmCitizen();
  if (opt.action === 'spend_gold' && window.onBribeGuard) onBribeGuard();
  arriveAtDestination(destination);
}

// ─── APPLY REWARD ─────────────────────────────────────────
function _applyTravelReward(result, destination) {
  const char = gameState.character;
  if (!char || !result) { arriveAtDestination(destination); return; }

  if (result.gold) { char.gold = (char.gold || 0) + result.gold; addLog(`🪙 +${result.gold} gold`, 'system'); }
  if (result.hp)   { char.hp = Math.min(char.maxHp, (char.hp || 1) + result.hp); addLog(`💚 +${result.hp} HP`, 'holy'); }
  if (result.holy) { char.holyPoints = (char.holyPoints || 0) + result.holy; addLog(`✝ +${result.holy} Holy Points`, 'holy'); }
  if (result.hell) { char.hellPoints = (char.hellPoints || 0) + result.hell; addLog(`⛧ +${result.hell} Hell Points`, 'hell'); }
  if (result.item) {
    char.inventory = char.inventory || [];
    char.inventory.push(result.item);
    toast(`${result.icon || '📦'} ${result.item} added to inventory!`, 'success');
  }
  if (result.flag && window.sceneState) {
    window.sceneState.flags = window.sceneState.flags || {};
    window.sceneState.flags[result.flag] = true;
    addLog(`📖 New knowledge: ${result.flag.replace(/_/g,' ')}`, 'system');
  }
  if (result.action === 'damage') {
    const dmg = result.amount || 10;
    char.hp = Math.max(1, (char.hp || 1) - dmg);
    addLog(`💔 Lost ${dmg} HP. (${char.hp}/${char.maxHp})`, 'combat');
  }
  if (result.action === 'combat') {
    arriveAtDestination(destination);
    setTimeout(() => {
      if (window.generateEnemy && window.startCombat) {
        const enemies = [window.generateEnemy(result.enemyKey, 1)];
        window.startCombat(enemies);
      }
    }, 600);
    return;
  }

  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.autoSave) autoSave();
  arriveAtDestination(destination);
}

// ─── ARRIVE AT DESTINATION ────────────────────────────────
function arriveAtDestination(locId) {
  if (!locId) return;
  const loc = window.WORLD_LOCATIONS?.[locId];
  if (!loc) return;
  addLog(`🗺 You arrive at ${loc.name}.`, 'system');
  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.autoSave) autoSave();
}

// ─── INJECT CSS ───────────────────────────────────────────
(function injectTravelCSS() {
  const style = document.createElement('style');
  style.textContent = `
  .travel-enc-panel {
    background: linear-gradient(180deg, rgba(5,3,8,0.99) 0%, rgba(10,6,15,0.99) 100%);
    border: 1px solid rgba(201,168,76,0.25);
    border-top: 2px solid rgba(201,168,76,0.5);
    margin: 8px 0;
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .tep-inner { padding: 24px 28px 20px; }
  .tep-type-bar {
    font-family: 'Cinzel', serif;
    font-size: 0.62rem;
    letter-spacing: 0.15em;
    margin-bottom: 12px;
  }
  .tep-icon { font-size: 48px; text-align: center; display: block; margin-bottom: 8px; }
  .tep-title {
    font-family: 'Cinzel', serif;
    color: var(--gold, #c9a84c);
    font-size: 1.05rem;
    text-align: center;
    margin-bottom: 16px;
    letter-spacing: 0.04em;
  }
  .tep-scene {
    font-family: 'IM Fell English', serif;
    font-size: 0.9rem;
    color: rgba(255,255,255,0.75);
    font-style: italic;
    line-height: 1.75;
    margin-bottom: 20px;
    text-align: center;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }
  .tep-options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 580px;
    margin: 0 auto;
  }
  .tep-option {
    background: rgba(201,168,76,0.05);
    border: 1px solid rgba(201,168,76,0.15);
    color: rgba(255,255,255,0.8);
    font-family: 'Cinzel', serif;
    font-size: 0.73rem;
    padding: 10px 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tep-option:hover {
    background: rgba(201,168,76,0.12);
    border-color: rgba(201,168,76,0.4);
    color: var(--gold, #c9a84c);
  }
  .tep-roll-badge {
    background: rgba(100,80,200,0.2);
    border: 1px solid rgba(100,80,200,0.3);
    color: #a090e0;
    font-size: 0.6rem;
    padding: 2px 6px;
    border-radius: 2px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  `;
  document.head.appendChild(style);
})();

// ─── HOOK INTO TRAVEL ─────────────────────────────────────
// Wrap travelToLocation to intercept with encounter check
(function hookTravel() {
  const _orig = window.travelToLocation;
  if (!_orig) {
    // map.js not loaded yet — retry
    setTimeout(hookTravel, 500);
    return;
  }

  window.travelToLocation = function(loc) {
    const fromLocId = window.mapState?.currentLocation;
    const fromLoc = window.WORLD_LOCATIONS?.[fromLocId] || {};

    // Run travel first (music, fog of war, description)
    _orig(loc);

    // Then check for travel encounter (delayed so narration shows first)
    const encObj = rollTravelEncounter(fromLoc, loc);
    if (encObj) {
      setTimeout(() => {
        addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
        showTravelEncounter(encObj, loc.id);
      }, 1800);
    }
  };

  console.log('🗺 Travel encounter system loaded.');
})();
