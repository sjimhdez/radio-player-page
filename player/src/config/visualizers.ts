import { oscilloscopeVisualizer } from 'src/components/visualizers/oscilloscope-visualizer'
import { barVisualizer } from 'src/components/visualizers/bar-visualizer'
import { particlesVisualizer } from 'src/components/visualizers/particles-visualizer'
import { amplitudeWaterfallVisualizer } from 'src/components/visualizers/amplitude-waterfall-visualizer'
import type { VisualizerFn } from 'src/hooks/use-audio-visualizer'

export type VisualizerDataType = 'time' | 'frequency' | 'other'

export interface VisualizerConfig {
  id: string
  name: string
  dataType: VisualizerDataType
  fn: VisualizerFn
  forceVerticalCenter?: boolean
}

/**
 * Registry of all available visualizers
 * Each visualizer must specify what type of data it needs
 */
export const VISUALIZERS: Record<string, VisualizerConfig> = {
  oscilloscope: {
    id: 'oscilloscope',
    name: 'Oscilloscope (Waves)',
    dataType: 'time',
    fn: oscilloscopeVisualizer,
  },
  bars: {
    id: 'bars',
    name: 'Bars',
    dataType: 'frequency',
    fn: barVisualizer,
    forceVerticalCenter: true,
  },
  particles: {
    id: 'particles',
    name: 'Partículas Orbitando',
    dataType: 'frequency',
    fn: particlesVisualizer,
  },
  spectrogram: {
    id: 'spectrogram',
    name: 'Amplitud Waterfall',
    dataType: 'time',
    fn: amplitudeWaterfallVisualizer,
  },
}

/**
 * Gets a visualizer by its ID
 */
export function getVisualizer(id: string): VisualizerConfig | undefined {
  return VISUALIZERS[id]
}

/**
 * Gets the default visualizer
 */
export function getDefaultVisualizer(): VisualizerConfig {
  return VISUALIZERS.oscilloscope
}

/**
 * List of all available visualizers (for admin)
 */
export function getAvailableVisualizers(): VisualizerConfig[] {
  return Object.values(VISUALIZERS)
}
