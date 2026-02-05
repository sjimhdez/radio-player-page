import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import { formatTimezoneDifference } from 'src/utils/timezone'
import type { EmissionTime } from 'src/hooks/use-emission-time'

interface TimezoneClockProps {
  /** Whether the stream is currently playing */
  isPlaying: boolean
  /** Emission time data from useEmissionTime hook */
  emissionTimeData: EmissionTime
}

/**
 * Timezone clock component
 *
 * Displays a discrete, stylized real-time clock showing the emission timezone (WordPress)
 * with a subtle time difference indicator. Positioned in the top-right corner.
 *
 * Only displays when:
 * - The stream is playing (isPlaying === true)
 * - There is a timezone difference (hasDifference === true)
 *
 * Features:
 * - Compact clock showing emission timezone in "HH:MM" format
 * - Updates at the start of each system minute (at :00 seconds)
 * - Subtle time difference indicator
 * - Discreet positioning in top-right corner
 * - Minimal, elegant design using Material-UI components
 *
 * @param props - Component props
 * @returns Timezone clock, or null if conditions not met
 */
const TimezoneClock = ({ isPlaying, emissionTimeData }: TimezoneClockProps) => {
  const { t } = useTranslation()
  const { emissionTime, timeDifference, hasDifference } = emissionTimeData

  // Only show when playing and there's a timezone difference
  if (!isPlaying || !hasDifference) {
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
        zIndex: (theme) => theme.zIndex.tooltip,
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
        <Typography
          variant="caption"
          textTransform="uppercase"
          letterSpacing="0.05em"
          color="text.secondary"
        >
          {t('dashboard.timezoneClockLabel')}
        </Typography>

        {/* Emission time clock and difference indicator */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography
            variant="body2"
            fontFamily="monospace"
            letterSpacing="0.05em"
            fontWeight={500}
          >
            {emissionTime}
          </Typography>

          {/* Time difference indicator */}
          <Chip
            label={formattedDifference}
            size="small"
            color={isPositive ? 'success' : 'warning'}
            variant="outlined"
            sx={{
              fontFamily: 'monospace',
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
