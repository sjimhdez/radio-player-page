import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import useAudioPlayer from 'src/hooks/use-audio-player'
import { media } from './fake-audio'

// Dynamic import('hls.js') / import('dashjs') inside the hook are intercepted by vi.mock.
const hls = vi.hoisted(() => ({ instances: [] as any[], supported: true }))
vi.mock('hls.js', () => {
  class FakeHls {
    static Events = { MANIFEST_PARSED: 'manifestParsed', ERROR: 'hlsError' }
    static isSupported = () => hls.supported
    handlers: Record<string, Function> = {}
    loadSource = vi.fn()
    attachMedia = vi.fn()
    destroy = vi.fn()
    on = (e: string, cb: Function) => { this.handlers[e] = cb }
    constructor() { hls.instances.push(this) }
  }
  return { default: FakeHls }
})
const dash = vi.hoisted(() => ({ player: null as any }))
vi.mock('dashjs', () => ({
  MediaPlayer: () => ({
    create: () => (dash.player = { initialize: vi.fn(), on: vi.fn(), reset: vi.fn() }),
  }),
}))

type Api = ReturnType<typeof useAudioPlayer>
function mount(streamUrl: string, introUrl?: string) {
  const api = {} as { current: Api }
  function Harness() {
    const player = useAudioPlayer(streamUrl, introUrl)
    useEffect(() => { api.current = player })
    api.current = player
    return <audio ref={player.audioRef} />
  }
  const view = render(<Harness />)
  return { api, audio: view.container.querySelector('audio')! }
}

beforeEach(() => {
  hls.instances = []
  hls.supported = true
  dash.player = null
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (Macintosh)' })
})

describe('useAudioPlayer (spike R4)', () => {
  it('plays an MP3 stream directly with crossOrigin anonymous', async () => {
    const { api, audio } = mount('https://radio.test/live.mp3')
    await act(() => api.current.play())
    expect(audio.src).toBe('https://radio.test/live.mp3')
    expect(audio.crossOrigin).toBe('anonymous')
    expect(media.load).toHaveBeenCalledTimes(1)
    expect(api.current.status).toBe('playing')
  })

  it('plays HLS through hls.js on non-iOS and starts on MANIFEST_PARSED', async () => {
    const { api, audio } = mount('https://radio.test/live.m3u8')
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(1)
    const h = hls.instances[0]
    expect(h.loadSource).toHaveBeenCalledWith('https://radio.test/live.m3u8')
    expect(h.attachMedia).toHaveBeenCalledWith(audio)
    expect(media.play).not.toHaveBeenCalled()
    await act(async () => h.handlers.manifestParsed())
    expect(media.play).toHaveBeenCalledTimes(1)
    expect(audio.crossOrigin).toBeNull() // hls.js path does not set it (see report, R3)
  })

  it('plays DASH through dashjs with autoplay', async () => {
    const { api, audio } = mount('https://radio.test/live.mpd')
    await act(() => api.current.play())
    expect(dash.player.initialize).toHaveBeenCalledWith(audio, 'https://radio.test/live.mpd', true)
  })

  it('uses native HLS on iOS without loading hls.js', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)' })
    const { api, audio } = mount('https://radio.test/live.m3u8')
    await act(() => api.current.play())
    expect(hls.instances).toHaveLength(0)
    expect(audio.src).toBe('https://radio.test/live.m3u8')
    expect(audio.crossOrigin).toBe('anonymous')
  })

  it('plays the welcome audio first, cannot be paused, then switches to live on ended', async () => {
    const { api, audio } = mount('https://radio.test/live.mp3', 'https://site.test/intro.mp3')
    await act(() => api.current.play())
    expect(audio.src).toBe('https://site.test/intro.mp3')
    expect(api.current.introLocked).toBe(true)
    act(() => api.current.pause())
    expect(media.pause).not.toHaveBeenCalled()
    await act(async () => { audio.dispatchEvent(new Event('ended')) })
    expect(audio.src).toBe('https://radio.test/live.mp3')
    expect(api.current.introLocked).toBe(false)
  })

  it('falls through to live silently when the welcome audio fails', async () => {
    const { api, audio } = mount('https://radio.test/live.mp3', 'https://site.test/broken.mp3')
    media.playShouldFail = true
    const first = act(() => api.current.play())
    media.playShouldFail = false // only the intro fails (first play() call)
    await first
    expect(audio.src).toBe('https://radio.test/live.mp3')
    expect(api.current.status).toBe('playing')
  })
})
