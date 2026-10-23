// Shared schedule vectors (spec 0002 §4.1): the same file PHP reads in
// tests/php/integration/Schedule/ScheduleVectorsTest.php.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import vectors from '../../../tests/fixtures/schedule-vectors.json'
import type { ProgramDefinition, Schedule } from 'src/types/global'
import { findActiveProgram, findIncomingProgram } from 'src/utils/program-schedule'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'

type VectorSlot = { program: string; start: string; end: string; is_rerun: boolean }
type VectorCurrent = { program: string; time_range: string; is_rerun: boolean } | null
type VectorUpcoming = {
  program: string
  time_range: string
  is_rerun: boolean
  minutes: number
} | null

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Program keys double as IDs and names, as in the PHP test. A vector's
// unpublished programs are left out (ADR 0045).
function programsOf(unpublished: string[] = []): ProgramDefinition[] {
  return vectors.programs
    .filter((key) => !unpublished.includes(key))
    .map((key) => ({ id: key, name: key }))
}

function toSchedule(grid: Record<string, VectorSlot[]>): Schedule {
  const schedule: Record<string, unknown> = {}
  for (const [day, slots] of Object.entries(grid)) {
    schedule[day] = slots.map((slot) => ({
      program_id: slot.program,
      start: slot.start,
      end: slot.end,
      is_rerun: slot.is_rerun,
    }))
  }
  return schedule as Schedule
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function expectedCurrent(current: VectorCurrent) {
  if (!current) return null
  return {
    programName: current.program,
    timeRange: current.time_range,
    programLogoUrl: null,
    isRerun: current.is_rerun,
  }
}

function expectedUpcoming(upcoming: VectorUpcoming) {
  if (!upcoming) return null
  return {
    programName: upcoming.program,
    timeRange: upcoming.time_range,
    minutesUntil: upcoming.minutes,
    programLogoUrl: null,
    isRerun: upcoming.is_rerun,
  }
}

const grids = vectors.grids as Record<string, Record<string, VectorSlot[]>>

type ResolutionVector = {
  id: string
  grid: string
  now: { day: string; time: string }
  unpublished?: string[]
  current: VectorCurrent
  upcoming: VectorUpcoming
  currently?: boolean
  issue?: string
  correct?: { current: VectorCurrent; upcoming: VectorUpcoming }
  ts?: { current: VectorCurrent; upcoming: VectorUpcoming; currently: boolean; issue: string }
}

describe('schedule vectors: resolution', () => {
  for (const vector of vectors.resolution as ResolutionVector[]) {
    // A "ts" object is the player's result where it differs from PHP (the
    // top-level result, which is then the correct one).
    const result = vector.ts ?? vector
    const correct = vector.ts ? vector : vector.correct
    const label = `${result.currently ? 'currently ' : ''}resolves vector ${vector.id} (${vector.now.day} ${vector.now.time})`
    const schedule = toSchedule(grids[vector.grid])
    const programs = programsOf(vector.unpublished)
    const dayOfWeek = DAYS.indexOf(vector.now.day)
    const currentTime = toMinutes(vector.now.time)

    it(label, () => {
      // A vector without a result fails here, as in PHP (spec 0002 A5).
      expect(result, 'Vector without a result.').toHaveProperty('current')
      expect(result, 'Vector without a result.').toHaveProperty('upcoming')
      expect(findActiveProgram(schedule, programs, dayOfWeek, currentTime)).toEqual(
        expectedCurrent(result.current),
      )
      expect(findIncomingProgram(schedule, programs, dayOfWeek, currentTime)).toEqual(
        expectedUpcoming(result.upcoming),
      )
    })

    if (result.currently) {
      // A currently vector still differs from its correct result
      // (docs/known-issues.md, the vector's issue).
      it(`currently differs from the correct result in vector ${vector.id} (${result.issue})`, () => {
        expect(correct, 'Currently vector without a correct result.').toBeDefined()
        expect({
          current: findActiveProgram(schedule, programs, dayOfWeek, currentTime),
          upcoming: findIncomingProgram(schedule, programs, dayOfWeek, currentTime),
        }).not.toEqual({
          current: expectedCurrent(correct!.current),
          upcoming: expectedUpcoming(correct!.upcoming),
        })
      })
    }
  }
})

describe('schedule vectors: tz', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  for (const vector of vectors.tz) {
    const label = `${vector.currently ? 'currently ' : ''}resolves ${vector.id} (${vector.utc}, offset ${vector.timezoneOffset})`

    it(label, () => {
      vi.setSystemTime(new Date(vector.utc))

      const result = getCurrentTimeInTimezone(vector.timezoneOffset)

      expect(result).toEqual(vector.expected)
      if (vector.currently) {
        // docs/known-issues.md C9: the offset is fixed when the page is served.
        expect(result).not.toEqual(vector.correct)
      }
    })
  }
})
