/**
 * Why the stream failed, as far as the browser tells (ADR 0065). It is shown only to
 * users who can manage_options; the listener's message does not change.
 *
 * - mixed-content: an http stream on an https page.
 * - http: the status of an HTTP error that hls.js or dashjs saw.
 * - unreachable: status 0 or MediaError 2. No CORS, a server that is down and a
 *   blocked request look the same to the browser.
 * - not-supported: MediaError 3 or 4, or NotSupportedError after the retry without
 *   crossOrigin. On a direct source it includes a 404, which looks the same.
 * - reconnect-exhausted: the reconnection ran out of attempts (ADR 0061).
 */
export type ErrorReason =
  | { code: 'mixed-content' | 'not-supported' | 'unreachable' | 'reconnect-exhausted' }
  | { code: 'http'; status: number }

/** What is known when a load fails */
export interface FailureFacts {
  /** The protocol of the page, as location.protocol gives it ('https:') */
  pageProtocol: string
  /** The URL that was loaded */
  url: string
  /** The HTTP status of the error of hls.js or dashjs; 0 without a response */
  status?: number
  /** The code of audio.error, if any */
  mediaErrorCode?: number | null
  /** What the rejected play() threw */
  rejection?: unknown
}

/** MediaError.MEDIA_ERR_NETWORK */
const MEDIA_ERR_NETWORK = 2
/** MediaError.MEDIA_ERR_DECODE */
const MEDIA_ERR_DECODE = 3
/** MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED */
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

/**
 * Decides the reason of a failed load. The schemes go first: an http stream on an
 * https page fails for that whatever the error says.
 *
 * @returns The reason, or null when nothing tells it (NotAllowedError, an attempt that
 *   timed out)
 */
export function errorReason({
  pageProtocol,
  url,
  status,
  mediaErrorCode,
  rejection,
}: FailureFacts): ErrorReason | null {
  if (pageProtocol === 'https:' && /^http:/i.test(url)) return { code: 'mixed-content' }
  if (status !== undefined) return status > 0 ? { code: 'http', status } : { code: 'unreachable' }
  if (mediaErrorCode === MEDIA_ERR_NETWORK) return { code: 'unreachable' }
  if (
    mediaErrorCode === MEDIA_ERR_DECODE ||
    mediaErrorCode === MEDIA_ERR_SRC_NOT_SUPPORTED ||
    (rejection instanceof DOMException && rejection.name === 'NotSupportedError')
  ) {
    return { code: 'not-supported' }
  }
  return null
}
