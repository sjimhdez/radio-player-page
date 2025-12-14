import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Detects MIME type from URL based on file extension
 */
function detectMimeType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  }
  return mimeTypes[extension || ''] || 'image/png'
}

/**
 * Generates artwork array with multiple sizes for better iOS support
 * iOS prefers multiple sizes to optimize display on different devices
 */
function generateArtworkArray(logoUrl: string): MediaImage[] {
  const mimeType = detectMimeType(logoUrl)
  const sizes = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512']

  return sizes.map((size) => ({
    src: logoUrl,
    sizes: size,
    type: mimeType,
  }))
}

/**
 * Hook to configure Media Session API with active stream data
 * Enables lock screen controls and media notification integration
 *
 * The hook automatically updates Media Session metadata and action handlers
 * whenever the provided props change. This ensures the lock screen always
 * displays current stream information.
 *
 * Updates dynamically when:
 * - Title changes
 * - Logo URL changes
 * - Play/pause callbacks change
 * - Translation language changes
 *
 * @param title - Title of the radio station/stream
 * @param logoUrl - URL of the logo/artwork image (from LOGO_IMAGE). If not provided, no artwork will be sent
 * @param onPlay - Callback function for play action
 * @param onPause - Callback function for pause action
 */
function useMediaSession(title: string, logoUrl: string, onPlay: () => void, onPause: () => void) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    // Only generate artwork if logoUrl is provided, otherwise send empty array
    const artwork = logoUrl ? generateArtworkArray(logoUrl) : []

    const metadata: MediaMetadataInit = {
      title: title || t('dashboard.liveRadio'),
      artwork,
    }

    navigator.mediaSession.metadata = new MediaMetadata(metadata)

    // Configure only play and pause
    navigator.mediaSession.setActionHandler('play', onPlay)
    navigator.mediaSession.setActionHandler('pause', onPause)

    // Explicitly disable +10/-10 seconds controls
    navigator.mediaSession.setActionHandler('seekbackward', null)
    navigator.mediaSession.setActionHandler('seekforward', null)
    navigator.mediaSession.setActionHandler('seekto', null)
    navigator.mediaSession.setActionHandler('previoustrack', null)
    navigator.mediaSession.setActionHandler('nexttrack', null)
  }, [title, logoUrl, onPlay, onPause, t])
}

export default useMediaSession
