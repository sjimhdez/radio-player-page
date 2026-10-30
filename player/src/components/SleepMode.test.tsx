// The sleep timer countdown, found by the audit of the player.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import 'src/config/i18n'
import SleepMode from 'src/components/SleepMode'
import useSleepTimer from 'src/hooks/use-sleep-timer'

/** Runs the sleep timer like the player page does */
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

it('counts against a deadline when the ticks are held back (K66)', () => {
  render(<Host />)
  fireEvent.click(screen.getByRole('button', { name: 'Sleep Timer' }))
  fireEvent.click(screen.getByRole('menuitem', { name: '30 minutes' }))

  // 29 minutes go by with the timers held back (a suspended page), then one tick.
  vi.setSystemTime(Date.now() + 29 * 60 * 1000)
  act(() => {
    vi.advanceTimersByTime(1000)
  })

  expect(screen.getByRole('status').textContent).toBe('59')
})
