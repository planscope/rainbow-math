// The level path: Mila climbs one level at a time. Each level mixes skills.
//   A = adding, no regrouping      B = taking away, no regrouping
//   C = adding with a carried ten  D = taking away with a borrowed ten
//   M = multiplication as equal groups
// mix: [skill, difficulty 1–3]; a skill listed twice comes up twice as often.
// goal: stars (problems solved on her own) needed to climb to the next level.

export const LEVELS = [
  { n: 1, mix: [['A', 1]], goal: 5 },
  { n: 2, mix: [['B', 1], ['B', 1], ['A', 1]], goal: 5 },
  { n: 3, mix: [['A', 2], ['B', 2]], goal: 6 },
  { n: 4, mix: [['C', 1], ['C', 1], ['A', 2], ['B', 2]], goal: 6 },
  { n: 5, mix: [['D', 1], ['D', 1], ['B', 2], ['C', 1]], goal: 6 },
  { n: 6, mix: [['A', 2], ['B', 2], ['C', 2], ['D', 2]], goal: 8 },
  { n: 7, mix: [['M', 1], ['M', 1], ['M', 1], ['C', 2], ['D', 2]], goal: 6 },
  { n: 8, mix: [['C', 2], ['D', 2], ['M', 2], ['M', 2]], goal: 8 },
  { n: 9, mix: [['M', 3], ['M', 3], ['M', 2], ['C', 3], ['D', 3]], goal: 6 },
  { n: 10, mix: [['A', 3], ['B', 3], ['C', 3], ['D', 3], ['M', 3], ['M', 2]], goal: 10 },
];
export const MAX_PATH_LEVEL = LEVELS.length;

const OP = { A: '+', B: '-', C: '+', D: '-', M: '×' };

export const levelInfo = (n) => LEVELS[Math.max(1, Math.min(MAX_PATH_LEVEL, n | 0)) - 1];

// Picks [skill, difficulty] for the next problem on the path.
//   regroupOn: false turns C/D into A/B.  multOn: false turns M into adding/taking away.
//   lastOp: gently alternate so the problems feel mixed.
export function pickFromLevel(n, { rng = Math.random, regroupOn = true, multOn = true, lastOp = null } = {}) {
  const lv = levelInfo(n);
  const options = lv.mix.map(([sk, d], i) => {
    let skill = sk;
    if (!regroupOn && skill === 'C') skill = 'A';
    if (!regroupOn && skill === 'D') skill = 'B';
    if (!multOn && skill === 'M') skill = i % 2 ? 'B' : 'A';
    return [skill, d];
  });
  const fresh = lastOp ? options.filter(([sk]) => OP[sk] !== lastOp) : options;
  const pool = fresh.length && rng() < 0.7 ? fresh : options;
  return pool[Math.floor(rng() * pool.length)];
}

// One problem finished on the path. Returns whether she climbed a level.
export function recordPath(path, independent) {
  const lv = levelInfo(path.level);
  if (!independent) return { leveledUp: false };
  path.stars = (path.stars || 0) + 1;
  if (path.stars >= lv.goal) {
    if (path.level < MAX_PATH_LEVEL) {
      path.level += 1;
      path.stars = 0;
      path.best = Math.max(path.best || 1, path.level);
      return { leveledUp: true, level: path.level };
    }
    path.stars = lv.goal; // top of the path: stays full
  }
  return { leveledUp: false };
}
