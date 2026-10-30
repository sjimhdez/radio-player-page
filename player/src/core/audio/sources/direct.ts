import type { AudioSource } from 'src/core/audio/sources/types'

/**
 * Tells whether a play() rejection is a failure of the media, which a source
 * without CORS and a broken one (a 404) give alike. NotAllowedError (no gesture)
 * and AbortError (a pause or a new load) are not.
 */
const isMediaError = (error: unknown) =>
  error instanceof DOMException && error.name === 'NotSupportedError'

/**
 * Creates the source that assigns the URL to audio.src: MP3/OGG, native HLS and the
 * welcome audio. Sets crossOrigin = 'anonymous' after src, as the hook does (ADR 0004).
 * If play() fails with a media error, it retries once on the same element without
 * crossOrigin; a 404 cannot be told apart, so it fails twice (ADR 0033).
 *
 * @param options.retryWithoutCors - Whether the retry is allowed: not when the element
 *   goes through the Web Audio graph, where it would play silent
 * @returns A source whose destroy() does nothing
 */
export function createDirectSource({
  retryWithoutCors = false,
}: { retryWithoutCors?: boolean } = {}): AudioSource {
  let corsClean = true

  return {
    async start(audio, url) {
      corsClean = true
      audio.src = url
      audio.crossOrigin = 'anonymous'
      audio.load()
      try {
        await audio.play()
      } catch (error) {
        if (!retryWithoutCors || !isMediaError(error)) throw error
        corsClean = false
        audio.removeAttribute('crossorigin')
        audio.load()
        await audio.play()
      }
    },
    isCorsClean: () => corsClean,
    usesMediaSource: () => false,
    destroy() {},
  }
}
