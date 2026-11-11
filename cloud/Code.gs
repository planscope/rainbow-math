/**
 * Rainbow Math saves: each student's progress, one row each, in this Google Sheet.
 * The app sends { op: 'get' | 'put', key, base, rec }.
 *   key  = SHA-256 fingerprint of the student's cloud code (the code itself never arrives)
 *   base = the version the device last saw; a put only lands if nobody saved in between,
 *          otherwise the newer copy comes back so the device can put both together.
 * Islands (tab "islands"): what friends may see of a child's island, and what they left there.
 *   island-put   { key, owner, snap }  the child's own device updates her island
 *   island-get   { key }               a friend looks at it (no gifts, no owner)
 *   gift         { key, gift }         a friend leaves a treat or a wave
 *   island-inbox { key, owner }        the child's device picks up the gifts (they are then removed)
 *   island-off   { key, owner }        a grown-up turned visits off: the row is deleted
 *   key   = fingerprint of the island code; owner = a key only the child's devices can make.
 * Only this one Sheet can be touched (@OnlyCurrentDoc).
 * @OnlyCurrentDoc
 */
const MAX_BYTES = 300000; // one student is about 20–60 KB
const CHUNK = 45000; // a cell holds up to 50,000 characters
const FIRST_DATA_COL = 5; // A key | B version | C saved | D name | E… data

function doGet() {
  return out({ ok: true, app: 'rainbow-math' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out({ ok: false, error: 'bad request' }); }
  if (!req || !/^[0-9a-f]{64}$/.test(String(req.key || ''))) return out({ ok: false, error: 'bad key' });
  if (/^island-|^gift$/.test(String(req.op))) return islandOp_(req);
  const sh = sheet_();
  if (req.op === 'get') {
    const row = findRow_(sh, req.key);
    if (!row) return out({ ok: true, found: false });
    return out({ ok: true, found: true, rev: Number(sh.getRange(row, 2).getValue()) || 0, rec: readRec_(sh, row) });
  }
  if (req.op === 'put') {
    const body = JSON.stringify(req.rec || null);
    if (!req.rec || !req.rec.data || body.length > MAX_BYTES) return out({ ok: false, error: 'too big or empty' });
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      let row = findRow_(sh, req.key);
      const cur = row ? Number(sh.getRange(row, 2).getValue()) || 0 : 0;
      if (cur !== (Number(req.base) || 0)) return out({ ok: false, conflict: true, rev: cur, rec: row ? readRec_(sh, row) : null });
      if (!row) row = sh.getLastRow() + 1;
      const parts = [];
      for (let i = 0; i < body.length; i += CHUNK) parts.push('~' + body.slice(i, i + CHUNK)); // "~" keeps Sheets from reading it as a number or formula
      const need = FIRST_DATA_COL - 1 + parts.length;
      if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
      sh.getRange(row, 1, 1, sh.getMaxColumns()).clearContent();
      const name = String((req.rec.player && req.rec.player.name) || '').slice(0, 20);
      sh.getRange(row, 1, 1, need).setValues([[req.key, cur + 1, new Date(), name].concat(parts)]);
      return out({ ok: true, rev: cur + 1 });
    } finally {
      lock.releaseLock();
    }
  }
  return out({ ok: false, error: 'unknown op' });
}

function readRec_(sh, row) {
  const width = sh.getLastColumn() - FIRST_DATA_COL + 1;
  if (width < 1) return null;
  const cells = sh.getRange(row, FIRST_DATA_COL, 1, width).getValues()[0];
  const text = cells.filter(function (c) { return c !== ''; }).map(function (c) { return String(c).slice(1); }).join('');
  try { return JSON.parse(text); } catch (x) { return null; }
}

function findRow_(sh, key) {
  if (sh.getLastRow() < 2) return 0;
  const hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(key).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('saves');
  if (!sh) {
    sh = ss.insertSheet('saves');
    sh.getRange(1, 1, 1, 5).setValues([['key', 'version', 'saved', 'student', 'progress (do not edit)']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- islands
const FOODS = ['berry', 'carrot', 'fish', 'apple', 'honey', 'cookie', 'corn', 'banana'];
const WAVES = ['wave', 'heart', 'star', 'rainbow'];
const MAX_SNAP = 40000;
const MAX_GIFTS = 40; // waiting on one island (the oldest go first)

function islandOp_(req) {
  const sh = islandSheet_();
  const owner = String(req.owner || '');
  const mine = (row) => /^[0-9a-f]{64}$/.test(owner) && String(sh.getRange(row, 2).getValue()) === digest_(owner);
  if (req.op === 'island-get') {
    const row = findRow_(sh, req.key);
    if (!row) return out({ ok: true, found: false });
    return out({ ok: true, found: true, snap: cell_(sh.getRange(row, 5).getValue()) });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const row = findRow_(sh, req.key);
    if (req.op === 'island-put') {
      if (!/^[0-9a-f]{64}$/.test(owner)) return out({ ok: false, error: 'bad owner' });
      const snap = JSON.stringify(req.snap || null);
      if (!req.snap || snap.length > MAX_SNAP) return out({ ok: false, error: 'too big or empty' });
      if (row && !mine(row)) return out({ ok: false, error: 'not yours' });
      const at = row || sh.getLastRow() + 1;
      const gifts = row ? sh.getRange(row, 6).getValue() : '';
      const name = String(req.snap.name || '').slice(0, 20);
      sh.getRange(at, 1, 1, 6).setValues([[req.key, digest_(owner), new Date(), name, '~' + snap, gifts]]);
      return out({ ok: true });
    }
    if (req.op === 'gift') {
      if (!row) return out({ ok: false, error: 'no island' });
      const g = req.gift || {};
      const food = FOODS.indexOf(g.food) >= 0 ? g.food : null;
      const wave = WAVES.indexOf(g.wave) >= 0 ? g.wave : null;
      const critter = /^[a-z]{2,10}(\.[a-z0-9]{6})?$/.test(String(g.critter || '')) ? g.critter : null;
      if (!wave && !(food && critter)) return out({ ok: false, error: 'bad gift' });
      const list = cell_(sh.getRange(row, 6).getValue()) || [];
      list.push({
        id: String(g.id || '').replace(/[^0-9a-z]/gi, '').slice(0, 12) || Utilities.getUuid().slice(0, 8),
        at: new Date().toISOString(),
        from: String(g.from || '').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 20),
        critter: food ? critter : null,
        food: food,
        wave: wave,
      });
      sh.getRange(row, 6).setValue('~' + JSON.stringify(list.slice(-MAX_GIFTS)));
      return out({ ok: true });
    }
    if (req.op === 'island-inbox') {
      if (!row) return out({ ok: true, gifts: [] });
      if (!mine(row)) return out({ ok: false, error: 'not yours' });
      const list = cell_(sh.getRange(row, 6).getValue()) || [];
      if (list.length) sh.getRange(row, 6).setValue('');
      return out({ ok: true, gifts: list });
    }
    if (req.op === 'island-off') {
      if (row && !mine(row)) return out({ ok: false, error: 'not yours' });
      if (row) sh.deleteRow(row);
      return out({ ok: true });
    }
  } finally {
    lock.releaseLock();
  }
  return out({ ok: false, error: 'unknown op' });
}

function cell_(v) {
  const t = String(v || '');
  if (!t) return null;
  try { return JSON.parse(t.charAt(0) === '~' ? t.slice(1) : t); } catch (x) { return null; }
}

function digest_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function islandSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('islands');
  if (!sh) {
    sh = ss.insertSheet('islands');
    sh.getRange(1, 1, 1, 6).setValues([['island', 'owner', 'updated', 'student', 'what friends see (do not edit)', 'gifts waiting']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Run once from the editor (Run ▸ setup) so Google asks you to allow this Sheet. */
function setup() {
  sheet_();
  islandSheet_();
  Logger.log('Ready: the saves tab exists.');
}
