// Contract of the visualizers in the player core: plain TypeScript, without
// React. Each visualizer is a factory whose instance keeps its
// own drawing state; the randomness comes in as a dependency and the time with
// each frame.

/**
 * Audio data a visualizer draws: `time` is the waveform and `frequency` the
 * spectrum. `other` gets the waveform too: useAudioVisualizer only tells
 * `frequency` apart.
 */
export type VisualizerDataType = 'time' | 'frequency' | 'other'

/** What a visualizer gets on each frame besides the context and the data */
export interface VisualizerFrame {
  /** Drawing width in CSS pixels */
  width: number
  /** Drawing height in CSS pixels */
  height: number
  /** Time of the frame in milliseconds (the requestAnimationFrame timestamp) */
  time: number
}

/** A visualizer instance: draws one frame of audio data on a 2D context */
export interface Visualizer {
  draw(ctx: CanvasRenderingContext2D, data: Uint8Array, frame: VisualizerFrame): void
}

/** Dependencies of a visualizer, with the globals as defaults */
export interface VisualizerDeps {
  /** Random number in [0, 1) (default: Math.random) */
  random?: () => number
}

/** Creates a visualizer instance with a fresh drawing state */
export type CreateVisualizer = (deps?: VisualizerDeps) => Visualizer

/** A visualizer of the catalog: its metadata and its factory */
export interface VisualizerDefinition {
  /** Unique identifier (the value of RADPLAPAG_CONFIG.visualizer) */
  id: string
  /** Audio data this visualizer draws */
  dataType: VisualizerDataType
  /** Whether the station info stays centered while it draws, instead of moving up */
  forceVerticalCenter?: boolean
  /** Creates an instance to draw with */
  create: CreateVisualizer
}
