// Saved data lives only in this browser (localStorage). Every access is
// wrapped so the app still works when storage is blocked.
import { NEXT_SKILL, BASE_SKILL, MAX_LEVEL } from './math.js?v=10';

const KEY = 'mila-rainbow-math-v1';

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
    },
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

export function load() {
  try {
    const raw = window.localStorage.getItem(KEY);
    // probe writability
    window.localStorage.setItem(KEY + ':probe', '1');
    window.localStorage.removeItem(KEY + ':probe');
    return raw ? merge(defaults(), JSON.parse(raw)) : defaults();
  } catch (e) {
    storageOK = false;
    return defaults();
  }
}

export function save(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    storageOK = true;
  } catch (e) {
    storageOK = false;
  }
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
