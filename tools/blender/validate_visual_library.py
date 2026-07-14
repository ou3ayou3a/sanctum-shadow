"""Headless integrity check for every generated Sanctum & Shadow GLB."""
from __future__ import annotations

import json
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
MANIFEST_PATH = SITE / "world3d/assets/production/manifest.json"
REQUIRED_CHARACTER_ACTIONS = {
    "Idle", "Walk", "Run", "Attack_Slash", "Attack_Smite", "Cast",
    "Bow_Shot", "Block", "Dodge", "Hit", "Death",
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.actions, bpy.data.armatures, bpy.data.meshes, bpy.data.materials):
        for item in list(collection):
            collection.remove(item)


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text())
    failures = []
    imported = 0
    for asset_id, asset in manifest["assets"].items():
        clear_scene()
        path = SITE / asset["url"]
        if not path.is_file() or path.stat().st_size != asset["bytes"]:
            failures.append(f"{asset_id}: missing file or manifest size mismatch")
            continue
        try:
            bpy.ops.import_scene.gltf(filepath=str(path))
        except Exception as error:
            failures.append(f"{asset_id}: import failed: {error}")
            continue
        mesh_count = sum(obj.type == "MESH" for obj in bpy.context.scene.objects)
        if not mesh_count:
            failures.append(f"{asset_id}: contains no meshes")
            continue
        if asset["category"] == "characters":
            action_names = {action.name for action in bpy.data.actions}
            missing = REQUIRED_CHARACTER_ACTIONS - action_names
            if missing:
                failures.append(f"{asset_id}: missing actions {sorted(missing)}")
                continue
            if not any(obj.type == "ARMATURE" for obj in bpy.context.scene.objects):
                failures.append(f"{asset_id}: contains no armature")
                continue
        imported += 1
        print(f"VALID {asset_id}: {mesh_count} meshes")

    if failures:
        raise RuntimeError("Visual library validation failed:\n" + "\n".join(failures))
    print(f"VALIDATED {imported} production GLBs and all character action sets")


if __name__ == "__main__":
    main()
