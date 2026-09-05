# Sanctum & Shadow — gameplay audit and completion plan

Audit date: 2026-09-05. Source baseline: `e0756ab`, current local working tree.

## Verdict

There is a substantial D&D-inspired RPG foundation, but it is not yet a reliably complete party CRPG. The main obstacle is inconsistent authority and integration, not a lack of features or graphics. Solo combat, multiplayer combat, narrative choices, physical interactions, and saves can disagree about what happened.

Finish a dependable Chapter I release before extending the campaign. “Complete game” needs a declared boundary: Chapter I has authored content; the existing Chapter II handoff is an AI prompt, not an authored second campaign with its own verified quest graph.

Graphics are excluded. A rendering exception is included only because it stops gameplay updates, including movement and input response. The separate paladin prototype is not part of this audit or the campaign release.

## Evidence and limitations

- `npm test`: 215 tests discovered, 214 passed. The real multiplayer integration test could not bind its local port (`EPERM`), so it is **environment-blocked**, not a demonstrated gameplay failure or a verified pass.
- `node tools/audit-gameplay.cjs`: isolated, in-memory probes of the actual server action handler and rules modules confirmed the AI-event, repeat-victory, shield, consumable, and full-cover problems below. No live session was altered.
- A static cross-reference of story files found 198 unique literal `runScene`/`GO` destinations and no missing matching scene factory. This does not establish reachability, valid prerequisites, safe reload, or correct outcomes.
- Reviewed the campaign objective engine, entry hooks, core and additional story structures, origin arcs, solo/server combat, tactical bridge, AI contracts/effects/offline fallback, multiplayer lifecycle, saves, inventory/shops, progression, reputation/fate, camp/prayer, and release tests.
- This is a cross-system code audit, **not a completed human-style campaign playthrough**. Runtime race conditions and route-specific failures still require the release matrix below.
- Local findings do not establish which revision is currently deployed. Railway storage, current production configuration, and online Claude availability were not verified in this audit.

## What is worth keeping

- Twenty defined Chapter I core quests: 12 main and 8 side quests.
- Eight origin premises, each with a named contact and three owner-specific quest records; up to 12 personal quest records for a four-character party.
- Six classes, race selection, character progression, skills, equipment, consumables, rests, and reputation-based merchant pricing.
- Shared d20 helpers for checks, attacks, initiative, proficiency, roll modes, and saving throws.
- Authored campaign scenes and deterministic offline narration.
- Versioned Claude response validation and bounded effect fields.
- Quest-reward claim tracking, persistent NPC-fate infrastructure, faction consequences, and six authored finale variants.
- Four-player party limits, reconnect handling, speaker ownership, conversation synchronization, and server-resolved multiplayer turn order.
- Versioned browser saves and atomic server snapshot writes.

These systems need consolidation and completion, not wholesale replacement.

## Findings

Severity: **P0** blocks reliable progression or state integrity; **P1** breaks expected mechanics or recovery; **P2** concerns depth, usability, or release completeness.

### F01 — P0: one environment update can stop the game loop

`SkyEnvironment.install()` assigns a texture to `scene.background` (`site/world3d/sky-environment.mjs:72`). `CityAtmosphere.update()` calls `scene.background?.lerp(...)` as though it is still a Color (`site/world3d/city-atmosphere.mjs:29`). Optional chaining does not protect a missing method on a present texture. The update runs before the next animation frame is scheduled (`site/world3d/world-engine.js:145`).

Impact: when that sky path succeeds, this type mismatch can stop movement, camera updates, combat presentation, and rendering. Fix type ownership and isolate nonessential subsystem failures; do not disguise the exception with an empty catch.

### F02 — P0: solo and multiplayer are different combat games

`site/combat.js:889` contains spell-specific healing, shields, status effects, area attacks, resource hooks, and some saving throws. `server.js:680` mostly chooses between self-healing and direct damage to one target.

Confirmed probe: Divine Shield spends 10 MP and logs a zero-damage hit; no shield state is created. Other mismatches include area damage, buffs, class-resource hooks, Holy costs, target healing, and enemy spell behavior. `processEnemyTurn()` performs a basic move/attack rather than using the authored solo enemy spell logic (`server.js:1012`).

Impact: friends do not get the abilities or encounters the game describes. A single shared combat reducer is the highest-value architectural correction.

### F03 — P0: multiplayer loses authored combat continuations

Story and origin encounters pass `victoryScene`, including `origin_shared_*_trail_resolved`, Harren resolutions, and `tower_ending_sword`. The server builds a fresh combat state without preserving that continuation (`server.js:524`). The multiplayer end handler contains special cases, but no generic `victoryScene` dispatch (`site/multiplayer.js:569`).

Impact: winning a battle can fail to open its authored payoff. Origin investigation fights are particularly exposed; a milestone event alone is not equivalent to running the correct resolution scene and applying its consequences.

### F04 — P0: completion is not an atomic, exactly-once transaction

The multiplayer `combat_action` handler checks whether a combat state exists but not whether it is still active (`server.js:640`). Defeat/victory leaves the inactive combat state attached to the session. No encounter-reward claim ID protects the client XP award (`site/multiplayer.js:569`).

Confirmed probe: submitting `end_turn` twice to an already-won encounter emits two victory events. The attack branch also lacks its own positive-AP guard. Fix encounter IDs, action IDs, turn versions, active-state validation, and committed reward claims together.

### F05 — P0: validated AI JSON can still bypass campaign requirements

The Claude contract checks the shape of quest event strings, not whether the current action is authorized to produce them (`site/claude-contract.js:188`). `ClaudeEffects.apply()` forwards those events (`site/claude-effects.js`). The quest reducer completes an objective with `completes:true` without enforcing required earlier objectives (`site/quests.js:127`).

Confirmed probe: a valid AI scene can contain `scene:tower_ending_sword`; with quest 20 active and no previous objectives complete, the reducer completes quest 20.

Fix: Claude proposes intent and narration. Only an authored, context-validated gameplay command may emit protected milestones. Alternatives must use explicit prerequisite groups, not an unconditional “all prior objectives” rule that would incorrectly break legitimate branching.

### F06 — P1: the physical-interaction rule is only partially applied

`PHYSICAL_NPC_SCENE_RULES` protects a small set of early-city NPC scene prefixes (`site/story.js:539`). Most later quest entries are location-triggered (`site/quest-entry-hooks.js`), and origin investigations open from `onLocationEntered()` (`site/party-origin-quests.js:224`). Several scene-to-scene transitions narrate movement into a room without a physical entity or interaction boundary.

Impact: the opening was improved, but later gameplay can return to choosing actions from wherever the party stands. Each actionable scene needs a location, entity, interaction range, prerequisites, and availability/fate checks. Narrative travel must not masquerade as actual movement.

### F07 — P1: tactical validation is weaker than the tactical UI suggests

`TacticalCombat.validateMove()` checks straight-line distance and a bounding square, not path length, walls, occupied cells, or navigation clearance. `coverBonus()` represents full cover as +5 AC; `validateAttack()` still allows the shot (`site/tactical-combat.js`). Most encounters have no authored cover data; Cupside is specially handled.

Confirmed probe: an attack through an obstacle marked `full` cover is accepted. Spell range/line-of-sight checks are also missing from the server spell branch. The 3D bridge can move models to nearby open positions independently of the logical combat coordinates (`site/world3d/combat-controller.js:20`).

Additionally, solo attacks are resolved after an animation callback while other turn controls exist. Pending actions need a reserved cost and encounter/turn identity so ending a turn or changing context cannot leave a stale action resolving later.

### F08 — P1: consumables have incorrect multiplayer semantics

The server's item branch treats a named inventory string as a healing item, always restores 30 HP, and removes it with `filter`, deleting every identical copy (`server.js:716`).

Confirmed probes: using one of two Health Potions leaves zero; a Quest Document can be consumed as healing. Use catalog IDs, quantities or instance IDs, allowed-use contexts, and the same effect definitions as the shop/solo engine. Quest items must not be implicitly consumable.

### F09 — P1: saves preserve summaries, not every active gameplay state

Browser saves include character, quest, location, facts, and flags, but no complete active combat transaction (`site/saves.js:109`). Saving is not categorically prohibited during combat; loading clears combat (`site/saves.js:295`). Active dialogue/check ownership and pending action continuations are not fully snapshotted. Entry restoration only re-arms introductions whose first milestone is incomplete.

Origin serialization stores the manifest, not `state.context` or `state.pending`. Origin scene factories require that context. Prayer blessings/curses are used in combat but absent from the enumerated saved character fields. These are recovery gaps even though migration and selected save tests pass.

Choose a clear policy: complete active-state snapshots, or explicit stable checkpoints with clear restrictions. Never silently drop an encounter or an unresolved choice on load.

### F10 — P1: disconnected-player turns can strand a party

Host migration exists, but combat advancement skips dead actors, not disconnected living actors (`server.js:978`). Disconnect does not resolve or transfer the disconnected actor's turn (`server.js:938`). The enemy timeout cannot resolve a living player's turn.

Add reconnect grace, visible countdown, then an explicit party-approved auto-defend/host-control policy. Stable character identities must survive socket replacement, save import, host migration, and late join.

### F11 — P1: NPC fate has competing representations

`setNPCFate(id,'dead')` sets both fate and legacy death flags; setting `'spared'` does not clear the old death flag (`site/consequences.js:29`). Prayer resurrection uses `'spared'` (`site/prayer.js:93`), while some readers consult fate and others inspect `npc_dead_*` directly.

Impact: a revived NPC can be alive for one system and dead for another. Quest 15 explicitly narrates Aldran's death but does not write an Aldran death through this fate API. Consolidate lifecycle transitions and every reader.

### F12 — P1/P2: origin arcs are functioning templates, not distinct complete adventures

Eight different contacts and premises lead to the same reunion, evidence confrontation, and justice/mercy/vengeance structure (`site/party-origin-quests.js:252`). The finale mainly grants faction reputation and an owner flag. The war-orphan quest promises a decision about an officer, for example, but the common reckoning does not stage a specific confrontation with that officer.

Other gaps: the manifest freezes once initialized, while the server supports later character arrivals; the best helper is chosen by raw ability score rather than the complete skill modifier and player consent; multiple owners sharing an origin repeat essentially the same story. Some finale references still use legacy `pq_*` flags rather than the shared-origin outcomes.

Keep three quests per character. Author distinct encounters, named responsible actors, evidence objects, and persistent outcomes. Let the owner lead the personal decision while the party participates, rather than promising ownership and then always treating it as an anonymous vote.

### F13 — P2: campaign structure and consequences need editorial sign-off

- The sequential `completeQuest()` unlocks the next numeric quest (`site/game.js:865`), including quests labeled side quests. Define genuinely optional discovery branches and the main-path prerequisites.
- The newer finale promises deduction redundancy, but earlier systems rely on flags, scene visits, and direct callbacks. Test missing-clue routes, refused quests, dead contacts, retreat, and revisits as coherent stories, not just successful event sequences.
- Aldran's rescue affects a line of text before his later scripted death (`site/story-extra-sermon.js:70`). This may be intentional tragedy, not a coding mistake. Decide what lasting benefit the rescue gives, or make the limitation and stakes clear. Do not silently rewrite this authorial choice.
- Offline Rhael directs the player to the Archive while the current physical Scribe is in the Tarnished Cup (`site/offline-narration.js:17`, physical scene rules). Maintain one location-aware NPC knowledge source.
- Generic offline actions can narrate hiding, moving an object, or changing position while storing only a fact (`site/game.js:1195`). Text must not claim mechanical effects that did not occur.
- Raw scene callbacks and finale code award XP alongside the quest reward system. Catalog intended bonuses versus duplicate rewards and guard all repeatable interactions.
- An old `beginChapterTwo()` announces a new chapter and generates an AI opening (`site/story.js:3036`). This is not a finished Chapter II. Replace unfinished handoffs with an honest chapter-complete state until authored content exists.

### F14 — P1/P2: validation depth and operational durability are insufficient release evidence

Several tests assert that strings appear in source. The campaign completion test injects the first event for each objective and stubs combat as a callback (`tests/campaign-completion.test.js`). Useful unit coverage, but not proof of a playable route.

Server characters and enemies are accepted from clients with partial clamping; spell lists and progression are not entirely derived from an authoritative catalog (`server.js:481`, `server.js:524`). Story events are relayed through a broad event-name path. This is tolerable only as an explicitly trusted-host prototype, not robust public authority.

Server snapshots use local disk; persistent Railway storage is required for replacement-safe campaigns. Empty sessions are deleted after the disconnect grace period and inactive snapshots expire. A durable campaign save must be separate from a temporary online room. Confirm deployment storage, backups, restore, and revision identity before release.

## Recommended gameplay identity

Use a deliberate **D&D-inspired, Divinity-style hybrid**:

- D&D-style attributes, skills, proficiency, AC, d20 attacks/checks, advantage/disadvantage, saving throws, and authored consequences.
- Divinity-style party exploration and tactical action points.
- Keep AP and mana for this release unless you explicitly want a much larger strict-D&D rules conversion. Spell slots, bonus actions, exact tabletop class progression, and every tabletop rule are not automatically required.
- Publish house rules: natural 1/20 checks, critical damage, movement units, friendly fire, death/revival, rest recovery, and who makes party checks.
- Recommended death default: downed allies and recovery opportunities, then a clear party-defeat checkpoint. Make hardcore/permadeath optional rather than an inconsistent hidden behavior.

## Ordered completion plan

Do not attempt a monolithic rewrite. Implement one step, add behavioral tests, verify it in normal play, then move on. Keep graphics frozen.

### 1. Stabilize the runtime and freeze the release contract

Fix F01, catch/report subsystem failures without stopping gameplay, and add a boot → move → interact → combat smoke test. Write the hybrid rules and Chapter I completion boundary. Inventory every command, ability, quest, item, scene, and persisted state type. This is a brief specification exercise, not a prolonged planning phase.

**Gate:** a clean local run remains responsive through exploration/dialogue/combat; runtime errors are surfaced with a recoverable checkpoint; agreed rules and content scope are written.

### 2. Establish one authoritative command and effect pipeline

Create plain-data commands such as interact, choose, check, attack, cast, move, use-item, rest, and finish-encounter. Validate actor, permissions, scene/encounter ID, turn revision, target, range, cost, and prerequisites. Return explicit state changes and presentation events. Reuse the reducer in solo and on the multiplayer server. Adapt existing UI to it incrementally.

Implement unique command IDs, replay rejection, exactly-once encounter rewards, and catalog-derived abilities/items/enemies. Do not rewrite all story prose here.

**Gate:** identical seeded commands produce identical solo/server results; stale, duplicated, unaffordable, inactive, and unauthorized commands cannot alter state.

### 3. Finish combat and all six classes

Port every shipped ability and enemy ability into shared definitions. Complete shields, buffs, damage-over-time, saving throws, resistances, status expiration, ally healing, area effects, resource costs, class passives, and revival. Correct target selection so downed allies can be selected for revival. Resolve victory, retreat, surrender, and party defeat through explicit encounter outcomes. Preserve authored continuation IDs.

**Gate:** each shipped ability has success/failure and legal/illegal-target tests in solo and multiplayer; every authored battle reaches its correct continuation exactly once.

### 4. Make tactical positioning authoritative

Use one navigation/collision representation for movement and combat legality. Charge actual traversable path distance. Validate occupancy, line of sight, full cover, melee reach, spell ranges, and area shapes. Reserve AP when an action is accepted; presentation timing must never own the rules. Prevent acting or ending a turn around a pending unresolved movement/attack.

Add a small purposeful tactical set: disengage/defend, shove, and clearly signposted hazards where supported. Do not build a huge elemental simulation before existing mechanics work.

**Gate:** no attacking through full walls, moving through blocked spaces, free movement by retargeting, or discrepancy between displayed and logical positions.

### 5. Convert every quest interaction to physical world actions

Give all required quest NPCs, clues, doors, altars, evidence containers, and exits stable entity IDs. Trigger dialogue/investigation only after approach and interaction. Location arrival may reveal an objective, not complete an investigation or automatically conduct a conversation. Preserve explicit scene context while the party examines an entity.

**Gate:** all 20 core quests and origin stages start/advance through reachable physical entities; the player cannot talk to unseen distant NPCs or search another building from the street.

### 6. Rebuild campaign progression as a validated quest graph

For each core quest record discovery, prerequisites, alternative routes, evidence, refusal/failure outcomes, combat links, NPC dependencies, completion, rewards, and reopen/resume routes. Separate optional quests from mandatory progression. Move protected milestones behind authored gameplay commands. Remove completion on mere presentation where the action has not occurred.

**Gate:** all 20 quests can finish through real actions; required clues have alternate paths; failed rolls, refused options, killed contacts, retreat, and out-of-order discovery cannot silently strand the main campaign.

### 7. Author the complete shared-origin adventures

Keep eight origins and three stages each. Add the actual named adversary/beneficiary and a distinctive activity to each arc. Make each conclusion produce a visible world outcome plus owner-specific epilogue. Handle same-origin parties, mixed parties, late join, reconnect, and owner absence. Let helpers volunteer and use actual skill totals; define owner-versus-party decision rights.

**Gate:** a four-player party can finish all 12 personal quest records; no repeated identical evidence retrieval is required merely because two players chose the same origin; outcomes survive saves and affect later content.

### 8. Unify story facts, NPC fate, and AI/offline adjudication

Create one canonical entity/knowledge registry with locations, alive/dead/arrested states, possessions, faction, known facts, and story availability. Reconcile the original Covenant investigation with the newer deduction arc and all six endings. Resolve Aldran's rescue payoff with author approval.

Claude returns proposals, not protected campaign events. Map open choices onto legal commands; unsupported actions get an honest explanation. Feed both Claude and offline narration the same bounded context and actual resolved result. Use one-time IDs for discoveries and rewards.

**Gate:** AI cannot finish a quest by claiming it happened; offline paths finish the campaign; dead NPCs stay absent, resurrection clears all death representations, and narration matches mechanical outcomes.

### 9. Complete economy, progression, rest, and party support systems

Unify item IDs/quantities, equipment effects, merchant transactions, loot ownership, trades, quest-item protection, and consumable behavior. Preserve reputation/alignment pricing. Audit XP and gold budgets, level pacing, rest limits/costs, prayer costs/cooldowns, and class-resource persistence. Put relationship consequences through the same pipeline where retained; defer optional relationship expansion until core release.

**Gate:** no duplicated rewards, vanished potion stacks, sell/buy money loops, lost gear bonuses, or free resource resets. Solo and 2–4-player parties reach intended challenge levels without mandatory grinding.

### 10. Make campaigns recoverable and multiplayer resilient

Persist all canonical campaign and character state with schema migrations and stable character IDs. Choose and implement safe checkpoint versus full mid-action save behavior. Separate durable campaigns from transient lobby sessions. Add host handover, disconnected-turn timeout policy, late join/spectating, speaker loss, save reload, and reconnect during a transition. Verify persistent deployment storage and restore from backup.

**Gate:** refresh, disconnect, host exit, and server restart at every checkpoint preserve outcomes and ownership without replaying costs/rewards or dropping the active objective.

### 11. Finish onboarding, feedback, and content sign-off

Teach movement, approach-to-interact, custom choices, checks, targeting, AP, items, resting, and party decisions in the first session. Show why an action is unavailable, its cost/range, and what changed. Make the journal show a specific next person/object/place without spoiling deductions. Ensure keyboard use, text size, and modal focus are reliable.

Provide an honest Chapter I ending summary: factions, surviving NPCs, each origin, unresolved hooks, and a final save. Remove premature Chapter II announcements. Balance encounters after shared mechanics are stable, including failed-check combat routes and same-class parties.

**Gate:** a friend unfamiliar with the project can begin and finish a representative quest/combat loop without the developer explaining hidden controls or recovery steps.

### 12. Run the release matrix and only then declare Chapter I complete

Run fresh player-driven playthroughs, not injected quest milestones. Record save checkpoints, actual steps, errors, outcomes, and build revision. Reuse `docs/CHAPTER_ONE_PLAYTHROUGH.md`, but expand its outdated Varek-focused C4/C5 wording to the true quest-20 finale.

Required coverage:

- One complete offline solo campaign through the real ending.
- Separate checkpoint branches reaching all six endings legitimately.
- All eight origin arcs; one mixed four-player party and one repeated-origin party.
- Two-, three-, and four-player gameplay; full four-player campaign route.
- Every class, shipped spell, consumable, equipment type, and boss mechanic.
- Failed checks, rejected quests, missing clues, dead essential contacts, retreat, defeat, and revival.
- Custom NPC/environment choices with Claude available, unavailable, delayed, malformed, and attempting unauthorized effects.
- Save/reload at each checkpoint; refresh and host/speaker disconnect during dialogue, travel, combat, and reward delivery.
- Server restart and durable campaign restore; production smoke test on the exact deployed revision.

**Release gate:** zero P0/P1 defects; no known progression softlocks; no state divergence, duplicate reward, or save loss in the matrix; all remaining limitations documented. Passing unit tests alone is not this gate.

## After Chapter I

Only after these gates, author Chapter II using the same entity registry, quest graph, command/effect pipeline, encounter definitions, and test harness. That is what makes subsequent chapters cheaper and safer. A new engine or more visual assets would not resolve the gameplay issues found here.

## Immediate next work item

Start with **Step 1: runtime stability and the short gameplay contract**, then **Step 2: shared authority**. Do not start with more quests, cinematics, character art, or another large UI redesign.

No gameplay fixes or deployment were performed during this audit. The new artifacts are this report and its read-only diagnostic probe.
