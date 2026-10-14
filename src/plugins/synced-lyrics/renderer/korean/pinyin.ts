import { F, I, syllable, V } from './hangul';

// Mandarin follows the official Korean transcription of Chinese
// (외래어 표기법, 중국어 표기 세칙): 我爱你 is 워 아이 니, 周杰伦 is 저우제룬.

const INITIALS: [pinyin: string, initial: number][] = [
  ['zh', I.j],
  ['ch', I.ch],
  ['sh', I.s],
  ['b', I.b],
  ['p', I.p],
  ['m', I.m],
  ['f', I.p],
  ['d', I.d],
  ['t', I.t],
  ['n', I.n],
  ['l', I.r],
  ['g', I.g],
  ['k', I.k],
  ['h', I.h],
  ['j', I.j],
  ['q', I.ch],
  ['x', I.s],
  ['r', I.r],
  ['z', I.jj],
  ['c', I.ch],
  ['s', I.ss],
];

type Final = readonly [vowel: number, final?: number, tail?: string];

const FINALS: Record<string, Final> = {
  'a': [V.a],
  'o': [V.o],
  'e': [V.eo],
  'ê': [V.e],
  'ai': [V.a, F.none, '이'],
  'ei': [V.e, F.none, '이'],
  'ao': [V.a, F.none, '오'],
  'ou': [V.eo, F.none, '우'],
  'an': [V.a, F.n],
  'en': [V.eo, F.n],
  'ang': [V.a, F.ng],
  'eng': [V.eo, F.ng],
  'ong': [V.u, F.ng],
  'er': [V.eo, F.l],
  'i': [V.i],
  'ia': [V.ya],
  'io': [V.yo],
  'ie': [V.ye],
  'iao': [V.ya, F.none, '오'],
  'iu': [V.yu],
  'iou': [V.yu],
  'ian': [V.ye, F.n],
  'in': [V.i, F.n],
  'iang': [V.ya, F.ng],
  'ing': [V.i, F.ng],
  'iong': [V.yu, F.ng],
  'u': [V.u],
  'ua': [V.wa],
  'uo': [V.wo],
  'uai': [V.wa, F.none, '이'],
  'ui': [V.u, F.none, '이'],
  'uei': [V.u, F.none, '이'],
  'uan': [V.wa, F.n],
  'un': [V.u, F.n],
  'uen': [V.u, F.n],
  'uang': [V.wa, F.ng],
  'ueng': [V.wo, F.ng],
  'ü': [V.wi],
  'üe': [V.we],
  'üan': [V.wi, F.none, '안'],
  'ün': [V.wi, F.n],
};

/** Syllables without an initial consonant, spelled with y/w in pinyin */
const ZERO_INITIAL: Record<string, string> = {
  yi: 'i',
  ya: 'ia',
  yo: 'io',
  ye: 'ie',
  yao: 'iao',
  you: 'iu',
  yan: 'ian',
  yin: 'in',
  yang: 'iang',
  ying: 'ing',
  yong: 'iong',
  yu: 'ü',
  yue: 'üe',
  yuan: 'üan',
  yun: 'ün',
  wu: 'u',
  wa: 'ua',
  wo: 'uo',
  wai: 'uai',
  wan: 'uan',
  wang: 'uang',
  weng: 'ueng',
};

// wei and wen are 웨이 and 원, while after a consonant (gui, dun) the
// same finals are 구이 and 둔
const ZERO_INITIAL_SPECIAL: Record<string, string> = {
  wei: `${syllable(I.none, V.we)}이`,
  wen: syllable(I.none, V.wo, F.n),
};

const INTERJECTIONS: Record<string, string> = {
  m: '음',
  n: '은',
  ng: '응',
  hm: '흠',
  hng: '흥',
};

/** ㅑ, ㅖ, ㅛ, ㅠ are written ㅏ, ㅔ, ㅗ, ㅜ after ㅈ, ㅉ, ㅊ */
const unpalatalize: Record<number, number> = {
  [V.ya]: V.a,
  [V.ye]: V.e,
  [V.yo]: V.o,
  [V.yu]: V.u,
};

const render = (initial: number, [vowel, final = 0, tail = '']: Final) => {
  const plain =
    initial === I.j || initial === I.jj || initial === I.ch
      ? (unpalatalize[vowel] ?? vowel)
      : vowel;
  return syllable(initial, plain, final) + tail;
};

/**
 * Korean pronunciation of a single toneless pinyin syllable (`"zhong"`,
 * `"lü"` or `"lv"`). Returns `null` when it isn't a pinyin syllable.
 */
export const pinyinToHangul = (input: string): string | null => {
  const pinyin = input.toLowerCase().replaceAll('v', 'ü').replaceAll('u:', 'ü');

  if (Object.hasOwn(INTERJECTIONS, pinyin)) return INTERJECTIONS[pinyin];
  if (Object.hasOwn(ZERO_INITIAL_SPECIAL, pinyin)) {
    return ZERO_INITIAL_SPECIAL[pinyin];
  }
  if (Object.hasOwn(ZERO_INITIAL, pinyin)) {
    return render(I.none, FINALS[ZERO_INITIAL[pinyin]]);
  }
  if (Object.hasOwn(FINALS, pinyin)) return render(I.none, FINALS[pinyin]);

  const match = INITIALS.find(([initial]) => pinyin.startsWith(initial));
  if (!match) return null;

  const [initialPinyin, initial] = match;
  let final = pinyin.slice(initialPinyin.length);

  // zhi, chi, shi, ri, zi, ci, si: the vowel is 으
  if (final === 'i' && /^(zh|ch|sh|r|z|c|s)$/.test(initialPinyin)) {
    return syllable(initial, V.eu);
  }
  // ju, que, xuan, jun: u is ü after j, q and x
  if (/^[jqx]$/.test(initialPinyin) && final.startsWith('u')) {
    final = `ü${final.slice(1)}`;
  }

  return Object.hasOwn(FINALS, final) ? render(initial, FINALS[final]) : null;
};
