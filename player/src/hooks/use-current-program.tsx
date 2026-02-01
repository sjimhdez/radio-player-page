import { useState, useEffect } from 'react'
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
 * - Updates automatically every minute to reflect program changes
 * - Returns null if no schedule is configured or no program is active
 *
 * Uses numeric offset from WordPress (handles DST automatically) with UTC fallback.
 *
 * @returns CurrentProgram object with programName and timeRange, or null if no active program
 */
function useCurrentProgram(): CurrentProgram | null {
  const config = useConfig()
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null)

  useEffect(() => {
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
      // at exactly 20:00 we show the program that starts (20:00-21:00), not the one that ends
      const sortedPrograms = [...dayPrograms].sort((a, b) => {
        const [aHour, aMinute] = a.start.split(':').map(Number)
        const [bHour, bMinute] = b.start.split(':').map(Number)
        const aStartTime = aHour * 60 + aMinute
        const bStartTime = bHour * 60 + bMinute
        return aStartTime - bStartTime
      })

      // Find the active program
      for (const program of sortedPrograms) {
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
  }, [config.schedule, config.timezoneOffset])

  return currentProgram
}

export default useCurrentProgram
