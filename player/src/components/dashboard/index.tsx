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

  // Configurar Media Session API para pantalla de bloqueo
  useMediaSession(SITE_TITLE, LOGO_IMAGE, play, pause)

  // Load visualizer asynchronously
  useEffect(() => {
    let cancelled = false

    const loadVisualizer = async () => {
      const defaultMetadata = getDefaultVisualizer()
      const loadedConfig = await getVisualizer(VISUALIZER_ID)

      if (!cancelled) {
        setVisualizerConfig(
          loadedConfig ||
            ({
              ...defaultMetadata,
              fn: () => {}, // Placeholder until loaded
            } as VisualizerConfig),
        )
      }
    }

    loadVisualizer()

    return () => {
      cancelled = true
    }
  }, [VISUALIZER_ID])

  // Use visualizer only when loaded
  const currentVisualizerConfig =
    visualizerConfig ||
    ({
      ...getDefaultVisualizer(),
      fn: () => {}, // Placeholder function
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

  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.width = dimensions.width
      canvasRef.current.height = dimensions.height
    }
  }, [dimensions])

  // Show error snackbar when status is 'error' and loading is false
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
          <PlayerControls
            status={status}
            loading={loading}
            error={openError}
            onPlay={play}
            onPause={pause}
          />
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
