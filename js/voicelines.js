// What the guide friend says out loud. Each line is recorded whole (one take per
// line, and one take per number when a line has {v}), so it sounds like a real
// cartoon character, not words glued together. [tags] tell the voice how to act;
// they are not spoken. No child's name is ever recorded.

export const LINES = {
  // ---- answering on her own, column by column
  borrow_tap: {
    values: [2, 3, 4, 5, 6, 7, 8, 9],
    en: ['[excited] Uh-oh, the top number is too small! [giggles] Tap the {v} to borrow a ten!', "[curious] Hmm... not enough ones up top! [cheerful] Tap the {v} and borrow a ten!", "[gasps] Oh no, we can't take that many! [excited] Let's borrow from the {v}. Tap it!", "[whispers] Psst... the top is too small. [excited] Tap the {v} to grab a ten!"],
    es: '[excited] ¡Uy, el de arriba es muy chiquito! [giggles] ¡Toca el {v} para pedir prestada una decena!',
  },
  ones_add: {
    en: ['[cheerful] First the ones! Add them up and write it in the shiny box!', "[excited] Let's start with the ones! Add them together and type the answer here.", "[happy] Ones first, superstar! What do they make together?", "[curious] Ooh, the ones! Add them up and pop the answer in the shiny box."],
    es: '[cheerful] ¡Primero las unidades! ¡Súmalas y escríbelo en la cajita brillante!',
  },
  ones_sub: {
    en: ['[cheerful] First the ones! Take away, and write it in the shiny box!', "[cheerful] Ones first! Take away, and type what's left.", "[curious] Let's look at the ones. How many are left after we take away?", "[happy] Start with the ones! Take them away and write what's left in the box."],
    es: '[cheerful] ¡Primero las unidades! ¡Resta y escríbelo en la cajita brillante!',
  },
  ones_after_borrow: {
    en: ['[excited] Now you have lots of ones! [whispers] Psst... use the yellow ten. Take away from the ten first!', "[excited] Look at all those ones now! [whispers] Hint: take away from the yellow ten first.", "[happy] Now we have plenty of ones! [curious] Try taking away from the yellow ten first.", "[giggles] So many ones! [whispers] Psst, the yellow ten makes it easy."],
    es: '[excited] ¡Ahora tienes muchas unidades! [whispers] Psst... usa la decena amarilla. ¡Quítale primero a la decena!',
  },
  tens_add: {
    en: ["[happy] Now the tens! You're doing amazing!", "[excited] Great job! Now add the tens!", "[happy] The ones are done! Let's do the tens now.", "[cheerful] On to the tens! You've got this!"],
    es: '[happy] ¡Ahora las decenas! ¡Lo estás haciendo increíble!',
  },
  tens_carry: {
    en: ["[excited] Now the tens! Don't forget the little yellow one on top!", "[excited] Tens time! Remember to add the little yellow one!", "[curious] Now the tens. Don't forget the one that flew up there!", "[happy] Tens next! Count the yellow one on top too."],
    es: '[excited] ¡Ahora las decenas! ¡No se te olvide el unito amarillo de arriba!',
  },
  tens_sub: {
    en: ['[happy] Now the tens! Almost there!', "[excited] Now take away the tens! You're so close!", "[happy] Last step: the tens!", "[cheerful] Tens time! Almost done!"],
    es: '[happy] ¡Ahora las decenas! ¡Ya casi!',
  },
  group_tap: {
    values: [2, 3, 4, 5, 10],
    fmt: 'countby',
    en: ['[excited] Tap each group, and count by {v}!', "[happy] Let's count the groups! Tap each one, and count by {v}.", "[curious] Tap the groups one at a time. Count by {v}!"],
    es: '[excited] ¡Toca cada grupo y cuenta {v}!',
  },
  mul_type: {
    en: ['[cheerful] How many in all? Type it in!', "[excited] So how many altogether? Type it in!", "[happy] Great counting! How many in all?"],
    es: '[cheerful] ¿Cuántos hay en total? ¡Escríbelo!',
  },

  // ---- step-by-step help
  g_ones_sum: {
    en: ["[curious] Let's put the ones together. How many is that?", "[curious] Let's put the ones together. What do we get?", "[happy] Add up the ones. How many is that?"],
    es: '[curious] Vamos a juntar las unidades. ¿Cuántas son?',
  },
  g_split: {
    en: ["[surprised] Whoa! That's too big for one box! It's one ten and some ones.", "[gasps] Whoa, that's a big number! It's one ten and some ones.", "[excited] Too big for one box! Let's split it into a ten and some ones."],
    es: '[surprised] ¡Wow! ¡No cabe en una cajita! Es una decena y unas unidades.',
  },
  g_carry: {
    en: ['[excited] Tap the yellow one, and watch it fly up to the tens! Wheee!', "[excited] Tap the yellow one, and send it flying to the tens! Zoom!", "[giggles] Ready? Tap the yellow one and watch it fly up!"],
    es: '[excited] ¡Toca el uno amarillo y mira cómo vuela a las decenas! ¡Wiii!',
  },
  g_write_ones: {
    en: ['[cheerful] Write the ones number in the shiny box!', "[cheerful] Now write the ones number in the box!", "[happy] Pop the ones number in the shiny box!"],
    es: '[cheerful] ¡Escribe las unidades en la cajita brillante!',
  },
  g_sub_cant: {
    en: ['[gasps] Uh-oh! The top ones are too small to take away. We need more ones!', "[gasps] Hmm, there aren't enough ones up top. We need more!", "[curious] Uh-oh, we can't take that many ones. We need to borrow!"],
    es: '[gasps] ¡Uy! Las unidades de arriba no alcanzan. ¡Necesitamos más!',
  },
  g_borrow_after: {
    en: ["[amazed] Look! The ten broke into ten little ones. It's still the same number!", "[amazed] Wow! One ten turned into ten ones. Same number, just more ones!", "[excited] Look! We traded one ten for ten ones. It's still the same amount!"],
    es: '[amazed] ¡Mira! La decena se rompió en diez unidades. ¡Sigue siendo el mismo número!',
  },
  g_split10: {
    en: ["[cheerful] Let's use the yellow ten! It's a ten, and a few more.", "[cheerful] Let's use the yellow ten to make it easy!", "[happy] Here's a trick: use the yellow ten!"],
    es: '[cheerful] ¡Usemos la decena amarilla! Es una decena y unas más.',
  },
  g_from_ten: {
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    en: ['[curious] Take {v} away from the yellow ten. How many are left?', "[happy] Ten, take away {v}. How many yellow ones are left?", "[curious] If we take {v} from the yellow ten, how many stay?"],
    es: '[curious] Quítale {v} a la decena amarilla. ¿Cuántas quedan?',
  },
  g_join: {
    en: ['[happy] Now put them all together! How many?', "[excited] Now put them all together! How many altogether?", "[happy] Let's join them up! How many ones now?"],
    es: '[happy] ¡Ahora júntalas todas! ¿Cuántas son?',
  },
  g_write_result: {
    en: ['[cheerful] Great! Write it in the ones box!', "[cheerful] You got it! Write it in the ones box.", "[excited] Yes! Now write that in the ones box."],
    es: '[cheerful] ¡Muy bien! ¡Escríbelo en la cajita de las unidades!',
  },
  g_sub_ones: {
    en: ['[cheerful] Take away the ones, and write it in the box!', "[happy] Take away the ones, and write what's left."],
    es: '[cheerful] ¡Resta las unidades y escríbelo en la cajita!',
  },
  g_sub_tens_zero: {
    en: ['[giggles] No tens left! The tens box can stay empty.', "[giggles] Zero tens! We can leave the tens box empty."],
    es: '[giggles] ¡No quedan decenas! La cajita se puede quedar vacía.',
  },
  g_m_intro: {
    en: ["[cheerful] Let's count the groups, one at a time!", "[excited] Let's count the groups together, one by one!"],
    es: '[cheerful] ¡Contemos los grupos, uno por uno!',
  },
  g_m_more: {
    en: ['[curious] Add one more group! How many now?', "[curious] One more group! How many now?", "[happy] Add another group! What's the total?"],
    es: '[curious] ¡Suma un grupo más! ¿Cuántos son ahora?',
  },
  g_next: {
    en: ['[cheerful] Look at the blocks, then tap here!', "[cheerful] Take a look, then tap here!"],
    es: '[cheerful] ¡Mira los bloques y luego toca aquí!',
  },

  // ---- cheering and comfort
  yay1: { en: ['[excited] Yaaay! You did it!', "[happy] Yes! That's exactly right!", "[excited] Wow, you're on fire!"], es: '[excited] ¡Siii! ¡Lo lograste!' },
  yay2: { en: ["[giggles] Woohoo! You're a math superstar!", "[giggles] Boom! Nailed it!", "[cheerful] Perfect! You're so smart!"], es: '[giggles] ¡Wuju! ¡Eres una superestrella de las mates!' },
  yay3: { en: ['[excited] Amazing! High five!', "[excited] Hooray! Another one right!"], es: '[excited] ¡Increíble! ¡Choca esos cinco!' },
  team: { en: ['[happy] We did it together! Teamwork!', "[happy] Teamwork makes it work! We did it!", "[excited] We figured it out together! Yay!"], es: '[happy] ¡Lo hicimos juntos! ¡Trabajo en equipo!' },
  oops1: { en: ["[gently] Oopsie! That's okay. Let's look again.", "[gently] Not quite, but that's okay! Let's try again.", "[gently] Hmm, almost! Let's check it together."], es: '[gently] ¡Ups! No pasa nada. Vamos a ver otra vez.' },
  oops2: { en: ['[gently] Almost! You can do it. Try again!', "[gently] Good try! Mistakes help us learn. Try again!"], es: '[gently] ¡Casi! Tú puedes. ¡Inténtalo otra vez!' },
  levelup: { en: ["[excited] Level up! [giggles] You're shining like a star!", "[excited] Level up! You're getting so good at this!"], es: '[excited] ¡Subiste de nivel! [giggles] ¡Brillas como una estrella!' },
  prize: { en: ['[excited] Wow! You earned a prize! Show it to a grown-up!', "[excited] Yay! You won a prize! Go tell a grown-up!"], es: '[excited] ¡Wow! ¡Ganaste un premio! ¡Enséñaselo a un adulto!' },
  hello: { en: ["[excited] Hi hi! Let's go on a rainbow adventure!", "[excited] Hi there! Ready for some math magic?", "[happy] Yay, you're here! Let's have a rainbow adventure!"], es: '[excited] ¡Holi! ¡Vamos a una aventura arcoíris!' },
  place_start: { en: "[cheerful] Let's see what you already know! Just try your best.", es: '[cheerful] ¡Vamos a ver todo lo que ya sabes! Solo haz tu mejor esfuerzo.' },
  place_next: { en: ["[gently] Good try! Let's do another one.", "[gently] Nice try! Here's another one."], es: '[gently] ¡Buen intento! Vamos con otro.' },
  place_done: { en: '[excited] All done! I found the perfect level for you!', es: '[excited] ¡Listo! ¡Encontré el nivel perfecto para ti!' },
};

const EN_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ES_NUM = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
const EN_BY = { 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 10: 'tens' };

function valueText(lang, line, v, forVoice) {
  if (line.fmt === 'countby') {
    if (lang === 'es') { const w = forVoice ? ES_NUM[v] : v; return `de ${w} en ${w}`; }
    return forVoice ? EN_BY[v] : `${v}s`;
  }
  if (!forVoice) return String(v);
  return (lang === 'es' ? ES_NUM : EN_NUM)[v] ?? String(v);
}

// A line can have several takes (different words), so the guide doesn't repeat itself.
export function variants(lang, key) {
  const line = LINES[key];
  if (!line) return [];
  const t = line[lang] || line.en;
  return Array.isArray(t) ? t : [t];
}

// The words of a line: forVoice=true is what gets recorded (with [tags], numbers as words),
// forVoice=false is what the device voice says if a recording is missing.
export function lineText(lang, key, v = null, forVoice = false, variant = 0) {
  const line = LINES[key];
  if (!line) return '';
  const takes = variants(lang, key);
  let s = (takes[variant] || takes[0]).replace('{v}', v == null ? '' : valueText(lang, line, v, forVoice));
  if (!forVoice) s = s.replace(/\[[^\]]*\]\s*/g, '').trim();
  return s;
}

export const clipId = (lang, key, v = null, variant = 0) => `${lang}-${key}${v == null ? '' : `-${v}`}${variant ? `-x${variant}` : ''}`;

// Every recording: { id: { lang, key, v, text } }
export function allLines() {
  const out = {};
  for (const lang of ['en', 'es']) {
    for (const [key, line] of Object.entries(LINES)) {
      const n = variants(lang, key).length;
      for (const v of line.values || [null]) {
        for (let x = 0; x < n; x++) out[clipId(lang, key, v, x)] = { lang, key, v, variant: x, text: lineText(lang, key, v, true, x) };
      }
    }
  }
  return out;
}
