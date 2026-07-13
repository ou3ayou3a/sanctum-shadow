/* =========================================================================
   npcs.js — story NPCs for Vaelthar, built from the character system.
   Each config is a state object understood by createCharacter() plus
   placement (pos / face), a dialogue id (matches dialogue.js), name/title
   for the world-space nameplate, and an optional pose tweak.
   ========================================================================= */
import * as THREE from 'three';
import { createCharacter } from './charbuilder.js';

/* poses are applied after build; they nudge limbs for character */
const POSES = {
  handOnHilt(c) { c.arms.r.group.rotation.x = 0.5; c.arms.r.group.rotation.z = -0.5; c.arms.r.elbow.rotation.x = 0.9; },
  clutch(c) { c.arms.l.group.rotation.x = 0.9; c.arms.r.group.rotation.x = 0.9; c.arms.l.elbow.rotation.x = 1.2; c.arms.r.elbow.rotation.x = 1.2; c.arms.l.group.rotation.z = 0.3; c.arms.r.group.rotation.z = -0.3; },
  preach(c) { c.arms.r.group.rotation.x = -2.4; c.arms.l.group.rotation.x = -1.2; c.arms.r.group.rotation.z = 0.3; },
  handsClasped(c) { c.arms.l.group.rotation.x = 0.7; c.arms.r.group.rotation.x = 0.7; c.arms.l.group.rotation.z = 0.4; c.arms.r.group.rotation.z = -0.4; c.arms.l.elbow.rotation.x = 0.9; c.arms.r.elbow.rotation.x = 0.9; },
  lean(c) { c.root.rotation.x = 0.12; c.arms.r.group.rotation.x = 0.6; },
  slump(c) { c.root.rotation.z = 0.1; c.arms.l.group.rotation.x = 0.3; },
};

/* ---------------- SQUARE NPCs ---------------- */
export const SQUARE_NPCS = [
  {
    id: 'captain_rhael', name: 'Captain Rhael', title: 'Of the Watch',
    pos: [0, 0, -16.5], face: 0.1, pose: 'handOnHilt',
    race: 'human', skin: '#b9794e', hair: '#9a9388',
    equipped: { helmet: 'none', chest: 'chainmail', shoulders: 'light', gauntlets: 'light', boots: 'heavy', weapon: 'sword' },
    tint: '#8a8782',
  },
  {
    id: 'trembling_scribe', name: 'Aldis', title: 'The Trembling Scribe',
    pos: [14.4, 0, 8], face: -1.5, pose: 'clutch',
    race: 'human', skin: '#d8b89a', hair: '#5a4326',
    equipped: { helmet: 'leatherhood', chest: 'clothrobe', shoulders: 'none', gauntlets: 'none', boots: 'light', weapon: 'none' },
    cloth: '#4a4336', tint: '#5a3c24',
  },
  {
    id: 'sister_mourne', name: 'Sister Mourne', title: 'The Candle · Inquisitor',
    pos: [13.2, 0, -2.5], face: -2.0, pose: 'handsClasped',
    race: 'human', skin: '#e3c3a6', hair: '#2a2420',
    equipped: { helmet: 'none', chest: 'clothrobe', shoulders: 'none', gauntlets: 'none', boots: 'light', weapon: 'staff' },
    cloth: '#d8cdb4', tint: '#c9a24b',
  },
  {
    id: 'screaming_preacher', name: 'Brother Lect', title: 'The Screaming Preacher',
    pos: [11.6, 0.95, -7], face: -1.7, pose: 'preach',
    race: 'human', skin: '#caa07a', hair: '#6a4a2a',
    equipped: { helmet: 'none', chest: 'clothrobe', shoulders: 'none', gauntlets: 'none', boots: 'none', weapon: 'none' },
    cloth: '#7c2a23', tint: '#b07a3a',
  },
  {
    id: 'vaelthar_guard_1', dialogueId: 'vaelthar_guard', name: 'Watchman', title: 'Royal Guard',
    pos: [-6.5, 0, -8], face: 0.6, pose: 'handOnHilt',
    race: 'human', skin: '#c98b63', hair: '#3a2a1a',
    equipped: { helmet: 'chaincoif', chest: 'chainmail', shoulders: 'light', gauntlets: 'light', boots: 'heavy', weapon: 'sword' },
    tint: '#7c8a9a',
  },
  {
    id: 'vaelthar_guard_2', dialogueId: 'vaelthar_guard', name: 'Watchman', title: 'Royal Guard',
    pos: [6.2, 0, 6.5], face: -2.4, pose: 'handOnHilt',
    race: 'orc', skin: '#6f8f4e', hair: '#241a12',
    equipped: { helmet: 'chaincoif', chest: 'chainmail', shoulders: 'heavy', gauntlets: 'light', boots: 'heavy', weapon: 'mace' },
    tint: '#7c8a9a',
  },
  {
    id: 'vaelthar_guard_3', dialogueId: 'vaelthar_guard', name: 'Watchman', title: 'Royal Guard',
    pos: [-9, 0, 3], face: 1.4, pose: 'handOnHilt',
    race: 'dwarf', skin: '#c08254', hair: '#5a3a1a',
    equipped: { helmet: 'platehelm', chest: 'plate', shoulders: 'light', gauntlets: 'heavy', boots: 'heavy', weapon: 'sword' },
    tint: '#7c8a9a',
  },
];

/* ---------------- TAVERN INTERIOR NPCs ---------------- */
export const TAVERN_NPCS = [
  {
    id: 'lyra_innkeeper', name: 'Lyra', title: 'Keeper of the Cup',
    pos: [2, 0, -5.0], face: 0, pose: 'lean',
    race: 'human', skin: '#caa078', hair: '#6b2f1f',
    equipped: { helmet: 'none', chest: 'leather', shoulders: 'none', gauntlets: 'none', boots: 'light', weapon: 'none' },
    tint: '#5a3c24',
  },
  {
    id: 'drunk_cartographer', name: 'The Cartographer', title: 'deep in his cups',
    pos: [-2.5, 0, 1.5], face: -0.6, pose: 'slump',
    race: 'human', skin: '#cf9d78', hair: '#7a6a4a',
    equipped: { helmet: 'none', chest: 'clothrobe', shoulders: 'none', gauntlets: 'none', boots: 'light', weapon: 'none' },
    cloth: '#3a4d63',
  },
  {
    id: 'nervous_merchant', name: 'Nervous Merchant', title: 'by the fire',
    pos: [-5.4, 0, -2.6], face: 0.9, pose: 'clutch',
    race: 'human', skin: '#d8b89a', hair: '#3a2a1a',
    equipped: { helmet: 'none', chest: 'leather', shoulders: 'light', gauntlets: 'none', boots: 'light', weapon: 'none' },
    tint: '#7c5a2a',
  },
  {
    id: 'cloaked_figure_1', name: 'Cloaked Figure', title: 'a hushed argument',
    pos: [5.0, 0, 3.0], face: -2.6, pose: 'handsClasped',
    race: 'darkelf', skin: '#6a5566', hair: '#d9d2e6',
    equipped: { helmet: 'leatherhood', chest: 'clothrobe', shoulders: 'light', gauntlets: 'none', boots: 'light', weapon: 'dagger' },
    cloth: '#1f1a16', tint: '#23201c',
  },
  {
    id: 'cloaked_figure_2', name: 'Cloaked Figure', title: '“…the Candle did it.”',
    pos: [6.2, 0, 2.0], face: 2.4, pose: 'clutch',
    race: 'human', skin: '#b88a6a', hair: '#2a2018',
    equipped: { helmet: 'leatherhood', chest: 'clothrobe', shoulders: 'none', gauntlets: 'none', boots: 'light', weapon: 'none' },
    cloth: '#241f1a', tint: '#23201c',
  },
];

/* build one NPC; returns { id, dialogueId, name, title, character, root } */
export function buildNPC(cfg) {
  // `id` is the UNIQUE instance id (used for mesh tagging / raycast resolution);
  // `dialogueId` is the registry id passed to startNPCConversation. For NPCs that
  // already have a unique id, dialogueId defaults to that id.
  const dialogueId = cfg.dialogueId || cfg.id;
  const character = createCharacter({
    race: cfg.race, skin: cfg.skin, hair: cfg.hair, tint: cfg.tint, equipped: cfg.equipped,
  });
  if (cfg.cloth) character.setCloth(cfg.cloth);
  const root = character.root;
  root.position.set(cfg.pos[0], cfg.pos[1] || 0, cfg.pos[2]);
  root.rotation.y = cfg.face || 0;
  if (cfg.pose && POSES[cfg.pose]) POSES[cfg.pose](character);
  // tag every mesh with the UNIQUE instance id so raycasting resolves the owning NPC
  root.traverse(o => { o.userData.npcId = cfg.id; o.userData.npcName = cfg.name; });
  root.userData.npcId = cfg.id;
  return { id: cfg.id, dialogueId, name: cfg.name, title: cfg.title, character, root, cfg, headY: character.height + (cfg.pos[1] || 0) };
}
