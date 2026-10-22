// Pure transition of the audio player (spec 0006, task 2.5). The currently cases
// replicate docs/known-issues.md K63 (K11 is fixed in spec 0007), as fixed in
// src/hooks/use-audio-player.test.tsx and tests/e2e/cross-origin.spec.ts.
// canVisualize (spec 0007, task 1.7): false on each attempt, set by the playing event.
import { describe, expect, it } from 'vitest'
import {
  initialPlayerState,
  transition,
  type PlayerEvent,
  type PlayerState,
} from 'src/core/audio/player-machine'

const run = (events: PlayerEvent[], from: PlayerState = initialPlayerState) =>
  events.reduce(transition, from)

// The live stream playing: since K11, playing comes from the element (spec 0007, ADR 0034).
const liveState = run([
  { type: 'load-start' },
  { type: 'live-started' },
  { type: 'playing', visualizable: false },
])

const introState = run([
  { type: 'intro-started' },
  { type: 'load-start' },
  { type: 'resumed' },
  { type: 'load-end' },
])

describe('initialPlayerState', () => {
  it('starts idle, not loading, unlocked, with nothing loaded, full volume and no visualizer', () => {
    expect(initialPlayerState).toEqual({
      status: 'idle',
      loading: false,
      introLocked: false,
      activeSource: null,
      introConsumed: false,
      volume: 1,
      canVisualize: false,
    })
  })
})

describe('transition', () => {
  it('sets and clears loading with load-start and load-end', () => {
    const loading = transition(initialPlayerState, { type: 'load-start' })
    expect(loading.loading).toBe(true)
    expect(transition(loading, { type: 'load-end' }).loading).toBe(false)
  })

  it('locks the welcome audio with intro-started', () => {
    const state = transition(initialPlayerState, { type: 'intro-started' })
    expect(state).toMatchObject({ activeSource: 'intro', introLocked: true, status: 'idle' })
  })

  it('marks the welcome audio as consumed with intro-finished', () => {
    const state = run([{ type: 'intro-started' }, { type: 'intro-finished' }])
    expect(state).toMatchObject({ introConsumed: true, activeSource: 'intro', introLocked: true })
  })

  it('switches to the live stream and unlocks with live-started', () => {
    const state = run([
      { type: 'intro-started' },
      { type: 'intro-finished' },
      { type: 'live-started' },
    ])
    expect(state).toMatchObject({ activeSource: 'live', introLocked: false, status: 'idle' })
  })

  it('reports playing with resumed', () => {
    const state = transition({ ...liveState, status: 'paused' }, { type: 'resumed' })
    expect(state.status).toBe('playing')
  })

  it('reports error with play-failed and stream-error', () => {
    expect(transition(liveState, { type: 'play-failed' }).status).toBe('error')
    expect(transition(liveState, { type: 'stream-error' }).status).toBe('error')
  })

  it('pauses the live stream with user-paused', () => {
    expect(transition(liveState, { type: 'user-paused' }).status).toBe('paused')
  })

  it('ignores user-paused while the welcome audio plays', () => {
    expect(transition(introState, { type: 'user-paused' })).toBe(introState)
  })

  it('reports playing and clears loading on the playing event', () => {
    const state = run([{ type: 'load-start' }, { type: 'playing', visualizable: false }])
    expect(state).toMatchObject({ status: 'playing', loading: false })
  })

  it.each([true, false])('sets canVisualize to %s on the playing event', (visualizable) => {
    const state = run([{ type: 'load-start' }, { type: 'playing', visualizable }])
    expect(state.canVisualize).toBe(visualizable)
  })

  it('clears canVisualize on each attempt (load-start)', () => {
    const visualizing = run([{ type: 'playing', visualizable: true }], liveState)
    expect(transition(visualizing, { type: 'load-start' }).canVisualize).toBe(false)
  })

  it('keeps canVisualize on waiting, pause and error', () => {
    const visualizing = run([{ type: 'playing', visualizable: true }], liveState)
    for (const type of ['waiting', 'pause', 'error'] as const) {
      expect(transition(visualizing, { type }).canVisualize).toBe(true)
    }
  })

  it('reports paused on the pause event and error on the error event', () => {
    expect(transition(liveState, { type: 'pause' }).status).toBe('paused')
    expect(transition(liveState, { type: 'error' }).status).toBe('error')
  })

  it('sets loading on waiting', () => {
    expect(transition(liveState, { type: 'waiting' }).loading).toBe(true)
  })

  it.each(['idle', 'error'] as const)('clears loading on canplay in %s', (status) => {
    const state = transition({ ...initialPlayerState, status, loading: true }, { type: 'canplay' })
    expect(state.loading).toBe(false)
  })

  it('keeps loading on canplay while playing', () => {
    const state = transition({ ...liveState, loading: true }, { type: 'canplay' })
    expect(state.loading).toBe(true)
  })

  it('stores the volume with volume-changed', () => {
    expect(transition(liveState, { type: 'volume-changed', volume: 0.4 }).volume).toBe(0.4)
  })

  it('does not mutate the previous state', () => {
    const before = { ...liveState }
    transition(liveState, { type: 'pause' })
    expect(liveState).toEqual(before)
  })

  describe('returns the same reference when nothing changes', () => {
    it.each<[string, PlayerState, PlayerEvent]>([
      ['load-end while not loading', initialPlayerState, { type: 'load-end' }],
      ['load-start while loading', { ...liveState, loading: true }, { type: 'load-start' }],
      ['playing while playing', liveState, { type: 'playing', visualizable: false }],
      ['pause while paused', { ...liveState, status: 'paused' }, { type: 'pause' }],
      ['volume-changed to the same volume', liveState, { type: 'volume-changed', volume: 1 }],
      ['canplay while playing and not loading', liveState, { type: 'canplay' }],
      ['intro-started twice', introState, { type: 'intro-started' }],
    ])('%s', (_, state, event) => {
      expect(transition(state, event)).toBe(state)
    })
  })

  it('keeps the error when a pause follows it (K1)', () => {
    const failed = run([{ type: 'error' }], liveState)
    expect(transition(failed, { type: 'pause' })).toBe(failed)
    expect(failed.status).toBe('error')
  })

  it('keeps loading until the element plays (K11)', () => {
    const state = run([{ type: 'load-start' }, { type: 'live-started' }])
    expect(state).toMatchObject({ status: 'idle', loading: true, activeSource: 'live' })
    expect(transition(state, { type: 'playing', visualizable: false })).toMatchObject({
      status: 'playing',
      loading: false,
    })
  })

  it('respects a pause pressed while it loads (K11)', () => {
    const state = run([{ type: 'load-start' }, { type: 'user-paused' }, { type: 'live-started' }])
    expect(state).toMatchObject({ status: 'paused', loading: false })
  })

  it('currently stays locked in the welcome audio when the live stream fails after it (K63)', () => {
    const state = run(
      [
        { type: 'intro-finished' },
        { type: 'load-start' },
        { type: 'play-failed' },
        { type: 'load-end' },
      ],
      introState,
    )
    expect(state).toMatchObject({ status: 'error', introLocked: true, activeSource: 'intro' })
  })

  it('currently stays locked when both the welcome audio and the live stream fail (K63)', () => {
    const state = run([
      { type: 'intro-started' },
      { type: 'load-start' },
      { type: 'intro-finished' },
      { type: 'play-failed' },
      { type: 'load-end' },
    ])
    expect(state).toMatchObject({ status: 'error', introLocked: true, activeSource: 'intro' })
  })

  it('currently cannot resume when something else pauses the welcome audio (K63)', () => {
    const paused = transition(introState, { type: 'pause' })
    expect(paused).toMatchObject({ status: 'paused', introLocked: true, activeSource: 'intro' })
    expect(transition(paused, { type: 'user-paused' })).toBe(paused)
  })

  it('currently stays locked in error when the welcome audio errors while playing (K63)', () => {
    const state = transition(introState, { type: 'error' })
    expect(state).toMatchObject({ status: 'error', introLocked: true, activeSource: 'intro' })
  })

  it('clears loading on a pause while buffering (K64)', () => {
    const state = run(
      [{ type: 'waiting' }, { type: 'user-paused' }, { type: 'pause' }, { type: 'canplay' }],
      liveState,
    )
    expect(state).toMatchObject({ status: 'paused', loading: false })
  })
})
