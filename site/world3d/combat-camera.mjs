import * as THREE from 'three';

// Include feet and headroom, then fit a sphere inside the HUD-safe viewport.
export function combatCameraFrame(records,camera){
  const bounds=new THREE.Box3();
  for(const record of records){
    if(!record.actor?.visible||record.combatant?.hp<=0)continue;
    const position=record.actor.getWorldPosition(new THREE.Vector3());
    bounds.expandByPoint(position);bounds.expandByPoint(position.clone().add(new THREE.Vector3(0,2.6,0)));
  }
  if(bounds.isEmpty())return null;
  const center=bounds.getCenter(new THREE.Vector3()),radius=bounds.getSize(new THREE.Vector3()).length()/2+.7;
  const vertical=THREE.MathUtils.degToRad(camera.fov)/2;
  const angle=Math.atan(Math.tan(vertical)*Math.min(1,camera.aspect)*.62);
  return{center,distance:Math.max(7,radius/Math.sin(angle))};
}

export class CombatCamera{
  constructor(engine){this.engine=engine;this.saved=null;}
  update(){
    const {combatController:combat,camera,controls,cameraPanOffset}=this.engine;
    const frame=combat?.active?combatCameraFrame(combat.records?.values()||[],camera):null;
    if(!frame){
      if(this.saved){
        const direction=camera.position.clone().sub(controls.target).normalize();
        controls.maxDistance=this.saved.maxDistance;
        camera.position.copy(controls.target).addScaledVector(direction,this.saved.distance);
        cameraPanOffset.copy(this.saved.pan);this.saved=null;
      }
      return null;
    }
    if(!this.saved){
      this.saved={maxDistance:controls.maxDistance,distance:camera.position.distanceTo(controls.target),pan:cameraPanOffset.clone()};
      cameraPanOffset.set(0,0,0);this.aspect=null;
    }
    // Fit once after the intro, and on viewport shape changes. Afterwards the
    // player's zoom and WASD pan remain under their control.
    if(this.aspect!==camera.aspect){
      const direction=camera.position.clone().sub(controls.target).normalize();
      controls.maxDistance=Math.max(this.saved.maxDistance,frame.distance*1.25);
      camera.position.copy(controls.target).addScaledVector(direction,frame.distance);
      this.aspect=camera.aspect;
    }
    return frame.center;
  }
}
