// Two devices played with the same student: put both together without losing anything.
// Progress only goes forward (the higher level, more stars, every friend, every quiz).
// Settings come from whichever copy was saved last. No DOM here, so it can be tested.

const pathKey = (p) => (p ? (p.champion ? 1e6 : 0) + (p.level || 1) * 1000 + (p.stars || 0) : 0);

function aheadPath(a, b) {
  if (!a) return b;
  if (!b) return a;
  const win = pathKey(b) > pathKey(a) ? b : a;
  return { ...win, best: Math.max(a.best || 1, b.best || 1, win.level || 1), v: Math.max(a.v || 0, b.v || 0) || win.v };
}

// Lists of finished things (sessions, quizzes): keep each one once, newest first.
function unionByDate(a = [], b = [], cap = 30) {
  const seen = new Map();
  for (const x of [...a, ...b]) {
    if (!x || typeof x !== 'object') continue;
    const k = `${x.date}|${x.mode || ''}|${x.level || ''}`;
    if (!seen.has(k)) seen.set(k, x);
  }
  return [...seen.values()].sort((x, y) => String(y.date).localeCompare(String(x.date))).slice(0, cap);
}

const uniq = (a = [], b = []) => [...new Set([...(a || []), ...(b || [])])];

// Per skill: the copy that has seen more problems knows more about her.
function perKey(a = {}, b = {}, weight) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    if (!(k in out) || weight(b[k]) > weight(out[k])) out[k] = b[k];
  }
  return out;
}

export function mergeData(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const newer = String(remote.savedAt || '') > String(local.savedAt || '') ? remote : local;
  const lp = local.progress || {};
  const rp = remote.progress || {};
  const skills = perKey(lp.skills, rp.skills, (s) => (s && s.attempts) || 0);
  // the guide's step-back goes with the skill copy that was kept
  const fade = {};
  for (const k of Object.keys({ ...(lp.fade || {}), ...(rp.fade || {}) })) {
    const fromRemote = rp.skills && skills[k] === rp.skills[k] && rp.fade && rp.fade[k];
    fade[k] = fromRemote ? rp.fade[k] : (lp.fade && lp.fade[k]) || (rp.fade && rp.fade[k]);
  }
  const unlocked = {};
  for (const k of Object.keys({ ...(lp.unlocked || {}), ...(rp.unlocked || {}) })) unlocked[k] = !!((lp.unlocked || {})[k] || (rp.unlocked || {})[k]);

  const lr = local.rewards || {};
  const rr = remote.rewards || {};
  const prizes = new Map();
  for (const z of [...(local.prizes || []), ...(remote.prizes || [])]) {
    if (!z || !z.id) continue;
    const had = prizes.get(z.id);
    prizes.set(z.id, had ? { ...had, ...z, won: !!(had.won || z.won), given: !!(had.given || z.given) } : z);
  }

  return {
    ...newer,
    settings: { ...(newer === local ? remote.settings : local.settings), ...(newer.settings || {}) },
    progress: {
      ...(rp || {}),
      ...(lp || {}),
      skills,
      fade,
      unlocked,
      path: aheadPath(lp.path, rp.path),
      lpath: aheadPath(lp.lpath, rp.lpath),
      lstats: perKey(lp.lstats, rp.lstats, (s) => (s && s.tries) || 0),
      placed: !!(lp.placed || rp.placed),
    },
    quizzes: unionByDate(local.quizzes, remote.quizzes),
    sessions: unionByDate(local.sessions, remote.sessions),
    prizes: [...prizes.values()],
    rewards: {
      ...rr,
      ...lr,
      pieces: Math.max(lr.pieces || 0, rr.pieces || 0),
      friends: uniq(lr.friends, rr.friends),
      awarded: uniq(lr.awarded, rr.awarded).slice(-80),
      star: !!(lr.star || rr.star),
    },
    // a problem half-done on this device stays here
    active: local.active || null,
    visits: Math.max(local.visits || 0, remote.visits || 0),
    savedAt: newer.savedAt || local.savedAt || remote.savedAt,
  };
}
