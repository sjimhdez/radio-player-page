// The week-interval model (ADR 0044), with the `model` vectors that PHP reads
// in tests/php/unit/Schedule/WeekIntervalTest.php.
import { describe, expect, it } from 'vitest'
import vectors from '../../../tests/fixtures/schedule-vectors.json'
import {
  at,
  contains,
  fromSlot,
  minuteOfWeek,
  minutesUntilStart,
  overlaps,
  type WeekInterval,
} from 'src/utils/week-interval'

type VectorSlot = { day: string; start: string; end: string }
type VectorInstant = { day: string; time: string }

function interval(slot: VectorSlot): WeekInterval {
  const result = fromSlot(slot.day, slot.start, slot.end)
  expect(result).not.toBeNull()
  return result!
}

function minute(instant: VectorInstant): number {
  const result = minuteOfWeek(instant.day, instant.time)
  expect(result).not.toBeNull()
  return result!
}

describe('minuteOfWeek', () => {
  it.each([
    ['monday', '00:00', 0],
    ['monday', '23:59', 1439],
    ['tuesday', '00:00', 1440],
    ['thursday', '15:30', 3 * 1440 + 930],
    ['sunday', '23:59', 10079],
    ['friday', '7:5', 4 * 1440 + 425],
  ])('gives %s %s as minute %i of the week', (day, time, expected) => {
    expect(minuteOfWeek(day, time)).toBe(expected)
  })

  it('has no minute and no interval for an unknown day key', () => {
    expect(minuteOfWeek('Monday', '08:00')).toBeNull()
    expect(fromSlot('lunes', '08:00', '10:00')).toBeNull()
  })
})

describe('at', () => {
  // The day of the week of Date.getUTCDay() and getCurrentTimeInTimezone(): 0 = Sunday.
  it.each([
    [1, 0, 0],
    [1, 590, 590],
    [0, 1439, 10079],
    [0, 0, 6 * 1440],
    [2, 90, 1530],
    [6, 1439, 6 * 1440 - 1],
  ])('gives day %i, minute %i as minute %i of the week', (dayOfWeek, minutes, expected) => {
    expect(at(dayOfWeek, minutes)).toBe(expected)
  })
})

describe('model vectors', () => {
  describe.each(vectors.model.from_slot)('from_slot $id', (vector) => {
    it('gives the interval of the slot', () => {
      expect(interval(vector.slot)).toEqual(vector.expected)
    })
  })

  describe.each(vectors.model.contains)('contains $id', (vector) => {
    it(`is ${vector.expected}`, () => {
      expect(contains(interval(vector.slot), minute(vector.at))).toBe(vector.expected)
    })
  })

  describe.each(vectors.model.minutes_until_start)('minutes_until_start $id', (vector) => {
    it(`is ${vector.expected}`, () => {
      expect(minutesUntilStart(interval(vector.slot), minute(vector.at))).toBe(vector.expected)
    })
  })

  describe.each(vectors.model.overlaps)('overlaps $id', (vector) => {
    it(`is ${vector.expected} in either order`, () => {
      const a = interval(vector.a)
      const b = interval(vector.b)
      expect(overlaps(a, b), 'a, b').toBe(vector.expected)
      expect(overlaps(b, a), 'b, a').toBe(vector.expected)
    })
  })
})

describe('fromSlot with times out of the day', () => {
  // Loose meta, never saved: still an interval within the week, as in PHP.
  it.each([
    ['sunday', '24:00', '01:00', 0, 60],
    ['monday', '-1:30', '01:00', 10050, 90],
    ['monday', '22:00', '25:00', 1320, 180],
  ])('gives %s %s-%s as { start: %i, duration: %i }', (day, start, end, startW, duration) => {
    expect(fromSlot(day, start, end)).toEqual({ start: startW, duration })
  })

  it('reads an empty or missing time as 00:00', () => {
    expect(fromSlot('monday', '', '01:00')).toEqual({ start: 0, duration: 60 })
    expect(fromSlot('monday', undefined, null)).toEqual({ start: 0, duration: 1440 })
    expect(minuteOfWeek('monday', 'abc')).toBe(0)
  })
})
