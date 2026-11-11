// Visiting friends' islands, between families.
//
// A grown-up turns visits on for a child and gets an island code (different from the
// progress code) to give to a friend's grown-up. Anyone with that code sees only the
// island: first name, island friends, rainbow pieces. Never levels, PINs or codes.
// Visitors can leave a treat for one island friend, or a wave. There is no chat.
//
// Only the device that also knows the child's progress code can change or close her
// island (the server keeps a fingerprint of a key made from it).
import { islandSnap, cleanGift } from './critters.js?v=26';

async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const islandKey = (code) => sha(`rainbow-math-island:${code}`);
export const ownerKey = (cloud) => sha(`rainbow-math-owner:${cloud}`);

// call: the cloud's call(body) from js/sync.js
export function createIslands(call) {
  const sentSnap = new Map(); // island code -> what was last uploaded

  async function put(isl, cloud, player, data, force = false) {
    if (!isl.code || !cloud) return { ok: false, error: 'no code' };
    const snap = islandSnap(player, data);
    const text = JSON.stringify(snap);
    if (!force && sentSnap.get(isl.code) === text) return { ok: true, same: true };
    const r = await call({ op: 'island-put', key: await islandKey(isl.code), owner: await ownerKey(cloud), snap });
    if (r.ok) sentSnap.set(isl.code, text);
    return r;
  }

  async function get(code) {
    const r = await call({ op: 'island-get', key: await islandKey(code) });
    return r.ok && r.found ? r.snap : null;
  }

  async function gift(code, g) {
    const clean = cleanGift({ ...g, id: String(Math.random()).slice(2, 12), at: new Date().toISOString() });
    if (!clean) return { ok: false };
    return call({ op: 'gift', key: await islandKey(code), gift: clean });
  }

  // What friends left since last time (the server forgets them once they're picked up).
  async function inbox(isl, cloud) {
    if (!isl.code || !cloud) return [];
    const r = await call({ op: 'island-inbox', key: await islandKey(isl.code), owner: await ownerKey(cloud) });
    return r.ok ? r.gifts || [] : [];
  }

  async function close(code, cloud) {
    sentSnap.delete(code);
    return call({ op: 'island-off', key: await islandKey(code), owner: await ownerKey(cloud) });
  }

  return { put, get, gift, inbox, close };
}
