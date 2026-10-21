import { useMemo, useSyncExternalStore } from 'react'
import useConfig from 'src/hooks/use-config'
import { createMinuteStore, type MinuteStore } from 'src/core/clock/minute-ticker'
import { getNowPlaying, type NowPlaying } from 'src/core/schedule/now-playing'
import type { CurrentProgram, IncomingProgram } from 'src/utils/program-schedule'

export type { CurrentProgram, IncomingProgram }

export type ProgramScheduleResult = NowPlaying

const NO_PROGRAMS: ProgramScheduleResult = { active: null, incoming: null }

// Without a schedule there is nothing to recompute, so no timer is started.
const NO_SCHEDULE_STORE: MinuteStore<ProgramScheduleResult> = {
  subscribe: () => () => {},
  getSnapshot: () => NO_PROGRAMS,
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
  const { schedule, programs, timezoneOffset } = useConfig()

  const store = useMemo(
    () =>
      schedule
        ? createMinuteStore(() => getNowPlaying(schedule, programs, timezoneOffset))
        : NO_SCHEDULE_STORE,
    [schedule, programs, timezoneOffset],
  )

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

export default useProgramSchedule
