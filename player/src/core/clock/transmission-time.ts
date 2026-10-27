import {
  formatTimeInTimezone,
  getBrowserTimezoneOffset,
  getStationOffset,
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
 * Both offsets are read now: the station one from the site zone when there is one, so
 * both clocks follow daylight saving time (ADR 0046).
 *
 * @param timezoneOffset - Station offset in hours from UTC served with the page (fallback)
 * @param timezone - Site IANA zone; its current offset wins
 * @returns TransmissionTime with both times as "HH:MM" and their difference
 */
export function getTransmissionTime(timezoneOffset: number, timezone?: string): TransmissionTime {
  const stationOffset = getStationOffset(timezone, timezoneOffset)
  const browserOffset = getBrowserTimezoneOffset()
  const timeDifference = getTimezoneDifference(stationOffset, browserOffset)

  return {
    transmissionTime: formatTimeInTimezone(stationOffset, false),
    browserTime: formatTimeInTimezone(browserOffset, false),
    timeDifference,
    hasDifference: Math.abs(timeDifference) > DIFFERENCE_THRESHOLD,
  }
}
