// Protocol detection (spec 0006, task 2.3). docs/known-issues.md C2: detection is
// endsWith() on the whole URL, as in src/hooks/use-audio-player.test.tsx.
import { describe, expect, it } from 'vitest'
import { detectProtocol } from 'src/core/audio/protocol'

describe('detectProtocol', () => {
  it.each([
    ['https://radio.test/live.m3u8', 'hls'],
    ['https://radio.test/live.mpd', 'dash'],
    ['https://radio.test/live.mp3', 'direct'],
    ['https://radio.test/live.ogg', 'direct'],
    ['https://radio.test/stream', 'direct'],
  ] as const)('detects %s as %s', (url, protocol) => {
    expect(detectProtocol(url)).toBe(protocol)
  })

  it.each([
    'https://radio.test/live.m3u8?token=x',
    'https://radio.test/LIVE.M3U8',
    'https://radio.test/live.mpd?token=x',
    'https://radio.test/LIVE.MPD',
  ])('currently treats %s as a direct stream (C2)', (url) => {
    expect(detectProtocol(url)).toBe('direct')
  })
})
