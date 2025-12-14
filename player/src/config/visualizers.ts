import type { VisualizerFn } from 'src/hooks/use-audio-visualizer'

/**
 * Type of audio data required by a visualizer
 * - 'time': Time domain data (waveform)
 * - 'frequency': Frequency domain data (spectrum)
 * - 'other': Other data types (custom implementations)
 */
export type VisualizerDataType = 'time' | 'frequency' | 'other'

/**
 * Visualizer configuration interface
 * Contains metadata and the visualizer function for rendering
 */
export interface VisualizerConfig {
  /** Unique identifier for the visualizer */
  id: string
  /** Display name of the visualizer */
  name: string
  /** Type of audio data this visualizer requires */
  dataType: VisualizerDataType
  /** Function that renders the visualization */
  fn: VisualizerFn
  /** Force vertical centering of stream info when this visualizer is active */
  forceVerticalCenter?: boolean
}

/**
 * Metadata for visualizers (loaded immediately, no code)
 */
const VISUALIZER_METADATA: Record<string, Omit<VisualizerConfig, 'fn'>> = {
  oscilloscope: {
    id: 'oscilloscope',
    name: 'Oscilloscope',
    dataType: 'time',
  },
  bars: {
    id: 'bars',
    name: 'Bars',
    dataType: 'frequency',
    forceVerticalCenter: true,
  },
  particles: {
    id: 'particles',
    name: 'Orbiting Particles',
    dataType: 'frequency',
  },
  waterfall: {
    id: 'waterfall',
    name: 'Amplitude Waterfall',
    dataType: 'time',
  },
}

/**
 * Cache for loaded visualizers
 */
const visualizerCache: Record<string, VisualizerConfig> = {}

/**
 * Lazy loaders for each visualizer
 */
const visualizerLoaders: Record<string, () => Promise<VisualizerFn>> = {
  oscilloscope: async () => {
    const { oscilloscopeVisualizer } = await import(
      'src/components/visualizers/oscilloscope-visualizer'
    )
    return oscilloscopeVisualizer
  },
  bars: async () => {
    const { barVisualizer } = await import('src/components/visualizers/bar-visualizer')
    return barVisualizer
  },
  particles: async () => {
    const { particlesVisualizer } = await import('src/components/visualizers/particles-visualizer')
    return particlesVisualizer
  },
  waterfall: async () => {
    const { amplitudeWaterfallVisualizer } = await import(
      'src/components/visualizers/amplitude-waterfall-visualizer'
    )
    return amplitudeWaterfallVisualizer
  },
}

/**
 * Gets a visualizer by its ID (async, lazy loads the code)
 * Visualizers are code-split and loaded on-demand to reduce initial bundle size
 * Results are cached after first load
 *
 * @param id - Visualizer identifier (e.g., 'oscilloscope', 'bars', 'particles', 'waterfall')
 * @returns Promise resolving to visualizer config or undefined if not found
 */
export async function getVisualizer(id: string): Promise<VisualizerConfig | undefined> {
  // Check cache first
  if (visualizerCache[id]) {
    return visualizerCache[id]
  }

  // Check if metadata exists
  const metadata = VISUALIZER_METADATA[id]
  if (!metadata) {
    return undefined
  }

  // Check if loader exists
  const loader = visualizerLoaders[id]
  if (!loader) {
    return undefined
  }

  // Load the visualizer function
  const fn = await loader()

  // Create config and cache it
  const config: VisualizerConfig = {
    ...metadata,
    fn,
  }

  visualizerCache[id] = config
  return config
}

/**
 * Gets the default visualizer metadata (synchronous, for initial render)
 * Returns metadata without the visualizer function to avoid loading code during SSR or initial render
 *
 * @returns Default visualizer metadata (oscilloscope)
 */
export function getDefaultVisualizer(): Omit<VisualizerConfig, 'fn'> {
  return VISUALIZER_METADATA.oscilloscope
}

/**
 * List of all available visualizers (for admin - metadata only)
 * Returns metadata for all visualizers without loading their code
 * Used by admin interface to display visualizer options
 *
 * @returns Array of visualizer metadata objects
 */
export function getAvailableVisualizers(): Omit<VisualizerConfig, 'fn'>[] {
  return Object.values(VISUALIZER_METADATA)
}
