// Luna's world (4–5 years old): math with pictures, all said out loud, answered by tapping.
// Pure logic, no DOM, so it can be tested.
//   count  - how many pictures?            find   - find the number 7
//   more   - which side has more?          add    - 2 ducks and 1 more, how many in all?
//   sub    - 4 balloons, 1 flies away      after  - what comes after 5?   before - before 5?
// Each skill has a top number (5, 10, 15 or 20) that grows along her 30 levels.

const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pickOf = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const OBJECTS = ['star', 'apple', 'duck', 'balloon', 'fish', 'butterfly', 'cupcake', 'flower'];
export const OBJ_EMOJI = {
  star: '⭐', apple: '\u{1F34E}', duck: '\u{1F986}', balloon: '\u{1F388}',
  fish: '\u{1F41F}', butterfly: '\u{1F98B}', cupcake: '\u{1F9C1}', flower: '\u{1F338}',
};

const W1 = [
  [['count', 5]], [['count', 5]], [['find', 5]], [['count', 5], ['find', 5]], [['count', 10], ['find', 5]],
  [['count', 10]], [['find', 10]], [['more', 5]], [['more', 10], ['count', 10]], [['count', 10], ['find', 10], ['more', 10]],
];
const W2 = [
  [['add', 3]], [['add', 5]], [['sub', 5]], [['add', 5], ['sub', 5]], [['add', 5], ['sub', 5], ['count', 10]],
  [['count', 15]], [['find', 20]], [['after', 10]], [['before', 10]], [['add', 5], ['sub', 5], ['after', 10], ['count', 15]],
];
const W3 = [
  [['add', 7]], [['sub', 7]], [['add', 10]], [['sub', 10]], [['add', 10], ['sub', 10], ['after', 20]],
  [['count', 20], ['find', 20]], [['add', 10], ['more', 20]], [['sub', 10], ['before', 20]], [['add', 10], ['sub', 10], ['after', 20]],
  [['add', 10], ['sub', 10], ['count', 20], ['find', 20], ['before', 20]],
];
export const LITTLE_LEVELS = [W1, W2, W3].flatMap((lvls, w) => lvls.map((mix, i) => {
  const n = w * 10 + i + 1;
  return { n, world: w + 1, step: i + 1, mix, goal: 4, gate: n % 5 === 0 };
}));
export const LITTLE_WORLDS = 3;
export const littleWorldOf = (n) => Math.ceil(Math.max(1, Math.min(LITTLE_LEVELS.length, n | 0)) / 10);
export const LITTLE_SKILLS = ['count', 'find', 'more', 'add', 'sub', 'after', 'before'];

// Three (or four) number buttons: the answer and its neighbors, so she has to really count.
function choicesFor(ans, lo, hi, k, rng) {
  const set = new Set([ans]);
  for (const x of shuffle([ans - 1, ans + 1, ans - 2, ans + 2, ans + 3, ans - 3], rng)) {
    if (set.size >= k) break;
    if (x >= lo && x <= hi) set.add(x);
  }
  for (let guard = 0; set.size < k && guard < 50; guard++) set.add(ri(rng, lo, hi));
  return shuffle([...set], rng).sort((a, b) => a - b);
}

// The smallest number for a top number: counting 15 means at least 8 pictures, and so on.
const lowFor = (max) => (max <= 5 ? 1 : max <= 10 ? 3 : max <= 15 ? 8 : 11);

function makeOnce(skill, max, rng) {
  const obj = pickOf(rng, OBJECTS);
  const k = max <= 5 ? 3 : 4;
  if (skill === 'count') {
    const n = ri(rng, lowFor(max), max);
    return { skill, max, obj, n, answer: n, choices: choicesFor(n, 1, Math.max(max, 5), k, rng), key: `count:${n}` };
  }
  if (skill === 'find') {
    const n = ri(rng, max <= 5 ? 1 : 0, max);
    return { skill, max, n, answer: n, choices: choicesFor(n, 0, max, k, rng), key: `find:${n}` };
  }
  if (skill === 'more') {
    const left = ri(rng, 1, max);
    let right = ri(rng, 1, max);
    for (let g = 0; right === left || Math.abs(right - left) > Math.max(2, Math.ceil(max / 3)); g++) {
      right = ri(rng, 1, max);
      if (g > 40) { right = left === 1 ? 2 : left - 1; break; }
    }
    return { skill, max, obj, left, right, answer: left > right ? 'L' : 'R', key: `more:${left}-${right}` };
  }
  if (skill === 'add') {
    const total = ri(rng, 2, max);
    const a = ri(rng, 1, total - 1);
    return { skill, max, obj, a, b: total - a, answer: total, choices: choicesFor(total, 1, max, k, rng), key: `add:${a}+${total - a}` };
  }
  if (skill === 'sub') {
    const a = ri(rng, 2, max);
    const b = ri(rng, 1, a - 1);
    return { skill, max, obj, a, b, answer: a - b, choices: choicesFor(a - b, 0, max, k, rng), key: `sub:${a}-${b}` };
  }
  if (skill === 'after') {
    const n = ri(rng, max <= 10 ? 1 : 5, max - 1);
    return { skill, max, n, answer: n + 1, choices: choicesFor(n + 1, 0, max, k, rng), key: `after:${n}` };
  }
  if (skill === 'before') {
    const n = ri(rng, max <= 10 ? 2 : 6, max);
    return { skill, max, n, answer: n - 1, choices: choicesFor(n - 1, 0, max, k, rng), key: `before:${n}` };
  }
  throw new Error(`Unknown little skill ${skill}`);
}

export function makeLittle(skill, max, rng = Math.random, avoidKeys = []) {
  const avoid = new Set(avoidKeys);
  let p = null;
  for (let i = 0; i < 40; i++) {
    p = makeOnce(skill, max, rng);
    if (!avoid.has(p.key)) return p;
  }
  return p;
}

export function isValidLittle(p) {
  if (!p || !LITTLE_SKILLS.includes(p.skill)) return false;
  if (p.skill === 'more') return p.left !== p.right && p.left >= 1 && p.right >= 1 && p.answer === (p.left > p.right ? 'L' : 'R');
  const ok = Number.isInteger(p.answer) && p.answer >= 0 && p.answer <= 20 && Array.isArray(p.choices) && p.choices.includes(p.answer)
    && new Set(p.choices).size === p.choices.length;
  if (!ok) return false;
  if (p.skill === 'add') return p.a >= 1 && p.b >= 1 && p.a + p.b === p.answer && p.answer <= p.max;
  if (p.skill === 'sub') return p.b >= 1 && p.b < p.a && p.a - p.b === p.answer;
  if (p.skill === 'count') return p.n === p.answer && p.n >= 1;
  return true;
}

// Picks [skill, top number] for her next problem. Quizzes mix the last 5 levels.
export function pickLittle(level, rng = Math.random, quiz = false) {
  const n = Math.max(1, Math.min(LITTLE_LEVELS.length, level | 0));
  const at = quiz ? Math.max(1, n - Math.floor(rng() * 5)) : n;
  const mix = LITTLE_LEVELS[at - 1].mix;
  return pickOf(rng, mix);
}
