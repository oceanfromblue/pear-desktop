import Butterchurn from 'butterchurn';
import ButterchurnPresets from 'butterchurn-presets';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class ButterchurnVisualizer extends Visualizer {
  private readonly visualizer: ReturnType<typeof Butterchurn.createVisualizer>;
  private destroyed: boolean = false;
  private animFrameHandle: number | null;

  constructor(
    audioContext: AudioContext,
    audioSource: MediaElementAudioSourceNode,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    config: VisualizerPluginConfig,
  ) {
    super(audioSource, audioNode);

    const preset = ButterchurnPresets[config.butterchurn.preset];
    const renderVisualizer = () => {
      if (this.destroyed) return;
      // A WebGL frame per screen refresh: not while paused or off screen
      if (this.shouldDraw) this.visualizer.render();
      this.animFrameHandle = requestAnimationFrame(renderVisualizer);
    };

    this.visualizer = Butterchurn.createVisualizer(audioContext, canvas, {
      width: canvas.width,
      height: canvas.height,
    });
    this.visualizer.loadPreset(preset, config.butterchurn.blendTimeInSeconds);
    this.visualizer.connectAudio(audioNode);
    this.watchCanvas(canvas);

    // Start animation request loop. Do not use setInterval!
    this.animFrameHandle = requestAnimationFrame(renderVisualizer);
  }

  resize(width: number, height: number) {
    this.visualizer.setRendererSize(width, height);
  }

  destroy() {
    if (this.animFrameHandle) cancelAnimationFrame(this.animFrameHandle);
    this.destroyed = true;
    this.unwatchCanvas();
    try {
      this.visualizer.disconnectAudio(this.audioNode);
      this.audioSource.disconnect(this.audioNode);
    } catch {}
    // Free its WebGL context now instead of whenever it gets garbage collected
    try {
      this.visualizer.loseGLContext();
    } catch {}
  }
}

export default ButterchurnVisualizer;
