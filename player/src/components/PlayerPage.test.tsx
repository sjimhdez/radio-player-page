// Characterization of the PlayerPage: the visible playback error and the sleep timer,
// with useAudioPlayer replaced by a controllable double.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import 'src/config/i18n'
import PlayerPage from 'src/components/PlayerPage'
import type { ErrorReason } from 'src/core/audio/error-reason'
import type { PluginConfig } from 'src/types/global'
import type { PlayerStatus } from 'src/types/player'

const player = vi.hoisted(() => ({
  status: 'idle' as PlayerStatus,
  loading: false,
  introLocked: false,
  volumeControllable: true,
  errorReason: null as ErrorReason | null,
  canVisualize: false,
  play: () => {},
  pause: () => {},
  audioRef: { current: null },
}))

vi.mock('src/hooks/use-audio-player', () => ({
  default: () => ({
    audioRef: player.audioRef,
    status: player.status,
    loading: player.loading,
    introLocked: player.introLocked,
    play: player.play,
    pause: player.pause,
    volume: 1,
    volumeControllable: player.volumeControllable,
    handleVolumeChange: () => {},
    canVisualize: player.canVisualize,
    errorReason: player.errorReason,
    getAnalyser: () => null,
  }),
}))
// The arguments of each call, to read whether the PlayerPage asks it to draw
const visualizerCalls = vi.hoisted(() => [] as unknown[][])
vi.mock('src/hooks/use-audio-visualizer', () => ({
  default: (...args: unknown[]) => {
    visualizerCalls.push(args)
  },
}))

const ERROR_TEXT = 'Unable to play the stream. Try again later.'

function setPlayer(status: PlayerStatus, loading = false) {
  player.status = status
  player.loading = loading
  player.introLocked = false
  player.volumeControllable = true
  player.errorReason = null
  player.canVisualize = false
}

beforeEach(() => {
  setPlayer('idle')
  visualizerCalls.length = 0
  player.play = vi.fn()
  player.pause = vi.fn()
})

describe('Dashboard error', () => {
  it('shows the error alert when the status is error and loading is done', () => {
    setPlayer('error', false)
    render(<PlayerPage />)

    expect(screen.getByRole('alert').textContent).toBe(ERROR_TEXT)
  })

  it('hides the error alert while still loading', () => {
    setPlayer('error', true)
    render(<PlayerPage />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides the error alert while playing', () => {
    setPlayer('playing')
    render(<PlayerPage />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hides the error alert when the status goes from error to paused', async () => {
    setPlayer('error')
    const { rerender } = render(<PlayerPage />)
    expect(screen.getByRole('alert')).toBeTruthy()

    setPlayer('paused')
    rerender(<PlayerPage />)

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })
})

// The reason and the link, only for users who can manage_options (ADR 0065).
describe('Dashboard error for administrators', () => {
  const EDIT_URL = 'https://site.test/wp-admin/post.php?post=7&action=edit'

  function setConfig(adminDiagnostics: PluginConfig['adminDiagnostics']) {
    window.RADPLAPAG_CONFIG = {
      streamUrl: 'https://radio.test/live.mp3',
      siteTitle: 'Radio Test',
      themeColor: 'neutral',
      visualizer: 'oscilloscope',
      timezoneOffset: 0,
      adminDiagnostics,
    }
  }

  afterEach(() => {
    delete window.RADPLAPAG_CONFIG
  })

  it.each([
    [{ code: 'mixed-content' }, 'This page uses HTTPS and the stream uses HTTP'],
    [{ code: 'http', status: 404 }, 'HTTP 404'],
    [{ code: 'unreachable' }, 'The browser could not download the stream'],
    [{ code: 'not-supported' }, 'The browser cannot play this URL'],
    [{ code: 'reconnect-exhausted' }, 'The stream stopped and did not come back'],
  ] as const)('shows the reason %j and the link to test the stream', (reason, text) => {
    setConfig({ editUrl: EDIT_URL })
    setPlayer('error')
    player.errorReason = reason
    render(<PlayerPage />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(ERROR_TEXT)
    expect(alert.textContent).toContain(text)
    expect(screen.getByRole('link', { name: 'Test Stream' }).getAttribute('href')).toBe(EDIT_URL)
  })

  it('shows only the link when the reason is unknown', () => {
    setConfig({ editUrl: EDIT_URL })
    setPlayer('error')
    render(<PlayerPage />)

    expect(screen.getByRole('alert').textContent).toBe(`${ERROR_TEXT}Test Stream`)
    expect(screen.getByRole('link', { name: 'Test Stream' })).toBeTruthy()
  })

  it('shows the message of always to listeners, even with a reason', () => {
    setConfig(null)
    setPlayer('error')
    player.errorReason = { code: 'unreachable' }
    render(<PlayerPage />)

    expect(screen.getByRole('alert').textContent).toBe(ERROR_TEXT)
    expect(screen.queryByRole('link', { name: 'Test Stream' })).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Sleep Timer' }))
    fireEvent.click(screen.getByRole('menuitem', { name: option }))
  }

  function tick(seconds: number) {
    act(() => {
      vi.advanceTimersByTime(seconds * 1000)
    })
  }

  it('disables the sleep mode button when nothing is playing', () => {
    render(<PlayerPage />)

    expect(screen.getByRole('button', { name: 'Sleep Timer' }).hasAttribute('disabled')).toBe(true)
  })

  it('disables sleep mode while the welcome audio plays (K65)', () => {
    setPlayer('playing')
    player.introLocked = true
    render(<PlayerPage />)

    expect(screen.getByRole('button', { name: 'Sleep Timer' }).hasAttribute('disabled')).toBe(true)
  })

  it('shows 1:00:00 after choosing 1 hour', () => {
    setPlayer('playing')
    render(<PlayerPage />)

    choose('1 hour')

    expect(screen.getByText('1:00:00')).toBeTruthy()
  })

  it('shows 2:00:00 after choosing 2 hours', () => {
    setPlayer('playing')
    render(<PlayerPage />)

    choose('2 hours')

    expect(screen.getByText('2:00:00')).toBeTruthy()
  })

  it('restarts the countdown when an option is chosen with the timer running', () => {
    setPlayer('playing')
    render(<PlayerPage />)
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
    const { rerender } = render(<PlayerPage />)
    choose('1 hour')
    tick(1)
    expect(screen.getByText('59:59')).toBeTruthy()

    setPlayer('paused')
    rerender(<PlayerPage />)

    expect(screen.queryByRole('button', { name: 'Cancel sleep timer' })).toBeNull()
    expect(screen.queryByText('59:59')).toBeNull()
  })

  it('calls pause once when the countdown reaches zero', () => {
    setPlayer('playing')
    render(<PlayerPage />)
    choose('30 minutes')

    tick(30 * 60)
    expect(player.pause).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Cancel sleep timer' })).toBeNull()

    tick(60)
    expect(player.pause).toHaveBeenCalledTimes(1)
  })
})

// The slider shows where the volume can be changed, as the controller decides by
// capability, whatever the user agent (K13, ADR 0036).
describe('Dashboard volume', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
  const WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36'

  it('shows the volume slider when the volume can be changed', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
    render(<PlayerPage />)

    expect(screen.getByRole('slider', { name: 'Volume' })).toBeTruthy()
  })

  it('hides the volume slider when the volume cannot be changed (K13)', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(WINDOWS)
    player.volumeControllable = false
    render(<PlayerPage />)

    expect(screen.queryByRole('slider', { name: 'Volume' })).toBeNull()
  })
})

describe('Dashboard current song', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    window.RADPLAPAG_CONFIG = {
      streamUrl: 'https://radio.test/live.mp3',
      siteTitle: 'Radio Test',
      themeColor: 'neutral',
      visualizer: 'oscilloscope',
      timezoneOffset: 0,
      showSong: true,
    }
    fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ icestats: { source: { title: 'A - B' } } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
    )
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    delete window.RADPLAPAG_CONFIG
  })

  it('does not ask for the song while the welcome audio plays (ADR 0068)', async () => {
    setPlayer('playing')
    player.introLocked = true
    const { rerender } = render(<PlayerPage />)
    await act(() => Promise.resolve())
    expect(fetchSpy).not.toHaveBeenCalled()

    player.introLocked = false
    rerender(<PlayerPage />)
    expect(await screen.findByText('A - B')).toBeTruthy()
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://radio.test/status-json.xsl')
  })
})

describe('Dashboard canvas', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The canvas is decorative, never announced (K123, ADR 0072).
  it('hides the canvas from assistive technology', () => {
    setPlayer('playing')
    player.canVisualize = true
    render(<PlayerPage />)
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(canvas.hasAttribute('role')).toBe(false)
    expect(canvas.hasAttribute('aria-label')).toBe(false)
    expect(screen.queryByRole('img')).toBeNull()
  })

  // The size of the canvas, at the density of the screen, belongs to
  // useAudioVisualizer, not to the PlayerPage (K116, K117).
  it('leaves the canvas size to the visualizer hook on resize', () => {
    render(<PlayerPage />)
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const before = [canvas.width, canvas.height]
    act(() => {
      vi.stubGlobal('innerWidth', 390)
      vi.stubGlobal('innerHeight', 844)
      window.dispatchEvent(new Event('resize'))
    })
    expect([canvas.width, canvas.height]).toEqual(before)
  })

  // With prefers-reduced-motion: reduce the player looks as with no visualizer, also
  // when the preference changes while playing (K124, ADR 0072).
  describe('with prefers-reduced-motion', () => {
    let reduce = false
    const listeners = new Set<() => void>()

    beforeEach(() => {
      reduce = false
      listeners.clear()
      vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
          ({
            get matches() {
              return query.includes('prefers-reduced-motion: reduce') && reduce
            },
            media: query,
            addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
            removeEventListener: (_type: string, listener: () => void) =>
              listeners.delete(listener),
            addListener: (listener: () => void) => listeners.add(listener),
            removeListener: (listener: () => void) => listeners.delete(listener),
          }) as unknown as MediaQueryList,
      )
      setPlayer('playing')
      player.canVisualize = true
    })

    function setReduce(value: boolean) {
      act(() => {
        reduce = value
        listeners.forEach((listener) => listener())
      })
    }

    function drawing() {
      const active = visualizerCalls[visualizerCalls.length - 1][2]
      const canvas = document.querySelector('canvas') as HTMLCanvasElement
      return { active, opacity: getComputedStyle(canvas).opacity }
    }

    it('does not draw the visualizer and shows the playing dots instead', () => {
      reduce = true
      render(<PlayerPage />)
      expect(drawing()).toEqual({ active: false, opacity: '0' })
      expect(document.querySelector('.loader')).not.toBeNull()
    })

    it('stops drawing when the preference turns on while playing, and back', () => {
      render(<PlayerPage />)
      expect(drawing()).toEqual({ active: true, opacity: '1' })
      setReduce(true)
      expect(drawing()).toEqual({ active: false, opacity: '0' })
      setReduce(false)
      expect(drawing()).toEqual({ active: true, opacity: '1' })
    })
  })
})
