// Bands of the frequency visualizers: the bars and the particles split the
// spectrum on a logarithmic scale, as the ear hears it, up to the top share of it.
// With 128 bands, each group keeps at least one band of its own, so the scale is
// nearly linear in the bass and opens up toward the treble.

/**
 * Share of the bands drawn: above it (about 16 kHz at 44.1–48 kHz) there is
 * hardly any signal, and the right of the bars stayed empty
 */
export const TOP_SHARE = 0.7

/**
 * Edges of `count` groups of bands over data of `length` values: group i reads
 * from edges[i] to edges[i + 1] (not included), at least one band each. The
 * analyser gives 128 values (fftSize 256), more than any count of groups here.
 */
export function bandEdges(count: number, length: number): number[] {
  const top = Math.round(length * TOP_SHARE)
  const edges = [0]

  for (let i = 1; i <= count; i++) {
    const target = Math.round((top + 1) ** (i / count) - 1)
    edges.push(Math.max(edges[i - 1] + 1, target))
  }

  return edges
}
