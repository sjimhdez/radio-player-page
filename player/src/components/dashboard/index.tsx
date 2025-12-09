import { useRef, useState, useEffect } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useTranslation } from 'react-i18next'
import useAudioPlayer from 'src/hooks/use-audio-player'
import useAudioVisualizer from 'src/hooks/use-audio-visualizer'
import { useCanVisualize } from 'src/hooks/use-can-visualize'
import { getVisualizer, getDefaultVisualizer } from 'src/config/visualizers'
import StreamInfo from './StreamInfo'
import PlayerControls from './PlayerControls'
import VolumeControl from './VolumeControl'
import SleepMode from './SleepMode'
import SleepTimer from './SleepTimer'

const Dashboard = () => {
  const STREAM_URL = window.STREAM_URL || ''
  const SITE_TITLE = window.SITE_TITLE || ''
  const VISUALIZER_ID = window.VISUALIZER || 'oscilloscope'

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [openError, setOpenError] = useState(false)
  const [sleepTimerSeconds, setSleepTimerSeconds] = useState<number | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  const { t } = useTranslation()
  const { audioRef, status, loading, play, pause, volume, handleVolumeChange } =
    useAudioPlayer(STREAM_URL)
  const canVisualize = useCanVisualize(audioRef)

  // Get the visualizer configured from admin, or use the default
  const visualizerConfig = getVisualizer(VISUALIZER_ID) || getDefaultVisualizer()

  useAudioVisualizer(
    audioRef,
    canvasRef,
    status,
    dimensions.width,
    dimensions.height,
    visualizerConfig.fn,
    visualizerConfig.dataType,
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

  useEffect(() => {
    setOpenError(status === 'error')
  }, [status])

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

      <Stack alignItems="center" gap={2} position="absolute" bottom={18}>
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

      <Snackbar open={openError} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          {t('dashboard.playStreamError')}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default Dashboard
