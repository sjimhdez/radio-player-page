export type StreamProtocol = 'hls' | 'dash' | 'direct'

/** Resolves relative stream URLs; the core has no window.location. */
const BASE_URL = 'http://base.invalid'

/**
 * Detects the streaming protocol from the extension of the stream URL's pathname.
 *
 * Case-insensitive, ignoring the query string and the fragment; a relative URL is resolved
 * against a placeholder base, and one that cannot be parsed is direct (docs/known-issues.md
 * C2, fixed in spec 0007, ADR 0034).
 *
 * @param url - Stream URL
 * @returns 'hls' for .m3u8, 'dash' for .mpd, 'direct' for anything else (MP3, OGG...)
 */
export function detectProtocol(url: string): StreamProtocol {
  let pathname: string
  try {
    pathname = new URL(url, BASE_URL).pathname.toLowerCase()
  } catch {
    return 'direct'
  }
  if (pathname.endsWith('.m3u8')) return 'hls'
  if (pathname.endsWith('.mpd')) return 'dash'
  return 'direct'
}
