const test=require('node:test');
const assert=require('node:assert/strict');
const Sync=require('../lib/conversation-sync.js');

function session(size=4){
  const players={};
  for(let index=1;index<=size;index++)players[`p${index}`]={id:`p${index}`,name:`Player ${index}`,connected:true,character:{name:`Hero ${index}`,class:'paladin',race:'human'}};
  return {code:'TEST-1000',state:'playing',players,combatState:null,conversation:null};
}

test('one designated speaker owns a conversation for parties of up to four',()=>{
  const game=session(4);
  const opened=Sync.begin(game,'p3',{npcId:'captain_rhael',npcName:'Captain Rhael',npcTitle:'Captain of the Watch'},1000);
  assert.equal(opened.ok,true);
  assert.equal(game.conversation.controllerId,'p3');
  assert.equal(game.conversation.controllerName,'Hero 3');
  assert.equal(Sync.begin(game,'p2',{npcId:'scribe',npcName:'Scribe'},1001).ok,false);
  const stolen=Sync.update(game,'p2','close',{conversationId:opened.state.id},1002);
  assert.equal(stolen.ok,false);
  assert.equal(game.conversation.active,true);
});

test('conversation responses are ordered, bounded, and safe for observers',()=>{
  const game=session(4),opened=Sync.begin(game,'p2',{npcId:'scribe',npcName:'The <Scribe>'},2000);
  const options=Array.from({length:8},(_,index)=>({text:`Choice <${index}>`,type:index===0?'end':'talk',roll:index===1?{stat:'CHA',skill:'persuasion',dc:99}:null,effects:{flags:{ai_forged:true}}}));
  const response=Sync.update(game,'p2','response',{conversationId:opened.state.id,text:'A <dangerous> answer.',options},2100);
  assert.equal(response.ok,true);
  assert.equal(response.state.revision,2);
  assert.equal(response.state.line,'A dangerous answer.');
  assert.equal(response.state.options.length,5);
  assert.deepEqual(response.state.options[1].roll,{stat:'CHA',skill:'persuasion',dc:30});
  assert.equal('effects' in response.state.options[0],false);
  const stale=Sync.update(game,'p2','player_action',{conversationId:'old-conversation',text:'Hello'},2200);
  assert.equal(stale.ok,false);
});

test('checks synchronize deterministic results and closing clears late-join state',()=>{
  const game=session(3),opened=Sync.begin(game,'p3',{npcId:'mourne',npcName:'Sister Mourne'},3000);
  const check=Sync.update(game,'p3','check',{conversationId:opened.state.id,ability:'cha',skill:'persuasion',dc:13,roll:18,rolls:[18],abilityMod:3,proficiency:2,total:23,success:true,crit:false,fumble:false,proficient:true,mode:'advantage'},3100);
  assert.equal(check.ok,true);
  assert.equal(check.relay.actorId,'p3');
  assert.equal(check.relay.total,23);
  assert.equal(Sync.publicState(game.conversation).lastCheck.success,true);
  const transition=Sync.update(game,'p3','scene_break',{conversationId:opened.state.id,sceneName:'Varek Confrontation <Talk>'},3150);
  assert.equal(transition.ok,true);
  assert.equal(transition.relay.sceneName,'varekconfrontationtalk');
  const closed=Sync.update(game,'p3','close',{conversationId:opened.state.id,graceful:true},3200);
  assert.equal(closed.ok,true);
  assert.equal(game.conversation,null);
  assert.equal(Sync.publicState(game.conversation),null);
});

test('combat and non-playing sessions reject conversation starts',()=>{
  const waiting=session(2);waiting.state='waiting';
  assert.equal(Sync.begin(waiting,'p1',{npcId:'guard',npcName:'Guard'}).ok,false);
  const combat=session(2);combat.combatState={active:true};
  assert.equal(Sync.begin(combat,'p1',{npcId:'guard',npcName:'Guard'}).ok,false);
});
