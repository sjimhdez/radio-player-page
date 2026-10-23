// getTransmissionTime computes the station and browser clocks for the current minute
// (spec 0006, task 1.6). The cases mirror src/hooks/use-transmission-time.test.tsx and add
// the midnight crossing and daylight saving time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTransmissionTime } from 'src/core/clock/transmission-time'

// The scripts run Vitest with TZ=UTC; these tests switch it per case.
const originalTz = process.env.TZ

function at(tz: string, utc: string, timezoneOffset: number, timezone?: string) {
  process.env.TZ = tz
  vi.setSystemTime(new Date(utc))
  return getTransmissionTime(timezoneOffset, timezone)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  process.env.TZ = originalTz
})

describe('getTransmissionTime', () => {
  it('formats station and browser time as HH:MM with their difference', () => {
    // Madrid is UTC+2 on this date.
    expect(at('Europe/Madrid', '2026-10-19T14:05:30Z', -6)).toEqual({
      transmissionTime: '08:05',
      browserTime: '16:05',
      timeDifference: -8,
      hasDifference: true,
    })
  })

  it('reports no difference when both zones match', () => {
    // Mexico City is UTC-6 with no DST.
    expect(at('America/Mexico_City', '2026-10-19T14:05:30Z', -6)).toEqual({
      transmissionTime: '08:05',
      browserTime: '08:05',
      timeDifference: 0,
      hasDifference: false,
    })
  })

  it('handles a half-hour station offset', () => {
    expect(at('UTC', '2026-10-19T14:05:30Z', 5.5)).toEqual({
      transmissionTime: '19:35',
      browserTime: '14:05',
      timeDifference: 5.5,
      hasDifference: true,
    })
  })

  it('handles a half-hour browser offset', () => {
    // Kolkata is UTC+5:30.
    expect(at('Asia/Kolkata', '2026-10-19T14:05:30Z', 0)).toEqual({
      transmissionTime: '14:05',
      browserTime: '19:35',
      timeDifference: -5.5,
      hasDifference: true,
    })
  })

  it('crosses midnight', () => {
    // 22:45 UTC is 04:15 the next day at +5.5 and 16:45 the same day at -6.
    expect(at('America/Mexico_City', '2026-01-05T22:45:00Z', 5.5)).toEqual({
      transmissionTime: '04:15',
      browserTime: '16:45',
      timeDifference: 11.5,
      hasDifference: true,
    })
  })

  it('follows the browser daylight saving time', () => {
    // The station offset is fixed when the page is served; Madrid moves from +2 to +1.
    expect(at('Europe/Madrid', '2026-10-24T12:00:00Z', 1)).toMatchObject({
      browserTime: '14:00',
      timeDifference: -1,
      hasDifference: true,
    })
    expect(at('Europe/Madrid', '2026-10-26T12:00:00Z', 1)).toMatchObject({
      browserTime: '13:00',
      timeDifference: 0,
      hasDifference: false,
    })
  })

  it('follows the station daylight saving time with its zone (C9)', () => {
    // New York switches to UTC-4 at 07:00Z on 2026-03-08; the page was served at -5.
    expect(at('UTC', '2026-03-08T08:30:00Z', -5, 'America/New_York')).toEqual({
      transmissionTime: '04:30',
      browserTime: '08:30',
      timeDifference: -4,
      hasDifference: true,
    })
  })

  it('keeps the served offset without a zone or with one Intl rejects', () => {
    expect(at('UTC', '2026-03-08T08:30:00Z', -5).transmissionTime).toBe('03:30')
    expect(at('UTC', '2026-03-08T08:30:00Z', -5, 'Not/AZone').transmissionTime).toBe('03:30')
  })

  it('ignores differences under the 0.01 h threshold', () => {
    expect(at('UTC', '2026-10-19T14:05:30Z', 0.005)).toMatchObject({
      timeDifference: 0.005,
      hasDifference: false,
    })
    expect(at('UTC', '2026-10-19T14:05:30Z', -0.02).hasDifference).toBe(true)
  })
})
