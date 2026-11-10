// Rebuilds audio/manifest.json from the clips already on disk (no ElevenLabs calls).
//   node tools/manifest.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allLines } from '../js/voicelines.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'audio');
const all = allLines();
const old = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8'));
const manifest = { ...old, generated: new Date().toISOString(), clips: {}, texts: {} };
const missing = [];
for (const id of Object.keys(all)) {
  if (fs.existsSync(path.join(AUDIO, `${id}.mp3`))) { manifest.clips[id] = `${id}.mp3`; manifest.texts[id] = all[id].text; } else missing.push(id);
}
fs.writeFileSync(path.join(AUDIO, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`manifest: ${Object.keys(manifest.clips).length} clips, ${missing.length} not recorded yet`);
const groups = {};
for (const id of missing) { const g = id.replace(/-x\d+$/, '').replace(/-\d+(-\d+)*$/, ''); groups[g] = (groups[g] || 0) + 1; }
console.log(groups);
