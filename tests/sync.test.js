import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults } from '../js/store.js';
import { mergeData } from '../js/merge.js';
import { createSync, readCode, showCode, newCode } from '../js/sync.js';

// The same rules as cloud/Code.gs, in memory.
function fakeCloud() {
  const rows = new Map();
  let up = true;
  const fetch = async (url, opt) => {
    if (!up) throw new Error('offline');
    const req = JSON.parse(opt.body);
    let res;
    if (req.op === 'get') {
      const r = rows.get(req.key);
      res = r ? { ok: true, found: true, rev: r.rev, rec: JSON.parse(r.body) } : { ok: true, found: false };
    } else {
      const r = rows.get(req.key);
      const cur = r ? r.rev : 0;
      if (cur !== (req.base || 0)) res = { ok: false, conflict: true, rev: cur, rec: r ? JSON.parse(r.body) : null };
      else { rows.set(req.key, { rev: cur + 1, body: JSON.stringify(req.rec) }); res = { ok: true, rev: cur + 1 }; }
    }
    return { json: async () => JSON.parse(JSON.stringify(res)) };
  };
  return { fetch, rows, setUp: (v) => { up = v; } };
}

// One iPad: its own players list and saved data.
function device(cloud) {
  const store = { players: { players: [], last: null }, data: new Map() };
  const sync = createSync({
    url: 'https://cloud.test', fetch: cloud.fetch, timeout: 1000,
    getPlayers: () => store.players,
    savePlayers: (l) => { store.players = JSON.parse(JSON.stringify(l)); },
    readData: (id) => (store.data.has(id) ? JSON.parse(JSON.stringify(store.data.get(id))) : null),
    writeData: (id, d) => store.data.set(id, JSON.parse(JSON.stringify(d))),
    dropData: (id) => store.data.delete(id),
  });
  const play = async (id, fn) => { const d = store.data.get(id); fn(d); d.savedAt = new Date().toISOString(); sync.saved(id); await sync.push(id); };
  return { store, sync, play };
}
const kid = (id, name, extra = {}) => ({ id, name, friend: 'fox', pin: 'h', created: '2026-11-01', ...extra });

test('codes are easy to read and type', () => {
  const c = newCode();
  assert.equal(c.length, 8);
  assert.equal(readCode(showCode(c).toLowerCase()), c);
  assert.equal(readCode('abc'), null);
});

test('progress made on one iPad shows up on another', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  a.store.players.players.push(kid('mila', 'Mila'));
  a.store.data.set('mila', defaults());
  await a.play('mila', (d) => { d.progress.path.level = 12; d.rewards.pieces = 40; d.rewards.friends = ['owl']; });
  const code = a.store.players.players[0].cloud;
  assert.ok(code, 'she got a cloud code');
  assert.equal(a.store.players.players[0].dirty, false);

  const b = device(cloud);
  const r = await b.sync.join(code);
  assert.equal(r.ok, true);
  assert.equal(b.store.data.get('mila').progress.path.level, 12);
  assert.equal(b.store.players.players[0].pin, 'h', 'her PIN works there too');

  await b.play('mila', (d) => { d.progress.path.level = 13; d.rewards.pieces = 45; });
  const got = await a.sync.pull('mila');
  assert.equal(got.progress.path.level, 13);
  assert.equal(a.store.data.get('mila').rewards.pieces, 45);
});

test('two iPads played offline at the same time: both are kept', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  a.store.players.players.push(kid('mila', 'Mila'));
  a.store.data.set('mila', defaults());
  await a.play('mila', (d) => { d.progress.path.level = 5; });
  const b = device(cloud);
  await b.sync.join(a.store.players.players[0].cloud);

  cloud.setUp(false);
  await a.play('mila', (d) => { d.progress.path.level = 8; d.rewards.friends = ['owl']; d.quizzes = [{ date: '2026-11-10T10:00:00Z', level: 5 }]; });
  await b.play('mila', (d) => { d.progress.path.level = 6; d.rewards.friends = ['cat']; d.rewards.pieces = 30; d.quizzes = [{ date: '2026-11-10T11:00:00Z', level: 5 }]; });
  cloud.setUp(true);
  await b.sync.push('mila');
  await a.sync.push('mila'); // conflict: puts both together
  const final = a.store.data.get('mila');
  assert.equal(final.progress.path.level, 8);
  assert.deepEqual([...final.rewards.friends].sort(), ['cat', 'owl']);
  assert.equal(final.rewards.pieces, 30);
  assert.equal(final.quizzes.length, 2);
  await b.sync.pull('mila');
  assert.equal(b.store.data.get('mila').progress.path.level, 8);
});

test('joining with a code combines the same child already on this device', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  a.store.players.players.push(kid('mila', 'Mila'));
  a.store.data.set('mila', defaults());
  await a.play('mila', (d) => { d.progress.path.level = 20; });
  const b = device(cloud);
  b.store.players.players.push(kid('p2', 'mila'));
  const local = defaults();
  local.rewards.friends = ['bee'];
  local.progress.path.level = 4;
  b.store.data.set('p2', local);
  const r = await b.sync.join(a.store.players.players[0].cloud);
  assert.equal(r.combined, true);
  assert.equal(b.store.players.players.length, 1);
  assert.equal(b.store.data.get('mila').progress.path.level, 20);
  assert.deepEqual(b.store.data.get('mila').rewards.friends, ['bee']);
  assert.equal(b.store.data.has('p2'), false);
});

test('a wrong code finds nothing and changes nothing', async () => {
  const b = device(fakeCloud());
  const r = await b.sync.join('ABCDEFGH');
  assert.equal(r.ok, false);
  assert.equal(b.store.players.players.length, 0);
});

test('a grown-up lowering the level on one iPad is not undone by the other', async () => {
  const cloud = fakeCloud();
  const a = device(cloud);
  a.store.players.players.push(kid('mila', 'Mila'));
  a.store.data.set('mila', defaults());
  await a.play('mila', (d) => { d.progress.path.level = 30; });
  const b = device(cloud);
  await b.sync.join(a.store.players.players[0].cloud);
  await a.play('mila', (d) => { d.progress.path.level = 22; });
  await b.sync.pull('mila'); // b had no changes of its own: it takes the new copy as is
  assert.equal(b.store.data.get('mila').progress.path.level, 22);
});

test('merge: the further path wins, settings follow the newer copy', () => {
  const a = defaults(); a.progress.path = { level: 9, stars: 2, best: 9 }; a.settings.lang = 'es'; a.savedAt = '2026-11-10T12:00:00Z';
  const b = defaults(); b.progress.path = { level: 9, stars: 4, best: 10 }; b.settings.lang = 'en'; b.savedAt = '2026-11-10T09:00:00Z';
  b.progress.skills.C.attempts = 50; b.progress.skills.C.level = 3;
  const m = mergeData(a, b);
  assert.equal(m.progress.path.stars, 4);
  assert.equal(m.progress.path.best, 10);
  assert.equal(m.settings.lang, 'es');
  assert.equal(m.progress.skills.C.level, 3);
});
