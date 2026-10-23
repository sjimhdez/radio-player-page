import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatTimeInTimezone,
  formatTimezoneDifference,
  getBrowserTimezoneOffset,
  getCurrentTimeInTimezone,
  getStationOffset,
  getTimezoneDifference,
} from 'src/utils/timezone'

// The scripts run Vitest with TZ=UTC; these tests switch it per case.
const originalTz = process.env.TZ

function useTz(tz: string) {
  process.env.TZ = tz
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  process.env.TZ = originalTz
})

describe('getCurrentTimeInTimezone (smoke)', () => {
  it('applies a fractional offset across midnight', () => {
    // Monday 22:45 UTC + 5.5 h = Tuesday 04:15 at the station.
    vi.setSystemTime(new Date('2026-01-05T22:45:00Z'))

    expect(getCurrentTimeInTimezone(5.5)).toEqual({ dayOfWeek: 2, currentTime: 4 * 60 + 15 })
  })
})

describe('getCurrentTimeInTimezone', () => {
  it.each(['UTC', 'America/New_York', 'Asia/Kolkata', 'Pacific/Kiritimati'])(
    'does not depend on the browser timezone (%s)',
    (tz) => {
      useTz(tz)
      vi.setSystemTime(new Date('2026-10-19T23:30:00Z'))

      expect(getCurrentTimeInTimezone(-5)).toEqual({ dayOfWeek: 1, currentTime: 18 * 60 + 30 })
    },
  )

  it('moves back a day with a negative offset', () => {
    // Sunday 02:00 UTC - 3 h = Saturday 23:00.
    vi.setSystemTime(new Date('2026-10-18T02:00:00Z'))

    expect(getCurrentTimeInTimezone(-3)).toEqual({ dayOfWeek: 6, currentTime: 23 * 60 })
  })

  it.each([NaN, '5' as unknown as number, undefined as unknown as number])(
    'falls back to UTC with an invalid offset (%s)',
    (offset) => {
      useTz('Asia/Kolkata')
      vi.setSystemTime(new Date('2026-10-19T09:50:00Z'))

      expect(getCurrentTimeInTimezone(offset)).toEqual({ dayOfWeek: 1, currentTime: 590 })
    },
  )

  it('falls back to UTC when the calculation throws', () => {
    vi.setSystemTime(new Date('2026-10-19T09:50:00Z'))
    const getUTCHours = Date.prototype.getUTCHours
    vi.spyOn(Date.prototype, 'getUTCHours')
      .mockImplementationOnce(() => {
        throw new Error('boom')
      })
      .mockImplementation(function (this: Date) {
        return getUTCHours.call(this)
      })

    expect(getCurrentTimeInTimezone(5.5)).toEqual({ dayOfWeek: 1, currentTime: 590 })
  })

  it('warns about an invalid offset only in development', () => {
    vi.stubEnv('DEV', true)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    getCurrentTimeInTimezone(NaN)

    expect(warn).toHaveBeenCalledOnce()
    vi.unstubAllEnvs()
  })

  // docs/known-issues.md C9 (fixed in spec 0009): the offset follows the site zone.
  it('follows daylight saving time with the site zone', () => {
    // New York switches to EDT (-4) at 2026-03-08T07:00Z; the page was served
    // at 06:00Z with -5. At 08:30Z the station is at 04:30.
    vi.setSystemTime(new Date('2026-03-08T08:30:00Z'))
    const offset = getStationOffset('America/New_York', -5)

    expect(getCurrentTimeInTimezone(offset).currentTime).toBe(4 * 60 + 30)
    expect(formatTimeInTimezone(offset, false)).toBe('04:30')
  })
})

describe('getStationOffset', () => {
  it.each([
    ['America/New_York', '2026-03-08T06:59:00Z', -5, -5],
    ['America/New_York', '2026-03-08T07:00:00Z', -5, -4],
    ['America/New_York', '2026-11-01T05:59:00Z', -4, -4],
    ['America/New_York', '2026-11-01T06:00:00Z', -4, -5],
    ['Asia/Kathmandu', '2026-10-19T20:00:00Z', 0, 5.75],
    ['America/St_Johns', '2026-01-15T12:00:00Z', 0, -3.5],
    ['America/St_Johns', '2026-07-15T12:00:00Z', -3.5, -2.5],
    ['UTC', '2026-07-15T12:00:00Z', 2, 0],
  ])('gives the current offset of %s at %s', (timezone, now, served, expected) => {
    vi.setSystemTime(new Date(now))

    expect(getStationOffset(timezone, served)).toBe(expected)
  })

  it.each(['UTC', 'Asia/Tokyo', 'America/Los_Angeles'])(
    'does not depend on the browser timezone (%s)',
    (tz) => {
      useTz(tz)
      vi.setSystemTime(new Date('2026-07-15T12:00:30Z'))

      expect(getStationOffset('Europe/Madrid', 1)).toBe(2)
    },
  )

  it('takes the instant as a parameter', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    expect(getStationOffset('Europe/Madrid', 1, new Date('2026-07-15T12:00:00Z'))).toBe(2)
  })

  it.each([undefined, '', 'Not/AZone'])('falls back to the served offset with zone %j', (tz) => {
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'))

    expect(getStationOffset(tz, -5)).toBe(-5)
  })
})

describe('getBrowserTimezoneOffset', () => {
  it.each([
    ['UTC', '2026-01-15T12:00:00Z', 0],
    ['America/New_York', '2026-01-15T12:00:00Z', -5],
    ['America/New_York', '2026-07-15T12:00:00Z', -4],
    ['Asia/Kolkata', '2026-01-15T12:00:00Z', 5.5],
    ['Asia/Kathmandu', '2026-01-15T12:00:00Z', 5.75],
    ['America/St_Johns', '2026-01-15T12:00:00Z', -3.5],
  ])('returns hours from UTC in %s on %s', (tz, now, expected) => {
    useTz(tz)
    vi.setSystemTime(new Date(now))

    // UTC gives -0 (sign inverted); + 0 normalizes it.
    expect(getBrowserTimezoneOffset() + 0).toBe(expected)
  })

  it('falls back to 0 when the browser offset throws', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockImplementation(() => {
      throw new Error('boom')
    })

    expect(getBrowserTimezoneOffset()).toBe(0)
  })
})

describe('getTimezoneDifference', () => {
  it('subtracts the browser offset from the WordPress one', () => {
    expect(getTimezoneDifference(-6, 2)).toBe(-8)
    expect(getTimezoneDifference(5.5, -5)).toBe(10.5)
    expect(getTimezoneDifference(1, 1)).toBe(0)
  })

  it('uses the browser offset when none is given', () => {
    useTz('Asia/Kolkata')
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))

    expect(getTimezoneDifference(-5)).toBe(-10.5)
  })
})

describe('formatTimeInTimezone', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-10-19T23:05:09Z'))
  })

  it('formats HH:MM:SS by default', () => {
    expect(formatTimeInTimezone(0)).toBe('23:05:09')
  })

  it('formats HH:MM without seconds', () => {
    expect(formatTimeInTimezone(0, false)).toBe('23:05')
  })

  it('applies negative and fractional offsets across midnight', () => {
    expect(formatTimeInTimezone(-5)).toBe('18:05:09')
    expect(formatTimeInTimezone(5.5)).toBe('04:35:09')
  })

  it('does not depend on the browser timezone', () => {
    useTz('America/New_York')

    expect(formatTimeInTimezone(1)).toBe('00:05:09')
  })

  // docs/known-issues.md K9.
  it('falls back to the browser local time for a non-finite offset', () => {
    useTz('Asia/Kolkata')

    expect(formatTimeInTimezone(NaN)).toBe('04:35:09')
    expect(formatTimeInTimezone(Infinity, false)).toBe('04:35')
    expect(formatTimeInTimezone(-Infinity)).toBe('04:35:09')
  })

  it('falls back to the browser local time when the calculation throws', () => {
    useTz('Asia/Kolkata')
    vi.spyOn(Date.prototype, 'getUTCHours').mockImplementation(() => {
      throw new Error('boom')
    })

    expect(formatTimeInTimezone(-5)).toBe('04:35:09')
    expect(formatTimeInTimezone(-5, false)).toBe('04:35')
  })
})

describe('formatTimezoneDifference', () => {
  it.each([
    [6, '+6'],
    [-3, '-3'],
    [0, '+0'],
    [-0, '+0'],
    [5.5, '+5.5'],
    [-9.5, '-9.5'],
  ])('formats %s as %s', (difference, expected) => {
    expect(formatTimezoneDifference(difference)).toBe(expected)
  })

  // docs/known-issues.md K10: rounded to one decimal, and Math.round rounds
  // halves up, so a 45-minute difference gives different magnitudes by sign.
  it('currently rounds 45-minute differences asymmetrically', () => {
    expect(formatTimezoneDifference(5.75)).toBe('+5.8')
    expect(formatTimezoneDifference(-5.75)).toBe('-5.7')
  })
})
