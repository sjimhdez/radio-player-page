import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Collapse from '@mui/material/Collapse'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useRef, useState, useEffect } from 'react'
import useProgramSchedule from 'src/hooks/use-program-schedule'

interface StreamInfoProps {
  /** Radio station or stream title */
  title: string
  /** Station logo image URL (optional) */
  logoImage?: string | null
  /** Whether the stream is currently playing */
  isPlaying: boolean
  /** Whether audio visualization is available */
  canVisualize: boolean
  /** Whether the player is currently loading */
  loading: boolean
  /** Force vertical centering regardless of visualization state */
  forceVerticalCenter?: boolean
}

/**
 * Stream information display component
 * Shows the station logo, title, connection status, and playing indicator
 * Dynamically positions itself based on visualization state and playback status
 *
 * Features:
 * - Displays station logo (if logoImage prop is provided)
 * - Shows station title
 * - Shows active program name and time range if schedule is configured
 * - Shows "connecting" message when loading and not playing
 * - Shows animated dot indicator when playing but visualization is not available
 *   (e.g., Safari with cross-origin audio due to CORS restrictions)
 * - Automatically adjusts vertical position based on visualization availability
 *
 * @param props - Component props
 * @returns Stream information display with logo and title
 */
const StreamInfo = ({
  title,
  logoImage,
  isPlaying,
  canVisualize,
  loading,
  forceVerticalCenter = false,
}: StreamInfoProps) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>(0)
  const { active: currentProgram, incoming: upcomingProgram } = useProgramSchedule()

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setHeight(containerRef.current.offsetHeight)
      }
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(updateHeight)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [title, isPlaying, canVisualize, loading, currentProgram, upcomingProgram])

  return (
    <Stack
      ref={containerRef}
      position={'absolute'}
      top={
        forceVerticalCenter || !(canVisualize && isPlaying)
          ? height > 0
            ? `calc(50% - ${height / 2}px)`
            : 'calc(50% - 2rem)'
          : 16
      }
      textAlign={'center'}
      sx={{ transition: 'all 0.8s ease' }}
      zIndex={(theme) => theme.zIndex.appBar}
      gap={1}
      px={2}
      py={1}
      alignItems="center"
      justifyContent="center"
    >
      {logoImage && (
        <Box
          component="img"
          src={logoImage}
          alt="Logo"
          sx={{
            width: 75,
            height: 75,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )}
      <Typography
        variant="h2"
        component="h1"
        sx={{ textWrap: 'balance', hyphens: 'auto', overflowWrap: 'break-word' }}
      >
        {title}
      </Typography>
      {/* Show active program if schedule is configured */}
      {currentProgram && (
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography variant="body2" component="p" sx={{ textWrap: 'balance', hyphens: 'auto' }}>
            {t('dashboard.activeProgram')}:
          </Typography>
          {currentProgram.programLogoUrl && (
            <Box
              component="img"
              src={currentProgram.programLogoUrl}
              alt=""
              aria-hidden
              sx={{
                width: 36,
                height: 36,
                objectFit: 'contain',
              }}
            />
          )}
          <Stack direction="row" alignItems="baseline" gap={1}>
            <Typography variant="h4" component="p" sx={{ textWrap: 'balance', hyphens: 'auto' }}>
              {currentProgram.programName}
            </Typography>
          </Stack>
        </Stack>
      )}
      {/* Show upcoming program announcement if it starts within 10 minutes */}
      {upcomingProgram && (
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Stack direction="row" alignItems="baseline" gap={0.5}>
            <Typography variant="body2" component="p" sx={{ textWrap: 'balance', hyphens: 'auto' }}>
              {t('dashboard.upcomingPrefix')}:
            </Typography>
            <Typography
              variant="body1"
              component="p"
              fontWeight="bold"
              sx={{ textWrap: 'balance', hyphens: 'auto' }}
            >
              {upcomingProgram.programName}{' '}
            </Typography>
            <Typography variant="body2" component="p" sx={{ textWrap: 'balance', hyphens: 'auto' }}>
              {t('dashboard.upcomingInMinutes', { minutes: upcomingProgram.minutesUntil })}{' '}
              {upcomingProgram.timeRange}
            </Typography>
          </Stack>
        </Stack>
      )}
      {/* Show connecting message when loading but not yet playing */}
      {loading && !isPlaying && (
        <Typography
          component="p"
          variant="h5"
          sx={{
            textWrap: 'balance',
            hyphens: 'auto',
            animation: 'blink 2s infinite',
            '@keyframes blink': { '0%, 100%': { opacity: 0 }, '50%': { opacity: 1 } },
          }}
        >
          {t('dashboard.connecting')}
        </Typography>
      )}

      {/* Animated playing indicator when playing but visualization is not available
          (e.g., Safari with cross-origin audio due to CORS restrictions) */}
      <Collapse
        in={isPlaying && !canVisualize}
        timeout={200}
        collapsedSize={0}
        orientation="vertical"
      >
        <Stack gap={1} alignItems={'center'}>
          <Box
            component="div"
            className="loader"
            sx={(theme) => {
              const errorColor = theme.palette.error.main
              return {
                position: 'relative',
                display: 'flex',
                '& .dot': {
                  position: 'relative',
                  display: 'block',
                  width: '10px',
                  height: '10px',
                  background: errorColor,
                  boxShadow: `0 0 10px ${errorColor}, 0 0 20px ${errorColor}, 0 0 40px ${errorColor}, 0 0 60px ${errorColor}, 0 0 80px ${errorColor}, 0 0 100px ${errorColor}`,
                  margin: '10px 5px 0',
                  transform: 'scale(0.1)',
                  borderRadius: '50%',
                  animation: 'animatePlayingDot 2s linear infinite',
                },
                '& .dot:nth-of-type(1)': { animationDelay: 'calc(0.1s * 0)' },
                '& .dot:nth-of-type(2)': { animationDelay: 'calc(0.1s * 1)' },
                '& .dot:nth-of-type(3)': { animationDelay: 'calc(0.1s * 2)' },
                '& .dot:nth-of-type(4)': { animationDelay: 'calc(0.1s * 3)' },
                '& .dot:nth-of-type(5)': { animationDelay: 'calc(0.1s * 4)' },
                '& .dot:nth-of-type(6)': { animationDelay: 'calc(0.1s * 5)' },
                '& .dot:nth-of-type(7)': { animationDelay: 'calc(0.1s * 6)' },
                '& .dot:nth-of-type(8)': { animationDelay: 'calc(0.1s * 7)' },
                '& .dot:nth-of-type(9)': { animationDelay: 'calc(0.1s * 8)' },
                '& .dot:nth-of-type(10)': { animationDelay: 'calc(0.1s * 9)' },
              }
            }}
          >
            {[...Array(10)].map((_, i) => (
              <Box key={i} component="div" className="dot" />
            ))}
          </Box>
        </Stack>
      </Collapse>
    </Stack>
  )
}

export default StreamInfo
