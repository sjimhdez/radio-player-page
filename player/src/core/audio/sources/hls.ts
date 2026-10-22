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
 * On the hls.js path crossOrigin is cleared (ADR 0004, docs/known-issues.md K70); native
 * HLS retries without it as the direct source does (C1, ADR 0033).
 *
 * @param options.loadHls - Loader of the Hls class (hls.js by default)
 * @param options.isIOS - Whether the device is iOS (iPadOS included), decided by the
 *   controller when it is created (ADR 0036)
 * @param options.retryWithoutCors - Passed to the direct source of native HLS
 * @returns AudioSource whose start() resolves before playback on the hls.js path:
 *   play() runs on MANIFEST_PARSED and its rejection goes to onPlayRejected. After
 *   destroy(), even while hls.js loads, nothing plays and nothing is reported
 */
export function createHlsSource({
  loadHls = loadHlsModule,
  isIOS,
  retryWithoutCors = false,
}: {
  loadHls?: () => Promise<HlsClass>
  isIOS: boolean
  retryWithoutCors?: boolean
}): AudioSource {
  let hls: HlsInstance | null = null
  const native = createDirectSource({ retryWithoutCors })
  let usesNative = false
  // Set by destroy(): a pause while hls.js loads cancels the load (ADR 0034 D3).
  let destroyed = false

  return {
    async start(audio, url, callbacks) {
      usesNative = isIOS
      destroyed = false
      if (isIOS) {
        return native.start(audio, url, callbacks)
      }
      const Hls = await loadHls()
      if (destroyed) return
      if (!Hls.isSupported()) {
        usesNative = true
        return native.start(audio, url, callbacks)
      }
      // hls.js 1.7 defaults to classic MediaSource; keep ManagedMediaSource as in 3.4.2.
      const instance = new Hls({ preferManagedMediaSource: true })
      hls = instance
      // MSE path: no crossOrigin, even after a direct source such as the intro.
      // Same as crossOrigin = null, which happy-dom stores as the invalid "null".
      audio.removeAttribute('crossorigin')
      instance.loadSource(url)
      instance.attachMedia(audio)
      // hls.js may still report after destroy(): those reports are ignored.
      instance.on(Hls.Events.MANIFEST_PARSED, () => {
        if (hls === instance) audio.play().catch(callbacks.onPlayRejected)
      })
      instance.on(Hls.Events.ERROR, (_, data) => {
        if (hls === instance && data.fatal) callbacks.onError()
      })
    },
    isCorsClean: () => !usesNative || native.isCorsClean(),
    destroy() {
      destroyed = true
      hls?.destroy()
      hls = null
    },
  }
}
