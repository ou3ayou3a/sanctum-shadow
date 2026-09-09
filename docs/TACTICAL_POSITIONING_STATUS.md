# Tactical positioning pass

Implemented locally:

- Exploration and tactical rules share NavigationGrid through navigation-core.js.
- Combat uses a generated collision catalog for all 24 world locations. It is exported from the actual zone constructors and checked for drift in tests. The server selects obstacles from that catalog, ignoring client-supplied obstacle arrays.
- Destinations inside obstacles or occupied by living combatants are rejected. Accepted routes charge traversable distance against the movement allowance and are returned in authoritative state.
- Full cover and world obstacles block attacks and targeted spells. Area effects use radius and line-of-sight filtering.
- Enemies use the same collision representation for movement and line of sight for attacks/spells.
- Initial combat placement is projected once in rules state rather than independently moving rendered models to different cells.
- Solo commands commit before animations. Multiplayer updates apply on receipt. Visual callbacks cannot resolve commands later or overwrite authoritative state.
- Encounter identity, current turn, active state, and revision are checked again at commit.

Verification completed for this tactical implementation pass:

- Actual game/browser fixtures: city Shadow Step and walking; tavern Shadow Step; wilderness Shadow Step and walking. Teleports spent 1 AP / 25 MP, walking spent 1 AP, and rendered endpoints matched rules coordinates plus battlefield origin.
- Browser QA exposed a real integration bug: the legacy visual-effects wrapper discarded the ground destination. `visuals.js` now forwards arguments and return values, with a regression test.
- Real four-player server integration: Shadow Step position and MP survive another player's reconnect; existing dialogue, support spells, victory, and retreat checks also pass.
- Full regression suite: 290 tests pass. Wilderness verification captured no runtime errors.

Scope limitations, not hidden completion claims:

- Location/origin still follow the initiating client's exploration context; full server-owned travel/presence validation remains a separate authority task. Geometry itself is now server-owned.
- Shadow Step is implemented: choose a visible unoccupied ground destination within 60 feet; validate before costs; synchronize teleport position and retained defensive buff. This does not implement light-level/shadow detection.
- Presentation locks are local UI pacing, not a server animation-duration reservation. Rules resolve immediately; there is no delayed rules transaction to reserve.
- These are targeted test encounters, not a full Chapter I playthrough, exhaustive checks of all 24 locations, or four simultaneous rendered browser clients.

No graphics changes or deployment are included in this pass.

Reproduce browser fixtures with `node tools/tactical-qa-server.cjs` and open `http://127.0.0.1:3003/`. The fixture is loopback-only and is not mounted by `server.js`. Fixture save data is isolated on that local origin. Regenerate collision data with `node tools/export-collision-catalog.mjs`; the catalog test detects changes in actual zone constructors.
