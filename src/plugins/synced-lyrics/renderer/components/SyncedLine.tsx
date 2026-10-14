import {
  createEffect,
  For,
  Show,
  createSignal,
  createMemo,
  untrack,
} from 'solid-js';
import { type VirtualizerHandle } from 'virtua/solid';

import { type LineLyrics } from '@/plugins/synced-lyrics/types';

import { _ytAPI } from '..';
import { config, currentTime } from '../renderer';
import { lyricsStore, pronunciationContext } from '../store';
import { effectiveTranslation, getLineTranslation } from '../translation-store';
import {
  canonicalize,
  convertChineseCharacter,
  romanize,
  simplifyUnicode,
  toKoreanPronunciation,
} from '../utils';

interface SyncedLineProps {
  scroller: VirtualizerHandle;
  index: number;

  line: LineLyrics;
  status: 'upcoming' | 'current' | 'previous';
}

const EmptyLine = (props: SyncedLineProps) => {
  const states = createMemo(() => {
    const defaultText = config()?.defaultTextString ?? '';
    return Array.isArray(defaultText) ? defaultText : [defaultText];
  });

  const index = createMemo(() => {
    const progress = currentTime() - props.line.timeInMs;
    const total = props.line.duration;

    const percentage = Math.min(1, progress / total);
    return Math.max(0, Math.floor((states().length - 1) * percentage));
  });

  return (
    <div
      class={`synced-line ${props.status}`}
      onClick={() => {
        _ytAPI?.seekTo((props.line.timeInMs + 10) / 1000);
      }}
    >
      <div class="description ytmusic-description-shelf-renderer" dir="auto">
        <yt-formatted-string
          text={{
            runs: [
              {
                text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
              },
            ],
          }}
        />

        <div class="text-lyrics">
          <span>
            <span>
              <Show
                fallback={
                  <yt-formatted-string
                    text={{ runs: [{ text: states()[0] }] }}
                  />
                }
                when={states().length > 1}
              >
                <yt-formatted-string
                  text={{
                    runs: [
                      {
                        text: states().at(
                          props.status === 'current' ? index() : -1,
                        )!,
                      },
                    ],
                  }}
                />
              </Show>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

/** The words of a line, revealed one after the other by the line effects */
const AnimatedWords = (props: { text: string }) => (
  <For each={props.text.split(' ')}>
    {(word, index) => (
      <span
        style={{
          'transition-delay': `${index() * 0.05}s`,
          'animation-delay': `${index() * 0.05}s`,
        }}
      >
        <yt-formatted-string
          text={{
            runs: [{ text: `${word} ` }],
          }}
        />
      </span>
    )}
  </For>
);

export const SyncedLine = (props: SyncedLineProps) => {
  const text = createMemo(() => {
    let line = props.line.text;
    const convertChineseText = config()?.convertChineseCharacter;
    if (convertChineseText && convertChineseText !== 'disabled') {
      line = convertChineseCharacter(line, convertChineseText);
    }
    return line.trim();
  });

  const [romanization, setRomanization] = createSignal('');
  createEffect(() => {
    const input = canonicalize(text());
    if (!config()?.romanization) return;

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

  // SyncedLine receives `props.index` from the VList iteration. The list is
  // [lyricsPicker, ...lines], so the lyric line index is `props.index - 1`.
  const translation = createMemo(() => {
    if (!effectiveTranslation(config())?.enabled) return '';
    const videoId = lyricsStore.videoId;
    if (!videoId) return '';
    const lyricIndex = props.index - 1;
    return getLineTranslation(videoId, lyricIndex) ?? '';
  });

  return (
    <Show fallback={<EmptyLine {...props} />} when={text()}>
      <div
        class={`synced-line ${props.status}`}
        onClick={() => {
          _ytAPI?.seekTo((props.line.timeInMs + 10) / 1000);
        }}
      >
        <div class="description ytmusic-description-shelf-renderer">
          <yt-formatted-string
            text={{
              runs: [
                {
                  text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
                },
              ],
            }}
          />
          <div
            class="text-lyrics"
            ref={(div: HTMLDivElement) => {
              // TODO: Investigate the animation, even though the duration is properly set, all lines have the same animation duration
              // Guard against non-finite durations (the last line has duration: Infinity)
              const duration = Number.isFinite(props.line.duration)
                ? props.line.duration
                : 0;
              div.style.setProperty(
                '--lyrics-duration',
                `${duration / 1000}s`,
                'important',
              );
            }}
            style={{ 'display': 'flex', 'flex-direction': 'column' }}
          >
            <span dir="auto">
              <AnimatedWords text={text()} />
            </span>

            <Show
              when={
                config()?.romanization &&
                simplifyUnicode(text()) !== simplifyUnicode(romanization())
              }
            >
              <span class="romaji" dir="auto">
                <AnimatedWords text={romanization()} />
              </span>
            </Show>

            <Show
              when={
                config()?.koreanPronunciation &&
                koreanPronunciation() &&
                simplifyUnicode(text()) !==
                  simplifyUnicode(koreanPronunciation())
              }
            >
              <span class="korean-pronunciation" dir="auto">
                <AnimatedWords text={koreanPronunciation()} />
              </span>
            </Show>

            <Show
              when={
                translation() &&
                simplifyUnicode(text()) !== simplifyUnicode(translation())
              }
            >
              <span class="translation" dir="auto">
                <AnimatedWords text={translation()} />
              </span>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
