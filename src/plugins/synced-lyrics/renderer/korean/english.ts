import { attachFinal, F, I, lastVowel, syllable, V } from './hangul';

// English is transcribed from its ARPAbet pronunciation (the CMU pronouncing
// dictionary) following the Korean loanword orthography for English
// (외래어 표기법), with the spelling breaking ties where Korean usage follows
// it (family is 패밀리, not 패멀리). Stress is dropped except for the
// unstressed AH0/ER0, the vowels the spelling can override.

type Vowel = readonly [vowel: number, tail?: string];

const PLAIN: Record<string, Vowel> = {
  AA: [V.a],
  AE: [V.ae],
  AH: [V.eo],
  AO: [V.o],
  EH: [V.e],
  ER: [V.eo],
  IH: [V.i],
  IY: [V.i],
  UH: [V.u],
  UW: [V.u],
  OW: [V.o],
  AW: [V.a, '우'],
  AY: [V.a, '이'],
  EY: [V.e, '이'],
  OY: [V.o, '이'],
};

const Y_GLIDE: Record<string, Vowel> = {
  AA: [V.ya],
  AE: [V.yae],
  AH: [V.yeo],
  AO: [V.yo],
  EH: [V.ye],
  ER: [V.yeo],
  IH: [V.i],
  IY: [V.i],
  UH: [V.yu],
  UW: [V.yu],
  OW: [V.yo],
  AW: [V.ya, '우'],
  AY: [V.ya, '이'],
  EY: [V.ye, '이'],
  OY: [V.yo, '이'],
};

const W_GLIDE: Record<string, Vowel> = {
  AA: [V.wa],
  AE: [V.wae],
  AH: [V.wo],
  AO: [V.wo],
  EH: [V.we],
  ER: [V.wo],
  IH: [V.wi],
  IY: [V.wi],
  UH: [V.u],
  UW: [V.u],
  OW: [V.wo],
  AW: [V.wa, '우'],
  AY: [V.wa, '이'],
  EY: [V.we, '이'],
  OY: [V.wo, '이'],
};

const ONSET: Record<string, number> = {
  B: I.b,
  CH: I.ch,
  D: I.d,
  DH: I.d,
  F: I.p,
  G: I.g,
  HH: I.h,
  JH: I.j,
  K: I.k,
  L: I.r,
  M: I.m,
  N: I.n,
  P: I.p,
  R: I.r,
  S: I.s,
  SH: I.s,
  T: I.t,
  TH: I.s,
  V: I.b,
  Z: I.j,
  ZH: I.j,
};

/** A consonant no vowel follows gets 으 (or 이 for the palatals) */
const STANDALONE: Record<string, string> = {
  B: '브',
  CH: '치',
  D: '드',
  DH: '드',
  F: '프',
  G: '그',
  HH: '흐',
  JH: '지',
  K: '크',
  P: '프',
  S: '스',
  SH: '시',
  T: '트',
  TH: '스',
  V: '브',
  Z: '즈',
  ZH: '지',
  W: '우',
  Y: '이',
};

const NASAL_FINAL: Record<string, number> = { M: F.m, N: F.n, NG: F.ng };
const STOP_FINAL: Record<string, number> = { P: F.p, T: F.s, K: F.k };

/** Short vowels close the syllable with a final p/t/k: cat is 캣, cake is 케이크 */
const SHORT_VOWELS = new Set(['AE', 'AH', 'EH', 'IH', 'UH', 'AA']);
const SONORANTS = new Set(['L', 'R', 'M', 'N']);
/** r after these vowels is heard as 어: here is 히어, care is 케어 */
const R_COLORED = new Set(['IH', 'IY', 'EH', 'UH', 'UW']);

const base = (phone: string) => phone.replace(/0$/, '');
const isVowel = (phone: string | undefined) =>
  phone !== undefined && base(phone) in PLAIN;

/** Vowel letter groups of a word: "family" is a, i, y */
const vowelGroups = (word: string) => {
  const groups: { letters: string; end: number }[] = [];
  // y is a vowel unless it starts the word or a syllable (you, beyond)
  const regex = /[aeiou]+(?:y(?![aeiou]))?|(?<=.)y(?![aeiou])/g;
  for (const match of word.matchAll(regex)) {
    groups.push({ letters: match[0], end: match.index + match[0].length });
  }
  // A silent final e: love, loved, makes
  if (groups.at(-1)?.letters === 'e' && /[^aeiou]e[sd]?$/.test(word)) {
    return { groups, silentE: true };
  }
  return { groups, silentE: false };
};

/**
 * Reduced vowels (AH0, ER0) the spelling writes as i, o, u or a final a are
 * usually transcribed after the letter: 패밀리, 메모리, 뷰티풀, 아메리카.
 */
const spellingVowels = (word: string, phones: string[]) => {
  const vowels = phones
    .map((phone, index) => ({ phone, index }))
    .filter(({ phone }) => isVowel(phone));
  let { groups, silentE } = vowelGroups(word);
  if (silentE && groups.length === vowels.length + 1) {
    groups = groups.slice(0, -1);
  }

  const overrides = new Map<number, number>();
  if (groups.length !== vowels.length) return overrides;

  for (const [n, { phone, index }] of vowels.entries()) {
    if (phone !== 'AH0' && phone !== 'ER0') continue;
    const { letters, end } = groups[n];
    const before = word.slice(0, end);
    const after = word.slice(end);

    // today, tonight, together
    if (n === 0 && letters === 'o' && before === 'to') {
      overrides.set(index, V.u);
    } else if (letters === 'i') overrides.set(index, V.i);
    else if (letters === 'o' && !/^[nm]/.test(after)) overrides.set(index, V.o);
    else if (letters === 'u' && after === 'l' && word.endsWith('ful')) {
      overrides.set(index, V.u);
    } else if (letters === 'a' && after === '' && groups.length > 1) {
      overrides.set(index, V.a);
    } else if (letters === 'e') {
      // little, people: the syllabic l is 을
      const syllabicL = /[^aeiou]le$/.test(before) && /^s?$/.test(after);
      // open, seven, seventeen are 오픈, 세븐, 세븐틴, but children,
      // moment, silence and legend are 칠드런, 모먼트, 사일런스, 레전드
      const syllabicN =
        /^n(?:[^aeiou]|e[ds]?$|$)/.test(after) &&
        !/^n(?:ts?$|c|d)/.test(after) &&
        !/re$/.test(before);
      if (syllabicL || syllabicN) overrides.set(index, V.eu);
    }
  }

  return overrides;
};

const EO_VOWELS = new Set<number>([V.eo, V.wo, V.yeo]);

/**
 * Korean pronunciation of an English word from its ARPAbet phonemes
 * (`["HH", "AH0", "L", "OW"]`), `word` being its lowercase spelling.
 */
export const arpabetToHangul = (word: string, phones: string[]): string => {
  const overrides = spellingVowels(word, phones);
  let out = '';
  // AW gliding into the next vowel: power is 파워, not 파우어
  let glide: 'w' | null = null;
  // The r of ER before a vowel starts the next syllable: memory is 메모리
  let initialR = false;

  const emit = (
    initial: number,
    index: number,
    table: Record<string, Vowel> = PLAIN,
  ) => {
    const phone = phones[index];
    const [vowel, tail = ''] = table[base(phone)];
    const override = table === PLAIN ? overrides.get(index) : undefined;

    if (base(phone) === 'ER' && isVowel(phones[index + 1])) initialR = true;
    if (base(phone) === 'AW' && isVowel(phones[index + 1])) {
      out += syllable(initial, override ?? vowel);
      glide = 'w';
      return;
    }
    out += syllable(initial, override ?? vowel) + tail;
  };

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i];
    const previous = phones[i - 1];
    const next = phones[i + 1];
    const afterNext = phones[i + 2];

    if (isVowel(phone)) {
      const initial = initialR ? I.r : I.none;
      initialR = false;
      if (glide) {
        glide = null;
        emit(initial, i, W_GLIDE);
      } else emit(initial, i);
      continue;
    }
    glide = null;
    initialR = false;

    // Glides
    if (phone === 'W' || phone === 'Y') {
      if (isVowel(next)) {
        emit(I.none, i + 1, phone === 'W' ? W_GLIDE : Y_GLIDE);
        i++;
      } else out += STANDALONE[phone];
      continue;
    }
    // cute is 큐트, queen is 퀸, white is 화이트 (but sweet is 스위트)
    if (
      isVowel(afterNext) &&
      (next === 'Y' || (next === 'W' && /^(K|G|HH)$/.test(phone)))
    ) {
      emit(ONSET[phone], i + 2, next === 'Y' ? Y_GLIDE : W_GLIDE);
      i += 2;
      continue;
    }

    // A consonant before a vowel starts its syllable
    if (isVowel(next) && phone !== 'NG') {
      // An l inside a word doubles: hello is 헬로, play is 플레이
      if (phone === 'L' && out) out = attachFinal(out, F.l) ?? out;
      if (phone === 'SH') emit(I.s, i + 1, Y_GLIDE);
      else emit(ONSET[phone], i + 1);
      i++;
      continue;
    }

    // Otherwise it ends a syllable
    switch (phone) {
      case 'M':
      case 'N':
      case 'NG': {
        out =
          attachFinal(out, NASAL_FINAL[phone]) ??
          out + syllable(I.none, V.eu, NASAL_FINAL[phone]);
        break;
      }
      case 'L': {
        // film is 필름
        if ((next === 'M' || next === 'N') && !isVowel(afterNext)) {
          out = attachFinal(out, F.l) ?? out;
          out += syllable(I.r, V.eu, NASAL_FINAL[next]);
          i++;
        } else out = attachFinal(out, F.l) ?? `${out}을`;
        break;
      }
      case 'R': {
        // car is 카, but here is 히어 and more is 모어
        const vowel = previous === undefined ? '' : base(previous);
        const heard =
          R_COLORED.has(vowel) ||
          (next === undefined &&
            vowel in PLAIN &&
            vowel !== 'AA' &&
            vowel !== 'ER');
        if (heard && !EO_VOWELS.has(lastVowel(out))) out += '어';
        break;
      }
      case 'P':
      case 'T':
      case 'K': {
        const short =
          previous !== undefined && SHORT_VOWELS.has(base(previous));
        // cats is 캣츠, lights is 라이츠
        if (phone === 'T' && next === 'S' && !isVowel(afterNext)) {
          if (short) out = attachFinal(out, F.s) ?? out;
          out += '츠';
          i++;
          break;
        }
        // out is 아웃, about is 어바웃
        if (
          phone === 'T' &&
          previous !== undefined &&
          base(previous) === 'AW'
        ) {
          out = attachFinal(out, F.s) ?? `${out}트`;
          break;
        }
        const beforeSonorant =
          next !== undefined &&
          (SONORANTS.has(next) || next === 'W' || next === 'Y');
        if (short && !beforeSonorant) {
          const closed = attachFinal(out, STOP_FINAL[phone]);
          if (closed) {
            out = closed;
            break;
          }
        }
        out += STANDALONE[phone];
        break;
      }
      case 'D': {
        // kids is 키즈
        if (next === 'Z' && !isVowel(afterNext)) {
          out += '즈';
          i++;
        } else out += '드';
        break;
      }
      case 'SH': {
        out += next === undefined ? '시' : '슈';
        break;
      }
      default: {
        out += STANDALONE[phone] ?? '';
      }
    }
  }

  return out;
};

/** Common lyric words whose usual Korean spelling the rules don't give */
const COMMON_WORDS: Record<string, string> = {
  'and': '앤드',
  'because': '비코즈',
  'california': '캘리포니아',
  'cause': '코즈',
  'chicken': '치킨',
  'coffee': '커피',
  'every': '에브리',
  'for': '포',
  'four': '포',
  'forever': '포에버',
  'god': '갓',
  'good': '굿',
  'goodbye': '굿바이',
  'hello': '헬로',
  'knew': '뉴',
  'new': '뉴',
  'nothing': '낫싱',
  'of': '오브',
  'on': '온',
  'real': '리얼',
  'sorry': '쏘리',
  'wanna': '워너',
  'was': '워즈',
  'what': '왓',
  "what's": '왓츠',
  'white': '화이트',
  'women': '위민',
  'yeah': '예',
  'yeh': '예',
  'your': '유어',
};

export type PronunciationLookup = (word: string) => string[] | null;

const wordToHangul = (
  raw: string,
  lookup: PronunciationLookup,
): string | null => {
  const word = raw.toLowerCase().replaceAll('’', "'");

  const candidates = [word];
  // lovin' is loving
  if (word.endsWith("in'")) candidates.push(`${word.slice(0, -1)}g`);
  // A quote around the word: 'hello'
  if (/^'|'$/.test(word)) candidates.push(word.replace(/^'+|'+$/g, ''));

  for (const candidate of candidates) {
    // Not `in`: "constructor" would be found on Object.prototype
    if (Object.hasOwn(COMMON_WORDS, candidate)) return COMMON_WORDS[candidate];
    const phones = lookup(candidate);
    if (phones?.length) return arpabetToHangul(candidate, phones);
  }
  return null;
};

/**
 * Replaces the English words of `line` by their Korean pronunciation,
 * leaving the words `lookup` doesn't know (names, other languages) as they are.
 */
export const englishLineToHangul = (
  line: string,
  lookup: PronunciationLookup,
): string =>
  line.replace(/[a-z][a-z'’]*/gi, (word) => wordToHangul(word, lookup) ?? word);
