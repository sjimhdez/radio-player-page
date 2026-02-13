import { useRef, useState, useEffect } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useTranslation } from 'react-i18next'
import useAudioPlayer from 'src/hooks/use-audio-player'
import useAudioVisualizer from 'src/hooks/use-audio-visualizer'
import { useCanVisualize } from 'src/hooks/use-can-visualize'
import useMediaSession from 'src/hooks/use-media-session'
import useConfig from 'src/hooks/use-config'
import { getVisualizer, getDefaultVisualizer, type VisualizerConfig } from 'src/config/visualizers'
import StreamInfo from './StreamInfo'
import PlayerControls from './PlayerControls'
import VolumeControl from './VolumeControl'
import SleepMode from './SleepMode'
import SleepTimer from './SleepTimer'
import TimezoneClock from './TimezoneClock'
import ScheduleModal from './ScheduleModal'
import AllProgramsModal from './AllProgramsModal'
import useEmissionTime from 'src/hooks/use-emission-time'
import IconButton from '@mui/material/IconButton'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'

/**
 * Main dashboard component
 * Orchestrates all player functionality including:
 * - Audio playback with support for HLS, DASH, and standard streams
 * - Audio visualization on canvas
 * - Media Session API integration for lock screen controls
 * - Sleep timer functionality
 * - Volume control
 * - Schedule modal: calendar button (left of play/pause) opens a modal with the
 *   full week schedule in a single scrollable column (current day first); cards per
 *   program (name, logo, time), live program highlighted and scrolled into view on
 *   open; Back to today button at the end; days without slots are not shown; button
 *   hidden when no schedule is configured
 * - All programs modal: list button (left of play/pause, next to calendar) opens a
 *   modal with every program in alphabetical order; each card shows image, name, all
 *   time slots when it airs, and a Live chip when that program is on air; same
 *   design as schedule modal; hidden when no schedule is configured
 * - Error handling and user feedback
 *
 * Reads configuration from WordPress via the useConfig() hook, which accesses
 * the window.RADPLAPAG_CONFIG object containing:
 * - streamUrl: Audio stream URL
 * - siteTitle: Radio station title
 * - logoImage: Station logo URL (optional)
 * - backgroundImage: Optional background image URL
 * - visualizer: Visualizer ID (oscilloscope, bars, particles, waterfall)
 * - themeColor: Theme color name
 * - schedule: Optional program schedule
 *
 * @returns Complete radio player dashboard interface
 */
const Dashboard = () => {
  const config = useConfig()

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [openError, setOpenError] = useState(false)
  const [openScheduleModal, setOpenScheduleModal] = useState(false)
  const [openAllProgramsModal, setOpenAllProgramsModal] = useState(false)
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null)
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  const { t } = useTranslation()
  const hasSchedule = Boolean(
    config.schedule &&
    (config.schedule.monday?.length ||
      config.schedule.tuesday?.length ||
      config.schedule.wednesday?.length ||
      config.schedule.thursday?.length ||
      config.schedule.friday?.length ||
      config.schedule.saturday?.length ||
      config.schedule.sunday?.length),
  )
  const { audioRef, status, loading, play, pause, volume, handleVolumeChange } = useAudioPlayer(
    config.streamUrl,
  )
  const canVisualize = useCanVisualize(audioRef)
  const emissionTimeData = useEmissionTime()

  // Configure Media Session API for lock screen
  useMediaSession(config.siteTitle, config.logoImage || '', play, pause, status)

  // Load visualizer asynchronously (code splitting)
  useEffect(() => {
    let cancelled = false

    const loadVisualizer = async () => {
      const defaultMetadata = getDefaultVisualizer()
      const loadedConfig = await getVisualizer(config.visualizer)

      // Only update state if component is still mounted
      if (!cancelled) {
        setVisualizerConfig(
          loadedConfig ||
            ({
              ...defaultMetadata,
              fn: () => {}, // Placeholder no-op function until visualizer loads
            } as VisualizerConfig),
        )
      }
    }

    loadVisualizer()

    return () => {
      cancelled = true
    }
  }, [config.visualizer])

  // Use visualizer only when loaded, fallback to default with placeholder function
  // The placeholder function is a no-op that gets called every frame while loading
  // This prevents errors but doesn't render anything until the visualizer loads
  const currentVisualizerConfig =
    visualizerConfig ||
    ({
      ...getDefaultVisualizer(),
      fn: () => {}, // Placeholder no-op function (called every frame but does nothing)
    } as VisualizerConfig)

  useAudioVisualizer(
    audioRef,
    canvasRef,
    status,
    dimensions.width,
    dimensions.height,
    currentVisualizerConfig.fn,
    currentVisualizerConfig.dataType,
  )

  // Handle window resize to update canvas dimensions
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Update canvas dimensions when window size changes
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = dimensions.width
      canvasRef.current.height = dimensions.height
    }
  }, [dimensions])

  // Show error snackbar when error occurs and loading is complete
  useEffect(() => {
    setOpenError(status === 'error' && loading === false)
  }, [status, loading])

  return (
    <Stack
      justifyContent="center"
      alignItems="center"
      width="100vw"
      height="100vh"
      position="relative"
    >
      {config.backgroundImage && (
        <Box
          component="img"
          src={config.backgroundImage}
          alt="Background"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 0,
            opacity: 0.3,
          }}
        />
      )}

      <StreamInfo
        title={config.siteTitle}
        logoImage={config.logoImage}
        isPlaying={status === 'playing'}
        canVisualize={canVisualize}
        loading={loading}
        forceVerticalCenter={currentVisualizerConfig.forceVerticalCenter}
      />

      <Box
        component="canvas"
        ref={canvasRef}
        role="img"
        aria-label={t('dashboard.audioVisualizer')}
        sx={{
          opacity: canVisualize ? 1 : 0,
          width: '100%',
          height: '100%',
          display: 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />

      <Stack alignItems="center" gap={2} position="absolute" bottom={25}>
        {sleepTimerSeconds !== null && (
          <SleepTimer
            remainingSeconds={sleepTimerSeconds}
            onCancel={() => setSleepTimerSeconds(null)}
          />
        )}
        <Box display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
          {hasSchedule ? (
            <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0}>
              <IconButton
                onClick={() => setOpenScheduleModal(true)}
                aria-label={t('dashboard.viewSchedule')}
                color="primary"
              >
                <CalendarMonthIcon />
              </IconButton>
              <IconButton
                onClick={() => setOpenAllProgramsModal(true)}
                aria-label={t('dashboard.viewAllPrograms')}
                color="primary"
              >
                <FormatListBulletedIcon />
              </IconButton>
            </Stack>
          ) : (
            <Box />
          )}
          <PlayerControls status={status} loading={loading} onPlay={play} onPause={pause} />
          <SleepMode
            isPlaying={status === 'playing'}
            onSleepTimerEnd={pause}
            onTimerChange={setSleepTimerSeconds}
            externalTimerSeconds={sleepTimerSeconds}
          />
        </Box>

        <VolumeControl volume={volume} onVolumeChange={handleVolumeChange} />
      </Stack>

      {hasSchedule && (
        <>
          <ScheduleModal open={openScheduleModal} onClose={() => setOpenScheduleModal(false)} />
          <AllProgramsModal
            open={openAllProgramsModal}
            onClose={() => setOpenAllProgramsModal(false)}
          />
        </>
      )}

      <audio ref={audioRef} hidden preload="none" />

      {/* Timezone clock - positioned discretely in top-right corner */}
      <TimezoneClock isPlaying={status === 'playing'} emissionTimeData={emissionTimeData} />

      <Snackbar open={openError} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
          {t('dashboard.playStreamError')}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default Dashboard
