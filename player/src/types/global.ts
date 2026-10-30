// The globals the WordPress plugin prints: the configuration and the relational data.

/** Day keys for the weekly schedule */
export type ScheduleDayKey =
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

/** A program of RADPLAPAG_PROGRAMS, which schedule slots point to by its id */
export interface ProgramDefinition {
  /** Unique program id */
  id: string
  /** Program name */
  name: string
  /** Program description (optional) */
  description?: string | null
  /** Extended description (optional, plain text + line breaks) */
  extendedDescription?: string | null
  /** Program logo image URL (optional) */
  logoUrl?: string | null
}

/** A slot of the schedule; its program's name and logo come from RADPLAPAG_PROGRAMS */
export interface ScheduleEntry {
  /** Unique ID of program in RADPLAPAG_PROGRAMS array */
  program_id: string
  /** Start time in "HH:MM" format (24-hour) */
  start: string
  /** End time in "HH:MM" format (24-hour) */
  end: string
  /** True when this slot is a rerun/repeat broadcast of the program */
  is_rerun?: boolean
}

/** The weekly schedule: the slots of each day */
export interface Schedule {
  monday?: ScheduleEntry[]
  tuesday?: ScheduleEntry[]
  wednesday?: ScheduleEntry[]
  thursday?: ScheduleEntry[]
  friday?: ScheduleEntry[]
  saturday?: ScheduleEntry[]
  sunday?: ScheduleEntry[]
}

/**
 * The plugin configuration (RADPLAPAG_CONFIG), without the programs and the schedule,
 * which come in RADPLAPAG_PROGRAMS and RADPLAPAG_SCHEDULE.
 */
export interface PluginConfig {
  /** Audio stream URL to play (required) */
  streamUrl: string
  /** Radio station or site title (required) */
  siteTitle: string
  /** Whether the player hides the station name visually (optional; ADR 0054) */
  hideTitle?: boolean
  /** Whether the player shows the current song from the stream server (optional; ADR 0068) */
  showSong?: boolean
  /** Background image URL (optional) */
  backgroundImage?: string | null
  /** Logo image URL (optional) */
  logoImage?: string | null
  /** Welcome audio (mp3) URL played once before the live stream starts (optional) */
  introAudioUrl?: string | null
  /** Theme color name (validated against whitelist, defaults to 'neutral') */
  themeColor: 'neutral' | 'blue' | 'green' | 'red' | 'orange' | 'yellow' | 'purple' | 'pink'
  /** Visualizer ID (validated against whitelist, defaults to 'oscilloscope') */
  visualizer: 'oscilloscope' | 'bars' | 'particles' | 'waterfall'
  /** Site offset in hours from UTC, fixed when the page is served; fallback without timezone */
  timezoneOffset: number
  /** Site IANA time zone, or null when the site uses a manual offset (ADR 0046) */
  timezone?: string | null
  /** The edit URL of the station for users who can manage_options, or null (ADR 0065) */
  adminDiagnostics?: AdminDiagnostics | null
}

/** What the player shows administrators about a stream that fails (ADR 0065) */
export interface AdminDiagnostics {
  /** Edit screen of the station, with the Test stream button */
  editUrl: string
}

/** Full config returned by useConfig(): config + programs + schedule (relational) */
export interface ResolvedConfig extends PluginConfig {
  /** Only true when RADPLAPAG_CONFIG.hideTitle is exactly true */
  hideTitle: boolean
  /** Only true when RADPLAPAG_CONFIG.showSong is exactly true */
  showSong: boolean
  /** Site IANA time zone, only when Intl accepts it */
  timezone?: string
  /** Only with an http(s) editUrl; null otherwise */
  adminDiagnostics: AdminDiagnostics | null
  /** The programs (from RADPLAPAG_PROGRAMS) */
  programs?: ProgramDefinition[]
  /** The weekly schedule (from RADPLAPAG_SCHEDULE) */
  schedule?: Schedule
}

declare global {
  interface Window {
    /** Plugin configuration (no schedule/programs) */
    RADPLAPAG_CONFIG?: PluginConfig
    /** The programs: [{ id, name, logoUrl }, ...] */
    RADPLAPAG_PROGRAMS?: ProgramDefinition[]
    /** The weekly schedule: { day: [{ program_id, start, end }, ...] } */
    RADPLAPAG_SCHEDULE?: Schedule
  }
}
