import {
  formatTimeInTimezone,
  getBrowserTimezoneOffset,
  getTimezoneDifference,
} from 'src/utils/timezone'

// Small threshold to absorb floating point noise in the difference.
const DIFFERENCE_THRESHOLD = 0.01

/**
 * Result of the station transmission time calculation (WordPress timezone)
 */
export interface TransmissionTime {
  /** Formatted time string in "HH:MM" format for WordPress / station timezone */
  transmissionTime: string
  /** Formatted time string in "HH:MM" format for browser timezone */
  browserTime: string
  /** Time difference in hours (positive if WordPress is ahead, negative if behind) */
  timeDifference: number
  /** Whether there is a timezone difference (not zero) */
  hasDifference: boolean
}

/**
 * Computes the station and browser clocks for the current minute.
 *
 * The station offset comes from WordPress, fixed when the page is served; the browser
 * offset is read now, so it follows the browser's daylight saving time.
 *
 * @param timezoneOffset - Station offset in hours from UTC
 * @returns TransmissionTime with both times as "HH:MM" and their difference
 */
export function getTransmissionTime(timezoneOffset: number): TransmissionTime {
  const browserOffset = getBrowserTimezoneOffset()
  const timeDifference = getTimezoneDifference(timezoneOffset, browserOffset)

  return {
    transmissionTime: formatTimeInTimezone(timezoneOffset, false),
    browserTime: formatTimeInTimezone(browserOffset, false),
    timeDifference,
    hasDifference: Math.abs(timeDifference) > DIFFERENCE_THRESHOLD,
  }
}
