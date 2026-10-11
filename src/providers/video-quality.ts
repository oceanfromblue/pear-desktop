import { LoggerPrefix } from '@/utils';

import type { MusicPlayer } from '@/types/music-player';

/**
 * Lowers the video quality to the minimum while nobody can see the video,
 * so the player doesn't download, buffer and decode HD video for nothing
 * (and restores the automatic quality as soon as the video is visible again).
 */
export type VideoHiddenReason =
  // "Song" tracks (ATV): the player shows the album art instead of their still image video
  | 'art-track'
  // video-toggle plugin: video switched off by the user
  | 'video-toggle'
  // video-toggle plugin: "force hide" option
  | 'video-force-hide'
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
let preferenceRestoreTimeouts: number[] = [];

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

const keepQualityPreference = (callback: () => void) => {
  cancelPreferenceRestore();

  let preference: string | null = null;
  try {
    preference = localStorage.getItem(QUALITY_PREFERENCE_KEY);
  } catch {}

  callback();

  const restore = () => {
    try {
      if (preference === null) {
        localStorage.removeItem(QUALITY_PREFERENCE_KEY);
      } else {
        localStorage.setItem(QUALITY_PREFERENCE_KEY, preference);
      }
    } catch {}
  };
  restore();
  // The player can also persist it a bit later
  preferenceRestoreTimeouts = [
    window.setTimeout(restore, 1_000),
    window.setTimeout(restore, 5_000),
  ];
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
      setQuality(lowestQuality);
      cappedVideoId = videoId;
    } else if (cappedVideoId) {
      setQuality('auto');
      cappedVideoId = null;
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
 * The quality of the current video was picked by the user, don't change it
 */
export const setManualVideoQuality = () => {
  cancelPreferenceRestore();
  manualQualityVideoId = getVideoId();
  cappedVideoId = null;
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
    if (document.visibilityState === 'hidden') {
      windowHiddenTimeout = window.setTimeout(
        () => setVideoHidden('window-hidden', true),
        WINDOW_HIDDEN_DELAY_MS,
      );
    } else {
      setVideoHidden('window-hidden', false);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  // The app can start hidden (e.g. in the tray)
  onVisibilityChange();

  document.addEventListener('enterpictureinpicture', updateVideoQuality, true);
  document.addEventListener('leavepictureinpicture', updateVideoQuality, true);

  updateArtTrack();
  updateVideoQuality();
};
