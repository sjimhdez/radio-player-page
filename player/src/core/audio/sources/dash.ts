import type { AudioSource, DashMediaPlayer, DashPlayer } from 'src/core/audio/sources/types'

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
 * before playback. crossOrigin is left as it is (docs/known-issues.md K70).
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
      // Third parameter (true) enables autoplay.
      instance.initialize(audio, url, true)
      instance.on('error', () => callbacks.onError())
    },
    destroy() {
      player?.reset()
      player = null
    },
  }
}
