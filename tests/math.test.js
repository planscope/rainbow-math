import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, isValidProblem, analyzeAnswer, buildSteps, parseEntry, mulberry32, tensOf, onesOf } from '../js/math.js';
import * as M from '../js/model.js';
import { STR, t, STORIES, CREATURE_NAMES, CREATURE_ORDER } from '../js/i18n.js';

const SK = ['A', 'B', 'C', 'D'];

test('generated problems follow their skill and level rules', () => {
  const rng = mulberry32(42);
  for (const s of SK) for (const lvl of [1, 2, 3]) {
    let zero = 0;
    for (let i = 0; i < 4000; i++) {
      const p = generateProblem(s, lvl, rng);
      assert.ok(isValidProblem(p), `${s}${lvl} ${p.key}`);
      assert.ok(p.a >= 10 && p.a <= 99 && p.b >= 10 && p.b <= 99);
      if (p.op === '+') assert.ok(p.answer <= 99);
      else assert.ok(p.answer >= 0, 'no negative answers');
      const maxA = { 1: 49, 2: 79, 3: 99 }[lvl];
      assert.ok(p.a <= maxA || p.op === '+', `${s}${lvl} first number too big ${p.key}`);
      if (p.answer === 0) zero++;
    }
    if (s === 'B' && lvl === 3) assert.ok(zero > 0, 'zero answers do happen at level 3');
  }
});

test('problems avoid repeats when asked', () => {
  const rng = mulberry32(7);
  const used = [];
  for (let i = 0; i < 10; i++) { const p = generateProblem('C', 1, rng, used); assert.ok(!used.includes(p.key)); used.push(p.key); }
});

test('blank is not zero, zero is zero', () => {
  assert.equal(parseEntry(''), null);
  assert.equal(parseEntry('   '), null);
  assert.equal(parseEntry(undefined), null);
  assert.equal(parseEntry('0'), 0);
  assert.equal(parseEntry('05'), 5);
  assert.equal(parseEntry('25'), 25);
  const p = { a: 37, b: 37, op: '-', answer: 0, skill: 'B', key: '37-37', regroup: false, level: 3 };
  assert.equal(analyzeAnswer(p, 0).correct, true);
});

test('wrong-answer feedback only states facts', () => {
  const p = { a: 42, b: 17, op: '-', answer: 25 };
  assert.equal(analyzeAnswer(p, 35).kind, 'onesRight');      // ones digit 5 matches
  assert.equal(analyzeAnswer(p, 24).kind, 'tensRight');
  assert.equal(analyzeAnswer(p, 59).kind, 'tooBigSub');
  assert.equal(analyzeAnswer(p, 13).kind, 'check');
  const q = { a: 28, b: 15, op: '+', answer: 43 };
  assert.equal(analyzeAnswer(q, 33).kind, 'onesRight');
  assert.equal(analyzeAnswer(q, 20).kind, 'tooSmallAdd');
  const r = { a: 45, b: 41, op: '-', answer: 4 };
  assert.notEqual(analyzeAnswer(r, 7).kind, 'tensRight', 'no "tens are right" when the answer has no tens');
});

// Walk every guided step on the blocks model and check that pictures,
// written marks and the numbers Mila is asked for always agree.
function walk(p) {
  const m = M.makeModel(p);
  assert.equal(M.value(m), p.a, 'model starts at the first number');
  const steps = buildSteps(p);
  assert.ok(steps[steps.length - 1].final);
  const marks = {};
  for (const st of steps) {
    if (st.kind === 'act') {
      const before = m.trades;
      const valBefore = M.value(m);
      assert.ok(M.applyAction(m, st.act), `${p.key} action ${st.act} possible`);
      assert.ok(M.actionDone(m, st.act, before));
      if (st.act.startsWith('trade')) assert.equal(M.value(m), valBefore, 'a trade never changes the amount');
    }
    if (st.key === 'g_sub_still') {
      const c = M.counts(m);
      assert.equal(c.tensIn, st.params.t); assert.equal(c.onesIn, st.params.o); assert.equal(M.value(m), p.a);
    }
    if (st.key === 'g_after_trade_up') assert.equal(M.counts(m).onesIn, st.params.o);
    if (st.kind === 'ask') {
      const c = M.counts(m);
      if (st.ask === 'ones') assert.equal(st.expect, c.onesIn, `${p.key} ones`);
      if (st.ask === 'tens') assert.equal(st.expect, c.tensIn, `${p.key} tens`);
      if (st.ask === 'total') { assert.equal(st.expect, p.answer); assert.equal(M.value(m), p.answer); assert.equal(st.params.t * 10 + st.params.o, p.answer); }
    }
    if (st.mark) Object.assign(marks, st.mark);
  }
  assert.equal(marks.ones, onesOf(p.answer));
  assert.equal(marks.tens, tensOf(p.answer));
  if (p.op === '+') assert.equal(M.counts(m).onesTray + M.counts(m).tensTray, 0);
  else assert.ok(M.subtractionDone(m));
  assert.equal(m.trades, p.regroup ? 1 : 0, 'exactly one trade when regrouping');
}

test('guided steps match the blocks for every problem', () => {
  // all valid two-digit pairs, exhaustively
  let n = 0;
  for (let a = 10; a <= 99; a++) for (let b = 10; b <= 99; b++) {
    if (a + b <= 99) {
      const reg = onesOf(a) + onesOf(b) >= 10;
      walk({ a, b, op: '+', answer: a + b, regroup: reg, skill: reg ? 'C' : 'A', key: `${a}+${b}` }); n++;
    }
    if (a - b >= 0) {
      const reg = onesOf(a) < onesOf(b);
      walk({ a, b, op: '-', answer: a - b, regroup: reg, skill: reg ? 'D' : 'B', key: `${a}-${b}` }); n++;
    }
  }
  assert.ok(n > 5000);
});

test('the 42 - 17 example follows the script', () => {
  const p = { a: 42, b: 17, op: '-', answer: 25, regroup: true };
  const keys = buildSteps(p).map((s) => s.key);
  assert.deepEqual(keys, ['g_sub_show', 'g_sub_need_trade', 'g_sub_still', 'g_take_ones', 'g_ask_ones_left', 'g_take_tens', 'g_ask_tens_left', 'g_ask_total']);
  const still = buildSteps(p)[2].params;
  assert.deepEqual([still.t, still.o, still.a], [3, 12, 42]);
});

test('the 28 + 15 example makes 13 ones then 4 tens 3 ones', () => {
  const p = { a: 28, b: 15, op: '+', answer: 43, regroup: true };
  const st = buildSteps(p);
  assert.equal(st.find((s) => s.ask === 'ones').expect, 13);
  assert.equal(st.find((s) => s.ask === 'tens').expect, 4);
  assert.deepEqual(st[st.length - 1].params, { t: 4, o: 3 });
});

test('free play: blocks can only take away what the problem asks, and trades only when needed', () => {
  const m = M.makeModel({ a: 42, b: 17, op: '-' });
  assert.equal(M.canTradeDown(m), true);
  M.takeOne(m, 'one'); M.takeOne(m, 'one');
  assert.equal(M.canTake(m, 'one'), false, 'no ones left on the mat');
  M.tradeDown(m);
  assert.equal(M.value(m), 40);
  assert.equal(M.canTradeDown(m), false, 'enough ones now');
  while (M.takeOne(m, 'one'));
  while (M.takeOne(m, 'ten'));
  assert.equal(M.value(m), 25);
  const n = M.makeModel({ a: 46, b: 23, op: '-' });
  assert.equal(M.canTradeDown(n), false, 'no trade needed when there are enough ones');
  const add = M.makeModel({ a: 28, b: 15, op: '+' });
  assert.equal(M.canTradeUp(add), false);
  M.bringOnes(add);
  assert.equal(M.canTradeUp(add), true);
  M.tradeUp(add); M.bringTens(add);
  assert.equal(M.value(add), 43);
  assert.equal(M.canTradeUp(add), false);
});

test('both languages have every key and every placeholder', () => {
  const en = STR.en, es = STR.es;
  for (const k of Object.keys(en)) {
    assert.ok(k in es, `Spanish missing ${k}`);
    if (typeof en[k] === 'string') {
      const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
      assert.equal(ph(es[k]), ph(en[k]), `placeholders differ in ${k}`);
    }
    if (Array.isArray(en[k])) assert.ok(Array.isArray(es[k]) && es[k].length > 0, `array ${k}`);
  }
  for (const k of Object.keys(es)) assert.ok(k in en, `English missing ${k}`);
  for (const op of ['+', '-']) for (const s of STORIES[op]) {
    for (const l of ['en', 'es']) { assert.ok(s[l].includes('{a}') && s[l].includes('{b}')); assert.ok(s[l].split(/[.?!]\s/).length <= 3, 'short stories'); }
  }
  for (const c of CREATURE_ORDER) assert.ok(CREATURE_NAMES[c].en && CREATURE_NAMES[c].es);
  assert.equal(t('es', 'g_sub_still', { t: es.tens(3), o: es.ones(12), a: 42 }), 'Ahora tenemos 3 decenas y 12 unidades. ¡Sigue siendo 42!');
  assert.equal(t('en', 'g_sub_still', { t: en.tens(3), o: en.ones(12), a: 42 }), 'Now we have 3 tens and 12 ones. It is still 42!');
  assert.equal(en.tens(1), '1 ten');
  assert.equal(es.ones(1), '1 unidad');
});

test('no discouraging words in child-facing text', () => {
  const bad = /\b(wrong|bad|careless|slow|stupid|fail|incorrect|mal|tonta|lenta|incorrecto)\b/i;
  for (const l of ['en', 'es']) for (const [k, v] of Object.entries(STR[l])) {
    if (k.startsWith('p_')) continue;
    const vals = Array.isArray(v) ? v : typeof v === 'string' ? [v] : [];
    for (const s of vals) assert.ok(!bad.test(s), `${l}.${k}: ${s}`);
  }
});
