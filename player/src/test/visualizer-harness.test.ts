// Tests of the 2D context fake and of the harness of the visualizer
// characterization tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CreateVisualizer,
  Visualizer,
  VisualizerDeps,
  VisualizerFrame,
} from 'src/core/visualizers/types'
import { createFakeCanvas2D, FakeCanvasElement } from 'src/test/fake-canvas-2d'
import {
  band,
  drawFrames,
  FRAME_120_FPS,
  noise,
  repeat,
  silence,
  sine,
  START_TIME,
  withRandom,
} from 'src/test/visualizer-harness'

/** A factory whose instances draw with the given function */
function factory(draw: Visualizer['draw']): CreateVisualizer {
  return () => ({ draw })
}

describe('createFakeCanvas2D', () => {
  it('records calls with their numbers rounded to two decimals', () => {
    const ctx = createFakeCanvas2D()
    ctx.fillRect(1.234, -0.001, 2, 3.456)
    ctx.beginPath()
    expect(ctx.log).toEqual(['fillRect(1.23, 0, 2, 3.46)', 'beginPath()'])
  })

  it('records assignments and reads back the last value', () => {
    const ctx = createFakeCanvas2D()
    ctx.fillStyle = 'red'
    ctx.globalAlpha = 0.333
    expect(ctx.log).toEqual(['fillStyle = red', 'globalAlpha = 0.33'])
    expect(ctx.fillStyle).toBe('red')
  })
})

describe('FakeCanvasElement', () => {
  it('counts width and height assignments', () => {
    const canvas = new FakeCanvasElement()
    canvas.width = 10
    canvas.height = 20
    canvas.width = 10
    expect(canvas.sizeAssignments).toBe(3)
    expect([canvas.width, canvas.height]).toEqual([10, 20])
  })
})

describe('drawFrames', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls the visualizer once per frame and leaves the clear out of the log', () => {
    const calls: number[] = []
    const { log } = drawFrames(
      factory((ctx, data, { width, height }) => {
        calls.push(data[0])
        ctx.fillRect(0, 0, width, height)
        expect(ctx.canvas.width).toBe(300)
      }),
      [band(0, 1), band(0, 2)],
      { width: 40, height: 30 },
    )
    expect(calls).toEqual([1, 2])
    expect(log).toEqual(['frame 0', 'fillRect(0, 0, 40, 30)', 'frame 1', 'fillRect(0, 0, 40, 30)'])
  })

  it('sets the system time of each frame', () => {
    const times: number[] = []
    const { next } = drawFrames(
      factory(() => times.push(Date.now())),
      repeat(silence('time'), 3),
      {
        width: 1,
        height: 1,
      },
      { frameMs: FRAME_120_FPS },
    )
    expect(times).toEqual([START_TIME, START_TIME + 8, START_TIME + 16])
    expect(next).toBeCloseTo(START_TIME + 25, 0)
  })

  it('keeps drawing on the surface of an earlier call', () => {
    const first = drawFrames(
      factory((ctx) => ctx.beginPath()),
      [silence('time')],
      {
        width: 1,
        height: 1,
      },
    )
    const second = drawFrames(
      factory((ctx) => ctx.fill()),
      [silence('time')],
      { width: 1, height: 1 },
      {
        surface: first,
      },
    )
    expect(second.log).toEqual(['frame 0', 'fill()'])
    expect(second.ctx.log).toHaveLength(4)
  })
})

describe('drawFrames with a visualizer factory (spec 0022, task 2.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** A factory that records the frames its instances get */
  function recordingFactory() {
    const instances: VisualizerFrame[][] = []
    const create: CreateVisualizer = () => {
      const frames: VisualizerFrame[] = []
      instances.push(frames)
      return {
        draw(ctx, data, frame) {
          frames.push(frame)
          ctx.fillRect(data[0], 0, frame.width, frame.height)
        },
      }
    }
    return { create, instances }
  }

  it('draws each frame with its size and the system time as the frame time', () => {
    const { create, instances } = recordingFactory()
    const { log } = drawFrames(
      create,
      [band(0, 1), band(0, 2)],
      { width: 40, height: 30 },
      { frameMs: FRAME_120_FPS },
    )
    expect(instances).toHaveLength(1)
    expect(instances[0]).toEqual([
      { width: 40, height: 30, time: START_TIME },
      { width: 40, height: 30, time: START_TIME + FRAME_120_FPS },
    ])
    expect(log).toEqual(['frame 0', 'fillRect(1, 0, 40, 30)', 'frame 1', 'fillRect(2, 0, 40, 30)'])
  })

  it('keeps one instance per surface', () => {
    const { create, instances } = recordingFactory()
    const size = { width: 1, height: 1 }
    const first = drawFrames(create, [silence('time')], size)
    drawFrames(create, [silence('time')], size, { surface: first })
    drawFrames(create, [silence('time')], size)
    expect(instances.map((frames) => frames.length)).toEqual([2, 1])
  })

  it('gives the context its canvas, out of the log', () => {
    let canvas: HTMLCanvasElement | undefined
    const { ctx, canvas: surfaceCanvas } = drawFrames(
      factory((context) => {
        canvas = context.canvas
      }),
      [silence('time')],
      { width: 1, height: 1 },
    )
    expect(canvas).toBe(surfaceCanvas)
    expect(ctx.log).toEqual(['frame 0'])
  })

  it('passes a random dependency that follows Math.random', () => {
    withRandom([0.25])
    const values: number[] = []
    drawFrames(
      (deps?: VisualizerDeps) => ({
        draw() {
          values.push(deps?.random?.() ?? -1)
        },
      }),
      [silence('time')],
      { width: 1, height: 1 },
    )
    expect(values).toEqual([0.25])
  })
})

describe('data and randomness', () => {
  it('gives 128 values per frame', () => {
    expect([silence('time'), sine(2, 50), noise(1), band(3, 9)].map((d) => d.length)).toEqual([
      128, 128, 128, 128,
    ])
  })

  it('makes silence of each domain', () => {
    expect(new Set(silence('time'))).toEqual(new Set([128]))
    expect(new Set(silence('frequency'))).toEqual(new Set([0]))
  })

  it('centers the sine on 128', () => {
    const data = sine(1, 100)
    expect([data[0], data[32], data[96]]).toEqual([128, 228, 28])
  })

  it('repeats the same noise for the same seed only', () => {
    expect(noise(7)).toEqual(noise(7))
    expect(noise(7)).not.toEqual(noise(8))
  })

  it('cycles through the random sequence', () => {
    withRandom([0.1, 0.9])
    expect([Math.random(), Math.random(), Math.random()]).toEqual([0.1, 0.9, 0.1])
  })
})
