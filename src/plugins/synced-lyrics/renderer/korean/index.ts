// Only the translation table, the index also loads the (unused) stroke counts
import { translate as hanjaTranslate } from 'hanja/lib/translate.js';
import { pinyin } from 'pinyin-pro';

import { englishLineToHangul } from './english';
import { getEnglishDictionary, lookupWord } from './english-dictionary';
import { appendKana, japaneseTokensToHangul } from './kana';
import { pinyinToHangul } from './pinyin';

import type { PronunciationContext } from './context';

const kanaRegex = /[\u3040-\u30FF]/;
const hanRegex = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const hanRunRegex = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/g;
const hangulRegex = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const latinRegex = /[a-z]/i;

/** 我爱你 is 워 아이 니: one Korean syllable group per Chinese character */
const chineseToHangul = (line: string) =>
  line.replace(hanRunRegex, (run) => {
    const syllables = pinyin(run, { toneType: 'none', type: 'array' });
    return ` ${syllables.map((syllable) => pinyinToHangul(syllable) ?? syllable).join(' ')} `;
  });

const englishToHangul = async (line: string) => {
  const dictionary = await getEnglishDictionary();
  // Not cached by the caller: tried again once the dictionary downloads
  if (!dictionary) throw new Error('The English dictionary is unavailable');
  return englishLineToHangul(line, (word) => lookupWord(dictionary, word));
};

/**
 * The lyric line written the way it sounds in Hangul: Japanese, Chinese and
 * English are transcribed, Korean (with its Hanja read) is kept.
 */
export const toKoreanPronunciation = async (
  line: string,
  context: PronunciationContext,
): Promise<string> => {
  let text = line;

  if (
    kanaRegex.test(text) ||
    (context.japanese && hanRegex.test(text) && !hangulRegex.test(text))
  ) {
    // Shares the Japanese dictionary with the romanization
    const { tokenizeJapanese } = await import('../romanize');
    text = japaneseTokensToHangul(await tokenizeJapanese(text));
  } else if (hanRegex.test(text)) {
    // Hanja in Korean lyrics are read in Korean, otherwise it's Chinese
    text = hangulRegex.test(text)
      ? hanjaTranslate(text, 'SUBSTITUTION')
      : chineseToHangul(text);
  }

  if (context.english && latinRegex.test(text)) {
    text = await englishToHangul(text);
  }

  // Full-width punctuation the transcription left
  return appendKana('', text).replaceAll(/\s+/g, ' ').trim();
};
