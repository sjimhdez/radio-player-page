import IconButton from '@mui/material/IconButton'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import PauseCircleIcon from '@mui/icons-material/PauseCircle'
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
  console.log('status', status)
  console.log('loading', loading)
  console.log('error', error)
  console.log('--------------------------------')
  // Show CircularProgress when loading
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
