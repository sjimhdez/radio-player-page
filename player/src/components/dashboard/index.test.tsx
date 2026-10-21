// Characterization of the Dashboard (spec 0006, task 3.3): the visible playback
// error and the sleep timer, with useAudioPlayer replaced by a controllable double.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import 'src/config/i18n'
import Dashboard from 'src/components/dashboard'
import type { PlayerStatus } from 'src/types/player'

const player = vi.hoisted(() => ({
  status: 'idle' as PlayerStatus,
  loading: false,
  play: () => {},
  pause: () => {},
  audioRef: { current: null },
}))

vi.mock('src/hooks/use-audio-player', () => ({
  default: () => ({
    audioRef: player.audioRef,
    status: player.status,
    loading: player.loading,
    introLocked: false,
    play: player.play,
    pause: player.pause,
    volume: 1,
    handleVolumeChange: () => {},
  }),
}))
vi.mock('src/hooks/use-audio-visualizer', () => ({ default: () => {} }))
vi.mock('src/hooks/use-can-visualize', () => ({ useCanVisualize: () => false }))

const ERROR_TEXT = 'Unable to play the stream. Try again later.'

function setPlayer(status: PlayerStatus, loading = false) {
  player.status = status
  player.loading = loading
}

beforeEach(() => {
  setPlayer('idle')
  player.play = vi.fn()
  player.pause = vi.fn()
})

describe('Dashboard error', () => {
  it('shows the error alert when the status is error and loading is done', () => {
    setPlayer('error', false)
    render(<Dashboard />)

    expect(screen.getByRole('alert').textContent).toBe(ERROR_TEXT)
  })

  it('hides the error alert while still loading', () => {
    setPlayer('error', true)
    render(<Dashboard />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides the error alert while playing', () => {
    setPlayer('playing')
    render(<Dashboard />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides the error alert when the status goes from error to paused', async () => {
    setPlayer('error')
    const { rerender } = render(<Dashboard />)
    expect(screen.getByRole('alert')).toBeTruthy()

    setPlayer('paused')
    rerender(<Dashboard />)

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

describe('Dashboard sleep mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function choose(option: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Sleep mode' }))
    fireEvent.click(screen.getByRole('menuitem', { name: option }))
  }

  function tick(seconds: number) {
    act(() => {
      vi.advanceTimersByTime(seconds * 1000)
    })
  }

  it('disables the sleep mode button when nothing is playing', () => {
    render(<Dashboard />)

    expect(screen.getByRole('button', { name: 'Sleep mode' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows 1:00:00 after choosing 1 hour', () => {
    setPlayer('playing')
    render(<Dashboard />)

    choose('1 hour')

    expect(screen.getByText('1:00:00')).toBeTruthy()
  })

  it('shows 2:00:00 after choosing 2 hours', () => {
    setPlayer('playing')
    render(<Dashboard />)

    choose('2 hours')

    expect(screen.getByText('2:00:00')).toBeTruthy()
  })

  it('restarts the countdown when an option is chosen with the timer running', () => {
    setPlayer('playing')
    render(<Dashboard />)
    choose('1 hour')
    tick(5)
    expect(screen.getByText('59:55')).toBeTruthy()

    choose('1 hour')
    expect(screen.getByText('1:00:00')).toBeTruthy()

    // One interval, not two: a second goes by as a single tick.
    tick(1)
    expect(screen.getByText('59:59')).toBeTruthy()
  })

  it('removes the countdown when the status goes to paused', () => {
    setPlayer('playing')
    const { rerender } = render(<Dashboard />)
    choose('1 hour')
    tick(1)
    expect(screen.getByText('59:59')).toBeTruthy()

    setPlayer('paused')
    rerender(<Dashboard />)

    expect(screen.queryByRole('button', { name: 'Cancel sleep mode' })).toBeNull()
    expect(screen.queryByText('59:59')).toBeNull()
  })

  it('calls pause once when the countdown reaches zero', () => {
    setPlayer('playing')
    render(<Dashboard />)
    choose('30 mins')

    tick(30 * 60)
    expect(player.pause).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Cancel sleep mode' })).toBeNull()

    tick(60)
    expect(player.pause).toHaveBeenCalledTimes(1)
  })
})
