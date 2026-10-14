import {
  contextBridge,
  ipcRenderer,
  type IpcRendererEvent,
  webFrame,
} from 'electron';
import is from 'electron-is';

import { loadI18n, setLanguage } from '@/i18n';

import * as config from './config';
import {
  forceLoadPreloadPlugin,
  forceUnloadPreloadPlugin,
  loadAllPreloadPlugins,
} from './loader/preload';

// @ts-expect-error dummy
globalThis.customElements = { define() {} };

const adapterScriptObserver = new MutationObserver((mutations, observer) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      const elem = node as HTMLElement;
      if (elem.tagName !== 'SCRIPT') continue;

      const script = elem as HTMLScriptElement;
      if (
        !script.getAttribute('src')?.endsWith('custom-elements-es5-adapter.js')
      )
        continue;

      script.remove();

      observer.disconnect();
      return;
    }
  }
});
adapterScriptObserver.observe(document, { subtree: true, childList: true });
// The adapter is a parser-inserted script: if it isn't there once the page is loaded,
// it never will be (don't keep observing every DOM change for the whole session)
window.addEventListener('load', () => adapterScriptObserver.disconnect(), {
  once: true,
});

loadI18n()
  .then(async () => {
    await setLanguage(config.get('options.language') ?? 'en');
    await loadAllPreloadPlugins();
  })
  .catch((err) => {
    console.error('Failed to load preload plugins:', err);
  });

// While nobody can see the page (e.g. hidden in the tray), free the memory it doesn't need:
// clears Blink's memory cache and sends a memory pressure signal (garbage collection, caches)
const TRIM_MEMORY_DELAY_MS = 60_000;
const TRIM_MEMORY_INTERVAL_MS = 15 * 60_000;
let trimMemoryTimeout: ReturnType<typeof setTimeout> | undefined;
const scheduleMemoryTrim = (delay: number) => {
  trimMemoryTimeout = setTimeout(() => {
    if (document.visibilityState !== 'hidden') return;

    webFrame.clearCache();
    // The memory grows back while playing in the background
    scheduleMemoryTrim(TRIM_MEMORY_INTERVAL_MS);
  }, delay);
};
// On `window` in the capture phase: the page stops the event there (renderer.ts),
// this listener being registered before it runs first. The page's override of
// `document.visibilityState` doesn't reach this (isolated) world.
window.addEventListener(
  'visibilitychange',
  () => {
    clearTimeout(trimMemoryTimeout);
    if (document.visibilityState === 'hidden') {
      scheduleMemoryTrim(TRIM_MEMORY_DELAY_MS);
    }
  },
  true,
);
// A page loaded while the window is hidden doesn't get the event
if (document.visibilityState === 'hidden') {
  scheduleMemoryTrim(TRIM_MEMORY_DELAY_MS);
}

ipcRenderer.on('plugin:unload', async (_, id: string) => {
  await forceUnloadPreloadPlugin(id);
});
ipcRenderer.on('plugin:enable', async (_, id: string) => {
  await forceLoadPreloadPlugin(id);
});

contextBridge.exposeInMainWorld('mainConfig', config);
contextBridge.exposeInMainWorld('electronIs', is);
contextBridge.exposeInMainWorld('ipcRenderer', {
  // Returns the function removing the listener: `off` and `removeListener`
  // can't find it, a function crossing the context bridge arrives here as a
  // new one every time
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => {
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  off: (channel: string, listener: (...args: unknown[]) => void) =>
    ipcRenderer.off(channel, listener),
  once: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void,
  ) => ipcRenderer.once(channel, listener),
  send: (channel: string, ...args: unknown[]) =>
    ipcRenderer.send(channel, ...args),
  removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
    ipcRenderer.removeListener(channel, listener),
  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel),
  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),
  sendSync: (channel: string, ...args: unknown[]): unknown =>
    ipcRenderer.sendSync(channel, ...args),
  sendToHost: (channel: string, ...args: unknown[]) =>
    ipcRenderer.sendToHost(channel, ...args),
});
contextBridge.exposeInMainWorld('reload', () =>
  ipcRenderer.send('peard:reload'),
);
contextBridge.exposeInMainWorld(
  'ELECTRON_RENDERER_URL',
  process.env.ELECTRON_RENDERER_URL,
);

const [path, script] = ipcRenderer.sendSync('get-renderer-script') as [
  string | null,
  string,
];
let blocked = true;
if (path) {
  webFrame.executeJavaScriptInIsolatedWorld(
    0,
    [
      {
        code: script,
        url: path,
      },
    ],
    true,
    () => (blocked = false),
  );
} else {
  webFrame.executeJavaScript(script, true, () => (blocked = false));
}

// HACK: Wait for the script to be executed (with timeout safety)
// Use a self-invoking async function to avoid top-level await (CJS output)
(async () => {
  if (!path && !script) return;

  const startTime = Date.now();
  const TIMEOUT = 10_000;
  while (blocked && Date.now() - startTime < TIMEOUT) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
})();
