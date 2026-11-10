// Cuts the dead air ElevenLabs leaves at the end of each recording, so lines
// played one after another ("What is" + "thirty" + "plus" + "twenty") flow like
// one sentence. The voice itself is untouched: the cut is a lossless copy.
//
//   node tools/tidy-audio.mjs          report only
//   node tools/tidy-audio.mjs --write  trim the files in audio/
//
// Pieces that get joined (rd-*) keep a short breath at the end; whole lines keep a
// natural pause. Running it twice changes nothing the second time.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { HOUSE } from './voice-house.mjs';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'audio');

export const keepFor = (id) => (/-rd-/.test(id) ? HOUSE.tidy.pieceTail : HOUSE.tidy.lineTail);

// When the voice stops: start of the silence that runs to the end of the file (null if none).
async function speechEnd(file) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${HOUSE.tidy.floorDb}dB:d=0.05`, '-f', 'null', '-'], { maxBuffer: 1 << 24 });
  const dur = Number((stderr.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((t, x) => t * 60 + Number(x), 0));
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  // the last silence reaches the end of the file when it has no matching silence_end
  // (or its end is the file's end)
  if (!starts.length) return { dur, end: null };
  const last = starts[starts.length - 1];
  const open = ends.length < starts.length || Math.abs(ends[ends.length - 1] - dur) < 0.03;
  return { dur, end: open && last > 0 ? last : null };
}

export async function tidyFile(file, id, write) {
  const { dur, end } = await speechEnd(file);
  if (end == null) return { dur, cut: 0 };
  const to = Math.min(dur, end + keepFor(id));
  const cut = dur - to;
  if (cut < 0.08) return { dur, cut: 0 };
  if (write) {
    const tmp = `${file}.tmp.mp3`;
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-t', to.toFixed(3), '-c', 'copy', '-map_metadata', '-1', tmp]);
    fs.renameSync(tmp, file);
  }
  return { dur, cut };
}

async function main() {
  const write = process.argv.includes('--write');
  const files = fs.readdirSync(AUDIO).filter((f) => f.endsWith('.mp3') && f !== 'silence.mp3');
  let before = 0;
  let saved = 0;
  let changed = 0;
  const work = files.slice();
  async function worker() {
    while (work.length) {
      const f = work.shift();
      const r = await tidyFile(path.join(AUDIO, f), f.slice(0, -4), write);
      before += r.dur;
      saved += r.cut;
      if (r.cut) changed++;
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`${files.length} clips, ${changed} ${write ? 'trimmed' : 'would be trimmed'}: ${saved.toFixed(0)} s of ${before.toFixed(0)} s was silence at the end`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
