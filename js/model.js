// The base-ten blocks model. Pure data + actions, no DOM.
// Every piece is a ten (rod) or a one (cube).
//   src:   'a' (first number), 'b' (second number), 'trade' (made by a trade)
//   state: 'in' (on the mat), 'tray' (waiting to be added), 'gone' (taken away)
import { tensOf, onesOf } from './math.js?v=5';

export function makeModel(p) {
  const m = { op: p.op, a: p.a, b: p.b, pieces: [], trades: 0, nextId: 1 };
  const add = (kind, src, state, n) => {
    for (let i = 0; i < n; i++) m.pieces.push({ id: m.nextId++, kind, src, state });
  };
  add('ten', 'a', 'in', tensOf(p.a));
  add('one', 'a', 'in', onesOf(p.a));
  if (p.op === '+') {
    add('ten', 'b', 'tray', tensOf(p.b));
    add('one', 'b', 'tray', onesOf(p.b));
  }
  return m;
}

export function cloneModel(m) {
  return { ...m, pieces: m.pieces.map((x) => ({ ...x })) };
}

export function counts(m) {
  const c = { tensIn: 0, onesIn: 0, tensTray: 0, onesTray: 0, tensGone: 0, onesGone: 0 };
  for (const x of m.pieces) {
    const k = (x.kind === 'ten' ? 'tens' : 'ones') + (x.state === 'in' ? 'In' : x.state === 'tray' ? 'Tray' : 'Gone');
    c[k]++;
  }
  return c;
}

export const value = (m) => {
  const c = counts(m);
  return c.tensIn * 10 + c.onesIn;
};

// ---- addition ----
export const canBringOnes = (m) => m.op === '+' && counts(m).onesTray > 0;
export const canBringTens = (m) => m.op === '+' && counts(m).tensTray > 0;
export function bringOnes(m) {
  m.pieces.forEach((x) => { if (x.kind === 'one' && x.state === 'tray') x.state = 'in'; });
}
export function bringTens(m) {
  m.pieces.forEach((x) => { if (x.kind === 'ten' && x.state === 'tray') x.state = 'in'; });
}
export const canTradeUp = (m) => m.op === '+' && counts(m).onesIn >= 10;
export function tradeUp(m) {
  if (!canTradeUp(m)) return false;
  let left = 10;
  m.pieces = m.pieces.filter((x) => {
    if (left > 0 && x.kind === 'one' && x.state === 'in') { left--; return false; }
    return true;
  });
  // the new ten goes after the existing tens on the mat
  const lastTen = m.pieces.reduce((acc, x, i) => (x.kind === 'ten' && x.state === 'in' ? i : acc), -1);
  m.pieces.splice(lastTen + 1, 0, { id: m.nextId++, kind: 'ten', src: 'trade', state: 'in' });
  m.trades++;
  return true;
}

// ---- subtraction ----
export function takeLeft(m) {
  const c = counts(m);
  return { tens: tensOf(m.b) - c.tensGone, ones: onesOf(m.b) - c.onesGone };
}
// Trade down only when it is needed: not enough ones left to take away.
export const canTradeDown = (m) => m.op === '-' && counts(m).tensIn > 0 && takeLeft(m).ones > counts(m).onesIn;
export function tradeDown(m) {
  if (!canTradeDown(m)) return false;
  // break the last ten on the mat (prefer one from the first number)
  let idx = -1;
  m.pieces.forEach((x, i) => { if (x.kind === 'ten' && x.state === 'in') idx = i; });
  const [ten] = m.pieces.splice(idx, 1);
  void ten;
  for (let i = 0; i < 10; i++) m.pieces.push({ id: m.nextId++, kind: 'one', src: 'trade', state: 'in' });
  m.trades++;
  return true;
}
export function canTake(m, kind) {
  if (m.op !== '-') return false;
  const left = takeLeft(m);
  const c = counts(m);
  return kind === 'ten' ? left.tens > 0 && c.tensIn > 0 : left.ones > 0 && c.onesIn > 0;
}
// Takes away one piece. If id is given, that piece; otherwise the last one on the mat.
export function takeOne(m, kind, id) {
  if (!canTake(m, kind)) return false;
  let piece = id != null ? m.pieces.find((x) => x.id === id && x.kind === kind && x.state === 'in') : null;
  if (!piece) {
    for (let i = m.pieces.length - 1; i >= 0; i--) {
      if (m.pieces[i].kind === kind && m.pieces[i].state === 'in') { piece = m.pieces[i]; break; }
    }
  }
  if (!piece) return false;
  piece.state = 'gone';
  return true;
}
export function takeAll(m, kind) {
  let n = 0;
  while (takeOne(m, kind)) n++;
  return n;
}
export const subtractionDone = (m) => {
  const l = takeLeft(m);
  return m.op === '-' && l.tens === 0 && l.ones === 0;
};

// Apply a named guided action. Returns true when it did something.
export function applyAction(m, act) {
  switch (act) {
    case 'bringOnes': if (!canBringOnes(m)) return false; bringOnes(m); return true;
    case 'bringTens': if (!canBringTens(m)) return false; bringTens(m); return true;
    case 'tradeUp': return tradeUp(m);
    case 'tradeDown': return tradeDown(m);
    case 'takeOnes': return takeAll(m, 'one') > 0;
    case 'takeTens': return takeAll(m, 'ten') > 0;
    default: return false;
  }
}

// Is the guided action finished? (Mila may do it piece by piece.)
export function actionDone(m, act, startTrades) {
  const c = counts(m);
  switch (act) {
    case 'bringOnes': return c.onesTray === 0;
    case 'bringTens': return c.tensTray === 0;
    case 'tradeUp':
    case 'tradeDown': return m.trades > startTrades;
    case 'takeOnes': return takeLeft(m).ones === 0;
    case 'takeTens': return takeLeft(m).tens === 0;
    default: return true;
  }
}
