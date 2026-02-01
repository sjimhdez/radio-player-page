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
