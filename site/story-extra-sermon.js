// Sanctum & Shadow — Chapter I extra scenes: sermon
// c1q15 "The Preacher's True Sermon" (Mol)  ·  c1q17 "The Church's Hidden Archive" (Level Four · Stone VI)
(function(){

  // ── local helpers (never assume load order) ────────────────────────────
  function F(key){
    if (typeof getFlag === 'function') return getFlag(key);
    return !!(window.sceneState && window.sceneState.flags && window.sceneState.flags[key]);
  }
  function SF(key){ if (typeof setFlag === 'function') setFlag(key); }
  function LOG(text, kind){ if (typeof addLog === 'function') addLog(text, kind || 'narrator'); }
  function HOLY(n){ if (typeof grantHolyPoints === 'function') grantHolyPoints(n); }
  function ITEM(name){
    var inv = window.gameState && window.gameState.character && window.gameState.character.inventory;
    if (inv && inv.indexOf(name) === -1) inv.push(name);
  }
  function GO(id){ if (typeof runScene === 'function') runScene(id); }

  // executeSceneOption() REMOVES the scene panel before running an option's action,
  // and the _pendingScene restore path calls showScene() directly — which never runs
  // processSceneQuestMilestone(). So an option that only opens a conversation is a
  // dead end that silently strands the quest chain. Open the conversation, then hand
  // control back through runScene() (the only path that fires scene: events) once the
  // conversation — and any fight it turned into — is actually over.
  function TALK_THEN(npcId, opener, nextSceneId){
    if (typeof startNPCConversation !== 'function') { GO(nextSceneId); return; }
    startNPCConversation(npcId, opener);
    var ticks = 0;
    var timer = setInterval(function(){
      ticks++;
      var busy = !!(window.npcConvState && window.npcConvState.active)
        || !!(window.combatState && window.combatState.active);
      // ticks > 2 lets the async conversation open before we test for "closed".
      if (!busy && ticks > 2) { clearInterval(timer); GO(nextSceneId); }
      else if (ticks > 600) { clearInterval(timer); } // 5 min safety valve
    }, 500);
  }
  function TRAVEL(locId){
    if (typeof travelToLocation === 'function' && window.WORLD_LOCATIONS && window.WORLD_LOCATIONS[locId]) {
      travelToLocation(window.WORLD_LOCATIONS[locId]);
    }
  }
  function agents(n, victoryScene){
    var list = [];
    for (var i = 0; i < n; i++) list.push({ name:'Church Agent', hp:40, ac:13, atk:5, icon:'🗡', id:'archive_agent_' + (i+1), xp:80 });
    if (typeof startCombat === 'function') startCombat(list, { victoryScene:victoryScene });
  }

  // The name is reachable by ANY TWO of these four. Nothing else counts.
  // (Twist bible §4 — redundancy guarantee. Do not widen this set.)
  function nameClues(){
    var keys = ['clue_hymnal_gloss','clue_sel','clue_well_syllable','clue_voice_cannot_say_own_name'];
    var n = 0;
    for (var i = 0; i < keys.length; i++) if (F(keys[i])) n++;
    return n;
  }
  function knowsName(){
    return F('knows_the_name_early') || F('knows_selvane')
      || (F('clue_hymnal_gloss') && F('clue_sel') && F('clue_well_syllable'));
  }

  const S = {

    // ══════════════════════════════════════════════════════════════════
    //  QUEST 15: THE PREACHER'S TRUE SERMON (c1q15) — Mol
    //  PRIMARY: Lect's hymnal + the Church's own printed marginal gloss.
    //  CORROBORATOR: the true sermon, in an alley, in a whisper, once.
    // ══════════════════════════════════════════════════════════════════

    mol_true_sermon_arrival: () => {
      SF('mol_true_sermon_started');
      const spared = F('heretic_protected') || F('aldran_escaped');
      return {
        location: 'Mol Village — The Second Sermon',
        locationIcon: '🏘',
        threat: '⚠ A Congregation With No Preacher',
        narration: `The cart is still on the green, and Aldran is on it. Somebody has folded his hands and put a coat under his head, which is more dignity than the road gave him. ${spared ? 'You bought him days. The Church took them back on the Vaelthar road and called it bandits, and nobody is going to ask the Church to elaborate.' : 'The Church says bandits. Nobody here believes it and nobody here says so.'} Two hundred people are standing in the same places they stood the last time. Nobody is on the cart. They don't need anyone on the cart — a woman near the front starts a sentence and two hundred people finish it, because they have all heard it enough times to know how it ends.`,
        sub: `Aldran is dead. The sermon isn't. And the Church has sent a man to preach over the body.`,
        options: [
          { icon: '💬', label: 'Listen to what the congregation is actually saying', type: 'talk',
            action: () => GO('mol_congregation_remains') },
          { icon: '🔍', label: 'Look at the body — the Church says bandits', type: 'explore',
            roll: { stat: 'INT', dc: 12 },
            onSuccess: () => {
              SF('aldran_body_examined');
              LOG('Nothing was taken. Purse still on the belt, boots still on the feet — and one clean thrust under the ribs from somebody who was taught where the ribs are. But his coat has been searched, carefully, by someone who put it back the way they found it. The copy of the Covenant he showed you is gone. They didn\'t kill a heretic. They recovered a document.', 'narrator');
              GO('lect_preaches_over_body');
            },
            onFail: () => { LOG('A woman takes your wrist, not unkindly, and moves you back. "He\'s been looked at enough." ', 'narrator'); GO('lect_preaches_over_body'); } },
          { icon: '🕯', label: 'A Church man is climbing onto the cart. Watch him.', type: 'explore',
            action: () => GO('lect_preaches_over_body') },
        ]
      };
    },

    mol_congregation_remains: () => {
      SF('mol_congregation_seen');
      return {
        location: 'Mol Village — The Green',
        locationIcon: '🏘',
        narration: `They are preaching him. Not about him — him. The woman at the front says "the Church of the Eternal Flame collected your tithe," and the man beside her says "then they burned the Covenant that would have protected your land rights," and a boy of maybe fifteen says the part about the protection racket, and gets it word for word, including the pause. Elder Mosswick stands at the back with his hat in his hands. "We didn't decide to do this," he tells you, quietly. "It just kept happening." And when they run out of Aldran, they do the only other thing two hundred people can do in unison: they sing the Sevenfold Benediction. The Church's own hymn. Over a man the Church killed.`,
        sub: `A heretic's congregation is singing the Church's morning hymn at his funeral, and nobody finds that strange.`,
        options: [
          { icon: '💬', label: '"You\'re singing the Church\'s hymn over a man the Church murdered."', type: 'talk',
            action: () => { LOG('Mosswick looks at you like you have asked why water is wet. "It\'s the only prayer we all know the words to. They teach it to you at six." He puts his hat back on. "What else would we sing?"', 'narrator'); GO('lect_preaches_over_body'); } },
          { icon: '🔍', label: 'Listen to the hymn itself — all seven lines, properly', type: 'explore',
            roll: { stat: 'WIS', dc: 11 },
            onSuccess: () => {
              SF('heard_benediction_sung');
              LOG('Six of the lines ask for something. Sanctify. Let. Vouchsafe. Attend. The seventh asks for nothing at all — it just says ever, and after ever, amen, and stops. Two hundred people sing it without noticing that the last line of the realm\'s most-recited prayer is not a prayer.', 'narrator');
              GO('lect_preaches_over_body');
            },
            onFail: () => GO('lect_preaches_over_body') },
          { icon: '🕯', label: 'The Church man is on the cart now', type: 'move',
            action: () => GO('lect_preaches_over_body') },
        ]
      };
    },

    lect_preaches_over_body: () => {
      SF('lect_in_mol');
      return {
        location: 'Mol Village — Brother Lect',
        locationIcon: '🔥',
        threat: '⚠ Church Sermon Over a Church Killing',
        narration: `They have sent the screamer. Brother Lect, forty-four, three days hoarse from the Temple Quarter, standing on a dead heretic's cart with his boots either side of the man's shoulders. He is very good. He is also, and this is the problem, entirely sincere — he tells two hundred people that the burning of the Covenant is the judgement of God on a grasping Crown, and he believes every syllable, and for a moment some of them believe it too. Then he closes the way every Flame sermon closes. He sings the Sevenfold Benediction. And two hundred people who came to bury a heretic sing it back to him, word perfect, unprompted — and somewhere in it, for about one breath, Brother Lect loses his place in a text he has sung twenty thousand times.`,
        sub: `He stumbled. On a hymn he could sing in his sleep, at his own funeral, drunk. Something in it caught him.`,
        options: [
          { icon: '🔍', label: 'Which line did he stumble on?', type: 'explore',
            roll: { stat: 'WIS', dc: 13 },
            onSuccess: () => {
              SF('lect_stumble_located');
              LOG('The fourth line. "Vouchsafe the seventh light to us." He got as far as the V and his mouth kept going and his eyes didn\'t. Nobody else noticed. He noticed.', 'narrator');
              GO('lect_hymnal');
            },
            onFail: () => { LOG('Somewhere in the middle. You can\'t place it — two hundred voices are carrying him and the gap closes before you can find its edges.', 'narrator'); GO('lect_confronted'); } },
          { icon: '💬', label: 'Interrupt him. Publicly. In front of two hundred people.', type: 'talk',
            roll: { stat: 'CHA', dc: 15 },
            onSuccess: () => { SF('lect_interrupted_clean'); LOG('You say one sentence and the square goes quiet, and Lect — who has never once been interrupted, only shouted over — stops. Steps down. Walks straight at you, which is not what a frightened man does.', 'narrator'); GO('lect_confronted'); },
            onFail: () => { SF('lect_hostile'); LOG('He rolls straight over you. He has been shouting for twenty years and you have been shouting for one sentence. Two Church agents at the back write something down. But he finishes early, and he comes to find you.', 'narrator'); GO('lect_confronted'); } },
          { icon: '🕯', label: 'Let him finish. Meet him when he steps down.', type: 'move',
            action: () => GO('lect_confronted') },
        ]
      };
    },

    lect_confronted: () => {
      SF('met_lect');
      const opts = [
        { icon: '💬', label: '"Sing the fourth line again. Just the fourth."', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => { SF('lect_sang_it_again'); LOG('He sings it. Of course he sings it — he has never refused to say a holy thing out loud in his life. "Vouchsafe the seventh light to us." Then he stands there with his mouth still open, holding the book, not looking at it.', 'narrator'); GO('lect_hymnal'); },
          onFail: () => { LOG('"I do not perform," he says, which is the single least true sentence spoken in Mol this year. But he says it while opening the book, because he cannot help checking.', 'narrator'); GO('lect_hymnal'); } },
        { icon: '📖', label: 'Ask to see the hymnal — the printed one, not the shouting', type: 'talk',
          roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => { SF('lect_handed_hymnal'); LOG('He hands it over. That is the part you weren\'t ready for. He hands it to a stranger with a sword because you asked to look at scripture, and that is the one request Brother Lect has never learned to refuse.', 'narrator'); GO('lect_hymnal'); },
          onFail: () => { LOG('"You may look. I will hold it." He holds it. His thumb is over the margin.', 'narrator'); GO('lect_hymnal'); } },
        { icon: '💬', label: 'Talk to him properly — let him say his piece', type: 'talk',
          action: () => TALK_THEN('screaming_preacher', 'I stop Brother Lect beside the cart, in Mol, standing over Aldran\'s body, and ask him what he thinks he is doing here — and what he stumbled on.', 'lect_hymnal') },
        { icon: '⚔', label: 'He is preaching over a murder the Church committed. End it.', type: 'combat',
          action: () => {
            SF('lect_attacked');
            LOG('You move on him and the two men at the back of the crowd stop being a crowd. Church agents. Lect doesn\'t run — he keeps preaching while they work, which is the most frightening thing about him.', 'narrator');
            agents(2, 'lect_hymnal');
          } },
      ];
      return {
        location: 'Mol Village — Beside the Cart',
        locationIcon: '🔥',
        narration: `Up close he is smaller than the volume suggests, and there is a burst blood vessel in his left eye from three days of it. He is holding a hymnal. It is destroyed — spine gone, sewn back with the wrong colour thread, corners rounded off by forty years of a thumb. "You are here for the heretic," he says. "Everyone is here for the heretic. Nobody is here for the hymn." He says it like an accusation, and there is something underneath it that isn't. "Well?"`,
        sub: `He's carried that book since he was six. It's the only thing on him he'd fight for.`,
        options: opts,
      };
    },

    // ── PRIMARY CLUE (c1q15): the hymnal, the capitals, and the Church's gloss ──
    lect_hymnal: () => {
      SF('clue_hymnal_gloss');
      LOG('📜 CLUE: The Sevenfold Benediction is printed with seven illuminated capitals — S E L V A N E — in every hymnal in the realm. Beside them, printed, in every copy: "The Seven Lights. A holy word of the old tongue. Its meaning is not preserved." The Church prints the denial next to the evidence.', 'holy');
      ITEM('Flame Hymnal (Sevenfold Benediction, illuminated)');
      const opts = [];
      if (nameClues() >= 2 && !F('knows_selvane') && !F('knows_the_name_early')) {
        opts.push({ icon: '🗣', label: 'Read the capitals down the left edge. Say the word out loud.', type: 'talk',
          action: () => {
            SF('knows_selvane'); HOLY(10);
            LOG('📜 REVELATION: SELVANE. You do not decode anything — you recognise it. You have been hearing it for days, in pieces, from people who did not know they were holding one: the syllable the well cannot finish, the thing the grandmothers of Mol hush children with, the one name the Voice has and cannot find. It is not a holy word of the old tongue. It is a man, and the realm has sung him at dawn for four hundred years.', 'holy');
            LOG('Lect watches your mouth make the sound. "That is not a word," he says. And then, much more quietly, because he is not stupid and never was: "Say it again."', 'narrator');
            GO('lect_alley_confession');
          } });
      } else {
        opts.push({ icon: '📖', label: 'Read the capitals down the left edge', type: 'explore',
          action: () => {
            LOG('S. E. L. V. A. N. E. It spells something. The Church has printed, in the margin, an inch away, that nobody knows what. Whatever it is, it is not hidden — it is filed.', 'narrator');
            GO('lect_alley_confession');
          } });
      }
      opts.push(
        { icon: '💬', label: '"What does the margin mean, Brother? Read it to me."', type: 'talk',
          action: () => {
            SF('lect_recited_gloss');
            LOG('He does not look at the page. "The Seven Lights. A holy word of the old tongue. Its meaning is not preserved." He has it by heart. He has had it by heart since before he could read the thing it is written next to. He has never once wondered.', 'narrator');
            GO('lect_alley_confession');
          } },
        { icon: '🔍', label: 'Check another hymnal — someone else\'s, from the crowd', type: 'explore',
          roll: { stat: 'INT', dc: 10 },
          onSuccess: () => {
            SF('clue_gloss_is_universal');
            LOG('📜 CLUE: A farmer\'s hymnal, forty years newer, printed in a different city. Same seven capitals, illuminated in the same order, same gloss in the same margin, word for word. This is not one bad copy. This is the edition. Every hymnal in the realm says it.', 'holy');
            GO('lect_alley_confession');
          },
          onFail: () => GO('lect_alley_confession') },
        { icon: '🚶', label: 'You have what you came for. Leave him with his book.', type: 'move',
          action: () => GO('mol_sermon_aftermath') }
      );
      return {
        location: 'Mol Village — The Hymnal',
        locationIcon: '📖',
        narration: `The Sevenfold Benediction, page one, the way it has been printed for four hundred years — seven lines, seven capitals, each one illuminated in gold leaf that some monk was paid to lay down so that a child could find its place:\n\n  S — "Sanctify the flame that does not fail,"\n  E — "Eternal in the hollow of the world,"\n  L — "Let the ash remember what it was,"\n  V — "Vouchsafe the seventh light to us,"\n  A — "Attend the door that has no door,"\n  N — "Now, and in the hour of the breaking,"\n  E — "Ever, and after ever, amen."\n\nAnd in the margin beside them, printed, part of the plate, in every copy ever struck: "The Seven Lights. A holy word of the old tongue. Its meaning is not preserved."`,
        sub: `The Church admits — in print, in every hymnal in the realm — that the seven letters spell a word it cannot read.`,
        options: opts,
      };
    },

    // ── CORROBORATOR (c1q15): the true sermon. Once. In an alley. In a whisper. ──
    lect_alley_confession: () => {
      SF('clue_lect_confession');
      LOG('📜 CLUE: Brother Lect\'s true sermon — the one he will not preach aloud: "I have sung those seven letters twenty thousand times. I was six when they taught me. I thought it was a sound God makes."', 'holy');
      const opts = [
        { icon: '💬', label: '"Then preach that. Out loud. Once. That\'s all."', type: 'talk',
          roll: { stat: 'CHA', dc: 16 },
          onSuccess: () => {
            SF('lect_said_it_twice'); HOLY(8);
            LOG('He doesn\'t. Of course he doesn\'t — he is forty-four and the Church is the only architecture he has. But he says it again, to you, slower, looking at you the whole way through, and lets you hear him mean it. That is the entire sermon. It lasts nine seconds and it has an audience of one, and it is the truest thing said in Mol today, including everything the congregation got word-perfect.', 'holy');
            GO('mol_sermon_aftermath');
          },
          onFail: () => { LOG('"Preach what?" he says. "I have nothing to preach. I have a stumble." He is already turning. He is already louder.', 'narrator'); GO('mol_sermon_aftermath'); } },
        { icon: '✝', label: 'Say the Name. Quietly. Not as a weapon.', type: 'talk',
          action: () => {
            SF('lect_heard_the_name'); HOLY(10);
            LOG('You say it once, at speaking volume, in an alley in Mol, and it is not loud and nothing catches fire. The stillness arrives the way it always arrives — without argument, without asking, simply there, and there is nothing in Brother Lect\'s twenty years of rebuttals that touches it, because it is not making a claim. It is just true, and it is standing next to him.', 'holy');
            LOG('He was seventeen when he burned his family\'s copy. He memorised it first. He told himself that was to know the enemy. He recovers — he always recovers — and he walks back to the square and screams the forgery louder than he has ever screamed anything in his life. His hands are shaking. He knows you can see them shaking. He shouts anyway.', 'narrator');
            GO('mol_sermon_aftermath');
          } },
        { icon: '💬', label: 'Push him — "Who taught you? Name the man."', type: 'talk',
          action: () => TALK_THEN('screaming_preacher', 'In the alley, quietly, I ask Brother Lect who taught him the Sevenfold Benediction when he was six, and whether that man ever told him what the seven letters spell.', 'mol_sermon_aftermath') },
        { icon: '🚶', label: 'Say nothing. Let him go back.', type: 'move',
          action: () => { SF('lect_left_alone'); LOG('You let him go. He goes. Somewhere behind you the volume comes back up, and it is the same volume it was this morning, and that is the whole mercy you had to give.', 'narrator'); GO('mol_sermon_aftermath'); } },
      ];
      return {
        location: 'Mol Village — Behind the Alehouse',
        locationIcon: '🔥',
        threat: null,
        narration: `He follows you into the gap between the alehouse and the wall, which for a man who does everything at volume is an announcement in itself. He does not scream. He has, it turns out, an inside voice; he has just never had a use for it. "I have sung those seven letters twenty thousand times," he says. "I was six when they taught me. I thought it was a sound God makes." He looks at the destroyed book in his hands as though somebody has handed it to him. "You are going to tell me it is a word. Don't. I have already worked out that it is a word. I worked it out on the cart, in front of two hundred people, in the time it takes to sing one line."`,
        sub: `This is the sermon. It is nine seconds long and he will never give it again.`,
        options: opts,
      };
    },

    mol_sermon_aftermath: () => {
      SF('mol_true_sermon_done');
      const opts = [];
      if (F('knows_selvane') || F('knows_the_name_early')) {
        opts.push({ icon: '📖', label: 'Look at the seventh line again, now that you know', type: 'explore',
          action: () => {
            SF('read_hymn_after_the_name');
            LOG('📜 The first six lines are the six old petitions, re-cut so their first letters spell a man. The seventh petitions nothing — it is the patch over the hole where the Name used to be. And the realm has been chanting the seal\'s operating manual at dawn for four hundred years and calling it worship: the seventh light. The door that has no door. The hour of the breaking.', 'holy');
            HOLY(5);
            GO('mol_sermon_aftermath');
          } });
      }
      opts.push(
        { icon: '💬', label: 'Tell the congregation what the capitals spell', type: 'talk',
          roll: { stat: 'CHA', dc: 14 },
          onSuccess: () => { SF('mol_told_the_capitals'); LOG('Mosswick hears you out, all of it, twice. Then: "So it\'s a name." He looks at the cart. "Aldran said the Church was a racket. He never said it was a headstone." Two hundred people in Mol now know there is a man in the morning hymn. By tomorrow it will be four hundred. You have just done to the Church what Aldran died doing, in one afternoon, using the Church\'s own printing.', 'holy'); GO('mol_sermon_aftermath'); },
          onFail: () => { LOG('They listen politely. It is letters. They have sung it since they were six and it has never been letters, it has been a shape their mouths make before breakfast. Mosswick pats your arm. It will take longer than an afternoon.', 'narrator'); GO('mol_sermon_aftermath'); } },
        { icon: '🕯', label: 'Watch the square one more time before you go', type: 'explore',
          action: () => {
            LOG('Lect is back on the cart, over the body, at full volume, preaching the Flame to a congregation that is not listening and will not disperse. He will do this until his voice goes. Then he will do it hoarse. Nothing about the sermon has changed except the man giving it, and nobody in the square can tell, and that is the point of him.', 'narrator');
            GO('mol_sermon_aftermath');
          } },
        { icon: '🗺', label: 'Back to Vaelthar — take the hymnal with you', type: 'move',
          action: () => { LOG('📜 You leave Mol with a hymnal, which is the least incriminating object in the world, and it is the only thing you own that the Church cannot ask you to hand over — because they printed it, and they gave it to you, and they gave one to everybody.', 'holy'); TRAVEL('vaelthar_city'); } }
      );
      return {
        location: 'Mol Village — After',
        locationIcon: '🏘',
        narration: `The congregation does not disperse. That is the report Brother Lect will file, and it is accurate, and it is not what happened. What happened is that a Church preacher stood on a dead man's cart and sang seven letters at two hundred people who sang them back, and one of the three of you standing here now knows they are a name. They bury Aldran at the edge of the green, in earth the Covenant would have given them the deed to. Somebody sings at the graveside. It is the Sevenfold Benediction. It is always the Sevenfold Benediction. It is the only prayer they all know the words to.`,
        sub: `You came for a preacher's real sermon. You leave with the Church's own printing, and a word it says it cannot read.`,
        options: opts,
      };
    },

    // ══════════════════════════════════════════════════════════════════
    //  QUEST 17: THE CHURCH'S HIDDEN ARCHIVE (c1q17) — Level Four · Stone VI
    //  PRIMARY: the founders' minutes.  CORROBORATOR: the Aldric Exception.
    // ══════════════════════════════════════════════════════════════════

    church_archive_breakin: () => {
      SF('archive_breakin_started');
      const opts = [];
      if (F('mourne_allied') || F('mourne_arrested') || F('mourne_becomes_ally')) {
        opts.push({ icon: '📜', label: 'Use Sister Mourne\'s access codes', type: 'talk',
          action: () => {
            SF('archive_entered_by_code');
            LOG('The codes work. Of course they work — she is the Church\'s best reader of the buried texts and they gave her the keys to the place the texts are buried. The deacon does not even look up. You have not broken into anything. You have been admitted.', 'narrator');
            GO('archive_theones_desk');
          } });
      }
      opts.push(
        { icon: '🍷', label: 'The scriptorium — the archivists hollowed the shelves to hide wine', type: 'explore',
          roll: { stat: 'DEX', dc: 13 },
          onSuccess: () => {
            SF('archive_entered_quietly');
            LOG('📜 Four generations of archivists cut hollows between the presses to hide wine from four generations of Elders. A hollow is a hole. The hole runs from the scriptorium on Three to the stair on Two, and nobody has ever reported it, because reporting it would mean explaining how they knew.', 'holy');
            GO('archive_theones_desk');
          },
          onFail: () => { LOG('A bottle goes over in the dark. In an archive. On stone. It is the loudest thing that has happened here since the Flame.', 'system'); agents(2, 'archive_theones_desk'); } },
        { icon: '🎭', label: 'Forge a writ of access and walk in like you own it', type: 'talk',
          roll: { stat: 'CHA', dc: 15 },
          onSuccess: () => { SF('archive_entered_by_forgery'); LOG('The deacon reads it twice, which is once more than the real ones get, and stamps it. Nothing in this building is secured against a man in a hurry with a stamp. It is secured against people who know what to ask for.', 'narrator'); GO('archive_theones_desk'); },
          onFail: () => { LOG('"The seal is right," the deacon says, pleasantly. "The series number is a scriptorium series. This writ says you are here to collect wine." He is already reaching for the bell.', 'narrator'); agents(2, 'archive_theones_desk'); } },
        { icon: '💬', label: 'Knock. Ask for Head Archivist Theones by name.', type: 'talk',
          action: () => { SF('archive_asked_for_theones'); LOG('You ask for him by name and by title and by the correct one of his two titles, and the deacon\'s whole face changes, because nobody outside the building knows there are two. Theones comes up himself. He does not look surprised. He looks tired in a way that has a date on it.', 'narrator'); GO('archive_theones_desk'); } },
        { icon: '⚔', label: 'Four levels of paper and two men with swords. Force it.', type: 'combat',
          action: () => { SF('archive_forced'); agents(3, 'archive_theones_desk'); } }
      );
      return {
        location: 'The Church Archive — Level One',
        locationIcon: '📚',
        threat: '⚠ Restricted — Highest Clergy Only',
        narration: `Four levels down, and every one of them is worse lit than the last on purpose. Level One is a counter, a register, and a deacon whose entire job is to be the reason you go home. Behind him the presses run back into the dark in rows, catalogued, dated, cross-referenced, and absolutely honest — this is the thing nobody expects about the Church Archive. It does not lie. It files. The original Covenant is down there. So is every instrument that ever preceded it, and four hundred years of correspondence, and, on Four, a room the archivists stopped assigning apprentices to in a year the register records without comment.`,
        sub: `Getting in is a lock problem. Knowing what to ask for is the actual problem.`,
        options: opts,
      };
    },

    archive_theones_desk: () => {
      SF('met_theones');
      const opts = [];
      // ── EARLY-SOLVER REWARD #2 (twist bible §4) ──
      if (knowsName()) {
        opts.push({ icon: '🗣', label: '"Say it: Selvane."', type: 'talk',
          action: () => {
            SF('solved_early'); HOLY(15);
            LOG('📜 He does not ask how you know. That is the tell — a man who has spent forty years being surprised by nothing has just been surprised, and his first act is not a question, it is a walk. He goes and gets the minutes himself.', 'holy');
            LOG('📜 ITEM GAINED: The Founders\' Minutes (unredacted) — the only copy. The only document in the world that proves a murder in chancery prose.', 'holy');
            ITEM('The Founders\' Minutes (unredacted)');
            GO('archive_founders_minutes');
          } });
      }
      opts.push(
        { icon: '💬', label: '"I want the original Covenant. Not a copy. The instrument."', type: 'talk',
          action: () => {
            SF('theones_asked_covenant');
            LOG('"Then you want Level Four, and you want the drafting file, not the engrossment." He says it before he decides to say it. That is how archivists are captured: not by threat, by a correctly-worded request. He hears himself, and stops, and rubs his eyes. "…Which I have now told you. Well."', 'narrator');
            GO('archive_level_four');
          } },
        { icon: '💬', label: '"How many collections have you destroyed?"', type: 'talk',
          roll: { stat: 'CHA', dc: 13 },
          onSuccess: () => {
            SF('theones_counted'); SF('theones_cooperating');
            LOG('📜 "Seventeen." No pause. He did not have to count — he has never once not known the number. "Seventeen separate collections of pre-Flame material, catalogued and destroyed on instruction, over forty years." A beat. "I read all of them first. Archival thoroughness. That is what I called it at the time."', 'holy');
            GO('archive_level_four');
          },
          onFail: () => { SF('theones_wary'); LOG('"That is an operational question and you are not an operation." He goes back to his ledger. He does not stop you going down. He does not come with you either, and on Four that will turn out to matter.', 'narrator'); GO('archive_level_four'); } },
        { icon: '💬', label: 'Talk to him properly — the man has been waiting to be asked something', type: 'talk',
          action: () => TALK_THEN('head_archivist_theones', 'I find Head Archivist Theones at his desk on Level One of the Church Archive and tell him I am going down to Level Four, with or without him.', 'archive_level_four') },
        { icon: '🚶', label: 'Don\'t negotiate with the catalogue. Go down without him.', type: 'move',
          roll: { stat: 'DEX', dc: 12 },
          onSuccess: () => { SF('archive_alone'); LOG('You are three flights down before the desk bell rings behind you, and it rings once, and then it doesn\'t ring again, which is a decision somebody made.', 'narrator'); GO('archive_level_four'); },
          onFail: () => { LOG('Two men on the Two stair. They are not guards. They are archivists, and they have been told what to do about people on the Two stair, and they are going to do it badly and completely.', 'narrator'); agents(2, 'archive_level_four'); } }
      );
      return {
        location: 'The Church Archive — Head Archivist Theones',
        locationIcon: '📚',
        narration: `He is sixty-seven and he does not ask how you got in. He asks which route — the scriptorium hollow or the writ — because it changes which form he has to file, and he says so, and means it. Theones has spent forty years knowing exactly where every buried thing in this building is buried, and following every instruction he was given about burying it, and telling himself the institution required it. Three days ago the Covenant burned and something in that sentence stopped working. He looks at you the way a man looks at weather he has been expecting. "Well," he says. "You're the ones. Ask me your question. I have been standing at this desk for four decades waiting for somebody to ask me a good one."`,
        sub: `He will not help easily. Forty years of loyalty does not dissolve overnight. But he is watching, and he is not comfortable.`,
        options: opts,
      };
    },

    archive_level_four: () => {
      SF('reached_archive_level_four');
      return {
        location: 'The Church Archive — Level Four',
        locationIcon: '🕯',
        threat: '☠ Nobody Is Assigned Down Here',
        narration: `Two is correspondence. Three is the scriptorium, and a bricked alcove in the west wall with a name still legible on the plaster — the apprentice who read the wrong drawer in Flame Year 380 and was sealed in with it. The brick is Church brick. The work is neat. Somebody filed a requisition for the mortar, and somebody approved it, and it is in the ledger, at the correct date, under building maintenance.\n\nFour is one room. Two presses, a table, and a stone set into the middle of the floor that is not archive stone — older, grey, and freshly cut, in a building that has not been cut into in four hundred years. The catalogue lists it as "structural." Nothing on Level Four is structural. Level Four is under everything.`,
        sub: `Two presses that matter, and a stone in the floor that nobody built around by accident.`,
        options: [
          { icon: '🔍', label: 'The near press is open to a standing file. Read what it\'s standing for.', type: 'explore',
            roll: { stat: 'INT', dc: 13 },
            onSuccess: () => GO('archive_aldric_exception'),
            onFail: () => { LOG('You pull the wrong drawer. It is the oldest press on Four and the drawer is the bottom one and it is not hidden, it is simply first, and inside it is the beginning of the whole series.', 'narrator'); GO('archive_founders_minutes'); } },
          { icon: '📜', label: 'Go to the beginning. The first minute book of the Church.', type: 'explore',
            action: () => GO('archive_founders_minutes') },
          { icon: '👂', label: 'Kneel on the stone in the floor. Put your ear to it.', type: 'explore',
            action: () => {
              SF('archive_floor_stone_seen');
              LOG('Cold, and then not cold — the cold of a room on the other side of it. There is nothing to hear. There is something not hearing you back. You are still kneeling on it when you notice you have been kneeling on it for a while, and that nobody in four hundred years of the most thoroughly catalogued building in the realm has written one word about the stone in the middle of Level Four.', 'narrator');
              GO('archive_founders_minutes');
            } },
        ]
      };
    },

    // ── CORROBORATOR (c1q17): The Aldric Exception ──
    archive_aldric_exception: () => {
      SF('clue_aldric_exception');
      LOG('📜 CLUE: The Aldric Exception — a standing Archive file, four centuries old, still open. First finding: why a saint with no vita, no birth record, no relics and nothing at all before Flame Year 12 has a monastery named for him. Operative provision: maintain and protect one Remnant house, in perpetuity, on the express finding that "the first clause requires a sayer who means it, and we have none."', 'holy');
      ITEM('The Aldric Exception (standing file, open)');
      const opts = [
        { icon: '🔍', label: 'The operative provision — what does this file actually DO?', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            SF('clue_aldric_exception_provision');
            LOG('📜 CLUE: It funds them. Line item, renewed every year, four hundred years unbroken: the Church of the Eternal Flame maintains and protects the Remnant house at Saint Aldric — the last community formally practising the faith it has hunted to extinction everywhere else in the world. Not tolerated. Protected. Because clause the first requires a sayer who means it, and the Church, by its own express written finding, has none.', 'holy');
            GO('archive_founders_minutes');
          },
          onFail: () => { LOG('Four centuries of minuted renewals, all correct, all boring. You cannot find the sentence that makes them make sense. It is in here. It is three lines long.', 'narrator'); GO('archive_founders_minutes'); } },
        { icon: '💬', label: '"Theones. Why does a saint have no birth record?"', type: 'talk',
          action: () => {
            SF('theones_aldric_line');
            LOG('📜 "I never destroyed a single document about Saint Aldric." He says it slowly, because he is hearing it as he says it. "There were none. You cannot burn what was never written." He looks at the shelf where four hundred years of a saint\'s life is not. "I have spent forty years assuming the gaps were mine."', 'holy');
            GO('archive_aldric_exception');
          } },
        { icon: '💬', label: '"Four hundred years of persecution — with one exception, filed correctly."', type: 'talk',
          action: () => {
            LOG('That is the sentence that does it. Not the atrocity — the filing. The Church burned the Remnant everywhere in the world except the one house it could not do without, and it did not do that in secret, and it did not do it out of mercy. It did it because it needed somebody, somewhere, to still mean the words. And it wrote that down. In a file. With a series number. And renewed it every year for four centuries without one single Elder ever asking what a Church needs a real believer FOR.', 'holy');
            GO('archive_founders_minutes');
          } },
        { icon: '📜', label: 'Take the file. Go to the beginning of the series.', type: 'move',
          action: () => GO('archive_founders_minutes') },
      ];
      return {
        location: 'The Church Archive — The Standing File',
        locationIcon: '📚',
        narration: `It is not sealed. It is not hidden. It is standing open in the near press because it is a live file — four centuries old and still being renewed, which in this building is not a scandal, it is a Tuesday. THE ALDRIC EXCEPTION. Its first finding is a question so administrative it took four hundred years to become terrifying: by what authority does a saint with no vita, no birth record, no relics, no miracles, and nothing whatsoever on record before Flame Year 12 hold a monastery in his name? And its operative provision — the thing the file exists to do, renewed annually, funded, signed — is to maintain and protect one house of the Remnant. Forever. On the express written finding that "the first clause requires a sayer who means it, and we have none."`,
        sub: `The Church has persecuted the Remnant everywhere in the world except the one house it cannot do without — and filed it correctly.`,
        options: opts,
      };
    },

    // ── PRIMARY CLUE (c1q17): the founders' minutes ──
    archive_founders_minutes: () => {
      SF('clue_founders_minutes');
      SF('clue_flame_year_one_blank');
      LOG('📜 CLUE: The founders\' minutes, Series I. "…the instrument requires a subject of local esteem." / "…the subject consenting, the ascension to be effected on the third day." / "…the subject\'s name to be struck from the registers, that the veneration attach to the office and not the man."', 'holy');
      LOG('📜 CLUE: The Church of the Eternal Flame has no founding charter and no founding event. Flame Year 1 is a date and nothing else. Years 1 through 11 are blank in the Church\'s own archive — the archive that has never failed to file anything. The whole realm dates its letters from Year 1.', 'holy');
      ITEM('Founders\' Minute Book (Series I)');
      const opts = [
        { icon: '💬', label: '"Registers. Not liturgy. They didn\'t erase him — they moved him."', type: 'talk',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            SF('clue_struck_from_registers');
            LOG('📜 CLUE: Read it again. They did not resolve to destroy the name. They resolved to strike it from the REGISTERS — the birth rolls, the parish books, the tax lists, the places a man is written down as a man. That is a records instruction, and it is a narrow one, and it was carried out by clerks, exactly, and only, as written. Wherever else that name went, it was not a register, and nobody struck it, because nobody was told to.', 'holy');
            GO('archive_c1q17_end');
          },
          onFail: () => { LOG('You read the sentence four times. It refuses to be dramatic. It is a filing instruction about a man\'s name and it was carried out by clerks who went home afterwards.', 'narrator'); GO('archive_c1q17_end'); } },
        { icon: '🔍', label: 'Flame Year 1. Find the founding charter. There is always a charter.', type: 'explore',
          action: () => {
            SF('archive_searched_year_one');
            LOG('There is always a charter. There is a charter for the fish market. There is a charter for the mortar that bricked up an apprentice. There is no charter for the Church of the Eternal Flame, and no minute, and no event, and no note explaining the absence — and this building has never once failed to note an absence. Year 1 is a date the realm has been writing at the top of its letters for four hundred years, and nobody wrote down what happened on it.', 'holy');
            GO('archive_c1q17_end');
          } },
        { icon: '💬', label: 'Put the page in front of Theones. Make him read it.', type: 'talk',
          action: () => {
            SF('theones_read_the_minutes');
            LOG('He checks the accession number first. Not the words — the number, and the hand, and the ink, because that is what he is and forty years does not come off a man in one afternoon. It takes him about nine seconds to confirm that it is genuine, first minute book, Series I, correctly filed since Flame Year 12. Then he reads the words. Then he sits down on the floor of Level Four, in his own archive, holding the arm of a chair he did not reach.', 'holy');
            GO('archive_c1q17_end');
          } },
        { icon: '📜', label: 'Take the minute book. All of it.', type: 'move',
          action: () => { LOG('📜 It fits under one arm. Four hundred years of the most powerful institution in the world begins with a meeting, and the meeting fits under one arm, and nobody ever burned it because nobody ever thought it was worth burning. It is minutes. It is the most boring document in the building.', 'holy'); GO('archive_c1q17_end'); } },
      ];
      return {
        location: 'The Church Archive — Series I',
        locationIcon: '📜',
        threat: null,
        narration: `Bottom drawer, oldest press, no seal, no ward, no warning. The first minute book of the Church of the Eternal Flame, in the hand of a chancery clerk who was paid to be boring and was very good at his job. There is no ritual chamber in it. There is no blood. There is no cackling. There are minutes:\n\n  "Resolved, that the instrument requires a subject of local esteem."\n  "The subject consenting, the ascension to be effected on the third day."\n  "That the subject's name be struck from the registers, that the veneration attach to the office and not the man."\n\nAnd on the shelf above it, where the founding charter of the Church of the Eternal Flame should be: nothing. Flame Year 1 has no charter and no founding event. Years 1 through 11 are blank.`,
        sub: `They resolved it in a meeting. He said yes. Eleven years of the archive are empty, and the realm dates its letters from the first of them.`,
        options: opts,
      };
    },

    archive_c1q17_end: () => {
      SF('archive_breakin_done');
      const opts = [];
      if (F('clue_aldric_exception')) {
        opts.push({ icon: '🗺', label: 'Ride to Saint Aldric — the file protects a house there, and someone is still in it', type: 'move',
          action: () => GO('cael_the_last_sayer') });
      }
      opts.push(
        { icon: '💬', label: 'Ask Theones what he does now', type: 'talk',
          action: () => TALK_THEN('head_archivist_theones', 'On Level Four, holding the founders\' minute book, I ask Head Archivist Theones what a man does with forty years after he reads this.', 'archive_c1q17_end') },
        { icon: '👂', label: 'Stay. The stone in the floor is not finished with you.', type: 'explore',
          action: () => {
            SF('archive_lower_stair_open');
            LOG('📜 You stay. The others go up. Somewhere under the stone in the middle of Level Four, in a city built on a marker nobody has moved in three hundred and ninety-three years, something says a name that belongs to a person standing in this room, and it is correct, and it is not the name on any document you have ever signed.', 'hell');
            LOG('📜 The way down is open. Whatever is beneath the Archive knows you are here now.', 'system');
          } },
        { icon: '🚶', label: 'Get out of the Archive with the file', type: 'move',
          action: () => { LOG('📜 You walk out of the Church Archive carrying the founders\' minutes and a live file, and nobody stops you, because nobody has ever written a procedure for somebody leaving with the boring drawer.', 'holy'); TRAVEL('vaelthar_city'); } }
      );
      return {
        location: 'The Church Archive — The Stair Up',
        locationIcon: '📚',
        narration: `Four levels of the most honest building in the realm, and this is what it had: a minute book that says they needed a man of local esteem and that he agreed; a live file that says they have protected one house of the faith they exterminated, for four centuries, because they need somebody who means it; and eleven blank years at the start of a calendar the whole world writes at the top of its letters. Theones stands at the foot of the stair with his hands behind his back, because if he puts them anywhere you will see them. "It was all filed," he says. "That is the part I want you to understand. Nobody hid any of this. We just never read it in the right order."`,
        sub: `They didn't bury the truth. They catalogued it, and trusted that nobody would ever request the whole series.`,
        options: opts,
      };
    },

    // ── §6 REQUIRED SCENE: Brother Cael, the last warranted Sayer ──
    cael_the_last_sayer: () => {
      SF('met_cael_sayer');
      const opts = [
        { icon: '💬', label: 'Tell him what he is.', type: 'talk',
          action: () => {
            SF('cael_told'); HOLY(10);
            LOG('📜 You tell him. The Aldric Exception. The provision. The stipend. The first clause, and the sayer who has to mean it, and the seven monks who were evicted to make a room for an Elder in a hurry — and the one who was in the root cellar and did not stop.', 'holy');
            LOG('"Oh," Brother Cael says. He thinks about it for a while. He is thirty-three and he has not slept properly in three days and he is still holding his hands the way he was holding them when you walked in. "I thought I was just praying."', 'holy');
            LOG('📜 He asks whether he should keep going. You realise he is asking your permission, and that he will do whatever you say, and that one of the two answers keeps a seal shut and the other lets a man rest, and the game will not tell you which one is kinder.', 'system');
          } },
        { icon: '🤫', label: 'Don\'t tell him. Ask him to keep going, and don\'t say why.', type: 'talk',
          action: () => {
            SF('cael_untold'); HOLY(5);
            LOG('📜 You ask him to keep praying. He says he was going to anyway; it did not occur to him that it was the sort of thing a person could be asked for. He looks pleased that somebody wanted something from him. You leave him kneeling in the courtyard of an empty monastery, holding the first seal shut with his mouth, and not knowing it, which is either a mercy or the cruellest thing you have done in Vaelthar.', 'holy');
          } },
        { icon: '💬', label: '"What do you say, exactly? In the night hours."', type: 'talk',
          action: () => {
            SF('cael_recited_order');
            LOG('He tells you, without drama, because you asked. Every morning, every evening, and three times during the night hours — and always in the same order, which he cannot explain. "Brother Ilm taught me. His teacher taught him that way. Nobody ever said why the order mattered." He shrugs. "It\'s not a rule. It\'s just how you say it."', 'narrator');
            GO('cael_the_last_sayer');
          } },
        { icon: '🚶', label: 'Leave him to it', type: 'move',
          action: () => { LOG('You leave him in the courtyard. Behind you, at the correct hour, quietly, a frightened man says the thing he has said every day of his life, alone, to nobody, in a building the Church protects and will not explain.', 'narrator'); TRAVEL('vaelthar_city'); } },
      ];
      return {
        location: 'Monastery of Saint Aldric — The Courtyard',
        locationIcon: '🧎',
        threat: null,
        narration: `The house the file protects is empty, because an Elder needed somewhere to hide and signed a housing requisition, and seven men were escorted or carried out of it four days ago. One is left. Brother Cael is thirty-three, and he is in the courtyard, on his knees, and he has been there since it happened, and he is not catatonic — he is praying. Every morning. Every evening. Three times during the night hours. He never stopped, not in the root cellar with the sounds overhead, not since. He does not know that the Archive has a four-hundred-year-old open file whose entire operative purpose is to keep him alive and saying it. He thinks he is a frightened man who prays.`,
        sub: `The last warranted Sayer of the First Stone is a terrified monk who thinks he is just praying.`,
        options: opts,
      };
    },

  };

  if (typeof SCENES !== 'undefined') Object.assign(SCENES, S);
  if (typeof window !== 'undefined') { window.SCENES = window.SCENES || SCENES; Object.assign(window.SCENES, S); }
})();
