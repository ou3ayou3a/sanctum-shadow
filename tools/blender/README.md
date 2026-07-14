# Sanctum & Shadow Blender pipeline

This pipeline builds the browser-ready visual library used by the Three.js game.
It is deterministic: committed GLBs can be rebuilt from the script and licensed
source asset without editing the game by hand.

## Build

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python tools/blender/build_visual_library.py
```

Outputs are written to `site/world3d/assets/production/`:

- Medieval city, castle, temple, crypt, cave, bridge, ruin, and nature assets.
- Walkable tavern, shop, temple, castle, house, and dungeon interiors.
- Class weapons and shields with stable grip origins.
- Seven fixed race character variants on the shared animated skeleton.
- `manifest.json` containing URLs, footprints, interactions, and file sizes.
- `tools/blender/sanctum-visual-library.blend`, the generated editable source library. It is intentionally kept outside the public site assets.

The character source is the CC0 Quaternius Ultimate Animated Character Pack model
documented in `site/prototype/ASSET-LICENSE.md`. Environment geometry created by
this script is original project geometry.

## Validate

Import every generated GLB back into Blender and verify the character armatures and animation clips:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python tools/blender/validate_visual_library.py
```
