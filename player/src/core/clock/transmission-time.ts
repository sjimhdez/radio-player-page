import {
  formatTimeInTimezone,
  getBrowserTimezoneOffset,
  getStationOffset,
  getTimezoneDifference,
} from 'src/core/clock/timezone'

/** The smallest difference that counts, in hours: absorbs floating point noise */
const DIFFERENCE_THRESHOLD = 0.01

/** The station clock (the WordPress zone) and the browser clock */
export interface TransmissionTime {
  /** The station time, as "HH:MM" */
  transmissionTime: string
  /** The browser time, as "HH:MM" */
  browserTime: string
  /** Time difference in hours (positive if WordPress is ahead, negative if behind) */
  timeDifference: number
  /** Whether the two clocks differ */
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
