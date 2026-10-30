import { createFrameStep, stepsOf } from 'src/core/visualizers/frame-time'
import type { CreateVisualizer } from 'src/core/visualizers/types'

const CONFIG = {
  /** Width of each column, in CSS pixels, with no gap between them */
  COLUMN_WIDTH: 2,
  /** Columns the waterfall moves to the left per 1/60 s */
  SCROLL_SPEED: 1,
  /** Color of every column, a translucent white */
  WAVEFORM_COLOR: 'rgba(255, 255, 255, 0.3)',
  /** Share of the way from the previous column to the new amplitude (0–1) */
  SMOOTHING_FACTOR: 0.3,
} as const

/** Drawing state of an instance, reset when the canvas or the data change size */
interface AmplitudeWaterfallState {
  canvasWidth: number
  canvasHeight: number
  /** Values per frame of the time domain data */
  dataPoints: number
  /** Smoothed average amplitude (0–255) of each column, oldest on the left */
  smoothedColumns: number[]
}

/** A fresh state: as many silent columns as fit across the canvas */
function initializeState(
  width: number,
  height: number,
  dataPoints: number,
): AmplitudeWaterfallState {
  const columnCount = Math.ceil(width / CONFIG.COLUMN_WIDTH)

  const smoothedColumns: number[] = new Array(columnCount).fill(0)

  return {
    canvasWidth: width,
    canvasHeight: height,
    dataPoints,
    smoothedColumns,
  }
}

/**
 * Average amplitude of a frame of time domain data, in 0–255: the mean distance
 * from 128 (no signal) scaled from its maximum, 128.
 */
function calculateAmplitude(timeData: Uint8Array): number {
  let sum = 0

  for (let i = 0; i < timeData.length; i++) {
    const deviation = Math.abs(timeData[i] - 128)
    sum += deviation
  }

  const averageDeviation = sum / timeData.length
  return Math.min(255, (averageDeviation / 128) * 255)
}

/** Draws a column centered vertically, as tall as the canvas at amplitude 255 */
function drawColumn(
  ctx: CanvasRenderingContext2D,
  amplitude: number,
  x: number,
  columnWidth: number,
  canvasHeight: number,
): void {
  const normalizedAmplitude = amplitude / 255
  const barHeight = (normalizedAmplitude * canvasHeight) / 2

  const centerY = canvasHeight / 2
  const topY = centerY - barHeight
  const totalHeight = barHeight * 2

  ctx.fillStyle = CONFIG.WAVEFORM_COLOR
  ctx.fillRect(x, topY, columnWidth, totalHeight)
}

/** Moves the columns SCROLL_SPEED to the left and adds the new ones on the right */
function updateWaterfall(state: AmplitudeWaterfallState, newTimeData: Uint8Array): void {
  const columnCount = state.smoothedColumns.length

  for (let i = 0; i < columnCount - CONFIG.SCROLL_SPEED; i++) {
    state.smoothedColumns[i] = state.smoothedColumns[i + CONFIG.SCROLL_SPEED]
  }

  const newAmplitude = calculateAmplitude(newTimeData)

  // Smoothed against the newest column left after the shift, also when it is
  // silent (K122)
  const lastSmoothedAmplitude =
    state.smoothedColumns[columnCount - CONFIG.SCROLL_SPEED] ?? newAmplitude
  const smoothedNewAmplitude =
    lastSmoothedAmplitude + (newAmplitude - lastSmoothedAmplitude) * CONFIG.SMOOTHING_FACTOR

  for (let i = 0; i < CONFIG.SCROLL_SPEED; i++) {
    const insertIndex = columnCount - CONFIG.SCROLL_SPEED + i
    if (insertIndex < columnCount) {
      state.smoothedColumns[insertIndex] = smoothedNewAmplitude
    }
  }
}

/**
 * Waterfall: the average amplitude over time as columns that scroll to the left,
 * the newest on the right. The instance keeps the columns.
 */
export const createWaterfallVisualizer: CreateVisualizer = () => {
  let state: AmplitudeWaterfallState | undefined
  const step = createFrameStep()
  const steps = stepsOf()

  return {
    draw(ctx, dataArray, { width, height, time }) {
      // One shift of the waterfall per 1/60 s since the previous frame (K119)
      const shifts = steps(step(time))
      const dataPoints = dataArray.length

      if (
        !state ||
        state.canvasWidth !== width ||
        state.canvasHeight !== height ||
        state.dataPoints !== dataPoints
      ) {
        state = initializeState(width, height, dataPoints)
      }

      for (let i = 0; i < shifts; i++) {
        updateWaterfall(state, dataArray)
      }

      ctx.clearRect(0, 0, width, height)

      const columnCount = state.smoothedColumns.length
      for (let i = 0; i < columnCount; i++) {
        const x = i * CONFIG.COLUMN_WIDTH
        if (x < width) {
          drawColumn(ctx, state.smoothedColumns[i], x, CONFIG.COLUMN_WIDTH, height)
        }
      }
    },
  }
}
