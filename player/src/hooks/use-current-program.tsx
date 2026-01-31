import { useState, useEffect } from 'react'
import type { Schedule } from 'src/types/global'

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
 * - Reads the schedule from window.SCHEDULE if available
 * - Calculates the current day of the week (0=Sunday, 1=Monday, etc.)
 * - Determines which program is currently active by comparing current time with program time slots
 * - Updates automatically every minute to reflect program changes
 * - Returns null if no schedule is configured or no program is active
 *
 * @returns CurrentProgram object with programName and timeRange, or null if no active program
 */
function useCurrentProgram(): CurrentProgram | null {
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null)

  useEffect(() => {
    const schedule: Schedule | undefined = window.SCHEDULE

    // If no schedule, return null
    if (!schedule) {
      setCurrentProgram(null)
      return
    }

    /**
     * Calculate the current active program
     */
    const calculateCurrentProgram = (): CurrentProgram | null => {
      const now = new Date()
      const dayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const currentTime = now.getHours() * 60 + now.getMinutes() // Current time in minutes since midnight

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

      // Find the active program
      for (const program of dayPrograms) {
        const [startHour, startMinute] = program.start.split(':').map(Number)
        const [endHour, endMinute] = program.end.split(':').map(Number)

        const startTime = startHour * 60 + startMinute
        const endTime = endHour * 60 + endMinute

        // Handle programs that cross midnight
        if (endTime <= startTime) {
          // Program crosses midnight (e.g., 23:00 to 00:00)
          // Check if current time is after start (before midnight) or before end (after midnight)
          if (currentTime >= startTime || currentTime < endTime) {
            return {
              programName: program.name,
              timeRange: `${program.start}-${program.end}`,
            }
          }
        } else {
          // Normal program (doesn't cross midnight)
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
        for (const program of prevDayPrograms) {
          const [startHour, startMinute] = program.start.split(':').map(Number)
          const [endHour, endMinute] = program.end.split(':').map(Number)

          const startTime = startHour * 60 + startMinute
          const endTime = endHour * 60 + endMinute

          // If program crosses midnight and we're in the early hours (before end time)
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

    // Update every minute to reflect program changes
    const interval = setInterval(() => {
      setCurrentProgram(calculateCurrentProgram())
    }, 60000) // 60 seconds

    return () => {
      clearInterval(interval)
    }
  }, [])

  return currentProgram
}

export default useCurrentProgram
