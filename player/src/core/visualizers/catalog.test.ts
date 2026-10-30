// Characterization of the visualizer catalog, written against the code of v3.1.0
// without changing it. Changed since by the fixes of K114 (dead code:
// getAvailableVisualizers and the name field are gone) and K115, and by the new
// shape of the visualizers (a factory, `create`, instead of `fn`).
import { describe, expect, it } from 'vitest'
import { getDefaultVisualizer, getVisualizer } from 'src/core/visualizers/catalog'
import { createWaterfallVisualizer } from 'src/core/visualizers/waterfall'
import { createParticlesVisualizer } from 'src/core/visualizers/particles'
import { createBarsVisualizer } from 'src/core/visualizers/bars'
import { createOscilloscopeVisualizer } from 'src/core/visualizers/oscilloscope'

describe('getVisualizer', () => {
  it.each([
    ['oscilloscope', 'time'],
    ['bars', 'frequency'],
    ['particles', 'frequency'],
    ['waterfall', 'time'],
  ])('loads %s with its metadata and its factory', async (id, dataType) => {
    const config = await getVisualizer(id)
    expect(config).toMatchObject({ id, dataType })
    expect(config?.create).toBeTypeOf('function')
  })

  it.each([
    ['oscilloscope', createOscilloscopeVisualizer],
    ['bars', createBarsVisualizer],
    ['particles', createParticlesVisualizer],
    ['waterfall', createWaterfallVisualizer],
  ])('loads the factory of %s from the core', async (id, create) => {
    expect((await getVisualizer(id))?.create).toBe(create)
  })

  it('returns the same object on the second call (cache)', async () => {
    const first = await getVisualizer('particles')
    expect(await getVisualizer('particles')).toBe(first)
  })

  it.each(['', 'spectrum', 'Oscilloscope'])(
    'returns undefined for the unknown id %j',
    async (id) => {
      expect(await getVisualizer(id)).toBeUndefined()
    },
  )

  // K115: the lookups were plain objects, so an Object.prototype key passed them.
  it.each(['toString', 'constructor', '__proto__'])(
    'returns undefined for the Object.prototype key %j',
    async (id) => {
      expect(await getVisualizer(id)).toBeUndefined()
    },
  )

  // The particles keep the station info centered too since they move with the
  // music, as the user chose after reviewing them
  it('forces the vertical centering for bars and particles', async () => {
    const ids = ['oscilloscope', 'bars', 'particles', 'waterfall']
    const configs = await Promise.all(ids.map((id) => getVisualizer(id)))
    expect(configs.map((config) => config?.forceVerticalCenter ?? false)).toEqual([
      false,
      true,
      true,
      false,
    ])
  })
})

describe('getDefaultVisualizer', () => {
  it('gives the oscilloscope metadata, without a drawing function', () => {
    expect(getDefaultVisualizer()).toEqual({ id: 'oscilloscope', dataType: 'time' })
  })
})
