export const CINEMATIC_KINDS=Object.freeze(['environment','combat_intro','attack','spell','finisher','victory']);

const SHOTS=Object.freeze({environment:'environment',combat_intro:'combat_wide',attack:'attack',spell:'spell',finisher:'finisher',victory:'victory'});
const DURATIONS=Object.freeze({environment:.9,combat_intro:1.25,attack:.78,spell:1.05,finisher:1.15,victory:1.45});

export function normalizeCinematicKind(kind){return CINEMATIC_KINDS.includes(kind)?kind:'environment';}
export function cinematicShotFor(kind){return SHOTS[normalizeCinematicKind(kind)];}
export function cinematicDurationFor(kind,reducedMotion=false){const duration=DURATIONS[normalizeCinematicKind(kind)];return reducedMotion?Math.min(.28,duration):duration;}
