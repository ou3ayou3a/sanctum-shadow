// Sanctum & Shadow — Chapter I extra scenes: children
// c1q8  — The Ambassador's Confession  (main, 250)
// c1q10 — The Children Who Remember Nothing (main, 280)
//
// Clue ledger obligations (Twist Bible §3):
//   c1q8  PRIMARY      clue_seventh_clause_exists   — Ostrene exemplar, Eighth Covenant, page one carries SEVEN clauses
//   c1q8  CORROBORATOR clue_covenant_expires        — Halven: it broke on a schedule; Varek is why it will not be mended
//   c1q10 PRIMARY      clue_children_hymn           — the Sevenfold Benediction, seven lines, capitals as printed
//   c1q10 CORROBORATOR clue_palm_symbol_is_overdrawn — the palm mark is a torch drawn OVER something unreadable
// Nothing else in these quests is a clue.

(function(){

  // Scenes here are re-enterable (failed rolls loop back, the page-four option
  // deliberately re-runs its own scene). Never hand out the same item twice.
  function addItemOnce(item) {
    const inv = (typeof gameState !== 'undefined' && gameState.character) ? gameState.character.inventory : null;
    if (!inv || typeof inv.indexOf !== 'function') return;
    if (inv.indexOf(item) === -1) inv.push(item);
  }

  const COLLATION_NOTES = 'Collation Notes: Page One, Eighth Covenant (seven clauses)';
  const HYMN_TRANSCRIPT = 'Transcript: The Sevenfold Benediction (as recited by the fourteen)';
  const PALM_RUBBING = 'Rubbing: The Overdrawn Palm Mark';

  const S = {

    // ══════════════════════════════════════════════════════════════
    //  c1q8 — THE AMBASSADOR'S CONFESSION
    //  Ostrene never took the Flame, so Ostrene's archive never redacted.
    // ══════════════════════════════════════════════════════════════

    ambassador_summons: () => {
      setFlag('ambassador_quest_started');
      return {
        location: 'Vaelthar — Fennow Row',
        locationIcon: '🏛',
        threat: '⚠ Diplomatic',
        narration: `A boy hands you a folded note and doesn't wait for a coin. Ostrene chancery paper — heavy, ruled, the kind of stock a nation buys by the crate. Inside, eight words in a hand that shook: "Come to the legation. Tomorrow is not certain." It is signed Oret Halven, Ambassador of Ostrene, and the wax has been broken and pressed shut again. Somebody read this before you did, and they were not careful enough to hide it, or they were not worried enough to try.`,
        sub: `Ostrene is the only neighbour that never took the Flame. Their ambassador is dying and he wants you specifically.`,
        options: [
          { icon: '🗺', label: 'Go to the legation now — tomorrow is not certain', type: 'move',
            action: () => runScene('ambassador_bedside') },
          { icon: '🔍', label: 'Examine the reseal — whose wax is under the Ostrene wax?', type: 'explore',
            roll: { stat: 'WIS', dc: 13 },
            onSuccess: () => { setFlag('note_was_read_by_church'); addLog('📜 The under-layer is Church chancery wax — a filing seal, not a spy\'s. Someone read it, stamped it, and filed the fact that they read it. That is worse.', 'system'); runScene('ambassador_bedside'); },
            onFail: () => { addLog('The wax tells you nothing but that it was warm twice.', 'system'); runScene('ambassador_bedside'); } },
          { icon: '💬', label: 'Ask around about Ostrene before you walk in blind', type: 'talk',
            roll: { stat: 'INT', dc: 12 },
            onSuccess: () => { setFlag('knows_ostrene_never_flamed'); addLog('📜 Ostrene refused the Flame four centuries ago and has been politely unimportant ever since. Consequence: no Ostrene document has ever been redacted by a Church clerk.', 'holy'); runScene('ambassador_bedside'); },
            onFail: () => { addLog('Nobody in the wool market has an opinion about Ostrene. That is roughly Ostrene\'s whole foreign policy.', 'system'); runScene('ambassador_bedside'); } },
          { icon: '⏭', label: 'Not today — a dying foreigner can wait', type: 'move',
            action: () => { addLog('You put the note in your coat. It stays there, getting heavier.', 'system'); runScene('vaelthar_main'); } },
        ]
      };
    },

    ambassador_bedside: () => {
      setFlag('clue_covenant_expires');
      addLog('📜 CLUE: Ambassador Halven — "It was not your Elder. Your Elder burned a copy of a copy. The Covenant broke on a schedule."', 'holy');
      return {
        location: 'The Ostrene Legation — Upper Room',
        locationIcon: '🏛',
        threat: '⚠ A Dying Man',
        narration: `The room smells of vinegar and paper. Ambassador Oret Halven is propped upright because lying flat has stopped working, and he is the colour of the sheets. A woman in grey Ostrene chancery dress stands at the bed-foot with a ledger open on her forearm — Undersecretary Rane, who has clearly not slept and has clearly not stopped writing. Halven looks at you for a long moment, deciding whether you are worth the breath. Then he spends it. "I know who broke the Covenant," he says. "It was not your Elder. Your Elder burned a copy of a copy." He stops to find more air. "The Covenant broke on a schedule. And your Elder is why it will not be mended."`,
        sub: `He is not accusing anyone. He is correcting you.`,
        options: [
          { icon: '💬', label: '"Then who did break it? Give me a name."', type: 'talk',
            roll: { stat: 'CHA', dc: 14 },
            onSuccess: () => runScene('ambassador_last_words'),
            onFail: () => runScene('ambassador_dies_silent') },
          { icon: '💬', label: '"A schedule? Treaties do not have schedules."', type: 'talk',
            action: () => runScene('ambassador_last_words') },
          { icon: '🔍', label: 'Look at him properly — is this an illness or a poisoning?', type: 'explore',
            roll: { stat: 'INT', dc: 12 },
            onSuccess: () => runScene('ambassador_poison_check'),
            onFail: () => { addLog('You cannot tell. Dying looks like dying.', 'system'); runScene('ambassador_dies_silent'); } },
          { icon: '🕯', label: 'Sit down. Stop interrogating a dying man.', type: 'talk',
            action: () => { setFlag('rane_trusts_you'); grantHolyPoints(5); addLog('📜 You sit. Halven stops performing and just breathes. Undersecretary Rane watches you do it and writes nothing down. +5 Holy Points.', 'holy'); runScene('ambassador_last_words'); } },
        ]
      };
    },

    ambassador_poison_check: () => {
      setFlag('knows_ambassador_not_murdered');
      return {
        location: 'The Ostrene Legation — Upper Room',
        locationIcon: '🏛',
        narration: `You were expecting a poisoning. You wanted a poisoning — a poisoning has a hand behind it and a hand can be found and broken. What you get is a physician's day-book on the side table, fourteen months of it, kept in three different hands across two countries. The same wasting, named early, treated properly, and entirely indifferent to being named. No blackened gums. No sweetness on the breath. Nothing under the nails. Nobody silenced Ambassador Halven. He simply ran out, on a schedule of his own, in a city that is about to do the same thing.`,
        sub: `Nobody is driving. That should be a relief. It is not.`,
        options: [
          { icon: '💬', label: 'Tell him what you were looking for. He has earned the honesty.', type: 'talk',
            action: () => { setFlag('rane_trusts_you'); addLog('Halven laughs, which costs him something. "You looked for a murderer in a sickroom. Your whole city does that."', 'system'); runScene('ambassador_last_words'); } },
          { icon: '💬', label: '"Fourteen months. So you knew you were dying when you came to sign."', type: 'talk',
            action: () => runScene('ambassador_last_words') },
        ]
      };
    },

    ambassador_last_words: () => {
      setFlag('ambassador_last_words_heard');
      grantXP(80);
      return {
        location: 'The Ostrene Legation — Upper Room',
        locationIcon: '🏛',
        narration: `"You are all reading the wrong end of it," Halven says. "Your Elder read it. Your Church read it. Your Crown read it four times and argued about the harbour dues." His hand moves an inch toward the chancery case on the table and stops there, because that is as far as it goes now. "Ostrene keeps counterparts. We keep everything, because nobody ever asked us to burn anything. Take ours. Look at the first page. Not the fourth — everyone reads the fourth — the first. Count the—" And that is where it ends. Not dramatically. Mid-word, the way a man puts down a pen. Undersecretary Rane closes the ledger, then closes his eyes, in that order, because she is a professional.`,
        sub: `He died pointing at a page. The chancery case is still on the table.`,
        options: [
          { icon: '📜', label: 'The case. He was pointing at the case.', type: 'explore',
            action: () => runScene('ambassador_strongbox') },
          { icon: '💬', label: 'Give Rane a moment before you touch anything of his', type: 'talk',
            action: () => { setFlag('rane_trusts_you'); grantHolyPoints(3); addLog('📜 You wait. Rane finishes what she has to finish. When she looks up, she has decided about you. +3 Holy Points.', 'holy'); runScene('ambassador_strongbox'); } },
        ]
      };
    },

    ambassador_dies_silent: () => {
      setFlag('ambassador_died_before_answering');
      return {
        location: 'The Ostrene Legation — Upper Room',
        locationIcon: '🏛',
        narration: `He tries. You can see him assembling it behind his eyes — the sentence he came a hundred and forty miles and fourteen months to say — and then the assembly stops. No last revelation. No name gasped into your collar. A man in a rented room in a foreign capital simply stops, with the useful part still inside him, and the room gets quieter by exactly one person. Undersecretary Rane writes the hour in her ledger. Then she says, without looking up: "He was going to tell you to read our copy. He had been telling everyone to read our copy for six days. Nobody did."`,
        sub: `The answer did not die with him. It is in the case on the table, and it always was.`,
        options: [
          { icon: '📜', label: '"Then show me your copy."', type: 'talk',
            action: () => runScene('ambassador_strongbox') },
          { icon: '🔍', label: 'Search the room first — six days of a dying man\'s notes', type: 'explore',
            roll: { stat: 'INT', dc: 12 },
            onSuccess: () => { addLog('📜 Six days of drafts, all to your Crown, all unsent. Each one opens: "With respect, you are negotiating the schedules."', 'holy'); runScene('ambassador_strongbox'); },
            onFail: () => runScene('ambassador_strongbox') },
        ]
      };
    },

    ambassador_strongbox: () => ({
      location: 'The Ostrene Legation — Chancery Case',
      locationIcon: '🏛',
      threat: '⚠ Foreign Property',
      narration: `The case is oak with iron corners and a lock that has been opened so many times the wear around the keyhole is a small polished eye. Inside: Ostrene's counterpart exemplar of the Covenant — not the one that burned three days ago, but the one before it. The Eighth. Made in the three hundred and fifty-fifth year of the Flame, and countersigned by an Ostrene ambassador who has been dead longer than you have been alive, because Ostrene sends a witness to every one of these and Ostrene never throws the witness's copy away. Rane has one hand flat on the lid. "This is sovereign property of a nation you are not at war with," she says. "Convince me."`,
      sub: `Ostrene's exemplar of the Eighth Covenant. Forty-nine years old. Never redacted, because nobody ever asked Ostrene to redact anything.`,
      options: [
        { icon: '💬', label: '"He told me to read it. Those were the last words he had."', type: 'talk',
          roll: { stat: 'CHA', dc: getFlag('rane_trusts_you') ? 8 : 13 },
          onSuccess: () => { addLog('📜 Rane lifts her hand off the lid. "Then read it here. It does not leave this room in your coat."', 'holy'); runScene('ambassador_seven_clauses'); },
          onFail: () => runScene('ambassador_rane_refuses') },
        { icon: '📜', label: '"Read me your own protocol. What happens to a counterpart when the witness dies?"', type: 'talk',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => { addLog('📜 Ostrene protocol, clause the eleventh: on the death of a witnessing legate, the counterpart is to be exhibited to the host chancery before repatriation. Rane reads it twice, sighs, and opens the case. She is not persuaded. She is compliant, which is stronger.', 'holy'); runScene('ambassador_seven_clauses'); },
          onFail: () => runScene('ambassador_rane_refuses') },
        { icon: '🔓', label: 'Take it. She is one exhausted clerk and this is bigger than her.', type: 'explore',
          roll: { stat: 'DEX', dc: 14 },
          onSuccess: () => { setFlag('stole_ostrene_exemplar'); grantHellPoints(4); addLog('📜 You take a dead man\'s document out of a foreign house while his secretary is writing down the hour of his death. It works. +4 Hell Points.', 'hell'); runScene('ambassador_seven_clauses'); },
          onFail: () => runScene('ambassador_rane_refuses') },
      ]
    }),

    ambassador_rane_refuses: () => {
      setFlag('rane_refused_once');
      return {
      location: 'The Ostrene Legation — Chancery Case',
      locationIcon: '🏛',
      narration: `Rane locks the case, and the sound is very final for such a small mechanism. "It goes home with him," she says. "That is what the protocol says and the protocol is the only thing in this building that still works." She writes a line in the ledger — your name, probably, and the hour, and what you asked for. Then, still writing, in exactly the tone she used for the hour of his death: "The courier leaves from the wool gate at fifth bell. The case is exhibited at the gate for inspection. Exhibited means open. It means open for about an hour, on a table, in a public thoroughfare, and I cannot lawfully stop anyone from having eyes."`,
      sub: `She did not give you the document. She gave you the timetable. That is what a clerk has instead of a conscience.`,
      options: [
        { icon: '🗺', label: 'Be at the wool gate at fifth bell', type: 'move',
          action: () => { addLog('📜 Fifth bell. A table, a lamp, an open case, and a bored Ostrene courier who has been instructed not to hurry.', 'system'); runScene('ambassador_seven_clauses'); } },
        { icon: '💬', label: '"You want me to read it. Why not just hand it to me?"', type: 'talk',
          roll: { stat: 'WIS', dc: 11 },
          onSuccess: () => { addLog('📜 Rane: "Because then I gave it to you. This way it was exhibited, and I filed that it was exhibited, and in forty years nobody will be able to prove I did anything at all." She has been in this trade a long time.', 'holy'); runScene('ambassador_seven_clauses'); },
          onFail: () => { addLog('She does not answer. She writes.', 'system'); runScene('ambassador_seven_clauses'); } },
      ]
      };
    },

    // ── PRIMARY CLUE: L1 — clue_seventh_clause_exists ───────────────
    ambassador_seven_clauses: () => {
      const opts = [
        { icon: '🔍', label: 'Collate it against the Church\'s free pamphlet in your pocket', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            setFlag('clue_seventh_clause_exists');
            grantXP(120);
            addLog('📜 CLUE: Ostrene\'s exemplar of the EIGHTH Covenant carries SEVEN clauses on page one. Every copy in Vaelthar carries FIVE.', 'holy');
            addLog('📜 Vaelthar\'s marginal instruction, in a chancery hand: "cl. vi–vii omitted — notarial matter, not operative."', 'holy');
            addLog('📜 And it is numbered. The Eighth. The one that burned three days ago was the Ninth. There have been NINE of these.', 'holy');
            addItemOnce(COLLATION_NOTES);
            runScene('ambassador_chancery_seizure');
          },
          onFail: () => {
            addLog('You lose count twice. Rane watches you lose count twice.', 'system');
            runScene('ambassador_chancery_seizure');
          } },
        { icon: '📜', label: 'Let Rane collate it — Ostrene clerks count for a living', type: 'talk',
          action: () => {
            setFlag('clue_seventh_clause_exists');
            setFlag('rane_collated_it');
            grantXP(80);
            addLog('📜 Rane runs a finger down both. It takes her nine seconds. "Ours has seven. Yours has five." A pause. "Yours has always had five. Did you not know that?"', 'holy');
            addLog('📜 CLUE: Page one of the Eighth Covenant carries SEVEN clauses. Vaelthar\'s copies carry FIVE — "cl. vi–vii omitted, notarial matter, not operative."', 'holy');
            addLog('📜 It is numbered THE EIGHTH. The one that burned was the NINTH. These have been happening, in order, for a very long time.', 'holy');
            addItemOnce(COLLATION_NOTES);
            runScene('ambassador_chancery_seizure');
          } },
        { icon: '👁', label: 'Skip page one. Go to page four — the clause everyone actually fights over.', type: 'explore',
          action: () => {
            setFlag('read_page_four_first');
            addLog('Page four. Crown oversight of Church finances. Exactly as Mourne described it, word for word, forty-nine years before she was born. It has been in every one of these. Nobody has ever signed it and meant it.', 'system');
            addLog('You did what every negotiator in four hundred years has done. You read the operative clauses.', 'system');
            runScene('ambassador_seven_clauses');
          } },
      ];
      if (getFlag('aldran_intel')) {
        opts.push({ icon: '💬', label: 'Compare it to Aldran\'s copy — the one he nearly died holding', type: 'talk',
          action: () => {
            setFlag('clue_seventh_clause_exists');
            grantXP(80);
            addLog('📜 Aldran\'s secret copy. The one the Church would have burned him for. Five clauses. He risked his life for the redacted edition and never knew.', 'holy');
            addLog('📜 CLUE: Ostrene\'s exemplar carries SEVEN clauses on page one. Every copy in Vaelthar — including the heretic\'s — carries FIVE.', 'holy');
            addItemOnce(COLLATION_NOTES);
            runScene('ambassador_chancery_seizure');
          } });
      }
      return {
        location: getFlag('rane_refused_once') ? 'The Wool Gate — Exhibited Case' : 'The Ostrene Legation — Page One',
        locationIcon: '📜',
        narration: `The exemplar is stitched, not bound, and page one is the one page with no fingerprints on it. THE EIGHTH COVENANT BETWEEN THE CROWN OF VAELTHAR AND THE CHURCH OF THE ETERNAL FLAME, MADE IN THE THREE HUNDRED AND FIFTY-FIFTH YEAR OF THE FLAME. Below that, a preamble nobody has ever quoted at you, and below the preamble, the clauses, numbered down the left in red. You have the Church's free pamphlet in your coat — they hand them out at the Temple Quarter gate, the whole thing on two sheets, for the people. The pamphlet's page one stops at five.`,
        sub: `Ostrene's page one does not stop at five.`,
        options: opts
      };
    },

    ambassador_chancery_seizure: () => ({
      location: 'The Ostrene Legation — The Door',
      locationIcon: '🕯',
      threat: '⚔ Church Chancery',
      narration: `Boots in the stairwell, unhurried — the tread of men who have paperwork. A Church chancery under-officer named Brask comes in first, and he is the worst kind: polite, bored, and correct. Two Flame agents behind him with their hands where you can see them, which is a courtesy and also a statement. "Repatriation of diplomatic material on the decease of a legate," Brask says, and produces a warrant that is, as far as you can tell, entirely genuine. "That includes the counterpart." He puts out a hand. He is not looking at you. He is looking at the case, the way a man looks at a chair he intends to sit in.`,
      sub: `Nobody sent him. This is just the form that gets filled in when a foreign ambassador dies. That is how it always happens.`,
      options: [
        { icon: '💬', label: '"The Watch has custody. Take it up with Captain Rhael."', type: 'talk',
          roll: { stat: 'CHA', dc: 14 },
          onSuccess: () => { setFlag('bluffed_chancery'); runScene('ambassador_exemplar_kept'); },
          onFail: () => { addLog('Brask does not argue. He writes "party asserts Watch custody — unverified" and holds his hand out for exactly as long as it takes you to understand.', 'system'); runScene('ambassador_exemplar_surrendered'); } },
        { icon: '⚔', label: 'No. This document does not go into a Church drawer.', type: 'combat',
          action: () => startCombat([
            { name: 'Chancery Under-Officer Brask', hp: 38, ac: 12, atk: 5, icon: '📋', id: 'chancery_brask', xp: 90 },
            { name: 'Flame Agent', hp: 32, ac: 13, atk: 5, icon: '🕯', id: 'flame_agent_legation_1', xp: 80 },
            { name: 'Flame Agent', hp: 32, ac: 13, atk: 5, icon: '🕯', id: 'flame_agent_legation_2', xp: 80 },
          ], { victoryScene: 'ambassador_exemplar_kept' }) },
        { icon: '📜', label: 'Hand it over — but copy page one first, in front of him', type: 'explore',
          roll: { stat: 'INT', dc: 13 },
          onSuccess: () => { setFlag('copied_page_one'); addLog('📜 ITEM GAINED: Page One, Eighth Covenant (your hand) — seven clauses, copied in front of a Church officer who did not think to stop you, because page one is not operative.', 'holy'); addItemOnce('Page One, Eighth Covenant (copied by hand)'); runScene('ambassador_exemplar_surrendered'); },
          onFail: () => runScene('ambassador_exemplar_surrendered') },
        { icon: '⚖', label: 'Let him have it. You already counted.', type: 'talk',
          action: () => runScene('ambassador_exemplar_surrendered') },
      ]
    }),

    ambassador_exemplar_kept: () => {
      setFlag('has_ostrene_exemplar');
      grantXP(150);
      addItemOnce('Ostrene Counterpart Exemplar (Eighth Covenant, FY 355)');
      addLog('📜 ITEM GAINED: Ostrene Counterpart Exemplar — the Eighth Covenant, FY 355, unredacted.', 'holy');
      addLog('📜 You hold the only unredacted Covenant text in Vaelthar. It is the eighth of nine. Nobody in this city has read its first page in forty-nine years.', 'holy');
      return {
        location: 'The Ostrene Legation — Afterwards',
        locationIcon: '🏛',
        narration: `Undersecretary Rane puts the exemplar into your hands herself, which is not protocol, and enters it in the ledger as "exhibited, not surrendered", which is. Then she says the only unprofessional thing she has said all day. "He kept asking why none of you would read the first page. I told him it was because it is not operative." She closes the book. "I have been a chancery clerk for nineteen years and I have never once read a preamble. Not one. In nineteen years." She looks at the bed. "He knew that about us. He thought it was funny, until about six days ago."`,
        sub: `Seven clauses on page one. Five in every copy in the capital. And there have been nine Covenants.`,
        options: [
          { icon: '💬', label: 'Take it to Captain Rhael — the Watch needs to see this', type: 'move',
            action: () => { setFlag('rhael_shown_exemplar'); addLog('📜 Rhael reads page one, then reads it again, then says: "Five and seven. That is not a conspiracy, that is a printing decision. Somebody made a printing decision." He is right, and he does not know how right.', 'holy'); runScene('vaelthar_main'); } },
          { icon: '👶', label: 'Rane mentioned a consular file — fourteen children, seven villages', type: 'move',
            action: () => runScene('children_almshouse') },
          { icon: '🗺', label: 'Back into the city', type: 'move', action: () => runScene('vaelthar_main') },
        ]
      };
    },

    ambassador_exemplar_surrendered: () => {
      setFlag('chancery_took_exemplar');
      grantXP(120);
      return {
        location: 'The Ostrene Legation — Afterwards',
        locationIcon: '🕯',
        narration: `Brask does not gloat, because Brask does not care. He puts the exemplar in a satchel, writes a receipt, tears the receipt along a perforation and hands Rane the stub — and you catch the top line as it goes past: a standing instruction number, and a date beside it that is older than every person in this room put together. Not an order from Elder Varek. Not an order from anybody living. A standing instruction, executed correctly, by a bored man, on a Tuesday. Rane files the stub. Brask leaves. The whole thing takes ninety seconds and it is entirely lawful and that is the most frightening thing you have seen in three days.`,
        sub: `Nobody stole it. It was collected, under an instruction with a date on it. Chancery decisions have dates.`,
        options: [
          { icon: '💬', label: '"What was that number on the receipt?"', type: 'talk',
            roll: { stat: 'INT', dc: 12 },
            onSuccess: () => { setFlag('saw_standing_instruction_date'); addLog('📜 Rane: "A standing instruction. It means somebody decided it once and nobody has decided it since." A pause. "Ours are numbered too. Ours you can look up. Yours you cannot." Someone, at some point, decided the capital would read five clauses. That decision has a date. You cannot reach it from here.', 'holy'); runScene('vaelthar_main'); },
            onFail: () => { addLog('Rane shrugs. "A number. They all have numbers."', 'system'); runScene('vaelthar_main'); } },
          { icon: '👶', label: 'Rane mentioned a consular file — fourteen children, seven villages', type: 'move',
            action: () => runScene('children_almshouse') },
          { icon: '🗺', label: 'Back into the city', type: 'move', action: () => runScene('vaelthar_main') },
        ]
      };
    },

    // ══════════════════════════════════════════════════════════════
    //  c1q10 — THE CHILDREN WHO REMEMBER NOTHING
    // ══════════════════════════════════════════════════════════════

    children_almshouse: () => {
      setFlag('children_quest_started');
      return {
        location: 'Vaelthar — The Wool Almshouse, Cantle Street',
        locationIcon: '👶',
        threat: '⚠ Fourteen Children',
        narration: `The Watch requisitioned a dead wool merchant's almshouse and put fourteen children in it because there was nowhere else with fourteen beds. Ages four to eleven. Found over two days, wandering, in a city that eats wandering children, and not one of them was hurt. That is the first wrong thing. The second wrong thing is that they are calm. They eat. They sleep. They hold out a cup when they want water. They do not cry for anyone, because there is no one to cry for — ask a child her name and she looks at you with mild, friendly interest, the way you would look at someone asking you the name of a stranger's dog. Sister Denne, a lay sister of the Flame with flour on her sleeves, is doing her best and knows it is not enough.`,
        sub: `Fourteen children. No names, no parents, no fear. Something took the whole shelf and left the room tidy.`,
        options: [
          { icon: '💬', label: 'Talk to Sister Denne and the Watch sergeant — get the intake ledger', type: 'talk',
            action: () => runScene('children_ledger') },
          { icon: '👁', label: '"Denne — you said they do something at dusk. Stay until dusk."', type: 'explore',
            action: () => runScene('children_hymn') },
          { icon: '🔍', label: 'Look at their hands. Every report mentions the palms.', type: 'explore',
            action: () => runScene('children_palms') },
          { icon: '🗺', label: 'Leave them to the Watch. You have a treaty to chase.', type: 'move',
            action: () => { addLog('You leave. One of them waves at you. It is a perfectly ordinary wave and it follows you down Cantle Street for the rest of the day.', 'system'); runScene('vaelthar_main'); } },
        ]
      };
    },

    // ── PRIMARY CLUE: L8 — clue_children_hymn ───────────────────────
    children_hymn: () => ({
      location: 'The Wool Almshouse — Dusk',
      locationIcon: '🕯',
      threat: '⚠ They Do This Every Night',
      narration: `It happens without a bell, without a signal, without anyone starting it. At the moment the light goes orange on the wall, fourteen children stop what they are doing — mid-bite, mid-game, one of them halfway up a stair — and recite. Word-perfect. In unison. The Sevenfold Benediction, the Church's own daily hymn, the one every child in the realm is taught at six. These children cannot tell you their mothers' faces. They cannot tell you their own names. And they do not miss a syllable. Sister Denne is standing in the doorway with a bowl in her hands and tears running down her face, and she does not seem to know she is crying. "I did not teach them that," she says. "I have been afraid to ask who did."`,
      sub: `Whatever took their names left the prayer. The prayer sits deeper than a name.`,
      options: [
        { icon: '📜', label: 'Write it down. Every line. Exactly as they say it.', type: 'explore',
          roll: { stat: 'WIS', dc: 13 },
          onSuccess: () => {
            setFlag('clue_children_hymn');
            grantXP(120);
            addLog('📜 CLUE: The Sevenfold Benediction, recited untaught by fourteen children with no memories. Transcribed with the capitals as printed:', 'holy');
            addLog('S — "Sanctify the flame that does not fail,"', 'holy');
            addLog('E — "Eternal in the hollow of the world,"', 'holy');
            addLog('L — "Let the ash remember what it was,"', 'holy');
            addLog('V — "Vouchsafe the seventh light to us,"', 'holy');
            addLog('A — "Attend the door that has no door,"', 'holy');
            addLog('N — "Now, and in the hour of the breaking,"', 'holy');
            addLog('E — "Ever, and after ever, amen."', 'holy');
            addItemOnce(HYMN_TRANSCRIPT);
            runScene('children_palms');
          },
          onFail: () => { addLog('You get four lines and lose the fifth. Your hand is shaking and you do not know why — it is a nursery hymn, you have heard it a thousand times, and something about hearing it in fourteen voices with no names behind them has taken the pen out of your fingers.', 'system'); runScene('children_hymn_second_night'); } },
        { icon: '💬', label: 'Ask Denne to say it with them — you want to hear the difference', type: 'talk',
          roll: { stat: 'CHA', dc: 10 },
          onSuccess: () => { setFlag('denne_recited_with_them'); addLog('📜 Denne joins in and her version is identical. Of course it is. She learned it at six, in a parish school, from a woman who learned it at six. Every mouth in this realm carries the same seven lines. The children are not saying anything strange. They are saying the most ordinary thing in the world, and they should not be able to.', 'holy'); runScene('children_hymn_second_night'); },
          onFail: () => runScene('children_hymn_second_night') },
        { icon: '🔍', label: 'Watch their hands while they recite', type: 'explore',
          action: () => runScene('children_palms') },
      ]
    }),

    children_hymn_second_night: () => ({
      location: 'The Wool Almshouse — The Second Dusk',
      locationIcon: '🕯',
      narration: `You come back the next evening and it happens again, at the same slant of light, the same fourteen mouths. It will happen tomorrow. It happened last night and the night before that in a Watch cell before anyone thought to write it down. This time you are ready, and Sister Denne holds the lamp steady for you without being asked, because she has had a day to decide she wants somebody else to be carrying this too.`,
      sub: `They do it every night. There is no trick to catching it. You only had to come back.`,
      options: [
        { icon: '📜', label: 'Take it down, line by line, no roll, no hurry', type: 'explore',
          action: () => {
            setFlag('clue_children_hymn');
            grantXP(100);
            addLog('📜 CLUE: The Sevenfold Benediction, recited untaught by fourteen children with no memories. Transcribed with the capitals as printed:', 'holy');
            addLog('S — "Sanctify the flame that does not fail,"', 'holy');
            addLog('E — "Eternal in the hollow of the world,"', 'holy');
            addLog('L — "Let the ash remember what it was,"', 'holy');
            addLog('V — "Vouchsafe the seventh light to us,"', 'holy');
            addLog('A — "Attend the door that has no door,"', 'holy');
            addLog('N — "Now, and in the hour of the breaking,"', 'holy');
            addLog('E — "Ever, and after ever, amen."', 'holy');
            addItemOnce(HYMN_TRANSCRIPT);
            runScene('children_palms');
          } },
        { icon: '💬', label: '"Denne. Line four. What is the seventh light?"', type: 'talk',
          action: () => {
            setFlag('clue_children_hymn');
            setFlag('asked_denne_the_obvious_question');
            grantXP(100);
            addLog('📜 Denne blinks. "It is — it is a way of saying God. It is just how the hymn goes." She has said that line every morning for twenty-nine years and has never once asked. Neither has anyone else. Nobody interrogates a nursery rhyme.', 'holy');
            addLog('📜 CLUE: The Sevenfold Benediction, transcribed with the capitals as printed:', 'holy');
            addLog('S — "Sanctify the flame that does not fail,"', 'holy');
            addLog('E — "Eternal in the hollow of the world,"', 'holy');
            addLog('L — "Let the ash remember what it was,"', 'holy');
            addLog('V — "Vouchsafe the seventh light to us,"', 'holy');
            addLog('A — "Attend the door that has no door,"', 'holy');
            addLog('N — "Now, and in the hour of the breaking,"', 'holy');
            addLog('E — "Ever, and after ever, amen."', 'holy');
            addItemOnce(HYMN_TRANSCRIPT);
            runScene('children_palms');
          } },
      ]
    }),

    // ── CORROBORATOR: clue_palm_symbol_is_overdrawn ─────────────────
    children_palms: () => {
      const opts = [
        { icon: '🔍', label: 'Take a hand. Actually look at the mark, not at the torch.', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            setFlag('clue_palm_symbol_is_overdrawn');
            grantXP(100);
            addLog('📜 CLUE: The palm mark is NOT the Eternal Flame\'s torch. It is a torch drawn OVER something — the underlying shape is still there beneath the overdrawing, and nobody in Vaelthar can tell you what it was.', 'holy');
            addItemOnce(PALM_RUBBING);
            runScene('children_ledger');
          },
          onFail: () => runScene('children_palms_inconclusive') },
        { icon: '💬', label: 'Ask Sister Denne what the mark is. She wears the Flame; she should know.', type: 'talk',
          roll: { stat: 'CHA', dc: 11 },
          onSuccess: () => { setFlag('denne_doubts_the_mark'); addLog('📜 Denne: "It is our torch." A long pause. She turns the girl\'s hand toward the lamp herself. "It is our torch," she says again, with markedly less of it. "The crossbar is wrong. Our torch does not have a crossbar."', 'holy'); runScene('children_palms'); },
          onFail: () => { addLog('"It is the Flame\'s mark," Denne says, too quickly, and goes to fetch more bread.', 'system'); runScene('children_palms_inconclusive'); } },
      ];
      if (getFlag('merchant_road_symbol_found')) {
        opts.push({ icon: '📜', label: 'Compare it to your sketch from the Merchant Road dead', type: 'explore',
          action: () => {
            setFlag('clue_palm_symbol_is_overdrawn');
            setFlag('children_match_caravan_dead');
            grantXP(120);
            addLog('📜 Your sketch of the caravan dead. Held beside a living four-year-old\'s hand. Identical. Not similar — identical, down to the place where the line doubles back on itself.', 'holy');
            addLog('📜 CLUE: The mark is a torch drawn OVER an older shape. Same overdrawing on the arranged dead of the Merchant Road and on fourteen children who cannot remember their names. Whatever is doing this has one hand and it does not distinguish.', 'holy');
            addItemOnce(PALM_RUBBING);
            runScene('children_ledger');
          } });
      }
      opts.push({ icon: '⏭', label: 'Leave the mark. Go find out where they came from.', type: 'move',
        action: () => runScene('children_ledger') });
      return {
        location: 'The Wool Almshouse — Fourteen Left Hands',
        locationIcon: '👶',
        narration: `Left palm, every one. Not a brand and not a tattoo — no scar tissue, no ink, no swelling, nothing that hurt going on. The skin simply has a shape in it, the way old paper has a watermark. A boy of about seven holds his hand out for you before you ask, flat, the way you would offer a coin, and he is entirely untroubled, and every adult who has looked at this mark for two days has said the same four words and stopped thinking: it is the Flame's torch.`,
        sub: `Everyone sees a torch. Everyone stops there. Look at what is under the torch.`,
        options: opts
      };
    },

    children_palms_inconclusive: () => ({
      location: 'The Wool Almshouse — Fourteen Left Hands',
      locationIcon: '👶',
      narration: `You look, and you see a torch, because that is what you have been looking at on every gatepost and every coin and every pamphlet since you were old enough to look at anything. That is not a failure of eyesight. It is a torch. Everyone agrees it is a torch. The trouble is that the boy's hand keeps not quite agreeing, and you cannot say why, and the harder you stare the more the shape seems to have been finished by someone in a hurry.`,
      sub: `You are not going to out-stare it. Get it on paper, or get someone to tell you what it is not.`,
      options: [
        { icon: '📜', label: 'Take a rubbing. Charcoal and paper. Then look at the paper, not the child.', type: 'explore',
          roll: { stat: 'DEX', dc: 11 },
          onSuccess: () => {
            setFlag('clue_palm_symbol_is_overdrawn');
            grantXP(100);
            addLog('📜 On paper, away from the hand, it is obvious and it is sickening: the torch is drawn over another shape. The first shape is still under there. Somebody traced the second one on top and did not quite cover it.', 'holy');
            addLog('📜 CLUE: The palm mark is NOT the Eternal Flame\'s torch. It is a torch drawn OVER something older. Nobody in Vaelthar can say what.', 'holy');
            addItemOnce(PALM_RUBBING);
            runScene('children_ledger');
          },
          onFail: () => { addLog('The rubbing smudges. The child laughs at the charcoal on his fingers. It is the only childlike thing any of them has done.', 'system'); runScene('children_ledger'); } },
        { icon: '⏭', label: 'Enough. Where did they come from?', type: 'move',
          action: () => runScene('children_ledger') },
      ]
    }),

    children_ledger: () => {
      const opts = [
        { icon: '📜', label: 'Read the intake ledger properly — where was each one found?', type: 'explore',
          roll: { stat: 'INT', dc: 12 },
          onSuccess: () => {
            setFlag('children_villages_traced');
            grantXP(100);
            addLog('📜 Fourteen children. Seven villages. TWO from each — exactly two, no village giving one or three. Mol. Aldric Cross. Harrenmoor. Cantle Fields. Vess Ford. Ashenmouth. And one the sergeant has spelled three different ways because nobody from there ever comes to the capital.', 'holy');
            addLog('📜 Fourteen is not a number of victims. It is a number of pairs. Somebody counted to seven twice.', 'holy');
            runScene('children_flame_custody');
          },
          onFail: () => { addLog('Sergeant Bral\'s handwriting defeats you. "Fourteen kids, six or seven villages, all out east," he offers, which is the least useful true sentence you have heard today.', 'system'); runScene('children_flame_custody'); } },
        { icon: '💬', label: '"Sergeant. Why is a foreign clerk on your visitor list?"', type: 'talk',
          action: () => {
            addLog('Bral: "Ostrene fella. Consular something. Wanted to know if any of the fourteen were Ostrene subjects — they have to ask, it is a form. Left a card." The card says: The Legation of Ostrene, Fennow Row. Their ambassador is dying and has asked to see somebody. Anybody.', 'system');
            runScene('ambassador_summons');
          } },
        { icon: '💬', label: '"Denne. Has the Church asked for them yet?"', type: 'talk',
          action: () => { addLog('Denne goes very still. "This morning," she says. "They said they would come back with the paperwork." She looks at the door. "That was four hours ago."', 'system'); runScene('children_flame_custody'); } },
      ];
      if (getFlag('pq_hunter_ritual_known')) {
        opts.push({ icon: '🗡', label: '[Hunter] Check them against your case file — 37 of 49', type: 'explore',
          action: () => {
            setFlag('children_in_hunter_file');
            addLog('🗡 Your file says thirty-seven marked and calls them primes, and it is wrong — nine is not prime and fourteen is not prime and eleven and nine and fourteen make thirty-four, not thirty-seven. You wrote that. Three years ago, at four in the morning, forcing a pattern because a pattern is easier to carry than a mess. The marks are real. Your arithmetic was a comfort blanket.', 'hell');
            addLog('🗡 Somebody is still counting. It is not you, and it never was.', 'hell');
            runScene('children_flame_custody');
          } });
      }
      return {
        location: 'The Wool Almshouse — Intake Ledger',
        locationIcon: '📋',
        narration: `Sergeant Bral of the Watch has the ledger, and Bral is not a clever man but he is a thorough one, which today is better. Fourteen entries in two days. Where found, when found, condition on arrival, distinguishing marks. Under "name", fourteen times, in the same weary hand: UNKNOWN — SUBJECT DOES NOT KNOW. Under "next of kin", fourteen dashes. And in the margin of the visitor list, one entry that has nothing to do with anything: a foreign clerk, four days ago, asking after the children on consular business.`,
        sub: `Where they were found is a list of villages. Read the list.`,
        options: opts
      };
    },

    children_flame_custody: () => ({
      location: 'The Wool Almshouse — The Door',
      locationIcon: '🕯',
      threat: '⚔ Church Custody Order',
      narration: `The paperwork arrives at half past four with three Flame agents behind it. Custody of unattributed minors bearing the sigil of the Order transfers to the Order — it is a real provision, it is two hundred years old, and it was written for foundlings left on chapel steps. The officer reading it aloud believes every word and is not enjoying himself. Behind you, fourteen children go on not being frightened, which is somehow the loudest thing in the room. Sister Denne, who wears the same torch these men do, has put herself between them and the door without appearing to have decided to.`,
      sub: `They are not villains. They are a form being filled in. That has been true of everything in this chapter.`,
      options: [
        { icon: '💬', label: '"They are Watch evidence in a murder inquiry. Rhael\'s inquiry."', type: 'talk',
          roll: { stat: 'CHA', dc: 13 },
          onSuccess: () => { setFlag('children_held_by_watch'); runScene('children_kept'); },
          onFail: () => { addLog('"Then Captain Rhael may file for their return," the officer says, and means it, and that is the end of it.', 'system'); runScene('children_surrendered'); } },
        { icon: '⚔', label: 'They are not taking fourteen children into a Church cellar', type: 'combat',
          action: () => startCombat([
            { name: 'Flame Custody Officer', hp: 40, ac: 13, atk: 5, icon: '🕯', id: 'flame_custody_officer', xp: 90 },
            { name: 'Flame Agent', hp: 30, ac: 12, atk: 4, icon: '🕯', id: 'flame_agent_almshouse_1', xp: 70 },
            { name: 'Flame Agent', hp: 30, ac: 12, atk: 4, icon: '🕯', id: 'flame_agent_almshouse_2', xp: 70 },
          ], { victoryScene: 'children_kept' }) },
        { icon: '🚪', label: 'Stall him at the door. Denne knows a back way through the wool store.', type: 'explore',
          roll: { stat: 'DEX', dc: 13 },
          onSuccess: () => { setFlag('children_hidden'); setFlag('denne_defied_the_church'); grantHolyPoints(8); addLog('📜 Fourteen children go out through a dead man\'s wool store in absolute silence, holding hands in a line, because somebody once taught them to. +8 Holy Points.', 'holy'); runScene('children_kept'); },
          onFail: () => { addLog('The wool store door is chained. Of course it is — the merchant is dead and the estate is in probate. Bureaucracy again.', 'system'); runScene('children_surrendered'); } },
        { icon: '⚖', label: 'Let them go. Fighting the Church over this buries the inquiry.', type: 'talk',
          action: () => runScene('children_surrendered') },
      ]
    }),

    children_kept: () => {
      setFlag('children_safe');
      grantXP(160);
      grantHolyPoints(5);
      return {
        location: 'The Wool Almshouse — After',
        locationIcon: '👶',
        narration: `Fourteen children, still in this room, still nameless, still calm. Sister Denne sits down on the bottom stair with her hands over her face for exactly as long as she allows herself, then gets up and starts cutting bread, because there are fourteen of them and they will want feeding at six. She does not look at her own torch pendant. She has not looked at it since you took the rubbing. At dusk they will do it again — fourteen voices, seven lines, word-perfect, and the fourth line will ask for the seventh light, and none of them will know what they are asking for, and neither, yet, do you.`,
        sub: `You kept fourteen children. You still cannot tell any of them their own name.`,
        options: [
          { icon: '💬', label: 'Tell Rhael. Two from each of seven villages is a shape, not a crime wave.', type: 'move',
            action: () => { addLog('📜 Rhael, quietly: "Seven villages. Two each. That is not a monster, that is a man with a list." He is wrong about the man. He is entirely right about the list.', 'holy'); runScene('vaelthar_main'); } },
          { icon: '🗺', label: 'The Ostrene legation asked after these children. Go and ask why.', type: 'move',
            action: () => runScene('ambassador_summons') },
          { icon: '🗺', label: 'Back into the city', type: 'move', action: () => runScene('vaelthar_main') },
        ]
      };
    },

    children_surrendered: () => {
      setFlag('children_taken_by_church');
      grantXP(120);
      grantHellPoints(3);
      return {
        location: 'Cantle Street — After',
        locationIcon: '🕯',
        narration: `They go quietly, in a line, holding hands, and the worst part is that they are not afraid, because being afraid requires remembering that something else was better. Sister Denne walks them to the cart and hands each one up, and the officer thanks her for her cooperation and means it, and she says "of course" and means that too, and then she stands in the street and does not go back inside. Whatever you carry out of Cantle Street tonight, you carry it in your notebook, because the evidence just got onto a cart. The transcript is still yours. So is the mark. They did not think to ask for either — the hymn is only a hymn and the torch is only their torch.`,
        sub: `They took the children. They left you the prayer, because nobody thinks a nursery hymn is evidence.`,
        options: [
          { icon: '💬', label: 'Ask Denne where the cart goes', type: 'talk',
            roll: { stat: 'CHA', dc: 12 },
            onSuccess: () => { setFlag('knows_children_destination'); addLog('📜 Denne, without turning around: "The Archive. They always go to the Archive. I have watched carts go to the Archive for nine years and I have never once watched one come back." She is a lay sister of the Eternal Flame and she has just informed on it, in the street, to a stranger.', 'holy'); runScene('vaelthar_main'); },
            onFail: () => { addLog('Denne shakes her head. She is not refusing. She genuinely does not know, and it has just occurred to her that in nine years she never asked.', 'system'); runScene('vaelthar_main'); } },
          { icon: '🗺', label: 'The Ostrene legation asked after these children. Go and ask why.', type: 'move',
            action: () => runScene('ambassador_summons') },
          { icon: '🗺', label: 'Back into the city', type: 'move', action: () => runScene('vaelthar_main') },
        ]
      };
    },

  };

  if (typeof SCENES !== 'undefined') Object.assign(SCENES, S);
  if (typeof window !== 'undefined') { window.SCENES = window.SCENES || SCENES; Object.assign(window.SCENES, S); }
})();
