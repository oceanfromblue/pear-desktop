import {
  createEffect,
  createMemo,
  createSignal,
  Show,
  untrack,
} from 'solid-js';

import { config } from '../renderer';
import { lyricsStore, pronunciationContext } from '../store';
import { effectiveTranslation, getLineTranslation } from '../translation-store';
import {
  canonicalize,
  convertChineseCharacter,
  romanize,
  simplifyUnicode,
  toKoreanPronunciation,
} from '../utils';

interface PlainLyricsProps {
  line: string;
  index: number;
}

export const PlainLyrics = (props: PlainLyricsProps) => {
  const [romanization, setRomanization] = createSignal('');
  const text = createMemo(() => {
    let line = props.line;
    const convertChineseText = config()?.convertChineseCharacter;
    if (convertChineseText && convertChineseText !== 'disabled') {
      line = convertChineseCharacter(line, convertChineseText);
    }
    return line;
  });

  createEffect(() => {
    if (!config()?.romanization) return;

    const input = canonicalize(text());
    romanize(input)
      .then((result) => {
        setRomanization(canonicalize(result));
      })
      .catch(() => {
        // Romanization is best-effort — keep the previous value on failure
      });
  });

  const [koreanPronunciation, setKoreanPronunciation] = createSignal('');
  createEffect(() => {
    const context = pronunciationContext();
    if (!context) return;

    const input = canonicalize(text());
    toKoreanPronunciation(input, context)
      .then((result) => {
        // A slower, outdated conversion must not overwrite a newer one
        if (input === canonicalize(untrack(text))) {
          setKoreanPronunciation(canonicalize(result));
        }
      })
      .catch(() => {
        // Best-effort too (e.g. a dictionary that couldn't be downloaded)
      });
  });

  const translation = createMemo(() => {
    if (!effectiveTranslation(config())?.enabled) return '';
    const videoId = lyricsStore.videoId;
    if (!videoId) return '';
    return getLineTranslation(videoId, props.index) ?? '';
  });

  return (
    <div
      class={`${
        props.line.match(/^\[.+\]$/s) ? 'lrc-header' : ''
      } text-lyrics description ytmusic-description-shelf-renderer`}
      style={{
        'display': 'flex',
        'flex-direction': 'column',
      }}
    >
      <yt-formatted-string
        text={{
          runs: [{ text: text() }],
        }}
      />
      <Show
        when={
          config()?.romanization &&
          simplifyUnicode(text()) !== simplifyUnicode(romanization())
        }
      >
        <yt-formatted-string
          class="romaji"
          text={{
            runs: [{ text: romanization() }],
          }}
        />
      </Show>
      <Show
        when={
          config()?.koreanPronunciation &&
          koreanPronunciation() &&
          simplifyUnicode(text()) !== simplifyUnicode(koreanPronunciation())
        }
      >
        <yt-formatted-string
          class="korean-pronunciation"
          text={{
            runs: [{ text: koreanPronunciation() }],
          }}
        />
      </Show>
      <Show
        when={
          translation() &&
          simplifyUnicode(text()) !== simplifyUnicode(translation())
        }
      >
        <yt-formatted-string
          class="translation"
          text={{
            runs: [{ text: translation() }],
          }}
        />
      </Show>
    </div>
  );
};
