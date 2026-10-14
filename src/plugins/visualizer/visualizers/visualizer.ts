export abstract class Visualizer {
  protected audioNode: GainNode;
  protected audioSource: MediaElementAudioSourceNode;

  private canvasObserver: IntersectionObserver | null = null;
  private canvasOnScreen = true;

  protected constructor(
    _audioSource: MediaElementAudioSourceNode,
    _audioNode: GainNode,
  ) {
    this.audioNode = _audioNode;
    this.audioSource = _audioSource;
  }

  /** Tracks whether `canvas` can be seen (the player page can be closed) */
  protected watchCanvas(canvas: HTMLCanvasElement) {
    this.canvasObserver = new IntersectionObserver((entries) => {
      this.canvasOnScreen = entries.at(-1)?.isIntersecting ?? true;
    });
    this.canvasObserver.observe(canvas);
  }

  protected unwatchCanvas() {
    this.canvasObserver?.disconnect();
    this.canvasObserver = null;
  }

  /** A frame is only worth drawing while playing, with the canvas on screen */
  protected get shouldDraw() {
    return this.canvasOnScreen && !this.audioSource.mediaElement.paused;
  }

  abstract resize(width: number, height: number): void;
  abstract destroy(): void;
}
