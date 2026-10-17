// Characterization of use-config (spec 0002, task 1.16). The hook reads the
// window.RADPLAPAG_* globals printed by radplapag_output_clean_page() once per mount.
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import useConfig from 'src/hooks/use-config'
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

function setGlobals(config?: unknown, programs?: unknown, schedule?: unknown) {
  window.RADPLAPAG_CONFIG = config as PluginConfig
  window.RADPLAPAG_PROGRAMS = programs as ProgramDefinition[]
  window.RADPLAPAG_SCHEDULE = schedule as Schedule
}

function resolve() {
  return renderHook(() => useConfig()).result.current
}

afterEach(() => {
  delete window.RADPLAPAG_CONFIG
  delete window.RADPLAPAG_PROGRAMS
  delete window.RADPLAPAG_SCHEDULE
})

describe('useConfig', () => {
  it('returns valid globals as they are', () => {
    setGlobals(CONFIG, PROGRAMS, SCHEDULE)

    expect(resolve()).toEqual({ ...CONFIG, programs: PROGRAMS, schedule: SCHEDULE })
  })

  it('falls back to safe defaults when the globals are missing', () => {
    expect(resolve()).toEqual({
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
    setGlobals({ ...CONFIG, backgroundImage: '', logoImage: null, introAudioUrl: '' })

    const config = resolve()

    expect(config.backgroundImage).toBeUndefined()
    expect(config.logoImage).toBeUndefined()
    expect(config.introAudioUrl).toBeUndefined()
  })

  it.each(['neutral', 'blue', 'green', 'red', 'orange', 'yellow', 'purple', 'pink'])(
    'accepts the theme color %s',
    (themeColor) => {
      setGlobals({ ...CONFIG, themeColor })

      expect(resolve().themeColor).toBe(themeColor)
    },
  )

  it.each(['teal', 'Blue', '', 42])('replaces the theme color %j with neutral', (themeColor) => {
    setGlobals({ ...CONFIG, themeColor })

    expect(resolve().themeColor).toBe('neutral')
  })

  it.each(['oscilloscope', 'bars', 'particles', 'waterfall'])(
    'accepts the visualizer %s',
    (visualizer) => {
      setGlobals({ ...CONFIG, visualizer })

      expect(resolve().visualizer).toBe(visualizer)
    },
  )

  it.each(['spectrum', 'Bars', ''])(
    'replaces the visualizer %j with oscilloscope',
    (visualizer) => {
      setGlobals({ ...CONFIG, visualizer })

      expect(resolve().visualizer).toBe('oscilloscope')
    },
  )

  it.each([-12, -3.5, 0, 5.75, 14])('accepts the timezone offset %d', (timezoneOffset) => {
    setGlobals({ ...CONFIG, timezoneOffset })

    expect(resolve().timezoneOffset).toBe(timezoneOffset)
  })

  it.each([-12.5, 14.5, Number.NaN, Infinity, '5', null])(
    'replaces the timezone offset %j with 0',
    (timezoneOffset) => {
      setGlobals({ ...CONFIG, timezoneOffset })

      expect(resolve().timezoneOffset).toBe(0)
    },
  )

  it('ignores programs that are not an array', () => {
    setGlobals(CONFIG, { 7: PROGRAMS[0] }, SCHEDULE)

    expect(resolve().programs).toBeUndefined()
  })

  it.each([null, 'monday', 0])('ignores the schedule %j', (schedule) => {
    setGlobals(CONFIG, PROGRAMS, schedule)

    expect(resolve().schedule).toBeUndefined()
  })

  // PHP prints an empty schedule as `[]` (wp_json_encode of an empty array); it is
  // kept and every consumer reads it as a schedule without slots.
  it('currently keeps an empty array as the schedule', () => {
    setGlobals(CONFIG, PROGRAMS, [])

    expect(resolve().schedule).toEqual([])
  })

  it('reads the globals once per mount', () => {
    setGlobals(CONFIG)
    const { result, rerender } = renderHook(() => useConfig())

    window.RADPLAPAG_CONFIG = { ...CONFIG, siteTitle: 'Changed' }
    rerender()

    expect(result.current.siteTitle).toBe('Radio Test')
  })
})
