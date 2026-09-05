# Chapter I gameplay contract

Status: implementation target for the completion plan, established in Step 1.
This is not a claim that later steps are implemented. No combat, death, economy,
or story balancing rules were changed as part of the stability patch.

## Release boundary

Ship one complete Chapter I: 20 core quests (12 main, 8 side), eight supported
origins with three quests per character, six classes, solo play and parties of
2–4 players, and all six authored finale outcomes. A four-character party has
up to 12 owner-specific origin quest records. Side quests should be optional
unless an explicit alternative prerequisite is shown. Chapter II remains out
of this release until it has authored content and its own release tests.

Graphics and extra cinematics are frozen during gameplay completion. Runtime
stability fixes to presentation code are permitted when needed to keep play
working. Do not deploy unfinished steps automatically.

## Rules identity

The game is a D&D-inspired, Divinity-style hybrid, not a strict tabletop emulator.
Preserve six attributes, d20 checks, proficiency, AC, saving throws, advantage /
disadvantage, turn-based combat, three AP per turn, and mana-based abilities.
Do not convert to spell slots or tabletop action/bonus-action economy in this release.

| Area | Completion rule |
| --- | --- |
| Checks | d20 + ability modifier + proficiency when trained, against explicit DC. Show all contributions before/after resolving. |
| Roll mode | Advantage takes the higher of two d20s; disadvantage the lower; both cancel. |
| House rule | Preserve existing natural-20 success / natural-1 failure for skill checks and attacks. Ordinary saves use the total, not automatic success/failure. Label this clearly as a house rule. |
| Attacks | Compare to AC. Critical attacks double damage dice, not flat modifiers. |
| Costs | Three AP per turn. Existing baseline: attack/move/item 1 AP; spells use their explicit AP/MP cost. Validate before committing; no cost from an invalid action. |
| Movement | World-space metres; actual traversable path consumes the budget. Existing 4.5m-per-AP budget is the starting balance value, not permission to cross walls. |
| Targeting | Ability definitions declare enemy/ally/self/downed targets, range, line of sight, area, and friendly-fire policy. No universal inferred behavior from flavor text. |
| State effects | One accepted command produces one committed outcome. Narration and animation describe it; they cannot invent or duplicate it. |
| Party checks | A real participant performs the check. Helpers volunteer and use actual skill modifiers. Do not silently substitute the host or the highest raw attribute. |
| Exploration | Approach a physical entity and interact. Arrival reveals opportunities; it does not automatically search rooms or conduct conversations. |
| Open choices | Claude proposes a legal intent; shared rules resolve it. Offline responses preserve the same authored campaign options. Unsupported actions are explained honestly. |
| Origin ownership | Three personal quests per character, playable with the party. Owner leads the personal reckoning; shared decisions have an explicit voting/consent policy. |
| Rewards | Each quest/encounter reward has an immutable claim ID. Reconnect, reload, and duplicate messages cannot pay it twice. |
| Recovery | Never overwrite a known-good save after a detected core runtime failure. Active-state save/reconnect policy is completed in Step 10. |

Recommended death model for Step 3: downed allies, a clearly stated revival
window, and party-defeat checkpoint recovery; hardcore becomes opt-in. Existing
death behavior is not changed now. Any change to permanently fatal prayer or
authored story deaths needs explicit narrative/balance review, not an incidental
refactor. Preserve current content until that decision is implemented and tested.

## Inventory of gameplay ownership

This catalog identifies every major command family and its current definitions;
Step 2 will move ownership into shared reducers without rewriting all content.

| Commands / state | Current source inventory | Required consolidation |
| --- | --- | --- |
| Creation, race/class/origin | `site/data.js`, `site/game.js`, `site/classes.js`, `site/party-origin-quests.js` | Catalog IDs and stable character identity |
| Interact / approach / travel | `site/world3d/world-engine.js`, `npc-manager.js`, `zone-registry.js`, `site/map.js`, `site/travel.js` | Physical entity, location, reach, availability |
| Scene/dialogue choice and party vote | `site/story.js`, `site/story-extra-*.js`, `site/dialogue.js`, `lib/conversation-sync.js` | Scene/choice version and explicit owner |
| Check / attack / save / initiative | `site/rules.js`, `site/game.js`, `site/combat.js`, `server.js` | Shared resolver, seeded tests |
| Cast / statuses / class resources | `site/combat.js`, `site/data.js`, `site/classes.js`, `site/skilltree.js`, `server.js` | One ability and effect registry |
| Tactical move / cover | `site/tactical-combat.js`, `site/world3d/navigation-grid.mjs`, `combat-controller.js` | Shared path and targeting validation |
| Encounter end / retreat / defeat | `site/combat.js`, `site/multiplayer.js`, `server.js` | Exactly-once outcome plus continuation |
| Quest milestones / rewards | `site/quests.js`, `site/quest-entry-hooks.js`, `site/game.js` | Validated branching quest graph |
| Personal quests / party history | `site/party-origin-quests.js`, legacy `pq_*` scenes | Owner context, durable stage, authored payoff |
| Environmental/custom actions | `site/world3d/environment-actions.mjs`, `tarnished-cup-actions.mjs`, `site/game.js` | Context-authorized effects |
| AI requests and offline response | `site/claude-contract.js`, `claude-effects.js`, `offline-narration.js`, `server.js` | Narrator cannot emit protected events |
| Buy / sell / equip / use / loot | `site/shop.js`, `site/charsheet.js`, `site/combat.js`, `server.js` | Item catalog, quantities, transactions |
| Rest / time / schedules / prayer | `site/camp.js`, `site/schedules.js`, `site/prayer.js` | Durable resources, costs, shared time |
| Reputation / fate / relationships | `site/reputation.js`, `consequences.js`, `romance.js`, `merchant-pricing.js` | One canonical fact/lifecycle registry |
| Save / restore / session lifecycle | `site/saves.js`, `schema.js`, `multiplayer.js`, `lib/session-store.js`, `session-security.js`, `party-rules.js`, `world-presence.js`, `server.js` | Durable campaign separate from socket room |

Persisted-state checklist for Step 10: character identity/build, HP/MP/AP and class
resources, equipment/inventory/quantities, XP/reward claims, conditions and prayer
effects; quest graph and owner context; NPC lifecycle/facts/relationships/factions;
world clock/location/positions; active encounter and committed actions; unresolved
scene/dialogue/check plus controller/version; pending transition; campaign revision.
Existing saves cover only a subset. Runtime-health records are diagnostics, not saves.

## Step 1 stability acceptance

- Color, texture, and absent backgrounds do not throw during atmosphere updates.
- Optional effect failure is reported once and quarantined; movement, interaction,
  dialogue, combat, camera, and direct rendering continue through frame updates.
- Compositor failure uses direct rendering; no silent infinite failure loop.
- A core update exception is visible, stops local world updates, and blocks new
  saves until a clean reload/checkpoint rebuild. Multiplayer server play may continue.
- Behavioral tests execute real frame/atmosphere methods with isolated adapters.
  This is integration smoke coverage, not a complete browser campaign run.
- Step 12 still requires fresh browser playthroughs, multiplayer integration, and
  production verification before declaring Chapter I finished.
