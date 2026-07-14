const emptyEffects=()=>({flags:{},facts:{},reputation:[],resources:{hp:0,holy:0,hell:0,xp:0},items:{add:[],remove:[]},questEvents:[]});
const effects=overrides=>Object.freeze({...emptyEffects(),...overrides});
const check=(skill,ability,dc)=>Object.freeze({skill,ability,dc});
const action=config=>Object.freeze({icon:'◆',once:false,effects:effects({}),failureEffects:effects({}),...config});

const LANDMARK_ACTIONS=Object.freeze({
  north_gate:Object.freeze([
    action({id:'survey_gate',icon:'👁',label:'Survey the gate defenses',check:check('perception','wis',11),once:true,successText:'From the gatehouse shadows, you identify the Watch blind spots and the fastest route north.',failureText:'The overlapping patrols make the gate pattern difficult to read.',effects:effects({facts:{ai_north_gate_blind_spots:'The northern gate changes patrols beside the western tower.'}})}),
  ]),
  signing_hall:Object.freeze([
    action({id:'study_burns',icon:'🔍',label:'Study the burn pattern',check:check('investigation','int',12),once:true,successText:'The fire spread outward from the Church side of the ruined table. It was deliberately started inside.',failureText:'Ash and collapsed stone obscure the fire’s origin.',effects:effects({facts:{ai_signing_hall_origin:'The Covenant fire began on the Church delegation side.'},questEvents:['scene:covenant_hall_scene']})}),
    action({id:'read_residue',icon:'✦',label:'Read the magical residue',check:check('arcana','int',14),once:true,successText:'The residue is alchemical flame, shaped to consume parchment before stone.',failureText:'Too many competing traces remain in the ash.',effects:effects({facts:{ai_signing_hall_alchemy:'Alchemical fire was designed to destroy the treaty documents first.'},resources:{hp:0,holy:0,hell:0,xp:25}})}),
  ]),
  church_archive:Object.freeze([
    action({id:'examine_archive_seal',icon:'🔍',label:'Examine the changed lock',check:check('investigation','int',12),once:true,successText:'Fresh tool marks show the Archive lock was replaced after the Covenant burned.',failureText:'The lock is new, but its maker left no obvious signature.',effects:effects({facts:{ai_archive_lock_replaced:'The Church Archive lock was replaced immediately after the fire.'}})}),
    action({id:'pick_archive_lock',icon:'🗝',label:'Try to pick the Archive lock',check:check('sleight_of_hand','dex',15),once:true,successText:'The final pin yields. You memorize the lock’s weakness before easing it shut again.',failureText:'A pin catches loudly. Someone inside the Archive stops moving.',effects:effects({flags:{ai_archive_lock_understood:true},facts:{ai_archive_lock_weakness:'The Archive’s replacement lock can be opened through its shallow third pin.'}}),failureEffects:effects({flags:{ai_archive_guard_alerted:true},reputation:[{faction:'church',delta:-1}]})}),
  ]),
  temple_quarter:Object.freeze([
    action({id:'listen_old_altar',icon:'☩',label:'Pray beside the buried altar stones',check:check('religion','wis',12),once:true,successText:'Beneath the Eternal Flame iconography, an older carved cross answers with unmistakable stillness.',failureText:'The district noise presses in, leaving only an uneasy silence.',effects:effects({facts:{ai_temple_old_faith:'An older cross lies beneath the Temple Quarter altar stones.'},resources:{hp:0,holy:2,hell:0,xp:0}})}),
  ]),
  watch_post:Object.freeze([
    action({id:'study_patrols',icon:'🗺',label:'Study the patrol maps',check:check('investigation','int',12),once:true,successText:'You commit the Watch rotations and their unguarded archive lane to memory.',failureText:'The map annotations use a rotating cipher you cannot quickly decode.',effects:effects({flags:{ai_watch_patrols_known:true},facts:{ai_watch_patrol_gap:'Archive Lane is briefly unguarded during the evening rotation.'},items:{add:['Marked Patrol Route'],remove:[]}})}),
  ]),
  covenant_fountain:Object.freeze([
    action({id:'search_fountain',icon:'◈',label:'Search beneath the dark water',check:check('perception','wis',10),once:true,successText:'Your fingers close around a treaty coin bearing an unfamiliar seventh seal.',failureText:'You find only ordinary coins and broken stone.',effects:effects({facts:{ai_seventh_seal_coin:'A Covenant coin bears a seventh seal absent from public copies.'},items:{add:['Seventh-Seal Covenant Coin'],remove:[]}})}),
    action({id:'read_statue',icon:'📜',label:'Interpret the broken treaty statue',check:check('history','int',11),once:true,successText:'The missing figure was not Crown or Church. The statue once represented an erased third witness.',failureText:'Damage has removed the identifying marks.',effects:effects({facts:{ai_erased_third_witness:'The Covenant monument originally included a third witnessing faction.'}})}),
  ]),
  ash_market:Object.freeze([
    action({id:'read_market',icon:'👁',label:'Listen for useful market rumors',check:check('insight','wis',11),once:true,successText:'Three unrelated merchants repeat the same name: the Candle.',failureText:'Every rumor contradicts the last.',effects:effects({facts:{ai_market_candle_rumor:'Ash Market merchants whisper that an operative called the Candle arranged the fire.'}})}),
  ]),
  tarnished_cup:Object.freeze([
    action({id:'listen_tavern_door',icon:'👂',label:'Listen at the tavern door',check:check('perception','wis',10),once:true,successText:'Inside, someone urgently repeats the words “Varek” and “monastery.”',failureText:'Music and conversation blur into noise.',effects:effects({facts:{ai_tavern_varek_whisper:'A frightened patron connected Varek to the monastery.'}})}),
  ]),
  south_gate:Object.freeze([
    action({id:'read_wagon_tracks',icon:'⌁',label:'Read the wagon tracks',check:check('survival','wis',12),once:true,successText:'One wagon returned from the Merchant Road much lighter—and with blood beneath its rear axle.',failureText:'Heavy traffic has churned the tracks together.',effects:effects({facts:{ai_south_gate_blood_wagon:'A bloodied wagon returned from the Merchant Road without its cargo.'}})}),
  ]),
});

const KIT_ACTIONS=Object.freeze({
  tavern:Object.freeze([action({id:'listen_room',icon:'👂',label:'Listen for local rumors',check:check('insight','wis',10),once:true,successText:'A repeated name rises through the ordinary gossip, giving you a useful lead.',failureText:'The room’s stories are too tangled to trust.',effects:effects({flags:{ai_tavern_rumor_heard:true}})})]),
  cellar:Object.freeze([action({id:'test_cellar_air',icon:'◌',label:'Test the cellar air',check:check('perception','wis',11),once:true,successText:'A cold draft reveals a concealed opening beyond the stored casks.',failureText:'Damp stone and wine mask any useful current.',effects:effects({flags:{ai_cellar_draft_found:true}})})]),
  forest:Object.freeze([
    action({id:'read_tracks',icon:'⌁',label:'Read the nearby tracks',check:check('survival','wis',12),once:true,successText:'You separate the recent trail from the animal paths and learn what passed this way.',failureText:'Rain and leaf fall have blurred the trail.',effects:effects({flags:{ai_forest_tracks_read:true}})}),
    action({id:'forage',icon:'❧',label:'Forage for useful herbs',check:check('nature','int',11),once:true,successText:'You gather a clean bundle of bitterleaf suitable for treating wounds.',failureText:'The useful plants have already been stripped from this area.',effects:effects({items:{add:['Bitterleaf Bundle'],remove:[]}})}),
  ]),
  ruins:Object.freeze([action({id:'read_ruins',icon:'📜',label:'Study the surviving inscriptions',check:check('history','int',12),once:true,successText:'The inscription records who abandoned this place—and what they feared.',failureText:'Too little of the inscription remains intact.',effects:effects({flags:{ai_ruins_inscription_read:true}})})]),
  cartographer:Object.freeze([action({id:'rebuild_route',icon:'🗺',label:'Reconstruct the abandoned route',check:check('investigation','int',12),once:true,successText:'The scattered notes align into a route leading away from the camp.',failureText:'The damaged map fragments refuse to align.',effects:effects({flags:{ai_cartographer_route_rebuilt:true}})})]),
  dungeon:Object.freeze([action({id:'listen_depths',icon:'👂',label:'Listen beyond the passage',check:check('perception','wis',12),successText:'You identify movement beyond the next turn before it identifies you.',failureText:'Dripping water masks every distant sound.',effects:effects({flags:{ai_dungeon_warning:true}})})]),
  temple:Object.freeze([action({id:'inspect_reliquary',icon:'☩',label:'Inspect the old reliquary',check:check('religion','wis',12),once:true,successText:'The reliquary predates the Eternal Flame and bears the mark of the older faith.',failureText:'Layers of later iconography conceal its origin.',effects:effects({flags:{ai_reliquary_old_faith:true}})})]),
  monastery:Object.freeze([action({id:'read_monastery_stones',icon:'☩',label:'Examine the monastery’s oldest stones',check:check('religion','wis',12),once:true,successText:'The oldest foundation marks point toward a sealed chamber below.',failureText:'Repairs and newer carvings obscure the original plan.',effects:effects({flags:{ai_monastery_lower_chamber:true}})})]),
  archive:Object.freeze([action({id:'trace_archive_catalogue',icon:'▤',label:'Trace the altered catalogue',check:check('investigation','int',13),once:true,successText:'A missing catalogue sequence reveals which records were deliberately removed.',failureText:'The archive’s indexing system defeats a quick search.',effects:effects({flags:{ai_archive_catalogue_gap:true}})})]),
  ashen:Object.freeze([action({id:'test_blue_ash',icon:'✦',label:'Test the blue ash',check:check('arcana','int',13),once:true,successText:'The ash is not a remnant of fire; it is material displaced from somewhere else.',failureText:'The ash changes before you can establish its nature.',effects:effects({flags:{ai_blue_ash_displacement:true}})})]),
  tower:Object.freeze([action({id:'study_tower_geometry',icon:'◇',label:'Study the tower’s impossible geometry',check:check('arcana','int',14),once:true,successText:'The tower’s angles repeat a controlled spatial fold around its entrance.',failureText:'Following one angle makes another impossible to remember.',effects:effects({flags:{ai_tower_spatial_fold:true}})})]),
  road:Object.freeze([action({id:'search_roadside',icon:'🔍',label:'Search the roadside',check:check('investigation','int',11),once:true,successText:'You find where someone left the road deliberately and covered their trail.',failureText:'Traffic has destroyed the useful signs.',effects:effects({flags:{ai_roadside_departure_found:true}})})]),
  outpost:Object.freeze([action({id:'survey_outpost',icon:'👁',label:'Survey the fortifications',check:check('perception','wis',11),once:true,successText:'You identify the outpost’s strongest approach and its neglected flank.',failureText:'The layered defenses reveal no immediate weakness.',effects:effects({flags:{ai_outpost_flank_known:true}})})]),
  village:Object.freeze([action({id:'read_village_mood',icon:'💬',label:'Read the villagers’ mood',check:check('insight','wis',10),once:true,successText:'The villagers are not merely afraid; they are hiding the same person.',failureText:'Doors close before you can read the settlement.',effects:effects({flags:{ai_village_shared_secret:true}})})]),
  fortress:Object.freeze([action({id:'study_fortress',icon:'🛡',label:'Study the fortress approach',check:check('investigation','int',13),once:true,successText:'You trace a defensible approach beneath the western wall.',failureText:'The fortress was designed to deny exactly this kind of study.',effects:effects({flags:{ai_fortress_approach_known:true}})})]),
});

export function getLandmarkActions(id){return [...(LANDMARK_ACTIONS[id]||[])];}
export function getKitActions(kit){return [...(KIT_ACTIONS[kit]||KIT_ACTIONS.ruins)];}
export const ENVIRONMENT_LANDMARK_IDS=Object.freeze(Object.keys(LANDMARK_ACTIONS));
export const ENVIRONMENT_ACTION_KITS=Object.freeze(Object.keys(KIT_ACTIONS));
