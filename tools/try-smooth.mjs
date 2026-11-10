// Records the same lines in a few recording styles so a grown-up can pick the smoothest by ear.
//   node tools/try-smooth.mjs   ->  samples/smooth/*.mp3 + samples/smooth.html
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lineText, explainText } from '../js/voicelines.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'samples', 'smooth');
fs.mkdirSync(OUT, { recursive: true });
const key = fs.readFileSync(path.join(os.homedir(), '.config', 'elevenlabs', 'api_key'), 'utf8').trim();
const VOICE = { en: 'cgSgspJ2msm6clMCkdW9', es: 'jBpfuIE2acCO8z3wKNLl' };
const plain = (t) => t.replace(/\[[^\]]*\]\s*/g, '').trim();

const LINES = [
  { id: 'guide', lang: 'en', label: 'Guide (Mila)', text: lineText('en', 'borrow_tap', 3, true), now: 'en-borrow_tap-3.mp3' },
  { id: 'count', lang: 'en', label: 'Question (Luna)', text: lineText('en', 'lu_count_butterfly', null, true), now: 'en-lu_count_butterfly.mp3' },
  { id: 'explain', lang: 'en', label: 'Explanation with numbers', text: explainText('en', 'x_tens_carry', { t: 2, u: 2 }, true), now: 'en-x_tens_carry-2-2.mp3' },
  { id: 'sum', lang: 'en', label: 'Math question', text: 'What is thirty plus twenty?', stitch: ['en-rd-what', 'en-rd-n30', 'en-rd-plus', 'en-rd-n20'] },
  { id: 'es', lang: 'es', label: 'Spanish (Gigi)', text: lineText('es', 'lu_count_butterfly', null, true), now: 'es-lu_count_butterfly.mp3' },
];
const OPTIONS = [
  { id: 'b', name: 'B · Natural: same model, no acting tags, higher quality', model: 'eleven_v3', settings: { stability: 0.5 }, text: plain, fmt: 'mp3_44100_128' },
  { id: 'c', name: 'C · Steady: same model, tags kept, most consistent setting, higher quality', model: 'eleven_v3', settings: { stability: 1.0 }, text: (t) => t, fmt: 'mp3_44100_128' },
  { id: 'd', name: 'D · Smooth storyteller: calmer model, warm and even, higher quality', model: 'eleven_multilingual_v2', settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 0.95 }, text: plain, fmt: 'mp3_44100_128' },
];

async function tts(o, line) {
  const body = { text: o.text(line.text), model_id: o.model, voice_settings: o.settings };
  if (o.model === 'eleven_v3') body.language_code = line.lang;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE[line.lang]}?output_format=${o.fmt}`, {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${o.id} ${line.id}: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return Buffer.from(await r.arrayBuffer());
}

// A = what the app plays today (the stitched question joined the way the app joins it)
for (const line of LINES) {
  const f = path.join(OUT, `a-${line.id}.mp3`);
  if (line.stitch) {
    const ins = line.stitch.flatMap((id) => ['-i', path.join(ROOT, 'audio', `${id}.mp3`)]);
    const n = line.stitch.length;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', `${line.stitch.map((_, i) => `[${i}]apad=pad_dur=0.05[p${i}]`).join(';')};${line.stitch.map((_, i) => `[p${i}]`).join('')}concat=n=${n}:v=0:a=1`, f]);
  } else fs.copyFileSync(path.join(ROOT, 'audio', line.now), f);
}
for (const o of OPTIONS) {
  for (const line of LINES) {
    fs.writeFileSync(path.join(OUT, `${o.id}-${line.id}.mp3`), await tts(o, line));
  }
  console.log('ok', o.id);
}

const all = [{ id: 'a', name: 'A · Today: expressive model with acting tags; the math question is joined from pieces' }, ...OPTIONS];
const rows = LINES.map((line) => `<section><h2>${line.label}</h2><p class="t">“${plain(line.text)}”</p>${all.map((o) => `<div class="row"><b>${o.id.toUpperCase()}</b><audio controls preload="none" src="smooth/${o.id}-${line.id}.mp3"></audio></div>`).join('')}</section>`).join('');
fs.writeFileSync(path.join(ROOT, 'samples', 'smooth.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Voces más suaves</title>
<style>body{margin:0;background:linear-gradient(180deg,#1d0f4a,#3b1678 48%,#8a2c9e);color:#fff;font:18px/1.4 ui-rounded,system-ui,sans-serif;min-height:100vh}main{max-width:820px;margin:0 auto;padding:24px 16px}ul{background:rgba(255,255,255,.12);border-radius:16px;padding:12px 16px 12px 34px}section{background:#fff;color:#2b2140;border-radius:18px;padding:12px 16px;margin:14px 0}h2{margin:0 0 4px;font-size:21px}.t{margin:4px 0 8px;color:#5b5270}.row{display:grid;grid-template-columns:28px 1fr;align-items:center;gap:8px;margin:6px 0}audio{width:100%}</style></head>
<body><main><h1>Which sounds smoothest?</h1><p>Same voices (Jessica in English, Gigi in Spanish), same lines, four ways of recording them. Listen to each line and pick the letter that sounds most natural.</p><ul>${all.map((o) => `<li>${o.name}</li>`).join('')}</ul>${rows}</main></body></html>`);
console.log('page: samples/smooth.html');
