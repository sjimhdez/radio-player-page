import type { Clock } from 'src/core/clock/minute-ticker'
import { detectProtocol } from 'src/core/audio/protocol'
import { createIcecastMethod } from 'src/core/song/icecast-method'
import { createIcyMethod } from 'src/core/song/icy-method'
import { createId3Reader, type Id3Reader } from 'src/core/song/id3-cues'
import type { FetchLike } from 'src/core/song/request'
import { createSongPoller, type Visibility } from 'src/core/song/song-poller'

/** How often status-json.xsl is asked, in ms: it is cheap, and not a listener (ADR 0068) */
export const ICECAST_INTERVAL_MS = 20000

/** How often the ICY metadata is read, in ms: each read is one more listener (ADR 0068) */
export const ICY_INTERVAL_MS = 30000

/** The source of the current song of a stream, attached to the audio element */
export type CurrentSong = Id3Reader

/**
 * Creates the source of the current song for a stream, by its protocol (ADR 0068):
 * for direct audio, the poller with status-json.xsl (every 20 s) and then ICY in the
 * stream (every 30 s), which ignores the element; for HLS, the reader of the ID3 cues of
 * the element; for DASH, none.
 *
 * @param options.clock - Timers of the poller (the global ones by default)
 * @param options.pageProtocol - The protocol of the page ('https:')
 * @returns The source, or null for DASH
 */
export function createCurrentSong({
  streamUrl,
  fetch,
  clock,
  visibility,
  pageProtocol,
}: {
  streamUrl: string
  fetch: FetchLike
  clock?: Clock
  visibility: Visibility
  pageProtocol: string
}): CurrentSong | null {
  switch (detectProtocol(streamUrl)) {
    case 'hls':
      return createId3Reader()
    case 'dash':
      return null
    case 'direct':
      return {
        ...createSongPoller({
          methods: [
            { lookUp: createIcecastMethod(streamUrl), intervalMs: ICECAST_INTERVAL_MS },
            { lookUp: createIcyMethod(streamUrl), intervalMs: ICY_INTERVAL_MS },
          ],
          fetch,
          clock,
          visibility,
          pageProtocol,
        }),
        attach: () => {},
        detach: () => {},
      }
  }
}
