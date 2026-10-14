import { getMediaElement } from '@/providers/media-element';

import type { SkipSilencesPluginConfig } from './index';
import type { RendererContext } from '@/types/contexts';

let config: SkipSilencesPluginConfig;

let isSilent = false;
let hasAudioStarted = false;

let loopTimer: number | undefined;

const smoothing = 0.1;
const threshold = -100; // DB (-100 = absolute silence, 0 = loudest)
const interval = 2; // Ms
const history = 10;
const speakingHistory = Array.from({ length: history }).fill(0) as number[];

let playOrSeekHandler: (() => void) | undefined;
// The audio graph is created once and kept for every song (the event below is
// sent for each of them): the analyser is only set up once
let analyserSource: AudioNode | undefined;
let analyser: AnalyserNode | undefined;
let listenedMedia: HTMLMediaElement | null = null;

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

const stopLoop = () => {
  if (loopTimer !== undefined) {
    clearTimeout(loopTimer);
    loopTimer = undefined;
  }
};

const stopAnalyser = () => {
  stopLoop();
  try {
    if (analyser) analyserSource?.disconnect(analyser);
  } catch {}
  analyserSource = undefined;
  analyser = undefined;

  if (playOrSeekHandler) {
    listenedMedia?.removeEventListener('play', playOrSeekHandler);
    listenedMedia?.removeEventListener('seeked', playOrSeekHandler);
    playOrSeekHandler = undefined;
  }
  listenedMedia = null;
};

const audioCanPlayListener = (e: CustomEvent<Compressor>) => {
  const sourceNode = e.detail.audioSource;
  // Already analysing this audio: don't add another analyser (it would be
  // processed for every audio frame), loop and listeners for each song
  if (analyserSource === sourceNode) return;
  stopAnalyser();

  // A <video>, or an <audio> in audio only mode
  const video = getMediaElement();
  const { audioContext } = e.detail;

  const songAnalyser = audioContext.createAnalyser();
  songAnalyser.fftSize = 512;
  songAnalyser.smoothingTimeConstant = smoothing;
  const fftBins = new Float32Array(songAnalyser.frequencyBinCount);

  sourceNode.connect(songAnalyser);
  analyserSource = sourceNode;
  analyser = songAnalyser;

  const skipSilence = () => {
    if (config.onlySkipBeginning && hasAudioStarted) {
      return;
    }

    if (isSilent && video && !video.paused) {
      video.currentTime += 0.2; // In s
    }
  };

  const looper = () => {
    loopTimer = window.setTimeout(() => {
      loopTimer = undefined;
      // Nothing to detect while paused (the loop runs every few ms):
      // the 'play' listener below starts it again
      if (video?.paused) return;

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

  playOrSeekHandler = () => {
    hasAudioStarted = false;
    skipSilence();
    if (loopTimer === undefined) looper();
  };

  listenedMedia = video;
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
