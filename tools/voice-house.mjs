// The house voice: one place that says how every recording is made, so math,
// reading, writing, money, geography and quiet-mind lessons all sound like the
// same friend. Chosen by ear on 2026-11-10 (style "A": expressive, with acting tags).
// Change it here only if you mean to re-record everything.
export const HOUSE = {
  model: 'eleven_v3', // understands [excited], [giggles], [whispers]
  settings: { stability: 0.5 }, // bright and playful, still steady
  format: 'mp3_44100_64',
  voices: {
    en: { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica' },
    es: { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi' },
  },
  // tools/tidy-audio.mjs: how much quiet to leave after the voice stops
  tidy: {
    floorDb: -45, // quieter than this counts as silence
    pieceTail: 0.06, // pieces joined into a sentence ("thirty", "plus")
    lineTail: 0.3, // whole lines: a natural pause
  },
  // Lines every module can share instead of recording them again
  // (ids in js/voicelines.js): numbers 0–100 and the joining words.
  shared: ['rd-n0..100', 'rd-what', 'rd-plus', 'rd-minus', 'rd-times'],
};
