import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Collapse from '@mui/material/Collapse'
import Box from '@mui/material/Box'
import { useTranslation } from 'react-i18next'
import useProgramSchedule from 'src/hooks/use-program-schedule'
import { Avatar } from '@mui/material'

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
  /** Hide the title visually; screen readers still read it (ADR 0054) */
  hideTitle?: boolean
}

/**
 * Visually hidden: out of the layout and invisible, but still in the
 * accessibility tree (not display: none nor aria-hidden; ADR 0054)
 */
const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const

/**
 * Stream information display component
 * Shows the station logo, title, connection status, and playing indicator
 * Sits in the page flow, inside main; Dashboard centers it in the window or
 * puts it at the top while a visualizer draws (ADR 0055)
 *
 * Features:
 * - Displays station logo (if logoImage prop is provided)
 * - Shows station title, or keeps it only for screen readers with hideTitle
 * - Shows active program name and time range if schedule is configured
 * - Shows "connecting" message when loading and not playing, in a status region
 * - Shows animated dot indicator when playing but visualization is not available
 *   (e.g., Safari with cross-origin audio due to CORS restrictions)
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
  hideTitle = false,
}: StreamInfoProps) => {
  const { t } = useTranslation()
  const { active: currentProgram, incoming: upcomingProgram } = useProgramSchedule()

  return (
    <Stack
      sx={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        gap: 1,
        px: 2,
        py: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {logoImage && (
        <Box
          component="img"
          src={logoImage}
          alt={t('dashboard.stationLogo', { name: title })}
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
        sx={
          hideTitle
            ? visuallyHidden
            : { textWrap: 'balance', hyphens: 'auto', overflowWrap: 'break-word' }
        }
      >
        {title}
      </Typography>
      <Stack
        sx={{
          gap: 3,
        }}
      >
        {/* Show active program if schedule is configured */}
        {currentProgram && (
          <Stack
            sx={{
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'center', sm: 'baseline' },
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            <Typography
              variant="body2"
              component="p"
              sx={{
                lineHeight: 1,
              }}
            >
              {t('dashboard.activeProgram')}:
            </Typography>

            <Stack
              sx={{
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'center', sm: 'baseline' },
                justifyContent: 'center',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              {currentProgram.programLogoUrl && (
                <Box
                  sx={{
                    position: { sm: 'relative' },
                    bottom: { xs: 0, sm: '-12px' },
                    marginBottom: { xs: 0, sm: '8px' },
                  }}
                >
                  <Avatar src={currentProgram.programLogoUrl} alt="" aria-hidden />
                </Box>
              )}

              <Typography
                variant="h4"
                component="p"
                sx={{
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  hyphens: 'auto',
                }}
              >
                {currentProgram.programName}
              </Typography>
              {currentProgram.isRerun && (
                <Typography
                  variant="body2"
                  component="p"
                  sx={{
                    color: 'text.secondary',
                    lineHeight: 1,
                  }}
                >
                  {t('dashboard.rerunLabel')}
                </Typography>
              )}
            </Stack>
          </Stack>
        )}
        {/* Show upcoming program announcement if it starts within 10 minutes */}
        {upcomingProgram && (
          <Stack
            direction="row"
            sx={{
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              variant="body2"
              component="p"
              sx={{
                lineHeight: 1,
              }}
            >
              {t('dashboard.upcomingPrefix')}:
            </Typography>
            <Typography
              variant="body1"
              component="p"
              sx={{
                fontWeight: 'bold',
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                hyphens: 'auto',
              }}
            >
              {upcomingProgram.programName}
            </Typography>
            {upcomingProgram.isRerun && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  lineHeight: 1,
                }}
              >
                {t('dashboard.rerunLabel')}
              </Typography>
            )}
            <Typography
              variant="body2"
              component="p"
              sx={{
                lineHeight: 1,
              }}
            >
              {t('dashboard.upcomingInMinutes', { count: upcomingProgram.minutesUntil })}{' '}
              {upcomingProgram.timeRange}
            </Typography>
          </Stack>
        )}
      </Stack>
      {/* Status region, always mounted so that the connecting message is
          announced (ADR 0051); when empty, it gives the Stack gap back */}
      <Typography
        role="status"
        component="p"
        variant="h5"
        sx={{
          textWrap: 'balance',
          hyphens: 'auto',
          '&:empty': { mt: -1 },
        }}
      >
        {loading && !isPlaying ? t('dashboard.connecting') : null}
      </Typography>

      {/* Animated playing indicator when playing but visualization is not available
          (e.g., Safari with cross-origin audio due to CORS restrictions) */}
      <Collapse
        in={isPlaying && !canVisualize}
        timeout={200}
        collapsedSize={0}
        unmountOnExit
        orientation="vertical"
      >
        <Stack
          sx={{
            gap: 1,
            alignItems: 'center',
          }}
        >
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
                  // Still and full size under "reduce motion" (the theme
                  // stops the animation)
                  '@media (prefers-reduced-motion: reduce)': { transform: 'none' },
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
