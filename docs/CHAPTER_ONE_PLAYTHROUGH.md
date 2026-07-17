# Chapter I Full Playthrough Protocol

This is the release gate for a genuine start-to-finish playthrough. Run it against the deployed Railway build with a new solo chronicle. Do not reuse an autosave, expired multiplayer session, or character created before the current save schema.

## Clean start

- Create a new solo character and confirm the opening begins in Vaelthar.
- Keep the browser console open and record the first error, location, quest state, and last input if anything fails.
- Use the normal graphics preset for the primary run. Repeat visual trouble spots at High and Low.
- Run the primary playthrough with deterministic offline narration. Test Claude custom choice handling separately after the deterministic path completes.

## Checkpoints

- **C0 — Fresh Arrival:** Immediately after character creation and the first Vaelthar arrival scene.
- **C1 — Vaelthar Evidence:** After acquiring evidence that the Covenant burning was deliberate.
- **C2 — Regional Leads:** After opening the Thornwood, Mol, Merchant Road, and Harren quest routes.
- **C3 — Before Saint Aldric:** Before entering the monastery dungeon or triggering the Chapter I finale.
- **C4 — Before Varek:** Immediately before the final Varek conversation or combat.
- **C5 — Chapter I Complete:** After rewards, quest completion, and the Chapter II hook are visible.

At each checkpoint, create a named manual save, reload it once, and confirm location, HP/MP, inventory, flags, quest objectives, world position, and discovered map locations survive.

## Location coverage

- [ ] Vaelthar — roads, districts, NPCs, shops, interiors, obstruction fading
- [ ] The Tarnished Cup — dialogue, open choice, cellar and exit
- [ ] Temple Quarter — Sister Mourne, temple dressing, Wine House and Archive routes
- [ ] Thornwood Gate — fortifications, Last Post entrance, forest route
- [ ] Mol Village — Aldran dialogue, crowd investigation, Hearthfire interior
- [ ] Monastery of Saint Aldric — courtyard, cellar, dungeon, consecutive encounter respite
- [ ] Merchant Road — ruined caravan, bridge, Broke Wheel Inn, ambush continuation
- [ ] Fortress Harren — walls, gate, Oath Hall, confession resolution
- [ ] Ashen Fields — blue-fire environment, camp, tower unlock
- [ ] Ashen Tower — outer court, antechamber, boss access
- [ ] Thornwood Passage — forest navigation, hut, cartographer route
- [ ] Lost Cartographer — camp investigation and Flask interior
- [ ] Church Archive — locked access, archive hotspots, Scriptorium return route

The associated interiors cover all 24 Chapter I map locations through these parent routes.

## Gameplay gates

- [ ] Every contextual interaction opens once, resolves once, and returns control.
- [ ] Every D&D check displays skill, ability, proficiency contribution, DC, and roll mode.
- [ ] Success and failure both produce visible narration and explicit state effects.
- [ ] Random travel encounters resume the authored arrival scene afterward.
- [ ] Melee, bow, staff, healing, spell, miss, impact, death, victory, and defeat flows complete.
- [ ] Camp recovery cannot bypass required consecutive encounters.
- [ ] Quest milestones complete exactly once and rewards cannot be farmed after reload.
- [ ] Offline narration completes the full route without an API key.
- [ ] At least one Claude custom choice is tested in NPC dialogue and one in an environmental interaction.

## Multiplayer follow-up

After the solo run is clean, repeat the main route with a 2–8 player party. Validate speaker ownership, voting, synchronized dialogue, host-only effects, combat turns, positional audio, reconnect, late join, checkpoint reload, and speaker disconnect during a conversation.

## Bug record

For every failure capture: checkpoint, location, active scene, selected option, expected result, actual result, reproducibility, console output, screenshot, and whether reload recovery worked. Do not continue past a progression blocker until its save is preserved.
