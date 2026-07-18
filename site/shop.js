// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — MERCHANT SHOP SYSTEM
//  Location-aware merchants, buy/sell, item effects
// ═══════════════════════════════════════════════════════════

// ─── ITEM CATALOGUE ──────────────────────────────────────
const SHOP_ITEMS = {

  // CONSUMABLES
  health_potion_sm:  { id:'health_potion_sm',  name:'Vial of Mending',       icon:'🧪', type:'consumable', effect:'heal_30',  price:18,  desc:'Restores 30 HP. Bitter taste of iron.' },
  health_potion_lg:  { id:'health_potion_lg',  name:'Draught of Mending',     icon:'⚗️', type:'consumable', effect:'heal_60',  price:40,  desc:'Restores 60 HP. Warm in the throat.' },
  mp_potion:         { id:'mp_potion',          name:'Essence of Focus',       icon:'💧', type:'consumable', effect:'mp_40',    price:30,  desc:'Restores 40 MP. Smells of ozone.' },
  antidote:          { id:'antidote',           name:'Antidote Tincture',      icon:'🌿', type:'consumable', effect:'cure_poison', price:22, desc:'Cures poison. Tastes of ash.' },
  holy_water:        { id:'holy_water',          name:'Holy Water',            icon:'✝',  type:'consumable', effect:'holy_dmg_undead', price:25, desc:'Burns undead and demons. +20 DMG vs unholy.' },
  bandage:           { id:'bandage',             name:'Field Bandage',         icon:'🩹', type:'consumable', effect:'heal_15',  price:8,   desc:'Restores 15 HP. Crude but effective.' },
  smoke_bomb:        { id:'smoke_bomb',          name:'Smoke Bomb',            icon:'💨', type:'consumable', effect:'escape',   price:35,  desc:'Creates cover. Allows retreat from combat.' },
  strength_draft:    { id:'strength_draft',      name:'Draft of Might',        icon:'🍺', type:'consumable', effect:'str_buff', price:45,  desc:'+4 STR for 3 turns. Smells like a forge.' },
  shadow_oil:        { id:'shadow_oil',          name:'Shadow Oil',            icon:'🌑', type:'consumable', effect:'sneak_buff', price:55, desc:'+4 DEX for 3 turns. Reeks of void.' },
  rations:           { id:'rations',             name:'Iron Rations',          icon:'🥩', type:'consumable', effect:'heal_10',  price:5,   desc:'Trail food. Restores 10 HP during rest.' },

  // WEAPONS
  iron_dagger:       { id:'iron_dagger',         name:'Iron Dagger',           icon:'🗡', type:'weapon', atk:2,  price:30,  desc:'+2 ATK. Fast and concealable.' },
  shortsword:        { id:'shortsword',           name:'Shortsword',            icon:'⚔', type:'weapon', atk:3,  price:55,  desc:'+3 ATK. Standard city guard issue.' },
  longsword:         { id:'longsword',            name:'Longsword',             icon:'⚔', type:'weapon', atk:5,  price:110, desc:'+5 ATK. A knight\'s blade.' },
  war_axe:           { id:'war_axe',              name:'War Axe',               icon:'🪓', type:'weapon', atk:6,  price:130, desc:'+6 ATK. Brutal and unsubtle.' },
  holy_blade:        { id:'holy_blade',           name:'Blessed Blade',         icon:'✝', type:'weapon', atk:4,  price:180, desc:'+4 ATK, +10 DMG vs undead. Church-forged.' },
  shadow_knife:      { id:'shadow_knife',         name:'Shadow Knife',          icon:'🌑', type:'weapon', atk:4,  price:160, desc:'+4 ATK, ignores 2 AC. Void-touched steel.' },
  staff_of_ruin:     { id:'staff_of_ruin',        name:'Staff of Ruin',         icon:'🔮', type:'weapon', atk:3,  price:150, desc:'+3 ATK, +4 spell damage. Humming with energy.' },
  crossbow:          { id:'crossbow',             name:'Crossbow',              icon:'🏹', type:'weapon', atk:4,  price:95,  desc:'+4 ATK ranged. Requires bolts.' },

  // ARMOR
  leather_armor:     { id:'leather_armor',        name:'Leather Armor',         icon:'🥋', type:'armor', ac:1,   price:40,  desc:'+1 AC. Light and flexible.' },
  chain_shirt:       { id:'chain_shirt',          name:'Chain Shirt',           icon:'🪖', type:'armor', ac:2,   price:90,  desc:'+2 AC. Rings of tested steel.' },
  half_plate:        { id:'half_plate',           name:'Half-Plate',            icon:'🛡', type:'armor', ac:3,   price:200, desc:'+3 AC. Heavy but reliable.' },
  shield:            { id:'shield',               name:'Iron Shield',           icon:'🛡', type:'armor', ac:2,   price:65,  desc:'+2 AC. Block and push.' },
  void_cloak:        { id:'void_cloak',           name:'Void Cloak',            icon:'🌑', type:'armor', ac:1,   price:140, desc:'+1 AC, +2 DEX. Woven from shadow.' },
  church_vestments:  { id:'church_vestments',     name:'Church Vestments',      icon:'✝', type:'armor', ac:1,   price:80,  desc:'+1 AC, +2 WIS. Holy protection.' },

  // KEY ITEMS / LORE
  city_pass:         { id:'city_pass',            name:'City Watch Pass',       icon:'📜', type:'key_item', price:120, desc:'Grants access to restricted districts. Forged.' },
  false_identity:    { id:'false_identity',       name:'False Papers',          icon:'🪪', type:'key_item', price:200, desc:'A complete false identity. Dangerous to carry.' },
  thieves_tools:     { id:'thieves_tools',        name:'Thieves\' Tools',       icon:'🔧', type:'key_item', price:50,  desc:'+4 DEX on lock-picking and trap disarming.' },
  torch:             { id:'torch',                name:'Alchemical Torch',      icon:'🔦', type:'key_item', price:12,  desc:'Burns for 6 hours. Reveals hidden doors.' },
  rope:              { id:'rope',                 name:'Silk Rope (50ft)',      icon:'🪢', type:'key_item', price:15,  desc:'Strong and silent. Endless uses.' },
  poison_vial:       { id:'poison_vial',          name:'Vial of Nightshade',    icon:'☠', type:'consumable', effect:'poison_weapon', price:75, desc:'Coats weapon for 3 strikes. -5 HP/turn for 3 turns.' },
};

// ─── MERCHANT INVENTORIES BY LOCATION ────────────────────
const MERCHANTS = {
  vaelthar_city: {
    name: 'Brennan\'s Sundries',
    keeper: 'Old Brennan',
    keeperIcon: '👴',
    desc: 'A cluttered stall near the market square. Brennan\'s seen better days — and so has his stock.',
    stock: ['health_potion_sm','health_potion_lg','bandage','rations','iron_dagger','leather_armor','shield','torch','rope','city_pass'],
    sellMultiplier: 0.5,
    faction: 'citizens', factionLabel:'Citizens of Vaelthar', alignment:'neutral',
  },
  // #28: re-keyed to real WORLD_LOCATIONS ids so all 7 merchants are reachable.
  thornwood_passage: {
    name: 'The Wanderer\'s Pack',
    keeper: 'Sylva',
    keeperIcon: '🧝',
    desc: 'A ranger\'s cart on the forest road. She trades in things that keep you alive out here.',
    stock: ['bandage','antidote','rations','smoke_bomb','shadow_knife','void_cloak','rope','thieves_tools','shadow_oil'],
    sellMultiplier: 0.45,
    faction: 'citizens', factionLabel:'Thornwood Folk', alignment:'neutral',
  },
  temple_quarter: {
    name: 'The Church Armory',
    keeper: 'Brother Edric',
    keeperIcon: '⛪',
    desc: 'The Church sells protection — for a price. Everything here is blessed. Most of it works.',
    stock: ['holy_water','health_potion_lg','mp_potion','holy_blade','church_vestments','shield','bandage','strength_draft'],
    sellMultiplier: 0.55,
    faction: 'church', factionLabel:'Church of the Eternal Flame', alignment:'holy',
  },
  tarnished_cup: {
    name: 'The Black Shelf',
    keeper: 'Mira (no last name)',
    keeperIcon: '🕵️',
    desc: 'A back room behind the tavern. Third knock, pause, two more. She sells what others won\'t.',
    stock: ['poison_vial','false_identity','thieves_tools','shadow_oil','shadow_knife','smoke_bomb','mp_potion','staff_of_ruin'],
    sellMultiplier: 0.6,
    faction: 'underworld', factionLabel:'Vaelthar Underworld', alignment:'dark',
  },
  merchant_road: {
    name: 'Harbormaster\'s Surplus',
    keeper: 'Big Kes',
    keeperIcon: '⚓',
    desc: 'A wagon of surplus goods parked along the trade road. No questions asked. Prices reflect that.',
    stock: ['rations','rope','crossbow','iron_dagger','leather_armor','chain_shirt','antidote','health_potion_sm','torch'],
    sellMultiplier: 0.4,
    faction: 'citizens', factionLabel:'Road Merchants', alignment:'neutral',
  },
  church_archive: {
    name: 'The Bone Trader',
    keeper: 'Osric the Gray',
    keeperIcon: '💀',
    desc: 'He\'s been here longer than anyone remembers, down among the sealed shelves. He\'ll be here after everyone else is gone.',
    stock: ['health_potion_lg','mp_potion','holy_water','staff_of_ruin','void_cloak','poison_vial','antidote','shadow_oil'],
    sellMultiplier: 0.65,
    faction: 'covenant', factionLabel:'Covenant Remnants', alignment:'dark',
  },
  monastery_aldric: {
    name: 'The Pilgrim\'s Store',
    keeper: 'Novice Tael',
    keeperIcon: '🧎',
    desc: 'Simple goods for simple needs. The monastery provides what wanderers require.',
    stock: ['rations','bandage','health_potion_sm','mp_potion','church_vestments','rope','torch','holy_water'],
    sellMultiplier: 0.5,
    faction: 'church', factionLabel:'Monastery of Saint Aldric', alignment:'holy',
  },
};

// Default fallback merchant
const DEFAULT_MERCHANT = {
  name: 'Traveling Merchant',
  keeper: 'The Merchant',
  keeperIcon: '🧳',
  desc: 'A road-worn trader with a battered cart.',
  stock: ['health_potion_sm','bandage','rations','iron_dagger','leather_armor','torch','rope'],
  sellMultiplier: 0.45,
  faction: 'citizens', factionLabel:'Independent Traders', alignment:'neutral',
};

// ─── SHOP STATE ───────────────────────────────────────────
window.shopState = { open: false, tab: 'buy' };

// ─── UNIFIED GEAR-BONUS BOOKKEEPING (#3) ──────────────────
// ONE source of truth for equipped-gear stat bonuses.
//
//   char.atkBonus / char.ac  — the live, persisted totals (saves.js persists these).
//   char._gearBonuses[name]  — { atk, ac } actually applied to those totals for that
//                              item NAME. Presence of an entry means "this item's bonus
//                              is currently counted exactly once".
//
// Both the shop (buy) and the character sheet (equip) route through these helpers, so a
// given item's atk/ac is applied EXACTLY ONCE no matter how many code paths touch it:
//   • applyGearBonus is a no-op if the name is already counted (idempotent).
//   • removeGearBonus deducts only what was actually applied, then clears the entry.

function gearStatsFor(name, slotHint) {
  // Resolve an item's atk/ac — from SHOP_ITEMS, or a keyword fallback for starting gear
  // that has no catalogue entry so it still grants stats.
  if (!name) return { atk: 0, ac: 0 };
  const ci = Object.values(window.SHOP_ITEMS || {}).find(i => i.name === name);
  if (ci) return { atk: ci.atk || 0, ac: ci.ac || 0 };
  const lower = name.toLowerCase();
  const weaponKeywords = ['sword','dagger','axe','mace','staff','bow','blade','knife','lance','spear','crossbow','wand','hammer'];
  const armorKeywords  = ['armor','mail','plate','robe','cloak','leather','shield','vest','coat'];
  if (slotHint === 'weapon' || weaponKeywords.some(k => lower.includes(k))) return { atk: 2, ac: 0 };
  if (slotHint === 'armor'  || armorKeywords.some(k => lower.includes(k)))  return { atk: 0, ac: 1 };
  return { atk: 0, ac: 0 };
}
window.gearStatsFor = gearStatsFor;

// Apply an item's bonus to the live totals exactly once. Idempotent per item name.
function applyGearBonus(char, name, slotHint) {
  if (!char || !name) return;
  char._gearBonuses = char._gearBonuses || {};
  if (char._gearBonuses[name]) return; // already counted — never apply twice
  const { atk, ac } = gearStatsFor(name, slotHint);
  if (!atk && !ac) return; // nothing to track
  if (atk) char.atkBonus = (char.atkBonus || 0) + atk;
  if (ac)  char.ac = (char.ac || 10) + ac;
  char._gearBonuses[name] = { atk, ac };
}
window.applyGearBonus = applyGearBonus;

// Remove exactly what was applied for an item name, then clear the entry.
function removeGearBonus(char, name) {
  if (!char || !name) return;
  char._gearBonuses = char._gearBonuses || {};
  const tracked = char._gearBonuses[name];
  if (!tracked) return; // nothing was applied for this name
  if (tracked.atk) char.atkBonus = Math.max(0, (char.atkBonus || 0) - tracked.atk);
  if (tracked.ac)  char.ac = Math.max(10, (char.ac || 10) - tracked.ac);
  delete char._gearBonuses[name];
}
window.removeGearBonus = removeGearBonus;

// ─── OPEN SHOP ────────────────────────────────────────────
function openShop() {
  // #16: no shopping during combat
  if (window.combatState?.active) {
    if (window.toast) toast('⚔ Not during combat!', 'error');
    else if (window.addLog) addLog('⚔ Not during combat!', 'system');
    return;
  }
  const location = window.mapState?.currentLocation || 'vaelthar_city';
  const merchant = MERCHANTS[location] || DEFAULT_MERCHANT;
  window.shopState.open = true;
  window.shopState.merchant = merchant;
  renderShop(merchant);
}

function merchantPriceState(char=gameState.character){
  return {reputation:window.reputation||{},holyPoints:char?.holyPoints||0,hellPoints:char?.hellPoints||0};
}

function getMerchantQuote(item,merchant=window.shopState.merchant,char=gameState.character){
  if(!item)return null;
  return window.MerchantPricing?.quote(item.price,merchant||DEFAULT_MERCHANT,merchantPriceState(char))
    || {basePrice:item.price,buyPrice:item.price,sellPrice:Math.max(1,Math.floor(item.price*(merchant?.sellMultiplier||.45))),adjustment:0,reasons:[]};
}

function merchantPriceSummary(merchant,char=gameState.character){
  return window.MerchantPricing?.describe(merchant,merchantPriceState(char))
    || {faction:merchant.factionLabel||'Independent',alignment:'unaligned',result:'standard prices',adjustment:0,reasons:[]};
}

function renderShop(merchant) {
  document.getElementById('shop-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'shop-panel';
  panel.className = 'shop-panel';

  const char = gameState.character;
  const gold = char?.gold || 0;
  const pricing = merchantPriceSummary(merchant,char);
  const esc = window.escapeHtml || (value=>String(value));

  panel.innerHTML = `
    <div class="shop-inner">
      <div class="shop-header">
        <div class="shop-keeper">
          <span class="shop-keeper-icon">${merchant.keeperIcon}</span>
          <div class="shop-keeper-info">
            <span class="shop-name">${merchant.name}</span>
            <span class="shop-keeper-name">${merchant.keeper}</span>
            <span class="shop-desc">"${merchant.desc}"</span>
            <span class="shop-loyalty">${esc(pricing.faction)} · ${esc(pricing.alignment)}</span>
          </div>
        </div>
        <div class="shop-gold">
          <span class="shop-gold-icon">🪙</span>
          <span class="shop-gold-amount" id="shop-gold-display">${gold}</span>
          <span class="shop-gold-label">gold</span>
        </div>
        <button class="shop-close" onclick="closeShop()">✕ Leave</button>
      </div>

      <div class="shop-pricing ${pricing.adjustment<0?'favorable':pricing.adjustment>0?'hostile':'neutral'}">
        <strong>${pricing.adjustment<0?'◆ FAVORABLE TERMS':pricing.adjustment>0?'⚠ INFLATED PRICES':'◇ STANDARD TERMS'}</strong>
        <span>${esc(pricing.result)}${pricing.reasons.length?` — ${pricing.reasons.map(reason=>esc(reason.label)).join(' · ')}`:''}</span>
      </div>

      <div class="shop-tabs">
        <button class="shop-tab ${window.shopState.tab === 'buy' ? 'active' : ''}" onclick="setShopTab('buy')">⚔ Buy</button>
        <button class="shop-tab ${window.shopState.tab === 'sell' ? 'active' : ''}" onclick="setShopTab('sell')">💰 Sell</button>
      </div>

      <div class="shop-body" id="shop-body">
        ${window.shopState.tab === 'buy' ? renderBuyTab(merchant) : renderSellTab(merchant)}
      </div>

      <div class="shop-footer" id="shop-footer">
        <span class="shop-hint">Click an item to ${window.shopState.tab === 'buy' ? 'buy' : 'sell'} it</span>
      </div>
    </div>
  `;

  // #9: in 3D Vaelthar the #game-log lives inside #game-screen, BELOW the z1400 city
  // canvas, so an inline panel is occluded. Float it on document.body (position:fixed,
  // z-index 1600) — the same pattern dialogue.js conv-panel and story.js scene-panel use.
  const in3D = document.body.classList.contains('vt-3d-active');
  const gameLog = document.getElementById('game-log');
  if (in3D) {
    panel.classList.add('shop-panel-floating');
    document.body.appendChild(panel);
  } else if (gameLog) {
    gameLog.appendChild(panel);
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  } else {
    document.body.appendChild(panel);
  }
  requestAnimationFrame(() => panel.style.opacity = '1');
}

function renderBuyTab(merchant) {
  const char = gameState.character;
  const gold = char?.gold || 0;

  return merchant.stock.map(itemId => {
    const item = SHOP_ITEMS[itemId];
    if (!item) return '';
    const quote = getMerchantQuote(item,merchant,char);
    const price = quote.buyPrice;
    const canAfford = gold >= price;
    const owned = (char?.inventory || []).filter(i => i === item.name).length;
    return `
      <div class="shop-item ${canAfford ? '' : 'unaffordable'}" onclick="${canAfford ? `buyItem('${item.id}')` : ''}">
        <span class="si-icon">${item.icon}</span>
        <div class="si-info">
          <span class="si-name">${item.name}</span>
          <span class="si-desc">${item.desc}</span>
          ${item.atk ? `<span class="si-stat atk">⚔ +${item.atk} ATK</span>` : ''}
          ${item.ac  ? `<span class="si-stat ac">🛡 +${item.ac} AC</span>` : ''}
          ${item.effect ? `<span class="si-stat eff">✨ ${formatEffect(item.effect)}</span>` : ''}
        </div>
        <div class="si-right">
          <span class="si-price ${canAfford ? '' : 'cant-afford'}">🪙 ${price}</span>
          ${price!==item.price?`<span class="si-base-price">base ${item.price}</span>`:''}
          ${owned > 0 ? `<span class="si-owned">own ${owned}</span>` : ''}
          ${canAfford ? `<button class="si-buy-btn">Buy</button>` : `<span class="si-broke">Not enough gold</span>`}
        </div>
      </div>`;
  }).join('');
}

function renderSellTab(merchant) {
  const char = gameState.character;
  const inventory = char?.inventory || [];

  if (inventory.length === 0) {
    return `<div class="shop-empty">Your pack is empty. Nothing to sell.</div>`;
  }

  // Group inventory items
  const grouped = {};
  inventory.forEach(name => {
    grouped[name] = (grouped[name] || 0) + 1;
  });

  // #31: don't interpolate the item name into an inline onclick — names like
  // "Thieves' Tools" break the JS string. Use data attributes + delegated listener.
  const esc = window.escapeHtml || (s => String(s));
  const html = Object.entries(grouped).map(([name, qty]) => {
    // Find item in catalogue or estimate value
    const catalogItem = Object.values(SHOP_ITEMS).find(i => i.name === name);
    const sellPrice = catalogItem ? getMerchantQuote(catalogItem,merchant,char).sellPrice : 5;
    const icon = catalogItem?.icon || '📦';
    const desc = catalogItem?.desc || 'An item from your travels.';

    return `
      <div class="shop-item sellable" data-sell-name="${esc(name)}">
        <span class="si-icon">${icon}</span>
        <div class="si-info">
          <span class="si-name">${esc(name)} ${qty > 1 ? `<span class="si-qty">×${qty}</span>` : ''}</span>
          <span class="si-desc">${esc(desc)}</span>
        </div>
        <div class="si-right">
          <span class="si-price">🪙 ${sellPrice}</span>
          <button class="si-buy-btn sell-btn">Sell</button>
        </div>
      </div>`;
  }).join('');
  // Wire listeners after the markup lands in the DOM.
  setTimeout(_wireSellButtons, 0);
  return html;
}

// #31: attach click handlers to sell rows using their data attributes.
function _wireSellButtons() {
  document.querySelectorAll('#shop-body .shop-item.sellable').forEach(el => {
    if (el._sellWired) return;
    el._sellWired = true;
    el.addEventListener('click', () => {
      const name = el.getAttribute('data-sell-name');
      sellItem(name);
    });
  });
}

function formatEffect(effect) {
  const map = {
    heal_10: 'Restore 10 HP', heal_15: 'Restore 15 HP',
    heal_30: 'Restore 30 HP', heal_60: 'Restore 60 HP',
    mp_40: 'Restore 40 MP', cure_poison: 'Cure Poison',
    holy_dmg_undead: '+20 vs Undead', escape: 'Escape Combat',
    str_buff: '+4 STR (3 turns)', sneak_buff: '+4 DEX (3 turns)',
    poison_weapon: 'Poison Weapon (3 strikes)',
  };
  return map[effect] || effect;
}

// ─── BUY ITEM ─────────────────────────────────────────────
function buyItem(itemId) {
  const item = SHOP_ITEMS[itemId];
  const char = gameState.character;
  if (!item || !char) return;
  const quote = getMerchantQuote(item,window.shopState.merchant,char);
  const price = quote.buyPrice;

  if ((char.gold || 0) < price) {
    toast('Not enough gold!', 'error');
    return;
  }

  char.gold = (char.gold || 0) - price;
  char.inventory = char.inventory || [];
  char.inventory.push(item.name);

  // #3: route gear stats through the unified bookkeeping so an item's atk/ac is applied
  // EXACTLY ONCE — whether granted here on purchase or later via the character sheet's
  // equip. applyGearBonus is idempotent per item name, so buying a second copy (or
  // equipping the same item) won't double-count.
  if (item.type === 'weapon' || item.type === 'armor') {
    applyGearBonus(char, item.name, item.type);
  }

  addLog(`🪙 Purchased ${item.icon} ${item.name} for ${price} gold${price!==item.price?` (base ${item.price}; reputation and alignment adjusted)`:''}.`, 'system');
  toast(`${item.icon} ${item.name} acquired!`, 'success');

  if (window.autoSave) autoSave();
  if (window.updateCharacterPanel) updateCharacterPanel();

  // Refresh shop display
  document.getElementById('shop-gold-display').textContent = char.gold;
  document.getElementById('shop-body').innerHTML = renderBuyTab(window.shopState.merchant);
}

// ─── SELL ITEM ────────────────────────────────────────────
function sellItem(itemName) {
  const char = gameState.character;
  if (!char) return;

  const idx = char.inventory.indexOf(itemName);
  if (idx === -1) { toast('Item not found!', 'error'); return; }
  const catalogItem=Object.values(SHOP_ITEMS).find(item=>item.name===itemName);
  const price=catalogItem?getMerchantQuote(catalogItem,window.shopState.merchant,char).sellPrice:5;

  char.inventory.splice(idx, 1);
  char.gold = (char.gold || 0) + price;

  // #3: the gear bonus is applied exactly once per item NAME while owned. Only deduct it
  // when the LAST copy of that name leaves the pack — and clear any orphaned equipped
  // pointer so nothing points at a sold item.
  const stillOwned = (char.inventory || []).includes(itemName);
  if (!stillOwned) {
    removeGearBonus(char, itemName);
    if (char.equipped) {
      for (const slot of Object.keys(char.equipped)) {
        if (char.equipped[slot] === itemName) char.equipped[slot] = null;
      }
    }
  }

  addLog(`🪙 Sold ${itemName} for ${price} gold.`, 'system');
  toast(`Sold for ${price}g!`, 'success');

  if (window.autoSave) autoSave();
  if (window.updateCharacterPanel) updateCharacterPanel();

  document.getElementById('shop-gold-display').textContent = char.gold;
  document.getElementById('shop-body').innerHTML = renderSellTab(window.shopState.merchant);
}

// ─── TAB SWITCH ───────────────────────────────────────────
function setShopTab(tab) {
  window.shopState.tab = tab;
  document.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase().includes(tab)));
  document.getElementById('shop-body').innerHTML =
    tab === 'buy' ? renderBuyTab(window.shopState.merchant) : renderSellTab(window.shopState.merchant);
  document.getElementById('shop-footer').innerHTML =
    `<span class="shop-hint">Click an item to ${tab === 'buy' ? 'buy' : 'sell'} it</span>`;
}

// ─── CLOSE SHOP ───────────────────────────────────────────
function closeShop() {
  document.getElementById('shop-panel')?.remove();
  window.shopState.open = false;
}

// ─── USE CONSUMABLE FROM INVENTORY ───────────────────────
// Replaces the crude combatItem() potion logic with full effect system
function useConsumable(itemName) {
  const char = gameState.character;
  if (!char) return;
  const idx = char.inventory.indexOf(itemName);
  if (idx === -1) { toast('Item not in inventory!', 'error'); return; }

  const catalogItem = Object.values(SHOP_ITEMS).find(i => i.name === itemName);
  const effect = catalogItem?.effect;

  char.inventory.splice(idx, 1);

  if (!effect) { addLog(`Used ${itemName}.`, 'system'); return; }

  if (effect.startsWith('heal_')) {
    const amt = parseInt(effect.split('_')[1]);
    const before = char.hp;
    char.hp = Math.min(char.maxHp, char.hp + amt);
    addLog(`🧪 Used ${itemName}. Restored ${char.hp - before} HP. (${char.hp}/${char.maxHp})`, 'holy');
  } else if (effect.startsWith('mp_')) {
    const amt = parseInt(effect.split('_')[1]);
    const before = char.mp;
    char.mp = Math.min(char.maxMp, char.mp + amt);
    addLog(`💧 Used ${itemName}. Restored ${char.mp - before} MP. (${char.mp}/${char.maxMp})`, 'holy');
  } else if (effect === 'cure_poison') {
    if (window.combatState && window.removeStatus) removeStatus('player', 'poison');
    addLog(`🌿 Used ${itemName}. Poison cured.`, 'holy');
  } else if (effect === 'str_buff') {
    if (window.addStatus) addStatus('player', { id:'str_buff', name:'Might Draft', icon:'💪', turnsLeft:3, bonusAtk:4 });
    addLog(`🍺 Used ${itemName}. +4 STR for 3 turns!`, 'holy');
  } else if (effect === 'sneak_buff') {
    if (window.addStatus) addStatus('player', { id:'sneak_buff', name:'Shadow Oil', icon:'🌑', turnsLeft:3, bonusDex:4 });
    addLog(`🌑 Used ${itemName}. +4 DEX for 3 turns!`, 'holy');
  } else if (effect === 'escape') {
    if (window.combatState?.active) {
      addLog(`💨 Smoke fills the air — you escape combat!`, 'system');
      // #15: use the clean flee path when available, else fall back.
      if (window.fleeCombat) fleeCombat();
      else if (window.endCombat) endCombat(false);
    } else {
      addLog(`💨 You deploy the smoke bomb but there\'s nothing to escape.`, 'system');
    }
  } else if (effect === 'poison_weapon') {
    if (window.combatState) combatState.poisonedWeapon = 3;
    addLog(`☠ Weapon coated with Nightshade. Next 3 strikes apply poison.`, 'hell');
  }

  if (window.updateCharacterPanel) updateCharacterPanel();
  if (window.autoSave) autoSave();
  toast(`Used ${itemName}!`, 'success');
}

// ─── SHOP CSS ─────────────────────────────────────────────
(function injectShopCSS() {
  const style = document.createElement('style');
  style.textContent = `
  .shop-panel {
    background: linear-gradient(180deg, rgba(8,6,4,0.98) 0%, rgba(12,8,4,0.98) 100%);
    border: 1px solid rgba(201,168,76,0.3);
    border-radius: 2px;
    margin: 12px 0;
    opacity: 0;
    transition: opacity 0.3s ease;
    max-height: 600px;
    display: flex;
    flex-direction: column;
  }
  .shop-inner { display:flex; flex-direction:column; height:100%; }

  /* #9: floating placement for 3D Vaelthar (above the z1400 city canvas). */
  .shop-panel.shop-panel-floating {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    width: min(680px, 94vw);
    max-height: 82vh;
    margin: 0;
    z-index: 1600;
    box-shadow: 0 4px 28px rgba(0,0,0,0.7);
  }

  .shop-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid rgba(201,168,76,0.15);
  }
  .shop-keeper { display:flex; gap:12px; flex:1; }
  .shop-keeper-icon { font-size:40px; flex-shrink:0; }
  .shop-keeper-info { display:flex; flex-direction:column; gap:2px; }
  .shop-name { font-family:'Cinzel',serif; color:var(--gold,#c9a84c); font-size:0.95rem; }
  .shop-keeper-name { font-size:0.75rem; color:rgba(201,168,76,0.6); }
  .shop-desc { font-size:0.72rem; color:rgba(255,255,255,0.4); font-style:italic; max-width:320px; }
  .shop-loyalty { margin-top:3px; color:rgba(201,168,76,.72); font:600 .58rem Cinzel,serif; letter-spacing:.05em; text-transform:uppercase; }

  .shop-pricing { display:flex;align-items:center;gap:9px;padding:7px 18px;border-bottom:1px solid rgba(201,168,76,.12);font-size:.64rem; }
  .shop-pricing strong { flex-shrink:0;font:700 .6rem Cinzel,serif;letter-spacing:.07em; }
  .shop-pricing span { color:rgba(255,255,255,.54); }
  .shop-pricing.favorable { background:rgba(62,145,91,.11);color:#75c990; }
  .shop-pricing.hostile { background:rgba(180,62,50,.12);color:#dc786e; }
  .shop-pricing.neutral { background:rgba(201,168,76,.05);color:rgba(201,168,76,.7); }

  .shop-gold { display:flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(201,168,76,0.08); border:1px solid rgba(201,168,76,0.2); margin-left:auto; }
  .shop-gold-icon { font-size:18px; }
  .shop-gold-amount { font-family:'Cinzel',serif; color:var(--gold,#c9a84c); font-size:1.3rem; }
  .shop-gold-label { font-size:0.65rem; color:rgba(201,168,76,0.5); text-transform:uppercase; letter-spacing:.05em; }

  .shop-close { background:rgba(180,40,40,0.15); border:1px solid rgba(180,40,40,0.3); color:#c06060; font-family:'Cinzel',serif; font-size:0.7rem; padding:6px 14px; cursor:pointer; transition:all .2s; }
  .shop-close:hover { background:rgba(180,40,40,0.3); color:#ff8080; }

  .shop-tabs { display:flex; border-bottom:1px solid rgba(201,168,76,0.15); }
  .shop-tab { flex:1; background:none; border:none; border-bottom:2px solid transparent; color:rgba(201,168,76,0.4); font-family:'Cinzel',serif; font-size:0.75rem; padding:10px; cursor:pointer; letter-spacing:.05em; transition:all .2s; }
  .shop-tab.active { color:var(--gold,#c9a84c); border-bottom-color:var(--gold,#c9a84c); }
  .shop-tab:hover { color:var(--gold,#c9a84c); }

  .shop-body { overflow-y:auto; flex:1; padding:8px 12px; display:flex; flex-direction:column; gap:4px; max-height:420px; }
  .shop-body::-webkit-scrollbar { width:4px; }
  .shop-body::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.2); }

  .shop-item {
    display:flex; align-items:center; gap:10px;
    padding:10px 12px; border:1px solid rgba(201,168,76,0.1);
    background:rgba(255,255,255,0.02); cursor:pointer;
    transition:all .2s;
  }
  .shop-item:hover:not(.unaffordable) { border-color:rgba(201,168,76,0.4); background:rgba(201,168,76,0.05); }
  .shop-item.unaffordable { opacity:0.45; cursor:default; }
  .shop-item.sellable:hover { border-color:rgba(100,200,100,0.4); background:rgba(100,200,100,0.04); }

  .si-icon { font-size:24px; flex-shrink:0; width:32px; text-align:center; }
  .si-info { flex:1; display:flex; flex-direction:column; gap:2px; }
  .si-name { font-family:'Cinzel',serif; color:rgba(255,255,255,0.85); font-size:0.78rem; }
  .si-qty { color:var(--gold,#c9a84c); font-size:0.7rem; }
  .si-desc { font-size:0.68rem; color:rgba(255,255,255,0.35); font-style:italic; }
  .si-stat { font-size:0.65rem; padding:1px 5px; border-radius:2px; display:inline-block; margin-right:4px; margin-top:2px; }
  .si-stat.atk { background:rgba(220,80,80,0.15); color:#e08080; }
  .si-stat.ac  { background:rgba(80,120,220,0.15); color:#8090e0; }
  .si-stat.eff { background:rgba(100,200,100,0.12); color:#80c080; }

  .si-right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
  .si-price { font-family:'Cinzel',serif; color:var(--gold,#c9a84c); font-size:0.8rem; }
  .si-price.cant-afford { color:#c06060; }
  .si-base-price { color:rgba(255,255,255,.3);font-size:.56rem;text-decoration:line-through; }
  .si-owned { font-size:0.62rem; color:rgba(201,168,76,0.5); }
  .si-broke { font-size:0.62rem; color:#c06060; }
  .si-buy-btn { background:rgba(201,168,76,0.15); border:1px solid rgba(201,168,76,0.3); color:var(--gold,#c9a84c); font-family:'Cinzel',serif; font-size:0.62rem; padding:3px 10px; cursor:pointer; transition:all .2s; }
  .si-buy-btn:hover { background:rgba(201,168,76,0.3); }
  .si-buy-btn.sell-btn { background:rgba(100,200,100,0.1); border-color:rgba(100,200,100,0.3); color:#80c080; }
  .si-buy-btn.sell-btn:hover { background:rgba(100,200,100,0.25); }

  .shop-footer { padding:8px 16px; border-top:1px solid rgba(201,168,76,0.1); }
  .shop-hint { font-size:0.65rem; color:rgba(255,255,255,0.25); font-style:italic; }
  .shop-empty { padding:32px; text-align:center; color:rgba(255,255,255,0.3); font-style:italic; font-size:0.8rem; }
  `;
  document.head.appendChild(style);
})();

console.log('🛒 Shop system loaded.');

// ─── GLOBAL EXPORTS ──────────────────────────────────────
window.useConsumable = useConsumable;
window.openShop = openShop;
window.getMerchantQuote = getMerchantQuote;
window.merchantPriceSummary = merchantPriceSummary;

window.SHOP_ITEMS = SHOP_ITEMS;
window.MERCHANTS = MERCHANTS;
