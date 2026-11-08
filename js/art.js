// Original artwork, drawn as inline SVG: Lumi the rainbow dragon, the island
// friends, the island itself and the interface icons.

const INK = '#2b2140';
export const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#748ffc', '#da77f2'];

// ---------------------------------------------------------------- Lumi
export function lumiSVG(mood = 'happy') {
  const eyesOpen = mood !== 'calm';
  const look = mood === 'think' ? -2.5 : 0;
  const eyes = eyesOpen
    ? `<ellipse cx="48" cy="${46 + look}" rx="6" ry="7.5" fill="${INK}"/><ellipse cx="72" cy="${46 + look}" rx="6" ry="7.5" fill="${INK}"/>
       <circle cx="50.5" cy="${43 + look}" r="2.3" fill="#fff"/><circle cx="74.5" cy="${43 + look}" r="2.3" fill="#fff"/>`
    : `<path d="M42 47 Q48 52 54 47" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
       <path d="M66 47 Q72 52 78 47" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const mouth = {
    happy: `<path d="M53 62 Q60 69 67 62" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    cheer: `<path d="M51 60 Q60 75 69 60 Z" fill="${INK}"/><path d="M55 66 Q60 71 65 66 Q60 64 55 66Z" fill="#ff8fab"/>`,
    think: `<ellipse cx="62" cy="64" rx="3" ry="3.6" fill="${INK}"/>`,
    calm: `<path d="M55 63 Q60 66 65 63" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  }[mood] || '';
  const arms = mood === 'cheer'
    ? `<ellipse cx="30" cy="70" rx="6" ry="11" transform="rotate(35 30 70)" fill="#a58cff"/><ellipse cx="90" cy="70" rx="6" ry="11" transform="rotate(-35 90 70)" fill="#a58cff"/>`
    : `<ellipse cx="34" cy="86" rx="6" ry="10" transform="rotate(20 34 86)" fill="#a58cff"/><ellipse cx="86" cy="86" rx="6" ry="10" transform="rotate(-20 86 86)" fill="#a58cff"/>`;
  const sparkles = mood === 'cheer'
    ? `<path d="M14 26 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#ffd43b"/><path d="M104 20 l1.6 4.6 4.6 1.6 -4.6 1.6 -1.6 4.6 -1.6 -4.6 -4.6 -1.6 4.6 -1.6z" fill="#da77f2"/>`
    : '';
  return `<svg viewBox="0 0 120 120" class="rm-lumi-svg" aria-hidden="true" focusable="false">
    ${sparkles}
    <path d="M86 96 C106 100 116 84 109 70 C104 81 97 85 86 85 Z" fill="#9f86ff"/>
    <circle cx="109" cy="69" r="5" fill="#ff8fc7"/>
    <path d="M34 70 C14 52 2 60 6 78 C14 72 22 74 28 82 Z" fill="#ffd36e" stroke="#e9ac2c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M86 70 C106 52 118 60 114 78 C106 72 98 74 92 82 Z" fill="#8be3d6" stroke="#3fb8a6" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="46" cy="109" rx="10" ry="6" fill="#9f86ff"/><ellipse cx="74" cy="109" rx="10" ry="6" fill="#9f86ff"/>
    <ellipse cx="60" cy="86" rx="30" ry="25" fill="#b6a1ff"/>
    <ellipse cx="60" cy="91" rx="18" ry="15" fill="#fff1d0"/>
    ${arms}
    <circle cx="35" cy="31" r="7" fill="${RAINBOW[0]}"/><circle cx="45" cy="23" r="7" fill="${RAINBOW[1]}"/>
    <circle cx="57" cy="19.5" r="7" fill="${RAINBOW[2]}"/><circle cx="69" cy="20.5" r="7" fill="${RAINBOW[3]}"/>
    <circle cx="80" cy="26" r="7" fill="${RAINBOW[4]}"/><circle cx="88" cy="35" r="6" fill="${RAINBOW[5]}"/>
    <circle cx="60" cy="50" r="30" fill="#b6a1ff"/>
    <ellipse cx="60" cy="61" rx="14" ry="9" fill="#cbbcff"/>
    <circle cx="56" cy="58" r="1.3" fill="${INK}"/><circle cx="64" cy="58" r="1.3" fill="${INK}"/>
    <circle cx="37" cy="58" r="5" fill="#ff9fc3" opacity=".8"/><circle cx="83" cy="58" r="5" fill="#ff9fc3" opacity=".8"/>
    ${eyes}
    ${mouth}
  </svg>`;
}

// ---------------------------------------------------------------- friends
function face(x, y, s = 1, color = INK) {
  const e = 4.2 * s, d = 9 * s;
  return `<ellipse cx="${x - d}" cy="${y}" rx="${e * 0.85}" ry="${e}" fill="${color}"/><ellipse cx="${x + d}" cy="${y}" rx="${e * 0.85}" ry="${e}" fill="${color}"/>
    <circle cx="${x - d + 1.3 * s}" cy="${y - 1.6 * s}" r="${1.5 * s}" fill="#fff"/><circle cx="${x + d + 1.3 * s}" cy="${y - 1.6 * s}" r="${1.5 * s}" fill="#fff"/>
    <circle cx="${x - d - 4 * s}" cy="${y + 7 * s}" r="${3.4 * s}" fill="#ff8fab" opacity=".7"/><circle cx="${x + d + 4 * s}" cy="${y + 7 * s}" r="${3.4 * s}" fill="#ff8fab" opacity=".7"/>
    <path d="M${x - 4 * s} ${y + 7 * s} Q${x} ${y + 11 * s} ${x + 4 * s} ${y + 7 * s}" stroke="${color}" stroke-width="${2 * s}" fill="none" stroke-linecap="round"/>`;
}

const FRIEND = {
  fox: () => `
    <path d="M70 78 C96 80 98 52 86 46 C90 62 82 70 68 70Z" fill="#ff9a4d"/><path d="M86 46 C92 50 93 56 91 60 C88 56 86 52 86 46Z" fill="#fff"/>
    <ellipse cx="50" cy="78" rx="21" ry="16" fill="#ff9a4d"/>
    <path d="M27 40 L33 12 L48 32Z" fill="#ff9a4d"/><path d="M73 40 L67 12 L52 32Z" fill="#ff9a4d"/>
    <path d="M31 34 L34 19 L42 31Z" fill="#ffd0b0"/><path d="M69 34 L66 19 L58 31Z" fill="#ffd0b0"/>
    <circle cx="50" cy="48" r="25" fill="#ff9a4d"/>
    <ellipse cx="50" cy="60" rx="15" ry="10" fill="#fff4ea"/>
    <path d="M50 26 l2.4 5 5.4.6 -4 3.7 1.1 5.3 -4.9-2.7 -4.9 2.7 1.1-5.3 -4-3.7 5.4-.6z" fill="#ffd43b"/>
    ${face(50, 49)}<circle cx="50" cy="56" r="2.4" fill="${INK}"/>`,
  bunny: () => `
    <ellipse cx="38" cy="24" rx="8" ry="20" transform="rotate(-10 38 24)" fill="#f1e6ff" stroke="#c9b3f5" stroke-width="2"/>
    <ellipse cx="62" cy="24" rx="8" ry="20" transform="rotate(10 62 24)" fill="#f1e6ff" stroke="#c9b3f5" stroke-width="2"/>
    <ellipse cx="38" cy="25" rx="3.6" ry="13" transform="rotate(-10 38 25)" fill="#ffc9de"/><ellipse cx="62" cy="25" rx="3.6" ry="13" transform="rotate(10 62 25)" fill="#ffc9de"/>
    <ellipse cx="50" cy="80" rx="20" ry="15" fill="#f1e6ff" stroke="#c9b3f5" stroke-width="2"/>
    <circle cx="50" cy="54" r="23" fill="#f1e6ff" stroke="#c9b3f5" stroke-width="2"/>
    <path d="M70 34 a7 7 0 1 0 6 10 a5.5 5.5 0 1 1 -6 -10z" fill="#ffd43b"/>
    ${face(50, 54)}`,
  turtle: () => `
    <ellipse cx="30" cy="80" rx="8" ry="6" fill="#8ad98a"/><ellipse cx="66" cy="80" rx="8" ry="6" fill="#8ad98a"/>
    <circle cx="78" cy="54" r="15" fill="#a9e7a4"/>
    <path d="M14 74 C14 40 72 36 74 74 Z" fill="#37b679"/>
    <path d="M14 74 L74 74" stroke="#2b8a5e" stroke-width="4" stroke-linecap="round"/>
    <circle cx="34" cy="60" r="7" fill="#63d39b"/><circle cx="52" cy="58" r="7" fill="#63d39b"/><circle cx="43" cy="47" r="6" fill="#63d39b"/>
    <circle cx="96" cy="30" r="5" fill="none" stroke="#74c0fc" stroke-width="2"/><circle cx="88" cy="20" r="3" fill="none" stroke="#74c0fc" stroke-width="2"/>
    ${face(80, 53, 0.62)}`,
  bird: () => `
    <path d="M44 28 C40 16 48 12 50 22 C52 12 60 16 56 28Z" fill="#748ffc"/>
    <circle cx="50" cy="56" r="27" fill="#4dabf7"/>
    <ellipse cx="50" cy="66" rx="16" ry="14" fill="#d0ebff"/>
    <path d="M22 58 C10 64 14 78 28 72Z" fill="#339af0"/><path d="M78 58 C90 64 86 78 72 72Z" fill="#339af0"/>
    <path d="M45 58 L55 58 L50 66Z" fill="#ffa94d"/>
    ${face(50, 48, 1)}
    <path d="M84 20 v14 a4 4 0 1 1 -2 -3.5 v-8 l8 -2 v9 a4 4 0 1 1 -2 -3.5 v-8z" fill="#7048e8"/>`,
  jelly: () => `
    <path d="M30 60 q-4 10 2 18 q6 8 0 16" stroke="#f783ac" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M44 62 q-4 10 2 18 q6 8 0 16" stroke="#da77f2" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M58 62 q4 10 -2 18 q-6 8 0 16" stroke="#f783ac" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M72 60 q4 10 -2 18 q-6 8 0 16" stroke="#da77f2" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M20 62 C20 20 80 20 80 62 Q72 68 64 62 Q57 68 50 62 Q43 68 36 62 Q28 68 20 62Z" fill="#fcc2d7"/>
    <ellipse cx="38" cy="36" rx="7" ry="4" fill="#fff" opacity=".7"/>
    <circle cx="86" cy="26" r="2.5" fill="#ffd43b"/><circle cx="14" cy="36" r="2" fill="#ffd43b"/>
    ${face(50, 48)}`,
  crab: () => `
    <path d="M22 70 l-10 12 M30 74 l-8 14 M78 70 l10 12 M70 74 l8 14" stroke="#e03131" stroke-width="4" stroke-linecap="round"/>
    <path d="M26 56 L18 46 M74 56 L82 46" stroke="#ff6b6b" stroke-width="6" stroke-linecap="round"/>
    <path d="M10 42 a10 10 0 1 1 16 -6 l-8 2 z" fill="#ff6b6b"/><path d="M90 42 a10 10 0 1 0 -16 -6 l8 2 z" fill="#ff6b6b"/>
    <ellipse cx="50" cy="64" rx="30" ry="20" fill="#ff6b6b"/>
    <path d="M40 46 v-12 M60 46 v-12" stroke="#ff6b6b" stroke-width="4"/>
    <circle cx="40" cy="32" r="7" fill="#fff"/><circle cx="60" cy="32" r="7" fill="#fff"/>
    <circle cx="41" cy="33" r="3.6" fill="${INK}"/><circle cx="61" cy="33" r="3.6" fill="${INK}"/>
    <circle cx="34" cy="68" r="4" fill="#ff8fab" opacity=".8"/><circle cx="66" cy="68" r="4" fill="#ff8fab" opacity=".8"/>
    <path d="M44 66 Q50 72 56 66" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  dragon: () => `
    <path d="M28 62 C6 50 6 30 22 36 C20 46 28 52 34 56Z" fill="#b2f2bb" stroke="#51cf66" stroke-width="2"/>
    <path d="M72 62 C94 50 94 30 78 36 C80 46 72 52 66 56Z" fill="#b2f2bb" stroke="#51cf66" stroke-width="2"/>
    <ellipse cx="50" cy="78" rx="21" ry="16" fill="#69db7c"/><ellipse cx="50" cy="82" rx="12" ry="10" fill="#ebfbee"/>
    <path d="M36 32 l-4 -12 l10 8z M64 32 l4 -12 l-10 8z" fill="#ffd43b"/>
    <circle cx="50" cy="50" r="24" fill="#69db7c"/>
    <path d="M50 24 C44 18 46 10 50 8 C54 10 56 18 50 24Z" fill="#37b24d"/>
    ${face(50, 50)}`,
  pup: () => `
    <ellipse cx="50" cy="80" rx="21" ry="15" fill="#f2c879"/>
    <circle cx="50" cy="52" r="24" fill="#f2c879"/>
    <ellipse cx="25" cy="50" rx="9" ry="17" transform="rotate(15 25 50)" fill="#b07d3a"/>
    <ellipse cx="75" cy="50" rx="9" ry="17" transform="rotate(-15 75 50)" fill="#b07d3a"/>
    <ellipse cx="50" cy="62" rx="12" ry="8" fill="#fff4e0"/>
    <ellipse cx="50" cy="58" rx="4" ry="3" fill="${INK}"/>
    <circle cx="62" cy="40" r="7" fill="#fff4e0" opacity=".7"/>
    ${face(50, 49)}
    <path d="M40 74 h20" stroke="#4dabf7" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="79" r="3.5" fill="#ffd43b"/>`,
  owl: () => `
    <path d="M26 30 L30 14 L42 26Z M74 30 L70 14 L58 26Z" fill="#7950f2"/>
    <ellipse cx="50" cy="58" rx="28" ry="32" fill="#9775fa"/>
    <ellipse cx="50" cy="70" rx="17" ry="17" fill="#e5dbff"/>
    <path d="M42 66 q4 4 8 0 q4 4 8 0 M42 74 q4 4 8 0 q4 4 8 0" stroke="#b197fc" stroke-width="2" fill="none"/>
    <circle cx="38" cy="44" r="11" fill="#fff"/><circle cx="62" cy="44" r="11" fill="#fff"/>
    <circle cx="39" cy="45" r="5.5" fill="${INK}"/><circle cx="63" cy="45" r="5.5" fill="${INK}"/>
    <circle cx="41" cy="43" r="1.8" fill="#fff"/><circle cx="65" cy="43" r="1.8" fill="#fff"/>
    <path d="M46 52 L54 52 L50 59Z" fill="#ffa94d"/>
    <path d="M86 18 a7 7 0 1 0 6 10 a5.5 5.5 0 1 1 -6 -10z" fill="#ffd43b"/>`,
  penguin: () => `
    <ellipse cx="40" cy="92" rx="8" ry="4" fill="#ffa94d"/><ellipse cx="60" cy="92" rx="8" ry="4" fill="#ffa94d"/>
    <ellipse cx="50" cy="58" rx="28" ry="34" fill="#364fc7"/>
    <ellipse cx="50" cy="64" rx="19" ry="26" fill="#fff"/>
    <path d="M22 56 C14 66 16 76 24 76Z M78 56 C86 66 84 76 76 76Z" fill="#364fc7"/>
    <path d="M45 54 L55 54 L50 61Z" fill="#ffa94d"/>
    <path d="M42 70 L50 74 L42 78Z M58 70 L50 74 L58 78Z" fill="#f06595"/><circle cx="50" cy="74" r="2.4" fill="#d6336c"/>
    ${face(50, 46)}`,
  pony: () => `
    <ellipse cx="54" cy="80" rx="22" ry="14" fill="#ffd6e7"/>
    <path d="M34 26 C20 30 16 50 24 64 C28 54 30 44 38 38Z" fill="#f06595"/>
    <path d="M36 22 L40 8 L48 22Z" fill="#ffd6e7"/>
    <ellipse cx="54" cy="50" rx="22" ry="24" fill="#ffd6e7"/>
    <ellipse cx="60" cy="64" rx="15" ry="10" fill="#ffb3cf"/>
    <circle cx="55" cy="64" r="1.6" fill="${INK}"/><circle cx="65" cy="64" r="1.6" fill="${INK}"/>
    <path d="M38 22 C46 14 58 16 62 24 C54 22 46 24 40 30Z" fill="#da77f2"/>
    <circle cx="72" cy="30" r="5" fill="#ffd43b"/><circle cx="72" cy="30" r="2" fill="#ff922b"/>
    ${face(54, 46, 0.9)}`,
  lion: () => `
    <ellipse cx="50" cy="82" rx="20" ry="14" fill="#ffd43b"/>
    ${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => {
      const r = (d * Math.PI) / 180;
      return `<circle cx="${(50 + 26 * Math.cos(r)).toFixed(1)}" cy="${(50 + 26 * Math.sin(r)).toFixed(1)}" r="11" fill="#f59f00"/>`;
    }).join('')}
    <circle cx="50" cy="50" r="25" fill="#ffd43b"/>
    <circle cx="33" cy="30" r="6" fill="#ffe066"/><circle cx="67" cy="30" r="6" fill="#ffe066"/>
    <ellipse cx="50" cy="60" rx="11" ry="7" fill="#fff3bf"/>
    <path d="M47 57 h6 l-3 3z" fill="#e8590c"/>
    ${face(50, 48)}`,
};

export function friendSVG(type, cls = 'rm-friend-svg') {
  const draw = FRIEND[type] || FRIEND.fox;
  return `<svg viewBox="0 0 100 100" class="${cls}" aria-hidden="true" focusable="false">${draw()}</svg>`;
}

// ---------------------------------------------------------------- island
const SLOTS = [
  [118, 176], [158, 184], [198, 178], [238, 186], [278, 178], [138, 206],
  [178, 210], [218, 206], [258, 210], [298, 204], [100, 206], [326, 196],
];

export function islandSVG({ pieces = 0, friends = [], rainbows = 0, star = false } = {}) {
  const lit = rainbows > 0 ? 7 : pieces % 7;
  const arcs = RAINBOW.map((c, i) => {
    const r = 160 - i * 9;
    const on = i < lit;
    return `<path d="M${200 - r} 196 A${r} ${r} 0 0 1 ${200 + r} 196" fill="none" stroke="${on ? c : '#e9e4f5'}" stroke-width="9" ${on ? '' : 'stroke-dasharray="3 6" stroke-linecap="round"'}/>`;
  }).join('');
  const deco = [];
  if (rainbows >= 1) deco.push(...[[80, 196], [150, 196], [246, 194], [312, 214]].map(([x, y], i) =>
    `<g transform="translate(${x} ${y})"><path d="M0 0 v-8" stroke="#2f9e44" stroke-width="2"/><circle cx="0" cy="-10" r="4.5" fill="${RAINBOW[(i * 2) % 7]}"/><circle cx="0" cy="-10" r="1.8" fill="#fff3bf"/></g>`));
  if (rainbows >= 2) deco.push(`<path d="M318 112 v-18" stroke="${INK}" stroke-width="2"/><path d="M318 94 l14 5 -14 5z" fill="#f06595"/>`);
  if (rainbows >= 3) deco.push(`<path d="M74 150 Q120 168 166 150" stroke="#868e96" stroke-width="1.5" fill="none"/>${[90, 110, 130, 150].map((x, i) => `<circle cx="${x}" cy="${155 + (i % 2 ? 4 : 0)}" r="4" fill="${RAINBOW[i + 1]}"/>`).join('')}`);
  if (rainbows >= 4) deco.push(`<g transform="translate(40 236)"><path d="M0 0 h34 l-6 8 h-22z" fill="#e8590c"/><path d="M16 0 v-20" stroke="${INK}" stroke-width="2"/><path d="M17 -20 l12 16 h-12z" fill="#fff"/></g>`);
  if (rainbows >= 5) deco.push(...[[200, 150], [176, 158], [224, 158]].map(([x, y]) => `<path d="M${x} ${y - 6} l1.8 4 4.4.6 -3.2 3 .8 4.4 -3.8-2.1 -3.8 2.1 .8-4.4 -3.2-3 4.4-.6z" fill="#ffd43b"/>`));
  if (rainbows >= 6) deco.push(`<g transform="translate(350 236)"><path d="M-12 0 h24 l-4 -10 h-16z" fill="#a5d8ff"/><path d="M0 -10 Q-8 -26 -14 -14 M0 -10 Q8 -26 14 -14" stroke="#4dabf7" stroke-width="2.5" fill="none"/></g>`);
  if (star) deco.push(`<path d="M200 28 l5 10.5 11.5 1.6 -8.3 8 2 11.4 -10.2-5.4 -10.2 5.4 2-11.4 -8.3-8 11.5-1.6z" fill="#fcc419" stroke="#f08c00" stroke-width="1.5"/>`);

  const fr = friends.slice(0, SLOTS.length).map((type, i) => {
    const [x, y] = SLOTS[i];
    return `<g transform="translate(${x - 19} ${y - 36}) scale(.38)">${FRIEND[type] ? FRIEND[type]() : ''}</g>`;
  }).join('');

  return `<svg viewBox="0 0 400 260" class="rm-island-svg" role="img" aria-hidden="true" focusable="false">
    <rect x="0" y="0" width="400" height="260" fill="#e7f5ff"/>
    <circle cx="352" cy="42" r="22" fill="#ffe066"/>
    <g fill="#fff"><ellipse cx="70" cy="50" rx="26" ry="10"/><ellipse cx="88" cy="44" rx="16" ry="10"/><ellipse cx="290" cy="70" rx="22" ry="8"/></g>
    ${arcs}
    <rect x="0" y="190" width="400" height="70" fill="#74c0fc"/>
    <path d="M0 200 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#a5d8ff" stroke-width="3" fill="none"/>
    <ellipse cx="208" cy="208" rx="172" ry="36" fill="#ffe8a3"/>
    <ellipse cx="208" cy="198" rx="146" ry="26" fill="#8ce99a"/>
    <path d="M62 200 C64 170 70 150 78 132" stroke="#a0522d" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M78 132 C60 120 44 126 38 136 C52 130 64 132 78 132 C70 112 76 102 86 98 C84 112 82 122 78 132 C96 118 110 124 114 134 C102 128 90 128 78 132Z" fill="#40c057"/>
    <rect x="300" y="128" width="36" height="56" rx="3" fill="#fcc2d7"/>
    <rect x="292" y="146" width="10" height="38" fill="#faa2c1"/><rect x="334" y="146" width="10" height="38" fill="#faa2c1"/>
    <path d="M296 130 L318 104 L340 130Z" fill="#9775fa"/>
    <path d="M311 184 v-16 a7 7 0 0 1 14 0 v16z" fill="#7048e8"/>
    <circle cx="318" cy="146" r="5" fill="#fff3bf"/>
    ${deco.join('')}
    ${fr}
  </svg>`;
}

// ---------------------------------------------------------------- icons
const P = {
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  soundOn: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  soundOff: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  read: '<path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  help: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.5 9.5a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.1.9-1.1 1.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.2"/>',
  blocks: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="11" y="13" width="4" height="4" rx=".8"/><rect x="16.5" y="13" width="4" height="4" rx=".8"/><rect x="11" y="18" width="4" height="3" rx=".8"/>',
  rest: '<path d="M6 17a4 4 0 0 1 .5-8 5.5 5.5 0 0 1 10.6 1.4A3.5 3.5 0 0 1 17 17z"/>',
  back: '<path d="M14.5 5 7.5 12l7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  next: '<path d="M9.5 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  del: '<path d="M9 5h11v14H9l-6-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5l5 5M17 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  island: '<path d="M3 19c3-2 15-2 18 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11 18c0-4 .5-7 2-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13 8c-3-2-6-1-7 1 2-1 5-1 7-1 0-3 2-4 4-5-1 2-2 3-4 5 3-1 5 0 6 2-2-1-4-1-6-2z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  reset: '<path d="M5 12a7 7 0 1 0 2-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  count: '<text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="700" font-family="sans-serif">123</text>',
  pencil: '<path d="M4 20l1.2-4.6L15.5 5.1a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 7l3.5 3.5" stroke="currentColor" stroke-width="2"/>',
  undo: '<path d="M8 8H4V4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 8.5A8 8 0 1 1 6 17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  eraser: '<path d="M14 4l6 6-9 9H6l-3-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 9l6 6M11 19h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="1.6"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" class="rm-ic" aria-hidden="true" focusable="false" fill="currentColor">${P[name] || ''}</svg>`;

// Rainbow piece (reward) glyph
export const pieceSVG = (i = 0) => `<svg viewBox="0 0 24 24" class="rm-piece-svg" aria-hidden="true" focusable="false"><path d="M12 2 C16 8 19 11 19 15 a7 7 0 0 1 -14 0 C5 11 8 8 12 2Z" fill="${RAINBOW[i % 7]}"/><ellipse cx="9.5" cy="13" rx="2" ry="3" fill="#fff" opacity=".55"/></svg>`;
