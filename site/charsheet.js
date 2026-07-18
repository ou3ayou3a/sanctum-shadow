// ============================================
//   SANCTUM & SHADOW — CHARACTER SHEET
//   Full visual overlay: portrait, stats,
//   class resource, skill tree, equipment,
//   relationships, reputation
// ============================================

function openCharSheet(section = 'character') {
  document.getElementById('char-sheet-overlay')?.remove();

  const char = gameState.character;
  if (!char) return;

  const cls   = (window.CLASSES||[]).find(c => c.id === char.class);
  const race  = (window.RACES||[]).find(r => r.id === char.race);
  // #81: outside active combat, refresh the class resource from a sensible default
  // so the sheet doesn't show a stale/empty bar between fights.
  if (!window.combatState?.active && window.initClassResource) initClassResource(char);
  const cr    = window.classResource || {};
  const stats = char.stats || {};

  const statKeys  = ['str','dex','con','int','wis','cha'];
  const statNames = ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
  const statAbbr  = ['STR','DEX','CON','INT','WIS','CHA'];

  const lvl   = char.level || 1;
  const xpTbl = window.XP_TABLE || [0,100,250,450,700,1000,1400,1900,2500,3200,4000];
  // Progress within level L: (xp - XP_TABLE[L-1]) / (XP_TABLE[L] - XP_TABLE[L-1])
  const prev  = xpTbl[lvl-1] || 0;
  const next  = xpTbl[lvl] || prev + 1000;
  const xpPct = Math.max(0, Math.min(100, Math.round(((char.xp-prev)/(next-prev))*100)));

  const hpPct = Math.min(100, Math.round((char.hp/char.maxHp)*100));
  const mpPct = Math.min(100, Math.round((char.mp/char.maxMp)*100));
  const crPct = cr.max ? Math.min(100, Math.round((cr.current/cr.max)*100)) : 0;

  // Equipped items
  const equipped = char.equipped || { weapon: null, armor: null, accessory: null };
  const esc = window.escapeHtml || (s => s);
  const slotLabel = (v) => v ? esc(v) : '<span style="opacity:0.4">Empty</span>';
  const inventoryItems = Array.isArray(char.inventory) ? char.inventory : [];
  const inventoryIcons = { sword:'⚔',mace:'🔨',staff:'🔮',bow:'🏹',dagger:'🗡',armor:'🛡',robe:'🧥',cloak:'🧥',potion:'🧪',water:'💧',book:'📜',scripture:'📖',kit:'💊',candle:'🕯',crystal:'💎',quiver:'🏹',lockpick:'🔑',salve:'🧪',bandage:'🩹',ration:'🥩',draught:'⚗',essence:'💧',antidote:'🌿',smoke:'💨',draft:'🍺',oil:'🌑' };
  const consumableKeywords = ['potion','salve','bandage','ration','draught','essence','antidote','smoke bomb','draft','oil','holy water','healing kit','vial','mending','focus','might','shadow'];
  const inventoryIcon = item => Object.entries(inventoryIcons).find(([key])=>item.toLowerCase().includes(key))?.[1] || '📦';
  const isConsumable = item => consumableKeywords.some(key=>item.toLowerCase().includes(key));

  // Reputation summary
  const rep = window.reputation || {};
  const factionNames = { church:'Eternal Flame', crown:'The Crown', watch:'City Watch', scholars:'The Scholars', remnant:'The Remnant', shadow:'Shadow Court' };
  const factionIcons = { church:'🕯', crown:'👑', watch:'⚔', scholars:'📜', remnant:'✝', shadow:'🌑' };

  // Relationships
  const rels = window.romanceState?.relationships || {};
  const relEntries = Object.entries(rels).filter(([,r]) => (r.affection || 0) >= 20);

  const overlay = document.createElement('div');
  overlay.id = 'char-sheet-overlay';
  overlay.innerHTML = `
<div class="cs-backdrop" onclick="if(event.target===this)closeCharSheet()"></div>
<div class="cs-panel">
  <!-- HEADER -->
  <div class="cs-header">
    <div class="cs-title-block">
      <div class="cs-name">${esc(char.name)}</div>
      <div class="cs-subtitle">${race?.name||''} ${cls?.name||''} · Level ${lvl}</div>
      <div class="cs-tree-tag">${char.tree ? `☩ ${char.tree.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())} Path` : ''}</div>
    </div>
    <button class="cs-close" aria-label="Close character sheet" onclick="closeCharSheet()">✕</button>
  </div>

  <!-- BODY: two-column -->
  <div class="cs-body">

    <!-- LEFT COLUMN -->
    <div class="cs-col-left">

      <!-- PORTRAIT -->
      <div class="cs-portrait-block">
        <img src="${char.portrait || window.PortraitLibrary?.getPlayerPortrait(char.race)}" class="cs-portrait-img" alt="${char.name}">
        <div class="cs-portrait-overlay">
          <div class="cs-morality">
            <span class="cs-holy">✝ ${char.holyPoints||0}</span>
            <span class="cs-hell">⛧ ${char.hellPoints||0}</span>
          </div>
        </div>
      </div>

      <!-- RESOURCE BARS -->
      <div class="cs-bars">
        <div class="cs-bar-row">
          <span class="cs-bar-label">❤ HP</span>
          <div class="cs-bar-track"><div class="cs-bar-fill hp" style="width:${hpPct}%"></div></div>
          <span class="cs-bar-val">${char.hp}/${char.maxHp}</span>
        </div>
        <div class="cs-bar-row">
          <span class="cs-bar-label">💙 MP</span>
          <div class="cs-bar-track"><div class="cs-bar-fill mp" style="width:${mpPct}%"></div></div>
          <span class="cs-bar-val">${char.mp}/${char.maxMp}</span>
        </div>
        ${cr.type ? `
        <div class="cs-bar-row">
          <span class="cs-bar-label" style="color:${cr.color}">${cr.icon} ${cr.label}</span>
          <div class="cs-bar-track"><div class="cs-bar-fill" style="width:${crPct}%;background:${cr.color}"></div></div>
          <span class="cs-bar-val">${cr.current}/${cr.max}</span>
        </div>` : ''}
        <div class="cs-bar-row">
          <span class="cs-bar-label" style="color:#888">⭐ XP</span>
          <div class="cs-bar-track"><div class="cs-bar-fill xp" style="width:${xpPct}%"></div></div>
          <span class="cs-bar-val">${char.xp}/${next}</span>
        </div>
        <div class="cs-gold-row">🪙 ${char.gold||0} gold&nbsp;&nbsp;·&nbsp;&nbsp;
          ${char.statPoints > 0 ? `<span style="color:#8bc87a">🎯 ${char.statPoints} stat pt${char.statPoints!==1?'s':''}</span>` : ''}
          ${char.skillPoints > 0 ? `&nbsp;<span style="color:#a0c0ff">✨ ${char.skillPoints} skill pt${char.skillPoints!==1?'s':''}</span>` : ''}
        </div>
      </div>

      <!-- STATS -->
      <div class="cs-section-title">Attributes</div>
      <div class="cs-stats-grid">
        ${statKeys.map((k,i) => {
          const val = stats[k]||10;
          const mod = Math.floor((val-10)/2);
          const isPrimary = cls?.primaryStat?.toLowerCase().includes(k);
          return `<div class="cs-stat ${isPrimary?'primary':''}">
            <div class="cs-stat-abbr">${statAbbr[i]}</div>
            <div class="cs-stat-val">${val}</div>
            <div class="cs-stat-mod">${mod>=0?'+':''}${mod}</div>
            ${char.statPoints > 0 ? `<button class="cs-stat-up" onclick="csAssignStat('${k}')">+</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      <div style="margin:8px 0 14px;padding:10px;border:1px solid rgba(201,168,76,.16);background:rgba(0,0,0,.18)">
        <div style="font-family:'Cinzel',serif;font-size:.68rem;color:var(--gold);margin-bottom:6px">
          Proficiency Bonus +${2 + Math.floor((lvl - 1) / 4)}
        </div>
        <div style="font-size:.72rem;color:var(--text-dim);line-height:1.5">
          ${(char.proficiencies || window.CLASS_PROFICIENCIES?.[char.class] || [])
            .map(s => s.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())).join(' · ') || 'Perception'}
        </div>
      </div>

      <!-- EQUIPMENT -->
      <div class="cs-section-title">Equipment</div>
      <div class="cs-equip-slots">
        <div class="cs-slot" onclick="csEquipFromInventory('weapon')">
          <span class="cs-slot-icon">⚔</span>
          <span class="cs-slot-label">Weapon</span>
          <span class="cs-slot-item">${slotLabel(equipped.weapon)}</span>
        </div>
        <div class="cs-slot" onclick="csEquipFromInventory('armor')">
          <span class="cs-slot-icon">🛡</span>
          <span class="cs-slot-label">Armor</span>
          <span class="cs-slot-item">${slotLabel(equipped.armor)}</span>
        </div>
        <div class="cs-slot" onclick="csEquipFromInventory('accessory')">
          <span class="cs-slot-icon">💍</span>
          <span class="cs-slot-label">Accessory</span>
          <span class="cs-slot-item">${slotLabel(equipped.accessory)}</span>
        </div>
      </div>

      <div class="cs-section-title" id="cs-inventory">Inventory <span class="cs-inventory-count">${inventoryItems.length}</span></div>
      <div class="cs-inventory-list">
        ${inventoryItems.map((item,index)=>`<div class="cs-inventory-item"><span class="cs-inventory-icon">${inventoryIcon(item)}</span><span>${esc(item)}</span>${isConsumable(item)?`<button type="button" onclick="csUseInventoryItem(${index})">USE</button>`:''}</div>`).join('') || '<div class="cs-inventory-empty">Nothing in your pack.</div>'}
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div class="cs-col-right">

      <!-- SKILL TREE -->
      <div class="cs-section-title">
        Skill Tree
        ${char.skillPoints > 0 ? `<span class="cs-skill-pts-badge">${char.skillPoints} pt${char.skillPoints!==1?'s':''}</span>` : ''}
      </div>
      <div id="char-sheet-skilltree"></div>

      <!-- REPUTATION -->
      <div class="cs-section-title">Reputation</div>
      <div class="cs-rep-grid">
        ${Object.entries(factionNames).map(([id, name]) => {
          const val = rep[id] || 0;
          // #81: check 'Enemy' (<= -60) BEFORE 'Hostile' (<= -30) so the worst tier is reachable
          const label = val >= 60 ? 'Allied' : val >= 30 ? 'Friendly' : val <= -60 ? 'Enemy' : val <= -30 ? 'Hostile' : 'Neutral';
          const color = val >= 30 ? '#8bc87a' : val <= -30 ? '#c0392b' : '#888';
          const barW = Math.min(100, Math.abs(val));
          return `<div class="cs-rep-row">
            <span class="cs-rep-icon">${factionIcons[id]}</span>
            <span class="cs-rep-name">${name}</span>
            <div class="cs-rep-track"><div class="cs-rep-fill" style="width:${barW}%;background:${color}"></div></div>
            <span class="cs-rep-label" style="color:${color}">${label}</span>
          </div>`;
        }).join('')}
      </div>

      <!-- RELATIONSHIPS -->
      ${relEntries.length > 0 ? `
      <div class="cs-section-title">Relationships</div>
      <div class="cs-rel-list">
        ${relEntries.map(([npcId, r]) => {
          const hearts = r.affection >= 75 ? '❤❤❤' : r.affection >= 50 ? '❤❤' : '❤';
          const stage = r.affection >= 90 ? 'Devoted' : r.affection >= 75 ? 'In Love' : r.affection >= 50 ? 'Romantic' : 'Close';
          return `<div class="cs-rel-row">
            <span class="cs-rel-hearts">${hearts}</span>
            <span class="cs-rel-name">${npcId.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())}</span>
            <span class="cs-rel-stage">${stage}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

      <!-- ORIGIN & SECRET -->
      <div class="cs-section-title">Background</div>
      <div class="cs-origin-block">
        <div class="cs-origin-label">${char.origin ? char.origin.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) : 'Unknown Origin'}</div>
        ${char.secret ? `<div class="cs-secret">🌑 "${char.secret}"</div>` : ''}
      </div>

    </div>
  </div>
</div>`;

  document.body.appendChild(overlay);

  // Render skill tree
  if (typeof renderSkillTreeSheet === 'function') renderSkillTreeSheet();

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    if (section === 'inventory') document.getElementById('cs-inventory')?.scrollIntoView({block:'start'});
  });
}
window.openCharSheet = openCharSheet;

function closeCharSheet() {
  const o = document.getElementById('char-sheet-overlay');
  if (!o) return;
  o.classList.remove('visible');
  setTimeout(() => o.remove(), 300);
}
window.closeCharSheet = closeCharSheet;

function csUseInventoryItem(index) {
  const item = gameState.character?.inventory?.[index];
  if (!item || typeof window.useConsumable !== 'function') return;
  window.useConsumable(item);
  openCharSheet('inventory');
}
window.csUseInventoryItem = csUseInventoryItem;

// ─── STAT ALLOCATION from Character Sheet ───
function csAssignStat(key) {
  const char = gameState.character;
  if (!char || !char.statPoints) return;
  char.stats[key] = (char.stats[key]||10) + 1;
  char.statPoints--;
  addLog(`📈 ${key.toUpperCase()} increased to ${char.stats[key]}!`, 'holy');
  if (window.autoSave) autoSave();
  openCharSheet(); // refresh
}
window.csAssignStat = csAssignStat;

// ─── EQUIP FROM INVENTORY ────────────────────
function csEquipFromInventory(slot) {
  const char = gameState.character;
  if (!char) return;
  if (!char.equipped) char.equipped = { weapon:null, armor:null, accessory:null };

  // Build list of equippable items for this slot
  const weaponKeywords = ['sword','dagger','axe','mace','staff','bow','blade','knife','lance','spear','crossbow','wand','hammer'];
  const armorKeywords  = ['armor','mail','plate','robe','cloak','leather','shield','vest','coat'];
  const accessKeywords = ['ring','amulet','pendant','gem','signet','talisman','bracelet','token'];

  const keywords = slot==='weapon' ? weaponKeywords : slot==='armor' ? armorKeywords : accessKeywords;
  const equippable = (char.inventory||[]).filter(item =>
    keywords.some(k => item.toLowerCase().includes(k))
  );

  if (equippable.length === 0) {
    toast('No equippable items for this slot!', 'error'); return;
  }

  // #81: cycle through items AND an "Unequip" (null) option so a slot can be emptied.
  const cycle = [...equippable, null];
  const current = char.equipped[slot];
  const idx = current ? cycle.indexOf(current) : cycle.length - 1; // start before first item
  const next = cycle[(idx + 1) % cycle.length];

  // #3: the character sheet is the authority for equipped-gear stats, and it shares ONE
  // bookkeeping model with the shop via window.applyGearBonus / removeGearBonus. Each
  // item's atk/ac is tracked in char._gearBonuses[name] and applied EXACTLY ONCE, so
  // equipping an item that was already bought (already counted) won't double it, and
  // unequipping deducts only what was actually applied.
  const removeGear = window.removeGearBonus || ((c, name) => {
    // Fallback if shop.js helpers aren't loaded: deduct from a per-name record.
    c._gearBonuses = c._gearBonuses || {};
    const t = c._gearBonuses[name];
    if (!t) return;
    if (t.atk) c.atkBonus = Math.max(0, (c.atkBonus||0) - t.atk);
    if (t.ac)  c.ac = Math.max(10, (c.ac||10) - t.ac);
    delete c._gearBonuses[name];
  });
  const applyGear = window.applyGearBonus || ((c, name) => {
    c._gearBonuses = c._gearBonuses || {};
    if (c._gearBonuses[name]) return;
    const ci = Object.values(window.SHOP_ITEMS||{}).find(i => i.name === name);
    let atk = 0, ac = 0;
    if (ci) { atk = ci.atk||0; ac = ci.ac||0; }
    else {
      const lower = name.toLowerCase();
      if (slot==='weapon' || weaponKeywords.some(k=>lower.includes(k))) atk = 2;
      else if (slot==='armor' || armorKeywords.some(k=>lower.includes(k))) ac = 1;
    }
    if (!atk && !ac) return;
    if (atk) c.atkBonus = (c.atkBonus||0) + atk;
    if (ac)  c.ac = (c.ac||10) + ac;
    c._gearBonuses[name] = { atk, ac };
  });

  // Remove the outgoing item's bonus (if it was applied), then equip and apply the new one.
  if (current) removeGear(char, current);
  char.equipped[slot] = next;
  if (next) applyGear(char, next, slot);

  if (next) {
    toast(`Equipped: ${next}`, 'success');
    addLog(`⚔ Equipped ${next} in ${slot} slot.`, 'system');
  } else {
    toast(`${slot.charAt(0).toUpperCase()+slot.slice(1)} slot emptied.`, 'success');
    addLog(`Unequipped ${slot} slot.`, 'system');
  }
  if (window.autoSave) autoSave();
  openCharSheet();
}
window.csEquipFromInventory = csEquipFromInventory;

// ─── CHARACTER SHEET CSS ─────────────────────
const charSheetCSS = `
#char-sheet-overlay {
  position:fixed; inset:0; z-index:4000;
  display:flex; align-items:center; justify-content:center;
  opacity:0; transition:opacity 0.3s;
  pointer-events:none;
}
#char-sheet-overlay.visible { opacity:1; pointer-events:all; }

.cs-backdrop {
  position:absolute; inset:0;
  background:rgba(0,0,0,0.82); backdrop-filter:blur(4px);
}

.cs-panel {
  position:relative; z-index:1;
  width:min(920px, 96vw); max-height:90vh;
  background:linear-gradient(160deg, rgba(8,5,2,0.99) 0%, rgba(4,2,1,1) 100%);
  border:1px solid rgba(201,168,76,0.35);
  border-radius:2px;
  display:flex; flex-direction:column;
  overflow:hidden;
  box-shadow:0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(201,168,76,0.08);
  animation:csSlideIn 0.35s cubic-bezier(0.16,1,0.3,1);
}
@keyframes csSlideIn { from{transform:translateY(24px) scale(0.98);opacity:0} to{transform:none;opacity:1} }

.cs-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 22px 12px;
  border-bottom:1px solid rgba(201,168,76,0.15);
  background:rgba(201,168,76,0.04);
  flex-shrink:0;
}
.cs-name { font-family:'Cinzel',serif; font-size:1.4rem; color:var(--gold); letter-spacing:0.1em; }
.cs-subtitle { font-family:'Cinzel',serif; font-size:0.75rem; color:var(--text-dim); letter-spacing:0.08em; margin-top:2px; }
.cs-tree-tag { font-family:'IM Fell English','Palatino',serif; font-size:0.72rem; color:rgba(201,168,76,0.6); margin-top:2px; font-style:italic; }
.cs-close {
  background:none; border:1px solid rgba(201,168,76,0.2); color:var(--text-dim);
  font-size:0.9rem; width:30px; height:30px; cursor:pointer; border-radius:2px;
  transition:all 0.15s;
}
.cs-close:hover { border-color:var(--gold); color:var(--gold); }

.cs-body {
  display:grid; grid-template-columns:260px 1fr;
  gap:0; overflow-y:auto; flex:1;
}

/* LEFT COLUMN */
.cs-col-left {
  padding:16px; border-right:1px solid rgba(201,168,76,0.1);
  display:flex; flex-direction:column; gap:14px;
}

.cs-portrait-block {
  position:relative; border-radius:3px; overflow:hidden;
  border:1px solid rgba(201,168,76,0.2);
  aspect-ratio:3/4; background:rgba(0,0,0,0.6);
}
.cs-portrait-img {
  width:100%; height:100%; object-fit:cover;
  display:block;
}
.cs-portrait-placeholder {
  width:100%; height:100%;
  display:flex; align-items:center; justify-content:center;
  font-size:4rem; color:rgba(201,168,76,0.3);
  background:linear-gradient(160deg, rgba(20,12,4,1), rgba(8,5,2,1));
}
.cs-portrait-overlay {
  position:absolute; bottom:0; left:0; right:0;
  background:linear-gradient(transparent, rgba(0,0,0,0.85));
  padding:8px 10px 8px;
}
.cs-morality { display:flex; justify-content:space-between; }
.cs-holy { font-family:'Cinzel',serif; font-size:0.7rem; color:#f0c060; }
.cs-hell { font-family:'Cinzel',serif; font-size:0.7rem; color:#c0392b; }

.cs-bars { display:flex; flex-direction:column; gap:5px; }
.cs-bar-row { display:grid; grid-template-columns:60px 1fr 52px; align-items:center; gap:6px; }
.cs-bar-label { font-family:'Cinzel',serif; font-size:0.6rem; color:var(--text-dim); }
.cs-bar-track { height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; }
.cs-bar-fill { height:100%; border-radius:3px; transition:width 0.4s; }
.cs-bar-fill.hp  { background:linear-gradient(90deg,#c0392b,#e74c3c); }
.cs-bar-fill.mp  { background:linear-gradient(90deg,#2980b9,#3498db); }
.cs-bar-fill.xp  { background:linear-gradient(90deg,#c9a84c,#f0c060); }
.cs-bar-val { font-family:'Cinzel',serif; font-size:0.58rem; color:var(--text-secondary); text-align:right; }
.cs-gold-row { font-family:'Cinzel',serif; font-size:0.65rem; color:var(--gold); margin-top:2px; }

.cs-section-title {
  font-family:'Cinzel',serif; font-size:0.65rem; color:var(--gold);
  letter-spacing:0.12em; text-transform:uppercase;
  border-bottom:1px solid rgba(201,168,76,0.15); padding-bottom:5px;
  margin-top:2px; display:flex; align-items:center; gap:8px;
}
.cs-skill-pts-badge {
  background:rgba(160,192,255,0.15); border:1px solid rgba(160,192,255,0.3);
  color:#a0c0ff; padding:1px 6px; border-radius:10px; font-size:0.6rem;
}

.cs-stats-grid {
  display:grid; grid-template-columns:repeat(3,1fr); gap:5px;
}
.cs-stat {
  background:rgba(201,168,76,0.04); border:1px solid rgba(201,168,76,0.12);
  border-radius:3px; padding:6px 4px; text-align:center;
  position:relative;
}
.cs-stat.primary { border-color:rgba(201,168,76,0.35); background:rgba(201,168,76,0.09); }
.cs-stat-abbr { font-family:'Cinzel',serif; font-size:0.55rem; color:var(--text-dim); letter-spacing:0.1em; }
.cs-stat-val  { font-family:'Cinzel',serif; font-size:1.1rem; color:var(--gold); line-height:1.2; }
.cs-stat-mod  { font-size:0.65rem; color:var(--text-secondary); }
.cs-stat-up {
  position:absolute; bottom:2px; right:2px;
  background:rgba(139,200,122,0.2); border:1px solid rgba(139,200,122,0.4);
  color:#8bc87a; font-size:0.65rem; width:16px; height:16px;
  cursor:pointer; border-radius:2px; line-height:1;
  display:flex; align-items:center; justify-content:center;
}
.cs-stat-up:hover { background:rgba(139,200,122,0.4); }

.cs-equip-slots { display:flex; flex-direction:column; gap:4px; }
.cs-slot {
  display:flex; align-items:center; gap:8px;
  background:rgba(201,168,76,0.04); border:1px solid rgba(201,168,76,0.12);
  border-radius:3px; padding:7px 10px; cursor:pointer; transition:all 0.15s;
}
.cs-slot:hover { border-color:rgba(201,168,76,0.35); background:rgba(201,168,76,0.09); }
.cs-slot-icon { font-size:0.9rem; flex-shrink:0; }
.cs-slot-label { font-family:'Cinzel',serif; font-size:0.58rem; color:var(--text-dim); width:52px; flex-shrink:0; }
.cs-slot-item { font-family:'IM Fell English','Palatino',serif; font-size:0.72rem; color:var(--text-secondary); flex:1; }
.cs-inventory-count { margin-left:auto;padding:1px 6px;border-radius:10px;color:var(--text-secondary);background:rgba(201,168,76,.1);font-size:.58rem; }
.cs-inventory-list { display:flex;flex-direction:column;gap:4px;scroll-margin-top:8px; }
.cs-inventory-item { display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:6px;padding:6px 7px;color:var(--text-secondary);background:rgba(201,168,76,.04);border:1px solid rgba(201,168,76,.1);font-size:.72rem; }
.cs-inventory-icon { text-align:center;font-size:.9rem; }
.cs-inventory-item button { padding:3px 6px;color:var(--gold);background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.28);font:600 .55rem Cinzel,serif;cursor:pointer; }
.cs-inventory-item button:hover { color:#16130c;background:var(--gold); }
.cs-inventory-empty { padding:8px;color:var(--text-dim);font-size:.72rem;font-style:italic; }

/* RIGHT COLUMN */
.cs-col-right { padding:16px; display:flex; flex-direction:column; gap:14px; }

.cs-rep-grid { display:flex; flex-direction:column; gap:5px; }
.cs-rep-row { display:grid; grid-template-columns:20px 100px 1fr 60px; align-items:center; gap:8px; }
.cs-rep-icon { font-size:0.85rem; text-align:center; }
.cs-rep-name { font-family:'Cinzel',serif; font-size:0.6rem; color:var(--text-dim); }
.cs-rep-track { height:4px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }
.cs-rep-fill { height:100%; border-radius:2px; transition:width 0.4s; }
.cs-rep-label { font-family:'Cinzel',serif; font-size:0.6rem; text-align:right; }

.cs-rel-list { display:flex; flex-direction:column; gap:4px; }
.cs-rel-row { display:flex; align-items:center; gap:8px; padding:5px 8px; background:rgba(201,168,76,0.04); border-radius:3px; }
.cs-rel-hearts { color:#e74c3c; font-size:0.75rem; }
.cs-rel-name { font-family:'Cinzel',serif; font-size:0.65rem; color:var(--text-secondary); flex:1; }
.cs-rel-stage { font-family:'IM Fell English','Palatino',serif; font-size:0.7rem; color:var(--gold); font-style:italic; }

.cs-origin-block { padding:8px 10px; background:rgba(0,0,0,0.3); border:1px solid rgba(201,168,76,0.1); border-radius:3px; }
.cs-origin-label { font-family:'Cinzel',serif; font-size:0.72rem; color:var(--text-secondary); }
.cs-secret { font-family:'IM Fell English','Palatino',serif; font-size:0.78rem; color:rgba(192,57,43,0.7); font-style:italic; margin-top:5px; border-left:2px solid rgba(192,57,43,0.3); padding-left:8px; }

@media (max-width:640px) {
  .cs-body { grid-template-columns:1fr; }
  .cs-col-left { border-right:none; border-bottom:1px solid rgba(201,168,76,0.1); }
  .cs-portrait-block { aspect-ratio:2/1; max-height:180px; }
}
`;
const csStyle = document.createElement('style');
csStyle.textContent = charSheetCSS;
document.head.appendChild(csStyle);
