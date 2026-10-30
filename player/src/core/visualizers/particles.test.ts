// Characterization of the particles, written against the code of v3.1.0 without
// changing it. The tests call it only through drawFrames(), so they do not depend
// on how it is built; Math.random() gives a fixed sequence (the speed of each
// particle).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createParticlesVisualizer as particlesVisualizer } from 'src/core/visualizers/particles'
import { bandEdges } from 'src/core/visualizers/bands'
import { createFakeCanvas2D, FakeCanvasElement } from 'src/test/fake-canvas-2d'
import {
  band,
  drawFrames,
  FRAME_120_FPS,
  FRAME_60_FPS,
  noise,
  repeat,
  silence,
  withRandom,
} from 'src/test/visualizer-harness'

const DESKTOP = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const RANDOM = [0, 0.25, 0.5, 0.75, 0.999]

/** Lines of the last frame of a log */
function lastFrame(log: string[]): string[] {
  const start = log.map((line) => line.startsWith('frame ')).lastIndexOf(true)
  return log.slice(start + 1)
}

/** Center of each particle (the arc calls) in the lines of a frame */
function particles(lines: string[]): { x: number; y: number }[] {
  return lines
    .filter((line) => line.startsWith('arc('))
    .map((line) => {
      const [x, y] = line.slice('arc('.length, -1).split(', ').map(Number)
      return { x, y }
    })
}

/** Distance of each particle to the center of the canvas */
function radii(lines: string[], size: { width: number; height: number }): number[] {
  return particles(lines).map(({ x, y }) => Math.hypot(x - size.width / 2, y - size.height / 2))
}

/** Indexes of the particles whose radius differs between two frames */
function moved(a: number[], b: number[]): number[] {
  return a.flatMap((radius, i) => (Math.abs(radius - b[i]) > 0.5 ? [i] : []))
}

beforeEach(() => {
  vi.useFakeTimers()
  withRandom(RANDOM)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('particlesVisualizer', () => {
  it.each([
    ['desktop', DESKTOP],
    ['phone', PHONE],
  ])('draws 50 particles and their trails over 3 frames of noise (%s)', (_name, size) => {
    const { log } = drawFrames(particlesVisualizer, [noise(1), noise(2), noise(3)], size)
    expect(log).toMatchSnapshot()
  })

  it('spreads 50 particles from 5 % to 45 % of the smaller side when silent', () => {
    const { log } = drawFrames(particlesVisualizer, [silence('frequency')], DESKTOP)
    const all = radii(lastFrame(log), DESKTOP)
    expect(all).toHaveLength(50)
    expect(all[0]).toBeCloseTo(45, 0)
    expect(all[49]).toBeCloseTo(45 + (405 - 45) * (49 / 50), 0)
  })

  it('draws a trail only from the second frame, up to 60 points', () => {
    const { log } = drawFrames(particlesVisualizer, repeat(silence('frequency'), 70), PHONE)
    const frames = log
      .join('\n')
      .split(/frame \d+\n?/)
      .slice(1)
    const strokes = frames.map((frame) => frame.split('stroke()').length - 1)
    expect(strokes[0]).toBe(0)
    expect(strokes[1]).toBe(50)
    const trail = lastFrame(log)
    const firstStroke = trail.indexOf('stroke()')
    const points = trail.slice(0, firstStroke).filter((line) => /^(moveTo|lineTo)\(/.test(line))
    expect(points).toHaveLength(60)
  })

  it('starts over, without trails, when the size changes', () => {
    const desktop = drawFrames(particlesVisualizer, repeat(noise(4), 3), DESKTOP)
    const phone = drawFrames(particlesVisualizer, [noise(4)], PHONE, {
      start: desktop.next,
      surface: desktop,
    })
    expect(phone.log).not.toContain('stroke()')
    expect(phone.canvas.sizeAssignments).toBe(0)
  })

  // The size of the canvas belongs to useAudioVisualizer (K116).
  it('never sets the canvas size', () => {
    const { canvas } = drawFrames(particlesVisualizer, repeat(noise(3), 5), PHONE)
    expect(canvas.sizeAssignments).toBe(0)
  })

  // Each particle reads its own bands, spread over the spectrum up to the top share
  // on a logarithmic scale (bandEdges()); most of them used to read the last band.
  it('maps the 50 particles to 50 distinct groups of bands across the spectrum (C5)', () => {
    const quiet = radii(
      lastFrame(drawFrames(particlesVisualizer, repeat(silence('frequency'), 10), DESKTOP).log),
      DESKTOP,
    )
    const at = (index: number) =>
      radii(
        lastFrame(drawFrames(particlesVisualizer, repeat(band(index, 255), 10), DESKTOP).log),
        DESKTOP,
      )
    const edges = bandEdges(50, 128)
    for (let particle = 0; particle < 50; particle++) {
      expect(moved(quiet, at(edges[particle]))).toEqual([particle])
    }
    expect(moved(quiet, at(edges[50] - 1))).toEqual([49])
    expect(moved(quiet, at(127))).toEqual([])
  })

  // The rotation follows the time between frames, so in the same 200 ms a particle
  // turns as far at 120 fps as at 60 fps (K119).
  it('rotates by time: in 200 ms, the same angle at 120 fps', () => {
    const angle = (frameMs: number) => {
      const frames = repeat(silence('frequency'), Math.round(200 / frameMs))
      const [first] = particles(
        lastFrame(drawFrames(particlesVisualizer, frames, DESKTOP, { frameMs }).log),
      )
      return Math.atan2(first.y - DESKTOP.height / 2, first.x - DESKTOP.width / 2)
    }
    // Particle 0 starts at angle 0 with speed 0.03 · 0.7 (Math.random() = 0)
    expect(angle(FRAME_60_FPS)).toBeCloseTo(12 * 0.021, 2)
    // The first frame counts as one at 60 fps: 1 + 23 half frames at 120 fps
    expect(angle(FRAME_120_FPS)).toBeCloseTo(12.5 * 0.021, 2)
  })

  // The radius is smoothed by time (factor 0.25 per 1/60 s), so in the same 100 ms
  // a particle gets as close to its target at any frame rate (K119).
  it('smooths the radius by time: after 100 ms, as close to the target at 120 fps', () => {
    const radius = (frameMs: number) => {
      const frames = [silence('frequency'), ...repeat(band(7, 255), Math.round(100 / frameMs))]
      const all = radii(
        lastFrame(drawFrames(particlesVisualizer, frames, DESKTOP, { frameMs }).log),
        DESKTOP,
      )
      return all[7]
    }
    // Particle 7 (it reads band 7): base 45 + 360 · 7/50 = 95.4, target 95.4 + 360 = 455.4
    expect(radius(FRAME_60_FPS)).toBeCloseTo(95.4 + 360 * (1 - 0.75 ** 6), 0)
    expect(radius(FRAME_120_FPS)).toBeCloseTo(95.4 + 360 * (1 - 0.75 ** 6), 0)
  })

  // The trail keeps the last second, not the last 60 frames, so it is as long at
  // 120 fps as at 60 fps, with twice the points (K119).
  it('keeps 1 s of trail: after 1 s, as long at 120 fps, with twice the points', () => {
    const trail = (frameMs: number) => {
      const frames = repeat(silence('frequency'), Math.round(1000 / frameMs))
      const lines = lastFrame(drawFrames(particlesVisualizer, frames, PHONE, { frameMs }).log)
      return lines
        .slice(0, lines.indexOf('stroke()'))
        .filter((line) => /^(moveTo|lineTo)\(/.test(line))
        .map((line) =>
          line
            .slice(line.indexOf('(') + 1, -1)
            .split(', ')
            .map(Number),
        )
    }
    const at60 = trail(FRAME_60_FPS)
    const at120 = trail(FRAME_120_FPS)
    expect(at60).toHaveLength(60)
    expect(at120).toHaveLength(119)
    // The oldest point is at the same place: the trail covers the same arc
    expect(at120[0][0]).toBeCloseTo(at60[0][0], 0)
    expect(at120[0][1]).toBeCloseTo(at60[0][1], 0)
  })

  // The speed of each particle comes from Math.random() when the state starts (K121).
  it('currently draws another picture with another Math.random() sequence', () => {
    const first = drawFrames(particlesVisualizer, repeat(silence('frequency'), 3), PHONE).log
    vi.restoreAllMocks()
    withRandom([0.6])
    const second = drawFrames(particlesVisualizer, repeat(silence('frequency'), 3), PHONE).log
    expect(second).not.toEqual(first)
  })
})

// The speed of each particle comes from the injected random function, not from
// Math.random(), so a test can fix it (K121).
describe('createParticlesVisualizer: injected randomness', () => {
  /** Log of three frames of noise drawn by a new instance */
  function drawWith(random: () => number): string[] {
    const ctx = createFakeCanvas2D()
    ;(ctx as { canvas: HTMLCanvasElement }).canvas = new FakeCanvasElement().asCanvas()
    const particles = particlesVisualizer({ random })
    ;[noise(1), noise(2), noise(3)].forEach((data, index) =>
      particles.draw(ctx, data, { ...DESKTOP, time: index * FRAME_60_FPS }),
    )
    return ctx.log
  }

  it('draws the same picture for the same random sequence, whatever Math.random gives', () => {
    vi.mocked(Math.random).mockRestore()
    const sequence = () => {
      let index = 0
      return () => RANDOM[index++ % RANDOM.length]
    }
    expect(drawWith(sequence())).toEqual(drawWith(sequence()))
    expect(drawWith(sequence())).not.toEqual(drawWith(() => 0.5))
  })
})
