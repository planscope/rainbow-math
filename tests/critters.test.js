import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../js/store.js';
import { mergeData } from '../js/merge.js';
import {
  SPECIES, critterOf, critterName, isCritterId, nextFriend, hatch, treats, feed, pet, care, hearts, isFull, FULL_AT,
  lineup, islandSnap, cleanSnap, cleanGift, takeGifts, sentToday, noteSent, TREAT_START,
} from '../js/critters.js';
import { friendSVG, islandSVG } from '../js/art.js';

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const kid = (pieces = 0) => {
  const d = defaults();
  d.rewards.pieces = pieces;
  d.rewards.treatsFrom = pieces;
  return d;
};

test('the 12 named friends come first, then baby friends that never run out', () => {
  const friends = [];
  for (let i = 0; i < 60; i++) friends.push(nextFriend(friends));
  assert.deepEqual(friends.slice(0, 12), SPECIES);
  const babies = friends.slice(12);
  assert.equal(new Set(friends).size, 60, 'every friend is new');
  for (const b of babies) {
    assert.ok(isCritterId(b), b);
    assert.ok(critterOf(b).baby);
  }
});

test('a baby friend is drawn and named the same way on every device', () => {
  const id = 'bunny.k3x9qa';
  assert.deepEqual(critterOf(id), critterOf(id));
  assert.match(critterName(id, 'en'), / the Bunny$/);
  assert.match(critterName(id, 'es'), /, la conejita$/);
  assert.equal(critterName('fox', 'en'), 'Twinkle the Star Fox');
  assert.equal(friendSVG(id), friendSVG(id));
  if (critterOf(id).hue) assert.match(friendSVG(id), /hueRotate/);
});

test('hatching avoids a name she already has for that kind', () => {
  const first = hatch([], seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]));
  const again = hatch([first], seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9, 0.15, 0.35, 0.55, 0.75, 0.95, 0.05]));
  assert.notEqual(first, again);
});

test('treats: 10 to start, one more for every problem solved', () => {
  const d = kid(250); // lots of old pieces don't turn into hundreds of treats
  assert.equal(treats(d.rewards), TREAT_START);
  d.rewards.pieces += 5;
  assert.equal(treats(d.rewards), TREAT_START + 5);
});

test('feeding: a treat each time, full after 3 a day, favorite food found', () => {
  const d = kid(0);
  d.rewards.friends = ['crab', 'fox'];
  const day = new Date('2026-11-10T15:00:00');
  const r1 = feed(d.rewards, 'crab', 'berry', day);
  assert.ok(r1.ok);
  assert.equal(r1.fav, false);
  const r2 = feed(d.rewards, 'crab', 'fish', day); // crabs love fish
  assert.ok(r2.fav);
  assert.ok(care(d.rewards, 'crab').knows);
  assert.ok(feed(d.rewards, 'crab', 'apple', day).full);
  assert.ok(isFull(care(d.rewards, 'crab'), '2026-11-10'));
  assert.deepEqual(feed(d.rewards, 'crab', 'apple', day), { ok: false, why: 'full' });
  assert.equal(treats(d.rewards), TREAT_START - FULL_AT);
  // tomorrow she can eat again
  assert.ok(feed(d.rewards, 'crab', 'apple', new Date('2026-11-11T09:00:00')).ok);
  // only her own friends, only real food
  assert.equal(feed(d.rewards, 'owl', 'fish', day).ok, false);
  assert.equal(feed(d.rewards, 'fox', 'pizza', day).ok, false);
});

test('no treats left: nothing is fed', () => {
  const d = kid(0);
  d.rewards.friends = [...SPECIES];
  let n = 0;
  for (const id of SPECIES) for (let i = 0; i < 3; i++) if (feed(d.rewards, id, 'berry', new Date('2026-11-10T10:00:00')).ok) n++;
  assert.equal(n, TREAT_START);
  assert.equal(treats(d.rewards), 0);
});

test('hearts grow with care, and petting is free', () => {
  const d = kid(100);
  d.rewards.friends = ['pup'];
  assert.equal(hearts(care(d.rewards, 'pup')), 0);
  feed(d.rewards, 'pup', 'cookie', new Date('2026-11-10T10:00:00'));
  assert.equal(hearts(care(d.rewards, 'pup')), 1);
  for (let i = 0; i < 20; i++) pet(d.rewards, 'pup');
  assert.equal(treats(d.rewards), TREAT_START - 1);
  assert.equal(hearts(care(d.rewards, 'pup')), 2);
});

test('the island shows the friends she played with last, and never more than 12', () => {
  const d = kid(0);
  for (let i = 0; i < 30; i++) d.rewards.friends.push(nextFriend(d.rewards.friends));
  pet(d.rewards, 'fox', new Date('2026-11-10T10:00:00'));
  const out = lineup(d.rewards, 12);
  assert.equal(out.length, 12);
  assert.equal(out[0], 'fox');
  assert.ok(islandSVG({ friends: out }).includes('data-critter="fox"'));
  assert.ok(lineup(d.rewards, 12, 'turtle').includes('turtle'), 'her own guide friend is always out');
});

test('what friends see: name and island only, and nothing unsafe gets drawn', () => {
  const d = kid(40);
  d.rewards.friends = ['fox', 'owl'];
  d.progress.path.level = 37;
  const snap = islandSnap({ name: 'Mila', friend: 'fox', pin: 'secret', cloud: 'ABCDEFGH' }, d);
  const text = JSON.stringify(snap);
  assert.ok(!/37|secret|ABCDEFGH|level/.test(text), text);
  assert.equal(snap.name, 'Mila');
  const evil = cleanSnap({ name: '<b>x</b>', out: ['fox', '"><script>', 'owl.zzzzzz', 'unicorn'], pieces: 'lots', hearts: { fox: 99 } });
  assert.deepEqual(evil.out, ['fox', 'owl.zzzzzz']);
  assert.equal(evil.hearts.fox, 5);
  assert.equal(evil.pieces, 0);
  assert.ok(!islandSVG({ friends: evil.out }).includes('<script'));
});

test('gifts: a treat from a friend adds love; waves are remembered; nothing twice', () => {
  const d = kid(0);
  d.rewards.friends = ['bunny'];
  const gifts = [
    { id: 'g1', at: '2026-11-10T10:00:00Z', from: 'Sofi', critter: 'bunny', food: 'carrot' },
    { id: 'g2', at: '2026-11-10T10:01:00Z', from: 'Sofi', wave: 'heart' },
    { id: 'g3', at: '2026-11-10T10:02:00Z', from: 'x', food: 'pizza', critter: 'bunny' },
  ];
  assert.equal(takeGifts(d, gifts).length, 2);
  assert.equal(care(d.rewards, 'bunny').got, 1);
  assert.equal(treats(d.rewards), TREAT_START, 'a gift does not cost her treats');
  assert.equal(takeGifts(d, gifts).length, 0);
  assert.equal(d.island.visitors[0].id, 'g2', 'newest first');
  assert.equal(cleanGift({ from: 'Ana<script>', wave: 'star' }).from, 'Anascript');
});

test('a few treats and one wave a day on each friend island', () => {
  const isl = defaults().island;
  noteSent(isl, 'ABCDEFGH', 'treat', '2026-11-10');
  noteSent(isl, 'ABCDEFGH', 'wave', '2026-11-10');
  assert.deepEqual(sentToday(isl, 'ABCDEFGH', '2026-11-10'), { day: '2026-11-10', treats: 1, waves: 1 });
  assert.equal(sentToday(isl, 'ABCDEFGH', '2026-11-11').treats, 0);
});

test('two devices: babies from both stay, care adds up, removed friend islands stay removed', () => {
  const a = kid(50);
  const b = kid(50);
  a.rewards.friends = [...SPECIES, 'owl.aaaaaa'];
  b.rewards.friends = [...SPECIES, 'pup.bbbbbb'];
  feed(a.rewards, 'fox', 'berry', new Date('2026-11-10T10:00:00'));
  feed(a.rewards, 'fox', 'berry', new Date('2026-11-10T10:05:00'));
  feed(b.rewards, 'fox', 'apple', new Date('2026-11-10T11:00:00'));
  a.island.friends = [{ code: 'AAAABBBB', name: 'Sofi', at: '2026-11-09T00:00:00Z' }];
  b.island.friends = [{ code: 'AAAABBBB', name: 'Sofi', at: '2026-11-10T00:00:00Z', gone: true }, { code: 'CCCCDDDD', name: 'Ana', at: '2026-11-10T00:00:00Z' }];
  b.island.code = 'ZZZZYYYY';
  b.savedAt = '2026-11-10T12:00:00Z';
  a.savedAt = '2026-11-10T11:00:00Z';
  const m = mergeData(a, b);
  assert.ok(m.rewards.friends.includes('owl.aaaaaa') && m.rewards.friends.includes('pup.bbbbbb'));
  assert.equal(m.rewards.care.fox.fed, 2);
  assert.equal(m.rewards.care.fox.today, 2);
  assert.equal(m.island.code, 'ZZZZYYYY');
  const sofi = m.island.friends.find((f) => f.code === 'AAAABBBB');
  assert.ok(sofi.gone);
  assert.ok(m.island.friends.some((f) => f.code === 'CCCCDDDD'));
  // and old saves without any of this still merge
  const old = kid(5);
  delete old.island;
  delete old.rewards.care;
  assert.ok(mergeData(old, a).island);
});
