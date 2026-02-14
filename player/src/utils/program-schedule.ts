/**
 * Pure functions for program schedule logic.
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

/** Program name and time range for display (resolved from schedule + programs) */
export interface CurrentProgram {
  programName: string
  timeRange: string
  programLogoUrl?: string | null
}

/** Incoming program with minutes until start (resolved from schedule + programs) */
export interface IncomingProgram {
  programName: string
  timeRange: string
  minutesUntil: number
  programLogoUrl?: string | null
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

/** Parse "HH:MM" to minutes since midnight */
function parseToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/**
 * Check if a schedule entry is currently active (by start/end only).
 *
 * @param entry - Schedule entry with start and end times
 * @param currentTime - Current time as minutes since midnight (0-1439)
 * @param isPrevDayCrossing - True when evaluating a previous day's entry that crosses midnight
 */
export function isProgramActive(
  entry: { start: string; end: string },
  currentTime: number,
  isPrevDayCrossing = false,
): boolean {
  const startTime = parseToMinutes(entry.start)
  const endTime = parseToMinutes(entry.end)

  if (isPrevDayCrossing) {
    return endTime <= startTime && currentTime < endTime
  }

  if (endTime <= startTime) {
    return currentTime >= startTime || currentTime < endTime
  }

  return currentTime >= startTime && currentTime < endTime
}

/**
 * Resolve program name, description, extended description and logo from programs array by program_id (unique string ID).
 */
function resolveProgram(
  programs: ProgramDefinition[] | undefined,
  programId: string,
): { name: string; description: string | null; extendedDescription: string | null; logoUrl: string | null } {
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
 * Find the currently active program.
 *
 * @param schedule - Weekly schedule (relational: program_id (string ID), start, end)
 * @param programs - Program definitions to resolve name/logo by program_id (unique string ID)
 * @param dayOfWeek - Current day (0=Sunday, 1=Monday, ...)
 * @param currentTime - Current time as minutes since midnight
 * @returns Active program (resolved) or null
 */
export function findActiveProgram(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  dayOfWeek: number,
  currentTime: number,
): CurrentProgram | null {
  if (!schedule) return null

  const dayKey = DAY_MAP[dayOfWeek]
  const dayEntries = schedule[dayKey]

  if (!dayEntries || dayEntries.length === 0) {
    return null
  }

  const sorted = [...dayEntries].sort((a, b) => parseToMinutes(a.start) - parseToMinutes(b.start))

  for (const entry of sorted) {
    if (isProgramActive(entry, currentTime, false)) {
      const { name, logoUrl } = resolveProgram(programs, entry.program_id)
      return {
        programName: name,
        timeRange: `${entry.start}-${entry.end}`,
        programLogoUrl: logoUrl,
      }
    }
  }

  const prevDayIndex = (dayOfWeek - 1 + 7) % 7
  const prevDayKey = DAY_MAP[prevDayIndex]
  const prevDayEntries = schedule[prevDayKey]

  if (prevDayEntries && prevDayEntries.length > 0) {
    const sortedPrev = [...prevDayEntries].sort(
      (a, b) => parseToMinutes(a.start) - parseToMinutes(b.start),
    )
    for (const entry of sortedPrev) {
      if (isProgramActive(entry, currentTime, true)) {
        const { name, logoUrl } = resolveProgram(programs, entry.program_id)
        return {
          programName: name,
          timeRange: `${entry.start}-${entry.end}`,
          programLogoUrl: logoUrl,
        }
      }
    }
  }

  return null
}

/** Incoming program window in minutes (relative to current time) */
const INCOMING_WINDOW_MINUTES = 10

/**
 * Find the first incoming program (next program that starts within 10 minutes from now).
 *
 * Calculated relative to current time, not to the active program, so the incoming
 * program is shown even when there is no program currently active.
 *
 * @param schedule - Weekly schedule (relational: program_id is unique string ID)
 * @param programs - Program definitions to resolve name/logo by program_id (unique string ID)
 * @param dayOfWeek - Current day (0=Sunday, 1=Monday, ...)
 * @param currentTime - Current time as minutes since midnight
 * @returns Incoming program (resolved) or null
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

  const dayKey = DAY_MAP[dayOfWeek]
  const dayEntries = schedule[dayKey] ?? []
  const nextDayKey = DAY_MAP[(dayOfWeek + 1) % 7]
  const nextDayEntries = schedule[nextDayKey] ?? []

  const candidates: Array<{ entry: ScheduleEntry; startTime: number }> = []

  // Today: programs that start after current time
  for (const entry of dayEntries) {
    const start = parseToMinutes(entry.start)
    if (start > currentTime) {
      candidates.push({ entry, startTime: start })
    }
  }

  // Next day: all programs (their start is "tomorrow" in same timeline)
  for (const entry of nextDayEntries) {
    candidates.push({
      entry,
      startTime: parseToMinutes(entry.start) + 1440,
    })
  }

  candidates.sort((a, b) => a.startTime - b.startTime)

  for (const { entry, startTime } of candidates) {
    const minutesUntil = startTime - currentTime
    if (minutesUntil > 0 && minutesUntil <= INCOMING_WINDOW_MINUTES) {
      const { name, logoUrl } = resolveProgram(programs, entry.program_id)
      return {
        programName: name,
        timeRange: `${entry.start}-${entry.end}`,
        minutesUntil,
        programLogoUrl: logoUrl,
      }
    }
  }

  return null
}

/** Resolved program slot for display in the schedule modal (one per day entry) */
export interface ProgramForDay {
  programName: string
  programLogoUrl: string | null
  start: string
  end: string
  timeRange: string
  isActive: boolean
}

/**
 * Get all program entries for a given day, sorted by start time, with name/logo resolved
 * and isActive set when that day is "today" and the entry is currently active.
 *
 * @param schedule - Weekly schedule (relational)
 * @param programs - Program definitions to resolve name/logo by program_id
 * @param dayOfWeek - Day to list (0=Sunday, 1=Monday, ...)
 * @param currentDayOfWeek - Current day in WordPress timezone (0-6)
 * @param currentTime - Current time as minutes since midnight
 * @returns Sorted list of resolved entries with isActive flag
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
  const dayEntries = schedule[dayKey]

  if (!dayEntries || dayEntries.length === 0) return []

  const sorted = [...dayEntries].sort((a, b) => parseToMinutes(a.start) - parseToMinutes(b.start))
  const isToday = dayOfWeek === currentDayOfWeek

  return sorted.map((entry) => {
    const { name, logoUrl } = resolveProgram(programs, entry.program_id)
    const active = isToday && isProgramActive(entry, currentTime, false)
    return {
      programName: name,
      programLogoUrl: logoUrl,
      start: entry.start,
      end: entry.end,
      timeRange: `${entry.start}-${entry.end}`,
      isActive: active,
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
 * Get programs for all days of the week, ordered with current day first.
 * Used by the schedule modal to show a single scrollable list.
 *
 * @param schedule - Weekly schedule (relational)
 * @param programs - Program definitions to resolve name/logo by program_id
 * @param currentDayOfWeek - Current day in WordPress timezone (0-6)
 * @param currentTime - Current time as minutes since midnight
 * @returns Array of days with programs, starting from today
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
 * Get all programs with every slot they have in the week, sorted alphabetically by name.
 * Used by the "all programs" modal. Each program includes isLive when any of its slots
 * is currently active (today or previous day crossing midnight).
 *
 * @param schedule - Weekly schedule (relational)
 * @param programs - Program definitions to resolve name/logo by program_id
 * @param currentDayOfWeek - Current day in WordPress timezone (0-6)
 * @param currentTime - Current time as minutes since midnight
 * @returns Array of programs with their slots and isLive flag, sorted by programName
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
    entries: Array<{ dayOfWeek: number; entry: ScheduleEntry }>
  }
  const byId = new Map<string, Accum>()

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    const dayKey = DAY_MAP[dayOfWeek]
    const dayEntries = schedule[dayKey]
    if (!dayEntries || dayEntries.length === 0) continue
    for (const entry of dayEntries) {
      const programId = entry.program_id
      const timeRange = `${entry.start}-${entry.end}`
      const slot: ProgramSlotDisplay = { dayOfWeek, timeRange }
      let acc = byId.get(programId)
      if (!acc) {
        const { name, description, extendedDescription, logoUrl } = resolveProgram(programs, programId)
        acc = { name, description, extendedDescription, logoUrl, slots: [], entries: [] }
        byId.set(programId, acc)
      }
      acc.slots.push(slot)
      acc.entries.push({ dayOfWeek, entry })
    }
  }

  const prevDayOfWeek = (currentDayOfWeek - 1 + 7) % 7

  const result: ProgramWithSlots[] = []
  for (const [programId, acc] of byId.entries()) {
    const isLive = acc.entries.some(
      ({ dayOfWeek, entry }) =>
        (dayOfWeek === currentDayOfWeek && isProgramActive(entry, currentTime, false)) ||
        (dayOfWeek === prevDayOfWeek && isProgramActive(entry, currentTime, true)),
    )
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

  result.sort((a, b) => a.programName.localeCompare(b.programName, undefined, { sensitivity: 'base' }))
  return result
}
