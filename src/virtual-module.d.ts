declare module 'virtual:plugins' {
  import type { PluginConfig, PluginDef } from '@/types/plugins';

  type Plugin = PluginDef<unknown, unknown, unknown, PluginConfig>;

  export const mainPlugins: () => Promise<Record<string, Plugin>>;
  export const preloadPlugins: () => Promise<Record<string, Plugin>>;
  export const rendererPlugins: () => Promise<Record<string, Plugin>>;
  /** Renderer only: the ids of every plugin (including the ones without a renderer) */
  export const rendererPluginIds: string[];
  /** Renderer only: load a single plugin, `undefined` if it has no renderer or is not supported */
  export const rendererPlugin: (id: string) => Promise<Plugin | undefined>;

  export const allPlugins: () => Promise<
    Record<string, Omit<Plugin, 'backend' | 'preload' | 'renderer'>>
  >;
}

declare module 'virtual:i18n' {
  import type { LanguageResources } from '@/i18n/resources/@types';

  export const languageNames: Record<
    string,
    { name?: string; localName?: string }
  >;
  export const availableLanguages: string[];
  export const loadLanguageResource: (
    language: string,
  ) => Promise<LanguageResources[string]['translation'] | undefined>;
}
