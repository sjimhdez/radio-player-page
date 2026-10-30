/**
 * The day of the week and the time of day at a fixed offset from UTC, the WordPress zone
 * in the player. Pass the offset getStationOffset() gives for the current minute to
 * follow daylight saving time (ADR 0046). Never throws: an invalid offset gives UTC.
 *
 * @param timezoneOffset - Offset in hours from UTC (-6, 5.5, 0)
 * @returns dayOfWeek (0-6, 0=Sunday) and currentTime (minutes since midnight)
 */
export function getCurrentTimeInTimezone(timezoneOffset: number): {
  dayOfWeek: number
  currentTime: number
} {
  if (typeof timezoneOffset === 'number' && !isNaN(timezoneOffset)) {
    try {
      const now = new Date()

      const offsetMs = timezoneOffset * 60 * 60 * 1000
      const localTimeMs = now.getTime() + offsetMs

      const localDate = new Date(localTimeMs)

      // The offset is already added, so the UTC getters read the time at the station.
      const hour = localDate.getUTCHours()
      const minute = localDate.getUTCMinutes()
      const dayOfWeek = localDate.getUTCDay()

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
    }
  }

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
 * The current offset of the station from UTC, in hours.
 *
 * With the site's IANA zone, the offset is the one that zone has at `now`, so it
 * follows daylight saving time while the page is open (ADR 0046). Without a zone, or
 * with one Intl rejects, it is the offset served with the page.
 *
 * @param timezone - Site IANA zone ("America/New_York"), undefined with a manual offset
 * @param timezoneOffset - Offset in hours from UTC served with the page (fallback)
 * @param now - Instant to resolve the offset at (default: now)
 * @returns Offset in hours from UTC, from whole minutes (-4, 5.75)
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
 * The current offset of the browser from UTC, in hours: negative behind UTC, positive
 * ahead. Read from the current date, so it follows daylight saving time; UTC if the
 * browser fails.
 */
export function getBrowserTimezoneOffset(): number {
  try {
    // getTimezoneOffset() gives minutes with the opposite sign: negative ahead of UTC.
    const offsetMinutes = new Date().getTimezoneOffset()
    const offsetHours = -offsetMinutes / 60
    return offsetHours
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Radio Player] Error getting browser timezone offset, using UTC:', error)
    }
    return 0
  }
}

/**
 * The difference between the WordPress and the browser offsets, in hours: positive if
 * WordPress is ahead, negative if behind.
 *
 * @param browserOffset - The browser offset; read from the browser when missing
 */
export function getTimezoneDifference(wordPressOffset: number, browserOffset?: number): number {
  const browser = browserOffset ?? getBrowserTimezoneOffset()
  // Subtract in whole minutes so the result carries no floating point noise.
  return (Math.round(wordPressOffset * 60) - Math.round(browser * 60)) / 60
}

/** The local time of the browser, for when the offset cannot be used */
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
 * The time at an offset from UTC, as "HH:MM:SS" or "HH:MM"; the browser time if the
 * offset is not a finite number.
 *
 * @param timezoneOffset - Offset in hours from UTC
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
 * A difference in hours (5.75 for 5:45) as shown: "+6", "-3", "+5:30", "-5:45", with
 * sign, hours and minutes and no units
 */
export function formatTimezoneDifference(differenceHours: number): string {
  // Work in whole minutes so the format is exact and symmetric by sign.
  const totalMinutes = Math.round(Math.abs(differenceHours) * 60)
  const sign = differenceHours < 0 && totalMinutes !== 0 ? '-' : '+'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (minutes === 0) {
    return `${sign}${hours}`
  }

  return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`
}
