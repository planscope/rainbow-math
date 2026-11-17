// Spelling words: the list from school each week, practiced so they make sense
// (each word in small parts, the tricky part shown, a sentence that uses it),
// then written from memory, like the Friday test. No DOM here, so it can be tested.
//
// Each word climbs 4 steps:
//   0 learn   look, listen, see its parts, trace it with a finger
//   1 build   put its letters in order
//   2 fill    write the missing letters (the tricky part)
//   3 spell   hear it and write it all from memory
//   4 known   spelled from memory; it still comes back in tests
// A miss moves the word one step back (never below "build"), so it gets more practice.

// Weeks from school. `parts` = the chunks to say and see; `tricky` = letters to notice.
export const WEEKS = [
  {
    id: '2026-11-16',
    label: { en: 'Week of November 16–20', es: 'Semana del 16 al 20 de noviembre' },
    words: [
      { w: 'answer', parts: ['an', 'swer'], tricky: 'w', tip: { en: 'The w is silent: we write it, but we don\'t say it.', es: 'La w no suena: se escribe, pero no se dice.' }, s: 'Raise your hand to answer the question.' },
      { w: 'blessed', parts: ['bless', 'ed'], tricky: 'ss', tip: { en: 'bless + ed. Two s\'s, and the ending -ed sounds like t.', es: 'bless + ed. Dos s, y el final -ed suena como t.' }, s: 'We feel blessed to be together.' },
      { w: 'common', parts: ['com', 'mon'], tricky: 'mm', tip: { en: 'Two m\'s in the middle: com + mon.', es: 'Dos m en medio: com + mon.' }, s: 'Cats and dogs are common pets.' },
      { w: 'comprehension', parts: ['com', 'pre', 'hen', 'sion'], tricky: 'sion', tip: { en: 'Four parts: com + pre + hen + sion. The end -sion says "shun".', es: 'Cuatro partes: com + pre + hen + sion. El final -sion suena "shun".' }, s: 'Reading comprehension means you understand what you read.' },
      { w: 'discover', parts: ['dis', 'cov', 'er'], tricky: 'dis', tip: { en: 'dis + cover! When you discover something, you take the cover off.', es: '¡dis + cover! Descubrir es quitarle la tapa (cover) a algo.' }, s: 'Let\'s discover what is inside the box.' },
      { w: 'gather', parts: ['gath', 'er'], tricky: 'th', tip: { en: 'Look for th in the middle: ga-TH-er.', es: 'Fíjate en la th en medio: ga-TH-er.' }, s: 'Our family will gather for a big dinner.' },
      { w: 'grateful', parts: ['grate', 'ful'], tricky: 'ful', tip: { en: 'grate + ful. The ending -ful has only ONE l.', es: 'grate + ful. El final -ful lleva solo UNA l.' }, s: 'I am grateful for my family.' },
      { w: 'proper', parts: ['prop', 'er'], tricky: 'er', tip: { en: 'prop + er. It ends with -er.', es: 'prop + er. Termina en -er.' }, s: 'Your name is a proper noun, so it starts with a capital letter.' },
      { w: 'question', parts: ['ques', 'tion'], tricky: 'qu', tip: { en: 'q always comes with u: qu. The end -tion says "chun".', es: 'La q siempre va con u: qu. El final -tion suena "chun".' }, s: 'Can I ask you a question?' },
      { w: 'Thanksgiving', parts: ['Thanks', 'giv', 'ing'], tricky: 'T', tip: { en: 'Thanks + giving. It\'s a holiday, so it starts with a big T.', es: 'Thanks + giving. Es un día festivo: empieza con T mayúscula.' }, s: 'We eat turkey on Thanksgiving.' },
    ],
  },
];

export const STEPS = ['learn', 'build', 'fill', 'spell', 'known'];
export const KNOWN = 4;

// ---------------------------------------------------------------- the list for this week
const today = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

// The newest school week that has started (or the first one), unless a grown-up typed a newer list.
export function currentList(sp = {}, now = new Date()) {
  const day = today(now);
  const started = WEEKS.filter((wk) => wk.id <= day);
  const wk = started.length ? started[started.length - 1] : WEEKS[0];
  const custom = sp.custom && Array.isArray(sp.custom.words) && sp.custom.words.length ? sp.custom : null;
  if (custom && String(custom.id || '') >= wk.id) {
    return { id: custom.id, label: custom.label ? { en: custom.label, es: custom.label } : wk.label, custom: true, words: custom.words.map((w) => infoFor(w)) };
  }
  return { id: wk.id, label: wk.label, custom: false, words: wk.words.map((x) => ({ ...x, parts: x.parts || [x.w] })) };
}

// A word a grown-up typed: use what we know about it, or make simple parts.
export function infoFor(word) {
  const w = cleanWord(word);
  for (const wk of WEEKS) {
    const hit = wk.words.find((x) => x.w.toLowerCase() === w.toLowerCase());
    if (hit) return { ...hit, w };
  }
  return { w, parts: guessParts(w), tricky: null, tip: null, s: null };
}

export const cleanWord = (s) => String(s || '').trim().replace(/[^A-Za-z'-]/g, '').slice(0, 24);

// A rough split into speakable parts (vowel groups), used only for typed-in words.
export function guessParts(w) {
  if (w.length <= 4) return [w];
  const out = [];
  let cur = '';
  const v = (c) => /[aeiouy]/i.test(c);
  for (let i = 0; i < w.length; i++) {
    cur += w[i];
    const rest = w.length - i - 1;
    // cut after a vowel group followed by consonant+vowel ("ta|ble"), or between two consonants ("win|ter")
    if (rest >= 2 && cur.length >= 2 && [...cur].some(v)) {
      const a = w[i], b = w[i + 1], c = w[i + 2];
      if ((v(a) && !v(b) && v(c)) || (!v(a) && !v(b) && v(c) && i > 0 && v(w[i - 1]))) {
        if (v(a)) { out.push(cur); cur = ''; } else { out.push(cur); cur = ''; }
      }
    }
  }
  if (cur) out.push(cur);
  // never leave a part with no vowel
  for (let i = out.length - 1; i > 0; i--) if (![...out[i]].some(v)) { out[i - 1] += out[i]; out.splice(i, 1); }
  return out.length ? out : [w];
}

// ---------------------------------------------------------------- how each word is going
const statOf = (sp, w) => ((sp.words || {})[w.toLowerCase()]) || { step: 0, right: 0, wrong: 0, seen: 0, last: '' };
export const wordStat = statOf;

function setStat(sp, w, st) {
  sp.words = { ...(sp.words || {}), [w.toLowerCase()]: st };
}

// She finished one exercise on a word. ok = right on the first try.
export function record(sp, w, ok, kind, now = new Date()) {
  const st = { ...statOf(sp, w) };
  st.seen += 1;
  st.last = now.toISOString();
  if (kind === 'learn') st.step = Math.max(st.step, 1);
  else if (ok) {
    st.right += 1;
    const to = { build: 2, fill: 3, spell: KNOWN, test: KNOWN }[kind] || st.step;
    st.step = Math.max(st.step, to);
  } else {
    st.wrong += 1;
    // one step back: building or filling stays at "build", writing from memory goes back to "fill"
    st.step = Math.max(1, Math.min(st.step, { build: 1, fill: 1, spell: 2, test: 2 }[kind] || st.step));
  }
  setStat(sp, w, st);
  return st;
}

export const stars = (st) => Math.min(3, Math.max(0, (st.step || 0) - 1)); // build done = 1, fill = 2, known = 3
export const knownCount = (sp, list) => list.words.filter((x) => statOf(sp, x.w).step >= KNOWN).length;

// What to practice now: the words furthest from known come first, mixed so the same
// word never comes twice in a row. Each item is the next step for that word.
export function plan(sp, list, n = 8, rng = Math.random) {
  const words = list.words.map((x) => ({ x, st: statOf(sp, x.w), r: rng() }));
  words.sort((a, b) => a.st.step - b.st.step || a.r - b.r);
  const items = [];
  // new words get learned first (a few at a time), then everyone practices
  const fresh = words.filter((o) => o.st.step === 0).slice(0, 4);
  for (const o of fresh) items.push({ w: o.x.w, kind: 'learn' });
  const pool = words.filter((o) => o.st.step > 0 || fresh.includes(o));
  let i = 0;
  while (items.length < n && pool.length) {
    const o = pool[i % pool.length];
    const step = o.st.step === 0 ? 1 : Math.min(o.st.step, 3); // known words get spelled again
    items.push({ w: o.x.w, kind: STEPS[step] });
    i++;
    if (i > n * 3) break;
  }
  // after learning a word, its practice comes later (not right away)
  const learn = items.filter((it) => it.kind === 'learn');
  const rest = items.filter((it) => it.kind !== 'learn');
  for (let k = 1; k < rest.length; k++) if (rest[k].w === rest[k - 1].w) { const j = rest.findIndex((it, z) => z > k && it.w !== rest[k].w); if (j > 0) [rest[k], rest[j]] = [rest[j], rest[k]]; }
  return [...learn, ...rest].slice(0, Math.max(n, learn.length));
}

// ---------------------------------------------------------------- exercises
// Build: her word's letters, mixed (never already in order).
export function tiles(w, rng = Math.random) {
  const letters = [...w].map((c, i) => ({ id: i, c }));
  if (letters.length < 2) return letters;
  for (let tries = 0; tries < 20; tries++) {
    for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
    if (letters.map((x) => x.c).join('') !== w) break;
  }
  return letters;
}

// Fill: which letters to hide. The tricky part if there is one, otherwise about a third.
export function holes(info, rng = Math.random) {
  const w = info.w;
  const hide = new Set();
  if (info.tricky) {
    const at = w.indexOf(info.tricky);
    if (at >= 0) for (let i = 0; i < info.tricky.length; i++) hide.add(at + i);
  }
  const want = Math.max(2, Math.round(w.length / 3));
  let guard = 0;
  while (hide.size < Math.min(want, w.length - 1) && guard++ < 100) hide.add(Math.floor(rng() * w.length));
  return [...hide].sort((a, b) => a - b);
}

// Is what she wrote the word? Capitals don't fail a word, but we say so.
export function check(w, typed) {
  const t = String(typed || '').trim();
  if (t === w) return { ok: true, exact: true };
  if (t.toLowerCase() === w.toLowerCase()) return { ok: true, exact: false, capital: /^[A-Z]/.test(w) && !/^[A-Z]/.test(t) };
  return { ok: false, diff: diff(w, t) };
}

// Letter by letter: which ones were right, so she sees just the part to fix.
export function diff(w, t) {
  const a = w.toLowerCase();
  const b = String(t || '').toLowerCase();
  // longest common subsequence: keep letters she got in the right order
  const m = a.length, n = b.length;
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? 1 + L[i + 1][j + 1] : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < m) {
    if (j < n && a[i] === b[j]) { out.push({ c: w[i], ok: true }); i++; j++; }
    else if (j < n && L[i][j + 1] >= L[i + 1][j]) j++;
    else { out.push({ c: w[i], ok: false }); i++; }
  }
  return out;
}

// A practice test: every word once, in a new order.
export function testOrder(list, rng = Math.random) {
  const ws = list.words.map((x) => x.w);
  for (let i = ws.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ws[i], ws[j]] = [ws[j], ws[i]]; }
  return ws;
}

// ---------------------------------------------------------------- voice
// Recordings per word: the word on its own, the word in its sentence, and the word
// spelled out ("answer. A, N, S, W, E, R. answer."), all in one take each so it flows.
export const slug = (w) => w.toLowerCase().replace(/[^a-z]/g, '');
export const wordClip = (w) => `en-rd-sw-${slug(w)}`;
export const sentenceClip = (w) => `en-sw-s-${slug(w)}`;
export const spelledClip = (w) => `en-sw-sp-${slug(w)}`;
export const spelledText = (w) => `${w}. ${[...w].filter((c) => /[a-z]/i.test(c)).map((c) => c.toUpperCase()).join(', ')}. ${w}.`;

// Every recording the spelling words need (for tools/eleven.mjs).
export function allSpellPieces() {
  const out = {};
  for (const wk of WEEKS) {
    for (const x of wk.words) {
      out[wordClip(x.w)] = { lang: 'en', key: 'rd', text: `${x.w}.` };
      if (x.s) out[sentenceClip(x.w)] = { lang: 'en', key: 'sw', text: `[cheerful] ${x.w}. ${x.s} ${x.w}.` };
      out[spelledClip(x.w)] = { lang: 'en', key: 'sw', text: `[slowly] ${spelledText(x.w)}` };
    }
  }
  return out;
}

export const spellClips = (info) => [spelledClip(info.w)];
