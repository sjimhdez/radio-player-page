import IconButton from '@mui/material/IconButton'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import type { PlayerStatus } from 'src/types/player'

interface PlayerControlsProps {
  /** Current playback status */
  status: PlayerStatus
  /** Whether the player is currently loading */
  loading: boolean
  /** Whether an error has occurred */
  error: boolean
  /** Callback function to start playback */
  onPlay: () => void
  /** Callback function to pause playback */
  onPause: () => void
}

/**
 * Player controls component
 * Displays play/pause button or loading indicator based on player status
 *
 * Rendering priority:
 * 1. If loading is true: shows loading spinner only (no buttons)
 * 2. If status is not 'playing': shows play button
 * 3. If status is 'playing': shows pause button
 *
 * @param props - Component props
 * @returns Loading spinner (when loading) or play/pause button (when not loading)
 */
const PlayerControls = ({ status, loading, error, onPlay, onPause }: PlayerControlsProps) => {
  const { t } = useTranslation()
  // Show CircularProgress when loading (takes priority over button display)
  if (loading) {
    return <CircularProgress size={88} />
  }

  if (status !== 'playing') {
    return (
      <IconButton onClick={onPlay} size="large" aria-label={t('dashboard.play')} color="primary">
        <PlayCircleIcon sx={{ width: 64, height: 64, '& > svg': { width: 64, height: 64 } }} />
      </IconButton>
    )
  }

  return (
    <IconButton onClick={onPause} size="large" aria-label={t('dashboard.stop')} color="primary">
      <PauseCircleIcon sx={{ width: 64, height: 64, '& > svg': { width: 64, height: 64 } }} />
    </IconButton>
  )
}

export default PlayerControls
