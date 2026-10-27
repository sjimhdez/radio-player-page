/**
 * The week-interval model of the schedule (ADR 0044).
 *
 * A minute of the week is day × 1440 + minute, with Monday = 0 and Sunday = 6
 * (0 ≤ w < 10080). A slot is the interval [start, start + duration) of the week,
 * wrapping at the end of Sunday: end > start lasts end - start, end < start
 * crosses midnight and end == start lasts 24 hours. Mirrors
 * Schedule\Week_Interval in PHP and radplapagScheduleRules in the admin; the
 * three pass the `model` vectors of tests/fixtures/schedule-vectors.json.
 *
 * @since 3.5.0
 */

import type { ScheduleDayKey } from 'src/types/global'

/** Minutes in a day */
export const DAY = 1440

/** Minutes in a week */
export const WEEK = 10080

/** A slot as an interval of the week */
export interface WeekInterval {
  /** Minute of the week it starts (0-10079) */
  start: number
  /** Minutes it lasts (1-1440) */
  duration: number
}

/** Schedule day keys from Monday, the index being the day of the week of the model */
const DAY_KEYS: readonly ScheduleDayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

/** Non-negative remainder of a division by a positive modulus */
function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

/**
 * Parse a time HH:MM to minutes since midnight, loosely like Time::to_minutes()
 * in PHP: a missing, empty or unreadable part counts as 0.
 */
function toMinutes(time: unknown): number {
  if (typeof time !== 'string' || time === '') return 0
  const [hour, minute = ''] = time.split(':', 2)
  return (parseInt(hour, 10) || 0) * 60 + (parseInt(minute, 10) || 0)
}

/**
 * Minute of the week of a day of the week and a time of day.
 *
 * @param dayOfWeek - Day as Date.getUTCDay() and getCurrentTimeInTimezone() give it (0=Sunday)
 * @param currentTime - Minutes since midnight (0-1439)
 * @returns Minute of the week (0-10079)
 */
export function at(dayOfWeek: number, currentTime: number): number {
  return mod(mod(dayOfWeek - 1, 7) * DAY + currentTime, WEEK)
}

/**
 * Minute of the week of a schedule day and a time of day.
 *
 * @param day - Schedule day key (monday ... sunday)
 * @param time - Time HH:MM; a result out of the week wraps into it
 * @returns Minute of the week (0-10079), or null for an unknown day
 */
export function minuteOfWeek(day: string, time: unknown): number | null {
  const index = DAY_KEYS.indexOf(day as ScheduleDayKey)
  if (index === -1) return null
  return mod(index * DAY + toMinutes(time), WEEK)
}

/**
 * Interval of a slot.
 *
 * @param day - Schedule day key the slot belongs to
 * @param start - Start time HH:MM
 * @param end - End time HH:MM
 * @returns Its interval, or null for an unknown day
 */
export function fromSlot(day: string, start: unknown, end: unknown): WeekInterval | null {
  const startW = minuteOfWeek(day, start)
  if (startW === null) return null
  const duration = mod(toMinutes(end) - toMinutes(start), DAY)
  return { start: startW, duration: duration === 0 ? DAY : duration }
}

/**
 * Check if an interval contains a minute of the week (start inclusive, end exclusive).
 */
export function contains(interval: WeekInterval, minute: number): boolean {
  return mod(minute - interval.start, WEEK) < interval.duration
}

/**
 * Minutes from a minute of the week to the next start of an interval:
 * 0 at its start, up to 10079 just after it.
 */
export function minutesUntilStart(interval: WeekInterval, minute: number): number {
  return mod(interval.start - minute, WEEK)
}

/**
 * Check if two intervals share at least one minute, wrapping at the end of the week.
 * Two intervals that only touch (one ends when the other starts) do not.
 */
export function overlaps(a: WeekInterval, b: WeekInterval): boolean {
  return contains(a, b.start) || contains(b, a.start)
}
