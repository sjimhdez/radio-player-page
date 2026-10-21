// Audit of zone 5 (spec 0002, task 4.6): the sleep timer countdown.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import 'src/config/i18n'
import SleepMode from 'src/components/dashboard/SleepMode'
import useSleepTimer from 'src/hooks/use-sleep-timer'

/** Runs the sleep timer like the dashboard does. */
function Host() {
  const { remainingSeconds, start } = useSleepTimer(true, () => {})
  return (
    <>
      <output>{String(remainingSeconds)}</output>
      <SleepMode isPlaying onSelect={(minutes) => start(minutes * 60)} />
    </>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

it('currently counts interval ticks, not elapsed time (K66)', () => {
  render(<Host />)
  fireEvent.click(screen.getByRole('button', { name: 'Sleep mode' }))
  fireEvent.click(screen.getByRole('menuitem', { name: '30 mins' }))

  // 29 minutes go by with the timers held back (a suspended page), then one tick.
  vi.setSystemTime(Date.now() + 29 * 60 * 1000)
  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.getByRole('status').textContent).toBe('1799')
})
