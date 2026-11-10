// Each student's progress is also kept in the family's own Google Sheet (through a small
// Google Apps Script web app, cloud/Code.gs), so she can keep playing on any device.
//
// Every student has a cloud code (like "K7M2-Q9XF"). The code is the only way to
// reach her saved progress: the server keeps a scrambled fingerprint of it, not the
// code, and a grown-up sees it only inside the PIN-locked grown-ups area.
// The device still saves first, so the app works the same with no internet; it
// catches up later. When two devices both played, the progress is put together
// (js/merge.js) instead of one copy winning.
import { mergeData } from './merge.js?v=25';

export const SYNC_URL = 'https://script.google.com/macros/s/AKfycbyRKjyroG9efELUr9-dofSwvn6Qb-nsD_hCCMRItRBFbJ6NOBcffboNDEyCx5Inmy8rxQ/exec';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1: easy to read out loud
export function newCode(rng = null) {
  const bytes = new Uint8Array(8);
  if (rng) for (let i = 0; i < 8; i++) bytes[i] = Math.floor(rng() * 256);
  else crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % 32]).join('');
}
export const showCode = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
// What a grown-up typed, cleaned up: "k7m2 q9xf" -> "K7M2Q9XF" (null if it can't be a code)
export function readCode(s) {
  const c = String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/I/g, '1');
  return c.length === 8 && [...c].every((ch) => ALPHABET.includes(ch)) ? c : null;
}
export async function keyOf(code) {
  const bytes = new TextEncoder().encode(`rainbow-math-cloud:${code}`);
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const meta = (pl) => ({ id: pl.id, name: pl.name, friend: pl.friend, little: !!pl.little, pin: pl.pin || null, created: pl.created });

// io: { url, fetch, getPlayers, savePlayers, readData, writeData, onRemote(id, data), timeout }
export function createSync(io) {
  const state = { online: null, last: null, error: null };
  const busy = new Map(); // id -> running promise
  const seq = new Map(); // id -> how many saves so far (to know if one happened mid-upload)
  const timers = new Map();
  const fails = new Map(); // id -> uploads that failed in a row
  const url = () => io.url || SYNC_URL;

  async function call(body) {
    if (!url()) throw new Error('no cloud');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), io.timeout || 12000) : null;
    try {
      // text/plain keeps it a "simple" request, so the browser doesn't need extra permission
      const r = await (io.fetch || fetch)(url(), { method: 'POST', headers: { 'content-type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined, redirect: 'follow' });
      const out = await r.json();
      state.online = true;
      state.error = null;
      return out;
    } catch (e) {
      state.online = false;
      state.error = (e && e.message) || 'offline';
      throw e;
    } finally { if (t) clearTimeout(t); }
  }

  const find = (id) => io.getPlayers().players.find((x) => x.id === id);
  const savedAll = () => io.savePlayers(io.getPlayers());

  // Upload one student's progress (and make her a code the first time).
  async function push(id) {
    if (busy.has(id)) { busy.get(id).then(() => schedule(id, 50)); return; }
    const run = (async () => {
      // the players list can be re-read from storage while we wait, so look her up again each time
      const pl = () => find(id);
      if (!pl() || !url()) return;
      if (!pl().cloud) { Object.assign(pl(), { cloud: newCode(), rev: 0, dirty: true }); savedAll(); }
      if (!pl().dirty && pl().rev) return;
      const startSeq = seq.get(id) || 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const data = io.readData(id);
        if (!data || !pl()) return;
        const r = await call({ op: 'put', key: await keyOf(pl().cloud), base: pl().rev || 0, rec: { player: meta(pl()), data } });
        if (!pl()) return;
        if (r.ok) {
          pl().rev = r.rev;
          if ((seq.get(id) || 0) === startSeq) pl().dirty = false;
          state.last = new Date().toISOString();
          fails.delete(id);
          savedAll();
          return;
        }
        if (r.conflict) {
          const theirs = r.rec;
          // the saved copy is gone from the sheet: start it again
          if (!theirs) { pl().rev = 0; continue; }
          // the code belongs to someone else (almost never happens): get a new one
          if (!theirs.player || theirs.player.id !== id) { Object.assign(pl(), { cloud: newCode(), rev: 0 }); savedAll(); continue; }
          // another device saved first: put both together, then try again
          const merged = mergeData(io.readData(id), theirs.data);
          io.writeData(id, merged);
          pl().rev = r.rev;
          savedAll();
          if (io.onRemote) io.onRemote(id, merged, 'merged');
          continue;
        }
        throw new Error(r.error || 'cloud said no');
      }
    })().catch(() => {
      // offline or the cloud is busy: it stays marked and tries again a bit later (15 s, 30 s, 1 min… up to 5 min)
      const n = (fails.get(id) || 0) + 1;
      fails.set(id, n);
      schedule(id, Math.min(300000, 15000 * 2 ** (n - 1)));
    }).finally(() => busy.delete(id));
    busy.set(id, run);
    return run;
  }

  function schedule(id, ms = 2500) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => { timers.delete(id); push(id); }, ms));
  }

  // The device saved: remember it changed, and upload in a moment.
  function saved(id) {
    const pl = find(id);
    if (!pl) return;
    seq.set(id, (seq.get(id) || 0) + 1);
    if (!pl.dirty) { pl.dirty = true; savedAll(); }
    if (url()) schedule(id);
  }

  // Bring in what other devices saved. Returns the new data if something changed.
  async function pull(id) {
    if (!find(id) || !find(id).cloud || !url()) return null;
    if (busy.has(id)) await busy.get(id);
    const r = await call({ op: 'get', key: await keyOf(find(id).cloud) });
    const pl = find(id);
    if (!r.ok || !pl) return null;
    if (!r.found) { Object.assign(pl, { dirty: true, rev: 0 }); savedAll(); push(id); return null; }
    if (r.rev === pl.rev) return null;
    const remote = r.rec.data;
    const next = pl.dirty ? mergeData(io.readData(id), remote) : remote;
    if (!pl.dirty && r.rec.player) {
      const m = r.rec.player;
      Object.assign(pl, { name: m.name || pl.name, friend: m.friend || pl.friend, little: !!m.little, pin: m.pin || null });
    }
    io.writeData(id, next);
    pl.rev = r.rev;
    savedAll();
    if (pl.dirty) push(id);
    return next;
  }

  // A code typed on a new device: her progress comes here. If this device already has a
  // student with the same name, both are put together (it's the same child).
  async function join(code) {
    const r = await call({ op: 'get', key: await keyOf(code) });
    if (!r.ok || !r.found || !r.rec || !r.rec.player) return { ok: false };
    const list = io.getPlayers();
    const m = r.rec.player;
    let data = r.rec.data;
    let combined = false;
    const twin = list.players.find((x) => x.id !== m.id && x.cloud !== code && String(x.name).trim().toLowerCase() === String(m.name).trim().toLowerCase() && !!x.little === !!m.little);
    if (twin) {
      const theirs = io.readData(twin.id);
      if (theirs) { data = mergeData(data, theirs); combined = true; }
      list.players = list.players.filter((x) => x.id !== twin.id);
      if (list.last === twin.id) list.last = m.id;
      if (io.dropData) io.dropData(twin.id);
    }
    let pl = list.players.find((x) => x.id === m.id);
    if (pl) {
      const mine = io.readData(m.id);
      if (mine && pl.dirty) { data = mergeData(mine, data); combined = true; }
      Object.assign(pl, { name: m.name, friend: m.friend, little: !!m.little, pin: m.pin || null });
    } else {
      pl = { ...m };
      list.players.push(pl);
    }
    pl.cloud = code;
    pl.rev = r.rev;
    pl.dirty = combined;
    io.writeData(m.id, data);
    io.savePlayers(list);
    if (combined) push(m.id);
    return { ok: true, id: m.id, combined };
  }

  // Everyone on this device gets a code and goes up (the first time, and after being offline).
  function upAll() {
    if (!url()) return;
    for (const pl of io.getPlayers().players) if (!pl.cloud || pl.dirty) push(pl.id);
  }

  return { state, push, pull, saved, join, upAll, call, on: () => !!url() };
}
