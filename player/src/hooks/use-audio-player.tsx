import { useRef, useState, useCallback, useEffect } from 'react'
import type { PlayerStatus } from 'src/types/player'
import type Hls from 'hls.js'
import type { MediaPlayerClass } from 'dashjs'
import { useIsIOS } from 'src/hooks/use-is-ios'

/**
 * Lazy loads HLS.js library
 * Only loaded when needed for HLS stream support on non-iOS devices
 *
 * @returns Promise resolving to HLS.js default export
 */
const loadHls = async () => {
  const hlsModule = await import('hls.js')
  return hlsModule.default
}

/**
 * Lazy loads dash.js MediaPlayer library
 * Only loaded when needed for DASH stream support
 *
 * @returns Promise resolving to dash.js MediaPlayer class
 */
const loadDashjs = async () => {
  const dashModule = await import('dashjs')
  return dashModule.MediaPlayer
}

/**
 * Custom hook for managing audio playback
 * Supports multiple streaming protocols: HLS (.m3u8), DASH (.mpd), and standard audio streams
 * Automatically selects the appropriate playback method based on stream URL and device capabilities
 *
 * Features:
 * - Automatic protocol detection and library loading
 * - iOS native HLS support (no library needed)
 * - Error handling and status management
 * - Volume control (disabled on iOS)
 * - Cleanup of streaming libraries on unmount or stream change
 *
 * @param streamUrl - URL of the audio stream to play
 * @param introUrl - Optional welcome audio (mp3) URL played once, before the first
 *   live stream playback of this hook instance. Not skippable or pausable while active.
 * @returns Audio player state and control functions
 * @returns audioRef - React ref to the HTMLAudioElement
 * @returns status - Current playback status ('idle' | 'playing' | 'paused' | 'error')
 * @returns loading - Whether the player is currently loading/buffering
 * @returns introLocked - Whether the welcome audio is currently playing (presentational only)
 * @returns play - Function to start or resume playback
 * @returns pause - Function to pause playback (no-op while introLocked)
 * @returns volume - Current volume level (0-1)
 * @returns handleVolumeChange - Function to change volume (ignored on iOS)
 */
function useAudioPlayer(streamUrl: string, introUrl?: string | null) {
  const audioRef = useRef<HTMLAudioElement>(null!)
  const hlsRef = useRef<Hls | null>(null)
  const dashRef = useRef<MediaPlayerClass | null>(null)
  const statusRef = useRef<PlayerStatus>('idle')
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(1)
  const isIOS = useIsIOS()

  // Tracks which source is currently loaded into the audio element: the one-time
  // welcome audio, or the live stream. Starts null (nothing loaded yet).
  const activeSourceRef = useRef<'intro' | 'live' | null>(null)
  // Whether the welcome audio has already played (or been skipped/failed) this page load.
  const introConsumedRef = useRef(false)
  // Presentational only: lets the UI grey out the play/pause button. The actual
  // "can't pause the welcome audio" guarantee lives in pause() below.
  const [introLocked, setIntroLocked] = useState(false)

  // Sync statusRef with status state
  useEffect(() => {
    statusRef.current = status
  }, [status])

  /**
   * Destroys HLS and DASH player instances
   * Called when changing streams or on component unmount
   */
  const destroyPlayers = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    if (dashRef.current) {
      dashRef.current.reset()
      dashRef.current = null
    }
  }, [])

  /**
   * Loads and plays the live stream (HLS/DASH/standard), detecting protocol from
   * the URL. Marks the active source as 'live' and clears the intro lock on success.
   * Does not catch its own errors - callers are responsible for error handling.
   */
  const playLiveStream = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    // Cleanup previous players if loading a new stream
    destroyPlayers()

    // Detect streaming protocol from URL extension
    const isHls = streamUrl.endsWith('.m3u8')
    const isDash = streamUrl.endsWith('.mpd')

    if (isHls) {
      // iOS Safari has native HLS support, no library needed
      if (isIOS) {
        audio.src = streamUrl
        audio.crossOrigin = 'anonymous'
        audio.load()
        await audio.play()
      } else {
        // Use HLS.js for non-iOS devices
        const Hls = await loadHls()
        if (Hls.isSupported()) {
          const hls = new Hls()
          hlsRef.current = hls
          hls.loadSource(streamUrl)
          hls.attachMedia(audio)

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            audio.play().catch(() => {
              setStatus('error')
              statusRef.current = 'error'
            })
          })

          hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
              setStatus('error')
              statusRef.current = 'error'
            }
          })
        } else {
          // HLS.js not supported, fallback to native browser support
          audio.src = streamUrl
          audio.crossOrigin = 'anonymous'
          audio.load()
          await audio.play()
        }
      }
    } else if (isDash) {
      // DASH streaming using dash.js
      // Third parameter (true) enables autoPlay - playback starts automatically
      const MediaPlayer = await loadDashjs()
      const player = MediaPlayer().create()
      dashRef.current = player
      player.initialize(audio, streamUrl, true)
      player.on('error', () => {
        setStatus('error')
        statusRef.current = 'error'
      })
    } else {
      // Standard audio stream (MP3, OGG, etc.)
      audio.src = streamUrl
      audio.crossOrigin = 'anonymous'
      audio.load()
      await audio.play()
    }

    activeSourceRef.current = 'live'
    setIntroLocked(false)
    setStatus('playing')
    statusRef.current = 'playing'
  }, [streamUrl, destroyPlayers, isIOS])

  /**
   * Marks the welcome audio as consumed and switches to the live stream.
   * Used both when the welcome audio finishes naturally ('ended') and when it
   * fails to load/play - either way, playback falls through to the live stream
   * silently, with no distinct error state for the welcome audio itself.
   */
  const advanceToLive = useCallback(async () => {
    introConsumedRef.current = true
    try {
      setLoading(true)
      await playLiveStream()
    } catch {
      setStatus('error')
      statusRef.current = 'error'
    } finally {
      setLoading(false)
    }
  }, [playLiveStream])

  const play = useCallback(async () => {
    if (!audioRef.current) return
    const audio = audioRef.current

    // First call of this player instance: decide whether to start with the
    // welcome audio or go straight to the live stream.
    if (activeSourceRef.current === null) {
      if (introUrl && !introConsumedRef.current) {
        activeSourceRef.current = 'intro'
        setIntroLocked(true)
        try {
          setLoading(true)
          audio.src = introUrl
          audio.crossOrigin = 'anonymous'
          audio.load()
          await audio.play()
          setStatus('playing')
          statusRef.current = 'playing'
        } catch {
          // Welcome audio failed to load/play: fall through to the live stream
          // silently, exactly as if it had played and ended normally.
          await advanceToLive()
        } finally {
          setLoading(false)
        }
        return
      }

      try {
        setLoading(true)
        await playLiveStream()
      } catch {
        setStatus('error')
        statusRef.current = 'error'
      } finally {
        setLoading(false)
      }
      return
    }

    // Welcome audio is currently playing: play() has nothing to do (pause() is
    // blocked while it's active, so this can only be reached if it's already playing).
    if (activeSourceRef.current === 'intro') {
      return
    }

    // Live stream: resume if already loaded, otherwise (re)load it.
    try {
      setLoading(true)

      if (audio.src === streamUrl && status !== 'error') {
        if (audio.paused) {
          await audio.play()
          setStatus('playing')
          statusRef.current = 'playing'
        }
        return
      }

      await playLiveStream()
    } catch {
      setStatus('error')
      statusRef.current = 'error'
    } finally {
      setLoading(false)
    }
  }, [streamUrl, introUrl, status, playLiveStream, advanceToLive])

  const pause = useCallback(() => {
    // The welcome audio cannot be paused/interrupted - this is the single
    // enforcement point, covering the on-screen button, Media Session's OS-level
    // pause handler, and the sleep timer's auto-pause alike.
    if (activeSourceRef.current === 'intro') {
      return
    }
    audioRef.current?.pause()
    setStatus('paused')
    statusRef.current = 'paused'
  }, [])

  const handleVolumeChange = useCallback(
    (newVolume: number) => {
      // Only change volume if not iOS
      if (!isIOS && audioRef.current) {
        audioRef.current.volume = newVolume
        setVolume(newVolume)
      }
    },
    [isIOS],
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Only set volume if not iOS
    if (!isIOS) {
      audio.volume = volume
    }

    // Event handler: updates playback status to 'playing'
    const onPlaying = () => {
      setStatus('playing')
      statusRef.current = 'playing'
    }
    const onPause = () => {
      setStatus('paused')
      statusRef.current = 'paused'
    }
    const onError = () => {
      setStatus('error')
      statusRef.current = 'error'
    }
    const onCanPlay = () => {
      // Only clear loading state if we were in idle or error state
      // (don't interfere with normal playback states)
      if (statusRef.current === 'idle' || statusRef.current === 'error') {
        setLoading(false)
      }
    }
    const onWaiting = () => setLoading(true)
    // Event handler: clears loading state when playback resumes after buffering
    // Note: This is a second 'playing' listener with a different purpose
    const onPlayingFromWaiting = () => setLoading(false)
    // Event handler: when the welcome audio finishes naturally, switch to the live stream
    const onEnded = () => {
      if (activeSourceRef.current === 'intro') {
        advanceToLive()
      }
    }

    // Add event listeners
    // Note: 'playing' event has two handlers:
    // 1. onPlaying: updates status to 'playing'
    // 2. onPlayingFromWaiting: clears loading state after buffering
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('playing', onPlayingFromWaiting)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlayingFromWaiting)
      audio.removeEventListener('ended', onEnded)
    }
  }, [volume, isIOS, advanceToLive]) // Note: status dependency intentionally omitted to avoid event loop issues

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyPlayers()
    }
  }, [destroyPlayers])

  return {
    audioRef,
    status,
    loading,
    introLocked,
    play,
    pause,
    volume,
    handleVolumeChange,
  }
}

export default useAudioPlayer
