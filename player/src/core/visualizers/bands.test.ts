import { describe, expect, it } from 'vitest'
import { bandEdges, TOP_SHARE } from 'src/core/visualizers/bands'

describe('bandEdges', () => {
  it('splits the bands from 0 up to the top share of the spectrum', () => {
    const edges = bandEdges(72, 128)
    expect(edges).toHaveLength(73)
    expect(edges[0]).toBe(0)
    expect(edges[72]).toBe(Math.round(128 * TOP_SHARE))
  })

  it('gives each group at least one band of its own, in order', () => {
    for (const count of [50, 72]) {
      const edges = bandEdges(count, 128)
      expect(edges.every((edge, i) => i === 0 || edge > edges[i - 1])).toBe(true)
    }
  })

  it('widens the groups toward the treble, on a logarithmic scale', () => {
    const edges = bandEdges(50, 128)
    const widths = edges.slice(1).map((edge, i) => edge - edges[i])
    expect(widths[0]).toBe(1)
    expect(widths[49]).toBeGreaterThan(5)
    expect(widths.every((width, i) => i === 0 || width >= widths[i - 1])).toBe(true)
  })

  it('follows the length of the data', () => {
    expect(bandEdges(10, 1024)[10]).toBe(Math.round(1024 * TOP_SHARE))
  })
})
