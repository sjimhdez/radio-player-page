import { useCallback, useRef, useState, useEffect } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useTranslation } from 'react-i18next'
import useAudioPlayer from 'src/hooks/use-audio-player'
import useAudioVisualizer from 'src/hooks/use-audio-visualizer'
import useMediaSession from 'src/hooks/use-media-session'
import useSleepTimer from 'src/hooks/use-sleep-timer'
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
import useTransmissionTime from 'src/hooks/use-transmission-time'
import IconButton from '@mui/material/IconButton'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import Tooltip from '@mui/material/Tooltip'

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
 * - Timezone clock: visible whenever the listener's timezone differs from the
 *   station's (always visible in that case, independent of playback state)
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
  const [openScheduleModal, setOpenScheduleModal] = useState(false)
  const [openAllProgramsModal, setOpenAllProgramsModal] = useState(false)
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  // Focus targets when the sleep timer goes away (known-issues.md K58)
  const playButtonRef = useRef<HTMLButtonElement>(null)
  const sleepModeRef = useRef<HTMLButtonElement>(null)
  const sleepTimerRef = useRef<HTMLDivElement>(null)

  const { t, i18n } = useTranslation()
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
  const {
    audioRef,
    status,
    loading,
    introLocked,
    play,
    pause,
    volume,
    volumeControllable,
    handleVolumeChange,
    canVisualize,
    getAnalyser,
  } = useAudioPlayer(config.streamUrl, config.introAudioUrl)
  const transmissionTimeData = useTransmissionTime()

  // Show error snackbar when error occurs and loading is complete
  const openError = status === 'error' && !loading

  // Configure Media Session API for lock screen
  useMediaSession(config.siteTitle, config.logoImage || '', play, pause, status)

  // Sleep timer: pauses playback when the countdown runs out. Its display unmounts
  // then, so if it held the focus the focus goes to Play (known-issues.md K58)
  const handleSleepEnd = useCallback(() => {
    const hadFocus = sleepTimerRef.current?.contains(document.activeElement) ?? false
    pause()
    if (hadFocus) playButtonRef.current?.focus()
  }, [pause])
  const sleepTimer = useSleepTimer(status === 'playing', handleSleepEnd)

  // Cancelling unmounts the cancel button: the focus goes to "Sleep mode" (K58)
  const handleSleepCancel = () => {
    sleepTimer.cancel()
    sleepModeRef.current?.focus()
  }

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
    getAnalyser,
    canvasRef,
    status === 'playing' && canVisualize,
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

  // The station info goes to the top while a visualizer draws
  const atTop = status === 'playing' && canVisualize && !currentVisualizerConfig.forceVerticalCenter
  // Top row: the clock, or at least 16px without it
  const topRowMin = transmissionTimeData.hasDifference ? 'auto' : '16px'

  // In flow: header (clock), main (station info over the visualizer layer) and
  // the controls region (known-issues.md K61, AX1). The outer rows share the
  // free space, so the station info sits in the middle of the window; with no
  // room, the controls row keeps its content and the station info goes up.
  // The height is definite: with min-height the free space is indefinite and
  // both outer rows grow to the tallest (ADR 0055)
  return (
    <Box
      lang={i18n.resolvedLanguage}
      sx={{
        display: 'grid',
        gridTemplateRows: `minmax(${topRowMin}, ${atTop ? 0 : 1}fr) auto minmax(auto, 1fr)`,
        // fr to fr animates where auto margins do not (K92)
        transition: 'grid-template-rows 0.8s ease',
        width: '100%',
        height: '100vh',
        '@supports (height: 100dvh)': { height: '100dvh' },
      }}
    >
      {transmissionTimeData.hasDifference && (
        <Box
          component="header"
          sx={{
            gridRow: 1,
            alignSelf: 'start',
            display: 'flex',
            justifyContent: 'flex-end',
            p: 2,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <TimezoneClock transmissionTimeData={transmissionTimeData} />
        </Box>
      )}

      <Box
        component="main"
        sx={{
          gridRow: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Background and visualizer, fixed to the window behind the content */}
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          {config.backgroundImage && (
            <Box
              component="img"
              src={config.backgroundImage}
              alt=""
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.3,
              }}
            />
          )}
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
            }}
          />
        </Box>

        <StreamInfo
          title={config.siteTitle}
          logoImage={config.logoImage}
          isPlaying={status === 'playing'}
          canVisualize={canVisualize}
          loading={loading}
          hideTitle={config.hideTitle}
        />
      </Box>

      <Stack
        component="section"
        aria-label={t('dashboard.playerControls')}
        sx={{
          gridRow: 3,
          alignSelf: 'end',
          alignItems: 'center',
          gap: 2,
          pt: 2,
          pb: '25px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {sleepTimer.remainingSeconds !== null && (
          <SleepTimer
            ref={sleepTimerRef}
            remainingSeconds={sleepTimer.remainingSeconds}
            onCancel={handleSleepCancel}
          />
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 1,
          }}
        >
          {hasSchedule ? (
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 2,
              }}
            >
              <Tooltip title={t('dashboard.viewSchedule')} placement="top" arrow>
                <IconButton
                  onClick={() => setOpenScheduleModal(true)}
                  aria-label={t('dashboard.viewSchedule')}
                  color="primary"
                >
                  <CalendarMonthIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('dashboard.viewAllPrograms')} placement="top" arrow>
                <IconButton
                  onClick={() => setOpenAllProgramsModal(true)}
                  aria-label={t('dashboard.viewAllPrograms')}
                  color="primary"
                >
                  <FormatListBulletedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : (
            <Box />
          )}
          <PlayerControls
            ref={playButtonRef}
            status={status}
            loading={loading}
            disabled={introLocked}
            onPlay={play}
            onPause={pause}
          />
          <SleepMode
            ref={sleepModeRef}
            isPlaying={status === 'playing' && !introLocked}
            onSelect={(minutes) => sleepTimer.start(minutes * 60)}
          />
        </Box>

        <VolumeControl
          volume={volume}
          controllable={volumeControllable}
          onVolumeChange={handleVolumeChange}
        />
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

      <Snackbar open={openError} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
          {t('dashboard.playStreamError')}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default Dashboard
