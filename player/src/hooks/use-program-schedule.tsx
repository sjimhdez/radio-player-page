import { useState, useEffect, useRef } from 'react'
import useConfig from 'src/hooks/use-config'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'
import {
  findActiveProgram,
  findIncomingProgram,
  type CurrentProgram,
  type IncomingProgram,
} from 'src/utils/program-schedule'

export type { CurrentProgram, IncomingProgram }

export interface ProgramScheduleResult {
  active: CurrentProgram | null
  incoming: IncomingProgram | null
}

/**
 * Hook to determine the active and incoming programs based on schedule and current time.
 * Uses relational data: config.schedule (program_id, start, end) and config.programs (name, logoUrl).
 *
 * Active: current >= entry AND current < exit
 * Incoming: first program that starts within 10 minutes from now (relative to current time, not to active program)
 *
 * Updates at the start of each system minute (:00 seconds).
 *
 * The result is used only for display (StreamInfo). The schedule must never
 * trigger play/pause: playback state is controlled solely by the user.
 *
 * @returns Object with active and incoming program, or null for each if none
 */
function useProgramSchedule(): ProgramScheduleResult {
  const config = useConfig()
  const [result, setResult] = useState<ProgramScheduleResult>({
    active: null,
    incoming: null,
  })
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current)
      timeoutIdRef.current = null
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }

    const schedule = config.schedule
    const programs = config.programs

    if (!schedule) {
      setResult({ active: null, incoming: null })
      return
    }

    const calculate = (): ProgramScheduleResult => {
      const { dayOfWeek, currentTime } = getCurrentTimeInTimezone(
        config.timezoneOffset
      )
      const active = findActiveProgram(
        schedule,
        programs,
        dayOfWeek,
        currentTime
      )
      const incoming = findIncomingProgram(
        schedule,
        programs,
        dayOfWeek,
        currentTime
      )
      return { active, incoming }
    }

    setResult(calculate())

    const msIntoMinute = Date.now() % 60000
    const delay = msIntoMinute === 0 ? 0 : 60000 - msIntoMinute
    timeoutIdRef.current = setTimeout(() => {
      setResult(calculate())
      intervalIdRef.current = setInterval(() => setResult(calculate()), 60000)
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
  }, [config.schedule, config.programs, config.timezoneOffset])

  return result
}

export default useProgramSchedule
