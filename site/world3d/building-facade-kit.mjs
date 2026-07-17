import * as THREE from 'three';

const DISTRICT_STYLES=Object.freeze({
  southward:{plaster:0xb09a75,roof:0x6a3d2f,trim:0x4b301d,accent:0x55705c,stone:0x726657},
  tarnished_cup:{plaster:0x927252,roof:0x52302a,trim:0x3a2418,accent:0x7d3e34,stone:0x65584a},
  market:{plaster:0xb38d5e,roof:0x70412d,trim:0x53341e,accent:0x42685c,stone:0x796b56},
  archive_lane:{plaster:0x8c806b,roof:0x3f4547,trim:0x322a23,accent:0x725b78,stone:0x66645e},
  signing_hall:{plaster:0x806a5a,roof:0x4b2b28,trim:0x30231d,accent:0x74352f,stone:0x5b514b},
  temple_quarter:{plaster:0xb7ad8e,roof:0x4a5359,trim:0x55452f,accent:0xa17e3d,stone:0x898578},
  crown_ward:{plaster:0xa69a81,roof:0x38464f,trim:0x493827,accent:0x7a3030,stone:0x817c70},
});

const FALLBACK_STYLE=DISTRICT_STYLES.southward;
const styleFor=plot=>DISTRICT_STYLES[plot.district]||FALLBACK_STYLE;
const seeded=value=>{let state=value>>>0;return()=>((state=Math.imul(state^state>>>15,2246822519))>>>0)/4294967296;};
const seedFor=text=>[...String(text)].reduce((seed,char)=>Math.imul(seed^char.charCodeAt(0),16777619)>>>0,2166136261);
const local=(plot,x,y,z)=>{const c=Math.cos(plot.rotation||0),s=Math.sin(plot.rotation||0);return{x:plot.x+x*c+z*s,y,z:plot.z-x*s+z*c,rotation:plot.rotation||0};};
const transform=(plot,x,y,z,scale=[1,1,1],rotation=0)=>({...local(plot,x,y,z),scale,rotation:(plot.rotation||0)+rotation});

function material(materials,kind,color,options={}){return materials?.material(kind,color,options)||new THREE.MeshStandardMaterial({color,roughness:.9,...options});}

function weatherAsset(object,plot,index=0){
  const style=styleFor(plot),variation=.88+(index%5)*.035;
  object.traverse(child=>{
    if(!child.isMesh||!child.material)return;
    const sources=Array.isArray(child.material)?child.material:[child.material];
    const adjusted=sources.map(source=>{
      const result=source.clone(),name=String(source.name||'').toLowerCase();
      const tint=/roof|tile/.test(name)?style.roof:/plaster|stucco/.test(name)?style.plaster:/timber|wood|beam|door|shutter/.test(name)?style.trim:/stone|foundation|column/.test(name)?style.stone:null;
      if(tint)result.color.lerp(new THREE.Color(tint),.34).multiplyScalar(variation);
      result.roughness=Math.min(1,(result.roughness??.85)+.04+(index%3)*.018);result.needsUpdate=true;return result;
    });
    child.material=Array.isArray(child.material)?adjusted:adjusted[0];
  });
  object.userData.districtStyle=plot.district;object.userData.facadeVariant=index%7;
}

export function createBuildingFacadeKit({root,buildingPlots=[],materials}){
  const instances=[],animated=[],dummy=new THREE.Object3D(),collections=new Map();
  const geometry={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(.5,.5,1,10),pot:new THREE.CylinderGeometry(.58,.45,1,8),roof:new THREE.ConeGeometry(.7,1,4)};
  const materialCache=new Map();
  const getMaterial=(district,kind,color,options={})=>{const key=`${district}:${kind}:${color}:${JSON.stringify(options)}`;if(!materialCache.has(key))materialCache.set(key,material(materials,kind,color,options));return materialCache.get(key);};
  const collect=(key,shape,mat,item)=>{if(!collections.has(key))collections.set(key,{shape,mat,items:[]});collections.get(key).items.push(item);};
  const add=(plot,key,shape,kind,color,x,y,z,scale,rotation=0,options={})=>collect(`${plot.district}:${key}`,shape,getMaterial(plot.district,kind,color,options),transform(plot,x,y,z,scale,rotation));

  for(const [index,plot]of buildingPlots.entries()){
    const random=seeded(seedFor(plot.id)),style=styleFor(plot),front=plot.depth*.5+.11,wide=plot.width>7,storeys=Math.max(1,Math.round(plot.height/2.8)),commercial=/workshop|warehouse|guild|granary/.test(plot.asset)||plot.district==='market';
    // Splash-darkened masonry, individual thresholds and timber sill courses
    // visually anchor every building to the street instead of letting it float.
    add(plot,'plinth','box','stone',style.stone,0,.22,front,[plot.width*.88,.44,.18]);
    add(plot,'threshold','box','stone',style.stone,0,.12,front+.43,[1.55,.24,.78]);
    add(plot,'door','box','timber',style.trim,0,1.18,front+.14,[1.08,2.25,.16]);
    add(plot,'lintel','box','stone',style.stone,0,2.4,front+.15,[1.42,.22,.26]);
    for(const side of[-1,1])add(plot,'door-jamb','box','stone',style.stone,side*.63,1.22,front+.15,[.18,2.48,.24]);

    // Upper façades get non-repeating window rhythms, shutters, flower boxes,
    // diagonal braces and projecting corbels based on plot identity.
    const windows=wide?(index%3===0?3:2):1;
    for(let floor=0;floor<Math.min(storeys,3);floor++)for(let windowIndex=0;windowIndex<windows;windowIndex++){
      if(floor===0&&windowIndex===Math.floor(windows/2))continue;
      const x=windows===1?0:(windowIndex-(windows-1)/2)*(plot.width/(windows+.35)),y=1.55+floor*2.25,glassColor=plot.district==='archive_lane'?0x88a5a7:0xe2a75d;
      add(plot,'window','box','metal',glassColor,x,y,front+.13,[.72,.92,.08],0,{metalness:.08,roughness:.28});
      for(const side of[-1,1])add(plot,'shutter','box','timber',style.trim,x+side*.48,y,front+.18,[.24,1.02,.09],side*.08);
      add(plot,'window-box','box','timber',style.trim,x,y-.58,front+.32,[.95,.16,.35]);
      if((index+floor+windowIndex)%2===0)add(plot,'window-greenery','box','vegetation',0x35573b,x,y-.48,front+.34,[.76,.18,.28]);
    }
    for(const side of[-1,1]){
      add(plot,'corner-post','box','timber',style.trim,side*plot.width*.44,plot.height*.37,front+.1,[.16,plot.height*.62,.16]);
      if(index%2===0)add(plot,'brace','box','timber',style.trim,side*plot.width*.31,2.75,front+.17,[.14,1.9,.14],side*.62);
      if(storeys>1)add(plot,'corbel','box','timber',style.trim,side*plot.width*.3,3.02,front+.4,[.18,.24,.72],side*.12);
    }

    // Roof additions deliberately change silhouettes. A second dormer is used
    // only on broad noble/warehouse fronts, avoiding cloned-looking skylines.
    const dormerCount=wide&&index%4===0?2:index%3===0?1:0;
    for(let dormer=0;dormer<dormerCount;dormer++){
      const x=dormerCount===1?plot.width*(random()-.5)*.24:(dormer?1:-1)*plot.width*.22,y=plot.height*.78,z=front*.38;
      add(plot,'dormer-body','box','plaster',style.plaster,x,y,z,[1.05,1.15,.9]);
      add(plot,'dormer-roof','roof','roof',style.roof,x,y+.78,z,[1.25,.85,1.25],Math.PI/4);
      add(plot,'dormer-window','box','metal',0xd69b55,x,y+.08,z+.48,[.46,.55,.06],0,{metalness:.05,roughness:.3});
    }
    const chimneyX=(index%2?-.31:.31)*plot.width;
    add(plot,'chimney','box','stone',style.stone,chimneyX,plot.height*.83,0,[.62,2.1,.62]);
    add(plot,'chimney-pot','pot','stone',style.stone,chimneyX,plot.height*.83+1.2,0,[.7,.48,.7]);

    // Commercial and civic buildings receive a distinct working frontage;
    // residential variants get ivy or a small rear lean-to instead.
    if(commercial){
      const awningColor=index%2?style.accent:0x765438;
      add(plot,'awning','box','timber',awningColor,0,2.5,front+.82,[Math.min(3.8,plot.width*.58),.12,1.45],0,{roughness:.82});
      for(const side of[-1,1])add(plot,'awning-post','cylinder','timber',style.trim,side*Math.min(1.65,plot.width*.24),1.25,front+1.35,[.13,2.5,.13]);
      const signX=(index%2?-.36:.36)*plot.width;
      add(plot,'sign-bracket','box','metal',0x343630,signX,3.25,front+.48,[.08,.08,.9],0,{metalness:.7,roughness:.35});
      add(plot,'hanging-sign','box','timber',style.accent,signX,2.75,front+.88,[.9,.72,.1]);
    }else if(index%2===0){
      for(let segment=0;segment<4;segment++)add(plot,'ivy','cylinder','vegetation',0x294b31,-plot.width*.38,1+segment*.72,front+.23,[.07,.9,.07],-.12+random()*.24);
    }else{
      add(plot,'lean-to','box','timber',style.trim,plot.width*.35,1.05,-plot.depth*.5-.55,[Math.min(2.6,plot.width*.36),2.1,1.25]);
      add(plot,'lean-to-roof','box','roof',style.roof,plot.width*.35,2.2,-plot.depth*.5-.55,[Math.min(2.9,plot.width*.4),.14,1.55],-.08);
    }
  }

  for(const [name,{shape,mat,items}]of collections){const mesh=new THREE.InstancedMesh(geometry[shape],mat,items.length);mesh.name=`authored-facades:${name}`;mesh.castShadow=mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);items.forEach((item,index)=>{dummy.position.set(item.x,item.y,item.z);dummy.rotation.set(0,item.rotation,0);dummy.scale.set(...item.scale);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);instances.push(mesh);}

  return{
    instanceCount:instances.reduce((sum,mesh)=>sum+mesh.count,0),districtCount:new Set(buildingPlots.map(plot=>plot.district)).size,weatherAsset,
    update(time){for(const item of animated)item.object.rotation.z=item.base+Math.sin(time*.8+item.phase)*.025;},
    dispose(){for(const mesh of instances)mesh.geometry.dispose();for(const value of materialCache.values())value.dispose();}
  };
}

export const VAELTHAR_FACADE_VOCABULARY=Object.freeze(['plinth','threshold','door','lintel','jamb','shutter','window box','corner post','diagonal brace','corbel','dormer','chimney','awning','hanging sign','ivy','lean-to']);
