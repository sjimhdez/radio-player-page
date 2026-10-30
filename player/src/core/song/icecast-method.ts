import { songFromStatus } from 'src/core/song/icecast-status'
import {
  FAILED,
  readTextAtMost,
  requestableUrl,
  requestInit,
  type MethodOptions,
  type MethodResult,
  type SongMethod,
} from 'src/core/song/request'

/** The most of a status-json.xsl the player reads, in bytes: ~250 mounts (ADR 0068) */
export const MAX_STATUS_BYTES = 256 * 1024

/**
 * The URLs of status-json.xsl for a stream, in order: at the root of its origin and,
 * when its path has more than one segment, in the directory of the mount (AzuraCast:
 * /listen/<station>/status-json.xsl).
 */
function candidatesFor(url: URL): string[] {
  const root = `${url.origin}/status-json.xsl`
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length < 2) return [root]
  const directory = url.pathname.slice(0, url.pathname.lastIndexOf('/'))
  return [root, `${url.origin}${directory}/status-json.xsl`]
}

/**
 * One request to a status-json.xsl: FAILED unless it answers OK with JSON of at most
 * MAX_STATUS_BYTES. A body that is not JSON (a Shoutcast answers with its stream) is
 * cancelled unread.
 */
async function lookUp(
  url: string,
  streamUrl: string,
  { fetch, signal }: MethodOptions,
): Promise<MethodResult> {
  try {
    const response = await fetch(url, requestInit(signal))
    if (!response.ok || !/json/i.test(response.headers.get('Content-Type') ?? '')) {
      await response.body?.cancel()
      return FAILED
    }
    const text = await readTextAtMost(response, MAX_STATUS_BYTES)
    return text === null ? FAILED : { song: songFromStatus(text, streamUrl) }
  } catch {
    // Blocked by CORS, the network, or aborted.
    return FAILED
  }
}

/**
 * The song from the Icecast status-json.xsl of the stream server (ADR 0068). The
 * first lookup tries the candidate URLs in order; the one that answers is the only one
 * asked from then on. Never asks an http server from an https page.
 */
export function createIcecastMethod(streamUrl: string): SongMethod {
  let found: string | null = null

  return async (options) => {
    const url = requestableUrl(streamUrl, options.pageProtocol)
    if (url === null) return FAILED
    if (found !== null) return lookUp(found, streamUrl, options)
    for (const candidate of candidatesFor(url)) {
      const result = await lookUp(candidate, streamUrl, options)
      if (result !== FAILED) {
        found = candidate
        return result
      }
    }
    return FAILED
  }
}
