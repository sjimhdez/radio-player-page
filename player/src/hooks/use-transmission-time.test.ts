// Characterization of use-transmission-time.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useTransmissionTime from 'src/hooks/use-transmission-time'
import type { PluginConfig } from 'src/types/global'

// The scripts run Vitest with TZ=UTC; these tests switch it per case.
const originalTz = process.env.TZ

function setOffset(timezoneOffset: number, timezone?: string) {
  window.RADPLAPAG_CONFIG = {
    streamUrl: '',
    siteTitle: '',
    timezoneOffset,
    timezone,
  } as PluginConfig
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  process.env.TZ = originalTz
  delete window.RADPLAPAG_CONFIG
})

describe('useTransmissionTime', () => {
  it('formats station and browser time as HH:MM with their difference', () => {
    process.env.TZ = 'Europe/Madrid' // UTC+2 on this date
    vi.setSystemTime(new Date('2026-10-19T14:05:30Z'))
    setOffset(-6)

    const { result } = renderHook(() => useTransmissionTime())

    expect(result.current).toEqual({
      transmissionTime: '08:05',
      browserTime: '16:05',
      timeDifference: -8,
      hasDifference: true,
    })
  })

  it('reports no difference when both zones match', () => {
    process.env.TZ = 'America/Mexico_City' // UTC-6, no DST
    vi.setSystemTime(new Date('2026-10-19T14:05:30Z'))
    setOffset(-6)

    const { result } = renderHook(() => useTransmissionTime())

    expect(result.current.timeDifference).toBe(0)
    expect(result.current.hasDifference).toBe(false)
    expect(result.current.transmissionTime).toBe(result.current.browserTime)
  })

  it('handles half-hour offsets', () => {
    process.env.TZ = 'UTC'
    vi.setSystemTime(new Date('2026-10-19T14:05:30Z'))
    setOffset(5.5)

    const { result } = renderHook(() => useTransmissionTime())

    expect(result.current).toMatchObject({
      transmissionTime: '19:35',
      browserTime: '14:05',
      timeDifference: 5.5,
      hasDifference: true,
    })
  })

  it('follows the station daylight saving time with its zone (C9)', () => {
    // New York switches to UTC-4 at 07:00Z on 2026-03-08; the page was served at -5.
    process.env.TZ = 'UTC'
    vi.setSystemTime(new Date('2026-03-08T06:59:30Z'))
    setOffset(-5, 'America/New_York')
    const { result } = renderHook(() => useTransmissionTime())
    expect(result.current).toMatchObject({ transmissionTime: '01:59', timeDifference: -5 })

    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toMatchObject({ transmissionTime: '03:00', timeDifference: -4 })
  })

  it('updates at the start of the next minute and then every 60 s', () => {
    process.env.TZ = 'UTC'
    vi.setSystemTime(new Date('2026-10-19T14:05:45Z'))
    setOffset(0)
    const { result } = renderHook(() => useTransmissionTime())
    expect(result.current.transmissionTime).toBe('14:05')

    act(() => vi.advanceTimersByTime(14_999))
    expect(result.current.transmissionTime).toBe('14:05')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current.transmissionTime).toBe('14:06')

    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current.transmissionTime).toBe('14:07')
  })

  it('clears its timers on unmount', () => {
    process.env.TZ = 'UTC'
    vi.setSystemTime(new Date('2026-10-19T14:05:45Z'))
    setOffset(0)
    const { unmount } = renderHook(() => useTransmissionTime())

    act(() => vi.advanceTimersByTime(15_000))
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
