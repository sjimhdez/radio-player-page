import { useState, useEffect, useRef } from 'react'
import type { Schedule } from 'src/types/global'
import useConfig from 'src/hooks/use-config'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'

/**
 * Result of the upcoming program calculation
 */
export interface UpcomingProgram {
  /** Program name */
  programName: string
  /** Time range in format "HH:MM-HH:MM" */
  timeRange: string
  /** Minutes until the program starts */
  minutesUntil: number
}

/**
 * Hook to determine the upcoming program that will start within 5 minutes or less.
 *
 * This hook:
 * - Reads the schedule from plugin configuration via useConfig() hook
 * - Uses WordPress timezone offset (numeric, handles DST automatically) to calculate current time
 * - Falls back to UTC if offset is invalid or unavailable
 * - Calculates the current day of the week (0=Sunday, 1=Monday, etc.) in WordPress timezone
 * - Orders programs by start time before evaluation
 * - Finds the first program that starts after the current time and within 5 minutes
 * - Checks current day and next day's programs
 * - Updates at the start of each system minute (at :00 seconds) to reflect program changes
 * - Returns null if no schedule is configured or no program starts within 5 minutes
 *
 * Uses numeric offset from WordPress (handles DST automatically) with UTC fallback.
 *
 * @returns UpcomingProgram object with programName, timeRange, and minutesUntil, or null if no upcoming program
 */
function useUpcomingProgram(): UpcomingProgram | null {
  const config = useConfig()
  const [upcomingProgram, setUpcomingProgram] = useState<UpcomingProgram | null>(null)
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Clear any previous timers when effect re-runs (before early returns)
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }

    const schedule: Schedule | undefined = config.schedule

    // If no schedule, return null
    if (!schedule) {
      setUpcomingProgram(null)
      return
    }

    /**
     * Calculate the upcoming program that starts within 5 minutes
     */
    const calculateUpcomingProgram = (): UpcomingProgram | null => {
      // Get current time in WordPress timezone using numeric offset
      const { dayOfWeek, currentTime } = getCurrentTimeInTimezone(
        config.timezoneOffset
      )

      // Map day of week to schedule key
      const dayMap: Record<number, keyof Schedule> = {
        0: 'sunday',
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
      }

      const dayKey = dayMap[dayOfWeek]
      const dayPrograms = schedule[dayKey]

      // Collect all candidate programs from current day and next day
      const candidates: Array<{
        program: { name: string; start: string; end: string }
        startTime: number
        dayOffset: number
      }> = []

      // Check current day's programs
      if (dayPrograms && dayPrograms.length > 0) {
        for (const program of dayPrograms) {
          const [startHour, startMinute] = program.start.split(':').map(Number)
          const [endHour, endMinute] = program.end.split(':').map(Number)

          const startTime = startHour * 60 + startMinute
          const endTime = endHour * 60 + endMinute

          // Check if program is currently active (same logic as use-current-program)
          let isActive = false
          if (endTime <= startTime) {
            // Program crosses midnight
            isActive = currentTime >= startTime || currentTime < endTime
          } else {
            // Normal program
            isActive = currentTime >= startTime && currentTime < endTime
          }

          // Only consider programs that start after current time and are not currently active
          if (startTime > currentTime && !isActive) {
            candidates.push({
              program,
              startTime,
              dayOffset: 0,
            })
          }
        }
      }

      // Check next day's programs
      const nextDayIndex = (dayOfWeek + 1) % 7
      const nextDayKey = dayMap[nextDayIndex]
      const nextDayPrograms = schedule[nextDayKey]

      if (nextDayPrograms && nextDayPrograms.length > 0) {
        for (const program of nextDayPrograms) {
          const [startHour, startMinute] = program.start.split(':').map(Number)
          const startTime = startHour * 60 + startMinute

          // For next day, add 24 hours (1440 minutes) to the start time
          candidates.push({
            program,
            startTime: startTime + 1440,
            dayOffset: 1,
          })
        }
      }

      // Also check programs from previous day that cross midnight
      // These might start "today" if they cross midnight
      const prevDayIndex = (dayOfWeek - 1 + 7) % 7
      const prevDayKey = dayMap[prevDayIndex]
      const prevDayPrograms = schedule[prevDayKey]

      if (prevDayPrograms && prevDayPrograms.length > 0) {
        for (const program of prevDayPrograms) {
          const [startHour, startMinute] = program.start.split(':').map(Number)
          const [endHour, endMinute] = program.end.split(':').map(Number)

          const startTime = startHour * 60 + startMinute
          const endTime = endHour * 60 + endMinute

          // If program crosses midnight and we're in the early hours (before end time)
          // The program is currently active, so we don't want to show it as upcoming
          // But we need to check if there's a program that starts after this one ends
          if (endTime <= startTime && currentTime < endTime) {
            // This program is currently active, skip it
            continue
          }
        }
      }

      // Sort candidates by start time to find the earliest one
      candidates.sort((a, b) => a.startTime - b.startTime)

      // Find the first program that starts within 5 minutes
      for (const candidate of candidates) {
        const minutesUntil = candidate.startTime - currentTime

        // Only show if it starts within 5 minutes and more than 0 minutes
        // (0 minutes means it's starting now, which should be handled by current program)
        if (minutesUntil > 0 && minutesUntil <= 5) {
          return {
            programName: candidate.program.name,
            timeRange: `${candidate.program.start}-${candidate.program.end}`,
            minutesUntil,
          }
        }
      }

      return null
    }

    // Calculate initial program
    setUpcomingProgram(calculateUpcomingProgram())

    // Align to system minute: first tick at next :00, then every 60s
    const msIntoMinute = Date.now() % 60000
    const delay = msIntoMinute === 0 ? 0 : 60000 - msIntoMinute
    timeoutIdRef.current = setTimeout(() => {
      setUpcomingProgram(calculateUpcomingProgram())
      intervalIdRef.current = setInterval(() => {
        setUpcomingProgram(calculateUpcomingProgram())
      }, 60000)
    }, delay)

    return () => {
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [config.schedule, config.timezoneOffset])

  return upcomingProgram
}

export default useUpcomingProgram
