// Records the guide friend's cartoon voice with ElevenLabs, once, on this computer.
// The API key is read from ~/.config/elevenlabs/api_key and is never printed or saved
// anywhere else. The app itself never talks to ElevenLabs: it only plays audio/*.mp3.
//
//   node tools/eleven.mjs voices                 list voices (yours + cartoon/child ones in the library)
//   node tools/eleven.mjs add <public_owner_id> <voice_id> <name>   add a library voice to your account
//   node tools/eleven.mjs sample <voice_id> <name>   record two short test lines (EN + ES) to samples/
//   node tools/eleven.mjs generate house           record every missing clip with the house voices (usual way)
//   node tools/eleven.mjs generate <voice_id> [name] record every missing clip with one voice
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { allLines } from '../js/voicelines.js';
import { HOUSE } from './voice-house.mjs';
import { tidyFile } from './tidy-audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO = path.join(ROOT, 'audio');
const API = 'https://api.elevenlabs.io';
const MODEL = HOUSE.model; // the house voice: see tools/voice-house.mjs

function key() {
  const f = path.join(os.homedir(), '.config', 'elevenlabs', 'api_key');
  if (!fs.existsSync(f)) throw new Error('No key file yet: ~/.config/elevenlabs/api_key');
  return fs.readFileSync(f, 'utf8').trim();
}

async function api(method, url, body, binary = false) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(API + url, {
      method,
      headers: { 'xi-api-key': key(), ...(body ? { 'content-type': 'application/json' } : {}), accept: binary ? 'audio/mpeg' : 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 1500 * (attempt + 1))); continue; }
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`${method} ${url.split('?')[0]} -> ${r.status} ${t.slice(0, 300)}`);
    }
    return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
  }
  throw new Error('ElevenLabs is busy, try again later');
}

const SETTINGS = HOUSE.settings;

async function tts(voiceId, text, lang) {
  return api('POST', `/v1/text-to-speech/${voiceId}?output_format=${HOUSE.format}`, {
    text, model_id: MODEL, language_code: lang, voice_settings: SETTINGS,
  }, true);
}

async function voices() {
  const mine = await api('GET', '/v1/voices');
  console.log('YOUR VOICES');
  for (const v of mine.voices || []) {
    const l = v.labels || {};
    console.log(`  ${v.voice_id}  ${v.name}  [${v.category}] ${[l.gender, l.age, l.accent, l.description, l.use_case].filter(Boolean).join(', ')}`);
  }
  const seen = new Set();
  console.log('\nLIBRARY (cartoon / child / animation, female)');
  for (const q of ['cartoon', 'animation', 'child', 'kids', 'princess', 'caricatura']) {
    let res;
    try { res = await api('GET', `/v1/shared-voices?page_size=15&search=${encodeURIComponent(q)}&gender=female&sort=cloned_by_count`); } catch (e) { console.log(`  (search "${q}" failed: ${e.message})`); continue; }
    for (const v of res.voices || []) {
      if (seen.has(v.voice_id)) continue;
      seen.add(v.voice_id);
      console.log(`  ${v.public_owner_id} ${v.voice_id}  ${v.name}  [${[v.language, v.accent, v.age, v.use_case, v.descriptive].filter(Boolean).join(', ')}] used ${v.cloned_by_count || 0}x  free:${v.free_users_allowed !== false}`);
      console.log(`      preview: ${v.preview_url}`);
    }
  }
}

async function add(owner, voiceId, name) {
  const r = await api('POST', `/v1/voices/add/${owner}/${voiceId}`, { new_name: name });
  console.log('added', r.voice_id || voiceId);
}

async function sample(voiceId, name) {
  const dir = path.join(ROOT, 'samples');
  fs.mkdirSync(dir, { recursive: true });
  const lines = {
    es: '¡Hola, Mila! Paso uno: siete menos ocho. ¡Siete es más chico que ocho, así que toca el tres para pedir prestada una decena!',
    en: 'Hi, Mila! Step one: seven minus eight. Seven is smaller than eight, so tap the three to borrow a ten!',
  };
  for (const [lang, text] of Object.entries(lines)) {
    const buf = await tts(voiceId, text, lang);
    const f = path.join(dir, `${name}-${lang}.mp3`);
    fs.writeFileSync(f, buf);
    console.log('wrote', path.relative(ROOT, f), buf.length, 'bytes');
  }
}

async function generate(voiceId, name = '') {
  fs.mkdirSync(AUDIO, { recursive: true });
  const all = allLines();
  const ids = Object.keys(all);
  const onlyLang = process.env.LANG_ONLY || null;
  // voiceId 'house' records each language with its house voice (tools/voice-house.mjs)
  const voiceFor = (lang) => (voiceId === 'house' ? HOUSE.voices[lang].id : voiceId);
  const todo = ids.filter((id) => !fs.existsSync(path.join(AUDIO, `${id}.mp3`)) && (!onlyLang || all[id].lang === onlyLang));
  const chars = todo.reduce((n, id) => n + all[id].text.length, 0);
  console.log(`${ids.length} clips, ${todo.length} to record (${chars} characters)`);
  let done = 0;
  const work = todo.slice();
  async function worker() {
    while (work.length) {
      const id = work.shift();
      const { lang, text } = all[id];
      const buf = await tts(voiceFor(lang), text, lang);
      fs.writeFileSync(path.join(AUDIO, `${id}.mp3`), buf);
      await tidyFile(path.join(AUDIO, `${id}.mp3`), id, true); // no dead air at the end
      done++;
      if (done % 25 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  // remove clips that are no longer used
  for (const f of fs.readdirSync(AUDIO)) {
    if (f.endsWith('.mp3') && f !== 'silence.mp3' && !all[f.slice(0, -4)]) { fs.unlinkSync(path.join(AUDIO, f)); console.log('removed old', f); }
  }
  let old = {};
  try { old = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8')); } catch (e) { /* first time */ }
  const manifest = { voice_id: old.voice_id || voiceId, voice_name: old.voice_name || name, voices: old.voices, model: MODEL, generated: new Date().toISOString(), clips: {}, texts: {} };
  for (const id of ids) {
    if (fs.existsSync(path.join(AUDIO, `${id}.mp3`))) { manifest.clips[id] = `${id}.mp3`; manifest.texts[id] = all[id].text; }
  }
  fs.writeFileSync(path.join(AUDIO, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`manifest: ${Object.keys(manifest.clips).length} clips`);
}

// Re-records every line of one language with another voice (e.g. English with Jessica).
async function relang(lang, voiceId, name) {
  const all = allLines();
  const ids = Object.keys(all).filter((id) => all[id].lang === lang);
  console.log(`re-recording ${ids.length} ${lang} lines with ${name}`);
  let done = 0;
  const work = ids.slice();
  async function worker() {
    while (work.length) {
      const id = work.shift();
      fs.writeFileSync(path.join(AUDIO, `${id}.mp3`), await tts(voiceId, all[id].text, lang));
      await tidyFile(path.join(AUDIO, `${id}.mp3`), id, true);
      done++;
      if (done % 20 === 0 || done === ids.length) console.log(`  ${done}/${ids.length}`);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const mf = path.join(AUDIO, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  manifest.voices = { ...(manifest.voices || { es: manifest.voice_name, en: manifest.voice_name }), [lang]: `${name} (${voiceId})` };
  manifest.generated = new Date().toISOString();
  fs.writeFileSync(mf, JSON.stringify(manifest, null, 1));
  console.log('manifest updated', manifest.voices);
}

const [cmd, ...args] = process.argv.slice(2);
const run = { voices, add, sample, generate, relang }[cmd];
if (!run) { console.log('use: voices | add <owner> <voice> <name> | sample <voice> <name> | generate <voice> [name]'); process.exit(1); }
run(...args).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
