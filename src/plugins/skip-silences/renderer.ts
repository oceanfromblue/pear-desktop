import { getMediaElement } from '@/providers/media-element';

import type { SkipSilencesPluginConfig } from './index';
import type { RendererContext } from '@/types/contexts';

let config: SkipSilencesPluginConfig;

let isSilent = false;
let hasAudioStarted = false;

const smoothing = 0.1;
const threshold = -100; // DB (-100 = absolute silence, 0 = loudest)
const interval = 2; // Ms
const history = 10;
const speakingHistory = Array.from({ length: history }).fill(0) as number[];

let playOrSeekHandler: (() => void) | undefined;
// The audio graph is created once and kept for every song, so only set up the analyser once
let analyserSource: MediaElementAudioSourceNode | undefined;
let analyser: AnalyserNode | undefined;
let looperTimeout: number | undefined;

const getMaxVolume = (
  analyser: AnalyserNode,
  fftBins: Float32Array<ArrayBuffer>,
) => {
  let maxVolume = Number.NEGATIVE_INFINITY;
  analyser.getFloatFrequencyData(fftBins);

  for (let i = 4, ii = fftBins.length; i < ii; i++) {
    if (fftBins[i] > maxVolume && fftBins[i] < 0) {
      maxVolume = fftBins[i];
    }
  }

  return maxVolume;
};

const stopAnalyser = () => {
  clearTimeout(looperTimeout);
  looperTimeout = undefined;
  try {
    if (analyser) analyserSource?.disconnect(analyser);
  } catch {}
  analyserSource = undefined;
  analyser = undefined;

  if (playOrSeekHandler) {
    const video = getMediaElement();
    video?.removeEventListener('play', playOrSeekHandler);
    video?.removeEventListener('seeked', playOrSeekHandler);
    playOrSeekHandler = undefined;
  }
};

const audioCanPlayListener = (e: CustomEvent<Compressor>) => {
  // This event is sent for every song: don't add another analyser, loop and listeners
  if (analyserSource === e.detail.audioSource) return;
  stopAnalyser();

  const video = getMediaElement();
  const { audioContext } = e.detail;
  const sourceNode = e.detail.audioSource;

  // Use an audio analyser similar to Hark
  // https://github.com/otalk/hark/blob/master/hark.bundle.js
  const songAnalyser = audioContext.createAnalyser();
  songAnalyser.fftSize = 512;
  songAnalyser.smoothingTimeConstant = smoothing;
  const fftBins = new Float32Array(songAnalyser.frequencyBinCount);

  sourceNode.connect(songAnalyser);
  analyserSource = sourceNode;
  analyser = songAnalyser;

  const looper = () => {
    looperTimeout = window.setTimeout(() => {
      const currentVolume = getMaxVolume(songAnalyser, fftBins);

      let history = 0;
      if (currentVolume > threshold && isSilent) {
        // Trigger quickly, short history
        for (
          let i = speakingHistory.length - 3;
          i < speakingHistory.length;
          i++
        ) {
          history += speakingHistory[i];
        }

        if (history >= 2) {
          // Not silent
          isSilent = false;
          hasAudioStarted = true;
        }
      } else if (currentVolume < threshold && !isSilent) {
        for (const element of speakingHistory) {
          history += element;
        }

        if (
          history == 0 && // Silent
          !(
            video &&
            (video.paused ||
              video.seeking ||
              video.ended ||
              video.muted ||
              video.volume === 0)
          )
        ) {
          isSilent = true;
          skipSilence();
        }
      }

      speakingHistory.shift();
      speakingHistory.push(Number(currentVolume > threshold));

      looper();
    }, interval);
  };

  looper();

  const skipSilence = () => {
    if (config.onlySkipBeginning && hasAudioStarted) {
      return;
    }

    if (isSilent && video && !video.paused) {
      video.currentTime += 0.2; // In s
    }
  };

  playOrSeekHandler = () => {
    hasAudioStarted = false;
    skipSilence();
  };

  video?.addEventListener('play', playOrSeekHandler);
  video?.addEventListener('seeked', playOrSeekHandler);
};

export const onRendererLoad = async ({
  getConfig,
}: RendererContext<SkipSilencesPluginConfig>) => {
  config = await getConfig();

  document.addEventListener('peard:audio-can-play', audioCanPlayListener, {
    passive: true,
  });
};

export const onRendererUnload = () => {
  document.removeEventListener('peard:audio-can-play', audioCanPlayListener);

  stopAnalyser();
};
