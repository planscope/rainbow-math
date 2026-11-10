import test from 'node:test';
import assert from 'node:assert/strict';
import { LITTLE_LEVELS, LITTLE_SKILLS, makeLittle, isValidLittle, pickLittle, littleWorldOf, migrateLittle, OP_OF } from '../js/little.js';
import { recordPath, passLevel } from '../js/levels.js';
import { mulberry32, onesOf, tensOf } from '../js/math.js';

test("Luna's 60 levels in 6 worlds, a quiz every 5th level", () => {
  assert.equal(LITTLE_LEVELS.length, 60);
  assert.deepEqual(LITTLE_LEVELS.filter((l) => l.gate).map((l) => l.n), Array.from({ length: 12 }, (_, i) => (i + 1) * 5));
  for (const l of LITTLE_LEVELS) assert.equal(littleWorldOf(l.n), l.world);
});

test('every little problem is valid and its buttons hold the answer', () => {
  const rng = mulberry32(5);
  for (const lv of LITTLE_LEVELS) {
    for (const [skill, n] of lv.mix) {
      assert.ok(LITTLE_SKILLS.includes(skill), skill);
      for (let i = 0; i < 150; i++) {
        const p = makeLittle(skill, n, rng);
        assert.ok(isValidLittle(p), `${lv.n} ${skill} ${JSON.stringify(p)}`);
        if (skill === 'more') continue;
        assert.ok(p.choices.length >= 2 && p.choices.length <= 4);
        if (p.op) assert.ok(p.answer <= 99 || skill === 'addTens', `${skill} stays under 100`);
      }
    }
  }
});

test('the hard skills follow their rules', () => {
  const rng = mulberry32(21);
  for (let i = 0; i < 300; i++) {
    const a20 = makeLittle('add20', 20, rng);
    assert.ok(a20.answer > 10 && a20.answer <= 18, '8 + 5 crosses 10');
    const s20 = makeLittle('sub20', 20, rng);
    assert.ok(s20.a > 10 && s20.b > onesOf(s20.a) && s20.answer < 10, '13 - 5 crosses 10');
    const at = makeLittle('addTens', 100, rng);
    assert.ok(at.a % 10 === 0 && at.b % 10 === 0 && at.answer <= 100);
    for (const sk of ['add22', 'add2', 'plusTens']) {
      const p = makeLittle(sk, 99, rng);
      assert.ok(onesOf(p.a) + onesOf(p.b) <= 9, `${sk} never needs carrying yet`);
    }
    for (const sk of ['sub22', 'sub2', 'minusTens']) {
      const p = makeLittle(sk, 99, rng);
      assert.ok(onesOf(p.a) >= onesOf(p.b) && tensOf(p.a) >= tensOf(p.b), `${sk} never needs borrowing yet`);
    }
    const sk = makeLittle('skipTo', 5, rng);
    assert.ok(sk.seq[0] >= 20 && sk.answer <= 100 && sk.answer % 5 === 0);
    const st = makeLittle('subTens', 100, rng);
    assert.ok(st.choices.every((c) => c % 10 === 0), 'tens problems only offer tens');
    const sk5 = makeLittle('skip', 5, rng);
    assert.ok(sk5.choices.filter((c) => c % 5 !== 0).length <= 1, 'counting by 5s offers fives');
    const t = makeLittle('tens', 20, rng);
    assert.ok(t.answer >= 11 && t.answer <= 19, 'teen numbers are 1 ten and some ones');
  }
  for (const k of Object.keys(OP_OF)) assert.ok(LITTLE_SKILLS.includes(k));
});

test('level 11 starts the tens and fives; quizzes pick from the last 5 levels', () => {
  const rng = mulberry32(9);
  for (let i = 0; i < 100; i++) assert.deepEqual(pickLittle(11, rng), ['skip', 10]);
  for (let i = 0; i < 100; i++) assert.ok(pickLittle(15, rng, true)[0] !== 'count');
});

test('Luna moves up from the old easy path', () => {
  const p = { level: 3, stars: 2, best: 3 };
  assert.ok(migrateLittle(p));
  assert.deepEqual([p.level, p.stars, p.v], [11, 0, 2]);
  assert.ok(!migrateLittle(p), 'only once');
});

test("Luna's path uses the same star and quiz rules", () => {
  const path = { level: 1, stars: 0, best: 1 };
  for (let i = 0; i < 3; i++) assert.ok(!recordPath(path, true, LITTLE_LEVELS).leveledUp);
  assert.ok(recordPath(path, true, LITTLE_LEVELS).leveledUp);
  path.level = 5;
  path.stars = 3;
  assert.ok(recordPath(path, true, LITTLE_LEVELS).quizNow);
  path.level = 60;
  assert.ok(passLevel(path, LITTLE_LEVELS).champion);
});
