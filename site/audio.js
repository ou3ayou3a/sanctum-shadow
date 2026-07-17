// ============================================
//   SANCTUM & SHADOW — AUDIO ENGINE
//   Pure Web Audio API — no external files
// ============================================

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let sfxGain = null;
  let currentTrackId = null;
  let musicBuildOutput = null;
  let activeTrackInstance = null;
  const fadingTrackInstances = new Set();
  let stopGeneration = 0;
  let lastTransitionContext = 'initial';
  let musicVolume = 0.35;
  let sfxVolume = 0.6;
  let enabled = true;
  let cityAmbience = null;
  let pendingAmbience = null;
  let pendingCityListener = null;

  function loadPrefs() {
    try {
      const v = localStorage.getItem('ss_music_volume');
      if (v !== null) musicVolume = Math.max(0, Math.min(1, parseFloat(v)));
      const m = localStorage.getItem('ss_music_muted');
      if (m !== null) enabled = m !== '1';
    } catch (e) {}
  }

  function init() {
    // Re-entry guard — never create a second AudioContext
    if (ctx) return true;
    loadPrefs();
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = enabled ? musicVolume : 0;
      masterGain.connect(ctx.destination);
      // Dedicated SFX bus — affected by volume + mute
      sfxGain = ctx.createGain();
      sfxGain.gain.value = enabled ? sfxVolume * (musicVolume / 0.35) : 0;
      sfxGain.connect(ctx.destination);
      if (pendingAmbience) setTimeout(() => startCityAmbience(pendingAmbience), 0);
      return true;
    } catch (e) {
      console.warn('Web Audio not supported');
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ── Core synthesis helpers ──────────────────

  const AUDIO_TRANSITION_PROFILES = Object.freeze({
    district: 1200,
    interior: 1600,
    exploration: 2200,
    combat_enter: 650,
    combat_exit: 1400,
    restore: 900,
  });

  const CITY_DISTRICT_MIXES = Object.freeze({
    covenant_square: { crowd:.09, wind:.034 },
    ash_market: { crowd:.13, wind:.024 },
    cupside_lane: { crowd:.075, wind:.027 },
    temple_quarter: { crowd:.045, wind:.04 },
    crown_watch: { crowd:.032, wind:.056 },
    southward: { crowd:.08, wind:.044 },
    outer_ward: { crowd:.04, wind:.06 },
  });

  const musicOutput = () => musicBuildOutput || masterGain;

  function createOscillator(type, freq, detune = 0) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    return osc;
  }

  function createFilter(type, freq, q = 1) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  function createReverb(seconds = 2, decay = 2) {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = rate * seconds;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const channel = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  function createDelay(time, feedback) {
    const delay = ctx.createDelay(2);
    delay.delayTime.value = time;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    delay.connect(fb);
    fb.connect(delay);
    return { delay, feedback: fb };
  }

  function noise(duration) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  // ── Drone base layer ────────────────────────
  function createDrone(freqs, gainVal, filterFreq = 800) {
    const drones = [];
    freqs.forEach(({ freq, detune = 0 }) => {
      const osc = createOscillator('sawtooth', freq, detune);
      const gain = ctx.createGain();
      gain.gain.value = gainVal;
      const filter = createFilter('lowpass', filterFreq, 0.8);
      const reverb = createReverb(4, 3);
      osc.connect(filter);
      filter.connect(reverb);
      reverb.connect(gain);
      gain.connect(musicOutput());
      osc.start();
      drones.push({ osc, gain, filter });
    });
    return drones;
  }

  // ── Pad layer ───────────────────────────────
  function createPad(freq, gainVal, modRate = 0.1) {
    const osc1 = createOscillator('sine', freq);
    const osc2 = createOscillator('sine', freq * 1.003);
    const lfo = createOscillator('sine', modRate);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = freq * 0.01;
    const gain = ctx.createGain();
    gain.gain.value = gainVal;
    const reverb = createReverb(6, 2);

    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(reverb);
    reverb.connect(musicOutput());

    osc1.start(); osc2.start(); lfo.start();
    return { osc1, osc2, lfo, gain };
  }

  // ── Rhythmic element ─────────────────────────
  function createBell(freq, time, gainVal, output = musicOutput()) {
    const osc = createOscillator('sine', freq);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 2.5);
    osc.connect(gain);
    gain.connect(output);
    osc.start(time);
    osc.stop(time + 2.6);
  }

  function scheduleChimes(notes, bpm, gainVal = 0.08) {
    const interval = 60 / bpm;
    const output = musicOutput();
    let i = 0;
    return setInterval(() => {
      const note = notes[Math.floor(Math.random() * notes.length)];
      createBell(note, ctx.currentTime, gainVal, output);
      i++;
    }, interval * 2000 + Math.random() * 3000);
  }

  // ── Low rumble / tension ─────────────────────
  function createRumble(freq = 40, gainVal = 0.04) {
    const n = noise(4);
    const filter = createFilter('bandpass', freq, 4);
    const gain = ctx.createGain();
    gain.gain.value = gainVal;
    const lfo = createOscillator('sine', 0.05);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = gainVal * 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    n.connect(filter);
    filter.connect(gain);
    gain.connect(musicOutput());
    n.loop = true;
    n.start();
    lfo.start();
    return { n, filter, gain, lfo };
  }

  // ── Heartbeat pulse ──────────────────────────
  function createHeartbeat(bpm = 60, gainVal = 0.1) {
    const interval = (60 / bpm) * 1000;
    const output = musicOutput();
    let phase = 0;

    function beat() {
      const now = ctx.currentTime;
      const osc = createOscillator('sine', phase === 0 ? 55 : 40);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(output);
      osc.start(now);
      osc.stop(now + 0.35);
      phase = 1 - phase;
    }

    beat();
    const id = setInterval(beat, interval / 2);
    return { stop: () => clearInterval(id) };
  }

  // ── Medieval acoustic ensemble ───────────────
  // Procedurally performed so every location has offline, royalty-free music.
  const MEDIEVAL_SCORES = Object.freeze({
    city: { bpm: 72, lute: [146.83,174.61,220,261.63,220,196,174.61,164.81], flute: [293.66,349.23,440,392], drum: 8, gain: .72 },
    chapel: { bpm: 54, lute: [130.81,164.81,196,246.94,220,196,164.81,146.83], flute: [523.25,493.88,440,392], drum: 0, gain: .55 },
    tavern: { bpm: 104, lute: [196,246.94,293.66,329.63,293.66,246.94,220,261.63], flute: [392,440,493.88,440], drum: 4, gain: .82 },
    forest: { bpm: 58, lute: [110,130.81,146.83,164.81,146.83,130.81,123.47,110], flute: [261.63,293.66,311.13,293.66], drum: 0, gain: .46 },
    dungeon: { bpm: 46, lute: [82.41,98,110,116.54,110,98,87.31,82.41], flute: [196,185,174.61,164.81], drum: 8, gain: .38 },
    battle: { bpm: 124, lute: [110,130.81,146.83,164.81,146.83,130.81,123.47,130.81], flute: [293.66,311.13,349.23,329.63], drum: 2, gain: .78 },
    boss: { bpm: 82, lute: [73.42,82.41,98,110,103.83,98,82.41,77.78], flute: [233.08,220,207.65,196], drum: 2, gain: .65 },
    village: { bpm: 78, lute: [174.61,220,261.63,293.66,261.63,220,196,220], flute: [349.23,392,440,392], drum: 8, gain: .68 },
    road: { bpm: 92, lute: [146.83,174.61,196,220,196,174.61,164.81,174.61], flute: [293.66,329.63,349.23,329.63], drum: 4, gain: .65 },
    fortress: { bpm: 64, lute: [110,130.81,146.83,164.81,146.83,130.81,123.47,110], flute: [220,261.63,293.66,261.63], drum: 4, gain: .58 },
    wastes: { bpm: 42, lute: [82.41,87.31,103.83,98,92.5,87.31,82.41,77.78], flute: [246.94,233.08,220,207.65], drum: 0, gain: .34 },
  });

  function createLutePluck(freq, time, gainVal = .035, duration = 1.25, output = musicOutput()) {
    const body = createOscillator('triangle', freq);
    const harmonic = createOscillator('sine', freq * 2.01, -3);
    const harmonicGain = ctx.createGain();
    const filter = createFilter('lowpass', 2100, .7);
    const gain = ctx.createGain();
    harmonicGain.gain.value = .24;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainVal, time + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    body.connect(filter);harmonic.connect(harmonicGain);harmonicGain.connect(filter);filter.connect(gain);gain.connect(output);
    body.start(time);harmonic.start(time);body.stop(time + duration + .02);harmonic.stop(time + duration + .02);
  }

  function createWoodenFlute(freq, time, gainVal = .018, duration = 1.7, output = musicOutput()) {
    const voice = createOscillator('sine', freq);
    const breath = createOscillator('triangle', freq * 2, 4);
    const breathGain = ctx.createGain();
    const vibrato = createOscillator('sine', 5.1);
    const vibratoDepth = ctx.createGain();
    const filter = createFilter('lowpass', 1650, .5);
    const gain = ctx.createGain();
    breathGain.gain.value = .09;vibratoDepth.gain.value = freq * .006;
    vibrato.connect(vibratoDepth);vibratoDepth.connect(voice.frequency);
    gain.gain.setValueAtTime(.0001, time);gain.gain.linearRampToValueAtTime(gainVal, time + .16);gain.gain.setValueAtTime(gainVal, time + Math.max(.2, duration - .22));gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    voice.connect(filter);breath.connect(breathGain);breathGain.connect(filter);filter.connect(gain);gain.connect(output);
    voice.start(time);breath.start(time);vibrato.start(time);voice.stop(time + duration + .03);breath.stop(time + duration + .03);vibrato.stop(time + duration + .03);
  }

  function createFrameDrum(time, gainVal = .035, accent = false, output = musicOutput()) {
    const duration = accent ? .22 : .14;
    const skin = noise(duration);
    const filter = createFilter('lowpass', accent ? 520 : 720, .8);
    const gain = ctx.createGain();
    const body = createOscillator('sine', accent ? 95 : 125);
    const bodyGain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, time);gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    body.frequency.exponentialRampToValueAtTime(accent ? 48 : 72, time + duration);
    bodyGain.gain.setValueAtTime(gainVal * .85, time);bodyGain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    skin.connect(filter);filter.connect(gain);gain.connect(output);body.connect(bodyGain);bodyGain.connect(output);
    skin.start(time);skin.stop(time + duration + .01);body.start(time);body.stop(time + duration + .02);
  }

  function createMedievalEnsemble(scoreId) {
    const score = MEDIEVAL_SCORES[scoreId] || MEDIEVAL_SCORES.city;
    const output = musicOutput();
    const beatMs = 60000 / score.bpm;
    let step = 0;
    let active = true;
    const perform = () => {
      if (!active || !ctx || ctx.state !== 'running') return;
      const time = ctx.currentTime + .025;
      const index = step % score.lute.length;
      createLutePluck(score.lute[index], time, .035 * score.gain, Math.min(1.35, beatMs / 1000 * 1.45), output);
      if (step % 4 === 0 && score.flute?.length) createWoodenFlute(score.flute[(step / 4) % score.flute.length | 0], time + .035, .018 * score.gain, Math.max(1.1, beatMs / 1000 * 2.5), output);
      if (score.drum && step % score.drum === 0) createFrameDrum(time, .038 * score.gain, step % (score.drum * 2) === 0, output);
      step++;
    };
    perform();
    const timer = setInterval(perform, beatMs);
    return { stop: () => { active = false; clearInterval(timer); } };
  }

  function addMedievalScore(nodes, scoreId) {
    nodes.medieval = createMedievalEnsemble(scoreId);
  }

  // ── Track definitions ────────────────────────

  const TRACKS = {
    city_tense: (nodes) => {
      // Moody city — low drones, distant bells, tension undercurrent
      nodes.drones = createDrone([
        { freq: 55, detune: 0 }, { freq: 55, detune: 7 },
        { freq: 82, detune: -4 }
      ], 0.03, 600);
      nodes.pad = createPad(110, 0.025, 0.07);
      nodes.pad2 = createPad(165, 0.015, 0.13);
      // D minor-ish bells
      nodes.chimes = scheduleChimes([293.66, 261.63, 349.23, 329.63, 220], 20, 0.05);
      nodes.rumble = createRumble(60, 0.03);
      addMedievalScore(nodes, 'city');
    },

    holy_ominous: (nodes) => {
      // Cathedral — high pads, eerie harmony
      nodes.pad = createPad(220, 0.04, 0.04);
      nodes.pad2 = createPad(293.66, 0.03, 0.06);
      nodes.pad3 = createPad(164.81, 0.025, 0.03);
      // Occasional high chimes
      nodes.chimes = scheduleChimes([880, 659.25, 783.99, 987.77], 12, 0.04);
      nodes.reverb_drone = createDrone([{ freq: 110, detune: 5 }], 0.025, 1200);
      addMedievalScore(nodes, 'chapel');
    },

    tavern_low: (nodes) => {
      // Warm tavern — low hum, a distant lute-like pluck, murmur of voices implied
      nodes.drones = createDrone([
        { freq: 65.41, detune: 0 }, { freq: 65.41, detune: 5 }
      ], 0.022, 800);
      nodes.pad = createPad(130.81, 0.018, 0.12);
      nodes.pad2 = createPad(196, 0.012, 0.08);
      // Warm, slow, slightly irregular plucks — like a lute
      nodes.chimes = scheduleChimes([261.63, 293.66, 329.63, 349.23, 392, 329.63], 6, 0.045);
      nodes.rumble = createRumble(55, 0.012); // low hearth hum
      addMedievalScore(nodes, 'tavern');
    },

    forest_dread: (nodes) => {
      // Thornwood — unsettling, alive, breathing
      nodes.drones = createDrone([
        { freq: 41, detune: 0 }, { freq: 55, detune: 10 }
      ], 0.035, 500);
      nodes.pad = createPad(82.41, 0.03, 0.15);
      nodes.rumble = createRumble(80, 0.04);
      nodes.heartbeat = createHeartbeat(50, 0.06);
      // Dissonant intervals
      nodes.chimes = scheduleChimes([174.61, 185, 196, 207.65], 8, 0.04);
      addMedievalScore(nodes, 'forest');
    },

    dungeon_horror: (nodes) => {
      // Deep darkness — slow heartbeat, very low drones, silence punctuated
      nodes.drones = createDrone([
        { freq: 27.5, detune: 0 }, { freq: 36.71, detune: 15 }
      ], 0.04, 300);
      nodes.rumble = createRumble(35, 0.05);
      nodes.heartbeat = createHeartbeat(44, 0.08);
      nodes.pad = createPad(55, 0.02, 0.08);
      addMedievalScore(nodes, 'dungeon');
    },

    combat: (nodes) => {
      // Fast, aggressive, percussive tension
      nodes.drones = createDrone([
        { freq: 55, detune: 0 }, { freq: 73.42, detune: 5 }
      ], 0.06, 1200);
      nodes.rumble = createRumble(100, 0.07);
      nodes.heartbeat = createHeartbeat(120, 0.12);
      // Urgent chimes
      nodes.chimes = scheduleChimes([220, 246.94, 261.63, 196], 60, 0.07);
      addMedievalScore(nodes, 'battle');
    },

    boss_ancient: (nodes) => {
      // The Shattered God — massive, oppressive, holy and dark at once
      nodes.drones = createDrone([
        { freq: 27.5, detune: 0 }, { freq: 32.7, detune: 8 },
        { freq: 41.2, detune: -6 }, { freq: 55, detune: 3 }
      ], 0.05, 800);
      nodes.pad = createPad(110, 0.04, 0.02);
      nodes.pad2 = createPad(146.83, 0.03, 0.03);
      nodes.rumble = createRumble(30, 0.06);
      nodes.heartbeat = createHeartbeat(80, 0.1);
      // Chaos bells — wrong intervals
      nodes.chimes = scheduleChimes([466.16, 493.88, 415.3, 369.99, 329.63], 15, 0.06);
      addMedievalScore(nodes, 'boss');
    },

    village_uneasy: (nodes) => {
      nodes.drones = createDrone([{ freq: 65.41, detune: 5 }], 0.025, 700);
      nodes.pad = createPad(130.81, 0.025, 0.09);
      nodes.chimes = scheduleChimes([392, 440, 349.23, 329.63], 15, 0.05);
      nodes.rumble = createRumble(70, 0.025);
      addMedievalScore(nodes, 'village');
    },

    road_danger: (nodes) => {
      nodes.drones = createDrone([
        { freq: 49, detune: 0 }, { freq: 65.41, detune: 6 }
      ], 0.03, 800);
      nodes.heartbeat = createHeartbeat(70, 0.07);
      nodes.rumble = createRumble(90, 0.04);
      nodes.chimes = scheduleChimes([196, 220, 185, 174.61], 18, 0.045);
      addMedievalScore(nodes, 'road');
    },

    fortress_somber: (nodes) => {
      nodes.drones = createDrone([
        { freq: 55, detune: 0 }, { freq: 82.41, detune: -8 }
      ], 0.035, 900);
      nodes.pad = createPad(110, 0.03, 0.05);
      nodes.heartbeat = createHeartbeat(55, 0.065);
      nodes.chimes = scheduleChimes([293.66, 277.18, 261.63], 10, 0.055);
      addMedievalScore(nodes, 'fortress');
    },

    wastes_eerie: (nodes) => {
      // The Ashen Fields — almost silent, very wrong
      nodes.drones = createDrone([
        { freq: 41.2, detune: 0 }, { freq: 41.2, detune: 25 }
      ], 0.03, 400);
      nodes.rumble = createRumble(45, 0.05);
      nodes.heartbeat = createHeartbeat(38, 0.09);
      // Near silence with occasional tones
      nodes.chimes = scheduleChimes([466.16, 440, 415.3], 5, 0.035);
      addMedievalScore(nodes, 'wastes');
    },
  };

  // ── Active nodes store ──────────────────────
  let activeNodes = {};

  function stopNodeCollection(nodes = {}) {
    if (nodes.drones) nodes.drones.forEach(d => { try { d.osc.stop(); } catch(e) {} });
    if (nodes.pad) { try { nodes.pad.osc1.stop(); nodes.pad.osc2.stop(); nodes.pad.lfo.stop(); } catch(e) {} }
    if (nodes.pad2) { try { nodes.pad2.osc1.stop(); nodes.pad2.osc2.stop(); nodes.pad2.lfo.stop(); } catch(e) {} }
    if (nodes.pad3) { try { nodes.pad3.osc1.stop(); nodes.pad3.osc2.stop(); nodes.pad3.lfo.stop(); } catch(e) {} }
    if (nodes.reverb_drone) nodes.reverb_drone.forEach(d => { try { d.osc.stop(); } catch(e) {} });
    if (nodes.rumble) { try { nodes.rumble.n.stop(); nodes.rumble.lfo.stop(); } catch(e) {} }
    if (nodes.heartbeat) { try { nodes.heartbeat.stop(); } catch(e) {} }
    if (nodes.chimes) clearInterval(nodes.chimes);
    if (nodes.medieval) { try { nodes.medieval.stop(); } catch(e) {} }
  }

  function updateTransitionDiagnostics() {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root) return;
    if (currentTrackId) root.dataset.audioTrack = currentTrackId;
    else delete root.dataset.audioTrack;
    root.dataset.audioTransition = lastTransitionContext;
    root.dataset.audioFadingTracks = String(fadingTrackInstances.size);
  }

  function createTrackInstance(trackId, initialGain = 1) {
    const track = TRACKS[trackId];
    if (!track || !ctx || !masterGain) return null;
    const bus = ctx.createGain();
    bus.gain.value = initialGain;
    bus.connect(masterGain);
    const nodes = {};
    const previousOutput = musicBuildOutput;
    musicBuildOutput = bus;
    try { track(nodes); }
    finally { musicBuildOutput = previousOutput; }
    return { id:trackId, bus, nodes, disposed:false, cleanupTimer:null };
  }

  function disposeTrackInstance(instance) {
    if (!instance || instance.disposed) return;
    instance.disposed = true;
    if (instance.cleanupTimer) clearTimeout(instance.cleanupTimer);
    stopNodeCollection(instance.nodes);
    try { instance.bus.disconnect(); } catch (e) {}
    fadingTrackInstances.delete(instance);
    if (activeTrackInstance === instance) activeTrackInstance = null;
    updateTransitionDiagnostics();
  }

  function stopAllTracks() {
    if (activeTrackInstance) disposeTrackInstance(activeTrackInstance);
    for (const instance of [...fadingTrackInstances]) disposeTrackInstance(instance);
    activeTrackInstance = null;
    activeNodes = {};
  }

  function holdAudioParam(param, now) {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {
      const value = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
    }
  }

  function play(trackId) {
    if (!enabled || !ctx) return;
    resume();
    if (!TRACKS[trackId] || (currentTrackId === trackId && activeTrackInstance)) return;
    stopGeneration++;
    stopAllTracks();
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(musicVolume, ctx.currentTime);
    activeTrackInstance = createTrackInstance(trackId, 1);
    activeNodes = activeTrackInstance?.nodes || {};
    currentTrackId = activeTrackInstance ? trackId : null;
    lastTransitionContext = 'play';
    updateTransitionDiagnostics();
  }

  function transition(trackId, fadeDuration = 2000) {
    if (!enabled || !ctx) return;
    resume();
    if (!TRACKS[trackId] || (currentTrackId === trackId && activeTrackInstance)) return;
    stopGeneration++;
    const duration = Math.max(0, Number(fadeDuration) || 0);
    if (!activeTrackInstance || duration === 0) { play(trackId); return; }

    const now = ctx.currentTime;
    const outgoing = activeTrackInstance;
    const incoming = createTrackInstance(trackId, 0);
    if (!incoming) return;

    holdAudioParam(outgoing.bus.gain, now);
    outgoing.bus.gain.linearRampToValueAtTime(0, now + duration / 1000);
    incoming.bus.gain.setValueAtTime(0, now);
    incoming.bus.gain.linearRampToValueAtTime(1, now + duration / 1000);
    fadingTrackInstances.add(outgoing);
    outgoing.cleanupTimer = setTimeout(() => disposeTrackInstance(outgoing), duration + 80);

    activeTrackInstance = incoming;
    activeNodes = incoming.nodes;
    currentTrackId = trackId;
    updateTransitionDiagnostics();
  }

  function transitionForContext(trackId, context = 'exploration') {
    lastTransitionContext = AUDIO_TRANSITION_PROFILES[context] ? context : 'exploration';
    transition(trackId, AUDIO_TRANSITION_PROFILES[lastTransitionContext]);
    updateTransitionDiagnostics();
  }

  function contextForLocation(location = {}) {
    const type = String(location.type || '').toLowerCase();
    const id = String(location.id || '').toLowerCase();
    if (type === 'tavern' || type === 'dungeon' || location.lightLevel || /(cellar|archive|crypt|interior|scriptorium|inn|tavern)/.test(id)) return 'interior';
    return 'exploration';
  }

  function stop() {
    if (!ctx) return;
    const generation=++stopGeneration;
    const instances = [activeTrackInstance, ...fadingTrackInstances].filter(Boolean);
    for (const instance of instances) {
      holdAudioParam(instance.bus.gain, ctx.currentTime);
      instance.bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }
    setTimeout(()=>{if(generation===stopGeneration)stopAllTracks();},1080);
    currentTrackId = null;
    lastTransitionContext = 'stop';
    updateTransitionDiagnostics();
  }

  function setVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    if (masterGain && enabled) masterGain.gain.value = musicVolume;
    if (sfxGain && enabled) sfxGain.gain.value = sfxVolume * (musicVolume / 0.35);
    try { localStorage.setItem('ss_music_volume', String(musicVolume)); } catch (e) {}
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem('ss_music_muted', enabled ? '0' : '1'); } catch (e) {}
    if (sfxGain) sfxGain.gain.value = enabled ? sfxVolume * (musicVolume / 0.35) : 0;
    if (!enabled) stop();
    else play(currentTrackId || 'city_tense');
    return enabled;
  }

  // ── Sound Effects ────────────────────────────

  function sfx_dice() {
    if (!ctx || !enabled) return;
    resume();
    const now = ctx.currentTime;
    // Rattle of dice — series of short noise bursts
    for (let i = 0; i < 4; i++) {
      const n = noise(0.08);
      const filter = createFilter('bandpass', 800 + Math.random() * 400, 6);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(sfxVolume * 0.4, now + i * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.08);
      n.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      n.start(now + i * 0.06);
      n.stop(now + i * 0.06 + 0.09);
    }
  }

  function sfx_holy() {
    if (!ctx || !enabled) return;
    resume();
    const now = ctx.currentTime;
    [880, 1108.73, 1318.51, 1760].forEach((freq, i) => {
      const osc = createOscillator('sine', freq);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.07);
      gain.gain.linearRampToValueAtTime(sfxVolume * 0.15, now + i * 0.07 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.8);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.85);
    });
  }

  function sfx_dark() {
    if (!ctx || !enabled) return;
    resume();
    const now = ctx.currentTime;
    [55, 41.2, 32.7].forEach((freq, i) => {
      const osc = createOscillator('sawtooth', freq);
      const filter = createFilter('lowpass', 200, 5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(sfxVolume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 1.6);
    });
  }

  function sfx_sword() {
    if (!ctx || !enabled) return;
    resume();
    const now = ctx.currentTime;
    // Metal clash — sharp transient + ring
    const n = noise(0.05);
    const filter = createFilter('highpass', 3000, 8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(sfxVolume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    n.connect(filter);
    filter.connect(gain);
    gain.connect(sfxGain);
    n.start(now);
    n.stop(now + 0.45);

    // Ring out
    const ring = createOscillator('triangle', 1800 + Math.random() * 400);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(sfxVolume * 0.08, now + 0.01);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    ring.connect(ringGain);
    ringGain.connect(sfxGain);
    ring.start(now + 0.01);
    ring.stop(now + 1.3);
  }

  function sfx_levelup() {
    if (!ctx || !enabled) return;
    resume();
    const now = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.5];
    melody.forEach((freq, i) => {
      const osc = createOscillator('triangle', freq);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(sfxVolume * 0.2, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.5);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.55);
    });
  }

  function sfx_page() {
    if (!ctx || !enabled) return;
    resume();
    const now = ctx.currentTime;
    const osc = createOscillator('sine', 440);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(sfxVolume * 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function sfx_travel() {
    if (!ctx || !enabled) return;
    resume();
    // Whoosh + distant bell
    sfx_page();
    setTimeout(() => createBell(440, ctx.currentTime, 0.1), 300);
  }

  function cityEmitterActive(config, hour) {
    const [start=0,end=24] = config.activeHours || [];
    const value = ((Number(hour) || 0) % 24 + 24) % 24;
    if (start === end || (start === 0 && end === 24)) return true;
    return start < end ? value >= start && value < end : value >= start || value < end;
  }

  function spatialTone(record, frequencies, duration=.35, volume=.08, type='triangle', delay=0) {
    if (!ctx || !cityAmbience || !enabled) return;
    const now=ctx.currentTime+delay;
    frequencies.forEach((frequency,index)=>{
      const osc=createOscillator(type,frequency,index*2),gain=ctx.createGain();
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume/(1+index*.4),now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.connect(gain);gain.connect(record.input);osc.start(now);osc.stop(now+duration+.03);
    });
  }

  function spatialNoise(record, duration=.16, volume=.07, filterType='bandpass', frequency=650, delay=0) {
    if (!ctx || !cityAmbience || !enabled) return;
    const now=ctx.currentTime+delay,source=noise(duration),filter=createFilter(filterType,frequency,1.3),gain=ctx.createGain();
    gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);source.connect(filter);filter.connect(gain);gain.connect(record.input);source.start(now);source.stop(now+duration+.02);
  }

  function spatialGlide(record, startFrequency, endFrequency, duration=.75, volume=.055, delay=0) {
    if (!ctx || !cityAmbience || !enabled) return;
    const now=ctx.currentTime+delay,osc=createOscillator('triangle',startFrequency),gain=ctx.createGain(),filter=createFilter('lowpass',1200,.6);
    osc.frequency.exponentialRampToValueAtTime(endFrequency,now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(volume,now+.08);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(filter);filter.connect(gain);gain.connect(record.input);osc.start(now);osc.stop(now+duration+.03);
  }

  function triggerCityEmitter(record) {
    if (!record.active || !enabled || !cityAmbience) return;
    switch(record.config.kind) {
      case 'smithy':
        spatialNoise(record,.075,.13,'highpass',2100);spatialTone(record,[620,930,1510],.62,.085,'sine');spatialNoise(record,.065,.1,'highpass',2400,.42);spatialTone(record,[690,1035],.5,.065,'sine',.42);break;
      case 'bells':
        spatialTone(record,[196,293.66,392,587.33],3.8,.115,'sine');spatialTone(record,[220,440,660],2.8,.06,'sine',.16);break;
      case 'market':
        spatialGlide(record,185,235,.58,.045);spatialGlide(record,220,178,.48,.038,.72);spatialNoise(record,.22,.045,'bandpass',520,.18);break;
      case 'tavern':
        spatialNoise(record,.55,.055,'bandpass',430);spatialGlide(record,210,260,.32,.028,.08);spatialTone(record,[880,1320],.42,.035,'sine',.48);break;
      case 'animals':
        spatialGlide(record,185,520,.85,.07);spatialGlide(record,500,235,.7,.052,.75);spatialNoise(record,.09,.065,'lowpass',420,1.65);spatialNoise(record,.09,.055,'lowpass',420,1.92);break;
      case 'guards':
        spatialNoise(record,.11,.075,'lowpass',330);spatialNoise(record,.11,.065,'lowpass',330,.46);spatialTone(record,[740],.32,.024,'sine',.9);break;
      default:
        spatialGlide(record,160,205,.42,.026);spatialNoise(record,.28,.035,'bandpass',380,.25);break;
    }
  }

  function makeSpatialLoop(record, filterType, frequency, volume, sources) {
    const source=noise(4),filter=createFilter(filterType,frequency,.75),gain=ctx.createGain();source.loop=true;gain.gain.value=volume;source.connect(filter);filter.connect(gain);gain.connect(record.input);source.start();sources.push(source);return gain;
  }

  function createCityEmitter(config, cityGain, sources, timers, index) {
    const panner=ctx.createPanner(),input=ctx.createGain(),[x=0,y=1.5,z=0]=config.position||[];
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=config.refDistance||3;panner.maxDistance=config.maxDistance||22;panner.rolloffFactor=1.15;panner.coneInnerAngle=360;panner.coneOuterAngle=360;
    if(panner.positionX){panner.positionX.value=x;panner.positionY.value=y;panner.positionZ.value=z;}else panner.setPosition(x,y,z);
    input.gain.value=0;input.connect(panner);panner.connect(cityGain);
    const record={config,input,panner,active:false};
    if(config.kind==='crowd')record.loop=makeSpatialLoop(record,'bandpass',330,.13,sources);
    if(config.kind==='market')record.loop=makeSpatialLoop(record,'bandpass',430,.11,sources);
    if(config.kind==='tavern')record.loop=makeSpatialLoop(record,'bandpass',280,.09,sources);
    timers.push(setTimeout(()=>triggerCityEmitter(record),900+index*520));
    timers.push(setInterval(()=>triggerCityEmitter(record),config.interval||8000));
    return record;
  }

  function disposeCityAmbience(ambience) {
    if (!ambience || ambience.disposed) return;
    ambience.disposed=true;
    for (const source of ambience.sources) { try { source.stop(); } catch (e) {} }
    for (const timer of ambience.timers) { clearInterval(timer);clearTimeout(timer); }
    if(ambience.disposeTimer)clearTimeout(ambience.disposeTimer);
    for (const emitter of ambience.emitters || []) { try { emitter.input.disconnect();emitter.panner.disconnect(); } catch (e) {} }
    try { ambience.gain.disconnect(); } catch (e) {}
  }

  function stopCityAmbience({fadeMs=1200,immediate=false}={}) {
    if (!cityAmbience) return;
    const ambience=cityAmbience;cityAmbience=null;
    for(const timer of ambience.timers){clearInterval(timer);clearTimeout(timer);}ambience.timers=[];
    if(!ctx||immediate||fadeMs<=0){disposeCityAmbience(ambience);return;}
    const now=ctx.currentTime,duration=Math.max(0,fadeMs)/1000;
    holdAudioParam(ambience.gain.gain,now);ambience.gain.gain.linearRampToValueAtTime(0,now+duration);
    ambience.disposeTimer=setTimeout(()=>disposeCityAmbience(ambience),fadeMs+80);
  }

  function ambiencePulse(frequency = 900, duration = .12, volume = .025) {
    if (!ctx || !cityAmbience || !enabled) return;
    const now=ctx.currentTime,osc=createOscillator('triangle',frequency),gain=ctx.createGain();gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(cityAmbience.gain);osc.start(now);osc.stop(now+duration+.02);
  }

  function startCityAmbience(options = {}) {
    pendingAmbience={...pendingAmbience,...options};
    if (!ctx || pendingAmbience.zoneId !== 'vaelthar_city') { if (pendingAmbience.zoneId && pendingAmbience.zoneId !== 'vaelthar_city') stopCityAmbience(); return; }
    if (cityAmbience) { updateCityAmbience(pendingAmbience); return; }
    resume();const gain=ctx.createGain();gain.gain.value=0;gain.connect(sfxGain);const sources=[],timers=[];
    const makeLoop=(filterType,frequency,volume)=>{const seconds=3,buffer=ctx.createBuffer(1,ctx.sampleRate*seconds,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(.35+.65*Math.sin(i*.00017)**2);const source=ctx.createBufferSource(),filter=createFilter(filterType,frequency,.7),layerGain=ctx.createGain();source.buffer=buffer;source.loop=true;layerGain.gain.value=volume;source.connect(filter);filter.connect(layerGain);layerGain.connect(gain);source.start();sources.push(source);return layerGain;};
    const crowd=makeLoop('bandpass',310,.11),wind=makeLoop('lowpass',720,.045),rain=makeLoop('highpass',1800,0);
    timers.push(setInterval(()=>ambiencePulse(760+Math.random()*180,.09,.018),4300));
    timers.push(setInterval(()=>{ambiencePulse(155,.18,.026);setTimeout(()=>ambiencePulse(210,.14,.018),115);},7900));
    timers.push(setInterval(()=>ambiencePulse(440,.95,.028),17000));
    const emitters=(pendingAmbience.emitters||[]).map((config,index)=>createCityEmitter(config,gain,sources,timers,index));
    cityAmbience={gain,sources,timers,crowd,wind,rain,emitters,disposed:false};updateCityAmbience(pendingAmbience);if(pendingCityListener)updateCityListener(pendingCityListener);
  }

  function updateCityAmbience({hour=10,weather='clear',zoneId='vaelthar_city',districtId=pendingAmbience?.districtId||'covenant_square'}={}) {
    pendingAmbience={...pendingAmbience,hour,weather,zoneId,districtId};if(zoneId!=='vaelthar_city'){stopCityAmbience();return;}if(!cityAmbience){if(ctx)startCityAmbience(pendingAmbience);return;}
    const day=hour>=6&&hour<21,now=ctx.currentTime,mix=CITY_DISTRICT_MIXES[districtId]||CITY_DISTRICT_MIXES.outer_ward,nightFactor=day?1:.25;
    cityAmbience.gain.gain.setTargetAtTime(enabled?.25:0,now,.42);cityAmbience.crowd.gain.setTargetAtTime(mix.crowd*nightFactor,now,.7);cityAmbience.wind.gain.setTargetAtTime(weather==='rain'?Math.max(.095,mix.wind*1.5):mix.wind,now,.7);cityAmbience.rain.gain.setTargetAtTime(weather==='rain'?.12:0,now,.4);
    for(const emitter of cityAmbience.emitters||[]){emitter.active=cityEmitterActive(emitter.config,hour);const weatherFactor=weather==='rain'&&['crowd','market','animals'].includes(emitter.config.kind)?.62:1;const target=emitter.active&&enabled?(emitter.config.volume||.35)*weatherFactor:0;emitter.input.gain.setTargetAtTime(target,now,.45);}
  }

  function updateCityDistrict(districtId='outer_ward') {
    const next=CITY_DISTRICT_MIXES[districtId]?districtId:'outer_ward';
    if(pendingAmbience?.districtId===next)return;
    lastTransitionContext='district';
    updateCityAmbience({...pendingAmbience,districtId:next});
    updateTransitionDiagnostics();
  }

  function updateCityListener({position=[0,0,0],forward=[0,0,-1],up=[0,1,0]}={}) {
    pendingCityListener={position:[...position],forward:[...forward],up:[...up]};if(!ctx)return;
    const listener=ctx.listener,now=ctx.currentTime,set=(param,value)=>param?.setTargetAtTime(value,now,.025);
    if(listener.positionX){set(listener.positionX,position[0]||0);set(listener.positionY,position[1]||0);set(listener.positionZ,position[2]||0);set(listener.forwardX,forward[0]||0);set(listener.forwardY,forward[1]||0);set(listener.forwardZ,forward[2]??-1);set(listener.upX,up[0]||0);set(listener.upY,up[1]??1);set(listener.upZ,up[2]||0);}
    else {listener.setPosition(position[0]||0,position[1]||0,position[2]||0);listener.setOrientation(forward[0]||0,forward[1]||0,forward[2]??-1,up[0]||0,up[1]??1,up[2]||0);}
  }

  function getCitySoundscapeState() {
    return {active:!!cityAmbience,zoneId:pendingAmbience?.zoneId||null,districtId:pendingAmbience?.districtId||null,listener:pendingCityListener?{...pendingCityListener}:null,emitters:(cityAmbience?.emitters||[]).map(({config,active})=>({id:config.id,kind:config.kind,active}))};
  }

  function getAudioTransitionState() {
    return {trackId:currentTrackId,context:lastTransitionContext,fadingTrackIds:[...fadingTrackInstances].map(instance=>instance.id),profileMs:AUDIO_TRANSITION_PROFILES[lastTransitionContext]||null};
  }

  return {
    init, play, transition, transitionForContext, contextForLocation, stop, toggle, setVolume,startCityAmbience,updateCityAmbience,updateCityDistrict,updateCityListener,stopCityAmbience,
    sfx: { dice: sfx_dice, holy: sfx_holy, dark: sfx_dark, sword: sfx_sword, levelup: sfx_levelup, page: sfx_page, travel: sfx_travel },
    isEnabled: () => enabled,
    getTrackId: () => currentTrackId,
    getVolume: () => musicVolume,
    getCitySoundscapeState,getAudioTransitionState,
  };
})();

// Export so the ~20 guarded `window.AudioEngine` call sites work
window.AudioEngine = AudioEngine;

// Initialize on first user interaction
let audioInitialized = false;
function initAudioOnInteraction() {
  if (!audioInitialized) {
    audioInitialized = AudioEngine.init();
  }
  if (audioInitialized && !AudioEngine.getTrackId() && document.getElementById('game-screen')?.classList.contains('active')) {
    const trackId = window.WORLD_LOCATIONS?.[window.mapState?.currentLocation]?.music || 'city_tense';
    const trackName = document.getElementById('music-track-name')?.textContent || 'The Chronicle Score';
    if (typeof startGameMusic === 'function') startGameMusic(trackId, trackName);
    else AudioEngine.play(trackId);
  }
  if (audioInitialized && !initAudioOnInteraction.reported) {
    initAudioOnInteraction.reported = true;
    console.log('🎵 Audio engine initialized');
  }
}

document.addEventListener('click', initAudioOnInteraction, { once: false });
document.addEventListener('keydown', initAudioOnInteraction, { once: false });
