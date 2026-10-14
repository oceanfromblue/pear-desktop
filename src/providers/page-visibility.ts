/**
 * The real visibility of the page.
 *
 * The renderer pins `document.hidden` and `document.visibilityState` to
 * "visible" and stops the `visibilitychange` event, so that YouTube Music
 * keeps playing in the background and never asks "Are you still there?".
 * The app's own features (e.g. lowering the video quality while nobody can
 * see it) still need to know: they use this instead.
 */
const visibilityStateGetter = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'visibilityState',
)?.get;

/** Sent on `document` in place of the stopped `visibilitychange` event */
export const PAGE_VISIBILITY_EVENT = 'peard:visibilitychange';

export const isPageHidden = () =>
  ((visibilityStateGetter?.call(document) as DocumentVisibilityState) ??
    document.visibilityState) === 'hidden';

/** Calls `listener` whenever the page is hidden or shown */
export const onPageVisibilityChange = (listener: () => void) => {
  // The native event until the renderer stops it, its replacement afterwards
  document.addEventListener('visibilitychange', listener);
  document.addEventListener(PAGE_VISIBILITY_EVENT, listener);

  return () => {
    document.removeEventListener('visibilitychange', listener);
    document.removeEventListener(PAGE_VISIBILITY_EVENT, listener);
  };
};
