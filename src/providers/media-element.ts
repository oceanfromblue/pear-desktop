/**
 * Returns the media element of the player.
 *
 * It is usually a `<video>`, but the player uses an `<audio>` element
 * (with the same classes) in audio only mode, so `document.querySelector('video')`
 * must not be used to access the playing media.
 */
export const getMediaElement = () =>
  document.querySelector<HTMLMediaElement>('video') ??
  document.querySelector<HTMLMediaElement>(
    '#movie_player audio.html5-main-video, #movie_player audio',
  );
