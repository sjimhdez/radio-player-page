/**
 * Visualizer function type
 * Function signature for audio visualizer implementations
 *
 * Note: This is a duplicate type definition. The main type is defined in use-audio-visualizer.tsx
 * Kept here for alternative import paths
 *
 * @param canvasCtx - Canvas 2D rendering context
 * @param dataArray - Audio data array (time or frequency domain)
 * @param canvas - HTML canvas element
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 */
export type VisualizerFn = (
  canvasCtx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => void
