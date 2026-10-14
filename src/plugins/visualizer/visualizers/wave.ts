import { Wave } from '@foobar404/wave';

import { Visualizer } from './visualizer';

import type { VisualizerPluginConfig } from '../index';

interface WaveAnimation {
  draw(data: Uint8Array, context: CanvasRenderingContext2D): void;
}

class WaveVisualizer extends Visualizer {
  private readonly analyser: AnalyserNode;
  private readonly animations: WaveAnimation[] = [];
  private animationFrame: number | null = null;

  constructor(
    audioContext: AudioContext,
    audioSource: MediaElementAudioSourceNode,
    canvas: HTMLCanvasElement,
    audioNode: GainNode,
    config: VisualizerPluginConfig,
  ) {
    super(audioSource, audioNode);

    // Without audio, Wave doesn't start its own animation loop: that loop can't
    // be stopped, it would keep running (and analysing the audio) forever
    // after this visualizer is replaced. The animations are drawn below instead.
    const wave = new Wave(undefined as never, canvas);
    for (const animation of config.wave.animations) {
      const Animation =
        wave.animations[animation.type as keyof typeof wave.animations];
      this.animations.push(new Animation(animation.config as never));
    }

    // Same as Wave's own analyser
    this.analyser = audioContext.createAnalyser();
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.fftSize = 1024;
    audioSource.connect(this.analyser);

    const context = canvas.getContext('2d')!;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.watchCanvas(canvas);
    const draw = () => {
      this.animationFrame = requestAnimationFrame(draw);
      if (!this.shouldDraw) return;

      this.analyser.getByteFrequencyData(data);
      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const animation of this.animations) animation.draw(data, context);
    };
    draw();
  }

  resize(_: number, __: number) {}

  destroy() {
    if (this.animationFrame !== null) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    this.unwatchCanvas();
    try {
      this.audioSource.disconnect(this.analyser);
    } catch {}
    try {
      this.audioSource.disconnect(this.audioNode);
    } catch {}
  }
}

export default WaveVisualizer;
