import type { PluginConfig, ProgramDefinition, ResolvedConfig, Schedule } from 'src/types/global'

/**
 * Valid theme color values
 */
const VALID_THEMES = [
  'neutral',
  'blue',
  'green',
  'red',
  'orange',
  'yellow',
  'purple',
  'pink',
] as const

/**
 * Valid visualizer values
 */
const VALID_VISUALIZERS = ['oscilloscope', 'bars', 'particles', 'waterfall'] as const

/**
 * The window.RADPLAPAG_* globals as WordPress prints them, before validation.
 */
export interface RawGlobals {
  /** window.RADPLAPAG_CONFIG */
  config?: PluginConfig
  /** window.RADPLAPAG_PROGRAMS */
  programs?: ProgramDefinition[]
  /** window.RADPLAPAG_SCHEDULE */
  schedule?: Schedule
}

/**
 * Validates the plugin globals and resolves them into the config the app uses.
 *
 * Every value is checked against its whitelist or range and replaced with a safe
 * default when invalid. Pure: the caller reads the globals and passes them in.
 *
 * @param globals - The raw config, programs and schedule
 * @returns ResolvedConfig (config + programs + schedule)
 */
export function readConfig({ config, programs, schedule }: RawGlobals): ResolvedConfig {
  // Validate themeColor against whitelist
  const themeColor =
    config?.themeColor && VALID_THEMES.includes(config.themeColor as (typeof VALID_THEMES)[number])
      ? config.themeColor
      : 'neutral'

  // Validate visualizer against whitelist
  const visualizer =
    config?.visualizer &&
    VALID_VISUALIZERS.includes(config.visualizer as (typeof VALID_VISUALIZERS)[number])
      ? config.visualizer
      : 'oscilloscope'

  // Validate timezoneOffset (must be a number between -12 and 14)
  const timezoneOffset =
    typeof config?.timezoneOffset === 'number' &&
    config.timezoneOffset >= -12 &&
    config.timezoneOffset <= 14
      ? config.timezoneOffset
      : 0 // Default to UTC (0) if invalid

  // An empty array passes as an object (K17)
  const resolvedSchedule = schedule && typeof schedule === 'object' ? schedule : undefined

  return {
    streamUrl: config?.streamUrl || '',
    siteTitle: config?.siteTitle || '',
    backgroundImage: config?.backgroundImage || undefined,
    logoImage: config?.logoImage || undefined,
    introAudioUrl: config?.introAudioUrl || undefined,
    themeColor,
    visualizer,
    timezoneOffset,
    programs: Array.isArray(programs) ? programs : undefined,
    schedule: resolvedSchedule,
  }
}
