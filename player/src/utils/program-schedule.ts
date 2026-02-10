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
 * @since 2.0.3
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
 * Resolve program name and logo from programs array by program_id (unique string ID).
 */
function resolveProgram(
  programs: ProgramDefinition[] | undefined,
  programId: string,
): { name: string; logoUrl: string | null } {
  if (!programs || !programId) {
    return { name: '', logoUrl: null }
  }
  const p = programs.find((prog) => prog.id === programId)
  return {
    name: p?.name ?? '',
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
