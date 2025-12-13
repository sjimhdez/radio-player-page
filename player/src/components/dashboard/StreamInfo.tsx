import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Collapse from '@mui/material/Collapse'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import { useRef, useState, useEffect } from 'react'

interface StreamInfoProps {
  title: string
  isPlaying: boolean
  canVisualize: boolean
  loading: boolean
  forceVerticalCenter?: boolean
}

const StreamInfo = ({
  title,
  isPlaying,
  canVisualize,
  loading,
  forceVerticalCenter = false,
}: StreamInfoProps) => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>(0)

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
  }, [title, isPlaying, canVisualize, loading])

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
      zIndex={(theme) => theme.zIndex.tooltip}
      gap={1}
      px={2}
      py={1}
      alignItems="center"
      justifyContent="center"
    >
      {window.LOGO_IMAGE && (
        <Box
          component="img"
          src={window.LOGO_IMAGE}
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
        variant="h1"
        component="h1"
        sx={{ textWrap: 'balance', hyphens: 'auto', overflowWrap: 'break-word' }}
      >
        {title}
      </Typography>
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
