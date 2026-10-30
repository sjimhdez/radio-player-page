// Characterization of use-program-schedule. The result is informative only: it never
// touches playback (an invariant of SPEC.md).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useProgramSchedule from 'src/hooks/use-program-schedule'
import type { PluginConfig, ProgramDefinition, Schedule } from 'src/types/global'

const PROGRAMS: ProgramDefinition[] = [
  { id: '1', name: 'Morning Show', logoUrl: 'https://site.test/morning.png' },
  { id: '2', name: 'News', logoUrl: null },
]
// 2026-10-19 is a Monday.
const SCHEDULE: Schedule = {
  monday: [
    { program_id: '1', start: '08:00', end: '09:00' },
    { program_id: '2', start: '09:00', end: '10:00', is_rerun: true },
  ],
}

function setGlobals(timezoneOffset: number, schedule: unknown = SCHEDULE, timezone?: string) {
  window.RADPLAPAG_CONFIG = {
    streamUrl: '',
    siteTitle: '',
    timezoneOffset,
    timezone,
  } as PluginConfig
  window.RADPLAPAG_PROGRAMS = PROGRAMS
  window.RADPLAPAG_SCHEDULE = schedule as Schedule
}

function names(result: ReturnType<typeof useProgramSchedule>) {
  return {
    active: result.active?.programName ?? null,
    incoming: result.incoming?.programName ?? null,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete window.RADPLAPAG_CONFIG
  delete window.RADPLAPAG_PROGRAMS
  delete window.RADPLAPAG_SCHEDULE
})

describe('useProgramSchedule', () => {
  it('resolves the active and incoming programs on mount', () => {
    vi.setSystemTime(new Date('2026-10-19T08:52:30Z'))
    setGlobals(0)

    const { result } = renderHook(() => useProgramSchedule())

    expect(result.current.active).toMatchObject({
      programName: 'Morning Show',
      programLogoUrl: 'https://site.test/morning.png',
      isRerun: false,
    })
    expect(result.current.incoming).toMatchObject({
      programName: 'News',
      minutesUntil: 8,
      isRerun: true,
    })
  })

  it('applies the station timezone offset', () => {
    // 14:30 UTC is 08:30 at UTC-6.
    vi.setSystemTime(new Date('2026-10-19T14:30:00Z'))
    setGlobals(-6)

    const { result } = renderHook(() => useProgramSchedule())

    expect(names(result.current)).toEqual({ active: 'Morning Show', incoming: null })
  })

  it('follows the station daylight saving time with its zone (C9)', () => {
    // 2026-03-08 is a Sunday; New York is at UTC-4 from 07:00Z, so 13:30Z is 09:30,
    // not the 08:30 the served offset (-5) gives.
    vi.setSystemTime(new Date('2026-03-08T13:30:00Z'))
    setGlobals(-5, { sunday: SCHEDULE.monday }, 'America/New_York')

    const { result } = renderHook(() => useProgramSchedule())

    expect(names(result.current)).toEqual({ active: 'News', incoming: null })
  })

  it('returns nulls without a schedule', () => {
    vi.setSystemTime(new Date('2026-10-19T08:30:00Z'))
    setGlobals(0, null)

    const { result } = renderHook(() => useProgramSchedule())

    expect(result.current).toEqual({ active: null, incoming: null })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('recalculates at the start of the next minute and then every 60 s', () => {
    vi.setSystemTime(new Date('2026-10-19T08:59:30Z'))
    setGlobals(0)
    const { result } = renderHook(() => useProgramSchedule())
    expect(names(result.current)).toEqual({ active: 'Morning Show', incoming: 'News' })

    // 29.999 s later it is still 08:59.
    act(() => vi.advanceTimersByTime(29_999))
    expect(names(result.current).active).toBe('Morning Show')

    // 09:00:00: the first, aligned tick.
    act(() => vi.advanceTimersByTime(1))
    expect(names(result.current)).toEqual({ active: 'News', incoming: null })

    // 10:00:00, sixty ticks of the interval later.
    act(() => vi.advanceTimersByTime(60 * 60_000))
    expect(result.current).toEqual({ active: null, incoming: null })
  })

  it('schedules the first tick immediately when mounted on an exact minute', () => {
    vi.setSystemTime(new Date('2026-10-19T08:59:00Z'))
    setGlobals(0)
    const { result } = renderHook(() => useProgramSchedule())

    // The clock moves without timers firing; the 0 ms timeout picks it up.
    vi.setSystemTime(new Date('2026-10-19T09:00:00Z'))
    act(() => vi.advanceTimersByTime(0))

    expect(names(result.current).active).toBe('News')
  })

  it('clears its timers on unmount', () => {
    vi.setSystemTime(new Date('2026-10-19T08:59:30Z'))
    setGlobals(0)
    const { unmount } = renderHook(() => useProgramSchedule())
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(30_000))
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
