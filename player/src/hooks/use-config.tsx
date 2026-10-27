import { useMemo } from 'react'
import { readConfig } from 'src/core/config/read-config'
import type { ResolvedConfig } from 'src/types/global'

/**
 * Hook to access and validate plugin configuration from WordPress.
 *
 * This hook is the only place that reads the globals injected by WordPress
 * (`window.RADPLAPAG_CONFIG`, `window.RADPLAPAG_PROGRAMS` and
 * `window.RADPLAPAG_SCHEDULE`). Validation and defaults live in
 * `src/core/config/read-config`.
 *
 * The configuration is memoized: the globals are read once when the component
 * mounts.
 *
 * @returns ResolvedConfig (config + programs + schedule)
 *
 * @example
 * ```tsx
 * const Dashboard = () => {
 *   const config = useConfig()
 *   return <div>{config.siteTitle}</div>
 * }
 * ```
 */
function useConfig(): ResolvedConfig {
  return useMemo(
    () =>
      readConfig({
        config: window.RADPLAPAG_CONFIG,
        programs: window.RADPLAPAG_PROGRAMS,
        schedule: window.RADPLAPAG_SCHEDULE,
      }),
    [],
  )
}

export default useConfig
