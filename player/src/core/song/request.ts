/** The fetch the methods of the current song use, injected (window.fetch in the player) */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

/** What one lookup of a method needs */
export interface MethodOptions {
  fetch: FetchLike
  /** Aborted by the poller on a pause, an error, a hidden page or a stream change */
  signal: AbortSignal
  /** The protocol of the page ('https:'), to never ask an http server from it */
  pageProtocol: string
}

/** The method does not work with this server: it is not tried again (ADR 0068) */
export const FAILED = { failed: true } as const

/** What one lookup gives: the song (null when the server has none right now), or FAILED */
export type MethodResult = { song: string | null } | typeof FAILED

/** One way of reading the song of a stream: Icecast status-json.xsl or ICY (ADR 0068) */
export type SongMethod = (options: MethodOptions) => Promise<MethodResult>

/** The options of every request (ADR 0068): CORS, no cookies, no cache */
export const requestInit = (
  signal: AbortSignal,
  headers?: Record<string, string>,
): RequestInit => ({
  mode: 'cors',
  credentials: 'omit',
  cache: 'no-store',
  ...(headers ? { headers } : {}),
  signal,
})

/**
 * The stream URL the methods may ask, or null: one that cannot be parsed, that is not
 * http(s), or http from an https page (mixed content: fetch does not upgrade it).
 */
export function requestableUrl(streamUrl: string, pageProtocol: string): URL | null {
  let url: URL
  try {
    url = new URL(streamUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return pageProtocol === 'https:' && url.protocol === 'http:' ? null : url
}

/**
 * The body of a response as text, reading at most limit bytes: past it the body is
 * cancelled and the result is null.
 *
 * @param limit - In bytes
 */
export async function readTextAtMost(response: Response, limit: number): Promise<string | null> {
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let read = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    read += value.length
    if (read > limit) {
      await reader.cancel()
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
}
