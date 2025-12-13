export type VisualizerFn = (
  canvasCtx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => void
