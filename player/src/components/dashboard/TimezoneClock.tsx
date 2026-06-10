import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import { formatTimezoneDifference } from 'src/utils/timezone'
import type { TransmissionTime } from 'src/hooks/use-transmission-time'

interface TimezoneClockProps {
  /** Station transmission time data from useTransmissionTime hook */
  transmissionTimeData: TransmissionTime
}

/**
 * Timezone clock component
 *
 * Displays a discrete, stylized real-time clock showing the station timezone (WordPress)
 * with a subtle time difference indicator. Positioned in the top-right corner.
 *
 * Only displays when there is a timezone difference (hasDifference === true). When that
 * condition is met, the clock is always visible, independent of playback state.
 *
 * Features:
 * - Compact clock showing station timezone in "HH:MM" format
 * - Updates at the start of each system minute (at :00 seconds)
 * - Subtle time difference indicator
 * - Discreet positioning in top-right corner
 * - Minimal, elegant design using Material-UI components
 *
 * @param props - Component props
 * @returns Timezone clock, or null when there is no timezone difference
 */
const TimezoneClock = ({ transmissionTimeData }: TimezoneClockProps) => {
  const { t } = useTranslation()
  const { transmissionTime, timeDifference, hasDifference } = transmissionTimeData

  // Only show when there is a timezone difference (always visible then, regardless of playback)
  if (!hasDifference) {
    return null
  }

  const formattedDifference = formatTimezoneDifference(timeDifference)
  const isPositive = timeDifference > 0

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: (theme) => theme.zIndex.appBar,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
        px: 1.5,
        py: 0.75,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="column" alignItems="flex-end" spacing={0.5}>
        {/* Informative text */}
        <Typography variant="caption" letterSpacing="0.05em" color="text.secondary">
          {t('dashboard.timezoneClockLabel')}
        </Typography>

        {/* Station transmission time clock and difference indicator */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" letterSpacing="0.05em" fontWeight={500}>
            {transmissionTime}
          </Typography>

          {/* Time difference indicator */}
          <Chip
            label={formattedDifference}
            size="small"
            color={isPositive ? 'success' : 'warning'}
            variant="outlined"
            sx={{
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Stack>
      </Stack>
    </Paper>
  )
}

export default TimezoneClock
