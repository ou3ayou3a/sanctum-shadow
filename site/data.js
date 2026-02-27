// ============================================
//   SANCTUM & SHADOW — GAME DATA
// ============================================

const RACES = [
  { id: 'human', icon: '👤', name: 'Human', bonus: '+1 all stats', bonusData: { str:1,dex:1,con:1,int:1,wis:1,cha:1 }, lore: 'Adaptable and ambitious, humans forge their destiny by sheer will.' },
  { id: 'dwarf', icon: '⛏', name: 'Dwarf', bonus: '+3 CON, +2 STR', bonusData: { con:3, str:2 }, lore: 'Iron-willed and stubborn, dwarves have survived in the harshest mountains.' },
  { id: 'elf', icon: '🌿', name: 'Elf', bonus: '+3 DEX, +2 INT', bonusData: { dex:3, int:2 }, lore: 'Ancient and graceful, elves weave magic into their every breath.' },
  { id: 'high_elf', icon: '✨', name: 'High Elf', bonus: '+4 INT, +2 WIS', bonusData: { int:4, wis:2 }, lore: 'Masters of arcane arts, High Elves remember the world before the fall.' },
  { id: 'dark_elf', icon: '🌑', name: 'Dark Elf', bonus: '+3 DEX, +2 CHA', bonusData: { dex:3, cha:2 }, lore: 'Exiled to the shadows, Dark Elves wield darkness as a divine gift.' },
  { id: 'orc', icon: '💀', name: 'Orc', bonus: '+5 STR, -1 INT', bonusData: { str:5, int:-1 }, lore: 'Born warriors who see death as a doorway to glory.' },
  { id: 'goblin', icon: '🐸', name: 'Goblin', bonus: '+4 DEX, -1 CON', bonusData: { dex:4, con:-1 }, lore: 'Cunning survivors who thrive in the cracks of civilization.' },
];

const CLASSES = [
  {
    id: 'warrior',
    icon: '⚔',
    name: 'Warrior',
    desc: 'Master of steel and blood. The battlefield is your cathedral.',
    role: 'Tank / Melee DPS',
    primaryStat: 'STR',
    trees: [
      { id: 'berserker', name: 'Berserker', icon: '🔥', skills: ['Rage Strike', 'Blood Frenzy', 'War Cry', 'Unstoppable', 'Avatar of War'] },
      { id: 'guardian', name: 'Guardian', icon: '🛡', skills: ['Shield Wall', 'Iron Skin', 'Provoke', 'Last Stand', 'Immortal Bastion'] },
      { id: 'warlord', name: 'Warlord', icon: '👑', skills: ['Battle Orders', 'Flanking Strike', 'Inspire Troops', 'Death Mark', 'Conqueror'] },
    ],
    startingHP: 120,
    startingMP: 30,
    inventory: ['Iron Greatsword', 'Chain Mail', 'Health Potion x3'],
    skills: { melee: 15, armor: 10, intimidate: 8 }
  },
  {
    id: 'paladin',
    icon: '☩',
    name: 'Paladin',
    desc: 'Holy warrior. Your sword is your faith. Your faith is your sword.',
    role: 'Tank / Support / Holy DPS',
    primaryStat: 'STR/WIS',
    trees: [
      { id: 'crusader', name: 'Crusader', icon: '⚔', skills: ['Holy Smite', 'Consecrate Ground', 'Divine Charge', 'Judgment', 'Wrath of the Divine'] },
      { id: 'protector', name: 'Protector', icon: '✝', skills: ['Lay on Hands', 'Aura of Protection', 'Divine Shield', 'Sacred Barrier', 'Miracle'] },
      { id: 'inquisitor', name: 'Inquisitor', icon: '⚖', skills: ['Detect Evil', 'Mark of Heresy', 'Righteous Fury', 'Trial by Combat', 'Execution'] },
    ],
    startingHP: 100,
    startingMP: 70,
    inventory: ['Holy Mace', 'Plate Armor', 'Holy Water x2', 'Scripture'],
    skills: { melee: 12, holy: 15, healing: 10 }
  },
  {
    id: 'cleric',
    icon: '✨',
    name: 'Cleric',
    desc: 'The gods speak through your wounds and your words.',
    role: 'Healer / Support / Magic',
    primaryStat: 'WIS',
    trees: [
      { id: 'healer', name: 'Life Domain', icon: '💚', skills: ['Cure Wounds', 'Mass Heal', 'Revivify', 'Sacred Ground', 'Resurrection'] },
      { id: 'war_cleric', name: 'War Domain', icon: '⚔', skills: ['Spiritual Weapon', 'Divine Strike', 'Guided Strike', 'War God\'s Blessing', 'Avatar of Battle'] },
      { id: 'shadow_cleric', name: 'Twilight Domain', icon: '🌑', skills: ['Eyes of the Dark', 'Veil of Twilight', 'Darkness Ward', 'Steps of Night', 'Deepest Dark'] },
    ],
    startingHP: 80,
    startingMP: 100,
    inventory: ['Holy Staff', 'Robes', 'Healing Kit', 'Candles x6'],
    skills: { healing: 18, holy: 12, knowledge: 10 }
  },
  {
    id: 'mage',
    icon: '🔮',
    name: 'Mage',
    desc: 'Reality is just a suggestion. You have better ones.',
    role: 'Arcane DPS / Control',
    primaryStat: 'INT',
    trees: [
      { id: 'destruction', name: 'Destruction', icon: '💥', skills: ['Fireball', 'Chain Lightning', 'Meteor Swarm', 'Disintegrate', 'Apocalypse'] },
      { id: 'illusion', name: 'Illusion', icon: '👁', skills: ['Mirror Image', 'Phantasm', 'Mass Hallucination', 'Mind Maze', 'Reality Break'] },
      { id: 'arcane', name: 'Arcane Mastery', icon: '⚗', skills: ['Counterspell', 'Arcane Surge', 'Spell Weaving', 'Mana Void', 'Archmage\'s Will'] },
    ],
    startingHP: 60,
    startingMP: 130,
    inventory: ['Arcane Staff', 'Mage Robes', 'Spellbook', 'Mana Crystal x2'],
    skills: { magic: 18, arcana: 15, perception: 8 }
  },
  {
    id: 'rogue',
    icon: '🗡',
    name: 'Rogue',
    desc: 'You don\'t fight fair. Fair is a concept invented by people who lose.',
    role: 'Stealth DPS / Utility',
    primaryStat: 'DEX',
    trees: [
      { id: 'assassin', name: 'Assassin', icon: '🎯', skills: ['Sneak Attack', 'Garrote', 'Poison Blade', 'Death Mark', 'One-Shot Kill'] },
      { id: 'trickster', name: 'Trickster', icon: '🃏', skills: ['Distraction', 'Pickpocket', 'Disguise', 'Bamboozle', 'Con Artist'] },
      { id: 'shadowblade', name: 'Shadowblade', icon: '🌑', skills: ['Shadow Step', 'Umbra Strike', 'Darkness Cloak', 'Void Blade', 'Phantom Kill'] },
    ],
    startingHP: 70,
    startingMP: 60,
    inventory: ['Twin Daggers', 'Leather Armor', 'Poison Vials x3', 'Lockpicks'],
    skills: { stealth: 18, sleight: 15, acrobatics: 12 }
  },
  {
    id: 'ranger',
    icon: '🏹',
    name: 'Ranger',
    desc: 'The forest is your temple. Every arrow is a prayer.',
    role: 'Ranged DPS / Scout',
    primaryStat: 'DEX/WIS',
    trees: [
      { id: 'hunter', name: 'Hunter', icon: '🎯', skills: ['Hunter\'s Mark', 'Multi-Shot', 'Volley', 'Colossus Slayer', 'Apex Predator'] },
      { id: 'beastmaster', name: 'Beast Master', icon: '🐺', skills: ['Animal Companion', 'Beast Bond', 'Pack Tactics', 'Primal Strike', 'Call of the Wild'] },
      { id: 'warden', name: 'Warden', icon: '🌿', skills: ['Nature\'s Step', 'Vine Trap', 'Camouflage', 'Terrain Reading', 'Earthwarden'] },
    ],
    startingHP: 80,
    startingMP: 50,
    inventory: ['Longbow', 'Quiver (30 arrows)', 'Short Sword', 'Hunting Cloak'],
    skills: { ranged: 18, survival: 15, tracking: 12 }
  },
];

const BACKSTORY_ORIGINS = {
  fallen_noble: {
    label: 'Fallen Noble',
    narrative: (name, race, cls) => `${name} was born into privilege — feasts, politics, servants, and silk. But when the family estate burned under mysterious circumstances and the debts came due, everything collapsed overnight. Nobility offers no protection from ruin; it merely makes the fall more spectacular. Now ${name} wanders with a coat of arms nobody recognizes and a burning need to know who lit that fire.`,
    quests: [
      { title: 'The Burning Estate', desc: 'Uncover who destroyed your family home and why.', xp: 300 },
      { title: 'The Missing Signet Ring', desc: 'Find the family heirloom stolen the night of the fire.', xp: 200 },
      { title: 'A Debt Unpaid', desc: 'The estate\'s creditor wants blood money. Pay it... or end them.', xp: 250 },
      { title: 'Old Allies, New Wolves', desc: 'Seek former allies of your family — but trust none of them.', xp: 350 },
      { title: 'Reclaim the Name', desc: 'Restore your family\'s honor by any means necessary.', xp: 500 },
    ]
  },
  orphan_war: {
    label: 'War Orphan',
    narrative: (name) => `When ${name} was seven, soldiers came. No warning. By morning, the village was ash and everyone in it was either dead or marching in chains. ${name} escaped by hiding in a root cellar for three days, listening to the screaming above. Now grown, trained, and cold — ${name} remembers every face of the men who commanded that raid. The list is short. The graves are not yet dug.`,
    quests: [
      { title: 'The Commander\'s Name', desc: 'Find the name of the officer who ordered the raid.', xp: 250 },
      { title: 'The Survivor\'s Map', desc: 'Someone else survived that night. Find them.', xp: 300 },
      { title: 'The Merchant\'s Ledger', desc: 'Who paid for that army? Follow the gold.', xp: 350 },
      { title: 'The Deserted Camp', desc: 'Return to where your village once stood. Something was buried.', xp: 200 },
      { title: 'Judgment', desc: 'Face the commander of the raid. What you do next defines you.', xp: 600 },
    ]
  },
  cursed_bloodline: {
    label: 'Cursed Bloodline',
    narrative: (name) => `${name}'s grandmother made a deal with something ancient. The details are vague — family lore, hushed voices at dinner, relatives who died too young or too strange. The curse skips a generation, they said. They were wrong. At puberty, ${name} began to hear a voice. Not threatening. Just... patient. Waiting. The blood runs hot on bad nights and the dreams are never innocent.`,
    quests: [
      { title: 'The Grandmother\'s Bargain', desc: 'Find records of the original deal your ancestor made.', xp: 300 },
      { title: 'The Voice Has a Name', desc: 'Discover the identity of what speaks in your blood.', xp: 350 },
      { title: 'The Binding Mark', desc: 'A scar appears on your skin at full moon. Someone out there has the matching mark.', xp: 250 },
      { title: 'Break the Chain', desc: 'Find a way to sever the bloodline curse permanently.', xp: 500 },
      { title: 'Feed the Blood or Starve It', desc: 'The curse demands tribute. You decide if you pay.', xp: 400 },
    ]
  },
  divine_chosen: {
    label: 'Divinely Chosen',
    narrative: (name) => `It happened once. ${name} was alone, half-starved, about to give up. Then — a light that had no source, a voice that had no throat, and a single phrase that still rings every morning upon waking: "You are not finished." No mission was given. No power was transferred. Just the certainty of purpose with no explanation of what that purpose is. God chose ${name}. What for, is the whole question.`,
    quests: [
      { title: 'The Dream That Repeats', desc: 'The same vision, every night. Decode its meaning.', xp: 200 },
      { title: 'The Prophet\'s Scroll', desc: 'An ancient text references someone matching your description. Find it.', xp: 300 },
      { title: 'The Temple of the Unnamed', desc: 'A ruined temple bears your name carved in stone — dated 400 years ago.', xp: 350 },
      { title: 'The Second Voice', desc: 'A demon claims GOD made the same deal with IT regarding you.', xp: 450 },
      { title: 'Fulfill the Calling', desc: 'Discover and complete the act you were chosen to perform.', xp: 700 },
    ]
  },
  exile: {
    label: 'The Exiled',
    narrative: (name) => `They said ${name} did something unforgivable. Maybe they're right. The exact charge varied depending on who was telling it, but the punishment was constant: stripped of rank, marked with the exile brand, and cast beyond the walls. Not killed — that would have been mercy. Instead, made to wander with the brand visible and the crime whispered behind every back. Whether the crime was real doesn't change the brand. The brand is very real.`,
    quests: [
      { title: 'The False Witness', desc: 'Find the person who testified against you.', xp: 300 },
      { title: 'The Sealed Document', desc: 'A document in the city archive holds the truth. It\'s sealed by order of the throne.', xp: 350 },
      { title: 'The Brand Cure', desc: 'A healer in the east claims they can remove exile brands. For a price.', xp: 200 },
      { title: 'Allies in the Gutter', desc: 'Other exiles have formed a network. Join them — or expose them.', xp: 250 },
      { title: 'Pardoned or Avenged', desc: 'Return to the city that cast you out. Do you seek justice or revenge?', xp: 600 },
    ]
  },
  monster_hunter: {
    label: 'Monster Hunter',
    narrative: (name) => `${name} doesn't scare easily anymore. That ended the first time a creature from beyond the veil tore through a garrison of trained soldiers like they were paper. What survived that night wasn't heroism — it was stubbornness. Now ${name} hunts the things that governments don't admit exist, that churches call 'mass hysteria,' that scholars call 'folklore.' The money is bad. The work is worse. But someone has to.`,
    quests: [
      { title: 'The Contract That Started It All', desc: 'Return to the site of your first hunt. Something was left unfinished.', xp: 300 },
      { title: 'The Hunter\'s Guild Mark', desc: 'A guild brand on your old kit identifies a brotherhood you never joined.', xp: 250 },
      { title: 'The Beast That Got Away', desc: 'One target has eluded you for years. Its trail has grown fresh.', xp: 400 },
      { title: 'The Client\'s Real Agenda', desc: 'Your longtime employer isn\'t paying you to kill monsters. So why are they paying you?', xp: 350 },
      { title: 'The Hunt of Hunts', desc: 'The creature responsible for the massacre that made you into this. It\'s still out there.', xp: 700 },
    ]
  },
  corrupted_saint: {
    label: 'Corrupted Saint',
    narrative: (name) => `${name} was ordained. Holy. Pure, even — or at least trying. Then came the moment of weakness, the deal with darkness, the sin that seemed small at the time. The Church doesn't know. The congregation doesn't know. The demons absolutely know. Every prayer since has been tainted, every blessing a small lie. And yet — the powers still work. God hasn't struck ${name} down. Whether that's mercy or something worse is the nightly question.`,
    quests: [
      { title: 'The Night of the Fall', desc: 'The full memory of what you agreed to is fragmented. Recover it.', xp: 300 },
      { title: 'The Demon\'s Invoice', desc: 'What exactly did you agree to provide in return? Something is coming to collect.', xp: 400 },
      { title: 'Confessional', desc: 'A fellow cleric suspects the truth. They\'re offering silence... for a favor.', xp: 300 },
      { title: 'Can the Stain Be Removed', desc: 'Seek a holy site said to purge demonic contracts.', xp: 500 },
      { title: 'Saint or Sinner', desc: 'At the end, stand before your God and account for everything.', xp: 700 },
    ]
  },
  blood_debt: {
    label: 'Blood Debt',
    narrative: (name) => `Someone saved ${name}'s life once. The cost was enormous — not to ${name}, to the person who did it. A limb. A child. A soul. They asked for nothing in return, which is somehow worse than asking for everything. The debt is unspoken but absolute. Every morning is borrowed time paid for by someone else's sacrifice. Finding a way to make it mean something is the closest thing to a reason to keep moving.`,
    quests: [
      { title: 'Where Are They Now', desc: 'Find the person who saved you. They have disappeared.', xp: 250 },
      { title: 'The Price They Paid', desc: 'Learn the full cost of what they gave for you.', xp: 300 },
      { title: 'The Debt\'s Enemy', desc: 'What or who drove them to make such a sacrifice? It still walks.', xp: 400 },
      { title: 'The Repayment', desc: 'Find a way to return what they lost — or create something worth the trade.', xp: 500 },
      { title: 'Earned or Forgiven', desc: 'Face your savior or their memory. Has the debt been paid?', xp: 600 },
    ]
  }
};

const CHAPTER_1_QUESTS = [
  { id: 'c1q1', title: 'The Fractured Covenant', desc: 'A holy treaty between the Kingdom of Vaelthar and the Church of the Eternal Flame has shattered. No one admits to breaking it. Investigate the ruins of the signing hall.', type: 'main', xp: 200, chapter: 1, order: 1 },
  { id: 'c1q2', title: 'Whispers in the Monastery', desc: 'Monks at the Monastery of Saint Aldric have gone silent. Their last missive mentioned "something beneath the stones that breathes."', type: 'main', xp: 200, chapter: 1, order: 2 },
  { id: 'c1q3', title: 'The Missing Cartographer', desc: 'The only man who mapped the Thornwood passage has vanished. His maps are needed. His fate is a mystery.', type: 'side', xp: 150, chapter: 1, order: 3 },
  { id: 'c1q4', title: 'Blood on the Merchant Road', desc: 'Three trade caravans have been destroyed in a week. No bandits take credit. No witnesses survive.', type: 'side', xp: 175, chapter: 1, order: 4 },
  { id: 'c1q5', title: 'The Heretic\'s Torch', desc: 'A preacher in the village of Mol draws crowds with sermons that name the Church itself as demonic. The Church wants him silenced. He might be right.', type: 'main', xp: 225, chapter: 1, order: 5 },
  { id: 'c1q6', title: 'The Knight Who Kneels to Nothing', desc: 'A legendary paladin has renounced his vows and barricaded himself in his keep. His former order wants him returned. Or dead.', type: 'side', xp: 180, chapter: 1, order: 6 },
  { id: 'c1q7', title: 'The Well That Screams', desc: 'A village well has started producing screams instead of water. At night. Louder every night.', type: 'side', xp: 160, chapter: 1, order: 7 },
  { id: 'c1q8', title: 'The Ambassador\'s Confession', desc: 'A foreign ambassador requests a secret meeting. He claims to know who broke the Covenant — and he is dying.', type: 'main', xp: 250, chapter: 1, order: 8 },
  { id: 'c1q9', title: 'Rats in the Treasury', desc: 'Someone is siphoning holy relics from the Royal Treasury. The thief leaves a single black candle behind each time.', type: 'side', xp: 175, chapter: 1, order: 9 },
  { id: 'c1q10', title: 'The Children Who Remember Nothing', desc: 'Fourteen children in the capital were found wandering. They remember nothing. They all bear the same symbol on their palms.', type: 'main', xp: 280, chapter: 1, order: 10 },
  { id: 'c1q11', title: 'The Condemned Man\'s Last Words', desc: 'A man executed for treason whispered something to the priest who heard his last rites. The priest has since fled.', type: 'side', xp: 190, chapter: 1, order: 11 },
  { id: 'c1q12', title: 'The Demon\'s Tithe', desc: 'A village elder admits his community has paid a "demon tithe" for three generations. The demon\'s name has been forgotten. The payments have not stopped.', type: 'main', xp: 300, chapter: 1, order: 12 },
  { id: 'c1q13', title: 'The Tower That Isn\'t There', desc: 'An ancient tower appears on the king\'s map in the Ashen Fields. No living person has seen it. It starts appearing in party members\' dreams.', type: 'main', xp: 320, chapter: 1, order: 13 },
  { id: 'c1q14', title: 'The Forge of Judgment', desc: 'A legendary smith claims he can craft a weapon "capable of killing what cannot otherwise die." He needs three impossible ingredients.', type: 'side', xp: 240, chapter: 1, order: 14 },
  { id: 'c1q15', title: 'The Preacher\'s True Sermon', desc: 'Return to Mol. The heretic preacher has been killed — but his congregation has become something else entirely.', type: 'main', xp: 350, chapter: 1, order: 15 },
  { id: 'c1q16', title: 'Allies or Enemies', desc: 'A rival adventuring company has been following the party\'s trail. Their leader wants to meet. At midnight. Alone.', type: 'side', xp: 200, chapter: 1, order: 16 },
  { id: 'c1q17', title: 'The Church\'s Hidden Archive', desc: 'The Church\'s deepest archive is said to contain the original Covenant. Breaking in will require every skill the party possesses.', type: 'main', xp: 400, chapter: 1, order: 17 },
  { id: 'c1q18', title: 'The Voice Beneath the Archive', desc: 'Something speaks from below the archive. It knows your names. All of them. Including your real ones.', type: 'main', xp: 450, chapter: 1, order: 18 },
  { id: 'c1q19', title: 'The Covenant\'s Author', desc: 'The truth of who wrote the original Covenant is revealed — and it is not who history claims.', type: 'main', xp: 500, chapter: 1, order: 19 },
  { id: 'c1q20', title: 'The Shattered God', desc: 'Chapter I climax. The party faces the entity responsible for fracturing the Covenant. The choice of how to end it will echo through all chapters.', type: 'main', boss: true, xp: 800, chapter: 1, order: 20 },
];

const SPELLS = {
  warrior: [
    { id: 'war_cry', name: 'War Cry', icon: '😤', mp: 20, damage: '2d6', type: 'physical', desc: 'Rally your allies (+2 ATK for 3 turns) or terrify enemies (-2 ATK for 3 turns)', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
    { id: 'whirlwind', name: 'Whirlwind Strike', icon: '🌀', mp: 35, damage: '3d8', type: 'physical', desc: 'Spin and hit ALL nearby targets — including allies!', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
    { id: 'last_stand', name: 'Last Stand', icon: '🛡', mp: 40, damage: null, type: 'buff', desc: 'When below 20 HP, gain +50% damage and immunity to knockback', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
  ],
  paladin: [
    { id: 'holy_smite', name: 'Holy Smite', icon: '✝', mp: 30, damage: '3d6+WIS', type: 'holy', desc: 'Radiant damage that burns undead and demons twice as hard. Heals you 1d4.', friendly_fire: false, holy_cost: 5, hell_cost: 0 },
    { id: 'lay_on_hands', name: 'Lay on Hands', icon: '💚', mp: 25, damage: null, type: 'heal', desc: 'Restore 3d8+WIS HP to one target. Cannot be used on self.', friendly_fire: false, holy_cost: 3, hell_cost: 0 },
    { id: 'divine_shield', name: 'Divine Shield', icon: '🔆', mp: 50, damage: null, type: 'buff', desc: 'Wrap yourself or an ally in divine light. Absorbs 30 damage. Costs 10 Holy Points.', friendly_fire: false, holy_cost: 10, hell_cost: 0 },
    { id: 'judgment', name: 'Judgment', icon: '⚖', mp: 60, damage: '5d10+WIS', type: 'holy', desc: 'MASSIVE holy damage to one target. Costs 15 Holy Points.', friendly_fire: false, holy_cost: 15, hell_cost: 0 },
  ],
  cleric: [
    { id: 'cure_wounds', name: 'Cure Wounds', icon: '💚', mp: 20, damage: null, type: 'heal', desc: 'Heal 2d8+WIS HP to one target.', friendly_fire: false, holy_cost: 2, hell_cost: 0 },
    { id: 'mass_heal', name: 'Mass Heal', icon: '💫', mp: 60, damage: null, type: 'heal', desc: 'Heal ALL party members for 2d6+WIS HP.', friendly_fire: false, holy_cost: 8, hell_cost: 0 },
    { id: 'spirit_weapon', name: 'Spiritual Weapon', icon: '👻', mp: 35, damage: '2d8+WIS', type: 'holy', desc: 'Summon a floating spectral weapon that attacks each turn.', friendly_fire: false, holy_cost: 5, hell_cost: 0 },
    { id: 'revivify', name: 'Revivify', icon: '❤', mp: 80, damage: null, type: 'heal', desc: 'Bring a fallen ally back to life with 1 HP. Must be used within 3 turns of death.', friendly_fire: false, holy_cost: 20, hell_cost: 0 },
  ],
  mage: [
    { id: 'fireball', name: 'Fireball', icon: '🔥', mp: 40, damage: '6d6', type: 'fire', desc: 'Massive AOE explosion. Hits everything in range — INCLUDING your allies.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
    { id: 'lightning_bolt', name: 'Chain Lightning', icon: '⚡', mp: 45, damage: '4d10', type: 'lightning', desc: 'Lightning chains between nearby targets. Chain to allies is 50% chance.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
    { id: 'mirror_image', name: 'Mirror Image', icon: '👁', mp: 30, damage: null, type: 'buff', desc: 'Create 3 illusions of yourself. Attackers hit illusions first.', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
    { id: 'disintegrate', name: 'Disintegrate', icon: '💀', mp: 80, damage: '10d6+INT', type: 'arcane', desc: 'Target makes a CON save or is disintegrated instantly. 40% chance to hit nearest ally first.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
  ],
  rogue: [
    { id: 'sneak_attack', name: 'Sneak Attack', icon: '🗡', mp: 15, damage: '3d6+DEX', type: 'physical', desc: 'Bonus damage when attacking from stealth or with an ally adjacent to target.', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
    { id: 'smoke_bomb', name: 'Smoke Bomb', icon: '💨', mp: 20, damage: null, type: 'debuff', desc: 'Fill area with smoke. All targets in range (allies included) roll -4 on attacks.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
    { id: 'shadow_step', name: 'Shadow Step', icon: '🌑', mp: 25, damage: null, type: 'movement', desc: 'Teleport to any shadow within 60 feet instantly.', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
    { id: 'garrote', name: 'Garrote', icon: '🩸', mp: 30, damage: '4d6+DEX', type: 'physical', desc: 'Grab target\'s throat. They are silenced (no spells) for 3 turns.', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
  ],
  ranger: [
    { id: 'hunters_mark', name: "Hunter's Mark", icon: '🎯', mp: 20, damage: '+2d6 to all attacks', type: 'buff', desc: 'Mark one target. All your attacks deal extra damage vs them.', friendly_fire: false, holy_cost: 0, hell_cost: 0 },
    { id: 'multi_shot', name: 'Multi-Shot', icon: '🏹', mp: 35, damage: '2d8 x3', type: 'physical', desc: 'Fire three arrows at once. Each arrow can hit different targets — including allies.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
    { id: 'volley', name: 'Volley', icon: '☄', mp: 50, damage: '3d10', type: 'physical', desc: 'Rain arrows on an area. All targets in zone take damage, no exceptions.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
    { id: 'beast_call', name: 'Beast Call', icon: '🐺', mp: 40, damage: '3d6', type: 'physical', desc: 'Summon a beast companion to attack. The beast doesn\'t distinguish friend from foe.', friendly_fire: true, holy_cost: 0, hell_cost: 0 },
  ],
  // Universal holy/dark powers
  holy: [
    { id: 'divine_light', name: 'Divine Light', icon: '✨', mp: 30, damage: '4d6 vs undead', type: 'holy', desc: 'Emit blinding holy light. Purges fear, stuns undead. Requires 10 Holy Points.', friendly_fire: false, holy_cost: 10, hell_cost: 0 },
    { id: 'holy_aura', name: 'Holy Aura', icon: '🌟', mp: 50, damage: null, type: 'buff', desc: 'Surround your party in divine protection. All allies gain +3 AC and resist dark magic. Requires 20 Holy Points.', friendly_fire: false, holy_cost: 20, hell_cost: 0 },
    { id: 'smite_evil', name: 'Smite the Wicked', icon: '⚡', mp: 60, damage: '8d8+WIS', type: 'holy', desc: 'Devastating holy strike. Requires 25 Holy Points. CANNOT harm allies.', friendly_fire: false, holy_cost: 25, hell_cost: 0 },
    { id: 'miracle', name: 'Miracle', icon: '☀', mp: 100, damage: null, type: 'heal', desc: 'Full heal all party members and remove all debuffs. Requires 40 Holy Points. Removes ALL Hell Points.', friendly_fire: false, holy_cost: 40, hell_cost: 0 },
  ],
  dark: [
    { id: 'hellfire', name: 'Hellfire', icon: '🔥', mp: 40, damage: '6d8', type: 'dark', desc: 'Black fire that scorches everything. 60% chance to hit nearest ally. Gain 8 Hell Points.', friendly_fire: true, holy_cost: 0, hell_cost: -5, hell_gain: 8 },
    { id: 'soul_drain', name: 'Soul Drain', icon: '💀', mp: 30, damage: '4d6', type: 'dark', desc: 'Drain life force from target. You heal half damage dealt. Dark powers always splash 20% to nearest ally. Gain 5 Hell Points.', friendly_fire: true, holy_cost: 0, hell_gain: 5 },
    { id: 'shadow_curse', name: 'Shadow Curse', icon: '🌑', mp: 50, damage: '3d6 per turn', type: 'dark', desc: 'Curse a target with creeping darkness. They take damage each turn. Caster also takes 1d4 per turn. Gain 10 Hell Points.', friendly_fire: true, holy_cost: 0, hell_gain: 10 },
    { id: 'call_demon', name: 'Call Demon', icon: '😈', mp: 80, damage: '5d10 chaos', type: 'dark', desc: 'Summon a demon to wreak havoc. The demon attacks RANDOMLY — friend or foe. Gain 20 Hell Points. Lose 10 Holy Points.', friendly_fire: true, holy_cost: 0, hell_gain: 20 },
  ]
};

const STARTING_ENEMIES = [
  { id: 'bandit', name: 'Road Bandit', icon: '🗡', hp: 30, maxHp: 30, ac: 10, attack: '1d8+2', xp: 50 },
  { id: 'skeleton', name: 'Risen Skeleton', icon: '💀', hp: 20, maxHp: 20, ac: 9, attack: '1d6', xp: 40 },
  { id: 'cultist', name: 'Covenant Cultist', icon: '😈', hp: 25, maxHp: 25, ac: 11, attack: '1d8+WIS', xp: 60 },
  { id: 'wolf', name: 'Dire Wolf', icon: '🐺', hp: 35, maxHp: 35, ac: 12, attack: '2d4+3', xp: 70 },
  { id: 'shadow', name: 'Shadow Wraith', icon: '🌑', hp: 40, maxHp: 40, ac: 14, attack: '1d6 necrotic', xp: 80 },
  { id: 'captain', name: 'Bandit Captain', icon: '⚔', hp: 65, maxHp: 65, ac: 14, attack: '2d8+4', xp: 150 },
  { id: 'demon_minor', name: 'Lesser Demon', icon: '😈', hp: 80, maxHp: 80, ac: 15, attack: '2d10+3', xp: 200 },
  { id: 'shattered_god', name: 'The Shattered God', icon: '👁', hp: 500, maxHp: 500, ac: 20, attack: '4d10+10', xp: 2000, boss: true },
];

const MORALITY_ACTIONS = {
  good: [
    { desc: 'Helped a wounded stranger', holy: 5 },
    { desc: 'Refused a bribe', holy: 8 },
    { desc: 'Protected an innocent', holy: 10 },
    { desc: 'Donated to the poor', holy: 5 },
    { desc: 'Spared a surrendering enemy', holy: 8 },
    { desc: 'Prayed sincerely', holy: 3 },
  ],
  evil: [
    { desc: 'Murdered an innocent', hell: 25 },
    { desc: 'Betrayed an ally', hell: 20 },
    { desc: 'Stole from the poor', hell: 10 },
    { desc: 'Made a deal with a demon', hell: 30 },
    { desc: 'Desecrated a holy site', hell: 15 },
    { desc: 'Lied to manipulate a friend', hell: 8 },
    { desc: 'Wrapped Bresker to a tree and pissed on him', hell: 12 },
  ]
};

window.CLASSES = CLASSES;
window.RACES = RACES;
