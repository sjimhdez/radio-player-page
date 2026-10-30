import type {
  AdminDiagnostics,
  PluginConfig,
  ProgramDefinition,
  ResolvedConfig,
  Schedule,
} from 'src/types/global'

/** The theme colors the admin offers; anything else falls back to neutral */
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

/** The visualizer ids of the catalog; anything else falls back to the oscilloscope */
const VALID_VISUALIZERS = ['oscilloscope', 'bars', 'particles', 'waterfall'] as const

/** Whether Intl accepts the value as an IANA time zone (ADR 0046) */
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
 * adminDiagnostics with only its editUrl, or null if it is not an object with an
 * http(s) editUrl (ADR 0065).
 */
function readAdminDiagnostics(value: unknown): AdminDiagnostics | null {
  if (value === null || typeof value !== 'object') {
    return null
  }
  const { editUrl } = value as { editUrl?: unknown }
  return typeof editUrl === 'string' && /^https?:\/\//i.test(editUrl) ? { editUrl } : null
}

/** The window.RADPLAPAG_* globals as WordPress prints them, before validation */
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
 */
export function readConfig({ config, programs, schedule }: RawGlobals): ResolvedConfig {
  const themeColor =
    config?.themeColor && VALID_THEMES.includes(config.themeColor as (typeof VALID_THEMES)[number])
      ? config.themeColor
      : 'neutral'

  const visualizer =
    config?.visualizer &&
    VALID_VISUALIZERS.includes(config.visualizer as (typeof VALID_VISUALIZERS)[number])
      ? config.visualizer
      : 'oscilloscope'

  // The offsets that exist on Earth, UTC-12 to UTC+14; UTC otherwise.
  const timezoneOffset =
    typeof config?.timezoneOffset === 'number' &&
    config.timezoneOffset >= -12 &&
    config.timezoneOffset <= 14
      ? config.timezoneOffset
      : 0

  // The site zone; without it the player falls back to timezoneOffset (ADR 0046)
  const timezone = isValidTimezone(config?.timezone) ? config.timezone : undefined

  // An empty array passes as an object (K17)
  const resolvedSchedule = schedule && typeof schedule === 'object' ? schedule : undefined

  return {
    streamUrl: config?.streamUrl || '',
    siteTitle: config?.siteTitle || '',
    // Only a real true hides the name (ADR 0054)
    hideTitle: config?.hideTitle === true,
    // Only a real true shows the current song (ADR 0068)
    showSong: config?.showSong === true,
    backgroundImage: config?.backgroundImage || undefined,
    logoImage: config?.logoImage || undefined,
    introAudioUrl: config?.introAudioUrl || undefined,
    themeColor,
    visualizer,
    timezoneOffset,
    timezone,
    adminDiagnostics: readAdminDiagnostics(config?.adminDiagnostics),
    programs: Array.isArray(programs) ? programs : undefined,
    schedule: resolvedSchedule,
  }
}
