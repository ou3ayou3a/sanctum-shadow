'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');

class AudioParamMock{
  constructor(value=0){this.value=value;}
  setValueAtTime(value){this.value=value;}
  setTargetAtTime(value){this.value=value;}
  linearRampToValueAtTime(value){this.value=value;}
  exponentialRampToValueAtTime(value){this.value=value;}
  cancelScheduledValues(){}
  cancelAndHoldAtTime(){}
}
class AudioNodeMock{connect(target){this.target=target;return target;}disconnect(){this.disconnected=true;}}
class AudioContextMock{
  constructor(){this.currentTime=1;this.sampleRate=120;this.state='running';this.destination=new AudioNodeMock();this.listener={positionX:new AudioParamMock(),positionY:new AudioParamMock(),positionZ:new AudioParamMock(),forwardX:new AudioParamMock(),forwardY:new AudioParamMock(),forwardZ:new AudioParamMock(-1),upX:new AudioParamMock(),upY:new AudioParamMock(1),upZ:new AudioParamMock()};}
  createGain(){const node=new AudioNodeMock();node.gain=new AudioParamMock(1);return node;}
  createPanner(){const node=new AudioNodeMock();node.positionX=new AudioParamMock();node.positionY=new AudioParamMock();node.positionZ=new AudioParamMock();return node;}
  createOscillator(){const node=new AudioNodeMock();node.frequency=new AudioParamMock(440);node.detune=new AudioParamMock();node.start=()=>{};node.stop=()=>{};return node;}
  createBiquadFilter(){const node=new AudioNodeMock();node.frequency=new AudioParamMock();node.Q=new AudioParamMock();return node;}
  createConvolver(){const node=new AudioNodeMock();node.buffer=null;return node;}
  createDelay(){const node=new AudioNodeMock();node.delayTime=new AudioParamMock();return node;}
  createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:index=>data[index]};}
  createBufferSource(){const node=new AudioNodeMock();node.start=()=>{};node.stop=()=>{};node.loop=false;return node;}
  resume(){this.state='running';}
}

function loadAudioEngine(){
  const document={documentElement:{dataset:{}},addEventListener(){},getElementById(){return null;}};
  const window={AudioContext:AudioContextMock,document};
  const context={window,document,console,localStorage:{getItem(){return null;},setItem(){}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},Date,Math,performance:{now:()=>1000}};
  vm.runInNewContext(read('site/audio.js'),context,{filename:'audio.js'});
  return{engine:window.AudioEngine,document};
}

test('moving multiplayer emitters are HRTF positioned, bounded, and event-deduplicated',()=>{
  const {engine,document}=loadAudioEngine();assert.equal(engine.init(),true);
  engine.updateCityListener({position:[0,1,0],forward:[0,0,-1],up:[0,1,0]});
  assert.equal(engine.updateWorldEmitter('party:p2',{position:{x:-4,y:1,z:2},active:true,maxDistance:16}),true);
  assert.equal(engine.playWorldSound('footstep',{x:-4,y:1,z:2},{emitterId:'party:p2',eventId:'step-1'}),true);
  assert.equal(engine.playWorldSound('footstep',{x:-4,y:1,z:2},{emitterId:'party:p2',eventId:'step-1'}),false);
  assert.equal(engine.playWorldSound('impact',{x:80,y:1,z:0},{eventId:'far-impact',maxDistance:20}),false);
  const state=engine.getWorldAudioState();assert.equal(state.emitters.length,1);assert.equal(state.emitters[0].id,'party:p2');assert.deepEqual(Array.from(state.emitters[0].position),[-4,1,2]);assert.equal(state.recentEventCount,1);
  assert.equal(document.documentElement.dataset.multiplayerAudioEmitters,'1');assert.equal(document.documentElement.dataset.lastWorldSound,'footstep');
  assert.equal(engine.removeWorldEmitter('party:p2'),true);assert.equal(engine.getWorldAudioState().emitters.length,0);
});

test('party locomotion updates moving emitters and cleans them up on disconnect',()=>{
  const party=read('site/world3d/party-manager.js');
  assert.match(party,/updateWorldEmitter\?\.\(`party:\$\{record\.id\}`/);
  assert.match(party,/playWorldSound\?\.\('footstep'/);
  assert.match(party,/playWorldSound\?\.\('armor'/);
  assert.match(party,/maxDistance:16/);
  assert.match(party,/removeWorldEmitter\?\.\(`party:\$\{record\.id\}`\)/);
});

test('authoritative battle presentations place releases, impacts, and deaths at their actors',()=>{
  const effects=read('site/world3d/ability-effects.js'),combat=read('site/world3d/combat-controller.js');
  assert.match(effects,/playWorldSound\?\.\(kind,position/);
  assert.match(effects,/`\$\{data\.id\}:\$\{phase\}`/);
  assert.match(effects,/releaseKind=data\.action==='spell'\?'spell_cast'/);
  assert.match(effects,/data\.hit===false&&!data\.healing\?'miss':'impact'/);
  assert.match(combat,/updateWorldEmitter\?\.\(emitterId/);
  assert.match(combat,/emitterId:`combat:\$\{presentation\.targetId\}`/);
  assert.match(combat,/eventId:`\$\{presentation\.id\}:death`/);
  assert.match(combat,/removeWorldEmitter\?\.\(`combat:\$\{record\.combatant\.id\}`\)/);
  assert.doesNotMatch(effects,/socket\.emit/);
});

test('world disposal has a final spatial-emitter safety cleanup',()=>{
  assert.match(read('site/world3d/world-engine.js'),/AudioEngine\?\.clearWorldEmitters\?\.\(\)/);
  const audio=read('site/audio.js'),combat=read('site/world3d/combat-controller.js');assert.match(audio,/MAX_WORLD_EMITTERS = 32/);assert.match(audio,/panningModel='HRTF'/);assert.match(audio,/worldSoundAudible/);assert.match(audio,/wasActive!==record\.active/);assert.match(combat,/performance\.now\(\)<\(record\.deathUntil/);
});
