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
  /** Formatted time string in "HH:MM" format for emission timezone (WordPress) */
  emissionTime: string
  /** Formatted time string in "HH:MM" format for browser timezone */
  browserTime: string
  /** Time difference in hours (positive if WordPress is ahead, negative if behind) */
  timeDifference: number
  /** Whether there is a timezone difference (not zero) */
  hasDifference: boolean
}

/**
 * Hook to calculate and update emission time
 *
 * This hook:
 * - Calculates the current time in WordPress timezone (emission timezone)
 * - Calculates the current time in browser timezone
 * - Calculates the timezone difference between them
 * - Updates every minute to show the clock (same pattern as program schedule updates)
 * - Returns formatted time strings in "HH:MM" format (without seconds for better performance)
 * - Returns difference information
 *
 * The hook uses the WordPress timezone offset from configuration, which handles DST automatically.
 * The browser timezone is detected automatically from the user's system settings.
 *
 * Updates every minute for good balance between accuracy and performance, following the same
 * pattern as the program schedule hooks (use-current-program, use-upcoming-program).
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

      // Format time without seconds for better performance (HH:MM instead of HH:MM:SS)
      setEmissionTime(formatTimeInTimezone(wordPressOffset, false))
      setBrowserTime(formatTimeInTimezone(browserOffset, false))
      setTimeDifference(difference)
    }

    // Update immediately
    updateTimes()

    // Update every minute (same pattern as program schedule hooks for consistency and performance)
    const interval = setInterval(updateTimes, 60000) // 60 seconds

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
