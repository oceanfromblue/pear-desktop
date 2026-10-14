// Hangul syllables are composed arithmetically from their jamo indices:
// U+AC00 + (initial * 21 + vowel) * 28 + final

/** Initial consonants (choseong) */
export const I = {
  g: 0, // ㄱ
  kk: 1, // ㄲ
  n: 2, // ㄴ
  d: 3, // ㄷ
  tt: 4, // ㄸ
  r: 5, // ㄹ
  m: 6, // ㅁ
  b: 7, // ㅂ
  pp: 8, // ㅃ
  s: 9, // ㅅ
  ss: 10, // ㅆ
  none: 11, // ㅇ
  j: 12, // ㅈ
  jj: 13, // ㅉ
  ch: 14, // ㅊ
  k: 15, // ㅋ
  t: 16, // ㅌ
  p: 17, // ㅍ
  h: 18, // ㅎ
} as const;

/** Vowels (jungseong) */
export const V = {
  a: 0, // ㅏ
  ae: 1, // ㅐ
  ya: 2, // ㅑ
  yae: 3, // ㅒ
  eo: 4, // ㅓ
  e: 5, // ㅔ
  yeo: 6, // ㅕ
  ye: 7, // ㅖ
  o: 8, // ㅗ
  wa: 9, // ㅘ
  wae: 10, // ㅙ
  oe: 11, // ㅚ
  yo: 12, // ㅛ
  u: 13, // ㅜ
  wo: 14, // ㅝ
  we: 15, // ㅞ
  wi: 16, // ㅟ
  yu: 17, // ㅠ
  eu: 18, // ㅡ
  ui: 19, // ㅢ
  i: 20, // ㅣ
} as const;

/** Final consonants (jongseong), only the ones a transcription needs */
export const F = {
  none: 0,
  k: 1, // ㄱ
  n: 4, // ㄴ
  t: 7, // ㄷ
  l: 8, // ㄹ
  m: 16, // ㅁ
  p: 17, // ㅂ
  s: 19, // ㅅ
  ng: 21, // ㅇ
} as const;

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;

export const syllable = (initial: number, vowel: number, final = 0) =>
  String.fromCharCode(SYLLABLE_BASE + (initial * 21 + vowel) * 28 + final);

const isSyllable = (code: number) =>
  code >= SYLLABLE_BASE && code <= SYLLABLE_LAST;

/**
 * Puts `final` under the last syllable of `text` when it has none yet.
 * @returns the new text, or `null` when there is no open syllable to attach to
 */
export const attachFinal = (text: string, final: number): string | null => {
  if (!text) return null;
  const code = text.charCodeAt(text.length - 1);
  if (!isSyllable(code) || (code - SYLLABLE_BASE) % 28 !== 0) return null;

  return text.slice(0, -1) + String.fromCharCode(code + final);
};

/** The final consonant index of the last syllable of `text` (0 for none). */
export const lastFinal = (text: string): number => {
  const code = text.charCodeAt(text.length - 1);
  return isSyllable(code) ? (code - SYLLABLE_BASE) % 28 : 0;
};

/** The vowel index of the last syllable of `text`, or `-1`. */
export const lastVowel = (text: string): number => {
  const code = text.charCodeAt(text.length - 1);
  return isSyllable(code)
    ? Math.floor(((code - SYLLABLE_BASE) % (21 * 28)) / 28)
    : -1;
};
