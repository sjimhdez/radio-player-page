import { toZonedTime } from 'date-fns-tz'
import { getHours, getMinutes, getDay } from 'date-fns'

/**
 * Get current date/time information in a specific timezone
 *
 * This function uses date-fns-tz to convert the current UTC time to a specific
 * timezone and extracts the day of week and current time in minutes since midnight.
 * It includes robust error handling with fallback to UTC if the timezone is invalid.
 *
 * @param timezone IANA timezone string (e.g., "America/Mexico_City", "Europe/Madrid", "UTC")
 * @returns Object with dayOfWeek (0-6, 0=Sunday) and currentTime (minutes since midnight)
 * @throws Never throws, always returns a valid result (falls back to UTC on error)
 */
export function getCurrentTimeInTimezone(timezone: string): {
  dayOfWeek: number
  currentTime: number
} {
  try {
    // Validate timezone is not empty
    if (!timezone || typeof timezone !== 'string' || timezone.trim() === '') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[Radio Player] Invalid timezone provided, falling back to UTC:',
          timezone
        )
      }
      timezone = 'UTC'
    }

    // Get current UTC time
    const now = new Date()

    // Convert UTC time to the specified timezone
    const zonedDate = toZonedTime(now, timezone)

    // Extract components using date-fns
    const hour = getHours(zonedDate)
    const minute = getMinutes(zonedDate)
    const dayOfWeek = getDay(zonedDate) // Returns 0 (Sunday) to 6 (Saturday)

    return {
      dayOfWeek,
      currentTime: hour * 60 + minute,
    }
  } catch (error) {
    // Fallback to UTC if timezone conversion fails
    if (process.env.NODE_ENV === 'development') {
      console.error(
        '[Radio Player] Error converting timezone, falling back to UTC:',
        error
      )
    }

    // Return UTC time as fallback
    const now = new Date()
    const hour = getHours(now)
    const minute = getMinutes(now)
    const dayOfWeek = getDay(now)

    return {
      dayOfWeek,
      currentTime: hour * 60 + minute,
    }
  }
}
