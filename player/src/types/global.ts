/**
 * Global window interface extensions
 * Configuration values injected by the WordPress plugin
 */
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
  }
}
