# Step 5 — physical quest interactions

Status: in progress. The foundation and Mol NPC pass were deployed in `d8bba24`. The subsequent night-vigil changes are local only. This is not the completed Step 5 acceptance gate.

Latest suite: 310 tests passed, including the four-player server integration test. Syntax and whitespace checks passed. Automated coverage includes three-night completion, failure/retry, clock transitions, invalid route keys, capping prerequisites, and the physical post-capping reward handoff.

Implemented:

- Explicit interaction context tied to an entity and zone.
- Reach revalidation when confirming a prompt, selecting an environmental option, or submitting a custom action.
- NPC conversation entry requires explicit interaction, not merely standing nearby.
- Chapter I quest introductions no longer auto-open on 3D arrival or save recovery.
- Queued introductions recheck location and physical permission before invoking the scene factory.
- Quest introductions are available as contextual actions on existing landmarks/regional focus points; the journal marker targets that entry point.
- Origin stage-two investigations require interaction at the destination focus point. Arrival alone does not start the investigation.
- Mol now has physical targets for the existing well, Warden Hesk, the well witness, and Preacher Aldran, using the existing world/character assets.
- Seven Mol scene boundaries now validate the correct target before their factories can mutate story state. Cross-target choices queue a conversation and return to exploration rather than talking remotely.
- Pending physical scene requests are restored from saves using a strict scene/entity allowlist. Success/reward branches are not exposed as independent world menu options.
- The night vigil has a separate reachable seat beside the well. Each night consumes its interaction context, waits for darkness when needed, and ends at dawn. Continuing requires another explicit interaction; three successful transcriptions still grant the authored reward. Failure still lowers the next check DC without granting a successful transcription.
- Cabb is a reachable world NPC. The capping ending waits for interaction with him, requires the existing two-night threshold or resolved syllable, and cancels pending vigils. The post-capping tally-stick now requires returning to Hesk; its reward remains one-time.

Latest targeted browser check: approached the well, selected the night vigil, walked to its seat, confirmed Night 1, and resolved a real failed WIS check. The clock displayed Dawn, Day 2, 06:00. Selecting “Sit again tonight” closed the scene and returned to exploration with a pending vigil rather than automatically opening Night 2. Cabb’s new ending handoff is covered by automated tests but has not yet been browser-playtested.

Still required:

- Replace shared regional focus points with individually authored NPC, clue, door, room, and evidence targets.
- Complete Mol’s remaining boundaries, including the actual well-shaft interior, night vigil staging, and the other Mol quests. The Mol dialogue pass does not constitute a fully physical quest chain.
- Convert later scene-to-scene movement into physical exploration boundaries without exposing payoff scenes as shortcuts.
- Validate every core quest and origin branch against those targets, including checks, combat continuations, save/load, and guest-initiated multiplayer actions.
- Server-authoritative physical presence checks for narrative commands. Current browser gates are usability enforcement, not an anti-cheat boundary.
- Browser playthrough of the changed quest-entry and origin interactions. Automated tests are not a substitute for that playthrough.

Validation: the expanded suite includes target navigation, cross-entity routing, save allowlisting, and duplicate-menu coverage. In the local rendered tavern fixture, clicking Eron moved the player to him without opening dialogue; arrival displayed a confirmation prompt, and confirming opened his offline conversation. In Mol, approaching the well did not advance its quest; explicit interaction opened the introduction. Selecting Hesk’s conversation returned to exploration with the quest still at 1/4. Walking to Hesk and confirming opened his authored scene. Asking him about the date then routed back to exploration for the separate witness. No new full-campaign or rendered multiplayer playthrough is claimed.
