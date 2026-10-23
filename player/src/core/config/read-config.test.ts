// readConfig resolves the window.RADPLAPAG_* globals without touching window (spec 0006,
// task 1.3). The cases mirror the characterization of src/hooks/use-config.test.tsx.
import { describe, expect, it } from 'vitest'
import { readConfig } from 'src/core/config/read-config'
import type { RawGlobals } from 'src/core/config/read-config'
import type { PluginConfig, ProgramDefinition, Schedule } from 'src/types/global'

const CONFIG: PluginConfig = {
  streamUrl: 'https://radio.test/live.mp3',
  siteTitle: 'Radio Test',
  backgroundImage: 'https://site.test/bg.jpg',
  logoImage: 'https://site.test/logo.png',
  introAudioUrl: 'https://site.test/intro.mp3',
  themeColor: 'blue',
  visualizer: 'bars',
  timezoneOffset: -6,
}
const PROGRAMS: ProgramDefinition[] = [{ id: '7', name: 'Morning Show', logoUrl: null }]
const SCHEDULE: Schedule = { monday: [{ program_id: '7', start: '08:00', end: '10:00' }] }

function read(config?: unknown, programs?: unknown, schedule?: unknown) {
  return readConfig({ config, programs, schedule } as RawGlobals)
}

describe('readConfig', () => {
  it('returns valid globals as they are', () => {
    expect(read(CONFIG, PROGRAMS, SCHEDULE)).toEqual({
      ...CONFIG,
      programs: PROGRAMS,
      schedule: SCHEDULE,
    })
  })

  it('falls back to safe defaults when the globals are missing', () => {
    expect(read()).toEqual({
      streamUrl: '',
      siteTitle: '',
      backgroundImage: undefined,
      logoImage: undefined,
      introAudioUrl: undefined,
      themeColor: 'neutral',
      visualizer: 'oscilloscope',
      timezoneOffset: 0,
      programs: undefined,
      schedule: undefined,
    })
  })

  it('turns empty strings and null media URLs into undefined', () => {
    const config = read({ ...CONFIG, backgroundImage: '', logoImage: null, introAudioUrl: '' })

    expect(config.backgroundImage).toBeUndefined()
    expect(config.logoImage).toBeUndefined()
    expect(config.introAudioUrl).toBeUndefined()
  })

  it.each(['neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink'])(
    'accepts the theme color %s',
    (themeColor) => {
      expect(read({ ...CONFIG, themeColor }).themeColor).toBe(themeColor)
    },
  )

  it.each(['teal', 'Blue', '', 42])('replaces the theme color %j with neutral', (themeColor) => {
    expect(read({ ...CONFIG, themeColor }).themeColor).toBe('neutral')
  })

  it.each(['oscilloscope', 'bars', 'particles', 'waterfall'])(
    'accepts the visualizer %s',
    (visualizer) => {
      expect(read({ ...CONFIG, visualizer }).visualizer).toBe(visualizer)
    },
  )

  it.each(['spectrum', 'Bars', ''])(
    'replaces the visualizer %j with oscilloscope',
    (visualizer) => {
      expect(read({ ...CONFIG, visualizer }).visualizer).toBe('oscilloscope')
    },
  )

  it.each([-12, -3.5, 0, 5.75, 14])('accepts the timezone offset %d', (timezoneOffset) => {
    expect(read({ ...CONFIG, timezoneOffset }).timezoneOffset).toBe(timezoneOffset)
  })

  it.each([-12.5, 14.5, Number.NaN, Infinity, '5', null])(
    'replaces the timezone offset %j with 0',
    (timezoneOffset) => {
      expect(read({ ...CONFIG, timezoneOffset }).timezoneOffset).toBe(0)
    },
  )

  it('ignores programs that are not an array', () => {
    expect(read(CONFIG, { 7: PROGRAMS[0] }, SCHEDULE).programs).toBeUndefined()
  })

  it.each([null, 'monday', 0])('ignores the schedule %j', (schedule) => {
    expect(read(CONFIG, PROGRAMS, schedule).schedule).toBeUndefined()
  })

  // PHP prints an empty schedule as `{}` (K17, ADR 0045); an older `[]` is still
  // accepted, kept as is, and every consumer reads it as a schedule without slots.
  it('keeps an empty array as the schedule', () => {
    expect(read(CONFIG, PROGRAMS, []).schedule).toEqual([])
  })

  it('returns a new object on every call', () => {
    expect(read(CONFIG)).not.toBe(read(CONFIG))
  })
})
