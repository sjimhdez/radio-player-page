// Levels of the frequency visualizers. Music has much more energy in the bass than
// in the treble, and the analyser gives it in decibels, so the bass sat at the top
// and the bars went down in steps to the right. Each group of bands is raised by
// its octaves above the bass (the tilt), and then measured against its own recent
// range, so that it moves with the music at any level.
import { bandEdges } from 'src/core/visualizers/bands'

/** Raise of the treble, in decibels per octave (music falls about as much) */
export const TILT_DB_PER_OCTAVE = 3

/** Byte units per decibel: the analyser maps its default -100 to -30 dB onto 0–255 */
const UNITS_PER_DB = 255 / 70

/** Center of the band the tilt starts from: the second band, about 200–300 Hz */
const REFERENCE_BAND = 1.5

/**
 * Smallest range a group is measured against (about 26 dB): a faint steady sound
 * (hiss) stays low, and a group only reaches the top with a strong sound
 */
export const MIN_RANGE = 96

/** Below this value the tilt shrinks with the signal, so silence stays at 0 */
export const TILT_KNEE = 64

/** Time constant, in milliseconds, of the fall of a group's top after a loud moment */
const TOP_FALL_MS = 1500

/** Time constant, in milliseconds, of the rise of a group's bottom after a quiet moment */
const BOTTOM_RISE_MS = 4000

/** Raise of each group (from edges[i] to edges[i + 1]) in byte units, 0 in the bass */
export function tiltOf(edges: number[]): number[] {
  return edges.slice(1).map((end, i) => {
    const center = (edges[i] + end) / 2
    const octaves = Math.log2(center / REFERENCE_BAND)
    return Math.max(0, octaves * TILT_DB_PER_OCTAVE * UNITS_PER_DB)
  })
}

/** Average of each group of bands plus its tilt (less of it below TILT_KNEE) */
export function groupValues(data: Uint8Array, edges: number[], tilt: number[]): number[] {
  return tilt.map((raise, i) => {
    let sum = 0
    for (let band = edges[i]; band < edges[i + 1]; band++) {
      sum += data[band]
    }
    const average = sum / (edges[i + 1] - edges[i])
    return average + raise * Math.min(1, average / TILT_KNEE)
  })
}

/**
 * Creates the meter of `count` groups: given their values and the milliseconds
 * since the previous call, returns the level of each in 0–1 within its own recent
 * range (its top follows the peaks at once and falls slowly; its bottom, the other
 * way round), never narrower than MIN_RANGE.
 */
export function createLevelMeter(count: number): (values: number[], stepMs: number) => number[] {
  const tops = new Array<number>(count).fill(MIN_RANGE)
  const bottoms = new Array<number>(count).fill(0)

  return (values, stepMs) => {
    const topFall = 1 - Math.exp(-stepMs / TOP_FALL_MS)
    const bottomRise = 1 - Math.exp(-stepMs / BOTTOM_RISE_MS)

    return values.map((value, i) => {
      tops[i] = value > tops[i] ? value : tops[i] + (value - tops[i]) * topFall
      bottoms[i] = value < bottoms[i] ? value : bottoms[i] + (value - bottoms[i]) * bottomRise
      if (tops[i] - bottoms[i] < MIN_RANGE) {
        bottoms[i] = Math.max(0, tops[i] - MIN_RANGE)
        tops[i] = bottoms[i] + MIN_RANGE
      }
      return Math.min(1, Math.max(0, (value - bottoms[i]) / (tops[i] - bottoms[i])))
    })
  }
}

/**
 * Creates the levels of `count` groups of bands over the spectrum (bandEdges(),
 * the tilt and the meter): given the frequency data and the milliseconds since
 * the previous call, returns the level of each group in 0–1, bass first.
 */
export function createSpectrumLevels(
  count: number,
): (data: Uint8Array, stepMs: number) => number[] {
  const meter = createLevelMeter(count)
  let groups: { length: number; edges: number[]; tilt: number[] } | undefined

  return (data, stepMs) => {
    if (!groups || groups.length !== data.length) {
      const edges = bandEdges(count, data.length)
      groups = { length: data.length, edges, tilt: tiltOf(edges) }
    }
    return meter(groupValues(data, groups.edges, groups.tilt), stepMs)
  }
}
