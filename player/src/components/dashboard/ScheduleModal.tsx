import { useCallback, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import useConfig from 'src/hooks/use-config'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'
import {
  getProgramsForWeekOrdered,
  type ProgramForDay,
  type DayWithPrograms,
} from 'src/utils/program-schedule'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
import CircleIcon from '@mui/icons-material/Circle'
import { CardMedia } from '@mui/material'

/** Day of week to i18n key (0=Sunday -> daySunday, ...) */
const DAY_KEYS = [
  'dashboard.daySunday',
  'dashboard.dayMonday',
  'dashboard.dayTuesday',
  'dashboard.dayWednesday',
  'dashboard.dayThursday',
  'dashboard.dayFriday',
  'dashboard.daySaturday',
] as const

interface ScheduleModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when the modal is closed */
  onClose: () => void
}

/**
 * Schedule modal component.
 * Shows the full week schedule in a single scrollable column, starting from today.
 * On open, scrolls to the currently active program slot.
 */
const ScheduleModal = ({ open, onClose }: ScheduleModalProps) => {
  const { t } = useTranslation()
  const config = useConfig()
  const schedule = config.schedule
  const programs = config.programs
  const timezoneOffset = config.timezoneOffset

  const { dayOfWeek: currentDayOfWeek, currentTime } = getCurrentTimeInTimezone(timezoneOffset)

  const weekData: DayWithPrograms[] = getProgramsForWeekOrdered(
    schedule,
    programs,
    currentDayOfWeek,
    currentTime,
  )

  const activeCardRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const scrollToActiveProgram = useCallback(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const renderProgramCard = (program: ProgramForDay, index: number, dayOfWeek: number) => (
    <Card
      key={`${dayOfWeek}-${program.programName}-${program.timeRange}-${index}`}
      ref={program.isActive ? activeCardRef : undefined}
      sx={{
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        display: 'flex',
      }}
    >
      {program.programLogoUrl && (
        <Stack direction="row" alignItems="center" justifyContent="center">
          <CardMedia
            component="img"
            src={program.programLogoUrl}
            alt={program.programName}
            width={128}
            height={128}
          />
        </Stack>
      )}
      <CardContent>
        <Stack px={1} gap={0.5} alignItems={'start'}>
          {program.isActive && (
            <Chip
              label={
                <Typography variant="body2" fontWeight="bold" textTransform={'uppercase'}>
                  {t('dashboard.scheduleLive')}
                </Typography>
              }
              color="error"
              size="small"
              variant="outlined"
              icon={<CircleIcon color="error" />}
              sx={{
                animation: 'scheduleLiveBlink 1.5s ease-in-out infinite',
                '@keyframes scheduleLiveBlink': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
          )}
          <Typography variant="body1" color="primary.main">
            {program.programName || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {program.timeRange}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableRestoreFocus
      slotProps={{
        transition: {
          onEntered: scrollToActiveProgram,
        },
      }}
    >
      <DialogTitle bgcolor={'background.paper'}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          {t('dashboard.viewSchedule')}
          <IconButton aria-label={t('dashboard.scheduleClose')} onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack ref={contentRef} maxHeight={'70vh'} overflow={'auto'} bgcolor={'background.paper'}>
          <Box>
            {weekData.length === 0 ? (
              <Typography>{t('dashboard.scheduleNoProgramsForDay')}</Typography>
            ) : (
              weekData.map(({ dayOfWeek, programs: dayPrograms }) => (
                <Stack key={dayOfWeek}>
                  <Stack
                    position={'sticky'}
                    top={0}
                    bgcolor={'background.paper'}
                    py={1}
                    px={3}
                    zIndex={(theme) => theme.zIndex.modal}
                    sx={{
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                    }}
                  >
                    <Typography variant="subtitle2" textTransform={'uppercase'} letterSpacing={1}>
                      {t(DAY_KEYS[dayOfWeek])}
                    </Typography>
                  </Stack>
                  <Stack>
                    {dayPrograms.map((program, index) => (
                      <Box key={`${dayOfWeek}-${index}`}>
                        {renderProgramCard(program, index, dayOfWeek)}
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              ))
            )}
          </Box>
          {weekData.length > 0 && (
            <Button variant="text" onClick={scrollToTop}>
              {t('dashboard.scheduleBackToTop')}
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default ScheduleModal
