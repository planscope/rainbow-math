// Plays the guide friend's recorded lines (ElevenLabs "Gigi", recorded once with
// tools/eleven.mjs). Each line is one whole recording, so it sounds natural.
// The app never calls ElevenLabs. If a recording is missing it says false and
// the app uses the device voice instead.
import { audioCtx, stopSpeaking } from './audio.js?v=11';
import { clipId } from './voicelines.js?v=11';

let manifest = null;
let manifestTried = false;
const buffers = new Map();
let current = null;
let token = 0;

async function loadManifest() {
  if (manifestTried) return manifest;
  manifestTried = true;
  try {
    const r = await fetch(new URL('../audio/manifest.json?v=11', import.meta.url));
    if (r.ok) manifest = await r.json();
  } catch (e) { /* no recordings: device voice is used */ }
  return manifest;
}

function getBuffer(ctx, file) {
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
