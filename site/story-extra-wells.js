// Sanctum & Shadow — Chapter I extra scenes: wells
// c1q7  The Well That Screams      (side, 160) — Mol village · Stone II
// c1q9  Rats in the Treasury       (side, 175) — Royal Treasury vault · Stone III
// c1q11 The Condemned Man's Last Words (side, 190) — Vaelthar gallows / the road
(function(){

  // ── local helpers (no globals leaked) ──────────────────
  function flags(){
    if (!window.sceneState) window.sceneState = { flags:{} };
    if (!window.sceneState.flags) window.sceneState.flags = {};
    return window.sceneState.flags;
  }
  function num(key){ var v = flags()[key]; return Number(v) || 0; }
  function bump(key, by){ var v = num(key) + (by || 1); setFlag(key, v); return v; }
  function once(key, fn){ if (flags()[key]) return false; setFlag(key); fn(); return true; }
  // `gameState` is a top-level `let` in game.js — it lives in the shared global
  // lexical scope, NOT on window (window.gameState is only bridged when the 3D
  // world loads). Reference it bare, exactly as story.js does.
  function give(item){
    try {
      if (typeof gameState === 'undefined' || !gameState.character) return;
      var inv = gameState.character.inventory;
      if (!Array.isArray(inv)) { inv = gameState.character.inventory = []; }
      if (inv.indexOf(item) === -1) inv.push(item);
    } catch (e) { /* inventory is a nicety, never a hard failure */ }
  }
  function night(hours){ if (window.advanceTime) window.advanceTime(hours || 24); }

  const S = {

  // ══════════════════════════════════════════════════════
  //  c1q7 — THE WELL THAT SCREAMS  (Mol · Stone II)
  // ══════════════════════════════════════════════════════

  well_that_screams_arrival: () => {
    setFlag('well_quest_started');
    return {
      location: 'Mol — The Well on the Green',
      locationIcon: '🕳',
      threat: '⚠ Nightly',
      narration: `In daylight it is the least frightening thing in Mol: a squat stone ring on the green, a bucket, a crank worn shiny by two hundred years of hands. The bucket comes up dry. It has come up dry for a month — the village queues at the rain-butt behind the smithy and pretends this is normal. An old man sits on an upturned pail beside the ring with a stick across his knees, cutting a notch into it with a paring knife, and does not look up when you arrive. Behind you a woman says, to nobody, in the flat voice people use for weather: "Started forty year ago. Year after the bad harvest — the year the collector didn't come."`,
      sub: `The well gives no water. At night it gives something else. The old man is counting.`,
      options: [
        { icon: '💬', label: 'Talk to the old man with the stick', type: 'talk',
          action: () => runScene('well_warden_tally') },
        { icon: '👁', label: '"Forty years ago. What happened forty years ago?"', type: 'talk',
          action: () => runScene('well_villagers_dismiss') },
        { icon: '🪢', label: 'Have yourself lowered down the shaft', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => runScene('well_dry_shaft'),
          onFail: () => { addLog('The rope skids through the crank. You drop the last twelve feet and land badly. −4 HP.', 'narrator'); if (gameState.character) gameState.character.hp = Math.max(1, gameState.character.hp - 4); runScene('well_dry_shaft'); } },
        { icon: '🌙', label: 'Stay until dark and hear it for yourself', type: 'move',
          action: () => runScene('well_vigil_night') },
      ]
    };
  },

  well_warden_tally: () => {
    once('well_tally_clue_logged', () => {
      setFlag('clue_seven_count');
      addLog('📜 CLUE: The Well Warden\'s tally-stick — seven notches every night. Never six. Never eight.', 'holy');
      grantXP(75);
    });
    return {
      location: 'Mol — Warden Hesk',
      locationIcon: '🕳',
      narration: `"Hesk," he says. "Well Warden. Which is a job for a well that has water, so mostly I'm a man on a pail." He turns the stick over and offers it without ceremony. It is elder wood, greasy with handling, and it is covered — end to end, both faces, spiralling — in notches grouped in sevens. Hundreds of groups. "Seven a night," Hesk says. "Every night. Not six. Not eight. I've sat here through rain, through my wife dying, through the Watch telling me to go home. Seven." He takes the stick back. "You count what you can't stop."`,
      sub: `Seven. Every night. The number is exact and it has been exact for years.`,
      options: [
        { icon: '💬', label: '"Seven what? Screams?"', type: 'talk',
          action: () => { addLog('Hesk: "That\'s what they call it. It\'s not seven screams. It\'s one thing, seven times, and it stops in the same place each time like a cart hitting the same rut."', 'narrator'); runScene('well_vigil_night'); } },
        { icon: '📜', label: '"How long have you counted? Give me a year."', type: 'talk',
          action: () => runScene('well_villagers_dismiss') },
        { icon: '🪢', label: '"I want to go down there."', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => runScene('well_dry_shaft'),
          onFail: () => { addLog('Hesk holds the crank while you go down and your boot finds nothing but air for a moment too long. −4 HP. He hauls you the rest of the way with the calm of a man who expected it.', 'narrator'); if (gameState.character) gameState.character.hp = Math.max(1, gameState.character.hp - 4); runScene('well_dry_shaft'); } },
        { icon: '🌙', label: 'Sit the night with him', type: 'move',
          action: () => runScene('well_vigil_night') },
      ]
    };
  },

  well_villagers_dismiss: () => {
    setFlag('well_dated_forty_years');
    return {
      location: 'Mol — The Green',
      locationIcon: '🏘',
      narration: `They are not frightened of the well. That is the strangest thing about Mol. A well that screams is, to these people, a fact of the parish, like the roof of the church or the bend in the road. "Wind in the shaft," says the smith. "Fenn's lad can throw his voice — he did it for a laugh once and got hided for it." Elder Berrick, when he drifts past, says the word "hysteria" the way a man says a word he has recently learned and enjoys. But the woman at the rain-butt does not move on. "Forty year," she says. "I was eleven. It was the year after the bad harvest. My father was fined for it after — for the year the collector didn't come."`,
      sub: `The well began screaming forty years ago. The year the tithe collector didn't come.`,
      options: [
        { icon: '💬', label: '"Fined? Fined by who — for what?"', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => { addLog('📜 The woman is exact about it: the year the collector didn\'t come, the parish paid nothing. The next year the parish paid a fine, late, and everyone grumbled and paid it. She was eleven. The well started that summer. She has never once put those two facts next to each other, and neither has anyone else in Mol.', 'narrator'); grantXP(50); runScene('well_that_screams_arrival'); },
          onFail: () => { addLog('She shrugs. "Church business. My father paid it and stopped talking about it." She goes back to the queue.', 'narrator'); runScene('well_that_screams_arrival'); } },
        { icon: '👁', label: 'Ask Elder Berrick what he thinks it is', type: 'talk',
          action: () => { addLog('Berrick: "Hysteria. A village hears a noise and builds a devil out of it." He says it three times in a row, in slightly different words, which is what a man does when he is the one who needs convincing.', 'narrator'); runScene('well_that_screams_arrival'); } },
        { icon: '💬', label: 'Go back to Hesk and his stick', type: 'move',
          action: () => runScene('well_warden_tally') },
        { icon: '🌙', label: 'Wait for dark', type: 'move',
          action: () => runScene('well_vigil_night') },
      ]
    };
  },

  well_dry_shaft: () => {
    setFlag('well_stone_seen');
    return {
      location: 'Mol — The Bottom of the Well',
      locationIcon: '🪨',
      narration: `Sixty feet down and it is dry as an oven. No mud. No weed. No water-line on the stones — not a stain, not a ring, nothing to say water was ever here at all, which is impossible, because this village has drunk from this well since before the village had a name. And the shaft does not end in a floor. It ends in a stone: a single cut block, face-on, filling the bottom of the well like a door with no frame. The masonry of the shaft was built down around it and stopped where it started. The block is four hundred years old by any reckoning you can make of it and the cut of it is clean enough to shave against. Its face is worn to nothing but for one mark at the base — a plain cross, unhurried, not the Church's torch. And the cold coming off it is not cold. It is a room's worth of air on the other side of something that should be solid rock.`,
      sub: `The well doesn't bottom out in water. It bottoms out in a stone with a cross on it.`,
      options: [
        { icon: '✋', label: 'Put your hand flat on the stone', type: 'explore',
          roll: { stat: 'WIS', dc: 13 },
          onSuccess: () => { addLog('📜 It is not a vibration and it is not a voice. It is weight — the specific, unmistakable weight of someone leaning on the other side of a door. Once. Then it stops, the way a person stops when they realise they have been heard.', 'holy'); grantHolyPoints(3); grantXP(75); runScene('well_dry_shaft'); },
          onFail: () => { addLog('Stone. Cold stone. You feel nothing and are not sure whether that is a relief.', 'narrator'); runScene('well_dry_shaft'); } },
        { icon: '🌙', label: 'Stay down here for the night — hear it from the source', type: 'move',
          action: () => { setFlag('well_vigil_in_shaft'); addLog('You send the bucket up empty and tell Hesk to leave the rope. He does not argue. "Nobody\'s ever done that," he says, which is not the same as telling you not to.', 'narrator'); runScene('well_vigil_night'); } },
        { icon: '🔍', label: 'Search the base of the stone for anything left behind', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { addLog('📜 Wedged in the joint where the shaft-work meets the block: a coin, a bone button, a child\'s tooth, a bent nail — the small change of four centuries of people dropping offerings down a hole. Every one of them is on the same side. Whatever the village thinks it has been doing, it has been paying something. The newest coin is forty years old.', 'holy'); grantXP(60); runScene('well_dry_shaft'); },
          onFail: () => runScene('well_dry_shaft') },
        { icon: '🪢', label: 'Climb out', type: 'move',
          action: () => runScene('well_that_screams_arrival') },
      ]
    };
  },

  well_vigil_night: () => {
    const done = num('well_nights_transcribed');
    const failed = num('well_nights_failed');
    const inShaft = !!flags()['well_vigil_in_shaft'];
    let dc = 13 - failed - (inShaft ? 2 : 0);
    if (dc < 10) dc = 10;
    const nightNo = done + failed + 1;
    const heard = [
      `It starts at full dark with no build to it, the way a door slams. It is not a sound a well should make and it is not, whatever the Watch report says, a sound of grief. It is effort. Something is working at something and failing, and then working at it again. Seven times. Hesk cuts his seventh notch and puts the knife away and says, "There. Now we can sleep."`,
      `Second night, and it is louder. Not nearer — louder, which is worse, because a thing that gets nearer is coming and a thing that gets louder is trying. You have one sheet of paper with the shape of it already on it, and you are beginning to hate that the shape is so short.`,
      `Third night. Hesk has stopped counting out loud. Half the village is standing at the edge of the green with lamps they have not lit, watching you write, and the sound goes through them all like the same sentence said seven times to people who do not speak the language.`,
    ][Math.min(done, 2)];
    const opts = [
      { icon: '✍', label: 'Transcribe it — sound by sound, exactly, no interpreting', type: 'explore',
        roll: { stat: 'WIS', dc: dc },
        onSuccess: () => {
          const n = bump('well_nights_transcribed');
          night(24);
          if (n >= 3) { runScene('well_syllable_resolved'); return; }
          addLog('📜 Night ' + n + ' of 3 transcribed. You have the shape of it on paper. It is much shorter than a scream.', 'holy');
          grantXP(50);
          runScene('well_vigil_night');
        },
        onFail: () => runScene('well_night_failed') },
      { icon: '👂', label: 'Don\'t write — just listen. All seven.', type: 'explore',
        roll: { stat: 'WIS', dc: dc + 1 },
        onSuccess: () => { addLog('📜 You stop trying to render it and just take it. Seven times, and every one of them stops in the same place — not cut off, not interrupted. Stopped. Like a man who has forgotten a word he has said every day of his life.', 'holy'); night(24); bump('well_nights_transcribed'); grantHolyPoints(2); if (num('well_nights_transcribed') >= 3) { runScene('well_syllable_resolved'); return; } runScene('well_vigil_night'); },
        onFail: () => runScene('well_night_failed') },
      { icon: '💬', label: 'Answer it — say something back down the shaft', type: 'talk',
        action: () => { addLog('You call down into it. It does not stop, it does not answer, it does not change. It has not been talking to you. It has been trying to say one thing to nobody for forty years.', 'narrator'); night(24); runScene('well_vigil_night'); } },
    ];
    if (failed >= 2 || done >= 2) {
      opts.push({ icon: '🧱', label: 'Let Cabb bring the lime cart — cap the well and end it', type: 'move',
        action: () => runScene('well_that_screams_capped') });
    }
    opts.push({ icon: '🏃', label: 'Enough. Leave Mol to its well.', type: 'move',
      action: () => runScene('well_that_screams_arrival') });
    return {
      location: 'Mol — The Well, Night ' + nightNo,
      locationIcon: '🌙',
      threat: '⚠ It is louder tonight',
      narration: heard + (failed >= 2 ? ` Cabb the well-digger has his cart on the green with a barrel of lime on it, and he is not being dramatic about it. He is a practical man with a practical solution and half of Mol behind him.` : ''),
      sub: `Three separate nights of clean transcription. That is what it takes. It gets louder each night — which helps.`,
      options: opts,
    };
  },

  well_night_failed: () => {
    bump('well_nights_failed');
    night(24);
    return {
      location: 'Mol — Dawn on the Green',
      locationIcon: '🌅',
      narration: `You lose it. Not because it is faint — because your hand is a hand and it wants to write a word, and there is no word, and by the fourth repetition you are writing what you expect instead of what is there. Hesk looks at your page in the grey light. "That's a scream," he says. "You've written down a scream. It isn't a scream." He goes home. The sheet goes in the fire, because a wrong copy is worse than none.`,
      sub: `A night gone. But it is louder tomorrow — it always is. That makes it easier, and that ought to frighten you.`,
      options: [
        { icon: '🌙', label: 'Sit again tonight', type: 'move',
          action: () => runScene('well_vigil_night') },
        { icon: '🪢', label: 'Go down and sit at the bottom instead — closer to it', type: 'explore',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { setFlag('well_vigil_in_shaft'); runScene('well_dry_shaft'); },
          onFail: () => { addLog('You get halfway down, and halfway down in the dark is a place where a person discovers things about themselves. You come back up. −3 HP.', 'narrator'); if (gameState.character) gameState.character.hp = Math.max(1, gameState.character.hp - 3); runScene('well_vigil_night'); } },
        { icon: '💬', label: 'Ask Hesk to do the writing — he has heard it four thousand times', type: 'talk',
          action: () => { addLog('Hesk: "I can\'t write. That\'s why I cut notches." A pause. "If I could write I\'d have written it down forty year ago and someone would have come and taken it off me and that would be that."', 'narrator'); runScene('well_vigil_night'); } },
        { icon: '🏃', label: 'Leave the well', type: 'move',
          action: () => runScene('well_that_screams_arrival') },
      ]
    };
  },

  well_syllable_resolved: () => {
    once('well_syllable_rewarded', () => {
      setFlag('clue_well_syllable');
      setFlag('clue_seven_count');
      addLog('📜 CLUE: Three nights, three sheets, one shape. The well is not screaming. It is saying one syllable and failing at the same place every time: "S—".', 'holy');
      addLog('📜 ITEM GAINED: Well-Scream Transcription (three nights) — and the Well Warden\'s tally-stick.', 'holy');
      give('Well-Scream Transcription (three nights)');
      give("The Well Warden's Tally-Stick");
      grantHolyPoints(5);
      grantXP(200);
    });
    return {
      location: 'Mol — The Well, After',
      locationIcon: '📜',
      narration: `You lay the three sheets side by side on the lid of Hesk's pail in the last of the dark. Three nights, three hands' worth of shake, and the same mark in the same place on all three. It is not seven screams. It is one syllable, said seven times, and it fails at the same place every time — at the very front of it, at the first letter, at "S—". Not cut off. Not swallowed. It gets that far and it cannot get further, and then it goes back to the start and tries again, and it does this seven times a night, and it has done it seven times a night for forty years, and it is getting louder because whatever is down there is trying harder. Hesk puts the tally-stick in your hands. He does not say anything for a long time. Then: "It's a name, isn't it." He is seventy years old and he says it like a man being told his wife's cause of death. "Forty year I've been cutting notches for somebody trying to say their own name."`,
      sub: `The thing under Mol is trying to say a name. It cannot get past the first letter. Seven attempts, every night.`,
      options: [
        { icon: '💬', label: '"Do you know any name in this parish that starts with an S?"', type: 'talk',
          action: () => { addLog('Hesk thinks about it seriously, which is what makes it awful. "Half of them. Sela. Sim. Sanna." Then, from the queue at the rain-butt, a grandmother hushing a child at dawn, without turning round, without thinking: "Quiet now — or Sel hears." Hesk does not react. Nobody reacts. It is a thing people say here.', 'holy'); grantXP(75); runScene('well_syllable_resolved'); } },
        { icon: '📜', label: 'Take the sheets to Vaelthar — someone there can read old sounds', type: 'move',
          action: () => { addLog('📜 You have a transcription of a syllable and a stick with a hundred thousand notches in it. Neither is evidence of anything. Together they are the only honest document in the province.', 'holy'); if (window.travelToLocation && window.WORLD_LOCATIONS) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
        { icon: '🔍', label: 'Go back down. Say the letter to the stone.', type: 'explore',
          action: () => { addLog('You go down and say it into the block — the one letter, nothing else. The stone does not answer. But that night, and every night after, it is still seven. It never becomes eight. You are not sure why that steadies you and it does.', 'narrator'); runScene('well_dry_shaft'); } },
        { icon: '🧱', label: 'Tell Cabb to cap it anyway — Mol needs to sleep', type: 'move',
          action: () => runScene('well_that_screams_capped') },
      ]
    };
  },

  well_that_screams_capped: () => {
    once('well_capped_once', () => {
      setFlag('well_capped');
      addLog('🧱 Mol\'s well is capped: rubble, lime, sixty feet of it. The screaming stops. So does the counting.', 'narrator');
      grantHolyPoints(3);
      grantXP(120);
    });
    return {
      location: 'Mol — The Green, Afterward',
      locationIcon: '🧱',
      narration: `Cabb does it properly, because Cabb does everything properly: rubble first, then lime, then rubble, sixty feet of it, a day and a night of carts. At dusk the village stands around the plug in the green and waits for full dark the way people wait for a verdict. Full dark comes. Nothing. A child laughs, too loud, and gets shushed, and then everybody is talking at once and someone brings out beer and it is, genuinely, the best night Mol has had in forty years. Hesk does not come. You find him at his door with the tally-stick across his knees and the paring knife in his hand and nothing left to cut. "It's still saying it," he says. "It's just that now there's nobody counting."`,
      sub: `The village can sleep. Sixty feet down, under the lime, something is still failing at the same letter.`,
      options: [
        { icon: '💬', label: 'Take the tally-stick from him', type: 'talk',
          action: () => { once('well_stick_taken', () => { give("The Well Warden's Tally-Stick"); addLog('📜 ITEM GAINED: The Well Warden\'s Tally-Stick — seven notches a night, forty years of them. Never six. Never eight.', 'holy'); setFlag('clue_seven_count'); grantXP(60); }); runScene('well_that_screams_capped'); } },
        { icon: '🍺', label: 'Drink with the village. They earned it.', type: 'talk',
          action: () => { addLog('You drink with Mol. They toast you. A grandmother hushes a child at the edge of the firelight — "quiet now, or Sel hears" — and pours you another, and it does not occur to a single person present that they have just named the thing they buried.', 'holy'); grantXP(60); if (window.travelToLocation && window.WORLD_LOCATIONS) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
        { icon: '🗺', label: 'Leave Mol', type: 'move',
          action: () => { if (window.travelToLocation && window.WORLD_LOCATIONS) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
      ]
    };
  },

  // ══════════════════════════════════════════════════════
  //  c1q9 — RATS IN THE TREASURY  (Vaelthar · Stone III)
  // ══════════════════════════════════════════════════════

  treasury_rats_arrival: () => {
    setFlag('treasury_quest_started');
    return {
      location: 'Vaelthar — The Royal Treasury',
      locationIcon: '👑',
      threat: '⚠ Crown Business',
      narration: `Under-Steward Corran Vess meets you at the vault door with the particular grey face of a man who has already written his own resignation and is carrying it in his coat. "Nothing forced," he says, before hello. "Nothing picked. The wards are unbroken, the seals are unbroken, the threshold dust is unbroken — I will swear to that in front of the King and I will be hanged still swearing it. This vault was never opened." He walks you in. Shelf eleven, the devotional shelf: a finger-bone in a lead case, a nail, a cup, a strip of shroud. All gone. All of them minor, all of them pre-Flame, every one of them marked with a plain cross. And in the empty place where the reliquary stood, standing upright and perfectly straight, is a single black candle. "Three days ago the Crown audited everything," Vess says. "Because of the Covenant. And we found we've been robbed once a year for longer than I've been alive, and nobody noticed, because nobody has ever once needed the finger-bone."`,
      sub: `The vault was never opened. The Crown says Church. The Church says Crown. There is a war in this, inside a week.`,
      options: [
        { icon: '🔍', label: 'Examine the black candle on the shelf', type: 'talk',
          action: () => runScene('treasury_shelf_candle') },
        { icon: '📜', label: '"Who holds keys to this room? All of them. Now."', type: 'talk',
          action: () => runScene('treasury_warrant_read') },
        { icon: '🔦', label: 'Take a lamp to the back of the vault — past the inventory line', type: 'explore',
          action: () => runScene('treasury_vault_dust') },
        { icon: '👁', label: 'Ask the Watch who they like for it', type: 'talk',
          action: () => runScene('treasury_the_candle_accusation') },
      ]
    };
  },

  treasury_shelf_candle: () => ({
    location: 'Vaelthar — The Royal Treasury, Shelf Eleven',
    locationIcon: '🕯',
    narration: `Black tallow. Cheap — cheaper than anything else within forty feet of it, which in this room is a kind of insult. No guild mark, no chandler's stamp, nothing to trace. It is a candle you could buy anywhere and nobody could ever prove where. And two things about it are wrong in a way that will not leave you alone. The base has been scratched with a knife, badly, by someone in a hurry or someone very old — a number, and the number is forty-nine. And the wick is white. Not grey. Not curled. White, and dust-furred, and dead straight. This candle has never been lit. It has never been near a flame in its life.`,
    sub: `Year forty-nine, scratched in the base. And it has never been lit.`,
    options: [
      { icon: '🔦', label: '"If there\'s one, there are others. Where does this vault put its rubbish?"', type: 'explore',
        action: () => runScene('treasury_vault_dust') },
      { icon: '📜', label: 'Take the candle as evidence', type: 'explore',
        action: () => { once('treasury_candle_taken', () => { give('Black Candle, Year 49 (unlit)'); addLog('📜 ITEM GAINED: Black Candle, Year 49 — unlit, unmarked, base scratched with a number.', 'holy'); grantXP(50); }); runScene('treasury_shelf_candle'); } },
      { icon: '💬', label: 'Ask Vess what the clerks do with them', type: 'talk',
        action: () => { addLog('Vess, distractedly: "They stand them at the back with the others. You can\'t throw away a thing that appears inside a locked vault — that\'s not superstition, that\'s procedure. If it came out of the vault it belongs to the Crown." He hears himself. He stops walking. "...There are others."', 'narrator'); runScene('treasury_vault_dust'); } },
      { icon: '👁', label: 'Ask the Watch who they like for it', type: 'talk',
        action: () => runScene('treasury_the_candle_accusation') },
    ]
  }),

  treasury_vault_dust: () => ({
    location: 'Vaelthar — The Back of the Vault',
    locationIcon: '🔦',
    threat: '⚠ Past the inventory line',
    narration: `The Treasury is a room the Crown has never seen the back of. The inventory line is painted on the floor at the third shelf; two guards stand on it because the standing order says nobody goes past it without a writ, and the standing order is older than the guards, and older than their fathers. Past it the lamplight stops working properly. Past it is dust — real dust, four hundred years of it, undisturbed except for one narrow track worn down the middle where somebody walks, once, and comes back. And at the far end of that track, at the edge of what your lamp can do, something is standing in the dust in a row.`,
    sub: `Someone walks to the back of this vault. Once a year. And nobody in the Crown has followed them.`,
    options: [
      { icon: '💬', label: 'Talk the guards off the line — Vess can write you the writ', type: 'talk',
        roll: { stat: 'CHA', dc: 12 },
        onSuccess: () => { addLog('Vess writes it standing up, against the wall, and the guards step aside with the visible relief of men who have wanted to know for years.', 'narrator'); runScene('treasury_fortynine_counted'); },
        onFail: () => { addLog('"No writ, no crossing." The senior man is not being difficult. He is being the only functioning part of this institution.', 'narrator'); runScene('treasury_vault_dust'); } },
      { icon: '🤫', label: 'Cross the line while they change watch', type: 'explore',
        roll: { stat: 'DEX', dc: 13 },
        onSuccess: () => runScene('treasury_fortynine_counted'),
        onFail: () => runScene('treasury_caught_crossing') },
      { icon: '📜', label: 'Read the warrant first — do this lawfully', type: 'talk',
        action: () => runScene('treasury_warrant_read') },
      { icon: '🏃', label: 'Back to the shelf', type: 'move',
        action: () => runScene('treasury_rats_arrival') },
    ]
  }),

  treasury_caught_crossing: () => ({
    location: 'Vaelthar — The Inventory Line',
    locationIcon: '🛡',
    threat: '☠ HOSTILE',
    narration: `Your boot comes down in four hundred years of dust and makes a sound like a slap. Both guards are on you before your lamp stops swinging. "Off the line. OFF THE LINE." They are not angry; they are terrified, because a man past the line without a writ is a hanging and so is a man who let him past. Vess is shouting something about writs from the doorway and nobody can hear him. The senior guard's sword is already out and this has stopped being about relics.`,
    sub: `Two frightened men doing their job. Anything you do to them is on you.`,
    options: [
      { icon: '✋', label: 'Step back. Hands open. Do it Vess\'s way.', type: 'talk',
        action: () => { addLog('You step back over the line. The senior guard breathes out for what sounds like the first time in a minute. Nothing is lost but time.', 'narrator'); runScene('treasury_vault_dust'); } },
      { icon: '💬', label: '"Your standing order is four hundred years old. Who wrote it?"', type: 'talk',
        roll: { stat: 'WIS', dc: 12 },
        onSuccess: () => { addLog('📜 The senior guard opens his mouth and nothing comes out, because he has never once been asked. The order is copied from the previous order, which is copied from the previous order. Nobody has read the bottom of it in living memory. He lets you past to prove to himself that he can.', 'holy'); grantXP(60); runScene('treasury_fortynine_counted'); },
        onFail: () => { addLog('"Doesn\'t matter who wrote it. It\'s the order." Which is the correct answer, and the reason this has worked for four centuries.', 'narrator'); runScene('treasury_vault_dust'); } },
      { icon: '⚔', label: 'Put them down and take the lamp to the back', type: 'combat',
        action: () => { setFlag('crown_hostile'); setFlag('wanted'); grantHellPoints(5); addLog('You draw on two Crown guards inside the Royal Treasury. Whatever you find at the back, you will be reading it as a wanted party. +5 Hell Points.', 'hell'); startCombat([
          Object.assign(generateEnemy('city_guard', 2), { id: 'treasury_guard_1' }),
          Object.assign(generateEnemy('city_guard', 2), { id: 'treasury_guard_2' }),
        ], { victoryScene: 'treasury_fortynine_counted' }); } },
    ]
  }),

  treasury_fortynine_counted: () => {
    once('treasury_count_rewarded', () => {
      setFlag('clue_fortynine_candles');
      addLog('📜 CLUE: Forty-nine black candles standing in the vault\'s dust — one per year, the year scratched into each base. Not one has ever been lit. The newest reads year 49.', 'holy');
      addLog('📜 CLUE: Nothing was stolen. Every missing relic is four feet away, stacked at the foot of a cut stone the palace was built around.', 'holy');
      grantHolyPoints(3);
      grantXP(200);
    });
    return {
      location: 'Vaelthar — The Foot of the Stone',
      locationIcon: '🕯',
      narration: `They are standing in a row against the back wall, oldest at the left, furred grey, and you count them twice because the first count is the sort of thing a man's mouth refuses to say out loud: forty-nine. One per year. The year scratched into each base with the same bad knife — 1, 2, 3, all the way to the one you took off shelf eleven this morning. Not one of them has ever been lit. Forty-nine candles and not one flame in four hundred and — no. In forty-nine years. And they are not standing against a wall. They are standing at the foot of a stone: a single cut block, seamless, that the Treasury was built around and not into, its face worn smooth but for a plain cross at the base, the cut of it clean enough to be a month old. Stacked against it, in the dark, in a neat and careful heap, is every single relic the Crown has spent three days believing was stolen. Nothing left this room. Somebody has been moving cross-marked relics four feet to the left, once a year, for forty-nine years, and leaving a receipt.`,
      sub: `Forty-nine years. Forty-nine candles. Nothing stolen. And this is year forty-nine.`,
      options: [
        { icon: '📜', label: 'Count them again and write the years down. All of them.', type: 'explore',
          action: () => { addLog('📜 You write the list. There are no gaps. Forty-nine consecutive years, every one marked, nobody ever late. Whatever else this is, it is the best-kept ledger in the kingdom, and it is kept in candle wax by a man with a bad knife.', 'holy'); grantXP(60); runScene('treasury_fortynine_counted'); } },
        { icon: '🕯', label: 'Look for the fiftieth', type: 'explore',
          roll: { stat: 'INT', dc: 11 },
          onSuccess: () => { addLog('📜 There isn\'t one. There is no fiftieth candle, no space left for one, and the row ends flush against the corner of the vault as though the room was measured for exactly this many and no more. Whatever this is, it was built to run for forty-nine years and stop. It is year forty-nine.', 'holy'); setFlag('clue_covenant_expires_treasury_corroboration'); grantHolyPoints(2); grantXP(75); runScene('treasury_fortynine_counted'); },
          onFail: () => { addLog('You look for a gap in the row and can\'t make one out in the lamplight. Later it will bother you.', 'narrator'); runScene('treasury_fortynine_counted'); } },
        { icon: '📜', label: 'Now read the warrant — somebody has a key and a right to be here', type: 'talk',
          action: () => runScene('treasury_warrant_read') },
        { icon: '👁', label: 'Tell the Watch what you found', type: 'talk',
          action: () => runScene('treasury_the_candle_accusation') },
      ]
    };
  },

  treasury_warrant_read: () => {
    setFlag('treasury_warrant_seen');
    return {
      location: 'Vaelthar — The Treasury Charter Box',
      locationIcon: '📜',
      narration: `Vess brings the charter box because Vess is, in the end, a good clerk having the worst week of his life. Three keys exist. The King's, which has not moved in a decade. The Treasury's, which is Vess's, which is on Vess. And one called the Second Key, which is not held in this building, which is not held by the Crown, and which is held under a warrant that is — Vess reads it twice and then hands it to you rather than say it — perpetual. It is dated in a year-count nobody uses any more, from before the Flame calendar, which means it is older than the kingdom's habit of counting years at all. It instructs the bearer of the Second Key to enter annually, to remove one marked relic, to set it by, and to leave the year marked upon a candle "that the count be kept." It exempts the withdrawal from the vault log — which is why the log is clean, which is why the vault was never opened. Every Crown since has renewed it, mechanically, in the same fourteen words. And the revocation clause says the instrument may be revoked upon the expiry of the Charter, and not before. Vess: "What charter? Whose charter? I've run this room for eleven years. I have never heard of a Charter." At the bottom, the counter-signature, in a hand like wire: A. Sallow.`,
      sub: `Not theft. A withdrawal, lawful, annual, on a warrant nobody alive can revoke. There is a name on it.`,
      options: [
        { icon: '🚪', label: 'Find A. Sallow', type: 'move',
          action: () => runScene('treasury_second_key') },
        { icon: '🔍', label: '"The relics it names — what do they have in common?"', type: 'talk',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { addLog('📜 CLUE: Every relic the warrant marks is pre-Flame and carries a plain cross. The Crown\'s own valuers wrote the note four hundred years ago and every valuer since has copied it forward without reading it: "devotional, obsolete, no market." The most protected instrument in the Treasury exists to move the only objects in it that nobody wants.', 'holy'); grantXP(75); runScene('treasury_warrant_read'); },
          onFail: () => { addLog('You read the schedule three times. It is a list of junk. That is the whole problem.', 'narrator'); runScene('treasury_warrant_read'); } },
        { icon: '🔦', label: 'Go to the back of the vault and see where the relics went', type: 'explore',
          action: () => runScene('treasury_vault_dust') },
        { icon: '👁', label: 'Ask the Watch who they like for it', type: 'talk',
          action: () => runScene('treasury_the_candle_accusation') },
      ]
    };
  },

  treasury_the_candle_accusation: () => {
    const knows = getFlag('clue_fortynine_candles');
    const opts = [
      { icon: '🧮', label: knows ? 'Do the arithmetic out loud, in front of them' : 'Push back — "how many candles, sergeant? Exactly?"', type: 'talk',
        roll: { stat: 'INT', dc: knows ? 9 : 13 },
        onSuccess: () => runScene('treasury_candle_arithmetic'),
        onFail: () => { addLog('The sergeant shrugs. "Enough of them. It\'s the Candle. Everyone knows." Everyone does know. That is not the same as it being true.', 'narrator'); runScene('treasury_the_candle_accusation'); } },
      { icon: '📜', label: 'Report it. Sister Mourne is the Candle. Let the Crown act.', type: 'talk',
        action: () => runScene('treasury_blame_the_candle') },
      { icon: '🔦', label: 'Say nothing yet. Go and count them yourself.', type: 'explore',
        action: () => runScene('treasury_vault_dust') },
      { icon: '📜', label: 'Read the warrant instead of the rumour', type: 'talk',
        action: () => runScene('treasury_warrant_read') },
    ];
    return {
      location: 'Vaelthar — The Treasury Steps',
      locationIcon: '🕯',
      narration: `The Watch sergeant does not even let you finish the question. "The Candle." He says it the way you'd name the weather. "Black candle left at the scene. Woman they call the Candle. Church woman, burned the treaty, everyone in this city knows it and half of them saw her walk out of the signing hall. I've had it written up since the hour we found the shelf." He is not stupid, he is not corrupt, and he is not being lazy. He has a nickname, a candle, and a Church, and he has assembled them the way any sane man would, and every officer above him has already agreed, and the Crown is going to move on the Temple Quarter on the strength of it.`,
      sub: `The obvious answer. The satisfying answer. The one everybody has already reached.`,
      options: opts,
    };
  },

  treasury_candle_arithmetic: () => {
    setFlag('mourne_cleared_of_treasury');
    once('treasury_arithmetic_rewarded', () => { grantHolyPoints(3); grantXP(150); });
    return {
      location: 'Vaelthar — The Treasury Steps',
      locationIcon: '🧮',
      narration: `"Forty-nine candles," you say. "One a year. Oldest at the left. The oldest one was stood in that dust forty-nine years ago." The sergeant waits, because he cannot see it yet. "Sister Mourne is forty. That candle was standing in your vault nine years before she was born." He opens his mouth. You are not finished. "And she is called the Candle because she burns things. Treaties. Texts. Hands, if the stories are worth anything. There are forty-nine candles at the back of the Royal Treasury and not one of them has ever been lit." The sergeant looks at his own report for a long moment. "Then who's been doing it for forty-nine years?" Which is, at last, the right question, and nobody in this city has asked it until this morning, because the wrong answer had a nickname and the right one has arithmetic.`,
      sub: `The emotionally satisfying answer is wrong. The arithmetic is right. Mourne did not do this.`,
      options: [
        { icon: '📜', label: '"Someone with a key and a warrant. Find me A. Sallow."', type: 'talk',
          action: () => runScene('treasury_second_key') },
        { icon: '💬', label: '"Kill the report. Do not send the Crown into the Temple Quarter."', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => { setFlag('temple_quarter_raid_stopped'); addLog('📜 The sergeant pulls the report. Whatever else happens this month, the Crown does not go through the Temple Quarter door on the strength of a nickname. He looks ten years older doing it.', 'holy'); grantHolyPoints(5); grantXP(100); runScene('treasury_candle_arithmetic'); },
          onFail: () => { addLog('"It\'s above me now. It\'s been above me since the second hour." The report is already three desks up.', 'narrator'); runScene('treasury_candle_arithmetic'); } },
        { icon: '📜', label: 'Read the warrant', type: 'talk',
          action: () => runScene('treasury_warrant_read') },
      ]
    };
  },

  treasury_blame_the_candle: () => {
    setFlag('blamed_mourne_for_treasury');
    return {
      location: 'Vaelthar — The Treasury Steps',
      locationIcon: '📜',
      narration: `You give the sergeant what he already had and he takes it gratefully, because a confirmation from outside is worth more than a certainty from inside. The report goes up three desks in an hour. By evening the Crown has men on the Temple Quarter door, and the Church has men behind it, and both sides are entirely certain and entirely wrong, and the thing at the back of the vault has not moved and does not care. Nothing you have said is a lie. Everything you have said is going to get somebody killed by the end of the week.`,
      sub: `It fits. It fits perfectly. That is what fitting feels like from the inside.`,
      options: [
        { icon: '🔦', label: 'Go and count the candles anyway. Be certain.', type: 'explore',
          action: () => runScene('treasury_vault_dust') },
        { icon: '📜', label: 'Read the warrant anyway. Be thorough.', type: 'talk',
          action: () => runScene('treasury_warrant_read') },
        { icon: '🗺', label: 'Leave it. The Crown can hang whoever it likes.', type: 'move',
          action: () => { grantHellPoints(3); addLog('You walk away from the Royal Treasury with the case closed and the wrong name on it. +3 Hell Points.', 'hell'); } },
      ]
    };
  },

  treasury_second_key: () => ({
    location: 'Vaelthar — Eleven Streets From the Palace',
    locationIcon: '🚪',
    narration: `A. Sallow is Adrin Sallow, and Adrin Sallow lives in a narrow house on a narrow street with a shop below it that sold hats until 1919 and now sells nothing. He is sixty-one. He answers the door in his shirtsleeves holding a bowl of soup. He is not surprised to see you and he is not afraid of you, and both of those facts are worse than the alternatives. Around his neck, on a cord, is a key that has worn a shallow groove into his collarbone over nineteen years. He looks at your Watch escort, and your weapons, and your faces, and he says, without any particular feeling: "Oh, is it finally about the vault? Come in, then. I've been waiting since Tuesday."`,
    sub: `He has been waiting. Not hiding — waiting.`,
    options: [
      { icon: '💬', label: 'Go in. Let him talk.', type: 'talk',
        action: () => runScene('treasury_rats_resolved') },
      { icon: '🔍', label: 'Search the house first — do not take an old man at his word', type: 'explore',
        roll: { stat: 'INT', dc: 12 },
        onSuccess: () => { addLog('📜 There is nothing here. No relics, no gold, no cache, no second life. There is a copper bath, a dead wife\'s chair, and one locked drawer containing nineteen filed copies of the same annual return, each one signed, each one stamped, each one exactly correct. He has not stolen so much as a spoon in nineteen years.', 'holy'); grantXP(75); runScene('treasury_rats_resolved'); },
        onFail: () => runScene('treasury_rats_resolved') },
      { icon: '😠', label: 'Take the key off his neck', type: 'combat',
        roll: { stat: 'STR', dc: 8 },
        onSuccess: () => { grantHellPoints(5); setFlag('took_second_key_by_force'); addLog('You take the Second Key off a sixty-one-year-old clerk in his own doorway. He does not resist. He lets go of the cord and says "all right" and puts his soup down and that is the worst part. +5 Hell Points.', 'hell'); give('The Second Key'); runScene('treasury_rats_resolved'); },
        onFail: () => { addLog('The cord holds. He does not fight you; he just stands there being an old man in his own doorway while you pull at a string around his neck, and the Watch sergeant behind you clears his throat, and you stop.', 'narrator'); runScene('treasury_second_key'); } },
    ]
  }),

  treasury_rats_resolved: () => {
    once('treasury_resolved_rewarded', () => {
      setFlag('treasury_case_solved');
      setFlag('clue_fortynine_candles');
      addLog('📜 RESOLVED: Nothing was stolen from the Royal Treasury. A keyholder with a perpetual pre-Flame warrant has moved one cross-marked relic to the foot of the old stone, once a year, for forty-nine years, and marked the year on a candle "that the count be kept."', 'holy');
      addLog('📜 CLUE: The warrant runs to forty-nine and stops. There is no fiftieth year. This is year forty-nine.', 'holy');
      grantHolyPoints(5);
      grantXP(250);
    });
    return {
      location: 'Vaelthar — Adrin Sallow\'s Front Room',
      locationIcon: '🔑',
      narration: `"It isn't theft," Adrin says, and he says it patiently, the way you'd correct a child's grammar. "It's a withdrawal. It's a line item. It has been a line item since before there was a Crown to itemise for." Nineteen times he has done it. His predecessor did thirty; he trained under her for a fortnight and she died in her chair. The form is four hundred years old and it is one page long: enter, take the marked object off the shelf, set it by the stone, scratch the year on a candle, leave the candle, lock the door, file a nil return. "I've never asked what it's for. You don't ask what a form is for. A form is what asking looks like when it's finished." He eats a spoonful of soup. "I'll tell you the only thing that's ever bothered me." He puts the spoon down. "It's year forty-nine. There's no candle for fifty. The warrant runs to forty-nine and then it stops — no renewal clause, no successor, nothing, it just ends, like a road. I wrote to the Chancery about it in the spring. Twice." He shrugs. "Nobody's written back."`,
      sub: `He has done it nineteen times. He does not know why. And the warrant ends this year.`,
      options: [
        { icon: '💬', label: '"Who told you to put it by the stone? Whose stone is it?"', type: 'talk',
          roll: { stat: 'WIS', dc: 12 },
          onSuccess: () => { addLog('📜 Adrin: "The form says \'to the stone.\' That\'s all it says. I asked her — my predecessor — in the fortnight I had her. She said her predecessor told her it was older than the vault and the vault was built around it because you can\'t move it, and that\'s not mysticism, that\'s masonry: they tried, in the second King\'s time, and they broke two winches and gave up and put a wall round it and called it the back of the room." A pause. "It\'s a good stone. Somebody cut it beautifully. I always thought it was a shame nobody sees it."', 'holy'); grantXP(100); runScene('treasury_rats_resolved'); },
          onFail: () => { addLog('"The form says \'to the stone.\' I don\'t know which stone. I know which stone I use." Which is, when you think about it, the entire history of the last four hundred years in one sentence.', 'narrator'); runScene('treasury_rats_resolved'); } },
        { icon: '📜', label: 'Take the warrant and the nineteen returns. Put them in front of the Crown.', type: 'explore',
          action: () => { once('treasury_warrant_seized', () => { give('The Second Key Warrant (perpetual, pre-Flame)'); give('Sallow\'s Annual Returns (nineteen)'); addLog('📜 ITEM GAINED: The Second Key Warrant — perpetual, pre-Flame, unrevokable until "the expiry of the Charter." Nobody in the Crown can say what the Charter is.', 'holy'); grantXP(100); }); runScene('treasury_rats_resolved'); } },
        { icon: '🔑', label: '"Do this year\'s withdrawal in front of me. Now."', type: 'talk',
          action: () => { addLog('He does. He is very good at it. Shelf eleven, the strip of shroud, four feet to the left, set it down square at the foot of the stone with two hands like a man laying a plate. Then the candle, the knife, the year — 49 — and he stands it in the dust at the end of the row and steps back and it is done and it took ninety seconds and it has been holding something together for four hundred years and he has no idea. On the way out he says: "That\'s me finished, then. Nothing left in the schedule." He sounds relieved.', 'holy'); setFlag('watched_the_withdrawal'); grantHolyPoints(3); grantXP(100); runScene('treasury_rats_resolved'); } },
        { icon: '⚔', label: 'Arrest him. Somebody has to hang for a year of Crown panic.', type: 'combat',
          action: () => { setFlag('sallow_arrested'); grantHellPoints(5); addLog('You arrest a sixty-one-year-old clerk for lawfully executing a warrant every Crown for four hundred years has renewed. The Chancery will find the instrument valid within a month and he will be released and he will never get the fortnight back. He goes quietly. He asks whether he should bring the key. +5 Hell Points.', 'hell'); if (window.travelToLocation && window.WORLD_LOCATIONS) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
      ]
    };
  },

  // ══════════════════════════════════════════════════════
  //  c1q11 — THE CONDEMNED MAN'S LAST WORDS
  // ══════════════════════════════════════════════════════

  condemned_last_words_arrival: () => {
    setFlag('condemned_quest_started');
    return {
      location: 'Vaelthar — The Gallows Yard',
      locationIcon: '⚖',
      threat: '⚠ Four days cold',
      narration: `They hanged him four days ago and the yard has not been swept since, which tells you something about the state of this city. The warrant is still nailed to the post, rain-swollen, legible: WAT KERRIN, cooper, of Low Ferry. Treason. No treason specified — no act, no date, no victim, just the word, which in a Crown court is not enough and in this month apparently is. The hangman is sitting on the steps of his own scaffold at ten in the morning with a jug between his boots, and he has the look of a professional who has done a piece of work he cannot put down. Kerrin's priest heard his last rites and then did not go home. Nobody has seen Father Ossen since.`,
      sub: `A man was hanged for treason nobody can name. The priest who heard him ran.`,
      options: [
        { icon: '📜', label: 'Read the warrant off the post', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => runScene('condemned_warrant_read'),
          onFail: () => { addLog('Rain and four days have had the ink. You get the name, the charge, and nothing else — which is exactly what the yard expects you to get.', 'narrator'); runScene('condemned_hangman_account'); } },
        { icon: '💬', label: 'Talk to the hangman', type: 'talk',
          action: () => runScene('condemned_hangman_account') },
        { icon: '👁', label: 'Ask the Watch about Father Ossen', type: 'talk',
          action: () => runScene('ossen_trail') },
        { icon: '🔍', label: 'Look at the drop itself', type: 'explore',
          action: () => { addLog('The rope is still on the beam. Nobody has cut it down, which is not procedure. The hangman notices you noticing. "Church man told me to leave it," he says. "Didn\'t say why. Didn\'t ask." ', 'narrator'); runScene('condemned_hangman_account'); } },
      ]
    };
  },

  condemned_warrant_read: () => {
    once('condemned_warrant_logged', () => {
      addLog('📜 CLUE: Kerrin\'s execution warrant is signed by the Church Archive, not the Watch — and expedited by four days. A Crown gallows, run on Archive paper.', 'holy');
      grantXP(100);
    });
    return {
      location: 'Vaelthar — The Gallows Post',
      locationIcon: '📜',
      narration: `You get the whole document off the post in one piece and read it in the shelter of the scaffold, and the interesting part is not the charge — the charge is a word — it is the bottom. A Crown execution warrant is signed by the Watch and countersigned by a magistrate; that is not tradition, that is law. This one is signed by the Church Archive. The magistrate's line has a mark in it that is not a signature but the acknowledgement of one, which is a thing clerks do when they are told to. And the schedule has been moved: original date, struck; new date, four days earlier, initialled. Somebody in the Archive wanted a cooper from Low Ferry dead four days sooner than the law wanted, and got it, and did not bother to hide the paperwork, because who reads a warrant after the drop.`,
      sub: `The Archive signed it. The Archive moved it up by four days. Nobody asks why the Archive hangs people.`,
      options: [
        { icon: '📜', label: 'Take the warrant', type: 'explore',
          action: () => { once('condemned_warrant_taken', () => { give("Kerrin's Execution Warrant (Archive-signed)"); addLog('📜 ITEM GAINED: Kerrin\'s Execution Warrant — Archive-signed, magistrate acknowledged not signed, date advanced four days.', 'holy'); grantXP(50); }); runScene('condemned_hangman_account'); } },
        { icon: '💬', label: 'Ask the hangman what four days of hurry looked like', type: 'talk',
          action: () => runScene('condemned_hangman_account') },
        { icon: '👁', label: 'Find Father Ossen', type: 'move',
          action: () => runScene('ossen_trail') },
      ]
    };
  },

  condemned_hangman_account: () => {
    setFlag('heard_hangman_account');
    return {
      location: 'Vaelthar — The Gallows Yard, The Steps',
      locationIcon: '🪢',
      narration: `"Bode," the hangman says. "Sixty-one men. Sixty-two now." He does not offer the jug and he does not apologise for it. "Kerrin didn't fight, didn't cry, didn't ask for his mother. He asked for a priest and I said you get one anyway, that's the rule, and he said good, and then he did the strangest thing I've seen in this yard." Bode looks at his hands. "He recited. To the priest. Six lines — I counted, I don't know why I counted — and at the end of every one he made a mark in the air with two fingers. Not the torch. The other one. The old one. Slow, so the priest could get it down." He drinks. "And he was watching the priest's hand while he did it. Making sure it was going down right. That's not confessing. I've heard sixty-one men confess. Confessing is unloading. This was a man handing over a parcel."`,
      sub: `Six lines. A mark at the end of each. And he was checking the priest was getting it right.`,
      options: [
        { icon: '💬', label: '"Why did you drop him on the sixth?"', type: 'talk',
          roll: { stat: 'WIS', dc: 12 },
          onSuccess: () => { addLog('📜 CLUE: Bode: "There was a Church man on the wall. Never seen the Archive send anyone to watch a hanging before. He nodded at the sixth line and I pulled, because that\'s the job, you pull when they nod." Bode has been drinking for four days about the fact that the nod came on the sixth line and not before and not after. "Kerrin was starting a seventh. He got as far as \'and the seventh is not—\'."', 'holy'); setFlag('knows_lect_seventh_cut'); grantHolyPoints(3); grantXP(150); runScene('condemned_hangman_account'); },
          onFail: () => { addLog('"You pull when they nod. That\'s the whole of my trade." He will not go further and he is not lying; he simply cannot make himself say the next part yet.', 'narrator'); runScene('condemned_hangman_account'); } },
        { icon: '💬', label: '"Do you remember any of the lines?"', type: 'talk',
          roll: { stat: 'INT', dc: 14 },
          onSuccess: () => { addLog('📜 Bode: "Something about ash. \'Let the ash remember what it was.\'" He looks up. "I\'ve sung that. That\'s in the morning hymn. That\'s the hymn, that line\'s in the hymn — what\'s a traitor doing saying the hymn on my rope?"', 'holy'); grantXP(100); runScene('condemned_hangman_account'); },
          onFail: () => { addLog('"I hang people. I don\'t listen to them." Which is a thing he has told himself sixty-one times and it stopped working on the sixty-second.', 'narrator'); runScene('condemned_hangman_account'); } },
        { icon: '👁', label: '"Where would a frightened priest go?"', type: 'talk',
          action: () => runScene('ossen_trail') },
        { icon: '🍺', label: 'Sit down. Drink with him. Let him get there himself.', type: 'talk',
          action: () => { addLog('You sit on the scaffold steps with the hangman of Vaelthar and drink his bad wine, and after a while he says, to the yard: "He wasn\'t a traitor. I\'ve hanged traitors. Traitors are angry." Then: "He was a priest. Not a Church one. The other kind. The kind they don\'t have a word for any more." He does not know why he knows that. He is right.', 'narrator'); grantHolyPoints(2); runScene('ossen_trail'); } },
      ]
    };
  },

  ossen_trail: () => ({
    location: 'Vaelthar — Looking For a Priest',
    locationIcon: '👁',
    threat: '⚠ You are not the only ones looking',
    narration: `Father Ossen is forty-four, unremarkable, a parish priest of the Eternal Flame with eleven years of clean service and no debts, and he has vanished so completely that the only honest conclusion is that he did not plan it — a man with a plan leaves a better hole than this. His room at the Temple Quarter has been searched twice: once by someone careful and once, afterwards, by someone who wanted it known. His horse is gone. His cash box is not. And the Archive has two men asking after him in the same taverns you are, one street ahead of you all morning, which means the Archive does not know where he is either, and which means the Archive very badly wants to.`,
    sub: `He didn't plan this. He ran. People who run go where they know.`,
    options: [
      { icon: '🍺', label: 'Ask Lyra at the Tarnished Cup — priests drink somewhere', type: 'talk',
        roll: { stat: 'CHA', dc: 11 },
        onSuccess: () => { addLog('📜 Lyra doesn\'t look up from the tap. "Ossen. Comes in for the small beer, never the good stuff, pays for other people\'s and thinks nobody notices." A pause. "He asked me on Tuesday which road had the fewest Church tolls. I told him the Merchant Road, because it does, and he thanked me, and he had a wax tablet in his hand and he was holding it the way you hold a baby." She wipes the counter. "Roadside inn. He\'ll be in the hayloft. He\'s not the sort to take a room."', 'holy'); grantXP(100); runScene('ossen_found'); },
        onFail: () => { addLog('Lyra: "Half this city is hiding from the other half this week. Narrow it down." She is not being unhelpful. She is being careful, which is why she is still alive.', 'narrator'); runScene('ossen_trail'); } },
      { icon: '🔍', label: 'Search his room before the Archive comes back a third time', type: 'explore',
        roll: { stat: 'INT', dc: 13 },
        onSuccess: () => { addLog('📜 The cash box is untouched and the wax is gone. Ossen keeps — kept — a shelf of confession slates, blanks, a priest\'s consumables, and there is a gap in it and a fresh smear of wax dust on the sill where he went out the window with one in his coat. Under the bed: a Merchant Road toll schedule, four days old, with the roadside inn circled.', 'holy'); grantXP(100); runScene('ossen_found'); },
        onFail: () => { addLog('You find a room a man left in a hurry and two searches\' worth of other people\'s fingerprints on top of it. Somebody is always ahead of you here.', 'narrator'); runScene('ossen_trail'); } },
      { icon: '👁', label: 'Follow the Archive\'s men instead — let them find him for you', type: 'explore',
        roll: { stat: 'DEX', dc: 13 },
        onSuccess: () => { setFlag('tailed_archive_men'); addLog('📜 You get behind them for two hours. They are not investigators. They are not asking where he went — they are asking what he was carrying. Nobody has said the word "tablet" out loud all morning except them.', 'holy'); grantXP(100); runScene('ossen_found'); },
        onFail: () => { addLog('They make you at the third tavern. They do not confront you. They simply stop looking for Ossen and start looking at you, and that is worse, and you have just cost yourself a head start.', 'narrator'); setFlag('archive_watching_party'); runScene('ossen_trail'); } },
      { icon: '⚖', label: 'Go back to the yard and lean on Bode again', type: 'move',
        action: () => runScene('condemned_hangman_account') },
    ]
  }),

  ossen_found: () => {
    setFlag('found_ossen');
    return {
      location: 'The Merchant Road — The Roadside Inn, Hayloft',
      locationIcon: '🌾',
      threat: '⚠ Two riders on the road behind you',
      narration: `He has not slept in four days and he has not put the tablet down in four days, and those two facts are the same fact. Father Ossen is sitting in the corner of a hayloft with his back to the wall and his cassock still on — he has not even had the sense to change out of the one thing in the world that identifies him — and when your head comes over the ladder he does not run and he does not scream. He holds up the wax tablet with both hands, in front of his chest, like a man surrendering a weapon or offering a child. "Are you here for it?" he says. His voice is completely level. "Take it. Please. I am required to write what I hear. I wrote it. I have not slept since and I do not want it and I cannot destroy it because I am required — " he stops. He starts again, quieter. "I have carried a thing for four days that I would be hanged for reading and I did not read it until this morning, and now I have read it, and I understand why he was in a hurry."`,
      sub: `He is not hiding it. He is trying to hand it to someone. That is what Kerrin did too.`,
      options: [
        { icon: '📜', label: '"Show me what you wrote."', type: 'talk',
          action: () => runScene('ossen_slate_read') },
        { icon: '💬', label: '"Why did you run? You did your office. You did nothing wrong."', type: 'talk',
          action: () => { addLog('Ossen: "Because the Archive signed his warrant. Not the Watch. The Archive." He laughs once, badly. "I have been a priest of the Eternal Flame for eleven years and I did not know my own Archive could hang a man. I found that out from a warrant nailed to a post. So I asked myself what else I don\'t know about the institution I have given my life to, and I discovered the answer is: everything, and it is written on this tablet in my own handwriting." He holds it out again. "Take it. I will feel better when it is somebody else\'s."', 'narrator'); runScene('ossen_slate_read'); } },
        { icon: '👁', label: 'Get him moving first — you were followed', type: 'move',
          roll: { stat: 'WIS', dc: 12 },
          onSuccess: () => { setFlag('ossen_moved_early'); addLog('📜 You get him out of the loft and into the treeline four minutes before two riders come up the inn road at a pace nobody uses on a toll road. You read the tablet in a ditch, in the wet, which is where most true documents in this kingdom have been read.', 'holy'); grantHolyPoints(3); grantXP(100); runScene('ossen_slate_read'); },
          onFail: () => runScene('ossen_hunted') },
        { icon: '🍺', label: 'Sit down. He needs a minute before he can do this.', type: 'talk',
          action: () => { addLog('You sit down in the hay across from a man who has not slept in four days. It takes him a while. "He was so calm," Ossen says eventually. "He kept checking my hand. He wasn\'t confessing to me. He was — " he searches for it — "he was filing. He was filing something with the only clerk they\'d let in the room."', 'narrator'); runScene('ossen_hunted'); } },
      ]
    };
  },

  ossen_hunted: () => ({
    location: 'The Roadside Inn — The Ladder',
    locationIcon: '🗡',
    threat: '☠ HOSTILE — Archive men',
    narration: `Two riders, no livery, no warrant, and a horse each left standing in the yard with the reins loose, which is the mark of men who expect to be four minutes. They come up the ladder without calling out. The first one says, conversationally, "The tablet, and you can all go home," and he means it, and that is the frightening part — they do not want you, they do not want him, they want a rectangle of wax with six lines on it, badly enough to ride four hours on a toll road they did not pay for. Ossen has stopped breathing. He is holding the tablet out towards them. He would give it to them. He would give it to anyone. That is what four days does.`,
    sub: `They want the wax. Nothing else. That tells you exactly what the wax is worth.`,
    options: [
      { icon: '⚔', label: 'Put yourself between the priest and the ladder', type: 'combat',
        action: () => { setFlag('defended_ossen'); startCombat([
          Object.assign(generateEnemy('church_agent', 2), { id: 'archive_man_1' }),
          Object.assign(generateEnemy('church_agent', 2), { id: 'archive_man_2' }),
        ], { victoryScene: 'ossen_slate_read' }); } },
      { icon: '🤫', label: 'Take the tablet and go out the loft door onto the stable roof', type: 'explore',
        roll: { stat: 'DEX', dc: 13 },
        onSuccess: () => { setFlag('ossen_escaped_with_party'); addLog('📜 You go off the stable roof into a midden with a priest under one arm and a wax tablet under the other and you do not stop running until the toll post. Ossen is laughing by the end of it, which is the first sound of a living man he has made in four days.', 'holy'); grantXP(150); runScene('ossen_slate_read'); },
          onFail: () => { addLog('The loft door is nailed. It has been nailed since the spring. You turn round and there are two men on the ladder and no floor left to argue on.', 'narrator'); startCombat([
            Object.assign(generateEnemy('church_agent', 2), { id: 'archive_man_1' }),
            Object.assign(generateEnemy('church_agent', 2), { id: 'archive_man_2' }),
          ], { victoryScene: 'ossen_slate_read' }); } },
      { icon: '💬', label: '"You can have the wax. I\'ve already read it."', type: 'talk',
        roll: { stat: 'CHA', dc: 14 },
        onSuccess: () => { setFlag('bluffed_archive_men'); addLog('📜 It is a bluff and it works because it is the one thing they are not equipped for. Their whole trade is objects. The lead man actually takes half a step back — you can watch him try to file a person and fail. They take the tablet. They do not take Ossen, because their warrant says wax. You read it over his shoulder in the yard afterwards, from memory, while he weeps and recites and corrects himself and gets it right.', 'holy'); grantHolyPoints(3); grantXP(150); runScene('ossen_slate_read'); },
        onFail: () => { addLog('"Then we\'ll have the wax and you." The lead man is already moving.', 'narrator'); startCombat([
          Object.assign(generateEnemy('church_agent', 2), { id: 'archive_man_1' }),
          Object.assign(generateEnemy('church_agent', 2), { id: 'archive_man_2' }),
        ], { victoryScene: 'ossen_slate_read' }); } },
      { icon: '✋', label: 'Let them take it. He is a man, it is a rectangle of wax.', type: 'talk',
        action: () => { setFlag('let_archive_take_tablet'); addLog('They take the tablet and go, and they are gone in four minutes exactly, and nobody is hurt, and Ossen sits down in the hay and puts his hands over his face. Then, without moving them, flatly, he begins to recite. "I am required to write what I hear," he says. "I have written it four hundred times in my head since Tuesday. Get a pen."', 'narrator'); grantHolyPoints(2); runScene('ossen_slate_read'); } },
    ]
  }),

  ossen_slate_read: () => {
    once('ossen_slate_rewarded', () => {
      setFlag('clue_old_benediction_six_lines');
      addLog('📜 CLUE: Ossen\'s confession-slate — six lines, each closing with a cross. Not a confession. A delivery. Line seven never came: they dropped Kerrin during the sixth.', 'holy');
      addLog('  I.   "Guard the light that does not fail, ✝"', 'holy');
      addLog('  II.  "Abide in the hollow of the world, ✝"', 'holy');
      addLog('  III. "Let the ash remember what it was, ✝"', 'holy');
      addLog('  IV.  "Grant us the light of the seventh stone, ✝"', 'holy');
      addLog('  V.   "Watch the door that has no door, ✝"', 'holy');
      addLog('  VI.  "Now, and in the hour of the breaking, ✝"', 'holy');
      addLog('  VII. — the wax is smooth. Nothing was written.', 'holy');
      addLog('📜 ITEM GAINED: Ossen\'s Confession-Slate (six lines).', 'holy');
      give("Ossen's Confession-Slate (six lines)");
      grantHolyPoints(5);
      grantXP(250);
    });
    return {
      location: 'Ossen\'s Confession-Slate',
      locationIcon: '📜',
      narration: `Six lines, in a priest's fast hand, on wax, with the stylus-marks of a man writing at a speed his training never prepared him for. Guard the light that does not fail. Abide in the hollow of the world. Let the ash remember what it was. Grant us the light of the seventh stone. Watch the door that has no door. Now, and in the hour of the breaking. Six petitions, and each one closes with a mark he has drawn rather than written — a plain cross, not the torch, six of them, because he wrote what he saw a dying man do with two fingers. And then the wax is smooth. Nothing. Not a scratch, not a start, not the tail of a letter. "There was a seventh," Ossen says. "He said it out loud — he said 'there are seven, Father, there are seven, and the seventh is not—'" He stops. He has said this sentence to himself for four days and it ends in the same place every time. "And then the Church man on the wall nodded, and Bode pulled, and that was the end of the sentence. They did not hang him for treason. They hanged him for the seventh line. They sat through six and waited."`,
      sub: `Six petitions. A real, spoken text. A man died delivering it. The Church killed him precisely at the seventh.`,
      options: [
        { icon: '💬', label: '"Read line three again. Slowly."', type: 'talk',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { addLog('📜 CLUE: "Let the ash remember what it was." You have sung that line. Everyone has sung that line — it is the third line of the morning hymn, the one the whole realm recites at dawn, the one the children in Vaelthar recite with no names in their heads. A hedge-priest hanged for treason spent his last ninety seconds carefully dictating six lines and four of them are the Church\'s own hymn with the first word changed.', 'holy'); setFlag('clue_slate_matches_hymn'); grantHolyPoints(3); grantXP(150); runScene('ossen_slate_read'); },
          onFail: () => { addLog('It is a prayer. It sounds like every prayer. That is exactly the problem and exactly the design.', 'narrator'); runScene('ossen_slate_read'); } },
        { icon: '💬', label: '"You are a priest of the Flame. What is this?"', type: 'talk',
          action: () => { addLog('Ossen, precisely, like a man reading his own death warrant aloud and being professional about it: "It is a benediction. It is in our form — the petition, the mark, the close. It is not in our book. It is older than our book and our book is a copy of it with the marks changed." He looks at the wax. "I have been ordained eleven years. I can read a liturgy the way a smith reads iron. That is not a heresy, that is a source, and ours is the copy."', 'holy'); setFlag('ossen_named_it_a_source'); grantHolyPoints(3); grantXP(100); runScene('ossen_slate_read'); } },
        { icon: '🛡', label: 'Get Ossen to Captain Rhael — the Watch can hold what the Archive wants', type: 'move',
          action: () => { setFlag('ossen_under_watch_protection'); addLog('📜 Rhael reads the slate twice, hands it back, and says nothing for a long moment. Then: "I\'ll house him. Not in a cell — in my sister\'s attic, and I\'ll deny it in front of the King." He looks at the tablet in your hand. "Six lines got a man hanged four days early. Don\'t let anybody see you carrying that in daylight."', 'holy'); grantHolyPoints(5); grantXP(100); runScene('ossen_slate_read'); } },
        { icon: '🌲', label: 'Put him on the Thornwood road with money and tell him to keep walking', type: 'move',
          action: () => { setFlag('ossen_fled_kingdom'); addLog('You give a frightened priest a horse and a purse and the one road with no Church tolls on it. He takes the horse. He does not take the slate — he pushes it back into your hands with both of his and says: "I am required to write what I hear. I am not required to keep it. Somebody has to hear the seventh, and it will not be me."', 'holy'); grantHolyPoints(3); grantXP(75); if (window.travelToLocation && window.WORLD_LOCATIONS) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
      ]
    };
  },

  };

  if (typeof SCENES !== 'undefined') Object.assign(SCENES, S);
  if (typeof window !== 'undefined') { window.SCENES = window.SCENES || SCENES; Object.assign(window.SCENES, S); }
})();
