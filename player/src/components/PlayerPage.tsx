import { useCallback, useRef, useState, useEffect } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import { useTranslation } from 'react-i18next'
import useAudioPlayer from 'src/hooks/use-audio-player'
import useAudioVisualizer from 'src/hooks/use-audio-visualizer'
import useMediaSession from 'src/hooks/use-media-session'
import useSleepTimer from 'src/hooks/use-sleep-timer'
import useConfig from 'src/hooks/use-config'
import useCurrentSong from 'src/hooks/use-current-song'
import type { ErrorReason } from 'src/core/audio/error-reason'
import { getVisualizer, getDefaultVisualizer } from 'src/core/visualizers/catalog'
import type { VisualizerDefinition } from 'src/core/visualizers/types'
import StreamInfo from 'src/components/StreamInfo'
import PlayerControls from 'src/components/PlayerControls'
import VolumeControl from 'src/components/VolumeControl'
import SleepMode from 'src/components/SleepMode'
import SleepTimer from 'src/components/SleepTimer'
import TimezoneClock from 'src/components/TimezoneClock'
import ScheduleModal from 'src/components/ScheduleModal'
import AllProgramsModal from 'src/components/AllProgramsModal'
import useTransmissionTime from 'src/hooks/use-transmission-time'
import IconButton from '@mui/material/IconButton'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'

/** The text of each error reason, shown to administrators only (ADR 0065) */
const REASON_KEYS: Record<ErrorReason['code'], string> = {
  'mixed-content': 'playerPage.diagnosticsMixedContent',
  http: 'playerPage.diagnosticsHttp',
  unreachable: 'playerPage.diagnosticsUnreachable',
  'not-supported': 'playerPage.diagnosticsNotSupported',
  'reconnect-exhausted': 'playerPage.diagnosticsReconnectExhausted',
}

/** The values of the text of a reason: the HTTP status, if any */
const reasonValues = (reason: ErrorReason) => ('status' in reason ? { status: reason.status } : {})

/**
 * The player page: the station info over the visualizer, the controls (play, volume,
 * sleep mode, the schedule and all programs modals), the clock when the listener's zone
 * differs from the station's, and the error alert.
 *
 * Reads the configuration through useConfig(). With showSong it shows the current song
 * (ADR 0068); with adminDiagnostics (users who can manage_options) the error alert adds
 * the reason and a link to test the stream (ADR 0065).
 */
const PlayerPage = () => {
  const config = useConfig()

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  const [openScheduleModal, setOpenScheduleModal] = useState(false)
  const [openAllProgramsModal, setOpenAllProgramsModal] = useState(false)
  const [visualizer, setVisualizer] = useState<VisualizerDefinition | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  // Focus targets when the sleep timer goes away (K58)
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
    reconnecting,
    introLocked,
    play,
    pause,
    volume,
    volumeControllable,
    handleVolumeChange,
    canVisualize,
    errorReason,
    getAnalyser,
  } = useAudioPlayer(config.streamUrl, config.introAudioUrl)
  // Only the live stream, not the welcome audio, asks for the song (ADR 0068)
  const song = useCurrentSong(
    config.streamUrl,
    config.showSong,
    status === 'playing' && !introLocked,
    audioRef,
  )
  const transmissionTimeData = useTransmissionTime()
  // With "reduce motion" the player looks as with no visualizer, also when the
  // preference changes while playing (K124, ADR 0072)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true })
  const showVisualizer = canVisualize && !reducedMotion

  // The error alert waits for the load to end.
  const openError = status === 'error' && !loading

  useMediaSession(config.siteTitle, config.logoImage || '', play, pause, status)

  // Sleep timer: pauses playback when the countdown runs out. Its display unmounts
  // then, so if it held the focus the focus goes to Play (K58)
  const handleSleepEnd = useCallback(() => {
    const hadFocus = sleepTimerRef.current?.contains(document.activeElement) ?? false
    pause()
    if (hadFocus) playButtonRef.current?.focus()
  }, [pause])
  const sleepTimer = useSleepTimer(status === 'playing', handleSleepEnd)

  // Cancelling unmounts the cancel button: the focus goes to "Sleep Timer" (K58)
  const handleSleepCancel = () => {
    sleepTimer.cancel()
    sleepModeRef.current?.focus()
  }

  // Each visualizer is a chunk of its own, loaded on demand.
  useEffect(() => {
    let cancelled = false

    const loadVisualizer = async () => {
      const loaded = await getVisualizer(config.visualizer)

      // Dropped if the visualizer changed or the PlayerPage unmounted meanwhile.
      if (!cancelled) {
        setVisualizer(loaded ?? null)
      }
    }

    loadVisualizer()

    return () => {
      cancelled = true
    }
  }, [config.visualizer])

  // Nothing is drawn until the visualizer loads; its metadata until then is the default
  const visualizerMetadata = visualizer ?? getDefaultVisualizer()

  useAudioVisualizer(
    getAnalyser,
    canvasRef,
    status === 'playing' && showVisualizer,
    dimensions.width,
    dimensions.height,
    visualizer,
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

  // The station info goes to the top while a visualizer draws
  const atTop = status === 'playing' && showVisualizer && !visualizerMetadata.forceVerticalCenter
  // Top row: the clock, or at least 16px without it
  const topRowMin = transmissionTimeData.hasDifference ? 'auto' : '16px'

  // In flow: header (clock), main (station info over the visualizer layer) and
  // the controls region, as landmarks (K61, ADR 0051). The outer rows share the
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
            // Decorative: the station and the state of Play are in the page (ADR 0072)
            aria-hidden="true"
            sx={{
              opacity: showVisualizer ? 1 : 0,
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
          canVisualize={showVisualizer}
          loading={loading}
          reconnecting={reconnecting}
          hideTitle={config.hideTitle}
          song={song}
        />
      </Box>

      <Stack
        component="section"
        aria-label={t('playerPage.playerControls')}
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
              <Tooltip title={t('playerPage.viewSchedule')} placement="top" arrow>
                <IconButton
                  onClick={() => setOpenScheduleModal(true)}
                  aria-label={t('playerPage.viewSchedule')}
                  color="primary"
                >
                  <CalendarMonthIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('playerPage.viewAllPrograms')} placement="top" arrow>
                <IconButton
                  onClick={() => setOpenAllProgramsModal(true)}
                  aria-label={t('playerPage.viewAllPrograms')}
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
          {t('playerPage.playStreamError')}
          {config.adminDiagnostics && (
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              {errorReason && `${t(REASON_KEYS[errorReason.code], reasonValues(errorReason))} `}
              <Link href={config.adminDiagnostics.editUrl} color="inherit" underline="always">
                {t('playerPage.diagnosticsTestStream')}
              </Link>
            </Box>
          )}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default PlayerPage
