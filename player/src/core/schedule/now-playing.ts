import type { ProgramDefinition, Schedule } from 'src/types/global'
import { getCurrentTimeInTimezone, getStationOffset } from 'src/core/clock/timezone'
import {
  findActiveProgram,
  findIncomingProgram,
  type CurrentProgram,
  type IncomingProgram,
} from 'src/core/schedule/program-schedule'

/** The program on air and the next one; null when there is none */
export interface NowPlaying {
  active: CurrentProgram | null
  incoming: IncomingProgram | null
}

/**
 * Resolves the program on air and the next one for the current minute at the station.
 *
 * A program is on air from its start to just before its end; the next one is the first
 * that starts within 10 minutes.
 *
 * The result is informative only: the schedule never controls playback.
 *
 * @param timezoneOffset - Station offset in hours from UTC served with the page (fallback)
 * @param timezone - Site IANA zone; its current offset wins, so DST is followed (ADR 0046)
 */
export function getNowPlaying(
  schedule: Schedule | undefined,
  programs: ProgramDefinition[] | undefined,
  timezoneOffset: number,
  timezone?: string,
): NowPlaying {
  if (!schedule) return { active: null, incoming: null }

  const { dayOfWeek, currentTime } = getCurrentTimeInTimezone(
    getStationOffset(timezone, timezoneOffset),
  )
  return {
    active: findActiveProgram(schedule, programs, dayOfWeek, currentTime),
    incoming: findIncomingProgram(schedule, programs, dayOfWeek, currentTime),
  }
}
