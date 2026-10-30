// Catalog of the visualizers: their metadata at once, for the first render, and
// their factories on demand, so that each visualizer is a chunk of its own.
import type { CreateVisualizer, VisualizerDefinition } from 'src/core/visualizers/types'

/** The metadata of a visualizer, without its factory */
export type VisualizerMetadata = Omit<VisualizerDefinition, 'create'>

interface CatalogEntry {
  metadata: VisualizerMetadata
  /** Lazy loader of the factory: one chunk per visualizer */
  load: () => Promise<CreateVisualizer>
}

/**
 * The catalog: metadata (loaded immediately, no code) and lazy loaders. A Map, so
 * only its own ids are found (not the keys of Object.prototype, K115).
 */
const CATALOG = new Map<string, CatalogEntry>([
  [
    'oscilloscope',
    {
      metadata: { id: 'oscilloscope', dataType: 'time' },
      load: async () => {
        const { createOscilloscopeVisualizer } = await import('src/core/visualizers/oscilloscope')
        return createOscilloscopeVisualizer
      },
    },
  ],
  [
    'bars',
    {
      metadata: { id: 'bars', dataType: 'frequency', forceVerticalCenter: true },
      load: async () => {
        const { createBarsVisualizer } = await import('src/core/visualizers/bars')
        return createBarsVisualizer
      },
    },
  ],
  [
    'particles',
    {
      metadata: { id: 'particles', dataType: 'frequency', forceVerticalCenter: true },
      load: async () => {
        const { createParticlesVisualizer } = await import('src/core/visualizers/particles')
        return createParticlesVisualizer
      },
    },
  ],
  [
    'waterfall',
    {
      metadata: { id: 'waterfall', dataType: 'time' },
      load: async () => {
        const { createWaterfallVisualizer } = await import('src/core/visualizers/waterfall')
        return createWaterfallVisualizer
      },
    },
  ],
])

/** Definitions already loaded, so each chunk is imported once */
const visualizerCache = new Map<string, VisualizerDefinition>()

/**
 * Loads the definition of the visualizer `id` (its chunk on the first call), or
 * undefined if the catalog has no such id.
 */
export async function getVisualizer(id: string): Promise<VisualizerDefinition | undefined> {
  const cached = visualizerCache.get(id)
  if (cached) {
    return cached
  }

  const entry = CATALOG.get(id)
  if (!entry) {
    return undefined
  }

  const definition: VisualizerDefinition = { ...entry.metadata, create: await entry.load() }
  visualizerCache.set(id, definition)
  return definition
}

/** Metadata of the default visualizer (the oscilloscope), without loading its chunk */
export function getDefaultVisualizer(): VisualizerMetadata {
  return (CATALOG.get('oscilloscope') as CatalogEntry).metadata
}
