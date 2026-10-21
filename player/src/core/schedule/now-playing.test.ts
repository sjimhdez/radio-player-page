// getNowPlaying resolves the program on air for the current minute (spec 0006, task 1.5).
// The cases mirror src/hooks/use-program-schedule.test.tsx. The resolution and timezone
// vectors of tests/fixtures/schedule-vectors.json are not repeated here: they already run
// against findActiveProgram, findIncomingProgram and getCurrentTimeInTimezone in
// src/utils/schedule-vectors.test.ts, and getNowPlaying only chains them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getNowPlaying } from 'src/core/schedule/now-playing'
import type { NowPlaying } from 'src/core/schedule/now-playing'
import type { ProgramDefinition, Schedule } from 'src/types/global'

const PROGRAMS: ProgramDefinition[] = [
  { id: '1', name: 'Morning Show', logoUrl: 'https://site.test/morning.png' },
  { id: '2', name: 'News', logoUrl: null },
  { id: '3', name: 'Late Night', logoUrl: null },
  { id: '4', name: 'Early Bird', logoUrl: null },
]
// 2026-10-19 is a Monday.
const SCHEDULE: Schedule = {
  monday: [
    { program_id: '1', start: '08:00', end: '09:00' },
    { program_id: '2', start: '09:00', end: '10:00', is_rerun: true },
    { program_id: '3', start: '23:30', end: '00:30' },
  ],
  tuesday: [{ program_id: '4', start: '00:30', end: '02:00' }],
}

function names(result: NowPlaying) {
  return {
    active: result.active?.programName ?? null,
    incoming: result.incoming?.programName ?? null,
  }
}

function at(utc: string, timezoneOffset = 0, schedule: Schedule | null = SCHEDULE) {
  vi.setSystemTime(new Date(utc))
  return getNowPlaying(schedule ?? undefined, PROGRAMS, timezoneOffset)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getNowPlaying', () => {
  it('resolves the active and incoming programs', () => {
    const result = at('2026-10-19T08:52:30Z')

    expect(result.active).toMatchObject({
      programName: 'Morning Show',
      programLogoUrl: 'https://site.test/morning.png',
      isRerun: false,
    })
    expect(result.incoming).toMatchObject({
      programName: 'News',
      minutesUntil: 8,
      isRerun: true,
    })
  })

  it('returns nulls without a schedule', () => {
    expect(at('2026-10-19T08:30:00Z', 0, null)).toEqual({ active: null, incoming: null })
  })

  it('returns nulls when nothing is on air or about to start', () => {
    expect(at('2026-10-19T12:00:00Z')).toEqual({ active: null, incoming: null })
  })

  it('switches programs on the exact minute', () => {
    expect(names(at('2026-10-19T08:59:59Z'))).toEqual({ active: 'Morning Show', incoming: 'News' })
    expect(names(at('2026-10-19T09:00:00Z'))).toEqual({ active: 'News', incoming: null })
  })

  it('keeps a slot crossing midnight active after midnight', () => {
    expect(names(at('2026-10-19T23:45:00Z')).active).toBe('Late Night')
    // Tuesday 00:25: Monday's slot is still on air and Tuesday's starts in 5 minutes.
    expect(names(at('2026-10-20T00:25:00Z'))).toEqual({
      active: 'Late Night',
      incoming: 'Early Bird',
    })
  })

  it('applies a negative offset', () => {
    // 14:30 UTC is 08:30 at UTC-6.
    expect(names(at('2026-10-19T14:30:00Z', -6))).toEqual({
      active: 'Morning Show',
      incoming: null,
    })
  })

  it('applies a fractional offset', () => {
    // 03:25 UTC is 08:55 at UTC+5:30.
    expect(names(at('2026-10-19T03:25:00Z', 5.5))).toEqual({
      active: 'Morning Show',
      incoming: 'News',
    })
  })

  it('moves to the previous day with the offset', () => {
    // Tuesday 05:45 UTC is Monday 23:45 at UTC-6.
    expect(names(at('2026-10-20T05:45:00Z', -6)).active).toBe('Late Night')
  })

  it('currently keeps the served offset after a DST switch with the page open (C9)', () => {
    // America/New_York switches to EDT at 2026-03-08T07:00:00Z. Served at -5, the player
    // still reads 03:30 when the station is at 04:30 EDT. 2026-03-08 is a Sunday.
    const schedule: Schedule = {
      sunday: [
        { program_id: '1', start: '03:00', end: '04:00' },
        { program_id: '2', start: '04:00', end: '05:00' },
      ],
    }

    expect(names(at('2026-03-08T08:30:00Z', -5, schedule)).active).toBe('Morning Show')
  })
})
