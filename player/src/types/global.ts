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

/**
 * Plugin configuration object injected by WordPress
 *
 * This interface represents the complete configuration object passed from
 * WordPress to React via `window.RADPLAPAG_CONFIG`. All values are validated
 * and sanitized by the `useConfig()` hook.
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
  /** WordPress timezone in IANA format (e.g., "America/Mexico_City", "Europe/Madrid", "UTC") */
  timezone: string
  /** Program schedule (optional, weekly schedule with programs by day) */
  schedule?: Schedule
}

declare global {
  interface Window {
    /** Plugin configuration object (new format, preferred) */
    RADPLAPAG_CONFIG?: PluginConfig
    /** Audio stream URL to play (deprecated, use RADPLAPAG_CONFIG.streamUrl) */
    STREAM_URL?: string
    /** Radio station or site title (deprecated, use RADPLAPAG_CONFIG.siteTitle) */
    SITE_TITLE?: string
    /** Theme color name (deprecated, use RADPLAPAG_CONFIG.themeColor) */
    THEME_COLOR?: string
    /** Background image URL (deprecated, use RADPLAPAG_CONFIG.backgroundImage) */
    BACKGROUND_IMAGE?: string
    /** Logo image URL (deprecated, use RADPLAPAG_CONFIG.logoImage) */
    LOGO_IMAGE?: string
    /** Visualizer ID (deprecated, use RADPLAPAG_CONFIG.visualizer) */
    VISUALIZER?: string
    /** Program schedule (deprecated, use RADPLAPAG_CONFIG.schedule) */
    SCHEDULE?: Schedule
  }
}
