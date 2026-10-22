import {
  initialPlayerState,
  transition,
  type PlayerEvent,
  type PlayerState,
} from 'src/core/audio/player-machine'
import { detectProtocol } from 'src/core/audio/protocol'
import { createDashSource } from 'src/core/audio/sources/dash'
import { createDirectSource } from 'src/core/audio/sources/direct'
import { createHlsSource } from 'src/core/audio/sources/hls'
import type { AudioSource, DashMediaPlayer, HlsClass } from 'src/core/audio/sources/types'
import { isVolumeControllable } from 'src/core/audio/volume'
import { createVisualizerGraph, type VisualizerGraphOptions } from 'src/core/audio/web-audio'

/**
 * Loaders of the streaming libraries; the dynamic imports of the sources by default.
 */
export interface StreamingLoaders {
  loadHls?: () => Promise<HlsClass>
  loadDash?: () => Promise<DashMediaPlayer>
}

export interface PlayOptions {
  streamUrl: string
  /** Welcome audio URL, played once per controller before the live stream. */
  introUrl?: string | null
  isIOS: boolean
}

export interface AudioController {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PlayerState
  /** Listens to audio and applies the volume, if it can be changed. Idempotent. */
  attach: (audio: HTMLAudioElement) => void
  /** Stops listening to the attached element. Idempotent. */
  detach: () => void
  /** Destroys the current source. */
  dispose: () => void
  /**
   * Starts the welcome audio or loads the live stream. After a pause, an error or a
   * stream change it reloads the live stream, back to the live edge (ADR 0032); while
   * that stream plays, it does nothing. While a play() is pending, the next one
   * returns its promise (docs/known-issues.md K80), until a pause().
   */
  play: (options: PlayOptions) => Promise<void>
  /**
   * Pauses playback, except the welcome audio. It cancels a pending play(): the load
   * in progress is destroyed and its outcome, an AbortError included, is ignored, so
   * the next play() starts anew (docs/known-issues.md K81 and K11, ADR 0034 D3).
   */
  pause: () => void
  /** Sets the volume (0-1); ignored if it cannot be changed. */
  setVolume: (volume: number) => void
  /** The analyser of the Web Audio graph; null until the element is connected. */
  getAnalyser: () => AnalyserNode | null
}

// The 3.4.2 hook had seven listeners; its two on 'playing' are one machine event here.
const AUDIO_EVENTS = ['playing', 'pause', 'error', 'canplay', 'waiting', 'ended'] as const

/**
 * Creates the audio controller: runs the effects of useAudioPlayer() (src, play(),
 * hls.js, dashjs, volume) and publishes the state of player-machine as a snapshot.
 *
 * isIOS is read on each play(), never when the controller is created (it turns true
 * after the first render, docs/known-issues.md K13). When the welcome audio ends, the
 * live stream is loaded with the options of the play() that started it.
 *
 * Whether the volume can be changed is probed once, when it is created, on an element
 * of its own, and published in the first snapshot (K13, ADR 0036).
 *
 * A direct source that fails is retried once without crossOrigin, unless the element
 * goes through the Web Audio graph: then it is an error (C1, ADR 0033).
 *
 * The Web Audio context is created or resumed synchronously in play(), inside the
 * gesture. When the element starts playing the live stream from a source clean of
 * CORS, it is connected to the graph (only the first time) and canVisualize turns
 * true; the welcome audio never is (K82, ADR 0031).
 *
 * @param options.loaders - Loaders of hls.js and dashjs (dynamic imports by default)
 * @param options.webAudio - Context factory and user agent (no Web Audio by default)
 * @param options.volumeProbe - Creates the element that probes the volume (controllable
 *   without it)
 * @returns AudioController
 */
export function createAudioController({
  loaders = {},
  webAudio = { userAgent: '' },
  volumeProbe,
}: {
  loaders?: StreamingLoaders
  webAudio?: VisualizerGraphOptions
  volumeProbe?: () => HTMLMediaElement
} = {}): AudioController {
  const graph = createVisualizerGraph(webAudio)
  const listeners = new Set<() => void>()
  let state =
    volumeProbe === undefined || isVolumeControllable(volumeProbe())
      ? initialPlayerState
      : { ...initialPlayerState, volumeControllable: false }
  let audio: HTMLAudioElement | null = null
  let source: AudioSource | null = null
  // The options of the play() that started the welcome audio, for 'ended'.
  let introOptions: PlayOptions | null = null
  // The pending play(), returned to the calls made before it settles (D7).
  let pendingPlay: Promise<void> | null = null
  // Whether the play() of the welcome audio is pending: its catch handles an error.
  let introStarting = false
  // Bumped by pause(): what an earlier play() reports afterwards is ignored (D3).
  let generation = 0
  // The URL of the loaded live stream; with hls.js and dashjs audio.src is a blob:.
  let liveUrl: string | null = null

  const dispatch = (event: PlayerEvent) => {
    const next = transition(state, event)
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener())
  }

  const createSource = (url: string, isIOS: boolean): AudioSource => {
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
   * Once a pause() has cancelled it, it reports nothing.
   */
  const playLive = async (element: HTMLAudioElement, url: string, isIOS: boolean) => {
    const current = generation
    const report = (event: PlayerEvent) => {
      if (generation === current) dispatch(event)
    }
    source?.destroy()
    source = createSource(url, isIOS)
    liveUrl = url
    await source.start(element, url, {
      onError: () => report({ type: 'stream-error' }),
      onPlayRejected: () => report({ type: 'play-failed' }),
    })
    report({ type: 'live-started' })
  }

  /**
   * Makes promise the pending play() until it settles (D7), so a play() meanwhile
   * returns it.
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
   * stream fails, the error stays and Play loads it again (docs/known-issues.md K63,
   * ADR 0034 D5); a pause() cancels it.
   */
  const advanceToLive = async (element: HTMLAudioElement, options: PlayOptions) => {
    dispatch({ type: 'intro-finished' })
    const current = generation
    try {
      dispatch({ type: 'load-start' })
      await playLive(element, options.streamUrl, options.isIOS)
    } catch {
      if (generation !== current) return
      dispatch({ type: 'play-failed' })
      dispatch({ type: 'load-end' })
    }
  }

  /**
   * Follows the welcome audio with the live stream, as a pending play().
   */
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

  const onAudioEvent = (event: Event) => {
    if (event.type === 'playing') {
      dispatch({ type: 'playing', visualizable: connectIfVisualizable() })
      return
    }
    if (event.type === 'ended') {
      // Only the end of the welcome audio matters.
      if (state.activeSource === 'intro') followWithLive()
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
    dispatch({ type: event.type as Exclude<(typeof AUDIO_EVENTS)[number], 'ended' | 'playing'> })
  }

  /**
   * Runs one play(): the welcome audio or the load of the live stream.
   */
  const startPlay = async (options: PlayOptions) => {
    const { streamUrl, introUrl, isIOS } = options
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
    // instead of the buffer (docs/known-issues.md C7, ADR 0032).
    if (
      state.activeSource === 'live' &&
      liveUrl === streamUrl &&
      state.status === 'playing' &&
      !element.paused
    ) {
      return
    }
    // loading stays on until the playing event of the element (K11).
    const current = generation
    try {
      dispatch({ type: 'load-start' })
      await playLive(element, streamUrl, isIOS)
    } catch {
      // A pause() rejects the pending play() with AbortError (K81).
      if (generation !== current) return
      dispatch({ type: 'play-failed' })
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
      pendingPlay = null
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
