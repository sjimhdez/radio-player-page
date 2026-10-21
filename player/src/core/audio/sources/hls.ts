import { createDirectSource } from 'src/core/audio/sources/direct'
import type { AudioSource, HlsClass, HlsInstance } from 'src/core/audio/sources/types'

/**
 * Lazy loads hls.js. The import() lives here so hls.js stays a separate chunk.
 *
 * @returns Promise resolving to the hls.js default export
 */
export async function loadHlsModule(): Promise<HlsClass> {
  const hlsModule = await import('hls.js')
  return hlsModule.default
}

/**
 * Creates the source for .m3u8 streams. iOS plays HLS natively through the direct
 * source; elsewhere hls.js is used when supported, with the direct source as fallback.
 * On the hls.js path crossOrigin is left as it is (docs/known-issues.md K70).
 *
 * @param options.loadHls - Loader of the Hls class (hls.js by default)
 * @param options.isIOS - Whether the device is iOS, read when the source is created
 * @returns AudioSource whose start() resolves before playback on the hls.js path:
 *   play() runs on MANIFEST_PARSED and its rejection goes to onPlayRejected
 */
export function createHlsSource({
  loadHls = loadHlsModule,
  isIOS,
}: {
  loadHls?: () => Promise<HlsClass>
  isIOS: boolean
}): AudioSource {
  let hls: HlsInstance | null = null

  return {
    async start(audio, url, callbacks) {
      if (isIOS) {
        return createDirectSource().start(audio, url, callbacks)
      }
      const Hls = await loadHls()
      if (!Hls.isSupported()) {
        return createDirectSource().start(audio, url, callbacks)
      }
      // hls.js 1.7 defaults to classic MediaSource; keep ManagedMediaSource as in 3.4.2.
      const instance = new Hls({ preferManagedMediaSource: true })
      hls = instance
      instance.loadSource(url)
      instance.attachMedia(audio)
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        audio.play().catch(callbacks.onPlayRejected)
      })
      instance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) callbacks.onError()
      })
    },
    destroy() {
      hls?.destroy()
      hls = null
    },
  }
}
