import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../js/store.js';
import { mergeData } from '../js/merge.js';
import { WEEKS, currentList, infoFor, guessParts, plan, tiles, holes, check, diff, record, wordStat, stars, knownCount, testOrder, spellClips, allSpellPieces, KNOWN } from '../js/spell.js';

const week = WEEKS.find((w) => w.id === '2026-11-16');
const sp = () => defaults().spelling;

test('this week: the 10 words from school, each in parts that spell it', () => {
  assert.deepEqual(week.words.map((x) => x.w), ['answer', 'blessed', 'common', 'comprehension', 'discover', 'gather', 'grateful', 'proper', 'question', 'Thanksgiving']);
  for (const x of week.words) {
    assert.equal(x.parts.join(''), x.w, x.w);
    assert.ok(x.w.includes(x.tricky), `${x.w} tricky part`);
    assert.ok(x.s && x.s.toLowerCase().includes(x.w.toLowerCase()), `${x.w} sentence uses it`);
    assert.ok(x.tip.en && x.tip.es);
  }
  const list = currentList(sp(), new Date('2026-11-17T10:00:00'));
  assert.equal(list.id, '2026-11-16');
  assert.equal(list.words.length, 10);
});

test('a list typed by a grown-up is used until a newer school list arrives', () => {
  const s = sp();
  s.custom = { id: '2026-11-18', label: 'Extra', words: ['answer', 'rainbow', 'turkey'], at: '2026-11-18T10:00:00Z' };
  const l = currentList(s, new Date('2026-11-18T12:00:00'));
  assert.ok(l.custom);
  assert.equal(l.words[0].tip.en.length > 0, true, 'a known word keeps its tip');
  assert.equal(l.words[1].parts.join(''), 'rainbow');
});

test('typed words get speakable parts that still spell the word', () => {
  for (const w of ['rainbow', 'turkey', 'beautiful', 'family', 'cat', 'November']) {
    const p = guessParts(w);
    assert.equal(p.join(''), w);
    for (const part of p) assert.ok(/[aeiouy]/i.test(part), `${w}: ${p}`);
  }
});

test('each word climbs learn → build → fill → spell → known, and a miss steps back', () => {
  const s = sp();
  record(s, 'answer', true, 'learn');
  assert.equal(wordStat(s, 'answer').step, 1);
  record(s, 'answer', true, 'build');
  record(s, 'answer', true, 'fill');
  assert.equal(stars(wordStat(s, 'answer')), 2);
  record(s, 'answer', true, 'spell');
  assert.equal(wordStat(s, 'answer').step, KNOWN);
  assert.equal(stars(wordStat(s, 'answer')), 3);
  record(s, 'answer', false, 'test');
  assert.equal(wordStat(s, 'answer').step, 2, 'missed on a test: back to filling the tricky part');
  record(s, 'answer', false, 'build');
  assert.equal(wordStat(s, 'answer').step, 1, 'never below build');
});

test('practice: new words are learned first, then the weakest words are practiced', () => {
  const s = sp();
  const list = currentList(s, new Date('2026-11-17'));
  const first = plan(s, list, 8, () => 0.5);
  assert.equal(first.filter((x) => x.kind === 'learn').length, 4);
  assert.ok(first.length >= 8);
  for (const x of list.words) record(s, x.w, true, 'learn');
  for (const x of list.words.slice(0, 9)) { record(s, x.w, true, 'build'); record(s, x.w, true, 'fill'); record(s, x.w, true, 'spell'); }
  const later = plan(s, list, 8, () => 0.5);
  assert.equal(later[0].w, 'Thanksgiving', 'the only word not known yet comes first');
  assert.equal(later[0].kind, 'build');
  for (let i = 1; i < later.length; i++) assert.notEqual(later[i].w, later[i - 1].w, 'never the same word twice in a row');
  assert.equal(knownCount(s, list), 9);
});

test('build tiles are the word letters, mixed; fill hides the tricky part', () => {
  const t = tiles('common', () => 0.3);
  assert.equal(t.map((x) => x.c).sort().join(''), [...'common'].sort().join(''));
  assert.notEqual(t.map((x) => x.c).join(''), 'common');
  const info = infoFor('grateful');
  const hs = holes(info, () => 0.1);
  const at = 'grateful'.indexOf('ful');
  for (let i = 0; i < 3; i++) assert.ok(hs.includes(at + i));
  assert.ok(hs.length < 'grateful'.length);
});

test('checking: exact, a missing capital (right, with a reminder), and which letters to fix', () => {
  assert.deepEqual(check('answer', 'answer'), { ok: true, exact: true });
  const c = check('Thanksgiving', 'thanksgiving');
  assert.ok(c.ok && c.capital);
  const miss = check('answer', 'anser');
  assert.equal(miss.ok, false);
  assert.deepEqual(miss.diff.filter((d) => !d.ok).map((d) => d.c), ['w']);
  assert.deepEqual(diff('blessed', 'blesed').filter((d) => !d.ok).length, 1);
});

test('a practice test asks every word once', () => {
  const list = currentList(sp(), new Date('2026-11-17'));
  const order = testOrder(list, () => 0.42);
  assert.equal(new Set(order).size, 10);
});

test('every word is recorded on its own, in its sentence, and spelled out', () => {
  assert.deepEqual(spellClips(infoFor('answer')), ['en-sw-sp-answer']);
  const all = allSpellPieces();
  assert.match(all['en-sw-sp-answer'].text, /answer\. A, N, S, W, E, R\. answer\./);
  assert.match(all['en-sw-sp-thanksgiving'].text, /T, H, A, N, K, S, G, I, V, I, N, G/);
  assert.ok(all['en-sw-s-thanksgiving'] && all['en-rd-sw-thanksgiving']);
});

test('two devices: the most practice per word and every test are kept', () => {
  const a = defaults();
  const b = defaults();
  record(a.spelling, 'answer', true, 'learn');
  record(a.spelling, 'answer', true, 'build');
  record(b.spelling, 'gather', true, 'learn');
  a.spelling.tests = [{ date: '2026-11-17T10:00:00Z', mode: 'test', week: '2026-11-16', n: 10, k: 8 }];
  b.spelling.tests = [{ date: '2026-11-18T10:00:00Z', mode: 'paper', week: '2026-11-16', n: 10, k: 10 }];
  const m = mergeData(a, b);
  assert.equal(m.spelling.words.answer.step, 2);
  assert.equal(m.spelling.words.gather.step, 1);
  assert.equal(m.spelling.tests.length, 2);
  // and a grown-up going back to the school list on one device wins over an older typed list
  a.spelling.custom = { id: '2026-11-17', words: ['x'], at: '2026-11-17T10:00:00Z' };
  b.spelling.clearedAt = '2026-11-18T10:00:00Z';
  assert.equal(mergeData(a, b).spelling.custom, null);
});
