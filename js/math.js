// Pure, deterministic math logic: problem generation, answer checking and
// the step-by-step guided explanations. No DOM here, so it can be unit-tested.

export const SKILLS = {
  A: { op: '+', regroup: false },
  B: { op: '-', regroup: false },
  C: { op: '+', regroup: true },
  D: { op: '-', regroup: true },
};
export const SKILL_ORDER = ['A', 'B', 'C', 'D'];
export const NEXT_SKILL = { A: 'C', B: 'D' }; // regrouping skill unlocked after the basic one
export const BASE_SKILL = { C: 'A', D: 'B' };
export const MAX_LEVEL = 3;

// Small seeded random generator (used by tests; the app uses Math.random).
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export const tensOf = (n) => Math.floor(n / 10);
export const onesOf = (n) => n % 10;

function makeProblem(skill, level, a, b) {
  const op = SKILLS[skill].op;
  const answer = op === '+' ? a + b : a - b;
  return {
    key: `${a}${op}${b}`,
    skill,
    level,
    op,
    a,
    b,
    answer,
    regroup: op === '+' ? onesOf(a) + onesOf(b) >= 10 : onesOf(a) < onesOf(b),
  };
}

function generateOnce(skill, level, rng) {
  let a10, a1, b10, b1;
  if (skill === 'A') {
    // addition, no regrouping: ones sum <= 9, tens sum <= limit (total <= 99)
    const T = [0, 5, 7, 9][level];
    a10 = ri(rng, 1, T - 1);
    b10 = ri(rng, 1, T - a10);
    const O = level === 1 ? 5 : 9;
    a1 = ri(rng, 0, O);
    b1 = ri(rng, 0, Math.min(O, 9 - a1));
  } else if (skill === 'C') {
    // addition with regrouping: ones sum >= 10, tens sum + 1 <= 9 (total <= 99)
    const T = [0, 4, 6, 8][level];
    a10 = ri(rng, 1, T - 1);
    b10 = ri(rng, 1, T - a10);
    a1 = ri(rng, 2, 9);
    const maxOnesSum = level === 1 ? 14 : 18;
    b1 = ri(rng, 10 - a1, Math.min(9, maxOnesSum - a1));
  } else if (skill === 'B') {
    // subtraction, no regrouping: a1 >= b1, a10 >= b10
    const T = [0, 4, 7, 9][level];
    a10 = ri(rng, 2, T);
    b10 = ri(rng, 1, a10 - 1);
    if (level === 3 && rng() < 0.15) b10 = a10; // single-digit answer
    a1 = ri(rng, level === 1 ? 1 : 0, 9);
    b1 = ri(rng, 0, a1);
    if (b10 === a10 && rng() < 0.3) b1 = a1; // occasionally a real zero answer
  } else if (skill === 'D') {
    // subtraction with regrouping: a1 < b1, a10 > b10
    const T = [0, 4, 7, 9][level];
    a10 = ri(rng, 2, T);
    b10 = ri(rng, 1, a10 - 1);
    a1 = ri(rng, level === 3 ? 0 : 1, 8);
    b1 = ri(rng, a1 + 1, 9);
  } else {
    throw new Error('Unknown skill ' + skill);
  }
  return makeProblem(skill, level, a10 * 10 + a1, b10 * 10 + b1);
}

export function generateProblem(skill, level = 1, rng = Math.random, avoidKeys = []) {
  const lvl = Math.max(1, Math.min(MAX_LEVEL, level | 0));
  const avoid = new Set(avoidKeys);
  let p = null;
  for (let i = 0; i < 60; i++) {
    p = generateOnce(skill, lvl, rng);
    if (!avoid.has(p.key)) return p;
  }
  return p;
}

// Checks a problem against the rules of its skill. Used by tests and as a
// safety net in the app.
export function isValidProblem(p) {
  const two = (n) => Number.isInteger(n) && n >= 10 && n <= 99;
  if (!two(p.a) || !two(p.b)) return false;
  const s = SKILLS[p.skill];
  if (!s || s.op !== p.op) return false;
  if (p.op === '+') {
    if (p.answer !== p.a + p.b || p.answer > 99) return false;
    const r = onesOf(p.a) + onesOf(p.b) >= 10;
    return r === s.regroup && p.regroup === r;
  }
  if (p.answer !== p.a - p.b || p.answer < 0) return false;
  const r = onesOf(p.a) < onesOf(p.b);
  return r === s.regroup && p.regroup === r;
}

// Parses keypad text. Blank is NOT zero: returns null for blank.
export function parseEntry(text) {
  const t = String(text ?? '').trim();
  if (t === '' || !/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

// Looks at a wrong answer and says only what is factually true about it.
export function analyzeAnswer(p, ans) {
  if (ans === p.answer) return { correct: true };
  const out = { correct: false, kind: 'check', focus: null };
  if (p.op === '+' && ans < p.a) {
    out.kind = 'tooSmallAdd';
  } else if (p.op === '-' && ans > p.a) {
    out.kind = 'tooBigSub';
  } else if (ans <= 99) {
    const at = tensOf(ans), ao = onesOf(ans);
    const ct = tensOf(p.answer), co = onesOf(p.answer);
    if (ao === co && at !== ct) {
      out.kind = 'onesRight';
      out.focus = 'tens';
      out.digit = ao;
    } else if (at === ct && ao !== co && ct > 0) {
      out.kind = 'tensRight';
      out.focus = 'ones';
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Guided steps. Each step is one small thing Mila does:
//   kind 'next' -> she taps "OK" after looking
//   kind 'act'  -> she moves blocks (act names a model action)
//   kind 'ask'  -> she types a number (ask: 'ones' | 'tens' | 'total')
// `mark` writes a pencil digit into the written answer after the step.
export function buildSteps(p) {
  const a10 = tensOf(p.a), a1 = onesOf(p.a), b10 = tensOf(p.b), b1 = onesOf(p.b);
  const steps = [];
  if (p.op === '+') {
    const onesSum = a1 + b1;
    const carry = onesSum >= 10 ? 1 : 0;
    const onesLeft = onesSum - 10 * carry;
    const tensSum = a10 + b10 + carry;
    if (b1 > 0) steps.push({ kind: 'act', act: 'bringOnes', key: 'g_add_ones', params: { ao: a1, bo: b1 }, focus: 'ones' });
    else steps.push({ kind: 'next', key: 'g_add_zero_ones', params: { ao: a1 }, focus: 'ones' });
    steps.push({ kind: 'ask', ask: 'ones', expect: onesSum, key: 'g_ask_ones', focus: 'ones', mark: carry ? null : { ones: onesLeft } });
    if (carry) {
      steps.push({ kind: 'act', act: 'tradeUp', key: 'g_trade_up', params: { n: onesSum }, focus: 'ones' });
      steps.push({ kind: 'next', key: 'g_after_trade_up', params: { o: onesLeft }, focus: 'ones', mark: { ones: onesLeft } });
    }
    steps.push({ kind: 'act', act: 'bringTens', key: carry ? 'g_add_tens_carry' : 'g_add_tens', params: { at: a10, bt: b10 }, focus: 'tens' });
    steps.push({ kind: 'ask', ask: 'tens', expect: tensSum, key: 'g_ask_tens', focus: 'tens', mark: { tens: tensSum } });
    steps.push({ kind: 'ask', ask: 'total', expect: p.answer, key: 'g_ask_total', params: { t: tensSum, o: onesLeft }, final: true });
  } else {
    const borrow = a1 < b1 ? 1 : 0;
    const tensNow = a10 - borrow;
    const onesNow = a1 + 10 * borrow;
    const onesLeft = onesNow - b1;
    const tensLeft = tensNow - b10;
    steps.push({ kind: 'next', key: 'g_sub_show', params: { a: p.a, t: a10, o: a1 } });
    if (borrow) {
      steps.push({ kind: 'act', act: 'tradeDown', key: 'g_sub_need_trade', params: { o: a1, bo: b1 }, focus: 'ones' });
      steps.push({ kind: 'next', key: 'g_sub_still', params: { t: tensNow, o: onesNow, a: p.a }, borrowShown: true });
    } else {
      steps.push({ kind: 'next', key: 'g_sub_enough', params: { o: a1, bo: b1 }, focus: 'ones' });
    }
    if (b1 > 0) steps.push({ kind: 'act', act: 'takeOnes', key: 'g_take_ones', params: { bo: b1 }, focus: 'ones' });
    else steps.push({ kind: 'next', key: 'g_take_zero_ones', focus: 'ones' });
    steps.push({ kind: 'ask', ask: 'ones', expect: onesLeft, key: 'g_ask_ones_left', focus: 'ones', mark: { ones: onesLeft } });
    steps.push({ kind: 'act', act: 'takeTens', key: 'g_take_tens', params: { bt: b10 }, focus: 'tens' });
    steps.push({ kind: 'ask', ask: 'tens', expect: tensLeft, key: 'g_ask_tens_left', focus: 'tens', mark: { tens: tensLeft } });
    steps.push({ kind: 'ask', ask: 'total', expect: p.answer, key: 'g_ask_total', params: { t: tensLeft, o: onesLeft }, final: true });
  }
  return steps;
}
