// A fake Clock (src/core/clock/minute-ticker.ts) for the core tests: time only moves
// when the test calls advance(), and every due timer fires in order on the way.
import type { Clock, TimerHandle } from 'src/core/clock/minute-ticker'

interface FakeTimer {
  callback: () => void
  at: number
  every: number | null
}

/**
 * A clock that only moves when the test calls advance().
 */
export function createFakeClock(start: number) {
  let time = start
  let nextId = 1
  const timers = new Map<number, FakeTimer>()

  const add = (callback: () => void, ms: number, every: number | null): TimerHandle => {
    const id = nextId++
    timers.set(id, { callback, at: time + ms, every })
    return id as unknown as TimerHandle
  }
  const remove = (handle: TimerHandle) => {
    timers.delete(handle as unknown as number)
  }

  const clock: Clock = {
    now: () => time,
    setTimeout: (callback, ms) => add(callback, ms, null),
    clearTimeout: remove,
    setInterval: (callback, ms) => add(callback, ms, ms),
    clearInterval: remove,
  }

  return {
    clock,
    timerCount: () => timers.size,
    /** Moves the time forward, firing every due timer in order. */
    advance(ms: number) {
      const end = time + ms
      for (;;) {
        let dueId: number | null = null
        let due: FakeTimer | null = null
        for (const [id, timer] of timers) {
          if (timer.at <= end && (due === null || timer.at < due.at)) {
            dueId = id
            due = timer
          }
        }
        if (dueId === null || due === null) break
        time = due.at
        if (due.every === null) timers.delete(dueId)
        else due.at += due.every
        due.callback()
      }
      time = end
    },
  }
}
