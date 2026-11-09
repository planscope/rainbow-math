// Saved data lives only in this browser (localStorage). Every access is
// wrapped so the app still works when storage is blocked.
import { NEXT_SKILL, BASE_SKILL, MAX_LEVEL } from './math.js?v=18';

// Each player (Mila, and classmates who play on this device) has their own saved data.
// Nothing leaves the device: no accounts, no server.
const OLD_KEY = 'mila-rainbow-math-v1';          // before players existed (Mila only)
const PLAYERS_KEY = 'rainbow-math-players-v1';
const playerKey = (id) => `rainbow-math-player-${id}`;
let currentId = null;

const skillStat = () => ({ level: 1, streak: 0, struggle: 0, attempts: 0, independent: 0, helped: 0 });

export function defaults() {
  return {
    version: 1,
    settings: {
      lang: 'en',
      sound: true,
      autoRead: false,
      motion: 'auto', // 'auto' | 'reduce'
      practice: 'choose', // 'choose' | 'path' | 'add' | 'sub' | 'mix' | 'mul'
      regroup: 'auto', // 'off' | 'auto' | 'now'
      sessionLength: 5,
      voice: { en: '', es: '' }, // chosen read-aloud voice per language ('' = best available)
      mult: true, // multiplication levels on the path
      coach: true, // a guide friend points at where to tap next
      coachVoice: true, // ...and says it in a cartoon voice
      coachVoiceKind: 'cartoon', // 'cartoon' (recorded clips) | 'device'
    },
    progress: {
      skills: { A: skillStat(), B: skillStat(), C: skillStat(), D: skillStat(), M: skillStat() },
      unlocked: { C: false, D: false },
      path: { level: 1, stars: 0, best: 1 }, // the level path
      placed: false, // finished the first "what do you know" check
    },
    prizes: [], // real-life prizes a grown-up set: { id, title, icon, goal, won, given }
    rewards: { pieces: 0, friends: [], star: false, awarded: [] },
    sessions: [],
    active: null,
    visits: 0,
  };
}

function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(saved)) {
    const b = base[k], s = saved[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)) out[k] = merge(b, s);
    else if (b === undefined || typeof b === typeof s || b === null) out[k] = s;
  }
  return out;
}

export let storageOK = true;

function readJSON(key) {
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { storageOK = false; return null; }
}
function writeJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); storageOK = true; } catch (e) { storageOK = false; }
}

// ---- players
export function loadPlayers() {
  let list = readJSON(PLAYERS_KEY);
  if (!list || !Array.isArray(list.players)) {
    list = { players: [], last: null };
    // Mila's progress from before players existed becomes her player.
    const old = readJSON(OLD_KEY);
    if (old) {
      list.players.push({ id: 'mila', name: 'Mila', friend: 'fox', pin: null, created: new Date().toISOString() });
      old.progress = old.progress || {};
      old.progress.placed = true; // she already has a level
      writeJSON(playerKey('mila'), old);
      writeJSON(`${OLD_KEY}-backup`, old);
      try { window.localStorage.removeItem(OLD_KEY); } catch (e) { /* ignore */ }
    }
    writeJSON(PLAYERS_KEY, list);
  }
  return list;
}
export const savePlayers = (list) => writeJSON(PLAYERS_KEY, list);

export function addPlayer(list, { name, friend, lang }) {
  const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  list.players.push({ id, name, friend, pin: null, created: new Date().toISOString() });
  savePlayers(list);
  const d = defaults();
  if (lang) d.settings.lang = lang;
  writeJSON(playerKey(id), d);
  return id;
}
export function removePlayer(list, id) {
  list.players = list.players.filter((x) => x.id !== id);
  if (list.last === id) list.last = null;
  savePlayers(list);
  try { window.localStorage.removeItem(playerKey(id)); } catch (e) { /* ignore */ }
}

// The PIN is kept as a scrambled fingerprint (SHA-256), never as the 4 digits.
// It only keeps classmates out of each other's progress on a shared device.
export async function pinHash(id, pin) {
  const bytes = new TextEncoder().encode(`rainbow-math:${id}:${pin}`);
  try {
    const d = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let x = 0x811c9dc5;
    for (const b of bytes) { x ^= b; x = Math.imul(x, 0x01000193) >>> 0; }
    return `f${x.toString(16)}`;
  }
}

export function load(id) {
  currentId = id;
  try {
    window.localStorage.setItem(`${PLAYERS_KEY}:probe`, '1');
    window.localStorage.removeItem(`${PLAYERS_KEY}:probe`);
  } catch (e) { storageOK = false; }
  const raw = id ? readJSON(playerKey(id)) : null;
  if (raw && !raw.enFirst) {
    // English is the main language: switch everyone to English once (Spanish stays one tap away).
    raw.enFirst = true;
    raw.settings = { ...(raw.settings || {}), lang: 'en' };
    writeJSON(playerKey(id), raw);
  }
  const d = raw ? merge(defaults(), raw) : defaults();
  d.enFirst = true;
  return d;
}

export function save(data) {
  if (!currentId) return;
  writeJSON(playerKey(currentId), data);
}

// ---------------------------------------------------------------- adaptivity
export function regroupAvailable(data, skill) {
  const r = data.settings.regroup;
  if (r === 'off') return false;
  if (r === 'now') return true;
  return !!data.progress.unlocked[skill];
}

// Picks the skill for the next problem from the chosen practice mode.
export function pickSkill(data, mode, sess, rng = Math.random) {
  if (sess && sess.repeatSkill) return sess.repeatSkill;
  const lines = mode === 'add' ? [['A', 'C']] : mode === 'sub' ? [['B', 'D']] : [['A', 'C'], ['B', 'D']];
  let line = lines[Math.floor(rng() * lines.length)];
  if (mode === 'mix' && sess && sess.lastOp) {
    // gently alternate in mixed mode
    if (rng() < 0.65) line = sess.lastOp === '+' ? ['B', 'D'] : ['A', 'C'];
  }
  const [base, hard] = line;
  if (sess && sess.ease) return base;
  if (!regroupAvailable(data, hard)) return base;
  return rng() < 0.7 ? hard : base;
}

// Records one finished problem. Returns notes for the next problem.
export function recordResult(data, skill, independent) {
  const s = data.progress.skills[skill];
  const note = { levelUp: false, unlocked: null, eased: false };
  s.attempts++;
  if (independent) {
    s.independent++;
    s.streak++;
    s.struggle = 0;
    if (s.streak >= 3) {
      if (s.level < MAX_LEVEL) {
        s.level++;
        note.levelUp = true;
      } else if (NEXT_SKILL[skill] && !data.progress.unlocked[NEXT_SKILL[skill]]) {
        data.progress.unlocked[NEXT_SKILL[skill]] = true;
        if (data.settings.regroup !== 'off') note.unlocked = NEXT_SKILL[skill];
      }
      s.streak = 0;
    }
  } else {
    s.helped++;
    s.streak = 0;
    s.struggle++;
    if (s.struggle >= 2) {
      if (s.level > 1) s.level--;
      s.struggle = 0;
      note.eased = true;
    }
  }
  return note;
}

export { BASE_SKILL };
