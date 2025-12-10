import { useRef, useState, useCallback, useEffect } from 'react'
import type { PlayerStatus } from 'src/types/player'
import type Hls from 'hls.js'
import type { MediaPlayerClass } from 'dashjs'
import { useIsIOS } from 'src/hooks/use-is-ios'

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
  const statusRef = useRef<PlayerStatus>('idle')
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(1)
  const isIOS = useIsIOS()

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
        // iOS Safari has native HLS support, don't use HLS.js
        if (isIOS) {
          // Use native HLS support on iOS
          audio.src = streamUrl
          audio.crossOrigin = 'anonymous'
          audio.load()
          await audio.play()
        } else {
          // Lazy load HLS.js only when needed (non-iOS devices)
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
  }, [streamUrl, destroyPlayers, status, isIOS])

  const pause = useCallback(() => {
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
  }, [volume, isIOS]) // removed status dependency to avoid loops, intentionally

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
    play,
    pause,
    volume,
    handleVolumeChange,
  }
}

export default useAudioPlayer
