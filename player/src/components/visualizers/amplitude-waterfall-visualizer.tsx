// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  COLUMN_WIDTH: 2, // Width of each column in pixels
  SCROLL_SPEED: 1, // Waterfall scroll speed (columns per frame)
  WAVEFORM_COLOR: 'rgba(255, 255, 255, 0.3)', // Fixed color for all vertical lines
  SMOOTHING_FACTOR: 0.3, // Smoothing factor for amplitude changes (0-1)
} as const

// ============================================================================
// Types
// ============================================================================

interface AmplitudeWaterfallState {
  canvasWidth: number
  canvasHeight: number
  dataPoints: number // Number of amplitude data points
  columns: number[] // Array of waterfall columns, each containing the average amplitude at that moment
  smoothedColumns: number[] // Smoothed columns for smoother transitions
}

// ============================================================================
// Persistent State per Canvas
// ============================================================================

const amplitudeWaterfallStateMap = new WeakMap<HTMLCanvasElement, AmplitudeWaterfallState>()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initializes or resets the canvas state for amplitude waterfall
 */
function initializeState(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dataPoints: number,
): AmplitudeWaterfallState {
  canvas.width = width
  canvas.height = height

  const columnCount = Math.ceil(width / CONFIG.COLUMN_WIDTH)

  // Initialize waterfall column arrays with zero amplitude
  const columns: number[] = new Array(columnCount).fill(0)
  const smoothedColumns: number[] = new Array(columnCount).fill(0)

  return {
    canvasWidth: width,
    canvasHeight: height,
    dataPoints,
    columns,
    smoothedColumns,
  }
}

/**
 * Calculates the average amplitude of time domain data
 * Time domain data is in range 0-255, where 128 is the center (no signal)
 */
function calculateAmplitude(timeData: Uint8Array): number {
  let sum = 0
  let maxDeviation = 0

  for (let i = 0; i < timeData.length; i++) {
    // Calculate deviation from center (128)
    const deviation = Math.abs(timeData[i] - 128)
    sum += deviation
    maxDeviation = Math.max(maxDeviation, deviation)
  }

  // Use average deviation, but scaled to be more sensitive
  const averageDeviation = sum / timeData.length
  // Normalize to 0-255, using maximum possible deviation (128)
  return Math.min(255, (averageDeviation / 128) * 255)
}

/**
 * Draws an amplitude waterfall column on the canvas
 * Shows amplitude as a vertically centered line with waterfall effect
 */
function drawColumn(
  ctx: CanvasRenderingContext2D,
  amplitude: number,
  x: number,
  columnWidth: number,
  canvasHeight: number,
): void {
  // Normalize amplitude (0-255) to height (0 to canvasHeight/2)
  const normalizedAmplitude = amplitude / 255
  const barHeight = (normalizedAmplitude * canvasHeight) / 2

  // Calculate vertically centered position
  const centerY = canvasHeight / 2
  const topY = centerY - barHeight
  const totalHeight = barHeight * 2

  // Draw complete amplitude bar (centered) with fixed color
  ctx.fillStyle = CONFIG.WAVEFORM_COLOR
  ctx.fillRect(x, topY, columnWidth, totalHeight)
}

/**
 * Updates the amplitude waterfall by shifting columns and adding a new one
 */
function updateWaterfall(state: AmplitudeWaterfallState, newTimeData: Uint8Array): void {
  const columnCount = state.columns.length

  // Shift all waterfall columns to the left
  for (let i = 0; i < columnCount - CONFIG.SCROLL_SPEED; i++) {
    state.columns[i] = state.columns[i + CONFIG.SCROLL_SPEED]
    state.smoothedColumns[i] = state.smoothedColumns[i + CONFIG.SCROLL_SPEED]
  }

  // Calculate average amplitude of current time domain data
  const newAmplitude = calculateAmplitude(newTimeData)

  // Apply smoothing to new amplitude using last smoothed column as reference
  const lastSmoothedAmplitude =
    state.smoothedColumns[columnCount - CONFIG.SCROLL_SPEED] || newAmplitude
  const smoothedNewAmplitude =
    lastSmoothedAmplitude + (newAmplitude - lastSmoothedAmplitude) * CONFIG.SMOOTHING_FACTOR

  // Add new column at the end of waterfall
  for (let i = 0; i < CONFIG.SCROLL_SPEED; i++) {
    const insertIndex = columnCount - CONFIG.SCROLL_SPEED + i
    if (insertIndex < columnCount) {
      state.columns[insertIndex] = newAmplitude
      state.smoothedColumns[insertIndex] = smoothedNewAmplitude
    }
  }
}

// ============================================================================
// Main Visualizer Function
// ============================================================================

/**
 * Amplitude waterfall visualizer
 * Creates a scrolling waterfall effect showing amplitude changes over time
 * Each column represents the average amplitude at a point in time
 * Columns scroll left as new data arrives
 *
 * @param ctx - Canvas 2D rendering context
 * @param dataArray - Time domain audio data (Uint8Array, range 0-255)
 * @param canvas - HTML canvas element
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 */
export const amplitudeWaterfallVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Get or initialize canvas state
  let state = amplitudeWaterfallStateMap.get(canvas)
  const dataPoints = dataArray.length

  // If canvas changed size, number of points changed, or state doesn't exist, reinitialize
  if (
    !state ||
    state.canvasWidth !== width ||
    state.canvasHeight !== height ||
    state.dataPoints !== dataPoints
  ) {
    state = initializeState(canvas, width, height, dataPoints)
    amplitudeWaterfallStateMap.set(canvas, state)
  }

  // Update amplitude waterfall with new time domain data
  updateWaterfall(state, dataArray)

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Draw all amplitude waterfall columns
  const columnCount = state.columns.length
  for (let i = 0; i < columnCount; i++) {
    const x = i * CONFIG.COLUMN_WIDTH
    if (x < width) {
      drawColumn(ctx, state.smoothedColumns[i], x, CONFIG.COLUMN_WIDTH, height)
    }
  }
}
