/**
 * Get current date/time information using timezone offset
 *
 * This function uses the numeric offset (in hours) to calculate the current time
 * in WordPress timezone. The numeric offset is reliable as it's always a number
 * and handles DST automatically from WordPress.
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
      if (process.env.NODE_ENV === 'development') {
        console.error(
          '[Radio Player] Error calculating time with offset, falling back to UTC:',
          error
        )
      }
      // Fall through to UTC fallback
    }
  }

  // Fallback: Return UTC time if offset is invalid
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[Radio Player] Invalid timezone offset, using UTC fallback. Offset:',
      timezoneOffset
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
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[Radio Player] Error getting browser timezone offset, using UTC:',
        error
      )
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
export function getTimezoneDifference(
  wordPressOffset: number,
  browserOffset?: number
): number {
  const browser = browserOffset ?? getBrowserTimezoneOffset()
  return wordPressOffset - browser
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
  includeSeconds: boolean = true
): string {
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
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[Radio Player] Error formatting time in timezone, using current time:',
        error
      )
    }
    // Fallback to browser's local time
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
  const formatted = rounded % 1 === 0 
    ? rounded.toString() 
    : rounded.toFixed(1)
  
  return `${sign}${formatted}`
}
