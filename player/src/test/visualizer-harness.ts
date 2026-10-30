// Harness of the visualizer characterization tests. The tests call each
// visualizer only through drawFrames(), the adapter to the shape of the
// visualizers, so a change of that shape changes the adapter and never their
// inputs, assertions or snapshots.
import { vi } from 'vitest'
import type { CreateVisualizer, Visualizer } from 'src/core/visualizers/types'
import { createFakeCanvas2D, FakeCanvasElement, type FakeCanvas2D } from 'src/test/fake-canvas-2d'

/** Values per frame: frequencyBinCount of the analyser with fftSize 256 */
export const DATA_LENGTH = 128

/** One frame at 60 fps, in milliseconds */
export const FRAME_60_FPS = 1000 / 60
/** One frame at 120 fps, in milliseconds */
export const FRAME_120_FPS = 1000 / 120

/** Wall clock of the first frame (Date.now() with fake timers) */
export const START_TIME = Date.UTC(2026, 9, 29, 12, 0, 0)

export interface Size {
  width: number
  height: number
}

export interface Surface {
  ctx: CanvasRenderingContext2D & FakeCanvas2D
  canvas: FakeCanvasElement
}

export interface DrawOptions {
  /** Time between frames in milliseconds (default: 60 fps) */
  frameMs?: number
  /** Time of the first frame (default: START_TIME) */
  start?: number
  /** Canvas and context of an earlier call, to keep drawing on the same surface */
  surface?: Surface
}

export interface DrawResult extends Surface {
  /** The log of the context, with a `frame N` line before each frame */
  log: string[]
  /** Time of the frame after the last one, to continue with `start` */
  next: number
}

export function createSurface(): Surface {
  const ctx = createFakeCanvas2D()
  const canvas = new FakeCanvasElement()
  // The canvas of the context, as in a browser; set out of the log
  ;(ctx as { canvas: HTMLCanvasElement }).canvas = canvas.asCanvas()
  ctx.log.pop()
  return { ctx, canvas }
}

// One instance of each factory per surface, as the drawing state of the old
// functions lived in a WeakMap per canvas.
const instances = new WeakMap<FakeCanvasElement, Map<CreateVisualizer, Visualizer>>()

function instanceFor(create: CreateVisualizer, canvas: FakeCanvasElement): Visualizer {
  let byFactory = instances.get(canvas)
  if (!byFactory) {
    byFactory = new Map()
    instances.set(canvas, byFactory)
  }
  let instance = byFactory.get(create)
  if (!instance) {
    // A function, not Math.random itself, so withRandom() keeps ruling
    instance = create({ random: () => Math.random() })
    byFactory.set(create, instance)
  }
  return instance
}

/**
 * Draws the frames as useAudioVisualizer does: on each frame it clears the whole
 * canvas (out of the log) and calls the visualizer with the data of the frame.
 * The system time is set to the time of each frame, which is also the frame time
 * the instance gets, so fake timers must be on (vi.useFakeTimers()).
 */
export function drawFrames(
  create: CreateVisualizer,
  frames: Uint8Array[],
  size: Size,
  options: DrawOptions = {},
): DrawResult {
  const { frameMs = FRAME_60_FPS, start = START_TIME, surface = createSurface() } = options
  const { ctx, canvas } = surface
  const firstLine = ctx.log.length
  const instance = instanceFor(create, canvas)

  frames.forEach((data, index) => {
    const time = start + index * frameMs
    vi.setSystemTime(time)
    // The clear of the hook is part of the adapter, not of the visualizer: it is
    // done but left out of the log, so a new adapter keeps the snapshots.
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.log.pop()
    ctx.log.push(`frame ${index}`)
    instance.draw(ctx, data, { ...size, time })
  })

  return { ctx, canvas, log: ctx.log.slice(firstLine), next: start + frames.length * frameMs }
}

/** The same data repeated for a number of frames */
export function repeat(data: Uint8Array, count: number): Uint8Array[] {
  return Array.from({ length: count }, () => data)
}

/** Replaces Math.random with a sequence that starts over when it runs out */
export function withRandom(sequence: number[]) {
  let index = 0
  return vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = sequence[index % sequence.length]
    index++
    return value
  })
}

/** No signal: 128 in the time domain, 0 in the frequency domain */
export function silence(type: 'time' | 'frequency'): Uint8Array {
  return new Uint8Array(DATA_LENGTH).fill(type === 'time' ? 128 : 0)
}

/** Time-domain sine of `cycles` periods over the frame, centered on 128 */
export function sine(cycles: number, amplitude: number): Uint8Array {
  return Uint8Array.from({ length: DATA_LENGTH }, (_, i) =>
    Math.round(128 + amplitude * Math.sin((2 * Math.PI * cycles * i) / DATA_LENGTH)),
  )
}

/** Deterministic noise in 0–255 (linear congruential generator) */
export function noise(seed: number): Uint8Array {
  let state = seed >>> 0
  return Uint8Array.from({ length: DATA_LENGTH }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state >>> 24
  })
}

/** Frequency data with a single band at `value` and the rest at 0 */
export function band(index: number, value: number): Uint8Array {
  const data = new Uint8Array(DATA_LENGTH)
  data[index] = value
  return data
}
