import { createFrameStep, MAX_STEP_MS, smoothingFor } from 'src/core/visualizers/frame-time'
import { createSpectrumLevels } from 'src/core/visualizers/levels'
import type { CreateVisualizer } from 'src/core/visualizers/types'

const CONFIG = {
  /** Bars across the canvas, each one a group of bands (K118) */
  BAR_COUNT: 72,
  /** Color of the bars, a faint white behind the station info */
  BAR_COLOR: 'rgba(255, 255, 255, 0.1)',
  /** Share of the way to the target covered per 1/60 s (0–1, lower is smoother) */
  SMOOTHING_FACTOR: 0.15,
  /** Gap between bars, in CSS pixels */
  BAR_SPACING: 2,
  /**
   * Milliseconds of frame time between two readings of the levels: the bars
   * glide toward each reading instead of following every frame
   */
  UPDATE_INTERVAL_MS: 50,
  /** How long a peak line stays, in milliseconds */
  PEAK_DURATION_MS: 4000,
  /** Color of the peak lines, the cyan of the oscilloscope */
  PEAK_COLOR: 'rgba(19, 181, 210, 0.78)',
  /** Width of the peak lines, in CSS pixels */
  PEAK_LINE_WIDTH: 2,
} as const

/** A peak line: the highest point a bar reached, shown for PEAK_DURATION_MS */
interface Peak {
  barIndex: number
  /** Height of the line from the bottom, in CSS pixels */
  peakHeight: number
  /** Frame time when the bar reached it, in milliseconds */
  timestamp: number
  /** Left of the bar, in CSS pixels, updated on every frame */
  x: number
  /** Width of the bar, in CSS pixels, updated on every frame */
  barWidth: number
}

/** Drawing state of an instance, reset when the canvas changes size */
interface BarState {
  /** Heights drawn, in CSS pixels, gliding toward the targets */
  smoothedHeights: number[]
  /** Heights of the last reading of the levels, in CSS pixels */
  targetHeights: number[]
  /** Heights drawn on the previous frame, to tell when a bar starts to fall */
  previousHeights: number[]
  peaks: Peak[]
  canvasWidth: number
  canvasHeight: number
  /** Frame time of the last reading of the levels, in milliseconds */
  lastUpdateTime: number
}

/** A fresh state, with every bar at 0 and the first reading UPDATE_INTERVAL_MS away */
function initializeState(width: number, height: number, now: number): BarState {
  return {
    smoothedHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    targetHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    previousHeights: new Array(CONFIG.BAR_COUNT).fill(0),
    peaks: [],
    canvasWidth: width,
    canvasHeight: height,
    lastUpdateTime: now,
  }
}

/** Target height of each bar, in CSS pixels, from its level in 0–1 (bass on the left) */
function calculateTargetHeights(levels: number[], canvasHeight: number): number[] {
  return levels.map((level) => level * canvasHeight)
}

/** One step of the exponential smoothing from a height toward its target */
function smoothHeight(currentHeight: number, targetHeight: number, factor: number): number {
  return currentHeight + (targetHeight - currentHeight) * factor
}

/** Width of the bars and the left of each, filling the canvas with BAR_SPACING between them */
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

/** Draws a bar up from the bottom (the hook has already cleared the canvas, K120) */
function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  barWidth: number,
  barHeight: number,
  canvasHeight: number,
): void {
  ctx.fillStyle = CONFIG.BAR_COLOR
  ctx.fillRect(x, canvasHeight - barHeight, barWidth, barHeight)
}

/** Draws a peak line across the width of its bar */
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
 * New peaks: a bar that was higher on the previous frame than now has just
 * reached a maximum. It leaves a peak only above 5 CSS pixels, so a bar at rest
 * leaves no lines at the bottom, and above the line it already has, if any.
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
    if (
      previousHeights[i] > currentHeights[i] &&
      // Lowest height, in CSS pixels, that leaves a peak line
      previousHeights[i] > 5
    ) {
      const existingPeak = existingPeaks.find((peak) => peak.barIndex === i)

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

/** The peaks younger than PEAK_DURATION_MS */
function cleanExpiredPeaks(peaks: Peak[], now: number): Peak[] {
  return peaks.filter((peak) => now - peak.timestamp < CONFIG.PEAK_DURATION_MS)
}

/**
 * Bars: the spectrum as BAR_COUNT vertical bars, bass on the left, each with a
 * peak line that stays for a while after the bar falls. The instance keeps the
 * heights, the peaks and the levels of each bar.
 */
export const createBarsVisualizer: CreateVisualizer = () => {
  let state: BarState | undefined
  const step = createFrameStep()
  const levels = createSpectrumLevels(CONFIG.BAR_COUNT)

  return {
    draw(ctx, dataArray, { width, height, time: now }) {
      // The smoothing follows the time since the previous frame (K119)
      const smoothing = smoothingFor(CONFIG.SMOOTHING_FACTOR, step(now))

      if (!state || state.canvasWidth !== width || state.canvasHeight !== height) {
        state = initializeState(width, height, now)
      }

      const shouldUpdateTargets = now - state.lastUpdateTime >= CONFIG.UPDATE_INTERVAL_MS

      if (shouldUpdateTargets) {
        // Capped like every step, so a pause does not reset the range of the bars
        const sinceUpdate = Math.min(MAX_STEP_MS, now - state.lastUpdateTime)
        state.targetHeights = calculateTargetHeights(levels(dataArray, sinceUpdate), height)
        state.lastUpdateTime = now
      }

      const visualBarCount = CONFIG.BAR_COUNT

      const { barWidth, barPositions } = calculateBarDimensions(width, visualBarCount)

      state.peaks = cleanExpiredPeaks(state.peaks, now)

      for (let i = 0; i < visualBarCount; i++) {
        state.smoothedHeights[i] = smoothHeight(
          state.smoothedHeights[i],
          state.targetHeights[i],
          smoothing,
        )

        drawBar(ctx, barPositions[i], barWidth, state.smoothedHeights[i], height)
      }

      const newPeaks = detectPeaks(
        state.smoothedHeights,
        state.previousHeights,
        barPositions,
        barWidth,
        now,
        state.peaks,
      )

      // A new peak of a bar replaces its line: detectPeaks() only returns higher ones
      for (const newPeak of newPeaks) {
        const existingIndex = state.peaks.findIndex((peak) => peak.barIndex === newPeak.barIndex)
        if (existingIndex >= 0) {
          state.peaks[existingIndex] = newPeak
        } else {
          state.peaks.push(newPeak)
        }
      }

      state.previousHeights = [...state.smoothedHeights]

      for (const peak of state.peaks) {
        peak.x = barPositions[peak.barIndex]
        peak.barWidth = barWidth
        drawPeakLine(ctx, peak, height)
      }
    },
  }
}
