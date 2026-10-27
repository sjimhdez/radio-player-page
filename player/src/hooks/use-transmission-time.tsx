import { useMemo, useSyncExternalStore } from 'react'
import useConfig from 'src/hooks/use-config'
import { createMinuteStore } from 'src/core/clock/minute-ticker'
import { getTransmissionTime, type TransmissionTime } from 'src/core/clock/transmission-time'

export type { TransmissionTime }

/**
 * Hook to calculate and update station transmission time (WordPress timezone)
 *
 * Returns the current time in the station and browser timezones as "HH:MM" and the
 * difference between them. The station offset comes from configuration (the site zone,
 * or the served offset without one); the browser offset is detected from the user's
 * system settings. The timezone clock that consumes
 * this data is shown whenever hasDifference is true, independent of playback state.
 *
 * Updates at the start of each system minute (:00 seconds).
 *
 * @returns TransmissionTime object with transmissionTime, browserTime, timeDifference, and hasDifference
 *
 * @example
 * ```tsx
 * const { transmissionTime, browserTime, timeDifference, hasDifference } = useTransmissionTime()
 *
 * if (hasDifference) {
 *   console.log(`Station: ${transmissionTime}, Browser: ${browserTime}, Diff: ${timeDifference}`)
 * }
 * ```
 */
function useTransmissionTime(): TransmissionTime {
  const { timezoneOffset, timezone } = useConfig()

  const store = useMemo(
    () => createMinuteStore(() => getTransmissionTime(timezoneOffset, timezone)),
    [timezoneOffset, timezone],
  )

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

export default useTransmissionTime
