export type StreamProtocol = 'hls' | 'dash' | 'direct'

/**
 * Detects the streaming protocol from the stream URL extension.
 *
 * Matches the suffix of the whole URL, case-sensitive: a query string or an upper-case
 * extension falls through to 'direct' (docs/known-issues.md C2, fixed in spec 0007).
 *
 * @param url - Stream URL
 * @returns 'hls' for .m3u8, 'dash' for .mpd, 'direct' for anything else (MP3, OGG...)
 */
export function detectProtocol(url: string): StreamProtocol {
  if (url.endsWith('.m3u8')) return 'hls'
  if (url.endsWith('.mpd')) return 'dash'
  return 'direct'
}
