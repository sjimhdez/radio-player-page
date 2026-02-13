/**
 * Global window interface extensions
 * Configuration and relational data injected by the WordPress plugin
 */

/** Day keys for the weekly schedule */
export type ScheduleDayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

/**
 * Program definition (from RADPLAPAG_PROGRAMS).
 * Resolved by program_id from schedule entries.
 */
export interface ProgramDefinition {
  /** Unique program identifier */
  id: string
  /** Program name */
  name: string
  /** Program logo image URL (optional) */
  logoUrl?: string | null
}

/**
 * Schedule slot (relational): references program by unique ID.
 * Name and logo are resolved from RADPLAPAG_PROGRAMS by matching program_id.
 */
export interface ScheduleEntry {
  /** Unique ID of program in RADPLAPAG_PROGRAMS array */
  program_id: string
  /** Start time in "HH:MM" format (24-hour) */
  start: string
  /** End time in "HH:MM" format (24-hour) */
  end: string
}

/**
 * Weekly schedule (relational): day -> array of { program_id, start, end }.
 * Resolve name/logo from programs by matching program_id in the UI.
 */
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
 * Plugin configuration object (RADPLAPAG_CONFIG).
 * Does not include schedule or programs; those are in RADPLAPAG_PROGRAMS and RADPLAPAG_SCHEDULE.
 */
export interface PluginConfig {
  /** Audio stream URL to play (required) */
  streamUrl: string
  /** Radio station or site title (required) */
  siteTitle: string
  /** Background image URL (optional) */
  backgroundImage?: string | null
  /** Logo image URL (optional) */
  logoImage?: string | null
  /** Theme color name (validated against whitelist, defaults to 'neutral') */
  themeColor: 'neutral' | 'blue' | 'green' | 'red' | 'orange' | 'yellow' | 'purple' | 'pink'
  /** Visualizer ID (validated against whitelist, defaults to 'oscilloscope') */
  visualizer: 'oscilloscope' | 'bars' | 'particles' | 'waterfall'
  /** WordPress timezone offset in hours from UTC (numeric, handles DST automatically) */
  timezoneOffset: number
}

/**
 * Full config returned by useConfig(): config + programs + schedule (relational).
 */
export interface ResolvedConfig extends PluginConfig {
  /** Program definitions (from RADPLAPAG_PROGRAMS). Resolve by schedule entry program_id. */
  programs?: ProgramDefinition[]
  /** Weekly schedule relational (from RADPLAPAG_SCHEDULE). */
  schedule?: Schedule
}

declare global {
  interface Window {
    /** Plugin configuration (no schedule/programs) */
    RADPLAPAG_CONFIG?: PluginConfig
    /** Program definitions: [{ id, name, logoUrl }, ...] */
    RADPLAPAG_PROGRAMS?: ProgramDefinition[]
    /** Weekly schedule relational: { day: [{ program_id (string ID), start, end }, ...] } */
    RADPLAPAG_SCHEDULE?: Schedule
  }
}
