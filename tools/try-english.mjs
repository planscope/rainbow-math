// Records the same two English lines with several voices/models to pick the most natural one.
//   node tools/try-english.mjs   ->  samples/en-<option>-<n>.mp3 + samples/english.html
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { lineText } from '../js/voicelines.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = fs.readFileSync(path.join(os.homedir(), '.config', 'elevenlabs', 'api_key'), 'utf8').trim();
const OUT = path.join(ROOT, 'samples');
fs.mkdirSync(OUT, { recursive: true });

const v3 = (t) => t; // v3 keeps the [tags]
const plain = (t) => t.replace(/\[[^\]]*\]\s*/g, '');
const OPTIONS = [
  { id: 'gigi-v2', name: 'Gigi (older model, smoother)', voice: 'jBpfuIE2acCO8z3wKNLl', model: 'eleven_multilingual_v2', settings: { stability: 0.35, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true }, text: plain },
  { id: 'jessica-v3', name: 'Jessica (playful, bright)', voice: 'cgSgspJ2msm6clMCkdW9', model: 'eleven_v3', settings: { stability: 0.5 }, text: v3 },
  { id: 'laura-v3', name: 'Laura (upbeat, quirky)', voice: 'FGY2WhTYpPnrIDTdsKH5', model: 'eleven_v3', settings: { stability: 0.5 }, text: v3 },
  { id: 'mimi-v3', name: 'Mimi (childlike, animation)', voice: 'zrHiDhphv9ZnVXBqCLjz', model: 'eleven_v3', settings: { stability: 0.5 }, text: v3 },
  { id: 'jessica-v2', name: 'Jessica (older model, smoother)', voice: 'cgSgspJ2msm6clMCkdW9', model: 'eleven_multilingual_v2', settings: { stability: 0.35, similarity_boost: 0.75, style: 0.6, use_speaker_boost: true }, text: plain },
  { id: 'aria-v3', name: 'Aria (expressive, warm)', voice: '9BWtsMINqrJLrRacOk9x', model: 'eleven_v3', settings: { stability: 0.5 }, text: v3 },
];
const LINES = [lineText('en', 'borrow_tap', 3, true), lineText('en', 'yay2', null, true)];

const done = [];
for (const o of OPTIONS) {
  const files = [];
  for (let i = 0; i < LINES.length; i++) {
    const body = { text: o.text(LINES[i]), model_id: o.model, voice_settings: o.settings };
    if (o.model === 'eleven_v3') body.language_code = 'en';
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${o.voice}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) { console.log(o.id, 'FAILED', r.status, (await r.text()).slice(0, 160)); continue; }
    const f = `en-${o.id}-${i + 1}.mp3`;
    fs.writeFileSync(path.join(OUT, f), Buffer.from(await r.arrayBuffer()));
    files.push(f);
  }
  if (files.length) { done.push({ ...o, files }); console.log('ok', o.id); }
}

const rows = done.map((o, n) => `<section><h2>${n + 1}. ${o.name}</h2>${o.files.map((f, i) => `<p>${plain(LINES[i])}</p><audio controls preload="none" src="${f}"></audio>`).join('')}</section>`).join('');
fs.writeFileSync(path.join(OUT, 'english.html'), `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Voces en inglés</title>
<style>body{margin:0;background:linear-gradient(180deg,#1d0f4a,#3b1678 48%,#8a2c9e);color:#fff;font:18px/1.4 ui-rounded,system-ui,sans-serif;min-height:100vh}main{max-width:820px;margin:0 auto;padding:24px 16px}section{background:#fff;color:#2b2140;border-radius:18px;padding:12px 16px;margin:12px 0}h2{margin:0 0 4px;font-size:21px}p{margin:8px 0 2px;font-size:15px;color:#5b5270}audio{width:100%}</style></head>
<body><main><h1>Voces en inglés para el amigo guía</h1><p style="color:#fff">Las mismas 2 frases con cada opción. Escoge el número que suene más natural.</p>${rows}</main></body></html>`);
console.log('page: samples/english.html');
