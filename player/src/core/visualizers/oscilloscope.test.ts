// Characterization of the oscilloscope, written against the code of v3.1.0 without
// changing it. The tests call it only through drawFrames(), so they do not depend
// on how it is built.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOscilloscopeVisualizer as oscilloscopeVisualizer } from 'src/core/visualizers/oscilloscope'
import { DATA_LENGTH, drawFrames, noise, repeat, silence, sine } from 'src/test/visualizer-harness'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('oscilloscopeVisualizer', () => {
  it.each([
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ])('draws the axis and the wave of silence, a sine and noise (%s)', (_name, size) => {
    const { log } = drawFrames(
      oscilloscopeVisualizer,
      [silence('time'), sine(2, 60), noise(1)],
      size,
    )
    expect(log).toMatchSnapshot()
  })

  it('draws one point per value across the whole width', () => {
    const { log } = drawFrames(oscilloscopeVisualizer, [sine(1, 40)], DESKTOP)
    const points = log.filter((line) => /^(moveTo|lineTo)\(/.test(line))
    // The axis (2 points) and the wave (128 points)
    expect(points).toHaveLength(2 + DATA_LENGTH)
    expect(points[2]).toBe('moveTo(0, 450)')
    expect(points[points.length - 1]).toMatch(/^lineTo\(1428.75, /)
  })

  it('puts 0 at the bottom edge and 255 just below the top', () => {
    const data = new Uint8Array(DATA_LENGTH).fill(128)
    data[0] = 0
    data[1] = 255
    const { log } = drawFrames(oscilloscopeVisualizer, [data], DESKTOP)
    const wave = log.filter((line) => /^(moveTo|lineTo)\(/.test(line)).slice(2)
    expect(wave.slice(0, 2)).toEqual(['moveTo(0, 900)', 'lineTo(11.25, 4)'])
  })

  // The size of the canvas, at the density of the screen, belongs to
  // useAudioVisualizer; reassigning it reset the context (K116, K117).
  it('never sets the canvas size', () => {
    const { canvas } = drawFrames(oscilloscopeVisualizer, repeat(silence('time'), 5), PHONE)
    expect(canvas.sizeAssignments).toBe(0)
  })
})
