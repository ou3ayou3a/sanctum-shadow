const emptyEffects=()=>({flags:{},facts:{},reputation:[],resources:{hp:0,holy:0,hell:0,xp:0},items:{add:[],remove:[]},questEvents:[]});
const effects=overrides=>Object.freeze({...emptyEffects(),...overrides});
const check=(skill,ability,dc)=>Object.freeze({skill,ability,dc});
const action=config=>Object.freeze({icon:'◆',once:true,effects:effects({}),failureEffects:effects({}),...config});

export const TARNISHED_CUP_ACTIONS=Object.freeze({
  burnedLedger:Object.freeze([
    action({
      id:'reconstruct_burned_ledger',icon:'▤',label:'Reconstruct the burned account ledger',check:check('investigation','int',12),
      successText:'The scorched entries align: Church silver paid for two sealed rooms, a cart, and men carrying Varek’s private mark on the night of the fire.',
      failureText:'The brittle pages break apart before the missing payments can be reconstructed.',
      effects:effects({flags:{cupside_orders_found:true},facts:{ai_tarnished_ledger_orders:'Church silver paid for rooms and transport used by agents bearing Elder Varek’s private mark.'},resources:{hp:0,holy:0,hell:0,xp:30},items:{add:['Charred Cupside Ledger'],remove:[]},questEvents:['scene:cupside_evidence_found']}),
      failureEffects:effects({flags:{tarnished_ledger_damaged:true}}),
    }),
    action({
      id:'read_ledger_cipher',icon:'✦',label:'Decode the marks in the ledger margin',check:check('arcana','int',14),
      successText:'The margin is not bookkeeping. It is a route cipher pointing from the Cup to Saint Aldric by way of an abandoned ossuary road.',
      failureText:'The marks resemble a route, but their repeating symbols refuse to resolve.',
      effects:effects({flags:{tarnished_ossuary_route_known:true},facts:{ai_tarnished_ossuary_route:'A coded route links the Tarnished Cup to Saint Aldric through an abandoned ossuary road.'},resources:{hp:0,holy:0,hell:0,xp:25}}),
    }),
  ]),
  cloakedBooth:Object.freeze([
    action({
      id:'eavesdrop_cloaked_figures',icon:'👂',label:'Eavesdrop without drawing attention',check:check('perception','wis',12),
      successText:'Between the music and clattering cups, you catch one clear sentence: “The Candle wants every witness moved before dawn.”',
      failureText:'One hood turns toward you. The argument stops immediately.',
      effects:effects({flags:{tarnished_candle_overheard:true},facts:{ai_candle_moves_witnesses:'An agent called the Candle ordered every Covenant witness moved before dawn.'},resources:{hp:0,holy:0,hell:0,xp:20},questEvents:['scene:cupside_evidence_found']}),
      failureEffects:effects({flags:{tarnished_informants_alerted:true},reputation:[{faction:'church',delta:-1}]}),
    }),
    action({
      id:'read_cloaked_figures',icon:'◉',label:'Read which figure is afraid',check:check('insight','wis',13),
      successText:'The figure nearest the wall is an informant. The other is deciding whether to betray him before he is silenced.',
      failureText:'Their rehearsed stillness reveals nothing certain.',
      effects:effects({facts:{ai_cloaked_informant:'The cloaked figure nearest the wall reports to the Church; his companion fears being silenced.'}}),
    }),
  ]),
  cellarHatch:Object.freeze([
    action({
      id:'inspect_cellar_hatch',icon:'⌄',label:'Inspect the sealed cellar hatch',check:check('investigation','int',11),
      successText:'The lock is ceremonial. Fresh scrape marks reveal a pressure catch beneath the third iron nail.',
      failureText:'The hatch appears swollen shut and offers no obvious mechanism.',
      effects:effects({flags:{tarnished_cellar_catch_known:true},facts:{ai_tarnished_cellar_catch:'The Tarnished Cup cellar hatch opens through a pressure catch beneath its third iron nail.'}}),
    }),
    action({
      id:'listen_below_hatch',icon:'👂',label:'Listen beneath the cellar',check:check('perception','wis',13),
      successText:'Below the casks, water moves through a much larger stone passage. Someone crosses it with a lantern and stops directly beneath you.',
      failureText:'You hear only settling timber and the slow drip of spilled ale.',
      effects:effects({flags:{tarnished_cellar_route_known:true},facts:{ai_tarnished_tunnel:'A trafficked stone passage runs beneath the Tarnished Cup cellar.'},resources:{hp:0,holy:0,hell:0,xp:20}}),
    }),
  ]),
  missingBoard:Object.freeze([
    action({
      id:'compare_missing_notices',icon:'▤',label:'Compare the missing-person notices',check:check('investigation','int',10),
      successText:'Four missing regulars vanished on different nights, but every notice names the same last sighting: a white cart outside the south gate.',
      failureText:'Rain-smeared ink and contradictory dates make the notices impossible to align.',
      effects:effects({flags:{tarnished_missing_regulars_known:true},facts:{ai_white_cart_missing_regulars:'Four missing Tarnished Cup regulars were last seen entering the same white cart near Vaelthar’s south gate.'},resources:{hp:0,holy:0,hell:0,xp:15}}),
    }),
  ]),
  oldCross:Object.freeze([
    action({
      id:'study_hearth_cross',icon:'☩',label:'Study the old cross carved by the hearth',check:check('religion','wis',12),
      successText:'The tiny cross predates the Eternal Flame. Someone has polished it with a thumb every night for decades.',
      failureText:'Soot and knife marks obscure the carving’s age and purpose.',
      effects:effects({facts:{ai_tarnished_old_cross:'A quietly tended cross beside the Tarnished Cup hearth predates the Eternal Flame.'},resources:{hp:0,holy:2,hell:0,xp:10}}),
    }),
  ]),
});

export function tarnishedCupActions(id){return [...(TARNISHED_CUP_ACTIONS[id]||[])];}
