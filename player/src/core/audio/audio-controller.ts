import { defaultClock, type Clock, type TimerHandle } from 'src/core/clock/minute-ticker'
import { errorReason, type ErrorReason } from 'src/core/audio/error-reason'
import {
  initialPlayerState,
  transition,
  type PlayerEvent,
  type PlayerState,
} from 'src/core/audio/player-machine'
import { isIOSDevice, type Platform } from 'src/core/audio/platform'
import { detectProtocol } from 'src/core/audio/protocol'
import { createDashSource } from 'src/core/audio/sources/dash'
import { createDirectSource } from 'src/core/audio/sources/direct'
import { createHlsSource } from 'src/core/audio/sources/hls'
import type { AudioSource, DashMediaPlayer, HlsClass } from 'src/core/audio/sources/types'
import { isVolumeControllable } from 'src/core/audio/volume'
import { createVisualizerGraph, type VisualizerGraphOptions } from 'src/core/audio/web-audio'

/** Loaders of the streaming libraries; the dynamic imports of the sources by default */
export interface StreamingLoaders {
  loadHls?: () => Promise<HlsClass>
  loadDash?: () => Promise<DashMediaPlayer>
}

/**
 * How long the live stream may play without advancing before it counts as cut, and
 * how long an attempt to reconnect may take to play (ADR 0061).
 */
export const STALL_MS = 8000

/**
 * How often the progress of the live stream is read, in ms: often enough to notice a
 * stall well within STALL_MS.
 */
const WATCH_INTERVAL_MS = 1000

/** The waits before each attempt to reconnect the live stream: six, ~1 min (ADR 0061) */
export const RECONNECT_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 15000, 30000]

/** The times of the reconnection, injected so tests can shorten them */
export interface ReconnectOptions {
  stallMs: number
  delaysMs: readonly number[]
}

/** What a play() loads */
export interface PlayOptions {
  /** URL of the live stream */
  streamUrl: string
  /** Welcome audio URL, played once per controller before the live stream */
  introUrl?: string | null
}

/** The audio controller that useAudioPlayer() adapts */
export interface AudioController {
  /** Adds a listener called on every change of the snapshot; returns its unsubscribe */
  subscribe: (listener: () => void) => () => void
  /** The current state; the same reference until something changes */
  getSnapshot: () => PlayerState
  /** Listens to audio and applies the volume, if it can be changed; idempotent */
  attach: (audio: HTMLAudioElement) => void
  /** Stops listening to the attached element; idempotent */
  detach: () => void
  /** Destroys the current source and cancels the reconnection (ADR 0061) */
  dispose: () => void
  /**
   * Starts the welcome audio or loads the live stream. After a pause, an error or a
   * stream change it reloads the live stream, back to the live edge (ADR 0032); while
   * that stream plays, it does nothing. While a play() is pending, the next one
   * returns its promise, until a pause() (K80). A load cancels the
   * reconnection in progress (ADR 0061).
   */
  play: (options: PlayOptions) => Promise<void>
  /**
   * Pauses playback, except the welcome audio. It cancels a pending play(): the load
   * in progress is destroyed and its outcome, an AbortError included, is ignored, so
   * the next play() starts anew (K81, K11, ADR 0034). It cancels the reconnection in
   * progress too (ADR 0061).
   */
  pause: () => void
  /** Sets the volume (0-1); ignored if it cannot be changed */
  setVolume: (volume: number) => void
  /** The analyser of the Web Audio graph; null until the element is connected */
  getAnalyser: () => AnalyserNode | null
}

/**
 * The events of the element the controller listens to. The 3.4.2 hook had seven
 * listeners; its two on 'playing' are one machine event here.
 */
const AUDIO_EVENTS = ['playing', 'pause', 'error', 'canplay', 'waiting', 'ended'] as const

/**
 * Creates the audio controller: runs the effects of useAudioPlayer() (src, play(),
 * hls.js, dashjs, volume) and publishes the state of player-machine as a snapshot.
 *
 * Whether the device is iOS, for native HLS, is decided once, when it is created, from
 * the platform it is given (K13, ADR 0036). When the welcome audio ends, the live
 * stream is loaded with the options of the play() that started it.
 *
 * Whether the volume can be changed is decided once, when it is created: never on iOS,
 * elsewhere by probing an element of its own; it is published in the first snapshot
 * (K13, K108, ADR 0036 and 0056).
 *
 * A direct source that fails is retried once without crossOrigin, unless the element
 * goes through the Web Audio graph: then it is an error (ADR 0033). While the live
 * stream starts, an error of the element is not published: the outcome of its play()
 * decides (K83).
 *
 * The Web Audio context is created or resumed synchronously in play(), inside the
 * gesture. When the element starts playing the live stream from a source clean of
 * CORS, it is connected to the graph (only the first time) and canVisualize turns
 * true; the welcome audio never is (K82, ADR 0031).
 *
 * Once the live stream has played, a cut (an error or the end of the element) reloads
 * it after each of reconnect.delaysMs in turn, with the loading UI and without
 * publishing the error, pause or ended of the element; an attempt that does not play
 * within reconnect.stallMs fails, one that plays restarts the count, and after the last
 * the error is published (ADR 0061). The welcome audio and a live stream that has
 * not played yet never reconnect. A cut is also a fatal error of hls.js or dashjs, and
 * a live stream from a source without Media Source whose currentTime does not advance
 * for reconnect.stallMs while it should play (Chromium and WebKit stall without an
 * error).
 *
 * @param options.loaders - Loaders of hls.js and dashjs (dynamic imports by default)
 * @param options.webAudio - Context factory and user agent (no Web Audio by default)
 * @param options.platform - User agent and touch points (not iOS by default)
 * @param options.volumeProbe - Creates the element that probes the volume (controllable
 *   without it)
 * @param options.clock - Timers of the reconnection (the global ones by default)
 * @param options.reconnect - Times of the reconnection (STALL_MS and RECONNECT_DELAYS_MS)
 * @param options.pageProtocol - The protocol of the page ('https:'), to tell mixed content
 *   in the reason of an error, which is published with it (ADR 0065)
 */
export function createAudioController({
  loaders = {},
  webAudio = { userAgent: '' },
  platform = { userAgent: '', maxTouchPoints: 0 },
  volumeProbe,
  clock = defaultClock,
  reconnect = { stallMs: STALL_MS, delaysMs: RECONNECT_DELAYS_MS },
  pageProtocol = '',
}: {
  loaders?: StreamingLoaders
  webAudio?: VisualizerGraphOptions
  platform?: Platform
  volumeProbe?: () => HTMLMediaElement
  clock?: Clock
  reconnect?: ReconnectOptions
  pageProtocol?: string
} = {}): AudioController {
  const graph = createVisualizerGraph(webAudio)
  const isIOS = isIOSDevice(platform.userAgent, platform.maxTouchPoints)
  const listeners = new Set<() => void>()
  // iOS 18 reads a volume write back at once and undoes it later, so the probe
  // alone is not enough there (K108, ADR 0056).
  let state =
    !isIOS && (volumeProbe === undefined || isVolumeControllable(volumeProbe()))
      ? initialPlayerState
      : { ...initialPlayerState, volumeControllable: false }
  let audio: HTMLAudioElement | null = null
  let source: AudioSource | null = null
  // The options of the play() that started the welcome audio, for 'ended'.
  let introOptions: PlayOptions | null = null
  // The pending play(), returned to the calls made before it settles (K80).
  let pendingPlay: Promise<void> | null = null
  // Whether the play() of the welcome audio is pending: its catch handles an error.
  let introStarting = false
  // Bumped by pause(): what an earlier play() reports afterwards is ignored (ADR 0034).
  let generation = 0
  // The URL of the loaded live stream; with hls.js and dashjs audio.src is a blob:.
  let liveUrl: string | null = null
  // Whether the start() of the live stream is pending, and whether it deferred an error
  // of the element: its outcome decides, so the retry without crossOrigin publishes no
  // error (K83).
  let liveStarting = false
  let errorDeferred = false
  // Whether the loaded live stream has played: from then on a cut reconnects (ADR 0061).
  let armed = false
  // Whether a reconnection is in progress, how many attempts it has made, and the
  // timer of the next one.
  let reconnecting = false
  let attempts = 0
  let reconnectTimer: TimerHandle | null = null
  // The watch of the progress of the live stream, and its last progress: the time of the
  // element and when it was read (ADR 0061).
  let watchTimer: TimerHandle | null = null
  let lastTime = 0
  let lastProgressAt = 0

  const dispatch = (event: PlayerEvent) => {
    const next = transition(state, event)
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener())
  }

  /**
   * Why loading url failed, from what the rejected play() threw, the HTTP status of
   * hls.js or dashjs and the MediaError of the element (ADR 0065).
   */
  const reasonFor = (url: string, rejection?: unknown, status?: number): ErrorReason | null =>
    errorReason({
      pageProtocol,
      url,
      status,
      mediaErrorCode: audio?.error?.code ?? null,
      rejection,
    })

  const createSource = (url: string): AudioSource => {
    const retryWithoutCors = !graph.isConnected()
    switch (detectProtocol(url)) {
      case 'hls':
        return createHlsSource({ loadHls: loaders.loadHls, isIOS, retryWithoutCors })
      case 'dash':
        return createDashSource({ loadDash: loaders.loadDash })
      case 'direct':
        return createDirectSource({ retryWithoutCors })
    }
  }

  /**
   * Destroys the current source and loads the live stream. Rejects if its play() rejects.
   * Once a pause() has cancelled it, it reports nothing. What the source reports after
   * start() goes through sourceFailed().
   */
  const playLive = async (element: HTMLAudioElement, url: string) => {
    const current = generation
    const report = (event: PlayerEvent) => {
      if (generation === current) dispatch(event)
    }
    const failed = (event: PlayerEvent) => {
      if (generation === current) sourceFailed(event)
    }
    source?.destroy()
    source = createSource(url)
    liveUrl = url
    liveStarting = true
    errorDeferred = false
    try {
      await source.start(element, url, {
        onError: ({ status }) =>
          failed({ type: 'stream-error', reason: reasonFor(url, undefined, status) }),
        onPlayRejected: (error) => failed({ type: 'play-failed', reason: reasonFor(url, error) }),
      })
    } finally {
      // A rejection is reported by the caller as play-failed; the deferred error is dropped.
      if (generation === current) {
        liveStarting = false
        errorDeferred = false
      }
    }
    report({ type: 'live-started' })
  }

  /**
   * Makes promise the pending play() until it settles, so a play() meanwhile returns
   * it (K80).
   */
  const track = (promise: Promise<void>): Promise<void> => {
    const attempt: Promise<void> = promise.finally(() => {
      // A pause() may have released it, and a later play() taken its place.
      if (pendingPlay === attempt) pendingPlay = null
    })
    pendingPlay = attempt
    return attempt
  }

  /**
   * Releases the welcome audio and loads the live stream. Used when it ends, fails to
   * start or errors while it plays: the live stream follows silently. If the live
   * stream fails, the error stays and Play loads it again (K63, ADR 0034); a pause()
   * cancels it.
   */
  const advanceToLive = async (element: HTMLAudioElement, options: PlayOptions) => {
    dispatch({ type: 'intro-finished' })
    const current = generation
    try {
      dispatch({ type: 'load-start' })
      await playLive(element, options.streamUrl)
    } catch (error) {
      if (generation !== current) return
      dispatch({ type: 'play-failed', reason: reasonFor(options.streamUrl, error) })
      dispatch({ type: 'load-end' })
    }
  }

  /** Follows the welcome audio with the live stream, as a pending play() */
  const followWithLive = () => {
    if (audio !== null && introOptions !== null) void track(advanceToLive(audio, introOptions))
  }

  /**
   * Whether the element can be visualized now; connects it to the graph if so. source
   * is only ever the live stream's: the welcome audio, which plays before the first
   * live stream, never sets it, so it is never visualized.
   */
  const connectIfVisualizable = (): boolean => {
    if (audio === null || !graph.supported || !source?.isCorsClean()) {
      return false
    }
    graph.connect(audio)
    return graph.isConnected()
  }

  /** Ends the reconnection in progress, if any, and cancels its pending timer */
  const stopReconnecting = () => {
    reconnecting = false
    attempts = 0
    if (reconnectTimer !== null) clock.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  /**
   * An attempt failed: waits for the next one or, after the last, publishes the error
   * as a failed play() does, and Play reloads the live stream.
   */
  const attemptFailed = (): void => {
    if (attempts < reconnect.delaysMs.length) {
      scheduleAttempt()
      return
    }
    stopReconnecting()
    dispatch({ type: 'play-failed', reason: { code: 'reconnect-exhausted' } })
    dispatch({ type: 'load-end' })
  }

  /**
   * Runs one attempt to reconnect: the load of the live stream, as Play does (ADR 0032).
   * It fails if its play() rejects or if it does not play within reconnect.stallMs;
   * then what it reports afterwards is ignored.
   */
  const attemptReconnect = async () => {
    reconnectTimer = null
    if (audio === null || liveUrl === null) return
    attempts += 1
    const current = generation
    reconnectTimer = clock.setTimeout(() => {
      reconnectTimer = null
      // Kept: a direct source still loads and may play late; its playing ends the
      // reconnection, and the watch and Web Audio need it.
      source?.destroy()
      failAttempt()
    }, reconnect.stallMs)
    try {
      await playLive(audio, liveUrl)
    } catch {
      if (generation === current) failAttempt()
    }
  }

  /** Ends the attempt in progress as failed: what it reports afterwards is ignored */
  const failAttempt = () => {
    generation += 1
    liveStarting = false
    errorDeferred = false
    if (reconnectTimer !== null) clock.clearTimeout(reconnectTimer)
    reconnectTimer = null
    attemptFailed()
  }

  /**
   * A fatal error of hls.js or dashjs, or a play() they started that was rejected:
   * during an attempt it fails; once the live stream has played it is a cut; before, it
   * is published, as it was (ADR 0061).
   */
  const sourceFailed = (event: PlayerEvent) => {
    if (reconnecting) failAttempt()
    else if (armed) startReconnect()
    else dispatch(event)
  }

  /** Waits for the next delay and attempts to reconnect */
  const scheduleAttempt = () => {
    reconnectTimer = clock.setTimeout(() => void attemptReconnect(), reconnect.delaysMs[attempts])
  }

  /** Stops watching the progress of the live stream */
  const stopWatching = () => {
    if (watchTimer !== null) clock.clearInterval(watchTimer)
    watchTimer = null
  }

  /** The live stream that was playing was cut: shows the loading and reconnects */
  const startReconnect = () => {
    stopWatching()
    // What the cut source reports from now on is ignored.
    generation += 1
    armed = false
    reconnecting = true
    attempts = 0
    dispatch({ type: 'reconnect-start' })
    scheduleAttempt()
  }

  /**
   * Reads the progress of the live stream once: if it should play (not paused, from a
   * source without Media Source) and its time has not moved for reconnect.stallMs, it
   * was cut. Chromium waits and WebKit stalls without an error (ADR 0061).
   */
  const watch = () => {
    if (audio === null) return
    const now = clock.now()
    const shouldAdvance =
      state.status === 'playing' && !audio.paused && source !== null && !source.usesMediaSource()
    if (!shouldAdvance || audio.currentTime !== lastTime) {
      lastTime = audio.currentTime
      lastProgressAt = now
      return
    }
    if (now - lastProgressAt >= reconnect.stallMs) startReconnect()
  }

  /** Starts watching the progress of the live stream, from its current time */
  const startWatching = () => {
    if (watchTimer !== null || audio === null) return
    lastTime = audio.currentTime
    lastProgressAt = clock.now()
    watchTimer = clock.setInterval(watch, WATCH_INTERVAL_MS)
  }

  const onAudioEvent = (event: Event) => {
    if (event.type === 'playing') {
      // The live stream plays: a later cut reconnects, and a reconnection is over.
      if (liveUrl !== null && state.activeSource !== 'intro') {
        armed = true
        stopReconnecting()
        startWatching()
      }
      dispatch({ type: 'playing', visualizable: connectIfVisualizable() })
      return
    }
    // While it reconnects, the element of the cut stream has nothing to publish.
    if (reconnecting && event.type !== 'canplay' && event.type !== 'waiting') return
    // A cut of the live stream: its error or its end, and the pause before the end.
    if (
      armed &&
      (event.type === 'error' ||
        event.type === 'ended' ||
        (event.type === 'pause' && audio !== null && audio.ended))
    ) {
      if (event.type !== 'pause') startReconnect()
      return
    }
    // A pause from outside (a call, unplugged headphones): what the paused element
    // reports afterwards is not a cut (ADR 0061).
    if (armed && event.type === 'pause') {
      armed = false
      stopWatching()
    }
    if (event.type === 'ended') {
      // Only the end of the welcome audio matters.
      if (state.activeSource === 'intro') followWithLive()
      return
    }
    // While the live stream starts, its error, and the pause of Chromium after it (K1),
    // wait for the outcome of start(): the retry without crossOrigin may still play (K83).
    if (liveStarting && (event.type === 'error' || (event.type === 'pause' && errorDeferred))) {
      errorDeferred = true
      return
    }
    if (state.activeSource === 'intro') {
      // An error while it starts is handled by the catch of its play() (K63).
      if (event.type === 'error') {
        if (!introStarting) followWithLive()
        return
      }
      // A pause from outside (not the one before ended) releases it: Play loads the
      // live stream (K63).
      if (event.type === 'pause' && audio !== null && !audio.ended) {
        dispatch({ type: 'intro-finished' })
      }
    }
    if (event.type === 'error') {
      dispatch({ type: 'error', reason: reasonFor(liveUrl ?? '') })
      return
    }
    dispatch({
      type: event.type as Exclude<(typeof AUDIO_EVENTS)[number], 'ended' | 'playing' | 'error'>,
    })
  }

  /** Runs one play(): the welcome audio or the load of the live stream */
  const startPlay = async (options: PlayOptions) => {
    const { streamUrl, introUrl } = options
    const element = audio
    if (element === null) return

    if (state.activeSource === null && introUrl && !state.introConsumed) {
      introOptions = options
      dispatch({ type: 'intro-started' })
      introStarting = true
      try {
        dispatch({ type: 'load-start' })
        await createDirectSource({ retryWithoutCors: !graph.isConnected() }).start(
          element,
          introUrl,
          {
            onError: () => {},
            onPlayRejected: () => {},
          },
        )
      } catch {
        introStarting = false
        // Paused from outside while it started: it stays paused (K63).
        if (state.activeSource !== 'intro') {
          dispatch({ type: 'load-end' })
          return
        }
        // The welcome audio failed: the live stream follows, as if it had ended.
        await advanceToLive(element, options)
        return
      }
      introStarting = false
      dispatch({ type: 'resumed' })
      dispatch({ type: 'load-end' })
      return
    }

    // The welcome audio is playing: pause() is blocked, so there is nothing to do.
    if (state.activeSource === 'intro') return

    // The same live stream is playing: nothing to do. Otherwise (first play, after a
    // pause, an error or a stream change) load it, so it plays from the live edge
    // instead of the buffer (ADR 0032).
    if (
      state.activeSource === 'live' &&
      liveUrl === streamUrl &&
      state.status === 'playing' &&
      !element.paused
    ) {
      return
    }
    // A load of the user cancels a reconnection, and the live stream reconnects again
    // only once this load plays (ADR 0061).
    if (reconnecting) {
      stopReconnecting()
      generation += 1
    }
    armed = false
    stopWatching()
    // loading stays on until the playing event of the element (K11).
    const current = generation
    try {
      dispatch({ type: 'load-start' })
      await playLive(element, streamUrl)
    } catch (error) {
      // A pause() rejects the pending play() with AbortError (K81).
      if (generation !== current) return
      dispatch({ type: 'play-failed', reason: reasonFor(streamUrl, error) })
      dispatch({ type: 'load-end' })
    }
  }

  const detach = () => {
    if (audio === null) return
    for (const type of AUDIO_EVENTS) audio.removeEventListener(type, onAudioEvent)
    audio = null
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => state,
    attach(element) {
      detach()
      audio = element
      if (state.volumeControllable) element.volume = state.volume
      for (const type of AUDIO_EVENTS) element.addEventListener(type, onAudioEvent)
    },
    detach,
    dispose() {
      // Nothing reconnects or watches a disposed controller (ADR 0061).
      generation += 1
      armed = false
      stopWatching()
      stopReconnecting()
      source?.destroy()
      source = null
    },
    play(options) {
      // Synchronous, inside the gesture: WebKit keeps a context made outside it silent.
      graph.prepare()
      return pendingPlay ?? track(startPlay(options))
    },
    pause() {
      // The welcome audio cannot be paused.
      if (state.activeSource === 'intro') return
      generation += 1
      armed = false
      stopWatching()
      // A reconnection is cancelled too: no more attempts (ADR 0061).
      stopReconnecting()
      pendingPlay = null
      liveStarting = false
      errorDeferred = false
      // A load in progress is cancelled: hls.js would play on MANIFEST_PARSED and
      // dashjs on its own (K11).
      if (state.loading) {
        source?.destroy()
        source = null
      }
      audio?.pause()
      dispatch({ type: 'user-paused' })
    },
    setVolume(volume) {
      if (!state.volumeControllable || audio === null) return
      audio.volume = volume
      dispatch({ type: 'volume-changed', volume })
    },
    getAnalyser: () => graph.getAnalyser(),
  }
}
