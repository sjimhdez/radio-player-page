// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  WAVE_COLOR: 'rgba(19, 181, 210, 0.78)', // Oscilloscope wave color
  AXIS_COLOR: '#555', // Central axis color
  AXIS_LINE_WIDTH: 1, // Central axis line thickness in pixels
  WAVE_LINE_WIDTH: 2, // Wave line thickness in pixels
  DATA_CENTER_VALUE: 128, // Center value of time domain data (0-255, where 128 is no signal)
} as const

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates the Y position of a wave point based on the data value
 * Time domain data is in range 0-255, where 128 is the center (no signal)
 * The wave is drawn vertically centered on the canvas
 */
function calculateWaveY(dataValue: number, centerY: number, canvasHeight: number): number {
  // Normalize the data value from the center (128)
  // dataValue - 128 gives a range of -128 to 127
  // Dividing by 128 normalizes to -1 to ~1
  // Multiplying by (height / 2) scales to half the canvas height
  let y =
    centerY -
    ((dataValue - CONFIG.DATA_CENTER_VALUE) / CONFIG.DATA_CENTER_VALUE) * (canvasHeight / 2)

  // Ensure Y is within canvas bounds
  y = Math.min(canvasHeight, Math.max(0, Math.round(y)))

  return y
}

/**
 * Draws the horizontal central axis of the oscilloscope
 */
function drawCenterAxis(ctx: CanvasRenderingContext2D, width: number, centerY: number): void {
  ctx.strokeStyle = CONFIG.AXIS_COLOR
  ctx.lineWidth = CONFIG.AXIS_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  ctx.lineTo(width, centerY)
  ctx.stroke()
}

/**
 * Draws the oscilloscope wave based on time domain data
 */
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

// ============================================================================
// Main Visualizer Function
// ============================================================================

export const oscilloscopeVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  canvas.width = width
  canvas.height = height

  const centerY = height / 2

  ctx.clearRect(0, 0, width, height)

  // Draw central axis
  drawCenterAxis(ctx, width, centerY)

  // Draw wave
  drawWaveform(ctx, dataArray, width, centerY, height)
}
