// The sleep countdown behind useSleepTimer (spec 0006, task 3.6). The cases mirror what
// src/components/dashboard/SleepMode.test.tsx and tests/e2e/sleep.spec.ts pin today,
// K65 and K66 included.
import { describe, expect, it, vi } from 'vitest'
import { createSleepTimer } from 'src/core/sleep/sleep-timer'
import type { Clock } from 'src/core/clock/minute-ticker'
import { createFakeClock } from 'src/test/fake-clock'

const SECOND = 1000
const MINUTE = 60 * SECOND
const START = Date.UTC(2026, 9, 21, 10, 0, 0, 0)

function setup() {
  const fake = createFakeClock(START)
  const onEnd = vi.fn()
  const timer = createSleepTimer({ onEnd, clock: fake.clock })
  return { fake, onEnd, timer }
}

describe('createSleepTimer', () => {
  it('starts inactive, without a timer', () => {
    const { fake, timer } = setup()
    const unsubscribe = timer.subscribe(() => {})

    expect(timer.getSnapshot()).toBeNull()
    expect(fake.timerCount()).toBe(0)
    unsubscribe()
  })

  it('counts down one second per tick and notifies the subscribers', () => {
    const { fake, timer } = setup()
    const listener = vi.fn()
    timer.subscribe(listener)

    timer.start(30 * 60)
    expect(timer.getSnapshot()).toBe(1800)
    expect(listener).toHaveBeenCalledTimes(1)

    fake.advance(SECOND - 1)
    expect(timer.getSnapshot()).toBe(1800)
    fake.advance(1)
    expect(timer.getSnapshot()).toBe(1799)
    fake.advance(9 * SECOND)
    expect(timer.getSnapshot()).toBe(1790)
    expect(listener).toHaveBeenCalledTimes(11)
  })

  it('calls onEnd once on the tick that finds 1 left and goes back to null', () => {
    const { fake, onEnd, timer } = setup()
    timer.subscribe(() => {})

    timer.start(3)
    fake.advance(2 * SECOND)
    expect(timer.getSnapshot()).toBe(1)
    expect(onEnd).not.toHaveBeenCalled()

    fake.advance(SECOND)
    expect(timer.getSnapshot()).toBeNull()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(fake.timerCount()).toBe(0)

    fake.advance(5 * SECOND)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('restarts the countdown and the interval on start()', () => {
    const { fake, timer } = setup()
    timer.subscribe(() => {})

    timer.start(30 * 60)
    fake.advance(SECOND + 500)
    expect(timer.getSnapshot()).toBe(1799)

    timer.start(60 * 60)
    expect(timer.getSnapshot()).toBe(3600)
    expect(fake.timerCount()).toBe(1)
    fake.advance(SECOND - 1)
    expect(timer.getSnapshot()).toBe(3600)
    fake.advance(1)
    expect(timer.getSnapshot()).toBe(3599)
  })

  it('cancels without calling onEnd', () => {
    const { fake, onEnd, timer } = setup()
    const listener = vi.fn()
    timer.subscribe(listener)

    timer.start(30 * 60)
    timer.cancel()
    expect(timer.getSnapshot()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(fake.timerCount()).toBe(0)

    fake.advance(60 * MINUTE)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('cancels on setPlaying(false) while active, without calling onEnd', () => {
    const { fake, onEnd, timer } = setup()
    const listener = vi.fn()
    timer.subscribe(listener)

    timer.setPlaying(true)
    timer.start(30 * 60)
    timer.setPlaying(true)
    expect(timer.getSnapshot()).toBe(1800)

    timer.setPlaying(false)
    expect(timer.getSnapshot()).toBeNull()
    expect(fake.timerCount()).toBe(0)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('does not notify on setPlaying(false) or cancel() while inactive', () => {
    const { timer } = setup()
    const listener = vi.fn()
    timer.subscribe(listener)

    timer.setPlaying(false)
    timer.cancel()
    expect(listener).not.toHaveBeenCalled()
  })

  it('currently cancels on any setPlaying(false), also the welcome handing over to the live stream (K65)', () => {
    // The welcome audio ends with pause before ended: the status goes through paused
    // while the live stream loads, and that counts as a pause.
    const { onEnd, timer } = setup()
    timer.subscribe(() => {})

    timer.setPlaying(true)
    timer.start(30 * 60)
    timer.setPlaying(false)
    timer.setPlaying(true)
    expect(timer.getSnapshot()).toBeNull()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('currently counts interval ticks, not elapsed time (K66)', () => {
    // 29 minutes go by with the timers held back (a suspended page), then one tick.
    const fake = createFakeClock(START)
    let skipped = 0
    const clock: Clock = { ...fake.clock, now: () => fake.clock.now() + skipped }
    const timer = createSleepTimer({ onEnd: () => {}, clock })
    timer.subscribe(() => {})

    timer.start(30 * 60)
    skipped = 29 * MINUTE
    fake.advance(SECOND)
    expect(timer.getSnapshot()).toBe(1799)
  })

  it('keeps the same snapshot between ticks', () => {
    const { fake, timer } = setup()
    timer.subscribe(() => {})

    timer.start(30 * 60)
    const first = timer.getSnapshot()
    expect(timer.getSnapshot()).toBe(first)
    fake.advance(SECOND - 1)
    expect(timer.getSnapshot()).toBe(first)
  })

  it('keeps a single interval while active and subscribed, and stops it with the last unsubscribe', () => {
    const { fake, timer } = setup()
    const unsubscribeFirst = timer.subscribe(() => {})
    const unsubscribeSecond = timer.subscribe(() => {})

    timer.start(30 * 60)
    expect(fake.timerCount()).toBe(1)
    fake.advance(5 * SECOND)
    expect(fake.timerCount()).toBe(1)

    unsubscribeFirst()
    expect(fake.timerCount()).toBe(1)
    unsubscribeSecond()
    expect(fake.timerCount()).toBe(0)
    fake.advance(MINUTE)
    expect(timer.getSnapshot()).toBe(1795)
  })

  it('starts the interval with the first subscriber when start() came before', () => {
    const { fake, timer } = setup()

    timer.start(30 * 60)
    expect(fake.timerCount()).toBe(0)
    const unsubscribe = timer.subscribe(() => {})
    expect(fake.timerCount()).toBe(1)
    fake.advance(SECOND)
    expect(timer.getSnapshot()).toBe(1799)
    unsubscribe()
  })

  it('leaves a single interval after subscribe, unsubscribe and subscribe again (StrictMode)', () => {
    const { fake, timer } = setup()
    const listener = vi.fn()

    timer.start(30 * 60)
    timer.subscribe(listener)()
    expect(fake.timerCount()).toBe(0)
    const unsubscribe = timer.subscribe(listener)
    expect(fake.timerCount()).toBe(1)

    fake.advance(3 * SECOND)
    expect(timer.getSnapshot()).toBe(1797)
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
  })

  it('does not notify a listener after it unsubscribes', () => {
    const { fake, timer } = setup()
    const gone = vi.fn()
    const kept = vi.fn()
    const unsubscribeGone = timer.subscribe(gone)
    timer.subscribe(kept)

    unsubscribeGone()
    unsubscribeGone()
    timer.start(30 * 60)
    fake.advance(SECOND)
    expect(gone).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledTimes(2)
  })

  it('uses the global timers by default', () => {
    vi.useFakeTimers()
    try {
      const onEnd = vi.fn()
      const timer = createSleepTimer({ onEnd })
      const unsubscribe = timer.subscribe(() => {})

      timer.start(2)
      expect(vi.getTimerCount()).toBe(1)
      vi.advanceTimersByTime(2 * SECOND)
      expect(onEnd).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(0)
      unsubscribe()
    } finally {
      vi.useRealTimers()
    }
  })
})
