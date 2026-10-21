// The minute ticker and store behind useProgramSchedule and useTransmissionTime (spec 0006,
// task 1.4). The cases mirror what src/hooks/use-program-schedule.test.tsx and
// use-transmission-time.test.tsx pin today: alignment, one live timer, none after unmount.
import { describe, expect, it, vi } from 'vitest'
import { createMinuteStore, createMinuteTicker } from 'src/core/clock/minute-ticker'
import { createFakeClock } from 'src/test/fake-clock'

const MINUTE = 60000
// 2026-10-21 10:00:00.000 UTC, an exact minute.
const EXACT_MINUTE = Date.UTC(2026, 9, 21, 10, 0, 0, 0)

describe('createMinuteTicker', () => {
  it('ticks right away (delay 0) when started on an exact minute', () => {
    const fake = createFakeClock(EXACT_MINUTE)
    const onTick = vi.fn()
    createMinuteTicker(fake.clock).start(onTick)

    expect(onTick).not.toHaveBeenCalled()
    fake.advance(0)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('aligns the first tick to the next minute, then ticks every minute', () => {
    const fake = createFakeClock(EXACT_MINUTE + 15000)
    const onTick = vi.fn()
    createMinuteTicker(fake.clock).start(onTick)

    fake.advance(44999)
    expect(onTick).not.toHaveBeenCalled()
    fake.advance(1)
    expect(onTick).toHaveBeenCalledTimes(1)
    expect(fake.clock.now() % MINUTE).toBe(0)

    fake.advance(MINUTE - 1)
    expect(onTick).toHaveBeenCalledTimes(1)
    fake.advance(1)
    expect(onTick).toHaveBeenCalledTimes(2)
    fake.advance(3 * MINUTE)
    expect(onTick).toHaveBeenCalledTimes(5)
  })

  it('keeps a single live timer before and after the first tick', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    createMinuteTicker(fake.clock).start(() => {})

    expect(fake.timerCount()).toBe(1)
    fake.advance(30000)
    expect(fake.timerCount()).toBe(1)
    fake.advance(5 * MINUTE)
    expect(fake.timerCount()).toBe(1)
  })

  it('leaves no timers after stop, before or after the first tick', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const ticker = createMinuteTicker(fake.clock)

    const stopBefore = ticker.start(() => {})
    stopBefore()
    expect(fake.timerCount()).toBe(0)

    const onTick = vi.fn()
    const stopAfter = ticker.start(onTick)
    fake.advance(30000)
    stopAfter()
    expect(fake.timerCount()).toBe(0)
    fake.advance(5 * MINUTE)
    expect(onTick).toHaveBeenCalledTimes(1)
  })

  it('makes stop idempotent', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const clearTimeout = vi.spyOn(fake.clock, 'clearTimeout')
    const stop = createMinuteTicker(fake.clock).start(() => {})

    stop()
    stop()
    expect(clearTimeout).toHaveBeenCalledTimes(1)
    expect(fake.timerCount()).toBe(0)
  })

  it('uses the global timers by default', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(EXACT_MINUTE + 59000)
      const onTick = vi.fn()
      const stop = createMinuteTicker().start(onTick)

      expect(vi.getTimerCount()).toBe(1)
      vi.advanceTimersByTime(1000)
      expect(onTick).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(MINUTE)
      expect(onTick).toHaveBeenCalledTimes(2)
      expect(vi.getTimerCount()).toBe(1)
      stop()
      expect(vi.getTimerCount()).toBe(0)

      createMinuteTicker().start(onTick)()
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('createMinuteStore', () => {
  it('computes the first snapshot without starting a timer', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const compute = vi.fn(() => ({ minute: fake.clock.now() }))
    const store = createMinuteStore(compute, fake.clock)

    expect(compute).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toEqual({ minute: EXACT_MINUTE + 30000 })
    expect(compute).toHaveBeenCalledTimes(1)
    expect(fake.timerCount()).toBe(0)
  })

  it('returns the same reference between ticks', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const store = createMinuteStore(() => ({ minute: fake.clock.now() }), fake.clock)
    const unsubscribe = store.subscribe(() => {})

    const first = store.getSnapshot()
    fake.advance(29999)
    expect(store.getSnapshot()).toBe(first)

    fake.advance(1)
    const second = store.getSnapshot()
    expect(second).not.toBe(first)
    expect(second).toEqual({ minute: EXACT_MINUTE + MINUTE })
    fake.advance(MINUTE - 1)
    expect(store.getSnapshot()).toBe(second)
    unsubscribe()
  })

  it('recomputes on every tick and notifies every subscriber', () => {
    const fake = createFakeClock(EXACT_MINUTE)
    const compute = vi.fn(() => fake.clock.now())
    const store = createMinuteStore(compute, fake.clock)
    const first = vi.fn()
    const second = vi.fn()
    store.subscribe(first)
    store.subscribe(second)

    fake.advance(0)
    expect(compute).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe(EXACT_MINUTE)

    fake.advance(2 * MINUTE)
    expect(compute).toHaveBeenCalledTimes(3)
    expect(first).toHaveBeenCalledTimes(3)
    expect(store.getSnapshot()).toBe(EXACT_MINUTE + 2 * MINUTE)
  })

  it('starts the ticker with the first subscriber and stops it with the last', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const store = createMinuteStore(() => 0, fake.clock)

    const unsubscribeFirst = store.subscribe(() => {})
    expect(fake.timerCount()).toBe(1)
    const unsubscribeSecond = store.subscribe(() => {})
    expect(fake.timerCount()).toBe(1)

    unsubscribeFirst()
    expect(fake.timerCount()).toBe(1)
    unsubscribeSecond()
    expect(fake.timerCount()).toBe(0)
  })

  it('leaves a single timer after subscribe, unsubscribe and subscribe again (StrictMode)', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const store = createMinuteStore(() => 0, fake.clock)
    const listener = vi.fn()

    store.subscribe(listener)()
    expect(fake.timerCount()).toBe(0)
    const unsubscribe = store.subscribe(listener)
    expect(fake.timerCount()).toBe(1)

    fake.advance(30000 + 2 * MINUTE)
    expect(listener).toHaveBeenCalledTimes(3)
    expect(fake.timerCount()).toBe(1)
    unsubscribe()
    expect(fake.timerCount()).toBe(0)
  })

  it('keeps the first snapshot when the first subscriber arrives in the same minute', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const compute = vi.fn(() => ({ minute: fake.clock.now() }))
    const store = createMinuteStore(compute, fake.clock)
    const listener = vi.fn()

    const first = store.getSnapshot()
    fake.advance(29999)
    const unsubscribe = store.subscribe(listener)
    expect(store.getSnapshot()).toBe(first)
    expect(compute).toHaveBeenCalledTimes(1)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('recomputes when the first subscriber arrives in a later minute than the snapshot', () => {
    // Render at :59.999, commit at :00.001: without this, the value stays a minute
    // behind until the next tick.
    const fake = createFakeClock(EXACT_MINUTE + MINUTE - 1)
    const store = createMinuteStore(() => ({ minute: fake.clock.now() }), fake.clock)
    const listener = vi.fn()

    store.getSnapshot()
    fake.advance(2)
    const unsubscribe = store.subscribe(listener)
    expect(store.getSnapshot()).toEqual({ minute: EXACT_MINUTE + MINUTE + 1 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(fake.timerCount()).toBe(1)
    unsubscribe()
  })

  it('recomputes when it is subscribed again after a minute without subscribers', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const store = createMinuteStore(() => ({ minute: fake.clock.now() }), fake.clock)

    store.subscribe(() => {})()
    store.getSnapshot()
    fake.advance(MINUTE)
    const unsubscribe = store.subscribe(() => {})
    expect(store.getSnapshot()).toEqual({ minute: EXACT_MINUTE + MINUTE + 30000 })
    unsubscribe()
  })

  it('does not notify a listener after it unsubscribes', () => {
    const fake = createFakeClock(EXACT_MINUTE + 30000)
    const store = createMinuteStore(() => 0, fake.clock)
    const gone = vi.fn()
    const kept = vi.fn()
    const unsubscribeGone = store.subscribe(gone)
    store.subscribe(kept)

    unsubscribeGone()
    unsubscribeGone()
    fake.advance(30000)
    expect(gone).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledTimes(1)
    expect(fake.timerCount()).toBe(1)
  })
})
