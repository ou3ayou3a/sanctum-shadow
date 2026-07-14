import * as THREE from 'three';

const PALETTES={
  stone:['#332d27','#51473b','#6a5d4b','#81715b'],plaster:['#8c765b','#a48b6b','#725f49','#b19a79'],
  roof:['#3b211d','#58302a','#6c3b31','#2c2524'],timber:['#291a12','#452a19','#624027','#795239'],
  metal:['#222522','#3b3e39','#55564e','#171918'],vegetation:['#233b29','#315638','#426b43','#182d20'],
  cobble:['#4a443a','#61584a','#776b58','#38352f'],mud:['#493725','#5d472f','#70563a','#382b20']
};

function randomFor(seed){let value=seed>>>0;return()=>((value=Math.imul(value^value>>>15,2246822519)^Math.imul(value^value>>>13,3266489917))>>>0)/4294967296;}
function textureFrom(draw,{size=256,repeat=[3,3],color=false}={}){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(...repeat);texture.anisotropy=4;if(color)texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function rounded(context,x,y,w,h,r=5){context.beginPath();context.roundRect(x,y,w,h,r);context.fill();}

function surfacePainter(kind,mode,seed){
  const random=randomFor(seed),palette=PALETTES[kind]||PALETTES.stone;
  return(context,size)=>{
    const grayscale=mode!=='color';
    context.fillStyle=grayscale?(mode==='roughness'?'#d3d3d3':'#777'):palette[0];context.fillRect(0,0,size,size);
    if(kind==='stone'||kind==='cobble'){
      const rows=kind==='cobble'?12:9,rowHeight=size/rows;
      for(let row=0;row<rows;row++){const cols=kind==='cobble'?9:6,width=size/cols,offset=(row%2)*width*.5;for(let col=-1;col<=cols;col++){const x=col*width+offset+2,y=row*rowHeight+2,jitter=(random()-.5)*5;
        if(mode==='color')context.fillStyle=palette[Math.floor(random()*palette.length)];else{const shade=Math.floor((mode==='roughness'?185:95)+random()*45);context.fillStyle=`rgb(${shade},${shade},${shade})`;}
        rounded(context,x+jitter,y,width-5,rowHeight-5,kind==='cobble'?7:2);
        context.strokeStyle=mode==='color'?'rgba(26,22,18,.55)':'rgba(35,35,35,.8)';context.lineWidth=2;context.stroke();}}
    }else if(kind==='roof'){
      const rows=14,h=size/rows,w=size/10;for(let row=0;row<rows;row++)for(let col=-1;col<11;col++){const x=col*w+(row%2)*w*.5,y=row*h;
        context.fillStyle=mode==='color'?palette[Math.floor(random()*palette.length)]:mode==='roughness'?'#c8c8c8':'#929292';rounded(context,x+1,y+1,w-3,h+4,4);context.strokeStyle=mode==='color'?'rgba(20,10,8,.5)':'#555';context.stroke();}
    }else if(kind==='timber'){
      context.fillStyle=mode==='color'?palette[1]:mode==='roughness'?'#d0d0d0':'#777';context.fillRect(0,0,size,size);for(let i=0;i<46;i++){const y=random()*size,amplitude=2+random()*5;context.strokeStyle=mode==='color'?palette[Math.floor(random()*palette.length)]:`rgb(${70+Math.floor(random()*55)},${70+Math.floor(random()*55)},${70+Math.floor(random()*55)})`;context.lineWidth=.7+random()*2;context.beginPath();context.moveTo(0,y);for(let x=0;x<=size;x+=16)context.lineTo(x,y+Math.sin(x*.045+i)*amplitude);context.stroke();}
    }else if(kind==='plaster'){
      context.fillStyle=mode==='color'?palette[0]:mode==='roughness'?'#dedede':'#888';context.fillRect(0,0,size,size);for(let i=0;i<420;i++){const shade=mode==='color'?palette[Math.floor(random()*palette.length)]:`rgb(${100+Math.floor(random()*95)},${100+Math.floor(random()*95)},${100+Math.floor(random()*95)})`;context.globalAlpha=.025+random()*.08;context.fillStyle=shade;context.beginPath();context.ellipse(random()*size,random()*size,2+random()*13,1+random()*5,random()*Math.PI,0,Math.PI*2);context.fill();}context.globalAlpha=1;for(let i=0;i<7;i++){context.strokeStyle=mode==='color'?'rgba(48,36,27,.28)':'#666';context.lineWidth=.7;context.beginPath();let x=random()*size,y=random()*size;context.moveTo(x,y);for(let n=0;n<5;n++){x+=(random()-.5)*18;y+=5+random()*12;context.lineTo(x,y);}context.stroke();}
    }else{
      for(let i=0;i<520;i++){context.globalAlpha=.05+random()*.18;context.fillStyle=mode==='color'?palette[Math.floor(random()*palette.length)]:`rgb(${90+Math.floor(random()*125)},${90+Math.floor(random()*125)},${90+Math.floor(random()*125)})`;context.beginPath();context.arc(random()*size,random()*size,.5+random()*4,0,Math.PI*2);context.fill();}context.globalAlpha=1;
    }
  };
}

function mapsFor(kind,index){const repeat=kind==='roof'?[3,4]:kind==='timber'?[2,6]:kind==='plaster'?[2.5,2.5]:[3.5,3.5];return{
  map:textureFrom(surfacePainter(kind,'color',0x1200+index),{repeat,color:true}),
  roughnessMap:textureFrom(surfacePainter(kind,'roughness',0x2200+index),{repeat}),
  bumpMap:textureFrom(surfacePainter(kind,'bump',0x3200+index),{repeat})
};}

function inferKind(material){const name=String(material?.name||'').toLowerCase();if(/roof|tile/.test(name))return'roof';if(/timber|wood|door|shutter|beam|post|bark/.test(name))return'timber';if(/plaster|stucco/.test(name))return'plaster';if(/metal|gold|iron|portcullis|brace/.test(name))return'metal';if(/leaf|grass|vegetation/.test(name))return'vegetation';return /stone|foundation|wall|tower|keep|column|chapel/.test(name)?'stone':null;}

export function createMedievalMaterialLibrary(){
  const maps=new Map(),upgraded=new WeakMap(),kinds=['stone','plaster','roof','timber','metal','vegetation','cobble','mud'];kinds.forEach((kind,index)=>maps.set(kind,mapsFor(kind,index)));
  const upgradeMaterial=source=>{const kind=inferKind(source);if(!kind||source.transparent)return source;if(upgraded.has(source))return upgraded.get(source);const material=source.clone(),set=maps.get(kind);material.map=set.map;material.roughnessMap=set.roughnessMap;material.bumpMap=set.bumpMap;material.bumpScale=kind==='stone'?.075:kind==='roof'?.055:kind==='timber'?.035:.025;material.roughness=kind==='metal'?.52:.9;material.metalness=kind==='metal'?.62:.02;material.needsUpdate=true;upgraded.set(source,material);return material;};
  return{
    maps,
    apply(object){object.traverse(child=>{if(!child.isMesh||!child.material)return;child.material=Array.isArray(child.material)?child.material.map(upgradeMaterial):upgradeMaterial(child.material);});return object;},
    material(kind,color=0xffffff,options={}){const set=maps.get(kind)||maps.get('stone');return new THREE.MeshStandardMaterial({color,map:set.map,roughnessMap:set.roughnessMap,bumpMap:set.bumpMap,bumpScale:options.bumpScale??.045,roughness:options.roughness??.9,metalness:options.metalness??(kind==='metal'?.55:.02),transparent:!!options.transparent,opacity:options.opacity??1});}
  };
}
