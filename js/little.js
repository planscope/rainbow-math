// Luna's world (4–5 years old, already counting by 5s and adding 10s): math with pictures,
// said out loud, answered by tapping. 60 levels in 6 worlds that end where Mila's path begins.
// Pure logic, no DOM, so it can be tested.
//
// Skills ([skill, n] in a level's mix; n is the top number, or the step for skip counting):
//   count  - how many pictures? (to n)          find     - find the number (to n)
//   more   - which side has more?               after / before - the number after / before
//   add / sub   - pictures, within n            double   - 6 + 6, up to n
//   make10 - 7 and how many more make 10?       from10   - 10 take away some
//   skip   - 5, 10, 15, ? (n = the step)        skipTo   - to 100 by 5s or 10s
//   tens   - tens bars and ones: 3 bars + 4 = 34 (to n)
//   addTens / subTens - 30 + 20, 50 − 20        compare  - which number is bigger? (to n)
//   add20 / sub20 - 8 + 5, 13 − 5 (crossing 10)
//   add2 / sub2   - 23 + 4, 37 − 5              plusTens / minusTens - 34 + 20, 56 − 20
//   add22 / sub22 - 23 + 14, 45 − 12 (no carrying or borrowing yet), up to n

const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pickOf = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const tensOf = (n) => Math.floor(n / 10);
const onesOf = (n) => n % 10;

export const OBJECTS = ['star', 'apple', 'duck', 'balloon', 'fish', 'butterfly', 'cupcake', 'flower'];
export const OBJ_EMOJI = {
  star: '⭐', apple: '\u{1F34E}', duck: '\u{1F986}', balloon: '\u{1F388}',
  fish: '\u{1F41F}', butterfly: '\u{1F98B}', cupcake: '\u{1F9C1}', flower: '\u{1F338}',
};

const WORLDS = [
  // 1. Counting (a quick warm-up)
  [[['count', 10]], [['find', 20]], [['more', 10]], [['count', 20], ['find', 20]], [['count', 20], ['more', 20], ['after', 20]],
    [['add', 10]], [['sub', 10]], [['add', 10], ['sub', 10]], [['after', 20], ['before', 20]], [['add', 10], ['sub', 10], ['count', 20], ['after', 20]]],
  // 2. Tens and fives
  [[['skip', 10]], [['skip', 5]], [['tens', 50]], [['addTens', 50]], [['skip', 10], ['skip', 5], ['addTens', 50]],
    [['subTens', 50]], [['skip', 2]], [['tens', 100]], [['addTens', 100], ['subTens', 100]], [['skipTo', 5], ['tens', 100], ['addTens', 100], ['subTens', 100]]],
  // 3. Friends of 10 and doubles
  [[['make10', 10]], [['from10', 10]], [['make10', 10], ['from10', 10]], [['double', 10]], [['make10', 10], ['from10', 10], ['double', 10], ['add', 10]],
    [['double', 20]], [['compare', 50]], [['compare', 100], ['skipTo', 5]], [['make10', 10], ['double', 20]], [['make10', 10], ['from10', 10], ['double', 20], ['compare', 100], ['addTens', 100]]],
  // 4. Teen numbers: crossing 10
  [[['tens', 20]], [['add20', 20]], [['sub20', 20]], [['add20', 20], ['sub20', 20]], [['add20', 20], ['sub20', 20], ['make10', 10], ['double', 20]],
    [['add20', 20], ['double', 20]], [['skip', 2], ['skipTo', 10]], [['add20', 20], ['tens', 100]], [['sub20', 20], ['compare', 100]], [['add20', 20], ['sub20', 20], ['tens', 100], ['skipTo', 5]]],
  // 5. Numbers to 100
  [[['add2', 99]], [['sub2', 99]], [['plusTens', 99]], [['minusTens', 99]], [['add2', 99], ['sub2', 99], ['plusTens', 99], ['minusTens', 99]],
    [['tens', 100], ['compare', 100]], [['add2', 99], ['sub2', 99]], [['plusTens', 99], ['skipTo', 10]], [['plusTens', 99], ['minusTens', 99], ['add20', 20]], [['add2', 99], ['sub2', 99], ['plusTens', 99], ['minusTens', 99], ['sub20', 20]]],
  // 6. Ready for big-kid math: two-digit adding and taking away
  [[['add22', 50]], [['sub22', 50]], [['add22', 99]], [['sub22', 99]], [['add22', 99], ['sub22', 99], ['plusTens', 99]],
    [['add22', 99], ['sub22', 99]], [['add20', 20], ['sub20', 20], ['add22', 99]], [['compare', 100], ['tens', 100], ['sub22', 99]], [['add22', 99], ['sub22', 99], ['minusTens', 99], ['add20', 20]],
    [['add22', 99], ['sub22', 99], ['add20', 20], ['sub20', 20], ['plusTens', 99], ['minusTens', 99]]],
];
const GOAL = [4, 4, 5, 5, 5, 5];

export const LITTLE_LEVELS = WORLDS.flatMap((lvls, w) => lvls.map((mix, i) => {
  const n = w * 10 + i + 1;
  return { n, world: w + 1, step: i + 1, mix, goal: GOAL[w], gate: n % 5 === 0 };
}));
export const LITTLE_WORLDS = WORLDS.length;
export const littleWorldOf = (n) => Math.ceil(Math.max(1, Math.min(LITTLE_LEVELS.length, n | 0)) / 10);
export const LITTLE_SKILLS = ['count', 'find', 'more', 'after', 'before', 'add', 'sub', 'double', 'make10', 'from10', 'skip', 'skipTo',
  'tens', 'addTens', 'subTens', 'compare', 'add20', 'sub20', 'add2', 'sub2', 'plusTens', 'minusTens', 'add22', 'sub22'];
// How a skill is shown: pictures, tens bars, a ten-frame, number cards, or just numbers.
const VIEW = {
  count: 'pics', more: 'more', find: 'find', after: 'track', before: 'track', add: 'pics', sub: 'pics', double: 'pics',
  make10: 'frame', from10: 'pics', skip: 'track', skipTo: 'track', tens: 'bars', addTens: 'bars', subTens: 'bars',
  compare: 'compare', add20: 'pics', sub20: 'pics', add2: 'bars', sub2: 'bars', plusTens: 'bars', minusTens: 'bars', add22: 'bars', sub22: 'bars',
};
// Which skills are adding / taking away (shown as a + or − problem).
export const OP_OF = { add: '+', double: '+', add20: '+', addTens: '+', add2: '+', plusTens: '+', add22: '+', sub: '-', from10: '-', sub20: '-', subTens: '-', sub2: '-', minusTens: '-', sub22: '-' };

// The answer and its neighbors, so she has to really count. Big numbers also get the
// "off by ten" and "digits swapped" mix-ups as choices.
function choicesFor(ans, lo, hi, k, rng) {
  const set = new Set([ans]);
  const near = ans >= 20
    ? [ans + 10, ans - 10, ans + 1, ans - 1, onesOf(ans) * 10 + tensOf(ans), ans + 2, ans - 2]
    : [ans - 1, ans + 1, ans - 2, ans + 2, ans + 3, ans - 3];
  for (const x of ans >= 20 ? near : shuffle(near, rng)) {
    if (set.size >= k) break;
    if (x >= lo && x <= hi && x !== ans) set.add(x);
  }
  for (let guard = 0; set.size < k && guard < 80; guard++) set.add(ri(rng, lo, hi));
  return [...set].sort((a, b) => a - b);
}

// Choices in the same steps as the answer (tens for 30 + 20, fives when counting by 5s),
// so the right one doesn't stand out. `odd` adds one "off by one" choice.
function choicesStep(ans, step, k, rng, odd = false) {
  const set = new Set([ans]);
  const cands = shuffle([ans + step, ans - step, ans + 2 * step, ans - 2 * step, ans + 3 * step], rng);
  if (odd) cands.unshift(rng() < 0.5 ? ans + 1 : ans - 1);
  for (const x of cands) { if (set.size >= k) break; if (x >= 0 && x <= 100) set.add(x); }
  for (let g = 0; set.size < k && g < 50; g++) { const x = step * ri(rng, 0, Math.floor(100 / step)); if (x !== ans) set.add(x); }
  return [...set].sort((a, b) => a - b);
}

const lowFor = (max) => (max <= 5 ? 1 : max <= 10 ? 3 : max <= 15 ? 8 : 11);

function opProblem(skill, n, a, b, rng, obj) {
  const op = OP_OF[skill];
  const answer = op === '+' ? a + b : a - b;
  const hi = Math.max(10, n, answer + 10 > 100 ? 100 : n);
  const choices = skill === 'addTens' || skill === 'subTens' ? choicesStep(answer, 10, 4, rng) : choicesFor(answer, 0, Math.min(100, hi), 4, rng);
  return { skill, max: n, obj, a, b, op, answer, view: VIEW[skill], choices, key: `${skill}:${a}${op}${b}` };
}

function makeOnce(skill, n, rng) {
  const obj = pickOf(rng, OBJECTS);
  const k = n <= 5 ? 3 : 4;
  const view = VIEW[skill];
  switch (skill) {
    case 'count': { const c = ri(rng, lowFor(n), n); return { skill, max: n, obj, n: c, answer: c, view, choices: choicesFor(c, 1, Math.max(n, 5), k, rng), key: `count:${c}` }; }
    case 'find': { const c = ri(rng, 0, n); return { skill, max: n, n: c, answer: c, view, choices: choicesFor(c, 0, n, k, rng), key: `find:${c}` }; }
    case 'more': {
      const left = ri(rng, 1, n);
      let right = ri(rng, 1, n);
      for (let g = 0; right === left || Math.abs(right - left) > Math.max(2, Math.ceil(n / 4)); g++) {
        right = ri(rng, 1, n);
        if (g > 40) { right = left === 1 ? 2 : left - 1; break; }
      }
      return { skill, max: n, obj, left, right, answer: left > right ? 'L' : 'R', view, key: `more:${left}-${right}` };
    }
    case 'after': { const c = ri(rng, 5, n - 1); return { skill, max: n, n: c, answer: c + 1, view, choices: choicesFor(c + 1, 0, n, k, rng), key: `after:${c}` }; }
    case 'before': { const c = ri(rng, 6, n); return { skill, max: n, n: c, answer: c - 1, view, choices: choicesFor(c - 1, 0, n, k, rng), key: `before:${c}` }; }
    case 'add': { const t = ri(rng, 3, n); const a = ri(rng, 1, t - 1); return opProblem(skill, n, a, t - a, rng, obj); }
    case 'sub': { const a = ri(rng, 3, n); return opProblem(skill, n, a, ri(rng, 1, a - 1), rng, obj); }
    case 'double': { const a = ri(rng, 2, Math.floor(n / 2)); return opProblem(skill, n, a, a, rng, obj); }
    case 'from10': return opProblem(skill, 10, 10, ri(rng, 1, 9), rng, obj);
    case 'make10': { const a = ri(rng, 1, 9); return { skill, max: 10, obj, a, answer: 10 - a, view, choices: choicesFor(10 - a, 0, 10, 4, rng), key: `make10:${a}` }; }
    case 'add20': { const a = ri(rng, 5, 9); const b = ri(rng, 11 - a, 9); return opProblem(skill, 20, a, b, rng, obj); }
    case 'sub20': { const a = ri(rng, 11, 18); const b = ri(rng, a - 9, 9); return opProblem(skill, 20, a, b, rng, obj); }
    case 'skip': case 'skipTo': {
      const step = n; // skip: by 2, 5 or 10 from a small start; skipTo: by 5 or 10, up to 100
      const limit = skill === 'skipTo' ? 100 : step === 2 ? 20 : step === 5 ? 50 : 100;
      const start = step * ri(rng, skill === 'skipTo' ? 4 : 0, Math.floor(limit / step) - 3);
      const seq = [start, start + step, start + 2 * step];
      const answer = start + 3 * step;
      return { skill, step, max: limit, seq, answer, view, choices: choicesStep(answer, step, 4, rng, true), key: `${skill}:${step}:${start}` };
    }
    case 'tens': { const t = n <= 20 ? 1 : ri(rng, 1, Math.floor((n - 1) / 10)); const v = t * 10 + ri(rng, n <= 20 ? 1 : 0, 9); return { skill, max: n, t: tensOf(v), o: onesOf(v), answer: v, view, choices: choicesFor(v, 0, 100, 4, rng), key: `tens:${v}` }; }
    case 'addTens': { const a = 10 * ri(rng, 1, n / 10 - 1); return opProblem(skill, n, a, 10 * ri(rng, 1, (n - a) / 10), rng); }
    case 'subTens': { const a = 10 * ri(rng, 2, n / 10); return opProblem(skill, n, a, 10 * ri(rng, 1, a / 10 - 1), rng); }
    case 'compare': {
      const x = ri(rng, 10, n);
      let y = x;
      for (let g = 0; y === x && g < 40; g++) y = Math.max(10, Math.min(n, x + pickOf(rng, [-10, 10, -1, 1, -3, 3, -9, 9, onesOf(x) * 10 + tensOf(x) - x])));
      if (y === x) y = x === n ? x - 1 : x + 1;
      return { skill, max: n, x, y, answer: Math.max(x, y), view, choices: [x, y], key: `compare:${x}-${y}` };
    }
    case 'add2': { const a = 10 * ri(rng, 1, 8) + ri(rng, 0, 7); return opProblem(skill, 99, a, ri(rng, 1, 9 - onesOf(a)), rng); }
    case 'sub2': { const a = 10 * ri(rng, 1, 9) + ri(rng, 2, 9); return opProblem(skill, 99, a, ri(rng, 1, onesOf(a)), rng); }
    case 'plusTens': { const a = 10 * ri(rng, 1, 7) + ri(rng, 1, 9); return opProblem(skill, 99, a, 10 * ri(rng, 1, 9 - tensOf(a)), rng); }
    case 'minusTens': { const a = 10 * ri(rng, 3, 9) + ri(rng, 1, 9); return opProblem(skill, 99, a, 10 * ri(rng, 1, tensOf(a) - 1), rng); }
    case 'add22': {
      const top = n === 50 ? 4 : 9;
      const at = ri(rng, 1, top - 1), bt = ri(rng, 1, top - at);
      const ao = ri(rng, 0, 8), bo = ri(rng, 0, 9 - ao);
      return opProblem(skill, n, at * 10 + ao, bt * 10 + bo, rng);
    }
    case 'sub22': {
      const top = n === 50 ? 5 : 9;
      const at = ri(rng, 2, top), bt = ri(rng, 1, at - 1);
      const ao = ri(rng, 1, 9), bo = ri(rng, 0, ao);
      return opProblem(skill, n, at * 10 + ao, bt * 10 + bo, rng);
    }
    default: throw new Error(`Unknown little skill ${skill}`);
  }
}

export function makeLittle(skill, n, rng = Math.random, avoidKeys = []) {
  const avoid = new Set(avoidKeys);
  let p = null;
  for (let i = 0; i < 40; i++) {
    p = makeOnce(skill, n, rng);
    if (!avoid.has(p.key)) return p;
  }
  return p;
}

export function isValidLittle(p) {
  if (!p || !LITTLE_SKILLS.includes(p.skill)) return false;
  if (p.skill === 'more') return p.left !== p.right && p.left >= 1 && p.right >= 1 && p.answer === (p.left > p.right ? 'L' : 'R');
  const ok = Number.isInteger(p.answer) && p.answer >= 0 && p.answer <= 100 && Array.isArray(p.choices) && p.choices.includes(p.answer)
    && new Set(p.choices).size === p.choices.length && p.choices.every((c) => c >= 0 && c <= 100);
  if (!ok) return false;
  if (p.op === '+') return p.a >= 1 && p.b >= 1 && p.a + p.b === p.answer;
  if (p.op === '-') return p.b >= 1 && p.b < p.a && p.a - p.b === p.answer;
  if (p.skill === 'make10') return p.a + p.answer === 10;
  if (p.skill === 'skip' || p.skill === 'skipTo') return p.answer === p.seq[2] + p.step && p.answer <= 100;
  if (p.skill === 'tens') return p.answer === p.t * 10 + p.o;
  if (p.skill === 'compare') return p.x !== p.y && p.answer === Math.max(p.x, p.y);
  return true;
}

// Picks [skill, n] for her next problem. Quizzes mix the last 5 levels.
export function pickLittle(level, rng = Math.random, quiz = false) {
  const n = Math.max(1, Math.min(LITTLE_LEVELS.length, level | 0));
  const at = quiz ? Math.max(1, n - Math.floor(rng() * 5)) : n;
  return pickOf(rng, LITTLE_LEVELS[at - 1].mix);
}

// Before this, Luna's path had 30 easy levels. She already adds 10s and counts by 5s,
// so she moves up to the tens-and-fives world (or further).
export function migrateLittle(lpath) {
  if (!lpath || lpath.v === 2) return false;
  const old = lpath.level || 1;
  lpath.level = old <= 10 ? 11 : old <= 20 ? 16 : 21;
  lpath.stars = 0;
  lpath.best = Math.max(lpath.level, lpath.best || 1);
  lpath.quizDue = false;
  lpath.quizWait = 0;
  lpath.champion = false;
  lpath.v = 2;
  return true;
}
