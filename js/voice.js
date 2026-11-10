// Plays the guide friend's recorded lines (ElevenLabs "Gigi", recorded once with
// tools/eleven.mjs). Each line is one whole recording, so it sounds natural.
// The app never calls ElevenLabs. If a recording is missing it says false and
// the app uses the device voice instead.
import { audioCtx, audioCtxAny, stopSpeaking } from './audio.js?v=23';
import { clipId, variants, explainId } from './voicelines.js?v=23';

// iPad/iPhone play the recordings with a regular audio player (the kind videos use):
// it is not silenced by the mute switch the way Web Audio can be.
const IOS = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
let media = null;
function mediaEl() {
  if (!media && typeof Audio !== 'undefined') {
    media = new Audio();
    media.preload = 'auto';
    media.setAttribute('playsinline', '');
  }
  return media;
}
// Call inside a tap once: after that Safari lets this player start sounds by itself.
export function unlockMedia() {
  if (!IOS) return;
  const a = mediaEl();
  if (!a || a.__unlocked) return;
  a.__unlocked = true;
  // must be an unmuted play inside the tap, or Safari won't count it (the clip itself is silent)
  a.muted = false;
  a.src = new URL('../audio/silence.mp3', import.meta.url).href;
  const p = a.play();
  if (p && p.then) p.then(() => { voiceInfo.unlocked = true; }).catch((e) => { a.__unlocked = false; voiceInfo.unlockError = e && e.name; });
}

let manifest = null;
let manifestLoading = null;

// What happened the last time a line was said (shown in the grown-ups voice check).
export const voiceInfo = { ios: IOS, unlocked: false, unlockError: null, last: null };
export async function voiceNames() {
  const m = await loadManifest();
  if (!m) return null;
  return m.voices || { es: m.voice_name, en: m.voice_name };
}
const buffers = new Map();
let current = null;
let token = 0;

// Everyone waits for the same download (two lines asked at once both get the list).
function loadManifest() {
  if (!manifestLoading) {
    manifestLoading = fetch(new URL('../audio/manifest.json?v=23', import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { manifest = m; return m; })
      .catch(() => null); // no recordings: device voice is used
  }
  return manifestLoading;
}

function getBuffer(ctx, file) {
  if (buffers.has(file)) return buffers.get(file);
  // the recording date in the URL makes devices fetch new takes after a re-recording
  const tag = manifest && manifest.generated ? `?g=${encodeURIComponent(manifest.generated)}` : '';
  const p = fetch(new URL(`../audio/${file}${tag}`, import.meta.url))
    .then((r) => { if (!r.ok) throw new Error('clip'); return r.arrayBuffer(); })
    .then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)));
  buffers.set(file, p);
  p.catch(() => buffers.delete(file));
  return p;
}

// Each line has several takes; pick one at random, never the same one twice in a row.
const lastTake = new Map();
function pickTake(m, lang, key, v) {
  const ok = [];
  const n = variants(lang, key).length;
  for (let x = 0; x < n; x++) if (m.clips[clipId(lang, key, v, x)]) ok.push(x);
  if (!ok.length) return null;
  const last = lastTake.get(`${lang}:${key}`);
  const pool = ok.length > 1 ? ok.filter((x) => x !== last) : ok;
  const x = pool[Math.floor(Math.random() * pool.length)];
  lastTake.set(`${lang}:${key}`, x);
  return m.clips[clipId(lang, key, v, x)];
}

export function stopClips() {
  token++;
  if (media && !media.paused) { try { media.pause(); } catch (e) { /* ignore */ } }
  if (current) { try { current.stop(); } catch (e) { /* already stopped */ } current = null; }
}

// Warm up lines that are likely next so they start right away.
export async function preloadLines(lang, list) {
  const m = await loadManifest();
  const ctx = audioCtx();
  if (!m || !ctx) return;
  for (const [key, v] of list) {
    for (let x = 0; x < variants(lang, key).length; x++) {
      const f = m.clips[clipId(lang, key, v, x)];
      if (f) getBuffer(ctx, f).catch(() => {});
    }
  }
}

// An explanation with real numbers ("Nine plus two..."), if it was recorded.
export async function playExplain(lang, key, params) {
  const m = await loadManifest();
  const file = m && m.clips ? m.clips[explainId(lang, key, params)] : null;
  if (!file) return false;
  return playFile(m, file, key);
}

// Resolves true when the recording started, false if it can't be played.
export async function playLine(lang, key, v = null) {
  const m = await loadManifest();
  const file = m && m.clips ? pickTake(m, lang, key, v) : null;
  return playFile(m, file, key);
}

// Plays several recordings one after another (used by "Read to me").
export async function playSequence(ids) {
  const m = await loadManifest();
  const files = m && m.clips ? ids.map((id) => m.clips[id]) : [];
  if (!files.length || files.some((f) => !f)) { voiceInfo.last = { how: 'device', key: 'read', reason: 'missing read pieces' }; return false; }
  return playFiles(m, files, 'read');
}

// The guide says a few things in a row ("14 is one ten and 4..." then "Now the tens...").
// Each piece is its explanation with real numbers if recorded, otherwise its general line;
// a piece with no recording is skipped, but the last one has to play.
export async function playParts(lang, parts) {
  const m = await loadManifest();
  if (!m || !m.clips) return false;
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const pt = parts[i];
    let f = null;
    try { f = pt.explain ? m.clips[explainId(lang, pt.explain, pt.params)] : null; } catch (e) { f = null; }
    if (!f && pt.line) f = pickTake(m, lang, pt.line, pt.v == null ? null : pt.v);
    if (f) files.push(f);
    else if (i === parts.length - 1) return false;
  }
  return playFiles(m, files, 'guide');
}

async function playFiles(m, files, label) {
  const my = ++token;
  const tag = m.generated ? `?g=${encodeURIComponent(m.generated)}` : '';
  const url = (f) => new URL(`../audio/${f}${tag}`, import.meta.url).href;
  stopSpeaking();
  if (current) { try { current.stop(); } catch (e) { /* ignore */ } current = null; }
  if (IOS && media && media.__unlocked) {
    try {
      media.src = url(files[0]);
      await media.play();
      voiceInfo.last = { how: 'recording', via: `iPad player (${label})`, key: label };
      (async () => {
        for (let i = 1; i < files.length; i++) {
          await new Promise((res) => { media.onended = res; media.onpause = res; });
          if (my !== token) return;
          media.src = url(files[i]);
          try { await media.play(); } catch (e) { return; }
        }
      })();
      return true;
    } catch (e) { voiceInfo.mediaError = e && e.name; }
  }
  const ctx = audioCtxAny();
  if (!ctx) { voiceInfo.last = { how: 'device', key: label, reason: 'no Web Audio' }; return false; }
  let bufs;
  try { bufs = await Promise.all(files.map((f) => getBuffer(ctx, f))); } catch (e) { voiceInfo.last = { how: 'device', key: label, reason: `could not load (${e && e.message})` }; return false; }
  if (my !== token) return true;
  let t = ctx.currentTime + 0.03;
  let last = null;
  for (const b of bufs) {
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(t);
    t += b.duration + 0.05;
    last = src;
    seqSources.push(src);
  }
  const mine = seqSources.slice();
  seqSources = [];
  current = { stop: () => { for (const x of mine) { try { x.stop(); } catch (e) { /* ignore */ } } } };
  void last;
  voiceInfo.last = { how: 'recording', via: `Web Audio (${label}, ${ctx.state})`, key: label };
  return true;
}
let seqSources = [];

async function playFile(m, file, key) {
  const my = ++token;
  if (!file) { voiceInfo.last = { how: 'device', key, reason: m ? 'no recording for this line' : 'recordings list did not load' }; return false; }
  if (IOS && media && media.__unlocked) {
    const tag = m.generated ? `?g=${encodeURIComponent(m.generated)}` : '';
    try {
      stopSpeaking();
      if (current) { try { current.stop(); } catch (e) { /* ignore */ } current = null; }
      media.muted = false;
      media.src = new URL(`../audio/${file}${tag}`, import.meta.url).href;
      await media.play();
      voiceInfo.last = { how: 'recording', via: 'iPad player', key };
      return true;
    } catch (e) { voiceInfo.mediaError = e && e.name; /* fall back to Web Audio below */ }
    if (my !== token) return true;
  }
  const ctx = audioCtx();
  if (!ctx) { voiceInfo.last = { how: 'device', key, reason: 'sound is off or no Web Audio' }; return false; }
  let buf;
  try { buf = await getBuffer(ctx, file); } catch (e) { voiceInfo.last = { how: 'device', key, reason: `could not load the recording (${e && e.message})` }; return false; }
  if (my !== token) return true; // something newer was asked for meanwhile
  stopSpeaking();
  if (current) { try { current.stop(); } catch (e) { /* ignore */ } }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(ctx.currentTime + 0.02);
  current = src;
  voiceInfo.last = { how: 'recording', via: `Web Audio (${ctx.state})`, key };
  return true;
}
