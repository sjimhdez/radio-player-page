import { describe, expect, it } from 'vitest'
import { bandEdges } from 'src/core/visualizers/bands'
import {
  createLevelMeter,
  createSpectrumLevels,
  groupValues,
  MIN_RANGE,
  TILT_KNEE,
  TILT_DB_PER_OCTAVE,
  tiltOf,
} from 'src/core/visualizers/levels'

// The analyser maps -100 to -30 dB onto 0–255 (its default decibel range)
const UNITS_PER_DB = 255 / 70

describe('tiltOf', () => {
  it('raises each group by its octaves above the first ones', () => {
    const edges = bandEdges(72, 128)
    const tilt = tiltOf(edges)
    expect(tilt).toHaveLength(72)
    expect(tilt[0]).toBe(0)
    // The last group, around band 87, is about 5.9 octaves above band 1.5
    const octaves = Math.log2((edges[71] + edges[72]) / 2 / 1.5)
    expect(tilt[71]).toBeCloseTo(octaves * TILT_DB_PER_OCTAVE * UNITS_PER_DB, 5)
  })

  it('grows toward the treble', () => {
    const tilt = tiltOf(bandEdges(50, 128))
    expect(tilt.every((value, i) => i === 0 || value >= tilt[i - 1])).toBe(true)
  })
})

describe('groupValues', () => {
  it('adds the tilt to the average of each group', () => {
    const data = Uint8Array.from([100, 70, 80, 90])
    expect(groupValues(data, [0, 1, 4], [0, 5])).toEqual([100, 85])
  })

  it('adds less tilt to a faint group, and none to a silent one', () => {
    const data = Uint8Array.from([0, 0, TILT_KNEE / 2, TILT_KNEE / 2])
    expect(groupValues(data, [0, 2, 4], [10, 10])).toEqual([0, TILT_KNEE / 2 + 5])
  })
})

describe('createLevelMeter', () => {
  it('is 0 in silence', () => {
    const meter = createLevelMeter(2)
    for (let i = 0; i < 100; i++) meter([0, 0], 50)
    expect(meter([0, 0], 50)).toEqual([0, 0])
  })

  it('gives 1 to a group at the top of its own range, whatever its level', () => {
    const meter = createLevelMeter(2)
    expect(meter([250, 120], 50)).toEqual([1, 1])
  })

  it('keeps a steady sound at the top instead of fading it out', () => {
    const meter = createLevelMeter(1)
    let level = [0]
    for (let i = 0; i < 200; i++) level = meter([200], 50)
    expect(level[0]).toBe(1)
  })

  it('follows the beat: a drop inside the recent range shows as a lower level', () => {
    const meter = createLevelMeter(1)
    // 20 s: the bottom starts at 0 and rises in a few seconds
    for (let i = 0; i < 400; i++) meter([i % 2 === 0 ? 220 : 140], 50)
    const [high] = meter([220], 50)
    const [low] = meter([140], 50)
    expect(high).toBe(1)
    expect(low).toBeLessThan(0.3)
  })

  it(`never stretches less than ${MIN_RANGE} units, so small noise stays small`, () => {
    const meter = createLevelMeter(1)
    for (let i = 0; i < 200; i++) meter([i % 2 === 0 ? 102 : 100], 50)
    const [low] = meter([100], 50)
    expect(low).toBeGreaterThan(1 - 4 / MIN_RANGE)
  })

  it('lowers its top over time after a loud moment, the same at any frame rate', () => {
    const settle = (stepMs: number) => {
      const meter = createLevelMeter(1)
      meter([250], stepMs)
      let level = [0]
      for (let t = 0; t < 2000; t += stepMs) level = meter([150], stepMs)
      return level[0]
    }
    expect(settle(50)).toBeGreaterThan(0.5)
    expect(settle(25)).toBeCloseTo(settle(50), 2)
  })
})

describe('createSpectrumLevels', () => {
  it('gives one level per group, 0 in silence and 1 for a group that sounds', () => {
    const levels = createSpectrumLevels(50)
    expect(levels(new Uint8Array(128), 16)).toEqual(new Array(50).fill(0))
    const data = new Uint8Array(128)
    data[0] = 200
    const [first, ...rest] = levels(data, 16)
    expect(first).toBe(1)
    expect(rest.every((level) => level === 0)).toBe(true)
  })

  it('follows a change in the length of the data', () => {
    const levels = createSpectrumLevels(10)
    levels(new Uint8Array(128), 16)
    const edges = bandEdges(10, 1024)
    const data = new Uint8Array(1024).fill(200, edges[9], edges[10])
    expect(levels(data, 16)[9]).toBe(1)
  })
})
