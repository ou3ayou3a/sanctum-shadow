# Step 5 — physical quest interactions

Status: in progress. The foundation, Mol NPC, and night-vigil passes were deployed through `cb1e941`. This release adds the well-shaft, tithe, origin-site, and pending-state work below. This is not the completed Step 5 acceptance gate.

Latest suite: 321 tests passed, including the existing four-player server integration test. Syntax and whitespace checks passed. The new multiplayer physical handoff has serialization/application tests, not a rendered multi-client playthrough or server proximity enforcement.

Implemented:

- Explicit interaction context tied to an entity and zone.
- Reach revalidation when confirming a prompt, selecting an environmental option, or submitting a custom action.
- NPC conversation entry requires explicit interaction, not merely standing nearby.
- Chapter I quest introductions no longer auto-open on 3D arrival or save recovery.
- Queued introductions recheck location and physical permission before invoking the scene factory.
- Quest introductions are available as contextual actions on existing landmarks/regional focus points; the journal marker targets that entry point.
- All eight origin stage-two investigations have distinct stable evidence entities instead of the destination focus point. Their authored positions have reachable approaches in the actual collision catalog. Arrival and interaction with the generic focus cannot start an investigation.
- Mol now has physical targets for the existing well, Warden Hesk, the well witness, and Preacher Aldran, using the existing world/character assets.
- Seven Mol scene boundaries now validate the correct target before their factories can mutate story state. Cross-target choices queue a conversation and return to exploration rather than talking remotely.
- Pending physical scene requests are restored from saves using a strict scene/entity allowlist. Success/reward branches are not exposed as independent world menu options.
- The night vigil has a separate reachable seat beside the well. Each night consumes its interaction context, waits for darkness when needed, and ends at dawn. Continuing requires another explicit interaction; three successful transcriptions still grant the authored reward. Failure still lowers the next check DC without granting a successful transcription.
- Cabb is a reachable world NPC. The capping ending waits for interaction with him, requires the existing two-night threshold or resolved syllable, and cancels pending vigils. The post-capping tally-stick now requires returning to Hesk; its reward remains one-time.
- The well has a dedicated playable shaft, an ancient sealing stone, an underground vigil seat, and a return rope. Descent checks occur at the physical rim, not while talking to Hesk. The resolved check unlocks the rope transition; the stone scene still requires a separate interaction below. Map travel cannot bypass the rope to enter or leave.
- Underground vigil bonuses are derived from the actual zone; an old saved underground flag cannot lower the outdoor DC. Capping clears both vigil requests and pending stone/descent requests.
- Local shaft transitions do not roll road encounters. Browser QA exposed an unrelated random lockbox appearing on descent; the travel wrapper now explicitly excludes these local passages, with a regression test.
- The Demon's Tithe now has its collection chest, Elder Berrick, parish ledger, collector, and Second Stone as distinct targets. Its authored scene callbacks are tested through the physical handoffs; remote attempts cannot grant the ledger/stone clues. Asking about the last Sayer requires returning to Berrick. Revisiting the ledger cannot duplicate its founding-page item.
- A repeated interaction while already in reach immediately offers confirmation instead of waiting for a zero-length movement callback. Approaching still does not itself confirm an action.
- Pending physical scene requests synchronize in shared campaign snapshots through the same allowlist as saves. A handoff closes an obsolete guest scene and refreshes target markers, without closing private memory panels. Most-recent requests receive marker priority.

Latest targeted browser check: used the local fixture to approach the well through game pathfinding, explicitly inspected it, resolved the real descent check, selected the rope action, loaded the shaft, walked to the sealing stone, and explicitly examined it. Arrival alone left the well quest at 1/4; stone interaction advanced it to 2/4. The climb-out choice returned to exploration, requiring movement to and confirmation of the return rope. This is a targeted fixture, not a full campaign playthrough. The random-travel exclusion was added after the browser exposed the lockbox and is covered by a regression test.

Still required:

- Replace shared regional focus points with individually authored NPC, clue, door, room, and evidence targets.
- Complete Mol's remaining sermon/congregation/Brother Lect boundaries and their NPC staging. The well and tithe work does not complete every Mol quest.
- Convert later scene-to-scene movement into physical exploration boundaries without exposing payoff scenes as shortcuts.
- Validate every core quest and origin branch against those targets, including checks, combat continuations, save/load, and guest-initiated multiplayer actions.
- Server-authoritative physical presence checks for narrative commands. Current browser gates are usability enforcement, not an anti-cheat boundary.
- Browser playthrough of the changed tithe and origin interactions, plus the remaining core routes. Automated tests are not a substitute for that playthrough.

Validation: the expanded suite includes target navigation, cross-entity routing, save allowlisting, and duplicate-menu coverage. In the local rendered tavern fixture, clicking Eron moved the player to him without opening dialogue; arrival displayed a confirmation prompt, and confirming opened his offline conversation. In Mol, approaching the well did not advance its quest; explicit interaction opened the introduction. Selecting Hesk’s conversation returned to exploration with the quest still at 1/4. Walking to Hesk and confirming opened his authored scene. Asking him about the date then routed back to exploration for the separate witness. No new full-campaign or rendered multiplayer playthrough is claimed.
