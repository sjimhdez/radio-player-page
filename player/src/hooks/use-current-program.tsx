import { useState, useEffect, useRef } from 'react'
import type { Schedule } from 'src/types/global'
import useConfig from 'src/hooks/use-config'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'

/**
 * Result of the current program calculation
 */
export interface CurrentProgram {
  /** Program name */
  programName: string
  /** Time range in format "HH:MM-HH:MM" */
  timeRange: string
}

/**
 * Hook to determine the currently active program based on the schedule and current time.
 *
 * This hook:
 * - Reads the schedule from plugin configuration via useConfig() hook
 * - Uses WordPress timezone offset (numeric, handles DST automatically) to calculate current time
 * - Falls back to UTC if offset is invalid or unavailable
 * - Calculates the current day of the week (0=Sunday, 1=Monday, etc.) in WordPress timezone
 * - Orders programs by start time before evaluation to handle ties correctly
 * - Determines which program is currently active by comparing current time with program time slots
 * - Updates at the start of each system minute (at :00 seconds) to reflect program changes
 * - Returns null if no schedule is configured or no program is active
 *
 * Uses numeric offset from WordPress (handles DST automatically) with UTC fallback.
 *
 * @returns CurrentProgram object with programName and timeRange, or null if no active program
 */
function useCurrentProgram(): CurrentProgram | null {
  const config = useConfig()
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null)
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
      setCurrentProgram(null)
      return
    }

    /**
     * Calculate the current active program
     */
    const calculateCurrentProgram = (): CurrentProgram | null => {
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

      // If no programs for this day, return null
      if (!dayPrograms || dayPrograms.length === 0) {
        return null
      }

      // Sort programs by start time to handle ties correctly
      // When a program ends exactly when another starts (e.g., 19:00-20:00 and 20:00-21:00),
      // at exactly 20:00 we show the program that starts (20:00-21:00), not the one that ends.
      // This is achieved by using `currentTime < endTime` (not `<=`) in the condition below.
      const sortedPrograms = [...dayPrograms].sort((a, b) => {
        const [aHour, aMinute] = a.start.split(':').map(Number)
        const [bHour, bMinute] = b.start.split(':').map(Number)
        const aStartTime = aHour * 60 + aMinute
        const bStartTime = bHour * 60 + bMinute
        return aStartTime - bStartTime
      })

      // Find the active program
      // We iterate through sorted programs and return the first one that matches.
      // The sorting ensures that when multiple programs could match (e.g., at exact boundary times),
      // we prioritize programs that start at that time over programs that end at that time.
      for (const program of sortedPrograms) {
        const [startHour, startMinute] = program.start.split(':').map(Number)
        const [endHour, endMinute] = program.end.split(':').map(Number)

        const startTime = startHour * 60 + startMinute
        const endTime = endHour * 60 + endMinute

        // Handle programs that cross midnight
        if (endTime <= startTime) {
          // Program crosses midnight (e.g., 23:00 to 01:00)
          // Check if current time is after start (before midnight) or before end (after midnight)
          // Note: We use `currentTime < endTime` (not `<=`) so that at exactly endTime,
          // the program that starts at that time takes precedence.
          if (currentTime >= startTime || currentTime < endTime) {
            return {
              programName: program.name,
              timeRange: `${program.start}-${program.end}`,
            }
          }
        } else {
          // Normal program (doesn't cross midnight)
          // Critical: We use `currentTime < endTime` (not `<=`) to handle exact boundary times correctly.
          // Example: Program A (19:00-20:00) and Program B (20:00-21:00)
          // At exactly 20:00 (currentTime === 1200 minutes):
          // - Program A: 1200 >= 1140 (start) && 1200 < 1200 (end) = false (not shown)
          // - Program B: 1200 >= 1200 (start) && 1200 < 1260 (end) = true (shown)
          // This ensures the program that starts at the boundary time is displayed.
          if (currentTime >= startTime && currentTime < endTime) {
            return {
              programName: program.name,
              timeRange: `${program.start}-${program.end}`,
            }
          }
        }
      }

      // Also check previous day's programs that cross midnight
      const prevDayIndex = (dayOfWeek - 1 + 7) % 7
      const prevDayKey = dayMap[prevDayIndex]
      const prevDayPrograms = schedule[prevDayKey]

      if (prevDayPrograms && prevDayPrograms.length > 0) {
        // Sort previous day's programs by start time for consistency
        const sortedPrevDayPrograms = [...prevDayPrograms].sort((a, b) => {
          const [aHour, aMinute] = a.start.split(':').map(Number)
          const [bHour, bMinute] = b.start.split(':').map(Number)
          const aStartTime = aHour * 60 + aMinute
          const bStartTime = bHour * 60 + bMinute
          return aStartTime - bStartTime
        })

        for (const program of sortedPrevDayPrograms) {
          const [startHour, startMinute] = program.start.split(':').map(Number)
          const [endHour, endMinute] = program.end.split(':').map(Number)

          const startTime = startHour * 60 + startMinute
          const endTime = endHour * 60 + endMinute

          // If program crosses midnight and we're in the early hours (before end time)
          // Note: We use `currentTime < endTime` (not `<=`) for consistency with the main logic.
          // This ensures that if a program from the previous day ends exactly when a program
          // from the current day starts, the current day's program takes precedence.
          if (endTime <= startTime && currentTime < endTime) {
            return {
              programName: program.name,
              timeRange: `${program.start}-${program.end}`,
            }
          }
        }
      }

      return null
    }

    // Calculate initial program
    setCurrentProgram(calculateCurrentProgram())

    // Align to system minute: first tick at next :00, then every 60s
    const msIntoMinute = Date.now() % 60000
    const delay = msIntoMinute === 0 ? 0 : 60000 - msIntoMinute
    timeoutIdRef.current = setTimeout(() => {
      setCurrentProgram(calculateCurrentProgram())
      intervalIdRef.current = setInterval(() => {
        setCurrentProgram(calculateCurrentProgram())
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

  return currentProgram
}

export default useCurrentProgram
