// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  BAR_COUNT: 72,
  BAR_COLOR: 'rgba(255, 255, 255, 0.1)',
  SMOOTHING_FACTOR: 0.15, // Smoothing factor (0-1, lower = smoother)
  BAR_SPACING: 2, // Space between bars in pixels
  UPDATE_INTERVAL_MS: 50, // Interval between target height updates
  MAX_AMPLITUDE: 255, // Maximum possible amplitude (frequency data range: 0-255)
  PEAK_DURATION_MS: 4000, // Peak line duration in milliseconds
  PEAK_COLOR: 'rgba(19, 181, 210, 0.78)', // Peak line color
  PEAK_LINE_WIDTH: 2, // Peak line thickness
} as const

// ============================================================================
// Types
// ============================================================================

interface Peak {
  barIndex: number // Bar index
  peakHeight: number // Peak height
  timestamp: number // Time when peak was detected
  x: number // Bar X position
  barWidth: number // Bar width
}

interface BarState {
  smoothedHeights: number[] // Current smoothed heights
  targetHeights: number[] // Calculated target heights
  previousHeights: number[] // Previous heights for peak detection
  peaks: Peak[] // Array of active peaks
  canvasWidth: number
  canvasHeight: number
  lastUpdateTime: number
}

// ============================================================================
// Persistent State per Canvas
// ============================================================================

const barStateMap = new WeakMap<HTMLCanvasElement, BarState>()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initializes or resets the canvas state
 */
function initializeState(canvas: HTMLCanvasElement, width: number, height: number): BarState {
  canvas.width = width
  canvas.height = height

  return {
    smoothedHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    targetHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    previousHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    peaks: [],
    canvasWidth: width,
    canvasHeight: height,
    lastUpdateTime: Date.now(),
  }
}

/**
 * Calculates the average amplitude for a range of frequency data
 * Frequency data already comes in range 0-255, where each value
 * represents the amplitude of a specific frequency band
 * Returns a value from 0 to 255 representing the average amplitude
 */
function calculateAverageAmplitude(
  dataArray: Uint8Array,
  startIdx: number,
  endIdx: number,
): number {
  let sumAmplitude = 0
  const count = endIdx - startIdx

  for (let i = startIdx; i < endIdx; i++) {
    // Frequency data already comes as amplitude (0-255)
    sumAmplitude += dataArray[i]
  }

  return sumAmplitude / count
}

/**
 * Converts an amplitude (0-255) to bar height in pixels (0-100% of canvas)
 * Linear scale: amplitude 0 = 0% height, amplitude 255 = 100% height
 * Simplified formula: height = (amplitude / 255) * canvasHeight
 */
function amplitudeToHeight(amplitude: number, canvasHeight: number): number {
  // Ensure amplitude is in valid range (0-255)
  const clampedAmplitude = Math.max(0, Math.min(amplitude, CONFIG.MAX_AMPLITUDE))

  // Convert directly from 0-255 scale to canvas height (0-100%)
  return (clampedAmplitude / CONFIG.MAX_AMPLITUDE) * canvasHeight
}

/**
 * Calculates target heights for all bars based on frequency data
 * Each bar represents a frequency band of the audio (from bass to treble)
 * Converts amplitude data (0-255) to canvas height (0-100%)
 * Displays bars in natural order without mirror effect
 */
function calculateTargetHeights(dataArray: Uint8Array, canvasHeight: number): number[] {
  const dataPointsPerBar = Math.floor(dataArray.length / CONFIG.BAR_COUNT)
  const heights: number[] = []

  // Calculate heights of bars in natural order (from bass to treble)
  for (let i = 0; i < CONFIG.BAR_COUNT; i++) {
    const startIdx = i * dataPointsPerBar
    const endIdx = Math.min(startIdx + dataPointsPerBar, dataArray.length)

    // Calculate average amplitude for this frequency band (range: 0-255)
    const averageAmplitude = calculateAverageAmplitude(dataArray, startIdx, endIdx)

    // Convert amplitude (0-255) to canvas height (0-100% of canvasHeight)
    heights[i] = amplitudeToHeight(averageAmplitude, canvasHeight)
  }

  return heights
}

/**
 * Applies smoothing to current height towards a target height
 */
function smoothHeight(currentHeight: number, targetHeight: number): number {
  return currentHeight + (targetHeight - currentHeight) * CONFIG.SMOOTHING_FACTOR
}

/**
 * Calculates bar dimensions and positions
 */
function calculateBarDimensions(
  canvasWidth: number,
  visualBarCount: number,
): { barWidth: number; barPositions: number[] } {
  const totalSpacing = CONFIG.BAR_SPACING * (visualBarCount - 1)
  const availableWidth = canvasWidth - totalSpacing
  const barWidth = availableWidth / visualBarCount

  const barPositions: number[] = []
  for (let i = 0; i < visualBarCount; i++) {
    barPositions[i] = i * (barWidth + CONFIG.BAR_SPACING)
  }

  return { barWidth, barPositions }
}

/**
 * Draws an individual bar on the canvas
 */
function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  barWidth: number,
  barHeight: number,
  canvasHeight: number,
): void {
  // Clear only the vertical area of this bar
  ctx.clearRect(x, 0, barWidth, canvasHeight)

  // Draw the bar from bottom to top
  ctx.fillStyle = CONFIG.BAR_COLOR
  ctx.fillRect(x, canvasHeight - barHeight, barWidth, barHeight)
}

/**
 * Draws a peak line on the canvas
 */
function drawPeakLine(ctx: CanvasRenderingContext2D, peak: Peak, canvasHeight: number): void {
  const y = canvasHeight - peak.peakHeight

  ctx.strokeStyle = CONFIG.PEAK_COLOR
  ctx.lineWidth = CONFIG.PEAK_LINE_WIDTH
  ctx.beginPath()
  ctx.moveTo(peak.x, y)
  ctx.lineTo(peak.x + peak.barWidth, y)
  ctx.stroke()
}

/**
 * Detecta nuevos picos comparando alturas actuales con anteriores
 * Un pico se detecta cuando la altura anterior era mayor que la actual,
 * lo que indica que la barra alcanzó un máximo y ahora está disminuyendo
 * Solo crea un nuevo pico si supera la altura del pico actualmente marcado para esa barra
 */
function detectPeaks(
  currentHeights: number[],
  previousHeights: number[],
  barPositions: number[],
  barWidth: number,
  now: number,
  existingPeaks: Peak[],
): Peak[] {
  const newPeaks: Peak[] = []

  for (let i = 0; i < currentHeights.length; i++) {
    // Detect peak: previous height was greater than current
    // This indicates the bar reached a local maximum and is now decreasing
    if (
      previousHeights[i] > currentHeights[i] &&
      previousHeights[i] > 5 // Minimum threshold to consider a peak (in pixels)
    ) {
      // Check if an active peak already exists for this bar
      const existingPeak = existingPeaks.find((peak) => peak.barIndex === i)

      // Only create a new peak if:
      // 1. No active peak exists for this bar, OR
      // 2. The new peak is greater than the existing peak
      if (!existingPeak || previousHeights[i] > existingPeak.peakHeight) {
        newPeaks.push({
          barIndex: i,
          peakHeight: previousHeights[i],
          timestamp: now,
          x: barPositions[i],
          barWidth: barWidth,
        })
      }
    }
  }

  return newPeaks
}

/**
 * Cleans expired peaks (older than PEAK_DURATION_MS)
 */
function cleanExpiredPeaks(peaks: Peak[], now: number): Peak[] {
  return peaks.filter((peak) => now - peak.timestamp < CONFIG.PEAK_DURATION_MS)
}

// ============================================================================
// Main Visualizer Function
// ============================================================================

/**
 * Bar visualizer
 * Displays frequency spectrum as vertical bars
 * Each bar represents a frequency band, showing amplitude from bass (left) to treble (right)
 * Includes peak detection and peak line display for visual feedback
 *
 * @param ctx - Canvas 2D rendering context
 * @param dataArray - Frequency domain audio data (Uint8Array, range 0-255)
 * @param canvas - HTML canvas element
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 */
export const barVisualizer = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  // Get or initialize canvas state
  let state = barStateMap.get(canvas)

  // If canvas changed size or state doesn't exist, reinitialize
  if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
    state = initializeState(canvas, width, height)
    barStateMap.set(canvas, state)
  }

  // Calculate target heights only if time interval has passed
  const now = Date.now()
  const shouldUpdateTargets = now - state.lastUpdateTime >= CONFIG.UPDATE_INTERVAL_MS

  if (shouldUpdateTargets) {
    state.targetHeights = calculateTargetHeights(dataArray, height)
    state.lastUpdateTime = now
  }

  const visualBarCount = CONFIG.BAR_COUNT

  // Calculate bar dimensions
  const { barWidth, barPositions } = calculateBarDimensions(width, visualBarCount)

  // Clean expired peaks
  state.peaks = cleanExpiredPeaks(state.peaks, now)

  // Each frame: apply smoothing and draw all bars
  for (let i = 0; i < visualBarCount; i++) {
    // Apply smoothing towards target height
    state.smoothedHeights[i] = smoothHeight(state.smoothedHeights[i], state.targetHeights[i])

    // Draw the bar
    drawBar(ctx, barPositions[i], barWidth, state.smoothedHeights[i], height)
  }

  // Detect new peaks by comparing current heights with previous ones
  // New peaks are only created if they exceed currently marked peaks
  const newPeaks = detectPeaks(
    state.smoothedHeights,
    state.previousHeights,
    barPositions,
    barWidth,
    now,
    state.peaks,
  )

  // Replace existing peaks if new ones are greater
  for (const newPeak of newPeaks) {
    const existingIndex = state.peaks.findIndex((peak) => peak.barIndex === newPeak.barIndex)
    if (existingIndex >= 0) {
      // Replace existing peak with new one (which is greater)
      state.peaks[existingIndex] = newPeak
    } else {
      // Add new peak if none exists for this bar
      state.peaks.push(newPeak)
    }
  }

  // Update previous heights for next detection
  state.previousHeights = [...state.smoothedHeights]

  // Draw active peak lines
  for (const peak of state.peaks) {
    // Update X position and width in case canvas changed size
    peak.x = barPositions[peak.barIndex]
    peak.barWidth = barWidth
    drawPeakLine(ctx, peak, height)
  }
}
