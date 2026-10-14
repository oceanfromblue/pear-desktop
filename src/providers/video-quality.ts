import {
  isPageHidden,
  onPageVisibilityChange,
} from '@/providers/page-visibility';
import { LoggerPrefix } from '@/utils';

import type { MusicPlayer } from '@/types/music-player';

/**
 * Lowers the video quality to the minimum while nobody can see the video,
 * so the player doesn't download, buffer and decode HD video for nothing
 * (and restores the user's quality as soon as the video is visible again).
 */
export type VideoHiddenReason =
  // "Song" tracks (ATV): the player shows the album art instead of their still image video
  | 'art-track'
  // video-toggle plugin: video switched off by the user
  | 'video-toggle'
  // video-toggle plugin: "force hide" option
  | 'video-force-hide'
  // audio-only plugin
  | 'audio-only-plugin'
  // the window has been hidden/minimized for a while
  | 'window-hidden';

// The player stores the selected quality range as the preference for every video
const QUALITY_PREFERENCE_KEY = 'yt-player-quality';
// Avoid switching back and forth when the window is only hidden briefly (alt-tab, occlusion)
const WINDOW_HIDDEN_DELAY_MS = 30_000;
const MAX_ATTEMPTS_PER_VIDEO = 3;

const hiddenReasons = new Set<VideoHiddenReason>();
let player: MusicPlayer | null = null;
// Video id the lowest quality was applied to (null when the quality is automatic)
let cappedVideoId: string | null = null;
// Video id the user manually picked a quality for (e.g. with the quality-changer plugin)
let manualQualityVideoId: string | null = null;
let attempts = 0;
// Quality to restore when the video is visible again ('auto' unless the user picked one)
let userQuality: string | null = null;
// The stored preference before the quality was lowered (null: nothing was stored)
let savedPreference: { value: string | null } | null = null;
let preferenceRestoreTimeouts: number[] = [];

const QUALITY_REGEX = /^(?:auto|tiny|small|medium|large|highres|hd\d+)$/;

const getVideoId = () => player?.getVideoData()?.video_id || null;

const getLowestQuality = () =>
  player
    ?.getAvailableQualityLevels()
    ?.filter((quality) => quality && quality !== 'auto')
    .at(-1) ?? 'tiny';

const cancelPreferenceRestore = () => {
  preferenceRestoreTimeouts.forEach((timeout) => clearTimeout(timeout));
  preferenceRestoreTimeouts = [];
};

const restorePreference = () => {
  if (!savedPreference) return;

  try {
    if (savedPreference.value === null) {
      localStorage.removeItem(QUALITY_PREFERENCE_KEY);
    } else {
      localStorage.setItem(QUALITY_PREFERENCE_KEY, savedPreference.value);
    }
  } catch {}
};

const keepQualityPreference = (callback: () => void) => {
  cancelPreferenceRestore();

  // Only read it once: afterwards it can contain the quality set below
  if (!savedPreference) {
    let value: string | null = null;
    try {
      value = localStorage.getItem(QUALITY_PREFERENCE_KEY);
    } catch {}
    savedPreference = { value };
  }

  callback();

  restorePreference();
  // The player can also persist it a bit later
  preferenceRestoreTimeouts.push(
    window.setTimeout(restorePreference, 1_000),
    window.setTimeout(() => {
      restorePreference();
      if (!cappedVideoId) savedPreference = null;
    }, 5_000),
  );
};

const getUserQuality = () => {
  try {
    const preference = player?.getUserPlaybackQualityPreference<[], unknown>();
    if (typeof preference === 'string' && QUALITY_REGEX.test(preference)) {
      return preference;
    }
  } catch {}

  return 'auto';
};

const setQuality = (quality: string) =>
  keepQualityPreference(() => {
    player?.setPlaybackQualityRange(quality, quality);
    player?.setPlaybackQuality(quality);
  });

const updateVideoQuality = () => {
  if (!player) return;

  const videoId = getVideoId();
  // Changing the quality before the video is loaded can stall the player,
  // this is called again on the next state change
  if (!videoId || player.getPlaybackQuality() === 'unknown') return;

  const shouldLowerQuality =
    hiddenReasons.size > 0 &&
    !document.pictureInPictureElement &&
    manualQualityVideoId !== videoId;

  try {
    if (shouldLowerQuality) {
      const lowestQuality = getLowestQuality();
      if (
        cappedVideoId === videoId &&
        player.getPlaybackQuality() === lowestQuality
      ) {
        return;
      }
      if (attempts >= MAX_ATTEMPTS_PER_VIDEO) return;

      attempts++;
      // Remember the quality used before lowering it the first time
      if (!cappedVideoId) userQuality ??= getUserQuality();
      setQuality(lowestQuality);
      cappedVideoId = videoId;
    } else if (cappedVideoId) {
      cappedVideoId = null;
      setQuality(userQuality ?? 'auto');
    }
  } catch (error) {
    console.warn(LoggerPrefix, 'Failed to change the video quality', error);
  }
};

export const setVideoHidden = (reason: VideoHiddenReason, hidden: boolean) => {
  if (hidden === hiddenReasons.has(reason)) return;

  if (hidden) {
    hiddenReasons.add(reason);
  } else {
    hiddenReasons.delete(reason);
  }

  attempts = 0;
  updateVideoQuality();
};

/**
 * The user picked a quality for the current video: don't change it,
 * and restore it (instead of the automatic quality) after lowering the quality
 */
export const setManualVideoQuality = (quality: string) => {
  // Keep the preference stored by the player for this choice
  cancelPreferenceRestore();
  savedPreference = null;

  manualQualityVideoId = getVideoId();
  cappedVideoId = null;
  userQuality = quality;
};

export const setupVideoQualityManager = (api: MusicPlayer) => {
  if (player) return;
  player = api;

  const updateArtTrack = () => {
    const isArtTrack =
      api.getPlayerResponse()?.videoDetails?.musicVideoType ===
      'MUSIC_VIDEO_TYPE_ATV';
    if (isArtTrack) {
      hiddenReasons.add('art-track');
    } else {
      hiddenReasons.delete('art-track');
    }
  };

  api.addEventListener('videodatachange', (name) => {
    if (name !== 'dataloaded') return;

    manualQualityVideoId = null;
    attempts = 0;
    updateArtTrack();
    updateVideoQuality();
  });
  // Retry once the player is ready, and when it changes the quality by itself
  api.addEventListener('onStateChange', updateVideoQuality);
  api.addEventListener('onPlaybackQualityChange', updateVideoQuality);

  let windowHiddenTimeout: number | undefined;
  const onVisibilityChange = () => {
    clearTimeout(windowHiddenTimeout);
    if (isPageHidden()) {
      windowHiddenTimeout = window.setTimeout(
        () => setVideoHidden('window-hidden', true),
        WINDOW_HIDDEN_DELAY_MS,
      );
    } else {
      setVideoHidden('window-hidden', false);
    }
  };
  onPageVisibilityChange(onVisibilityChange);
  // The app can start hidden (e.g. in the tray)
  onVisibilityChange();

  document.addEventListener('enterpictureinpicture', updateVideoQuality, true);
  document.addEventListener('leavepictureinpicture', updateVideoQuality, true);

  updateArtTrack();
  updateVideoQuality();
};
