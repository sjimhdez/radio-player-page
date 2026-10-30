import type { Ref } from 'react'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { useTranslation } from 'react-i18next'
import { intervalToDuration } from 'date-fns'

/** Props of the sleep timer display */
interface SleepTimerProps {
  /** Seconds left until the player pauses */
  remainingSeconds: number
  /** Cancels the countdown */
  onCancel: () => void
  /** Ref to the container, so the player page can tell whether it holds the focus (K58) */
  ref?: Ref<HTMLDivElement>
}

/** The time left until the player pauses, with a button to cancel */
const SleepTimer = ({ remainingSeconds, onCancel, ref }: SleepTimerProps) => {
  const { t } = useTranslation()

  /** Seconds as "1:23:45", or "23:45" under an hour (date-fns intervalToDuration) */
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
    <Stack
      ref={ref}
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      <Typography variant="body2" sx={{ minWidth: '60px', textAlign: 'center' }}>
        {formatTime(remainingSeconds)}
      </Typography>
      <IconButton
        onClick={onCancel}
        size="small"
        aria-label={t('playerPage.cancelSleepMode')}
        color="primary"
      >
        <CloseIcon />
      </IconButton>
    </Stack>
  )
}

export default SleepTimer
