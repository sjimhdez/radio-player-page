import { useRef, useState, useCallback, useEffect } from 'react'
import type { PlayerStatus } from 'src/types/player'
import Hls from 'hls.js'
import { MediaPlayer, type MediaPlayerClass } from 'dashjs'

function useAudioPlayer(streamUrl: string) {
  const audioRef = useRef<HTMLAudioElement>(null!)
  const hlsRef = useRef<Hls | null>(null)
  const dashRef = useRef<MediaPlayerClass | null>(null)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [volume, setVolume] = useState(1)

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

      if (isHls && Hls.isSupported()) {
        const hls = new Hls()
        hlsRef.current = hls
        hls.loadSource(streamUrl)
        hls.attachMedia(audio)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio.play().catch(() => setStatus('error'))
        })

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setStatus('error')
          }
        })

      } else if (isDash) {
        const player = MediaPlayer().create()
        dashRef.current = player
        player.initialize(audio, streamUrl, true)
        player.on('error', () => setStatus('error'))

      } else {
        // Native / Standard
        audio.src = streamUrl
        audio.crossOrigin = 'anonymous'
        audio.load()
        await audio.play()
      }

      setStatus('playing')

    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }, [streamUrl, destroyPlayers, status])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setStatus('paused')
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

    const onPlaying = () => setStatus('playing')
    const onPause = () => setStatus('paused')
    const onError = () => setStatus('error')
    const onCanPlay = () => {
      if (status === 'idle' || status === 'error') {
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
    }
  }, [destroyPlayers])

  return { audioRef, status, loading, play, pause, volume, handleVolumeChange }
}

export default useAudioPlayer
