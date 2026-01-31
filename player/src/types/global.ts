/**
 * Global window interface extensions
 * Configuration values injected by the WordPress plugin
 */

/**
 * Program schedule entry
 */
export interface Program {
  /** Program name */
  name: string
  /** Start time in "HH:MM" format (24-hour) */
  start: string
  /** End time in "HH:MM" format (24-hour) */
  end: string
}

/**
 * Weekly program schedule
 */
export interface Schedule {
  /** Programs scheduled for Monday */
  monday?: Program[]
  /** Programs scheduled for Tuesday */
  tuesday?: Program[]
  /** Programs scheduled for Wednesday */
  wednesday?: Program[]
  /** Programs scheduled for Thursday */
  thursday?: Program[]
  /** Programs scheduled for Friday */
  friday?: Program[]
  /** Programs scheduled for Saturday */
  saturday?: Program[]
  /** Programs scheduled for Sunday */
  sunday?: Program[]
}

declare global {
  interface Window {
    /** Audio stream URL to play */
    STREAM_URL: string
    /** Radio station or site title */
    SITE_TITLE: string
    /** Theme color name (optional, defaults to 'neutral') */
    THEME_COLOR?: string
    /** Background image URL (optional) */
    BACKGROUND_IMAGE?: string
    /** Logo image URL (optional) */
    LOGO_IMAGE?: string
    /** Visualizer ID (optional, defaults to 'oscilloscope') */
    VISUALIZER?: string
    /** Program schedule (optional, weekly schedule with programs by day) */
    SCHEDULE?: Schedule
  }
}
