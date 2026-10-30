import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import { useTranslation } from 'react-i18next'
import { formatTimezoneDifference } from 'src/core/clock/timezone'
import type { TransmissionTime } from 'src/hooks/use-transmission-time'

/** Props of the station clock */
interface TimezoneClockProps {
  /** The station and browser times from useTransmissionTime() */
  transmissionTimeData: TransmissionTime
}

/**
 * The station clock (the WordPress zone) as "HH:MM", with its difference from the
 * browser; the page header places it. Only when the zones differ, and then always,
 * whatever the playback state.
 */
const TimezoneClock = ({ transmissionTimeData }: TimezoneClockProps) => {
  const { t } = useTranslation()
  const { transmissionTime, timeDifference, hasDifference } = transmissionTimeData

  if (!hasDifference) {
    return null
  }

  const formattedDifference = formatTimezoneDifference(timeDifference)
  const isPositive = timeDifference > 0

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(8px)',
        px: 1.5,
        py: 0.75,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack
        direction="column"
        spacing={0.5}
        sx={{
          alignItems: 'flex-end',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            letterSpacing: '0.05em',
            color: 'text.secondary',
          }}
        >
          {t('playerPage.timezoneClockLabel')}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              letterSpacing: '0.05em',
              fontWeight: 500,
            }}
          >
            {transmissionTime}
          </Typography>

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
