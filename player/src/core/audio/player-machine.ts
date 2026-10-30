import type { ErrorReason } from 'src/core/audio/error-reason'
import type { PlayerStatus } from 'src/types/player'

/**
 * Snapshot of the audio player. Immutable: transition() returns a new object
 * when something changes, and the same one otherwise.
 */
export interface PlayerState {
  status: PlayerStatus
  /** Whether the player is loading or buffering */
  loading: boolean
  /** Whether the welcome audio holds the player (presentational only) */
  introLocked: boolean
  /** Which source is loaded into the audio element; null until the first play() */
  activeSource: 'intro' | 'live' | null
  /** Whether the welcome audio has already played, or failed, for this player */
  introConsumed: boolean
  /** Volume level (0-1) */
  volume: number
  /**
   * Whether the volume can be changed; set by the controller when it is created
   * (K13, ADR 0036). No event changes it.
   */
  volumeControllable: boolean
  /**
   * Whether the source in the element goes through the Web Audio graph: false on each
   * attempt, set by the playing event of the element (K82, ADR 0031).
   */
  canVisualize: boolean
  /**
   * Why the last load failed, for administrators (ADR 0065): set with the error, null
   * when nothing tells it, cleared by load-start and playing, kept by a pause.
   */
  errorReason: ErrorReason | null
  /**
   * Whether the live stream is reconnecting after a cut: the status stays playing, and
   * the status region says it connects (K129, ADR 0061)
   */
  reconnecting: boolean
}

/**
 * What the controller reports: its own steps (load-start to volume-changed) and
 * the events of the audio element (playing, pause, error, canplay, waiting). The
 * controller adds to playing whether the source is visualizable: the live stream,
 * clean of CORS and connected to the Web Audio graph.
 */
export type PlayerEvent =
  | { type: 'load-start' }
  | { type: 'reconnect-start' }
  | { type: 'load-end' }
  | { type: 'intro-started' }
  | { type: 'intro-finished' }
  | { type: 'live-started' }
  | { type: 'play-failed'; reason?: ErrorReason | null }
  | { type: 'resumed' }
  | { type: 'user-paused' }
  | { type: 'playing'; visualizable: boolean }
  | { type: 'pause' }
  | { type: 'error'; reason?: ErrorReason | null }
  | { type: 'canplay' }
  | { type: 'waiting' }
  | { type: 'stream-error'; reason?: ErrorReason | null }
  | { type: 'volume-changed'; volume: number }

/** The state of a new player: idle, at full volume, before any source */
export const initialPlayerState: PlayerState = {
  status: 'idle',
  loading: false,
  introLocked: false,
  activeSource: null,
  introConsumed: false,
  volume: 1,
  volumeControllable: true,
  canVisualize: false,
  errorReason: null,
  reconnecting: false,
}

/** Returns state with changes applied, or state itself if no field differs */
function patch(state: PlayerState, changes: Partial<PlayerState>): PlayerState {
  const keys = Object.keys(changes) as (keyof PlayerState)[]
  if (keys.every((key) => state[key] === changes[key])) return state
  return { ...state, ...changes }
}

/**
 * The reason of an error event, or the one in state if it is equal, so an equal
 * reason does not change the state.
 */
function reasonOf(state: PlayerState, reason: ErrorReason | null | undefined): ErrorReason | null {
  const next = reason ?? null
  const current = state.errorReason
  if (next === null || current === null) return next
  const sameStatus = !('status' in next) || ('status' in current && current.status === next.status)
  return current.code === next.code && sameStatus ? current : next
}

/**
 * Pure transition of the audio player.
 *
 * Replicates the 3.4.2 hook, with its quirks fixed (ADR 0034): intro-finished
 * releases the welcome audio, so Play loads the live stream after it fails or is
 * paused (K63). A pause keeps the error status (K1), the user's
 * pause clears loading (K64), and the status turns playing with the playing event of
 * the element, not with live-started (K11).
 *
 * @returns The next state, or the same reference if nothing changed
 */
export function transition(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'load-start':
      return patch(state, {
        loading: true,
        canVisualize: false,
        errorReason: null,
        reconnecting: false,
      })
    case 'reconnect-start':
      return patch(state, {
        loading: true,
        canVisualize: false,
        errorReason: null,
        reconnecting: true,
      })
    case 'waiting':
      return patch(state, { loading: true })
    case 'load-end':
      return patch(state, { loading: false })
    case 'intro-started':
      return patch(state, { activeSource: 'intro', introLocked: true })
    case 'intro-finished':
      // Play loads the live stream from now on, whatever follows (K63).
      return patch(state, { introConsumed: true, introLocked: false, activeSource: null })
    case 'live-started':
      // playing comes from the element: hls.js plays on MANIFEST_PARSED, dashjs autoplays (K11).
      return patch(state, { activeSource: 'live', introLocked: false })
    case 'resumed':
      return patch(state, { status: 'playing' })
    case 'playing':
      return patch(state, {
        status: 'playing',
        loading: false,
        canVisualize: event.visualizable,
        errorReason: null,
        reconnecting: false,
      })
    case 'user-paused':
      // The welcome audio cannot be paused.
      if (state.activeSource === 'intro') return state
      // canplay does not clear loading once paused (K64).
      return patch(state, { status: 'paused', loading: false, reconnecting: false })
    case 'pause':
      // Chromium fires a pause after the error of a failing source (K1).
      if (state.status === 'error') return state
      return patch(state, { status: 'paused' })
    case 'stream-error':
      // A fatal error of hls.js or dashjs comes after the load, which keeps loading (K11).
      return patch(state, {
        status: 'error',
        loading: false,
        errorReason: reasonOf(state, event.reason),
        reconnecting: false,
      })
    case 'play-failed':
    case 'error':
      return patch(state, {
        status: 'error',
        errorReason: reasonOf(state, event.reason),
        reconnecting: false,
      })
    case 'canplay':
      if (state.status !== 'idle' && state.status !== 'error') return state
      return patch(state, { loading: false })
    case 'volume-changed':
      return patch(state, { volume: event.volume })
  }
}
