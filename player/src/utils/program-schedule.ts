/**
 * Pure functions for program schedule logic.
 *
 * Determines active and incoming programs based on schedule and current time.
 * Handles programs that cross midnight correctly.
 *
 * @since 2.0.3
 */

import type { Program, Schedule } from 'src/types/global'

/** Program name and time range for display */
export interface CurrentProgram {
  programName: string
  timeRange: string
}

/** Incoming program with minutes until start */
export interface IncomingProgram {
  programName: string
  timeRange: string
  minutesUntil: number
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
 * Check if a program is currently active.
 *
 * Active when: current >= entry AND current < exit
 *
 * @param program - Program with start and end times
 * @param currentTime - Current time as minutes since midnight (0-1439)
 * @param isPrevDayCrossing - True when evaluating a previous day's program that crosses midnight
 * @returns True if the program is active
 */
export function isProgramActive(
  program: Program,
  currentTime: number,
  isPrevDayCrossing = false
): boolean {
  const startTime = parseToMinutes(program.start)
  const endTime = parseToMinutes(program.end)

  if (isPrevDayCrossing) {
    // Previous day's program that crosses midnight: we're in early hours of current day
    // Active when currentTime < endTime (e.g. 00:30 < 60 for 01:00)
    return endTime <= startTime && currentTime < endTime
  }

  if (endTime <= startTime) {
    // Program crosses midnight (e.g. 23:00 to 01:00)
    return currentTime >= startTime || currentTime < endTime
  }

  // Normal program: current >= start AND current < end
  return currentTime >= startTime && currentTime < endTime
}

/**
 * Find the currently active program.
 *
 * @param schedule - Weekly schedule
 * @param dayOfWeek - Current day (0=Sunday, 1=Monday, ...)
 * @param currentTime - Current time as minutes since midnight
 * @returns Active program or null
 */
export function findActiveProgram(
  schedule: Schedule,
  dayOfWeek: number,
  currentTime: number
): CurrentProgram | null {
  const dayKey = DAY_MAP[dayOfWeek]
  const dayPrograms = schedule[dayKey]

  if (!dayPrograms || dayPrograms.length === 0) {
    return null
  }

  const sortedPrograms = [...dayPrograms].sort((a, b) => {
    return parseToMinutes(a.start) - parseToMinutes(b.start)
  })

  for (const program of sortedPrograms) {
    if (isProgramActive(program, currentTime, false)) {
      return {
        programName: program.name,
        timeRange: `${program.start}-${program.end}`,
      }
    }
  }

  // Check previous day's programs that cross midnight
  const prevDayIndex = (dayOfWeek - 1 + 7) % 7
  const prevDayKey = DAY_MAP[prevDayIndex]
  const prevDayPrograms = schedule[prevDayKey]

  if (prevDayPrograms && prevDayPrograms.length > 0) {
    const sortedPrevDay = [...prevDayPrograms].sort((a, b) => {
      return parseToMinutes(a.start) - parseToMinutes(b.start)
    })

    for (const program of sortedPrevDay) {
      if (isProgramActive(program, currentTime, true)) {
        return {
          programName: program.name,
          timeRange: `${program.start}-${program.end}`,
        }
      }
    }
  }

  return null
}

/** Incoming program window in minutes */
const INCOMING_WINDOW_MINUTES = 10

/**
 * Find the first incoming program (first after active, within 10 minutes).
 *
 * @param schedule - Weekly schedule
 * @param dayOfWeek - Current day (0=Sunday, 1=Monday, ...)
 * @param currentTime - Current time as minutes since midnight
 * @param activeProgram - The currently active program (from findActiveProgram)
 * @returns Incoming program or null
 */
export function findIncomingProgram(
  schedule: Schedule,
  dayOfWeek: number,
  currentTime: number,
  activeProgram: CurrentProgram | null
): IncomingProgram | null {
  if (!activeProgram) {
    return null
  }

  // Parse referenceEnd and referenceStart from active program's timeRange "HH:MM-HH:MM"
  const rangeParts = activeProgram.timeRange.split('-')
  if (rangeParts.length !== 2) {
    return null
  }
  const referenceStart = parseToMinutes(rangeParts[0])
  const referenceEnd = parseToMinutes(rangeParts[1])
  const activeCrossesMidnight = referenceEnd <= referenceStart

  const dayKey = DAY_MAP[dayOfWeek]
  const dayPrograms = schedule[dayKey] ?? []

  // Build candidates: programs that start >= referenceEnd
  // When active crosses midnight and we're before midnight (currentTime > referenceEnd),
  // same-day programs with start >= referenceEnd are "next calendar day" - add 1440
  const beforeMidnightInCrossing = activeCrossesMidnight && currentTime > referenceEnd

  const candidates: Array<{ program: Program; startTime: number }> = []

  for (const program of dayPrograms) {
    const start = parseToMinutes(program.start)
    if (start >= referenceEnd) {
      const startTime = beforeMidnightInCrossing ? start + 1440 : start
      candidates.push({ program, startTime })
    }
  }

  const nextDayIndex = (dayOfWeek + 1) % 7
  const nextDayKey = DAY_MAP[nextDayIndex]
  const nextDayPrograms = schedule[nextDayKey] ?? []

  for (const program of nextDayPrograms) {
    candidates.push({
      program,
      startTime: parseToMinutes(program.start) + 1440,
    })
  }

  candidates.sort((a, b) => a.startTime - b.startTime)

  for (const { program, startTime } of candidates) {
    const minutesUntil = startTime - currentTime
    if (minutesUntil > 0 && minutesUntil <= INCOMING_WINDOW_MINUTES) {
      return {
        programName: program.name,
        timeRange: `${program.start}-${program.end}`,
        minutesUntil,
      }
    }
  }

  return null
}
