// ============================================
//   SANCTUM & SHADOW — WORLD MAP
// ============================================

const WORLD_LOCATIONS = {
  // ── STARTING REGION ──
  vaelthar_city: {
    id: 'vaelthar_city',
    name: 'Vaelthar',
    subtitle: 'The Fractured Capital',
    x: 420, y: 280,
    type: 'city',
    icon: '🏰',
    region: 'heartlands',
    danger: 1,
    discovered: true,
    current: true,
    connections: ['thornwood_gate', 'monastery_aldric', 'merchant_road', 'temple_quarter', 'tarnished_cup'],
    description: `The great capital of Vaelthar stands wounded but defiant. Its spires still pierce the sky but the streets carry a new tension since the Covenant shattered. Royal guards stand at every corner, their eyes nervous. The Church's white banners have been torn from three major buildings. Something is very wrong here, and everyone knows it — but no one speaks of it aloud.`,
    quests: ['c1q1', 'c1q9', 'c1q10'],
    npcs: ['The Trembling Scribe', 'Captain Rhael of the Watch', 'Sister Mourne (Church Inquisitor)'],
    encounters: ['cultist', 'bandit'],
    music: 'city_tense',
  },
  tarnished_cup: {
    id: 'tarnished_cup',
    name: 'The Tarnished Cup',
    subtitle: 'Where Secrets Drown',
    x: 390, y: 310,
    type: 'tavern',
    icon: '🍺',
    region: 'heartlands',
    danger: 1,
    discovered: false,
    connections: ['vaelthar_city'],
    description: `The Tarnished Cup is the oldest tavern in Vaelthar and the only one that stayed open during the Covenant collapse three days ago. Candles burn low in iron holders. The smell of spilled ale, pipe smoke and secrets hangs over every table. Lyra — the innkeeper — knows everything that happens in this city because drunk people tell her things. Off-duty guards, frightened scholars and three people who are definitely not what they claim to be sit at separate tables, staring into their cups. Someone was crying in the back room earlier. No one mentions it.`,
    quests: ['c1q2'],
    npcs: ['Lyra (Innkeeper)', 'The Drunk Cartographer', 'Nervous Merchant', 'Two Cloaked Figures'],
    encounters: [],
    music: 'tavern_low',
    lightLevel: 'dim',
  },
  temple_quarter: {
    id: 'temple_quarter',
    name: 'Temple Quarter',
    subtitle: 'Where Faith Bleeds',
    x: 480, y: 240,
    type: 'district',
    icon: '⛪',
    region: 'heartlands',
    danger: 2,
    discovered: false,
    connections: ['vaelthar_city', 'church_archive', 'temple_wine_house'],
    description: `Three temples stand in the quarter — one to the Eternal Flame, one to the Old Gods, and one that has been sealed shut since the Covenant broke. Pilgrims mill about in confusion. A preacher stands on a crate screaming that the Church itself is the demon. Guards are dragging him away. He's still screaming as they round the corner.`,
    quests: ['c1q5', 'c1q9'],
    npcs: ['The Screaming Preacher', 'Deacon Voss', 'The Sealed Door Keeper'],
    encounters: ['cultist'],
    music: 'holy_ominous',
  },
  thornwood_gate: {
    id: 'thornwood_gate',
    name: 'Thornwood Gate',
    subtitle: 'The Edge of Civilization',
    x: 320, y: 220,
    type: 'outpost',
    icon: '🌲',
    region: 'heartlands',
    danger: 2,
    discovered: false,
    connections: ['vaelthar_city', 'thornwood_passage', 'mol_village', 'gatehouse_ale'],
    description: `The great iron gates at the western edge of Vaelthar territory. Beyond them lies the Thornwood — a forest that appeared on no map before 40 years ago and has grown larger every decade. The guards here drink heavily. The ones who go in rarely come back the same. One of them keeps writing the same word in the dirt: "DEEPER."`,
    quests: ['c1q3'],
    npcs: ['Gatewarden Pol', 'The Drunk Cartographer', 'Soldier Who Won\'t Speak'],
    encounters: ['bandit', 'wolf'],
    music: 'forest_dread',
  },
  mol_village: {
    id: 'mol_village',
    name: 'Mol',
    subtitle: 'The Heretic\'s Pulpit',
    x: 250, y: 180,
    type: 'village',
    icon: '🏘',
    region: 'western_reach',
    danger: 3,
    discovered: false,
    connections: ['thornwood_gate', 'thornwood_passage', 'mol_hearthfire'],
    description: `A small village that should be unremarkable. It isn't. A preacher here draws crowds with sermons naming the Church of the Eternal Flame as a demonic institution. The villagers listen with the focused attention of people who have been waiting their whole lives to hear something true. The Church wants him silenced. He might be right.`,
    quests: ['c1q5', 'c1q15'],
    npcs: ['The Heretic Preacher Aldran', 'Elder Mosswick', 'The Congregation'],
    encounters: ['cultist', 'shadow'],
    music: 'village_uneasy',
  },
  monastery_aldric: {
    id: 'monastery_aldric',
    name: 'Monastery of Saint Aldric',
    subtitle: 'Where the Monks Fell Silent',
    x: 540, y: 180,
    type: 'dungeon',
    icon: '⛩',
    region: 'northern_highlands',
    danger: 3,
    discovered: false,
    connections: ['vaelthar_city', 'ashen_fields', 'monastery_cellar'],
    description: `The monastery sits on a hill that the locals call "the Listening Stone" because of how sound behaves strangely near it. The monks stopped responding to any communication three weeks ago. The gates are open. There are no bodies. There are no monks. There is writing on every interior wall — the same phrase, over and over, in at least six different handwriting styles: "It breathes below."`,
    quests: ['c1q2', 'c1q7'],
    npcs: ['The Last Monk (catatonic)', 'The Voice Below'],
    encounters: ['skeleton', 'shadow', 'shadow'],
    music: 'dungeon_horror',
  },
  merchant_road: {
    id: 'merchant_road',
    name: 'The Merchant Road',
    subtitle: 'Blood on the Cobblestones',
    x: 500, y: 360,
    type: 'road',
    icon: '🛤',
    region: 'heartlands',
    danger: 2,
    discovered: false,
    connections: ['vaelthar_city', 'ashen_fields', 'fortress_harren', 'roadside_inn'],
    description: `The main trade artery of the kingdom, now soaked in silence and dried blood. Three caravans destroyed in a week. No bandit faction has claimed the kills — and the bodies weren't robbed, just... arranged. Someone is making a point. The only survivor of the last attack keeps repeating "they came from the ground."`,
    quests: ['c1q4'],
    npcs: ['Merchant Widow Sera', 'The Sole Survivor', 'The Royal Investigator (incompetent)'],
    encounters: ['bandit', 'captain', 'cultist'],
    music: 'road_danger',
  },
  fortress_harren: {
    id: 'fortress_harren',
    name: 'Fortress Harren',
    subtitle: 'The Kneeling Knight',
    x: 580, y: 400,
    type: 'fortress',
    icon: '🏯',
    region: 'eastern_march',
    danger: 3,
    discovered: false,
    connections: ['merchant_road', 'ashen_fields', 'harren_hall'],
    description: `Once a seat of legendary paladins, Fortress Harren has been barricaded from within. Sir Aldric Harren, one of the most celebrated holy warriors of the age, has renounced his vows and refuses all visitors. His former Order wants him returned — or dead. The fortress windows are dark except one, where a candle burns every night, and the silhouette that paces before it never seems to sleep.`,
    quests: ['c1q6'],
    npcs: ['Sir Harren (fallen paladin)', 'Order Commander Vael', 'The Trapped Squire'],
    encounters: ['captain', 'skeleton'],
    music: 'fortress_somber',
  },
  ashen_fields: {
    id: 'ashen_fields',
    name: 'The Ashen Fields',
    subtitle: 'Where the Tower Appears',
    x: 480, y: 460,
    type: 'wilderness',
    icon: '🌑',
    region: 'southern_wastes',
    danger: 4,
    discovered: false,
    connections: ['merchant_road', 'fortress_harren', 'monastery_aldric', 'tower_ash', 'ashen_camp'],
    description: `A vast expanse of grey earth where nothing grows and fires burn without fuel — blue flames that give no heat. The locals refuse to come here. An ancient tower appears on the king's official map but no living person reports seeing it. Party members who sleep near the Fields report the same dream: a door, slightly open, and something breathing on the other side.`,
    quests: ['c1q13'],
    npcs: ['The Wandering Scholar (probably mad)', 'The Ash Spirits'],
    encounters: ['shadow', 'shadow', 'demon_minor'],
    music: 'wastes_eerie',
  },
  tower_ash: {
    id: 'tower_ash',
    name: 'The Ashen Tower',
    subtitle: 'It Should Not Exist',
    x: 430, y: 530,
    type: 'dungeon',
    icon: '🗼',
    region: 'southern_wastes',
    danger: 5,
    discovered: false,
    locked: true,
    lockHint: 'Requires completing The Ashen Fields investigation first.',
    connections: ['ashen_fields', 'tower_antechamber'],
    description: `You can see it now. The tower that no one was supposed to find. It is exactly as the maps show — but the maps are 400 years old, and the stones look freshly cut. The door at its base has no handle, no lock. Just a symbol carved in what appears to be dried blood. Someone with sufficient knowledge might recognize the symbol. Someone without that knowledge should run.`,
    quests: ['c1q13', 'c1q18'],
    npcs: ['The Voice That Knows Your Names'],
    encounters: ['shadow', 'demon_minor', 'shattered_god'],
    music: 'boss_ancient',
    isBoss: true,
  },
  thornwood_passage: {
    id: 'thornwood_passage',
    name: 'The Thornwood',
    subtitle: 'The Forest That Grows',
    x: 200, y: 290,
    type: 'wilderness',
    icon: '🌳',
    region: 'western_reach',
    danger: 3,
    discovered: false,
    connections: ['thornwood_gate', 'mol_village', 'lost_cartographer', 'thornwood_hut'],
    description: `The forest closes behind you within minutes of entering. The trees here are too tall, too old, and too quiet — no birds, no wind, yet the branches move. Your compass behaves strangely. The path you're on wasn't there when you arrived, and when you turn around, the way you came has closed. Something here is both very patient and very aware that you've arrived.`,
    quests: ['c1q3'],
    npcs: ['The Lost Cartographer (if you can find him)', 'The Thornwood Itself'],
    encounters: ['wolf', 'shadow', 'bandit'],
    music: 'forest_dread',
  },
  lost_cartographer: {
    id: 'lost_cartographer',
    name: 'The Cartographer\'s Ruin',
    subtitle: 'The Last Known Point',
    x: 145, y: 350,
    type: 'point_of_interest',
    icon: '🗺',
    region: 'western_reach',
    danger: 3,
    discovered: false,
    connections: ['thornwood_passage', 'cartographer_flask'],
    description: `You find him — or what remains of his camp. Maps cover every surface, pinned with thorns, some of them depicting places that don't exist, or places that haven't existed yet. The cartographer himself is here, sitting very still, staring at a blank page. He looks up when you enter. His eyes are the wrong color. "You're in the map," he says quietly. "You've been in the map the whole time."`,
    quests: ['c1q3'],
    npcs: ['The Changed Cartographer'],
    encounters: ['shadow'],
    music: 'dungeon_horror',
  },
  church_archive: {
    id: 'church_archive',
    name: 'The Church Archive',
    subtitle: 'Truth Behind the Seals',
    x: 560, y: 160,
    type: 'dungeon',
    icon: '📚',
    region: 'northern_highlands',
    danger: 4,
    discovered: false,
    locked: true,
    lockHint: 'You need access codes or a way to break in. Speak to Sister Mourne in Vaelthar.',
    connections: ['temple_quarter', 'monastery_aldric', 'archive_scriptorium'],
    description: `The Church's deepest archive — four levels underground, accessible only to the highest clergy. It contains the original Covenant document, centuries of correspondence with entities that should not exist, and something in the lowest level that the archivists have stopped going near. Getting in will require every skill your party has. Getting out may require more.`,
    quests: ['c1q17', 'c1q18', 'c1q19'],
    npcs: ['Head Archivist Theones', 'The Sealed-In Apprentice', 'The Voice Beneath the Archive'],
    encounters: ['cultist', 'captain', 'shadow', 'demon_minor'],
    music: 'dungeon_horror',
    isBoss: false,
  },
  // ── TAVERNS ── one per location ──────────────

  // Vaelthar already has tarnished_cup above

  // Temple Quarter — a quiet wine house for clergy and doubters
  temple_wine_house: {
    id: 'temple_wine_house',
    name: 'The Penitent\'s Cup',
    subtitle: 'Where the Faithful Drink Quietly',
    x: 510, y: 220,
    type: 'tavern', icon: '🕯', region: 'heartlands', danger: 2,
    discovered: false, connections: ['temple_quarter'],
    description: `A narrow wine house pressed between two crumbling chapels. The clientele are priests who have stopped believing, pilgrims who have been here too long, and one very drunk deacon who insists he saw the Covenant burn from a window. The owner, a woman called Vesna, serves only wine — three varieties, all of them bitter — and has never been seen to smile. She hears everything. She forgets nothing.`,
    npcs: ['Vesna (Owner)', 'The Doubting Deacon', 'Pilgrim Who Saw Too Much'],
    quests: [], encounters: [], music: 'tavern_low', lightLevel: 'dim',
  },

  // Thornwood Gate — a rowdy guardpost tavern
  gatehouse_ale: {
    id: 'gatehouse_ale',
    name: 'The Last Post',
    subtitle: 'Drink Before You Go In',
    x: 295, y: 200,
    type: 'tavern', icon: '🍺', region: 'heartlands', danger: 2,
    discovered: false, connections: ['thornwood_gate'],
    description: `A squat stone building nailed to the side of the Thornwood gatehouse like an afterthought. The guards here have a tradition — you drink here before entering the Thornwood, and if you come back, you drink here again. The board above the bar lists names of people who went in and never came back for that second drink. The list is very long. The barkeep, Donal, keeps adding to it with a kind of grim ceremony.`,
    npcs: ['Donal (Barkeep)', 'Off-Duty Guards', 'Man Who Came Back Wrong'],
    quests: [], encounters: [], music: 'tavern_low', lightLevel: 'dim',
  },

  // Mol Village — heretic's gathering place
  mol_hearthfire: {
    id: 'mol_hearthfire',
    name: 'The Hearthfire',
    subtitle: 'Where Heretics Gather',
    x: 225, y: 165,
    type: 'tavern', icon: '🔥', region: 'western_reach', danger: 3,
    discovered: false, connections: ['mol_village'],
    description: `The only building in Mol with a lock on the door — though it's never used. The Hearthfire serves strong grain spirit and functions equally as tavern, meeting hall, and confessional. The preacher Aldran can sometimes be found here after his sermons, drinking alone and staring at the fire with the expression of a man who knows exactly how this ends. The walls are covered in religious graffiti — but not to the Eternal Flame.`,
    npcs: ['Breta (Host)', 'Aldran (the Heretic Preacher, off-duty)', 'Local Who Knows Everything'],
    quests: ['c1q5'], encounters: [], music: 'tavern_low', lightLevel: 'dim',
  },

  // Monastery — a cellar with ancient wine
  monastery_cellar: {
    id: 'monastery_cellar',
    name: 'The Monk\'s Cellar',
    subtitle: 'Ancient Wine, No Monks',
    x: 575, y: 165,
    type: 'tavern', icon: '🍷', region: 'northern_highlands', danger: 3,
    discovered: false, connections: ['monastery_aldric'],
    description: `The monastery's wine cellar is untouched — racks of bottles going back 200 years, all still sealed. The monks brewed something called "Black Vespers" that has no equivalent anywhere in the known world. It tastes like grief and smells like incense. Drinking enough of it produces visions. Whether those visions are divine or something else is a matter of current and urgent debate. No monk is present to ask.`,
    npcs: ['No Staff — Help Yourself', 'The Bottle That Keeps Refilling'],
    quests: ['c1q7'], encounters: ['skeleton'], music: 'tavern_low', lightLevel: 'dark',
  },

  // Merchant Road — a roadside inn, nervous
  roadside_inn: {
    id: 'roadside_inn',
    name: 'The Broke Wheel Inn',
    subtitle: 'Shelter on a Dangerous Road',
    x: 530, y: 345,
    type: 'tavern', icon: '🛤', region: 'heartlands', danger: 2,
    discovered: false, connections: ['merchant_road'],
    description: `A roadside inn that has stopped pretending to be safe. The windows are boarded from the outside. The owner, Sera's brother Tomas, serves watered ale and dried meat and watches the road with a crossbow under the counter. Three caravans destroyed nearby in a week. Every traveler who stops here has the same haunted look. Nobody sits with their back to the door anymore. Tomas will pay good money for an escort.`,
    npcs: ['Tomas (Innkeeper)', 'Caravan Survivors', 'The Royal Investigator (drunk)'],
    quests: ['c1q4'], encounters: ['bandit'], music: 'tavern_low', lightLevel: 'dim',
  },

  // Fortress Harren — a soldiers' drinking hall
  harren_hall: {
    id: 'harren_hall',
    name: 'The Broken Oath',
    subtitle: 'For Soldiers Without Orders',
    x: 615, y: 385,
    type: 'tavern', icon: '⚔', region: 'eastern_march', danger: 3,
    discovered: false, connections: ['fortress_harren'],
    description: `A drinking hall outside the fortress walls where discharged soldiers and Order members who disagree with Commander Vael's ultimatum come to stare at their ale. The name was scratched into the sign by someone after Harren renounced his vows — no one has changed it. Sir Harren's former squire sometimes comes here and sits alone without speaking. Buying him a drink earns you nothing except gratitude that looks remarkably like grief.`,
    npcs: ['Grisel (Barkeep, ex-soldier)', 'The Forsaken Squire', 'Order Deserters'],
    quests: ['c1q6'], encounters: [], music: 'tavern_low', lightLevel: 'dim',
  },

  // Ashen Fields — a fire camp, not really a tavern
  ashen_camp: {
    id: 'ashen_camp',
    name: 'The Wanderer\'s Fire',
    subtitle: 'A Fire in the Ash',
    x: 455, y: 445,
    type: 'tavern', icon: '🌑', region: 'southern_wastes', danger: 4,
    discovered: false, connections: ['ashen_fields'],
    description: `Not a tavern — a fire that never goes out, ringed by stones, with crates of spirit bottles stacked beside it. Nobody owns it. Travelers passing through the Ashen Fields stop here, take a bottle, leave a coin or don't, and sit for a while watching the blue flames that shouldn't exist. The scholar who's been camped here for three weeks swears the fire shows you things if you stare long enough. He's not wrong. He's also not entirely sane anymore.`,
    npcs: ['The Mad Scholar', 'Passing Travelers', 'The Fire Itself (perception check)'],
    quests: ['c1q13'], encounters: ['shadow'], music: 'tavern_low', lightLevel: 'dark',
  },

  // Ashen Tower — a crumbling ante-room with old wine
  tower_antechamber: {
    id: 'tower_antechamber',
    name: 'The Waiting Room',
    subtitle: 'What the Tower Left Behind',
    x: 405, y: 510,
    type: 'tavern', icon: '🗼', region: 'southern_wastes', danger: 5,
    discovered: false, connections: ['tower_ash'],
    description: `A crumbling ante-chamber outside the tower's sealed door. Previous visitors — whoever they were — left behind a case of black-bottled wine, a journal (water-damaged, only fragments readable), and a note that says: "You'll need this." The wine has no label and smells faintly of something burning. Drinking it makes your hands stop shaking. It also makes the symbols on the tower door easier to read. Make of that what you will.`,
    npcs: ['Nobody Alive'],
    quests: ['c1q18'], encounters: ['shadow'], music: 'tavern_low', lightLevel: 'pitch_dark',
  },

  // Thornwood Passage — a ruined forester's hut
  thornwood_hut: {
    id: 'thornwood_hut',
    name: 'The Forester\'s Ruin',
    subtitle: 'Lost in the Wood',
    x: 175, y: 270,
    type: 'tavern', icon: '🌳', region: 'western_reach', danger: 3,
    discovered: false, connections: ['thornwood_passage'],
    description: `A forester's hut that the Thornwood has been slowly consuming for decades — roots through the floor, branches through the roof, ivy over the windows. Inside, someone has maintained a small barrel of forest-brewed spirit that never seems to empty. Drinking here has a side effect: your perception of the forest sharpens unnaturally, and you hear things in the trees that you couldn't quite make out before. You're not sure if that's better.`,
    npcs: ['Nobody — Just the Forest'],
    quests: [], encounters: ['wolf', 'shadow'], music: 'tavern_low', lightLevel: 'dark',
  },

  // Lost Cartographer — maps and madness, with a flask
  cartographer_flask: {
    id: 'cartographer_flask',
    name: 'The Last Draft',
    subtitle: 'The Cartographer\'s Only Comfort',
    x: 120, y: 335,
    type: 'tavern', icon: '🗺', region: 'western_reach', danger: 3,
    discovered: false, connections: ['lost_cartographer'],
    description: `Among the cartographer's belongings — maps pinned everywhere, compass needles pointing in wrong directions — is a leather flask of something potent, and a crate that turns out to contain twelve more. He doesn't drink from them himself anymore. "It blurs the maps," he explains, staring at a map that depicts a city that doesn't exist yet. Travelers are welcome to help themselves. He'll charge nothing. He just wants someone to look at the maps and tell him if what he's drawn is real.`,
    npcs: ['The Changed Cartographer (host by accident)'],
    quests: ['c1q3'], encounters: ['shadow'], music: 'tavern_low', lightLevel: 'dark',
  },

  // Church Archive — a secret scriptorium room
  archive_scriptorium: {
    id: 'archive_scriptorium',
    name: 'The Scriptorium',
    subtitle: 'Where Archivists Hid Their Wine',
    x: 590, y: 140,
    type: 'tavern', icon: '📚', region: 'northern_highlands', danger: 4,
    discovered: false, connections: ['church_archive'],
    description: `Three levels underground in the Church Archive, there is a scriptorium where generations of archivists have hidden wine in the hollow spaces between bookshelves. The collection is extraordinary and completely unsanctioned. Someone left a chair, a reading lamp, and a note: "If you found this, you're either authorized or you're exactly who we hoped would come. Pour yourself something. You're going to need it before you reach the lower levels."`,
    npcs: ['Mira the Archivist (if she made it here)', 'Ghost of Old Archivist'],
    quests: ['c1q17'], encounters: ['cultist'], music: 'tavern_low', lightLevel: 'dark',
  },

  heartlands: { name: 'The Heartlands', color: 'rgba(100, 80, 40, 0.15)', strokeColor: 'rgba(201,168,76,0.3)' },
  western_reach: { name: 'The Western Reach', color: 'rgba(40, 80, 40, 0.15)', strokeColor: 'rgba(74,154,100,0.3)' },
  northern_highlands: { name: 'The Northern Highlands', color: 'rgba(40, 60, 100, 0.15)', strokeColor: 'rgba(100,140,200,0.3)' },
  eastern_march: { name: 'The Eastern March', color: 'rgba(100, 60, 40, 0.15)', strokeColor: 'rgba(180,120,80,0.3)' },
  southern_wastes: { name: 'The Southern Wastes', color: 'rgba(80, 40, 40, 0.2)', strokeColor: 'rgba(192,57,43,0.4)' },
};

const LOCATION_DESCRIPTIONS_TRAVEL = {
  city: (loc) => `The city of ${loc.name} rises before you — its towers and smoke and noise a familiar chaos after the roads. You feel both safer and more watched here.`,
  dungeon: (loc) => `${loc.name} looms ahead, wrong in the way that places feel wrong when something has happened in them that the stones haven't forgotten.`,
  village: (loc) => `${loc.name} is smaller than expected. The villagers notice you immediately. In a village this size, strangers are remembered.`,
  wilderness: (loc) => `The ${loc.name} stretches before you — vast, indifferent, and entirely unbothered by your presence.`,
  fortress: (loc) => `${loc.name} stands as fortresses are meant to stand: as a warning. Whether it warns you away or warns others about what's inside is unclear.`,
  road: (loc) => `The road stretches east and west. It should feel safe — roads are civilization. But these particular cobblestones are stained, and the silence is too complete.`,
  outpost: (loc) => `${loc.name} marks the edge of the maps you trust. Beyond this, the cartographers wrote simply: "Unknown."`,
  district: (loc) => `The ${loc.name} district carries the weight of too much faith suddenly in doubt.`,
  point_of_interest: (loc) => `Something brought you here. Something about ${loc.name} that the rumors couldn't quite capture.`,
};

// ─── MAP RENDERER ──────────────────────────
let mapState = {
  currentLocation: 'vaelthar_city',
  hoveredLocation: null,
  viewBox: { x: 0, y: 0, w: 720, h: 620 },
  isDragging: false,
  dragStart: null,
  zoom: 1,
};

function buildWorldMap() {
  const container = document.getElementById('world-map-container');
  if (!container) return;

  container.innerHTML = '';

  // Build SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'world-svg');
  svg.setAttribute('viewBox', '0 0 720 620');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.cursor = 'grab';

  // Defs (filters, patterns)
  svg.innerHTML = `
    <defs>
      <filter id="glow-gold">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-red">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="fog">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="2"/>
        <feDisplacementMap in="SourceGraphic" scale="8"/>
      </filter>
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stop-color="transparent"/>
        <stop offset="100%" stop-color="rgba(5,3,1,0.7)"/>
      </radialGradient>
      <pattern id="parchment-grain" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
        <rect width="200" height="200" fill="#0d0b06"/>
        <image href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9InR1cmJ1bGVuY2UiIGJhc2VGcmVxdWVuY3k9IjAuNjUiIG51bU9jdGF2ZXM9IjIiIHN0aXRjaFRpbGVzPSJzdGl0Y2giLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIwLjA0Ii8+PC9zdmc+" width="200" height="200"/>
      </pattern>
    </defs>

    <!-- Map background -->
    <rect width="720" height="620" fill="url(#parchment-grain)"/>
    <rect width="720" height="620" fill="rgba(15,10,4,0.6)"/>

    <!-- Region blobs (hand-drawn feel) -->
    <g id="regions-layer">
      <!-- Heartlands -->
      <path d="M 300 160 Q 420 130 560 160 Q 620 240 600 360 Q 560 430 480 420 Q 380 440 320 400 Q 260 360 270 280 Q 260 200 300 160 Z"
        fill="rgba(120,100,50,0.08)" stroke="rgba(201,168,76,0.12)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <!-- Western Reach -->
      <path d="M 100 140 Q 180 110 300 160 Q 280 240 270 340 Q 220 380 160 360 Q 100 320 90 250 Q 80 190 100 140 Z"
        fill="rgba(50,100,50,0.08)" stroke="rgba(74,154,100,0.15)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <!-- Northern Highlands -->
      <path d="M 420 80 Q 520 70 620 120 Q 660 160 600 190 Q 540 150 420 140 Q 380 130 380 100 Z"
        fill="rgba(40,60,100,0.1)" stroke="rgba(100,140,200,0.2)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <!-- Southern Wastes -->
      <path d="M 340 420 Q 430 410 550 420 Q 600 460 580 540 Q 520 580 420 580 Q 340 570 310 520 Q 300 470 340 420 Z"
        fill="rgba(100,30,30,0.12)" stroke="rgba(192,57,43,0.2)" stroke-width="1.5" stroke-dasharray="4,4"/>
      <!-- Eastern March -->
      <path d="M 580 300 Q 650 280 680 340 Q 690 400 650 440 Q 600 460 580 420 Q 560 380 560 340 Z"
        fill="rgba(100,60,40,0.1)" stroke="rgba(180,120,80,0.2)" stroke-width="1.5" stroke-dasharray="4,4"/>
    </g>

    <!-- Region labels -->
    <g id="region-labels" font-family="Cinzel, serif" fill="rgba(201,168,76,0.2)" font-size="10" letter-spacing="3">
      <text x="400" y="310" text-anchor="middle" transform="rotate(-5,400,310)">THE HEARTLANDS</text>
      <text x="170" y="270" text-anchor="middle" transform="rotate(-10,170,270)">WESTERN REACH</text>
      <text x="520" y="110" text-anchor="middle">NORTHERN HIGHLANDS</text>
      <text x="450" y="510" text-anchor="middle" fill="rgba(192,57,43,0.3)">SOUTHERN WASTES</text>
      <text x="630" y="380" text-anchor="middle" transform="rotate(90,630,380)" font-size="8">EASTERN MARCH</text>
    </g>

    <!-- Mountain decorations -->
    <g stroke="rgba(201,168,76,0.1)" fill="none" stroke-width="1">
      <path d="M 130 120 L 145 95 L 160 120"/><path d="M 155 115 L 170 88 L 185 115"/>
      <path d="M 550 90 L 565 65 L 580 90"/><path d="M 570 85 L 585 58 L 600 85"/>
      <path d="M 620 440 L 635 415 L 650 440"/><path d="M 640 435 L 655 408 L 670 435"/>
    </g>

    <!-- Forest decorations -->
    <g fill="rgba(50,100,50,0.12)" stroke="none">
      <circle cx="195" cy="295" r="8"/><circle cx="210" cy="285" r="6"/><circle cx="220" cy="300" r="7"/>
      <circle cx="185" cy="310" r="5"/><circle cx="175" cy="298" r="6"/>
    </g>

    <!-- Water/coastline hints -->
    <path d="M 60 100 Q 80 200 70 350 Q 65 430 90 520" stroke="rgba(40,80,120,0.2)" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 60 100 Q 80 200 70 350 Q 65 430 90 520" stroke="rgba(60,120,180,0.1)" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="8,4"/>

    <!-- Road network -->
    <g id="roads-layer" stroke="rgba(201,168,76,0.15)" stroke-width="1.5" fill="none" stroke-dasharray="5,3">
    </g>

    <!-- Connection lines layer -->
    <g id="connections-layer"></g>

    <!-- Fog of war layer -->
    <g id="fog-layer"></g>

    <!-- Location nodes layer -->
    <g id="locations-layer"></g>

    <!-- Vignette overlay -->
    <rect width="720" height="620" fill="url(#vignette)"/>

    <!-- Compass rose -->
    <g transform="translate(650, 80)" font-family="Cinzel, serif" fill="rgba(201,168,76,0.35)" font-size="9">
      <circle cx="0" cy="0" r="18" stroke="rgba(201,168,76,0.2)" stroke-width="1" fill="none"/>
      <text x="0" y="-22" text-anchor="middle">N</text>
      <text x="0" y="30" text-anchor="middle">S</text>
      <text x="-26" y="4" text-anchor="middle">W</text>
      <text x="26" y="4" text-anchor="middle">E</text>
      <path d="M0,-15 L3,-3 L0,0 L-3,-3 Z" fill="rgba(232,200,74,0.5)"/>
      <path d="M0,15 L3,3 L0,0 L-3,3 Z" fill="rgba(201,168,76,0.3)"/>
    </g>

    <!-- Scale bar -->
    <g transform="translate(30, 580)" font-family="Crimson Text, serif" fill="rgba(201,168,76,0.3)" font-size="8">
      <line x1="0" y1="0" x2="60" y2="0" stroke="rgba(201,168,76,0.3)" stroke-width="1"/>
      <line x1="0" y1="-3" x2="0" y2="3" stroke="rgba(201,168,76,0.3)" stroke-width="1"/>
      <line x1="60" y1="-3" x2="60" y2="3" stroke="rgba(201,168,76,0.3)" stroke-width="1"/>
      <text x="30" y="-6" text-anchor="middle">1 Day's Journey</text>
    </g>
  `;

  // Draw connections
  const connLayer = svg.querySelector('#connections-layer');
  const drawn = new Set();
  Object.values(WORLD_LOCATIONS).forEach(loc => {
    loc.connections.forEach(connId => {
      const key = [loc.id, connId].sort().join('--');
      if (drawn.has(key)) return;
      drawn.add(key);
      const target = WORLD_LOCATIONS[connId];
      if (!target) return;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      // Slightly curved paths for organic feel
      const mx = (loc.x + target.x) / 2 + (Math.random() - 0.5) * 20;
      const my = (loc.y + target.y) / 2 + (Math.random() - 0.5) * 20;
      line.setAttribute('d', `M ${loc.x} ${loc.y} Q ${mx} ${my} ${target.x} ${target.y}`);
      line.setAttribute('stroke', 'rgba(201,168,76,0.18)');
      line.setAttribute('stroke-width', '1.5');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-dasharray', '4,3');
      connLayer.appendChild(line);
    });
  });

  // Draw location nodes
  const locLayer = svg.querySelector('#locations-layer');
  const fogLayer = svg.querySelector('#fog-layer');

  Object.values(WORLD_LOCATIONS).forEach(loc => {
    if (!loc.discovered) {
      // Fog of war circle
      const fog = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fog.setAttribute('cx', loc.x);
      fog.setAttribute('cy', loc.y);
      fog.setAttribute('r', 35);
      fog.setAttribute('fill', 'rgba(8,6,3,0.85)');
      fog.setAttribute('filter', 'url(#fog)');
      fog.setAttribute('class', 'fog-circle');
      fog.setAttribute('data-loc-id', loc.id);
      fogLayer.appendChild(fog);

      // Faint question mark
      const qmark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      qmark.setAttribute('x', loc.x);
      qmark.setAttribute('y', loc.y + 4);
      qmark.setAttribute('text-anchor', 'middle');
      qmark.setAttribute('font-size', '14');
      qmark.setAttribute('fill', 'rgba(201,168,76,0.15)');
      qmark.setAttribute('font-family', 'Cinzel, serif');
      qmark.textContent = '?';
      fogLayer.appendChild(qmark);
      return;
    }

    renderLocationNode(locLayer, loc);
  });

  container.appendChild(svg);

  // Map tooltip
  const tooltip = document.createElement('div');
  tooltip.id = 'map-tooltip';
  tooltip.className = 'map-tooltip hidden';
  container.appendChild(tooltip);
}

function renderLocationNode(layer, loc) {
  const isCurrent = loc.id === mapState.currentLocation;
  const isBoss = loc.isBoss;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('class', 'loc-node');
  g.setAttribute('data-loc-id', loc.id);
  g.style.cursor = 'pointer';

  // Pulse ring for current location
  if (isCurrent) {
    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulse.setAttribute('cx', loc.x);
    pulse.setAttribute('cy', loc.y);
    pulse.setAttribute('r', 18);
    pulse.setAttribute('fill', 'none');
    pulse.setAttribute('stroke', 'rgba(232,200,74,0.4)');
    pulse.setAttribute('stroke-width', '2');
    pulse.setAttribute('class', 'pulse-ring');
    g.appendChild(pulse);
  }

  // Danger aura for high danger
  if (loc.danger >= 4) {
    const aura = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    aura.setAttribute('cx', loc.x);
    aura.setAttribute('cy', loc.y);
    aura.setAttribute('r', 20);
    aura.setAttribute('fill', 'rgba(192,57,43,0.08)');
    aura.setAttribute('stroke', 'rgba(192,57,43,0.25)');
    aura.setAttribute('stroke-width', '1');
    g.appendChild(aura);
  }

  // Main node circle
  const colors = {
    city: '#c9a84c', dungeon: '#8b1a1a', village: '#4a9a6a',
    fortress: '#9a7a4a', road: '#7a6a4a', wilderness: '#4a7a4a',
    outpost: '#7a8a6a', district: '#aa9a6a', point_of_interest: '#9a4a8a'
  };

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', loc.x);
  circle.setAttribute('cy', loc.y);
  circle.setAttribute('r', isCurrent ? 12 : 9);
  circle.setAttribute('fill', isCurrent ? '#c9a84c' : 'rgba(15,10,4,0.9)');
  circle.setAttribute('stroke', isBoss ? '#c0392b' : (colors[loc.type] || '#c9a84c'));
  circle.setAttribute('stroke-width', isCurrent ? '2.5' : '1.5');
  if (isBoss) circle.setAttribute('filter', 'url(#glow-red)');
  if (isCurrent) circle.setAttribute('filter', 'url(#glow-gold)');
  g.appendChild(circle);

  // Icon text
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', loc.x);
  icon.setAttribute('y', loc.y + 5);
  icon.setAttribute('text-anchor', 'middle');
  icon.setAttribute('font-size', isCurrent ? '12' : '10');
  icon.textContent = isBoss ? '💀' : (loc.icon || '•');
  g.appendChild(icon);

  // Name label
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', loc.x);
  label.setAttribute('y', loc.y + 24);
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-size', '8');
  label.setAttribute('font-family', 'Cinzel, serif');
  label.setAttribute('fill', isCurrent ? 'rgba(240,208,128,0.9)' : 'rgba(201,168,76,0.6)');
  label.setAttribute('letter-spacing', '1');
  label.textContent = loc.name.toUpperCase();
  g.appendChild(label);

  // Danger skulls
  if (loc.danger >= 4) {
    const skull = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    skull.setAttribute('x', loc.x + 14);
    skull.setAttribute('y', loc.y - 10);
    skull.setAttribute('font-size', '8');
    skull.textContent = '☠';
    skull.setAttribute('fill', 'rgba(192,57,43,0.7)');
    g.appendChild(skull);
  }

  // Event handlers
  g.addEventListener('mouseenter', () => showMapTooltip(loc));
  g.addEventListener('mouseleave', hideMapTooltip);
  g.addEventListener('click', () => handleMapLocationClick(loc));

  layer.appendChild(g);
}

function showMapTooltip(loc) {
  const tooltip = document.getElementById('map-tooltip');
  if (!tooltip) return;

  const dangerStr = '☠'.repeat(loc.danger) + '☆'.repeat(5 - loc.danger);
  const questCount = loc.quests?.length || 0;

  tooltip.innerHTML = `
    <div class="mtt-name">${loc.icon} ${loc.name}</div>
    <div class="mtt-sub">${loc.subtitle}</div>
    <div class="mtt-danger">${dangerStr} Danger Level ${loc.danger}/5</div>
    ${questCount > 0 ? `<div class="mtt-quests">📜 ${questCount} quest${questCount > 1 ? 's' : ''} here</div>` : ''}
    ${loc.locked ? `<div class="mtt-locked">🔒 ${loc.lockHint}</div>` : ''}
    <div class="mtt-hint">Click to ${loc.id === mapState.currentLocation ? 'view current location' : 'travel here'}</div>
  `;
  tooltip.classList.remove('hidden');
}

function hideMapTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

function handleMapLocationClick(loc) {
  if (loc.locked) {
    toast(`🔒 ${loc.lockHint}`, 'error');
    return;
  }

  if (loc.id === mapState.currentLocation) {
    // Show full location info panel
    showLocationPanel(loc);
    return;
  }

  // Check if connected
  const current = WORLD_LOCATIONS[mapState.currentLocation];
  if (!current || !current.connections.includes(loc.id)) {
    // Can they reach it through discovered locations?
    toast(`You must travel through connected locations to reach ${loc.name}.`, 'error');
    showLocationPanel(loc, true); // show "can't travel" version
    return;
  }

  // Travel!
  travelToLocation(loc);
}

function travelToLocation(loc) {
  closeOverlay('map-overlay');

  // Discover location
  WORLD_LOCATIONS[loc.id].discovered = true;
  const prev = mapState.currentLocation;
  WORLD_LOCATIONS[prev].current = false;
  mapState.currentLocation = loc.id;
  WORLD_LOCATIONS[loc.id].current = true;

  // Play travel music
  if (window.AudioEngine) AudioEngine.transition(loc.music || 'city_tense');

  // Narrative
  const travelDesc = LOCATION_DESCRIPTIONS_TRAVEL[loc.type] ? LOCATION_DESCRIPTIONS_TRAVEL[loc.type](loc) : `You arrive at ${loc.name}.`;

  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`🗺 TRAVELING TO: ${loc.name}`, 'system');
  addLog(travelDesc, 'narrator');

  // DM narration
  setTimeout(async () => {
    await narrateLocation(loc);
  }, 600);

  // Check for random encounters
  const encounterChance = loc.danger * 0.12;
  if (Math.random() < encounterChance && loc.encounters?.length) {
    setTimeout(() => triggerEncounter(loc), 2000);
  }
}

async function narrateLocation(loc) {
  const char = gameState.character;
  if (!char) {
    addLog(loc.description, 'narrator');
    return;
  }

  // Show static description first immediately
  addLog(loc.description, 'narrator');

  if (loc.quests?.length) {
    const relevantQuests = loc.quests
      .map(qid => CHAPTER_1_QUESTS.find(q => q.id === qid))
      .filter(Boolean);
    if (relevantQuests.length > 0) {
      setTimeout(() => {
        addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
        relevantQuests.forEach(q => {
          addLog(`📜 Quest available: "${q.title}" — ${q.desc}`, 'system');
        });
      }, 800);
    }
  }

  if (loc.npcs?.length) {
    setTimeout(() => {
      addLog(`👥 Present here: ${loc.npcs.join(', ')}`, 'system');
    }, 1200);
  }
}

function triggerEncounter(loc) {
  if (!loc.encounters?.length) return;
  const enemyType = loc.encounters[Math.floor(Math.random() * loc.encounters.length)];
  const enemy = STARTING_ENEMIES.find(e => e.id === enemyType);
  if (!enemy) return;

  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`⚔ ENCOUNTER! A ${enemy.name} appears!`, 'combat');
  addLog(`${enemy.icon} ${enemy.name} — HP: ${enemy.hp} | AC: ${enemy.ac} | ATK: ${enemy.attack}`, 'combat');
  addLog(`Roll for initiative! Use the Attack or Spell buttons to engage.`, 'system');

  if (window.AudioEngine) AudioEngine.transition('combat');
  toast(`⚔ ${enemy.name} attacks!`, 'error');
}

function showLocationPanel(loc, cantTravel = false) {
  const panel = document.getElementById('location-detail-panel');
  if (!panel) return;

  const dangerColor = loc.danger >= 4 ? 'var(--hell)' : loc.danger >= 3 ? '#c9a84c' : '#4a9a6a';
  const dangerStr = ['', '✦', '✦✦', '✦✦✦', '☠✦✦✦', '☠☠☠☠☠'][loc.danger] || '';

  panel.innerHTML = `
    <div class="lp-header">
      <span class="lp-icon">${loc.icon}</span>
      <div>
        <div class="lp-name">${loc.name}</div>
        <div class="lp-sub">${loc.subtitle}</div>
      </div>
      <button class="lp-close" onclick="document.getElementById('location-detail-panel').classList.add('hidden')">✕</button>
    </div>
    <div class="lp-danger" style="color:${dangerColor}">${dangerStr} Danger ${loc.danger}/5</div>
    <div class="lp-desc">${loc.description}</div>
    ${loc.npcs?.length ? `<div class="lp-section"><div class="lp-section-title">👥 Who You'll Find</div>${loc.npcs.map(n => `<div class="lp-npc">${n}</div>`).join('')}</div>` : ''}
    ${loc.quests?.length ? `<div class="lp-section"><div class="lp-section-title">📜 Quests Here</div>${loc.quests.map(qid => { const q = CHAPTER_1_QUESTS.find(q => q.id === qid); return q ? `<div class="lp-quest">${q.title}</div>` : ''; }).join('')}</div>` : ''}
    ${loc.locked ? `<div class="lp-locked">🔒 ${loc.lockHint}</div>` : ''}
    ${!cantTravel && !loc.locked && loc.id !== mapState.currentLocation ? `<button class="btn-primary full-width" style="margin-top:16px" onclick="travelToLocation(WORLD_LOCATIONS['${loc.id}'])">⚔ Travel to ${loc.name}</button>` : ''}
    ${cantTravel ? `<div class="lp-locked" style="margin-top:12px">⚠ Must travel through connected locations to reach here.</div>` : ''}
  `;

  panel.classList.remove('hidden');
}

// ─── MAP OVERLAY ───────────────────────────
function openWorldMap() {
  const overlay = document.getElementById('map-overlay');
  overlay.classList.remove('hidden');
  buildWorldMap();

  // Add CSS pulse animation dynamically
  const style = document.getElementById('map-pulse-style') || document.createElement('style');
  style.id = 'map-pulse-style';
  style.textContent = `
    .pulse-ring { animation: mapPulse 2s ease-in-out infinite; }
    @keyframes mapPulse { 0%,100% { r:16; opacity:0.4; } 50% { r:22; opacity:0.8; } }
    .loc-node { transition: opacity 0.2s; }
    .loc-node:hover { opacity: 0.85; }
    #map-tooltip { position:absolute; bottom:16px; left:16px; background:rgba(10,8,4,0.95); border:1px solid rgba(201,168,76,0.4); padding:12px 16px; max-width:260px; pointer-events:none; z-index:10; }
    .mtt-name { font-family:'Cinzel',serif; color:var(--gold); font-size:0.9rem; margin-bottom:3px; }
    .mtt-sub { color:var(--text-secondary); font-style:italic; font-size:0.8rem; margin-bottom:6px; }
    .mtt-danger { font-size:0.75rem; color:var(--text-dim); }
    .mtt-quests { font-size:0.78rem; color:var(--gold-dark); margin-top:4px; }
    .mtt-locked { font-size:0.75rem; color:var(--hell); margin-top:4px; font-style:italic; }
    .mtt-hint { font-size:0.72rem; color:rgba(201,168,76,0.4); margin-top:6px; font-family:'Cinzel',serif; letter-spacing:0.05em; }
  `;
  document.head.appendChild(style);
}
