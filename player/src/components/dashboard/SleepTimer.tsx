import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'

interface SleepTimerProps {
  /** Remaining seconds until sleep timer ends */
  remainingSeconds: number
  /** Callback function to cancel the sleep timer */
  onCancel: () => void
}

/**
 * Sleep timer display component
 * Shows the remaining time until the sleep timer ends and provides a cancel button
 *
 * @param props - Component props
 * @returns Sleep timer display with countdown and cancel button
 */
const SleepTimer = ({ remainingSeconds, onCancel }: SleepTimerProps) => {
  const { t } = useTranslation()

  /**
   * Formats seconds into a human-readable time string
   * Shows hours:minutes:seconds if hours > 0, otherwise shows minutes:seconds
   *
   * @param seconds - Total seconds to format
   * @returns Formatted time string (e.g., "1:23:45" or "23:45")
   */
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Stack direction="row" alignItems="center" justifyContent="center" gap={1}>
      <Typography variant="body2" sx={{ minWidth: '60px', textAlign: 'center' }}>
        {formatTime(remainingSeconds)}
      </Typography>
      <IconButton
        onClick={onCancel}
        size="small"
        aria-label={t('dashboard.cancelSleepMode')}
        color="primary"
      >
        <CloseIcon />
      </IconButton>
    </Stack>
  )
}

export default SleepTimer
