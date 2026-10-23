import type { ProgramDefinition, Schedule } from 'src/types/global'
import { getCurrentTimeInTimezone, getStationOffset } from 'src/utils/timezone'
import {
  findActiveProgram,
  findIncomingProgram,
  type CurrentProgram,
  type IncomingProgram,
} from 'src/utils/program-schedule'

export interface NowPlaying {
  active: CurrentProgram | null
  incoming: IncomingProgram | null
}

/**
 * Resolves the program on air and the next one for the current minute at the station.
 *
 * Active: current >= entry AND current < exit
 * Incoming: first program that starts within 10 minutes from now
 *
 * The result is informative only: the schedule never controls playback.
 *
 * @param schedule - Weekly schedule (relational: program_id, start, end)
 * @param programs - Program definitions to resolve name/logo by program_id
 * @param timezoneOffset - Station offset in hours from UTC served with the page (fallback)
 * @param timezone - Site IANA zone; its current offset wins, so DST is followed (ADR 0046)
 * @returns NowPlaying, with null for each program when there is none
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
