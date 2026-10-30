// Which source of the current song a stream gets (ADR 0068): status-json.xsl then ICY
// for direct audio, the ID3 cues for HLS, nothing for DASH.
import { describe, expect, it, vi } from 'vitest'
import { createCurrentSong, ICY_INTERVAL_MS } from 'src/core/song/current-song'
import { createFakeClock } from 'src/test/fake-clock'
import { createFakeFetch } from 'src/test/fake-fetch'
import { FakeTrack, FakeTrackList, vttCue } from 'src/test/fake-text-tracks'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function make(streamUrl: string) {
  const fake = createFakeClock(0)
  const { fetch } = createFakeFetch({
    'https://radio.test/status-json.xsl': () =>
      new Response(JSON.stringify({ icestats: { source: { title: 'Song' } } }), {
        headers: { 'Content-Type': 'application/json' },
      }),
  })
  const song = createCurrentSong({
    streamUrl,
    fetch,
    clock: fake.clock,
    visibility: { isVisible: () => true, subscribe: () => () => {} },
    pageProtocol: 'https:',
  })
  return { song, fetch, fake }
}

describe('createCurrentSong', () => {
  it('polls status-json.xsl for direct audio, every 20 s', async () => {
    const { song, fetch, fake } = make('https://radio.test/live.mp3')
    song!.subscribe(() => {})
    song!.attach({ textTracks: new FakeTrackList() })
    song!.setPlaying(true)
    await flush()
    expect(song!.getSnapshot()).toBe('Song')
    fake.advance(20000)
    expect(fetch).toHaveBeenCalledTimes(2)
    song!.detach()
  })

  it('falls back to ICY in the stream, every 30 s', async () => {
    const { song, fetch } = make('https://other.test/live.mp3')
    song!.subscribe(() => {})
    song!.setPlaying(true)
    await flush()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://other.test/status-json.xsl',
      'https://other.test/live.mp3',
    ])
    expect(ICY_INTERVAL_MS).toBe(30000)
  })

  it('reads the ID3 cues for HLS, without requests', () => {
    const { song, fetch } = make('https://radio.test/hls/index.m3u8')
    const textTracks = new FakeTrackList()
    song!.subscribe(() => {})
    song!.attach({ textTracks })
    song!.setPlaying(true)
    textTracks.add(new FakeTrack('metadata')).show(vttCue('TIT2', 'Cue'))
    expect(song!.getSnapshot()).toBe('Cue')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('has nothing for DASH', () => {
    expect(make('https://radio.test/dash/manifest.mpd').song).toBeNull()
  })

  it('uses the global clock by default', () => {
    const song = createCurrentSong({
      streamUrl: 'https://radio.test/live.mp3',
      fetch: vi.fn(),
      visibility: { isVisible: () => false, subscribe: () => () => {} },
      pageProtocol: 'https:',
    })
    expect(song).not.toBeNull()
  })
})
