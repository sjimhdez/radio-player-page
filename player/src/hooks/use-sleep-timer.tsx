import { useEffect, useState, useSyncExternalStore } from 'react'
import { createSleepTimer } from 'src/core/sleep/sleep-timer'

export interface SleepTimerState {
  /** Seconds left, or null when no countdown is running */
  remainingSeconds: number | null
  /** Starts the countdown from `seconds`, restarting it if it was running */
  start: (seconds: number) => void
  /** Stops the countdown without calling onEnd */
  cancel: () => void
}

/**
 * Hook for the sleep countdown (src/core/sleep/sleep-timer.ts)
 *
 * Counts down against a deadline (known-issues.md K66, ADR 0035) and calls the latest onEnd
 * when it runs out. Any pause
 * (isPlaying false) cancels it (known-issues.md K65). start and cancel are stable.
 *
 * @param isPlaying - Whether the stream is playing
 * @param onEnd - Called once when the countdown runs out (the player pauses)
 * @returns SleepTimerState with remainingSeconds, start and cancel
 */
function useSleepTimer(isPlaying: boolean, onEnd: () => void): SleepTimerState {
  // The timer is created once; it calls whichever onEnd the last render passed.
  const [{ timer, setOnEnd }] = useState(() => {
    let latestOnEnd = () => {}
    return {
      timer: createSleepTimer({ onEnd: () => latestOnEnd() }),
      setOnEnd: (callback: () => void) => {
        latestOnEnd = callback
      },
    }
  })

  useEffect(() => {
    setOnEnd(onEnd)
  }, [setOnEnd, onEnd])

  useEffect(() => {
    timer.setPlaying(isPlaying)
  }, [timer, isPlaying])

  const remainingSeconds = useSyncExternalStore(timer.subscribe, timer.getSnapshot)

  return { remainingSeconds, start: timer.start, cancel: timer.cancel }
}

export default useSleepTimer
