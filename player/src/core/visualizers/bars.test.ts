// Characterization of the bars, written against the code of v3.1.0 without
// changing it. The tests call it only through drawFrames(), which gives each frame
// its time, so they do not depend on how it is built.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBarsVisualizer as barVisualizer } from 'src/core/visualizers/bars'
import { TOP_SHARE } from 'src/core/visualizers/bands'
import { createFakeCanvas2D, FakeCanvasElement } from 'src/test/fake-canvas-2d'
import {
  band,
  drawFrames,
  FRAME_120_FPS,
  FRAME_60_FPS,
  noise,
  repeat,
  silence,
} from 'src/test/visualizer-harness'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const PEAK_COLOR = 'strokeStyle = rgba(19, 181, 210, 0.78)'

/** Lines of the last frame of a log */
function lastFrame(log: string[]): string[] {
  const start = log.map((line) => line.startsWith('frame ')).lastIndexOf(true)
  return log.slice(start + 1)
}

/** Heights of the bars (fourth argument of fillRect) in the lines of a frame */
function barHeights(lines: string[]): number[] {
  return lines
    .filter((line) => line.startsWith('fillRect('))
    .map((line) => Number(line.slice('fillRect('.length, -1).split(', ')[3]))
}

function frameCount(durationMs: number, frameMs: number): number {
  return Math.round(durationMs / frameMs)
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('barVisualizer', () => {
  it.each([
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ])('draws 72 bars and their peaks over 8 frames of noise (%s)', (_name, size) => {
    const frames = Array.from({ length: 8 }, (_, i) => noise(i + 1))
    const { log } = drawFrames(barVisualizer, frames, size)
    expect(log).toMatchSnapshot()
  })

  it('draws 72 bars of the same width, 2 px apart', () => {
    const { log } = drawFrames(barVisualizer, [silence('frequency')], DESKTOP)
    const bars = log.filter((line) => line.startsWith('fillRect('))
    expect(bars).toHaveLength(72)
    expect(bars[0]).toBe('fillRect(0, 900, 18.03, 0)')
    expect(bars[71]).toBe('fillRect(1421.97, 900, 18.03, 0)')
  })

  it('updates the target heights only every 50 ms', () => {
    // Frames 10 ms apart: the first targets arrive at 50 ms (frame 5)
    const { log } = drawFrames(barVisualizer, repeat(band(0, 255), 6), DESKTOP, { frameMs: 10 })
    const frames = log
      .join('\n')
      .split(/frame \d+\n?/)
      .slice(1)
    const firstBar = frames.map((frame) => barHeights(frame.split('\n'))[0])
    expect(firstBar.slice(0, 5)).toEqual([0, 0, 0, 0, 0])
    // One smoothing step of 10 ms toward 900 px (K119)
    expect(firstBar[5]).toBeCloseTo(900 * (1 - 0.85 ** 0.6), 1)
  })

  it('keeps a peak line for 4 s after the bar starts to fall, then drops it', () => {
    const loud = drawFrames(barVisualizer, repeat(band(0, 255), 10), DESKTOP, { frameMs: 100 })
    const quiet = drawFrames(barVisualizer, repeat(silence('frequency'), 50), DESKTOP, {
      frameMs: 100,
      start: loud.next,
      surface: loud,
    })
    const frames = quiet.log
      .join('\n')
      .split(/frame \d+\n?/)
      .slice(1)
    const peaksPerFrame = frames.map((frame) => frame.split(PEAK_COLOR).length - 1)
    expect(peaksPerFrame[0]).toBe(1)
    expect(peaksPerFrame[39]).toBe(1)
    expect(peaksPerFrame[41]).toBe(0)
  })

  it('starts over at height 0 when the size changes', () => {
    const desktop = drawFrames(barVisualizer, repeat(band(0, 255), 10), DESKTOP, { frameMs: 100 })
    const phone = drawFrames(barVisualizer, [band(0, 255)], PHONE, {
      start: desktop.next,
      surface: desktop,
    })
    expect(barHeights(lastFrame(desktop.log)).some((height) => height > 0)).toBe(true)
    expect(new Set(barHeights(phone.log))).toEqual(new Set([0]))
    expect(phone.canvas.sizeAssignments).toBe(0)
  })

  // The size of the canvas belongs to useAudioVisualizer (K116).
  it('never sets the canvas size', () => {
    const { canvas } = drawFrames(barVisualizer, repeat(noise(3), 5), PHONE)
    expect(canvas.sizeAssignments).toBe(0)
  })

  // useAudioVisualizer already clears the whole canvas before each frame, so the
  // bars do not clear their columns again (K120).
  it('does not clear the canvas again on any frame', () => {
    const { log } = drawFrames(barVisualizer, [noise(5), noise(6)], DESKTOP)
    expect(log.filter((line) => line.startsWith('clearRect('))).toEqual([])
  })

  // The 72 bars cover the bands up to the top share of the spectrum, on a
  // logarithmic scale; above it there is hardly any signal (K118).
  it('reads every band up to the top share, from bass on the left to treble on the right', () => {
    const risen = (index: number) => {
      const { log } = drawFrames(barVisualizer, repeat(band(index, 255), 10), DESKTOP, {
        frameMs: 100,
      })
      return barHeights(lastFrame(log)).flatMap((height, bar) => (height > 0 ? [bar] : []))
    }
    const top = Math.round(128 * TOP_SHARE)
    const bars = Array.from({ length: top }, (_, index) => risen(index))
    // Each band raises exactly one bar, in order, and every bar has a band
    expect(bars.every((raised) => raised.length === 1)).toBe(true)
    const owner = bars.map(([bar]) => bar)
    expect(owner[0]).toBe(0)
    expect(owner[top - 1]).toBe(71)
    expect(owner.every((bar, index) => index === 0 || bar - owner[index - 1] <= 1)).toBe(true)
    expect(owner.every((bar, index) => index === 0 || bar >= owner[index - 1])).toBe(true)
    expect(risen(127)).toEqual([])
  })

  // The smoothing follows the time between frames, like the targets, so the bars
  // rise as fast at 120 fps as at 60 fps (K119).
  it('smooths by time: after 200 ms, the same height at 120 fps as at 60 fps', () => {
    const at = (frameMs: number) => {
      const { log } = drawFrames(
        barVisualizer,
        repeat(band(0, 255), frameCount(200, frameMs)),
        DESKTOP,
        {
          frameMs,
        },
      )
      return barHeights(lastFrame(log))[0]
    }
    expect(at(FRAME_60_FPS)).toBeGreaterThan(300)
    expect(Math.abs(at(FRAME_120_FPS) - at(FRAME_60_FPS))).toBeLessThan(at(FRAME_60_FPS) * 0.05)
  })
})

// The bars follow the time of each frame, not the wall clock (K121).
describe('createBarVisualizer: frame time', () => {
  /** Draws with Date.now() still and the frame time moving `frameMs` per frame */
  function drawOnFrameTime(frames: Uint8Array[], frameMs: number, start = 0) {
    const ctx = createFakeCanvas2D()
    ;(ctx as { canvas: HTMLCanvasElement }).canvas = new FakeCanvasElement().asCanvas()
    const bars = barVisualizer()
    return frames.map((data, index) => {
      const firstLine = ctx.log.length
      bars.draw(ctx, data, { ...DESKTOP, time: start + index * frameMs })
      return ctx.log.slice(firstLine)
    })
  }

  it('updates the targets every 50 ms of frame time', () => {
    vi.setSystemTime(0)
    const frames = drawOnFrameTime(repeat(band(0, 255), 6), 10, 1000)
    const firstBar = frames.map((lines) => barHeights(lines)[0])
    expect(firstBar.slice(0, 5)).toEqual([0, 0, 0, 0, 0])
    // One smoothing step of 10 ms toward 900 px (K119)
    expect(firstBar[5]).toBeCloseTo(900 * (1 - 0.85 ** 0.6), 1)
  })

  it('drops a peak line 4 s of frame time after it starts', () => {
    vi.setSystemTime(0)
    const frames = drawOnFrameTime(
      [...repeat(band(0, 255), 10), ...repeat(silence('frequency'), 50)],
      100,
    )
    const peaks = frames.map((lines) => lines.filter((line) => line === PEAK_COLOR).length)
    expect(peaks[10]).toBe(1)
    expect(peaks[49]).toBe(1)
    expect(peaks[51]).toBe(0)
  })

  // The level meter gets the step capped like the rest of the animation, so a long
  // pause does not reset the range of each bar.
  it('keeps the range of each bar after a long pause', () => {
    vi.setSystemTime(0)
    /** Height of the first bar after loud and quiet in turns, `pauseMs`, and quiet */
    const afterPause = (pauseMs: number) => {
      const ctx = createFakeCanvas2D()
      ;(ctx as { canvas: HTMLCanvasElement }).canvas = new FakeCanvasElement().asCanvas()
      const bars = barVisualizer()
      const draw = (data: Uint8Array, time: number) => {
        const firstLine = ctx.log.length
        bars.draw(ctx, data, { ...DESKTOP, time })
        return barHeights(ctx.log.slice(firstLine))[0]
      }
      for (let i = 0; i < 20; i++) draw(band(0, i % 2 ? 100 : 255), i * 50)
      let height = 0
      for (let i = 0; i < 10; i++) height = draw(band(0, 100), 950 + pauseMs + i * 50)
      return height
    }
    // A minute paused looks like a short gap, not like a reset of the range
    expect(Math.abs(afterPause(60_000) - afterPause(50))).toBeLessThan(20)
  })
})
