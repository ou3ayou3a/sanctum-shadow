// Sanctum & Shadow — deterministic merchant-specific reputation pricing.
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.MerchantPricing=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const roundPercent=value=>Math.round(value*100);

  function factionAdjustment(score){
    const value=clamp(score,-100,100);
    if(value>=10)return -(0.05+((value-10)/90)*0.10); // friendly: -5%, revered: -15%
    if(value<=-10)return 0.10+((Math.abs(value)-10)/90)*0.25; // suspicious: +10%, hated: +35%
    return 0;
  }

  function alignmentAdjustment(merchantAlignment,holyPoints,hellPoints){
    const alignment=String(merchantAlignment||'neutral').toLowerCase();
    if(!['holy','dark'].includes(alignment))return 0;
    const net=clamp((Number(holyPoints)||0)-(Number(hellPoints)||0),-100,100);
    const strength=Math.abs(net);
    if(strength<10)return 0;
    const playerAlignment=net>0?'holy':'dark';
    if(playerAlignment===alignment){
      if(strength>=100)return -0.25;
      return -(0.10+((strength-10)/90)*0.15); // matching: -10%, maximum: -25%
    }
    if(strength>=100)return 0.30;
    return 0.10+((strength-10)/90)*0.20; // opposed: +10%, maximum: +30%
  }

  function quote(basePrice,merchant,state={}){
    const base=Math.max(1,Math.round(Number(basePrice)||1));
    const faction=merchant?.faction||'citizens';
    const factionScore=clamp(state.reputation?.[faction],-100,100);
    const factionDelta=factionAdjustment(factionScore);
    const alignmentDelta=alignmentAdjustment(merchant?.alignment,state.holyPoints,state.hellPoints);
    const adjustment=clamp(factionDelta+alignmentDelta,-0.50,0.80);
    const multiplier=1+adjustment;
    const buyPrice=Math.max(1,Math.ceil(base*multiplier));
    const baseSell=Math.max(1,Math.floor(base*clamp(merchant?.sellMultiplier||0.45,0.05,1)));
    const sellOfferMultiplier=clamp(1-(adjustment*0.6),0.60,1.35);
    const sellPrice=Math.max(1,Math.floor(baseSell*sellOfferMultiplier));
    const reasons=[];
    if(factionDelta){
      reasons.push({kind:'faction',faction,score:factionScore,delta:factionDelta,
        label:`${merchant?.factionLabel||faction.replace(/_/g,' ')} ${factionDelta<0?'favor':'enmity'}: ${factionDelta>0?'+':''}${roundPercent(factionDelta)}%`});
    }
    if(alignmentDelta){
      const playerAlignment=((Number(state.holyPoints)||0)-(Number(state.hellPoints)||0))>=0?'Holy':'Dark';
      reasons.push({kind:'alignment',alignment:merchant?.alignment,delta:alignmentDelta,
        label:`${playerAlignment} ${alignmentDelta<0?'kinship':'opposition'}: ${alignmentDelta>0?'+':''}${roundPercent(alignmentDelta)}%`});
    }
    return Object.freeze({basePrice:base,buyPrice,sellPrice,multiplier,adjustment,factionScore,factionDelta,alignmentDelta,reasons});
  }

  function describe(merchant,state={}){
    const sample=quote(100,merchant,state);
    const alignment=merchant?.alignment&&merchant.alignment!=='neutral'
      ? `${merchant.alignment==='holy'?'Holy':'Dark'}-aligned`:'unaligned';
    const faction=merchant?.factionLabel||String(merchant?.faction||'citizens').replace(/_/g,' ');
    const result=sample.adjustment===0?'standard prices':sample.adjustment<0
      ? `${Math.abs(roundPercent(sample.adjustment))}% favorable prices`
      : `${roundPercent(sample.adjustment)}% markup`;
    return Object.freeze({...sample,alignment,faction,result});
  }

  return Object.freeze({factionAdjustment,alignmentAdjustment,quote,describe});
});
