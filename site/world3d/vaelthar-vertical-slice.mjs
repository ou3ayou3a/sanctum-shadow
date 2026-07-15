import * as THREE from 'three';

const EMPTY_EFFECTS=()=>({flags:{},facts:{},reputation:[],resources:{hp:0,holy:0,hell:0,xp:0},items:{add:[],remove:[]},questEvents:[]});
const effects=overrides=>({...EMPTY_EFFECTS(),...overrides});
const check=(skill,ability,dc)=>({skill,ability,dc});

function mesh(root,geometry,material,position,rotation=[0,0,0],name='vertical-slice-detail'){
  const object=new THREE.Mesh(geometry,material);object.position.set(...position);object.rotation.set(...rotation);object.name=name;object.castShadow=object.receiveShadow=true;root.add(object);return object;
}

function interaction(root,interactables,{id,label,x,z,range=1.7,actions,onInteract}){
  const object=mesh(root,new THREE.CylinderGeometry(range*.72,range*.72,.42,16),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[x,.21,z],[0,0,0],`interaction:${id}`);
  object.castShadow=object.receiveShadow=false;object.userData.interactionId=id;
  interactables.push({id,label,object,position:new THREE.Vector3(x,0,z),range,actions,onInteract});
}

function startCheckpointCombat(engine){
  window.sceneState=window.sceneState||{flags:{},knownFacts:{}};window.sceneState.flags=window.sceneState.flags||{};
  if(window.sceneState.flags.cupside_checkpoint_defeated){engine.toast('The checkpoint is already abandoned.');return;}
  window.sceneState.currentScene='cupside_checkpoint';
  window.sceneState._currentScene={id:'cupside_checkpoint',location:'Cupside Lane',personal:false};
  window.addLog?.('The sergeant reaches for his whistle. Steel clears leather along Cupside Lane.', 'combat');
  window.startCombat?.([
    {id:'cupside_sergeant',name:'Cupside Sergeant',hp:54,maxHp:54,ac:15,atk:5,attackBonus:5,damageMod:3,icon:'🛡',level:3,xp:110,tacticalRole:'frontline'},
    {id:'cupside_crossbow',name:'Church Crossbowman',hp:38,maxHp:38,ac:13,atk:5,attackBonus:5,damageMod:2,icon:'🏹',level:3,xp:90,tacticalRole:'ranged'},
  ],{id:'cupside_checkpoint'});
}

function checkpointFailure(result,engine){
  if(result?.pending||result?.success!==false)return;
  window.setTimeout(()=>startCheckpointCombat(engine),650);
}

export function buildVaeltharVerticalSlice({root,obstacles,interactables,materialLibrary}){
  const animated=[];
  const stone=materialLibrary.material('cobble',0x8a7a63,{bumpScale:.085});
  const darkStone=materialLibrary.material('stone',0x403b34,{bumpScale:.08});
  const wetStone=materialLibrary.material('stone',0x313a37,{bumpScale:.06,roughness:.62});
  const timber=materialLibrary.material('timber',0x4a2f1d,{bumpScale:.045});
  const iron=materialLibrary.material('metal',0x323631,{metalness:.76,roughness:.34});
  const cloth=new THREE.MeshStandardMaterial({color:0x742e2a,roughness:.88,side:THREE.DoubleSide});
  const paper=new THREE.MeshStandardMaterial({color:0xb8a77d,roughness:1,side:THREE.DoubleSide});

  // Covenant Square → Cupside Lane. Narrow, irregular stone courses sit above
  // the broad city road and give this one playable route a deliberately authored read.
  const route=[[-3,7],[-5.4,8.6],[-7.8,10.2],[-10.1,12],[-12.5,14],[-14.8,16.1]];
  for(let i=0;i<route.length-1;i++){
    const [ax,az]=route[i],[bx,bz]=route[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),steps=Math.max(2,Math.ceil(length/.72));
    for(let step=0;step<steps;step++){
      const t=(step+.5)/steps,cx=THREE.MathUtils.lerp(ax,bx,t),cz=THREE.MathUtils.lerp(az,bz,t),row=step%2;
      for(let across=-2;across<=2;across++){
        const sideX=Math.cos(angle),sideZ=-Math.sin(angle),jitter=((i*17+step*7+across*3)%11-5)*.012;
        const slab=mesh(root,new THREE.BoxGeometry(.62+(row?-.05:.05),.055,.58),stone,[cx+sideX*(across*.58+jitter),.078,cz+sideZ*(across*.58+jitter)],[0,angle+((step+across)%3-1)*.025,0],'cupside-hand-laid-cobble');slab.castShadow=false;
      }
    }
  }

  // Raised curbs, open drainage, iron grates, mud and puddles make the street
  // read as used infrastructure rather than a texture painted over a plane.
  for(const side of[-1,1]){
    for(let i=0;i<route.length-1;i++){
      const [ax,az]=route[i],[bx,bz]=route[i+1],dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),nx=Math.cos(angle),nz=-Math.sin(angle),x=(ax+bx)/2+nx*1.83*side,z=(az+bz)/2+nz*1.83*side;
      mesh(root,new THREE.BoxGeometry(.22,.16,length+.08),darkStone,[x,.08,z],[0,angle,0],'cupside-raised-curb');
      mesh(root,new THREE.BoxGeometry(.28,.035,length-.06),wetStone,[x+nx*.27*side,.032,z+nz*.27*side],[0,angle,0],'cupside-drainage-channel').castShadow=false;
    }
  }
  for(const [x,z,rotation]of[[-6.6,9.4,-.93],[-11.5,13.1,-.89]]){
    const grate=new THREE.Group();grate.position.set(x,.065,z);grate.rotation.y=rotation;root.add(grate);
    for(let index=-2;index<=2;index++)mesh(grate,new THREE.BoxGeometry(.055,.035,.68),iron,[index*.13,0,0],[0,0,0],'street-drain-grate');
    mesh(grate,new THREE.BoxGeometry(.72,.03,.055),iron,[0,0,-.31]);mesh(grate,new THREE.BoxGeometry(.72,.03,.055),iron,[0,0,.31]);
  }
  for(const [x,z,sx,sz]of[[-4.7,8.2,1.4,.48],[-9.2,11.5,.9,.35],[-13.7,15.6,1.1,.42]]){
    const puddle=mesh(root,new THREE.CircleGeometry(1,24),new THREE.MeshStandardMaterial({color:0x263b3b,roughness:.2,metalness:.08,transparent:true,opacity:.7}),[x,.069,z],[-Math.PI/2,0,0],'cupside-rain-puddle');puddle.scale.set(sx,sz,1);animated.push({kind:'puddle',object:puddle,phase:x});
  }

  // Dense street storytelling: awnings, projecting signs, laundry, baskets,
  // a handcart and a guard barricade. These assets frame the route at player height.
  for(const [x,z,rotation,width]of[[-6.7,14.6,-.88,3.2],[-12.4,7.3,2.25,2.8]]){
    const awning=mesh(root,new THREE.PlaneGeometry(width,1.55,4,2),cloth,[x,2.55,z],[-1.12,rotation,0],'cupside-cloth-awning');animated.push({kind:'cloth',object:awning,base:awning.rotation.z,phase:x+z});
    for(const offset of[-width*.45,width*.45])mesh(root,new THREE.CylinderGeometry(.045,.055,2.45,7),timber,[x+Math.cos(rotation)*offset,1.22,z-Math.sin(rotation)*offset],[0,0,0],'awning-post');
  }
  const signPost=mesh(root,new THREE.CylinderGeometry(.06,.075,1.25,8),iron,[-15.1,3.65,17.5],[0,0,Math.PI/2],'tarnished-cup-sign-bracket');
  const sign=mesh(root,new THREE.BoxGeometry(1.25,.82,.12),timber,[-14.55,3.05,17.5],[0,.08,0],'tarnished-cup-hanging-sign');animated.push({kind:'sign',object:sign,base:sign.rotation.z,phase:.7});
  for(const [x,z]of[[-7.2,14],[-7.8,14.3],[-12.5,7.8]])mesh(root,new THREE.SphereGeometry(.33,10,7),new THREE.MeshStandardMaterial({color:0x82633f,roughness:1}),[x,.28,z],[0,0,.08],'market-basket');

  const cart=new THREE.Group();cart.position.set(-11.7,0,8.6);cart.rotation.y=.72;root.add(cart);
  mesh(cart,new THREE.BoxGeometry(2.25,.36,1.15),timber,[0,.78,0]);
  for(const side of[-1,1]){const wheel=mesh(cart,new THREE.TorusGeometry(.48,.09,8,18),timber,[side*.83,.48,0],[Math.PI/2,0,0],'handcart-wheel');wheel.rotation.y=Math.PI/2;}
  mesh(cart,new THREE.BoxGeometry(.1,.1,2.3),timber,[-.55,.72,-1.42],[.13,0,-.06],'handcart-shaft');mesh(cart,new THREE.BoxGeometry(.1,.1,2.3),timber,[.55,.72,-1.42],[.13,0,.06],'handcart-shaft');
  obstacles.push({x:-11.7,z:8.6,hw:1.35,hd:.9});

  const checkpoint=new THREE.Group();checkpoint.position.set(-8.8,0,10.8);checkpoint.rotation.y=-.91;checkpoint.userData.closedY=0;root.add(checkpoint);
  for(const side of[-1,1]){mesh(checkpoint,new THREE.BoxGeometry(2.65,.18,.18),timber,[0,1.02+side*.38,side*.04],[0,0,side*.07],'watch-barricade-rail');mesh(checkpoint,new THREE.BoxGeometry(.16,1.35,.2),timber,[side*1.08,.68,0],[0,0,side*.16],'watch-barricade-leg');}
  for(const x of[-.82,0,.82])mesh(checkpoint,new THREE.ConeGeometry(.11,.28,5),iron,[x,1.5,0],[0,0,0],'watch-barricade-spike');
  obstacles.push({x:-8.8,z:10.8,hw:1.05,hd:.42});

  // Physical evidence before the confrontation rewards observation and feeds
  // the same authoritative quest milestone used by social and combat routes.
  const dispatch=mesh(root,new THREE.PlaneGeometry(.75,.52),paper,[-5.35,.092,8.65],[-Math.PI/2,.18,.14],'burned-crown-dispatch');
  const burnedEdge=mesh(root,new THREE.RingGeometry(.18,.31,12,1,0,Math.PI*1.25),new THREE.MeshBasicMaterial({color:0x251912,side:THREE.DoubleSide}),[-5.52,.096,8.58],[-Math.PI/2,0,.3],'dispatch-burn-mark');burnedEdge.castShadow=false;
  interaction(root,interactables,{id:'cupside_dispatch',label:'Examine the burned dispatch',x:-5.35,z:8.65,actions:[
    {id:'read_dispatch',icon:'📜',label:'Reconstruct the surviving orders',check:check('investigation','int',12),once:true,successText:'The surviving lines order Church auxiliaries to seize every witness entering the Tarnished Cup—dated hours before the Covenant burned.',failureText:'Heat has fused the decisive lines into a blackened curl.',effects:effects({flags:{cupside_orders_found:true},facts:{cupside_preordered_arrests:'Church auxiliaries received orders to seize Tarnished Cup witnesses before the Covenant burned.'},items:{add:['Charred Cupside Orders'],remove:[]},resources:{hp:0,holy:0,hell:0,xp:35},questEvents:['scene:cupside_evidence_found']})},
    {id:'read_seal',icon:'◈',label:'Identify the wax seal',check:check('religion','wis',13),once:true,successText:'Beneath the Crown wax is the Candle’s private counterseal. Sister Mourne authorized the arrests.',failureText:'The seal is too blistered to name its owner.',effects:effects({facts:{cupside_candle_seal:'The Candle personally countersealed the Cupside arrest order.'},questEvents:['scene:cupside_evidence_found']})},
  ],onInteract:engine=>engine.toast('The dispatch is burned around the edges, but someone stamped it twice.')});

  const bloodMaterial=new THREE.MeshStandardMaterial({color:0x4e1717,roughness:.72,transparent:true,opacity:.82});
  for(let i=0;i<7;i++){const drop=mesh(root,new THREE.CircleGeometry(.07+(i%3)*.025,12),bloodMaterial.clone(),[-11.4-i*.48,.073,13.25+i*.46],[-Math.PI/2,0,0],`blood-trail-${i}`);drop.scale.x=1.7;drop.castShadow=false;}
  interaction(root,interactables,{id:'cupside_blood_trail',label:'Inspect the blood trail',x:-12.7,z:14.5,actions:[
    {id:'follow_blood',icon:'⌁',label:'Read the wounded person’s trail',check:check('survival','wis',11),once:true,successText:'A wounded courier crawled toward the tavern, then vanished through a concealed cellar hatch beside the rain barrels.',failureText:'Foot traffic breaks the trail before it reaches the tavern.',effects:effects({flags:{cupside_cellar_route_known:true},facts:{cupside_wounded_courier:'A wounded courier escaped the checkpoint through the Tarnished Cup cellar.'},questEvents:['scene:cupside_evidence_found']})},
    {id:'inspect_spatter',icon:'🔍',label:'Reconstruct the attack',check:check('medicine','wis',12),once:true,successText:'The victim was struck from behind while kneeling. This was an arrest only in name.',failureText:'Rain has diluted the pattern beyond certainty.',effects:effects({facts:{cupside_execution_attempt:'The checkpoint guards attempted to execute a kneeling courier.'},reputation:[{faction:'church',delta:-1}],questEvents:['scene:cupside_evidence_found']})},
  ],onInteract:engine=>engine.toast('Rain has not fully washed the dark droplets from the gutter.')});

  const checkpointActions=[
    {id:'present_authority',icon:'⚖',label:'Invoke Captain Rhael’s authority',check:check('persuasion','cha',12),once:true,successText:'The sergeant recognizes Rhael’s seal and orders the barrier opened, furious but unwilling to challenge the Watch in public.',failureText:'The sergeant calls the seal borrowed and reaches for his whistle.',effects:effects({flags:{cupside_checkpoint_cleared:true},facts:{cupside_church_checkpoint:'Church auxiliaries were holding an illegal checkpoint outside the Tarnished Cup.'},reputation:[{faction:'city_watch',delta:1},{faction:'church',delta:-1}],resources:{hp:0,holy:0,hell:0,xp:40},questEvents:['scene:cupside_checkpoint_resolved']}),failureEffects:effects({flags:{cupside_checkpoint_hostile:true},reputation:[{faction:'church',delta:-1}] }),onResolved:checkpointFailure},
    {id:'cite_orders',icon:'📜',label:'Confront them with the burned orders',check:check('intimidation','cha',11),once:true,successText:'The counterseal drains the color from the sergeant’s face. He abandons the checkpoint rather than let the order reach a tribunal.',failureText:'He calls the document a forgery and orders the crossbowman to aim.',effects:effects({flags:{cupside_checkpoint_cleared:true,cupside_order_exposed:true},reputation:[{faction:'city_watch',delta:2}],resources:{hp:0,holy:0,hell:0,xp:45},questEvents:['scene:cupside_evidence_found','scene:cupside_checkpoint_resolved']}),failureEffects:effects({flags:{cupside_checkpoint_hostile:true}}),requiresFlag:'cupside_orders_found',onResolved:checkpointFailure},
    {id:'bluff_delivery',icon:'🎭',label:'Pose as a Church courier',check:check('deception','cha',14),once:true,successText:'You recite enough correct titles that the guards wave the party through before either admits uncertainty.',failureText:'You use yesterday’s watchword. Both guards draw at once.',effects:effects({flags:{cupside_checkpoint_cleared:true,cupside_checkpoint_bluffed:true},resources:{hp:0,holy:0,hell:1,xp:30},questEvents:['scene:cupside_checkpoint_resolved']}),failureEffects:effects({flags:{cupside_checkpoint_hostile:true},reputation:[{faction:'church',delta:-1}]}),onResolved:checkpointFailure},
    {id:'slip_alley',icon:'◐',label:'Lead the party through the laundry alley',check:check('stealth','dex',13),once:true,successText:'Laundry, roof shadow, and the washerman’s cart hide the party until the tavern door is within reach.',failureText:'A hanging buckle strikes stone. The crossbowman turns toward the sound.',effects:effects({flags:{cupside_checkpoint_cleared:true,cupside_checkpoint_bypassed:true},resources:{hp:0,holy:0,hell:0,xp:35},questEvents:['scene:cupside_checkpoint_resolved']}),failureEffects:effects({flags:{cupside_checkpoint_hostile:true}}),onResolved:checkpointFailure},
    {id:'draw_weapons',icon:'⚔',label:'Draw weapons and break the checkpoint',direct:true,onSelect:startCheckpointCombat},
  ];
  interaction(root,interactables,{id:'cupside_checkpoint',label:'Church checkpoint — Cupside Lane',x:-8.8,z:10.8,range:2.1,actions:checkpointActions,onInteract:engine=>engine.toast('The checkpoint bars the shortest route to the Tarnished Cup.')});

  return{
    update(time){const cleared=!!window.sceneState?.flags?.cupside_checkpoint_cleared||!!window.sceneState?.flags?.cupside_checkpoint_defeated;checkpoint.position.y=THREE.MathUtils.lerp(checkpoint.position.y,cleared?-1.7:checkpoint.userData.closedY,.08);for(const item of animated){if(item.kind==='puddle')item.object.material.opacity=.62+Math.sin(time*.7+item.phase)*.04;else if(item.kind==='sign')item.object.rotation.z=item.base+Math.sin(time*.9+item.phase)*.025;else item.object.rotation.z=item.base+Math.sin(time*1.15+item.phase)*.018;}},
  };
}
