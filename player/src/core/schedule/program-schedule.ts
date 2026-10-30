/**
 * Pure functions of the program schedule.
 *
 * Schedule and programs are relational: schedule entries have program_id;
 * name and logo are resolved from the programs array.
 *
 * IMPORTANT: The schedule is for display only (e.g. showing current/next program in the UI).
 * It must never control playback: when a program ends or there is no next program,
 * playback must continue unchanged. The user controls play/pause exclusively.
 *
 * @since 3.1.0
 */

import type { Schedule, ScheduleEntry, ProgramDefinition } from 'src/types/global'
import {
  at,
  contains,
  DAY,
  fromSlot,
  minutesUntilStart,
  WEEK,
} from 'src/core/schedule/week-interval'
import type { WeekInterval } from 'src/core/schedule/week-interval'

/** Program name and time range for display (resolved from schedule + programs) */
export interface CurrentProgram {
  programName: string
  timeRange: string
  programLogoUrl?: string | null
  isRerun: boolean
}

/** Incoming program with minutes until start (resolved from schedule + programs) */
export interface IncomingProgram {
  programName: string
  timeRange: string
  minutesUntil: number
  programLogoUrl?: string | null
  isRerun: boolean
}

/** Day of week to schedule key mapping (0=Sunday, 1=Monday, ...) */
const DAY_MAP: Record<number, keyof Schedule> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
}

/** "HH:MM" as minutes since midnight */
function parseToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/**
 * Whether a schedule entry is active now (by start and end only), as an interval of
 * the week (ADR 0044): only from its start, never early on its own day.
 *
 * @param currentTime - Current time as minutes since midnight (0-1439)
 * @param isPrevDayCrossing - True when evaluating a previous day's entry that crosses midnight
 */
export function isProgramActive(
  entry: { start: string; end: string },
  currentTime: number,
  isPrevDayCrossing = false,
): boolean {
  const interval = fromSlot('monday', entry.start, entry.end)
  const minute = (isPrevDayCrossing ? DAY : 0) + currentTime

  return interval !== null && contains(interval, minute)
}

/**
 * The name, description, extended description and logo of a slot's program, by its
 * program_id.
 */
function resolveProgram(
  programs: ProgramDefinition[] | undefined,
  programId: string,
): {
  name: string
  description: string | null
  extendedDescription: string | null
  logoUrl: string | null
} {
  if (!programs || !programId) {
    return { name: '', description: null, extendedDescription: null, logoUrl: null }
  }
  const p = programs.find((prog) => prog.id === programId)
  return {
    name: p?.name ?? '',
    description: p?.description ?? null,
    extendedDescription: p?.extendedDescription ?? null,
    logoUrl: p?.logoUrl ?? null,
  }
}

/**
 * Whether a slot's program is in the programs array. A slot of any other program
 * (not public or deleted) is ignored everywhere (ADR 0045).
 */
function isKnownProgram(programs: ProgramDefinition[] | undefined, programId: string): boolean {
  return !!programs?.some((prog) => prog.id === programId)
}

/** The active slot and its interval of the week */
interface ActiveSlot {
  entry: ScheduleEntry
  interval: WeekInterval
}

/**
 * The active slot over the whole week (ADR 0044): the one that started latest wins; on
 * a tie, the first one in the stored order of its day, from Monday.
 */
function findActiveSlot(
  schedule: Schedule,
  programs: ProgramDefinition[] | undefined,
  minute: number,
): ActiveSlot | null {
  let current: ActiveSlot | null = null
  let currentElapsed = WEEK

  for (let i = 1; i <= 7; i++) {
    const dayKey = DAY_MAP[i % 7]
    for (const entry of schedule[dayKey] ?? []) {
      if (!isKnownProgram(programs, entry.program_id)) continue
      const interval = fromSlot(dayKey, entry.start, entry.end)
      if (interval === null || !contains(interval, minute)) continue
      const elapsed = (WEEK - minutesUntilStart(interval, minute)) % WEEK
      if (elapsed < currentElapsed) {
        current = { entry, interval }
        currentElapsed = elapsed
      }
    }
  }

  return current
}

/**
 * The program on air, or null.
 *
 * Looks at the whole week (ADR 0044): the active slot that started latest wins; on a
 * tie, the first one in the stored order of its day, from Monday.
 *
 * @param dayOfWeek - Current day (0=Sunday, 1=Monday, ...)
 * @param currentTime - Current time as minutes since midnight
 */
export function findActiveProgram(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  dayOfWeek: number,
  currentTime: number,
): CurrentProgram | null {
  if (!schedule) return null

  const active = findActiveSlot(schedule, programs, at(dayOfWeek, currentTime))
  if (active === null) return null

  const { entry } = active
  const { name, logoUrl } = resolveProgram(programs, entry.program_id)
  return {
    programName: name,
    timeRange: `${entry.start}-${entry.end}`,
    programLogoUrl: logoUrl,
    isRerun: !!entry.is_rerun,
  }
}

/** How far ahead the next program is announced, in minutes from now */
const INCOMING_WINDOW_MINUTES = 10

/**
 * The next program: the first that starts within 10 minutes from now, or null.
 *
 * Calculated relative to current time, not to the active program, so the incoming
 * program is shown even when there is no program currently active. Slots are
 * intervals of the whole week (ADR 0044); on a tie, the first one in stored order,
 * from Monday. A slot of the program on air that starts just when the slot on air
 * ends is skipped: it goes on, it does not come up (K52).
 *
 * @param dayOfWeek - Current day (0=Sunday, 1=Monday, ...)
 * @param currentTime - Current time as minutes since midnight
 */
export function findIncomingProgram(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  dayOfWeek: number,
  currentTime: number,
): IncomingProgram | null {
  if (!schedule) {
    return null
  }

  const minute = at(dayOfWeek, currentTime)
  const active = findActiveSlot(schedule, programs, minute)
  const activeEnd =
    active === null ? null : (active.interval.start + active.interval.duration) % WEEK

  let incoming: ScheduleEntry | null = null
  let incomingMinutes = 0

  for (let i = 1; i <= 7; i++) {
    const dayKey = DAY_MAP[i % 7]
    for (const entry of schedule[dayKey] ?? []) {
      if (!isKnownProgram(programs, entry.program_id)) continue
      const interval = fromSlot(dayKey, entry.start, entry.end)
      if (interval === null) continue
      const minutesUntil = minutesUntilStart(interval, minute)
      if (minutesUntil <= 0 || minutesUntil > INCOMING_WINDOW_MINUTES) continue
      if (interval.start === activeEnd && entry.program_id === active?.entry.program_id) continue
      if (incoming === null || minutesUntil < incomingMinutes) {
        incoming = entry
        incomingMinutes = minutesUntil
      }
    }
  }

  if (incoming === null) return null

  const { name, logoUrl } = resolveProgram(programs, incoming.program_id)
  return {
    programName: name,
    timeRange: `${incoming.start}-${incoming.end}`,
    minutesUntil: incomingMinutes,
    programLogoUrl: logoUrl,
    isRerun: !!incoming.is_rerun,
  }
}

/** Resolved program slot for display in the schedule modal (one per day entry) */
export interface ProgramForDay {
  programName: string
  programDescription?: string | null
  programLogoUrl: string | null
  start: string
  end: string
  timeRange: string
  isActive: boolean
  isRerun: boolean
}

/**
 * The program entries of a day, sorted by start time, with name and logo resolved
 * and isActive set when the entry is currently active as an interval of the week
 * (ADR 0044), so a previous day slot crossing midnight is active while it still plays.
 *
 * @param dayOfWeek - Day to list (0=Sunday, 1=Monday, ...)
 * @param currentDayOfWeek - Current day in WordPress timezone (0-6)
 * @param currentTime - Current time as minutes since midnight
 */
export function getProgramsForDay(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  dayOfWeek: number,
  currentDayOfWeek: number,
  currentTime: number,
): ProgramForDay[] {
  if (!schedule) return []

  const dayKey = DAY_MAP[dayOfWeek]
  const dayEntries = (schedule[dayKey] ?? []).filter((entry) =>
    isKnownProgram(programs, entry.program_id),
  )

  if (dayEntries.length === 0) return []

  const sorted = [...dayEntries].sort((a, b) => parseToMinutes(a.start) - parseToMinutes(b.start))
  const minute = at(currentDayOfWeek, currentTime)

  return sorted.map((entry) => {
    const { name, description, logoUrl } = resolveProgram(programs, entry.program_id)
    const interval = fromSlot(dayKey, entry.start, entry.end)
    const active = interval !== null && contains(interval, minute)
    return {
      programName: name,
      programDescription: description,
      programLogoUrl: logoUrl,
      start: entry.start,
      end: entry.end,
      timeRange: `${entry.start}-${entry.end}`,
      isActive: active,
      isRerun: !!entry.is_rerun,
    }
  })
}

/** Day with its program slots for schedule modal (week view) */
export interface DayWithPrograms {
  dayOfWeek: number
  programs: ProgramForDay[]
}

/** Single time slot for display (day + time range) */
export interface ProgramSlotDisplay {
  dayOfWeek: number
  timeRange: string
}

/**
 * Program with all its weekly slots, for the "all programs" list modal.
 * Slots are all occurrences of this program in the schedule; isLive when any slot is active now.
 *
 * @since 3.2.0
 */
export interface ProgramWithSlots {
  programId: string
  programName: string
  programDescription?: string | null
  programExtendedDescription?: string | null
  programLogoUrl: string | null
  slots: ProgramSlotDisplay[]
  isLive: boolean
}

/**
 * The programs of every day of the week, from the current day, for the single
 * scrollable list of the schedule modal.
 *
 * @param currentDayOfWeek - Current day in WordPress timezone (0-6)
 * @param currentTime - Current time as minutes since midnight
 */
export function getProgramsForWeekOrdered(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  currentDayOfWeek: number,
  currentTime: number,
): DayWithPrograms[] {
  if (!schedule) return []

  const result: DayWithPrograms[] = []
  for (let i = 0; i < 7; i++) {
    const dayOfWeek = (currentDayOfWeek + i) % 7
    const programsForDay = getProgramsForDay(
      schedule,
      programs,
      dayOfWeek,
      currentDayOfWeek,
      currentTime,
    )
    if (programsForDay.length > 0) {
      result.push({ dayOfWeek, programs: programsForDay })
    }
  }
  return result
}

/**
 * Every program with all its slots of the week, sorted by name, for the "all programs"
 * modal. Each program includes isLive when any of its slots
 * is currently active as an interval of the week (ADR 0044).
 *
 * @param currentDayOfWeek - Current day in WordPress timezone (0-6)
 * @param currentTime - Current time as minutes since midnight
 * @since 3.2.0
 */
export function getAllProgramsWithSlots(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  currentDayOfWeek: number,
  currentTime: number,
): ProgramWithSlots[] {
  if (!schedule) return []

  type Accum = {
    name: string
    description: string | null
    extendedDescription: string | null
    logoUrl: string | null
    slots: ProgramSlotDisplay[]
    intervals: WeekInterval[]
  }
  const byId = new Map<string, Accum>()

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayKey = DAY_MAP[dayOfWeek]
    const dayEntries = schedule[dayKey]
    if (!dayEntries || dayEntries.length === 0) continue
    for (const entry of dayEntries) {
      const programId = entry.program_id
      if (!isKnownProgram(programs, programId)) continue
      const timeRange = `${entry.start}-${entry.end}`
      const slot: ProgramSlotDisplay = { dayOfWeek, timeRange }
      let acc = byId.get(programId)
      if (!acc) {
        const { name, description, extendedDescription, logoUrl } = resolveProgram(
          programs,
          programId,
        )
        acc = { name, description, extendedDescription, logoUrl, slots: [], intervals: [] }
        byId.set(programId, acc)
      }
      acc.slots.push(slot)
      const interval = fromSlot(dayKey, entry.start, entry.end)
      if (interval !== null) acc.intervals.push(interval)
    }
  }

  const minute = at(currentDayOfWeek, currentTime)

  const result: ProgramWithSlots[] = []
  for (const [programId, acc] of byId.entries()) {
    const isLive = acc.intervals.some((interval) => contains(interval, minute))
    result.push({
      programId,
      programName: acc.name,
      programDescription: acc.description,
      programExtendedDescription: acc.extendedDescription,
      programLogoUrl: acc.logoUrl,
      slots: acc.slots,
      isLive,
    })
  }

  result.sort((a, b) =>
    a.programName.localeCompare(b.programName, undefined, { sensitivity: 'base' }),
  )
  return result
}
