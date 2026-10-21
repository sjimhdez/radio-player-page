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

/**
 * Loaders of the streaming libraries; the dynamic imports of the sources by default.
 */
export interface StreamingLoaders {
  loadHls?: () => Promise<HlsClass>
  loadDash?: () => Promise<DashMediaPlayer>
}

export interface PlayOptions {
  streamUrl: string
  /** Welcome audio URL (not played yet: task 2.7). */
  introUrl?: string | null
  isIOS: boolean
}

export interface AudioController {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => PlayerState
  /** Listens to audio and applies the volume, except on iOS. Idempotent. */
  attach: (audio: HTMLAudioElement, options: { isIOS: boolean }) => void
  /** Stops listening to the attached element. Idempotent. */
  detach: () => void
  /** Destroys the current source. */
  dispose: () => void
  /** Starts or resumes playback. */
  play: (options: PlayOptions) => Promise<void>
  /** Pauses playback. */
  pause: () => void
  /** Sets the volume (0-1); ignored on iOS. */
  setVolume: (volume: number, options: { isIOS: boolean }) => void
}

// The 3.4.2 hook had seven listeners; its two on 'playing' are one machine event here.
const AUDIO_EVENTS = ['playing', 'pause', 'error', 'canplay', 'waiting', 'ended'] as const

/**
 * Creates the audio controller: runs the effects of useAudioPlayer() (src, play(),
 * hls.js, dashjs, volume) and publishes the state of player-machine as a snapshot.
 *
 * isIOS is read on each call, never when the controller is created (it turns true
 * after the first render, docs/known-issues.md K13).
 *
 * @param options.loaders - Loaders of hls.js and dashjs (dynamic imports by default)
 * @returns AudioController
 */
export function createAudioController({
  loaders = {},
}: { loaders?: StreamingLoaders } = {}): AudioController {
  const listeners = new Set<() => void>()
  let state = initialPlayerState
  let audio: HTMLAudioElement | null = null
  let source: AudioSource | null = null

  const dispatch = (event: PlayerEvent) => {
    const next = transition(state, event)
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener())
  }

  const onAudioEvent = (event: Event) => {
    // 'ended' only matters for the welcome audio (task 2.7).
    if (event.type === 'ended') return
    dispatch({ type: event.type as Exclude<(typeof AUDIO_EVENTS)[number], 'ended'> })
  }

  const createSource = (url: string, isIOS: boolean): AudioSource => {
    switch (detectProtocol(url)) {
      case 'hls':
        return createHlsSource({ loadHls: loaders.loadHls, isIOS })
      case 'dash':
        return createDashSource({ loadDash: loaders.loadDash })
      case 'direct':
        return createDirectSource()
    }
  }

  /**
   * Destroys the current source and loads the live stream. Rejects if its play() rejects.
   */
  const playLive = async (element: HTMLAudioElement, url: string, isIOS: boolean) => {
    source?.destroy()
    source = createSource(url, isIOS)
    await source.start(element, url, {
      onError: () => dispatch({ type: 'stream-error' }),
      onPlayRejected: () => dispatch({ type: 'play-failed' }),
    })
    dispatch({ type: 'live-started' })
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
    attach(element, { isIOS }) {
      detach()
      audio = element
      if (!isIOS) element.volume = state.volume
      for (const type of AUDIO_EVENTS) element.addEventListener(type, onAudioEvent)
    },
    detach,
    dispose() {
      source?.destroy()
      source = null
    },
    async play({ streamUrl, isIOS }) {
      const element = audio
      if (element === null) return

      // Resume the loaded live stream if it is the same and did not fail; otherwise
      // (first play, after an error, after a stream change) load it.
      const resume =
        state.activeSource !== null && element.src === streamUrl && state.status !== 'error'
      try {
        dispatch({ type: 'load-start' })
        if (resume) {
          if (element.paused) {
            await element.play()
            dispatch({ type: 'resumed' })
          }
          return
        }
        await playLive(element, streamUrl, isIOS)
      } catch {
        dispatch({ type: 'play-failed' })
      } finally {
        dispatch({ type: 'load-end' })
      }
    },
    pause() {
      // The welcome audio cannot be paused.
      if (state.activeSource === 'intro') return
      audio?.pause()
      dispatch({ type: 'user-paused' })
    },
    setVolume(volume, { isIOS }) {
      if (isIOS || audio === null) return
      audio.volume = volume
      dispatch({ type: 'volume-changed', volume })
    },
  }
}
