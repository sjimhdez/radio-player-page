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
import { getVisualizer, getDefaultVisualizer, type VisualizerConfig } from 'src/config/visualizers'
import StreamInfo from './StreamInfo'
import PlayerControls from './PlayerControls'
import VolumeControl from './VolumeControl'
import SleepMode from './SleepMode'
import SleepTimer from './SleepTimer'

/**
 * Main dashboard component
 * Orchestrates all player functionality including:
 * - Audio playback with support for HLS, DASH, and standard streams
 * - Audio visualization on canvas
 * - Media Session API integration for lock screen controls
 * - Sleep timer functionality
 * - Volume control
 * - Error handling and user feedback
 *
 * Reads configuration from window global variables:
 * - STREAM_URL: Audio stream URL
 * - SITE_TITLE: Radio station title
 * - LOGO_IMAGE: Station logo URL
 * - BACKGROUND_IMAGE: Optional background image URL
 * - VISUALIZER: Visualizer ID (oscilloscope, bars, particles, waterfall)
 * - THEME_COLOR: Theme color name
 *
 * @returns Complete radio player dashboard interface
 */
const Dashboard = () => {
  const STREAM_URL = window.STREAM_URL || ''
  const SITE_TITLE = window.SITE_TITLE || ''
  const LOGO_IMAGE = window.LOGO_IMAGE || ''
  const VISUALIZER_ID = window.VISUALIZER || 'oscilloscope'

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [openError, setOpenError] = useState(false)
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null)
  const [visualizerConfig, setVisualizerConfig] = useState<VisualizerConfig | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  const { t } = useTranslation()
  const { audioRef, status, loading, play, pause, volume, handleVolumeChange } =
    useAudioPlayer(STREAM_URL)
  const canVisualize = useCanVisualize(audioRef)

  // Configure Media Session API for lock screen
  useMediaSession(SITE_TITLE, LOGO_IMAGE, play, pause, status)

  // Load visualizer asynchronously (code splitting)
  useEffect(() => {
    let cancelled = false

    const loadVisualizer = async () => {
      const defaultMetadata = getDefaultVisualizer()
      const loadedConfig = await getVisualizer(VISUALIZER_ID)

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
  }, [VISUALIZER_ID])

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
      {window.BACKGROUND_IMAGE && (
        <Box
          component="img"
          src={window.BACKGROUND_IMAGE}
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
        title={SITE_TITLE}
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
          <Box />
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

      <audio ref={audioRef} hidden preload="none" />

      <Snackbar open={openError} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
          {t('dashboard.playStreamError')}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default Dashboard
