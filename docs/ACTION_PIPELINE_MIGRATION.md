# Shared command pipeline — migration status

This is the first deployable portion of completion-plan Step 2, not a claim
that every gameplay action is migrated. Graphics are unchanged.

## Implemented

- A shared browser/Node command boundary with actor, encounter, revision,
  turn, living-actor, target, range, AP, MP, catalog ownership, and replay checks.
- Pure resolution and explicit effects for baseline attacks, movement,
  restorative items, and ending turns; commit is separate from presentation.
- Solo movement/items and multiplayer attack/movement/items/end-turn use
  the reducer. Solo attacks use its admission and weapon-roll logic while
  preserving existing class/status hooks. Solo spell/end-turn handlers also
  pass shared admission checks.
- Canonical class-spell and shop-item catalogs, shared by browser and server.
  Server spell definitions are no longer supplied by the player's payload.
- Finite command receipts, encounter revisions, terminal encounter/reward guard,
  duplicate client victory suppression, and stale-client resynchronization.
- Explicit legacy potion aliases; arbitrary named quest items cannot heal;
  one inventory entry is consumed, not every matching copy.

## Remaining before the full Step 2 gate

- Migrate interact/choose/check/rest and their scene/prerequisite permissions
  to the command envelope instead of relying on their existing host-owned paths.
- Consolidate authored encounter/enemy definitions; server encounter creation
  still accepts clamped enemy data from a participating client.
- Move solo attack class/status hooks and authored spell effects behind shared
  effects. This must coordinate with Step 3, without replacing buffs with damage.
- Persist reward claims as part of canonical campaign/save state. Current
  encounter guards stop repeat terminal messages within the retained encounter;
  this is not yet a complete cross-save reward ledger.

The remaining work must not be described as done merely because the migrated
command tests pass. Full campaign playthrough remains a separate release gate.
