import type { AudioSource, DashMediaPlayer, DashPlayer } from 'src/core/audio/sources/types'

/**
 * dashjs TIME_SYNC_FAILED: non fatal, what a live MPD without UTCTiming gives with no
 * time source.
 */
const TIME_SYNC_FAILED = 16

/**
 * Lazy loads the dashjs MediaPlayer factory. The import() lives here so dashjs stays a
 * separate chunk.
 */
export async function loadDashModule(): Promise<DashMediaPlayer> {
  const dashModule = await import('dashjs')
  return dashModule.MediaPlayer
}

/**
 * Creates the source for .mpd streams: dashjs with autoplay, so start() resolves
 * before playback. crossOrigin is cleared (K70, ADR 0004). The default time sources
 * (time.akamai.com) are cleared, so a live MPD without UTCTiming asks no third party
 * for the time; dashjs then uses the manifest Date header or the local clock, and its
 * time sync error is ignored (K67).
 *
 * @param options.loadDash - Loader of the MediaPlayer factory (dashjs by default)
 * @returns A source whose destroy() resets the dashjs player, which stops its
 *   autoplay; after it, even while dashjs loads, nothing is created or reported
 */
export function createDashSource({
  loadDash = loadDashModule,
}: { loadDash?: () => Promise<DashMediaPlayer> } = {}): AudioSource {
  let player: DashPlayer | null = null
  // Set by destroy(): a pause while dashjs loads cancels the load (ADR 0034).
  let destroyed = false

  return {
    async start(audio, url, callbacks) {
      destroyed = false
      const MediaPlayer = await loadDash()
      if (destroyed) return
      const instance = MediaPlayer().create()
      player = instance
      // MSE path: no crossOrigin, even after a direct source such as the intro.
      // Same as crossOrigin = null, which happy-dom stores as the invalid "null".
      audio.removeAttribute('crossorigin')
      // The third argument turns autoplay on.
      instance.initialize(audio, url, true)
      // After initialize(), which restores the defaults.
      instance.clearDefaultUTCTimingSources()
      // dashjs may still report after reset(): those reports are ignored.
      instance.on('error', (event) => {
        if (player === instance && event.error.code !== TIME_SYNC_FAILED) {
          // A download error has the HTTP status, 0 without a response (ADR 0065).
          const status = event.error.data?.response?.status
          callbacks.onError(typeof status === 'number' ? { status } : {})
        }
      })
    },
    isCorsClean: () => true,
    usesMediaSource: () => true,
    destroy() {
      destroyed = true
      player?.reset()
      player = null
    },
  }
}
