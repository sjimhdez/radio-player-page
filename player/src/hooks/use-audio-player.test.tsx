// Characterization of use-audio-player (spec 0002, task 1.15). ADR 0004: direct
// sources set crossOrigin = 'anonymous'; the MSE paths (hls.js, dashjs) do not.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode, useEffect } from 'react'
import { act, render } from '@testing-library/react'
import useAudioPlayer from 'src/hooks/use-audio-player'
import { installFakeAudio, media } from 'src/test/fake-audio'
import { installFakeWebAudio, webAudio } from 'src/test/fake-web-audio'

type Handler = (event?: unknown, data?: { fatal: boolean }) => void

// The hook loads hls.js and dashjs with dynamic import(); vi.mock intercepts both.
const hls = vi.hoisted(() => ({
  instances: [] as Array<{
    config: unknown
    handlers: Record<string, Handler>
    loadSource: ReturnType<typeof vi.fn>
    attachMedia: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }>,
  supported: true,
  /** Runs inside isSupported(): after the import, before the instance exists. */
  onSupported: undefined as (() => void) | undefined,
}))
vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' }
    static isSupported = () => {
      hls.onSupported?.()
      return hls.supported
    }
    handlers: Record<string, Handler> = {}
    loadSource = vi.fn()
    attachMedia = vi.fn()
    destroy = vi.fn()
    on = (event: string, cb: Handler) => {
      this.handlers[event] = cb
    }
    config: unknown
    constructor(config?: unknown) {
      this.config = config
      hls.instances.push(this)
    }
  }
  return { default: FakeHls }
})

const dash = vi.hoisted(() => ({
  players: [] as Array<{
    handlers: Record<string, (event: { error: { code: number } }) => void>
    initialize: ReturnType<typeof vi.fn>
    reset: ReturnType<typeof vi.fn>
  }>,
}))
vi.mock('dashjs', () => ({
  MediaPlayer: () => ({
    create: () => {
      const player = {
        handlers: {} as Record<string, (event: { error: { code: number } }) => void>,
        initialize: vi.fn(),
        clearDefaultUTCTimingSources: vi.fn(),
        reset: vi.fn(),
        on: (event: string, cb: (event: { error: { code: number } }) => void) => {
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
const SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0.1 Safari/605.1.15'
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'
const FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:131.0) Gecko/20100101 Firefox/131.0'

type Api = ReturnType<typeof useAudioPlayer>

// The hook result reaches the test through a callback, after each render.
function Harness(props: { streamUrl: string; introUrl?: string; onResult: (api: Api) => void }) {
  const { onResult } = props
  const player = useAudioPlayer(props.streamUrl, props.introUrl)
  const { audioRef } = player
  useEffect(() => onResult(player))
  return <audio ref={audioRef} />
}

const expose = (api: { current: Api }) => (result: Api) => {
  api.current = result
}

function mount(streamUrl: string, introUrl?: string) {
  const api = {} as { current: Api }
  const view = render(<Harness streamUrl={streamUrl} introUrl={introUrl} onResult={expose(api)} />)
  const audio = view.container.querySelector('audio')!
  const rerender = (url: string) =>
    view.rerender(<Harness streamUrl={url} introUrl={introUrl} onResult={expose(api)} />)
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
  hls.onSupported = undefined
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

  // docs/known-issues.md C7 (spec 0007, ADR 0032).
  it('reloads the live stream on play() after a pause (C7)', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    act(() => api.current.pause())
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(api.current.status).toBe('paused')
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(2)
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
    // Two loads for the failed attempt and its retry without crossOrigin (C1, ADR 0033).
    expect(media.load).toHaveBeenCalledTimes(3)
    expect(api.current.status).toBe('playing')
  })

  // docs/known-issues.md C1 (spec 0007, ADR 0033).
  it('plays an MP3 without CORS by retrying without crossOrigin (C1)', async () => {
    media.corsBlocked.add(MP3)
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    expect(media.play).toHaveBeenCalledTimes(2)
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(api.current.status).toBe('playing')
  })
})

// spec 0007, task 1.7 (K82, ADR 0031): the hook injects window.AudioContext and
// navigator.userAgent; the controller decides (src/core/audio/audio-controller.test.ts).
describe('visualization (K82)', () => {
  let restoreWebAudio: () => void
  beforeEach(() => {
    restoreWebAudio = installFakeWebAudio()
  })
  afterEach(() => restoreWebAudio())

  it('starts without a visualizer nor an analyser', () => {
    const { api } = mount(MP3)
    expect(api.current.canVisualize).toBe(false)
    expect(api.current.getAnalyser()).toBeNull()
    expect(webAudio.contexts).toHaveLength(0)
  })

  it('visualizes a direct stream with CORS through window.AudioContext', async () => {
    const { api, audio } = mount(MP3)
    await act(() => api.current.play())
    expect(api.current.canVisualize).toBe(true)
    const [context] = webAudio.contexts
    expect(context.createMediaElementSource).toHaveBeenCalledWith(audio)
    expect(api.current.getAnalyser()).toBe(context.analysers[0])
  })

  it('never creates the context in WebKit, read from navigator.userAgent', async () => {
    setUserAgent(SAFARI)
    const { api } = mount(MP3)
    await act(() => api.current.play())
    expect(api.current).toMatchObject({ status: 'playing', canVisualize: false })
    expect(webAudio.contexts).toHaveLength(0)
  })

  it('does not visualize without window.AudioContext', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { api } = mount(MP3)
    await act(() => api.current.play())
    expect(api.current).toMatchObject({ status: 'playing', canVisualize: false })
  })

  // Moved from use-can-visualize.test.tsx (spec 0007, task 1.8): the decision
  // follows the source, not the user agent on mount.
  it.each([
    ['chrome', CHROME],
    ['edge', EDGE],
    ['firefox', FIREFOX],
  ])('waits for a stream with CORS to visualize on %s', async (_name, userAgent) => {
    setUserAgent(userAgent)
    const { api } = mount(MP3)
    expect(api.current.canVisualize).toBe(false)
    await act(() => api.current.play())
    expect(api.current.canVisualize).toBe(true)
  })

  it.each([
    ['safari', SAFARI],
    ['iphone', IPHONE_SAFARI],
  ])('never visualizes on %s, also a same-origin stream', async (_name, userAgent) => {
    setUserAgent(userAgent)
    const { api } = mount(`${window.location.origin}/live.mp3`)
    await act(() => api.current.play())
    expect(api.current).toMatchObject({ status: 'playing', canVisualize: false })
    expect(webAudio.contexts).toHaveLength(0)
  })

  it('does not visualize a stream without CORS on Chrome', async () => {
    setUserAgent(CHROME)
    media.corsBlocked.add(MP3)
    const { api } = mount(MP3)
    await act(() => api.current.play())
    expect(api.current).toMatchObject({ status: 'playing', canVisualize: false })
  })

  it('does not visualize the welcome audio, then visualizes the live stream', async () => {
    setUserAgent(CHROME)
    const { api, audio } = mount(MP3, INTRO)
    await act(() => api.current.play())
    expect(api.current).toMatchObject({ introLocked: true, canVisualize: false })
    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })
    expect(api.current).toMatchObject({ introLocked: false, canVisualize: true })
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

  // hls.js 1.7 turned preferManagedMediaSource off by default; 3.4.2 shipped
  // with it on (spec 0003, task 1.1).
  it('creates hls.js preferring ManagedMediaSource', async () => {
    const { api } = mount(HLS)
    await act(() => api.current.play())
    expect(hls.instances[0].config).toEqual({ preferManagedMediaSource: true })
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

  // docs/known-issues.md C7 and K12 (spec 0007, ADR 0032).
  it('recreates hls.js to return to the live edge (C7)', async () => {
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
    act(() => dash.players[0].handlers.error({ error: { code: 17 } }))
    expect(api.current.status).toBe('error')
  })

  // docs/known-issues.md C7 and K12 (spec 0007, ADR 0032).
  it('recreates dashjs to return to the live edge (C7)', async () => {
    const { api } = mount(DASH)
    await act(() => api.current.play())
    act(() => api.current.pause())
    await act(() => api.current.play())
    expect(dash.players).toHaveLength(2)
    expect(dash.players[0].reset).toHaveBeenCalledTimes(1)
  })
})

// docs/known-issues.md C2, fixed in spec 0007: the suffix of the pathname, case-insensitive.
describe('protocol detection (C2)', () => {
  it.each([
    'https://radio.test/live.m3u8?token=x',
    'https://radio.test/LIVE.M3U8',
    'https://radio.test/live.m3u8#t',
  ])('detects %s as HLS by the suffix of its pathname (C2)', async (url) => {
    const { api } = mount(url)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].loadSource).toHaveBeenCalledWith(url)
    expect(dash.players).toHaveLength(0)
  })

  it.each(['https://radio.test/live.mpd?token=x', 'https://radio.test/LIVE.MPD'])(
    'detects %s as DASH by the suffix of its pathname (C2)',
    async (url) => {
      const { api, audio } = mount(url)
      await act(() => api.current.play())
      expect(dash.players).toHaveLength(1)
      expect(dash.players[0].initialize).toHaveBeenCalledWith(audio, url, true)
      expect(hls.instances).toHaveLength(0)
    },
  )

  it('plays a URL that cannot be parsed as a direct stream (C2)', async () => {
    const url = 'http://[/live.m3u8'
    const { api, audio } = mount(url)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(0)
    expect(dash.players).toHaveLength(0)
    expect(audio.src).toBe(url)
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
    // The live stream fails twice: with crossOrigin and on its retry (C1, ADR 0033).
    expect(media.play.mock.calls.map(([src]) => src)).toEqual([INTRO, MP3, MP3])
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

  it('clears crossOrigin on the hls.js path after the welcome audio (K70)', async () => {
    const { api, audio } = mount(HLS, INTRO)
    await act(() => api.current.play())

    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })

    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(audio.crossOrigin).toBeNull()
  })

  it('clears crossOrigin on the dashjs path after the welcome audio (K70)', async () => {
    const { api, audio } = mount(DASH, INTRO)
    await act(() => api.current.play())

    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })

    expect(dash.players).toHaveLength(1)
    expect(dash.players[0].initialize).toHaveBeenCalledWith(audio, DASH, true)
    expect(audio.crossOrigin).toBeNull()
  })
})

// Lifecycle (spec 0006, task 2.1): what the controller and its adapter must keep.
// main.tsx mounts the player in StrictMode, which mounts, unmounts and remounts
// every effect in development; the visualizers rely on a stable audioRef.
describe('lifecycle (spec 0006, 2.1)', () => {
  function mountStrict(streamUrl: string, introUrl?: string) {
    const api = {} as { current: Api }
    const view = render(
      <StrictMode>
        <Harness streamUrl={streamUrl} introUrl={introUrl} onResult={expose(api)} />
      </StrictMode>,
    )
    const audio = view.container.querySelector('audio')!
    return { api, audio, unmount: view.unmount }
  }

  it('loads and plays an MP3 once in StrictMode', async () => {
    const { api } = mountStrict(MP3)
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(api.current.status).toBe('playing')
    act(() => api.current.pause())
    expect(media.pause).toHaveBeenCalledTimes(1)
    expect(api.current.status).toBe('paused')
  })

  it('maps playing and pause to the status in StrictMode', () => {
    const { api, audio } = mountStrict(MP3)
    act(() => {
      audio.dispatchEvent(new Event('playing'))
    })
    expect(api.current.status).toBe('playing')
    act(() => {
      audio.dispatchEvent(new Event('pause'))
    })
    expect(api.current.status).toBe('paused')
  })

  it('listens to the audio element once in StrictMode', async () => {
    const { api, audio } = mountStrict(MP3, INTRO)
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(1)

    await act(async () => {
      audio.dispatchEvent(new Event('ended'))
    })

    // One ended handler: the live stream loads once, not once per mounted effect.
    expect(media.load).toHaveBeenCalledTimes(2)
    expect(media.load).toHaveBeenLastCalledWith(MP3)
    expect(api.current.introLocked).toBe(false)
  })

  it('creates and destroys hls.js once in StrictMode', async () => {
    const { api, audio, unmount } = mountStrict(HLS)
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    unmount()
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('keeps the same audioRef across renders', async () => {
    const { api, audio, rerender } = mount(MP3)
    const ref = api.current.audioRef
    expect(ref.current).toBe(audio)

    await act(() => api.current.play())
    expect(api.current.audioRef).toBe(ref)
    act(() => api.current.pause())
    expect(api.current.audioRef).toBe(ref)
    act(() => api.current.handleVolumeChange(0.4))
    expect(api.current.audioRef).toBe(ref)
    rerender('https://radio.test/other.mp3')
    expect(api.current.audioRef).toBe(ref)
    expect(ref.current).toBe(audio)
  })

  it('keeps the same audioRef in StrictMode', async () => {
    const { api, audio } = mountStrict(MP3)
    const ref = api.current.audioRef
    expect(ref.current).toBe(audio)
    await act(() => api.current.play())
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(api.current.audioRef).toBe(ref)
    expect(ref.current).toBe(audio)
  })

  it('keeps the changed volume on the element after another render', async () => {
    const { api, audio, rerender } = mount(MP3)
    act(() => api.current.handleVolumeChange(0.4))

    rerender('https://radio.test/other.mp3')
    expect(audio.volume).toBe(0.4)
    expect(api.current.volume).toBe(0.4)

    await act(() => api.current.play())
    expect(audio.volume).toBe(0.4)
    expect(api.current.volume).toBe(0.4)
  })

  it('applies a volume change in StrictMode', () => {
    const { api, audio } = mountStrict(MP3)
    act(() => api.current.handleVolumeChange(0.4))
    expect(audio.volume).toBe(0.4)
    expect(api.current.volume).toBe(0.4)
  })
})

// Concurrency suspicions of the 0002 triage (spec 0006 §4.5, task 2.2), against the
// hook of today. The core answers them again in task 2.10, which fixes K80.
describe('concurrency (spec 0006, 2.2)', () => {
  // docs/known-issues.md K80, fixed in the audio controller (task 2.10): the second
  // play() gets the pending one. Two play() in the same tick cannot be tested here:
  // while an import() of a vi.mock'ed module is in flight, the next one resolves to
  // the real module (Vitest 5.0.5). The second play() comes in the same window
  // instead: the first one has loaded hls.js and has not created its instance yet.
  it('keeps a single hls.js alive after a second play() while it loads (K80)', async () => {
    const { api, audio, unmount } = mount(HLS)
    let second!: Promise<void>
    hls.onSupported = () => {
      hls.onSupported = undefined
      second = api.current.play()
    }
    await act(async () => {
      await api.current.play()
      await second
    })

    // The same as a single call: one instance, attached once.
    expect(hls.instances).toHaveLength(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledTimes(1)
    expect(hls.instances[0].attachMedia).toHaveBeenCalledWith(audio)
    expect(api.current.status).toBe('playing')

    unmount()
    expect(hls.instances[0].destroy).toHaveBeenCalledTimes(1)
  })

  // docs/known-issues.md K81: a browser rejects the pending play() with AbortError
  // when pause() interrupts it.
  it('currently reports an error when a pause interrupts the loading MP3 (K81)', async () => {
    media.hold = true
    const { api } = mount(MP3)
    let done!: Promise<void>
    await act(async () => {
      done = api.current.play()
    })
    act(() => api.current.pause())
    expect(api.current.status).toBe('paused')

    await act(async () => {
      media.fail('AbortError')
      await done
    })

    // The UI shows "Unable to play the stream" instead of Play.
    expect(api.current.status).toBe('error')
    expect(api.current.loading).toBe(false)
  })
})

// ADR 0030 (spec 0006, task 2.11): the render order. In Chromium a failing MP3 fires
// 'error' (and play() rejects, also on its retry) in one task and 'pause' in a later one.
// Since spec 0007 the 'pause' keeps the 'error' state (docs/known-issues.md K1): the alert
// shows and stays. Here the microtasks stand for the end of the task.
describe('render order (spec 0006, 2.11)', () => {
  const globals = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  let actEnvironment: boolean | undefined
  beforeEach(() => {
    // Outside act(), React schedules the renders as in a browser.
    actEnvironment = globals.IS_REACT_ACT_ENVIRONMENT
    globals.IS_REACT_ACT_ENVIRONMENT = false
  })
  afterEach(() => {
    globals.IS_REACT_ACT_ENVIRONMENT = actEnvironment
  })

  it('renders the error of a failing MP3 and keeps it after the pause (K1)', async () => {
    media.hold = true
    const api = {} as { current: Api }
    const rendered: string[] = []
    const view = render(
      <Harness
        streamUrl={MP3}
        onResult={(result) => {
          api.current = result
          rendered.push(result.status)
        }}
      />,
    )
    const audio = view.container.querySelector('audio')!
    const done = api.current.play()

    audio.dispatchEvent(new Event('error'))
    media.fail()
    // The retry without crossOrigin fails too, as with a 404 (C1, ADR 0033).
    for (let i = 0; i < 10; i++) await Promise.resolve()
    expect(media.pending).toHaveLength(1)
    audio.dispatchEvent(new Event('error'))
    media.fail()
    await done
    for (let i = 0; i < 10; i++) await Promise.resolve()
    await vi.waitFor(() => expect(rendered).toContain('error'))
    audio.dispatchEvent(new Event('pause'))
    // A real task, so that React renders whatever the pause changed.
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(api.current).toMatchObject({ status: 'error', loading: false })
    expect(rendered).not.toContain('paused')
  })
})
