import { useMemo } from 'react'
import { readConfig } from 'src/core/config/read-config'
import type { ResolvedConfig } from 'src/types/global'

/**
 * The validated plugin configuration: config, programs and schedule.
 *
 * The only place that reads the globals WordPress prints (`window.RADPLAPAG_CONFIG`,
 * `window.RADPLAPAG_PROGRAMS` and `window.RADPLAPAG_SCHEDULE`); validation and defaults
 * live in `src/core/config/read-config`. The globals are read once, on mount.
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
