import test from 'node:test';
import assert from 'node:assert/strict';
import { LITTLE_LEVELS, LITTLE_SKILLS, makeLittle, isValidLittle, pickLittle, littleWorldOf } from '../js/little.js';
import { recordPath, passLevel } from '../js/levels.js';
import { mulberry32 } from '../js/math.js';

test("Luna's 30 levels in 3 worlds, a quiz every 5th level", () => {
  assert.equal(LITTLE_LEVELS.length, 30);
  assert.deepEqual(LITTLE_LEVELS.filter((l) => l.gate).map((l) => l.n), [5, 10, 15, 20, 25, 30]);
  for (const l of LITTLE_LEVELS) assert.equal(littleWorldOf(l.n), l.world);
});

test('every little problem is valid, small, and its buttons hold the answer', () => {
  const rng = mulberry32(5);
  for (const lv of LITTLE_LEVELS) {
    for (const [skill, max] of lv.mix) {
      assert.ok(LITTLE_SKILLS.includes(skill));
      for (let i = 0; i < 200; i++) {
        const p = makeLittle(skill, max, rng);
        assert.ok(isValidLittle(p), `${lv.n} ${skill} ${JSON.stringify(p)}`);
        if (p.skill !== 'more') {
          assert.ok(p.answer <= max, `answers stay within ${max}`);
          assert.ok(p.choices.every((c) => c >= 0 && c <= Math.max(max, 5)));
          assert.equal(p.choices.length, max <= 5 ? 3 : 4);
        } else {
          assert.ok(Math.max(p.left, p.right) <= max);
        }
      }
    }
  }
});

test('level 1 is only counting to 5; level 11 starts adding', () => {
  const rng = mulberry32(9);
  for (let i = 0; i < 100; i++) assert.deepEqual(pickLittle(1, rng), ['count', 5]);
  for (let i = 0; i < 100; i++) assert.equal(pickLittle(11, rng)[0], 'add');
  for (let i = 0; i < 100; i++) assert.ok(pickLittle(10, rng, true)[1] <= 10, 'quiz picks from the last 5 levels');
});

test("Luna's path uses the same star and quiz rules", () => {
  const path = { level: 1, stars: 0, best: 1 };
  for (let i = 0; i < 3; i++) assert.ok(!recordPath(path, true, LITTLE_LEVELS).leveledUp);
  assert.ok(recordPath(path, true, LITTLE_LEVELS).leveledUp);
  path.level = 5;
  path.stars = 3;
  assert.ok(recordPath(path, true, LITTLE_LEVELS).quizNow);
  path.level = 30;
  assert.ok(passLevel(path, LITTLE_LEVELS).champion);
});
