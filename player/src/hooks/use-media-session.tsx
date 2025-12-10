import { useEffect } from 'react'

/**
 * Hook to configure Media Session API with active stream data
 */
function useMediaSession(title: string, logoUrl: string, onPlay: () => void, onPause: () => void) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    const artwork = logoUrl ? [{ src: logoUrl, sizes: '256x256', type: 'image/png' }] : []

    //TODO: add translation for title
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title || 'Live Radio',
      artwork,
    })

    // Configure only play and pause
    navigator.mediaSession.setActionHandler('play', onPlay)
    navigator.mediaSession.setActionHandler('pause', onPause)

    // Explicitly disable +10/-10 seconds controls
    navigator.mediaSession.setActionHandler('seekbackward', null)
    navigator.mediaSession.setActionHandler('seekforward', null)
    navigator.mediaSession.setActionHandler('seekto', null)
    navigator.mediaSession.setActionHandler('previoustrack', null)
    navigator.mediaSession.setActionHandler('nexttrack', null)
  }, [title, logoUrl, onPlay, onPause])
}

export default useMediaSession
