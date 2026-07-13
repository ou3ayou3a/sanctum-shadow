/* =========================================================================
   vaelthar3d.js — VAELTHAR, THE FRACTURED CAPITAL
   The first playable 3D map for Sanctum & Shadow.
   -------------------------------------------------------------------------
   Render settings, primitive modeling, and the player/NPC bodies all reuse
   the Character Creator's system. This module is the controller: scene,
   camera follow, click-to-move, NPC interaction, the tavern interior, the
   atmosphere FX, and the window hooks the rest of the game drives.

   PUBLIC HOOKS (exposed on window):
     window.loadVaeltharMap()      -> build + start rendering the city
     window.unloadVaeltharMap()    -> dispose all geometry/materials, stop loop

   INTEGRATION POINTS (resolved at call-time; the live game overrides them):
     window.gameState.character           -> read race/class/equipped/colors
     window.startNPCConversation(id)      -> existing AI dialogue system
     window.travelToLocation(id)          -> existing WORLD_LOCATIONS travel
     window.openShop(id)                  -> existing shop screen
   See the integration note at the bottom of the demo HTML.
   ========================================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCharacter, RACES } from './charbuilder.js';
import { buildCity, buildTavernInterior, PAL } from './city.js';
import { buildNPC, SQUARE_NPCS, TAVERN_NPCS } from './npcs.js';
import { Atmosphere } from './fx.js';

const DEFAULT_CHARACTER = { race: 'human', class: 'warrior', skin: '#c98b63', hair: '#3a2a1a', tint: '#9aa0a8' };

class VaeltharWorld {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.running = false;
    this.area = 'square';            // 'square' | 'tavern'
    this.npcs = [];                  // active NPC records
    this.nameplates = [];            // {el, npc}
    this.signEls = [];               // ambient building signs
    this.moveTarget = null;
    this.pendingNPC = null;
    this.active = null;              // current interactable {kind, ...}
    this._tmp = new THREE.Vector3();
    this._clock = new THREE.Clock();

    this._initRenderer();
    this._initScenes();
    this._initOverlay();
    this._bindInput();
  }

  /* ---------------- renderer (identical settings to the creator) ---------------- */
  _initRenderer() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.18;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    this.camera.position.set(0, 6, 13);

    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true; c.dampingFactor = 0.08;
    c.minDistance = 4.5; c.maxDistance = 20;
    c.maxPolarAngle = Math.PI * 0.49; c.minPolarAngle = Math.PI * 0.12;
    c.enablePan = false; c.rotateSpeed = 0.85;
    c.target.set(0, 1.4, 0);
    this.controls = c;
    this._resize();
    window.addEventListener('resize', this._resizeBound = () => this._resize());
  }

  _resize() {
    const w = this.canvas.clientWidth || this.canvas.parentElement.clientWidth;
    const h = this.canvas.clientHeight || this.canvas.parentElement.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /* ---------------- scenes + lighting ---------------- */
  _initScenes() {
    // ---- SQUARE ----
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xc2c5c8, 0x21190f, 1.0));   // cool morning sky
    const key = new THREE.DirectionalLight(0xeef0ec, 2.3);       // pale sun through smoke
    key.position.set(-14, 24, 18); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 2; key.shadow.camera.far = 80;
    const sc = key.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    s.add(key);
    const fill = new THREE.DirectionalLight(0x8fa2cc, 0.7); fill.position.set(16, 10, -10); s.add(fill);
    const amb = new THREE.AmbientLight(0x55555c, 0.7); s.add(amb);
    this.sceneSquare = s;
    this.atmoSquare = new Atmosphere(s, { fogColor: 0x9a958a, fogNear: 22, fogFar: 76, smoke: 240, radius: 36 });

    const city = buildCity();
    s.add(city.root);
    this.city = city;
    for (const b of city.braziers) { if (b.worldPos) this.atmoSquare.addFireLight(b.worldPos, { kind: b.kind || 'brazier', intensity: b.kind === 'window' ? 2.0 : 1.5, dist: b.kind === 'window' ? 9 : 11 }); }

    // ---- TAVERN (built lazily) ----
    this.sceneTavern = null;
    this.atmoTavern = null;
    this.tavern = null;

    // ---- player ----
    this._buildPlayer();
    // spawn marker (click-to-move target ring)
    this._makeMarker();
  }

  _resolveCharacter() {
    const gs = (window.gameState && window.gameState.character) ? window.gameState.character : null;
    const src = gs || DEFAULT_CHARACTER;
    return {
      race: src.race || 'human', class: src.class || null,
      skin: src.skin || (RACES[src.race] && RACES[src.race].skin) || '#c98b63',
      hair: src.hair || '#3a2a1a', tint: src.tint || '#9aa0a8',
      equipped: src.equipped || null,
    };
  }

  _buildPlayer() {
    const cfg = this._resolveCharacter();
    this.player = createCharacter(cfg);
    this.playerRoot = new THREE.Group();
    this.playerRoot.add(this.player.root);
    this.playerRoot.position.set(0, 0, 5);
    this.playerRoot.rotation.y = Math.PI;          // face north (the gate)
    this.facing = Math.PI;
    this.sceneSquare.add(this.playerRoot);
    this.walkPhase = 0;
  }

  _makeMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0xe7c977, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), new THREE.MeshBasicMaterial({ color: 0xe7c977, transparent: true, opacity: 0.8, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2; dot.position.y = 0.06; g.add(dot);
    g.visible = false;
    this.marker = g; this.markerRing = ring; this.markerDot = dot; this.markerT = 0;
    this.sceneSquare.add(g);
  }

  /* ---------------- NPCs for current area ---------------- */
  _spawnNPCs(list, scene) {
    this._clearNPCs();
    for (const cfg of list) {
      const npc = buildNPC(cfg);
      scene.add(npc.root);
      this.npcs.push(npc);
      // nameplate
      const el = document.createElement('div');
      el.className = 'vt-nameplate';
      el.innerHTML = `<div class="vt-np-name">${npc.name}</div><div class="vt-np-title">${npc.title}</div>`;
      this.overlay.appendChild(el);
      this.nameplates.push({ el, npc });
    }
  }
  _clearNPCs() {
    for (const n of this.npcs) { if (n.root.parent) n.root.parent.remove(n.root); n.character.dispose(); }
    for (const p of this.nameplates) p.el.remove();
    this.npcs = []; this.nameplates = [];
  }

  /* ---------------- ambient building signs ---------------- */
  _spawnSigns(labels) {
    this._clearSigns();
    for (const l of labels) {
      const el = document.createElement('div');
      el.className = 'vt-sign';
      el.innerHTML = `<div class="vt-sign-name">${l.text}</div>${l.sub ? `<div class="vt-sign-sub">${l.sub}</div>` : ''}`;
      this.overlay.appendChild(el);
      this.signEls.push({ el, pos: l.position });
    }
  }
  _clearSigns() { for (const s of this.signEls) s.el.remove(); this.signEls = []; }

  /* ---------------- overlay UI: prompt + toast ---------------- */
  _initOverlay() {
    const prompt = document.createElement('div');
    prompt.className = 'vt-prompt'; prompt.style.display = 'none';
    prompt.innerHTML = `<button class="vt-prompt-btn"><span class="vt-key">E</span><span class="vt-prompt-text"></span></button>`;
    this.overlay.appendChild(prompt);
    this.promptEl = prompt;
    this.promptBtn = prompt.querySelector('.vt-prompt-btn');
    this.promptText = prompt.querySelector('.vt-prompt-text');
    this.promptBtn.addEventListener('click', (e) => { e.stopPropagation(); this._confirm(); });

    const toast = document.createElement('div');
    toast.className = 'vt-toast'; toast.style.opacity = '0';
    this.overlay.appendChild(toast); this.toastEl = toast;
  }

  _toast(msg, ms = 2600) {
    this.toastEl.textContent = msg; this.toastEl.style.opacity = '1';
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { this.toastEl.style.opacity = '0'; }, ms);
  }

  /* ---------------- input ---------------- */
  _bindInput() {
    const cv = this.canvas;
    this.ray = new THREE.Raycaster();
    let down = null;
    // store handlers as instance fields so dispose() can remove them
    this._onPointerDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    this._onPointerUp = (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      const moved = Math.hypot(dx, dy);
      const dt = performance.now() - down.t;
      down = null;
      if (moved < 6 && dt < 400) this._onTap(e);   // tap, not orbit-drag
    };
    cv.addEventListener('pointerdown', this._onPointerDown);
    cv.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('keydown', this._keyBound = (e) => {
      if (!this.running) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { if (this.active) { e.preventDefault(); this._confirm(); } }
    });
  }

  _ndc(e) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  _onTap(e) {
    this.ray.setFromCamera(this._ndc(e), this.camera);
    // 1) NPC?
    const roots = this.npcs.map(n => n.root);
    const hitN = this.ray.intersectObjects(roots, true);
    if (hitN.length) {
      // every descendant mesh is tagged with userData.npcId (the unique instance
      // id); read it off the hit object, walking up only if the leaf lacks it.
      let o = hitN[0].object; while (o && !o.userData.npcId) o = o.parent;
      const hitId = o && o.userData.npcId;
      const npc = this.npcs.find(n => n.dialogueId === hitId || n.id === hitId || n.root.userData.npcId === hitId);
      if (npc) { this._goToNPC(npc); return; }
    }
    // 2) ground
    const pt = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt)) {
      this.pendingNPC = null;
      this._setMoveTarget(pt);
    }
  }

  _goToNPC(npc) {
    this.pendingNPC = npc;
    // walk to a point just short of the NPC
    const p = this.playerRoot.position, t = npc.root.position;
    const dir = this._tmp.set(t.x - p.x, 0, t.z - p.z); const len = dir.length() || 1;
    dir.multiplyScalar(1 / len);
    const stop = 1.7;
    this._setMoveTarget(new THREE.Vector3(t.x - dir.x * stop, 0, t.z - dir.z * stop));
  }

  _setMoveTarget(v) {
    this.moveTarget = v.clone(); this.moveTarget.y = 0;
    this.marker.position.set(v.x, 0, v.z); this.marker.visible = true; this.markerT = 0;
  }

  /* ---------------- interaction targets ---------------- */
  _interactables() {
    // doors for current area + NPCs (NPCs handled separately for prompt label)
    const doors = this.area === 'square' ? this.city.doors : (this.tavern ? this.tavern.doors : []);
    return doors;
  }

  _confirm() {
    const a = this.active; if (!a) return;
    if (a.type === 'npc') { this._talk(a.npc.dialogueId, a.npc.name); return; }
    const d = a.door;
    if (d.kind === 'tavern') this._enterTavern();
    else if (d.kind === 'exit-interior') this._exitTavern();
    else if (d.kind === 'shop') this._openShop(d);
    else if (d.kind === 'sealed') this._toast('The Archive doors are sealed by Crown order. Aldis the scribe lingers here, terrified.');
    else if (d.kind === 'exit') this._travel(d);
  }

  _talk(id, name) {
    if (typeof window.startNPCConversation === 'function') {
      try { window.startNPCConversation(id); } catch (err) { console.warn('startNPCConversation failed', err); this._fallbackTalk(id, name); }
    } else { this._fallbackTalk(id, name); }
  }
  _fallbackTalk(id, name) {
    // demo-only: the live game replaces window.startNPCConversation
    this._toast(`“${name}” would speak now — connect window.startNPCConversation('${id}').`, 3400);
  }
  _travel(d) {
    if (typeof window.travelToLocation === 'function') { try { window.travelToLocation(d.locationId); return; } catch (err) {} }
    this._toast(`Travel to “${d.label}” — connect window.travelToLocation('${d.locationId}').`, 3400);
  }
  _openShop(d) {
    if (typeof window.openShop === 'function') { try { window.openShop(d.id); return; } catch (err) {} }
    this._toast(`Open “${d.label}” — connect window.openShop('${d.id}').`, 3400);
  }

  /* ---------------- tavern interior ---------------- */
  _enterTavern() {
    if (!this.sceneTavern) {
      const s = new THREE.Scene();
      s.add(new THREE.HemisphereLight(0x6a4e30, 0x140d06, 0.85));
      s.add(new THREE.AmbientLight(0x4a3420, 0.85));
      const warm = new THREE.PointLight(0xffc070, 3.0, 40, 1.4); warm.position.set(-1, 4.6, 0); s.add(warm);
      const soft = new THREE.DirectionalLight(0xffd9a0, 0.55); soft.position.set(-6, 8, 6); s.add(soft);
      this.sceneTavern = s;
      this.atmoTavern = new Atmosphere(s, { fogColor: 0x241a10, fogNear: 12, fogFar: 34, smoke: 50, radius: 9, smokeOpacity: 0.07, smokeSize: 2.2 });
      const tav = buildTavernInterior();
      s.add(tav.root); this.tavern = tav;
      for (const c of tav.candles) this.atmoTavern.addFireLight(c.worldPos, { kind: c.kind, color: c.kind === 'hearth' ? 0xff8a3a : 0xffc06a, intensity: c.kind === 'hearth' ? 3.6 : 1.5, dist: c.kind === 'hearth' ? 15 : 8 });
    }
    this.area = 'tavern';
    this.moveTarget = null; this.pendingNPC = null; this.marker.visible = false;
    this.playerRoot.parent && this.playerRoot.parent.remove(this.playerRoot);
    this.sceneTavern.add(this.playerRoot);
    this.marker.parent && this.marker.parent.remove(this.marker); this.sceneTavern.add(this.marker);
    const sp = this.tavern.spawn; this.playerRoot.position.set(sp.x, 0, sp.z); this.facing = Math.PI;
    this._spawnNPCs(TAVERN_NPCS, this.sceneTavern);
    this._spawnSigns([]);
    this._snapCamera();
    this._toast('The Tarnished Cup — warmth, low voices, the smell of tallow.');
  }
  _exitTavern() {
    this.area = 'square';
    this.moveTarget = null; this.pendingNPC = null; this.marker.visible = false;
    this.playerRoot.parent && this.playerRoot.parent.remove(this.playerRoot);
    this.sceneSquare.add(this.playerRoot);
    this.marker.parent && this.marker.parent.remove(this.marker); this.sceneSquare.add(this.marker);
    // step out by the tavern door
    const d = this.city.doors.find(x => x.id === 'tarnished_cup');
    this.playerRoot.position.set(d.position.x, 0, d.position.z + 1); this.facing = 0;
    this._spawnNPCs(SQUARE_NPCS, this.sceneSquare);
    this._spawnSigns(this.city.labels);
    this._snapCamera();
  }

  _snapCamera() {
    const p = this.playerRoot.position;
    if (this.area === 'tavern') {
      // fixed ¾ view framing the whole room (orbitable, not a tight follow)
      this.controls.target.set(0, 1.3, -1.0);
      this.camera.position.set(6.4, 5.4, 6.6);
      this.controls.update();
      return;
    }
    this.controls.target.set(p.x, 1.4, p.z);
    this.camera.position.set(p.x, p.y + 5, p.z + 11);
    this.controls.update();
  }

  _clampCameraToRoom() {
    const b = this.tavern.bounds; const c = this.camera.position;
    c.x = Math.max(b.minX + 0.4, Math.min(b.maxX - 0.4, c.x));
    c.z = Math.max(b.minZ + 0.4, Math.min(b.maxZ - 0.4, c.z));
    c.y = Math.max(1.7, Math.min(5.6, c.y));
  }

  /* ---------------- movement + collision ---------------- */
  _blocked(x, z) {
    const list = this.area === 'square' ? this.city.obstacles : this.tavern.obstacles;
    const pr = 0.55;
    for (const o of list) { if (Math.abs(x - o.x) < o.hw + pr && Math.abs(z - o.z) < o.hd + pr) return true; }
    return false;
  }
  _clampBounds(v) {
    const b = this.area === 'square' ? this.city.bounds : this.tavern.bounds;
    v.x = Math.max(b.minX, Math.min(b.maxX, v.x));
    v.z = Math.max(b.minZ, Math.min(b.maxZ, v.z));
  }

  _moveStep(dt) {
    if (!this.moveTarget) { this.player.idle(this._clock.elapsedTime); this.player.resetWalk(); this._easeFacing(dt); return; }
    const p = this.playerRoot.position;
    const dx = this.moveTarget.x - p.x, dz = this.moveTarget.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.12) { this.moveTarget = null; this.marker.visible = false; this.player.resetWalk(); this._arrive(); return; }
    const speed = 3.4;
    const step = Math.min(dist, speed * dt);
    const nx = dx / dist, nz = dz / dist;
    let cx = p.x + nx * step, cz = p.z + nz * step;
    // slide against obstacles
    if (this._blocked(cx, cz)) {
      if (!this._blocked(p.x + nx * step, p.z)) cz = p.z;
      else if (!this._blocked(p.x, p.z + nz * step)) cx = p.x;
      else { this.moveTarget = null; this.marker.visible = false; this.player.resetWalk(); this._arrive(); return; }
    }
    const cv = this._tmp.set(cx, 0, cz); this._clampBounds(cv);
    p.x = cv.x; p.z = cv.z;
    // face + animate
    this.facing = Math.atan2(nx, nz);
    this._easeFacing(dt, true);
    this.walkPhase += dt * 9.5;
    this.player.walk(this.walkPhase, 1);
  }

  _easeFacing(dt, fast) {
    let cur = this.playerRoot.rotation.y;
    let d = this.facing - cur;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.playerRoot.rotation.y = cur + d * Math.min(1, dt * (fast ? 12 : 6));
  }

  _arrive() {
    if (this.pendingNPC) {
      const npc = this.pendingNPC; this.pendingNPC = null;
      const p = this.playerRoot.position, t = npc.root.position;
      if (Math.hypot(t.x - p.x, t.z - p.z) < 2.4) { this._talk(npc.dialogueId, npc.name); }
    }
  }

  /* ---------------- per-frame proximity + nameplates ---------------- */
  _updateInteract() {
    const p = this.playerRoot.position;
    let best = null, bestD = Infinity;
    // nearest NPC
    for (const n of this.npcs) {
      const d = Math.hypot(n.root.position.x - p.x, n.root.position.z - p.z);
      if (d < 2.6 && d < bestD) { bestD = d; best = { type: 'npc', npc: n, label: 'Speak to ' + n.name, dist: d }; }
    }
    // nearest door
    for (const d of this._interactables()) {
      const dd = Math.hypot(d.position.x - p.x, d.position.z - p.z);
      const range = d.kind === 'exit' ? 3.2 : 3.0;
      if (dd < range && dd < bestD) { bestD = dd; best = { type: 'door', door: d, label: d.label, dist: dd }; }
    }
    this.active = best;
    if (best) {
      this.promptEl.style.display = 'block';
      let verb = 'Speak';
      if (best.type === 'door') verb = best.door.kind === 'tavern' ? 'Enter' : best.door.kind === 'exit' || best.door.kind === 'exit-interior' ? 'Travel' : best.door.kind === 'shop' ? 'Trade' : 'Inspect';
      this.promptText.innerHTML = `<b>${verb}</b> — ${best.label}${best.door && best.door.sub ? `<span class="vt-prompt-sub">${best.door.sub}</span>` : ''}`;
    } else { this.promptEl.style.display = 'none'; }
  }

  _updateNameplates() {
    const cam = this.camera;
    const camPos = cam.position;
    for (const { el, npc } of this.nameplates) {
      const wp = this._tmp.set(npc.root.position.x, npc.headY + 0.4, npc.root.position.z);
      const dist = wp.distanceTo(camPos);
      const v = wp.clone().project(cam);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1 || dist > 22) { el.style.display = 'none'; continue; }
      const r = this.canvas.getBoundingClientRect();
      const x = r.left + (v.x * 0.5 + 0.5) * r.width;
      const y = r.top + (-v.y * 0.5 + 0.5) * r.height;
      el.style.display = 'block';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      const near = Math.max(0.25, Math.min(1, (18 - dist) / 12));
      el.style.opacity = near.toFixed(2);
      const isActive = this.active && this.active.type === 'npc' && this.active.npc === npc;
      el.classList.toggle('vt-np-active', !!isActive);
    }
    // building signs (fainter)
    for (const { el, pos } of this.signEls) {
      const wp = this._tmp.copy(pos);
      const dist = wp.distanceTo(camPos);
      const v = wp.clone().project(cam);
      if (v.z > 1 || dist > 46 || v.x < -1.05 || v.x > 1.05) { el.style.display = 'none'; continue; }
      const r = this.canvas.getBoundingClientRect();
      el.style.display = 'block';
      el.style.left = (r.left + (v.x * 0.5 + 0.5) * r.width) + 'px';
      el.style.top = (r.top + (-v.y * 0.5 + 0.5) * r.height) + 'px';
      el.style.opacity = Math.max(0.1, Math.min(0.42, (44 - dist) / 70)).toFixed(2);
    }
  }

  /* ---------------- loop ---------------- */
  _frame() {
    if (!this.running) return;
    const dt = Math.min(0.05, this._clock.getDelta());
    const t = this._clock.elapsedTime;
    this._moveStep(dt);
    // idle NPC breathing
    for (const n of this.npcs) n.character.idle(t + n.root.position.x, false);
    // camera follows player in the open square; interior uses a fixed framed view
    const p = this.playerRoot.position;
    if (this.area === 'square') {
      this.controls.target.lerp(this._tmp.set(p.x, 1.4, p.z), Math.min(1, dt * 6));
    }
    this.controls.update();
    if (this.area === 'tavern') this._clampCameraToRoom();
    if (this.marker.visible) { this.markerT += dt; const s = 1 + Math.sin(this.markerT * 5) * 0.12; this.markerRing.scale.set(s, s, s); this.markerRing.material.opacity = 0.6 + Math.sin(this.markerT * 5) * 0.3; }
    // FX
    const atmo = this.area === 'square' ? this.atmoSquare : this.atmoTavern;
    if (atmo) { atmo.update(dt, t); atmo.follow(p); }
    this._updateInteract();
    this._updateNameplates();
    // optional divine VFX hook
    if (window.Divinity && typeof window.Divinity.update === 'function') { try { window.Divinity.update(dt, t); } catch (e) {} }
    this.renderer.render(this.area === 'square' ? this.sceneSquare : this.sceneTavern, this.camera);
    this._raf = requestAnimationFrame(() => this._frame());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._spawnNPCs(SQUARE_NPCS, this.sceneSquare);
    this._spawnSigns(this.city.labels);
    this._snapCamera();
    this._clock.start();
    this._frame();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resizeBound);
    window.removeEventListener('keydown', this._keyBound);
    // remove the per-load canvas pointer listeners
    if (this._onPointerDown) this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    if (this._onPointerUp) this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this._clearNPCs(); this._clearSigns();
    this.promptEl && this.promptEl.remove(); this.toastEl && this.toastEl.remove();
    if (this.atmoSquare) this.atmoSquare.dispose();
    if (this.atmoTavern) this.atmoTavern.dispose();
    // OrbitControls registers its own DOM listeners — release them
    if (this.controls) this.controls.dispose();
    const killScene = (s) => { if (!s) return; s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); };
    killScene(this.sceneSquare); killScene(this.sceneTavern);
    // the player was already disposed by killScene's traverse above; guard the
    // explicit dispose so we don't double-free its geometry/materials
    if (this.player && !this._playerDisposed) { this.player.dispose(); this._playerDisposed = true; }
    this.renderer.dispose();
    // NOTE: do NOT forceContextLoss() — the map reuses the single #vaelthar-scene
    // canvas, so losing its context blanks the renderer on the next enter. Reusing
    // one canvas reuses one context (getContext returns the existing one), so this
    // is not a context leak. renderer.dispose() + the listener/controls cleanup above
    // is the correct teardown.
    this.sceneSquare = this.sceneTavern = null;
  }
}

/* ---------------- module bootstrap + window hooks ---------------- */
let WORLD = null;

function findMounts() {
  const canvas = document.getElementById('vaelthar-scene');
  const overlay = document.getElementById('vaelthar-overlay');
  return { canvas, overlay };
}

window.loadVaeltharMap = function loadVaeltharMap() {
  if (WORLD) { WORLD.start(); return WORLD; }
  const { canvas, overlay } = findMounts();
  if (!canvas || !overlay) { console.error('[vaelthar] missing #vaelthar-scene canvas or #vaelthar-overlay'); return null; }
  WORLD = new VaeltharWorld(canvas, overlay);
  window.__vt = WORLD;
  WORLD.start();
  return WORLD;
};

window.unloadVaeltharMap = function unloadVaeltharMap() {
  if (!WORLD) return;
  WORLD.dispose();
  WORLD = null;
};

// auto-boot if the host page asked for it
if (document.body && document.body.dataset && document.body.dataset.autoload === 'vaelthar') {
  window.loadVaeltharMap();
}

export { VaeltharWorld };
