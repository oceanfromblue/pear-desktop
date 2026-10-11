import { LoggerPrefix } from '@/utils';

import { getMediaElement } from './media-element';

import type { MusicPlayer } from '@/types/music-player';

const AUDIO_ONLY_ATTRIBUTE = 'peard-audio-only';

/**
 * Makes the player believe it runs on an audio only device (the player's own
 * `deviceIsAudioOnly` flag, used by YouTube's background audio players),
 * so it creates an `<audio>` element and never downloads or decodes the video.
 *
 * The flag is read from the player configuration when the player is created,
 * so this must run before the page scripts (it is a no-op otherwise).
 */
export const forceAudioOnlyPlayer = () => {
  Object.defineProperty(Object.prototype, 'deviceIsAudioOnly', {
    get: () => true,
    set: () => {},
    enumerable: false,
    configurable: true,
  });

  document.documentElement.setAttribute(AUDIO_ONLY_ATTRIBUTE, '');
};

const audioOnlyStyle = `
  /* There is no video to show, show the album art / thumbnail instead */
  html[${AUDIO_ONLY_ATTRIBUTE}] #song-video.ytmusic-player {
    display: none !important;
  }
  html[${AUDIO_ONLY_ATTRIBUTE}] #song-image.ytmusic-player {
    display: block !important;
  }
`;

export const setupAudioOnlyMode = (api: MusicPlayer) => {
  const mediaElement = getMediaElement();
  if (!(mediaElement instanceof HTMLAudioElement)) {
    // e.g. the player changed and doesn't support the flag anymore: it plays the video as usual
    console.warn(
      LoggerPrefix,
      'Audio only mode is enabled, but the player still uses a video element',
    );
    document.documentElement.removeAttribute(AUDIO_ONLY_ATTRIBUTE);
    return;
  }

  const style = document.createElement('style');
  style.textContent = audioOnlyStyle;
  document.head.appendChild(style);

  const getThumbnail = () =>
    api
      .getPlayerResponse()
      ?.videoDetails?.thumbnail?.thumbnails?.at(-1)
      ?.url.split('?')[0];

  // In video mode the page doesn't load the image (it uses a placeholder)
  const fixImage = () => {
    const image = document.querySelector<HTMLImageElement>(
      '#song-image #img.style-scope.yt-img-shadow',
    );
    if (!image) return;

    const src = image.getAttribute('src');
    if (!src || src.startsWith('data:')) {
      const thumbnail = getThumbnail();
      if (thumbnail) image.src = thumbnail;
    }
  };

  const image = document.querySelector(
    '#song-image #img.style-scope.yt-img-shadow',
  );
  if (image) {
    new MutationObserver(fixImage).observe(image, {
      attributeFilter: ['src'],
    });
  }

  api.addEventListener('videodatachange', (name) => {
    if (name === 'dataloaded') fixImage();
  });
  fixImage();
};
