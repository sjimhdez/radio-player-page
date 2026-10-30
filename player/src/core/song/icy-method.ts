import { icyBlockAt, songFromIcyBlock } from 'src/core/song/icy'
import { FAILED, requestableUrl, requestInit, type SongMethod } from 'src/core/song/request'

/**
 * The largest icy-metaint the player reads through, in bytes: the servers measured send
 * 8-32 KB, and a larger one would download that much audio on each lookup (ADR 0069).
 */
export const MAX_ICY_METAINT = 64 * 1024

/** The bytes read so far followed by chunk */
function append(bytes: Uint8Array, chunk: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length + chunk.length)
  out.set(bytes)
  out.set(chunk, bytes.length)
  return out
}

/**
 * The song from the ICY metadata inside the stream (ADR 0068). Asks the stream
 * with Icy-MetaData: 1, reads up to the first block (icy-metaint must be exposed by
 * CORS) and aborts its own request, always: each lookup is one more listener on the
 * server for as long as it lasts. Never asks an http stream from an https page.
 */
export function createIcyMethod(streamUrl: string): SongMethod {
  return async ({ fetch, signal, pageProtocol }) => {
    if (signal.aborted || requestableUrl(streamUrl, pageProtocol) === null) return FAILED
    const own = new AbortController()
    const abort = () => own.abort()
    signal.addEventListener('abort', abort)
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    try {
      const response = await fetch(streamUrl, requestInit(own.signal, { 'Icy-MetaData': '1' }))
      const metaint = Number(response.headers.get('icy-metaint'))
      if (response.body === null) return FAILED
      reader = response.body.getReader()
      if (!response.ok || !Number.isInteger(metaint) || metaint <= 0 || metaint > MAX_ICY_METAINT) {
        return FAILED
      }
      let bytes: Uint8Array = new Uint8Array(0)
      while (!own.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) return FAILED
        bytes = append(bytes, value)
        const block = icyBlockAt(bytes, metaint)
        if (block !== null) return { song: songFromIcyBlock(block) }
      }
      return FAILED
    } catch {
      // Blocked by CORS, the network, or aborted.
      return FAILED
    } finally {
      signal.removeEventListener('abort', abort)
      own.abort()
      await reader?.cancel().catch(() => {})
    }
  }
}
