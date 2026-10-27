import type { PlayerStatus } from 'src/types/player'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

// iOS prefers several sizes to pick the right one for each device.
const ARTWORK_SIZES = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512']

/**
 * What the core needs from the browser; `navigator.mediaSession` and `new MediaMetadata()`
 * in the player.
 */
export interface MediaSessionDeps {
  session: Pick<MediaSession, 'metadata' | 'playbackState' | 'setActionHandler'>
  createMetadata: (init: MediaMetadataInit) => MediaMetadata
}

export interface MediaSessionState {
  /** Title shown on the lock screen, already translated. */
  title: string
  /** Logo URL; without it no artwork is sent. */
  logoUrl: string
  onPlay: () => void
  onPause: () => void
  status: PlayerStatus
}

/**
 * Detects the MIME type of an image from its file extension.
 *
 * The query and the hash are dropped first (known-issues.md K14).
 *
 * @param url - Image URL
 * @returns The MIME type, `image/png` when the extension is unknown
 */
export function mimeTypeFor(url: string): string {
  const extension = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  return MIME_TYPES[extension || ''] || 'image/png'
}

/**
 * Lists the logo in six sizes for the lock screen.
 *
 * @param logoUrl - Logo URL
 * @returns One artwork entry per size, all with the same URL and type
 */
export function artworkFor(logoUrl: string): MediaImage[] {
  const type = mimeTypeFor(logoUrl)
  return ARTWORK_SIZES.map((sizes) => ({ src: logoUrl, sizes, type }))
}

/**
 * Sets the Media Session metadata, the play and pause handlers and the playback state,
 * and disables seeking and track changes. Errors of the API are logged, not thrown.
 *
 * @param deps - The session and the metadata factory
 * @param state - What to show and the handlers to register
 * @returns Cleanup that clears the metadata and the play and pause handlers
 */
export function applyMediaSession(
  { session, createMetadata }: MediaSessionDeps,
  { title, logoUrl, onPlay, onPause, status }: MediaSessionState,
): () => void {
  try {
    session.metadata = createMetadata({
      title,
      artwork: logoUrl ? artworkFor(logoUrl) : [],
    })

    session.setActionHandler('play', onPlay)
    session.setActionHandler('pause', onPause)

    session.playbackState = status === 'playing' ? 'playing' : 'paused'

    session.setActionHandler('seekbackward', null)
    session.setActionHandler('seekforward', null)
    session.setActionHandler('seekto', null)
    session.setActionHandler('previoustrack', null)
    session.setActionHandler('nexttrack', null)
  } catch (error) {
    console.warn('Media Session API error:', error)
  }

  return () => {
    try {
      session.metadata = null
      session.setActionHandler('play', null)
      session.setActionHandler('pause', null)
    } catch (error) {
      console.warn('Media Session API cleanup error:', error)
    }
  }
}
