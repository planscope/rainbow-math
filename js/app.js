// Mila's Rainbow Math Adventure: screens and interaction.
import { generateProblem, analyzeAnswer, buildSteps, parseEntry, tensOf, onesOf, isValidProblem, BASE_SKILL } from './math.js?v=4';
import * as M from './model.js?v=4';
import { t, STR, storyText, CREATURE_NAMES, CREATURE_ORDER } from './i18n.js?v=4';
import { lumiSVG, friendSVG, islandSVG, icon, pieceSVG } from './art.js?v=4';
import { load, save, storageOK, pickSkill, recordResult, regroupAvailable, defaults } from './store.js?v=4';
import { sfx, setSound, unlockAudio, speak as speakRaw, stopSpeaking, canSpeak, listVoices, onVoicesChanged } from './audio.js?v=4';

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
let data = load();
data.visits = (data.visits || 0) + 1;
save(data);
setSound(data.settings.sound);

let screen = 'welcome';
let play = null;        // live state of the current problem
let celebrate = null;   // results of the finished adventure
let parentReturn = 'welcome';
let parentConfirm = false;
let parentMsg = '';
let toastTimer = null;

const L = () => data.settings.lang;
const speak = (text, lang) => speakRaw(text, lang, (data.settings.voice || {})[lang] || '');
const T = (k, p) => t(L(), k, p);
const W = () => STR[L()] || STR.en;
const reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const reduced = () => data.settings.motion === 'reduce' || !!(reduceMQ && reduceMQ.matches);
const opSym = (op) => (op === '+' ? '+' : '−');
const rand = (n) => Math.floor(Math.random() * n);

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
  applyMotion();
  if (play && play.bubbleKey) play.bubble = play.bubbleKey(); // follows language changes
  let view;
  switch (screen) {
    case 'choose': view = viewChoose(); break;
    case 'play': view = viewPlay(); break;
    case 'break': view = viewBreak(); break;
    case 'celebrate': view = viewCelebrate(); break;
    case 'island': view = viewIsland(); break;
    case 'bye': view = viewBye(); break;
    case 'parent': view = viewParent(); break;
    default: view = viewWelcome();
  }
  root.replaceChildren(view, toastEl);
  if (focusKey) {
    const el = root.querySelector(`[data-k="${focusKey}"]`);
    if (el && !el.disabled) el.focus({ preventScroll: true });
  }
  if (screen === 'play' && play) setupInk();
  if (play) play.fresh = new Map();
}
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
          read && spoken ? button(null, () => readAloud(spoken), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'bubble-read' }) : null)
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

function parentHold() {
  const el = h('button', { type: 'button', class: 'rm-btn rm-hold soft small', 'aria-label': T('grownUps'), 'data-k': 'hold' },
    h('span', { class: 'rm-btn-ic', html: icon('lock') }),
    h('span', { class: 'rm-btn-t' }, T('grownUps')),
    h('span', { class: 'rm-hold-bar' }));
  let timer = null;
  const begin = (e) => {
    if (timer) return;
    if (e && e.cancelable) e.preventDefault();
    el.classList.add('holding');
    timer = setTimeout(() => { cancel(); parentReturn = screen; parentConfirm = false; parentMsg = ''; go('parent'); }, 2000);
  };
  const cancel = () => { clearTimeout(timer); timer = null; el.classList.remove('holding'); };
  el.addEventListener('pointerdown', begin);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => el.addEventListener(ev, cancel));
  el.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) begin(e); });
  el.addEventListener('keyup', cancel);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  return el;
}

const rainbowBar = () => h('div', { class: 'rm-rainbow-bar', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6].map(() => h('span')));

// ---------------------------------------------------------------- welcome
function viewWelcome() {
  const s = data.active;
  const r = data.rewards;
  const returning = r.pieces > 0 || data.sessions.length > 0;
  return h('main', { class: 'rm-screen rm-welcome' },
    h('div', { class: 'rm-corner' }, langButton()),
    h('h1', { class: 'rm-title' }, T('appName')),
    rainbowBar(),
    h('div', { class: 'rm-welcome-scene', html: islandSVG({ pieces: r.pieces, friends: r.friends, rainbows: Math.floor(r.pieces / 7), star: r.star }) }),
    h('div', { class: 'rm-welcome-bubble' }, bubbleEl({ mood: 'happy', text: returning ? T('welcomeBack') : T('welcomeHi') })),
    h('div', { class: 'rm-actions' },
      s
        ? button(T('keepGoing', { n: Math.min(s.index + 1, s.length), total: s.length }), resumeSession, { cls: 'primary big', ic: 'next', k: 'go' })
        : button(T('letsGo'), startFlow, { cls: 'primary big', ic: 'next', k: 'go' }),
      s ? button(T('newAdventure'), () => { data.active = null; save(data); startFlow(); }, { cls: 'big', k: 'new' }) : null,
      button(T('myIsland'), () => go('island'), { cls: 'big', ic: 'island', k: 'island' })),
    h('div', { class: 'rm-foot' }, parentHold()));
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
    h('div', { class: 'rm-adv-grid' },
      card('add', T('addTitle'), T('addPlace'), '+', 'add'),
      card('sub', T('subTitle'), T('subPlace'), '−', 'sub'),
      card('mix', T('mixTitle'), T('mixPlace'), '±', 'mix')));
}

function startFlow() {
  const pr = data.settings.practice;
  if (pr === 'add' || pr === 'sub' || pr === 'mix') startSession(pr);
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
  newProblem();
  go('play');
}

function resumeSession() {
  const s = data.active;
  if (!s) return startFlow();
  if (s.index >= s.length) return finishSession();
  if (!s.current || !s.current.p || !isValidProblem(s.current.p)) newProblem();
  else initPlay();
  go('play');
}

function totalAttempts() {
  return Object.values(data.progress.skills).reduce((n, s) => n + s.attempts, 0);
}

function newProblem() {
  const s = data.active;
  const skill = pickSkill(data, s.mode, s);
  const st = data.progress.skills[skill];
  const p = generateProblem(skill, st.level, Math.random, s.used);
  let msg = null;
  let blocks = false;
  if (st.attempts === 0 && !BASE_SKILL[skill]) { msg = 'introFirst'; blocks = true; }
  else if (st.attempts === 0 && BASE_SKILL[skill]) { msg = skill === 'C' ? 'newSkillAdd' : 'newSkillSub'; blocks = true; }
  else if (s.note === 'support') { msg = 'supportNext'; blocks = true; }
  else if (s.note === 'similar') msg = 'similarNext';
  else if (s.note === 'harder') msg = 'harderNext';
  const story = !blocks && totalAttempts() > 0 && Math.random() < 0.4 ? rand(10) : null;
  s.current = { p, story, wrongs: 0, helped: false, blocksUsed: blocks, showBlocks: blocks, solved: false, awarded: false, msg, prompt: rand(4) };
  s.used.push(p.key);
  s.lastOp = p.op;
  s.repeatSkill = null;
  s.ease = false;
  s.note = null;
  save(data);
  initPlay();
}

function initPlay() {
  const c = data.active.current;
  play = {
    p: c.p,
    model: M.makeModel(c.p),
    showBlocks: !!c.showBlocks,
    counting: false,
    entry: c.solved ? String(c.p.answer) : '',
    entryStale: false,
    cells: c.solved ? answerCells(c.p.answer) : { tens: '', ones: '' },
    activeCell: 'ones',
    drawing: false,
    strokes: [],
    carryFresh: false,
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
  };
  setBubble(() => (c.solved ? solvedBubble(null) : introBubble()));
}

const answerCells = (n) => ({ tens: n >= 10 ? String(tensOf(n)) : '', ones: String(onesOf(n)) });

// The final answer is typed into the Tens and Ones boxes, like on paper.
function usingCells() {
  if (!play) return false;
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
  return h('main', { class: `rm-screen rm-play ${play.showBlocks ? 'with-blocks' : 'no-blocks'}` },
    topBar(s),
    h('section', { class: 'rm-a-bubble' }, bubbleEl(play.bubble)),
    h('section', { class: 'rm-a-problem' }, problemCard()),
    play.showBlocks ? h('section', { class: 'rm-a-blocks' }, matPanel()) : null,
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
    soundButton());
}

function problemCard() {
  const c = data.active.current;
  const p = play.p;
  const solved = play.status === 'solved';
  return h('div', { class: `rm-card rm-problem ${play.drawing ? 'drawing' : ''}` },
    c.story != null ? h('p', { class: 'rm-story' }, storyText(L(), p, c.story)) : null,
    h('p', { class: 'rm-eq', 'aria-label': T('whatIs', { a: p.a, b: p.b, opw: p.op === '+' ? W().plusWord : W().minusWord }) },
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
  const fc = play.focusCol;
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
  const arrow = (dir) => h('span', { class: `rm-w-arrow ${dir} ${fresh ? 'fresh' : ''}`, html: CARRY_ARROW, 'aria-hidden': 'true' });
  let markT = null, markO = null;
  if (traded && p.op === '+') {
    markT = h('span', { class: 'rm-w-markwrap' }, h('span', { class: `rm-carry ${fresh ? 'fly-left' : ''}` }, '1'), arrow('to-tens'));
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
  const cell = (txt, col, extra = '') => h('span', { class: `rm-w-c ${col} ${fc === col ? 'focus' : ''} ${extra}` }, txt);
  const borrowNow = gst && gst.kind === 'borrow' && !traded;
  const topTens = borrowNow
    ? h('button', { type: 'button', class: 'rm-w-c tens num-a rm-borrow-btn', 'data-k': 'borrow-digit', 'aria-label': T('act_borrow'), onclick: doBorrow }, String(a10))
    : cell(String(a10), 'tens', `num-a ${traded && p.op === '-' ? 'struck' : ''}`);
  const cellsOn = usingCells() && play.status !== 'solved';
  const box = (txt, col, pen) => h('button', {
    type: 'button',
    class: `rm-w-c ${col} rm-w-ans ${pen ? 'pencil' : ''} ${play.entryStale && !pen ? 'stale' : ''} ${cellsOn && play.activeCell === col ? 'active' : ''} ${fc === col ? 'focus' : ''}`,
    'data-k': `cell-${col}`,
    'aria-label': `${col === 'tens' ? T('tensCol') : T('onesCol')}: ${txt || '?'}`,
    disabled: !cellsOn,
    onclick: () => selectCell(col),
  }, txt);
  return h('div', { class: `rm-written ${traded || (gst && gst.split) ? 'traded' : ''}` },
    h('span', { class: 'rm-w-op' }), cell(T('tensCol'), 'tens', 'rm-w-h'), cell(T('onesCol'), 'ones', 'rm-w-h'),
    h('span', { class: 'rm-w-op' }), cell(markT, 'tens', 'rm-w-mark'), cell(markO, 'ones', 'rm-w-mark'),
    h('span', { class: 'rm-w-op' }), topTens, cell(String(a1), 'ones', `num-a ${traded && p.op === '-' ? 'struck' : ''}`),
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
  if (guided && st && st.kind === 'ask') label = `${st.params.x} + ${st.params.y} = ?`;
  const cellsOn = usingCells();
  let shown = play.entry;
  if (cellsOn) {
    label = T('typingIn', { box: play.activeCell === 'ones' ? T('onesCol') : T('tensCol') });
    const { tens, ones } = play.cells;
    shown = tens ? `${tens}${ones || '?'}` : ones;
  }
  const key = (d) => button(String(d), () => press(String(d)), { cls: 'rm-key', k: `key-${d}`, disabled });
  const last = data.active.index + 1 >= data.active.length;
  return h('div', { class: `rm-pad ${disabled ? 'off' : ''}` },
    solved
      ? button(last ? T('finish') : T('next'), goNext, { cls: 'primary big rm-next', ic: 'next', k: 'next' })
      : h('div', { class: 'rm-entry' },
        h('span', { class: 'rm-entry-l' }, label),
        h('span', { class: `rm-entry-v ${play.entryStale ? 'stale' : ''}` }, shown || ' '),
        cellsOn && !guided ? h('span', { class: 'rm-entry-tip' }, T('tapBox')) : null),
    h('div', { class: 'rm-keys' },
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(key),
      button(null, del, { cls: 'rm-key soft', ic: 'del', aria: T('del'), k: 'key-del', disabled }),
      key(0),
      button(null, submit, { cls: 'rm-key primary', ic: 'check', aria: T('check'), k: 'key-ok', disabled })));
}

function toolsEl() {
  const st = play.status;
  return [
    button(T('help'), startGuided, { ic: 'help', k: 't-help', disabled: st !== 'ask', cls: 'tool' }),
    button(play.showBlocks ? T('hideBlocks') : T('blocks'), toggleBlocks, { ic: 'blocks', k: 't-blocks', disabled: st === 'guided', cls: 'tool' }),
    button(play.drawing ? T('drawDone') : T('draw'), toggleDraw, { ic: 'pencil', k: 't-draw', cls: `tool ${play.drawing ? 'on' : ''}`, pressed: play.drawing }),
    button(T('read'), readProblem, { ic: 'read', k: 't-read', cls: 'tool' }),
    button(T('takeBreak'), () => go('break'), { ic: 'rest', k: 't-break', cls: 'tool' }),
  ];
}

function readProblem() {
  const c = data.active.current, p = play.p;
  const parts = [];
  if (c.story != null) parts.push(storyText(L(), p, c.story));
  parts.push(T('whatIs', { a: p.a, b: p.b, opw: p.op === '+' ? W().plusWord : W().minusWord }));
  readAloud(parts.join(' '));
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
function press(d) {
  if (play.status === 'solved') return;
  const st = curStep();
  if (play.status === 'guided' && (!st || (st.kind !== 'ask' && st.kind !== 'write'))) return;
  if (play.status === 'guided' && st.kind === 'write') {
    play.cells[st.cell] = d;
    play.activeCell = st.cell;
    play.entryStale = false;
    sfx.tap();
    update();
    return;
  }
  if (usingCells()) {
    if (play.entryStale) clearCells();
    play.cells[play.activeCell] = d;
    // like on paper: ones first, then move over to the tens box
    if (play.activeCell === 'ones' && play.cells.tens === '') play.activeCell = 'tens';
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
  if (usingCells()) {
    if (play.entryStale) { clearCells(); update(); return; }
    const a = play.activeCell;
    if (play.cells[a] !== '') play.cells[a] = '';
    else { const o = a === 'ones' ? 'tens' : 'ones'; play.cells[o] = ''; play.activeCell = o; }
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
  clearCells();
  setBubble(() => ({ mood: 'happy', text: T('prompt', { pick: data.active.current.prompt }) }));
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

function startGuided(lead) {
  if (!play || play.status === 'solved' || play.status === 'guided') return;
  const c = data.active.current;
  c.helped = true;
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
  enterStep();
}

function stepBubble() {
  const g = play.guided;
  const st = curStep();
  // paper-method texts talk about the written digits, so they keep plain numbers
  const params = st.key.startsWith('w_') ? { ...st.params } : words(st.params);
  if (st.key === 'w_split') params.ow = W().ones(st.params.o);
  let lead = g.lead;
  let text = T(st.key, params);
  if ((st.kind === 'ask' || st.kind === 'write') && g.wrongs > 0) {
    if (g.wrongs === 1) lead = T('g_count');
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
  play.guided.startTrades = play.model.trades;
  play.guided.wrongs = 0;
  play.guided.synced = false;
  play.focusCol = st.focus || null;
  if (st.kind === 'write') { play.activeCell = st.cell; play.cells[st.cell] = ''; }
  setBubble(stepBubble);
  if (data.settings.autoRead) speak([play.bubble.lead, play.bubble.text].filter(Boolean).join(' '), L());
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
    sfx.pop();
    advanceStep();
    return;
  }
  g.wrongs++;
  sfx.soft();
  if (g.wrongs === 1) { syncStep(st); play.counting = true; play.countedEver = true; }
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
    const independent = !c.helped && c.wrongs === 0;
    c.independent = independent;
    const key = `${s.id}:${s.index}`;
    if (!data.rewards.awarded.includes(key)) {
      data.rewards.pieces++;
      data.rewards.awarded = [...data.rewards.awarded, key].slice(-80);
      play.bump = true;
    }
    s.results.push({ skill: p.skill, key: p.key, independent });
    const note = recordResult(data, p.skill, independent);
    if (c.helped) { s.repeatSkill = p.skill; s.note = 'similar'; }
    if (note.eased) {
      s.note = 'support';
      s.ease = true;
      if (BASE_SKILL[p.skill] && data.progress.skills[p.skill].level === 1) s.repeatSkill = BASE_SKILL[p.skill];
    }
    if (note.levelUp && !c.helped) s.note = 'harder';
    if (note.unlocked && (s.mode === 'mix' || (s.mode === 'add' && note.unlocked === 'C') || (s.mode === 'sub' && note.unlocked === 'D'))) {
      s.repeatSkill = note.unlocked;
      s.note = null;
    }
    save(data);
  }
  const independent = c.independent;
  const pickN = rand(4);
  const praiseKey = play.tradedEver ? (p.op === '+' ? 'p_tradedAdd' : 'p_tradedSub')
    : play.countedEver ? 'p_counted'
      : c.wrongs > 0 && !c.helped ? 'p_fixed'
        : p.regroup ? 'p_onesCareful'
          : play.movedBlocks ? 'p_blocks' : null;
  setBubble(() => solvedBubble({ wasGuided, independent, pickN, praiseKey }));
  sfx.correct();
  setTimeout(() => sfx.reward(), 450);
  update();
  play.bump = false;
  burst();
}

function solvedBubble(info) {
  const p = play.p;
  const last = data.active.index + 1 >= data.active.length;
  const nextBtn = { label: last ? T('finish') : T('next'), onClick: goNext, primary: true, ic: 'next', k: 'b-next' };
  if (!info) return { mood: 'cheer', text: `${p.a} ${opSym(p.op)} ${p.b} = ${p.answer}`, buttons: [nextBtn] };
  const eq = `${p.a} ${opSym(p.op)} ${p.b} = ${p.answer}.`;
  if (info.wasGuided) {
    return { mood: 'cheer', lead: T('g_done', { n: p.answer }), text: `${T('rightTeam')} ${info.praiseKey ? T(info.praiseKey) : ''}`.trim(), buttons: [nextBtn] };
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
  if (s.index >= s.length) finishSession();
  else { newProblem(); go('play'); }
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
window.addEventListener('resize', () => { if (screen === 'play' && play) setupInk(); });

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

function onTray() {
  const mode = blockMode();
  if (mode === 'explore') act((m) => { if (!M.canBringOnes(m) && !M.canBringTens(m)) return false; M.bringOnes(m); M.bringTens(m); return true; });
  else if (mode === 'bringOnes' || mode === 'bringTens') act((m) => M.applyAction(m, mode));
  else guidedWait();
}

function onPiece(x) {
  const m = play.model;
  const mode = blockMode();
  if (m.op === '+') { sfx.tap(); return; }
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
  }, play.counting && n != null ? h('span', { class: 'rm-pc-n' }, String(isOne ? n : n * 10)) : null);
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
  const nFrames = Math.max(1, Math.ceil(ones.length / 10));
  for (let f = 0; f < nFrames; f++) {
    const chunk = ones.slice(f * 10, f * 10 + 10);
    const full = chunk.length === 10 && chunk.every((x) => x.state === 'in');
    const slots = chunk.map((x) => pieceEl(x, x.state === 'in' ? ++on : null));
    for (let i = chunk.length; i < 10; i++) slots.push(h('span', { class: 'rm-slot', 'aria-hidden': 'true' }));
    const fr = h('div', { class: `rm-frame ${full && m.op === '+' ? 'full' : ''}` }, slots);
    if (full && m.op === '+' && f === 0) enableDrag(fr, 'frame');
    frames.push(fr);
  }

  const tW = W().tens(c.tensIn), oW = W().ones(c.onesIn);
  const trayFull = c.tensTray + c.onesTray === tensOf(p.b) + onesOf(p.b) && m.op === '+';
  const nothingTaken = c.tensGone + c.onesGone === 0;
  const showTotal = play.status === 'solved' || (m.op === '-' ? nothingTaken : trayFull && m.trades === 0);
  let line = showTotal ? T('matIsN', { t: tW, o: oW, n: M.value(m) }) : T('matIs', { t: tW, o: oW });
  if (m.op === '-' && m.trades > 0 && nothingTaken) line += ` ${T('stillN', { n: p.a })}`;

  let hint = null;
  if (!guided && play.status !== 'solved') {
    if (m.op === '+') {
      if (c.onesIn >= 10) hint = T('tooManyOnes');
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
    tray = h('button', { type: 'button', class: 'rm-tray', 'data-k': 'tray', 'aria-label': T('trayLabel', { b: what }), onclick: tapGuard(onTray) },
      h('span', { class: 'rm-tray-sum' }, `+ ${M.counts(m).tensTray * 10 + M.counts(m).onesTray}`),
      h('span', { class: 'rm-tray-p' }, tp.map((x) => h('span', { class: `rm-mini ${x.kind === 'one' ? 'one' : 'rod'} src-b` }))),
      h('span', { class: 'rm-tray-l' }, T('trayTip')));
    enableDrag(tray, 'tray');
  }

  const explore = [];
  explore.push(button(play.counting ? T('countOff') : T('countOn'), () => { play.counting = !play.counting; if (play.counting) play.countedEver = true; sfx.tap(); update(); }, { cls: 'small soft', ic: 'count', k: 'count', pressed: play.counting }));
  if (!guided && play.status !== 'solved') {
    explore.push(button(T('matStart'), () => { play.model = M.makeModel(p); sfx.tap(); update(); }, { cls: 'small soft', ic: 'reset', k: 'mat-reset' }));
    if (m.op === '+') {
      explore.push(button(T('addOnes'), () => act((mm) => M.applyAction(mm, 'bringOnes')), { cls: 'small', k: 'x-ones', disabled: !M.canBringOnes(m) }));
      explore.push(button(T('addTens'), () => act((mm) => M.applyAction(mm, 'bringTens')), { cls: 'small', k: 'x-tens', disabled: !M.canBringTens(m) }));
      explore.push(button(T('tradeUp'), () => act(M.tradeUp), { cls: `small ${M.canTradeUp(m) ? 'gold' : ''}`, k: 'x-tradeup', disabled: !M.canTradeUp(m) }));
    } else {
      explore.push(button(T('tradeDown'), () => act(M.tradeDown), { cls: `small ${M.canTradeDown(m) ? 'gold' : ''}`, k: 'x-tradedown', disabled: !M.canTradeDown(m) }));
    }
  }
  explore.push(...explore.splice(0, !guided && play.status !== 'solved' ? 2 : 1)); // block actions first, then count / start over

  return h('div', { class: 'rm-card rm-blocks' },
    h('div', { class: 'rm-mat' },
      h('div', { class: `rm-col tens ${fc === 'tens' ? 'focus' : ''}`, 'data-drop': 'tens' },
        h('div', { class: 'rm-col-h' }, h('span', null, T('tensCol')), h('b', { class: 'rm-col-n' }, String(c.tensIn))),
        h('div', { class: 'rm-col-b' }, tens)),
      h('div', { class: `rm-col ones ${fc === 'ones' ? 'focus' : ''}`, 'data-drop': 'ones' },
        h('div', { class: 'rm-col-h' }, h('span', null, T('onesCol')), h('b', { class: 'rm-col-n' }, String(c.onesIn))),
        h('div', { class: 'rm-col-b' }, frames))),
    tray,
    h('p', { class: 'rm-mat-line', 'aria-live': 'polite' }, line),
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
      h('span', { class: 'rm-chip' }, h('span', { html: pieceSVG(2) }), T('celPieces', { n: c.earned }))),
    c.friend
      ? h('div', { class: 'rm-friend-card new' },
        h('div', { class: 'rm-friend-art', html: friendSVG(c.friend) }),
        h('div', null, h('p', { class: 'rm-text' }, T('celFriend')), h('p', { class: 'rm-friend-name' }, CREATURE_NAMES[c.friend][L()])))
      : h('p', { class: 'rm-text' }, T('celAllFriends')),
    h('div', { class: 'rm-actions' },
      button(null, () => readAloud([T('celTitle'), T('celSolved', { n: c.earned }), c.friend ? `${T('celFriend')} ${CREATURE_NAMES[c.friend][L()]}` : ''].join(' ')), { cls: 'icon soft', ic: 'read', aria: T('read'), k: 'read' }),
      button(T('oneMore'), () => startSession(data.settings.practice === 'choose' ? c.mode : data.settings.practice), { cls: 'primary big', ic: 'next', k: 'more' }),
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
      ? h('div', { class: 'rm-friends' }, r.friends.map((f) => h('div', { class: 'rm-friend-card' },
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

function viewParent() {
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
      h('h2', { class: 'rm-h2' }, T('p_title')),
      button(T('p_close'), () => go(parentReturn === 'parent' ? 'welcome' : parentReturn), { cls: 'soft small', ic: 'close', k: 'p-close' })),
    h('section', { class: 'rm-card rm-p-sec' },
      seg(T('p_practice'), st.practice, [['choose', T('p_choose')], ['add', T('p_add')], ['sub', T('p_sub')], ['mix', T('p_mix')]], (v) => { st.practice = v; }),
      seg(T('p_regroup'), st.regroup, [['off', T('p_reg_off')], ['auto', T('p_reg_auto')], ['now', T('p_reg_now')]], (v) => { st.regroup = v; }),
      h('p', { class: 'rm-small' }, T('p_regNote')),
      seg(T('p_length'), st.sessionLength, [[3, '3'], [5, '5'], [8, '8'], [10, '10']], (v) => { st.sessionLength = v; }),
      seg(T('p_lang'), st.lang, [['en', 'English'], ['es', 'Español']], (v) => { st.lang = v; }),
      seg(T('p_sound'), st.sound, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.sound = v; setSound(v); }),
      seg(T('p_autoRead'), st.autoRead, [[true, T('p_on')], [false, T('p_off')]], (v) => { st.autoRead = v; }),
      voiceField(),
      seg(T('p_motion'), st.motion, [['auto', T('p_motionAuto')], ['reduce', T('p_motionReduce')]], (v) => { st.motion = v; })),
    h('section', { class: 'rm-card rm-p-sec' },
      h('h3', { class: 'rm-h3' }, T('p_progress')),
      h('div', { class: 'rm-table-wrap' },
        h('table', { class: 'rm-table' },
          h('thead', null, h('tr', null, [T('p_skill'), T('p_level'), T('p_own'), T('p_withHelp'), T('p_status')].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', null, ['A', 'B', 'C', 'D'].map((k) => h('tr', null,
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
      h('p', { class: 'rm-small' }, T('p_saveNote')),
      !storageOK ? h('p', { class: 'rm-small warn' }, T('p_noStorage')) : null,
      h('p', { class: 'rm-small' }, T('p_speechNote'), canSpeak() ? '' : ' ✖'),
      h('p', { class: 'rm-small' }, T('p_unlistedNote')),
      parentMsg ? h('p', { class: 'rm-small ok', role: 'status' }, parentMsg) : null,
      parentConfirm
        ? h('div', { class: 'rm-confirm', role: 'alertdialog', 'aria-label': T('p_reset') },
          h('p', { class: 'rm-text' }, T('p_resetSure')),
          h('div', { class: 'rm-actions' },
            button(T('p_resetYes'), resetProgress, { cls: 'danger', k: 'reset-yes' }),
            button(T('p_resetNo'), () => { parentConfirm = false; update(); }, { cls: 'soft', k: 'reset-no' })))
        : button(T('p_reset'), () => { parentConfirm = true; update(); }, { cls: 'soft', ic: 'reset', k: 'reset' })));
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
document.addEventListener('pointerdown', () => unlockAudio(), { once: true });
if (data.active && data.active.current && isValidProblem(data.active.current.p)) initPlay();
render();
