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
import { getCurrentTimeInTimezone, getStationOffset } from 'src/core/clock/timezone'
import {
  getProgramsForWeekOrdered,
  type ProgramForDay,
  type DayWithPrograms,
} from 'src/core/schedule/program-schedule'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
import CircleIcon from '@mui/icons-material/Circle'
import { CardMedia } from '@mui/material'

/** Day of week to i18n key (0=Sunday -> daySunday, ...) */
const DAY_KEYS = [
  'playerPage.daySunday',
  'playerPage.dayMonday',
  'playerPage.dayTuesday',
  'playerPage.dayWednesday',
  'playerPage.dayThursday',
  'playerPage.dayFriday',
  'playerPage.daySaturday',
] as const

/** Props of the schedule modal */
interface ScheduleModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Called when the modal closes */
  onClose: () => void
}

/**
 * The schedule modal: the week in a single scrollable column, from today; on open it
 * scrolls to the slot on air.
 */
const ScheduleModal = ({ open, onClose }: ScheduleModalProps) => {
  const { t } = useTranslation()
  const config = useConfig()
  const schedule = config.schedule
  const programs = config.programs
  const { dayOfWeek: currentDayOfWeek, currentTime } = getCurrentTimeInTimezone(
    getStationOffset(config.timezone, config.timezoneOffset),
  )

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
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CardMedia
            component="img"
            src={program.programLogoUrl}
            alt={program.programName}
            sx={{
              width: 128,
              height: 128,
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
        </Stack>
      )}
      <CardContent>
        <Stack
          sx={{
            px: 1,
            gap: 0.5,
            alignItems: 'start',
          }}
        >
          <Stack
            sx={{
              alignItems: 'start',
            }}
          >
            {program.isActive && (
              <Chip
                label={
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('playerPage.scheduleLive')}
                  </Typography>
                }
                color="error"
                size="small"
                variant="outlined"
                icon={<CircleIcon color="error" />}
              />
            )}
            <Typography
              variant="body1"
              sx={{
                color: 'primary.light',
              }}
            >
              {program.programName || '—'}
            </Typography>
          </Stack>
          {program.programDescription && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {program.programDescription}
            </Typography>
          )}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {program.timeRange}
          </Typography>
          {program.isRerun && (
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t('playerPage.rerunLabel')}
            </Typography>
          )}
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
      slotProps={{
        transition: {
          onEntered: scrollToActiveProgram,
        },
      }}
    >
      <DialogTitle sx={{ bgcolor: 'background.paper' }}>
        <Stack
          direction="row"
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          {t('playerPage.viewSchedule')}
          <IconButton aria-label={t('playerPage.scheduleClose')} onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack
          ref={contentRef}
          sx={{
            maxHeight: '70vh',
            overflow: 'auto',
            bgcolor: 'background.paper',
          }}
        >
          <Box>
            {weekData.length === 0 ? (
              <Typography>{t('playerPage.scheduleNoProgramsForDay')}</Typography>
            ) : (
              weekData.map(({ dayOfWeek, programs: dayPrograms }) => (
                <Stack key={dayOfWeek}>
                  <Stack
                    sx={{
                      position: 'sticky',
                      top: 0,
                      bgcolor: 'background.paper',
                      py: 1,
                      px: 3,
                      zIndex: (theme) => theme.zIndex.modal,
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      component="h3"
                      sx={{
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}
                    >
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
              {t('playerPage.scheduleBackToTop')}
            </Button>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default ScheduleModal
