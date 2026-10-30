import { useMemo, useSyncExternalStore } from 'react'
import useConfig from 'src/hooks/use-config'
import { createMinuteStore } from 'src/core/clock/minute-ticker'
import { getTransmissionTime, type TransmissionTime } from 'src/core/clock/transmission-time'

export type { TransmissionTime }

/**
 * The station time (the WordPress zone) and the browser time as "HH:MM", and their
 * difference, recomputed at the start of every minute.
 *
 * The station offset comes from the configuration (the site zone, or the served offset
 * without one); the browser offset, from the system. The clock that shows them appears
 * whenever hasDifference is true, whatever the playback state.
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
