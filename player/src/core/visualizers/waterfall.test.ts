// Characterization of the amplitude waterfall, written against the code of v3.1.0
// without changing it. The tests call it only through drawFrames(), so they do not
// depend on how it is built.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWaterfallVisualizer as amplitudeWaterfallVisualizer } from 'src/core/visualizers/waterfall'
import {
  drawFrames,
  FRAME_120_FPS,
  FRAME_60_FPS,
  noise,
  repeat,
  silence,
  sine,
} from 'src/test/visualizer-harness'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

/** Lines of the last frame of a log */
function lastFrame(log: string[]): string[] {
  const start = log.map((line) => line.startsWith('frame ')).lastIndexOf(true)
  return log.slice(start + 1)
}

/** x and height of each column (the fillRect calls) in the lines of a frame */
function columns(lines: string[]): { x: number; height: number }[] {
  return lines
    .filter((line) => line.startsWith('fillRect('))
    .map((line) => {
      const [x, , , height] = line.slice('fillRect('.length, -1).split(', ').map(Number)
      return { x, height }
    })
}

/** Height of the newest column (the rightmost) of the last frame */
function newest(log: string[]): number {
  const all = columns(lastFrame(log))
  return all[all.length - 1].height
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('amplitudeWaterfallVisualizer', () => {
  it.each([
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ])('draws the columns of silence, a sine and noise (%s)', (_name, size) => {
    const { log } = drawFrames(
      amplitudeWaterfallVisualizer,
      [silence('time'), sine(2, 60), noise(1)],
      size,
    )
    expect(log).toMatchSnapshot()
  })

  it('draws a 2 px column per 2 px of width, centered on the middle', () => {
    const { log } = drawFrames(amplitudeWaterfallVisualizer, [sine(1, 64)], PHONE)
    const all = columns(lastFrame(log))
    expect(all).toHaveLength(195)
    expect(all[0]).toEqual({ x: 0, height: 0 })
    expect(all[194].x).toBe(388)
    expect(
      lastFrame(log)
        .filter((line) => line.startsWith('fillRect('))
        .pop(),
    ).toMatch(/^fillRect\(388, [\d.]+, 2, [\d.]+\)$/)
  })

  it('moves a loud column one column to the left per frame, with a fading tail', () => {
    const { log } = drawFrames(
      amplitudeWaterfallVisualizer,
      [sine(2, 100), ...repeat(silence('time'), 5)],
      PHONE,
    )
    const loud = columns(lastFrame(log)).filter((column) => column.height > 0)
    // The silence that follows is smoothed towards 0: a tail that fades to the right
    expect(loud.map((column) => column.x)).toEqual([378, 380, 382, 384, 386, 388])
    const heights = loud.map((column) => column.height)
    expect(heights).toEqual([...heights].sort((a, b) => b - a))
  })

  it('starts over when the size or the number of values changes', () => {
    const desktop = drawFrames(amplitudeWaterfallVisualizer, repeat(sine(2, 100), 3), DESKTOP)
    const phone = drawFrames(amplitudeWaterfallVisualizer, [silence('time')], PHONE, {
      start: desktop.next,
      surface: desktop,
    })
    expect(columns(lastFrame(phone.log)).every((column) => column.height === 0)).toBe(true)
    const shorter = drawFrames(
      amplitudeWaterfallVisualizer,
      [new Uint8Array(64).fill(128)],
      PHONE,
      {
        start: phone.next,
        surface: phone,
      },
    )
    expect(shorter.canvas.sizeAssignments).toBe(0)
  })

  // The size of the canvas belongs to useAudioVisualizer (K116).
  it('never sets the canvas size', () => {
    const { canvas } = drawFrames(amplitudeWaterfallVisualizer, repeat(noise(3), 5), PHONE)
    expect(canvas.sizeAssignments).toBe(0)
  })

  // The waterfall scrolls one column per 1/60 s, so in the same 200 ms it moves as
  // far at 120 fps as at 60 fps (K119).
  it('scrolls by time: in 200 ms, the same distance at 120 fps as at 60 fps', () => {
    const distance = (frameMs: number) => {
      const frames = [sine(2, 100), ...repeat(silence('time'), Math.round(200 / frameMs))]
      const { log } = drawFrames(amplitudeWaterfallVisualizer, frames, PHONE, { frameMs })
      const [loud] = columns(lastFrame(log)).filter((column) => column.height > 0)
      return 388 - loud.x
    }
    expect(distance(FRAME_60_FPS)).toBe(24)
    expect(distance(FRAME_120_FPS)).toBe(24)
  })

  // The new column is smoothed against the previous one also when that one is
  // silent (0), so sound after silence rises to 30 % at once (K122).
  it('smooths the first column after silence as any other', () => {
    const afterSilence = drawFrames(
      amplitudeWaterfallVisualizer,
      [silence('time'), sine(2, 100)],
      PHONE,
    )
    const settled = drawFrames(amplitudeWaterfallVisualizer, repeat(sine(2, 100), 60), PHONE)
    expect(newest(afterSilence.log)).toBeCloseTo(0.3 * newest(settled.log), 0)
  })
})
