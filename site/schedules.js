// ═══════════════════════════════════════════════════════════
//  SANCTUM & SHADOW — NPC SCHEDULE SYSTEM
//  Each NPC has time-based states: where they are, their
//  mood, what they'll discuss, and what the player sees
//  when they try to find them at the wrong time.
// ═══════════════════════════════════════════════════════════

// ─── TIME BANDS ──────────────────────────────────────────
// dawn 5-7, morning 8-11, afternoon 12-16, dusk 17-19,
// night 20-23, deep_night 0-4
function getTimeBand() {
  const h = window.worldClock?.hour ?? 8;
  if (h >= 5  && h < 8)  return 'dawn';
  if (h >= 8  && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'dusk';
  if (h >= 20 && h < 24) return 'night';
  return 'deep_night';
}

// ─── NPC SCHEDULES ───────────────────────────────────────
// Each entry: location, mood, available topics, absent text
const NPC_SCHEDULES = {

  captain_rhael: {
    dawn: {
      location: 'vaelthar_city',
      locationName: 'the Watch barracks, reviewing overnight reports',
      mood: 'exhausted',
      moodDesc: 'Rhael has been awake since before first light. He\'s running on bitter tea and bad news. He\'s shorter than usual and has no patience for anything that isn\'t essential.',
      available: ['night_incidents', 'archive_status', 'urgent_business'],
      absentText: null, // always findable at dawn, just in barracks
    },
    morning: {
      location: 'vaelthar_city',
      locationName: 'the market square on his morning patrol',
      mood: 'alert',
      moodDesc: 'Rhael is on patrol, walking a fixed route through the market. He\'s watchful and professional. He will stop to talk but keeps scanning the street over your shoulder.',
      available: ['all'],
      absentText: null,
    },
    afternoon: {
      location: 'vaelthar_city',
      locationName: 'the Watch headquarters',
      mood: 'focused',
      moodDesc: 'Rhael is at his desk, dealing with the day\'s reports. He is businesslike and will give you his full attention if you have something worth hearing.',
      available: ['all'],
      absentText: null,
    },
    dusk: {
      location: 'vaelthar_city',
      locationName: 'the East Gate, overseeing the gate closing',
      mood: 'tense',
      moodDesc: 'Rhael personally oversees the gate closing since the Covenant broke. He is on edge — this is when trouble happens. He\'ll talk but he\'s watching the gate more than you.',
      available: ['gate_status', 'urgent_business', 'threats'],
      absentText: null,
    },
    night: {
      location: 'tarnished_cup',
      locationName: 'The Tarnished Cup tavern, off-duty',
      mood: 'guarded_off_duty',
      moodDesc: 'Rhael is off duty, drinking alone at the bar. He\'s not in uniform. He does NOT want to discuss Watch business here — this is the one hour a day that is his. He is more human here than anywhere else, but also more defensive about it.',
      available: ['personal', 'rumors', 'off_the_record'],
      locked: ['official_business', 'arrest_orders'],
      lockedResponse: 'He sets his cup down slowly. "I am off duty. Come to the barracks in the morning."',
    },
    deep_night: {
      location: null, // not findable
      locationName: 'his quarters, asleep',
      mood: 'asleep',
      moodDesc: null,
      absentText: 'Captain Rhael is not here. At this hour he\'ll be in his quarters in the Watch barracks. You could knock — if it\'s important enough to wake him.',
      emergencyAvailable: true, // can be woken for emergencies
      emergencyText: '*A guard opens a slot in the door. Rhael\'s voice, thick with interrupted sleep.* "This had better be the city burning."',
    },
  },

  trembling_scribe: {
    dawn: {
      location: 'church_archive',
      locationName: 'the Archive steps, where he\'s been since before dawn',
      mood: 'desperate',
      moodDesc: 'Aldis hasn\'t slept. He\'s been on the Archive steps since the sky was still dark, clutching his document roll. He\'s past frightened — he\'s in the hollow calm that comes after a night of terror.',
      available: ['all'],
    },
    morning: {
      location: 'vaelthar_city',
      locationName: 'the market square, trying to look ordinary',
      mood: 'paranoid',
      moodDesc: 'Aldis is moving through the market, pretending to shop. He keeps stopping to check if he\'s being followed. He\'ll flinch when you approach. He\'s chosen a public place deliberately — he thinks it\'s safer.',
      available: ['all'],
    },
    afternoon: {
      location: 'church_archive',
      locationName: 'outside the Archive, waiting',
      mood: 'resigned',
      moodDesc: 'He\'s back at the Archive. He doesn\'t know where else to go. He\'s sitting on the steps eating nothing, just watching the door that won\'t open for him.',
      available: ['all'],
    },
    dusk: {
      location: 'tarnished_cup',
      locationName: 'The Tarnished Cup, in a corner booth',
      mood: 'frightened_drinking',
      moodDesc: 'Aldis has bought a drink he isn\'t finishing. He chose the darkest corner of the tavern. He startles at every door opening. He\'s more willing to talk here — the public setting makes him feel marginally safer — but he speaks barely above a whisper.',
      available: ['all'],
    },
    night: {
      location: 'tarnished_cup',
      locationName: 'The Tarnished Cup, still in the corner',
      mood: 'drunk_and_loose',
      moodDesc: 'Aldis has been drinking since dusk. He\'s not drunk enough to be sloppy but enough to be less careful. He will say things now he would never say sober. His filter is lowered.',
      available: ['all'],
      bonus: 'More willing to reveal sensitive information at night — he\'s had too much wine to be careful.',
    },
    deep_night: {
      location: null,
      locationName: 'wherever he could find shelter — possibly a doorway or a rented room',
      mood: 'hiding',
      absentText: 'The Scribe isn\'t here. At this hour he\'ll have found somewhere to hide for the night. He moves spots every night — he doesn\'t sleep in the same place twice.',
    },
  },

  sister_mourne: {
    dawn: {
      location: 'temple_quarter',
      locationName: 'the Cathedral of the Eternal Flame, at morning prayers',
      mood: 'devout_guarded',
      moodDesc: 'Mourne is at dawn prayers — genuinely, not as performance. She is calmer here than anywhere else. But she is surrounded by other Church members and will NOT discuss anything sensitive. She will suggest you meet elsewhere.',
      available: ['greetings', 'meeting_request'],
      locked: ['covenant', 'document', 'accusations'],
      lockedResponse: '"Not here," she says, barely moving her lips. "The walls in this building hear everything."',
    },
    morning: {
      location: 'temple_quarter',
      locationName: 'the Church administrative offices',
      mood: 'formal_professional',
      moodDesc: 'Mourne is doing Church business — reviewing documents, meeting with junior clergy. She is in her professional mode: precise, controlled, unreadable. She will give you an appointment.',
      available: ['all'],
    },
    afternoon: {
      location: 'vaelthar_city',
      locationName: 'the city, running errands for the Church',
      mood: 'alert_exposed',
      moodDesc: 'Mourne is out in the city — she visits the apothecary, the cartographer, a bookbinder. She is aware she\'s exposed and moves quickly. She will talk but prefers to keep walking — a moving conversation is harder to surveil.',
      available: ['all'],
    },
    dusk: {
      location: 'temple_quarter',
      locationName: 'her private room in the Cathedral compound',
      mood: 'reflective',
      moodDesc: 'Mourne is in her room at dusk — this is when she thinks. She writes letters, burns them, writes again. If you can get to her here it\'s one of the only times she\'s genuinely unguarded. She might say something true.',
      available: ['all'],
      bonus: 'At dusk, Mourne is more reflective and may reveal something she wouldn\'t say in daylight.',
    },
    night: {
      location: 'temple_quarter',
      locationName: 'the Cathedral, at the late office',
      mood: 'closed',
      moodDesc: 'Mourne attends the night office. She\'s not available for conversation — she takes religious observance seriously.',
      available: ['urgent_only'],
      lockedResponse: 'She doesn\'t turn from the altar. "Whatever it is, it waits until morning."',
    },
    deep_night: {
      location: null,
      locationName: 'asleep in the Cathedral compound',
      mood: 'asleep',
      absentText: 'Sister Mourne is not here. The Cathedral gates are locked at this hour. A junior monk guards the door and will not disturb her.',
    },
  },

  bresker: {
    dawn: {
      location: 'vaelthar_city',
      locationName: 'wherever you last camped or stayed, sharpening his sword',
      mood: 'quiet_morning',
      moodDesc: 'Bresker is awake early — habit from years of soldiering. He\'s sharpening his blade, drinking bad coffee, watching the city wake up. He\'s unusually quiet at this hour. Reflective, almost.',
      available: ['all'],
    },
    morning: {
      location: 'vaelthar_city',
      locationName: 'with you, or nearby',
      mood: 'ready',
      moodDesc: 'Bresker is in his default state — alert, practical, a little bored. He\'s ready for whatever the day is.',
      available: ['all'],
    },
    afternoon: {
      location: 'vaelthar_city',
      locationName: 'scouting ahead or gathering information',
      mood: 'focused',
      moodDesc: 'Bresker has been doing his own reconnaissance. He may have information you don\'t. He reports back in his usual laconic style — two sentences where others would use twenty.',
      available: ['all'],
      bonus: 'Bresker may have picked up rumors or tactical information during the afternoon.',
    },
    dusk: {
      location: 'tarnished_cup',
      locationName: 'The Tarnished Cup, getting dinner',
      mood: 'relaxed',
      moodDesc: 'Bresker is eating. He considers this sacred and will talk business over food but with visible reluctance. He eats like a man who\'s missed too many meals in his life.',
      available: ['all'],
    },
    night: {
      location: 'tarnished_cup',
      locationName: 'The Tarnished Cup, drinking',
      mood: 'open',
      moodDesc: 'Bresker drinks steadily but never gets sloppy. At night he\'s more willing to talk about himself — old wounds, old jobs, things he regrets. He\'ll tell you things now that he wouldn\'t in daylight.',
      available: ['all'],
      bonus: 'Bresker opens up at night. Personal conversation, his history, and honest opinions are more accessible.',
    },
    deep_night: {
      location: 'vaelthar_city',
      locationName: 'keeping watch or sleeping light',
      mood: 'vigilant',
      moodDesc: 'Bresker either isn\'t sleeping or is sleeping with one eye open. He\'s always been like this. He\'ll be aware you\'re there before you say anything.',
      available: ['all'],
    },
  },

  vaelthar_guard: {
    dawn: {
      location: 'vaelthar_city',
      locationName: 'the Watch barracks, end of night shift',
      mood: 'tired_going_off_duty',
      moodDesc: 'Fen is finishing his night shift and is exhausted, slightly punchy. He\'ll say things he shouldn\'t because his filter is down from fatigue.',
      available: ['all'],
    },
    morning: {
      location: 'vaelthar_city',
      locationName: 'on patrol near the market gate',
      mood: 'nervous_dutiful',
      moodDesc: 'Fen is on patrol. He\'s trying to look authoritative and mostly failing. He\'ll challenge you first, then be embarrassed about it.',
      available: ['all'],
    },
    afternoon: {
      location: 'vaelthar_city',
      locationName: 'guarding the Archive entrance',
      mood: 'bored_watchful',
      moodDesc: 'Fen has been assigned to the Archive since the lockdown. Standing still for hours has made him chatty — he\'s desperate for someone to talk to.',
      available: ['all'],
      bonus: 'Fen is bored and talkative in the afternoon — easier to get information.',
    },
    dusk: {
      location: 'vaelthar_city',
      locationName: 'the East Gate for gate-closing',
      mood: 'tense_following_orders',
      moodDesc: 'Fen is at the gate closing. He has specific orders and is anxious about following them exactly right. He is easily flustered.',
      available: ['gate_business'],
    },
    night: {
      location: null,
      locationName: 'off duty',
      mood: 'off_duty',
      absentText: 'Guard Fen is off duty at this hour. You could find him at The Tarnished Cup if you needed him badly enough — he drinks there most nights.',
    },
    deep_night: {
      location: 'vaelthar_city',
      locationName: 'night watch patrol',
      mood: 'spooked',
      moodDesc: 'Fen is on night watch and terrified. Every shadow is something. He\'ll challenge you aggressively because he\'s scared.',
      available: ['all'],
    },
  },

};

// ─── GET CURRENT NPC SCHEDULE STATE ──────────────────────
function getNPCSchedule(npcId) {
  const schedule = NPC_SCHEDULES[npcId];
  if (!schedule) return null;
  const band = getTimeBand();
  return schedule[band] || schedule['morning']; // fallback to morning
}

// ─── CHECK IF NPC IS FINDABLE ────────────────────────────
function isNPCPresent(npcId, currentLocationId) {
  const state = getNPCSchedule(npcId);
  if (!state) return { present: true, reason: null }; // no schedule = always present

  // If location is null they're unreachable
  if (state.location === null) {
    return { present: false, reason: state.absentText || `${npcId} is not available at this hour.` };
  }

  // If they have a location and player isn't there
  if (state.location && state.location !== currentLocationId) {
    const band = getTimeBand();
    const time = getTimeOfDay?.() || { name: band, icon: '🕐' };
    return {
      present: false,
      nearbyLocation: state.location,
      reason: `${_getNPCName(npcId)} isn't here. ${time.icon} At ${time.name}, they're at ${state.locationName}.`,
      hint: `You could travel there to find them.`,
    };
  }

  return { present: true, state };
}

function _getNPCName(npcId) {
  const npc = window.NPC_REGISTRY?.[npcId];
  return npc?.name || npcId.replace(/_/g, ' ');
}

// ─── BUILD SCHEDULE CONTEXT FOR SYSTEM PROMPT ───────────
function getSchedulePromptBlock(npcId) {
  const state = getNPCSchedule(npcId);
  if (!state || !state.moodDesc) return '';

  const band = getTimeBand();
  const hour = window.worldClock?.hour ?? 8;
  const timeStr = `${String(hour).padStart(2,'0')}:00`;
  const lines = [];

  lines.push(`TIME & LOCATION: It is ${timeStr} (${band}). You are currently at ${state.locationName}.`);
  lines.push(`CURRENT MOOD: ${state.moodDesc}`);

  if (state.locked?.length) {
    lines.push(`LOCKED TOPICS: Do NOT discuss the following right now — ${state.locked.join(', ')}. If asked about them: "${state.lockedResponse}"`);
  }
  if (state.bonus) {
    lines.push(`SPECIAL CONDITION: ${state.bonus}`);
  }
  if (state.mood === 'asleep' || state.mood === 'deep_night') {
    lines.push(`You were just woken up or disturbed. You are disoriented and irritable. Keep responses very short.`);
  }

  return lines.join('\n');
}

// ─── HOOK INTO startNPCConversation ──────────────────────
// Intercepts conversation starts to check if NPC is present
// and inject schedule context into the prompt
function _hookConversationForSchedules() {
  const _origStart = window.startNPCConversation;
  if (!_origStart) { setTimeout(_hookConversationForSchedules, 600); return; }

  window.startNPCConversation = async function(npcIdOrName, playerOpener) {
    // Resolve NPC id
    const npc = window.NPC_REGISTRY?.[npcIdOrName] ||
      Object.values(window.NPC_REGISTRY || {}).find(n =>
        n.name.toLowerCase().includes((npcIdOrName || '').toLowerCase()) ||
        (n.aliases || []).some(a => a.toLowerCase() === (npcIdOrName || '').toLowerCase())
      );

    if (npc) {
      const locId = window.mapState?.currentLocation || 'vaelthar_city';
      const presence = isNPCPresent(npc.id, locId);

      if (!presence.present) {
        // NPC isn't here — log it and abort conversation
        addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
        addLog(`🔍 ${presence.reason}`, 'narrator');
        if (presence.hint) addLog(`💡 ${presence.hint}`, 'system');
        return;
      }

      // NPC is present — store schedule context for prompt injection
      window._currentNPCScheduleContext = getSchedulePromptBlock(npc.id);
    }

    return _origStart(npcIdOrName, playerOpener);
  };

  console.log('🕐 NPC schedule hook active.');
}

// ─── HOOK INTO SYSTEM PROMPT BUILDER ────────────────────
// getSchedulePromptBlock is called from dialogue.js via
// window.getNPCScheduleContext — injected alongside rep block
window.getNPCScheduleContext = function(npcId) {
  return getSchedulePromptBlock(npcId);
};

window.isNPCPresent   = isNPCPresent;
window.getNPCSchedule = getNPCSchedule;
window.getTimeBand    = getTimeBand;

// ─── VISIBLE "WHERE ARE THEY NOW" LOG ────────────────────
// Called when player opens world map — shows NPC locations
function logNPCLocations() {
  const band = getTimeBand();
  const time = typeof getTimeOfDay === 'function' ? getTimeOfDay() : { icon: '🕐', name: band };
  addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'system');
  addLog(`${time.icon} Known whereabouts at ${time.name}:`, 'system');
  Object.entries(NPC_SCHEDULES).forEach(([id, sched]) => {
    const state = sched[band] || sched['morning'];
    const name  = _getNPCName(id);
    const dead  = window.sceneState?.flags?.['npc_dead_' + id];
    if (dead) {
      addLog(`  ✝ ${name} — deceased`, 'system');
    } else if (state.location === null) {
      addLog(`  🌑 ${name} — ${state.locationName}`, 'system');
    } else {
      addLog(`  📍 ${name} — ${state.locationName}`, 'system');
    }
  });
}
window.logNPCLocations = logNPCLocations;

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(_hookConversationForSchedules, 1200);
});

// Re-hook if showScreen called after load
const _schedOrigShowScreen = window.showScreen;
if (_schedOrigShowScreen) {
  window.showScreen = function(name) {
    _schedOrigShowScreen(name);
    if (name === 'game') setTimeout(_hookConversationForSchedules, 800);
  };
}

console.log('📅 NPC schedule system loaded.');
