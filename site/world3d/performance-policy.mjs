const MICRO_DETAIL=/grass|undergrowth|debris|basket|bottle|mug|coin|paper|laundry|rope|plank|candle|small-prop|ground-cover/;
const AMBIENT_DETAIL=/smoke|fog|mist|flame|foliage|leaf|bush|banner|flag|cloth|market-prop|street-prop/;
const STREET_PROP=/barrel|crate|cart|stall|sign|fence|bench|table|cask|well|lamp|hearth|rack|canopy/;
const LANDMARK=/castle|citadel|keep|tower|gate|wall|temple|church|tavern|warehouse|estate|guild|bridge|terrain|navigation-ground/;

export function performanceProfileFor(name,{radius=1,isInstanced=false}={}){
  const value=String(name||'').toLowerCase();
  if(LANDMARK.test(value)||radius>10)return{tier:'landmark',cullDistance:210,shadowDistance:78};
  if(MICRO_DETAIL.test(value)||radius<.22)return{tier:'micro',cullDistance:isInstanced?58:38,shadowDistance:18};
  if(AMBIENT_DETAIL.test(value))return{tier:'ambient',cullDistance:68,shadowDistance:28};
  if(STREET_PROP.test(value)||radius<1.25)return{tier:'prop',cullDistance:88,shadowDistance:38};
  return{tier:'structure',cullDistance:145,shadowDistance:58};
}
