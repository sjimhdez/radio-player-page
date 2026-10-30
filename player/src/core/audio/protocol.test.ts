// Protocol detection by the suffix of the pathname, case-insensitive (ADR 0034), as in
// src/hooks/use-audio-player.test.tsx.
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
    ['https://radio.test/live.m3u8?token=x', 'hls'],
    ['https://radio.test/LIVE.M3U8', 'hls'],
    ['https://radio.test/live.m3u8#t', 'hls'],
    ['https://radio.test/live.mpd?token=x', 'dash'],
    ['https://radio.test/LIVE.MPD', 'dash'],
    ['/live.m3u8?token=x', 'hls'],
    ['https://radio.test/stream?format=.m3u8', 'direct'],
  ] as const)('detects %s by the suffix of its pathname (C2)', (url, protocol) => {
    expect(detectProtocol(url)).toBe(protocol)
  })

  it('treats a URL that cannot be parsed as a direct stream, without throwing (C2)', () => {
    expect(detectProtocol('http://[/live.m3u8')).toBe('direct')
  })
})
