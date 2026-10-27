import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { applyMediaSession } from 'src/core/media-session/media-session'
import type { PlayerStatus } from 'src/types/player'

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
 * - Player status changes (synchronizes playbackState)
 *
 * @param title - Title of the radio station/stream
 * @param logoUrl - URL of the logo/artwork image (from RADPLAPAG_CONFIG.logoImage). If not provided, no artwork will be sent
 * @param onPlay - Callback function for play action
 * @param onPause - Callback function for pause action
 * @param status - Current player status to synchronize playbackState
 */
function useMediaSession(
  title: string,
  logoUrl: string,
  onPlay: () => void,
  onPause: () => void,
  status: PlayerStatus,
) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }

    return applyMediaSession(
      {
        session: navigator.mediaSession,
        createMetadata: (init) => new MediaMetadata(init),
      },
      { title: title || t('dashboard.liveRadio'), logoUrl, onPlay, onPause, status },
    )
  }, [title, logoUrl, onPlay, onPause, t, status])
}

export default useMediaSession
