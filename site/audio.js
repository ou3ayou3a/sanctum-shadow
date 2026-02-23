// ============================================
//   SANCTUM & SHADOW — AUDIO ENGINE
//   Pure Web Audio API — no external files
// ============================================

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let currentTrack = null;
  let currentTrackId = null;
  let musicVolume = 0.35;
  let sfxVolume = 0.6;
  let enabled = true;

  function init() {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = musicVolume;
      masterGain.connect(ctx.destination);
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
      gain.connect(masterGain);
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
    reverb.connect(masterGain);

    osc1.start(); osc2.start(); lfo.start();
    return { osc1, osc2, lfo, gain };
  }

  // ── Rhythmic element ─────────────────────────
  function createBell(freq, time, gainVal) {
    const osc = createOscillator('sine', freq);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 2.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(time);
    osc.stop(time + 2.6);
  }

  function scheduleChimes(notes, bpm, gainVal = 0.08) {
    const interval = 60 / bpm;
    let i = 0;
    return setInterval(() => {
      const note = notes[Math.floor(Math.random() * notes.length)];
      createBell(note, ctx.currentTime, gainVal);
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
    gain.connect(masterGain);
    n.loop = true;
    n.start();
    lfo.start();
    return { n, filter, gain, lfo };
  }

  // ── Heartbeat pulse ──────────────────────────
  function createHeartbeat(bpm = 60, gainVal = 0.1) {
    const interval = (60 / bpm) * 1000;
    let phase = 0;

    function beat() {
      const now = ctx.currentTime;
      const osc = createOscillator('sine', phase === 0 ? 55 : 40);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainVal, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
      phase = 1 - phase;
    }

    beat();
    const id = setInterval(beat, interval / 2);
    return { stop: () => clearInterval(id) };
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
    },

    holy_ominous: (nodes) => {
      // Cathedral — high pads, eerie harmony
      nodes.pad = createPad(220, 0.04, 0.04);
      nodes.pad2 = createPad(293.66, 0.03, 0.06);
      nodes.pad3 = createPad(164.81, 0.025, 0.03);
      // Occasional high chimes
      nodes.chimes = scheduleChimes([880, 659.25, 783.99, 987.77], 12, 0.04);
      nodes.reverb_drone = createDrone([{ freq: 110, detune: 5 }], 0.025, 1200);
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
    },

    dungeon_horror: (nodes) => {
      // Deep darkness — slow heartbeat, very low drones, silence punctuated
      nodes.drones = createDrone([
        { freq: 27.5, detune: 0 }, { freq: 36.71, detune: 15 }
      ], 0.04, 300);
      nodes.rumble = createRumble(35, 0.05);
      nodes.heartbeat = createHeartbeat(44, 0.08);
      nodes.pad = createPad(55, 0.02, 0.08);
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
    },

    village_uneasy: (nodes) => {
      nodes.drones = createDrone([{ freq: 65.41, detune: 5 }], 0.025, 700);
      nodes.pad = createPad(130.81, 0.025, 0.09);
      nodes.chimes = scheduleChimes([392, 440, 349.23, 329.63], 15, 0.05);
      nodes.rumble = createRumble(70, 0.025);
    },

    road_danger: (nodes) => {
      nodes.drones = createDrone([
        { freq: 49, detune: 0 }, { freq: 65.41, detune: 6 }
      ], 0.03, 800);
      nodes.heartbeat = createHeartbeat(70, 0.07);
      nodes.rumble = createRumble(90, 0.04);
      nodes.chimes = scheduleChimes([196, 220, 185, 174.61], 18, 0.045);
    },

    fortress_somber: (nodes) => {
      nodes.drones = createDrone([
        { freq: 55, detune: 0 }, { freq: 82.41, detune: -8 }
      ], 0.035, 900);
      nodes.pad = createPad(110, 0.03, 0.05);
      nodes.heartbeat = createHeartbeat(55, 0.065);
      nodes.chimes = scheduleChimes([293.66, 277.18, 261.63], 10, 0.055);
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
    },
  };

  // ── Active nodes store ──────────────────────
  let activeNodes = {};

  function stopAllNodes() {
    if (activeNodes.drones) activeNodes.drones.forEach(d => { try { d.osc.stop(); } catch(e) {} });
    if (activeNodes.pad) { try { activeNodes.pad.osc1.stop(); activeNodes.pad.osc2.stop(); activeNodes.pad.lfo.stop(); } catch(e) {} }
    if (activeNodes.pad2) { try { activeNodes.pad2.osc1.stop(); activeNodes.pad2.osc2.stop(); activeNodes.pad2.lfo.stop(); } catch(e) {} }
    if (activeNodes.pad3) { try { activeNodes.pad3.osc1.stop(); activeNodes.pad3.osc2.stop(); activeNodes.pad3.lfo.stop(); } catch(e) {} }
    if (activeNodes.reverb_drone) activeNodes.reverb_drone.forEach(d => { try { d.osc.stop(); } catch(e) {} });
    if (activeNodes.rumble) { try { activeNodes.rumble.n.stop(); activeNodes.rumble.lfo.stop(); } catch(e) {} }
    if (activeNodes.heartbeat) { try { activeNodes.heartbeat.stop(); } catch(e) {} }
    if (activeNodes.chimes) clearInterval(activeNodes.chimes);
    activeNodes = {};
  }

  function play(trackId) {
    if (!enabled || !ctx) return;
    resume();
    if (currentTrackId === trackId) return;
    stopAllNodes();
    currentTrackId = trackId;
    const track = TRACKS[trackId];
    if (!track) return;
    track(activeNodes);
  }

  function transition(trackId, fadeDuration = 2000) {
    if (!enabled || !ctx) return;
    resume();
    if (currentTrackId === trackId) return;

    // Fade out current
    if (masterGain) {
      const currentVol = masterGain.gain.value;
      masterGain.gain.setValueAtTime(currentVol, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeDuration / 1000);
    }

    setTimeout(() => {
      stopAllNodes();
      currentTrackId = trackId;
      if (masterGain) {
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        masterGain.gain.linearRampToValueAtTime(musicVolume, ctx.currentTime + fadeDuration / 1000);
      }
      const track = TRACKS[trackId];
      if (track) track(activeNodes);
    }, fadeDuration);
  }

  function stop() {
    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }
    setTimeout(stopAllNodes, 1100);
    currentTrackId = null;
  }

  function setVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    if (masterGain) masterGain.gain.value = musicVolume;
  }

  function toggle() {
    enabled = !enabled;
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
    n.start(now);
    n.stop(now + 0.45);

    // Ring out
    const ring = createOscillator('triangle', 1800 + Math.random() * 400);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(sfxVolume * 0.08, now + 0.01);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    ring.connect(ringGain);
    ringGain.connect(ctx.destination);
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
      gain.connect(ctx.destination);
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
    gain.connect(ctx.destination);
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

  return {
    init, play, transition, stop, toggle, setVolume,
    sfx: { dice: sfx_dice, holy: sfx_holy, dark: sfx_dark, sword: sfx_sword, levelup: sfx_levelup, page: sfx_page, travel: sfx_travel },
    isEnabled: () => enabled,
    getTrackId: () => currentTrackId,
  };
})();

// Initialize on first user interaction
let audioInitialized = false;
function initAudioOnInteraction() {
  if (audioInitialized) return;
  audioInitialized = AudioEngine.init();
  if (audioInitialized) {
    console.log('🎵 Audio engine initialized');
  }
}

document.addEventListener('click', initAudioOnInteraction, { once: false });
document.addEventListener('keydown', initAudioOnInteraction, { once: false });
