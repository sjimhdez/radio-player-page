import { useMemo } from 'react'
import type { PluginConfig } from 'src/types/global'

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
 * Hook to access and validate plugin configuration from WordPress.
 *
 * This hook centralizes access to the plugin configuration object that is
 * injected by WordPress via `window.RADPLAPAG_CONFIG`. It validates all
 * configuration values against whitelists, applies safe defaults, and
 * ensures type safety.
 *
 * The configuration is memoized to prevent unnecessary recalculations on
 * re-renders. All validation happens once when the component mounts.
 *
 * @returns PluginConfig object with validated and sanitized configuration values
 *
 * @example
 * ```tsx
 * const Dashboard = () => {
 *   const config = useConfig()
 *   return <div>{config.siteTitle}</div>
 * }
 * ```
 */
function useConfig(): PluginConfig {
  return useMemo(() => {
    const rawConfig = window.RADPLAPAG_CONFIG

    // Validate themeColor against whitelist
    const themeColor =
      rawConfig?.themeColor && VALID_THEMES.includes(rawConfig.themeColor as any)
        ? rawConfig.themeColor
        : 'neutral'

    // Validate visualizer against whitelist
    const visualizer =
      rawConfig?.visualizer &&
      VALID_VISUALIZERS.includes(rawConfig.visualizer as any)
        ? rawConfig.visualizer
        : 'oscilloscope'

    // Validate timezoneOffset (must be a number between -12 and 14)
    const timezoneOffset =
      typeof rawConfig?.timezoneOffset === 'number' &&
      rawConfig.timezoneOffset >= -12 &&
      rawConfig.timezoneOffset <= 14
        ? rawConfig.timezoneOffset
        : 0 // Default to UTC (0) if invalid

    return {
      streamUrl: rawConfig?.streamUrl || '',
      siteTitle: rawConfig?.siteTitle || '',
      backgroundImage: rawConfig?.backgroundImage || undefined,
      logoImage: rawConfig?.logoImage || undefined,
      themeColor,
      visualizer,
      timezoneOffset,
      schedule: rawConfig?.schedule,
    }
  }, [])
}

export default useConfig
