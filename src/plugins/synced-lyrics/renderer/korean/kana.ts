import { attachFinal, F, I, lastVowel, syllable, V } from './hangul';

type Jamo = readonly [initial: number, vowel: number];

// The way Korean lyric sites write Japanese pronunciation, closer to how it is
// sung than the official loanword orthography: か is 카 (not 가), つ is 츠,
// っ and ん become a final consonant and long vowels are marked with "-".
const KANA: Record<string, Jamo> = {
  ア: [I.none, V.a],
  イ: [I.none, V.i],
  ウ: [I.none, V.u],
  エ: [I.none, V.e],
  オ: [I.none, V.o],
  カ: [I.k, V.a],
  キ: [I.k, V.i],
  ク: [I.k, V.u],
  ケ: [I.k, V.e],
  コ: [I.k, V.o],
  ガ: [I.g, V.a],
  ギ: [I.g, V.i],
  グ: [I.g, V.u],
  ゲ: [I.g, V.e],
  ゴ: [I.g, V.o],
  サ: [I.s, V.a],
  シ: [I.s, V.i],
  ス: [I.s, V.eu],
  セ: [I.s, V.e],
  ソ: [I.s, V.o],
  ザ: [I.j, V.a],
  ジ: [I.j, V.i],
  ズ: [I.j, V.eu],
  ゼ: [I.j, V.e],
  ゾ: [I.j, V.o],
  タ: [I.t, V.a],
  チ: [I.ch, V.i],
  ツ: [I.ch, V.eu],
  テ: [I.t, V.e],
  ト: [I.t, V.o],
  ダ: [I.d, V.a],
  ヂ: [I.j, V.i],
  ヅ: [I.j, V.eu],
  デ: [I.d, V.e],
  ド: [I.d, V.o],
  ナ: [I.n, V.a],
  ニ: [I.n, V.i],
  ヌ: [I.n, V.u],
  ネ: [I.n, V.e],
  ノ: [I.n, V.o],
  ハ: [I.h, V.a],
  ヒ: [I.h, V.i],
  フ: [I.h, V.u],
  ヘ: [I.h, V.e],
  ホ: [I.h, V.o],
  バ: [I.b, V.a],
  ビ: [I.b, V.i],
  ブ: [I.b, V.u],
  ベ: [I.b, V.e],
  ボ: [I.b, V.o],
  パ: [I.p, V.a],
  ピ: [I.p, V.i],
  プ: [I.p, V.u],
  ペ: [I.p, V.e],
  ポ: [I.p, V.o],
  マ: [I.m, V.a],
  ミ: [I.m, V.i],
  ム: [I.m, V.u],
  メ: [I.m, V.e],
  モ: [I.m, V.o],
  ヤ: [I.none, V.ya],
  ユ: [I.none, V.yu],
  ヨ: [I.none, V.yo],
  ラ: [I.r, V.a],
  リ: [I.r, V.i],
  ル: [I.r, V.u],
  レ: [I.r, V.e],
  ロ: [I.r, V.o],
  ワ: [I.none, V.wa],
  ヰ: [I.none, V.i],
  ヱ: [I.none, V.e],
  ヲ: [I.none, V.o],
  ヴ: [I.b, V.u],
  ァ: [I.none, V.a],
  ィ: [I.none, V.i],
  ゥ: [I.none, V.u],
  ェ: [I.none, V.e],
  ォ: [I.none, V.o],
  ャ: [I.none, V.ya],
  ュ: [I.none, V.yu],
  ョ: [I.none, V.yo],
  ヮ: [I.none, V.wa],
  ヵ: [I.k, V.a],
  ヶ: [I.k, V.e],
};

const SMALL_Y: Record<string, number> = { ャ: V.ya, ュ: V.yu, ョ: V.yo };
const SMALL_VOWELS = new Set(['ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ヮ']);

/** ウ-row kana followed by a small vowel: ウィ, クァ, ファ, ヴァ, ツァ... */
const combineWithURow = (
  [initial, vowel]: Jamo,
  small: string,
): Jamo | null => {
  if (vowel !== V.u && vowel !== V.eu) return null;

  if (initial === I.none || initial === I.k || initial === I.g) {
    const glide: Record<string, number> = {
      ァ: V.wa,
      ヮ: V.wa,
      ィ: V.wi,
      ェ: V.we,
      ォ: V.wo,
    };
    return small in glide ? [initial, glide[small]] : null;
  }

  // ファ is 파 and ヴァ is 바, like in loanwords; ツァ is 차; スィ is 시
  const plain: Record<string, number> = {
    ァ: V.a,
    ィ: V.i,
    ェ: V.e,
    ォ: V.o,
  };
  if (!(small in plain)) return null;
  if (initial === I.h) return [I.p, plain[small]];
  if (initial === I.b || initial === I.ch) return [initial, plain[small]];
  if ((initial === I.s || initial === I.j) && small === 'ィ') {
    return [initial, V.i];
  }
  return null;
};

/** A kana followed by a small kana that changes its sound, e.g. キャ, シェ, ティ */
const combine = (base: Jamo, small: string): Jamo | null => {
  const [initial, vowel] = base;

  if (small in SMALL_Y) {
    if (vowel === V.i && initial !== I.none) return [initial, SMALL_Y[small]];
    // フュ, ヴュ, テュ, デュ
    if (vowel === V.u && initial === I.h) return [I.p, SMALL_Y[small]];
    if (vowel === V.u && initial === I.b) return [I.b, SMALL_Y[small]];
    if (vowel === V.e && (initial === I.t || initial === I.d)) {
      return [initial, SMALL_Y[small]];
    }
    return null;
  }

  if (!SMALL_VOWELS.has(small)) return null;

  // シェ is 셰, ジェ and チェ are 제 and 체, イェ is 예
  if (vowel === V.i && small === 'ェ') {
    return [initial, initial === I.j || initial === I.ch ? V.e : V.ye];
  }
  // ティ, ディ
  if (vowel === V.e && small === 'ィ' && (initial === I.t || initial === I.d)) {
    return [initial, V.i];
  }
  // トゥ, ドゥ
  if (vowel === V.o && small === 'ゥ' && (initial === I.t || initial === I.d)) {
    return [initial, V.u];
  }

  return combineWithURow(base, small);
};

const PUNCTUATION: Record<string, string> = {
  '、': ', ',
  '。': '. ',
  '，': ', ',
  '．': '. ',
  '！': '! ',
  '？': '? ',
  '：': ': ',
  '；': '; ',
  '～': '~',
  '〜': '~',
  '・': ' ',
  '　': ' ',
  '（': '(',
  '）': ')',
};

/** Closes the last syllable with `final`, over a long vowel mark (ティーン is 틴) */
const closeSyllable = (text: string, final: number) =>
  attachFinal(text, final) ??
  (text.endsWith('-') ? attachFinal(text.slice(0, -1), final) : null);

const toKatakana = (text: string) =>
  text.replace(/[ぁ-ゖ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60),
  );

/**
 * Appends the Korean pronunciation of `kana` (hiragana or katakana) to
 * `prefix`, so that a leading ん or っ can close the prefix's last syllable.
 * Anything that isn't kana is kept as is.
 */
export const appendKana = (prefix: string, kana: string): string => {
  const chars = Array.from(toKatakana(kana));
  let out = prefix;

  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];

    if (char === 'ン') {
      out = closeSyllable(out, F.n) ?? `${out}${syllable(I.none, V.eu, F.ng)}`;
      continue;
    }
    if (char === 'ッ') {
      // Doubles the next consonant: 待って is 맛테
      out = closeSyllable(out, F.s) ?? out;
      continue;
    }
    if (char === 'ー') {
      out += '-';
      continue;
    }

    const base = KANA[char];
    if (!base) {
      out += PUNCTUATION[char] ?? char;
      continue;
    }
    // A small vowel repeating the one before lengthens it: ねぇ is 네-
    if (SMALL_VOWELS.has(char) && lastVowel(out) === base[1]) {
      out += '-';
      continue;
    }

    const next = chars[index + 1];
    const combined = next ? combine(base, next) : null;
    if (combined) {
      out += syllable(combined[0], combined[1]);
      index++;
    } else {
      out += syllable(base[0], base[1]);
    }
  }

  return out;
};

export const kanaToHangul = (kana: string) => appendKana('', kana);

/** The subset of a kuromoji token the transcription needs */
export interface JapaneseToken {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  reading?: string;
  pronunciation?: string;
}

const japaneseRegex =
  /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF々〆]/;
const openingBrackets = /^[「『（(【[〈《"'“‘]+$/;
const oRowEnding = /[オコゴソゾトドノホボポモヨロヲョォ]$/;

const smallKanaOnly = /^[ぁぃぅぇぉゃゅょっゎァィゥェォャュョッヮー]+$/;

/** Particles, auxiliaries and suffixes are read together with the word before them */
const attachesToPrevious = (
  token: JapaneseToken,
  previous: JapaneseToken | undefined,
) => {
  if (token.pos === '助詞' || token.pos === '助動詞') return true;
  if (previous?.pos === '接頭詞' || smallKanaOnly.test(token.surface_form)) {
    return true;
  }
  if (token.pos_detail_1 === '接尾') return true;
  if (token.pos_detail_1 !== '非自立') return false;
  // A dependent noun (こと, よう, ところ) is a word of its own, except for
  // the nominalizers の and ん: 好きなんだ is 스키난다
  return token.pos !== '名詞' || /^[のんノン]$/.test(token.surface_form);
};

const tokenKana = (token: JapaneseToken) => {
  // `pronunciation` reads は/へ particles as わ/え and marks long vowels
  for (const kana of [token.pronunciation, token.reading]) {
    if (kana && kana !== '*') return kana;
  }
  return token.surface_form;
};

/**
 * Korean pronunciation of a tokenized Japanese line, with a space between
 * each word and the particles/auxiliaries that follow it ("君の名前を" is
 * "키미노 나마에오").
 */
export const japaneseTokensToHangul = (tokens: JapaneseToken[]): string => {
  const words: string[] = [];
  let word = '';
  // The word so far is an opening bracket, the next token belongs to it
  let glue = false;
  let previous: JapaneseToken | undefined;
  let previousKana = '';

  const flush = () => {
    if (word.trim()) words.push(word.trim());
    word = '';
    glue = false;
  };

  for (const token of tokens) {
    const surface = token.surface_form;

    if (!japaneseRegex.test(surface)) {
      if (!surface.trim()) {
        flush();
      } else if (openingBrackets.test(surface)) {
        flush();
        word = appendKana('', surface);
        glue = true;
      } else if (token.pos === '記号') {
        word = appendKana(word, surface);
        if (/\s$/.test(word)) flush();
      } else if (glue || !/[\p{L}\p{N}]$/u.test(word)) {
        // Latin words, numbers
        word += surface;
        glue = false;
      } else {
        flush();
        word = surface;
      }
      previous = token;
      previousKana = '';
      continue;
    }

    if (glue) glue = false;
    else if (!attachesToPrevious(token, previous)) flush();

    const kana = tokenKana(token);
    // The volitional う lengthens the vowel before it: でしょう, 行こう
    if (
      token.pos === '助動詞' &&
      (surface === 'う' || surface === 'ウ') &&
      oRowEnding.test(previousKana)
    ) {
      word += '-';
    } else {
      word = appendKana(word, kana);
    }

    previous = token;
    previousKana = kana;
  }
  flush();

  return words.join(' ');
};
