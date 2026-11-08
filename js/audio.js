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

function pickVoice(lang) {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    const want = lang === 'es' ? ['es-MX', 'es-US', 'es-419', 'es'] : ['en-US', 'en-GB', 'en'];
    for (const w of want) {
      const v = voices.find((x) => x.lang && x.lang.replace('_', '-').toLowerCase().startsWith(w.toLowerCase()));
      if (v) return v;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Only ever called from a user action (a tap), or right after one.
export function speak(text, lang) {
  if (!canSpeak() || !text) return false;
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[−]/g, '-'));
    u.lang = lang === 'es' ? 'es-MX' : 'en-US';
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = 0.9;
    u.pitch = 1.05;
    s.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

export function stopSpeaking() {
  try { if (canSpeak()) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}
