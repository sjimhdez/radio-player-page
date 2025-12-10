import IconButton from '@mui/material/IconButton'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'
import type { PlayerStatus } from 'src/types/player'

interface PlayerControlsProps {
  status: PlayerStatus
  loading: boolean
  error: boolean
  onPlay: () => void
  onPause: () => void
}

const PlayerControls = ({ status, loading, error, onPlay, onPause }: PlayerControlsProps) => {
  const { t } = useTranslation()

  // Show CircularProgress when loading
  if (loading && !error) {
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
      <StopCircleIcon sx={{ width: 64, height: 64, '& > svg': { width: 64, height: 64 } }} />
    </IconButton>
  )
}

export default PlayerControls
