// Sanctum & Shadow — Chapter I extra scenes: tithe
// c1q12 The Demon's Tithe (Mol — Stone II) · c1q13 The Tower That Isn't There (Ashen Fields — Stone VII)
(function(){

  // Early-solver gate (Twist Bible §4, Reward #1): the player may say the name
  // to the man on the steps only if they arrived carrying it from elsewhere.
  function canNameHimEarly() {
    return !!(getFlag('clue_sel') && getFlag('clue_children_hymn')
      && (getFlag('clue_well_syllable') || getFlag('clue_hymnal_gloss')));
  }

  const S = {

    // ══════════════════════════════════════════
    //  QUEST 12: THE DEMON'S TITHE (c1q12)
    //  Mol — Stone II. The mechanism lives here.
    // ══════════════════════════════════════════

    mol_tithe_hook: () => {
      setFlag('tithe_quest_started');
      return {
        location: 'Mol — Collection Day',
        locationIcon: '🏘',
        threat: '⚠ Something Owed',
        narration: `It is collection day in Mol and nobody has to be told. The chest goes out at the crossroads before dawn — a good chest, iron-banded, better made than any house here — and by mid-morning it is full of coin from people who cannot spare it. Elder Berrick stands beside it the way a man stands beside a coffin. "Third generation," he says, before you ask. "My grandfather paid. My father paid. I pay." Behind him, a grandmother catches a child's wrist as the child leans toward the chest, and says, quite calmly, without any drama at all: "Quiet now, or Sel hears."`,
        sub: `A demon tithe, three generations deep. Nobody can name the demon. Nobody has stopped paying.`,
        options: [
          { icon: '💬', label: '"What is the demon\'s name?"', type: 'talk',
            action: () => runScene('berrick_forgotten_name') },
          { icon: '📜', label: 'Ask to see the ledger — three generations of payments leave paper', type: 'explore',
            action: () => runScene('mol_tithe_ledger') },
          { icon: '👁', label: 'Say nothing. Wait for whoever comes to collect it.', type: 'explore',
            roll: { stat: 'WIS', dc: 11 },
            onSuccess: () => { setFlag('tithe_collector_spotted'); addLog('📜 CLUE: You mark the collector two hours before he shows himself — he approaches from the Vaelthar road, unarmed, unescorted, and bored. Nobody guards this money. Nobody has needed to in four hundred years.', 'holy'); runScene('mol_tithe_collector'); },
            onFail: () => runScene('mol_tithe_collector') },
          { icon: '🔥', label: '"Then stop paying. Tonight. I\'ll stand here when it comes."', type: 'talk',
            action: () => {
              setFlag('offered_to_break_tithe');
              addLog('Berrick looks at you with something close to pity. "The last village that tried that was Ostrek. There is no Ostrek." He does not raise his voice. "You will forgive us for not experimenting."', 'narrator');
              runScene('berrick_forgotten_name');
            }},
        ]
      };
    },

    berrick_forgotten_name: () => {
      if (!getFlag('clue_sel')) {
        setFlag('clue_sel');
        addLog('📜 CLUE: Berrick swears the demon\'s name is unknowable and always has been. The grandmothers of Mol hush their children at dusk with it anyway: "quiet now, or Sel hears." They think it is a bogeyman.', 'holy');
      }
      return {
        location: 'Mol — Berrick\'s Doorstep',
        locationIcon: '🏘',
        narration: `"There is no name." Berrick says it the way men say things they were taught before they could argue. "That is the point of it. A thing with a name can be bargained with. This one cannot, so it has no name, so we pay." He believes every word. Behind him, through the open door, his mother is putting a child to bed, and you hear her do it: "Sleep now. Quiet now, or Sel hears." Berrick doesn't turn around. He has heard that sentence every night of his life and it has never once occurred to him that it is a name.`,
        sub: `The name nobody knows is the name every grandmother in Mol says out loud at bedtime.`,
        options: [
          { icon: '💬', label: '"Your mother just said it. Sel. That\'s a name."', type: 'talk',
            roll: { stat: 'CHA', dc: 12 },
            onSuccess: () => {
              setFlag('berrick_heard_it');
              addLog('Berrick opens his mouth. Closes it. "That\'s — that\'s just what you say to children." A pause that goes on too long. "That\'s just what you say."', 'narrator');
              runScene('mol_tithe_ledger');
            },
            onFail: () => { addLog('"That is a nursery word," he says, and the subject is closed the way a door is closed.', 'narrator'); runScene('mol_tithe_ledger'); } },
          { icon: '📜', label: '"Then show me the ledger. A nameless demon still gets paid by somebody."', type: 'explore',
            action: () => runScene('mol_tithe_ledger') },
          { icon: '👁', label: 'Leave it. Go wait at the chest for the collector.', type: 'move',
            action: () => runScene('mol_tithe_collector') },
        ]
      };
    },

    mol_tithe_ledger: () => ({
      location: 'Mol — The Parish Ledger',
      locationIcon: '📜',
      narration: `It is not a grimoire. It is a parish account book, and it is deeply boring, which is the first thing about this village that frightens you. Sixty-odd years of entries in three hands. Every page is ruled, dated, initialled. Every page has the payee's name struck through — not scratched out in terror, struck through the way a clerk strikes a line that has been superseded. Somebody has been maintaining this document correctly for longer than anyone in Mol has been alive.`,
      sub: `Three generations of a demon tithe, and it is filed like a tax return. Somebody is being paid.`,
      options: [
        { icon: '🔍', label: 'Go to the front. Whatever started this wrote it down.', type: 'explore',
          roll: { stat: 'INT', dc: 13 },
          onSuccess: () => runScene('mol_tithe_founding_page'),
          onFail: () => runScene('mol_tithe_ledger_wrong_page') },
        { icon: '🔍', label: 'Ignore the entries. Look for the year somebody didn\'t pay.', type: 'explore',
          roll: { stat: 'WIS', dc: 12 },
          onSuccess: () => {
            if (!getFlag('clue_skipped_year')) {
              setFlag('clue_skipped_year');
              addLog('📜 CLUE: One skipped year. Forty-one years ago — the bad harvest. The next entry is a fine, paid late. Sixty years of perfect compliance and exactly one gap.', 'holy');
            }
            runScene('mol_tithe_founding_page');
          },
          onFail: () => runScene('mol_tithe_ledger_wrong_page') },
        { icon: '💬', label: '"Who are all these struck-out names? Who did you pay?"', type: 'talk',
          action: () => {
            addLog('Berrick shrugs. "Men who died. You strike a dead man and write the next one under him. That\'s bookkeeping." He genuinely does not find this interesting.', 'narrator');
            runScene('mol_tithe_founding_page');
          }},
      ]
    }),

    mol_tithe_ledger_wrong_page: () => ({
      location: 'Mol — The Parish Ledger',
      locationIcon: '📜',
      narration: `You read for an hour and learn nothing, because there is nothing in the middle of this book but arithmetic. Coin in, coin out, a levy on a parish of four hundred souls, balanced to the copper. Whatever this village is afraid of, it does not appear anywhere in sixty years of its own paperwork. Then Berrick, watching you flounder, says the useful thing without knowing it is useful: "The old page is stitched in at the front. Nobody reads the front. It's just the warrant."`,
      sub: `Nobody reads the front. That is the whole history of this chapter in one sentence.`,
      options: [
        { icon: '📜', label: 'The front. Read the founding page.', type: 'explore',
          action: () => runScene('mol_tithe_founding_page') },
        { icon: '👁', label: 'Enough paper. Wait for the man who comes to take the chest.', type: 'move',
          action: () => runScene('mol_tithe_collector') },
      ]
    }),

    mol_tithe_founding_page: () => {
      if (!getFlag('clue_tithe_pays_sayers')) {
        setFlag('clue_tithe_pays_sayers');
        grantXP(120);
        addLog('📜 CLUE: The tithe is a payroll. "…for the stipend of the Sayer of the Second Stone, that the seven clauses be said at the seven stones on the day of the year…" Seven stones. Seven Sayers. A Charter that licenses them. The money buys a saying.', 'holy');
      }
      gameState.character?.inventory?.push('Mol Tithe Ledger — Founding Page');
      return {
        location: 'Mol — The Founding Page',
        locationIcon: '📜',
        narration: `The first page is stitched in, older than the rest, and it is the only page in the book with nothing struck through. It reads, in full: "Levy of the parish of Mol, for the stipend of the Sayer of the Second Stone, that the seven clauses be said at the seven stones on the day of the year, in the year of renewal and in every year thereafter, per the Charter." That is all. No demon. No tithe. No threat. A parish is paying a man's wages so that seven sentences get said out loud once a year, in seven places, and it has been doing so, without interruption, without anyone asking why, because nobody has cancelled a standing order in four hundred years.`,
        sub: `Not a demon tithe. A payroll. And Aldran, on that cart, called it a protection racket — to a congregation that was funding the seal under their own well.`,
        options: [
          { icon: '🔍', label: 'The skipped year. Find it and date it.', type: 'explore',
            roll: { stat: 'INT', dc: 11 },
            onSuccess: () => {
              if (!getFlag('clue_skipped_year')) {
                setFlag('clue_skipped_year');
                addLog('📜 CLUE: Forty-one years ago the collector did not come — the bad harvest year. One saying missed. The next entry is a fine, paid late. And forty years ago the well began to scream, and the Thornwood appeared on no map before that year, and has grown every decade since.', 'holy');
              }
              runScene('mol_tithe_stone');
            },
            onFail: () => { addLog('The years blur. You will have to ask someone who lived through them.', 'system'); runScene('mol_tithe_stone'); } },
          { icon: '💬', label: '"Berrick. What happened the year the collector didn\'t come?"', type: 'talk',
            action: () => {
              if (!getFlag('clue_skipped_year')) {
                setFlag('clue_skipped_year');
                addLog('📜 CLUE: Berrick was a boy. "Bad harvest. Nobody came for it. We thought we\'d been let off." He does not connect it to anything. The well started screaming the following year — and the Thornwood appeared on no map before that year.', 'holy');
              }
              addLog('Berrick: "Bad harvest, that year. Nobody came for the chest. We thought God had noticed us." He laughs, one note. "The year after that the well started."', 'narrator');
              runScene('mol_tithe_stone');
            }},
          { icon: '🗿', label: '"The Second Stone." Where is it? Take me there.', type: 'move',
            action: () => runScene('mol_tithe_stone') },
        ]
      };
    },

    mol_tithe_collector: () => ({
      location: 'Mol — The Crossroads',
      locationIcon: '🏘',
      threat: '⚠ Church Business',
      narration: `He arrives at noon on a bad mule: a Church clerk of perhaps twenty-five, ink on his fingers, no escort, no weapon, no ceremony. He counts the chest at the crossroads in front of everyone, writes a number, signs it, and gives Berrick a receipt. A receipt. When you ask him what the money is for he looks at you with the flat incomprehension of a man asked why water is wet. "It's the Mol levy," he says. "It's on the schedule."`,
      sub: `The most feared payment in the western reach has a receipt and a filing schedule.`,
      options: [
        { icon: '💬', label: '"On whose schedule? Who signs for this in Vaelthar?"', type: 'talk',
          roll: { stat: 'CHA', dc: 12 },
          onSuccess: () => {
            setFlag('tithe_traced_to_archive');
            addLog('📜 CLUE: The Mol levy is disbursed by the Archive, not the Treasury — a standing warrant, perpetual, pre-dating every clerk in the building. He has never met the payee. He has never wondered.', 'holy');
            runScene('mol_tithe_founding_page');
          },
          onFail: () => { addLog('"The schedule," he repeats, slower, as though you are the slow one. "It has always been on the schedule."', 'narrator'); runScene('mol_tithe_founding_page'); } },
        { icon: '📜', label: 'Take his receipt book while he\'s counting', type: 'explore',
          roll: { stat: 'DEX', dc: 13 },
          onSuccess: () => { addLog('📜 ITEM GAINED: Collector\'s Receipt Book — sixty years of counterfoils, every one signed off against a warrant number nobody in this village has ever seen.', 'holy'); gameState.character?.inventory?.push('Collector\'s Receipt Book'); runScene('mol_tithe_ledger'); },
          onFail: () => { addLog('He catches your wrist without any surprise at all. "Everyone tries that once," he says, and goes back to counting.', 'narrator'); runScene('mol_tithe_ledger'); } },
        { icon: '⚔', label: 'The money doesn\'t leave Mol. Stop him.', type: 'combat',
          action: () => {
            setFlag('tithe_collector_attacked');
            addLog('⚔ Two Church agents come off the Vaelthar road at a dead run. Not guarding the money — guarding the schedule.', 'combat');
            startCombat([generateEnemy('church_agent', 3), generateEnemy('church_agent', 3)], { victoryScene:'mol_tithe_ledger' });
          }},
        { icon: '📜', label: 'Let him go. Go read the front of the ledger instead.', type: 'move',
          action: () => runScene('mol_tithe_ledger') },
      ]
    }),

    mol_tithe_stone: () => {
      if (!getFlag('found_second_stone')) {
        setFlag('found_second_stone');
        grantHolyPoints(10);
        grantXP(180);
        addLog('📜 REVELATION: Stone II stands in the field behind Mol\'s well. The tithe is not paid to a demon. It is paid so that a man will stand at this stone once a year and say seven clauses aloud. Skip the payment, skip the saying. Skip the saying, and the ground remembers.', 'holy');
      }
      return {
        location: 'Mol — The Field Behind the Well',
        locationIcon: '🗿',
        threat: '⚠ Stone II',
        narration: `It is thirty paces behind the well and every child in Mol has climbed it: a squat pre-Flame marker, waist-high, with a plain cross cut into the weather side and grooves worn smooth by four hundred years of small hands. Nobody guards it. Nobody has needed to. Grass has been kept short around its base — not by anyone's decision, just by the fact that a village walks past a thing every day for four centuries. And under it, faintly, through your boots, you can feel the well doing what it does at this hour, which is trying to finish a word.`,
        sub: `Stone II. The tithe pays a man to stand here and speak. This year, nobody has.`,
        options: [
          { icon: '🔍', label: 'The cross on the stone — how old is that cut?', type: 'explore',
            roll: { stat: 'INT', dc: 12 },
            onSuccess: () => {
              setFlag('clue_stone_two_cross');
              addLog('📜 CLUE: The cross is original to the stone and older than the Eternal Flame. It was not added. Everything else in this realm was added to it.', 'holy');
              runScene('mol_tithe_stone');
            },
            onFail: () => { addLog('Old. Older than the Church, you\'d guess, but a guess is not evidence.', 'system'); runScene('mol_tithe_stone'); } },
          { icon: '💬', label: '"Berrick. Who was the last man paid to stand here?"', type: 'talk',
            action: () => {
              addLog('Berrick thinks. "Old Perrin? He did something at the stone. Once a year. Took a coin for it." A shrug. "He died in the spring. Nobody\'s taken it on. It\'s not really a job, is it — standing in a field talking."', 'narrator');
              setFlag('knows_sayer_two_dead');
              runScene('mol_tithe_stone');
            }},
          { icon: '🗺', label: 'Take the founding page and go. Somebody in Vaelthar needs to read this.', type: 'move',
            action: () => { if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
        ]
      };
    },

    // ══════════════════════════════════════════
    //  QUEST 13: THE TOWER THAT ISN'T THERE (c1q13)
    //  Ashen Fields — Stone VII. He is a person.
    // ══════════════════════════════════════════

    ashen_fields_dreamers: () => {
      setFlag('tower_quest_started');
      return {
        location: 'The Ashen Fields — The Wanderer\'s Fire',
        locationIcon: '🌑',
        threat: '⚠ Nothing Grows Here',
        narration: `Three people are sitting at a fire that has no fuel and gives no heat: the scholar who has been camped here three weeks, a wool factor from the Merchant Road who stopped one night and has not left, and a girl of about sixteen driving her uncle's cattle south. They have not met before this week. They have nothing in common. They are all having the same dream, and they have stopped pretending otherwise, and they are frightened in the specific way of people whose private madness has just been corroborated by strangers.`,
        sub: `Three strangers. One dream. The tower is on the king's map and nobody has ever seen it.`,
        options: [
          { icon: '💬', label: 'Separate them. Take each account alone, in detail.', type: 'talk',
            roll: { stat: 'WIS', dc: 13 },
            onSuccess: () => runScene('tower_dream_transcript'),
            onFail: () => { addLog('They talk over each other and contaminate each other and by the end you have one story told three times, which proves nothing. You will have to sleep here yourself.', 'system'); runScene('tower_dream_walk'); } },
          { icon: '🗺', label: 'The king\'s map. Lay it against the seven markers.', type: 'explore',
            action: () => runScene('tower_map_overlay') },
          { icon: '🌑', label: 'Make camp in the Fields. See it yourself.', type: 'move',
            action: () => runScene('tower_dream_walk') },
          { icon: '💬', label: '"Scholar. Three weeks. Why are you still here?"', type: 'talk',
            action: () => {
              addLog('The scholar does not look away from the blue flames. "Because it isn\'t a nightmare," he says. "That\'s what nobody understands. He\'s polite. He asks his question and he waits and he can\'t hear me answer, and I come back every night to answer him anyway." He finally looks up. "Three weeks. I\'d like it to work once."', 'narrator');
              runScene('tower_dream_transcript');
            }},
        ]
      };
    },

    tower_dream_transcript: () => {
      if (!getFlag('clue_third_day_question')) {
        setFlag('clue_third_day_question');
        grantXP(120);
        addLog('📜 CLUE: Three independent dreamers, separated, match to the detail. Thirty-seven steps. No door. Ash falling upward. And a man of about fifty on the thirty-seventh step, who is not frightening, who is waiting, and who asks the same question every night, politely: "Has it been three days yet?"', 'holy');
      }
      return {
        location: 'The Ashen Fields — Three Accounts',
        locationIcon: '🌑',
        narration: `You take them apart and they hold. Thirty-seven steps — the factor counted them twice because he is a man who counts things. No door: not a locked door, no door, a wall where a door should be. Ash falling upward, which all three describe apologetically, as though it is their fault it makes no sense. And on the thirty-seventh step, a man. Middle-aged. Tired. Sitting the way you sit when sitting is the only thing left. He is not frightening. The girl says it plainest, and then cries, which surprises her: "He asks it nicely. Every night. Like he doesn't want to be a bother."`,
        sub: `"Has it been three days yet?" — asked politely, every night, for four hundred years.`,
        options: [
          { icon: '🗺', label: 'Three dreamers agree. Now check the map against the markers.', type: 'explore',
            action: () => runScene('tower_map_overlay') },
          { icon: '💬', label: '"Three days since what? Did any of you ask him?"', type: 'talk',
            action: () => {
              addLog('The girl says: "I did. Every night. He can\'t hear me." She wipes her face, angry about it. "He\'s not haunting us. He\'s waiting for somebody to come back and tell him, and we\'re not the somebody, and he doesn\'t know that."', 'narrator');
              runScene('tower_dream_walk');
            }},
          { icon: '🌑', label: 'Sleep in the Fields tonight. Ask him yourself.', type: 'move',
            action: () => runScene('tower_dream_walk') },
        ]
      };
    },

    tower_map_overlay: () => {
      if (!getFlag('clue_seven_stones_mapped')) {
        setFlag('clue_seven_stones_mapped');
        grantXP(100);
        addLog('📜 CLUE: Overlay the king\'s map on the seven pre-Flame markers. Same seven points. I — the monastery chamber. II — Mol\'s well. III — the Treasury vault. IV — Fortress Harren. V — the Forge. VI — Archive Level Four. Point seven is the Tower, and it is the only one you have never stood in.', 'holy');
      }
      return {
        location: 'The Ashen Fields — The King\'s Map',
        locationIcon: '🗺',
        narration: `The king's survey is a serious document made by serious men and it puts a tower in the Ashen Fields at a grid reference where four hundred years of travellers have reported grey dirt. Lay the seven old markers over it and the argument ends. Six of the seven points are places you have personally stood — a chamber under a monastery, a well behind a village, a vault nobody opened, a fortress, a forge, a room four levels beneath the Archive. You have been walking a circuit for weeks without knowing it was a circuit. The seventh point is here, and there is nothing here, and the map is not wrong.`,
        sub: `Seven points. You have stood in six. The seventh is the only marker still intact — it is inside its own seal.`,
        options: [
          { icon: '🔍', label: 'Why can you see six and not the seventh?', type: 'explore',
            roll: { stat: 'INT', dc: 14 },
            onSuccess: () => {
              setFlag('clue_stone_seven_intact');
              addLog('📜 CLUE: The six you have stood in are all cracked, worn, leaking. The seventh is not — it is the only marker still whole. You cannot see the Tower because the Tower is inside a seal that has not failed. It appears in dreams because a sealed place still has to exist somewhere.', 'holy');
              runScene('tower_dream_walk');
            },
            onFail: () => { addLog('You have no theory. You have a map and an empty field and a headache.', 'system'); runScene('tower_dream_walk'); } },
          { icon: '🔍', label: 'The ash. Where is it falling from?', type: 'explore',
            roll: { stat: 'WIS', dc: 12 },
            onSuccess: () => {
              setFlag('clue_ash_goes_in');
              addLog('📜 CLUE: You stand still for an hour and watch. The Ashen Fields are not ash from the Tower. The ash is going into it. Four hundred years of it, drifting toward a grid reference where there is nothing, and arriving.', 'holy');
              runScene('tower_dream_walk');
            },
            onFail: () => runScene('tower_dream_walk') },
          { icon: '🌑', label: 'Enough surveying. Sleep here.', type: 'move',
            action: () => runScene('tower_dream_walk') },
        ]
      };
    },

    tower_dream_walk: () => {
      setFlag('dreamed_of_tower');
      const opts = [
        { icon: '💬', label: '"Yes. It\'s been three days." — lie to him', type: 'talk',
          action: () => {
            setFlag('lied_to_the_man');
            addLog('He lifts his head. For one moment his face does something you will think about for the rest of your life. Then it fades, because he cannot hear you, and he has never been able to hear anyone, and the question begins again from the start.', 'narrator');
            runScene('ashen_fields_survey');
          }},
        { icon: '🔍', label: 'Count the steps. Look at the walls. Take the room apart.', type: 'explore',
          roll: { stat: 'INT', dc: 13 },
          onSuccess: () => {
            setFlag('clue_tower_interior');
            addLog('📜 CLUE: Thirty-seven steps, and they end at nothing — no landing, no door, a wall. The stair was built to go somewhere and the somewhere was removed. He is not imprisoned at the top of the tower. He is sitting on the last step of a staircase that no longer arrives.', 'holy');
            runScene('ashen_fields_survey');
          },
          onFail: () => runScene('ashen_fields_survey') },
        { icon: '🌅', label: 'Wake up. Walk to the grid reference in daylight.', type: 'move',
          action: () => runScene('ashen_fields_survey') },
      ];
      if (canNameHimEarly()) {
        opts.unshift({ icon: '🗣', label: 'Say his name to the man on the steps: "Sel."', type: 'talk',
          action: () => runScene('tower_dream_answer') });
      }
      return {
        location: 'The Ashen Fields — The Dream',
        locationIcon: '🌑',
        threat: '⚠ You Are Asleep',
        narration: `You sleep in grey dirt and you are somewhere else immediately, without transition, the way dreams do not actually work. A stair. You count without deciding to: thirty-seven steps. Ash falls upward past you in a slow grey drift, going somewhere, arriving. There is no door anywhere. And on the thirty-seventh step a man sits with his forearms on his knees — fifty or so, ordinary, the sort of face you would not look at twice in a market. He sees you. He straightens a little, apologetic, a man who does not want to impose. "Has it been three days yet?" he asks. And then he waits, and you can see him listening, and you can see that whatever you say does not reach him, and after a while he asks again, just as politely, as though for the first time.`,
        sub: `Not a monster. Not a voice. A tired man, asking one question, who cannot hear the answer.`,
        options: opts,
      };
    },

    tower_dream_answer: () => {
      if (!getFlag('knows_the_name_early')) {
        setFlag('knows_the_name_early');
        setFlag('ashen_fields_investigated');
        grantHolyPoints(10);
        grantXP(200);
        addLog('🌟 You said a name to a person instead of an address to an office. Nothing supernatural happened. It did not need to. +10 Holy Points. The Tower is on your map.', 'holy');
        addLog('📜 The party stops dreaming of a tower. From tonight they dream of a man.', 'holy');
      }
      if (window.unlockLocationsByProgress) window.unlockLocationsByProgress();
      return {
        location: 'The Ashen Fields — The Dream',
        locationIcon: '🌑',
        narration: `"Sel."\n\nNothing happens. No light, no thunder, no shift in the air — you are asleep in a field of grey dirt and one syllable does not change the world. But you are both asleep, and a dream is the one room he has left, and for the first time in four hundred years somebody has addressed a person and not an office. His head comes up. Not the polite lift. Something else. He looks at you the way a man looks up in a dark house when he thought he was alone in it.\n\n"…Who's there?"\n\nAnd you wake, in the ash, in the cold, with your heart going like a hammer and the taste of somebody else's grief in your mouth.`,
        sub: `He heard you. Four hundred years and nobody had tried his name.`,
        options: [
          { icon: '🗼', label: 'Get up. Now. The Tower is on the map and you know where.', type: 'move',
            action: () => runScene('tower_of_ash_found') },
          { icon: '💬', label: 'Wake the scholar. Tell him it worked.', type: 'talk',
            action: () => {
              addLog('The scholar listens without interrupting, which is not like him. At the end he says, very quietly: "Three weeks I answered his question. Three weeks. It never once occurred to me to ask his name." He puts his head in his hands. "I\'m a scholar."', 'narrator');
              runScene('tower_of_ash_found');
            }},
          { icon: '🌑', label: 'Say nothing to anyone. Walk to the grid reference.', type: 'move',
            action: () => runScene('ashen_fields_survey') },
        ]
      };
    },

    ashen_fields_survey: () => ({
      location: 'The Ashen Fields — The Grid Reference',
      locationIcon: '🌑',
      threat: '☠ DANGEROUS',
      narration: `Daylight, such as it is. You walk to the point the king's surveyors marked and there is nothing there, and you keep walking, and there is still nothing there, and the nothing has a quality to it — like a held breath, like a room on the other side of a wall you cannot find the door to. The blue flames burn along the ground without heat. And the ash, when you finally stand still long enough to watch it, is not falling. It is going somewhere. Something comes out of the drift toward you that has been waiting a long time for someone to stand still.`,
      sub: `The tower is here. You are standing in it and you cannot see it.`,
      options: [
        { icon: '🔍', label: 'Follow the ash. It is going somewhere — go where it goes.', type: 'explore',
          roll: { stat: 'WIS', dc: 13 },
          onSuccess: () => { addLog('📜 You stop trying to find a tower and start following four hundred years of ash. It takes you eleven paces and then you are looking at a wall that was always there.', 'holy'); runScene('tower_of_ash_found'); },
          onFail: () => { addLog('The drift breaks apart in your hands and the wraiths take the opportunity.', 'combat'); startCombat([generateEnemy('shadow_wraith', 4), generateEnemy('shadow_wraith', 4)], { victoryScene:'tower_of_ash_found' }); } },
        { icon: '⚔', label: 'Deal with what\'s coming out of the ash first', type: 'combat',
          action: () => startCombat([generateEnemy('shadow_wraith', 4), generateEnemy('shadow_wraith', 4), generateEnemy('skeleton', 3)], { victoryScene:'tower_of_ash_found' }) },
        { icon: '🗺', label: 'Use the seven-marker overlay — trust the old survey over your eyes', type: 'explore',
          action: () => {
            if (getFlag('clue_seven_stones_mapped') || getFlag('clue_stone_seven_intact') || getFlag('knows_the_name_early')) {
              addLog('📜 You stop looking for a tower and start standing where the seventh marker says a tower is. Your eyes lose the argument.', 'holy');
              runScene('tower_of_ash_found');
            } else {
              addLog('You have no overlay to use. You are wandering a grey field with a map you have not checked against anything.', 'system');
              startCombat([generateEnemy('shadow_wraith', 4)], { victoryScene:'ashen_fields_survey' });
            }
          }},
      ]
    }),

    tower_of_ash_found: () => {
      if (!getFlag('found_tower_of_ash')) {
        setFlag('found_tower_of_ash');
        setFlag('ashen_fields_investigated');
        setFlag('found_seventh_stone');
        grantXP(320);
        grantHolyPoints(5);
        addLog('🗼 The Tower of Ash is real, it is here, and it is on your map. Stone VII is the only marker in the realm still whole — which is why nobody has ever seen it. It is inside its own seal.', 'holy');
      }
      if (window.unlockLocationsByProgress) window.unlockLocationsByProgress();
      return {
        location: 'The Tower of Ash — The Door With No Door',
        locationIcon: '🗼',
        threat: '☠ Stone VII',
        narration: `It is exactly as the maps show, and the maps are four hundred years old, and the stones look freshly cut — because nothing has touched them in three hundred and ninety-three years. The door at the base has no handle and no lock, which the dreamers all reported and none of them believed. Ash arrives here. It has been arriving here your whole life and your father's whole life. And somewhere above you, on the thirty-seventh step of a staircase that no longer goes anywhere, a man of about fifty is being patient about it.`,
        sub: `Stone VII, intact. The last seal that hasn't failed — with a person inside it.`,
        options: [
          { icon: '🔍', label: 'The symbol on the door — read it', type: 'explore',
            roll: { stat: 'INT', dc: 14 },
            onSuccess: () => {
              setFlag('clue_tower_door_mark');
              addLog('📜 CLUE: It is not a ward and it is not a warning. It is a cross, with the crossbar drawn out into a torch — the same overdrawing as the children\'s palms, half-finished, the tracing still visible. Somebody traced over this door and gave up partway.', 'holy');
              runScene('tower_of_ash_found');
            },
            onFail: () => { addLog('Blood, or something that was blood. Old. You can feel the shape is familiar and you cannot say from where.', 'system'); runScene('tower_of_ash_found'); } },
          { icon: '✊', label: 'Knock. There is a man in there.', type: 'talk',
            action: () => {
              setFlag('knocked_on_the_tower');
              addLog('You knock. It is an absurd thing to do and you do it anyway. Nothing answers — but the ash, for about two seconds, stops moving. Then it resumes. Something in there heard a person be polite to it and did not know what to do.', 'narrator');
              runScene('tower_of_ash_found');
            }},
          { icon: '🗺', label: 'Leave it sealed. You are not ready — and you know it.', type: 'move',
            action: () => { addLog('You walk out of the Ashen Fields with a location, a question, and no idea yet that the question is the point. The Tower will keep. It has kept for four centuries.', 'system'); if (window.travelToLocation) travelToLocation(WORLD_LOCATIONS['vaelthar_city']); } },
        ]
      };
    },

  };

  if (typeof SCENES !== 'undefined') Object.assign(SCENES, S);
  if (typeof window !== 'undefined') { window.SCENES = window.SCENES || SCENES; Object.assign(window.SCENES, S); }
})();
