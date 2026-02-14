import { useCallback, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import { useTranslation } from 'react-i18next'
import useConfig from 'src/hooks/use-config'
import { getCurrentTimeInTimezone } from 'src/utils/timezone'
import { getAllProgramsWithSlots, type ProgramWithSlots } from 'src/utils/program-schedule'
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

interface ProgramCardProps {
  program: ProgramWithSlots
  activeCardRef: React.RefObject<HTMLDivElement | null>
  expanded: boolean
  onToggle: () => void
}

function ProgramCard({ program, activeCardRef, expanded, onToggle }: ProgramCardProps) {
  const { t } = useTranslation()
  return (
    <Card
      ref={program.isLive ? activeCardRef : undefined}
      sx={{
        borderBottom: '1px solid',
        borderBottomColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        {program.programLogoUrl && (
          <Stack direction="row" alignItems="start" justifyContent="center">
            <CardMedia
              component="img"
              src={program.programLogoUrl}
              alt={program.programName}
              width={128}
              height={128}
            />
          </Stack>
        )}
        <CardContent sx={{ flex: 1 }}>
          <Stack px={1} gap={0.5} alignItems="start">
            {program.isLive && (
              <Chip
                label={
                  <Typography variant="body2" fontWeight="bold" textTransform="uppercase">
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
            <Typography variant="body1" color="primary.light">
              {program.programName || '—'}
            </Typography>
            {program.programDescription && (
              <Typography variant="body2" color="text.secondary">
                {program.programDescription}
              </Typography>
            )}
            <Button
              variant="text"
              size="small"
              onClick={onToggle}
              aria-expanded={expanded}
              color="inherit"
            >
              {expanded ? t('dashboard.showLess') : t('dashboard.showMore')}
            </Button>
          </Stack>
        </CardContent>
      </Box>
      <Collapse in={expanded}>
        <Stack gap={3} p={3}>
          {program.programExtendedDescription && (
            <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
              {program.programExtendedDescription}
            </Typography>
          )}
          <Stack gap={1.5}>
            <Typography variant="h5">{t('dashboard.emissionTimes')}</Typography>
            <Stack gap={0.5}>
              {program.slots.map((slot, index) => (
                <Typography
                  key={`${program.programId}-${index}`}
                  variant="body2"
                  color="text.secondary"
                >
                  {t(DAY_KEYS[slot.dayOfWeek])} {slot.timeRange}
                </Typography>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Collapse>
    </Card>
  )
}

interface AllProgramsModalProps {
  /** Whether the modal is open */
  open: boolean
  /** Callback when the modal is closed */
  onClose: () => void
}

/**
 * All programs modal component.
 * Shows every program in the schedule in alphabetical order by name. Each card displays
 * the program image, name, and all time slots when it airs (day + time range). A "Live"
 * chip is shown when that program is currently on air. Uses the same visual design as
 * ScheduleModal (Dialog, cards, chip styling).
 */
const AllProgramsModal = ({ open, onClose }: AllProgramsModalProps) => {
  const { t } = useTranslation()
  const config = useConfig()
  const schedule = config.schedule
  const programs = config.programs
  const timezoneOffset = config.timezoneOffset

  const { dayOfWeek: currentDayOfWeek, currentTime } = getCurrentTimeInTimezone(timezoneOffset)

  const programsWithSlots: ProgramWithSlots[] = getAllProgramsWithSlots(
    schedule,
    programs,
    currentDayOfWeek,
    currentTime,
  )

  const activeCardRef = useRef<HTMLDivElement | null>(null)
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null)

  const handleToggleExpand = useCallback((programId: string) => {
    setExpandedProgramId((prev) => (prev === programId ? null : programId))
  }, [])

  const scrollToActiveProgram = useCallback(() => {
    activeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
          {t('dashboard.viewAllPrograms')}
          <IconButton aria-label={t('dashboard.allProgramsClose')} onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        <Stack maxHeight={'70vh'} overflow={'auto'} bgcolor={'background.paper'}>
          <Box>
            {programsWithSlots.length === 0 ? (
              <Typography>{t('dashboard.allProgramsEmpty')}</Typography>
            ) : (
              programsWithSlots.map((program) => (
                <Box key={program.programId}>
                  <ProgramCard
                    program={program}
                    activeCardRef={activeCardRef}
                    expanded={expandedProgramId === program.programId}
                    onToggle={() => handleToggleExpand(program.programId)}
                  />
                </Box>
              ))
            )}
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}

export default AllProgramsModal
