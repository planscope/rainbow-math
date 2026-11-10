// The level path: 100 levels in 10 worlds of 10. Each level mixes skills.
//   A = adding, no regrouping      B = taking away, no regrouping
//   C = adding with a carried ten  D = taking away with a borrowed ten
//   M = multiplication (equal groups, rows, then times tables)
// mix: [skill, difficulty]; a skill listed twice comes up twice as often.
//   A–D difficulty 1–3 (bigger numbers), M difficulty 1–6 (see mult.js).
// goal: stars (problems solved on her own) to finish the level.
// gate: every 5th level ends with a quiz; the other levels climb on stars alone.

const WORLDS = [
  // 1. Adding & taking away (no regrouping)
  [[['A', 1]], [['A', 1], ['B', 1]], [['B', 1]], [['A', 1], ['B', 1], ['B', 1]], [['A', 2], ['B', 1]],
    [['A', 2]], [['B', 2]], [['A', 2], ['B', 2]], [['A', 3], ['B', 2]], [['A', 3], ['B', 3]]],
  // 2. Carrying a ten
  [[['C', 1]], [['C', 1], ['A', 2]], [['C', 1], ['B', 2]], [['C', 1], ['C', 2], ['A', 3]], [['C', 2], ['A', 3], ['B', 2]],
    [['C', 2], ['B', 3]], [['C', 3]], [['C', 3], ['A', 3]], [['C', 3], ['B', 3]], [['C', 2], ['C', 3], ['A', 3], ['B', 3]]],
  // 3. Borrowing a ten
  [[['D', 1]], [['D', 1], ['B', 2]], [['D', 1], ['A', 2]], [['D', 1], ['D', 2], ['C', 1]], [['D', 2], ['C', 2], ['B', 3]],
    [['D', 2], ['B', 3]], [['D', 3]], [['D', 3], ['C', 2]], [['D', 3], ['B', 3]], [['D', 3], ['C', 3], ['A', 3], ['B', 3]]],
  // 4. Mixed masters
  [[['C', 2], ['D', 2]], [['C', 2], ['D', 2], ['A', 3]], [['C', 3], ['D', 2]], [['C', 2], ['D', 3]], [['C', 3], ['D', 3], ['B', 3]],
    [['C', 3], ['D', 3]], [['C', 3], ['D', 3], ['A', 3]], [['C', 3], ['D', 3], ['B', 3]], [['C', 3], ['D', 3], ['D', 3]], [['C', 3], ['D', 3], ['A', 3], ['B', 3]]],
  // 5. Equal groups
  [[['M', 1]], [['M', 1], ['A', 3]], [['M', 1], ['B', 3]], [['M', 1], ['C', 2]], [['M', 1], ['D', 2], ['C', 3]],
    [['M', 2]], [['M', 2], ['C', 3]], [['M', 2], ['D', 3]], [['M', 1], ['M', 2], ['C', 3]], [['M', 2], ['C', 3], ['D', 3]]],
  // 6. Groups and rows
  [[['M', 2], ['M', 3]], [['M', 3]], [['M', 3], ['C', 3]], [['M', 3], ['D', 3]], [['M', 2], ['M', 3], ['C', 3], ['D', 3]],
    [['M', 3], ['M', 3], ['A', 3]], [['M', 3], ['B', 3]], [['M', 3], ['C', 3], ['D', 3]], [['M', 2], ['M', 3], ['D', 3]], [['M', 3], ['C', 3], ['D', 3], ['M', 2]]],
  // 7. Times tables: 2, 5 and 10
  [[['M', 4]], [['M', 4], ['M', 3]], [['M', 4], ['C', 3]], [['M', 4], ['D', 3]], [['M', 4], ['M', 3], ['C', 3], ['D', 3]],
    [['M', 4], ['M', 4], ['B', 3]], [['M', 4], ['A', 3]], [['M', 4], ['C', 3], ['D', 3]], [['M', 4], ['M', 4], ['D', 3]], [['M', 4], ['M', 3], ['C', 3], ['D', 3]]],
  // 8. Times tables: 3 and 4
  [[['M', 5]], [['M', 5], ['M', 4]], [['M', 5], ['C', 3]], [['M', 5], ['D', 3]], [['M', 5], ['M', 4], ['C', 3], ['D', 3]],
    [['M', 5], ['M', 5], ['A', 3]], [['M', 5], ['B', 3]], [['M', 5], ['M', 4], ['D', 3]], [['M', 5], ['C', 3], ['D', 3]], [['M', 5], ['M', 4], ['C', 3], ['D', 3]]],
  // 9. Big tables (6, 7, 8, 9)
  [[['M', 6]], [['M', 6], ['M', 5]], [['M', 6], ['C', 3]], [['M', 6], ['D', 3]], [['M', 6], ['M', 5], ['M', 4], ['D', 3]],
    [['M', 6], ['M', 6], ['B', 3]], [['M', 6], ['A', 3]], [['M', 6], ['M', 5], ['C', 3]], [['M', 6], ['C', 3], ['D', 3]], [['M', 6], ['M', 5], ['C', 3], ['D', 3]]],
  // 10. The grand finale: a bit of everything, at its hardest
  [[['C', 3], ['D', 3], ['M', 4]], [['M', 5], ['C', 3], ['D', 3]], [['M', 6], ['C', 3], ['D', 3]], [['M', 4], ['M', 5], ['M', 6]], [['A', 3], ['B', 3], ['C', 3], ['D', 3], ['M', 6]],
    [['M', 6], ['M', 6], ['D', 3]], [['M', 5], ['M', 6], ['C', 3]], [['C', 3], ['D', 3], ['M', 5], ['M', 6]], [['D', 3], ['D', 3], ['M', 6], ['M', 4]], [['A', 3], ['B', 3], ['C', 3], ['D', 3], ['M', 4], ['M', 5], ['M', 6]]],
];
const GOAL_BY_WORLD = [4, 4, 5, 5, 5, 5, 5, 5, 6, 6];

export const LEVELS = WORLDS.flatMap((levels, w) => levels.map((mix, i) => {
  const n = w * 10 + i + 1;
  return { n, world: w + 1, step: i + 1, mix, goal: GOAL_BY_WORLD[w], gate: n % 5 === 0 };
}));
export const MAX_PATH_LEVEL = LEVELS.length;
export const WORLD_COUNT = WORLDS.length;
export const worldOf = (n) => Math.ceil(Math.max(1, Math.min(MAX_PATH_LEVEL, n | 0)) / 10);

const OP = { A: '+', B: '-', C: '+', D: '-', M: '×' };

export const levelInfo = (n, levels = LEVELS) => levels[Math.max(1, Math.min(levels.length, n | 0)) - 1];

// Picks [skill, difficulty] for the next problem on the path.
//   regroupOn: false turns C/D into A/B.  multOn: false turns M into adding/taking away.
//   lastOp: gently alternate so the problems feel mixed.
export function pickFromLevel(n, { rng = Math.random, regroupOn = true, multOn = true, lastOp = null } = {}) {
  const lv = levelInfo(n);
  const options = lv.mix.map(([sk, d], i) => {
    let skill = sk;
    let diff = d;
    if (!regroupOn && skill === 'C') skill = 'A';
    if (!regroupOn && skill === 'D') skill = 'B';
    if (!multOn && skill === 'M') { skill = i % 2 ? 'B' : 'A'; diff = 3; }
    return [skill, diff];
  });
  const fresh = lastOp ? options.filter(([sk]) => OP[sk] !== lastOp) : options;
  const pool = fresh.length && rng() < 0.7 ? fresh : options;
  return pool[Math.floor(rng() * pool.length)];
}

// Quizzes: every 5th level ends with one. Passing it is the only way past that level.
export const QUIZ = { size: 5, pass: 4, bonus: 3, wait: 3 };

// One problem finished on the path (solved on her own or not).
//   leveledUp: stars filled a normal level, so she climbs right away.
//   quizNow: stars filled a quiz level, so the quiz opens.
// `levels` lets Luna's path use the same rules.
export function recordPath(path, independent, levels = LEVELS) {
  const lv = levelInfo(path.level, levels);
  if (!independent) return { quizNow: false, leveledUp: false };
  if ((path.stars || 0) < lv.goal) path.stars = (path.stars || 0) + 1;
  else if (path.quizWait > 0) path.quizWait -= 1; // after a quiz that didn't pass yet
  if (path.champion) return { quizNow: false, leveledUp: false }; // passed the top level: just keep practicing
  if (path.stars >= lv.goal && !lv.gate) {
    const r = passLevel(path, levels);
    return { quizNow: false, ...r };
  }
  const due = lv.gate && path.stars >= lv.goal && !(path.quizWait > 0);
  const quizNow = due && !path.quizDue;
  path.quizDue = due;
  return { quizNow, leveledUp: false };
}

// The level is done (stars, or its quiz): climb, or become champion at the top.
export function passLevel(path, levels = LEVELS) {
  path.quizDue = false;
  path.quizWait = 0;
  if (path.level < levels.length) {
    path.level += 1;
    path.stars = 0;
    path.best = Math.max(path.best || 1, path.level);
    return { leveledUp: true, level: path.level };
  }
  path.champion = true;
  return { leveledUp: false, champion: true };
}

// Not passed yet: practice a few more on her own, then the quiz comes back. Nothing is taken away.
export function failQuiz(path) {
  path.quizDue = false;
  path.quizWait = QUIZ.wait;
}

// The quiz problems: the last 5 levels, plus one from earlier to see if it stuck.
export function quizPlan(level, { rng = Math.random, regroupOn = true, multOn = true, size = QUIZ.size } = {}) {
  const lv = levelInfo(level).n;
  const from = Math.max(1, lv - 4);
  const plan = [];
  let lastOp = null;
  for (let i = 0; i < size; i++) {
    const at = i === 0 ? lv : from + Math.floor(rng() * (lv - from + 1));
    const pick = pickFromLevel(at, { rng, regroupOn, multOn, lastOp });
    plan.push(pick);
    lastOp = OP[pick[0]];
  }
  if (lv > 5) {
    const earlier = 1 + Math.floor(rng() * (from - 1));
    plan[1 + Math.floor(rng() * (size - 1))] = pickFromLevel(earlier, { rng, regroupOn, multOn });
  }
  return plan;
}

// Before 100 levels the path had 10. Each old level starts at the matching new one.
const OLD_TO_NEW = { 1: 1, 2: 3, 3: 7, 4: 11, 5: 21, 6: 31, 7: 41, 8: 51, 9: 56, 10: 91 };
export function migratePath(path) {
  if (!path || path.v === 2) return false;
  path.level = OLD_TO_NEW[path.level] || 1;
  path.stars = 0;
  path.best = Math.max(path.level, OLD_TO_NEW[path.best] || 1);
  path.quizDue = false;
  path.quizWait = 0;
  path.champion = false;
  path.v = 2;
  return true;
}
