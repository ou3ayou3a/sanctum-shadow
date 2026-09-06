# Shared combat implementation status

## Delivered in this pass

- Browser and server use the same attack and ability effect resolver.
- All 30 shipped player abilities and 15 enemy abilities have explicit handling.
- Shared shields, healing, area effects, status expiration, damage-over-time, resistance, class resources, and downed-ally revival targeting.
- Victory and defeat settle once per active encounter; retreat awards no victory rewards. Surrender is admitted only when an authored surrender continuation exists.
- Authored victory continuations survive multiplayer transport.
- Regression coverage includes seeded browser/server ability parity and real four-player server combat, support abilities, and retreat.

## Remaining limitations (not completion claims)

- This is not a full campaign playthrough or proof of every quest route.
- Shadow Step currently grants defensive positioning benefits and an automatic next hit; actual destination-selected teleportation still needs the movement/navigation pass. Its legacy tooltip overstates this.
- Some legacy ability descriptions still need a balance/content reconciliation: Disintegrate currently uses a CON save for half damage without ally splash; Multi-Shot selects enemies; Holy Smite's legacy text mentions a Holy cost absent from its catalog entry.
- Surrender requires authored encounter content; no generic surrender story is invented.
- Persistent reward claims across server restarts, non-combat authority, navigation/line-of-sight, and pending-animation action reservations remain separate audit tasks.

Validation: `npm run check` passes 282 tests, including the real multiplayer integration test. Existing graphics and unrelated prototype assets are not part of this release.
