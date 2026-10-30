import type { CreateVisualizer } from 'src/core/visualizers/types'

const CONFIG = {
  /** Color of the wave, the cyan of the peak lines of the bars */
  WAVE_COLOR: 'rgba(19, 181, 210, 0.78)',
  /** Color of the horizontal axis, a dim gray so the wave stands out */
  AXIS_COLOR: '#555',
  /** Width of the axis, in CSS pixels */
  AXIS_LINE_WIDTH: 1,
  /** Width of the wave, in CSS pixels */
  WAVE_LINE_WIDTH: 2,
  /** Value of the time domain data (0–255) with no signal: the axis */
  DATA_CENTER_VALUE: 128,
} as const

/**
 * Y of a value of the time domain data: the full range spans the height of the
 * canvas, centered on centerY, rounded and kept inside the canvas.
 */
function calculateWaveY(dataValue: number, centerY: number, canvasHeight: number): number {
  let y =
    centerY -
    ((dataValue - CONFIG.DATA_CENTER_VALUE) / CONFIG.DATA_CENTER_VALUE) * (canvasHeight / 2)

  y = Math.min(canvasHeight, Math.max(0, Math.round(y)))

  return y
}

/** Draws the horizontal axis across the canvas at centerY */
function drawCenterAxis(ctx: CanvasRenderingContext2D, width: number, centerY: number): void {
  ctx.strokeStyle = CONFIG.AXIS_COLOR
  ctx.lineWidth = CONFIG.AXIS_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
}

/** Draws the wave as one line through every value, spread over the width */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  width: number,
  centerY: number,
  height: number,
): void {
  ctx.strokeStyle = CONFIG.WAVE_COLOR
  ctx.lineWidth = CONFIG.WAVE_LINE_WIDTH
  ctx.beginPath()

  const sliceWidth = width / dataArray.length

  for (let i = 0; i < dataArray.length; i++) {
    const x = i * sliceWidth
    const y = calculateWaveY(dataArray[i], centerY, height)

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
}

/** Oscilloscope: the waveform as a line over a horizontal axis, without state */
export const createOscilloscopeVisualizer: CreateVisualizer = () => ({
  draw(ctx, dataArray, { width, height }) {
    const centerY = height / 2

    ctx.clearRect(0, 0, width, height)

    drawCenterAxis(ctx, width, centerY)

    drawWaveform(ctx, dataArray, width, centerY, height)
  },
})
