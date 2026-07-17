import * as THREE from 'three';
import { cityDistrictForPosition, citySoundscapeForZone } from './city-soundscape.mjs?v=169';

const DAY=new THREE.Color(0xb7cbc2),DAWN=new THREE.Color(0xb7795d),NIGHT=new THREE.Color(0x101927);
const KIT_SKIES=Object.freeze({
  tavern:0x2b1b13,cellar:0x171518,forest:0x7f9a88,cartographer:0x84917a,village:0x9eb19c,outpost:0x879b91,road:0x98a798,fortress:0x78817d,monastery:0x92a6a0,archive:0x1a1b1b,ashen:0x526170,tower:0x493d4a,temple:0xa49c83,dungeon:0x151719,
});
const INTERIOR_KITS=new Set(['tavern','cellar','archive','dungeon']);
const clamp01=value=>THREE.MathUtils.clamp(value,0,1);

export class CityAtmosphere{
  constructor(engine){this.engine=engine;this.torches=[];this.lastHour=-1;this.wetness=0;this.listenerElapsed=0;this.districtElapsed=0;this.audioDistrict=null;this.listenerForward=new THREE.Vector3();this.kit=engine.zone?.profile?.kit||'road';this.baseSky=new THREE.Color(KIT_SKIES[this.kit]||DAY);}
  initialize(){
    const {scene}=this.engine;scene.traverse(object=>{if(object.isPointLight&&object.position.y<4){object.userData.dayIntensity=object.intensity;this.torches.push(object);}});
    const geometry=new THREE.BufferGeometry(),count=720,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*70;positions[i*3+1]=Math.random()*24;positions[i*3+2]=(Math.random()-.5)*70;}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:0xaac3c9,size:.055,transparent:true,opacity:.55,depthWrite:false});this.rain=new THREE.Points(geometry,material);this.rain.name='weather:rain';this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    this.soundEmitters=citySoundscapeForZone(this.engine.zone.id);this.engine.canvas.dataset.citySoundEmitters=String(this.soundEmitters.length);if(this.engine.zone.id==='vaelthar_city'){this.audioDistrict=cityDistrictForPosition(this.engine.actor?.position);this.engine.canvas.dataset.cityAudioDistrict=this.audioDistrict;}window.AudioEngine?.startCityAmbience?.({zoneId:this.engine.zone.id,emitters:this.soundEmitters,districtId:this.audioDistrict});return this;
  }
  weatherFor(day,hour){
    if(INTERIOR_KITS.has(this.kit))return'clear';
    if(this.kit==='ashen'||this.kit==='tower')return'mist';
    const value=(day*37+Math.floor(hour/4)*17+11+this.kit.length*3)%13;
    if(this.kit==='forest'||this.kit==='monastery')return value<5?'mist':value<8?'rain':'clear';
    return value<4?'rain':value===4?'mist':'clear';
  }
  update(dt,time){
    const clock=window.worldClock||{hour:10,day:1},hour=Number(clock.hour)||0,day=Number(clock.day)||1,weather=this.weatherFor(day,hour),isRain=weather==='rain';
    const daylight=clamp01(Math.sin((hour-5.5)/14*Math.PI)),dawn=Math.max(0,1-Math.abs(hour-6.5)/2.2),dusk=Math.max(0,1-Math.abs(hour-19)/2.3),warm=Math.max(dawn,dusk),sky=NIGHT.clone().lerp(this.baseSky,daylight).lerp(DAWN,warm*.42);
    this.engine.scene.background?.lerp(sky,1-Math.exp(-dt*.55));this.engine.scene.fog?.color.lerp(sky.clone().multiplyScalar(.72),1-Math.exp(-dt*.55));
    if(this.engine.hemisphereLight){this.engine.hemisphereLight.intensity=.58+daylight*2.55;this.engine.hemisphereLight.color.copy(NIGHT).lerp(new THREE.Color(0xe7ead7),daylight);}
    if(this.engine.sunLight){this.engine.sunLight.intensity=.4+daylight*3.5;const angle=(hour-6)/24*Math.PI*2;this.engine.sunLight.position.set(Math.cos(angle)*28,5+daylight*24,Math.sin(angle)*20);this.engine.sunLight.color.set(warm>.2?0xffc98b:0xfff1d8);}
    this.engine.renderer.toneMappingExposure=INTERIOR_KITS.has(this.kit)?1.08:.9+daylight*.5;
    const night=1-daylight;for(const light of this.torches)light.intensity=(light.userData.dayIntensity||5)*(.38+night*.96);
    const targetWet=isRain?1:weather==='mist'?.38:.05;this.wetness=THREE.MathUtils.lerp(this.wetness,targetWet,1-Math.exp(-dt*(isRain?.8:.18)));this.engine.zone?.setWetness?.(this.wetness);
    this.rain.visible=isRain;this.rain.position.set(this.engine.actor.position.x,0,this.engine.actor.position.z);if(isRain){const array=this.rain.geometry.attributes.position.array;for(let i=0;i<array.length;i+=3){array[i+1]-=dt*(13+(i%17)*.32);array[i]+=.6*dt;if(array[i+1]<.1){array[i+1]=22;array[i]=(Math.random()-.5)*70;array[i+2]=(Math.random()-.5)*70;}}this.rain.geometry.attributes.position.needsUpdate=true;}
    this.listenerElapsed+=dt;if(this.listenerElapsed>=.08){this.listenerElapsed=0;this.engine.camera.getWorldDirection(this.listenerForward);window.AudioEngine?.updateCityListener?.({position:this.engine.camera.position.toArray(),forward:this.listenerForward.toArray(),up:this.engine.camera.up.toArray()});this.engine.canvas.dataset.citySoundListener='tracking';}
    this.districtElapsed+=dt;if(this.engine.zone.id==='vaelthar_city'&&this.districtElapsed>=.25){this.districtElapsed=0;const nextDistrict=cityDistrictForPosition(this.engine.actor?.position,this.audioDistrict);if(nextDistrict!==this.audioDistrict){this.audioDistrict=nextDistrict;this.engine.canvas.dataset.cityAudioDistrict=nextDistrict;window.AudioEngine?.updateCityDistrict?.(nextDistrict);}}
    if(this.lastHour!==hour){this.lastHour=hour;window.AudioEngine?.updateCityAmbience?.({hour,weather,zoneId:this.engine.zone.id,districtId:this.audioDistrict});}
  }
  dispose(){delete this.engine.canvas.dataset.citySoundEmitters;delete this.engine.canvas.dataset.citySoundListener;delete this.engine.canvas.dataset.cityAudioDistrict;this.engine.scene.remove(this.rain);this.rain.geometry.dispose();this.rain.material.dispose();window.AudioEngine?.stopCityAmbience?.({fadeMs:1200});}
}
