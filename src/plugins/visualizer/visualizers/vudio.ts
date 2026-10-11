import Vudio from 'vudio/umd/vudio';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

class VudioVisualizer extends Visualizer {
  private readonly visualizer: Vudio;
  private readonly destination: MediaStreamAudioDestinationNode;

  constructor(
    audioContext: AudioContext,
    audioSource: MediaElementAudioSourceNode,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    config: VisualizerPluginConfig,
  ) {
    super(audioSource, audioNode);

    // An audio only stream: `captureStream()` on the media element would also capture
    // the video, which keeps it decoding even when the window is hidden
    this.destination = audioContext.createMediaStreamDestination();
    audioNode.connect(this.destination);

    this.visualizer = new Vudio(this.destination.stream, canvas, {
      width: canvas.width,
      height: canvas.height,
      // Visualizer config
      ...config.vudio,
    });

    this.visualizer.dance();
  }

  resize(width: number, height: number) {
    this.visualizer.setOption({
      width,
      height,
    });
  }

  destroy() {
    this.visualizer.pause();
    try {
      this.audioSource.disconnect(this.audioNode);
      this.audioNode.disconnect(this.destination);
    } catch {}
    this.destination.stream.getTracks().forEach((track) => track.stop());

    // Vudio creates its own AudioContext and never closes it
    const vudioContext = (
      this.visualizer as unknown as { analyser?: AnalyserNode }
    ).analyser?.context;
    if (vudioContext instanceof AudioContext) {
      vudioContext.close().catch(() => {});
    }
  }
}

export default VudioVisualizer;
