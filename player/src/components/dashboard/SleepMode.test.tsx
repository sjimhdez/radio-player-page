// Audit of zone 5 (spec 0002, task 4.6): the sleep timer countdown.
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import 'src/config/i18n'
import SleepMode from 'src/components/dashboard/SleepMode'

/** Holds the remaining seconds like the dashboard does. */
function Host() {
  const [seconds, setSeconds] = useState<number | null>(null)
  return (
    <>
      <output>{String(seconds)}</output>
      <SleepMode
        isPlaying
        onSleepTimerEnd={() => {}}
        onTimerChange={setSeconds}
        externalTimerSeconds={seconds}
      />
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
