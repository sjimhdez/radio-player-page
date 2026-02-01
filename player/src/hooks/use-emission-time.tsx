import { useState, useEffect } from 'react'
import useConfig from 'src/hooks/use-config'
import {
  getBrowserTimezoneOffset,
  getTimezoneDifference,
  formatTimeInTimezone,
} from 'src/utils/timezone'

/**
 * Result of the emission time calculation
 */
export interface EmissionTime {
  /** Formatted time string in "HH:MM:SS" format for emission timezone (WordPress) */
  emissionTime: string
  /** Formatted time string in "HH:MM:SS" format for browser timezone */
  browserTime: string
  /** Time difference in hours (positive if WordPress is ahead, negative if behind) */
  timeDifference: number
  /** Whether there is a timezone difference (not zero) */
  hasDifference: boolean
}

/**
 * Hook to calculate and update emission time in real-time
 *
 * This hook:
 * - Calculates the current time in WordPress timezone (emission timezone)
 * - Calculates the current time in browser timezone
 * - Calculates the timezone difference between them
 * - Updates every second to show a real-time clock
 * - Returns formatted time strings and difference information
 *
 * The hook uses the WordPress timezone offset from configuration, which handles DST automatically.
 * The browser timezone is detected automatically from the user's system settings.
 *
 * @returns EmissionTime object with emissionTime, browserTime, timeDifference, and hasDifference
 *
 * @example
 * ```tsx
 * const { emissionTime, browserTime, timeDifference, hasDifference } = useEmissionTime()
 *
 * if (hasDifference) {
 *   console.log(`Emission: ${emissionTime}, Browser: ${browserTime}, Diff: ${timeDifference}`)
 * }
 * ```
 */
function useEmissionTime(): EmissionTime {
  const config = useConfig()
  const [emissionTime, setEmissionTime] = useState<string>('')
  const [browserTime, setBrowserTime] = useState<string>('')
  const [timeDifference, setTimeDifference] = useState<number>(0)

  useEffect(() => {
    /**
     * Update time values
     */
    const updateTimes = () => {
      const wordPressOffset = config.timezoneOffset
      const browserOffset = getBrowserTimezoneOffset()
      const difference = getTimezoneDifference(wordPressOffset, browserOffset)

      setEmissionTime(formatTimeInTimezone(wordPressOffset, true))
      setBrowserTime(formatTimeInTimezone(browserOffset, true))
      setTimeDifference(difference)
    }

    // Update immediately
    updateTimes()

    // Update every second for real-time clock
    const interval = setInterval(updateTimes, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [config.timezoneOffset])

  const hasDifference = Math.abs(timeDifference) > 0.01 // Use small threshold to handle floating point precision

  return {
    emissionTime,
    browserTime,
    timeDifference,
    hasDifference,
  }
}

export default useEmissionTime
