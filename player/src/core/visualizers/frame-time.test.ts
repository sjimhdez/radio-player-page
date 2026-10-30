import { describe, expect, it } from 'vitest'
import {
  createFrameStep,
  framesIn,
  MAX_STEP_MS,
  REFERENCE_FRAME_MS,
  smoothingFor,
  stepsOf,
} from 'src/core/visualizers/frame-time'

describe('createFrameStep', () => {
  it('gives one reference frame on the first frame', () => {
    const step = createFrameStep()
    expect(step(5000)).toBe(REFERENCE_FRAME_MS)
  })

  it('gives the time since the previous frame', () => {
    const step = createFrameStep()
    step(1000)
    expect(step(1008)).toBe(8)
    expect(step(1033)).toBe(25)
  })

  it(`caps the step at ${MAX_STEP_MS} ms after a hidden tab or a pause`, () => {
    const step = createFrameStep()
    step(1000)
    expect(step(11000)).toBe(MAX_STEP_MS)
  })

  it('never goes back in time', () => {
    const step = createFrameStep()
    step(1000)
    expect(step(990)).toBe(0)
  })
})

describe('smoothingFor', () => {
  it('is the per-frame factor on a reference frame', () => {
    expect(smoothingFor(0.25, REFERENCE_FRAME_MS)).toBeCloseTo(0.25, 10)
  })

  it('is exactly the per-frame factor on 60 fps timestamps', () => {
    const start = Date.UTC(2026, 9, 29, 12, 0, 0)
    const step = start + (7 * 1000) / 60 - (start + (6 * 1000) / 60)
    expect(smoothingFor(0.15, step)).toBe(smoothingFor(0.15, REFERENCE_FRAME_MS))
  })

  it('reaches the same point in the same time at any frame rate', () => {
    let at60 = 0
    let at120 = 0
    for (let i = 0; i < 6; i++) at60 += (1 - at60) * smoothingFor(0.15, 1000 / 60)
    for (let i = 0; i < 12; i++) at120 += (1 - at120) * smoothingFor(0.15, 1000 / 120)
    expect(at120).toBeCloseTo(at60, 10)
  })

  it('does not move on a step of 0 ms', () => {
    expect(smoothingFor(0.3, 0)).toBe(0)
  })
})

describe('stepsOf', () => {
  it('counts whole reference frames and keeps the rest for later', () => {
    const steps = stepsOf()
    expect(steps(1000 / 120)).toBe(0)
    expect(steps(1000 / 120)).toBe(1)
    expect(steps(2.5 * REFERENCE_FRAME_MS)).toBe(2)
    expect(steps(0.5 * REFERENCE_FRAME_MS)).toBe(1)
  })

  it('does not lose a frame to rounding on 60 fps timestamps', () => {
    const steps = stepsOf()
    const start = Date.UTC(2026, 9, 29, 12, 0, 0)
    let total = 0
    for (let i = 1; i <= 600; i++) {
      total += steps(start + (i * 1000) / 60 - (start + ((i - 1) * 1000) / 60))
    }
    expect(total).toBe(600)
  })
})

describe('framesIn', () => {
  it('counts the reference frames in a step', () => {
    expect(framesIn(1000 / 120)).toBe(0.5)
    expect(framesIn(50)).toBe(3)
  })
})
