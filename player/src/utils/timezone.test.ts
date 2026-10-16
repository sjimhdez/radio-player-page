import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'

describe('getCurrentTimeInTimezone (smoke)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies a fractional offset across midnight', () => {
    // Monday 22:45 UTC + 5.5 h = Tuesday 04:15 at the station.
    vi.setSystemTime(new Date('2026-01-05T22:45:00Z'))

    expect(getCurrentTimeInTimezone(5.5)).toEqual({ dayOfWeek: 2, currentTime: 4 * 60 + 15 })
  })
})
