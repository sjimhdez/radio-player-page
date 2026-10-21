import { defaultClock } from 'src/core/clock/minute-ticker'
import type { Clock, TimerHandle } from 'src/core/clock/minute-ticker'

const TICK_MS = 1000

export interface SleepTimerOptions {
  /** Called once when the countdown runs out (the player pauses). */
  onEnd: () => void
  /** The timers (the globals by default). */
  clock?: Clock
}

export interface SleepTimer {
  /** Starts the countdown from `seconds`, restarting it and its interval if it was running. */
  start: (seconds: number) => void
  /** Stops the countdown without calling onEnd. */
  cancel: () => void
  /** Tells the timer whether the stream is playing; any pause cancels it (K65). */
  setPlaying: (playing: boolean) => void
  subscribe: (listener: () => void) => () => void
  /** Seconds left, or null when no countdown is running. */
  getSnapshot: () => number | null
}

/**
 * Creates the sleep countdown behind the sleep mode.
 *
 * Each tick of a one-second interval takes one second off, whatever the time elapsed
 * (known-issues.md K66). The interval only runs while the countdown is active and has
 * subscribers.
 *
 * @param options - onEnd and the clock
 * @returns SleepTimer
 */
export function createSleepTimer({ onEnd, clock = defaultClock }: SleepTimerOptions): SleepTimer {
  const listeners = new Set<() => void>()
  let remainingSeconds: number | null = null
  let interval: TimerHandle | null = null

  const notify = () => listeners.forEach((listener) => listener())

  const stopInterval = () => {
    if (interval !== null) {
      clock.clearInterval(interval)
      interval = null
    }
  }

  const tick = () => {
    if (remainingSeconds === null) return
    if (remainingSeconds <= 1) {
      remainingSeconds = null
      stopInterval()
      onEnd()
    } else {
      remainingSeconds -= 1
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
    if (remainingSeconds === null) return
    remainingSeconds = null
    stopInterval()
    notify()
  }

  return {
    start(seconds) {
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
