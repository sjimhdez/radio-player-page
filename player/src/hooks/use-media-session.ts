import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { applyMediaSession } from 'src/core/media-session/media-session'
import type { PlayerStatus } from 'src/types/player'

/**
 * Fills the Media Session (lock screen and media notification) with the station and
 * its play and pause handlers, and keeps it up to date: the metadata, the handlers and
 * the playback state follow the arguments and the language.
 *
 * @param logoUrl - The artwork (RADPLAPAG_CONFIG.logoImage); without it none is sent
 * @param status - The player status, mirrored in playbackState
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
      { title: title || t('playerPage.liveRadio'), logoUrl, onPlay, onPause, status },
    )
  }, [title, logoUrl, onPlay, onPause, t, status])
}

export default useMediaSession
