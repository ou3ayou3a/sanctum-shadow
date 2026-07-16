import * as THREE from 'three';

const DAY=new THREE.Color(0xb7cbc2),DAWN=new THREE.Color(0xb7795d),NIGHT=new THREE.Color(0x101927);
const clamp01=value=>THREE.MathUtils.clamp(value,0,1);

export class CityAtmosphere{
  constructor(engine){this.engine=engine;this.torches=[];this.lastHour=-1;this.wetness=0;}
  initialize(){
    const {scene}=this.engine;scene.traverse(object=>{if(object.isPointLight&&object.position.y<4){object.userData.dayIntensity=object.intensity;this.torches.push(object);}});
    const geometry=new THREE.BufferGeometry(),count=720,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*70;positions[i*3+1]=Math.random()*24;positions[i*3+2]=(Math.random()-.5)*70;}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=new THREE.PointsMaterial({color:0xaac3c9,size:.055,transparent:true,opacity:.55,depthWrite:false});this.rain=new THREE.Points(geometry,material);this.rain.name='weather:rain';this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);return this;
  }
  weatherFor(day,hour){const value=(day*37+Math.floor(hour/4)*17+11)%13;return value<4?'rain':value===4?'mist':'clear';}
  update(dt,time){
    const clock=window.worldClock||{hour:10,day:1},hour=Number(clock.hour)||0,day=Number(clock.day)||1,weather=this.weatherFor(day,hour),isRain=weather==='rain';
    const daylight=clamp01(Math.sin((hour-5.5)/14*Math.PI)),dawn=Math.max(0,1-Math.abs(hour-6.5)/2.2),dusk=Math.max(0,1-Math.abs(hour-19)/2.3),warm=Math.max(dawn,dusk),sky=NIGHT.clone().lerp(DAY,daylight).lerp(DAWN,warm*.42);
    this.engine.scene.background?.lerp(sky,1-Math.exp(-dt*.55));this.engine.scene.fog?.color.lerp(sky.clone().multiplyScalar(.72),1-Math.exp(-dt*.55));
    if(this.engine.hemisphereLight){this.engine.hemisphereLight.intensity=.58+daylight*2.55;this.engine.hemisphereLight.color.copy(NIGHT).lerp(new THREE.Color(0xe7ead7),daylight);}
    if(this.engine.sunLight){this.engine.sunLight.intensity=.4+daylight*3.5;const angle=(hour-6)/24*Math.PI*2;this.engine.sunLight.position.set(Math.cos(angle)*28,5+daylight*24,Math.sin(angle)*20);this.engine.sunLight.color.set(warm>.2?0xffc98b:0xfff1d8);}
    this.engine.renderer.toneMappingExposure=.9+daylight*.5;
    const night=1-daylight;for(const light of this.torches)light.intensity=(light.userData.dayIntensity||5)*(.38+night*.96);
    const targetWet=isRain?1:weather==='mist'?.38:.05;this.wetness=THREE.MathUtils.lerp(this.wetness,targetWet,1-Math.exp(-dt*(isRain?.8:.18)));this.engine.zone?.setWetness?.(this.wetness);
    this.rain.visible=isRain;this.rain.position.set(this.engine.actor.position.x,0,this.engine.actor.position.z);if(isRain){const array=this.rain.geometry.attributes.position.array;for(let i=0;i<array.length;i+=3){array[i+1]-=dt*(13+(i%17)*.32);array[i]+=.6*dt;if(array[i+1]<.1){array[i+1]=22;array[i]=(Math.random()-.5)*70;array[i+2]=(Math.random()-.5)*70;}}this.rain.geometry.attributes.position.needsUpdate=true;}
    if(this.lastHour!==hour){this.lastHour=hour;window.AudioEngine?.updateCityAmbience?.({hour,weather,zoneId:this.engine.zone.id});}
  }
  dispose(){this.engine.scene.remove(this.rain);this.rain.geometry.dispose();this.rain.material.dispose();window.AudioEngine?.stopCityAmbience?.();}
}
