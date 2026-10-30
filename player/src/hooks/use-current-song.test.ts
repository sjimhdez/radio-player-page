// useCurrentSong: adapter of src/core/song/ for the player page, with window.fetch, the
// visibility of the document and the protocol of the page.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useCurrentSong from 'src/hooks/use-current-song'

const STREAM = 'https://radio.test/live.mp3'

let visibility: DocumentVisibilityState = 'visible'
let title = 'A - B'
let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  title = 'A - B'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
  fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
    if (String(input) !== 'https://radio.test/status-json.xsl') throw new TypeError('blocked')
    return new Response(JSON.stringify({ icestats: { source: { title } } }), {
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

afterEach(() => {
  vi.useRealTimers()
  delete (document as { visibilityState?: unknown }).visibilityState
})

function render(
  streamUrl: string,
  showSong: boolean,
  isPlaying: boolean,
  audio = document.createElement('audio'),
) {
  const audioRef = { current: audio }
  return {
    audioRef,
    ...renderHook(
      ({ playing }: { playing: boolean }) => useCurrentSong(streamUrl, showSong, playing, audioRef),
      { initialProps: { playing: isPlaying } },
    ),
  }
}

const settle = () => act(() => vi.advanceTimersByTimeAsync(0))

describe('useCurrentSong', () => {
  it('asks nothing and has no song without showSong', async () => {
    const { result } = render(STREAM, false, true)
    await settle()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('asks nothing until the stream plays', async () => {
    render(STREAM, true, false)
    await settle()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('gives the song of the server while the stream plays, and its changes', async () => {
    const { result } = render(STREAM, true, true)
    await settle()
    expect(result.current).toBe('A - B')
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ mode: 'cors', credentials: 'omit' })
    title = 'C - D'
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(result.current).toBe('C - D')
  })

  it('clears the song on a pause', async () => {
    const { result, rerender } = render(STREAM, true, true)
    await settle()
    rerender({ playing: false })
    expect(result.current).toBeNull()
  })

  it('stops while the page is hidden', async () => {
    const { result } = render(STREAM, true, true)
    await settle()
    visibility = 'hidden'
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(60000))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('clears the song and stops asking the old station when the stream changes', async () => {
    const audioRef = { current: document.createElement('audio') }
    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => useCurrentSong(url, true, true, audioRef),
      { initialProps: { url: STREAM } },
    )
    await settle()
    expect(result.current).toBe('A - B')
    rerender({ url: 'https://other.test/live.mp3' })
    expect(result.current).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(60000))
    const old = fetchSpy.mock.calls.filter((call: unknown[]) =>
      String(call[0]).startsWith('https://radio.test/'),
    )
    expect(old).toHaveLength(1)
    expect(result.current).toBeNull()
  })

  it('stops asking when it unmounts', async () => {
    const { unmount } = render(STREAM, true, true)
    await settle()
    unmount()
    await act(() => vi.advanceTimersByTimeAsync(60000))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('listens to the metadata tracks of the element for HLS, without requests', async () => {
    const audio = document.createElement('audio')
    const track = audio.addTextTrack('metadata')
    const listen = vi.spyOn(track, 'addEventListener')
    const remove = vi.spyOn(track, 'removeEventListener')
    const { unmount } = render('https://radio.test/hls/index.m3u8', true, true, audio)
    expect(listen).toHaveBeenCalledWith('cuechange', expect.any(Function))
    await settle()
    expect(fetchSpy).not.toHaveBeenCalled()
    unmount()
    expect(remove).toHaveBeenCalledWith('cuechange', expect.any(Function))
  })

  it('has no song for DASH', async () => {
    const { result } = render('https://radio.test/dash/manifest.mpd', true, true)
    await settle()
    expect(result.current).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
