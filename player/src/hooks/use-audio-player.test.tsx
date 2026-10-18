// Characterization of use-audio-player (spec 0002, task 1.15). ADR 0004: direct
// sources set crossOrigin = 'anonymous'; the MSE paths (hls.js, dashjs) do not.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import useAudioPlayer from 'src/hooks/use-audio-player'
import { installFakeAudio, media } from 'src/test/fake-audio'

type Handler = (event?: unknown, data?: { fatal: boolean }) => void

// The hook loads hls.js and dashjs with dynamic import(); vi.mock intercepts both.
const hls = vi.hoisted(() => ({
  instances: [] as Array<{
    handlers: Record<string, Handler>
    loadSource: ReturnType<typeof vi.fn>
    attachMedia: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }>,
  supported: true,
}))
vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' }
    static isSupported = () => hls.supported
    handlers: Record<string, Handler> = {}
    loadSource = vi.fn()
    attachMedia = vi.fn()
    destroy = vi.fn()
    on = (event: string, cb: Handler) => {
      this.handlers[event] = cb
    }
    constructor() {
      hls.instances.push(this)
    }
  }
  return { default: FakeHls }
})

const dash = vi.hoisted(() => ({
  players: [] as Array<{
    handlers: Record<string, () => void>
    initialize: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
  }>,
}))
vi.mock('dashjs', () => ({
  MediaPlayer: () => ({
    create: () => {
      const player = {
        handlers: {} as Record<string, () => void>,
        initialize: vi.fn(),
        reset: vi.fn(),
        on: (event: string, cb: () => void) => {
          player.handlers[event] = cb
        },
      }
      dash.players.push(player)
      return player
    },
  }),
}))

const MP3 = 'https://radio.test/live.mp3'
const HLS = 'https://radio.test/live.m3u8'
const DASH = 'https://radio.test/live.mpd'
const INTRO = 'https://site.test/intro.mp3'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'

type Api = ReturnType<typeof useAudioPlayer>

function Harness(props: { streamUrl: string; introUrl?: string; api: { current: Api } }) {
  const player = useAudioPlayer(props.streamUrl, props.introUrl)
  props.api.current = player
  return <audio ref={player.audioRef} />
}

function mount(streamUrl: string, introUrl?: string) {
  const api = {} as { current: Api }
  const view = render(<Harness streamUrl={streamUrl} introUrl={introUrl} api={api} />)
  const audio = view.container.querySelector('audio')!
  const rerender = (url: string) =>
    view.rerender(<Harness streamUrl={url} introUrl={introUrl} api={api} />)
  return { api, audio, rerender, unmount: view.unmount }
}

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value })
}

let restoreAudio: () => void

beforeEach(() => {
  restoreAudio = installFakeAudio()
  hls.instances = []
  hls.supported = true
  dash.players = []
  setUserAgent(DESKTOP)
})

afterEach(() => {
  restoreAudio()
})

describe('direct streams', () => {
  it('plays an MP3 by assigning src with crossOrigin anonymous', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    expect(audio.src).toBe(MP3)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledWith(MP3)
    expect(api.current.status).toBe('playing')
  })

  it('starts idle with nothing loaded', () => {
    const { api, audio } = mount(MP3)
    expect(api.current.status).toBe('idle')
    expect(api.current.loading).toBe(false)
    expect(api.current.introLocked).toBe(false)
    expect(audio.getAttribute('src')).toBeNull()
  })

  it('sets error when play() rejects', async () => {
    media.failing.add(MP3)
    const { api } = mount(MP3)
    await act(() => api.current.play())
    expect(api.current.status).toBe('error')
    expect(api.current.loading).toBe(false)
  })

  it('is loading while play() is pending', async () => {
    media.hold = true
    const { api } = mount(MP3)
    let done!: Promise<void>
    await act(async () => {
      done = api.current.play()
    })
    expect(api.current.loading).toBe(true)
    await act(async () => {
      media.release()
      await done
    })
    expect(api.current.loading).toBe(false)
    expect(api.current.status).toBe('playing')
  })

  it('pauses and resumes the loaded source without reloading it', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    act(() => api.current.pause())
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(api.current.status).toBe('paused')
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(audio.src).toBe(MP3)
    expect(api.current.status).toBe('playing')
  })

  it('does nothing on play() when the loaded source is already playing', async () => {
    const { api } = mount(MP3)
    await act(() => api.current.play())
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(1)
  })

  it('reloads the stream on play() after an error', async () => {
    media.failing.add(MP3)
    const { api } = mount(MP3)
    await act(() => api.current.play())
    media.failing.clear()
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(api.current.status).toBe('playing')
  })
})

describe('HLS', () => {
  it('uses hls.js on non-iOS without crossOrigin and plays on MANIFEST_PARSED', async () => {
    const { api, audio } = mount(HLS)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(1)
    const instance = hls.instances[0]
    expect(instance.loadSource).toHaveBeenCalledWith(HLS)
    expect(instance.attachMedia).toHaveBeenCalledWith(audio)
    expect(media.play).not.toHaveBeenCalled()
    await act(async () => instance.handlers.hlsManifestParsed())
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.crossOrigin).toBeNull()
  })

  // docs/known-issues.md K11
  it('currently reports playing before MANIFEST_PARSED', async () => {
    const { api } = mount(HLS)
    await act(() => api.current.play())
    expect(media.play).not.toHaveBeenCalled()
    expect(api.current.status).toBe('playing')
  })

  it('sets error when play() after MANIFEST_PARSED rejects', async () => {
    // The fake attachMedia() leaves src empty, so play() runs on ''.
    media.failing.add('')
    const { api } = mount(HLS)
    await act(() => api.current.play())
    await act(async () => {
      hls.instances[0].handlers.hlsManifestParsed()
    })
    expect(api.current.status).toBe('error')
  })

  it('sets error on a fatal hls.js error only', async () => {
    const { api } = mount(HLS)
    await act(() => api.current.play())
    act(() => hls.instances[0].handlers.hlsError(undefined, { fatal: false }))
    expect(api.current.status).toBe('playing')
    act(() => hls.instances[0].handlers.hlsError(undefined, { fatal: true }))
    expect(api.current.status).toBe('error')
  })

  it('falls back to native HLS with crossOrigin when hls.js is not supported', async () => {
    hls.supported = false
    const { api, audio } = mount(HLS)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(0)
    expect(audio.src).toBe(HLS)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.play).toHaveBeenCalledWith(HLS)
    expect(api.current.status).toBe('playing')
  })

  it('uses native HLS on iOS with crossOrigin, without hls.js', async () => {
    setUserAgent(IPHONE)
    const { api, audio } = mount(HLS)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(0)
    expect(audio.src).toBe(HLS)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.play).toHaveBeenCalledWith(HLS)
  })

  // docs/known-issues.md K12
  it('currently recreates hls.js when resuming after a pause', async () => {
    const { api } = mount(HLS)
    await act(() => api.current.play())
    act(() => api.current.pause())
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(2)
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
  })
})

describe('DASH', () => {
  it('uses dashjs with autoplay and without crossOrigin', async () => {
    const { api, audio } = mount(DASH)
    await act(() => api.current.play())
    expect(dash.players).toHaveLength(1)
    expect(dash.players[0].initialize).toHaveBeenCalledWith(audio, DASH, true)
    expect(audio.crossOrigin).toBeNull()
    expect(media.play).not.toHaveBeenCalled()
    expect(api.current.status).toBe('playing')
  })

  it('sets error on a dashjs error', async () => {
    const { api } = mount(DASH)
    await act(() => api.current.play())
    act(() => dash.players[0].handlers.error())
    expect(api.current.status).toBe('error')
  })
})

// docs/known-issues.md C2: detection is endsWith() on the whole URL.
describe('protocol detection (C2)', () => {
  it.each([
    'https://radio.test/live.m3u8?token=x',
    'https://radio.test/LIVE.M3U8',
    'https://radio.test/live.mpd?token=x',
    'https://radio.test/LIVE.MPD',
  ])('currently treats %s as a direct stream', async (url) => {
    const { api, audio } = mount(url)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(0)
    expect(dash.players).toHaveLength(0)
    expect(audio.src).toBe(url)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.play).toHaveBeenCalledWith(url)
  })
})

describe('welcome audio (intro)', () => {
  it('plays the intro first with crossOrigin and locks the controls', async () => {
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())
    expect(audio.src).toBe(INTRO)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(api.current.introLocked).toBe(true)
    expect(api.current.status).toBe('playing')
  })

  it('cannot be paused while it plays', async () => {
    const { api } = mount(MP3, INTRO)
    await act(() => api.current.play())
    act(() => api.current.pause())
    expect(media.pause).not.toHaveBeenCalled()
    expect(api.current.status).toBe('playing')
  })

  it('ignores play() while it plays', async () => {
    const { api } = mount(MP3, INTRO)
    await act(() => api.current.play())
    await act(() => api.current.play())
    expect(media.play).toHaveBeenCalledTimes(1)
  })

  it('switches to the live stream on ended and unlocks', async () => {
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())
    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })
    expect(audio.src).toBe(MP3)
    expect(audio.crossOrigin).toBe('anonymous')
    expect(api.current.introLocked).toBe(false)
    expect(api.current.status).toBe('playing')
    act(() => api.current.pause())
    expect(api.current.status).toBe('paused')
  })

  it('ignores ended on the live stream', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })
    expect(media.load).toHaveBeenCalledTimes(1)
  })

  it('falls through to the live stream silently when it fails', async () => {
    media.failing.add(INTRO)
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())
    expect(audio.src).toBe(MP3)
    expect(api.current.introLocked).toBe(false)
    expect(api.current.status).toBe('playing')
  })

  it('sets error when it fails and the live stream fails too', async () => {
    media.failing.add(INTRO)
    media.failing.add(MP3)
    const { api } = mount(MP3, INTRO)
    await act(() => api.current.play())
    expect(api.current.status).toBe('error')
    expect(api.current.loading).toBe(false)
  })

  it('plays only once per hook instance', async () => {
    const { api } = mount(MP3, INTRO)
    await act(() => api.current.play())
    await act(async () => {
      document.querySelector('audio')!.dispatchEvent(new Event('ended'))
    })
    act(() => api.current.pause())
    await act(() => api.current.play())
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3, MP3])
  })
})

describe('audio element events', () => {
  it('maps playing, pause and error to the status', async () => {
    const { api, audio } = mount(MP3)
    act(() => {
      audio.dispatchEvent(new Event('playing'))
    })
    expect(api.current.status).toBe('playing')
    act(() => {
      audio.dispatchEvent(new Event('pause'))
    })
    expect(api.current.status).toBe('paused')
    act(() => {
      audio.dispatchEvent(new Event('error'))
    })
    expect(api.current.status).toBe('error')
  })

  it('sets loading on waiting and clears it on playing', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    act(() => {
      audio.dispatchEvent(new Event('waiting'))
    })
    expect(api.current.loading).toBe(true)
    act(() => {
      audio.dispatchEvent(new Event('playing'))
    })
    expect(api.current.loading).toBe(false)
  })

  it('clears loading on canplay only when idle or in error', async () => {
    const { api, audio } = mount(MP3)
    act(() => {
      audio.dispatchEvent(new Event('waiting'))
    })
    act(() => {
      audio.dispatchEvent(new Event('canplay'))
    })
    expect(api.current.loading).toBe(false)

    act(() => {
      audio.dispatchEvent(new Event('pause'))
    })
    act(() => {
      audio.dispatchEvent(new Event('waiting'))
    })
    act(() => {
      audio.dispatchEvent(new Event('canplay'))
    })
    expect(api.current.loading).toBe(true)
  })
})

describe('volume', () => {
  it('starts at 1 and applies changes to the element', () => {
    const { api, audio } = mount(MP3)
    expect(api.current.volume).toBe(1)
    expect(audio.volume).toBe(1)
    act(() => api.current.handleVolumeChange(0.4))
    expect(api.current.volume).toBe(0.4)
    expect(audio.volume).toBe(0.4)
  })

  it('ignores changes on iOS', () => {
    setUserAgent(IPHONE)
    const { api, audio } = mount(MP3)
    act(() => api.current.handleVolumeChange(0.4))
    expect(api.current.volume).toBe(1)
    expect(audio.volume).toBe(1)
  })
})

describe('cleanup', () => {
  it('destroys hls.js on unmount', async () => {
    const { api, unmount } = mount(HLS)
    await act(() => api.current.play())
    unmount()
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('resets dashjs on unmount', async () => {
    const { api, unmount } = mount(DASH)
    await act(() => api.current.play())
    unmount()
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
  })

  it('removes its audio listeners on unmount', async () => {
    const { audio, unmount } = mount(MP3, INTRO)
    unmount()
    audio.dispatchEvent(new Event('ended'))
    expect(media.load).not.toHaveBeenCalled()
  })

  it('destroys the previous player on the next play() after a stream change', async () => {
    const { api, rerender } = mount(HLS)
    await act(() => api.current.play())
    rerender(DASH)
    expect(hls.instances[0].destroy).not.toHaveBeenCalled()
    await act(() => api.current.play())
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
    expect(dash.players[0].initialize).toHaveBeenCalledWith(expect.anything(), DASH, true)
  })

  it('loads the new direct stream on play() after a stream change', async () => {
    const next = 'https://radio.test/other.mp3'
    const { api, audio, rerender } = mount(MP3)
    await act(() => api.current.play())
    rerender(next)
    await act(() => api.current.play())
    expect(audio.src).toBe(next)
    expect(media.load).toHaveBeenCalledTimes(2)
  })
})

// Audit of zone 5 (spec 0002, task 4.6): rows of docs/known-issues.md.
describe('audit (spec 0002, 4.6)', () => {
  it('currently stays locked in the welcome audio when the live stream fails after it (K63)', async () => {
    media.failing.add(MP3)
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())

    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })

    expect(api.current.status).toBe('error')
    // Play stays disabled and play() returns early: no retry is possible.
    expect(api.current.introLocked).toBe(true)
    media.failing.clear()
    await act(() => api.current.play())
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3])
    expect(api.current.status).toBe('error')
  })

  it('currently stays locked when both the welcome audio and the live stream fail (K63)', async () => {
    media.failing.add(INTRO)
    media.failing.add(MP3)
    const { api } = mount(MP3, INTRO)

    await act(() => api.current.play())

    expect(api.current.status).toBe('error')
    expect(api.current.introLocked).toBe(true)
  })

  it('currently cannot resume when something else pauses the welcome audio (K63)', async () => {
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())

    act(() => {
      audio.pause()
    })
    await act(() => api.current.play())

    expect(api.current.status).toBe('paused')
    expect(api.current.introLocked).toBe(true)
    expect(media.play).toHaveBeenCalledTimes(1)
  })

  it('currently stays locked in error when the welcome audio errors while playing (K63)', async () => {
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())

    act(() => {
      audio.dispatchEvent(new Event('error'))
    })

    expect(api.current.status).toBe('error')
    expect(api.current.introLocked).toBe(true)
  })

  it('currently keeps loading after a pause while buffering (K64)', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    act(() => {
      audio.dispatchEvent(new Event('waiting'))
    })

    act(() => api.current.pause())
    act(() => {
      audio.dispatchEvent(new Event('canplay'))
    })

    // The spinner replaces Play while paused.
    expect(api.current.status).toBe('paused')
    expect(api.current.loading).toBe(true)
  })

  it('currently plays HLS on MANIFEST_PARSED after a pause pressed while it loads (K11)', async () => {
    const { api } = mount(HLS)
    await act(() => api.current.play())
    act(() => api.current.pause())
    expect(api.current.status).toBe('paused')

    await act(async () => {
      hls.instances[0].handlers.hlsManifestParsed()
    })

    expect(media.play).toHaveBeenCalledTimes(1)
    expect(api.current.status).toBe('playing')
  })

  it('currently keeps crossOrigin anonymous on the hls.js path after the welcome audio (K70)', async () => {
    const { api, audio } = mount(HLS, INTRO)
    await act(() => api.current.play())

    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })

    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(audio.crossOrigin).toBe('anonymous')
  })
})
