import { t } from '@/i18n';
import { createPlugin } from '@/utils';

import { EqualizerPresets } from './EqualizerPresets';
import {
  defaultPresets,
  presetConfigs,
  type Preset,
  type FilterConfig,
} from './presets';

import type { MenuTemplate } from '@/menu';
import type { MenuContext } from '@/types/contexts';

export type EqualizerPluginConfig = {
  enabled: boolean;
  filters: FilterConfig[];
  presets: { [preset in Preset]: boolean };
};

let appliedFilters: BiquadFilterNode[] = [];
let audioSourceNode: AudioNode | null = null;
let audioCtx: AudioContext | null = null;

/** Takes the filters out of the audio graph, restoring the default path */
const removeFilters = () => {
  if (audioSourceNode && appliedFilters.length > 0) {
    try {
      audioSourceNode.disconnect(appliedFilters[0]);
    } catch {}
  }
  appliedFilters.forEach((filter) => filter.disconnect());
  appliedFilters = [];

  if (audioSourceNode && audioCtx) {
    audioSourceNode.connect(audioCtx.destination);
  }
  audioSourceNode = null;
  audioCtx = null;
};

export default createPlugin({
  name: () => t('plugins.equalizer.name'),
  description: () => t('plugins.equalizer.description'),
  restartNeeded: false,
  addedVersion: '3.7.X',
  config: {
    enabled: false,
    filters: [],
    presets: { 'bass-booster': false },
  } as EqualizerPluginConfig,
  settings: [
    {
      type: 'custom',
      key: 'presets',
      label: () => t('plugins.equalizer.menu.presets.label'),
      component: 'equalizer.presets',
      // The renderer reads the presets once, on start; a toggled preset only
      // reaches the audio graph after a restart.
      restartNeeded: true,
    },
  ],
  menu: async ({
    getConfig,
    setConfig,
  }: MenuContext<EqualizerPluginConfig>): Promise<MenuTemplate> => {
    const config = await getConfig();

    return [
      {
        label: t('plugins.equalizer.menu.presets.label'),
        type: 'submenu',
        submenu: defaultPresets.map((preset) => ({
          label: t(`plugins.equalizer.menu.presets.list.${preset}`),
          type: 'radio',
          checked: config.presets[preset],
          click() {
            setConfig({
              presets: { ...config.presets, [preset]: !config.presets[preset] },
            });
          },
        })),
      },
    ];
  },
  renderer: {
    components: { presets: EqualizerPresets },
    audioCanPlayListener: null as
      | ((event: CustomEvent<Compressor>) => void)
      | null,
    async start({ getConfig }) {
      const config = await getConfig();

      this.audioCanPlayListener = ({
        detail: { audioSource, audioContext },
      }) => {
        // This event is sent for every song, but the audio graph stays the
        // same: the filters are only inserted once
        if (audioSourceNode === audioSource) return;

        const filtersToApply = config.filters.concat(
          defaultPresets
            .filter((preset) => config.presets[preset])
            .map((preset) => presetConfigs[preset]),
        );

        if (filtersToApply.length === 0) return;

        removeFilters();
        audioSourceNode = audioSource;
        audioCtx = audioContext;

        // Disconnect default path to avoid parallel audio
        try {
          audioSource.disconnect(audioContext.destination);
        } catch {}

        let lastNode: AudioNode = audioSource;
        filtersToApply.forEach((filter) => {
          const biquadFilter = audioContext.createBiquadFilter();
          biquadFilter.type = filter.type;
          biquadFilter.frequency.value = filter.frequency;
          biquadFilter.Q.value = filter.Q;
          biquadFilter.gain.value = filter.gain;

          lastNode.connect(biquadFilter);
          lastNode = biquadFilter;

          appliedFilters.push(biquadFilter);
        });
        lastNode.connect(audioContext.destination);
      };

      document.addEventListener(
        'peard:audio-can-play',
        this.audioCanPlayListener,
      );
    },
    stop() {
      if (this.audioCanPlayListener) {
        document.removeEventListener(
          'peard:audio-can-play',
          this.audioCanPlayListener,
        );
        this.audioCanPlayListener = null;
      }

      removeFilters();
    },
  },
});
