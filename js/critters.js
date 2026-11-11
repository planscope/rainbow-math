// Island friends that never run out, the treats she earns by solving, and how each
// friend is doing. No DOM here, so it can be tested.
//
// The first 12 friends are the named ones ('fox', 'bunny', ...). After those, every
// finished adventure hatches a new baby friend: one of the 12 kinds, in its own color,
// with its own little hat or bow and its own name. A baby's id carries everything
// about it ('bunny.k3x9qa'), so two devices always draw the same friend.
import { CREATURE_NAMES, CREATURE_ORDER } from './i18n.js?v=26';

export const SPECIES = CREATURE_ORDER;

// e: the picture; en/es: its name; a: with "a/una" (for sentences)
export const FOODS = {
  berry: { e: '\u{1F353}', en: 'strawberry', es: 'fresa', a: { en: 'a strawberry', es: 'una fresa' } },
  carrot: { e: '\u{1F955}', en: 'carrot', es: 'zanahoria', a: { en: 'a carrot', es: 'una zanahoria' } },
  fish: { e: '\u{1F41F}', en: 'fish', es: 'pescadito', a: { en: 'a fish', es: 'un pescadito' } },
  apple: { e: '\u{1F34E}', en: 'apple', es: 'manzana', a: { en: 'an apple', es: 'una manzana' } },
  honey: { e: '\u{1F36F}', en: 'honey', es: 'miel', a: { en: 'some honey', es: 'miel' } },
  cookie: { e: '\u{1F36A}', en: 'cookie', es: 'galleta', a: { en: 'a cookie', es: 'una galleta' } },
  corn: { e: '\u{1F33D}', en: 'corn', es: 'elote', a: { en: 'some corn', es: 'un elote' } },
  banana: { e: '\u{1F34C}', en: 'banana', es: 'plátano', a: { en: 'a banana', es: 'un plátano' } },
};
export const FOOD_KEYS = Object.keys(FOODS);
// what each of the 12 named friends likes best
const BASE_FAV = { fox: 'berry', bunny: 'carrot', turtle: 'apple', bird: 'corn', jelly: 'berry', crab: 'fish', dragon: 'apple', pup: 'cookie', owl: 'banana', penguin: 'fish', pony: 'carrot', lion: 'honey' };

export const WAVES = {
  wave: '\u{1F44B}',
  heart: '\u{2764}\u{FE0F}',
  star: '\u{2B50}',
  rainbow: '\u{1F308}',
};

// Colors for babies (turns of the color wheel) and the things they wear.
const HUES = [35, 70, 120, 165, 200, 240, 285, 320];
export const ACCS = ['bow', 'crown', 'flower', 'hat', 'star', 'leaf', 'heart', 'beanie', 'none'];
// Names that sound sweet in English and Spanish (and never mean something rude in either).
const NAMES = ['Pip', 'Bobo', 'Mimi', 'Lulu', 'Kiki', 'Zuzu', 'Momo', 'Fifi', 'Coco', 'Tico', 'Poppy', 'Suki',
  'Tilly', 'Dot', 'Bean', 'Biscuit', 'Noodle', 'Button', 'Clover', 'Maple', 'Peaches', 'Pudding', 'Sprinkles', 'Muffin',
  'Waffles', 'Daisy', 'Ruby', 'Opal', 'Pearl', 'Indigo', 'Echo', 'Nova', 'Luz', 'Nube', 'Chispa', 'Paloma',
  'Canela', 'Galleta', 'Miel', 'Mango', 'Kiwi', 'Fresa', 'Lucero', 'Estrella', 'Nieve', 'Ziggy', 'Pompom', 'Tofu',
  'Mochi', 'Boba', 'Wren', 'Juniper', 'Twig', 'Fig', 'Plum', 'Taffy', 'Gumdrop', 'Jojo', 'Cupcake', 'Jellybean',
  'Marshmallow', 'Bombón', 'Chiquis', 'Rayito'];
const KIND = {
  en: { fox: 'Fox', bunny: 'Bunny', turtle: 'Turtle', bird: 'Bird', jelly: 'Jellyfish', crab: 'Crab', dragon: 'Dragon', pup: 'Puppy', owl: 'Owl', penguin: 'Penguin', pony: 'Pony', lion: 'Lion Cub' },
  es: { fox: 'la zorrita', bunny: 'la conejita', turtle: 'la tortuga', bird: 'la pajarita', jelly: 'la medusa', crab: 'el cangrejito', dragon: 'el dragoncito', pup: 'el perrito', owl: 'el búho', penguin: 'el pingüino', pony: 'la ponita', lion: 'el leoncito' },
};

const ID_RE = /^([a-z]{2,10})(?:\.([a-z0-9]{6}))?$/;
export const isCritterId = (id) => {
  const m = ID_RE.exec(String(id || ''));
  return !!m && SPECIES.includes(m[1]);
};

function hash(s) {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

// Everything about one friend, from its id.
export function critterOf(id) {
  const m = ID_RE.exec(String(id || ''));
  const species = m && SPECIES.includes(m[1]) ? m[1] : 'fox';
  const seed = m && m[2];
  if (!seed) return { id, species, baby: false, hue: 0, acc: 'none', nick: null, fav: BASE_FAV[species] || 'berry' };
  const x = hash(`${species}.${seed}`);
  return {
    id,
    species,
    baby: true,
    hue: HUES[x % HUES.length],
    acc: ACCS[(x >>> 3) % ACCS.length],
    nick: NAMES[(x >>> 7) % NAMES.length],
    fav: FOOD_KEYS[(x >>> 13) % FOOD_KEYS.length],
  };
}

export function critterName(id, lang = 'en') {
  const c = critterOf(id);
  if (!c.baby) return (CREATURE_NAMES[c.species] || CREATURE_NAMES.fox)[lang] || CREATURE_NAMES[c.species].en;
  return lang === 'es' ? `${c.nick}, ${KIND.es[c.species]}` : `${c.nick} the ${KIND.en[c.species]}`;
}
export const critterNick = (id, lang = 'en') => {
  const c = critterOf(id);
  return c.baby ? c.nick : critterName(id, lang).split(/,| the /)[0];
};

// A new baby friend, different from everyone already on the island.
export function hatch(friends = [], rng = Math.random) {
  const have = new Set(friends);
  const names = new Set(friends.map((f) => { const c = critterOf(f); return c.baby ? `${c.species}|${c.nick}` : null; }));
  let best = null;
  for (let i = 0; i < 40; i++) {
    const species = SPECIES[Math.floor(rng() * SPECIES.length)];
    let seed = '';
    for (let k = 0; k < 6; k++) seed += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rng() * 36)];
    const id = `${species}.${seed}`;
    if (have.has(id)) continue;
    best = id;
    const c = critterOf(id);
    if (!names.has(`${species}|${c.nick}`)) break; // a name she doesn't have yet for that kind
  }
  return best;
}

// The next friend to arrive: the named ones first, then babies forever.
export function nextFriend(friends = [], rng = Math.random) {
  const base = SPECIES.find((f) => !friends.includes(f));
  return base || hatch(friends, rng);
}

// ---------------------------------------------------------------- care
export const FULL_AT = 3; // treats per friend per day, then "I'm full!"
export const TREAT_START = 10; // treats to start with
const HEART_AT = [1, 3, 6, 10, 15]; // love it takes for each heart (up to 5)

export const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

const careOf = (r, id) => (r.care && r.care[id]) || { fed: 0, got: 0, day: '', today: 0, last: '', knows: false, pets: 0 };
export const care = careOf;
export const love = (c) => (c.fed || 0) + (c.got || 0) + Math.floor((c.pets || 0) / 5);
export const hearts = (c) => HEART_AT.filter((n) => love(c) >= n).length;
export const fedToday = (c, day = today()) => (c.day === day ? c.today || 0 : 0);
export const isFull = (c, day = today()) => fedToday(c, day) >= FULL_AT;

// Treats: a few to start, then one for every problem solved since treats began.
export function treats(r) {
  const from = r.treatsFrom == null ? r.pieces || 0 : r.treatsFrom;
  const earned = TREAT_START + Math.max(0, (r.pieces || 0) - from);
  let spent = r.gave || 0;
  for (const c of Object.values(r.care || {})) spent += (c && c.fed) || 0;
  return Math.max(0, earned - spent);
}

// She gives one of her friends a treat. Returns what happened (and changes r).
export function feed(r, id, food, now = new Date()) {
  if (!r.friends.includes(id) || !FOODS[food]) return { ok: false, why: 'who' };
  const day = today(now);
  const c = { ...careOf(r, id) };
  if (isFull(c, day)) return { ok: false, why: 'full' };
  if (treats(r) <= 0) return { ok: false, why: 'none' };
  const fav = critterOf(id).fav === food;
  c.today = fedToday(c, day) + 1;
  c.day = day;
  c.fed = (c.fed || 0) + 1;
  c.last = now.toISOString();
  if (fav) c.knows = true;
  const before = hearts(careOf(r, id));
  r.care = { ...(r.care || {}), [id]: c };
  return { ok: true, fav, full: isFull(c, day), heartUp: hearts(c) > before };
}

export function pet(r, id, now = new Date()) {
  if (!r.friends.includes(id)) return false;
  const c = { ...careOf(r, id) };
  c.pets = (c.pets || 0) + 1;
  c.last = now.toISOString();
  r.care = { ...(r.care || {}), [id]: c };
  return true;
}

// Who is out on the island: the ones she played with most recently, then the newest.
export function lineup(r, n = 12, guide = null) {
  const list = (r.friends || []).map((id, i) => ({ id, i, last: careOf(r, id).last || '' }));
  list.sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : b.i - a.i));
  let out = list.slice(0, n).map((x) => x.id);
  if (guide && r.friends.includes(guide) && !out.includes(guide)) out = [guide, ...out.slice(0, n - 1)];
  return out;
}

// ---------------------------------------------------------------- visiting
// What friends see when they visit her island: no levels, no codes, nothing else.
export function islandSnap(player, data) {
  const r = data.rewards;
  const out = lineup(r, 12, player.friend);
  const hh = {};
  for (const id of out) hh[id] = hearts(careOf(r, id));
  return {
    v: 1,
    name: String(player.name || '').slice(0, 20),
    little: !!player.little,
    pieces: r.pieces || 0,
    star: !!r.star,
    count: (r.friends || []).length,
    out,
    hearts: hh,
  };
}

// A friend's island as it came from the cloud, made safe to draw (anyone could have sent it).
export function cleanSnap(s) {
  if (!s || typeof s !== 'object') return null;
  const out = (Array.isArray(s.out) ? s.out : []).filter(isCritterId).slice(0, 12);
  const hh = {};
  for (const id of out) hh[id] = Math.max(0, Math.min(5, Math.floor(Number((s.hearts || {})[id]) || 0)));
  return {
    name: String(s.name || '').slice(0, 20),
    little: !!s.little,
    pieces: Math.max(0, Math.min(1e6, Math.floor(Number(s.pieces) || 0))),
    star: !!s.star,
    count: Math.max(out.length, Math.min(1e5, Math.floor(Number(s.count) || 0))),
    out,
    hearts: hh,
  };
}

// Something a friend left on her island: a treat for one of her friends, or a wave.
export function cleanGift(g) {
  if (!g || typeof g !== 'object') return null;
  const food = FOODS[g.food] ? g.food : null;
  const wave = WAVES[g.wave] ? g.wave : null;
  const critter = isCritterId(g.critter) ? g.critter : null;
  if (!wave && !(food && critter)) return null;
  return {
    id: String(g.id || '').slice(0, 12) || String(Math.random()).slice(2, 10),
    at: String(g.at || new Date().toISOString()).slice(0, 30),
    from: String(g.from || '').replace(/[^\p{L}\p{N} .'-]/gu, '').slice(0, 20),
    critter: food ? critter : null,
    food,
    wave,
  };
}

// Gifts that arrived: treats count as love for that friend; all of them are remembered as visits.
export function takeGifts(data, gifts) {
  const r = data.rewards;
  const isl = data.island;
  const seen = new Set((isl.visitors || []).map((v) => v.id));
  const fresh = [];
  for (const raw of gifts || []) {
    const g = cleanGift(raw);
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    fresh.push(g);
    if (g.food && r.friends.includes(g.critter)) {
      const c = { ...careOf(r, g.critter) };
      c.got = (c.got || 0) + 1;
      r.care = { ...(r.care || {}), [g.critter]: c };
    }
  }
  if (fresh.length) isl.visitors = [...fresh.reverse(), ...(isl.visitors || [])].slice(0, 30);
  return fresh;
}

// How much she already gave on one friend's island today (a few treats and one wave a day).
export const GIFTS_A_DAY = 3;
export function sentToday(isl, code, day = today()) {
  const s = (isl.sent || {})[code];
  return s && s.day === day ? s : { day, treats: 0, waves: 0 };
}
export function noteSent(isl, code, kind, day = today()) {
  const s = { ...sentToday(isl, code, day) };
  if (kind === 'wave') s.waves += 1; else s.treats += 1;
  isl.sent = { ...(isl.sent || {}), [code]: s };
}
