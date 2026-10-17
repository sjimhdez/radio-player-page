import { describe, expect, it } from 'vitest'
import type { ProgramDefinition, Schedule } from 'src/types/global'
import {
  findActiveProgram,
  findIncomingProgram,
  getAllProgramsWithSlots,
  getProgramsForDay,
  getProgramsForWeekOrdered,
  isProgramActive,
} from 'src/utils/program-schedule'

const SUNDAY = 0
const MONDAY = 1
const TUESDAY = 2
const WEDNESDAY = 3
const FRIDAY = 5
const SATURDAY = 6

function at(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function slot(program_id: string, start: string, end: string, is_rerun?: boolean) {
  return { program_id, start, end, is_rerun }
}

const programs: ProgramDefinition[] = [
  {
    id: 'morning',
    name: 'morning show',
    description: 'Wake up',
    extendedDescription: 'Long text',
    logoUrl: 'https://example.test/morning.png',
  },
  { id: 'late', name: 'Late Night' },
  { id: 'news', name: 'News', description: null, logoUrl: null },
]

// Monday: news, morning (out of order on purpose) and late crossing into Tuesday.
const schedule: Schedule = {
  monday: [
    slot('news', '10:00', '11:00', true),
    slot('morning', '06:00', '10:00'),
    slot('late', '22:00', '02:00'),
  ],
  wednesday: [slot('news', '12:00', '13:00')],
}

describe('isProgramActive', () => {
  it('is active from start (inclusive) to end (exclusive)', () => {
    const entry = { start: '06:00', end: '10:00' }

    expect(isProgramActive(entry, at('05:59'))).toBe(false)
    expect(isProgramActive(entry, at('06:00'))).toBe(true)
    expect(isProgramActive(entry, at('09:59'))).toBe(true)
    expect(isProgramActive(entry, at('10:00'))).toBe(false)
  })

  it('treats a slot crossing midnight as active after its start', () => {
    expect(isProgramActive({ start: '22:00', end: '02:00' }, at('23:30'))).toBe(true)
    expect(isProgramActive({ start: '22:00', end: '02:00' }, at('21:59'))).toBe(false)
  })

  // docs/known-issues.md C16.
  it('currently treats a slot crossing midnight as active early on its own day', () => {
    expect(isProgramActive({ start: '22:00', end: '02:00' }, at('01:00'))).toBe(true)
  })

  it('treats start equal to end as a 24-hour slot', () => {
    expect(isProgramActive({ start: '08:00', end: '08:00' }, at('08:00'))).toBe(true)
    expect(isProgramActive({ start: '08:00', end: '08:00' }, at('08:00'), true)).toBe(false)
    expect(isProgramActive({ start: '08:00', end: '08:00' }, at('07:59'), true)).toBe(true)
  })

  it('on the previous day only matches slots crossing midnight, before their end', () => {
    expect(isProgramActive({ start: '22:00', end: '02:00' }, at('01:59'), true)).toBe(true)
    expect(isProgramActive({ start: '22:00', end: '02:00' }, at('02:00'), true)).toBe(false)
    expect(isProgramActive({ start: '06:00', end: '10:00' }, at('07:00'), true)).toBe(false)
  })
})

describe('findActiveProgram', () => {
  it('returns null without a schedule', () => {
    expect(findActiveProgram(undefined, programs, MONDAY, at('07:00'))).toBeNull()
  })

  it('resolves name and logo of the active slot', () => {
    expect(findActiveProgram(schedule, programs, MONDAY, at('07:00'))).toEqual({
      programName: 'morning show',
      timeRange: '06:00-10:00',
      programLogoUrl: 'https://example.test/morning.png',
      isRerun: false,
    })
  })

  it('carries the rerun flag', () => {
    expect(findActiveProgram(schedule, programs, MONDAY, at('10:30'))?.isRerun).toBe(true)
  })

  it('picks the earliest start when slots overlap', () => {
    const overlapping: Schedule = {
      friday: [slot('news', '09:00', '11:00'), slot('morning', '08:00', '10:00')],
    }

    expect(findActiveProgram(overlapping, programs, FRIDAY, at('09:30'))?.programName).toBe(
      'morning show',
    )
  })

  it('returns the previous day slot crossing midnight', () => {
    const tuesday: Schedule = { ...schedule, tuesday: [slot('news', '08:00', '09:00')] }

    expect(findActiveProgram(tuesday, programs, TUESDAY, at('01:00'))?.programName).toBe(
      'Late Night',
    )
  })

  it('wraps Sunday back to Saturday', () => {
    const weekend: Schedule = {
      saturday: [slot('late', '23:00', '01:00')],
      sunday: [slot('news', '08:00', '09:00')],
    }

    expect(findActiveProgram(weekend, programs, SUNDAY, at('00:30'))?.programName).toBe(
      'Late Night',
    )
  })

  // docs/known-issues.md K8.
  it('currently ignores the previous day slot crossing midnight when today has no slots', () => {
    const fridayNight: Schedule = { friday: [slot('late', '22:00', '02:00')] }

    expect(findActiveProgram(fridayNight, programs, SATURDAY, at('01:00'))).toBeNull()
  })

  it('leaves the name empty for an unknown program', () => {
    const unknown: Schedule = { monday: [slot('missing', '06:00', '10:00')] }

    expect(findActiveProgram(unknown, programs, MONDAY, at('07:00'))).toEqual({
      programName: '',
      timeRange: '06:00-10:00',
      programLogoUrl: null,
      isRerun: false,
    })
    expect(findActiveProgram(unknown, undefined, MONDAY, at('07:00'))?.programName).toBe('')
  })

  it('returns null between slots', () => {
    expect(findActiveProgram(schedule, programs, WEDNESDAY, at('11:00'))).toBeNull()
  })
})

describe('findIncomingProgram', () => {
  it('returns null without a schedule', () => {
    expect(findIncomingProgram(undefined, programs, MONDAY, at('05:55'))).toBeNull()
  })

  it('returns the next slot starting within 10 minutes', () => {
    expect(findIncomingProgram(schedule, programs, MONDAY, at('05:50'))).toEqual({
      programName: 'morning show',
      timeRange: '06:00-10:00',
      minutesUntil: 10,
      programLogoUrl: 'https://example.test/morning.png',
      isRerun: false,
    })
  })

  it('ignores a slot starting in 11 minutes', () => {
    expect(findIncomingProgram(schedule, programs, MONDAY, at('05:49'))).toBeNull()
  })

  it('ignores a slot starting right now', () => {
    expect(findIncomingProgram(schedule, programs, MONDAY, at('06:00'))).toBeNull()
  })

  it('looks at the next day across midnight, Saturday into Sunday', () => {
    const weekend: Schedule = { sunday: [slot('news', '00:05', '01:00')] }

    expect(findIncomingProgram(weekend, programs, SATURDAY, at('23:58'))?.minutesUntil).toBe(7)
  })

  it('shows the incoming slot even with no active program', () => {
    expect(findIncomingProgram(schedule, programs, WEDNESDAY, at('11:55'))?.programName).toBe(
      'News',
    )
  })
})

describe('getProgramsForDay', () => {
  it('returns an empty list without a schedule or slots', () => {
    expect(getProgramsForDay(undefined, programs, MONDAY, MONDAY, at('07:00'))).toEqual([])
    expect(getProgramsForDay(schedule, programs, FRIDAY, MONDAY, at('07:00'))).toEqual([])
  })

  it('sorts by start and resolves name, description and logo', () => {
    const day = getProgramsForDay(schedule, programs, MONDAY, MONDAY, at('07:00'))

    expect(day).toEqual([
      {
        programName: 'morning show',
        programDescription: 'Wake up',
        programLogoUrl: 'https://example.test/morning.png',
        start: '06:00',
        end: '10:00',
        timeRange: '06:00-10:00',
        isActive: true,
        isRerun: false,
      },
      {
        programName: 'News',
        programDescription: null,
        programLogoUrl: null,
        start: '10:00',
        end: '11:00',
        timeRange: '10:00-11:00',
        isActive: false,
        isRerun: true,
      },
      {
        programName: 'Late Night',
        programDescription: null,
        programLogoUrl: null,
        start: '22:00',
        end: '02:00',
        timeRange: '22:00-02:00',
        isActive: false,
        isRerun: false,
      },
    ])
  })

  it('marks nothing active on a day other than today', () => {
    const day = getProgramsForDay(schedule, programs, MONDAY, WEDNESDAY, at('07:00'))

    expect(day.some((entry) => entry.isActive)).toBe(false)
  })

  // docs/known-issues.md C4 (the util; the schedule modal is confirmed in e2e).
  it('currently does not mark the previous day slot crossing midnight as active', () => {
    const monday = getProgramsForDay(schedule, programs, MONDAY, TUESDAY, at('01:00'))

    expect(monday.find((entry) => entry.programName === 'Late Night')?.isActive).toBe(false)
  })
})

describe('getProgramsForWeekOrdered', () => {
  it('returns an empty list without a schedule', () => {
    expect(getProgramsForWeekOrdered(undefined, programs, MONDAY, at('07:00'))).toEqual([])
  })

  it('starts today, wraps around the week and skips empty days', () => {
    const week = getProgramsForWeekOrdered(schedule, programs, TUESDAY, at('12:30'))

    expect(week.map((day) => day.dayOfWeek)).toEqual([WEDNESDAY, MONDAY])
    expect(week[0].programs[0].isActive).toBe(false)
  })

  it('marks the active slot only on today', () => {
    const week = getProgramsForWeekOrdered(schedule, programs, WEDNESDAY, at('12:30'))

    expect(week[0]).toMatchObject({
      dayOfWeek: WEDNESDAY,
      programs: [{ programName: 'News', isActive: true }],
    })
    expect(week[1].programs.some((entry) => entry.isActive)).toBe(false)
  })
})

describe('getAllProgramsWithSlots', () => {
  it('returns an empty list without a schedule', () => {
    expect(getAllProgramsWithSlots(undefined, programs, MONDAY, at('07:00'))).toEqual([])
  })

  it('groups slots by program, sorted by name ignoring case', () => {
    const list = getAllProgramsWithSlots(schedule, programs, MONDAY, at('07:00'))

    expect(list.map((program) => program.programName)).toEqual([
      'Late Night',
      'morning show',
      'News',
    ])
    expect(list[1]).toEqual({
      programId: 'morning',
      programName: 'morning show',
      programDescription: 'Wake up',
      programExtendedDescription: 'Long text',
      programLogoUrl: 'https://example.test/morning.png',
      slots: [{ dayOfWeek: MONDAY, timeRange: '06:00-10:00' }],
      isLive: true,
    })
  })

  it('lists slots by day from Sunday, in schedule order within a day', () => {
    const weekly: Schedule = {
      monday: [slot('news', '18:00', '19:00'), slot('news', '08:00', '09:00')],
      sunday: [slot('news', '12:00', '13:00')],
    }

    expect(getAllProgramsWithSlots(weekly, programs, MONDAY, at('07:00'))[0].slots).toEqual([
      { dayOfWeek: SUNDAY, timeRange: '12:00-13:00' },
      { dayOfWeek: MONDAY, timeRange: '18:00-19:00' },
      { dayOfWeek: MONDAY, timeRange: '08:00-09:00' },
    ])
  })

  it('is live through the previous day slot crossing midnight', () => {
    const list = getAllProgramsWithSlots(schedule, programs, TUESDAY, at('01:00'))

    expect(list.filter((program) => program.isLive).map((program) => program.programId)).toEqual([
      'late',
    ])
  })

  it('is not live on another day at the same time', () => {
    const list = getAllProgramsWithSlots(schedule, programs, WEDNESDAY, at('07:00'))

    expect(list.some((program) => program.isLive)).toBe(false)
  })

  it('keeps unknown programs with an empty name', () => {
    const unknown: Schedule = { monday: [slot('missing', '06:00', '10:00')] }

    expect(getAllProgramsWithSlots(unknown, programs, MONDAY, at('07:00'))[0]).toMatchObject({
      programId: 'missing',
      programName: '',
      programLogoUrl: null,
    })
  })
})
