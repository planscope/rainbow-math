// Records a few whole sentences with different models/settings to compare how natural they sound.
//   node tools/try-voice.mjs <voice_id> <name>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = fs.readFileSync(path.join(os.homedir(), '.config', 'elevenlabs', 'api_key'), 'utf8').trim();
const [voice, name] = process.argv.slice(2);

const LINES = {
  es: '[excited] ¡Uy, el de arriba es muy chiquito! [giggles] ¡Toca el tres para pedir prestada una decena!',
  en: '[excited] Uh-oh, the top number is too small! [giggles] Tap the three to borrow a ten!',
};
const PLAIN = {
  es: '¡Uy, el de arriba es muy chiquito! ¡Toca el tres para pedir prestada una decena!',
  en: 'Uh-oh, the top number is too small! Tap the three to borrow a ten!',
};
const TRIES = [
  { tag: 'v3', model: 'eleven_v3', text: LINES, settings: { stability: 0.5 } },
  { tag: 'v2', model: 'eleven_multilingual_v2', text: PLAIN, settings: { stability: 0.3, similarity_boost: 0.8, style: 0.75, use_speaker_boost: true } },
];

fs.mkdirSync(path.join(ROOT, 'samples'), { recursive: true });
for (const t of TRIES) {
  for (const lang of ['es', 'en']) {
    const body = { text: t.text[lang], model_id: t.model, voice_settings: t.settings };
    if (t.model !== 'eleven_multilingual_v2') body.language_code = lang;
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) { console.log(t.tag, lang, 'FAILED', r.status, (await r.text()).slice(0, 200)); continue; }
    const f = path.join(ROOT, 'samples', `try-${name}-${t.tag}-${lang}.mp3`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    console.log('wrote', path.relative(ROOT, f));
  }
}
