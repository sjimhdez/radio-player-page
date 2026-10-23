/**
 * Get current date/time information using timezone offset
 *
 * This function uses the numeric offset (in hours) to calculate the current time
 * in WordPress timezone. The offset is fixed: pass the one getStationOffset() gives
 * for the current minute to follow daylight saving time (ADR 0046).
 *
 * @param timezoneOffset Numeric offset in hours from UTC (e.g., -6, 5.5, 0)
 * @returns Object with dayOfWeek (0-6, 0=Sunday) and currentTime (minutes since midnight)
 * @throws Never throws, always returns a valid result (falls back to UTC on error)
 */
export function getCurrentTimeInTimezone(timezoneOffset: number): {
  dayOfWeek: number
  currentTime: number
} {
  // Validate and use numeric offset
  if (typeof timezoneOffset === 'number' && !isNaN(timezoneOffset)) {
    try {
      // Get current UTC time
      const now = new Date()

      // Calculate local time by adding WordPress timezone offset (in milliseconds)
      const offsetMs = timezoneOffset * 60 * 60 * 1000
      const localTimeMs = now.getTime() + offsetMs

      // Create a Date object representing the local time in WordPress timezone
      const localDate = new Date(localTimeMs)

      // Extract components using UTC methods
      // Since we've added the offset to UTC time, UTC methods give us the local time
      const hour = localDate.getUTCHours()
      const minute = localDate.getUTCMinutes()
      const dayOfWeek = localDate.getUTCDay() // Returns 0 (Sunday) to 6 (Saturday)

      return {
        dayOfWeek,
        currentTime: hour * 60 + minute,
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          '[Radio Player] Error calculating time with offset, falling back to UTC:',
          error,
        )
      }
      // Fall through to UTC fallback
    }
  }

  // Fallback: Return UTC time if offset is invalid
  if (import.meta.env.DEV) {
    console.warn(
      '[Radio Player] Invalid timezone offset, using UTC fallback. Offset:',
      timezoneOffset,
    )
  }

  const now = new Date()
  const hour = now.getUTCHours()
  const minute = now.getUTCMinutes()
  const dayOfWeek = now.getUTCDay()

  return {
    dayOfWeek,
    currentTime: hour * 60 + minute,
  }
}

/**
 * Get the station's current offset in hours from UTC
 *
 * With the site's IANA zone, the offset is the one that zone has at `now`, so it
 * follows daylight saving time while the page is open (ADR 0046). Without a zone, or
 * with one Intl rejects, it is the offset served with the page.
 *
 * @param timezone Site IANA zone (e.g., "America/New_York"), undefined with a manual offset
 * @param timezoneOffset Offset in hours from UTC served with the page (fallback)
 * @param now Instant to resolve the offset at (default: now)
 * @returns Offset in hours from UTC, from whole minutes (e.g., -4, 5.75)
 */
export function getStationOffset(
  timezone: string | undefined,
  timezoneOffset: number,
  now: Date = new Date(),
): number {
  if (!timezone) return timezoneOffset

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(now)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value)

    // Wall-clock minutes at the station minus UTC minutes, both truncated to the minute.
    const localMinutes =
      Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute')) / 60000
    const utcMinutes = Math.floor(now.getTime() / 60000)
    const offsetMinutes = localMinutes - utcMinutes

    return Number.isFinite(offsetMinutes) ? offsetMinutes / 60 : timezoneOffset
  } catch {
    // Intl rejects the zone (RangeError): keep the served offset.
    return timezoneOffset
  }
}

/**
 * Get the browser's timezone offset in hours from UTC
 *
 * Uses the browser's local timezone offset, which automatically handles DST.
 * The offset is calculated from the current date to account for DST changes.
 *
 * @returns Numeric offset in hours from UTC (e.g., -6, 5.5, 0)
 *         Negative values indicate timezones behind UTC, positive values ahead
 */
export function getBrowserTimezoneOffset(): number {
  try {
    // getTimezoneOffset() returns the offset in minutes, negative for timezones ahead of UTC
    // We need to invert the sign and convert to hours
    const offsetMinutes = new Date().getTimezoneOffset()
    const offsetHours = -offsetMinutes / 60 // Invert sign: negative offset means ahead of UTC
    return offsetHours
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Radio Player] Error getting browser timezone offset, using UTC:', error)
    }
    return 0 // Fallback to UTC
  }
}

/**
 * Calculate the timezone difference between browser and WordPress timezone
 *
 * @param wordPressOffset WordPress timezone offset in hours from UTC
 * @param browserOffset Browser timezone offset in hours from UTC (optional, calculated if not provided)
 * @returns Difference in hours (positive if WordPress is ahead, negative if behind)
 */
export function getTimezoneDifference(wordPressOffset: number, browserOffset?: number): number {
  const browser = browserOffset ?? getBrowserTimezoneOffset()
  return wordPressOffset - browser
}

/**
 * Format the browser's local time (fallback when the offset cannot be used)
 */
function formatBrowserLocalTime(includeSeconds: boolean): string {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const second = now.getSeconds()
  const hourStr = hour.toString().padStart(2, '0')
  const minuteStr = minute.toString().padStart(2, '0')
  if (includeSeconds) {
    const secondStr = second.toString().padStart(2, '0')
    return `${hourStr}:${minuteStr}:${secondStr}`
  }
  return `${hourStr}:${minuteStr}`
}

/**
 * Format time in a specific timezone for display
 *
 * @param timezoneOffset Timezone offset in hours from UTC
 * @param includeSeconds Whether to include seconds in the format (default: true)
 * @returns Formatted time string in "HH:MM:SS" or "HH:MM" format
 */
export function formatTimeInTimezone(
  timezoneOffset: number,
  includeSeconds: boolean = true,
): string {
  if (!Number.isFinite(timezoneOffset)) {
    return formatBrowserLocalTime(includeSeconds)
  }

  try {
    const now = new Date()
    const offsetMs = timezoneOffset * 60 * 60 * 1000
    const localTimeMs = now.getTime() + offsetMs
    const localDate = new Date(localTimeMs)

    const hour = localDate.getUTCHours()
    const minute = localDate.getUTCMinutes()
    const second = localDate.getUTCSeconds()

    const hourStr = hour.toString().padStart(2, '0')
    const minuteStr = minute.toString().padStart(2, '0')

    if (includeSeconds) {
      const secondStr = second.toString().padStart(2, '0')
      return `${hourStr}:${minuteStr}:${secondStr}`
    }

    return `${hourStr}:${minuteStr}`
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Radio Player] Error formatting time in timezone, using current time:', error)
    }
    return formatBrowserLocalTime(includeSeconds)
  }
}

/**
 * Format timezone difference for display
 *
 * @param differenceHours Difference in hours (can be decimal for half-hour timezones)
 * @returns Formatted string like "+6", "-3", "+5.5" (number with sign, no units)
 */
export function formatTimezoneDifference(differenceHours: number): string {
  // Round to 1 decimal place to handle half-hour timezones
  const rounded = Math.round(differenceHours * 10) / 10
  const sign = rounded >= 0 ? '+' : ''

  // Format with proper decimal handling
  const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1)

  return `${sign}${formatted}`
}
