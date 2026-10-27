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
 * Whether Intl accepts the value as an IANA time zone (C9, ADR 0046).
 */
function isValidTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || timezone === '') {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

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

  // The site zone; without it the player falls back to timezoneOffset (ADR 0046)
  const timezone = isValidTimezone(config?.timezone) ? config.timezone : undefined

  // An empty array passes as an object (K17)
  const resolvedSchedule = schedule && typeof schedule === 'object' ? schedule : undefined

  return {
    streamUrl: config?.streamUrl || '',
    siteTitle: config?.siteTitle || '',
    // Only a real true hides the name (ADR 0054)
    hideTitle: config?.hideTitle === true,
    backgroundImage: config?.backgroundImage || undefined,
    logoImage: config?.logoImage || undefined,
    introAudioUrl: config?.introAudioUrl || undefined,
    themeColor,
    visualizer,
    timezoneOffset,
    timezone,
    programs: Array.isArray(programs) ? programs : undefined,
    schedule: resolvedSchedule,
  }
}
