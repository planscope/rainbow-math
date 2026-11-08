// Joins recorded clips into whole sentences (like the app does) so a grown-up
// can listen to them: node tools/preview-lines.mjs  ->  samples/line-*.mp3
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clipsFor } from '../js/voice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'samples');
fs.mkdirSync(OUT, { recursive: true });
const gap = path.join(OUT, 'gap.mp3');
if (!fs.existsSync(gap)) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.04', '-b:a', '64k', gap]);

const lines = {
  'es-paso1-37-18': ['es', [{ key: 'c_borrow_v', params: { n: 1, x: 7, y: 8, t: 3 } }]],
  'es-diez-menos-8': ['es', [{ key: 'coachStep', params: { n: 5 } }, { key: 'w_from_ten', params: { y: 8 } }]],
  'es-14-mas-38': ['es', [{ key: 'c_tens_carry_v', params: { n: 2, x: 1, y: 3 } }]],
  'es-grupos': ['es', [{ key: 'c_group_v', params: { n: 1, b: 4 } }]],
  'en-step1-37-18': ['en', [{ key: 'c_borrow_v', params: { n: 1, x: 7, y: 8, t: 3 } }]],
};
for (const [name, [lang, items]] of Object.entries(lines)) {
  const ids = clipsFor(lang, items);
  const list = path.join(OUT, `${name}.txt`);
  fs.writeFileSync(list, ids.flatMap((id) => [`file '${path.join(ROOT, 'audio', id + '.mp3')}'`, `file '${gap}'`]).join('\n'));
  const out = path.join(OUT, `line-${name}.mp3`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ac', '1', '-b:a', '64k', out]);
  fs.unlinkSync(list);
  console.log('wrote', path.relative(ROOT, out));
}
