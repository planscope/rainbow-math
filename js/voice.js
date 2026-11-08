// The guide friend's cartoon voice: short clips recorded once with ElevenLabs
// (tools/gen-voice.mjs) and joined together here, e.g.
//   "Step" + "1" + "the ones." + "4" + "plus" + "8" + "Write the answer here."
// No API key or internet service is used while Mila plays. If a clip is missing,
// the app falls back to the device's own voice.
import { STR } from './i18n.js?v=9';
import { speakable, audioCtx, stopSpeaking } from './audio.js?v=9';

// Lines the guide friend says out loud.
export const VOICE_KEYS = [
  'coachStep',
  'c_borrow_v', 'c_ones_add_v', 'c_ones_sub_v', 'c_tens_add_v', 'c_tens_carry_v', 'c_tens_sub_v', 'c_group_v', 'c_mul_type_v',
  'w_ones_sum', 'w_split_v', 'w_split1_v', 'w_carry_up', 'w_write_ones', 'w_ones_direct', 'w_tens_carry', 'w_tens',
  'w_sub_cant', 'w_borrow', 'w_borrow_after', 'w_split10', 'w_from_ten', 'w_join', 'w_write_result',
  'w_sub_ones', 'w_sub_tens', 'w_sub_tens_zero',
  'm_intro', 'm_two', 'm_more',
];
export const LANGS = ['en', 'es'];

const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ES_NUM = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós',
  'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const ES_TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

export function numberWords(lang, n) {
  if (lang === 'es') {
    if (n === 100) return 'cien';
    if (n < 30) return ES_NUM[n];
    const t = Math.floor(n / 10), o = n % 10;
    return o ? `${ES_TENS[t]} y ${ES_NUM[o]}` : ES_TENS[t];
  }
  if (n === 100) return 'one hundred';
  if (n < 20) return EN_NUM[n];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${EN_TENS[t]}-${EN_NUM[o]}` : EN_TENS[t];
}

// "Step {n}: the ones." -> [{lit:'Step '}, {param:'n'}, {lit:': the ones.'}]
export function parts(template) {
  const out = [];
  const re = /\{(\w+)\}/g;
  let last = 0, mm;
  while ((mm = re.exec(template))) {
    if (mm.index > last) out.push({ lit: template.slice(last, mm.index) });
    out.push({ param: mm[1] });
    last = mm.index + mm[0].length;
  }
  if (last < template.length) out.push({ lit: template.slice(last) });
  return out;
}

// What a literal piece sounds like (symbols as words, no leading punctuation).
export function chunkText(lang, lit) {
  let t = speakable(lit, lang).replace(/\s+/g, ' ').replace(/^[\s.,:;]+/, '').trim();
  if (lang === 'es') t = t.replace(/\b1 (decena|unidad)\b/g, 'una $1');
  t = t.replace(/\s*(es igual a|equals)\s*\?\s*$/, lang === 'es' ? ', ¿cuánto es?' : ', what is it?').replace(/^,\s*/, '');
  return /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(t) ? t : '';
}

function hash(s) {
  let x = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return x.toString(16).padStart(8, '0');
}
export const chunkId = (lang, text) => `${lang}-${hash(text)}`;
export const numberId = (lang, n) => `${lang}-n${n}`;

// The clips for a list of lines [{key, params}], or null if a line can't be built from clips.
export function clipsFor(lang, items) {
  const dict = STR[lang] || STR.en;
  const ids = [];
  for (const { key, params = {} } of items) {
    const tpl = dict[key];
    if (typeof tpl !== 'string' || !VOICE_KEYS.includes(key)) return null;
    for (const part of parts(tpl)) {
      if (part.lit != null) {
        const t = chunkText(lang, part.lit);
        if (t) ids.push(chunkId(lang, t));
      } else {
        const v = params[part.param];
        if (!Number.isInteger(v) || v < 0 || v > 100) return null;
        ids.push(numberId(lang, v));
      }
    }
  }
  return ids;
}

// Every clip the app may need: { id: { lang, text } }.
export function allClips() {
  const out = {};
  for (const lang of LANGS) {
    for (let n = 0; n <= 100; n++) out[numberId(lang, n)] = { lang, text: numberWords(lang, n) };
    for (const key of VOICE_KEYS) {
      const tpl = (STR[lang] || {})[key];
      if (typeof tpl !== 'string') throw new Error(`missing ${lang}.${key}`);
      for (const part of parts(tpl)) {
        if (part.lit == null) continue;
        const t = chunkText(lang, part.lit);
        if (t) out[chunkId(lang, t)] = { lang, text: t };
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- playing (browser only)
let manifest = null;
let manifestTried = false;
const buffers = new Map();
let playing = [];
let token = 0;

async function loadManifest() {
  if (manifestTried) return manifest;
  manifestTried = true;
  try {
    const r = await fetch(new URL('../audio/manifest.json?v=9', import.meta.url));
    if (r.ok) manifest = await r.json();
  } catch (e) { /* no clips: device voice is used */ }
  return manifest;
}

export async function clipsReady(lang) {
  const m = await loadManifest();
  return !!(m && m.clips && Object.keys(m.clips).some((id) => id.startsWith(`${lang}-`)));
}

async function getBuffer(ctx, file) {
  if (buffers.has(file)) return buffers.get(file);
  const p = fetch(new URL(`../audio/${file}`, import.meta.url))
    .then((r) => { if (!r.ok) throw new Error('clip'); return r.arrayBuffer(); })
    .then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)));
  buffers.set(file, p);
  p.catch(() => buffers.delete(file));
  return p;
}

export function stopClips() {
  token++;
  for (const s of playing) { try { s.stop(); } catch (e) { /* already stopped */ } }
  playing = [];
}

// Plays the clips one after another. Resolves false if they can't be played.
export async function playClips(ids) {
  if (!ids || !ids.length) return false;
  const my = ++token;
  const m = await loadManifest();
  if (!m || !m.clips || ids.some((id) => !m.clips[id])) return false;
  const ctx = audioCtx();
  if (!ctx) return false;
  let bufs;
  try { bufs = await Promise.all(ids.map((id) => getBuffer(ctx, m.clips[id]))); } catch (e) { return false; }
  if (my !== token) return true; // something newer started meanwhile
  stopSpeaking();
  for (const s of playing) { try { s.stop(); } catch (e) { /* ignore */ } }
  playing = [];
  let t = ctx.currentTime + 0.05;
  for (const b of bufs) {
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(t);
    playing.push(src);
    t += b.duration + 0.04;
  }
  return true;
}
