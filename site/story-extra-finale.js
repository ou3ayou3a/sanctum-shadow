// Sanctum & Shadow — Chapter I extra scenes: finale
// c1q18 The Voice Beneath the Archive (Church Archive — Stone VI)
// c1q19 The Covenant's Author (The Chancery — page one)
// c1q20 The Shattered God (The Tower of Ash — Stone VII)
//
// Twist Bible compliance notes for future editors:
//  · The Voice Beneath the Archive is SELVANE reaching — NOT the Voice Below (c1q2).
//  · The Voice must NEVER say "Jesus Christ." Not once. Not ever.
//  · Ending 3 step one is not magic. Write it flat. It has no power; it has the fact
//    that nobody has said it in four hundred years.
(function(){

  // ── DEDUCTION GATES (Twist Bible §4 — redundancy guarantee) ───────────────
  // The name is reachable from any TWO of the four sources. A player who skipped
  // two side quests still solves it. Nothing here may depend on a pq_* flag.
  function knowsTheName() {
    if (getFlag('knows_the_name_early') || getFlag('solved_early') || getFlag('told_the_voice')) return true;
    var sources = ['clue_hymnal_gloss', 'clue_sel', 'clue_well_syllable', 'clue_voice_cannot_say_own_name'];
    var count = 0;
    for (var i = 0; i < sources.length; i++) if (getFlag(sources[i])) count++;
    return count >= 2;
  }
  // Line seven of the Old Benediction: from Eron in the tavern (hour one) or from
  // the Chancery Rubric (c1q19). Either is sufficient. Both is the same sentence.
  function hasLineSeven() {
    return !!(getFlag('clue_eron_inscription') || getFlag('clue_rubric_seventh_clause_spoken'));
  }
  // Ending 2 needs the six petitions AND line seven AND, later, an officer.
  function canReadTheCharter() {
    return !!(getFlag('clue_old_benediction_six_lines') && hasLineSeven());
  }
  function caelAlive() {
    return !getFlag('npc_dead_last_monk') && !getFlag('npc_dead_brother_cael');
  }
  function theonesAlive() {
    return !getFlag('npc_dead_head_archivist_theones') && !getFlag('npc_dead_theones');
  }
  function varekReachable() {
    return getFlag('chapter1_finale') && !getFlag('npc_dead_elder_varek');
  }

  // Shipped assets, unedited: data.js:304 (500 HP, AC 20, xp 2000, boss),
  // combat.js:236 (flee:false, the four boss spells). The Forge blade
  // (data.js:236 — "capable of killing what cannot otherwise die") un-names it,
  // which is exactly why the fight becomes survivable. It does not become kind.
  function shatteredGodBoss() {
    var boss = Object.assign({}, generateEnemy('shattered_god', 10), {
      id: 'shattered_god', hp: 500, maxHp: 500, ac: 20, xp: 2000, boss: true,
    });
    if (getFlag('has_unnaming_blade')) {
      boss.hp = 280; boss.maxHp = 280;
      addLog('🗡 The blade knows what it was made of. Every stroke takes a face off him and does not give it back. He is easier to kill because you brought the right tool. Sit with that.', 'combat');
    }
    return boss;
  }

  function openTheTower() {
    setFlag('unlocked_tower_ash');
    setFlag('tower_opened');
    try {
      if (typeof WORLD_LOCATIONS !== 'undefined' && WORLD_LOCATIONS.tower_ash) {
        WORLD_LOCATIONS.tower_ash.locked = false;
        WORLD_LOCATIONS.tower_ash.discovered = true;
      }
      if (typeof WORLD_LOCATIONS !== 'undefined' && WORLD_LOCATIONS.ashen_fields) {
        WORLD_LOCATIONS.ashen_fields.discovered = true;
      }
    } catch (e) { /* never let a map touch break a scene */ }
    if (window.unlockLocationsByProgress) window.unlockLocationsByProgress();
  }

  function goTo(id) {
    if (window.travelToLocation && typeof WORLD_LOCATIONS !== 'undefined' && WORLD_LOCATIONS[id]) {
      travelToLocation(WORLD_LOCATIONS[id]);
    }
  }

  const S = {

    // ══════════════════════════════════════════════════════════════════
    //  QUEST 18: THE VOICE BENEATH THE ARCHIVE (c1q18)
    //  Church Archive, below Level Four — Stone VI.
    //  It knows your names. All of them. It does not know its own.
    // ══════════════════════════════════════════════════════════════════

    archive_lowest_level: () => {
      setFlag('archive_voice_quest_started');
      return {
        location: 'Church Archive — Below Level Four',
        locationIcon: '📜',
        threat: '⚠ Not On Any Plan',
        narration: `Level Four is the bottom of the Archive on every plan the Church has drawn since Flame Year 12. Level Four also has a seam in its floor, three feet by three, cut clean, and the stone around the seam has been polished by four centuries of boots belonging to men who came down here specifically not to open it. There is a ring set into it. The ring is worn. Nobody wears a ring by not pulling it.\n\nUnderneath: a stair, going down, into air that is measurably colder than the rock it is cut through.`,
        sub: `There is a stair below the bottom of the Archive, and somebody has been keeping it swept.`,
        options: [
          { icon: '🔍', label: 'Read the floor before you open it — who has been down here?', type: 'explore',
            roll: { stat: 'INT', dc: 13 },
            onSuccess: () => {
              setFlag('archive_stair_read');
              addLog('📜 CLUE: The wear is all on the OUTSIDE of the seam. Nobody goes down. They come down to Level Four, stand beside the hatch, and go back up. Generations of archivists have made a pilgrimage to a closed door and called it filing.', 'holy');
              grantXP(60);
              runScene('archive_voice_names');
            },
            onFail: () => { addLog('Dust and boot-polish and four hundred years. You can tell it is used. You cannot tell how.', 'system'); runScene('archive_voice_names'); } },
          { icon: '✝', label: 'Pray before you open it. You do not know what is down there.', type: 'explore',
            roll: { stat: 'WIS', dc: 12 },
            onSuccess: () => {
              grantHolyPoints(5);
              addLog('☩ The stillness comes and it comes easily, here, at the bottom of the building where they buried it. Whatever is under this floor, it is not what you just prayed to. +5 Holy Points.', 'holy');
              runScene('archive_voice_names');
            },
            onFail: () => { addLog('The words go out of you and the cold takes them and gives nothing back. Not refusal. Just cold.', 'system'); runScene('archive_voice_names'); } },
          { icon: '🕳', label: 'Pull the ring. Go down.', type: 'move',
            action: () => runScene('archive_voice_names') },
          { icon: '🚪', label: 'Close it. Some doors are shut for a reason.', type: 'move',
            action: () => { addLog('You lower the hatch and the seam disappears into the floor as if it had never been cut. You will come back. Everyone comes back. That is what the polish on the stone is.', 'system'); } },
        ]
      };
    },

    archive_voice_names: () => {
      setFlag('heard_the_archive_voice');
      return {
        location: 'Church Archive — The Space Under The Foundation',
        locationIcon: '🕳',
        threat: '☠ Stone VI',
        narration: `It is not a chamber. It is the gap left over between the Archive's foundation and the thing the foundation was poured around and never removed: a squat pre-Flame marker, waist-high, plain, a cross cut into its weather side. They built the deepest secret in the world on top of it, and then they stopped coming down, which is the most honest thing the Church has ever done.\n\nThere is nothing in the dark. There is only the addressing.\n\nIt says your name. Then it says the name you use where nobody knows you. Then it says the name your mother wrote down and crossed out in the third month and never told anyone, including you. Then it says a name off a headstone in a village you have never visited, and it is right, and it is yours, and you have no idea how it could be.`,
        sub: `It has every name you have ever had, and two you did not know you had.`,
        options: (function(){
          var opts = [
            { icon: '💬', label: '"Enough. You know every name in the world. What is yours?"', type: 'talk',
              action: () => runScene('archive_voice_asks_name') },
            { icon: '✝', label: 'Ask it about Jesus Christ', type: 'talk',
              action: () => runScene('archive_voice_the_name') },
            { icon: '🕯', label: 'Say nothing. Let it finish the list.', type: 'explore',
              roll: { stat: 'WIS', dc: 14 },
              onSuccess: () => {
                setFlag('let_the_voice_finish');
                grantXP(80);
                addLog('📜 CLUE: It is not threatening you. It is not showing off. It is going through them one at a time, carefully, the way a man goes through a drawer looking for a thing he is certain he put there. It is checking.', 'holy');
                runScene('archive_voice_asks_name');
              },
              onFail: () => { addLog('You last about ninety seconds. Then the fourth name arrives — the one off the headstone — and your nerve goes.', 'system'); runScene('archive_voice_asks_name'); } },
          ];
          if (getFlag('solved_early') || getFlag('knows_the_name_early')) {
            opts.push({ icon: '🗣', label: 'Tell it its name.', type: 'talk',
              action: () => runScene('archive_voice_told_name') });
          }
          opts.push({ icon: '🚪', label: 'Get out. Now. Up the stair.', type: 'move',
            action: () => {
              addLog('You get four steps up before it says the headstone name again, conversationally, the way you would say "you forgot your hat." You stop. Everybody stops. It has had four hundred years to work out how to keep somebody in a room.', 'narrator');
              runScene('archive_voice_asks_name');
            }});
          return opts;
        })(),
      };
    },

    // PRIMARY CLUE — c1q18. Same failure, same syllable, same place as the well.
    archive_voice_asks_name: () => {
      if (!getFlag('clue_voice_cannot_say_own_name')) {
        setFlag('clue_voice_cannot_say_own_name');
        grantXP(200);
        grantHolyPoints(5);
        addLog('📜 CLUE: It holds every name that has ever been given and cannot produce its own. A name is not forgotten like that. A name is REMOVED like that. And a thing that has a name to lose is a person.', 'holy');
      }
      return {
        location: 'Church Archive — The Space Under The Foundation',
        locationIcon: '🕳',
        threat: '☠ Stone VI',
        narration: `The list stops. That is worse than the list.\n\n"I know every name that was ever given," it says. "I was given one. I cannot find it. It is the only one that isn't here."\n\nYou ask it again, directly. What is your name.\n\nAnd it tries. You can hear it try — a thing that has never once struggled with a word in your presence, that produced a name your mother buried in her own head, working at the front of one syllable like a man with his shoulder against a door that opens the other way.\n\n"S—"\n\nAnd it stops. And the stop is the loudest thing in the building.`,
        sub: `"S—". It cannot get past the first letter of itself.`,
        options: (function(){
          var opts = [];
          if (getFlag('clue_well_syllable')) {
            opts.push({ icon: '🔍', label: 'You have heard that exact failure before. In a well. In Mol.', type: 'explore',
              roll: { stat: 'INT', dc: 12 },
              onSuccess: () => {
                setFlag('voice_matches_well');
                grantXP(120);
                addLog('📜 DEDUCTION: Same syllable. Same failure. Same place in the word. The thing under the Archive and the thing under Mol\'s well are not two things being similar. They are one thing, reaching, at two of the seven stones — and the one in the city is reaching through the thinner floor.', 'holy');
                runScene('archive_voice_asks_name');
              },
              onFail: () => { addLog('It nags at you the way a tune does. You have heard this. You cannot place where.', 'system'); runScene('archive_voice_asks_name'); } });
          }
          if (!getFlag('clue_name_cannot_be_held')) {
            opts.push({ icon: '✝', label: 'Ask it about Jesus Christ', type: 'talk',
              action: () => runScene('archive_voice_the_name') });
          }
          if (knowsTheName() && !getFlag('told_the_voice')) {
            opts.push({ icon: '🗣', label: 'Tell it its name.', type: 'talk',
              action: () => runScene('archive_voice_told_name') });
          }
          opts.push({ icon: '💬', label: '"Who took it from you?"', type: 'talk',
            action: () => {
              addLog('A long pause. Then, and this is the part you will carry: "I don\'t know. I would have given it to them. They only had to ask. They asked me for everything else."', 'narrator');
              grantXP(50);
              runScene('archive_voice_asks_name');
            }});
          opts.push({ icon: '🚪', label: 'Climb out. You have what you came for and you wish you did not.', type: 'move',
            action: () => runScene('archive_voice_ascent') });
          return opts;
        })(),
      };
    },

    // CORROBORATOR — c1q18. The Voice never speaks the Name. The PLAYER speaks it.
    archive_voice_the_name: () => {
      if (!getFlag('clue_name_cannot_be_held')) {
        setFlag('clue_name_cannot_be_held');
        grantHolyPoints(10);
        grantXP(150);
        addLog('☩ CLUE: It collects every name in the world and there are exactly two it does not have. Its own, which was taken. And one that cannot be taken, because it will not be held. +10 Holy Points.', 'holy');
      }
      return {
        location: 'Church Archive — The Space Under The Foundation',
        locationIcon: '🕳',
        narration: `You say it yourself, because you want to hear what happens: Jesus Christ.\n\nAnd the stillness comes. Not loudly. It does not push the dark back and it does not light anything and nothing in the room moves. It simply is, the way the floor is, and you notice that for a moment you have stopped bracing.\n\nThe thing in the dark waits until it has passed. Then, and it is choosing its words, which it has not done once tonight:\n\n"There is one name I cannot hold. Not because it was taken." A pause you could park a cart in. "Because it will not be held."\n\nAnd then, quieter, and it is not asking you: "I used to think that was the same thing."`,
        sub: `Two names missing from a collection of every name. One stolen. One that cannot be owned.`,
        options: (function(){
          var opts = [];
          if (!getFlag('clue_voice_cannot_say_own_name')) {
            opts.push({ icon: '💬', label: '"Then what is YOUR name?"', type: 'talk',
              action: () => runScene('archive_voice_asks_name') });
          }
          if (knowsTheName() && !getFlag('told_the_voice')) {
            opts.push({ icon: '🗣', label: 'Tell it its name.', type: 'talk',
              action: () => runScene('archive_voice_told_name') });
          }
          // The chapter's most important piece of bookkeeping: this is NOT the
          // Voice Below (c1q2). Give the player a way to establish that in-world.
          opts.push({ icon: '🔍', label: '"Are you the thing under the monastery? The one that talks about pieces?"', type: 'explore',
            roll: { stat: 'WIS', dc: 13 },
            onSuccess: () => {
              setFlag('voice_is_not_the_voice_below');
              grantXP(120);
              addLog('📜 CLUE: "That is a piece of me," it says. "The smallest one. It never found anybody to live in, so it stayed where they cut it." A pause. "Six of them found people. It talks about us in the third person now. It has been alone longer than I have and it is younger than I am, which I do not think it has worked out." — Six carriers, one fragment left in the monastery chamber. That is seven. All seven are accounted for. This is not an eighth thing. This is what the seven were taken OUT of.', 'holy');
              runScene('archive_voice_the_name');
            },
            onFail: () => { addLog('"No," it says, and there is something almost offended in it, and you are not equipped to follow up.', 'system'); runScene('archive_voice_the_name'); } });
          opts.push({ icon: '💬', label: '"You know what the Church built on top of you. Say it."', type: 'talk',
            roll: { stat: 'CHA', dc: 14 },
            onSuccess: () => {
              setFlag('voice_named_the_church');
              grantXP(100);
              addLog('📜 It says: "They put a floor over me and a filing system on the floor. Four hundred years of clerks have stood on my head and been very careful with the paperwork." A beat. "I do not blame the clerks. Clerks are not the ones who decide."', 'narrator');
              runScene('archive_voice_the_name');
            },
            onFail: () => { addLog('It does not answer. It goes back to the list. Your name again, from the top.', 'system'); runScene('archive_voice_the_name'); } });
          opts.push({ icon: '🚪', label: 'Climb out.', type: 'move',
            action: () => runScene('archive_voice_ascent') });
          return opts;
        })(),
      };
    },

    // EARLY-SOLVER REWARD #3 (Twist Bible §4). The option the chapter is built toward.
    archive_voice_told_name: () => {
      if (!getFlag('told_the_voice')) {
        setFlag('told_the_voice');
        setFlag('clue_voice_cannot_say_own_name');
        grantHolyPoints(20);
        grantXP(300);
        openTheTower();
        addLog('🌟 You gave a dead man back the only thing of his that nobody could use. +20 Holy Points.', 'holy');
        addLog('🗼 The Archive floor has cracked from Level Four to the bedrock, and the Tower of Ash is on your map. That is how it opens. Somebody said his name and the seal had nothing left to hold.', 'holy');
      }
      return {
        location: 'Church Archive — The Space Under The Foundation',
        locationIcon: '🕳',
        narration: `"Selvane."\n\nNothing happens for long enough that you think you have made a fool of yourself in front of a hole.\n\nThen: "S—" — the same door, the same shoulder, the same four hundred years — and then, all at once and very small:\n\n"…Selvane."\n\nAnd it says it again. And again. Not triumph. A man patting his pockets and finding the thing he has been searching for since before your grandmother's grandmother was a rumour. And then the sound it makes is not a scream and is not a voice and every archivist in the four levels above you will lie about it for the rest of their lives, because it is a grown man weeping, and it is coming up through the floor of the Church of the Eternal Flame.\n\nThe marker stone splits. The foundation splits. Somewhere four hundred miles south, in a field of grey dirt, ash stops arriving and hangs in the air, waiting.`,
        sub: `The Tower has opened. Not because you broke it. Because there was nothing left to hold shut.`,
        options: [
          { icon: '💬', label: '"Selvane. Do you know what they did to you?"', type: 'talk',
            action: () => {
              addLog('"They asked me," it says. "That is the part nobody will believe. They asked me and I said yes." The weeping stops the way a tap stops. "I would like to be asked something again. Anything. It has been a while."', 'narrator');
              grantXP(75);
              runScene('archive_voice_told_name');
            }},
          { icon: '🗼', label: '"I am coming to the Tower. Wait for me."', type: 'talk',
            action: () => {
              setFlag('promised_the_tower');
              addLog('📜 It says: "I have never been anything else." You do not think it meant that to land the way it landed.', 'narrator');
              runScene('archive_voice_ascent');
            }},
          { icon: '🚪', label: 'Climb out before the ceiling decides.', type: 'move',
            action: () => runScene('archive_voice_ascent') },
        ]
      };
    },

    // COMPLETES c1q18.
    archive_voice_ascent: () => {
      if (!getFlag('archive_voice_quest_complete')) {
        setFlag('archive_voice_quest_complete');
        grantXP(450);
        addLog('📜 QUEST COMPLETE: The Voice Beneath the Archive. It is not the Voice Below. The Voice Below is the seventh fragment and it is still in the monastery where it has always been. This is the man the fragments were cut out of, reaching, through the one stone in the realm with a city thin enough on top of it.', 'holy');
      }
      return {
        location: 'Church Archive — Level Four',
        locationIcon: '📜',
        narration: `You come up through the hatch into Level Four and Head Archivist Theones is standing beside it with a lamp he has not lit, in the dark, at whatever hour this is. He does not ask what you heard. He has had forty years to ask and he has managed not to.\n\n"My predecessor stood here," he says. "His predecessor stood here. There is a marginal note in the Level Four inventory, in six different hands, all of them saying the same thing in slightly better Chancery each time: 'Sub-floor cavity. Not surveyed. Not to be surveyed.'" He looks at the hole. "It has been the last line of that inventory since Flame Year Twelve. I have initialled it eleven times."\n\nThen: "Did it use my name?"`,
        sub: `It used everyone's.`,
        options: [
          { icon: '💬', label: '"It used everyone\'s. That is the point. It has all of them except one."', type: 'talk',
            action: () => {
              addLog('Theones does not sit down. He stays standing, which costs him something. "Except one," he repeats. "Whose?" And you watch a man who has catalogued the history of the world discover there is a category he never opened.', 'narrator');
              grantXP(60);
              runScene('archive_voice_ascent');
            }},
          { icon: '📜', label: '"What are you rehearsing? I can hear you doing it at night."', type: 'talk',
            action: () => runScene('chancery_records_room') },
          { icon: '🚪', label: 'Say nothing. Go up. Go outside. Breathe.', type: 'move',
            action: () => { addLog('You climb four levels and step out into the Temple Quarter and the bells are ringing for the evening office and two hundred people are singing the Sevenfold Benediction in the square, at the tops of their voices, beautifully, the way they have every evening for four hundred years.', 'narrator'); goTo('temple_quarter'); } },
        ]
      };
    },

    // ══════════════════════════════════════════════════════════════════
    //  QUEST 19: THE COVENANT'S AUTHOR (c1q19)
    //  It is not who history claims. History claims Saint Aldric.
    //  Saint Aldric does not exist.
    // ══════════════════════════════════════════════════════════════════

    chancery_records_room: () => {
      setFlag('covenant_author_quest_started');
      return {
        location: 'Church Archive — The Chancery Room, Level Three',
        locationIcon: '📚',
        threat: '⚠ Ratification In Four Days',
        narration: `Six days ago the Ninth Covenant was signed. Three days ago it was ash. The period expires this year and there is not one clerk in this building with the authority to say that out loud, so instead there are four copyists at four desks re-engrossing the whole instrument from the Ostrene counterpart, at speed, in silence, and the room smells of gum arabic and panic.\n\nAnd in the corner, in a chair too small for him, Head Archivist Theones is practising a sentence. Out loud. Phonetically. In a language he does not speak. He has been doing it, by his own account, for four months. He is the presiding officer of the Ninth Ratification and he has that one line to deliver and he is determined not to fumble it in front of the Crown.\n\nHe gets to the third syllable and stops and starts again. He has the vowels slightly wrong.`,
        sub: `They are rebuilding the treaty from page four. Nobody in this room has read page one.`,
        options: [
          { icon: '🔍', label: 'The First Covenant, Flame Year 12 — get it out of the vault', type: 'explore',
            roll: { stat: 'INT', dc: 13 },
            onSuccess: () => {
              setFlag('pulled_first_covenant');
              addLog('📜 You cite the correct shelf, the correct series, and the correct reason. The vault clerk is so relieved to meet someone who knows the catalogue that he hands you a four-hundred-year-old document and goes back to his tea.', 'holy');
              runScene('covenant_signature_block');
            },
            onFail: () => { addLog('The vault clerk refuses on procedure. Theones, without looking up from his sentence, says "give it to them" in the voice of a man who has stopped caring which rules he is breaking this week.', 'system'); runScene('covenant_signature_block'); } },
          { icon: '🔍', label: 'Watch the copyists. What are they NOT copying?', type: 'explore',
            roll: { stat: 'WIS', dc: 12 },
            onSuccess: () => {
              setFlag('clue_copyists_skip_page_one');
              grantXP(90);
              addLog('📜 CLUE: All four start at clause the eighth — the schedules. Page one is marked in the margin "ENGROSSED PER RUBRIC — DO NOT COPY." It is not secret. It is not sealed. It is just not a copyist\'s job. Four hundred years of negotiators have fought over the schedules and skipped the preamble, because nobody reads the preamble.', 'holy');
              runScene('covenant_signature_block');
            },
            onFail: () => { addLog('Four men copying fast. Whatever they are leaving out, they are leaving it out so routinely that it does not look like leaving anything out.', 'system'); runScene('covenant_signature_block'); } },
          { icon: '💬', label: '"Theones. What is that sentence you keep saying?"', type: 'talk',
            action: () => runScene('chancery_rubric_rehearsal') },
          { icon: '🚪', label: 'Leave them to it. You have a tower to find.', type: 'move',
            action: () => { addLog('You leave four men rebuilding a prayer they believe is a contract, at speed, four days before the deadline. They will finish. That is the horrifying part. They are good at their jobs.', 'system'); } },
        ]
      };
    },

    // PRIMARY CLUE — c1q19.
    covenant_signature_block: () => {
      if (!getFlag('clue_author_signed_with_cross')) {
        setFlag('clue_author_signed_with_cross');
        grantXP(250);
        grantHolyPoints(5);
        addLog('📜 CLUE: First Covenant, FY 12. Seven signatories. Six names — every one of them pre-Flame — and where the seventh signature belongs: a cross. Eron\'s stones under the monastery are six crosses and one Name. This document is six names and one cross. Somebody built the mirror deliberately.', 'holy');
      }
      return {
        location: 'The Chancery Room — The First Covenant',
        locationIcon: '📜',
        narration: `Vellum the colour of weak tea, and the finest chancery hand you have ever seen in your life — a hand that has never once hurried. Seven signatory blocks at the foot of page one.\n\nSix names. Ostrene forms, pre-Flame spellings, one of them a woman with a street named after her in a city that no longer exists. All six died before Flame Year Forty.\n\nAnd where the seventh signature belongs there is a cross.\n\nIt is not the mark of a man who cannot write. The hand that drew that cross drew every other letter on the page. Whoever he was, he could write better than the Crown's own engrosser and he chose to sign like a man who could not sign at all.`,
        sub: `Six names and a cross. He drafted it and would not put his name on it.`,
        options: (function(){
          var minutes = getFlag('clue_founders_minutes');
          var opts = [
            { icon: '🔍', label: minutes
                ? 'Lay the founders\' minutes beside it. Compare the drafting hands.'
                : 'The drafting hand — where else have you seen it?',
              type: 'explore',
              roll: { stat: 'INT', dc: minutes ? 12 : 15 },
              onSuccess: () => {
                setFlag('clue_author_hand_matches_minutes');
                grantXP(150);
                addLog('📜 DEDUCTION: The hand that drafted page one of the First Covenant is the hand that took the founders\' minutes. Same letterforms, same eccentric ampersand, same man. He was in the room where they decided to make a god. He was in the room where they begged the old faith for the instrument to hold what they had made. ONE MAN WAS IN BOTH ROOMS.', 'holy');
                runScene('chancery_rubric_rehearsal');
              },
              onFail: () => { addLog('You know this hand. You have read this hand somewhere in the last week and your memory will not surrender the where.', 'system'); runScene('chancery_rubric_rehearsal'); } },
            { icon: '📜', label: 'Read page one. All of it. Including the preamble.', type: 'explore',
              roll: { stat: 'INT', dc: 12 },
              onSuccess: () => {
                setFlag('read_page_one');
                grantXP(120);
                addLog('📜 CLUE: Page one is not a preamble. It is six petitions, each closing with a cross — and then a seventh cross, alone, with nothing after it. The chancery gloss in the margin: "the notarial mark, closing the instrument." Four hundred years of copyists have drawn the seventh clause of the most fought-over document in the world at the bottom of a page and called it punctuation.', 'holy');
                runScene('chancery_rubric_rehearsal');
              },
              onFail: () => { addLog('Formal old religious throat-clearing, as far as you can tell. The operative material starts on page four. Everyone says so.', 'system'); runScene('chancery_rubric_rehearsal'); } },
            { icon: '💬', label: '"Theones. Who signed with a cross, and why is he not named?"', type: 'talk',
              action: () => runScene('chancery_rubric_rehearsal') },
          ];
          opts.push({ icon: '🚪', label: 'Put it back. Carefully. It is four hundred years old.', type: 'move',
            action: () => { addLog('You put the oldest surviving prayer in the world back in a vault, correctly, in its series, and the clerk thanks you for your care with the materials.', 'system'); } });
          return opts;
        })(),
      };
    },

    // CORROBORATOR — c1q19. The detonation. He reads it aloud, correctly, once.
    chancery_rubric_rehearsal: () => {
      var first = !getFlag('clue_rubric_seventh_clause_spoken');
      if (first) {
        setFlag('clue_rubric_seventh_clause_spoken');
        setFlag('covenant_is_a_prayer');
        setFlag('theones_broke');
        grantHolyPoints(15);
        grantXP(300);
        addLog('☩ REVELATION: The Covenant is not signed. It is SAID. The signature only licenses the saying. Clause the seventh is not written — it is spoken, by the presiding officer alone, in the old form. The old form is: "In the name of Jesus Christ, who was here before the flame and will be here after it." +15 Holy Points.', 'holy');
        addLog('📜 The Chancery Rubric glosses it: "rendering approximately, IT IS DONE." It does not mean that. It has never meant that. Somebody wrote that gloss knowing exactly what he was doing.', 'holy');
      }
      return {
        location: 'The Chancery Room — The Rubric',
        locationIcon: '📚',
        threat: first ? '☩ Something Real' : null,
        narration: first
          ? `He hands you the rubric, mildly, the way you would hand someone a timetable. "The Chancery Rubric for the Ratification of the Covenant. Clause the seventh is not written — it is spoken, by the presiding officer alone, in the old form. There is a transliteration. The Archive's gloss says it renders approximately as 'it is done.'" A dry little shrug. "Four months. I have the vowels wrong. Listen."\n\nAnd Head Archivist Theones, sixty-seven years old, forty years in the service of the Church of the Eternal Flame, gets the vowels right for the first time — and says the name of Jesus Christ out loud in the Chancery Room, correctly, in front of you, because it was written on a card and it was his job.\n\nAnd the stillness comes.\n\nIt does not knock anything over. The copyists do not look up; two of them stop writing without noticing they have. It is quiet. It is certain. It does not argue with anybody. It simply is, and it is in the room, and it has come for the man in the small chair.\n\nHis hands are shaking. He looks at them as if they belong to someone else.`
          : `He is still holding the card. He has not put it down since. "I have destroyed more documentation of that name than almost any person alive," he says, to nobody, for the third time in an hour. "I need you to understand what I'm telling you." Then, with the terrible precision of his profession: "In four days I was going to say it in the Cathedral. In front of the Crown. And go home."`,
        sub: first ? `He said it. He had no idea. He was four days from saying it in the Cathedral.` : `The presiding officer of the Ninth Ratification cannot stop looking at his own hands.`,
        options: (function(){
          var opts = [
            { icon: '💬', label: '"Do you know what you just said?"', type: 'talk',
              action: () => {
                addLog('☩ Theones: "I have destroyed more documentation of that name than almost any person alive. I need you to understand what I\'m telling you." He sits down. He does not do it gracefully. "Seventeen collections. I read every one of them first. Professional thoroughness." His hands have not stopped. "And it was on the card. It has been on the card since Flame Year Twelve. It was always on the card."', 'holy');
                setFlag('theones_told');
                grantXP(100);
                runScene('chancery_rubric_rehearsal');
              }},
            { icon: '💬', label: '"Then Varek did not burn a treaty. He burned a prayer."', type: 'talk',
              action: () => {
                addLog('📜 Theones, quietly, doing the arithmetic out loud like the archivist he is: "Signing does not seal it. Signing WARRANTS it. The saying seals it. Burn the instrument before ratification and the warrants never existed — and seven men who were licensed to stand at seven stones and speak are, as of three days ago, not licensed to do anything at all." A pause. "He burned the authorisation. The whole realm stopped being allowed to pray."', 'holy');
                setFlag('understands_the_mechanism');
                grantXP(120);
                runScene('chancery_rubric_rehearsal');
              }},
            { icon: '🕯', label: 'Take page one to Sister Mourne. She has read every buried text alive.', type: 'move',
              action: () => runScene('mourne_page_one') },
          ];
          if (varekReachable()) {
            opts.push({ icon: '⛩', label: 'Take page one to Elder Varek. Let him read the first page.', type: 'move',
              action: () => runScene('varek_first_page') });
          }
          opts.push({ icon: '📜', label: 'Close the book. You know who wrote it now.', type: 'move',
            action: () => runScene('covenant_author_closed') });
          return opts;
        })(),
      };
    },

    // THE MOURNE SCENE (Twist Bible §6). She can survive being wrong.
    // She cannot survive having skimmed.
    mourne_page_one: () => {
      setFlag('mourne_read_page_one');
      return {
        location: 'Temple Quarter — Sister Mourne',
        locationIcon: '🕯',
        narration: `She takes it because she is curious, and she reads it the way she does everything, which is completely. You watch her get to the bottom of page one. You watch her go back to the top of page one. You watch her do it a third time, and Sister Mourne has never in her life needed to read anything three times.\n\nShe is the most learned living reader of the texts the Church buried. She had to be — the Church trains its agents to counter the argument, which means she had to read the argument. She knows the six petitions. She could recite them. She has known since she was twenty-four what the Eternal Flame was built on top of and she has spent every year since not thinking about it.\n\n"I read the operative clauses," she says.\n\nShe does not raise her voice. She never does.\n\n"Clause four. The financial provisions. The transitional schedules. I read them four times and I read them correctly and I was right about what they would do to us." Her thumb is on the seventh cross at the bottom of the page. "I have been in the room with this document. More than once. I read page four."`,
        sub: `She is not sorry. She has never been sorry. That is not what this is.`,
        options: [
          { icon: '💬', label: '"You were right about clause four. That was never the question."', type: 'talk',
            action: () => {
              addLog('Mourne: "No. I was right about clause four." She says it flatly, like reading a total off a ledger. "And the answer to the question I was actually being asked was on the first page, in a hand better than mine, and I turned past it because the first page of a treaty is —" And she stops. And she lets the sentence hang, which is what she does when she has decided not to say the last part. But this time you can see it on her, and it is not that she decided. It is that there is no last part.', 'narrator');
              setFlag('mourne_broke');
              grantXP(150);
              runScene('mourne_page_one');
            }},
          { icon: '🕯', label: '"You are called The Candle. You burned a prayer."', type: 'talk',
            roll: { stat: 'CHA', dc: 15 },
            onSuccess: () => {
              setFlag('mourne_named');
              grantHolyPoints(5);
              addLog('📜 She does not flinch and she does not defend it. "Yes," she says. And then — the only time you will ever hear this from her — "I would like to sit down." She does not sit down. Varek\'s agents are trained.', 'holy');
              runScene('mourne_page_one');
            },
            onFail: () => { addLog('"You are trying to make me feel it," she says, "and I will, later, on my own time, and you will not be there." It is the closest thing to honesty she has.', 'system'); runScene('mourne_page_one'); } },
          { icon: '💬', label: '"Can it be mended? You know the texts better than anyone alive."', type: 'talk',
            action: () => {
              addLog('Mourne: "It requires a sayer who means it." A beat. "I have read more about Him than any priest in this city and I have never once meant a word of it. That is not modesty. It is a finding." She hands page one back. "You will need someone else."', 'narrator');
              setFlag('mourne_declines_officer');
              grantXP(80);
              runScene('mourne_page_one');
            }},
          { icon: '📜', label: 'Take page one back. Leave her with it.', type: 'move',
            action: () => runScene('covenant_author_closed') },
        ]
      };
    },

    // THE VAREK SCENE (Twist Bible §6). He is not a dupe. He is a tragedy.
    // He destroyed the world with a housing requisition.
    varek_first_page: () => {
      setFlag('varek_read_page_one');
      return {
        location: 'Monastery of Saint Aldric — Elder Varek',
        locationIcon: '⛩',
        narration: `He reads it faster than Mourne did and he understands it slower, which is the difference between them. Then he understands it.\n\n"I read the treaty carefully," he says. It is not a defence. He is stating a fact about a competent man. "Clause four would have made the Church a department of the Crown inside two years. I was right. Nobody has told me I was wrong about clause four and nobody is going to, because I was not."\n\nHe puts the page down.\n\n"And when I came here to wait it out, this building was full. Seven brothers. I signed a requisition. Standard form. Church property, Church use, Elder's prerogative — I did not even write it, my clerk wrote it, I initialled it between two other things." He looks at the empty cloister. "Some were escorted. Some were carried. I did not ask which."\n\nSeven men. The Sayers of the First Stone. A housing requisition.`,
        sub: `"The Elder broke the first without knowing." The monk meant it literally. So did the Voice.`,
        options: [
          { icon: '💬', label: '"You did not burn the seal. You evicted it."', type: 'talk',
            action: () => {
              addLog('📜 Varek: "The Candle burned a copy of a copy. I knew that when I ordered it — it was a copy, it was theatre, it was meant to buy the Church eighteen months." His voice does not change. "And the actual seal was seven men in this building who I had removed to make room for my bed."', 'hell');
              setFlag('varek_understands');
              grantXP(150);
              runScene('varek_first_page');
            }},
          { icon: '💬', label: 'Let him ask his question.', type: 'talk',
            action: () => {
              addLog('Varek: "Would it have mattered? If I had read the first page?" — And the game does not answer him, and neither do you, because the answer is yes, it would have mattered, and he would not have believed it, and both of those are true at once and there is no sentence that holds them both.', 'narrator');
              setFlag('varek_asked');
              grantXP(80);
              runScene('varek_first_page');
            }},
          { icon: '✝', label: '"Say it. Clause seven. You are an Elder — you are qualified to preside."', type: 'talk',
            roll: { stat: 'CHA', dc: 16 },
            onSuccess: () => {
              addLog('☩ He tries. He gets three words in — and stops. Not from fear. From accuracy. "It requires conviction," he says. "I have had forty years of the other thing." Elder Varek, who was right about clause four, is not qualified, and he is the first man in this chapter to work that out about himself unprompted.', 'holy');
              setFlag('varek_cannot_say_it');
              grantHolyPoints(5);
              runScene('varek_first_page');
            },
            onFail: () => { addLog('"No," he says. Just that. He is not being difficult. He is being correct and he knows it.', 'system'); runScene('varek_first_page'); } },
          { icon: '📜', label: 'Leave him with the first page. Let him hold it a while.', type: 'move',
            action: () => runScene('covenant_author_closed') },
        ]
      };
    },

    // COMPLETES c1q19.
    covenant_author_closed: () => {
      if (!getFlag('covenant_author_known')) {
        setFlag('covenant_author_known');
        setFlag('covenant_is_a_prayer');
        grantXP(500);
        grantHolyPoints(10);
        addLog('📜 QUEST COMPLETE: The Covenant\'s Author. History says Saint Aldric wrote it. Saint Aldric has no vita, no birth record, no relics, and nothing whatsoever before Flame Year Twelve — because "Saint Aldric" is not a man. It is the file name the Church gave to the author it could not name, exactly as it gave "the Eternal Flame" to the man it murdered. They struck two names. They were consistent.', 'holy');
      }
      return {
        location: 'Vaelthar — What Page One Is',
        locationIcon: '📜',
        narration: `He was in both rooms.\n\nHe sat with the founders while they resolved that the instrument required a subject of local esteem, and he wrote it down in a beautiful hand, and he watched it not work. And then, eleven years later, with something in seven pieces and the Church he had helped invent going quietly out of its mind, he went to the faith he had helped bury and asked the people he had helped persecute for the one thing that could hold what he had made. They gave it to him. It is six petitions and a Name. He copied it onto page one of a treaty because a treaty is the only object in the world that both a Crown and a Church will agree to keep safe, and he attached four hundred years of schedules to it so that nobody would ever throw it away.\n\nThen he signed it with a cross, because he did not consider himself fit to sign it with a name.\n\nThey buried him under the monastery, and they could not put a name on the grave either, so they made one up and called it a saint and built a Remnant house on top of him and protected it for four centuries — on the express finding that the first clause requires a sayer who means it, and they have none.`,
        sub: `The Covenant is not to be signed. It is to be said. Everything else is schedules.`,
        options: [
          { icon: '🗼', label: 'The Ashen Fields. The Tower. Stone VII. Go.', type: 'move',
            action: () => { openTheTower(); addLog('You go south with a prayer in your coat and the name of a dead man in your mouth.', 'narrator'); goTo('tower_ash'); } },
          { icon: '🌑', label: 'The Ashen Fields first — you want the ground under you before the door', type: 'move',
            action: () => goTo('ashen_fields') },
          { icon: '💬', label: 'Tell Theones the ratification is not a signing ceremony', type: 'talk',
            action: () => {
              addLog('📜 Theones: "Then the Crown\'s lawyers have been negotiating the annexes of a prayer since before my great-grandfather was born." He starts laughing and it goes wrong about four seconds in. "I have to tell the Cathedral. I have to stand up in front of the Crown and tell them what we have all been doing." He stops. "They will not believe me. I am the Head Archivist. I destroyed the evidence."', 'narrator');
              setFlag('theones_will_testify');
              grantXP(100);
            }},
        ]
      };
    },

    // ══════════════════════════════════════════════════════════════════
    //  QUEST 20: THE SHATTERED GOD (c1q20) — BOSS
    //  The Tower of Ash — Stone VII. Three endings.
    //  A god cannot be talked down. So stop addressing a god.
    // ══════════════════════════════════════════════════════════════════

    tower_ash_approach: () => {
      setFlag('tower_ash_entered');
      var told = getFlag('told_the_voice');
      return {
        location: 'The Tower of Ash — The Door With No Handle',
        locationIcon: '🗼',
        threat: '☠ Stone VII',
        narration: told
          ? `You do not have to open it. It came apart four days ago, from the inside, at the same hour a hole opened in the floor of the Church Archive four hundred miles north, and the ash that has been falling upward into this tower since before the Church existed is hanging motionless over the Ashen Fields like a held breath.\n\nInside: a staircase that does not go anywhere any more. Thirty-seven steps. You have been dreaming these steps for weeks and the count was always right.`
          : `The door has no handle and no lock. It has a symbol on it in something that was blood a very long time ago, and the maps that show this tower are four hundred years old, and the stones look freshly cut, because nothing has touched them in three hundred and ninety-three years.\n\nThe ash falls upward. It has been falling upward into this tower your whole life and your father's whole life. It is not ash FROM the tower. It has been going IN.\n\nInside — you know this without opening anything, because you have dreamt it — there is a staircase that no longer goes anywhere. Thirty-seven steps.`,
        sub: `Thirty-seven steps. There is a man on the last one and he has one question.`,
        options: (function(){
          var opts = [];
          if (getFlag('clue_flame_is_traced_cross') || getFlag('clue_tower_door_mark')) {
            opts.push({ icon: '🔍', label: 'The symbol. You know what it is now.', type: 'explore',
              action: () => {
                setFlag('read_tower_door');
                grantXP(90);
                addLog('📜 It is a cross with the crossbar drawn out into a torch, half-finished, the tracing still visible — the same overdrawing as the children\'s palms and the caravan dead. Somebody started converting this door and gave up partway through. You can see exactly where his nerve went.', 'holy');
                runScene('tower_thirty_seventh_step');
              }});
          } else {
            opts.push({ icon: '🔍', label: 'Read the symbol on the door', type: 'explore',
              roll: { stat: 'INT', dc: 14 },
              onSuccess: () => {
                setFlag('read_tower_door');
                grantXP(90);
                addLog('📜 CLUE: It is not a ward. It is a cross that somebody began redrawing into a torch and abandoned halfway. The tracing is still visible. Whatever the Eternal Flame is, it was made out of something that was already here.', 'holy');
                runScene('tower_thirty_seventh_step');
              },
              onFail: () => { addLog('Old blood in a shape your eye insists it knows. Your eye is right and you cannot make it say why.', 'system'); runScene('tower_thirty_seventh_step'); } });
          }
          if (knowsTheName()) {
            opts.push({ icon: '🗣', label: 'Say his name at the door. "Selvane."', type: 'talk',
              action: () => {
                setFlag('named_him_at_the_door');
                grantHolyPoints(5);
                addLog('☩ Nothing dramatic. The door simply is not there any more, in the way that a thing you were arguing with turns out to have been a misunderstanding. There was never a lock. There was a man who had not been called anything in four hundred years, and a wall made out of that.', 'holy');
                runScene('tower_thirty_seventh_step');
              }});
          }
          opts.push({ icon: '✊', label: 'Knock. It costs nothing to be civil to a tower.', type: 'talk',
            action: () => {
              addLog('You knock. The ash stops for two full seconds. Then it resumes. Somewhere above you something that has not been treated as a person since before the calendar started does not know what to do with a knock.', 'narrator');
              runScene('tower_thirty_seventh_step');
            }});
          opts.push({ icon: '🚪', label: 'Not today. Turn around. Walk out of the Fields.', type: 'move',
            action: () => { addLog('You walk out of the Ashen Fields. The Tower keeps. It has kept for four hundred years and it will keep for another week, and the man on the thirty-seventh step will spend that week doing what he has done every other week, which is waiting politely.', 'system'); goTo('ashen_fields'); } });
          return opts;
        })(),
      };
    },

    // THE CONFRONTATION. All three endings hang off this scene.
    // combat:victory:tower_thirty_seventh_step fires here if the player fights.
    tower_thirty_seventh_step: () => {
      setFlag('faced_the_shattered_god');
      return {
        location: 'The Tower of Ash — The Thirty-Seventh Step',
        locationIcon: '🗼',
        threat: '☠ THE SHATTERED GOD',
        narration: `The sealed door does not open — it simply ceases to be there. Beyond it, something vast and broken unfolds out of the dark. It has too many faces, and every one of them already knows your name.\n\nThe air turns to ash in your lungs. The Shattered God rises from the tower's heart — divine and ruined in equal measure, a thing that was worshipped and then murdered, and has forgiven neither.\n\nRead the order. Nobody is worshipped first and murdered second by accident. That is what happens to a man you raise up on purpose so that you can put him down on schedule. And the faces are not power. They are four hundred years of other people's names, tried on one at a time against a hole that only ever fitted one.\n\nAnd then, out of all of it, in a voice that is somehow both the well and the Archive and every dream you have had for a month, polite, patient, and four centuries old:\n\n"Has it been three days yet?"`,
        sub: `He is not asking you. He has asked every night since the calendar started. He cannot hear the answer.`,
        options: (function(){
          var opts = [];
          if (getFlag('has_unnaming_blade')) {
            opts.push({ icon: '🗡', label: 'The blade from the Forge. Use it. It was made for exactly this.', type: 'combat',
              action: () => {
                setFlag('used_unnaming_blade');
                startCombat([shatteredGodBoss()], { victoryScene: 'tower_ending_sword' });
              }});
          }
          opts.push({ icon: '⚔', label: 'Fight it. Whatever it is, it cannot be allowed out.', type: 'combat',
            action: () => startCombat([shatteredGodBoss()], { victoryScene: 'tower_ending_sword' }) });
          if (canReadTheCharter()) {
            opts.push({ icon: '📜', label: 'Read the seven clauses at Stone VII. Re-seal it.', type: 'explore',
              action: () => runScene('tower_charter_officer') });
          }
          if (knowsTheName()) {
            opts.push({ icon: '🗣', label: 'Say his name. "Sel."', type: 'talk',
              action: () => runScene('tower_speak_his_name') });
          }
          // Resolved at click time, not build time: if the player has already given
          // him a self, the Name has somebody to land on and this is Ending 3.
          // If not, it lands on an "it" — and that is the lesson, not a bug.
          opts.push({ icon: '✝', label: 'Speak the Name: "Jesus Christ."', type: 'talk',
            action: () => runScene(getFlag('spoke_selvane') ? 'tower_ending_third_day' : 'tower_name_without_name') });
          return opts;
        })(),
      };
    },

    // ENDING 3 — STEP ONE. Nothing supernatural happens. Write it flat.
    tower_speak_his_name: () => {
      if (!getFlag('spoke_selvane')) {
        setFlag('spoke_selvane');
        grantHolyPoints(10);
        grantXP(200);
        addLog('📜 Nothing supernatural happened. The name is dead — the thing under the Archive told you so itself. It has no power. It has one property: nobody has said it in four hundred years. +10 Holy Points.', 'holy');
      }
      return {
        location: 'The Tower of Ash — The Thirty-Seventh Step',
        locationIcon: '🗼',
        threat: '⚠ A Man',
        narration: `"Sel."\n\nThe faces stop.\n\nNot in fear, and not in fury, and there is no light and no thunder and nothing in the tower moves. The faces simply stop being tried on, because someone has addressed a person, and there is no longer any point wearing somebody else's.\n\nWhat is left is a man of about fifty sitting on a step, with seven holes in him where seven pieces were subtracted, and no face of his own, because his own was cut out and filed.\n\n"Sel," he says back. He turns it over. He is checking it against something. "Nobody says Sel."\n\nA very long pause.\n\n"Only my mother said Sel."`,
        sub: `You cannot forgive a god. This is the step that makes the next one possible.`,
        options: (function(){
          var opts = [
            { icon: '✝', label: 'Speak the Name: "Jesus Christ."', type: 'talk',
              action: () => runScene('tower_ending_third_day') },
            { icon: '💬', label: '"Nobody made you. Say it again."', type: 'talk',
              action: () => {
                addLog('Selvane: "Nobody made me. They asked. I was — " and he searches for it, and finds it, and it is the worst word in the chapter — "flattered. They said it would help. They said I would be back in three days and I would be able to tell everyone what it was like." He looks at his hands, which are not there. "I have been able to tell nobody anything at all."', 'narrator');
                setFlag('selvane_consented_aloud');
                grantXP(100);
                runScene('tower_speak_his_name');
              }},
            { icon: '💬', label: '"It has been four hundred and four years."', type: 'talk',
              action: () => {
                addLog('Selvane: "Oh." A pause of a kind you will think about for the rest of your life. "Then it did not work." And then, and he is being kind to THEM, which is unbearable: "They must have been so frightened. Eleven years of it and nothing coming back but pieces. I hope somebody looked after them."', 'narrator');
                setFlag('selvane_told_the_years');
                grantXP(100);
                runScene('tower_speak_his_name');
              }},
          ];
          if (canReadTheCharter()) {
            opts.push({ icon: '📜', label: 'Read the seven clauses. Put him back. Keep the world.', type: 'explore',
              action: () => runScene('tower_charter_officer') });
          }
          opts.push({ icon: '⚔', label: 'Kill him. He is a man now and that makes it easier, not harder.', type: 'combat',
            action: () => { setFlag('killed_him_as_a_man'); grantHellPoints(10); startCombat([shatteredGodBoss()], { victoryScene: 'tower_ending_sword' }); } });
          return opts;
        })(),
      };
    },

    // FAILURE STATE — the Name spoken over an "it". It teaches you why it exists.
    tower_name_without_name: () => {
      setFlag('spoke_the_name_at_an_it');
      grantHolyPoints(5);
      return {
        location: 'The Tower of Ash — The Thirty-Seventh Step',
        locationIcon: '🗼',
        threat: '☠ THE SHATTERED GOD',
        narration: `"Jesus Christ."\n\nAnd the stillness comes, exactly as it always comes: quiet, not loud. Certain, not theatrical. It does not argue with the thing in the tower and it does not fight it and it does not burn it. It is simply there, entirely, in a room with a hundred stolen faces.\n\nAnd it lands on an "it."\n\nThere is nothing in the room for it to be true TO. The faces do not stop. They cannot — there is no self behind them to be still. Something in there registers the way a locked house registers weather.\n\nThe Name is not a key. It is a witness. And a witness needs somebody to witness to.`,
        sub: `You said the truest thing in the world to a thing that has no self to hear it.`,
        options: (function(){
          var opts = [];
          if (knowsTheName()) {
            opts.push({ icon: '🗣', label: 'Give it a self first. Say his name: "Sel."', type: 'talk',
              action: () => runScene('tower_speak_his_name') });
          } else {
            opts.push({ icon: '🔍', label: 'It has a name. Find it. Think — what have you been hearing all chapter?', type: 'explore',
              roll: { stat: 'INT', dc: 18 },
              onSuccess: () => {
                setFlag('knows_the_name_early');
                grantXP(200);
                addLog('📜 The well: "S—". The Archive: "S—". The grandmothers of Mol at dusk: "quiet now, or Sel hears." And seven illuminated capitals in every hymnal in the realm, sung by every child at dawn for four hundred years, glossed in the margin as a holy word whose meaning is not preserved. S. E. L. V. A. N. E.', 'holy');
                runScene('tower_speak_his_name');
              },
              onFail: () => { addLog('You are missing something and you can feel the shape of the gap. Somebody in Mol knows. Somebody with a hymnal knows. Everybody knows. Nobody has noticed.', 'system'); runScene('tower_name_without_name'); } });
          }
          opts.push({ icon: '💬', label: 'Ask it the question back. "Has it been three days yet?"', type: 'talk',
            action: () => {
              setFlag('asked_it_back');
              addLog('You ask a hundred stolen faces whether it has been three days yet. Every one of them answers at once, in your voice, in your mother\'s voice, in the voice off the headstone: "Has it been three days yet?" It is not mocking you. It cannot hear you. It has never been able to hear anybody — that is what the question IS. Four hundred years of asking into a room with nobody in it, and now there is somebody in the room, and it still cannot tell.', 'narrator');
              grantXP(80);
              runScene('tower_name_without_name');
            }});
          if (canReadTheCharter()) {
            opts.push({ icon: '📜', label: 'Fall back on the clauses. Re-seal it.', type: 'explore',
              action: () => runScene('tower_charter_officer') });
          }
          opts.push({ icon: '⚔', label: 'Then there is only the sword.', type: 'combat',
            action: () => startCombat([shatteredGodBoss()], { victoryScene: 'tower_ending_sword' }) });
          return opts;
        })(),
      };
    },

    // ENDING 2 — the officer. The cost is a person and the player picks them.
    tower_charter_officer: () => ({
      location: 'The Tower of Ash — Stone VII',
      locationIcon: '📜',
      threat: '⚠ Clause The Seventh',
      narration: `Six petitions, each closing with a cross. You have them — a hanged man gave them to a priest who ran, and the priest kept the wax because he was required to, and line seven never came because they hanged him during line six.\n\nAnd line seven itself: "In the name of Jesus Christ, who was here before the flame and will be here after it." Carved on a stone under a monastery. Printed on a rubric card in a chancery. Sitting in a drunk cartographer's coat pocket in a tavern since the first hour you were in this city.\n\nYou learned this move in the second week. A binding circle under a monastery. Aware. Contained. Not free. Not dead. It cost fifteen Holy Points then.\n\nBut the first clause requires a sayer who MEANS it, and a warranted one, and you are standing at Stone VII holding a prayer and a vacancy.`,
      sub: `It only works if the officer means it. Somebody has to say it, and then live in it.`,
      options: (function(){
        var opts = [];
        if (theonesAlive() && getFlag('theones_broke') && !getFlag('theones_tried')) {
          opts.push({ icon: '📚', label: 'Head Archivist Theones. He is the presiding officer. It is literally his job.', type: 'talk',
            action: () => {
              setFlag('theones_tried');
              addLog('☩ He says it. He says it correctly — four months of practice, and now he knows what it means, and he says it beautifully. And nothing happens. He stands at Stone VII in the ash with the card in his hand and nothing happens, and he knows exactly why, and he is a truthful man about records, so he says it out loud where you can hear: "Forty years. I destroyed seventeen collections about this name and read every one of them first. I do not mean it. I want to. Wanting is not meaning." He hands you the card.', 'holy');
              grantXP(120);
              runScene('tower_charter_officer');
            }});
        }
        if (caelAlive()) {
          opts.push({ icon: '🧎', label: 'Brother Cael. He never stopped. He has never once known what that made him.', type: 'talk',
            action: () => { setFlag('officer_cael'); runScene('tower_ending_charter'); } });
        }
        if (!getFlag('player_tried_saying')) {
          opts.push({ icon: '✝', label: 'Say it yourself. Be the Sayer of the Seventh Stone.', type: 'talk',
            roll: { stat: 'WIS', dc: 15 },
            onSuccess: () => { setFlag('player_tried_saying'); setFlag('officer_player'); runScene('tower_ending_charter'); },
            onFail: () => {
              setFlag('player_tried_saying');
              addLog('You say it and you hear yourself say it and you hear the difference. It is not a failure of courage. It is that you are saying it AT the stone instead of meaning it, and the seal can tell, and so can you, and there is no arguing with either of them.', 'system');
              runScene('tower_charter_officer');
            }});
        }
        opts.push({ icon: '⚔', label: 'No. Nobody spends their life on this. Fight it.', type: 'combat',
          action: () => startCombat([shatteredGodBoss()], { victoryScene: 'tower_ending_sword' }) });
        if (knowsTheName() && !getFlag('spoke_selvane')) {
          opts.push({ icon: '🗣', label: 'Wait. Before you put him in a box — say his name.', type: 'talk',
            action: () => runScene('tower_speak_his_name') });
        }
        return opts;
      })(),
    }),

    // ══════════════ ENDING 1 — THE SWORD ══════════════
    // Always available. No puzzle. No flags. It works.
    tower_ending_sword: () => {
      if (!getFlag('chapter1_ending_sword')) {
        setFlag('chapter1_ending_sword');
        setFlag('chapter1_complete');
        setFlag('shattered_god_defeated');
        grantXP(800);
        addLog('⚡ QUEST COMPLETE: The Shattered God. It is down. Canon loot recovered: the Shattered God\'s Eye, and a Divine Remnant.', 'holy');
        if (getFlag('used_unnaming_blade')) {
          addLog('🗡 LOOT LOG — the blade you used, itemised, as forged: (1) metal that was already a promise — the seal matrix from the burned signing hall. (2) ash from something burned to hide it — the signing hall ash. (3) a name freely given, spoken over the quench — yours.', 'system');
          addLog('📜 A promise, a burning, and a freely given name. That is the founders\' recipe. You have just done, with a sword and good intentions, precisely what they did with a plan and a liturgy: solved a man by killing him.', 'system');
          grantHellPoints(5);
        }
      }
      return {
        location: 'The Tower of Ash — After',
        locationIcon: '🗼',
        narration: `It shatters further. That is the honest word for it. Not destroyed — divided, again, into smaller pieces than the founders managed, and the pieces go down through the floor of the tower and into the ground and away in six directions, and the ash finally stops falling upward because there is nothing left up there to fall into.\n\nOn the thirty-seventh step there is a shape burned into the stone where somebody sat for a very long time.\n\nThe last thing it said was not a curse and it was not your name. It was the question. It never stopped asking the question. It was still asking it when it came apart, politely, the way it had asked every night for four hundred and four years, and the last word of it was "yet."`,
        sub: `You won. The word "won" is doing a great deal of work in that sentence.`,
        options: [
          { icon: '📜', label: 'What happens now?', type: 'explore',
            action: () => {
              addLog('📜 CHAPTER II: More wells. More children with nothing behind their eyes and a torch traced over a cross on their palms. More pieces going looking for each other, and now there are more pieces than there were. You are the fourth generation to try this and you did it exactly the way the other three did.', 'hell');
              if (getFlag('pq_curse_network')) addLog('📜 Ysel\'s network wakes at dawn. Six carriers. Nobody sends word. Everybody knows.', 'hell');
              grantXP(100);
            }},
          { icon: '🗿', label: 'Look at Stone VII before you go', type: 'explore',
            action: () => { addLog('☩ It is intact. It is the only marker the Church never dared move, and the Name is still cut into it, and it has outlasted the thing it was built to hold. It will outlast you too. That is not a threat. It is the point.', 'holy'); grantHolyPoints(5); } },
          { icon: '🗺', label: 'Go home. Report. Say it was necessary.', type: 'move',
            action: () => { addLog('And it was. That is the thing about this ending. It was necessary and it was a killing and both of those go in the report, and only one of them gets read.', 'system'); goTo('vaelthar_city'); } },
        ]
      };
    },

    // ══════════════ ENDING 2 — THE CHARTER ══════════════
    // You kept the world. You also put a murdered man back in a box.
    tower_ending_charter: () => {
      var officer = getFlag('officer_cael') ? 'cael' : 'player';
      if (!getFlag('chapter1_ending_charter')) {
        setFlag('chapter1_ending_charter');
        setFlag('chapter1_complete');
        setFlag('covenant_resealed');
        grantXP(800);
        grantHolyPoints(15);
        addLog('📜 QUEST COMPLETE: The Shattered God — THE CHARTER. The Tenth Period runs from tonight. Forty-nine years. The tithe must be paid forever, the Remnant house on the author\'s grave must be maintained forever, and the Church of the Eternal Flame must never become a department of the Crown — which means Elder Varek was right, and the whole obscene machine goes on, and that is what you bought the world with.', 'holy');
        if (officer === 'cael') {
          addLog('🧎 Brother Cael is the Sayer of the Seventh Stone. The warrant is perpetual. He will go back to the monastery and stay there, alone, saying it, forever.', 'holy');
        } else {
          addLog('✝ YOU are the Sayer of the Seventh Stone. The warrant is perpetual. Warrants do not expire when you do.', 'holy');
        }
      }
      return {
        location: 'The Tower of Ash — Stone VII, Sealed',
        locationIcon: '📜',
        narration: officer === 'cael'
          ? `He is thirty-three and he is terrified and he does it anyway, because he has done it every morning and every evening and three times in the night hours since he was a boy and he never once stopped, not even in the root cellar with the sounds going on above him.\n\nSix petitions. Then line seven, in the old form, and he means it so completely that it is almost rude to be standing there.\n\nAnd it holds.\n\nThe faces fold in. The man on the thirty-seventh step sits back down, and he does not resist, and he does not fight it, and that is by an enormous margin the worst part. He only asks, once, quietly, whether it will be three days this time.\n\nNobody answers him.\n\nAfterwards Cael says: "Oh. I thought I was just praying." Then he walks back to Saint Aldric's and does not come out.`
          : `You read them. Six petitions, each closing with a cross, and then the seventh clause that is not written, in the old form, and you mean it — you find, standing in the ash at the last whole stone in the world, that you do — and it is the quietest thing you have ever done.\n\nAnd it holds.\n\nThe faces fold in. The man on the thirty-seventh step sits back down, and he does not resist, and he does not fight it, and that is by an enormous margin the worst part. He only asks, once, quietly, whether it will be three days this time.\n\nYou do not answer him. There is no answer that is both true and bearable, and you have run out of the second one.`,
        sub: `You kept the world. You put a murdered man back in a box for another forty-nine years.`,
        options: [
          { icon: '📜', label: 'What happens now?', type: 'explore',
            action: () => {
              addLog('📜 CHAPTER II: The Tenth Covenant needs writing. Now you know what page one is. So does the Crown. And the Crown has lawyers, and the lawyers have now been told that the operative clause of the instrument they have been negotiating for four centuries is a prayer that only works if the man saying it means it — and they are already asking who decides that, and by what test, and whether it can be certified.', 'hell');
              grantXP(100);
            }},
          { icon: '💬', label: 'Somebody redacted the capital\'s copies down to five clauses. When?', type: 'talk',
            action: () => { addLog('📜 CHAPTER II: It was a chancery decision, and chancery decisions have dates, and Caelan Vey is still employed and still in his office. He drafted clause four for the Crown for ordinary reasons of state. There is no grey man. Nobody was driving. That is the horror.', 'hell'); setFlag('chapter2_vey_thread'); } },
          { icon: '🗺', label: 'Ride back to Vaelthar. Tell them it holds.', type: 'move',
            action: () => { addLog('It holds. They will be delighted. They will not ask what it cost, because the answer is a name and a person and neither of those goes in a schedule.', 'system'); goTo('vaelthar_city'); } },
        ]
      };
    },

    // ══════════════ ENDING 3 — THE THIRD DAY ══════════════
    // He is not destroyed. He is not raised — only Christ rises. He is let go.
    tower_ending_third_day: () => {
      if (!getFlag('chapter1_ending_third_day')) {
        setFlag('chapter1_ending_third_day');
        setFlag('chapter1_complete');
        setFlag('selvane_released');
        grantXP(1200);
        grantHolyPoints(40);
        addLog('☩ QUEST COMPLETE: The Shattered God — THE THIRD DAY. He was not destroyed. He was not raised — only Christ rises, and that is the entire point, and nothing in this world will ever blur it. He was LET GO. +40 Holy Points.', 'holy');
        addLog('📜 The stillness did not give him his third day. It told him the truth he had been sold a forgery of, and that it had happened, and that it was not him, and that it did not have to be him.', 'holy');
      }
      return {
        location: 'The Tower of Ash — The Thirty-Seventh Step',
        locationIcon: '☩',
        narration: `"Jesus Christ."\n\nAnd the stillness comes. Quiet, not loud. Certain, not theatrical. It does not argue with anybody in the room and it does not perform and there is no light and no sound and no number anywhere. It simply is, the way the ground is.\n\nAnd the thing that was manufactured and marketed and murdered as a counterfeit of precisely this — hears the original.\n\nHe does not move. He is a man of about fifty sitting on a step.\n\n"Oh."\n\nA long pause.\n\n"They copied a true thing."\n\nLonger.\n\n"I said yes. I want you to know I said yes. Nobody made me."\n\nAnd then, quietly, the only thing he has wanted in four hundred and four years:\n\n"Then I can stop."\n\nThe ash stops falling upward.`,
        sub: `He can stop. That is all it was. That is all it ever was.`,
        options: [
          { icon: '🗿', label: 'Stone VII', type: 'explore',
            action: () => {
              addLog('☩ It is unsealed and the Name is still cut into it — the only marker the Church never dared move. And on the wall of the Church of the Eternal Flame in Vaelthar, on stone that predates the building by centuries, a carving that has been there since before there was a Church to carve it finally reads straight: "In the name of Jesus Christ — the Chosen comes after the breaking. The Chosen does not know the task. The Chosen will not be given a choice." Somebody knew there would be a breaking, and knew who would be standing here, four centuries before the Church existed. Chapter I was the breaking.', 'holy');
              grantHolyPoints(10);
            }},
          { icon: '📜', label: 'What happens now?', type: 'explore',
            action: () => {
              addLog('📜 CHAPTER II — THE ORPHANS: six fragments leaked into the bloodlines nearest their stones. The seventh never found a carrier and is still in the monastery chamber, which is what the Voice Below always was. Letting him go does not heal the six. It ORPHANS them. Six pieces, no centre, nothing left to converge toward, all awake by morning.', 'hell');
              if (getFlag('pq_curse_network')) addLog('📜 Ysel wakes at dawn with her wrist burning and no idea why the pull has stopped. She will work it out by noon. She will not thank you.', 'hell');
              grantXP(150);
            }},
          { icon: '☩', label: 'The arithmetic problem nobody has said out loud yet', type: 'explore',
            action: () => {
              addLog('📜 CHAPTER III: If the Eternal Flame was Selvane, and Selvane is gone — then four hundred years of prayer, every dawn, from an entire realm, went SOMEWHERE. It did not go to him; he could not even hear a question asked in his own tower. Something has been receiving it. That is not a Chapter II problem.', 'hell');
              setFlag('chapter3_thread_open');
              grantXP(150);
            }},
          { icon: '🗺', label: 'Walk out. The Fields are just a field now.', type: 'move',
            action: () => { addLog('You walk out of the Ashen Fields in ordinary grey dirt under an ordinary sky, and behind you a tower that nobody could find is standing in plain sight with nothing in it, and the last mercy in the world turns out to be that a man can be given his name back, and a Name can be spoken over him that nobody owns, and neither of those costs anything at all except being willing to say them out loud.', 'holy'); goTo('vaelthar_city'); } },
        ]
      };
    },

  };

  if (typeof SCENES !== 'undefined') Object.assign(SCENES, S);
  if (typeof window !== 'undefined') { window.SCENES = window.SCENES || SCENES; Object.assign(window.SCENES, S); }

  // ── WORLD REACHABILITY ────────────────────────────────────────────────────
  // map.js hardcodes its arrival triggers for c1q1–c1q6 only. Wrap narrateLocation
  // additively (idempotent, delegates to whatever is already installed) so the
  // finale quests have real entry points on the world map: church_archive →
  // c1q18, archive_scriptorium → c1q19, tower_ash → c1q20.
  if (typeof window !== 'undefined' && !window._finaleArrivalHooked) {
    window._finaleArrivalHooked = true;
    var prevNarrate = window.narrateLocation;
    if (typeof prevNarrate === 'function') {
      window.narrateLocation = function (loc) {
        var out = prevNarrate.apply(this, arguments);
        try {
          setTimeout(function () { maybeQueueFinaleScene(loc); }, 2400);
        } catch (e) { /* an arrival hook must never break travel */ }
        return out;
      };
    }
  }

  function maybeQueueFinaleScene(loc) {
    if (!loc || typeof window.runScene !== 'function') return;
    if (window.combatState && window.combatState.active) return;
    if (window._pendingArrivalScene) return;
    if (document.getElementById('scene-panel')) return;
    if (window.npcConvState && window.npcConvState.active) return;
    var flags = (window.sceneState && window.sceneState.flags) || {};
    var active = ((window.gameState && window.gameState.activeQuests) || []).map(function (q) { return q && q.id; });
    var queue = window.queueArrivalScene || window.runScene;

    if (loc.id === 'church_archive' && !flags.archive_voice_quest_started
      && (flags.clue_founders_minutes || flags.clue_aldric_exception || active.indexOf('c1q18') !== -1)) {
      queue('archive_lowest_level'); return;
    }
    if (loc.id === 'church_archive' && flags.archive_voice_quest_complete && !flags.covenant_author_quest_started) {
      queue('chancery_records_room'); return;
    }
    if (loc.id === 'archive_scriptorium' && !flags.covenant_author_quest_started
      && (flags.clue_voice_cannot_say_own_name || active.indexOf('c1q19') !== -1)) {
      queue('chancery_records_room'); return;
    }
    if (loc.id === 'tower_ash' && !flags.tower_ash_entered) {
      queue('tower_ash_approach'); return;
    }
  }

})();
