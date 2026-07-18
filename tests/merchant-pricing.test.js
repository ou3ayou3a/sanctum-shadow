'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Pricing=require('../site/merchant-pricing.js');

const project=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(project,file),'utf8');
const merchant=(faction='church',alignment='holy')=>({faction,factionLabel:faction,alignment,sellMultiplier:.5});
const state=(score=0,holyPoints=0,hellPoints=0,faction='church')=>({reputation:{[faction]:score},holyPoints,hellPoints});

test('matching moral alignment starts at ten percent and reaches twenty-five percent',()=>{
  assert.equal(Pricing.alignmentAdjustment('holy',10,0),-.10);
  assert.equal(Pricing.alignmentAdjustment('holy',100,0),-.25);
  assert.equal(Pricing.alignmentAdjustment('dark',0,10),-.10);
  assert.equal(Pricing.alignmentAdjustment('dark',0,100),-.25);
});

test('holy and dark opposition raises prices up to thirty percent',()=>{
  assert.equal(Pricing.alignmentAdjustment('dark',10,0),.10);
  assert.equal(Pricing.alignmentAdjustment('dark',100,0),.30);
  assert.equal(Pricing.alignmentAdjustment('holy',0,100),.30);
});

test('merchant faction loyalty overrides unrelated hero reputation',()=>{
  const holyChurch=merchant('church','holy');
  const belovedButExcommunicated={reputation:{citizens:100,church:-100},holyPoints:0,hellPoints:0};
  const quote=Pricing.quote(100,holyChurch,belovedButExcommunicated);
  assert.equal(quote.buyPrice,135);
  assert.equal(quote.factionScore,-100);
  assert.ok(quote.reasons.some(reason=>/enmity/.test(reason.label)));
});

test('maximum matching alignment grants exactly twenty-five percent without faction influence',()=>{
  const quote=Pricing.quote(100,merchant('church','holy'),state(0,100,0));
  assert.equal(quote.buyPrice,75);
  assert.equal(quote.alignmentDelta,-.25);
});

test('faction and moral alignment combine deterministically for buy and sell offers',()=>{
  const favored=Pricing.quote(100,merchant('church','holy'),state(100,100,0));
  const hated=Pricing.quote(100,merchant('church','holy'),state(-100,0,100));
  assert.equal(favored.buyPrice,60);
  assert.equal(hated.buyPrice,165);
  assert.ok(favored.sellPrice>50);
  assert.ok(hated.sellPrice<50);
});

test('shop displays and charges the same computed quote and recomputes sale offers',()=>{
  const shop=read('site/shop.js'),index=read('site/index.html');
  assert.match(index,/merchant-pricing\.js\?v=1/);
  assert.match(shop,/const price = quote\.buyPrice/);
  assert.match(shop,/char\.gold = \(char\.gold \|\| 0\) - price/);
  assert.match(shop,/function sellItem\(itemName\)/);
  assert.doesNotMatch(shop,/function sellItem\(itemName, price\)/);
  for(const profile of["alignment:'holy'","alignment:'dark'","alignment:'neutral'", "faction: 'church'", "faction: 'underworld'"])assert.match(shop,new RegExp(profile));
});
