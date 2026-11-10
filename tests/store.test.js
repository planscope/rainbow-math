import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, recordResult, pickSkill, regroupAvailable } from '../js/store.js';

test('three independent answers raise the level, then unlock regrouping', () => {
  const d = defaults();
  for (let i = 0; i < 3; i++) recordResult(d, 'A', true);
  assert.equal(d.progress.skills.A.level, 2);
  for (let i = 0; i < 6; i++) recordResult(d, 'A', true);
  assert.equal(d.progress.skills.A.level, 3);
  assert.equal(d.progress.unlocked.C, true);
  assert.equal(d.progress.skills.A.independent, 9);
  assert.equal(d.progress.skills.A.helped, 0);
});

test('two helped answers in a row ease the level; help never removes rewards', () => {
  const d = defaults();
  d.progress.skills.B.level = 2;
  d.rewards.pieces = 5;
  recordResult(d, 'B', false);
  const note = recordResult(d, 'B', false);
  assert.equal(note.eased, true);
  assert.equal(d.progress.skills.B.level, 1);
  assert.equal(d.progress.skills.B.helped, 2);
  assert.equal(d.rewards.pieces, 5);
});

test('regrouping setting is respected', () => {
  const d = defaults();
  d.settings.regroup = 'off';
  d.progress.unlocked.C = true;
  for (let i = 0; i < 200; i++) assert.equal(pickSkill(d, 'add', {}), 'A');
  d.settings.regroup = 'now';
  assert.equal(regroupAvailable(d, 'D'), true);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(pickSkill(d, 'mix', {}));
  assert.deepEqual([...seen].sort(), ['A', 'B', 'C', 'D']);
  for (let i = 0; i < 100; i++) assert.ok(['B', 'D'].includes(pickSkill(d, 'sub', {})));
});

import { migratePath } from '../js/levels.js';
test('an old 10-level path is moved onto the 100 levels when she logs in', () => {
  const d = defaults();
  d.progress.path = { level: 5, stars: 3, best: 5 }; // saved before the 100 levels
  assert.ok(migratePath(d.progress.path));
  assert.equal(d.progress.path.level, 21);
  const fresh = defaults();
  assert.ok(migratePath(fresh.progress.path), 'a new player is moved once too');
  assert.equal(fresh.progress.path.level, 1);
});
