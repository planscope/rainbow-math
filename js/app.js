// Mila's Rainbow Math Adventure: screens and interaction.
import { generateProblem, analyzeAnswer, buildSteps, parseEntry, tensOf, onesOf, isValidProblem, BASE_SKILL, mistakePattern } from './math.js?v=25';
import * as M from './model.js?v=25';
import { generateMul, isValidMul, buildMulSteps, analyzeMul } from './mult.js?v=25';
import { LEVELS, levelInfo, pickFromLevel, recordPath, MAX_PATH_LEVEL, QUIZ, passLevel, failQuiz, quizPlan, worldOf, WORLD_COUNT, migratePath } from './levels.js?v=25';
import { t, STR, storyText, CREATURE_NAMES, CREATURE_ORDER } from './i18n.js?v=25';
import { lumiSVG, friendSVG, islandSVG, icon, pieceSVG, RAINBOW } from './art.js?v=25';
import { load, save, storageOK, pickSkill, recordResult, regroupAvailable, defaults, loadPlayers, savePlayers, addPlayer, removePlayer, pinHash, helpLevel, recordFade, passedFade, onSaved, readData, writeData, dropData } from './store.js?v=25';
import { createSync, showCode, readCode } from './sync.js?v=25';
import { sfx, setSound, unlockAudio, speak as speakRaw, stopSpeaking as stopDeviceSpeech, canSpeak, listVoices, onVoicesChanged } from './audio.js?v=25';
import { playLine, playExplain, playSequence, playParts, stopClips, preloadLines, unlockMedia, voiceInfo, voiceNames } from './voice.js?v=25';
import { lineText, explainFor, readSequence, clipId } from './voicelines.js?v=25';
import { LITTLE_LEVELS, LITTLE_WORLDS, LITTLE_SKILLS, littleWorldOf, makeLittle, pickLittle, OBJ_EMOJI, migrateLittle } from './little.js?v=25';
const stopSpeaking = () => { stopDeviceSpeech(); stopClips(); };

// ---------------------------------------------------------------- setup
function mount() {
  let host = document.getElementById('rainbow-math');
  if (!host) {
    host = document.createElement('div');
    host.id = 'rainbow-math';
    document.body.appendChild(host);
  }
  host.classList.add('rm');
  document.documentElement.classList.add('rm-active');
  return host;
}

const root = mount();
// Who is playing: each child has their own saved progress on this device.
let players = loadPlayers();
let player = null;
let data = guestData();
setSound(data.settings.sound);

// Each student's progress also lives in the cloud, so she can play on any device.
const sync = createSync({
  getPlayers: () => players, savePlayers, readData, writeData, dropData,
  onRemote: (id) => takeRemote(id),
});
onSaved((id) => sync.saved(id));
// Screens where new progress from another device can appear without surprising her.
const CALM = ['who', 'welcome', 'island', 'path', 'parent', 'newplayer', 'join'];
// Another device's progress arrived for someone: if it's who's playing, use it now
// (her half-done problem on this device stays as it is).
function takeRemote(id) {
  if (player && player.id === id) {
    const fresh = load(id);
    const keep = data.active;
    for (const k of Object.keys(fresh)) if (k !== 'active') data[k] = fresh[k];
    data.active = keep;
    player = players.players.find((x) => x.id === id) || player;
  }
  if (CALM.includes(screen)) update();
}
async function pullNow(id) {
  try { if (await sync.pull(id)) takeRemote(id); } catch (e) { /* offline: try again later */ }
}

function guestData() {
  // before anyone logs in: English first (Spanish is the second language)
  let lang = 'en';
  if (players.last) { const d = load(players.last); lang = d.settings.lang || lang; }
  const g = load(null);
  g.settings.lang = lang;
  return g;
}

let screen = 'who';
let pin = { target: null, mode: 'enter', entry: '', first: '', msg: '', tries: 0, busy: false };
let draft = { name: '', friend: 'fox' };
let play = null;        // live state of the current problem
let celebrate = null;   // results of the finished adventure
let parentReturn = 'welcome';
let parentConfirm = false;
let parentMsg = '';
let toastTimer = null;

const L = () => data.settings.lang;
const speak = (text, lang, opts) => speakRaw(text, lang, (data.settings.voice || {})[lang] || '', opts);
const T = (k, p) => t(L(), k, { name: player ? player.name : '', ...p });
const W = () => STR[L()] || STR.en;
const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => data.settings.motion === 'reduce' || !!(reduceMQ && reduceMQ.matches);
const opSym = (op) => (op === '+' ? '+' : op === '\u00d7' ? '\u00d7' : '\u2212');
const opWord = (op) => (op === '+' ? W().plusWord : op === '\u00d7' ? W().timesWord : W().minusWord);
const isMul = () => !!play && play.p.op === '\u00d7';
const validProblem = (p) => !!p && (p.op === '\u00d7' ? isValidMul(p) : isValidProblem(p));
const rand = (n) => Math.floor(Math.random() * n);
// 100 levels in 10 worlds: a level is called by its world ("Level 23: Borrowing a ten")
const WORLD_ICONS = ['\u{1F33C}', '\u{1F680}', '\u{1F98A}', '\u{1F308}', '\u{1F36D}', '\u{1F3F0}', '\u{1F984}', '\u{1F30B}', '\u{1F319}', '\u{1F451}'];
const lvName = (n) => T(`world${worldOf(n)}`);
// Luna (4–5) plays in her own little world: her own 30 levels, pictures, and everything said out loud.
const isLittle = () => !!(player && player.little);
const LITTLE_ICONS = ['\u{1F33B}', '\u{1F51F}', '\u{1F91D}', '\u{1F98B}', '\u{1F4AF}', '\u{1F680}'];
const PIC = ['\u{1F436}', '\u{1F431}', '\u{1F98B}', '\u2B50', '\u{1F353}', '\u{1F308}', '\u{1F41F}', '\u{1F338}', '\u{1F366}'];
const lvNewLittle = (n) => { const lv = levelInfo(n, LITTLE_LEVELS); return lv.step === 1 ? T(`lworldNew${lv.world}`) : lv.gate ? T('lvGateNew') : T('lvStepNew'); };
// Which path the shared screens show: the big-kid 100 levels, or the little-kid 30.
function P() {
  return isLittle()
    ? { path: data.progress.lpath, levels: LITTLE_LEVELS, worlds: LITTLE_WORLDS, icons: LITTLE_ICONS, name: (n) => T(`lworld${littleWorldOf(n)}`), fresh: lvNewLittle }
    : { path: data.progress.path, levels: LEVELS, worlds: WORLD_COUNT, icons: WORLD_ICONS, name: lvName, fresh: lvNew };
}
let lplay = null; // the little-kid problem on screen
function lvNew(n) {
  const lv = levelInfo(n);
  if (lv.step === 1) return T(`worldNew${lv.world}`);
  if (lv.gate) return T('lvGateNew');
  return T('lvStepNew');
}

// ---------------------------------------------------------------- DOM helpers
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function button(label, onClick, opts = {}) {
  const { cls = '', ic = null, k = null, aria = null, disabled = false, pressed = null } = opts;
  return h('button', {
    type: 'button',
    class: `rm-btn ${cls}`,
    'data-k': k,
    'aria-label': aria,
    'aria-pressed': pressed == null ? null : String(pressed),
    disabled,
    onclick: (e) => { unlockAudio(); onClick(e); },
  },
  ic ? h('span', { class: 'rm-btn-ic', html: icon(ic) }) : null,
  label != null ? h('span', { class: 'rm-btn-t' }, label) : null);
}

function applyMotion() {
  root.classList.toggle('rm-reduce', reduced());
}

function render() {
  const focusKey = document.activeElement && root.contains(document.activeElement) ? document.activeElement.getAttribute('data-k') : null;
  root.setAttribute('lang', L());
  root.setAttribute('data-screen', screen);
  root.setAttribute('data-kid', isLittle() ? 'little' : 'big');
  applyMotion();
  if (screen === 'play' && play && play.bubbleKey && data.active) play.bubble = play.bubbleKey(); // follows language changes
  computeCoach();
  let view;
  switch (screen) {
    case 'choose': view = viewChoose(); break;
    case 'play': view = viewPlay(); break;
    case 'break': view = viewBreak(); break;
    case 'celebrate': view = viewCelebrate(); break;
    case 'island': view = viewIsland(); break;
    case 'path': view = viewPathMap(); break;
    case 'levelup': view = viewLevelUp(); break;
    case 'who': view = viewWho(); break;
    case 'pin': view = viewPin(); break;
    case 'newplayer': view = viewNewPlayer(); break;
    case 'join': view = viewJoin(); break;
    case 'placeIntro': view = viewPlaceIntro(); break;
    case 'placeDone': view = viewPlaceDone(); break;
    case 'prize': view = viewPrize(); break;
    case 'bye': view = viewBye(); break;
    case 'parent': view = viewParent(); break;
    case 'quizIntro': view = viewQuizIntro(); break;
    case 'quizDone': view = viewQuizDone(); break;
    case 'lplay': view = viewLittlePlay(); break;
    default: view = viewWelcome();
  }
  const coach = screen === 'play' && play && play.coach ? coachEls() : [];
  root.replaceChildren(view, toastEl, ...coach);
  if (focusKey) {
    const el = root.querySelector(`[data-k="${focusKey}"]`);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  if (screen === 'play' && play) setupInk();
  if (play) play.fresh = new Map();
  if (coach.length) {
    positionCoach();
    requestAnimationFrame(positionCoach);
    play.coachShown = play.coach.key;
    speakCoach();
  }
}

// ---------------------------------------------------------------- guide friend
// One of Mila's island friends sits next to the place to tap, with "Step 1"
// and a short instruction, and says it in a cartoon voice.
const isQuiz = () => !!(data.active && data.active.mode === 'quiz');
// The guide friend: off in the placement check, and quiet in a quiz unless she asks for Help.
const coachOn = () => data.settings.coach !== false && !(data.active && data.active.mode === 'placement') && !(isQuiz() && (!play || play.status !== 'guided'));
const voiceOn = () => data.settings.coach !== false && data.settings.coachVoice !== false && data.settings.sound;
const coachTalks = () => coachOn() && voiceOn();
const guideFriend = () => (data.rewards.friends && data.rewards.friends[0]) || 'fox';

function computeCoach() {
  if (!play) return;
  play.coach = null;
  play.coachFocus = null;
  if (screen !== 'play' || !coachOn() || play.status === 'solved' || play.splitting || !data.active) return;
  const p = play.p;
  let c = null;
  if (play.status === 'guided') {
    const st = curStep();
    if (!st) return;
    const n = play.guided.i + 1;
    const said = [play.bubble && play.bubble.lead, play.bubble && play.bubble.text].filter(Boolean).join(' ');
    if (st.kind === 'carry') c = { target: '[data-k="carry-chip"]', short: T('c_carry_s'), side: 'above' };
    else if (st.kind === 'borrow') c = { target: '[data-k="borrow-digit"]', short: T('c_borrow_s', { t: tensOf(p.a) }), side: 'above' };
    else if (ADD_SYNC.includes(st.sync) && !play.guided.synced && addProgress(st).left > 0) {
      c = { target: '.rm-tray', short: T('c_add_s', { n: addProgress(st).left }), side: 'above' };
    }
    else if (st.kind === 'write') c = { target: `[data-k="cell-${st.cell}"]`, short: T('c_write_s'), side: 'below' };
    else if (REMOVE_SYNC.includes(st.sync) && !play.guided.synced) {
      const rp = removeProgress(st);
      const tgt = st.sync === 'takeTens' ? '.rm-col.tens .rm-col-b' : st.sync === 'takeFromTen' ? '.rm-frame.ten' : '.rm-col.ones .rm-col-b';
      c = { target: tgt, short: T('c_take_s', { n: rp.left }), side: 'above' };
    }
    else if (st.kind === 'ask') c = { target: '.rm-entry', short: T('c_type_s'), side: 'left' };
    else c = { target: '[data-k="g-next"]', short: T('c_ok_s'), side: 'below' };
    void said;
    const lk = GUIDED_LINE[st.key] || (st.kind === 'next' ? 'g_next' : null);
    const lv = st.key === 'w_borrow' ? st.params.t : st.key === 'w_from_ten' ? st.params.y : null;
    Object.assign(c, { n, key: `g${play.guided.i}`, vline: lk ? [lk, lv] : null, step: st });
  } else if (!fadeAllows()) {
    return;
  } else if (isMul()) {
    const k = play.mulCounted;
    c = k < p.a
      ? { n: 1, target: `[data-k="grp-${k}"]`, short: T('c_group_s'), vline: ['group_tap', p.b], side: 'above', key: 'm1' }
      : { n: 2, target: '.rm-entry', short: T('c_type_s'), vline: ['mul_type', null], side: 'left', key: 'm2' };
  } else {
    const info = colInfo();
    const col = phaseCell();
    const needBorrow = p.op === '-' && info.borrow;
    if (col === 'ones' && needBorrow && !info.borrowed) {
      c = { n: 1, target: '[data-k="borrow-digit"]', short: T('c_borrow_s', { t: info.a10 }), vline: ['borrow_tap', info.a10], side: 'above', key: 'b1', focus: 'ones' };
    } else if (col === 'ones') {
      const n = needBorrow ? 2 : 1;
      const vline = p.op === '+' ? ['ones_add', null] : [info.borrowed ? 'ones_after_borrow' : 'ones_sub', null];
      c = { n, target: '[data-k="cell-ones"]', short: T('c_box_s', { expr: info.onesExpr }), vline, side: 'below', key: `o${n}` };
    } else {
      const n = needBorrow ? 3 : 2;
      const vline = p.op === '+' ? [info.carry ? 'tens_carry' : 'tens_add', null] : ['tens_sub', null];
      c = { n, target: '[data-k="cell-tens"]', short: T('c_box_s', { expr: info.tensExpr }), vline, side: 'below', key: `t${n}` };
    }
  }
  if (c.vline) c.say = lineText(L(), c.vline[0], c.vline[1]);
  play.coach = c;
  play.coachFocus = c.focus || null;
}

// The guide steps back as she learns: right away for a new skill, after a pause once
// she's on a roll, and only when she taps Help after she passed a quiz with it.
function fadeAllows() {
  const lvl = helpLevel(data, play.p.skill);
  if (lvl === 'off') return false;
  if (lvl === 'light' && !(data.active.current && data.active.current.wrongs > 0)) {
    const wait = 8000 - (Date.now() - (play.shownAt || 0));
    if (wait > 0) {
      if (!play.coachTimer) {
        const me = play;
        play.coachTimer = setTimeout(() => { if (play === me && screen === 'play' && play.status === 'ask') update(); }, wait + 50);
      }
      return false;
    }
  }
  return true;
}

function coachEls() {
  const c = play.coach;
  const fresh = c.key !== play.coachShown;
  return [
    h('div', { class: 'rm-tap-ring', 'aria-hidden': 'true' }),
    h('div', { class: `rm-coach ${fresh ? 'enter' : ''}`, 'aria-hidden': 'true' },
      h('div', { class: 'rm-coach-pal', html: friendSVG(guideFriend()) }),
      h('div', { class: 'rm-coach-b' }, h('b', { class: 'rm-coach-n' }, T('coachStep', { n: c.n })), h('span', null, c.short))),
  ];
}

function positionCoach() {
  const el = root.querySelector('.rm-coach');
  const ring = root.querySelector('.rm-tap-ring');
  if (!el || !ring || !play || !play.coach) return;
  const t = root.querySelector(play.coach.target);
  const r = t ? t.getBoundingClientRect() : null;
  if (!r || !r.width) { el.style.display = 'none'; ring.style.display = 'none'; return; }
  el.style.display = '';
  ring.style.display = '';
  Object.assign(ring.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = el.offsetWidth, hgt = el.offsetHeight;
  let side = play.coach.side;
  let left, top;
  if (side === 'left' && r.left - w - 14 < 8) side = 'below';
  if (side === 'below' && r.bottom + 12 + hgt > vh - 8) side = 'above';
  if (side === 'above' && r.top - 12 - hgt < 8) side = 'below';
  if (side === 'left') { left = r.left - w - 14; top = r.top + r.height / 2 - hgt / 2; }
  else { left = r.left + r.width / 2 - w / 2; top = side === 'below' ? r.bottom + 12 : r.top - hgt - 12; }
  left = Math.max(8, Math.min(vw - w - 8, left));
  top = Math.max(8, Math.min(vh - hgt - 8, top));
  Object.assign(el.style, { left: `${left}px`, top: `${top}px` });
  el.dataset.side = side;
}

const GUIDED_LINE = {
  w_ones_sum: 'g_ones_sum', w_split: 'g_split', w_carry_up: 'g_carry', w_write_ones: 'g_write_ones',
  w_ones_direct: 'ones_add', w_tens_carry: 'tens_carry', w_tens: 'tens_add',
  w_sub_cant: 'g_sub_cant', w_borrow: 'borrow_tap', w_borrow_after: 'g_borrow_after', w_split10: 'g_split10',
  w_from_ten: 'g_from_ten', w_join: 'g_join', w_write_result: 'g_write_result', w_sub_ones: 'g_sub_ones',
  w_sub_tens: 'tens_sub', w_sub_tens_zero: 'g_sub_tens_zero', m_intro: 'g_m_intro', m_two: 'g_m_more', m_more: 'g_m_more',
};

function speakCoach() {
  const c = play && play.coach;
  if (!c || c.key === play.coachSpoken) return;
  play.coachSpoken = c.key;
  const still = () => !!play && play.coachSpoken === c.key && screen === 'play';
  if (c.step) sayStep(c.step, c.vline, still);
  else if (c.vline) sayLine(c.vline[0], c.vline[1], still);
}

// Step-by-step help: the guide explains with the real numbers ("Nine plus two...").
// If that recording is missing it says the general recorded line, and only then the device voice.
function sayStep(st, vline, still = () => true) {
  if (!coachTalks()) return;
  if (play) play.lastSaid = { step: st, vline };
  const lang = L();
  const ek = explainFor(st.key);
  const general = () => { if (vline && still()) sayLine(vline[0], vline[1], still, true); };
  if (data.settings.coachVoiceKind === 'device') { general(); return; }
  if (st.say && st.say.length) {
    const parts = st.say.map((k) => ({ explain: explainFor(k), params: st.params, line: GUIDED_LINE[k] }));
    parts.push({ explain: ek, params: st.params, line: vline && vline[0], v: vline && vline[1] });
    playParts(lang, parts).then((ok) => { if (!ok) general(); });
    return;
  }
  if (!ek) { general(); return; }
  playExplain(lang, ek, st.params).then((ok) => { if (!ok) general(); else voiceInfo.last = { how: 'recording', via: 'explanation', key: ek }; });
}

// The speaker in Lumi's bubble repeats what the guide said, in the same voice.
function replayGuide(text) {
  const ls = play && play.lastSaid;
  if (screen === 'play' && ls && coachTalks()) {
    if (ls.step) sayStep(ls.step, ls.vline);
    else sayLine(ls.key, ls.v);
    return;
  }
  readAloud(text);
}

// The guide friend says a recorded line (Gigi). If it can't, the device voice says it.
function sayLine(key, v = null, still = () => true, keepLast = false) {
  if (!voiceOn()) return;
  if (play && !keepLast) play.lastSaid = { key, v };
  const lang = L();
  const device = () => { const t = lineText(lang, key, v); if (t) speak(t, lang, { pitch: 1.5, rate: 1.0 }); };
  if (data.settings.coachVoiceKind === 'device') { voiceInfo.last = { how: 'device', key, reason: 'grown-ups chose the device voice' }; device(); return; }
  playLine(lang, key, v).then((ok) => { if (!ok && still()) device(); });
}
const cheer = () => sayLine(`yay${1 + rand(3)}`);
const comfort = () => sayLine(`oops${1 + rand(2)}`);
root.addEventListener('scroll', () => { if (screen === 'play') positionCoach(); }, { passive: true });
const update = render;

function go(next) {
  stopSpeaking();
  screen = next;
  render();
  try { root.scrollTop = 0; } catch (e) { /* ignore */ }
}

const toastEl = h('div', { class: 'rm-toast', role: 'status', 'aria-live': 'polite' });
function toast(text) {
  const el = toastEl;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function readAloud(text) {
  if (!speak(text, L())) toast(T('noSpeech'));
}

// ---------------------------------------------------------------- shared pieces
function bubbleEl({ mood = 'happy', lead = null, text = '', buttons = [], read = true, note = null } = {}) {
  const spoken = [lead, text].filter(Boolean).join(' ');
  return h('div', { class: 'rm-bubble-wrap' },
    h('div', { class: 'rm-lumi', html: lumiSVG(mood) }),
    h('div', { class: 'rm-bubble' },
      h('div', { class: 'rm-bubble-text', 'aria-live': 'polite' },
        note ? h('p', { class: 'rm-note' }, note) : null,
        lead ? h('p', { class: 'rm-lead' }, lead) : null,
        text ? h('p', { class: 'rm-main' }, text) : null),
      (read || buttons.length)
        ? h('div', { class: 'rm-bubble-actions' },
          buttons.map((b) => button(b.label, b.onClick, { cls: b.primary ? 'primary' : '', ic: b.ic, k: b.k })),
          read && spoken ? button(null, () => replayGuide(spoken), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'bubble-read' }) : null)
        : null));
}

function langButton() {
  return button(W().otherLang, () => {
    data.settings.lang = W().otherLangCode;
    save(data);
    stopSpeaking();
    update();
  }, { cls: 'soft small', ic: 'globe', k: 'lang' });
}

function soundButton() {
  const on = data.settings.sound;
  return button(null, () => {
    data.settings.sound = !on;
    setSound(!on);
    save(data);
    if (!on) sfx.tap();
    update();
  }, { cls: 'icon soft', ic: on ? 'soundOn' : 'soundOff', aria: on ? T('soundOn') : T('soundOff'), k: 'sound', pressed: on });
}

// Grown-ups area: locked with its own 4-number code. The first time (or a forgotten code)
// a grown-up answers a multiplication question first, so a child can't set the code.
function parentHold() {
  return button(T('grownUps'), openParent, { cls: 'soft small rm-hold', ic: 'lock', k: 'hold' });
}
const newGate = () => ({ ga: 12 + rand(8), gb: 12 + rand(8) });
function openParent() {
  stopSpeaking();
  parentReturn = screen === 'pin' || screen === 'parent' ? 'who' : screen;
  pin = players.parentPin
    ? { kind: 'parent', mode: 'enter', entry: '', first: '', msg: '', tries: 0, busy: false }
    : { kind: 'parent', mode: 'gate', entry: '', first: '', msg: '', tries: 0, busy: false, ...newGate() };
  go('pin');
}
function openParentArea() {
  parentConfirm = false;
  go('parent');
}
function changeParentPin() {
  pin = { kind: 'parent', mode: 'create', changing: true, entry: '', first: '', msg: '', tries: 0, busy: false };
  go('pin');
}
function gateCheck() {
  if (pin.kind !== 'parent' || pin.mode !== 'gate') return;
  if (Number(pin.entry) === pin.ga * pin.gb) { pin.mode = 'create'; pin.msg = ''; sfx.pop(); }
  else { pin.msg = T('pp_gateWrong'); sfx.soft(); }
  pin.entry = '';
  update();
}
async function parentPinDone(entered) {
  if (pin.mode === 'enter') {
    if (await pinHash('grown-ups', entered) === players.parentPin) { pin.busy = false; parentMsg = ''; openParentArea(); return; }
    pin.tries++;
    pin.msg = T('pp_wrong');
    sfx.soft();
  } else if (pin.mode === 'create') {
    pin.first = entered;
    pin.mode = 'confirm';
  } else if (entered === pin.first) {
    players.parentPin = await pinHash('grown-ups', entered);
    savePlayers(players);
    pin.busy = false;
    parentMsg = pin.changing ? T('p_pinChanged') : '';
    openParentArea();
    return;
  } else {
    pin.mode = 'create';
    pin.first = '';
    pin.msg = T('pinMismatch');
    sfx.soft();
  }
  pin.entry = '';
  pin.busy = false;
  update();
}

const rainbowBar = () => h('div', { class: 'rm-rainbow-bar', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6].map(() => h('span')));

// ---------------------------------------------------------------- welcome
function viewWelcome() {
  const s = data.active;
  const r = data.rewards;
  const returning = r.pieces > 0 || data.sessions.length > 0;
  return h('main', { class: 'rm-screen rm-welcome' },
    h('div', { class: 'rm-corner' }, langButton()),
    h('h1', { class: 'rm-title' }, isLittle() ? T('appNameLittle') : T('appName')),
    rainbowBar(),
    h('div', { class: 'rm-welcome-scene', html: islandSVG({ pieces: r.pieces, friends: r.friends, rainbows: Math.floor(r.pieces / 7), star: r.star }) }),
    h('div', { class: 'rm-welcome-bubble' }, bubbleEl({ mood: 'happy', text: returning ? T('welcomeBack') : T('welcomeHi') })),
    prizeStrip(true),
    nextCard(),
    h('div', { class: 'rm-actions' },
      s
        ? button(T('keepGoing', { n: Math.min(s.index + 1, s.length), total: s.length }), resumeSession, { cls: 'primary big', ic: 'next', k: 'go' })
        : button(T('letsGo'), startFlow, { cls: 'primary big', ic: 'next', k: 'go' }),
      s ? button(T('newAdventure'), () => { data.active = null; play = null; save(data); startFlow(); }, { cls: 'big', k: 'new' }) : null,
      button(T('myIsland'), () => go('island'), { cls: 'big', ic: 'island', k: 'island' })),
    h('div', { class: 'rm-foot' },
      button(T('switchPlayer'), switchPlayer, { cls: 'soft small', ic: 'back', k: 'switch' }),
      parentHold()));
}

// ---------------------------------------------------------------- players: who's playing, secret code
function viewWho() {
  return h('main', { class: 'rm-screen rm-who' },
    h('div', { class: 'rm-corner' }, langButton()),
    h('h1', { class: 'rm-title' }, T('appName')),
    rainbowBar(),
    h('div', { class: 'rm-welcome-bubble' }, bubbleEl({ mood: 'happy', text: T('whoTitle') })),
    h('div', { class: 'rm-players' },
      players.players.map((pl) => h('button', { type: 'button', class: 'rm-player', 'data-k': `pl-${pl.id}`, onclick: () => { unlockAudio(); sfx.tap(); pickPlayer(pl); } },
        h('span', { class: 'rm-player-art', html: friendSVG(pl.friend || 'fox') }),
        h('span', { class: 'rm-player-name' }, pl.name))),
      h('button', { type: 'button', class: 'rm-player add', 'data-k': 'pl-new', onclick: () => { unlockAudio(); draft = { name: '', friend: 'fox' }; go('newplayer'); } },
        h('span', { class: 'rm-player-plus' }, '+'),
        h('span', { class: 'rm-player-name' }, T('newPlayer')))),
    h('div', { class: 'rm-foot' }, parentHold()));
}

function pickPlayer(pl) {
  pin = { target: pl, pic: !!pl.little, mode: pl.pin ? 'enter' : 'create', entry: '', first: '', msg: '', tries: 0, busy: false };
  go('pin');
  if (pl.little) sayLine('lu_pic');
}

function viewPin() {
  const parent = pin.kind === 'parent';
  const pl = pin.target;
  if (!parent && !pl) return viewWho();
  const gate = parent && pin.mode === 'gate';
  const pic = !parent && pin.pic;
  const len = pic ? 3 : 4;
  const title = parent
    ? (gate ? T('pp_gate', { a: pin.ga, b: pin.gb }) : pin.mode === 'enter' ? T('pp_enter') : pin.mode === 'create' ? T('pp_create') : T('pp_confirm'))
    : pic ? (pin.mode === 'enter' ? T('picHello', { who: pl.name }) : pin.mode === 'create' ? T('picCreate') : T('picConfirm'))
      : pin.mode === 'enter' ? T('pinHello', { who: pl.name }) : pin.mode === 'create' ? T('pinCreate') : T('pinConfirm');
  const key = (d) => h('button', { type: 'button', class: 'rm-btn rm-key', 'data-k': `pin-${d}`, onclick: () => { unlockAudio(); pinPress(String(d)); } }, String(d));
  const picKey = (e, i) => h('button', { type: 'button', class: 'rm-btn rm-key pic', 'data-k': `pin-${i}`, 'aria-label': e, onclick: () => { unlockAudio(); pinPress(String(i)); } }, e);
  const back = () => go(parent ? (pin.changing ? 'parent' : parentReturn || 'who') : 'who');
  return h('main', { class: `rm-screen rm-pin ${parent ? 'grown' : ''}` },
    h('div', { class: 'rm-row-top' }, button(T('back'), back, { cls: 'soft small', ic: 'back', k: 'back' }), langButton()),
    parent ? h('div', { class: 'rm-pin-art lock', html: `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_LOCK}</svg>` }) : h('div', { class: 'rm-pin-art', html: friendSVG(pl.friend || 'fox') }),
    h('h2', { class: 'rm-h2' }, parent ? T('pp_title') : pl.name),
    h('p', { class: 'rm-big-text' }, title),
    gate
      ? h('p', { class: 'rm-pin-typed', 'aria-live': 'polite' }, pin.entry || '\u00a0')
      : h('div', { class: `rm-pin-dots ${pin.msg && pin.mode === 'enter' ? 'shake' : ''} ${pic ? 'pic' : ''}`, role: 'img', 'aria-label': `${pin.entry.length} / ${len}` },
        Array.from({ length: len }, (_, i) => h('span', { class: i < pin.entry.length ? 'on' : '' }, pic && i < pin.entry.length ? PIC[Number(pin.entry[i])] : ''))),
    h('p', { class: 'rm-pin-msg', role: 'status' }, pin.msg || (gate ? T('pp_gateNote') : '\u00a0')),
    pic ? h('div', { class: 'rm-keys rm-pin-keys pics' },
      PIC.map(picKey),
      h('span'),
      button(null, () => { pin.entry = pin.entry.slice(0, -1); update(); }, { cls: 'rm-key soft', ic: 'del', aria: T('del'), k: 'pin-del' }),
      h('span')) : h('div', { class: 'rm-keys rm-pin-keys' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key),
      button(null, () => { pin.entry = pin.entry.slice(0, -1); update(); }, { cls: 'rm-key soft', ic: 'del', aria: T('del'), k: 'pin-del' }),
      key(0),
      gate ? button(null, gateCheck, { cls: 'rm-key primary', ic: 'check', aria: T('pp_ok'), k: 'pin-ok' }) : h('span')),
    parent && pin.mode === 'enter'
      ? button(T('pp_forgot'), () => { Object.assign(pin, { mode: 'gate', entry: '', msg: '' }, newGate()); update(); }, { cls: 'soft small', k: 'pp-forgot' })
      : null);
}
const ICON_LOCK = '<rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>';

async function pinPress(d) {
  if (pin.busy) return;
  if (pin.kind === 'parent' && pin.mode === 'gate') {
    if (pin.entry.length >= 3) return;
    pin.entry += d;
    pin.msg = '';
    sfx.tap();
    update();
    return;
  }
  const len = pin.kind !== 'parent' && pin.pic ? 3 : 4;
  if (pin.entry.length >= len) return;
  pin.entry += d;
  pin.msg = '';
  sfx.tap();
  update();
  if (pin.entry.length < len) return;
  pin.busy = true;
  const pl = pin.target;
  const entered = pin.entry;
  await new Promise((r) => setTimeout(r, 180));
  if (pin.kind === 'parent') { await parentPinDone(entered); return; }
  if (pin.mode === 'enter') {
    if (await pinHash(pl.id, entered) === pl.pin) { pin.busy = false; login(pl); return; }
    pin.tries++;
    pin.msg = pin.tries >= 5 ? T('pinAskGrownUp') : T('pinWrong');
    sfx.soft();
  } else if (pin.mode === 'create') {
    pin.first = entered;
    pin.mode = 'confirm';
  } else if (entered === pin.first) {
    pl.pin = await pinHash(pl.id, entered);
    savePlayers(players);
    pin.busy = false;
    login(pl);
    return;
  } else {
    pin.mode = 'create';
    pin.first = '';
    pin.msg = T('pinMismatch');
    sfx.soft();
  }
  pin.entry = '';
  pin.busy = false;
  update();
}

async function login(pl) {
  // first bring in what she did on other devices (a short wait at most; the rest arrives later)
  const cloud = players.players.find((x) => x.id === pl.id);
  if (sync.on() && cloud && cloud.cloud) {
    pin.msg = T('syncing');
    update();
    await Promise.race([pullNow(pl.id), new Promise((r) => setTimeout(r, 2500))]);
    pin.msg = '';
  }
  player = players.players.find((x) => x.id === pl.id) || pl;
  data = load(player.id);
  migratePath(data.progress.path);
  if (player.little) migrateLittle(data.progress.lpath);
  data.visits = (data.visits || 0) + 1;
  save(data);
  players.last = player.id;
  savePlayers(players);
  setSound(data.settings.sound);
  play = null;
  celebrate = null;
  if (data.active && data.active.current && validProblem(data.active.current.p)) initPlay();
  sfx.reward();
  if (!data.progress.placed && !isLittle()) { go('placeIntro'); sayLine('place_start'); return; }
  go('welcome');
  sayLine(isLittle() ? 'lu_hello' : 'hello');
}

function switchPlayer() {
  stopSpeaking();
  if (player) save(data);
  player = null;
  play = null;
  celebrate = null;
  data = guestData();
  go('who');
}

function viewNewPlayer() {
  const ok = draft.name.trim().length > 0;
  const input = h('input', {
    type: 'text', class: 'rm-input', maxlength: '14', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false',
    value: draft.name, 'aria-label': T('newName'), 'data-k': 'name-input',
    oninput: (e) => {
      draft.name = e.target.value.replace(/[<>]/g, '').slice(0, 14);
      const nb = root.querySelector('[data-k="new-next"]');
      if (nb) nb.disabled = !draft.name.trim();
    },
  });
  return h('main', { class: 'rm-screen rm-newplayer' },
    h('div', { class: 'rm-row-top' }, button(T('back'), () => go('who'), { cls: 'soft small', ic: 'back', k: 'back' }), langButton()),
    h('h2', { class: 'rm-h2' }, T('newTitle')),
    h('label', { class: 'rm-field-l' }, T('newName')),
    input,
    h('div', { class: 'rm-field-l' }, T('newKind')),
    h('div', { class: 'rm-kind-pick' },
      h('button', { type: 'button', class: 'rm-kind', 'aria-pressed': String(!draft.little), 'data-k': 'kind-big', onclick: () => { draft.little = false; sfx.tap(); update(); } }, h('span', { 'aria-hidden': 'true' }, '\u{1F9EE}'), T('kindBig')),
      h('button', { type: 'button', class: 'rm-kind', 'aria-pressed': String(!!draft.little), 'data-k': 'kind-little', onclick: () => { draft.little = true; sfx.tap(); update(); } }, h('span', { 'aria-hidden': 'true' }, '\u{1F33B}'), T('kindLittle'))),
    h('div', { class: 'rm-field-l' }, T('newFriend')),
    h('div', { class: 'rm-friend-pick' }, CREATURE_ORDER.map((f) => h('button', {
      type: 'button', class: 'rm-friend-opt', 'aria-pressed': String(draft.friend === f), 'aria-label': CREATURE_NAMES[f][L()], 'data-k': `fr-${f}`,
      onclick: () => { draft.friend = f; sfx.tap(); update(); },
    }, h('span', { html: friendSVG(f) })))),
    h('div', { class: 'rm-actions' }, button(T('newNext'), createPlayer, { cls: 'primary big', ic: 'next', k: 'new-next', disabled: !ok })),
    sync.on() ? h('div', { class: 'rm-join-link' }, button(T('joinLink'), () => { joinDraft = { code: '', msg: '', busy: false }; go('join'); }, { cls: 'soft', ic: 'next', k: 'join-open' })) : null);
}

// ---------------------------------------------------------------- the same student on another device
let joinDraft = { code: '', msg: '', busy: false };
function viewJoin() {
  const input = h('input', {
    type: 'text', class: 'rm-input rm-code-input', maxlength: '9', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false',
    placeholder: 'K7M2-Q9XF', value: joinDraft.code, 'aria-label': T('joinTitle'), 'data-k': 'join-input',
    oninput: (e) => { joinDraft.code = e.target.value.toUpperCase().slice(0, 9); joinDraft.msg = ''; const m = root.querySelector('.rm-pin-msg'); if (m) m.textContent = '\u00a0'; },
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); joinNow(); } },
  });
  return h('main', { class: 'rm-screen rm-newplayer rm-join' },
    h('div', { class: 'rm-row-top' }, button(T('back'), () => go('newplayer'), { cls: 'soft small', ic: 'back', k: 'back' }), langButton()),
    h('h2', { class: 'rm-h2' }, T('joinTitle')),
    h('p', { class: 'rm-text' }, T('joinText')),
    input,
    h('p', { class: 'rm-pin-msg', role: 'status' }, joinDraft.busy ? T('joinWait') : joinDraft.msg || '\u00a0'),
    h('div', { class: 'rm-actions' }, button(T('joinGo'), joinNow, { cls: 'primary big', ic: 'next', k: 'join-go', disabled: joinDraft.busy })));
}
async function joinNow() {
  if (joinDraft.busy) return;
  const code = readCode(joinDraft.code);
  if (!code) { joinDraft.msg = T('joinBad'); sfx.soft(); update(); return; }
  joinDraft.busy = true;
  update();
  let r;
  try { r = await sync.join(code); } catch (e) { r = { ok: false, offline: true }; }
  joinDraft.busy = false;
  if (!r.ok) { joinDraft.msg = r.offline ? T('joinOffline') : T('joinNone'); sfx.soft(); update(); return; }
  const pl = players.players.find((x) => x.id === r.id);
  sfx.reward();
  if (r.combined) toast(T('joinCombined', { who: pl.name }));
  pickPlayer(pl);
}

function createPlayer() {
  const name = draft.name.trim().slice(0, 14);
  if (!name) return;
  const id = addPlayer(players, { name, friend: draft.friend, lang: L(), little: !!draft.little });
  players = loadPlayers();
  sync.push(id);
  pickPlayer(players.players.find((x) => x.id === id));
}

// ---------------------------------------------------------------- first "what do you know" check
// About 6 problems. It starts in the middle of the path and goes up after a right answer
// and down after a miss (like looking for a page in a book), then picks the level.
// The first check finds her world: one problem like each world's first level, binary search.
const PROBE = { 1: ['A', 2], 2: ['C', 1], 3: ['D', 1], 4: ['D', 3], 5: ['M', 1], 6: ['M', 3], 7: ['M', 4], 8: ['M', 5], 9: ['M', 6], 10: ['M', 6] };

function viewPlaceIntro() {
  return h('main', { class: 'rm-screen rm-celebrate rm-place' },
    h('div', { class: 'rm-lumi big', html: lumiSVG('happy') }),
    h('h2', { class: 'rm-h2' }, T('placeTitle')),
    h('p', { class: 'rm-big-text' }, T('placeText')),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud(`${T('placeTitle')} ${T('placeText')}`), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('placeGo'), () => startSession('placement'), { cls: 'primary big', ic: 'next', k: 'place-go' })));
}

function placementRecord(ok) {
  const s = data.active;
  const pl = s.place;
  if (ok) pl.pass = Math.max(pl.pass, pl.probe); else pl.fail = Math.min(pl.fail, pl.probe);
  pl.done++;
  const top = data.settings.mult === false ? 4 : 10;
  const next = Math.floor((pl.pass + Math.min(pl.fail, top + 1)) / 2);
  if (pl.done >= 7 || next <= pl.pass || next >= Math.min(pl.fail, top + 1)) pl.finished = true;
  else pl.probe = next;
  save(data);
}

// A miss during the check: no hints, show the answer kindly and move on.
function placementMiss() {
  const s = data.active, c = s.current, p = play.p;
  play.status = 'solved';
  play.solvedAt = Date.now();
  play.entry = String(p.answer);
  play.entryStale = false;
  play.staleCell = null;
  play.cells = answerCells(p.answer);
  play.focusCol = null;
  if (isMul()) play.mulCounted = p.a;
  c.solved = true;
  c.awarded = true;
  placementRecord(false);
  sfx.soft();
  setBubble(() => ({ mood: 'happy', text: T('placeNext', { n: p.answer }), buttons: [{ label: T('next'), onClick: goNext, primary: true, ic: 'next', k: 'b-next' }] }));
  update();
  sayLine('place_next');
}

function finishPlacement() {
  const s = data.active;
  const lvl = Math.max(1, (Math.min(s.place.pass, WORLD_COUNT) - 1) * 10 + 1);
  data.progress.path = { level: lvl, stars: 0, best: Math.max(lvl, data.progress.path.best || 1), v: 2 };
  data.progress.placed = true;
  data.active = null;
  play = null;
  save(data);
  go('placeDone');
  sayLine('place_done');
}

function viewPlaceDone() {
  const n = data.progress.path.level;
  const conf = reduced() ? null : h('div', { class: 'rm-confetti', 'aria-hidden': 'true' },
    Array.from({ length: 28 }, (_, i) => h('span', { style: `--i:${i};--x:${(i * 37) % 100}` })));
  return h('main', { class: 'rm-screen rm-celebrate rm-levelup' },
    conf,
    h('div', { class: 'rm-lumi big', html: lumiSVG('cheer') }),
    h('div', { class: 'rm-levelup-badge' }, String(n)),
    h('h2', { class: 'rm-h2' }, T('placeDoneTitle', { n })),
    h('p', { class: 'rm-big-text' }, lvName(n)),
    h('div', { class: 'rm-actions' }, button(T('placeDoneGo'), () => startSession('path'), { cls: 'primary big', ic: 'next', k: 'place-play' })));
}

// ---------------------------------------------------------------- real-life prizes set by a grown-up
const PRIZE_ICONS = ['\u{1F6CD}\uFE0F', '\u{1F366}', '\u{1F9F8}', '\u{1F3A0}', '\u{1F3AC}', '\u{1F355}', '\u{1F4DA}', '\u{1F3A8}', '\u{1F381}', '\u{1F3D6}\uFE0F'];
const nextPrize = () => (data.prizes || []).filter((x) => !x.won).sort((a, b) => a.goal - b.goal)[0] || null;

function prizeStrip(big) {
  const pz = nextPrize();
  if (!pz) return null;
  const have = data.rewards.pieces;
  const pct = Math.min(100, Math.round((have / pz.goal) * 100));
  return h('div', { class: `rm-prize-strip ${big ? 'big' : ''} ${pz.goal - have <= 3 ? 'close' : ''}`, role: 'img', 'aria-label': `${T('prizeNext')}: ${pz.title}. ${T('prizeLeft', { n: Math.max(0, pz.goal - have) })}` },
    h('span', { class: 'rm-prize-icon' }, pz.icon),
    h('span', { class: 'rm-prize-text' },
      h('small', null, T('prizeNext')),
      h('b', null, pz.title),
      h('span', { class: 'rm-prize-bar' }, h('span', { style: `width:${pct}%` }))),
    h('span', { class: 'rm-prize-count' }, h('span', { html: pieceSVG(3) }), `${Math.min(have, pz.goal)}/${pz.goal}`),
    big ? h('span', { class: 'rm-prize-left' }, T('prizeMore', { n: Math.max(0, pz.goal - have), what: pz.title })) : null);
}

// The prize stays in sight while she works: "7 more to Target!" fills up with every piece.
function prizeMini() {
  const pz = nextPrize();
  if (!pz) return null;
  const have = data.rewards.pieces;
  const left = Math.max(0, pz.goal - have);
  const pct = Math.min(100, Math.round((have / pz.goal) * 100));
  const bumped = (play && play.bump) || (lplay && lplay.bump);
  const from = bumped ? Math.max(0, Math.round(((have - 1) / pz.goal) * 100)) : pct;
  return h('div', { class: `rm-prize-mini ${bumped ? 'bump' : ''} ${left <= 3 ? 'close' : ''}`, role: 'img', 'aria-label': `${pz.title}: ${T('prizeLeft', { n: left })}` },
    h('span', { class: 'rm-prize-mini-ic', 'aria-hidden': 'true' }, pz.icon),
    h('span', { class: 'rm-prize-mini-t' },
      h('b', null, T('prizeMore', { n: left, what: pz.title })),
      h('span', { class: 'rm-prize-bar' }, h('span', { class: from !== pct ? 'grow' : '', style: `width:${pct}%;--from:${from}%` }))));
}

// What's next on the path: stars to the quiz, or the quiz itself.
function nextCard() {
  if (!data.progress.placed && !isLittle()) return null;
  const ctx = P();
  const path = ctx.path;
  const lv = levelInfo(path.level, ctx.levels);
  if (path.quizDue) {
    return h('button', { type: 'button', class: 'rm-next-card quiz', 'data-k': 'next-quiz', onclick: () => { unlockAudio(); sfx.tap(); go('quizIntro'); sayLine('quiz_intro'); } },
      h('span', { class: 'rm-next-ic', 'aria-hidden': 'true' }, '\u{1F3C6}'),
      h('span', { class: 'rm-next-t' }, h('b', null, T('nextQuiz')), h('small', null, T('pathLevel', { n: path.level, name: ctx.name(path.level) }))),
      h('span', { class: 'rm-path-go', html: icon('next') }));
  }
  const text = path.champion ? T('nextChamp')
    : path.stars < lv.goal ? (lv.gate ? T('nextStars', { n: lv.goal - path.stars, l: path.level }) : T('nextLevelStars', { n: lv.goal - path.stars, l: path.level + 1 }))
      : T('nextWait', { n: path.quizWait || 0 });
  return h('button', { type: 'button', class: 'rm-next-card', 'data-k': 'next-path', onclick: () => { unlockAudio(); sfx.tap(); go('path'); } },
    h('span', { class: 'rm-next-ic', 'aria-hidden': 'true' }, path.champion ? '\u{1F451}' : lv.gate ? '\u{1F3C6}' : ctx.icons[lv.world - 1]),
    h('span', { class: 'rm-next-t' },
      h('b', null, text),
      h('small', null, T('pathLevel', { n: path.level, name: ctx.name(path.level) })),
      starsRow(Math.min(path.stars, lv.goal), lv.goal)),
    h('span', { class: 'rm-path-go', html: icon('next') }));
}

function checkPrizes() {
  const s = data.active;
  for (const pz of data.prizes || []) {
    if (!pz.won && data.rewards.pieces >= pz.goal) {
      pz.won = true;
      pz.wonAt = new Date().toISOString();
      if (s) s.prizeWon = pz.id;
    }
  }
}

function viewPrize() {
  const s = data.active;
  const pz = (data.prizes || []).find((x) => s && x.id === s.prizeWon) || (data.prizes || []).filter((x) => x.won).slice(-1)[0];
  const conf = reduced() ? null : h('div', { class: 'rm-confetti', 'aria-hidden': 'true' },
    Array.from({ length: 34 }, (_, i) => h('span', { style: `--i:${i};--x:${(i * 29) % 100}` })));
  return h('main', { class: 'rm-screen rm-celebrate rm-prize' },
    conf,
    h('div', { class: 'rm-prize-big' }, pz ? pz.icon : '\u{1F381}'),
    h('h2', { class: 'rm-h2' }, T('prizeTitle')),
    h('p', { class: 'rm-big-text' }, pz ? pz.title : ''),
    h('p', { class: 'rm-text' }, T('prizeShow')),
    h('div', { class: 'rm-actions' }, button(T('prizeOk'), afterPrize, { cls: 'primary big', ic: 'next', k: 'prize-ok' })));
}

function afterPrize() {
  const s = data.active;
  if (s) { s.prizeWon = null; save(data); }
  if (s && s.levelUp) { go('levelup'); sayLine('levelup'); return; }
  if (!s) { if (quizResult) { quizDoneNext(); return; } go('welcome'); return; }
  continueSession();
}

// ---------------------------------------------------------------- choose
function viewChoose() {
  const card = (mode, title, place, sym, cls) => h('button', {
    type: 'button', class: `rm-adv ${cls}`, 'data-k': `adv-${mode}`,
    onclick: () => { unlockAudio(); sfx.tap(); startSession(mode); },
  },
  h('span', { class: 'rm-adv-sym', 'aria-hidden': 'true' }, sym),
  h('span', { class: 'rm-adv-title' }, title),
  h('span', { class: 'rm-adv-place' }, place));
  return h('main', { class: 'rm-screen rm-choose' },
    h('div', { class: 'rm-row-top' }, button(T('back'), () => go('welcome'), { cls: 'soft small', ic: 'back', k: 'back' }), langButton()),
    h('div', { class: 'rm-choose-bubble' }, bubbleEl({ mood: 'happy', text: T('chooseTitle') })),
    pathCard(),
    h('h3', { class: 'rm-h3' }, T('practiceTitle')),
    h('div', { class: 'rm-adv-grid four' },
      card('add', T('addTitle'), T('addPlace'), '+', 'add'),
      card('sub', T('subTitle'), T('subPlace'), '\u2212', 'sub'),
      card('mix', T('mixTitle'), T('mixPlace'), '\u00b1', 'mix'),
      card('mul', T('mulTitle'), T('mulPlace'), '\u00d7', 'mul')));
}

function starsRow(have, goal) {
  return h('span', { class: 'rm-stars', role: 'img', 'aria-label': T('pathStars', { s: have, g: goal }) },
    Array.from({ length: goal }, (_, i) => h('span', { class: i < have ? 'on' : '', html: icon('star') })));
}

function pathCard() {
  const path = data.progress.path;
  const lv = levelInfo(path.level);
  return h('div', { class: 'rm-path-card' },
    h('button', { type: 'button', class: 'rm-path-main', 'data-k': 'adv-path', onclick: () => { unlockAudio(); sfx.tap(); startSession('path'); } },
      h('span', { class: 'rm-path-badge' }, String(path.level)),
      h('span', { class: 'rm-path-text' },
        h('span', { class: 'rm-adv-title' }, T('pathTitle')),
        h('span', { class: 'rm-path-name' }, T('pathLevel', { n: path.level, name: lvName(path.level) })),
        starsRow(path.stars, lv.goal)),
      h('span', { class: 'rm-path-go', html: icon('next') })),
    button(T('pathSee'), () => go('path'), { cls: 'small soft', ic: 'island', k: 'see-path' }));
}

function levelChip() {
  const ctx = P();
  const path = ctx.path;
  const lv = levelInfo(path.level, ctx.levels);
  const pct = Math.round((Math.min(path.stars, lv.goal) / lv.goal) * 100);
  const bump = (play && play.starEarned) || (lplay && lplay.starEarned);
  return h('div', { class: `rm-level-chip ${bump ? 'bump' : ''}`, role: 'img', 'aria-label': `${T('levelChip', { n: path.level })}: ${T('pathStars', { s: path.stars, g: lv.goal })}` },
    h('span', { class: 'rm-level-ic', 'aria-hidden': 'true' }, ctx.icons[lv.world - 1]),
    h('b', null, T('levelChip', { n: path.level })),
    h('span', { class: 'rm-level-bar' }, h('span', { style: `width:${pct}%` })),
    h('span', { class: 'rm-level-n' }, h('span', { html: icon('star') }), `${path.stars}/${lv.goal}`),
    path.quizDue ? h('span', { class: 'rm-level-quiz', 'aria-hidden': 'true' }, '\u{1F3C6}') : null);
}

// ---------------------------------------------------------------- level path map & level up
function viewPathMap() {
  const ctx = P();
  const path = ctx.path;
  const max = ctx.levels.length;
  const cur = levelInfo(path.level, ctx.levels);
  return h('main', { class: 'rm-screen rm-pathmap' },
    h('div', { class: 'rm-row-top' }, button(T('back'), () => go(isLittle() ? 'welcome' : 'choose'), { cls: 'soft small', ic: 'back', k: 'back' }), langButton()),
    h('h2', { class: 'rm-h2' }, T('pathMapTitle')),
    h('p', { class: 'rm-text' }, T('pathMapNote', { n: path.level, total: max })),
    h('ol', { class: 'rm-worlds' }, Array.from({ length: ctx.worlds }, (_, w) => {
      const lvs = ctx.levels.filter((lv) => lv.world === w + 1);
      const last = lvs[lvs.length - 1];
      const wState = last.n < path.level || (path.champion && last.n === max) ? 'done' : lvs[0].n <= path.level ? 'here' : 'locked';
      return h('li', { class: `rm-world ${wState}` },
        h('div', { class: 'rm-world-h' },
          h('span', { class: 'rm-world-ic', 'aria-hidden': 'true' }, wState === 'locked' ? '\u{1F512}' : ctx.icons[w]),
          h('span', { class: 'rm-world-t' }, h('small', null, T('worldN', { w: w + 1 })), h('b', null, ctx.name(lvs[0].n))),
          wState === 'here' ? h('span', { class: 'rm-stone-lumi', html: lumiSVG('happy') }) : null),
        h('div', { class: 'rm-world-dots' }, lvs.map((lv) => {
          const st = lv.n < path.level || (path.champion && lv.n === max) ? 'done' : lv.n === path.level ? 'here' : 'locked';
          return h('span', { class: `rm-wdot ${st} ${lv.gate ? 'gate' : ''} ${st === 'here' && path.quizDue ? 'due' : ''}`, title: `${T('levelChip', { n: lv.n })}${lv.gate ? ` · ${T('pathQuiz')}` : ''}` },
            lv.gate ? '\u{1F3C6}' : st === 'done' ? h('span', { html: icon('star') }) : String(lv.n));
        })),
        wState === 'here' ? h('div', { class: 'rm-world-now' }, h('b', null, T('pathLevel', { n: path.level, name: ctx.name(path.level) })), starsRow(Math.min(path.stars, cur.goal), cur.goal)) : null);
    })),
    path.level >= max ? h('p', { class: 'rm-text' }, T('pathTop')) : null,
    h('div', { class: 'rm-actions' }, button(T('pathPlay'), () => (isLittle() ? startLittle() : startSession('path')), { cls: 'primary big', ic: 'next', k: 'path-play' })));
}

function viewLevelUp() {
  const ctx = P();
  const n = (data.active && data.active.levelUp) || ctx.path.level;
  const conf = reduced() ? null : h('div', { class: 'rm-confetti', 'aria-hidden': 'true' },
    Array.from({ length: 28 }, (_, i) => h('span', { style: `--i:${i};--x:${(i * 37) % 100}` })));
  const lv = levelInfo(n, ctx.levels);
  const newWorld = lv.step === 1 && n > 1;
  const say = `${T('levelUpTitle', { n })} ${newWorld ? T('worldUnlocked', { w: lv.world, name: ctx.name(n) }) : ctx.name(n)}. ${ctx.fresh(n)}`;
  return h('main', { class: `rm-screen rm-celebrate rm-levelup ${newWorld ? 'new-world' : ''}` },
    conf,
    newWorld ? h('div', { class: 'rm-world-banner' }, h('span', { 'aria-hidden': 'true' }, ctx.icons[lv.world - 1]), T('worldUnlocked', { w: lv.world, name: ctx.name(n) })) : null,
    h('div', { class: 'rm-lumi big', html: lumiSVG('cheer') }),
    h('div', { class: 'rm-levelup-jump', 'aria-hidden': 'true' },
      h('span', { class: 'rm-levelup-old' }, String(n - 1)),
      h('span', { class: 'rm-levelup-arrow' }, '→'),
      h('div', { class: 'rm-levelup-badge' }, String(n))),
    h('h2', { class: 'rm-h2' }, T('levelUpTitle', { n })),
    h('p', { class: 'rm-big-text' }, ctx.name(n)),
    h('div', { class: 'rm-world-dots big', role: 'img', 'aria-label': T('worldProgress', { k: lv.step, w: lv.world }) },
      ctx.levels.filter((x) => x.world === lv.world).map((x) => h('span', { class: `rm-wdot ${x.n < n ? 'done' : x.n === n ? 'here' : 'locked'} ${x.gate ? 'gate' : ''}` },
        x.gate ? '\u{1F3C6}' : x.n < n ? h('span', { html: icon('star') }) : String(x.n)))),
    h('p', { class: 'rm-text' }, ctx.fresh(n)),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud(say), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('levelUpGo'), afterLevelUp, { cls: 'primary big', ic: 'next', k: 'levelup-go' })));
}

// ---------------------------------------------------------------- multiplication: equal groups
function mulCard() {
  const c = data.active.current;
  const p = play.p;
  const solved = play.status === 'solved';
  const k = play.mulCounted;
  const terms = [];
  for (let i = 0; i < p.a; i++) {
    if (i) terms.push(h('span', { class: 'rm-mul-plus' }, ' + '));
    terms.push(h('span', { class: i < k ? 'on' : '' }, String(p.b)));
  }
  const shown = solved ? String(p.answer) : (play.entryStale ? '' : play.entry);
  return h('div', { class: `rm-card rm-problem rm-mul ${play.drawing ? 'drawing' : ''}` },
    c.story != null ? h('p', { class: 'rm-story' }, storyText(L(), p, c.story)) : null,
    h('p', { class: 'rm-eq', 'aria-label': T('whatIs', { a: p.a, b: p.b, opw: opWord(p.op) }) },
      h('span', { class: 'num-a' }, String(p.a)), ' \u00d7 ', h('span', { class: 'num-b' }, String(p.b)), ' = ',
      h('span', { class: solved ? 'num-ans' : 'num-q' }, solved ? String(p.answer) : '?')),
    h('p', { class: 'rm-mul-words' }, T(p.style === 'rows' ? 'mulRowsOf' : 'mulGroupsOf', { a: p.a, b: p.b })),
    h('p', { class: 'rm-mul-add', 'aria-hidden': 'true' }, terms),
    h('div', { class: `rm-mul-ans ${play.entryStale ? 'stale' : ''} ${solved ? 'solved' : ''}` }, shown || '\u00a0'),
    h('canvas', { class: 'rm-ink', 'aria-hidden': 'true' }),
    play.drawing ? h('div', { class: 'rm-ink-bar' },
      button(T('undo'), undoStroke, { cls: 'small soft', ic: 'undo', k: 'ink-undo', disabled: !play.strokes.length }),
      button(T('eraseAll'), eraseInk, { cls: 'small soft', ic: 'eraser', k: 'ink-erase', disabled: !play.strokes.length })) : null);
}

function groupsPanel() {
  const p = play.p;
  const k = play.mulCounted;
  const guided = play.status === 'guided';
  const solvedAll = play.status === 'solved';
  const rows = p.style === 'rows';
  const groups = Array.from({ length: p.a }, (_, i) => {
    const lit = i < k;
    const gems = Array.from({ length: p.b }, () => h('span', { class: 'rm-gem' }));
    return h('button', {
      type: 'button',
      class: `rm-group ${rows ? 'row' : ''} ${lit ? 'lit' : ''}`,
      style: `--c:${RAINBOW[i % RAINBOW.length]}`,
      'data-k': `grp-${i}`,
      'aria-label': `${i + 1}: ${p.b}`,
      onclick: () => tapGroup(),
    },
    h('span', { class: 'rm-gems' }, gems),
    // the running total is hers to say: only shown for groups she already counted in Help, or when solved
    h('span', { class: 'rm-group-n' }, solvedAll || (guided && i < k - 1) ? String((i + 1) * p.b) : lit ? '\u2714' : ''));
  });
  const hint = k >= p.a && !guided && !solvedAll ? T('mulAllTapped') : T(rows ? 'mulTapRows' : 'mulTapGroups', { b: p.b });
  return h('div', { class: 'rm-card rm-blocks rm-groups-panel' },
    h('p', { class: 'rm-mat-line' }, hint),
    h('div', { class: `rm-groups ${rows ? 'rows' : ''}` }, groups),
    !guided && play.status !== 'solved' && k > 0
      ? h('div', { class: 'rm-mat-actions' }, button(T('mulRecount'), () => { play.mulCounted = 0; sfx.tap(); update(); }, { cls: 'small soft', ic: 'reset', k: 'grp-reset' }))
      : null);
}

function tapGroup() {
  if (play.status === 'guided') { guidedWait(); return; }
  if (play.status === 'solved') { sfx.tap(); return; }
  if (play.mulCounted >= play.p.a) { sfx.tap(); return; }
  play.mulCounted++;
  play.countedGroups = true;
  data.active.current.blocksUsed = true;
  sfx.pop();
  update();
}

const s0 = () => data.active || {};
function submitMulEntry() {
  const n = parseEntry(play.entryStale ? '' : play.entry);
  if (n === null) { toast(T('blankEntry')); sfx.soft(); return; }
  const p = play.p;
  const c = data.active.current;
  const res = analyzeMul(p, n);
  if (res.correct) { solve(); return; }
  if (s0().mode === 'placement') { placementMiss(); return; }
  if (isQuiz()) { quizWrong(n); return; }
  c.wrongs++;
  save(data);
  sfx.soft();
  if (c.wrongs >= 2) { startGuided(T('wrong2')); return; }
  comfort();
  play.entryStale = true;
  const leadPick = rand(3);
  setBubble(() => ({
    mood: 'think',
    lead: T('wrong1', { pick: leadPick }),
    text: T(res.kind, { a: p.a, b: p.b }),
    buttons: [
      { label: T('tryAgain'), onClick: tryAgain, primary: true, k: 'try' },
      { label: T('helpSteps'), onClick: startGuided, ic: 'help', k: 'steps' },
    ],
  }));
  update();
}

function startFlow() {
  if (isLittle()) { startLittle(); return; }
  if (!data.progress.placed) { go('placeIntro'); sayLine('place_start'); return; }
  const pr = data.settings.practice;
  if (['path', 'add', 'sub', 'mix', 'mul'].includes(pr)) startSession(pr);
  else go('choose');
}

// ---------------------------------------------------------------- sessions
function startSession(mode) {
  data.active = {
    id: Date.now().toString(36) + rand(1000),
    mode,
    length: data.settings.sessionLength,
    index: 0,
    results: [],
    used: [],
    lastOp: null,
    repeatSkill: null,
    ease: false,
    note: null,
    current: null,
    finished: false,
  };
  if (mode === 'placement') {
    data.active.length = 7;
    data.active.place = { pass: 0, fail: 11, probe: 4, done: 0, finished: false };
  }
  if (mode === 'quiz') {
    const path = data.progress.path;
    data.active.length = QUIZ.size;
    // counts = this is the level's quiz (it's due); otherwise it's only a check
    data.active.quiz = { level: path.level, counts: !!path.quizDue, items: [], plan: quizPlan(path.level, { regroupOn: data.settings.regroup !== 'off', multOn: data.settings.mult !== false }) };
  }
  newProblem();
  go('play');
}

function resumeSession() {
  const s = data.active;
  if (!s) return startFlow();
  if (s.prizeWon) { go('prize'); sayLine('prize'); return; }
  if (s.levelUp) { go('levelup'); sayLine('levelup'); return; }
  if (s.mode === 'little' || s.mode === 'lquiz') {
    if (s.quizNext) return endForQuiz();
    if (s.index >= s.length || !s.current) return lContinue();
    lInit();
    go('lplay');
    lSay();
    return;
  }
  if (s.mode === 'placement' && (s.place.finished || s.index >= s.length)) return finishPlacement();
  if (s.quizNext) return endForQuiz();
  if (s.mode === 'quiz' && s.index >= s.length) return finishQuiz();
  if (s.index >= s.length) return finishSession();
  if (!s.current || !s.current.p || !validProblem(s.current.p)) newProblem();
  else initPlay();
  go('play');
}

function totalAttempts() {
  return Object.values(data.progress.skills).reduce((n, s) => n + s.attempts, 0);
}

function newProblem() {
  const s = data.active;
  let skill, level;
  if (s.mode === 'placement') {
    [skill, level] = PROBE[s.place.probe] || ['A', 1];
  } else if (s.mode === 'quiz') {
    [skill, level] = s.quiz.plan[s.index] || pickFromLevel(s.quiz.level, {});
  } else if (s.mode === 'path') {
    if (s.repeatSkill) { skill = s.repeatSkill; level = s.repeatLevel || 1; }
    else {
      [skill, level] = pickFromLevel(data.progress.path.level, {
        regroupOn: data.settings.regroup !== 'off',
        multOn: data.settings.mult !== false,
        lastOp: s.lastOp,
      });
    }
    if (s.ease) level = Math.max(1, level - 1);
  } else if (s.mode === 'mul') {
    skill = 'M';
    level = data.progress.skills.M.level;
  } else {
    skill = pickSkill(data, s.mode, s);
    level = data.progress.skills[skill].level;
  }
  const st = data.progress.skills[skill];
  const p = skill === 'M' ? generateMul(level, Math.random, s.used) : generateProblem(skill, level, Math.random, s.used);
  let msg = null;
  let blocks = false;
  if (skill === 'M') { if (st.attempts === 0) msg = 'newSkillMul'; }
  else if (st.attempts === 0 && !BASE_SKILL[skill]) { msg = 'introFirst'; blocks = true; }
  else if (st.attempts === 0 && BASE_SKILL[skill]) { msg = skill === 'C' ? 'newSkillAdd' : 'newSkillSub'; blocks = true; }
  else if (s.note === 'support') { msg = 'supportNext'; blocks = true; }
  else if (s.note === 'similar') msg = 'similarNext';
  else if (s.note === 'harder') msg = 'harderNext';
  if (s.mode === 'quiz') { msg = null; blocks = false; } // a quiz starts plain: no blocks, no tips
  const story = !blocks && totalAttempts() > 0 && Math.random() < 0.4 ? rand(10) : null;
  s.current = { p, story, wrongs: 0, helped: false, blocksUsed: blocks, showBlocks: blocks, solved: false, awarded: false, msg, prompt: rand(4) };
  s.used.push(p.key);
  s.lastOp = p.op;
  s.repeatSkill = null;
  s.repeatLevel = null;
  s.ease = false;
  s.note = null;
  save(data);
  initPlay();
}

function initPlay() {
  const c = data.active.current;
  play = {
    p: c.p,
    model: c.p.op === '\u00d7' ? null : M.makeModel(c.p),
    mulCounted: c.solved && c.p.op === '\u00d7' ? c.p.a : 0,
    countedGroups: false,
    showBlocks: !!c.showBlocks,
    counting: false,
    entry: c.solved ? String(c.p.answer) : '',
    entryStale: false,
    cells: c.solved ? answerCells(c.p.answer) : { tens: '', ones: '' },
    activeCell: 'ones',
    drawing: false,
    strokes: [],
    carryFresh: false,
    phase: 'ones',       // answering column by column, like on paper
    staleCell: null,     // a box with a number that wasn't right yet
    splitting: false,    // showing 12 in the ones box just before the 1 goes up
    carryFromBox: null,  // where the carried 1 starts its flight
    status: c.solved ? 'solved' : 'ask',
    guided: null,
    focusCol: null,
    marks: {},
    bubble: null,
    bubbleKey: null,
    leaving: false,
    tradedEver: false,
    countedEver: false,
    bump: false,
    fresh: new Map(),
    shownAt: Date.now(),  // the guide may wait a little before pointing
    coachTimer: null,
    scratch: { T: '', O: '' }, // quiz: what she writes in the little boxes on top
    strike: false,        // quiz: she crossed out the tens to borrow
  };
  setBubble(() => (c.solved ? solvedBubble(null) : introBubble()));
  preloadLines(L(), [['yay1'], ['yay2'], ['yay3'], ['team'], ['oops1'], ['oops2']]);
}

const answerCells = (n) => ({ tens: n >= 10 ? String(tensOf(n)) : '', ones: String(onesOf(n)) });

// The final answer is typed into the Tens and Ones boxes, like on paper.
function usingCells() {
  if (!play || isMul()) return false; // multiplication answers go in one box
  if (play.status === 'ask') return true;
  const st = curStep();
  return play.status === 'guided' && !!st && st.kind === 'write';
}
function clearCells() {
  play.cells = { tens: '', ones: '' };
  play.activeCell = 'ones';
  play.entryStale = false;
}
// null = blank, 'needOnes' = only the tens box is filled
function cellsValue() {
  if (play.entryStale) return null;
  const { tens, ones } = play.cells;
  if (tens === '' && ones === '') return null;
  if (ones === '') return 'needOnes';
  return Number(tens || 0) * 10 + Number(ones);
}
function selectCell(col) {
  if (!usingCells() || play.status === 'solved') return;
  if (play.status === 'ask' && isQuiz()) { play.activeCell = col; sfx.tap(); update(); return; }
  if (play.status === 'ask') {
    if (col === phaseCell()) { sfx.tap(); return; }
    if (col === 'tens') { toast(T('onesFirst')); sfx.soft(); return; }
    restartColumns();
    sfx.tap();
    update();
    return;
  }
  const st = curStep();
  if (play.status === 'guided' && st && st.cell !== col) { guidedWait(); return; }
  if (play.entryStale) clearCells();
  play.activeCell = col;
  sfx.tap();
  update();
}

// The bubble is stored as a function so it can be rebuilt after a language switch.
function setBubble(fn) {
  play.bubbleKey = fn;
  play.bubble = fn();
}

function introBubble() {
  const c = data.active.current;
  if (isQuiz()) return { mood: 'happy', lead: T('quizOf', { i: data.active.index + 1, n: data.active.length }), text: T('quizPrompt') };
  return { mood: 'happy', text: c.msg ? T(c.msg) : T('prompt', { pick: c.prompt }) };
}

function goHome() {
  stopSpeaking();
  save(data);
  go('welcome');
}

// ---------------------------------------------------------------- play view
function viewPlay() {
  const s = data.active;
  const mul = isMul();
  return h('main', { class: `rm-screen rm-play ${play.showBlocks || mul ? 'with-blocks' : 'no-blocks'} ${mul ? 'is-mul' : ''} ${isQuiz() ? 'quiz' : ''}` },
    topBar(s),
    h('section', { class: 'rm-a-bubble' }, bubbleEl(play.bubble)),
    h('section', { class: 'rm-a-problem' }, mul ? mulCard() : problemCard()),
    play.showBlocks || mul ? h('section', { class: 'rm-a-blocks' }, mul ? groupsPanel() : matPanel()) : null,
    h('section', { class: 'rm-a-pad' }, padEl()),
    h('nav', { class: 'rm-a-tools' }, toolsEl()));
}

function topBar(s) {
  const dots = [];
  for (let i = 0; i < s.length; i++) {
    const done = i < s.index || (i === s.index && play.status === 'solved');
    dots.push(h('span', { class: `rm-dot ${done ? 'done' : ''} ${i === s.index ? 'now' : ''}`, html: done ? icon('star') : '' }));
  }
  const n = data.rewards.pieces;
  return h('header', { class: 'rm-top' },
    button(null, goHome, { cls: 'icon soft', ic: 'home', aria: T('home'), k: 'home' }),
    h('div', { class: 'rm-dots', role: 'img', 'aria-label': T('problemOf', { i: Math.min(s.index + 1, s.length), n: s.length }) }, dots),
    h('div', { class: `rm-pieces ${play.bump ? 'bump' : ''}`, role: 'img', 'aria-label': T('pieces', { n }) },
      h('span', { html: pieceSVG(n) }), h('b', null, String(n))),
    prizeMini(),
    s.mode === 'quiz' ? h('div', { class: 'rm-level-chip quiz' }, h('span', { 'aria-hidden': 'true' }, '\u{1F3C6}'), h('b', null, T('quizChip'))) : s.mode === 'path' ? levelChip() : null,
    soundButton());
}

function problemCard() {
  const c = data.active.current;
  const p = play.p;
  const solved = play.status === 'solved';
  return h('div', { class: `rm-card rm-problem ${play.drawing ? 'drawing' : ''}` },
    c.story != null ? h('p', { class: 'rm-story' }, storyText(L(), p, c.story)) : null,
    h('p', { class: 'rm-eq', 'aria-label': T('whatIs', { a: p.a, b: p.b, opw: opWord(p.op) }) },
      h('span', { class: 'num-a' }, String(p.a)), ` ${opSym(p.op)} `, h('span', { class: 'num-b' }, String(p.b)), ' = ',
      h('span', { class: solved ? 'num-ans' : 'num-q' }, solved ? String(p.answer) : '?')),
    writtenEl(),
    h('canvas', { class: 'rm-ink', 'aria-hidden': 'true' }),
    play.drawing ? h('div', { class: 'rm-ink-bar' },
      button(T('undo'), undoStroke, { cls: 'small soft', ic: 'undo', k: 'ink-undo', disabled: !play.strokes.length }),
      button(T('eraseAll'), eraseInk, { cls: 'small soft', ic: 'eraser', k: 'ink-erase', disabled: !play.strokes.length })) : null);
}

function curStep() {
  return play.guided ? play.guided.steps[play.guided.i] : null;
}

function writtenEl() {
  const p = play.p, m = play.model;
  const a10 = tensOf(p.a), a1 = onesOf(p.a), b10 = tensOf(p.b), b1 = onesOf(p.b);
  const traded = m.trades > 0;
  const fc = play.focusCol || play.coachFocus;
  let ansT = '', ansO = '', penT = false, penO = false;
  const st = curStep();
  if (play.status === 'solved') {
    ansT = p.answer >= 10 ? String(tensOf(p.answer)) : '';
    ansO = String(onesOf(p.answer));
  } else if (usingCells()) {
    ansT = play.cells.tens;
    ansO = play.cells.ones;
  }
  void st;
  if (!ansO && play.marks.ones != null) { ansO = String(play.marks.ones); penO = true; }
  if (!ansT && play.marks.tens != null && play.marks.tens > 0) { ansT = String(play.marks.tens); penT = true; }

  // Carrying (addition) or trading (subtraction) is drawn as an arrow between the columns,
  // and the moved number glides into place the moment it happens.
  const fresh = play.carryFresh && !reduced();
  const flyFromBox = !!play.carryFromBox;
  const arrow = (dir) => h('span', { class: `rm-w-arrow ${dir} ${fresh ? 'fresh' : ''}`, html: CARRY_ARROW, 'aria-hidden': 'true' });
  let markT = null, markO = null;
  if (traded && p.op === '+') {
    markT = h('span', { class: 'rm-w-markwrap' }, h('span', { class: `rm-carry ${fresh && !flyFromBox ? 'fly-left' : ''}` }, '1'), arrow('to-tens'));
  }
  if (traded && p.op === '-') {
    markT = h('span', { class: 'rm-w-markwrap' }, h('span', { class: 'rm-borrow-t' }, String(a10 - 1)), arrow('to-ones'));
    markO = h('span', { class: `rm-carry wide ${fresh ? 'fly-right' : ''}` }, String(a1 + 10));
  }
  const gst = play.status === 'guided' ? curStep() : null;
  if (gst && gst.split && !traded) {
    // 9 + 2 = 11: the 1 ten (yellow) and the 1 one, sitting over the ones column
    const tensDigit = gst.kind === 'carry'
      ? h('button', { type: 'button', class: 'rm-split-t tap', 'data-k': 'carry-chip', 'aria-label': T('act_carry'), onclick: doCarry }, '1')
      : h('b', { class: 'rm-split-t' }, '1');
    markO = h('span', { class: 'rm-split' }, tensDigit, h('b', { class: 'rm-split-o' }, String(gst.params.s % 10)));
    if (gst.kind === 'carry') {
      markT = h('button', { type: 'button', class: 'rm-carry-target', 'data-k': 'carry-target', 'aria-label': T('act_carry'), onclick: doCarry }, '?');
    }
  }
  const quiz = isQuiz() && !gst;
  if (quiz) {
    // like on paper: the little boxes on top are hers to fill or leave empty, on every problem
    const sbox = (col) => h('button', {
      type: 'button',
      class: `rm-scratch ${play.status === 'ask' && play.activeCell === `s${col}` ? 'active' : ''} ${play.scratch[col] ? 'filled' : ''}`,
      'data-k': `cell-s${col}`,
      'aria-label': `${T(col === 'T' ? 'scratchT' : 'scratchO')}: ${play.scratch[col] || '?'}`,
      disabled: play.status !== 'ask',
      onclick: () => selectCell(`s${col}`),
    }, play.scratch[col] || '');
    markT = sbox('T');
    markO = p.op === '-' ? sbox('O') : null;
  }
  const struck = quiz && play.strike;
  const cell = (txt, col, extra = '') => h('span', { class: `rm-w-c ${col} ${fc === col ? 'focus' : ''} ${extra}` }, txt);
  const borrowNow = gst && gst.kind === 'borrow' && !traded;
  // while answering on her own, Mila may tap the tens digit to borrow when she needs to
  const borrowOwn = !isQuiz() && play.status === 'ask' && p.op === '-' && a1 < b1 && !traded && play.phase === 'ones';
  const topTens = quiz && p.op === '-'
    ? h('button', { type: 'button', class: `rm-w-c tens num-a rm-borrow-btn quiet ${struck ? 'struck' : ''}`, 'data-k': 'borrow-digit', 'aria-label': T('strikeTens'), disabled: play.status !== 'ask', onclick: quizStrike }, String(a10))
    : borrowNow || borrowOwn
    ? h('button', { type: 'button', class: `rm-w-c tens num-a rm-borrow-btn ${borrowOwn ? 'quiet' : ''}`, 'data-k': 'borrow-digit', 'aria-label': T('act_borrow'), onclick: borrowOwn ? borrowByTap : doBorrow }, String(a10))
    : cell(String(a10), 'tens', `num-a ${traded && p.op === '-' ? 'struck' : ''}`);
  const cellsOn = usingCells() && play.status !== 'solved';
  const box = (txt, col, pen) => h('button', {
    type: 'button',
    class: `rm-w-c ${col} rm-w-ans ${play.popKey && Date.now() - play.popKey < 120 && play.activeCell === col ? 'pop' : ''} ${pen ? 'pencil' : ''} ${(play.entryStale || play.staleCell === col) && !pen ? 'stale' : ''} ${cellsOn && play.activeCell === col ? 'active' : ''} ${fc === col ? 'focus' : ''} ${String(txt).length === 2 ? 'two' : ''}`,
    'data-k': `cell-${col}`,
    'aria-label': `${col === 'tens' ? T('tensCol') : T('onesCol')}: ${txt || '?'}`,
    disabled: !cellsOn,
    onclick: () => selectCell(col),
  }, col === 'ones' && play.splitting && String(txt).length === 2
    ? [h('span', { class: 'rm-box-ten' }, String(txt)[0]), String(txt)[1]]
    : txt);
  return h('div', { class: `rm-written ${traded || quiz || (gst && gst.split) ? 'traded' : ''} ${quiz ? 'quiz' : ''}` },
    h('span', { class: 'rm-w-op' }), cell(T('tensCol'), 'tens', 'rm-w-h'), cell(T('onesCol'), 'ones', 'rm-w-h'),
    h('span', { class: 'rm-w-op' }), cell(markT, 'tens', 'rm-w-mark'), cell(markO, 'ones', 'rm-w-mark'),
    h('span', { class: 'rm-w-op' }), topTens, cell(String(a1), 'ones', `num-a ${(traded && p.op === '-' && !quiz) || struck ? 'struck' : ''}`),
    h('span', { class: 'rm-w-op' }, opSym(p.op)), cell(String(b10), 'tens', 'num-b'), cell(String(b1), 'ones', 'num-b'),
    h('span', { class: 'rm-w-line' }),
    h('span', { class: 'rm-w-op' }), box(ansT, 'tens', penT), box(ansO, 'ones', penO));
}
const CARRY_ARROW = '<svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="M88 26 C80 4 20 4 12 26" fill="none" stroke="#e8590c" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path class="head-l" d="M4 18 L12 28 L20 17" fill="none" stroke="#e8590c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path class="head-r" d="M80 17 L88 28 L96 18" fill="none" stroke="#e8590c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';

function padEl() {
  const st = curStep();
  const guided = play.status === 'guided';
  const solved = play.status === 'solved';
  const disabled = solved || (guided && (!st || (st.kind !== 'ask' && st.kind !== 'write')));
  let label = T('answerLabel');
  if (guided && st && st.kind === 'ask') label = `${st.label || `${st.params.x} + ${st.params.y}`} = ?`;
  else if (isMul()) label = `${play.p.a} \u00d7 ${play.p.b} = ?`;
  const cellsOn = usingCells();
  let shown = play.entry;
  let tip = null;
  if (cellsOn && play.status === 'ask' && isQuiz()) {
    const ac = play.activeCell;
    label = T('quizTyping', { box: ac === 'sT' || ac === 'sO' ? T('boxTop') : ac === 'ones' ? T('onesCol') : T('tensCol') });
    shown = ac === 'sT' ? play.scratch.T : ac === 'sO' ? play.scratch.O : play.cells[ac];
  } else if (cellsOn && play.status === 'ask') {
    const info = colInfo();
    const col = phaseCell();
    label = `${col === 'ones' ? T('onesCol') : T('tensCol')}: ${col === 'ones' ? info.onesExpr : info.tensExpr} = ?`;
    shown = play.staleCell === col ? play.cells[col] : play.cells[col];
    tip = col === 'ones' ? T('tipOnes') : T('tipTens');
    if (col === 'ones' && play.p.op === '-' && info.borrow && !info.borrowed) tip = T('tipBorrow', { x: info.a1, y: info.b1, t: info.a10 });
    if (col === 'ones' && play.p.op === '-' && info.borrowed && info.a1 > 0) tip = T('tipSplit', { o: info.a1 + 10, r: info.a1 });
  } else if (cellsOn) {
    label = T('typingIn', { box: play.activeCell === 'ones' ? T('onesCol') : T('tensCol') });
    shown = play.cells[play.activeCell];
  }
  const key = (d) => button(String(d), () => press(String(d)), { cls: 'rm-key', k: `key-${d}`, disabled });
  const last = data.active.index + 1 >= data.active.length;
  return h('div', { class: `rm-pad ${disabled ? 'off' : ''}` },
    solved
      ? button(last ? T('finish') : T('next'), goNext, { cls: 'primary big rm-next', ic: 'next', k: 'next' })
      : h('div', { class: 'rm-entry' },
        h('span', { class: 'rm-entry-l' }, label),
        h('span', { class: `rm-entry-v ${play.entryStale ? 'stale' : ''} ${play.popKey && Date.now() - play.popKey < 120 ? 'pop' : ''}` }, shown || ' '),
        tip ? h('span', { class: 'rm-entry-tip' }, tip) : null),
    h('div', { class: 'rm-keys' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key),
      button(null, del, { cls: 'rm-key soft', ic: 'del', aria: T('del'), k: 'key-del', disabled }),
      key(0),
      button(null, submit, { cls: 'rm-key primary', ic: 'check', aria: T('check'), k: 'key-ok', disabled })));
}

function toolsEl() {
  const st = play.status;
  return [
    button(T('help'), startGuided, { ic: 'help', k: 't-help', disabled: st !== 'ask' || s0().mode === 'placement', cls: 'tool' }),
    button(play.showBlocks ? T('hideBlocks') : T('blocks'), toggleBlocks, { ic: 'blocks', k: 't-blocks', disabled: st === 'guided' || isMul(), cls: 'tool' }),
    button(play.drawing ? T('drawDone') : T('draw'), toggleDraw, { ic: 'pencil', k: 't-draw', cls: `tool ${play.drawing ? 'on' : ''}`, pressed: play.drawing }),
    button(T('read'), readProblem, { ic: 'read', k: 't-read', cls: 'tool' }),
    button(T('takeBreak'), () => go('break'), { ic: 'rest', k: 't-break', cls: 'tool' }),
  ];
}

function readProblem() {
  const c = data.active.current, p = play.p;
  const parts = [];
  if (c.story != null) parts.push(storyText(L(), p, c.story));
  parts.push(T('whatIs', { a: p.a, b: p.b, opw: opWord(p.op) }));
  const text = parts.join(' ');
  // English: read with the recorded voice (joined pieces); otherwise the device voice
  unlockMedia();
  const ids = data.settings.coachVoiceKind !== 'device' ? readSequence(L(), p, c.story) : null;
  if (!ids) { readAloud(text); return; }
  playSequence(ids).then((ok) => { if (!ok) readAloud(text); });
}

function toggleBlocks() {
  play.showBlocks = !play.showBlocks;
  const c = data.active.current;
  c.showBlocks = play.showBlocks;
  if (play.showBlocks) c.blocksUsed = true;
  save(data);
  sfx.tap();
  update();
}

// ---------------------------------------------------------------- keypad
// A little burst of colored sparkles from the key, and the number bounces into its box.
function keyBurst(d) {
  if (reduced()) return;
  const key = root.querySelector(`[data-k="key-${d}"]`);
  if (!key) return;
  const r = key.getBoundingClientRect();
  const b = h('div', { class: 'rm-keyburst', 'aria-hidden': 'true', style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px` },
    Array.from({ length: 10 }, (_, i) => h('span', { style: `--a:${i * 36}deg;--c:${RAINBOW[i % RAINBOW.length]}` })));
  root.append(b);
  setTimeout(() => b.remove(), 650);
}

function press(d) {
  if (play.status === 'solved') return;
  play.popKey = Date.now();
  setTimeout(() => keyBurst(d), 0);
  const st = curStep();
  if (play.status === 'guided' && (!st || (st.kind !== 'ask' && st.kind !== 'write'))) return;
  if (play.status === 'guided' && st.kind === 'write') {
    if (play.splitting) return;
    const cur = play.cells[st.cell];
    play.cells[st.cell] = st.carryAuto && cur.length === 1 && cur !== '0' && !play.entryStale ? cur + d : d;
    play.activeCell = st.cell;
    play.entryStale = false;
    sfx.tap();
    update();
    return;
  }
  if (play.status === 'ask' && !isMul() && isQuiz()) {
    const col = play.activeCell;
    if (col === 'sT') play.scratch.T = d;
    else if (col === 'sO') { const cur = play.scratch.O; play.scratch.O = cur.length >= 2 || cur === '0' ? d : cur + d; }
    else {
      play.cells[col] = d;
      if (col === 'ones' && play.cells.tens === '') play.activeCell = 'tens';
    }
    play.entryStale = false;
    sfx.tap();
    update();
    return;
  }
  if (play.status === 'ask' && !isMul()) {
    if (play.splitting) return;
    const col = phaseCell();
    if (play.staleCell === col || play.entryStale) { play.cells[col] = ''; play.staleCell = null; play.entryStale = false; }
    if (col === 'ones') {
      // the ones can add up to a two-digit number, like 4 + 8 = 12
      const cur = play.cells.ones;
      play.cells.ones = cur.length >= 2 || cur === '0' ? d : cur + d;
    } else {
      play.cells.tens = d;
    }
    play.activeCell = col;
    sfx.tap();
    update();
    return;
  }
  if (play.entryStale) { play.entry = ''; play.entryStale = false; }
  if (play.entry === '0') play.entry = '';
  if (play.entry.length >= 2) return;
  play.entry += d;
  sfx.tap();
  update();
}

function del() {
  if (play.status === 'solved') return;
  const gs = play.status === 'guided' ? curStep() : null;
  if (gs && gs.kind === 'write') { play.cells[gs.cell] = ''; update(); return; }
  if (play.status === 'ask' && !isMul() && isQuiz()) {
    const col = play.activeCell;
    if (col === 'sT') play.scratch.T = '';
    else if (col === 'sO') play.scratch.O = play.scratch.O.slice(0, -1);
    else play.cells[col] = '';
    update();
    return;
  }
  if (play.status === 'ask' && !isMul()) {
    if (play.splitting) return;
    const col = phaseCell();
    play.cells[col] = play.staleCell === col ? '' : play.cells[col].slice(0, -1);
    play.staleCell = null;
    play.entryStale = false;
    update();
    return;
  }
  if (play.entryStale) { play.entry = ''; play.entryStale = false; }
  play.entry = play.entry.slice(0, -1);
  update();
}

function submit() {
  if (!play || play.status === 'solved' || play.leaving) return;
  if (play.status === 'guided') {
    const st = curStep();
    if (!st || (st.kind !== 'ask' && st.kind !== 'write')) return;
    const g = st.kind === 'write'
      ? (play.cells[st.cell] === '' ? null : Number(play.cells[st.cell]))
      : parseEntry(play.entryStale ? '' : play.entry);
    if (g === null) { toast(T('blankEntry')); sfx.soft(); return; }
    return submitGuided(g);
  }
  if (play.status === 'ask' && isMul()) return submitMulEntry();
  if (play.status === 'ask' && isQuiz()) return quizSubmit();
  if (play.status === 'ask') return submitColumn();
  const n = usingCells() ? cellsValue() : parseEntry(play.entryStale ? '' : play.entry);
  if (n === 'needOnes') {
    play.activeCell = 'ones';
    toast(T('fillOnes'));
    sfx.soft();
    update();
    return;
  }
  if (n === null) {
    toast(T('blankEntry'));
    sfx.soft();
    return;
  }
  if (play.status === 'guided') return submitGuided(n);
  const p = play.p;
  const c = data.active.current;
  const res = analyzeAnswer(p, n);
  if (res.correct) return solve();
  c.wrongs++;
  save(data);
  sfx.soft();
  if (c.wrongs === 1) {
    play.focusCol = res.focus;
    play.entryStale = true;
    const leadPick = rand(3);
    const kind = res.kind;
    setBubble(() => ({
      mood: 'think',
      lead: T('wrong1', { pick: leadPick }),
      text: T(`a_${kind}`, { d: res.digit, ans: n, a: p.a }),
      buttons: [
        { label: T('tryAgain'), onClick: tryAgain, primary: true, k: 'try' },
        { label: T('helpSteps'), onClick: startGuided, ic: 'help', k: 'steps' },
      ],
    }));
    update();
  } else {
    startGuided(T('wrong2'));
  }
}

function tryAgain() {
  play.entry = '';
  if (play.status === 'ask' && !isMul()) {
    play.cells[phaseCell()] = '';
    play.staleCell = null;
    play.entryStale = false;
    setBubble(() => ({ mood: 'happy', text: T('prompt', { pick: data.active.current.prompt }) }));
    update();
    return;
  }
  clearCells();
  setBubble(() => ({ mood: 'happy', text: T('prompt', { pick: data.active.current.prompt }) }));
  update();
}

// ---------------------------------------------------------------- quiz: the whole answer, her way
function quizStrike() {
  if (!isQuiz() || play.status !== 'ask') return;
  play.strike = !play.strike;
  if (play.strike) play.activeCell = 'sT';
  sfx.tap();
  update();
}

function quizSubmit() {
  const n = cellsValue();
  if (n === 'needOnes') { play.activeCell = 'ones'; toast(T('fillOnes')); sfx.soft(); update(); return; }
  if (n === null) { toast(T('blankEntry')); sfx.soft(); return; }
  if (n === play.p.answer) { solve(); return; }
  quizWrong(n);
}

// A wrong quiz answer: no hints about what's wrong. One more try, or Help (which counts as help).
function quizWrong(n) {
  const c = data.active.current;
  c.wrongs++;
  c.tries = [...(c.tries || []), n];
  save(data);
  sfx.soft();
  if (c.wrongs >= 2) { quizMiss(); return; }
  sayLine('quiz_check');
  if (isMul()) play.entryStale = true;
  setBubble(() => ({
    mood: 'think',
    text: T('quizCheck'),
    buttons: [
      { label: T('tryAgain'), onClick: () => { if (isMul()) { play.entry = ''; play.entryStale = false; } setBubble(introBubble); update(); }, primary: true, k: 'try' },
      { label: T('helpSteps'), onClick: startGuided, ic: 'help', k: 'steps' },
    ],
  }));
  update();
}

// Two misses: show the answer kindly and move on. It's written down for the grown-ups.
function quizMiss() {
  const s = data.active, c = s.current, p = play.p;
  play.status = 'solved';
  play.solvedAt = Date.now();
  play.entry = String(p.answer);
  play.entryStale = false;
  play.cells = answerCells(p.answer);
  play.focusCol = null;
  if (isMul()) play.mulCounted = p.a;
  c.solved = true;
  c.awarded = true;
  c.independent = false;
  s.results.push({ skill: p.skill, key: p.key, independent: false });
  recordResult(data, p.skill, false);
  recordFade(data, p.skill, false);
  quizRecord(false);
  save(data);
  setBubble(() => ({ mood: 'happy', text: T('quizShow', { n: p.answer }), buttons: [{ label: T('quizNextBtn'), onClick: goNext, primary: true, ic: 'next', k: 'b-next' }] }));
  update();
}

// What the grown-ups see: her tries, whether she wrote the carry / borrow herself, and the kind of slip.
function quizRecord(ok) {
  const s = data.active, c = s.current, p = play.p;
  const sc = play.scratch || { T: '', O: '' };
  const tries = c.tries || [];
  const item = {
    key: p.key, skill: p.skill, op: p.op, a: p.a, b: p.b, answer: p.answer, tries,
    ok, firstTry: ok && !c.wrongs && !c.helped, helped: !!c.helped, blocks: !!c.blocksUsed,
    pattern: mistakePattern(p, tries[0]),
  };
  if (p.op === '+' && onesOf(p.a) + onesOf(p.b) >= 10) item.carry = sc.T === '1';
  if (p.op === '-' && onesOf(p.a) < onesOf(p.b)) item.borrow = sc.T === String(tensOf(p.a) - 1) || sc.O === String(onesOf(p.a) + 10) || !!play.strike;
  s.quiz.items.push(item);
}

// ---------------------------------------------------------------- column by column (paper method)
const phaseCell = () => (play.phase === 'tens' ? 'tens' : 'ones');

// What each column should add up to, and how to say it (e.g. "1 + 1 + 3").
function colInfo() {
  const p = play.p, m = play.model;
  const a10 = tensOf(p.a), a1 = onesOf(p.a), b10 = tensOf(p.b), b1 = onesOf(p.b);
  if (p.op === '+') {
    const sum = a1 + b1;
    const carry = sum >= 10 ? 1 : 0;
    return { a10, a1, b10, b1, carry, onesExpect: sum, onesExpr: `${a1} + ${b1}`, tensExpect: a10 + b10 + carry, tensExpr: carry ? `1 + ${a10} + ${b10}` : `${a10} + ${b10}` };
  }
  const borrow = a1 < b1 ? 1 : 0;
  const borrowed = m.trades > 0;
  return {
    a10, a1, b10, b1, borrow, borrowed,
    onesExpect: a1 + 10 * borrow - b1,
    onesExpr: `${borrowed ? a1 + 10 : a1} \u2212 ${b1}`,
    tensExpect: a10 - borrow - b10,
    tensExpr: `${a10 - borrow} \u2212 ${b10}`,
  };
}

function restartColumns() {
  play.phase = 'ones';
  play.cells = { tens: '', ones: '' };
  play.activeCell = 'ones';
  play.staleCell = null;
  play.splitting = false;
  play.model = M.makeModel(play.p);
  setBubble(introBubble);
}

function submitColumn() {
  if (play.splitting) return;
  const col = phaseCell();
  const info = colInfo();
  const raw = play.staleCell === col ? '' : play.cells[col];
  let v = raw === '' ? null : Number(raw);
  if (col === 'tens' && v === null && info.tensExpect === 0) v = 0; // no tens: the box may stay empty
  if (v === null) { toast(T('blankEntry')); sfx.soft(); return; }
  const expect = col === 'ones' ? info.onesExpect : info.tensExpect;
  if (v !== expect) { columnWrong(col, v, info); return; }
  if (col === 'tens') { solve(); return; }
  onesDone(v, info);
}

// The ones are right. For 4 + 8 = 12 the 2 stays in the box and the 1 flies up on top of the tens.
function onesDone(v, info) {
  const p = play.p;
  sfx.pop();
  play.focusCol = null;
  if (p.op === '+' && v >= 10) {
    play.splitting = true;
    play.cells.ones = String(v);
    setBubble(() => ({ mood: 'cheer', text: T('col_split', { s: v, o: v % 10 }) }));
    update();
    setTimeout(() => {
      if (!play || play.status !== 'ask' || !play.splitting) return;
      play.splitting = false;
      play.cells.ones = String(v % 10);
      play.phase = 'tens';
      play.activeCell = 'tens';
      const box = root.querySelector('[data-k="cell-ones"]');
      play.carryFromBox = box ? box.getBoundingClientRect() : null;
      setBubble(() => ({ mood: 'cheer', lead: T('col_carry_lead', { s: v, o: v % 10, t: info.a10 }), text: T('col_tens', { expr: info.tensExpr }) }));
      const moved = play.model.trades === 0 && act((m) => { if (M.canBringOnes(m)) M.bringOnes(m); return M.tradeUp(m); }, { noAdvance: true });
      if (!moved) update();
      flyCarryFromBox();
    }, reduced() ? 300 : 900);
    return;
  }
  play.cells.ones = String(v);
  play.phase = 'tens';
  play.activeCell = 'tens';
  if (p.op === '-' && info.borrow && play.model.trades === 0) {
    // she borrowed in her head: show what that looks like on paper and in the blocks
    setBubble(() => ({ mood: 'happy', lead: T('col_borrow_lead', { t0: info.a10, t: info.a10 - 1, x: info.a1, o: info.a1 + 10 }), text: T('col_tens', { expr: info.tensExpr }) }));
    if (!act(M.tradeDown, { noAdvance: true })) update();
    return;
  }
  setBubble(() => ({ mood: 'happy', lead: T('col_nice_ones'), text: T('col_tens', { expr: colInfo().tensExpr }) }));
  update();
}

function flyCarryFromBox() {
  const r = play && play.carryFromBox;
  if (play) play.carryFromBox = null;
  if (!r || reduced()) return;
  const badge = root.querySelector('.rm-carry');
  if (!badge || typeof badge.animate !== 'function') return;
  const b = badge.getBoundingClientRect();
  const dx = r.left + r.width * 0.3 - (b.left + b.width / 2);
  const dy = r.top + r.height / 2 - (b.top + b.height / 2);
  badge.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(1.3)` },
    { transform: `translate(${dx * 0.8}px, ${dy * 0.45}px) scale(1.6)`, offset: 0.45 },
    { transform: 'translate(0px, 0px) scale(1)' },
  ], { duration: 1400, easing: 'cubic-bezier(.35, .1, .25, 1)', fill: 'backwards' });
}

function borrowByTap() {
  if (play.status !== 'ask' || play.model.trades > 0) return;
  const info = colInfo();
  setBubble(() => ({
    mood: 'happy',
    lead: T('col_borrow_lead', { t0: info.a10, t: info.a10 - 1, x: info.a1, o: info.a1 + 10 }),
    text: T('col_ones_now', { expr: colInfo().onesExpr }),
    buttons: info.a1 > 0 ? [{ label: T('btn_split10', { r: info.a1 }), onClick: () => startGuided(null, 'w_from_ten'), ic: 'blocks', k: 'split10' }] : [],
  }));
  if (!act(M.tradeDown, { noAdvance: true })) update();
}

function columnWrong(col, v, info) {
  if (data.active.mode === 'placement') { placementMiss(); return; }
  const p = play.p;
  const c = data.active.current;
  c.wrongs++;
  save(data);
  sfx.soft();
  if (c.wrongs >= 2) { startGuided(T('wrong2')); return; }
  comfort();
  play.focusCol = col;
  play.staleCell = col;
  let text;
  if (col === 'ones') {
    text = p.op === '-' && info.borrow && !info.borrowed && v === info.b1 - info.a1
      ? T('col_sub_reverse', { x: info.a1, y: info.b1, t: info.a10 })
      : p.op === '-' && info.borrowed && info.a1 > 0
        ? T('col_split10_hint', { o: info.a1 + 10, y: info.b1, r: info.a1 })
        : T('col_check_ones', { expr: info.onesExpr });
  } else if (p.op === '+' && info.carry && v === info.a10 + info.b10) {
    text = T('col_forgot_carry', { v, t: info.a10, u: info.b10 });
  } else if (p.op === '-' && info.borrow && v === info.a10 - info.b10) {
    text = T('col_forgot_borrow', { t0: info.a10, t: info.a10 - 1 });
  } else {
    text = T('col_check_tens', { expr: info.tensExpr });
  }
  const leadPick = rand(3);
  setBubble(() => ({
    mood: 'think',
    lead: T('wrong1', { pick: leadPick }),
    text,
    buttons: [
      { label: T('tryAgain'), onClick: tryAgain, primary: true, k: 'try' },
      col === 'ones' && p.op === '-' && info.borrowed && info.a1 > 0
        ? { label: T('btn_split10', { r: info.a1 }), onClick: () => startGuided(null, 'w_from_ten'), ic: 'blocks', k: 'split10' }
        : { label: T('helpSteps'), onClick: startGuided, ic: 'help', k: 'steps' },
    ],
  }));
  update();
}

// ---------------------------------------------------------------- guided help
const TEN_WORDS = ['at', 'bt', 't'];
const ONE_WORDS = ['ao', 'bo', 'o'];
function words(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = TEN_WORDS.includes(k) ? W().tens(v) : ONE_WORDS.includes(k) ? W().ones(v) : v;
  }
  return out;
}

function startGuided(lead, fromKey) {
  if (!play || play.status === 'solved' || play.status === 'guided') return;
  const c = data.active.current;
  c.helped = true;
  if (isMul()) {
    save(data);
    play.entry = '';
    play.entryStale = false;
    play.status = 'guided';
    play.mulCounted = 0;
    play.guided = { steps: buildMulSteps(play.p), i: 0, wrongs: 0, startTrades: 0, lead: typeof lead === 'string' ? lead : null };
    enterStep();
    return;
  }
  c.showBlocks = true;
  c.blocksUsed = true;
  save(data);
  play.model = M.makeModel(play.p);
  play.showBlocks = true;
  play.counting = false;
  play.marks = {};
  play.entry = '';
  clearCells();
  play.status = 'guided';
  play.guided = { steps: buildSteps(play.p), i: 0, wrongs: 0, startTrades: 0, lead: typeof lead === 'string' ? lead : null };
  const from = fromKey ? play.guided.steps.findIndex((x) => x.key === fromKey) : -1;
  if (from > 0) {
    // the earlier steps already happened: replay their blocks moves quietly
    for (let j = 0; j < from; j++) if (play.guided.steps[j].sync) M.applyAction(play.model, play.guided.steps[j].sync);
    play.guided.i = from;
  }
  enterStep();
}

function stepBubble() {
  const g = play.guided;
  const st = curStep();
  // paper-method texts talk about the written digits, so they keep plain numbers
  const params = st.key.startsWith('w_') || st.key.startsWith('m_') ? { ...st.params } : words(st.params);
  if (st.params.o != null) params.ow = W().ones(st.params.o);
  let lead = g.lead;
  if (!lead && st.lead) lead = st.lead.map((k) => T(k, params)).join(' ');
  let text = T(st.key, params);
  if ((st.kind === 'ask' || st.kind === 'write') && g.wrongs > 0) {
    if (g.wrongs === 1) lead = REMOVE_SYNC.includes(st.sync) && !g.synced ? T('g_tapTake') : ADD_SYNC.includes(st.sync) && !g.synced ? T('g_tapAdd') : st.hint ? T(st.hint, params) : T('g_count');
    else text = T('w_tell', { n: st.expect });
  }
  const buttons = [];
  if (st.kind === 'next') buttons.push({ label: T('ok', { pick: g.i }), onClick: st.final ? finishWithNext : advanceStep, primary: true, ic: 'next', k: 'g-next' });
  if (st.kind === 'carry') buttons.push({ label: T('act_carry'), onClick: doCarry, primary: true, k: 'g-act' });
  if (st.kind === 'borrow') buttons.push({ label: T('act_borrow'), onClick: doBorrow, primary: true, k: 'g-act' });
  const thinking = st.kind === 'ask' || st.kind === 'write';
  return { mood: thinking ? 'think' : 'happy', lead, text, buttons, note: T('stepOf', { i: g.i + 1, n: g.steps.length }) };
}

function enterStep() {
  const st = curStep();
  play.guided.startTrades = play.model ? play.model.trades : 0;
  if (st.count != null) play.mulCounted = st.count;
  play.guided.wrongs = 0;
  play.guided.synced = false;
  play.focusCol = st.focus || null;
  if (st.kind === 'write') { play.activeCell = st.cell; play.cells[st.cell] = ''; }
  setBubble(stepBubble);
  if (data.settings.autoRead && !coachTalks()) speak([play.bubble.lead, play.bubble.text].filter(Boolean).join(' '), L());
  update();
}

function advanceStep() {
  const g = play.guided;
  if (!g) return;
  const st = curStep();
  if (st.mark) play.marks = { ...play.marks, ...st.mark };
  g.lead = null;
  g.i = Math.min(g.i + 1, g.steps.length - 1);
  enterStep();
}

// 8 + 6 = 14 typed in the ones box: the 4 stays, the 1 ten flies up on top of the tens.
function guidedCarry(st, n) {
  sfx.pop();
  play.splitting = true;
  play.cells.ones = String(n);
  play.coach = null;
  setBubble(() => ({ mood: 'cheer', text: T('col_split', { s: n, o: n % 10 }) }));
  update();
  setTimeout(() => {
    if (!play || play.status !== 'guided' || curStep() !== st) return;
    play.splitting = false;
    play.cells.ones = String(n % 10);
    const box = root.querySelector('[data-k="cell-ones"]');
    play.carryFromBox = box ? box.getBoundingClientRect() : null;
    play.guided.i += 1; // straight on to the tens: nothing to tap in between
    enterStep();
    if (!act(M.tradeUp, { noAdvance: true })) update();
    flyCarryFromBox();
  }, reduced() ? 300 : 1100);
}

// The blocks move that goes with a step (only once).
function syncStep(st) {
  const g = play.guided;
  if (!st || !st.sync || g.synced) return;
  g.synced = true;
  act((m) => M.applyAction(m, st.sync), { noAdvance: true });
}
function doCarry() {
  const st = curStep();
  if (!st || st.kind !== 'carry') return;
  act(M.tradeUp);
}
function doBorrow() {
  const st = curStep();
  if (!st || st.kind !== 'borrow') return;
  act(M.tradeDown);
}
function finishWithNext() {
  syncStep(curStep());
  solve();
}

function submitGuided(n) {
  const g = play.guided;
  const st = curStep();
  if (!st || (st.kind !== 'ask' && st.kind !== 'write')) return;
  if (n === st.expect) {
    play.entry = '';
    play.entryStale = false;
    syncStep(st);
    if (st.final) return solve();
    if (st.carryAuto) { guidedCarry(st, n); return; }
    sfx.pop();
    advanceStep();
    return;
  }
  g.wrongs++;
  comfort();
  sfx.soft();
  if (g.wrongs === 1) {
    if (!REMOVE_SYNC.includes(st.sync) && !ADD_SYNC.includes(st.sync)) syncStep(st);
    play.counting = true;
    play.countedEver = true;
  }
  if (st.kind === 'write') play.cells[st.cell] = '';
  else play.entryStale = true;
  setBubble(stepBubble);
  if (data.settings.autoRead) speak([play.bubble.lead, play.bubble.text].filter(Boolean).join(' '), L());
  update();
}

// ---------------------------------------------------------------- solving
function solve() {
  const s = data.active, c = s.current, p = play.p;
  const wasGuided = play.status === 'guided';
  play.status = 'solved';
  play.solvedAt = Date.now();
  play.entry = String(p.answer);
  play.entryStale = false;
  play.cells = answerCells(p.answer);
  play.focusCol = null;
  play.marks = {};
  if (!c.awarded) {
    c.awarded = true;
    c.solved = true;
    // in a quiz, fixing her own answer on the 2nd try still counts as on her own
    const independent = s.mode === 'quiz' ? !c.helped : !c.helped && c.wrongs === 0;
    c.independent = independent;
    const key = `${s.id}:${s.index}`;
    if (!data.rewards.awarded.includes(key)) {
      data.rewards.pieces++;
      data.rewards.awarded = [...data.rewards.awarded, key].slice(-80);
      play.bump = true;
      checkPrizes();
      const pz = nextPrize();
      const left = pz ? pz.goal - data.rewards.pieces : 0;
      if (pz && !s.prizeWon && left > 0 && left <= 3 && !pz.nearSaid) { pz.nearSaid = true; play.sayPrizeClose = true; }
    }
    if (s.mode === 'placement') placementRecord(independent);
    if (s.mode === 'quiz') quizRecord(true);
    if (s.mode !== 'placement') recordFade(data, p.skill, independent);
    s.results.push({ skill: p.skill, key: p.key, independent });
    const note = recordResult(data, p.skill, independent);
    if (c.helped && s.mode !== 'quiz') { s.repeatSkill = p.skill; s.repeatLevel = p.level; s.note = 'similar'; }
    if (s.mode === 'path') {
      const r = recordPath(data.progress.path, independent);
      if (independent) play.starEarned = true;
      if (r.quizNow) { s.quizNext = true; s.repeatSkill = null; s.note = null; } // a quiz level is full: quiz time
      if (r.leveledUp) { s.levelUp = r.level; s.repeatSkill = null; s.note = null; }
      play.pathNote = independent ? starsNote() : null;
    }
    if (note.eased) {
      s.note = 'support';
      s.ease = true;
      if (BASE_SKILL[p.skill] && data.progress.skills[p.skill].level === 1) s.repeatSkill = BASE_SKILL[p.skill];
    }
    if (note.levelUp && !c.helped && s.mode !== 'path') s.note = 'harder';
    if (s.mode !== 'path' && note.unlocked && (s.mode === 'mix' || (s.mode === 'add' && note.unlocked === 'C') || (s.mode === 'sub' && note.unlocked === 'D'))) {
      s.repeatSkill = note.unlocked;
      s.note = null;
    }
    save(data);
  }
  const independent = c.independent;
  const pickN = rand(4);
  if (isMul()) play.mulCounted = p.a;
  const praiseKey = isMul() ? (play.countedGroups ? 'p_groups' : null) : play.tradedEver ? (p.op === '+' ? 'p_tradedAdd' : 'p_tradedSub')
    : play.countedEver ? 'p_counted'
      : c.wrongs > 0 && !c.helped ? 'p_fixed'
        : p.regroup ? 'p_onesCareful'
          : play.movedBlocks ? 'p_blocks' : null;
  const pathNote = play.pathNote;
  setBubble(() => { const b = solvedBubble({ wasGuided, independent, pickN, praiseKey }); if (pathNote) b.text = `${b.text ? `${b.text} ` : ''}${T(pathNote.key, pathNote)}`; return b; });
  sfx.correct();
  if (wasGuided || !c.independent) sayLine('team'); else cheer();
  if (play.sayPrizeClose) {
    play.sayPrizeClose = false;
    const me = play;
    setTimeout(() => { if (play === me && screen === 'play') sayLine('prize_close'); }, 2300);
  }
  setTimeout(() => sfx.reward(), 450);
  update();
  if (play.starEarned) flyStar();
  play.bump = false;
  play.starEarned = false;
  burst();
  if (pathNote && pathNote.left === 1 && !s.levelUp && !s.quizNext) {
    const me = play;
    setTimeout(() => { if (play === me && screen === 'play') sayLine('one_more_star'); }, 2300);
  }
}

// After a star: "2 more stars to Level 24!" (or to the quiz, or "Level up!").
function starsNote() {
  const path = data.progress.path;
  const s = data.active;
  if (s.levelUp) return { key: 'noteLevelUp', n: s.levelUp };
  if (s.quizNext) return { key: 'noteQuiz' };
  const lv = levelInfo(path.level);
  const left = lv.goal - path.stars;
  if (left <= 0 || path.champion) return null;
  return { key: `${lv.gate ? 'noteToQuiz' : 'noteToLevel'}${left === 1 ? '1' : ''}`, n: left, l: path.level + 1, left };
}

// A star flies from the problem up into the level chip.
function flyStar() {
  if (reduced()) return;
  const chip = root.querySelector('.rm-level-chip');
  const from = root.querySelector('.rm-eq') || root.querySelector('.rm-problem') || root.querySelector('.lu-scene');
  if (!chip || !from) return;
  const a = from.getBoundingClientRect(), b = chip.getBoundingClientRect();
  const el = h('div', { class: 'rm-flystar', 'aria-hidden': 'true', html: icon('star'), style: `left:${a.left + a.width / 2 - 24}px;top:${a.top + a.height / 2 - 24}px` });
  root.append(el);
  if (typeof el.animate !== 'function') { el.remove(); return; }
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  el.animate([
    { transform: 'translate(0, 0) scale(.4) rotate(0deg)', opacity: 0 },
    { transform: 'translate(0, -30px) scale(1.6) rotate(-20deg)', opacity: 1, offset: 0.3 },
    { transform: `translate(${dx}px, ${dy}px) scale(.6) rotate(200deg)`, opacity: 1 },
  ], { duration: 1100, easing: 'cubic-bezier(.5, 0, .3, 1)' }).onfinish = () => { el.remove(); const c = root.querySelector('.rm-level-chip'); if (c) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } };
}

function solvedBubble(info) {
  const p = play.p;
  const last = data.active.index + 1 >= data.active.length;
  const nextBtn = { label: last ? T('finish') : T('next'), onClick: goNext, primary: true, ic: 'next', k: 'b-next' };
  if (!info) return { mood: 'cheer', text: `${p.a} ${opSym(p.op)} ${p.b} = ${p.answer}`, buttons: [nextBtn] };
  const eq = `${p.a} ${opSym(p.op)} ${p.b} = ${p.answer}.`;
  if (info.wasGuided) {
    return { mood: 'cheer', lead: p.op === '\u00d7' ? T('m_so', { a: p.a, b: p.b, n: p.answer }) : T('g_done', { n: p.answer }), text: `${T('rightTeam')} ${info.praiseKey ? T(info.praiseKey) : ''}`.trim(), buttons: [nextBtn] };
  }
  return {
    mood: 'cheer',
    lead: `${T('right', { pick: info.pickN })} ${eq}`,
    text: info.praiseKey ? T(info.praiseKey) : '',
    buttons: [nextBtn],
  };
}

function burst() {
  if (reduced()) return;
  const card = root.querySelector('.rm-problem');
  if (!card) return;
  const b = h('div', { class: 'rm-burst', 'aria-hidden': 'true' });
  for (let i = 0; i < 7; i++) b.append(h('span', { style: `--i:${i}`, html: pieceSVG(i) }));
  card.append(b);
  setTimeout(() => b.remove(), 1400);
}

function goNext() {
  const s = data.active;
  if (!play || play.leaving || !s || !s.current || !s.current.solved) return;
  if (play.solvedAt && Date.now() - play.solvedAt < 700) return; // let the celebration be seen
  play.leaving = true;
  stopSpeaking();
  s.index++;
  save(data);
  if (s.mode === 'placement') {
    if (s.place.finished || s.index >= s.length) finishPlacement();
    else { newProblem(); go('play'); }
    return;
  }
  if (s.prizeWon) { go('prize'); sayLine('prize'); return; }
  if (s.levelUp) { go('levelup'); sayLine('levelup'); return; }
  continueSession();
}

function continueSession() {
  const s = data.active;
  if (!s) { go('welcome'); return; }
  if (s.mode === 'little' || s.mode === 'lquiz') { lContinue(); return; }
  if (s.quizNext) { endForQuiz(); return; }
  if (s.mode === 'quiz' && s.index >= s.length) { finishQuiz(); return; }
  if (s.index >= s.length) finishSession();
  else { newProblem(); go('play'); }
}

function afterLevelUp() {
  const s = data.active;
  if (!s) { if (quizResult) { quizDoneNext(); return; } go('welcome'); return; }
  s.levelUp = null;
  save(data);
  continueSession();
}

// ---------------------------------------------------------------- Luna's world (little kids, 4–5)
// Pictures to count, numbers to find, and adding / taking away with pictures. She answers
// by tapping big buttons, and everything is said out loud. Tapping a picture counts it aloud.
function startLittle(quiz = false) {
  const lp = data.progress.lpath;
  stopSpeaking();
  play = null;
  data.active = {
    id: Date.now().toString(36) + rand(1000),
    mode: quiz ? 'lquiz' : 'little',
    length: quiz ? QUIZ.size : 5,
    index: 0,
    results: [],
    used: [],
    current: null,
    finished: false,
    quiz: quiz ? { level: lp.level, counts: !!lp.quizDue, items: [] } : null,
  };
  lNew();
  go('lplay');
  lSay();
}

function lNew() {
  const s = data.active;
  const [skill, max] = pickLittle(data.progress.lpath.level, Math.random, s.mode === 'lquiz');
  const p = makeLittle(skill, max, Math.random, s.used);
  s.current = { p, wrongs: 0, solved: false, awarded: false, picked: [] };
  s.used.push(p.key);
  save(data);
  lInit();
}

function lInit() {
  const c = data.active.current;
  lplay = { status: c.solved ? 'solved' : 'ask', marks: {}, total: 0, help: false, wrong: c.picked ? c.picked.slice() : [], show: false, bump: false, starEarned: false, leaving: false };
}

// Says the question in the recorded voice ("How many ducks? Count them, then tap the number!").
// Says the question in the recorded voice. Adding and taking away are joined from recorded
// pieces ("What is" + "thirty" + "plus" + "twenty"), skip counting says the numbers.
function lSay() {
  const s = data.active;
  const p = s && s.current && s.current.p;
  if (!p) return;
  unlockMedia();
  const lang = L();
  const num = (x) => `${lang}-rd-n${x}`;
  let ids = null;
  if (p.op) ids = [`${lang}-rd-what`, num(p.a), `${lang}-rd-${p.op === '+' ? 'plus' : 'minus'}`, num(p.b)];
  else if (p.skill === 'make10') ids = [`${lang}-rd-what`, num(10), `${lang}-rd-minus`, num(p.a)];
  else if (p.skill === 'skip' || p.skill === 'skipTo') ids = [...p.seq.map(num), clipId(lang, 'lu_next')];
  if (ids) {
    if (!voiceOn()) return;
    const text = p.op ? `${T('whatIs', { a: p.a, b: p.b, opw: opWord(p.op) })}` : p.skill === 'make10' ? T('l_q_make10') : `${p.seq.join(', ')}. ${T('l_q_skip')}`;
    if (data.settings.coachVoiceKind === 'device') { speak(text, lang); return; }
    playSequence(ids).then((ok) => {
      if (ok) return;
      if (p.seq) playSequence(p.seq.map(num)).then((ok2) => { if (!ok2) speak(text, lang); });
      else speak(text, lang);
    });
    return;
  }
  if (p.skill === 'count') sayLine(`lu_count_${p.obj}`);
  else if (p.skill === 'find') sayLine('lu_find', p.n);
  else if (p.skill === 'after') sayLine('lu_after', p.n);
  else if (p.skill === 'before') sayLine('lu_before', p.n);
  else if (p.skill === 'tens') sayLine('lu_tens');
  else if (p.skill === 'compare') sayLine('lu_bigger');
  else sayLine(`lu_${p.skill}`);
}

function lQuestion(p) {
  if (p.op) return `${p.a} ${p.op === '+' ? '+' : '−'} ${p.b} = ?`;
  if (p.skill === 'count') return T('l_q_count', { obj: T(`obj_${p.obj}`) });
  if (p.skill === 'find') return T('l_q_find', { n: p.n });
  if (p.skill === 'after') return T('l_q_after', { n: p.n });
  if (p.skill === 'before') return T('l_q_before', { n: p.n });
  if (p.skill === 'skip' || p.skill === 'skipTo') return T('l_q_skip');
  return T(`l_q_${p.skill}`);
}

// Tapping a picture counts it out loud: "one", "two", "three"...
// Tapping a picture counts it out loud: "one, two, three". A tens bar counts 10 at once:
// "ten, twenty, thirty", then the ones keep going: "thirty-one, thirty-two".
function lTapObj(id, value = 1) {
  if (!lplay || lplay.status !== 'ask' || lplay.marks[id] != null) return;
  lplay.total += value;
  lplay.marks[id] = lplay.total;
  sfx.pop();
  update();
  if (voiceOn() && lplay.total <= 100) { unlockMedia(); playSequence([`${L()}-rd-n${lplay.total}`]); }
}

function lAnswer(v) {
  const s = data.active;
  if (!s || !lplay || lplay.status !== 'ask' || lplay.wrong.includes(v)) return;
  const c = s.current, p = c.p;
  unlockAudio();
  if (v === p.answer) { lSolve(); return; }
  c.wrongs++;
  c.picked.push(v);
  lplay.wrong.push(v);
  sfx.soft();
  save(data);
  if (c.wrongs >= 2) { lMiss(); return; }
  if (s.mode !== 'lquiz') { lplay.help = true; lplay.marks = {}; lplay.total = 0; sayLine('lu_help'); } else sayLine('quiz_check');
  update();
}

function lItem(ok) {
  const c = data.active.current, p = c.p;
  return { key: p.key, skill: p.skill, little: true, ok, firstTry: ok && c.wrongs === 0, helped: false, tries: c.picked.slice(), answer: p.answer };
}

function lSolve() {
  const s = data.active, c = s.current, p = c.p;
  lplay.status = 'solved';
  c.solved = true;
  if (!c.awarded) {
    c.awarded = true;
    const key = `${s.id}:${s.index}`;
    if (!data.rewards.awarded.includes(key)) {
      data.rewards.pieces++;
      data.rewards.awarded = [...data.rewards.awarded, key].slice(-80);
      lplay.bump = true;
      checkPrizes();
    }
    const st = data.progress.lstats[p.skill] || (data.progress.lstats[p.skill] = { tries: 0, first: 0 });
    st.tries++;
    if (c.wrongs === 0) st.first++;
    s.results.push({ skill: p.skill, key: p.key, independent: true });
    if (s.mode === 'lquiz') s.quiz.items.push(lItem(true));
    else {
      const r = recordPath(data.progress.lpath, true, LITTLE_LEVELS);
      lplay.starEarned = true;
      if (r.quizNow) s.quizNext = true;
      if (r.leveledUp) s.levelUp = r.level;
    }
    save(data);
  }
  sfx.correct();
  cheer();
  setTimeout(() => sfx.reward(), 450);
  update();
  if (lplay.starEarned) flyStar();
  lplay.bump = false;
  lplay.starEarned = false;
}

// Two misses: the right button lights up, kindly, and on to the next one.
function lMiss() {
  const s = data.active, c = s.current, p = c.p;
  lplay.status = 'solved';
  lplay.show = true;
  c.solved = true;
  c.awarded = true;
  const st = data.progress.lstats[p.skill] || (data.progress.lstats[p.skill] = { tries: 0, first: 0 });
  st.tries++;
  s.results.push({ skill: p.skill, key: p.key, independent: false });
  if (s.mode === 'lquiz') s.quiz.items.push(lItem(false));
  save(data);
  sayLine('lu_show');
  update();
}

function lNext() {
  const s = data.active;
  if (!s || !lplay || lplay.status !== 'solved' || lplay.leaving) return;
  lplay.leaving = true;
  stopSpeaking();
  s.index++;
  save(data);
  if (s.prizeWon) { go('prize'); sayLine('prize'); return; }
  if (s.levelUp) { go('levelup'); sayLine('levelup'); return; }
  lContinue();
}

function lContinue() {
  const s = data.active;
  if (!s) { go('welcome'); return; }
  if (s.quizNext) { endForQuiz(); return; }
  if (s.mode === 'lquiz' && s.index >= s.length) { finishLittleQuiz(); return; }
  if (s.index >= s.length) { lplay = null; finishSession(); return; }
  lNew();
  go('lplay');
  lSay();
}

function finishLittleQuiz() {
  const s = data.active;
  if (!s || s.finished) return;
  s.finished = true;
  const q = s.quiz;
  const lp = data.progress.lpath;
  const n = q.items.length;
  const k = q.items.filter((x) => x.ok).length;
  const passed = n > 0 && k >= Math.ceil((QUIZ.pass / QUIZ.size) * n);
  const date = new Date().toISOString();
  data.quizzes = [{ date, level: q.level, n, k, passed, counted: q.counts, little: true, items: q.items }, ...(data.quizzes || [])].slice(0, 30);
  data.sessions = [{ date, mode: 'lquiz', done: n, own: k, team: n - k }, ...data.sessions].slice(0, 30);
  let wentUp = false, champion = false, bonus = 0;
  const itsLevel = q.counts && lp.level === q.level;
  if (passed) {
    bonus = QUIZ.bonus;
    data.rewards.pieces += bonus;
    if (itsLevel) { const r = passLevel(lp, LITTLE_LEVELS); wentUp = !!r.leveledUp; champion = !!r.champion; }
  } else if (itsLevel) failQuiz(lp);
  checkPrizes();
  quizResult = { k, n, passed, bonus, wentUp, levelUp: wentUp, champion, counted: itsLevel, prize: !!s.prizeWon, level: lp.level, wait: lp.quizWait || 0, items: q.items };
  data.active = null;
  lplay = null;
  play = null;
  save(data);
  sfx.reward();
  go('quizDone');
  sayLine(passed ? 'quiz_pass' : 'quiz_more');
}

function viewLittlePlay() {
  const s = data.active;
  if (!s || !s.current) return viewWelcome();
  const c = s.current, p = c.p;
  if (!lplay) lInit();
  const solved = lplay.status === 'solved';
  const dots = Array.from({ length: s.length }, (_, i) => {
    const done = i < s.index || (i === s.index && solved && !lplay.show);
    return h('span', { class: `rm-dot ${done ? 'done' : ''} ${i === s.index ? 'now' : ''}`, html: done ? icon('star') : '' });
  });
  const n = data.rewards.pieces;
  const quiz = s.mode === 'lquiz';
  return h('main', { class: `rm-screen lu-play ${quiz ? 'quiz' : ''}` },
    h('header', { class: 'rm-top' },
      button(null, goHome, { cls: 'icon soft', ic: 'home', aria: T('home'), k: 'home' }),
      h('div', { class: 'rm-dots', role: 'img', 'aria-label': T('problemOf', { i: Math.min(s.index + 1, s.length), n: s.length }) }, dots),
      h('div', { class: `rm-pieces ${lplay.bump ? 'bump' : ''}`, role: 'img', 'aria-label': T('pieces', { n }) }, h('span', { html: pieceSVG(n) }), h('b', null, String(n))),
      prizeMini(),
      quiz ? h('div', { class: 'rm-level-chip quiz' }, h('span', { 'aria-hidden': 'true' }, '\u{1F3C6}'), h('b', null, T('quizChip'))) : levelChip(),
      soundButton()),
    h('div', { class: 'lu-ask' },
      h('div', { class: `lu-friend ${solved && !lplay.show ? 'cheer' : ''}`, html: friendSVG((player && player.friend) || 'fox') }),
      h('button', { type: 'button', class: 'lu-say', 'data-k': 'l-say', 'aria-label': T('l_listen'), onclick: () => { unlockAudio(); lSay(); } },
        h('span', { class: 'lu-say-ic', html: icon('read') }),
        h('b', null, lQuestion(p)))),
    littleScene(p, solved),
    p.skill === 'more' ? null : h('div', { class: 'lu-choices' }, p.choices.map((v) => h('button', {
      type: 'button',
      class: `lu-choice ${lplay.wrong.includes(v) ? 'wrong' : ''} ${solved && v === p.answer ? 'right' : ''} ${solved && v !== p.answer ? 'dim' : ''}`,
      'data-k': `l-ch-${v}`,
      disabled: solved || lplay.wrong.includes(v),
      onclick: () => lAnswer(v),
    }, String(v)))),
    solved ? h('div', { class: 'lu-next-row' }, button(s.index + 1 >= s.length ? T('finish') : T('next'), lNext, { cls: 'primary big lu-next', ic: 'next', k: 'l-next' })) : null);
}

function littleScene(p, solved) {
  const em = OBJ_EMOJI[p.obj] || '⭐';
  const help = lplay.help && !solved ? 'help' : '';
  const badge = (id) => (lplay.marks[id] != null ? h('span', { class: 'lu-n' }, String(lplay.marks[id])) : null);
  const obj = (id, gone = false, i = 0) => h('button', {
    type: 'button', class: `lu-obj ${gone ? 'gone' : ''} ${lplay.marks[id] != null ? 'counted' : ''}`, 'data-k': `l-obj-${id}`, 'aria-label': em,
    disabled: gone || solved, style: `--d:${i * 40}ms`, onclick: () => lTapObj(id),
  }, h('span', { class: 'lu-em' }, em), badge(id));
  const rows = (items) => {
    const out = [];
    for (let i = 0; i < items.length; i += 5) out.push(h('div', { class: 'lu-row' }, items.slice(i, i + 5)));
    return h('div', { class: 'lu-rows' }, out);
  };
  const range = (n, from = 0) => Array.from({ length: n }, (_, i) => from + i);
  // a number as tens bars and ones dots; `goneT` / `goneO` of them are taken away (crossed out)
  const tensOnes = (g, n, goneT = 0, goneO = 0) => {
    const t = Math.floor(n / 10), o = n % 10;
    const bars = range(t).map((i) => {
      const id = `${g}B${i}`, gone = i >= t - goneT;
      return h('button', { type: 'button', class: `lu-bar ${gone ? 'gone' : ''} ${lplay.marks[id] != null ? 'counted' : ''}`, 'data-k': `l-obj-${id}`, 'aria-label': '10', disabled: gone || solved, onclick: () => lTapObj(id, 10) },
        range(10).map(() => h('span', { class: 'lu-bar-dot' })), badge(id));
    });
    const dots = range(o).map((i) => {
      const id = `${g}D${i}`, gone = i >= o - goneO;
      return h('button', { type: 'button', class: `lu-dot ${gone ? 'gone' : ''} ${lplay.marks[id] != null ? 'counted' : ''}`, 'data-k': `l-obj-${id}`, 'aria-label': '1', disabled: gone || solved, onclick: () => lTapObj(id, 1) }, badge(id));
    });
    const dotCols = [];
    for (let i = 0; i < dots.length; i += 5) dotCols.push(h('div', { class: 'lu-dotcol' }, dots.slice(i, i + 5)));
    return h('div', { class: 'lu-tensones' }, h('div', { class: 'lu-bars' }, bars), dotCols.length ? h('div', { class: 'lu-dots' }, dotCols) : null);
  };
  const eq = () => h('p', { class: 'lu-eq' }, `${p.a} ${p.op === '+' ? '+' : '−'} ${p.b} = ${solved ? p.answer : '?'}`);

  if (p.view === 'pics' && p.op === '+') {
    return h('div', { class: `lu-scene add ${help}` },
      h('div', { class: 'lu-groups' },
        h('div', { class: 'lu-group a' }, rows(range(p.a).map((i) => obj(i, false, i)))),
        h('span', { class: 'lu-op', 'aria-hidden': 'true' }, '+'),
        h('div', { class: 'lu-group b' }, rows(range(p.b, p.a).map((i) => obj(i, false, i))))),
      eq());
  }
  if (p.view === 'pics' && p.op === '-') {
    return h('div', { class: `lu-scene sub ${help}` }, rows(range(p.a).map((i) => obj(i, i >= p.a - p.b, i))), eq());
  }
  if (p.view === 'bars' && p.op === '+') {
    return h('div', { class: `lu-scene bars ${help}` },
      h('div', { class: 'lu-groups' },
        h('div', { class: 'lu-group a' }, tensOnes('a', p.a)),
        h('span', { class: 'lu-op', 'aria-hidden': 'true' }, '+'),
        h('div', { class: 'lu-group b' }, tensOnes('b', p.b))),
      eq());
  }
  if (p.view === 'bars' && p.op === '-') {
    return h('div', { class: `lu-scene bars sub ${help}` }, tensOnes('a', p.a, Math.floor(p.b / 10), p.b % 10), eq());
  }
  if (p.view === 'bars') {
    return h('div', { class: `lu-scene bars ${help}` }, tensOnes('a', p.answer), help ? h('p', { class: 'lu-tip' }, T('l_tapCount')) : null);
  }
  if (p.view === 'frame') {
    // 7 are in the ten-frame; tap the empty spots to count how many more make 10
    const cells = range(10).map((i) => (i < p.a
      ? h('span', { class: 'lu-cell full' }, h('span', { class: 'lu-em' }, em))
      : h('button', { type: 'button', class: `lu-cell empty ${lplay.marks[`e${i}`] != null ? 'counted' : ''}`, 'data-k': `l-obj-e${i}`, disabled: solved, onclick: () => lTapObj(`e${i}`) },
        solved ? h('span', { class: 'lu-em' }, em) : null, badge(`e${i}`))));
    return h('div', { class: `lu-scene frame ${help}` }, h('div', { class: 'lu-frame' }, cells), h('p', { class: 'lu-eq' }, `${p.a} + ${solved ? p.answer : '?'} = 10`));
  }
  if (p.skill === 'count') {
    return h('div', { class: `lu-scene ${help}` }, rows(range(p.n).map((i) => obj(i, false, i))),
      help ? h('p', { class: 'lu-tip' }, T('l_tapCount')) : null);
  }
  if (p.skill === 'more') {
    const side = (key, count) => h('button', {
      type: 'button',
      class: `lu-side ${lplay.wrong.includes(key) ? 'wrong' : ''} ${solved && p.answer === key ? 'right' : ''} ${solved && p.answer !== key ? 'dim' : ''}`,
      'data-k': `l-side-${key}`, 'aria-label': `${T('l_side')}: ${count}`,
      disabled: solved || lplay.wrong.includes(key), onclick: () => lAnswer(key),
    }, h('span', { class: 'lu-side-objs' }, Array.from({ length: count }, () => h('span', { class: 'lu-em' }, em))),
    solved ? h('b', { class: 'lu-side-n' }, String(count)) : null);
    return h('div', { class: 'lu-scene more' }, side('L', p.left), side('R', p.right));
  }
  if (p.skill === 'skip' || p.skill === 'skipTo') {
    return h('div', { class: 'lu-scene track skip' },
      p.seq.map((v) => h('span', { class: 'lu-card' }, String(v))),
      h('span', { class: `lu-card q ${solved ? 'got' : ''}` }, solved ? String(p.answer) : '?'));
  }
  if (p.skill === 'after' || p.skill === 'before') {
    const known = h('span', { class: 'lu-card' }, String(p.n));
    const q = h('span', { class: `lu-card q ${solved ? 'got' : ''}` }, solved ? String(p.answer) : '?');
    return h('div', { class: 'lu-scene track' }, p.skill === 'after' ? [known, q] : [q, known]);
  }
  if (p.skill === 'compare') {
    return h('div', { class: 'lu-scene compare' },
      h('div', { class: 'lu-groups' },
        h('div', { class: 'lu-group a' }, tensOnes('x', p.x)),
        h('span', { class: 'lu-op', 'aria-hidden': 'true' }, '?'),
        h('div', { class: 'lu-group b' }, tensOnes('y', p.y))));
  }
  // find: just listen, then tap the number
  return h('div', { class: 'lu-scene find' },
    h('button', { type: 'button', class: 'lu-big-say', 'data-k': 'l-say-big', 'aria-label': T('l_listen'), onclick: () => { unlockAudio(); lSay(); } }, h('span', { html: icon('read') })));
}

function viewParentLittle() {
  const st = data.settings;
  const ls = data.progress.lstats || {};
  const lp = data.progress.lpath;
  const quizzes = data.quizzes || [];
  const rows = LITTLE_SKILLS.filter((k) => ls[k] && ls[k].tries > 0).map((k) => h('tr', null,
    h('th', { scope: 'row' }, T(`l_skill_${k}`)),
    h('td', null, String(ls[k].tries)),
    h('td', null, `${Math.round((ls[k].first / ls[k].tries) * 100)}%`)));
  const itemText = (it) => `${it.ok ? '✔' : '✖'} ${T(`l_skill_${it.skill}`)}: ${(it.tries || []).length ? `${it.tries.join(', ')} → ` : ''}${it.answer === 'L' ? '⬅' : it.answer === 'R' ? '➡' : it.answer}`;
  return h('main', { class: 'rm-screen rm-parent' },
    h('div', { class: 'rm-row-top' },
      h('h2', { class: 'rm-h2' }, `${T('p_title')} · ${player.name}`),
      button(T('p_close'), () => go(parentReturn === 'parent' ? 'welcome' : parentReturn), { cls: 'soft small', ic: 'close', k: 'p-close' })),
    parentMsg ? h('p', { class: 'rm-small ok', role: 'status' }, parentMsg) : null,
    cloudCard(),
    h('section', { class: 'rm-card rm-p-sec' },
      h('h3', { class: 'rm-h3' }, T('p_lskills')),
      h('p', { class: 'rm-small' }, T('p_littleNote')),
      rows.length ? h('div', { class: 'rm-table-wrap' }, h('table', { class: 'rm-table' },
        h('thead', null, h('tr', null, [T('p_skill'), T('p_lcolAll'), T('p_lcolRight')].map((x) => h('th', { scope: 'col' }, x)))),
        h('tbody', null, rows))) : h('p', { class: 'rm-small' }, T('p_noSessions')),
      h('h3', { class: 'rm-h3' }, T('p_quizzes')),
      quizzes.length
        ? h('ul', { class: 'rm-sessions rm-quizlist' }, quizzes.slice(0, 8).map((q) => h('li', null,
          h('b', null, T('p_quizRow', { date: fmtDay(q.date), l: q.level, k: q.k, n: q.n, res: !q.counted ? `${T('p_checkOnly')}${q.passed ? ' ✔' : ''}` : q.passed ? T('p_passed') : T('p_notYet') })),
          h('ul', null, (q.items || []).map((it) => h('li', { class: 'rm-small' }, itemText(it)))))))
        : h('p', { class: 'rm-small' }, T('p_noQuizzes')),
      button(T('p_quizNow'), () => go('quizIntro'), { cls: 'primary small', ic: 'star', k: 'p-quiz' })),
    prizesSection(),
    h('section', { class: 'rm-card rm-p-sec' },
      levelPicker(T('p_path'), lp.level, LITTLE_LEVELS.length, (v) => { Object.assign(lp, { level: v, stars: 0, best: Math.max(lp.best || 1, v), quizDue: false, quizWait: 0, champion: false }); }, (n) => T(`lworld${littleWorldOf(n)}`)),
      seg(T('p_lang'), st.lang, [['en', 'English'], ['es', 'Español']], (v) => { st.lang = v; }),
      seg(T('p_sound'), st.sound, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.sound = v; setSound(v); }),
      seg(T('p_motion'), st.motion, [['auto', T('p_motionAuto')], ['reduce', T('p_motionReduce')]], (v) => { st.motion = v; }),
      voiceCheck()),
    h('section', { class: 'rm-card rm-p-sec' },
      h('p', { class: 'rm-small' }, T(sync.on() ? 'p_saveNoteCloud' : 'p_saveNote')),
      button(T('p_changePin'), changeParentPin, { cls: 'small soft', ic: 'lock', k: 'p-change-pin' }),
      parentConfirm
        ? h('div', { class: 'rm-confirm', role: 'alertdialog', 'aria-label': T('p_reset') },
          h('p', { class: 'rm-text' }, T('p_resetSure')),
          h('div', { class: 'rm-actions' },
            button(T('p_resetYes'), resetProgress, { cls: 'danger', k: 'reset-yes' }),
            button(T('p_resetNo'), () => { parentConfirm = false; update(); }, { cls: 'soft', k: 'reset-no' })))
        : button(T('p_reset'), () => { parentConfirm = true; update(); }, { cls: 'soft', ic: 'reset', k: 'reset' })));
}

// ---------------------------------------------------------------- quizzes
// The practice adventure pauses here: a full row of stars means it's quiz time.
function endForQuiz() {
  const s = data.active;
  if (s && s.results.length) {
    const own = s.results.filter((r) => r.independent).length;
    data.sessions = [{ date: new Date().toISOString(), mode: s.mode, done: s.results.length, own, team: s.results.length - own }, ...data.sessions].slice(0, 30);
  }
  data.active = null;
  play = null;
  save(data);
  go('quizIntro');
  sayLine('quiz_intro');
}

function viewQuizIntro() {
  const ctx = P();
  const n = ctx.path.level;
  const text = isLittle() ? T('lquizText', { k: QUIZ.size }) : T('quizText', { n, k: QUIZ.size });
  return h('main', { class: 'rm-screen rm-celebrate rm-quizintro' },
    h('div', { class: 'rm-quiz-trophy', 'aria-hidden': 'true' }, '\u{1F3C6}'),
    h('h2', { class: 'rm-h2' }, T('quizTitle')),
    h('p', { class: 'rm-big-text' }, T('pathLevel', { n, name: ctx.name(n) })),
    h('p', { class: 'rm-text' }, text),
    prizeStrip(true),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud(`${T('quizTitle')} ${text}`), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('quizGo'), () => { unlockAudio(); stopSpeaking(); data.active = null; play = null; if (isLittle()) startLittle(true); else startSession('quiz'); }, { cls: 'primary big', ic: 'next', k: 'quiz-go' }),
      button(T('quizLater'), () => go('welcome'), { cls: 'big', k: 'quiz-later' })));
}

let quizResult = null;
function finishQuiz() {
  const s = data.active;
  if (!s || s.finished) return;
  s.finished = true;
  const q = s.quiz;
  const path = data.progress.path;
  const n = q.items.length;
  const k = q.items.filter((x) => x.ok && !x.helped).length;
  const passed = n > 0 && k >= Math.ceil((QUIZ.pass / QUIZ.size) * n);
  const date = new Date().toISOString();
  data.quizzes = [{ date, level: q.level, n, k, passed, counted: q.counts, items: q.items }, ...(data.quizzes || [])].slice(0, 30);
  data.sessions = [{ date, mode: 'quiz', done: n, own: k, team: n - k }, ...data.sessions].slice(0, 30);
  let wentUp = false, champion = false, bonus = 0;
  const itsLevel = q.counts && path.level === q.level;
  if (passed) {
    bonus = QUIZ.bonus;
    data.rewards.pieces += bonus;
    // the guide steps back only for skills she got right on her own every time in this quiz
    const shaky = new Set(q.items.filter((it) => !it.ok || it.helped).map((it) => it.skill));
    for (const it of q.items) if (!shaky.has(it.skill)) passedFade(data, it.skill);
    if (itsLevel) { const r = passLevel(path); wentUp = !!r.leveledUp; champion = !!r.champion; }
  } else if (itsLevel) failQuiz(path);
  checkPrizes();
  quizResult = { k, n, passed, bonus, wentUp, levelUp: wentUp, champion, counted: itsLevel, prize: !!s.prizeWon, level: path.level, wait: path.quizWait || 0, items: q.items };
  data.active = null;
  play = null;
  save(data);
  sfx.reward();
  go('quizDone');
  sayLine(passed ? 'quiz_pass' : 'quiz_more');
}

function quizDoneNext() {
  const r = quizResult;
  if (r && r.prize) { r.prize = false; go('prize'); sayLine('prize'); return; }
  if (r && r.levelUp) { r.levelUp = false; go('levelup'); sayLine('levelup'); return; }
  quizResult = null;
  go('welcome');
}

function viewQuizDone() {
  const r = quizResult || { k: 0, n: 0, passed: false, bonus: 0, items: [] };
  const conf = r.passed && !reduced() ? h('div', { class: 'rm-confetti', 'aria-hidden': 'true' },
    Array.from({ length: 30 }, (_, i) => h('span', { style: `--i:${i};--x:${(i * 37) % 100}` }))) : null;
  const title = r.passed ? T('quizPassTitle') : T('quizDoneTitle');
  const text = r.passed
    ? (r.champion ? T('quizChampText', { b: r.bonus }) : r.wentUp ? T('quizPassText', { n: r.level, b: r.bonus }) : T('quizCheckText', { b: r.bonus }))
    : (r.counted ? T('quizMoreText', { w: r.wait }) : T('quizMoreCheck'));
  return h('main', { class: 'rm-screen rm-celebrate rm-quizdone' },
    conf,
    h('div', { class: 'rm-lumi big', html: lumiSVG(r.passed ? 'cheer' : 'happy') }),
    h('h2', { class: 'rm-h2' }, title),
    h('div', { class: 'rm-quiz-score', role: 'img', 'aria-label': T('quizScore', { k: r.k, n: r.n }) },
      r.items.map((it) => h('span', { class: it.ok && !it.helped ? 'on' : '', html: icon('star') }))),
    h('p', { class: 'rm-big-text' }, T('quizScore', { k: r.k, n: r.n })),
    h('p', { class: 'rm-text' }, text),
    prizeStrip(true),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud(`${title} ${T('quizScore', { k: r.k, n: r.n })}. ${text}`), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('quizNextBtn'), quizDoneNext, { cls: 'primary big', ic: 'next', k: 'quiz-next' })));
}

function finishSession() {
  const s = data.active;
  if (!s || s.finished) return;
  s.finished = true;
  const own = s.results.filter((r) => r.independent).length;
  const team = s.results.length - own;
  let friend = null;
  const next = CREATURE_ORDER.find((f) => !data.rewards.friends.includes(f));
  if (next) { data.rewards.friends = [...data.rewards.friends, next]; friend = next; } else data.rewards.star = true;
  data.sessions = [{ date: new Date().toISOString(), mode: s.mode, done: s.results.length, own, team }, ...data.sessions].slice(0, 30);
  celebrate = { own, team, friend, earned: s.results.length, mode: s.mode };
  data.active = null;
  play = null;
  save(data);
  sfx.reward();
  go('celebrate');
}

// ---------------------------------------------------------------- blocks
function act(fn, opts = {}) {
  const m = play.model;
  const before = new Map(m.pieces.map((x) => [x.id, x.state]));
  const tr = m.trades;
  // where a trade starts, so we can show the pieces travelling
  const srcEl = m.op === '+' ? root.querySelector('.rm-frame.full') : [...root.querySelectorAll('.rm-col.tens .rm-rod:not(.gone)')].pop();
  const src = srcEl ? { rect: srcEl.getBoundingClientRect(), html: srcEl.outerHTML } : null;
  if (!fn(m)) return false;
  play.fresh = new Map();
  const newIds = [];
  for (const x of m.pieces) {
    const was = before.get(x.id);
    if (was !== x.state) play.fresh.set(x.id, x.state === 'gone' ? 'gone' : 'in');
    if (was === undefined) newIds.push(x);
  }
  play.movedBlocks = true;
  const traded = m.trades > tr;
  if (traded) { play.tradedEver = true; play.carryFresh = true; sfx.trade(); } else sfx.pop();
  data.active.current.blocksUsed = true;
  let advanced = false;
  if (play.status === 'guided' && !opts.noAdvance) {
    const st = curStep();
    if (st && (st.kind === 'carry' || st.kind === 'borrow') && m.trades > play.guided.startTrades) {
      advanceStep();
      advanced = true;
    }
  }
  if (!advanced) update();
  play.carryFresh = false;
  if (traded && src) {
    const targets = newIds.map((x) => root.querySelector(`[data-k="pc-${x.id}"]`)).filter(Boolean);
    const dest = m.op === '+' ? targets[0] : root.querySelector('.rm-col.ones .rm-col-b');
    flyPieces(src, dest, targets);
  }
  return true;
}

// The ten (or the ten ones) visibly travel to the other column.
function flyPieces(src, dest, hide) {
  if (!dest || reduced() || typeof Element.prototype.animate !== 'function') return;
  const t = dest.getBoundingClientRect();
  const r = src.rect;
  if (!r.width || !t.width) return;
  const g = h('div', { class: 'rm-flyer', html: src.html, 'aria-hidden': 'true' });
  Object.assign(g.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  root.append(g);
  hide.forEach((el) => { el.style.visibility = 'hidden'; });
  const dx = t.left + t.width / 2 - (r.left + r.width / 2);
  const dy = t.top + t.height / 2 - (r.top + r.height / 2);
  const sx = Math.max(0.15, Math.min(4, t.width / r.width));
  const sy = Math.max(0.15, Math.min(4, t.height / r.height));
  const anim = g.animate([
    { transform: 'translate(0px, 0px) scale(1, 1)' },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 50}px) scale(${(1 + sx) / 2}, ${(1 + sy) / 2})`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
  ], { duration: 1000, easing: 'ease-in-out' });
  const done = () => { g.remove(); hide.forEach((el) => { el.style.visibility = ''; }); };
  anim.onfinish = done;
  anim.oncancel = done;
}

// ---------------------------------------------------------------- finger drawing
function toggleDraw() {
  play.drawing = !play.drawing;
  sfx.tap();
  update();
}
function undoStroke() { play.strokes.pop(); update(); }
function eraseInk() { play.strokes = []; update(); }

function drawStroke(ctx, st) {
  const pts = st.pts;
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], pts[0][2] / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    ctx.lineWidth = pts[i][2];
    ctx.beginPath();
    ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
    ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
}

function setupInk() {
  const cv = root.querySelector('.rm-ink');
  if (!cv || !play) return;
  const r = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
  cv.style.width = `${r.width}px`;
  cv.style.height = `${r.height}px`;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3d2f8f';
  ctx.fillStyle = '#3d2f8f';
  play.strokes.forEach((st) => drawStroke(ctx, st));
  if (cv.dataset.bound) return;
  cv.dataset.bound = '1';
  let cur = null, pid = null;
  const width = (e) => (e.pointerType === 'pen' ? 2 + (e.pressure || 0.5) * 4 : 5);
  const at = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top, width(e)]; };
  cv.addEventListener('pointerdown', (e) => {
    if (!play || !play.drawing || cur) return;
    e.preventDefault();
    pid = e.pointerId;
    try { cv.setPointerCapture(pid); } catch (err) { /* ignore */ }
    cur = { pts: [at(e)] };
    play.strokes.push(cur);
    drawStroke(ctx, cur);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!cur || e.pointerId !== pid) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      cur.pts.push(at(ev));
      drawStroke(ctx, { pts: cur.pts.slice(-2) });
    }
  });
  const end = (e) => {
    if (!cur || e.pointerId !== pid) return;
    cur = null;
    pid = null;
    update(); // turns on Undo / Erase
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
}
window.addEventListener('resize', () => { if (screen === 'play' && play) { setupInk(); positionCoach(); } });

function guidedWait() {
  toast(T('g_wait'));
  sfx.soft();
}

// what is allowed right now: returns the step act name in guided mode, or 'explore'
function blockMode() {
  if (play.status !== 'guided') return 'explore';
  const st = curStep();
  return st && st.kind === 'carry' ? 'tradeUp' : st && st.kind === 'borrow' ? 'tradeDown' : 'none';
}

// Adding: every tap brings ONE waiting block onto the mat (ones first), so Mila
// adds them herself and the board never does the adding for her.
function onTray(x) {
  const m = play.model;
  if (play.status === 'guided') {
    const st = curStep();
    if (st && ADD_SYNC.includes(st.sync) && !play.guided.synced) { addOneForStep(st, x); return; }
    guidedWait();
    return;
  }
  const kind = x ? x.kind : M.canBringOnes(m) ? 'one' : 'ten';
  act((mm) => M.bringOne(mm, kind, x ? x.id : null));
}

const ADD_SYNC = ['bringOnes', 'bringTens'];
function addProgress(st) {
  const m = play.model;
  const total = st.sync === 'bringTens' ? tensOf(m.b) : onesOf(m.b);
  const c = M.counts(m);
  const left = st.sync === 'bringTens' ? c.tensTray : c.onesTray;
  return { total, done: total - left, left };
}
function addOneForStep(st, x) {
  const want = st.sync === 'bringTens' ? 'ten' : 'one';
  if (x && x.kind !== want) { toast(T(want === 'one' ? 'addOnesFirst' : 'addTensNow')); sfx.soft(); return; }
  play.counting = false;
  act((mm) => M.bringOne(mm, want, x ? x.id : null), { noAdvance: true });
  if (addProgress(st).left === 0) {
    play.guided.synced = true;
    play.counting = true; // now count them together
    play.countedEver = true;
    sfx.reward();
    toast(T('addedAllCount'));
    update();
  }
}

// During help, tapping the blocks does this step's move (bring in the ones, take away...)
// and numbers the pieces so she can count them.
// Help steps that take blocks away: Mila taps each block herself (one tap = one block).
const REMOVE_SYNC = ['takeOnes', 'takeFromTen', 'takeTens'];
function removeProgress(st) {
  const m = play.model;
  const total = st.sync === 'takeTens' ? tensOf(m.b) : onesOf(m.b);
  const left = st.sync === 'takeTens' ? M.takeLeft(m).tens : M.takeLeft(m).ones;
  return { total, done: total - left, left };
}
function takeOneForStep(st, x) {
  const m = play.model;
  if (st.sync === 'takeTens' && x.kind !== 'ten') { toast(T('tapTens')); sfx.soft(); return; }
  if (st.sync !== 'takeTens' && x.kind !== 'one') { toast(T('tapOnes')); sfx.soft(); return; }
  if (st.sync === 'takeFromTen' && x.src !== 'trade') { toast(T('tapYellow')); sfx.soft(); return; }
  if (!M.canTake(m, x.kind)) { toast(T('takenAll')); return; }
  play.counting = false;
  act((mm) => M.takeOne(mm, x.kind, x.id), { noAdvance: true });
  if (removeProgress(st).left === 0) {
    play.guided.synced = true;
    play.counting = true; // now count what's left
    play.countedEver = true;
    sfx.reward();
    toast(T('takenAllCount'));
    update();
  }
}

function helpBlocksMove(allowed) {
  if (!play || play.status !== 'guided') return false;
  const st = curStep();
  if (!st || !st.sync || !allowed.includes(st.sync) || play.guided.synced) return false;
  syncStep(st);
  play.counting = true;
  play.countedEver = true;
  update();
  return true;
}

function onPiece(x) {
  const m = play.model;
  const mode = blockMode();
  if (play.status === 'guided' && x.state === 'in') {
    const st = curStep();
    if (st && REMOVE_SYNC.includes(st.sync) && !play.guided.synced) { takeOneForStep(st, x); return; }
  }
  if (m.op === '+') {
    if (x.kind === 'one' && x.state === 'in' && M.canTradeUp(m) && (mode === 'explore' || mode === 'tradeUp')) { act(M.tradeUp); return; }
    sfx.tap();
    return;
  }
  if (x.state !== 'in') return;
  if (x.kind === 'one') {
    if (mode === 'explore' || mode === 'takeOnes') {
      if (!M.canTake(m, 'one')) { toast(T('alreadyTaken', { what: L() === 'es' ? 'unidades' : 'ones' })); return; }
      act((mm) => M.takeOne(mm, 'one', x.id));
    } else guidedWait();
  } else {
    if (mode === 'tradeDown') { act(M.tradeDown); return; }
    if (mode === 'explore' || mode === 'takeTens') {
      if (M.canTake(m, 'ten')) { act((mm) => M.takeOne(mm, 'ten', x.id)); return; }
      if (mode === 'explore' && M.canTradeDown(m)) { toast(T('needTrade')); return; }
      toast(T('alreadyTaken', { what: L() === 'es' ? 'decenas' : 'tens' }));
    } else guidedWait();
  }
}

function onDrop(kind, target) {
  const m = play.model;
  const mode = blockMode();
  if (kind === 'tray') { onTray(); return; }
  if (kind === 'ten' && target === 'ones') {
    if ((mode === 'explore' && M.canTradeDown(m)) || mode === 'tradeDown') act(M.tradeDown);
    else if (mode === 'explore') toast(T('dragTip'));
    else guidedWait();
  } else if (kind === 'frame' && target === 'tens') {
    if ((mode === 'explore' && M.canTradeUp(m)) || mode === 'tradeUp') act(M.tradeUp);
    else if (mode !== 'explore') guidedWait();
  }
}

// Drag with pointer events. A short press without moving stays a tap.
let suppressClickUntil = 0;
function enableDrag(el, kind) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    let ghost = null;
    const pid = e.pointerId;
    try { el.setPointerCapture(pid); } catch (err) { /* ignore */ }
    const move = (ev) => {
      if (ev.pointerId !== pid) return;
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!ghost && Math.hypot(dx, dy) > 10) {
        const r = el.getBoundingClientRect();
        ghost = el.cloneNode(true);
        ghost.classList.add('rm-ghost');
        ghost.style.width = `${r.width}px`;
        ghost.style.height = `${r.height}px`;
        ghost.style.left = `${r.left}px`;
        ghost.style.top = `${r.top}px`;
        root.append(ghost);
        el.classList.add('dragging');
      }
      if (ghost) {
        ev.preventDefault();
        ghost.style.transform = `translate(${dx}px, ${dy}px)`;
        root.querySelectorAll('[data-drop]').forEach((d) => d.classList.remove('over'));
        const under = dropUnder(ev.clientX, ev.clientY, ghost);
        if (under) under.classList.add('over');
      }
    };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (ghost) {
        const under = dropUnder(ev.clientX, ev.clientY, ghost);
        ghost.remove();
        el.classList.remove('dragging');
        root.querySelectorAll('[data-drop]').forEach((d) => d.classList.remove('over'));
        suppressClickUntil = Date.now() + 400;
        if (under && ev.type === 'pointerup') onDrop(kind, under.getAttribute('data-drop'));
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}
function dropUnder(x, y, ghost) {
  ghost.style.visibility = 'hidden';
  const elAt = document.elementFromPoint(x, y);
  ghost.style.visibility = '';
  return elAt ? elAt.closest('[data-drop]') : null;
}
const tapGuard = (fn) => (e) => { if (Date.now() < suppressClickUntil) { e.preventDefault(); return; } unlockAudio(); fn(e); };

function pieceEl(x, n) {
  const isOne = x.kind === 'one';
  const fresh = play.fresh.get(x.id);
  const name = isOne ? W().ones(1) : W().tens(1);
  const el = h('button', {
    type: 'button',
    class: `rm-pc ${isOne ? 'rm-one' : 'rm-rod'} src-${x.src} ${x.state === 'gone' ? 'gone' : ''} ${fresh ? `fresh-${fresh}` : ''}`,
    'aria-label': name,
    disabled: x.state === 'gone',
    'data-k': `pc-${x.id}`,
    onclick: tapGuard(() => onPiece(x)),
  }, play.counting && n != null ? h('span', { class: 'rm-pc-n', style: `--i:${n}` }, String(isOne ? n : n * 10)) : null);
  if (!isOne && play.model.op === '-' && x.state === 'in') enableDrag(el, 'ten');
  return el;
}

function matPanel() {
  const m = play.model, p = play.p;
  const c = M.counts(m);
  const guided = play.status === 'guided';
  const fc = play.focusCol;

  // tens column
  let tn = 0;
  const tens = m.pieces.filter((x) => x.kind === 'ten' && x.state !== 'tray').map((x) => pieceEl(x, x.state === 'in' ? ++tn : null));
  // ones column in frames of ten
  const ones = m.pieces.filter((x) => x.kind === 'one' && x.state !== 'tray');
  let on = 0;
  const frames = [];
  const splitTen = m.op === '-' && m.trades > 0;
  let chunks = [];
  if (splitTen) {
    // 17 = the yellow 10 + 7: the borrowed ten stays together in its own row
    const tr = ones.filter((x) => x.src === 'trade');
    const rest = ones.filter((x) => x.src !== 'trade');
    chunks = [tr];
    for (let i = 0; i < Math.max(1, rest.length); i += 10) chunks.push(rest.slice(i, i + 10));
  } else {
    for (let i = 0; i < Math.max(1, ones.length); i += 10) chunks.push(ones.slice(i, i + 10));
  }
  chunks.forEach((chunk, f) => {
    const full = chunk.length === 10 && chunk.every((x) => x.state === 'in');
    const slots = chunk.map((x) => pieceEl(x, x.state === 'in' ? ++on : null));
    for (let i = chunk.length; i < 10; i++) slots.push(h('span', { class: 'rm-slot', 'aria-hidden': 'true' }));
    const fr = h('div', { class: `rm-frame ${full && m.op === '+' ? 'full' : ''} ${splitTen && f === 0 ? 'ten' : ''}` }, slots);
    if (full && m.op === '+' && f === 0) enableDrag(fr, 'frame');
    if (splitTen) {
      const left = chunk.filter((x) => x.state === 'in').length;
      const cap = c.onesGone === 0 || play.status === 'solved' ? h('span', { class: `rm-frame-cap ${f === 0 ? 'ten' : ''}` }, String(left)) : null;
      frames.push(h('div', { class: 'rm-frame-wrap' }, fr, cap));
      if (f === 0) frames.push(h('span', { class: 'rm-frame-plus', 'aria-hidden': 'true' }, '+'));
    } else {
      frames.push(fr);
    }
  });

  const tW = W().tens(c.tensIn), oW = W().ones(c.onesIn);
  const trayFull = c.tensTray + c.onesTray === tensOf(p.b) + onesOf(p.b) && m.op === '+';
  const nothingTaken = c.tensGone + c.onesGone === 0;
  const solved = play.status === 'solved';
  const untouched = m.op === '-' ? nothingTaken : trayFull && m.trades === 0;
  let line = solved || untouched ? T('matIsN', { t: tW, o: oW, n: M.value(m) }) : null;
  if (m.op === '-' && m.trades > 0 && nothingTaken && !solved) line += ` ${T('stillN', { n: p.a })}`;
  const showN = solved || untouched;

  let hint = null;
  if (guided) {
    const gst = curStep();
    if (gst && REMOVE_SYNC.includes(gst.sync)) {
      const rp = removeProgress(gst);
      hint = rp.left ? T('takenOf', { k: rp.done, n: rp.total }) : T('takenAllCount');
    } else if (gst && ADD_SYNC.includes(gst.sync) && !play.guided.synced) {
      const ap = addProgress(gst);
      hint = ap.left ? T(gst.sync === 'bringTens' ? 'addedTensOf' : 'addedOf', { k: ap.done, n: ap.total }) : null;
    }
  }
  if (!guided && play.status !== 'solved') {
    if (m.op === '+') {
      if (c.onesIn >= 10) hint = T('tooManyOnes');
      else if (c.tensTray + c.onesTray > 0) hint = T('tapToAdd');
      else if (m.trades > 0) hint = T('carriedHint');
    } else {
      const left = M.takeLeft(m);
      if (left.tens + left.ones === 0) hint = T('allTaken');
      else if (M.canTradeDown(m)) hint = T('needTrade');
      else if (nothingTaken) hint = T('tapToTake', { b: p.b });
      else hint = T('toTake', { t: W().tens(left.tens), o: W().ones(left.ones) });
    }
  }

  let tray = null;
  if (m.op === '+' && c.tensTray + c.onesTray > 0) {
    const tp = m.pieces.filter((x) => x.state === 'tray');
    const what = [c.tensTray ? W().tens(c.tensTray) : null, c.onesTray ? W().ones(c.onesTray) : null].filter(Boolean).join(' + ');
    tray = h('div', { class: 'rm-tray', 'data-k': 'tray', role: 'group', 'aria-label': T('trayLabel', { b: what }) },
      h('span', { class: 'rm-tray-sum' }, '+'),
      h('span', { class: 'rm-tray-p' }, tp.map((x) => h('button', {
        type: 'button',
        class: `rm-mini ${x.kind === 'one' ? 'one' : 'rod'} src-b`,
        'data-k': `tp-${x.id}`,
        'aria-label': x.kind === 'one' ? W().ones(1) : W().tens(1),
        onclick: tapGuard(() => onTray(x)),
      }))),
      h('span', { class: 'rm-tray-l' }, T('trayTip')));
  }

  const explore = [];
  explore.push(button(play.counting ? `${T('countOff')}` : `${T('countOn')}`, () => { play.counting = !play.counting; if (play.counting) play.countedEver = true; sfx.tap(); update(); }, { cls: `small count-btn ${play.counting ? 'on' : ''}`, ic: 'count', k: 'count', pressed: play.counting }));
  if (!guided && play.status !== 'solved') {
    explore.push(button(T('matStart'), () => { if (play.status === 'ask') restartColumns(); else play.model = M.makeModel(p); sfx.tap(); update(); }, { cls: 'small soft', ic: 'reset', k: 'mat-reset' }));
    if (m.op === '+') {
      explore.push(button(T('tradeUp'), () => act(M.tradeUp), { cls: `small ${M.canTradeUp(m) ? 'gold' : ''}`, k: 'x-tradeup', disabled: !M.canTradeUp(m) }));
    } else {
      explore.push(button(T('tradeDown'), () => act(M.tradeDown), { cls: `small ${M.canTradeDown(m) ? 'gold' : ''}`, k: 'x-tradedown', disabled: !M.canTradeDown(m) }));
    }
  }
  explore.push(...explore.splice(0, !guided && play.status !== 'solved' ? 2 : 1)); // block actions first, then count / start over

  return h('div', { class: 'rm-card rm-blocks' },
    h('div', { class: 'rm-mat' },
      h('div', { class: `rm-col tens ${fc === 'tens' ? 'focus' : ''}`, 'data-drop': 'tens' },
        h('div', { class: 'rm-col-h' }, h('span', null, T('tensCol')), showN ? h('b', { class: 'rm-col-n' }, String(c.tensIn)) : null),
        h('div', { class: 'rm-col-b' }, tens)),
      h('div', { class: `rm-col ones ${fc === 'ones' ? 'focus' : ''}`, 'data-drop': 'ones' },
        h('div', { class: 'rm-col-h' }, h('span', null, T('onesCol')), showN ? h('b', { class: 'rm-col-n' }, String(c.onesIn)) : null),
        h('div', { class: 'rm-col-b' }, frames))),
    tray,
    line ? h('p', { class: 'rm-mat-line', 'aria-live': 'polite' }, line) : null,
    hint ? h('p', { class: 'rm-mat-hint' }, hint) : null,
    explore.length ? h('div', { class: 'rm-mat-actions' }, explore) : null);
}

// ---------------------------------------------------------------- break & bye
function viewBreak() {
  return h('main', { class: 'rm-screen rm-break' },
    h('div', { class: 'rm-lumi big', html: lumiSVG('calm') }),
    h('h2', { class: 'rm-h2' }, T('breakTitle')),
    h('div', { class: 'rm-breath', 'aria-hidden': 'true' }, h('span')),
    h('p', { class: 'rm-big-text' }, T('breathe')),
    h('p', { class: 'rm-text' }, T('breakNote')),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud(`${T('breathe')} ${T('breakNote')}`), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('ready'), () => { if (play && data.active) go('play'); else go('welcome'); }, { cls: 'primary big', ic: 'next', k: 'ready' }),
      button(T('stopToday'), () => { save(data); go('bye'); }, { cls: 'big', k: 'stop' })));
}

function viewBye() {
  return h('main', { class: 'rm-screen rm-bye' },
    h('div', { class: 'rm-lumi big', html: lumiSVG('happy') }),
    h('h2', { class: 'rm-h2' }, T('byeTitle')),
    h('p', { class: 'rm-big-text' }, T('byeText')),
    h('div', { class: 'rm-actions' },
      button(T('myIsland'), () => go('island'), { cls: 'big', ic: 'island', k: 'island' }),
      button(T('home'), () => go('welcome'), { cls: 'primary big', ic: 'home', k: 'home' })));
}

// ---------------------------------------------------------------- celebrate
function viewCelebrate() {
  const c = celebrate || { own: 0, team: 0, earned: 0, friend: null, mode: 'mix' };
  const conf = reduced() ? null : h('div', { class: 'rm-confetti', 'aria-hidden': 'true' },
    Array.from({ length: 28 }, (_, i) => h('span', { style: `--i:${i};--x:${(i * 37) % 100}` })));
  return h('main', { class: 'rm-screen rm-celebrate' },
    conf,
    h('div', { class: 'rm-lumi big', html: lumiSVG('cheer') }),
    h('h2', { class: 'rm-h2' }, T('celTitle')),
    h('p', { class: 'rm-big-text' }, T('celSolved', { n: c.earned })),
    h('div', { class: 'rm-chips' },
      c.own ? h('span', { class: 'rm-chip' }, h('span', { html: icon('star') }), T('celOwn', { n: c.own })) : null,
      c.team ? h('span', { class: 'rm-chip team' }, h('span', { html: lumiSVG('happy') }), T('celTeam', { n: c.team })) : null,
      h('span', { class: 'rm-chip' }, h('span', { html: pieceSVG(2) }), T('celPieces', { n: c.earned })),
      c.mode === 'path' ? h('span', { class: 'rm-chip' }, h('span', { html: icon('star') }), T('celLevel', { n: data.progress.path.level, s: data.progress.path.stars, g: levelInfo(data.progress.path.level).goal })) : null),
    c.friend
      ? h('div', { class: 'rm-friend-card photocard new' },
        h('div', { class: 'rm-friend-art', html: friendSVG(c.friend) }),
        h('div', null, h('p', { class: 'rm-text' }, T('celFriend')), h('p', { class: 'rm-friend-name' }, CREATURE_NAMES[c.friend][L()])))
      : h('p', { class: 'rm-text' }, T('celAllFriends')),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud([T('celTitle'), T('celSolved', { n: c.earned }), c.friend ? `${T('celFriend')} ${CREATURE_NAMES[c.friend][L()]}` : ''].join(' ')), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('oneMore'), () => (isLittle() ? startLittle() : startSession(data.settings.practice === 'choose' ? c.mode : data.settings.practice)), { cls: 'primary big', ic: 'next', k: 'more' }),
      button(T('seeIsland'), () => go('island'), { cls: 'big', ic: 'island', k: 'island' }),
      button(T('allDone'), () => go('bye'), { cls: 'big', k: 'done' })));
}

// ---------------------------------------------------------------- island
function viewIsland() {
  const r = data.rewards;
  const rainbows = Math.floor(r.pieces / 7);
  const inNext = r.pieces % 7;
  return h('main', { class: 'rm-screen rm-island' },
    h('div', { class: 'rm-row-top' },
      button(T('back'), () => go(data.active ? 'welcome' : 'welcome'), { cls: 'soft small', ic: 'back', k: 'back' }),
      langButton()),
    h('h2', { class: 'rm-h2' }, T('islandTitle')),
    h('div', { class: 'rm-island-scene', html: islandSVG({ pieces: r.pieces, friends: r.friends, rainbows, star: r.star }) }),
    h('div', { class: 'rm-island-stats' },
      h('div', { class: 'rm-drops', role: 'img', 'aria-label': T('islandNext', { n: 7 - inNext }) },
        [0, 1, 2, 3, 4, 5, 6].map((i) => h('span', { class: i < inNext ? 'on' : '', html: pieceSVG(i) }))),
      h('p', { class: 'rm-text' }, `${T('islandPieces', { n: r.pieces })} · ${T('islandNext', { n: 7 - inNext })}`),
      rainbows ? h('p', { class: 'rm-text' }, T('islandRainbows', { n: rainbows })) : null),
    h('h3', { class: 'rm-h3' }, T('islandFriends', { n: r.friends.length, total: CREATURE_ORDER.length })),
    r.friends.length
      ? h('div', { class: 'rm-friends' }, r.friends.map((f) => h('div', { class: 'rm-friend-card photocard' },
        h('div', { class: 'rm-friend-art', html: friendSVG(f) }),
        h('p', { class: 'rm-friend-name' }, CREATURE_NAMES[f][L()]))))
      : h('p', { class: 'rm-text' }, T('islandEmpty')));
}

// ---------------------------------------------------------------- parent area
function seg(label, value, options, onPick) {
  return h('div', { class: 'rm-field' },
    h('div', { class: 'rm-field-l' }, label),
    h('div', { class: 'rm-seg', role: 'group', 'aria-label': label },
      options.map(([v, text]) => h('button', {
        type: 'button', class: 'rm-seg-b', 'aria-pressed': String(v === value), 'data-k': `seg-${label}-${v}`,
        onclick: () => { onPick(v); parentMsg = ''; save(data); update(); },
      }, text))));
}

// 100 levels: a dropdown instead of 100 buttons.
function levelPicker(label, value, max, onPick, nameOf = lvName) {
  return h('div', { class: 'rm-field' },
    h('div', { class: 'rm-field-l' }, label),
    h('select', {
      class: 'rm-select', 'aria-label': label, 'data-k': 'level-select',
      onchange: (e) => { onPick(Number(e.target.value)); parentMsg = ''; save(data); update(); },
    }, Array.from({ length: max }, (_, i) => h('option', { value: String(i + 1), selected: i + 1 === value }, `${i + 1} \u00b7 ${nameOf(i + 1)}`))));
}

// This child's code for other devices, at the top of their grown-ups page.
function cloudCard() {
  if (!sync.on() || !player) return null;
  const pl = players.players.find((x) => x.id === player.id) || player;
  return h('section', { class: 'rm-card rm-p-sec rm-cloud-card' },
    h('p', null, h('span', { class: 'rm-small' }, `\u2601\uFE0F ${T('p_code')}: `),
      pl.cloud && pl.rev ? h('b', { class: 'rm-code', 'data-k': 'my-code' }, showCode(pl.cloud)) : h('span', { class: 'rm-small' }, T('p_codeWait'))),
    h('p', { class: 'rm-small' }, T('p_cloudNote')));
}

function playersSection() {
  return h('section', { class: 'rm-card rm-p-sec' },
    h('h3', { class: 'rm-h3' }, T('p_players')),
    h('ul', { class: 'rm-plist' }, players.players.map((pl) => h('li', null,
      h('span', { class: 'rm-plist-art', html: friendSVG(pl.friend || 'fox') }),
      h('b', null, pl.name),
      h('span', { class: 'rm-small' }, pl.little ? T('kindLittle') : T('kindBig')),
      sync.on() ? h('span', { class: 'rm-cloud-code', 'data-k': `code-${pl.id}` }, pl.cloud && pl.rev
        ? [h('span', { class: 'rm-small' }, `${T('p_code')}: `), h('b', { class: 'rm-code' }, showCode(pl.cloud))]
        : h('span', { class: 'rm-small' }, T('p_codeWait'))) : null,
      button(T('p_resetPin'), () => { pl.pin = null; savePlayers(players); parentMsg = T('p_pinReset'); update(); }, { cls: 'small soft', k: `pin-reset-${pl.id}`, disabled: !pl.pin }),
      pdel === pl.id
        ? h('span', { class: 'rm-confirm-inline' }, h('span', null, sync.on() && pl.cloud && pl.rev ? T('p_delCloud', { who: pl.name }) : T('p_delSure', { who: pl.name })),
          button(T('p_resetYes'), () => { removePlayer(players, pl.id); players = loadPlayers(); pdel = null; if (player && player.id === pl.id) { player = null; data = guestData(); play = null; } update(); }, { cls: 'small danger', k: `del-yes-${pl.id}` }),
          button(T('p_resetNo'), () => { pdel = null; update(); }, { cls: 'small soft', k: `del-no-${pl.id}` }))
        : button(T('p_delPlayer'), () => { pdel = pl.id; update(); }, { cls: 'small soft', k: `del-${pl.id}` })))),
    sync.on() ? h('p', { class: 'rm-small' }, T('p_cloudNote')) : null,
    sync.on() ? h('p', { class: `rm-small ${players.players.some((x) => x.dirty) && sync.state.online === false ? 'warn' : ''}` },
      players.players.some((x) => x.dirty || !x.rev) ? T('p_cloudWaiting') : T('p_cloudOk')) : null,
    h('p', { class: 'rm-small' }, T('p_playersNote')));
}
let pdel = null;
let prizeDraft = { title: '', icon: '\u{1F6CD}\uFE0F', goal: 50 };

function prizesSection() {
  const list = data.prizes || (data.prizes = []);
  const have = data.rewards.pieces;
  const titleIn = h('input', {
    type: 'text', class: 'rm-input small', maxlength: '30', placeholder: T('p_prizePh'), value: prizeDraft.title, 'data-k': 'prize-title', 'aria-label': T('p_prizeTitle'),
    oninput: (e) => { prizeDraft.title = e.target.value.replace(/[<>]/g, ''); const b = root.querySelector('[data-k="prize-add"]'); if (b) b.disabled = !prizeDraft.title.trim(); },
  });
  return h('section', { class: 'rm-card rm-p-sec' },
    h('h3', { class: 'rm-h3' }, T('p_prizes')),
    h('p', { class: 'rm-small' }, `${T('p_prizesNote')} ${T('pieces', { n: have })}.`),
    list.length ? h('ul', { class: 'rm-plist' }, list.map((pz) => h('li', null,
      h('span', { class: 'rm-prize-icon' }, pz.icon),
      h('b', null, `${pz.title} \u00b7 ${pz.goal}`),
      h('span', { class: 'rm-small' }, pz.given ? T('p_prizeGiven') : pz.won ? T('p_prizeWon') : T('p_prizeLeft', { n: Math.max(0, pz.goal - have) })),
      pz.won && !pz.given ? button(T('p_prizeGive'), () => { pz.given = true; save(data); update(); }, { cls: 'small', k: `give-${pz.id}` }) : null,
      button(null, () => { data.prizes = list.filter((x) => x.id !== pz.id); save(data); update(); }, { cls: 'icon soft small', ic: 'close', aria: T('p_delPlayer'), k: `pz-del-${pz.id}` })))) : h('p', { class: 'rm-small' }, T('p_noPrizes')),
    h('div', { class: 'rm-field' }, h('div', { class: 'rm-field-l' }, T('p_prizeTitle')), titleIn),
    h('div', { class: 'rm-seg' }, PRIZE_ICONS.map((ic) => h('button', { type: 'button', class: 'rm-seg-b emoji', 'aria-pressed': String(prizeDraft.icon === ic), onclick: () => { prizeDraft.icon = ic; update(); } }, ic))),
    seg(T('p_prizeGoal'), prizeDraft.goal, [[20, '20'], [50, '50'], [100, '100'], [200, '200'], [300, '300']], (v) => { prizeDraft.goal = v; }),
    button(T('p_prizeAdd'), () => {
      const title = prizeDraft.title.trim().slice(0, 30);
      if (!title) return;
      list.push({ id: `z${Date.now().toString(36)}`, title, icon: prizeDraft.icon, goal: prizeDraft.goal, won: data.rewards.pieces >= prizeDraft.goal, given: false });
      prizeDraft = { title: '', icon: prizeDraft.icon, goal: prizeDraft.goal };
      save(data);
      update();
    }, { cls: 'primary', ic: 'star', k: 'prize-add', disabled: !prizeDraft.title.trim() }));
}

function viewParent() {
  if (player && isLittle()) return viewParentLittle();
  if (!player) {
    return h('main', { class: 'rm-screen rm-parent' },
      h('div', { class: 'rm-row-top' },
        h('h2', { class: 'rm-h2' }, T('p_title')),
        button(T('p_close'), () => go('who'), { cls: 'soft small', ic: 'close', k: 'p-close' })),
      parentMsg ? h('p', { class: 'rm-small ok', role: 'status' }, parentMsg) : null,
      playersSection(),
      h('section', { class: 'rm-card rm-p-sec' }, button(T('p_changePin'), changeParentPin, { cls: 'small soft', ic: 'lock', k: 'p-change-pin' })));
  }
  const st = data.settings;
  const sk = data.progress.skills;
  const status = (k) => {
    if ((k === 'C' || k === 'D') && !regroupAvailable(data, k)) return T('p_st_locked');
    if (sk[k].attempts === 0) return T('p_st_new');
    if (sk[k].level === 3 && sk[k].independent >= 6) return T('p_st_strong');
    return T('p_st_practice');
  };
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString(L() === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' }); } catch (e) { return iso.slice(0, 10); } };
  return h('main', { class: 'rm-screen rm-parent' },
    h('div', { class: 'rm-row-top' },
      h('h2', { class: 'rm-h2' }, `${T('p_title')} \u00b7 ${player.name}`),
      button(T('p_close'), () => go(parentReturn === 'parent' ? 'welcome' : parentReturn), { cls: 'soft small', ic: 'close', k: 'p-close' })),
    parentMsg ? h('p', { class: 'rm-small ok', role: 'status' }, parentMsg) : null,
    cloudCard(),
    learningSection(),
    prizesSection(),
    h('section', { class: 'rm-card rm-p-sec' },
      seg(T('p_practice'), st.practice, [['choose', T('p_choose')], ['path', T('p_path_opt')], ['add', T('p_add')], ['sub', T('p_sub')], ['mix', T('p_mix')], ['mul', T('p_mul_opt')]], (v) => { st.practice = v; }),
      levelPicker(T('p_path'), data.progress.path.level, LEVELS.length, (v) => {
        const path = data.progress.path;
        path.level = v;
        path.stars = 0;
        path.best = Math.max(path.best || 1, v);
        path.quizDue = false;
        path.quizWait = 0;
        path.champion = false;
      }),
      h('p', { class: 'rm-small' }, `${T('pathLevel', { n: data.progress.path.level, name: lvName(data.progress.path.level) })}. ${T('p_pathNote')}`),
      seg(T('p_mult'), st.mult !== false, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.mult = v; }),
      button(T('p_replace'), () => { data.progress.placed = false; save(data); parentMsg = T('p_replaceDone'); update(); }, { cls: 'small soft', ic: 'reset', k: 'replace' }),
      seg(T('p_regroup'), st.regroup, [['off', T('p_reg_off')], ['auto', T('p_reg_auto')], ['now', T('p_reg_now')]], (v) => { st.regroup = v; }),
      h('p', { class: 'rm-small' }, T('p_regNote')),
      seg(T('p_length'), st.sessionLength, [[3, '3'], [5, '5'], [8, '8'], [10, '10']], (v) => { st.sessionLength = v; }),
      seg(T('p_lang'), st.lang, [['en', 'English'], ['es', 'Español']], (v) => { st.lang = v; }),
      seg(T('p_sound'), st.sound, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.sound = v; setSound(v); }),
      seg(T('p_autoRead'), st.autoRead, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.autoRead = v; }),
      seg(T('p_coach'), st.coach !== false, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.coach = v; }),
      seg(T('p_coachVoice'), st.coachVoice !== false, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.coachVoice = v; }),
      seg(T('p_coachVoiceKind'), st.coachVoiceKind === 'device' ? 'device' : 'cartoon', [['cartoon', T('p_vk_cartoon')], ['device', T('p_vk_device')]], (v) => { st.coachVoiceKind = v; }),
      voiceField(),
      voiceCheck(),
      seg(T('p_motion'), st.motion, [['auto', T('p_motionAuto')], ['reduce', T('p_motionReduce')]], (v) => { st.motion = v; })),
    h('section', { class: 'rm-card rm-p-sec' },
      h('h3', { class: 'rm-h3' }, T('p_progress')),
      h('div', { class: 'rm-table-wrap' },
        h('table', { class: 'rm-table' },
          h('thead', null, h('tr', null, [T('p_skill'), T('p_level'), T('p_own'), T('p_withHelp'), T('p_status')].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', null, ['A', 'B', 'C', 'D', 'M'].map((k) => h('tr', null,
            h('th', { scope: 'row' }, T(`skill_${k}`)),
            h('td', null, `${sk[k].level} / 3`),
            h('td', null, String(sk[k].independent)),
            h('td', null, String(sk[k].helped)),
            h('td', null, status(k))))))),
      h('p', { class: 'rm-small' }, T('p_rewards', { p: data.rewards.pieces, f: data.rewards.friends.length })),
      h('h3', { class: 'rm-h3' }, T('p_sessions')),
      data.sessions.length
        ? h('ul', { class: 'rm-sessions' }, data.sessions.slice(0, 10).map((x) => h('li', null,
          T('p_sessionRow', { date: fmtDate(x.date), mode: T(`p_mode_${x.mode}`), done: x.done, own: x.own, team: x.team }))))
        : h('p', { class: 'rm-small' }, T('p_noSessions'))),
    h('section', { class: 'rm-card rm-p-sec' },
      h('p', { class: 'rm-small' }, T(sync.on() ? 'p_saveNoteCloud' : 'p_saveNote')),
      !storageOK ? h('p', { class: 'rm-small warn' }, T('p_noStorage')) : null,
      h('p', { class: 'rm-small' }, T('p_speechNote'), canSpeak() ? '' : ' ✖'),
      h('p', { class: 'rm-small' }, T('p_unlistedNote')),
      button(T('p_changePin'), changeParentPin, { cls: 'small soft', ic: 'lock', k: 'p-change-pin' }),
      parentConfirm
        ? h('div', { class: 'rm-confirm', role: 'alertdialog', 'aria-label': T('p_reset') },
          h('p', { class: 'rm-text' }, T('p_resetSure')),
          h('div', { class: 'rm-actions' },
            button(T('p_resetYes'), resetProgress, { cls: 'danger', k: 'reset-yes' }),
            button(T('p_resetNo'), () => { parentConfirm = false; update(); }, { cls: 'soft', k: 'reset-no' })))
        : button(T('p_reset'), () => { parentConfirm = true; update(); }, { cls: 'soft', ic: 'reset', k: 'reset' })));
}

const fmtDay = (iso) => { try { return new Date(iso).toLocaleDateString(L() === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } };

// Is she learning or just following the guide? Practice (with the guide) next to quizzes (alone),
// the kinds of slips in quizzes, and every quiz problem with what she wrote.
function learningSection() {
  const sk = data.progress.skills;
  const quizzes = data.quizzes || [];
  const all = quizzes.flatMap((q) => q.items || []);
  const rows = ['A', 'B', 'C', 'D', 'M'].filter((k) => sk[k].attempts > 0 || all.some((i) => i.skill === k)).map((k) => {
    const items = all.filter((i) => i.skill === k);
    const qOwn = items.filter((i) => i.ok && !i.helped).length;
    const pp = sk[k].attempts ? sk[k].independent / sk[k].attempts : 0;
    const qp = items.length ? qOwn / items.length : 0;
    const verdict = items.length < 2 ? 'v_noData' : qp >= 0.8 ? 'v_learned' : pp >= 0.7 && qp < 0.6 ? 'v_guide' : 'v_learning';
    return h('tr', null,
      h('th', { scope: 'row' }, T(`skill_${k}`)),
      h('td', null, sk[k].attempts ? `${Math.round(pp * 100)}%` : '\u2013'),
      h('td', null, items.length ? `${qOwn}/${items.length}` : '\u2013'),
      h('td', null, T(`fade_${helpLevel(data, k)}`)),
      h('td', { class: `rm-verdict ${verdict}` }, T(verdict)));
  });
  const counts = {};
  for (const it of all) if (it.pattern) counts[it.pattern] = (counts[it.pattern] || 0) + 1;
  const mistakes = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const sym = (op) => (op === '+' ? '+' : op === '-' ? '\u2212' : '\u00d7');
  const itemText = (it) => {
    const how = it.helped ? T('q_help') : !it.ok ? T('q_miss') : it.firstTry ? T('q_own') : T('q_retry');
    const marks = [
      it.carry === true ? T('q_carry') : it.carry === false ? T('q_noCarry') : null,
      it.borrow === true ? T('q_borrow') : it.borrow === false ? T('q_noBorrow') : null,
      it.blocks ? T('q_blocks') : null,
    ].filter(Boolean).join(', ');
    const tries = (it.tries || []).length ? `${it.tries.join(', ')} \u2192 ` : '';
    return `${it.ok ? '\u2714' : '\u2716'} ${it.a} ${sym(it.op)} ${it.b} = ${tries}${it.answer} \u00b7 ${how}${marks ? ` \u00b7 ${marks}` : ''}`;
  };
  return h('section', { class: 'rm-card rm-p-sec' },
    h('h3', { class: 'rm-h3' }, T('p_learn')),
    h('p', { class: 'rm-small' }, T('p_learnNote')),
    rows.length ? h('div', { class: 'rm-table-wrap' },
      h('table', { class: 'rm-table' },
        h('thead', null, h('tr', null, [T('p_skill'), T('p_colPractice'), T('p_colQuiz'), T('p_colGuide'), T('p_colVerdict')].map((x) => h('th', { scope: 'col' }, x)))),
        h('tbody', null, rows))) : null,
    h('h3', { class: 'rm-h3' }, T('p_mistakes')),
    mistakes.length
      ? h('ul', { class: 'rm-sessions' }, mistakes.map(([k, n]) => h('li', null, `${T(`mk_${k}`)}: ${n}`)))
      : h('p', { class: 'rm-small' }, T('p_noMistakes')),
    h('h3', { class: 'rm-h3' }, T('p_quizzes')),
    quizzes.length
      ? h('ul', { class: 'rm-sessions rm-quizlist' }, quizzes.slice(0, 8).map((q) => h('li', null,
        h('b', null, T('p_quizRow', { date: fmtDay(q.date), l: q.level, k: q.k, n: q.n, res: !q.counted ? `${T('p_checkOnly')}${q.passed ? ' \u2714' : ''}` : q.passed ? T('p_passed') : T('p_notYet') })),
        h('ul', null, (q.items || []).map((it) => h('li', { class: 'rm-small' }, itemText(it)))))))
      : h('p', { class: 'rm-small' }, T('p_noQuizzes')),
    button(T('p_quizNow'), () => go('quizIntro'), { cls: 'primary small', ic: 'star', k: 'p-quiz' }),
    h('p', { class: 'rm-small' }, T('p_quizNowNote')));
}

function voiceField() {
  const lang = L();
  const voices = canSpeak() ? listVoices(lang) : [];
  if (!data.settings.voice) data.settings.voice = { en: '', es: '' };
  const cur = data.settings.voice[lang] || '';
  const sel = h('select', {
    class: 'rm-select', 'aria-label': T('p_voice'), 'data-k': 'voice-select',
    onchange: (e) => { data.settings.voice[lang] = e.target.value; save(data); speak(T('voiceSample'), lang); },
  },
  h('option', { value: '' }, T('p_voiceAuto')),
  voices.map((v) => h('option', { value: v.name, selected: v.name === cur }, `${v.nice ? '\u2605 ' : ''}${v.name} (${v.lang})`)));
  return h('div', { class: 'rm-field' },
    h('div', { class: 'rm-field-l' }, T('p_voice')),
    h('div', { class: 'rm-seg' },
      sel,
      button(T('p_voiceTest'), () => readAloud(T('voiceSample')), { cls: 'small', ic: 'read', k: 'voice-test' })),
    canSpeak() && !voices.length ? h('p', { class: 'rm-small' }, T('p_noVoices')) : null,
    h('p', { class: 'rm-small' }, T('p_voiceTip')));
}

// Shows which voice the guide really used last, and lets a grown-up test it with a tap.
let voiceNamesCache = null;
function voiceCheck() {
  if (!voiceNamesCache) voiceNames().then((v) => { voiceNamesCache = v || {}; if (screen === 'parent') update(); });
  const lang = L();
  const vi = voiceInfo;
  const last = vi.last
    ? (vi.last.how === 'recording' ? T('vc_rec', { via: vi.last.via }) : T('vc_dev', { why: vi.last.reason || '?' }))
    : T('vc_none');
  return h('div', { class: 'rm-field rm-vcheck' },
    h('div', { class: 'rm-field-l' }, T('vc_title')),
    h('p', { class: 'rm-small' }, T('vc_voice', { lang: lang === 'es' ? 'Español' : 'English', who: (voiceNamesCache && voiceNamesCache[lang]) || '\u2026' })),
    h('p', { class: 'rm-small' }, `${T('vc_last')}: ${last}`),
    h('p', { class: 'rm-small' }, `iPad: ${vi.ios ? T('p_on') : T('p_off')} \u00b7 ${T('p_sound')}: ${data.settings.sound ? T('p_on') : T('p_off')} \u00b7 v25${vi.unlockError ? ` \u00b7 unlock: ${vi.unlockError}` : ''}${vi.mediaError ? ` \u00b7 player: ${vi.mediaError}` : ''}`),
    button(T('vc_test'), () => { unlockMedia(); unlockAudio(); sayLine('hello'); setTimeout(() => { if (screen === 'parent') update(); }, 1200); }, { cls: 'small', ic: 'read', k: 'vc-test' }));
}

function resetProgress() {
  data = { ...defaults(), settings: data.settings, visits: 1 };
  play = null;
  celebrate = null;
  parentConfirm = false;
  parentMsg = T('p_resetDone');
  save(data);
  update();
}

// ---------------------------------------------------------------- keyboard
function onKey(e) {
  if (screen === 'pin' && /^[0-9]$/.test(e.key)) { e.preventDefault(); pinPress(e.key); return; }
  if (screen === 'pin' && e.key === 'Enter' && pin.kind === 'parent' && pin.mode === 'gate') { e.preventDefault(); gateCheck(); return; }
  if (screen === 'pin' && e.key === 'Backspace') { e.preventDefault(); pin.entry = pin.entry.slice(0, -1); update(); return; }
  if (screen !== 'play' || !play) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); del(); }
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && usingCells()) { e.preventDefault(); selectCell(e.key === 'ArrowLeft' ? 'tens' : 'ones'); }
  else if (e.key === 'Enter') {
    if (e.target && e.target.tagName === 'BUTTON' && root.contains(e.target)) return;
    e.preventDefault();
    if (play.status === 'solved') goNext(); else submit();
  }
}

// ---------------------------------------------------------------- start
document.addEventListener('keydown', onKey);
onVoicesChanged(() => { if (screen === 'parent') update(); });
if (reduceMQ && reduceMQ.addEventListener) reduceMQ.addEventListener('change', applyMotion);
// iPad Safari wakes sound only on real taps (touchend / click), so listen to those every time.
const wakeSound = () => { unlockAudio(); unlockMedia(); };
['touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, wakeSound, { capture: true, passive: true }));
render();
// Cloud: send anything waiting, and bring in what other devices saved.
function catchUp() {
  if (!sync.on()) return;
  sync.upAll();
  for (const pl of players.players) if (pl.cloud && (!player || pl.id !== player.id || CALM.includes(screen))) pullNow(pl.id);
}
catchUp();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') catchUp();
  else if (player) sync.push(player.id); // she put the iPad down: save to the cloud now
});
window.addEventListener('online', catchUp);
