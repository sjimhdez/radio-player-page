// Time of the visualizers: they animate by the time between frames, not per
// frame, so they look the same at 60 Hz and at 120 Hz (K119). Their constants
// were tuned per frame at 60 fps, the reference frame here.

/** One frame at 60 fps, the pace the per-frame constants were tuned at */
export const REFERENCE_FRAME_MS = 1000 / 60

/** Longest step between two frames: after a hidden tab or a pause, no big jump */
export const MAX_STEP_MS = 100

/**
 * Slack, in reference frames, when counting whole frames: timestamps of about
 * 1.7e12 ms lose some 1e-4 ms, and a step a hair short of a whole reference frame
 * still counts as one.
 */
const STEP_EPSILON = 1e-3

/** Rounding of framesIn() (1e-4 frames), for the same loss of the timestamps */
const FRAMES_PRECISION = 1e4

/**
 * Creates the step of an instance: given the time of each frame, returns the
 * milliseconds since the previous one (one reference frame on the first),
 * between 0 and MAX_STEP_MS.
 */
export function createFrameStep(): (time: number) => number {
  let previous: number | undefined

  return (time) => {
    const step = previous === undefined ? REFERENCE_FRAME_MS : time - previous
    previous = time
    return Math.min(MAX_STEP_MS, Math.max(0, step))
  }
}

/**
 * Factor of an exponential smoothing tuned per frame at 60 fps (`factor`), for a
 * step of `stepMs`: the same curve over time at any frame rate.
 */
export function smoothingFor(factor: number, stepMs: number): number {
  return 1 - (1 - factor) ** framesIn(stepMs)
}

/** Reference frames in a step, rounded so that 60 fps timestamps give exactly 1 */
export function framesIn(stepMs: number): number {
  return Math.round((stepMs / REFERENCE_FRAME_MS) * FRAMES_PRECISION) / FRAMES_PRECISION
}

/**
 * Creates a counter of whole reference frames: given each step, returns how many
 * whole reference frames have passed, keeping the rest for the next step.
 */
export function stepsOf(): (stepMs: number) => number {
  let pending = 0

  return (stepMs) => {
    pending += stepMs / REFERENCE_FRAME_MS
    const whole = Math.floor(pending + STEP_EPSILON)
    pending = Math.max(0, pending - whole)
    return whole
  }
}
