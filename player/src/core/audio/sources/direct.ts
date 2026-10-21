import type { AudioSource } from 'src/core/audio/sources/types'

/**
 * Creates the source that assigns the URL to audio.src: MP3/OGG, native HLS and the
 * welcome audio. Sets crossOrigin = 'anonymous' after src, as the hook does (ADR 0004).
 *
 * @returns AudioSource whose destroy() does nothing
 */
export function createDirectSource(): AudioSource {
  return {
    async start(audio, url) {
      audio.src = url
      audio.crossOrigin = 'anonymous'
      audio.load()
      await audio.play()
    },
    destroy() {},
  }
}
