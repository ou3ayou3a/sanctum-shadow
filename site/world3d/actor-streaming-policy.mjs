export const NPC_ACTOR_BUDGETS=Object.freeze({low:4,medium:8,high:12});
export const NPC_STREAM_RADII=Object.freeze({low:16,medium:22,high:28});

export function normalizedWorldQuality(value){return Object.hasOwn(NPC_ACTOR_BUDGETS,value)?value:'medium';}
export function npcActorBudget(value){return NPC_ACTOR_BUDGETS[normalizedWorldQuality(value)];}
export function npcStreamRadius(value){return NPC_STREAM_RADII[normalizedWorldQuality(value)];}

export function selectNpcActorIds(records,playerPosition,quality='medium'){
  const limit=npcActorBudget(quality),radius=npcStreamRadius(quality),px=Number(playerPosition?.x)||0,pz=Number(playerPosition?.z)||0;
  const ranked=(records||[])
    .filter(record=>record?.active!==false)
    .map(record=>({record,distance:Math.hypot((Number(record.position?.x)||0)-px,(Number(record.position?.z)||0)-pz)}))
    .sort((a,b)=>(Number(b.record.priority)-Number(a.record.priority))||a.distance-b.distance||String(a.record.config?.id||'').localeCompare(String(b.record.config?.id||'')));
  const selected=ranked.filter(item=>item.distance<=radius||item.record.priority).slice(0,limit),minimum=Math.min(4,limit,ranked.length);for(const item of ranked)if(selected.length<minimum&&!selected.includes(item))selected.push(item);
  return new Set(selected.slice(0,limit).map(item=>item.record.config.id));
}
