import { detectAll } from 'tinyld';

// Kept apart from the converters: the store imports this eagerly, the
// dictionaries behind the converters only load once a line needs them.

export interface PronunciationContext {
  /** The lyrics have kana: kanji-only lines are Japanese, not Chinese */
  japanese: boolean;
  /** Latin-script lines are English (not Spanish, French...) */
  english: boolean;
}

const OTHER_LATIN_LANGUAGES = new Set([
  'af',
  'az',
  'ca',
  'cs',
  'cy',
  'da',
  'de',
  'eo',
  'es',
  'et',
  'eu',
  'fi',
  'fil',
  'fr',
  'ga',
  'gl',
  'hr',
  'hu',
  'id',
  'is',
  'it',
  'la',
  'lt',
  'lv',
  'ms',
  'mt',
  'nb',
  'nl',
  'nn',
  'no',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sq',
  'sr',
  'sv',
  'sw',
  'tl',
  'tr',
  'uz',
  'vi',
]);

const kanaRegex = /[\u3040-\u30FF]/;
const nonLatinRegex =
  /[\u0400-\u04FF\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

export const detectPronunciationContext = (
  lines: string[],
): PronunciationContext => {
  const japanese = lines.some((line) => kanaRegex.test(line));

  const latinText = lines
    .filter((line) => /[a-z]/i.test(line) && !nonLatinRegex.test(line))
    .join('\n');
  let english = true;
  if (latinText.length >= 40) {
    const [best] = detectAll(latinText);
    english = !(
      best &&
      best.accuracy >= 0.5 &&
      OTHER_LATIN_LANGUAGES.has(best.lang)
    );
  }

  return { japanese, english };
};
