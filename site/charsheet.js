// ============================================
//   SANCTUM & SHADOW — CHARACTER SHEET
//   Full visual overlay: portrait, stats,
//   class resource, skill tree, equipment,
//   relationships, reputation
// ============================================

function openCharSheet() {
  document.getElementById('char-sheet-overlay')?.remove();

  const char = gameState.character;
  if (!char) return;

  const cls   = (window.CLASSES||[]).find(c => c.id === char.class);
  const race  = (window.RACES||[]).find(r => r.id === char.race);
  const cr    = window.classResource || {};
  const stats = char.stats || {};

  const statKeys  = ['str','dex','con','int','wis','cha'];
  const statNames = ['Strength','Dexterity','Constitution','Intelligence','Wisdom','Charisma'];
  const statAbbr  = ['STR','DEX','CON','INT','WIS','CHA'];

  const lvl   = char.level || 1;
  const xpTbl = window.XP_TABLE || [0,100,250,450,700,1000,1400,1900,2500,3200,4000];
  const prev  = xpTbl[lvl] || 0;
  const next  = xpTbl[lvl+1] || prev + 1000;
  const xpPct = Math.min(100, Math.round(((char.xp-prev)/(next-prev))*100));

  const hpPct = Math.min(100, Math.round((char.hp/char.maxHp)*100));
  const mpPct = Math.min(100, Math.round((char.mp/char.maxMp)*100));
  const crPct = cr.max ? Math.min(100, Math.round((cr.current/cr.max)*100)) : 0;

  // Equipped items
  const equipped = char.equipped || { weapon: null, armor: null, accessory: null };

  // Reputation summary
  const rep = window.gameState?.reputation || {};
  const factionNames = { church:'Eternal Flame', crown:'The Crown', watch:'City Watch', scholars:'The Scholars', remnant:'The Remnant', shadow:'Shadow Court' };
  const factionIcons = { church:'🕯', crown:'👑', watch:'⚔', scholars:'📜', remnant:'✝', shadow:'🌑' };

  // Relationships
  const rels = char.relationships || {};
  const relEntries = Object.entries(rels).filter(([,r]) => r.affection >= 20);

  const overlay = document.createElement('div');
  overlay.id = 'char-sheet-overlay';
  overlay.innerHTML = `
<div class="cs-backdrop" onclick="if(event.target===this)closeCharSheet()"></div>
<div class="cs-panel">
  <!-- HEADER -->
  <div class="cs-header">
    <div class="cs-title-block">
      <div class="cs-name">${char.name}</div>
      <div class="cs-subtitle">${race?.name||''} ${cls?.name||''} · Level ${lvl}</div>
      <div class="cs-tree-tag">${char.tree ? `☩ ${char.tree.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())} Path` : ''}</div>
    </div>
    <button class="cs-close" onclick="closeCharSheet()">✕</button>
  </div>

  <!-- BODY: two-column -->
  <div class="cs-body">

    <!-- LEFT COLUMN -->
    <div class="cs-col-left">

      <!-- PORTRAIT -->
      <div class="cs-portrait-block">
        ${char.portrait
          ? `<img src="${char.portrait}" class="cs-portrait-img" alt="${char.name}">`
          : `<div class="cs-portrait-placeholder">${cls?.icon||'⚔'}</div>`}
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

      <!-- EQUIPMENT -->
      <div class="cs-section-title">Equipment</div>
      <div class="cs-equip-slots">
        <div class="cs-slot" onclick="csEquipFromInventory('weapon')">
          <span class="cs-slot-icon">⚔</span>
          <span class="cs-slot-label">Weapon</span>
          <span class="cs-slot-item">${equipped.weapon || '<span style="opacity:0.4">Empty</span>'}</span>
        </div>
        <div class="cs-slot" onclick="csEquipFromInventory('armor')">
          <span class="cs-slot-icon">🛡</span>
          <span class="cs-slot-label">Armor</span>
          <span class="cs-slot-item">${equipped.armor || '<span style="opacity:0.4">Empty</span>'}</span>
        </div>
        <div class="cs-slot" onclick="csEquipFromInventory('accessory')">
          <span class="cs-slot-icon">💍</span>
          <span class="cs-slot-label">Accessory</span>
          <span class="cs-slot-item">${equipped.accessory || '<span style="opacity:0.4">Empty</span>'}</span>
        </div>
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
          const label = val >= 60 ? 'Allied' : val >= 30 ? 'Friendly' : val <= -30 ? 'Hostile' : val <= -60 ? 'Enemy' : 'Neutral';
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
  requestAnimationFrame(() => overlay.classList.add('visible'));
}
window.openCharSheet = openCharSheet;

function closeCharSheet() {
  const o = document.getElementById('char-sheet-overlay');
  if (!o) return;
  o.classList.remove('visible');
  setTimeout(() => o.remove(), 300);
}
window.closeCharSheet = closeCharSheet;

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

  // Simple cycle: equip first available, or show quick picker
  const current = char.equipped[slot];
  const idx = current ? equippable.indexOf(current) : -1;
  const next = equippable[(idx+1) % equippable.length];

  // Remove old bonuses
  if (current) {
    const oldItem = Object.values(window.SHOP_ITEMS||{}).find(i => i.name === current);
    if (oldItem?.atk) char.atkBonus = Math.max(0,(char.atkBonus||0)-oldItem.atk);
    if (oldItem?.ac)  char.ac = Math.max(10,(char.ac||10)-oldItem.ac);
  }

  // Apply new bonuses
  char.equipped[slot] = next;
  const newItem = Object.values(window.SHOP_ITEMS||{}).find(i => i.name === next);
  if (newItem?.atk) char.atkBonus = (char.atkBonus||0) + newItem.atk;
  if (newItem?.ac)  char.ac = (char.ac||10) + newItem.ac;

  toast(`Equipped: ${next}`, 'success');
  addLog(`⚔ Equipped ${next} in ${slot} slot.`, 'system');
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

