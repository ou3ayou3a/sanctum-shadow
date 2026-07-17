const VAELTHAR_EMITTERS = Object.freeze([
  Object.freeze({ id:'covenant-square-crowd', kind:'crowd', position:[0,1.6,1], refDistance:4, maxDistance:24, volume:.34, interval:7600, activeHours:[6,23] }),
  Object.freeze({ id:'ash-market-traders', kind:'market', position:[17,1.7,14], refDistance:3.5, maxDistance:23, volume:.42, interval:5900, activeHours:[6,20] }),
  Object.freeze({ id:'garrick-smithy', kind:'smithy', position:[27,1.45,-7], refDistance:2.5, maxDistance:19, volume:.5, interval:3200, activeHours:[6,20] }),
  Object.freeze({ id:'tarnished-cup-yard', kind:'tavern', position:[-16,1.8,13], refDistance:3.5, maxDistance:21, volume:.4, interval:6800, activeHours:[11,2] }),
  Object.freeze({ id:'temple-belfry', kind:'bells', position:[18,8,-16], refDistance:7, maxDistance:52, volume:.5, interval:19000, activeHours:[5,23] }),
  Object.freeze({ id:'southward-stables', kind:'animals', position:[8,1.5,31], refDistance:3, maxDistance:20, volume:.46, interval:9300, activeHours:[5,22] }),
  Object.freeze({ id:'north-gate-watch', kind:'guards', position:[0,1.5,-35], refDistance:3, maxDistance:18, volume:.4, interval:7100, activeHours:[0,24] }),
]);

export const CITY_SOUND_KINDS = Object.freeze(['crowd','market','smithy','tavern','bells','animals','guards']);

export function citySoundscapeForZone(zoneId) {
  return zoneId === 'vaelthar_city' ? VAELTHAR_EMITTERS : Object.freeze([]);
}

export function soundEmitterActiveAtHour(emitter, hour) {
  const [start=0,end=24] = emitter?.activeHours || [];
  const value = ((Number(hour) || 0) % 24 + 24) % 24;
  if (start === end || (start === 0 && end === 24)) return true;
  return start < end ? value >= start && value < end : value >= start || value < end;
}
