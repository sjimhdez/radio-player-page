// Accessibility findings of the review before the 3.5.0 release, pinned as they are.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import 'src/config/i18n'
import AllProgramsModal from 'src/components/AllProgramsModal'
import ScheduleModal from 'src/components/ScheduleModal'
import VolumeControl from 'src/components/VolumeControl'
import type { PluginConfig, ProgramDefinition, Schedule } from 'src/types/global'

const PROGRAMS: ProgramDefinition[] = [
  { id: '1', name: 'Morning Show', extendedDescription: 'About the morning.' },
  { id: '2', name: 'News', extendedDescription: 'About the news.' },
]
// 2026-10-19 is a Monday; at 08:30 UTC the Morning Show is live.
const SCHEDULE: Schedule = {
  monday: [
    { program_id: '1', start: '08:00', end: '09:00' },
    { program_id: '2', start: '09:00', end: '10:00' },
  ],
}

const noop = () => {}

/** Asks for less motion, as the system setting does */
function preferReducedMotion() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addEventListener: noop,
        removeEventListener: noop,
        addListener: noop,
        removeListener: noop,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
}

/** Opens a modal and lets its transition end, which scrolls to the live program */
function openModal(modal: React.ReactElement) {
  render(modal)
  act(() => {
    vi.advanceTimersByTime(1000)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T08:30:00Z'))
  window.RADPLAPAG_CONFIG = { streamUrl: '', siteTitle: '', timezoneOffset: 0 } as PluginConfig
  window.RADPLAPAG_PROGRAMS = PROGRAMS
  window.RADPLAPAG_SCHEDULE = SCHEDULE
})

afterEach(() => {
  vi.useRealTimers()
  delete window.RADPLAPAG_CONFIG
  delete window.RADPLAPAG_PROGRAMS
  delete window.RADPLAPAG_SCHEDULE
})

describe('AllProgramsModal headings (R-a11y-6)', () => {
  it('currently repeats Broadcast Times as the only heading of each program', () => {
    openModal(<AllProgramsModal open onClose={noop} />)

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Broadcast Times',
      'Broadcast Times',
    ])
    expect(screen.queryByRole('heading', { name: 'Morning Show' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'News' })).toBeNull()
  })

  it('currently names every Show more button the same', () => {
    openModal(<AllProgramsModal open onClose={noop} />)

    expect(screen.getAllByRole('button', { name: 'Show more' })).toHaveLength(2)
  })
})

describe('smooth scrolling with reduced motion (R-a11y-7)', () => {
  let scrollIntoView: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    preferReducedMotion()
    scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(noop)
  })

  it('currently scrolls the schedule smoothly to the live program', () => {
    openModal(<ScheduleModal open onClose={noop} />)

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('currently scrolls the schedule smoothly back to the top', () => {
    const scrollTo = vi.spyOn(Element.prototype, 'scrollTo').mockImplementation(noop)
    openModal(<ScheduleModal open onClose={noop} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('currently scrolls the programs smoothly to the live one', () => {
    openModal(<AllProgramsModal open onClose={noop} />)

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })
})

// The names of the dialogs are pinned in tests/e2e/player-a11y.spec.ts instead:
// dom-accessibility-api leaves out the aria-label of the Close button.
describe('minor findings (R-a11y-8 b)', () => {
  it('currently gives the volume no text value (b)', () => {
    render(<VolumeControl volume={0.37} controllable onVolumeChange={noop} />)

    const slider = screen.getByRole('slider', { name: 'Volume' })
    expect(slider.getAttribute('aria-valuenow')).toBe('0.37')
    expect(slider.hasAttribute('aria-valuetext')).toBe(false)
  })
})
