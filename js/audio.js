// Gentle sound effects (made with Web Audio, no files) and read-aloud.
// There is no failure sound on purpose.

let ctx = null;
let enabled = true;

export function setSound(on) { enabled = !!on; }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Call from any tap so iPad Safari allows sound later.
export function unlockAudio() { if (enabled) audio(); }

function tone(freq, start, dur, type = 'sine', vol = 0.12) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  tap() { if (enabled) tone(660, 0, 0.08, 'sine', 0.05); },
  pop() { if (enabled) tone(520, 0, 0.1, 'triangle', 0.08); },
  trade() { if (!enabled) return; tone(523, 0, 0.14, 'triangle', 0.09); tone(784, 0.1, 0.18, 'triangle', 0.09); },
  correct() { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'sine', 0.1)); },
  reward() { if (!enabled) return; [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.06)); },
  soft() { if (enabled) tone(440, 0, 0.18, 'sine', 0.05); },
};

// ---------------------------------------------------------------- speech
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';

// Warm, natural female voices that come with Apple, Google and Microsoft devices.
// Higher score = picked first. Novelty and male voices are pushed to the bottom.
const FEMALE = /\b(ava|samantha|allison|susan|zoe|zoey|nicky|karen|moira|tessa|serena|victoria|fiona|kathy|joelle|aria|jenny|michelle|emma|libby|sonia|natasha|clara|ana|ashley|sara|nora|flo|sandy|shelley|paulina|m[oó]nica|marisol|ang[eé]lica|isabela|francisca|soledad|dalia|elvira|helena|laura|paloma|lupe|sof[ií]a|ximena|larissa|google us english|google uk english female|google espa[nñ]ol)\b/i;
const MALE = /\b(daniel|alex|fred|tom|aaron|arthur|gordon|rishi|oliver|jorge|juan|diego|carlos|pablo|reed|eddy|rocko|grandpa|ralph|junior|albert|evan|nathan|guy|andrew|brian|ryan|thomas|alvaro|jamie|lee)\b/i;
const NOVELTY = /\b(bad news|bahh|bells|boing|bubbles|cellos|wobble|zarvox|trinoids|whisper|jester|organ|superstar|good news|deranged|hysterical|grandma)\b/i;
const QUALITY = /(premium|enhanced|mejorad|natural|neural|siri)/i;

function voiceScore(v, lang) {
  const l = (v.lang || '').replace('_', '-').toLowerCase();
  if (!l.startsWith(lang)) return -1;
  let s = 1;
  if (lang === 'en' && l === 'en-us') s += 3;
  if (lang === 'es' && (l === 'es-mx' || l === 'es-us' || l === 'es-419')) s += 3;
  if (FEMALE.test(v.name)) s += 6;
  if (MALE.test(v.name)) s -= 8;
  if (NOVELTY.test(v.name)) s -= 20;
  if (QUALITY.test(v.name)) s += 5;
  if (/^(ava|samantha|paulina|marisol)\b/i.test(v.name)) s += 2; // Apple's nicest gentle voices
  return s;
}

export function listVoices(lang) {
  try {
    return (window.speechSynthesis.getVoices() || [])
      .map((v) => ({ v, score: voiceScore(v, lang) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => ({ name: x.v.name, lang: x.v.lang, nice: x.score >= 7 }));
  } catch (e) { return []; }
}

function pickVoice(lang, wanted) {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (wanted) {
      const v = voices.find((x) => x.name === wanted);
      if (v) return v;
    }
    let best = null, bestScore = -1;
    for (const v of voices) {
      const sc = voiceScore(v, lang);
      if (sc > bestScore) { best = v; bestScore = sc; }
    }
    return best;
  } catch (e) { return null; }
}

// Read math out loud as words, not symbols.
function speakable(text, lang) {
  const es = lang === 'es';
  return text
    .replace(/\s*−\s*/g, es ? ' menos ' : ' minus ')
    .replace(/(\d)\s*-\s*(\d)/g, es ? '$1 menos $2' : '$1 minus $2')
    .replace(/\s*×\s*/g, es ? ' por ' : ' times ')
    .replace(/\s*\+\s*/g, es ? ' más ' : ' plus ')
    .replace(/\s*=\s*/g, es ? ' es igual a ' : ' equals ')
    .replace(/→/g, ', ')
    .replace(/…/g, '...');
}

// Only ever called from a user action (a tap), or right after one.
export function speak(text, lang, voiceName) {
  if (!canSpeak() || !text) return false;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(speakable(text, lang));
    u.lang = lang === 'es' ? 'es-MX' : 'en-US';
    const v = pickVoice(lang, voiceName);
    if (v) { u.voice = v; u.lang = v.lang; }
    // a little slower and a little brighter: friendly, patient, clear
    u.rate = 0.88;
    u.pitch = 1.12;
    u.volume = 1;
    s.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

export function onVoicesChanged(fn) {
  try {
    if (canSpeak() && window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', fn);
  } catch (e) { /* ignore */ }
}

export function stopSpeaking() {
  try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}
