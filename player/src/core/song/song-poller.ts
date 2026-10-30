import { defaultClock, type Clock, type TimerHandle } from 'src/core/clock/minute-ticker'
import { type FetchLike, type MethodResult, type SongMethod } from 'src/core/song/request'

/** Whether the page is visible, and its changes (document.visibilityState in the player) */
export interface Visibility {
  isVisible: () => boolean
  subscribe: (listener: () => void) => () => void
}

/**
 * A source of the current song: a store for useSyncExternalStore, told by the player
 * whether the live stream plays.
 */
export interface SongStore {
  subscribe: (listener: () => void) => () => void
  /** The song, or null */
  getSnapshot: () => string | null
  /** Tells whether the live stream plays; idempotent */
  setPlaying: (playing: boolean) => void
}

/** A method and how long to wait between its lookups */
export interface PolledMethod {
  lookUp: SongMethod
  intervalMs: number
}

/**
 * Creates the poller of the current song (ADR 0068, ADR 0069). It asks only while the
 * live stream plays, the page is visible and someone is subscribed; then it looks up at
 * once and again after the interval of the method in use.
 *
 * The methods are tried in order: a method that fails before it has ever answered is
 * dropped for good (for this page load) and the next one is asked at once; without any
 * left, it stops. A method that has answered stays: a later failure is only no song
 * until its next lookup, so a glitch never moves it to the next method (ICY counts as
 * a listener).
 *
 * Stopping (a pause, an error, a hidden page, the last unsubscribe) aborts the lookup in
 * flight, whose result is then ignored, cancels the timer and clears the song.
 *
 * @param options.methods - The methods, in order (none: never asks)
 * @param options.clock - Timers (the global ones by default)
 * @param options.pageProtocol - Passed to the methods ('https:')
 */
export function createSongPoller({
  methods,
  fetch,
  clock = defaultClock,
  visibility,
  pageProtocol,
}: {
  methods: readonly PolledMethod[]
  fetch: FetchLike
  clock?: Clock
  visibility: Visibility
  pageProtocol: string
}): SongStore {
  const listeners = new Set<() => void>()
  let song: string | null = null
  let playing = false
  let index = 0
  // Whether the method in use has answered at least once: then it is never dropped.
  let answered = false
  let inFlight: AbortController | null = null
  let timer: TimerHandle | null = null
  let stopVisibility: (() => void) | null = null

  const publish = (next: string | null) => {
    if (next === song) return
    song = next
    listeners.forEach((listener) => listener())
  }

  const isActive = () => playing && listeners.size > 0 && visibility.isVisible()

  const stop = () => {
    inFlight?.abort()
    inFlight = null
    if (timer !== null) clock.clearTimeout(timer)
    timer = null
    publish(null)
  }

  const lookUp = () => {
    timer = null
    const method = methods[index]
    if (method === undefined || inFlight !== null) return
    const controller = new AbortController()
    inFlight = controller
    void method.lookUp({ fetch, signal: controller.signal, pageProtocol }).then((result) => {
      if (controller.signal.aborted) return
      inFlight = null
      settle(method, result)
    })
  }

  const settle = (method: PolledMethod, result: MethodResult) => {
    if ('failed' in result) {
      if (!answered) {
        index += 1
        lookUp()
        return
      }
      publish(null)
    } else {
      answered = true
      publish(result.song)
    }
    timer = clock.setTimeout(lookUp, method.intervalMs)
  }

  const update = () => {
    if (!isActive()) stop()
    else if (inFlight === null && timer === null) lookUp()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      if (stopVisibility === null) {
        stopVisibility = visibility.subscribe(update)
        update()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && stopVisibility !== null) {
          stopVisibility()
          stopVisibility = null
          stop()
        }
      }
    },
    getSnapshot: () => song,
    setPlaying(value) {
      playing = value
      update()
    },
  }
}
