import test from 'node:test';
import assert from 'node:assert/strict';
import { generateProblem, isValidProblem, analyzeAnswer, buildSteps, parseEntry, mulberry32, tensOf, onesOf, mistakePattern } from '../js/math.js';
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

// Walk every guided step on the blocks model and check that the pictures,
// the written boxes and the numbers Mila is asked for always agree.
function walk(p) {
  const m = M.makeModel(p);
  assert.equal(M.value(m), p.a, 'model starts at the first number');
  const steps = buildSteps(p);
  assert.ok(steps[steps.length - 1].final);
  const boxes = { ones: '', tens: '' };
  for (const st of steps) {
    const valBefore = M.value(m);
    if (st.sync) {
      const did = M.applyAction(m, st.sync);
      assert.ok(did, `${p.key} ${st.key} sync ${st.sync}`);
      if (st.sync.startsWith('trade')) {
        assert.equal(M.value(m), valBefore, 'a trade never changes the amount');
        assert.equal(st.kind, st.sync === 'tradeUp' ? 'carry' : 'borrow');
      }
    }
    const c = M.counts(m);
    if (st.kind === 'ask' && st.ask === 'fromTen') {
      const yellowLeft = m.pieces.filter((x) => x.kind === 'one' && x.src === 'trade' && x.state === 'in').length;
      assert.equal(st.expect, yellowLeft, `${p.key} 10 - ${st.params.y} left in the yellow ten`);
    } else if (st.kind === 'ask') assert.equal(st.expect, c.onesIn, `${p.key} ones shown in blocks`);
    if (st.say && st.say.includes('w_borrow_after')) { assert.equal(c.tensIn, st.params.t); assert.equal(st.params.o, st.params.x + 10); }
    if (st.kind === 'write' && st.carryAuto) {
      // 8 + 6 = 14 in the ones box: the 4 stays, the 1 ten goes up
      assert.ok(st.expect >= 10 && st.expect <= 18, `${p.key} carry sum`);
      assert.equal(st.expect, c.onesIn, `${p.key} ones shown in blocks`);
      assert.ok(M.tradeUp(m));
      boxes.ones = String(st.expect % 10);
    } else if (st.kind === 'write') {
      assert.ok(st.expect >= 0 && st.expect <= 9, 'one digit per box');
      assert.equal(st.expect, st.cell === 'ones' ? c.onesIn : c.tensIn, `${p.key} ${st.cell} box matches blocks`);
      boxes[st.cell] = String(st.expect);
    }
    assert.ok(st.kind !== 'next' || st.final, `${p.key} no extra OK screens`);
  }
  assert.equal(M.value(m), p.answer, `${p.key} blocks end at the answer`);
  assert.equal(Number(boxes.tens || 0) * 10 + Number(boxes.ones), p.answer, `${p.key} boxes read the answer`);
  assert.equal(boxes.ones, String(onesOf(p.answer)));
  if (p.op === '+') assert.equal(M.counts(m).onesTray + M.counts(m).tensTray, 0);
  else assert.ok(M.subtractionDone(m));
  assert.equal(m.trades, p.regroup ? 1 : 0, 'exactly one trade when regrouping');
}

test('guided steps match the blocks for every problem', () => {
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

test('39 + 12: 9 + 2 = 11, the 1 goes up on top of the 3, then 1 + 3 + 1', () => {
  const st = buildSteps({ a: 39, b: 12, op: '+', answer: 51, regroup: true });
  assert.deepEqual(st.map((x) => x.key), ['w_ones_sum', 'w_tens_carry']);
  assert.equal(st[0].expect, 11);
  assert.equal(st[0].cell, 'ones');
  assert.ok(st[0].carryAuto, '11 goes in the ones box, the 1 flies up by itself');
  assert.equal(st[1].params.t, 3);
  assert.equal(st[1].expect, 5);
});

test('42 - 17: borrow from the 4, then 12 - 7 as (10 - 7) + 2', () => {
  const st = buildSteps({ a: 42, b: 17, op: '-', answer: 25, regroup: true });
  assert.deepEqual(st.map((x) => x.key), ['w_borrow', 'w_from_ten', 'w_join', 'w_sub_tens']);
  assert.deepEqual([st[1].params.t, st[1].params.o, st[1].params.a], [3, 12, 42]);
  assert.deepEqual(st.filter((x) => x.expect != null).map((x) => x.expect), [3, 5, 2]);
  assert.equal(st[2].cell, 'ones', '3 + 2 goes straight into the ones box');
});

test('37 - 18: 17 is 10 and 7, 10 - 8 = 2, 2 + 7 = 9, then 2 - 1 = 1', () => {
  const st = buildSteps({ a: 37, b: 18, op: '-', answer: 19, regroup: true });
  const ft = st.find((x) => x.key === 'w_from_ten');
  assert.deepEqual([ft.params.o, ft.params.r], [17, 7]);
  assert.ok(ft.say.includes('w_split10'));
  assert.equal(st.find((x) => x.ask === 'fromTen').label, '10 \u2212 8');
  assert.deepEqual(st.filter((x) => x.expect != null).map((x) => x.expect), [2, 9, 1]);
  const zero = buildSteps({ a: 40, b: 18, op: '-', answer: 22, regroup: true });
  assert.ok(!zero.some((x) => x.key === 'w_join'), '40 - 18: just 10 - 8');
  assert.equal(zero.find((x) => x.key === 'w_from_ten').cell, 'ones', '10 - 8 = 2 goes in the ones box');
});

test('no regrouping: write the ones, then the tens', () => {
  assert.deepEqual(buildSteps({ a: 24, b: 24, op: '+', answer: 48 }).map((x) => [x.cell, x.expect]), [['ones', 8], ['tens', 4]]);
  assert.equal(buildSteps({ a: 45, b: 41, op: '-', answer: 4 }).at(-1).key, 'w_sub_tens_zero');
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
      const ph = (s) => [...new Set(s.match(/\{\w+\}/g) || [])].sort().join();
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

// ---------------------------------------------------------------- level path & multiplication
import { generateMul, isValidMul, buildMulSteps, analyzeMul } from '../js/mult.js';
import { LEVELS, pickFromLevel, recordPath, MAX_PATH_LEVEL, passLevel, failQuiz, quizPlan, QUIZ } from '../js/levels.js';
import { defaults, helpLevel, recordFade, passedFade } from '../js/store.js';

test('multiplication problems stay small and friendly', () => {
  const rng = mulberry32(9);
  for (const lvl of [1, 2, 3]) for (let i = 0; i < 2000; i++) {
    const p = generateMul(lvl, rng);
    assert.ok(isValidMul(p), p.key);
    if (lvl === 1) { assert.ok(p.a <= 3); assert.ok([2, 5, 10].includes(p.b)); }
    assert.equal(p.style, lvl === 3 ? 'rows' : 'groups');
  }
});

test('multiplication help adds one group at a time', () => {
  const st = buildMulSteps({ a: 3, b: 4, answer: 12 });
  assert.deepEqual(st.map((x) => x.expect ?? null), [null, 8, 12]);
  assert.ok(st.at(-1).final);
  assert.deepEqual(st.map((x) => x.count), [1, 2, 3]);
  assert.equal(analyzeMul({ a: 3, b: 4, answer: 12 }, 7).kind, 'm_added');
  assert.equal(analyzeMul({ a: 3, b: 4, answer: 12 }, 11).kind, 'm_count_hint');
});

test('the level path climbs with stars and mixes skills', () => {
  const path = { level: 1, stars: 0, best: 1 };
  recordPath(path, false);
  assert.equal(path.stars, 0, 'help never removes or adds stars');
  for (let i = 0; i < LEVELS[0].goal - 1; i++) assert.ok(!recordPath(path, true).quizNow);
  assert.equal(path.level, 1);
  const r = recordPath(path, true);
  assert.ok(r.quizNow, 'a full row of stars opens the quiz');
  assert.equal(path.level, 1, 'stars alone never climb a level');
  assert.ok(!recordPath(path, true).quizNow, 'the quiz is asked for once, then waits on the home screen');
  failQuiz(path);
  assert.equal(path.stars, LEVELS[0].goal, 'a quiz that did not pass takes nothing away');
  assert.ok(!recordPath(path, true).quizNow);
  assert.ok(!recordPath(path, true).quizNow);
  assert.ok(recordPath(path, true).quizNow, `the quiz comes back after ${QUIZ.wait} more stars`);
  assert.ok(passLevel(path).leveledUp);
  assert.equal(path.level, 2);
  assert.equal(path.stars, 0);
  assert.equal(path.quizDue, false);
  const rng = mulberry32(3);
  for (const lv of LEVELS) {
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const [sk, d] = pickFromLevel(lv.n, { rng });
      assert.ok(['A', 'B', 'C', 'D', 'M'].includes(sk));
      assert.ok(d >= 1 && d <= 3);
      seen.add(sk);
    }
    if (lv.n >= 2) assert.ok(seen.size >= 2, `level ${lv.n} is mixed`);
  }
  for (let i = 0; i < 300; i++) {
    assert.ok(!['C', 'D'].includes(pickFromLevel(6, { rng, regroupOn: false })[0]));
    assert.notEqual(pickFromLevel(7, { rng, multOn: false })[0], 'M');
  }
  const top = { level: MAX_PATH_LEVEL, stars: 0 };
  for (let i = 0; i < 30; i++) recordPath(top, true);
  assert.equal(top.level, MAX_PATH_LEVEL);
  assert.ok(passLevel(top).champion);
  assert.equal(top.level, MAX_PATH_LEVEL);
});

test('quizzes mix the level with one earlier problem', () => {
  const rng = mulberry32(11);
  for (const lv of LEVELS) {
    const plan = quizPlan(lv.n, { rng });
    assert.equal(plan.length, QUIZ.size);
    const fromLevel = plan.filter(([sk, d]) => lv.mix.some(([s2, d2]) => s2 === sk && d2 === d)).length;
    assert.ok(fromLevel >= QUIZ.size - 1, `level ${lv.n} quiz is mostly its own level`);
  }
  assert.ok(quizPlan(7, { rng, multOn: false }).every(([sk]) => sk !== 'M'));
});

test('quiz mistakes are named for the grown-ups', () => {
  assert.equal(mistakePattern({ a: 28, b: 26, op: '+', answer: 54 }, 44), 'forgotCarry');
  assert.equal(mistakePattern({ a: 42, b: 17, op: '-', answer: 25 }, 35), 'smallFromBig');
  assert.equal(mistakePattern({ a: 42, b: 18, op: '-', answer: 24 }, 34), 'forgotTens');
  assert.equal(mistakePattern({ a: 42, b: 17, op: '-', answer: 25 }, 59), 'wrongOp');
  assert.equal(mistakePattern({ a: 31, b: 15, op: '+', answer: 46 }, 64), 'swapped');
  assert.equal(mistakePattern({ a: 31, b: 15, op: '+', answer: 46 }, 47), 'offByOne');
  assert.equal(mistakePattern({ a: 31, b: 15, op: '+', answer: 46 }, 46), null);
  assert.equal(mistakePattern({ a: 4, b: 5, op: '\u00d7', answer: 20 }, 9), 'wrongOp');
});

test('the guide steps back as she learns, and comes back when she struggles', () => {
  const d = defaults();
  assert.equal(helpLevel(d, 'C'), 'full');
  for (let i = 0; i < 3; i++) recordFade(d, 'C', true);
  assert.equal(helpLevel(d, 'C'), 'light');
  passedFade(d, 'C');
  assert.equal(helpLevel(d, 'C'), 'off');
  recordFade(d, 'C', false);
  assert.equal(helpLevel(d, 'C'), 'off', 'one slip is fine');
  recordFade(d, 'C', false);
  assert.equal(helpLevel(d, 'C'), 'full', 'two in a row: the guide comes back');
});

// ---------------------------------------------------------------- guide voice lines
import { allLines, variants, clipId, lineText } from '../js/voicelines.js';

test('every voice line has text, no child name, and unique recordings', () => {
  const all = allLines();
  const ids = Object.keys(all);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.ok(all[id].text.length >= 2, id);
    assert.ok(!/mila/i.test(all[id].text), `${id} must not say a name`);
    assert.ok(!/\{v\}/.test(all[id].text), `${id} filled in`);
  }
  assert.ok(variants('en', 'yay1').length >= 3, 'English cheers have several takes');
  assert.equal(clipId('en', 'borrow_tap', 3, 0), 'en-borrow_tap-3', 'the first take keeps its old file name');
  assert.equal(clipId('en', 'borrow_tap', 3, 2), 'en-borrow_tap-3-x2');
  assert.ok(!lineText('en', 'ones_add', null, false, 1).includes('['), 'device text has no acting tags');
});
