/**
 * Rainbow Math saves: each student's progress, one row each, in this Google Sheet.
 * The app sends { op: 'get' | 'put', key, base, rec }.
 *   key  = SHA-256 fingerprint of the student's cloud code (the code itself never arrives)
 *   base = the version the device last saw; a put only lands if nobody saved in between,
 *          otherwise the newer copy comes back so the device can put both together.
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

/** Run once from the editor (Run ▸ setup) so Google asks you to allow this Sheet. */
function setup() {
  sheet_();
  Logger.log('Ready: the saves tab exists.');
}
