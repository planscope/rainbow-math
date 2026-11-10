// First steps with multiplication: "3 × 4" means 3 equal groups of 4.
// Pure logic, no DOM, so it can be tested.

const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const pickOf = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// level 1: 2–3 groups of 2, 5 or 10 (easy to count by)
// level 2: 2–5 groups of 2, 3, 4, 5 or 10
// level 3: 2–5 groups of 2–5 or 10, shown as rows (arrays)
// level 4: times tables of 2, 5 and 10 (up to 10 rows)
// level 5: times tables of 3 and 4 (up to 10 rows)
// level 6: the big tables, 6 to 9 (up to 6 rows)
export const MUL_LEVELS = 6;
const MUL_RULE = {
  1: { a: [2, 3], b: [2, 5, 10] },
  2: { a: [2, 5], b: [2, 3, 4, 5, 10, 2, 5] },
  3: { a: [2, 5], b: [2, 3, 4, 5, 10] },
  4: { a: [2, 10], b: [2, 5, 10] },
  5: { a: [2, 10], b: [3, 4] },
  6: { a: [2, 6], b: [6, 7, 8, 9] },
};
export function generateMul(level = 1, rng = Math.random, avoidKeys = []) {
  const lvl = Math.max(1, Math.min(MUL_LEVELS, level | 0));
  const rule = MUL_RULE[lvl];
  const avoid = new Set(avoidKeys);
  let p = null;
  for (let i = 0; i < 60; i++) {
    const a = ri(rng, rule.a[0], rule.a[1]);
    const b = pickOf(rng, rule.b);
    p = {
      key: `${a}x${b}`,
      skill: 'M',
      level: lvl,
      op: '×',
      a,
      b,
      answer: a * b,
      regroup: false,
      style: lvl >= 3 ? 'rows' : 'groups',
    };
    if (!avoid.has(p.key)) return p;
  }
  return p;
}

export function isValidMul(p) {
  return !!p && p.op === '×' && p.skill === 'M'
    && Number.isInteger(p.a) && Number.isInteger(p.b)
    && p.a >= 2 && p.a <= 10 && p.b >= 2 && p.b <= 10
    && p.answer === p.a * p.b
    && (p.style === 'groups' || p.style === 'rows');
}

// Step-by-step help: count the groups by adding one more group each time.
//   3 × 4: "There are 3 groups of 4" → 4 + 4 = 8 → 8 + 4 = 12
// `count` = how many groups are lit up while she works on that step.
export function buildMulSteps(p) {
  const steps = [{ kind: 'next', key: 'm_intro', params: { a: p.a, b: p.b }, count: 1 }];
  for (let k = 2; k <= p.a; k++) {
    steps.push({
      kind: 'ask',
      key: k === 2 ? 'm_two' : 'm_more',
      params: { x: (k - 1) * p.b, y: p.b, k },
      expect: k * p.b,
      count: k,
      final: k === p.a,
    });
  }
  return steps;
}

// Every multiplication any level can ask (for recording the guide's explanations).
export function allMulProblems() {
  const out = new Map();
  for (const r of Object.values(MUL_RULE)) {
    for (let a = r.a[0]; a <= r.a[1]; a++) for (const b of new Set(r.b)) out.set(`${a}x${b}`, { a, b, answer: a * b });
  }
  return [...out.values()];
}

// Facts about a wrong answer (never a guess about why).
export function analyzeMul(p, ans) {
  if (ans === p.answer) return { correct: true };
  if (ans === p.a + p.b) return { correct: false, kind: 'm_added' };
  return { correct: false, kind: 'm_count_hint' };
}
