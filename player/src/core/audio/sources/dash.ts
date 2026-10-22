import type { AudioSource, DashMediaPlayer, DashPlayer } from 'src/core/audio/sources/types'

/** dashjs TIME_SYNC_FAILED: non fatal, what a live MPD without UTCTiming gives with no time source. */
const TIME_SYNC_FAILED = 16

/**
 * Lazy loads dashjs. The import() lives here so dashjs stays a separate chunk.
 *
 * @returns Promise resolving to the dashjs MediaPlayer factory
 */
export async function loadDashModule(): Promise<DashMediaPlayer> {
  const dashModule = await import('dashjs')
  return dashModule.MediaPlayer
}

/**
 * Creates the source for .mpd streams: dashjs with autoplay, so start() resolves
 * before playback. crossOrigin is cleared (ADR 0004, docs/known-issues.md K70). The
 * default time sources (time.akamai.com) are cleared, so a live MPD without UTCTiming
 * asks no third party for the time; dashjs then uses the manifest Date header or the
 * local clock, and its time sync error is ignored (K67).
 *
 * @param options.loadDash - Loader of the MediaPlayer factory (dashjs by default)
 * @returns AudioSource whose destroy() resets the dashjs player
 */
export function createDashSource({
  loadDash = loadDashModule,
}: { loadDash?: () => Promise<DashMediaPlayer> } = {}): AudioSource {
  let player: DashPlayer | null = null

  return {
    async start(audio, url, callbacks) {
      const MediaPlayer = await loadDash()
      const instance = MediaPlayer().create()
      player = instance
      // MSE path: no crossOrigin, even after a direct source such as the intro.
      // Same as crossOrigin = null, which happy-dom stores as the invalid "null".
      audio.removeAttribute('crossorigin')
      // Third parameter (true) enables autoplay.
      instance.initialize(audio, url, true)
      // After initialize(): it restores the defaults (spike 0007, R2).
      instance.clearDefaultUTCTimingSources()
      instance.on('error', (event) => {
        if (event.error.code !== TIME_SYNC_FAILED) callbacks.onError()
      })
    },
    isCorsClean: () => true,
    destroy() {
      player?.reset()
      player = null
    },
  }
}
