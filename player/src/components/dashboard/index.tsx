import { useRef, useState, useEffect } from 'react'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import useAudioPlayer from '../../hooks/use-audio-player'
import useAudioVisualizer from '../../hooks/use-audio-visualizer'
import theme from '../../config/theme'
import Collapse from '@mui/material/Collapse'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

const Dashboard = () => {
  const STREAM_URL = window.STREAM_URL || ''
  const SITE_TITLE = window.SITE_TITLE || ''

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [openError, setOpenError] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  const { audioRef, status, loading, play, pause } = useAudioPlayer(STREAM_URL)

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

  const { canVisualize } = useAudioVisualizer(
    audioRef,
    canvasRef,
    status,
    dimensions.width,
    dimensions.height,
  )

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
      <Stack
        position={'absolute'}
        top={canVisualize && status === 'playing' ? 16 : 'calc(50% - 2rem)'}
        textAlign={'center'}
        sx={{ transition: 'all 0.8s ease' }}
        zIndex={theme.zIndex.tooltip}
        gap={1}
        direction={'row'}
      >
        <Typography variant="h5" component="h1">
          {SITE_TITLE}
        </Typography>

        <Collapse
          in={status === 'playing' && !canVisualize}
          timeout={2000}
          collapsedSize={0}
          orientation="horizontal"
        >
          <Typography variant="h5" whiteSpace={'nowrap'}>
            is on live!
          </Typography>
        </Collapse>
      </Stack>

      <Box
        component="canvas"
        ref={canvasRef}
        sx={{
          opacity: canVisualize ? 1 : 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      <Stack alignItems="center" gap={2} position="absolute" bottom={18}>
        {loading && !openError ? (
          <CircularProgress size={48} />
        ) : status !== 'playing' ? (
          <IconButton onClick={play} size="large">
            <PlayArrowIcon />
          </IconButton>
        ) : (
          <IconButton onClick={pause} size="large">
            <PauseIcon />
          </IconButton>
        )}
      </Stack>

      <audio ref={audioRef} hidden preload="none" />

      <Snackbar open={openError} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" sx={{ width: '100%' }}>
          Unable to play the stream. Please check the URL or try again later.
        </Alert>
      </Snackbar>
    </Stack>
  )
}

export default Dashboard
