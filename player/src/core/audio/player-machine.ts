import type { PlayerStatus } from 'src/types/player'

/**
 * Snapshot of the audio player. Immutable: transition() returns a new object
 * when something changes, and the same one otherwise.
 */
export interface PlayerState {
  status: PlayerStatus
  /** Whether the player is loading or buffering. */
  loading: boolean
  /** Whether the welcome audio holds the player (presentational only). */
  introLocked: boolean
  /** Which source is loaded into the audio element; null until the first play(). */
  activeSource: 'intro' | 'live' | null
  /** Whether the welcome audio has already played, or failed, for this player. */
  introConsumed: boolean
  /** Volume level (0-1). */
  volume: number
  /**
   * Whether the source in the element goes through the Web Audio graph: false on each
   * attempt, set by the playing event of the element (K82, ADR 0031).
   */
  canVisualize: boolean
}

/**
 * What the controller reports: its own steps (load-start to volume-changed) and
 * the events of the audio element (playing, pause, error, canplay, waiting). The
 * controller adds to playing whether the source is visualizable: the live stream,
 * clean of CORS and connected to the Web Audio graph.
 */
export type PlayerEvent =
  | { type: 'load-start' }
  | { type: 'load-end' }
  | { type: 'intro-started' }
  | { type: 'intro-finished' }
  | { type: 'live-started' }
  | { type: 'play-failed' }
  | { type: 'resumed' }
  | { type: 'user-paused' }
  | { type: 'playing'; visualizable: boolean }
  | { type: 'pause' }
  | { type: 'error' }
  | { type: 'canplay' }
  | { type: 'waiting' }
  | { type: 'stream-error' }
  | { type: 'volume-changed'; volume: number }

export const initialPlayerState: PlayerState = {
  status: 'idle',
  loading: false,
  introLocked: false,
  activeSource: null,
  introConsumed: false,
  volume: 1,
  canVisualize: false,
}

/**
 * Returns state with changes applied, or state itself if no field differs.
 */
function patch(state: PlayerState, changes: Partial<PlayerState>): PlayerState {
  const keys = Object.keys(changes) as (keyof PlayerState)[]
  if (keys.every((key) => state[key] === changes[key])) return state
  return { ...state, ...changes }
}

/**
 * Pure transition of the audio player.
 *
 * Replicates the 3.4.2 hook, quirks included (docs/known-issues.md, fixed in spec 0007):
 * live-started reports playing before the HLS manifest is parsed (K11), the welcome
 * audio stays locked after a failure, an external pause or an error (K63), and canplay
 * only clears loading in idle or error (K64). A pause keeps the error status (K1).
 *
 * @param state - Current state
 * @param event - What happened
 * @returns The next state, or the same reference if nothing changed
 */
export function transition(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'load-start':
      return patch(state, { loading: true, canVisualize: false })
    case 'waiting':
      return patch(state, { loading: true })
    case 'load-end':
      return patch(state, { loading: false })
    case 'intro-started':
      return patch(state, { activeSource: 'intro', introLocked: true })
    case 'intro-finished':
      return patch(state, { introConsumed: true })
    case 'live-started':
      return patch(state, { activeSource: 'live', introLocked: false, status: 'playing' })
    case 'resumed':
      return patch(state, { status: 'playing' })
    case 'playing':
      return patch(state, { status: 'playing', loading: false, canVisualize: event.visualizable })
    case 'user-paused':
      // The welcome audio cannot be paused.
      if (state.activeSource === 'intro') return state
      return patch(state, { status: 'paused' })
    case 'pause':
      // Chromium fires a pause after the error of a failing source (K1).
      if (state.status === 'error') return state
      return patch(state, { status: 'paused' })
    case 'play-failed':
    case 'stream-error':
    case 'error':
      return patch(state, { status: 'error' })
    case 'canplay':
      if (state.status !== 'idle' && state.status !== 'error') return state
      return patch(state, { loading: false })
    case 'volume-changed':
      return patch(state, { volume: event.volume })
  }
}
