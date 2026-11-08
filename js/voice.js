// Plays the guide friend's recorded lines (ElevenLabs "Gigi", recorded once with
// tools/eleven.mjs). Each line is one whole recording, so it sounds natural.
// The app never calls ElevenLabs. If a recording is missing it says false and
// the app uses the device voice instead.
import { audioCtx, stopSpeaking } from './audio.js?v=12';
import { clipId } from './voicelines.js?v=12';

let manifest = null;
let manifestLoading = null;
const buffers = new Map();
let current = null;
let token = 0;

// Everyone waits for the same download (two lines asked at once both get the list).
function loadManifest() {
  if (!manifestLoading) {
    manifestLoading = fetch(new URL('../audio/manifest.json?v=12', import.meta.url))
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

export function stopClips() {
  token++;
  if (current) { try { current.stop(); } catch (e) { /* already stopped */ } current = null; }
}

// Warm up lines that are likely next so they start right away.
export async function preloadLines(lang, list) {
  const m = await loadManifest();
  const ctx = audioCtx();
  if (!m || !ctx) return;
  for (const [key, v] of list) {
    const f = m.clips[clipId(lang, key, v)];
    if (f) getBuffer(ctx, f).catch(() => {});
  }
}

// Resolves true when the recording started, false if it can't be played.
export async function playLine(lang, key, v = null) {
  const my = ++token;
  const m = await loadManifest();
  const file = m && m.clips && m.clips[clipId(lang, key, v)];
  if (!file) return false;
  const ctx = audioCtx();
  if (!ctx) return false;
  let buf;
  try { buf = await getBuffer(ctx, file); } catch (e) { return false; }
  if (my !== token) return true; // something newer was asked for meanwhile
  stopSpeaking();
  if (current) { try { current.stop(); } catch (e) { /* ignore */ } }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(ctx.currentTime + 0.02);
  current = src;
  return true;
}
