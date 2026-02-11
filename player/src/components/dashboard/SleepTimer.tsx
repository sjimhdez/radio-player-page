import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'
import { intervalToDuration } from 'date-fns'

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
 * Uses date-fns for time formatting to ensure consistent and reliable duration display.
 *
 * @param props - Component props
 * @returns Sleep timer display with countdown and cancel button
 */
const SleepTimer = ({ remainingSeconds, onCancel }: SleepTimerProps) => {
  const { t } = useTranslation()

  /**
   * Formats seconds into a human-readable time string
   * Shows hours:minutes:seconds if hours > 0, otherwise shows minutes:seconds
   * Uses date-fns intervalToDuration for reliable duration calculation
   *
   * @param seconds - Total seconds to format
   * @returns Formatted time string (e.g., "1:23:45" or "23:45")
   */
  const formatTime = (seconds: number): string => {
    const start = new Date(0)
    const end = new Date(seconds * 1000)
    const duration = intervalToDuration({ start, end })

    const hours = duration.hours ?? 0
    const minutes = duration.minutes ?? 0
    const secs = duration.seconds ?? 0

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
