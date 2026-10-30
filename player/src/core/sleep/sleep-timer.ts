import { defaultClock } from 'src/core/clock/minute-ticker'
import type { Clock, TimerHandle } from 'src/core/clock/minute-ticker'

/** The interval of the countdown, in ms: it shows whole seconds */
const TICK_MS = 1000

/** What the sleep countdown needs */
export interface SleepTimerOptions {
  /** Called once when the countdown runs out (the player pauses) */
  onEnd: () => void
  /** The timers (the globals by default) */
  clock?: Clock
}

/** The sleep countdown, a store for useSyncExternalStore */
export interface SleepTimer {
  /** Starts the countdown from `seconds`, restarting it and its interval if it was running */
  start: (seconds: number) => void
  /** Stops the countdown without calling onEnd */
  cancel: () => void
  /** Tells the timer whether the stream is playing; any pause cancels it (K65) */
  setPlaying: (playing: boolean) => void
  subscribe: (listener: () => void) => () => void
  /** Seconds left, or null when no countdown is running */
  getSnapshot: () => number | null
}

/**
 * Creates the sleep countdown behind the sleep mode.
 *
 * The countdown runs against a deadline: each tick of a one-second interval works out
 * the seconds left from the clock, so held back or suspended timers do not stretch it
 * (K66, ADR 0035). The interval only runs while the countdown is active and has
 * subscribers; the first subscriber to come back catches up with the deadline.
 */
export function createSleepTimer({ onEnd, clock = defaultClock }: SleepTimerOptions): SleepTimer {
  const listeners = new Set<() => void>()
  let deadline: number | null = null
  let remainingSeconds: number | null = null
  let interval: TimerHandle | null = null

  const notify = () => listeners.forEach((listener) => listener())

  const stopInterval = () => {
    if (interval !== null) {
      clock.clearInterval(interval)
      interval = null
    }
  }

  // Rounded to the nearest second, so the drift of the interval neither skips nor
  // repeats a second.
  const secondsLeft = (end: number) => Math.round((end - clock.now()) / TICK_MS)

  const tick = () => {
    if (deadline === null) return
    const seconds = secondsLeft(deadline)
    if (seconds <= 0) {
      deadline = null
      remainingSeconds = null
      stopInterval()
      onEnd()
    } else {
      remainingSeconds = seconds
    }
    notify()
  }

  const startInterval = () => {
    stopInterval()
    if (remainingSeconds !== null && listeners.size > 0) {
      interval = clock.setInterval(tick, TICK_MS)
    }
  }

  const cancel = () => {
    if (deadline === null) return
    deadline = null
    remainingSeconds = null
    stopInterval()
    notify()
  }

  return {
    start(seconds) {
      deadline = clock.now() + seconds * TICK_MS
      remainingSeconds = seconds
      startInterval()
      notify()
    },
    cancel,
    setPlaying(playing) {
      if (!playing) cancel()
    },
    subscribe(listener) {
      listeners.add(listener)
      if (interval === null && deadline !== null) {
        // Back from no subscribers: the snapshot catches up with the deadline, silently
        // unless it has run out.
        const seconds = secondsLeft(deadline)
        if (seconds <= 0) tick()
        else remainingSeconds = seconds
      }
      if (interval === null) startInterval()

      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopInterval()
      }
    },
    getSnapshot() {
      return remainingSeconds
    },
  }
}
