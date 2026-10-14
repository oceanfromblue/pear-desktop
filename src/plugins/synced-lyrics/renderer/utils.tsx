import { sify, tify } from 'chinese-conv';
import { render } from 'solid-js/web';

import { waitForElement } from '@/utils/wait-for-element';

import { LyricsRenderer, setIsVisible } from './renderer';

import type { PronunciationContext } from './korean/context';

export const selectors = {
  head: '#tabsContent > .tab-header:nth-of-type(2)',
  body: {
    tabRenderer: '#tab-renderer[page-type="MUSIC_PAGE_TYPE_TRACK_LYRICS"]',
    root: 'ytmusic-description-shelf-renderer',
  },
};

export const tabStates: Record<string, () => void> = {
  true: async () => {
    setIsVisible(true);

    let container = document.querySelector('#synced-lyrics-container');
    if (container) return;

    const tabRenderer = await waitForElement<HTMLElement>(
      selectors.body.tabRenderer,
    );

    container = Object.assign(document.createElement('div'), {
      id: 'synced-lyrics-container',
    });

    tabRenderer.appendChild(container);
    render(() => <LyricsRenderer />, container);
  },
  false: () => {
    setIsVisible(false);
  },
};

export const canonicalize = (text: string) => {
  return (
    text
      // `hi  there` => `hi there`
      .replaceAll(/\s+/g, ' ')

      // `( a )` => `(a)`
      .replaceAll(/([([]) ([^ ])/g, (_, symbol, a) => `${symbol}${a}`)
      .replaceAll(/([^ ]) ([)\]])/g, (_, a, symbol) => `${a}${symbol}`)

      // `can ' t` => `can't`
      .replaceAll(
        /([Ii]) (') ([^ ])|(n) (') (t)(?= |$)|(t) (') (s)|([^ ]) (') (re)|([^ ]) (') (ve)|([^ ]) (-) ([^ ])/g,
        (m, ...groups) => {
          for (let i = 0; i < groups.length; i += 3) {
            if (groups[i]) {
              return groups.slice(i, i + 3).join('');
            }
          }

          return m;
        },
      )
      // `Stayin ' still` => `Stayin' still`
      .replaceAll(/in ' ([^ ])/g, (_, char) => `in' ${char}`)
      .replaceAll("in ',", "in',")

      .replaceAll(", ' cause", ", 'cause")

      // `hi , there` => `hi, there`
      .replaceAll(/([^ ]) ([.,!?])/g, (_, a, symbol) => `${a}${symbol}`)

      // `hi " there "` => `hi "there"`
      .replaceAll(
        /"([^"]+)"/g,
        (_, content) =>
          `"${typeof content === 'string' ? content.trim() : content}"`,
      )
      .trim()
  );
};

export const convertChineseCharacter = (
  text: string,
  mode: 'simplifiedToTraditional' | 'traditionalToSimplified',
) => {
  if (!hasChinese([text])) return text;

  switch (mode) {
    case 'simplifiedToTraditional':
      return tify(text);
    case 'traditionalToSimplified':
      return sify(text);
  }
};

export const simplifyUnicode = (text?: string) =>
  text
    ? text
        .replaceAll(/\u0020|\u00A0|[\u2000-\u200A]|\u202F|\u205F|\u3000/g, ' ')
        .trim()
    : text;

export const hasChinese = (lines: string[]) =>
  lines.some((line) => /[\u4E00-\u9FFF]+/.test(line));

// Scripts handled by the romanizer (Devanagari, Bengali, Thai, Hangul, Kana, CJK)
const romanizableRegex =
  /[\u0900-\u09FF\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF66-\uFF9F]/;

let romanizer: Promise<typeof import('./romanize')> | undefined;
let koreanTranscriber: Promise<typeof import('./korean')> | undefined;

// The lines are converted again whenever they scroll back into view
const MAX_CACHED_LINES = 1000;
const cached = (
  cache: Map<string, Promise<string>>,
  key: string,
  convert: () => Promise<string>,
) => {
  const hit = cache.get(key);
  if (hit) return hit;

  const result = convert();
  cache.set(key, result);
  if (cache.size > MAX_CACHED_LINES) {
    cache.delete(cache.keys().next().value!);
  }
  // Failures (e.g. a dictionary that didn't download) are retried later
  result.catch(() => {
    if (cache.get(key) === result) cache.delete(key);
  });
  return result;
};

const romanizationCache = new Map<string, Promise<string>>();
const koreanCache = new Map<string, Promise<string>>();

// The romanization libraries are big (dictionaries), only load them when needed
export const romanize = (line: string) => {
  if (!romanizableRegex.test(line)) return Promise.resolve(line);

  return cached(romanizationCache, line, async () => {
    romanizer ??= import('./romanize');
    return (await romanizer).romanize(line);
  });
};

// Japanese, Chinese and English (or Hanja in Korean lyrics)
const transcribableRegex =
  /[a-z\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/i;

/** The line as it sounds, written in Hangul */
export const toKoreanPronunciation = (
  line: string,
  context: PronunciationContext,
) => {
  if (!transcribableRegex.test(line)) return Promise.resolve(line);

  const key = `${Number(context.japanese)}${Number(context.english)}${line}`;
  return cached(koreanCache, key, async () => {
    koreanTranscriber ??= import('./korean');
    return (await koreanTranscriber).toKoreanPronunciation(line, context);
  });
};
