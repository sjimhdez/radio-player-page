import { useMemo, useSyncExternalStore } from 'react'
import useConfig from 'src/hooks/use-config'
import { createMinuteStore, type MinuteStore } from 'src/core/clock/minute-ticker'
import { getNowPlaying, type NowPlaying } from 'src/core/schedule/now-playing'
import type { CurrentProgram, IncomingProgram } from 'src/core/schedule/program-schedule'

export type { CurrentProgram, IncomingProgram }

/** The program on air and the next one */
export type ProgramScheduleResult = NowPlaying

/** The result without a schedule: nothing on air and nothing next */
const NO_PROGRAMS: ProgramScheduleResult = { active: null, incoming: null }

/** The store without a schedule: there is nothing to recompute, so no timer is started */
const NO_SCHEDULE_STORE: MinuteStore<ProgramScheduleResult> = {
  subscribe: () => () => {},
  getSnapshot: () => NO_PROGRAMS,
}

/**
 * The program on air and the next one, recomputed at the start of every minute; null
 * for each when there is none.
 *
 * A program is on air from its start to just before its end; the next one is the first
 * that starts within 10 minutes from now, whether or not a program is on air. The
 * result is only shown (StreamInfo): the schedule never controls playback.
 */
function useProgramSchedule(): ProgramScheduleResult {
  const { schedule, programs, timezoneOffset, timezone } = useConfig()

  const store = useMemo(
    () =>
      schedule
        ? createMinuteStore(() => getNowPlaying(schedule, programs, timezoneOffset, timezone))
        : NO_SCHEDULE_STORE,
    [schedule, programs, timezoneOffset, timezone],
  )

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

export default useProgramSchedule
