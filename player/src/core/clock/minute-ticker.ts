const MINUTE_MS = 60000

export type TimerHandle = ReturnType<typeof setTimeout>

/**
 * The time source and timers the ticker uses, injected so tests can drive them.
 */
export interface Clock {
  now: () => number
  setTimeout: (callback: () => void, ms: number) => TimerHandle
  clearTimeout: (handle: TimerHandle) => void
  setInterval: (callback: () => void, ms: number) => TimerHandle
  clearInterval: (handle: TimerHandle) => void
}

/**
 * The global clock. Each call looks the global up, so vi.useFakeTimers() still applies.
 */
export const defaultClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle),
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle),
}

export interface MinuteTicker {
  /**
   * Calls onTick at the start of every minute until the returned stop() is called.
   * Only one timer is alive at a time; stop() is idempotent.
   */
  start: (onTick: () => void) => () => void
}

/**
 * Creates a ticker aligned to the system minute: the first tick fires at the next :00
 * (right away on an exact minute), then every 60 seconds.
 *
 * @param clock - The time source and timers (the globals by default)
 * @returns MinuteTicker
 */
export function createMinuteTicker(clock: Clock = defaultClock): MinuteTicker {
  return {
    start(onTick) {
      let timeout: TimerHandle | null = null
      let interval: TimerHandle | null = null

      const msIntoMinute = clock.now() % MINUTE_MS
      const delay = msIntoMinute === 0 ? 0 : MINUTE_MS - msIntoMinute
      timeout = clock.setTimeout(() => {
        timeout = null
        onTick()
        interval = clock.setInterval(onTick, MINUTE_MS)
      }, delay)

      return () => {
        if (timeout !== null) {
          clock.clearTimeout(timeout)
          timeout = null
        }
        if (interval !== null) {
          clock.clearInterval(interval)
          interval = null
        }
      }
    },
  }
}

/**
 * An external store for useSyncExternalStore.
 */
export interface MinuteStore<T> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => T
}

/**
 * Creates a store whose value is recomputed at the start of every minute.
 *
 * The first getSnapshot() computes the value without a timer and caches it, so the
 * reference stays the same until the next tick. The ticker starts with the first
 * subscriber and stops with the last one; if the cached value is from an earlier
 * minute by then (render and commit on both sides of :00, or a while without
 * subscribers), it is recomputed and the subscribers are notified.
 *
 * @param compute - Computes the value for the current time
 * @param clock - The time source and timers (the globals by default)
 * @returns MinuteStore
 */
export function createMinuteStore<T>(
  compute: () => T,
  clock: Clock = defaultClock,
): MinuteStore<T> {
  const ticker = createMinuteTicker(clock)
  const listeners = new Set<() => void>()
  let snapshot: { value: T; minute: number } | null = null
  let stop: (() => void) | null = null

  const currentMinute = () => Math.floor(clock.now() / MINUTE_MS)
  const recompute = () => (snapshot = { value: compute(), minute: currentMinute() })
  const tick = () => {
    recompute()
    listeners.forEach((listener) => listener())
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (stop === null) {
        if (snapshot !== null && snapshot.minute !== currentMinute()) tick()
        stop = ticker.start(tick)
      }

      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && stop !== null) {
          stop()
          stop = null
        }
      }
    },
    getSnapshot() {
      return (snapshot ?? recompute()).value
    },
  }
}
