import { useRef, useState, useCallback, useEffect } from 'react'
import type { PlayerStatus } from 'src/types/player'
import type Hls from 'hls.js'
import type { MediaPlayerClass } from 'dashjs'

// Lazy loaders for streaming libraries
const loadHls = async () => {
  const hlsModule = await import('hls.js')
  return hlsModule.default
}

const loadDashjs = async () => {
  const dashModule = await import('dashjs')
  return dashModule.MediaPlayer
}

function useAudioPlayer(streamUrl: string) {
  const audioRef = useRef<HTMLAudioElement>(null!)
  const hlsRef = useRef<Hls | null>(null)
  const dashRef = useRef<MediaPlayerClass | null>(null)
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const statusRef = useRef<PlayerStatus>('idle')
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [maxRetriesReached, setMaxRetriesReached] = useState(false)

  const MAX_RETRIES = 5
  const RETRY_DELAY_MS = 3000 // 3 segundos

  // Sync statusRef with status state
  useEffect(() => {
    statusRef.current = status
  }, [status])

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

  const play = useCallback(async () => {
    if (!audioRef.current) return
    const audio = audioRef.current

    try {
      setLoading(true)
      // Reset retry count on successful play attempt
      retryCountRef.current = 0
      setMaxRetriesReached(false)

      // If we are already playing the same URL, just play
      if (audio.src === streamUrl && status !== 'error') {
        if (audio.paused) {
          await audio.play()
          setStatus('playing')
        }
        return
      }

      // Cleanup previous players if loading a new stream
      destroyPlayers()

      const isHls = streamUrl.endsWith('.m3u8')
      const isDash = streamUrl.endsWith('.mpd')

      if (isHls) {
        // Lazy load HLS.js only when needed
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
          // HLS not supported, fallback to native
          audio.src = streamUrl
          audio.crossOrigin = 'anonymous'
          audio.load()
          await audio.play()
        }
      } else if (isDash) {
        // Lazy load dash.js only when needed
        const MediaPlayer = await loadDashjs()
        const player = MediaPlayer().create()
        dashRef.current = player
        player.initialize(audio, streamUrl, true)
        player.on('error', () => {
          setStatus('error')
          statusRef.current = 'error'
        })
      } else {
        // Native / Standard
        audio.src = streamUrl
        audio.crossOrigin = 'anonymous'
        audio.load()
        await audio.play()
      }

      setStatus('playing')
      statusRef.current = 'playing'
    } catch {
      setStatus('error')
      statusRef.current = 'error'
    } finally {
      setLoading(false)
    }
  }, [streamUrl, destroyPlayers, status])

  // Auto-retry logic when error occurs
  useEffect(() => {
    // Only retry if status is error and not paused
    if (status === 'error' && streamUrl) {
      // Clear any existing retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }

      // Check if we haven't exceeded max retries
      if (retryCountRef.current < MAX_RETRIES) {
        const currentAttempt = retryCountRef.current + 1
        retryCountRef.current = currentAttempt
        setRetryAttempt(currentAttempt)
        setIsRetrying(true)

        // Schedule retry after delay
        retryTimeoutRef.current = setTimeout(() => {
          // Only retry if still in error state (not paused by user)
          if (statusRef.current === 'error') {
            setIsRetrying(false)
            play()
          } else {
            setIsRetrying(false)
          }
        }, RETRY_DELAY_MS)
      } else {
        // Max retries reached
        setIsRetrying(false)
        setRetryAttempt(0)
        setMaxRetriesReached(true)
      }
    } else if (status !== 'error') {
      // Cancel retries if status changes away from error
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      setIsRetrying(false)
      // Reset retry count on successful recovery
      if (status === 'playing') {
        retryCountRef.current = 0
        setRetryAttempt(0)
        setMaxRetriesReached(false)
      }
    }

    // Cleanup timeout on unmount or when status changes
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [status, streamUrl, play])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setStatus('paused')
    statusRef.current = 'paused'
    // Cancel any pending retries when user manually pauses
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    retryCountRef.current = 0
    setIsRetrying(false)
    setRetryAttempt(0)
    setMaxRetriesReached(false)
  }, [])

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume
      setVolume(newVolume)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = volume

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
      if (statusRef.current === 'idle' || statusRef.current === 'error') {
        // Only update if we were waiting for it
        setLoading(false)
      }
    }
    const onWaiting = () => setLoading(true)
    const onPlayingFromWaiting = () => setLoading(false)

    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('waiting', onWaiting)
    // When playing resumes after buffering
    audio.addEventListener('playing', onPlayingFromWaiting)

    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('playing', onPlayingFromWaiting)
    }
  }, [volume]) // removed status dependency to avoid loops, intentionally

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyPlayers()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [destroyPlayers])

  return {
    audioRef,
    status,
    loading,
    play,
    pause,
    volume,
    handleVolumeChange,
    isRetrying,
    retryAttempt,
    maxRetriesReached,
  }
}

export default useAudioPlayer
