(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OfflineNarration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function cleanId(value){
    return String(value||'citizen').toLowerCase().replace(/[^a-z0-9_-]/g,'_').replace(/_+/g,'_').slice(0,64)||'citizen';
  }

  function checksum(value){
    return String(value||'').split('').reduce((total,char)=>((total*31)+char.charCodeAt(0))>>>0,2166136261);
  }

  const AUTHORED_REPLIES=Object.freeze({
    captain_rhael:Object.freeze({
      default:`Rhael studies you before answering. "The signing hall burned from the inside. The Crown did not start it. Find the Trembling Scribe near the Archive if you want proof."`,
      scribe:`"The Scribe is frightened because he saw the order before the hall burned," Rhael says. "Watch the Archive doors. Church agents are watching them too."`,
      questEvents:['scene:rhael_reveals_covenant'],
      fact:'Captain Rhael confirmed that the Covenant hall was burned from within and directed the party to the surviving Scribe.',
    }),
    trembling_scribe:Object.freeze({
      default:`The Scribe grips the document roll tighter. "Elder Varek's seal is on the order. Sister Mourne carried it out. If they see me talking to you, they will kill me."`,
      questEvents:['scene:scribe_gives_document'],
      fact:`The surviving Scribe identified Elder Varek's seal on the order that preceded the Covenant fire.`,
    }),
    sister_mourne:Object.freeze({
      default:`Mourne does not deny the accusation. "The Covenant would have made the Church a department of the Crown. Varek chose fire instead. Wrongly, perhaps—but not without reason."`,
      questEvents:['scene:mourne_reveals_varek'],
      fact:'Sister Mourne admitted that Varek chose to destroy the Covenant rather than submit the Church to the Crown.',
    }),
    elder_varek:Object.freeze({
      default:`Varek folds his hands. "I broke the Covenant because its hidden treasury clause would have ended the Church. I will answer for the deaths, but you will hear the whole truth first."`,
      questEvents:[],
      fact:'Elder Varek admitted responsibility for breaking the Covenant and claimed its hidden treasury clause threatened the Church.',
    }),
  });

  const CITIZEN_LINES=Object.freeze([
    `"The Watch doubled its patrols after the signing hall burned," the citizen says. "If you want answers, follow who is frightened—not who is shouting."`,
    `"Carts have been leaving the Archive after midnight," the citizen whispers. "No merchant marks, only Church wax on the covers."`,
    `"The old alleys still reach every district," the citizen says. "Look for the lanterns with blue glass; the Watch uses them to mark safe routes."`,
    `"People are disappearing near the closed gates," the citizen says. "Ask the market porters. They see every sealed wagon that passes."`,
  ]);

  function npcReply(npc={},playerText=''){
    const id=cleanId(npc.id||npc.name),name=String(npc.name||'The citizen').trim().slice(0,100)||'The citizen';
    const authored=AUTHORED_REPLIES[id];
    const lower=String(playerText||'').toLowerCase();
    const asksForVarekLocation=id==='trembling_scribe'&&/\b(where|location|monastery|saint aldric)\b/.test(lower);
    const speech=asksForVarekLocation
      ? `The Scribe looks toward the Archive doors. "The Monastery of Saint Aldric. Elder Varek retreated there the morning after the Covenant burned. Four Church soldiers guard him, and he still believes this order was destroyed."`
      : authored
      ? (id==='captain_rhael'&&lower.includes('scribe')?authored.scribe:authored.default)
      : `${name} studies the street before answering. ${CITIZEN_LINES[checksum(`${id}:${lower}`)%CITIZEN_LINES.length]}`;
    const fact=asksForVarekLocation
      ? 'The surviving Scribe confirmed that Elder Varek is hiding at the Monastery of Saint Aldric with four Church soldiers.'
      : authored?.fact||`${name} shared a grounded lead while the chronicler service was unavailable.`;
    const questEvents=[...(authored?.questEvents||[])];
    if(asksForVarekLocation)questEvents.push('scene:scribe_names_varek_location');
    const options=id==='trembling_scribe'
      ? [
        {text:'Ask where Elder Varek went',type:'talk',roll:null,effects:{facts:{ai_offline_varek_location:'Elder Varek is hiding at the Monastery of Saint Aldric.'},questEvents:['scene:scribe_names_varek_location']}},
        {text:'Ask him to help despite the danger',type:'talk',roll:{stat:'CHA',skill:'persuasion',dc:12},effects:{flags:{ai_offline_help_trembling_scribe:true},facts:{ai_offline_varek_location:'Elder Varek is hiding at the Monastery of Saint Aldric.'},reputation:[{faction:npc.faction||'city_watch',delta:1}],questEvents:['scene:scribe_names_varek_location']},failureEffects:{flags:{ai_offline_wary_trembling_scribe:true}}},
        {text:'End conversation',type:'end',roll:null,effects:{}},
      ]
      : [
        {text:'Ask what evidence they can provide',type:'talk',roll:null,effects:{facts:{[`ai_offline_evidence_${id}`]:fact},questEvents}},
        {text:'Ask them to help despite the danger',type:'talk',roll:{stat:'CHA',skill:'persuasion',dc:12},effects:{flags:{[`ai_offline_help_${id}`]:true},reputation:[{faction:npc.faction||'city_watch',delta:1}]},failureEffects:{flags:{[`ai_offline_wary_${id}`]:true}}},
        {text:'End conversation',type:'end',roll:null,effects:{}},
      ];
    return{
      speech,
      effects:{
        flags:{[`ai_offline_spoke_${id}`]:true},
        facts:{[`ai_offline_${id}`]:fact},
        questEvents,
      },
      options,
    };
  }

  function scene(context='',locationName='Vaelthar'){
    const seed=checksum(`${locationName}:${context}`),id=`offline_scene_${seed.toString(36)}`;
    const atmosphere=[
      'A bell sounds beyond the rooftops while nearby voices drop to guarded whispers.',
      'Wind drives smoke between the buildings, briefly revealing tracks that avoid the main road.',
      'A patrol turns the far corner as shutters close one by one along the street.',
      'Fresh cart ruts cut across older footprints, leading away from the crowded route.',
    ][seed%4];
    return{
      id,
      location:locationName||'The road ahead',locationIcon:'🧭',threat:null,
      narration:`${atmosphere} Without a distant chronicler to interpret the moment, the evidence in front of you remains clear enough to act on.`,
      sub:'Choose a grounded action. Its check and consequences are resolved locally and remain part of the campaign.',
      options:[
        {icon:'🔍',label:'Study the immediate area for a useful lead',type:'explore',roll:{stat:'WIS',skill:'investigation',dc:11},effects:{facts:{[`ai_${id}_lead`]:'The party found a physical trail through careful local investigation.'},resources:{xp:10}},failureEffects:{flags:{[`ai_${id}_search_inconclusive`]:true}}},
        {icon:'💬',label:'Quietly ask nearby witnesses what changed',type:'talk',roll:{stat:'CHA',skill:'persuasion',dc:12},effects:{facts:{[`ai_${id}_witness`]:'A local witness confirmed unusual movement through the area.'}},failureEffects:{flags:{[`ai_${id}_locals_guarded`]:true}}},
        {icon:'🧭',label:'Mark the clue and continue exploring',type:'move',effects:{flags:{[`ai_${id}_marked`]:true}}},
      ],
    };
  }

  return Object.freeze({cleanId,checksum,npcReply,scene});
});
