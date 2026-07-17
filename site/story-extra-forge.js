// Sanctum & Shadow — Chapter I extra scenes: forge
// c1q14 "The Forge of Judgment" (Stone V) — PRIMARY CLUE: clue_flame_is_traced_cross
// c1q16 "Allies or Enemies"          — PRIMARY CLUE: clue_rival_map_five_of_seven (+ clue_boss_is_a_person)
(function(){

  // ── local helpers (never assume the host page shape) ─────────────────────
  function give(item) {
    var inv = (typeof gameState !== 'undefined' && gameState.character && gameState.character.inventory) || null;
    if (inv && inv.indexOf(item) === -1) inv.push(item);
  }
  function once(flag, fn) {
    if (getFlag(flag)) return;
    setFlag(flag);
    fn();
  }
  function stonesSpokenCount() {
    var n = 0;
    if (getFlag('clue_well_syllable')) n++;
    if (getFlag('clue_voice_cannot_say_own_name')) n++;
    return n;
  }

  var S = {

  // ══════════════════════════════════════════════════════════════════════
  //  c1q14 — THE FORGE OF JUDGMENT
  //  The forge does not judge. It reverts a thing to what it was before it
  //  was renamed, and reforges that. Nobody here knows that is what it does.
  // ══════════════════════════════════════════════════════════════════════

  forge_of_judgment_arrival: () => {
    setFlag('forge_quest_started');
    setFlag('visited_stone_five'); // world state: the party has stood at the fifth marker
    return {
      location: 'The Merchant Road — The Bend Forge',
      locationIcon: '🔨',
      narration: `Six miles south of where the caravans died, the Crown's cobbles stop being Crown work. The stones get bigger, older, badly matched — and then there is a forge sitting in the bend of the road like it is the reason the road bends. No sign. No apprentice. The chimney has been smoking since before anybody's grandfather. The woman working the fire does not look up when armed strangers walk into her yard, which tells you more about the road than about her. Hessa Corl is sixty-odd, forearms like cable, and she is making nails. On the shelf behind her sits a crate of Church brass — altar sigils, door bosses, censer-hooks — waiting to be melted into something useful. The anvil she is working is not an anvil. It is a block of pale stone with an iron face bolted onto it, and whoever cut that stone was not thinking about anvils.`,
      sub: `The road calls it the Forge of Judgment. She calls it the forge.`,
      options: [
        { icon: '💬', label: '"They say you can make a weapon that kills what cannot otherwise die."',
          type: 'talk', action: () => runScene('forge_hessa_offer') },
        { icon: '🔍', label: 'Look under the iron face — at the stone the whole forge is built on', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            addLog('🔍 The block is pale, pre-Flame, and cut square by somebody who intended it to be seen from all four sides. The iron face is bolted on. The bolts are three hundred years newer than the stone.', 'system');
            runScene('forge_hessa_offer');
          },
          onFail: () => {
            addLog('It is a rock with an anvil on it. You are looking at a rock with an anvil on it.', 'system');
            runScene('forge_hessa_offer');
          } },
        { icon: '👁', label: 'Say nothing. Watch her work for a while.', type: 'explore',
          roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => {
            addLog('👁 She finishes a piece, turns it over once, and throws it back in the crate. Then another. Then another. She is not making nails out of that brass. She is failing to.', 'system');
            runScene('forge_the_trick');
          },
          onFail: () => runScene('forge_hessa_offer') },
        { icon: '🚶', label: 'Leave. It is a forge. You have a treaty to find.', type: 'move',
          action: () => runScene('vaelthar_main') },
      ]
    };
  },

  forge_hessa_offer: () => {
    setFlag('forge_heard_offer');
    var seenTrick = getFlag('clue_flame_is_traced_cross');
    var opts = [];

    opts.push({ icon: '💬', label: '"Where does a nail-smith get a recipe like that?"',
      type: 'talk', roll: { stat: 'CHA', dc: 13 },
      onSuccess: () => {
        addLog('📜 The recipe came with the forge, not the family. Hessa bought the land from a bank. The deed is older than the Church and has no seller\'s name on it — only a mark.', 'system');
        runScene(getFlag('clue_flame_is_traced_cross') ? 'forge_ingredient_hunt' : 'forge_the_trick');
      },
      onFail: () => {
        addLog('"Off the wall," she says. "It was here when I got here." She goes back to the nails.', 'system');
        runScene(getFlag('clue_flame_is_traced_cross') ? 'forge_ingredient_hunt' : 'forge_the_trick');
      } });

    if (!seenTrick) {
      opts.push({ icon: '🔨', label: 'Let her show you the thing she thinks is a defect.', type: 'explore',
        action: () => runScene('forge_the_trick') });
    } else {
      opts.push({ icon: '🔩', label: '"I know where the metal is and I know where the ash is. Start the fire."',
        type: 'move', action: () => runScene('forge_ingredient_hunt') });
    }

    opts.push({ icon: '💬', label: '"A name freely given. What does that cost me?"', type: 'talk',
      action: () => {
        addLog('"Nothing," Hessa says. "That\'s the trouble with it. People come out here expecting it to cost something, and then it doesn\'t, and then they don\'t do it."', 'narrator');
        runScene(getFlag('clue_flame_is_traced_cross') ? 'forge_ingredient_hunt' : 'forge_the_trick');
      } });

    opts.push({ icon: '🚶', label: 'Leave it on the wall where it has been for forty years.', type: 'move',
      action: () => runScene('vaelthar_main') });

    return {
      location: 'The Bend Forge — Hessa Corl',
      locationIcon: '🔨',
      narration: `She stops hammering, which is her whole reaction. "I can make it," Hessa says. "My master could have made it. His master could have made it. None of them ever did." She wipes her hands and points the rag at the wall, where a slate hangs beside the tongs, and the slate is already written, in a tradeswoman's flat hand, because she has been quoting this job for forty years and nobody has ever taken it.\n\n  — metal that was already a promise\n  — ash from something burned to hide it\n  — a name freely given, spoken over the quench\n\nUnder the three lines there is a rule, and under the rule there is a price in silver. It is an invoice. It has always been an invoice. "First two you can steal," Hessa says. "Third one's why the slate's still clean." Then she picks the crate of Church brass up with her boot and drags it over. "Before you pay me anything, you're going to watch something. So you don't come back later and tell people I didn't say."`,
      sub: `She is disclosing a known defect in her product. That is all she thinks this is.`,
      options: opts,
    };
  },

  // ── PRIMARY CLUE — c1q14 ────────────────────────────────────────────────
  forge_the_trick: () => {
    once('forge_trick_rewarded', () => {
      setFlag('clue_flame_is_traced_cross');
      addLog('📜 CLUE: The Eternal Flame\'s sigil is a cross with the crossbar drawn out into a torch — the tracing still visible in the metal. The Church did not replace the old faith. It traced it.', 'holy');
      grantXP(120);
      grantHolyPoints(3);
    });
    var opts = [];

    opts.push({ icon: '🔍', label: 'Look at the crossbar properly. At the place where the tracing stops.',
      type: 'explore', roll: { stat: 'WIS', dc: 12 },
      onSuccess: () => {
        addLog('🔍 The flame is drawn OVER the top arm, not instead of it. And whoever cut the original mould pressed harder on the thing underneath than on the thing on top. Handwriting under handwriting. The confident line is the cross.', 'holy');
        if (getFlag('clue_palm_symbol_is_overdrawn')) {
          addLog('🔍 You have seen this exact overdrawing twice already: on fourteen children\'s palms, and on the hands of the caravan dead.', 'holy');
        }
        runScene(getFlag('forge_heard_offer') ? 'forge_ingredient_hunt' : 'forge_hessa_offer');
      },
      onFail: () => {
        addLog('It is a cross with a torch on it. Beyond that, it is warm and you are holding it wrong.', 'system');
        runScene(getFlag('forge_heard_offer') ? 'forge_ingredient_hunt' : 'forge_hessa_offer');
      } });

    opts.push({ icon: '💬', label: '"How many have come out like that?"', type: 'talk',
      action: () => {
        addLog('"Thirty years," Hessa says. "All of them. Every one." — And you never told anyone? She looks at you the way you would look at a man asking why you never reported that the sky is up. "It\'s a casting fault. It\'s in the mould." She drops it back in the crate with the others. There are a lot of others. "It\'s in everybody\'s mould."', 'narrator');
        runScene(getFlag('forge_heard_offer') ? 'forge_ingredient_hunt' : 'forge_hessa_offer');
      } });

    if (getFlag('forge_heard_offer')) {
      opts.push({ icon: '🔩', label: '"Make me the weapon. I know where the first two are."', type: 'move',
        action: () => runScene('forge_ingredient_hunt') });
    } else {
      opts.push({ icon: '💬', label: '"Forget the brass. They say you can make a weapon."', type: 'talk',
        action: () => runScene('forge_hessa_offer') });
    }

    opts.push({ icon: '🚶', label: 'Put it down. Walk out. It is a casting fault.', type: 'move',
      action: () => runScene('vaelthar_main') });

    return {
      location: 'The Bend Forge — The Crate',
      locationIcon: '🔥',
      narration: `She takes an altar sigil off the top of the crate without looking at it — the Eternal Flame's torch in cast brass, the same one bolted to every church door, every alms box and every gate in the realm — and puts it in the fire. She works it maybe four minutes. She is not doing anything clever. She is doing what a smith does to brass.\n\nWhat comes off the stone is a cross. A plain one. Four arms, one arm longer, no ornament. And drawn out of the top arm, half-finished, is the torch: the crossbar pulled and thinned and turned up into a flame, the tool-marks of the original tracing still sitting in the metal like handwriting under handwriting.\n\nHessa turns it over once. "Does that," she says. "Means it was made from something."`,
      sub: `She has been throwing these back in the crate for thirty years. It is a defect. It is in the mould.`,
      options: opts,
    };
  },

  forge_ingredient_hunt: () => {
    var hasMatrix = getFlag('has_seal_matrix');
    var hasAsh = getFlag('has_signing_hall_ash');
    var opts = [];

    if (!hasMatrix) {
      opts.push({ icon: '🔩', label: 'Lever the beam up. Get the seal matrix out from under it.',
        type: 'explore', roll: { stat: 'STR', dc: 12 },
        onSuccess: () => {
          setFlag('has_seal_matrix');
          give('The Covenant Seal Matrix');
          addLog('🔩 ITEM GAINED: The Covenant Seal Matrix — the iron die the wax was pressed from. The object that made a promise official.', 'holy');
          runScene('forge_ingredient_hunt');
        },
        onFail: () => {
          setFlag('has_seal_matrix');
          setFlag('seen_at_the_hall');
          give('The Covenant Seal Matrix');
          addLog('🔩 The beam goes. The noise crosses the street before you do. You have the matrix in your fist and two men coming at you across the cobbles who have been waiting three days for somebody to do exactly this.', 'combat');
          startCombat([
            generateEnemy('church_agent', 3),
            generateEnemy('church_agent', 3),
          ], { victoryScene: 'forge_ingredient_hunt' });
        } });
    }

    if (!hasAsh) {
      opts.push({ icon: '🫙', label: 'Take the ash. Carefully. Do not breathe.',
        type: 'explore', roll: { stat: 'DEX', dc: 11 },
        onSuccess: () => {
          setFlag('has_signing_hall_ash');
          give('Jar of Signing-Hall Ash');
          addLog('🫙 ITEM GAINED: Jar of Signing-Hall Ash — it still holds the grain of the tabletop. Ash from something burned to hide it.', 'holy');
          runScene('forge_ingredient_hunt');
        },
        onFail: () => {
          setFlag('has_signing_hall_ash');
          give('Jar of Signing-Hall Ash');
          addLog('🫙 You breathe. Half the table is in the air and some of it is in your mouth and it tastes of nothing at all. You take what is left. It is enough. It was only ever going to be enough.', 'system');
          runScene('forge_ingredient_hunt');
        } });
    }

    if (hasMatrix && hasAsh) {
      opts.push({ icon: '🔥', label: 'Take them back to Hessa.', type: 'move',
        action: () => runScene('forge_the_quench') });
    }

    if (!getFlag('hall_watchers_handled')) {
      opts.push({ icon: '👁', label: 'The two men in the doorway. Ask them what they are waiting for.',
        type: 'talk', roll: { stat: 'CHA', dc: 13 },
        onSuccess: () => {
          setFlag('hall_watchers_handled');
          addLog('💬 "Orders," the older one says, and does not say whose. "We\'re not to stop anybody. We\'re to write down who comes." He shows you the book. There are four names in it and three of them are crossed out. He does not write yours down. He looks tired enough that you believe him.', 'narrator');
          runScene('forge_ingredient_hunt');
        },
        onFail: () => {
          setFlag('hall_watchers_handled');
          setFlag('seen_at_the_hall');
          addLog('⚔ The younger one has his hand inside his coat before you finish the sentence.', 'combat');
          startCombat([
            generateEnemy('church_agent', 3),
            generateEnemy('church_agent', 3),
          ], { victoryScene: 'forge_ingredient_hunt' });
        } });
    }

    opts.push({ icon: '🚶', label: 'Leave it. Some things should stay burned.', type: 'move',
      action: () => runScene('vaelthar_main') });

    return {
      location: 'Covenant Signing Hall — Ruins',
      locationIcon: '🏛',
      threat: '⚠ Watched',
      narration: `Three days and nobody has swept it. Not the Crown, not the Church, not the Watch — because the first man to sweep it owns whatever he finds in it, and nobody in Vaelthar wants to own this. The ceremonial table is a shape in the ash now, a long grey rectangle holding its own outline out of sheer inertia. Pinned under a collapsed ceiling beam, blackened but whole: the seal matrix. Not a seal — the die the seals were pressed from. The thing that made promises official.\n\nAcross the street, two men have been standing in a doorway for an hour without buying anything.`,
      sub: `Metal that was already a promise. Ash from something burned to hide it. Both in one room.`,
      options: opts,
    };
  },

  forge_the_quench: () => {
    return {
      location: 'The Bend Forge — The Quench-Trough',
      locationIcon: '🔨',
      narration: `It takes her a day and a half and she does not talk while she does it. The matrix goes into the crucible with road-iron and comes out as nothing recognisable, which she says is the point. The ash she stirs in with a stick, swearing steadily, because ash does not want to go into metal and metal does not want it.\n\nWhat is on the bench at the end is not beautiful. No fuller, no maker's mark, no name cut into the tang. It looks like a knife you would buy for cutting rope, and Hessa is not proud of it, because there is nothing in it to be proud of yet.\n\nThe trough is full. The water is cold and grey and has a leaf in it. She holds the blade over it and waits.\n\n"Last one," she says. "Say your name over the water. Not a name. Yours. Out loud, and mean it, and nobody makes you."\n\nBehind her, the slate. Three lines, a rule, a price. Forty years on the same wall.`,
      sub: `She is not asking for anything. That is precisely what the clause requires.`,
      options: [
        { icon: '🗣', label: 'Say your name over the water.', type: 'talk',
          action: () => runScene('forge_blade_made') },
        { icon: '🔍', label: 'Read the slate again. The exact wording of the third line.',
          type: 'explore', roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            addLog('📜 Not "a name." Not "the smith\'s name." A name FREELY GIVEN. That is not how a smith writes. That is how a clause is drafted — by somebody who knew that a name taken would not work, and who bothered to say so, a very long time ago, in writing.', 'holy');
            runScene('forge_the_quench');
          },
          onFail: () => {
            addLog('It is chalk on slate. It says what it says.', 'system');
            runScene('forge_the_quench');
          } },
        { icon: '💬', label: '"Can it be anyone\'s name?"', type: 'talk',
          action: () => {
            addLog('"Freely given," Hessa says. "That\'s the whole clause. You can\'t give me what isn\'t yours." She shifts the blade to her off hand. "People have tried. I stopped letting them about twenty years ago. It\'s not that it doesn\'t work. It\'s that they never came back for it."', 'narrator');
            runScene('forge_the_quench');
          } },
        { icon: '🚶', label: 'Say nothing.', type: 'move',
          action: () => runScene('forge_walk_away') },
      ]
    };
  },

  forge_blade_made: () => {
    once('forge_blade_rewarded', () => {
      setFlag('has_unnaming_blade');
      setFlag('gave_own_name_to_forge');
      give('The Blade With Your Name In It');
      addLog('🗡 ITEM GAINED: The Blade With Your Name In It — metal that was already a promise; ash from something burned to hide it; a name freely given.', 'holy');
      grantXP(180);
    });
    var opts = [];
    opts.push({ icon: '💬', label: '"What does it actually do?"', type: 'talk',
      action: () => {
        addLog('"Takes a thing back to before somebody renamed it," Hessa says. "Then I hit it. Or you do." She racks her tongs. "On a person? Never tried it on a person. Nobody has. That\'s not a warning, it\'s an inventory."', 'narrator');
        runScene('forge_blade_made');
      } });
    opts.push({ icon: '📜', label: 'Ask her to total the invoice.', type: 'talk',
      action: () => {
        addLog('She looks at the slate for a while. Then she takes the rag off her shoulder and wipes it — the whole thing, three lines and the rule and the price — for the first time in forty years. "Nothing," she says. "You already paid."', 'narrator');
        runScene('forge_blade_made');
      } });
    if (!getFlag('rival_company_noticed')) {
      opts.push({ icon: '👁', label: 'Outside, someone is standing at the bend who was not there when you went in.',
        type: 'explore', action: () => runScene('rival_company_shadow') });
    }
    opts.push({ icon: '🚶', label: 'Take it and go.', type: 'move',
      action: () => runScene('vaelthar_main') });

    return {
      location: 'The Bend Forge — The Quench-Trough',
      locationIcon: '🗡',
      narration: `You say it. Out loud, over the water, and you mean it, because she asked you to and there is no reason in the world not to.\n\nThe blade goes in. It hisses exactly as much as hot iron hisses and no more. Steam. The stink of the trough. The leaf goes round twice. Hessa lifts it out, sights down the edge with one eye shut the way she has done ten thousand times, and hands it to you grip-first because she is a professional.\n\n"That's it," she says. "Don't put a name on it. It's got one in it already."`,
      sub: `It looks like a knife. It looks like any knife.`,
      options: opts,
    };
  },

  forge_walk_away: () => {
    once('forge_walkaway_rewarded', () => {
      setFlag('refused_the_forge');
      give('Hessa\'s Knife');
      addLog('🔪 ITEM GAINED: Hessa\'s Knife — a very good knife. Nothing else.', 'system');
      grantXP(180);
    });
    var opts = [];
    opts.push({ icon: '🔨', label: '"Start again. I\'ll say it."', type: 'talk',
      action: () => { setFlag('has_seal_matrix'); setFlag('has_signing_hall_ash'); runScene('forge_the_quench'); } });
    if (!getFlag('rival_company_noticed')) {
      opts.push({ icon: '👁', label: 'Outside, someone is standing at the bend who was not there when you went in.',
        type: 'explore', action: () => runScene('rival_company_shadow') });
    }
    opts.push({ icon: '🚶', label: 'Take the plain knife and go.', type: 'move',
      action: () => runScene('vaelthar_main') });

    return {
      location: 'The Bend Forge — The Quench-Trough',
      locationIcon: '🔪',
      narration: `You don't say it. Hessa waits — the way she has waited forty years, which is to say without any particular interest — and then she puts the blade in the water anyway, because it is hot and it is going to warp.\n\nIt comes out a blade. A good one. A very good one, honestly, given what she had to work with. It will cut a man exactly as well as any other good knife and no better, and she knows it before it is dry.\n\n"Fair enough," she says, and racks her tongs. "If you change your mind I'll start again. I'm not busy." She is not disappointed. If anything there is something in her face that was not there before, and it takes you two miles up the road to recognise it as relief.`,
      sub: `Nothing happened. That is the entire event.`,
      options: opts,
    };
  },

  // ══════════════════════════════════════════════════════════════════════
  //  c1q16 — ALLIES OR ENEMIES
  //  They are not rivals. They are doing the same arithmetic, and they are
  //  behind you, and their captain has exactly one question.
  // ══════════════════════════════════════════════════════════════════════

  rival_company_shadow: () => {
    setFlag('rival_company_noticed');
    return {
      location: 'The Tarnished Cup — The Bar',
      locationIcon: '🍺',
      narration: `Lyra does not slide the paper down the bar. She walks it round and puts it in front of you, which is different, and then she stays, which is very different.\n\n"Woman left this. Yesterday." She wipes a glass she has already wiped. "She's been in three times since you started drinking here. Always about two hours after you go out. Never asks a question. Pays for a room she doesn't sleep in. Last time she left a coin on the bar for a drink she didn't order." Lyra sets the glass down. "Eleven of them. No banner, no contract board, no trouble. They were at Mol. They were at the Gate. They were here." She looks at you properly. "I have had every kind of person in this room. I don't know what that one is."\n\nThe note is one line, no signature, in a hand better than yours: *Midnight. The old milestone north of the gate. Come alone. I will be alone. — S. Vell*`,
      sub: `Eleven of them. They pay their tab. They have been two hours behind you for a fortnight.`,
      options: [
        { icon: '👁', label: 'Don\'t wait for midnight. Track them backwards — find their camp before dark.',
          type: 'explore', roll: { stat: 'WIS', dc: 13 },
          onSuccess: () => { setFlag('rival_came_alone'); runScene('rival_camp_tracked'); },
          onFail: () => {
            setFlag('rival_came_alone');
            setFlag('rival_track_failed');
            addLog('👁 You walk a circle for six hours. Whoever taught them to move taught them properly. You arrive at the stone at midnight with nothing but sore feet and the note.', 'system');
            runScene('rival_midnight_meeting');
          } },
        { icon: '🕛', label: 'Keep the meeting. Alone, as asked.', type: 'move',
          action: () => { setFlag('rival_came_alone'); runScene('rival_midnight_meeting'); } },
        { icon: '⚔', label: 'Keep the meeting. Put your people in the treeline.', type: 'move',
          action: () => { setFlag('rival_brought_the_party'); runScene('rival_midnight_meeting'); } },
        { icon: '🔥', label: 'Burn the note. You have a treaty to find.', type: 'move',
          action: () => {
            setFlag('rival_note_burned');
            addLog('🔥 You burn it in the candle. Lyra watches you do it and says nothing, which from Lyra is a review. Another note will come. They always do.', 'system');
            runScene('vaelthar_main');
          } },
      ]
    };
  },

  rival_camp_tracked: () => {
    setFlag('rival_camp_found');
    return {
      location: 'Two Miles North of the Gate — A Camp With No Banner',
      locationIcon: '⛺',
      narration: `You find it an hour before dusk, and you only find it because somebody dropped a chain link.\n\nEleven bedrolls in a ring, cold-camped. No colours. No dice, no bottles, no rubbish pit. Against a tree: a surveyor's chain, coiled properly; a plumb line; a bundle of stakes, sharpened and counted. Whatever this is, it is not a company. It is a survey.\n\nThe mess kettle is upside down on a stone. On the underside of the lid, scratched with a knife point and small enough that you would only ever see it while washing up, is a cross.`,
      sub: `Nobody is here. They are all out being two hours behind you.`,
      options: [
        { icon: '🔍', label: 'Go through it. Ledgers, orders, anything with a name on it.',
          type: 'explore', roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            setFlag('rival_camp_searched');
            setFlag('rival_employer_is_a_letter');
            addLog('📜 Their expense ledger: a retainer, paid quarterly, drawn on a Vaelthar counting-house against a standing instruction. No employer\'s name anywhere in the book. The instruction letter is pinned to the inside cover. It is beautiful handwriting. It is chancery handwriting.', 'holy');
            runScene('rival_midnight_meeting');
          },
          onFail: () => {
            setFlag('rival_camp_searched');
            addLog('🔍 The ledger tells you they buy a lot of chalk. On the way out you knock the kettle off the stone and put the lid back on the wrong angle, and you know it, and you leave it.', 'system');
            runScene('rival_midnight_meeting');
          } },
        { icon: '👁', label: 'Touch nothing. Look, count, leave it exactly as you found it.',
          type: 'explore', roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => {
            setFlag('rival_camp_left_clean');
            addLog('👁 Eleven bedrolls. Seven bundles of stakes cut and bound, five of them opened. You put the kettle lid back on the angle it was on and you go.', 'holy');
            runScene('rival_midnight_meeting');
          },
          onFail: () => {
            setFlag('rival_camp_searched');
            addLog('👁 Seven bundles of stakes, five opened — and then your boot goes through the ash of the fire and there is no putting that back.', 'system');
            runScene('rival_midnight_meeting');
          } },
        { icon: '🚶', label: 'Enough. Be at the stone at midnight.', type: 'move',
          action: () => runScene('rival_midnight_meeting') },
      ]
    };
  },

  // ── PRIMARY CLUE — c1q16 ────────────────────────────────────────────────
  rival_midnight_meeting: () => {
    var brought = getFlag('rival_brought_the_party');
    var spoken = stonesSpokenCount();
    var opts = [];

    if (!brought) {
      once('rival_map_seen', () => {
        setFlag('clue_rival_map_five_of_seven');
        addLog('📜 CLUE: Vell\'s company has independently surveyed five of seven points. Two sheets are drawn, numbered and blank. Somebody else is counting to seven — and they are behind you.', 'holy');
        grantXP(140);
      });
    } else {
      opts.push({ icon: '🔍', label: 'The map is folded under her hand. Read what you can of it anyway.',
        type: 'explore', roll: { stat: 'INT', dc: 14 },
        onSuccess: () => {
          once('rival_map_seen', () => {
            setFlag('clue_rival_map_five_of_seven');
            addLog('📜 CLUE: You get the corner of it before she moves her hand. Five points surveyed with bearings and a scale bar. Two more sheets under them, numbered six and seven, and blank.', 'holy');
            grantXP(140);
          });
          runScene('rival_midnight_meeting');
        },
        onFail: () => {
          addLog('She moves her hand onto it without looking at you. "No," she says, the way you would say it to a dog.', 'system');
          runScene('rival_midnight_meeting');
        } });
    }

    opts.push({ icon: '💬',
      label: spoken === 0
        ? '"None. Nothing has spoken to me from anywhere." — Tell her the truth.'
        : '"' + spoken + '." — Tell her the truth.',
      type: 'talk',
      action: () => { setFlag('answered_vell_honestly'); runScene('rival_company_allies'); } });

    opts.push({ icon: '💬', label: '"Seven." — Lie. See what she does with it.',
      type: 'talk', roll: { stat: 'CHA', dc: 15 },
      onSuccess: () => {
        setFlag('lied_to_vell');
        addLog('🎭 She goes very still. "Then you\'re ahead of me," she says, "and you\'re lying, and I can\'t tell which of those is the useful one." She writes it down anyway.', 'narrator');
        runScene('rival_company_allies');
      },
      onFail: () => {
        addLog('She lets the silence run about four seconds too long. "Seven," she repeats, and folds the map. "No. You\'d be dead."', 'combat');
        runScene('rival_company_enemies');
      } });

    opts.push({ icon: '⚔', label: 'She is alone, at midnight, and she has been behind you for a fortnight.',
      type: 'combat',
      action: () => {
        setFlag('attacked_serai_vell');
        startCombat([
          { name: 'Captain Serai Vell', hp: 85, ac: 16, atk: 7, icon: '🏹', id: 'serai_vell',
            xp: 400, level: 4, tacticalRole: 'ranged', spells: ['savage_bite'], flee: false, boss: false },
        ], { victoryScene: 'rival_company_enemies' });
      } });

    opts.push({ icon: '🚶', label: 'Say nothing. Walk back to the gate.', type: 'move',
      action: () => runScene('rival_company_enemies') });

    var narration;
    if (brought) {
      narration = `She is standing, not sitting, and her bow is strung, and the map on the stone is folded. She counted your people out of the treeline before you finished crossing the field, and she is not angry about it, which is worse.\n\n"I said alone," Serai Vell says. "I said I'd be alone. I was." She taps the folded map once with two fingers. "This was for whoever sat down."\n\nShe is maybe thirty-five, weathered like a woman who works outdoors and sleeps outdoors and has decided that is fine. She turns the lamp down to nothing. Then, because she needs the answer more than she needs the point she has just made, she asks anyway.\n\n"One question. How many stones has it spoken to you from?"`;
    } else {
      narration = `The milestone is Crown work and it is not old. The thing it was set beside is old.\n\nSerai Vell is sitting on the base with her hands where you can see them and her bow unstrung across her knees. Restringing a bow takes about four minutes. Leaving it unstrung at midnight, in a field, with strangers walking towards you, is therefore a complete sentence.\n\nShe has a lamp turned down to nothing and a map spread on the stone with a rock on each corner, and when you arrive she does not fold it. That is the first thing you notice. The second thing you notice is what is on it: five points, surveyed properly — bearings, distances, a scale bar drawn in — and under them two more sheets, numbered six and seven, and blank.\n\n"Sit down," she says. "I've got one question and then you can go."`
        + (getFlag('rival_camp_left_clean')
          ? `\n\n"Somebody was in my camp today and put my kettle lid back the way they found it. That's why I'm still sitting down."`
          : getFlag('rival_camp_searched')
            ? `\n\n"Somebody was in my camp today and put my kettle lid back wrong. I sat down anyway. Don't make me regret the arithmetic."`
            : '')
        + `\n\n"How many stones has it spoken to you from?"`;
    }

    return {
      location: 'The Old Milestone, North of the Gate — Midnight',
      locationIcon: '🕛',
      threat: brought ? '⚠ She counted them' : null,
      narration: narration,
      sub: `It is not the question you prepared for. She only wants the number.`,
      options: opts,
    };
  },

  rival_company_allies: () => {
    once('rival_allies_rewarded', () => {
      setFlag('vell_company_allied');
      setFlag('clue_boss_is_a_person');
      addLog('📜 CLUE: Vell\'s company does not want to seal the thing in the Tower. They want to let it go. And she did not say "it." She said "him."', 'holy');
      if (!getFlag('rival_brought_the_party')) give('Vell\'s Traced Copy — Five of Seven');
      grantXP(200);
      grantHolyPoints(5);
    });
    var spoken = stonesSpokenCount();
    var opts = [];

    opts.push({ icon: '💬', label: '"Your employer. Give me a name. One try."',
      type: 'talk', roll: { stat: 'CHA', dc: 16 },
      onSuccess: () => {
        addLog('💬 She stops. She actually thinks about it, which is not what you expected. "If I knew," Serai says, "I\'d tell you. Gladly. I\'d like somebody else to carry it." Then she walks.', 'narrator');
        runScene('vaelthar_main');
      },
      onFail: () => { addLog('She keeps walking. She does not even shrug.', 'system'); runScene('vaelthar_main'); } });

    if (!getFlag('forge_quest_started')) {
      opts.push({ icon: '🔨', label: '"Point five. You said it\'s a forge in a bend on the Merchant Road."',
        type: 'move', action: () => runScene('forge_of_judgment_arrival') });
    }

    opts.push({ icon: '🚶', label: 'Walk back to the gate. Think about the word "him" the whole way.',
      type: 'move', action: () => runScene('vaelthar_main') });

    return {
      location: 'The Old Milestone — Midnight',
      locationIcon: '🏹',
      narration: `You tell her. She takes it the way a surveyor takes a bearing: writes it down, does not react.\n\n"${spoken === 0 ? 'None' : spoken}," she says. "I'm at three." She lets that sit exactly as long as it needs to. Then: "You want to know why alone. My contract has a clause. I don't discuss the work in front of your people." A beat. "Not in front of anyone. In front of *your people*. Somebody drafted that clause knowing you had people, and knowing what they're called."\n\nWho is your employer? — "It's a letter. Quarterly retainer, drawn proper, never late. I've never met him." She almost smiles. "The hand's very good. Chancery hand, actually. Whoever writes my orders writes them for a living."\n\nShe rolls the map, and hands you a second one from inside her coat. "Traced it this afternoon. I was going to give it to you either way."\n\nThen she stands and strings the bow, and she does it while she is talking, which is the second sentence.\n\n"One more, since you sat down. Everybody we've met who's got this far wants to seal it." She shoulders the case. "We don't want to seal it. We want to let it go. You'll understand when you meet him."\n\n*It?*\n\nShe is already walking. Over her shoulder, without turning:\n\n"Him."`,
      sub: `She said it the way you say a person's name when you don't have one.`,
      options: opts,
    };
  },

  rival_company_enemies: () => {
    var killed = getFlag('attacked_serai_vell');
    once('rival_enemies_rewarded', () => {
      setFlag('vell_company_hostile');
      if (killed) {
        setFlag('killed_serai_vell');
        setFlag('clue_boss_is_a_person');
        give('Vell\'s Instruction Letter (chancery hand, unsigned)');
        addLog('📜 CLUE: Her orders, on her body: "...you will find them ahead of you. Do not correct them. You will understand when you meet him." The letter is unsigned. The hand is chancery.', 'holy');
        grantHellPoints(5);
      } else {
        setFlag('vell_company_cold');
      }
      grantXP(200);
    });
    var opts = [];

    if (!getFlag('forge_quest_started')) {
      opts.push({ icon: '🔨', label: 'Her fifth point is marked on the road south. A forge, in a bend.',
        type: 'move', action: () => runScene('forge_of_judgment_arrival') });
    }
    opts.push({ icon: '🚶', label: 'Go back to the gate.', type: 'move',
      action: () => runScene('vaelthar_main') });
    opts.push({ icon: '👁', label: 'Look north, at the dark, for a while.', type: 'explore',
      roll: { stat: 'WIS', dc: 10 },
      onSuccess: () => {
        addLog('👁 Nothing moves out there. Nothing is going to. They are not coming for you. They are going to keep doing the survey, two hours behind you, for as long as it takes, and that is the part you will think about at three in the morning.', 'system');
        runScene('vaelthar_main');
      },
      onFail: () => runScene('vaelthar_main') });

    var narration = killed
      ? `She is a very good archer and she is one person at midnight, and there is no version of that arithmetic where she wins it. She knows the answer before you do. She does not run, and she does not ask you to stop, and she does not say anything at all after the first exchange.\n\nIn her coat: a folded instruction letter. Quarterly retainer, drawn on a Vaelthar counting-house, no employer's name anywhere on it. Beautiful handwriting. And a line near the bottom that you read three times standing over her:\n\n*"...you will find them ahead of you. Do not correct them. You will understand when you meet him."*\n\nThe map on the stone is still weighted down with four rocks. Five points, surveyed properly. Two blank sheets, numbered.\n\nAnd the worst of it comes later, and slowly: the other ten do not come for you. Not at Mol. Not at the Gate. They keep surveying. Two hours behind, every time, and now nobody is going to sit down and tell you the number.`
      : `She folds the map. She is not angry, which is somehow the whole problem.\n\n"Right," Serai says. "Then you're not at the stage where the question means anything yet." She strings the bow while she says it, which takes four minutes, and she says nothing for all four of them, and neither do you.\n\n"We'll be behind you. We were always going to be behind you."\n\nAnd they are. At Mol, three hours. At the Gate, an afternoon. They never speak to you again. They never once get in your way. And at every stone you reach from now on, somebody has already put a stake in the ground beside it, and measured, and gone.`;

    return {
      location: 'The Old Milestone, North of the Gate — Midnight',
      locationIcon: killed ? '🩸' : '🏹',
      threat: killed ? '☠ Done' : null,
      narration: narration,
      sub: killed ? `Eleven of them. Ten now. They are still counting.` : `They are still counting. They are just not counting for you.`,
      options: opts,
    };
  },

  };

  // ── register scenes ──────────────────────────────────────────────────────
  if (typeof SCENES !== 'undefined') Object.assign(SCENES, S);
  if (typeof window !== 'undefined') { window.SCENES = window.SCENES || SCENES; Object.assign(window.SCENES, S); }

  // ── world hooks: additive, composition-safe. Wrap an existing hub scene and
  //    append entry options. Capturing `prev` means another extras file that
  //    wraps the same scene composes with this one instead of clobbering it.
  function appendOptions(sceneId, build) {
    var target = (typeof window !== 'undefined' && window.SCENES) || (typeof SCENES !== 'undefined' ? SCENES : null);
    if (!target || !target[sceneId]) return;
    var prev = target[sceneId];
    target[sceneId] = function () {
      var built = (typeof prev === 'function') ? prev() : Object.assign({}, prev);
      if (!built) return built;
      var extra = [];
      try { extra = build() || []; } catch (e) { extra = []; }
      if (extra.length) built.options = (built.options || []).concat(extra);
      return built;
    };
  }

  appendOptions('vaelthar_main', function () {
    var out = [];
    if (!getFlag('rival_company_noticed')) {
      out.push({ icon: '👁', label: 'Lyra has been holding a note for you since yesterday.', type: 'talk',
        action: () => runScene('rival_company_shadow') });
    }
    if (!getFlag('forge_quest_started')) {
      out.push({ icon: '🔨', label: 'The road south — the smith they say judges what she reforges.', type: 'move',
        action: () => runScene('forge_of_judgment_arrival') });
    }
    return out;
  });

  appendOptions('tarnished_cup_arrival', function () {
    if (getFlag('rival_company_noticed')) return [];
    return [{ icon: '👁', label: 'Lyra is holding a folded note and has not put it down.', type: 'talk',
      action: () => runScene('rival_company_shadow') }];
  });

  appendOptions('merchant_road_investigation', function () {
    if (getFlag('forge_quest_started')) return [];
    return [{ icon: '🔨', label: 'Six miles south the road bends around a forge that has no sign.', type: 'move',
      action: () => runScene('forge_of_judgment_arrival') }];
  });

})();
