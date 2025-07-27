import { useRef, useState, useCallback, useEffect } from 'react'
import type { PlayerStatus } from '../types/player'

function useAudioPlayer(streamUrl: string) {
  const audioRef = useRef<HTMLAudioElement>(null!)
  const [status, setStatus] = useState<PlayerStatus>('idle')
  const [loading, setLoading] = useState(false)

  const play = useCallback(async () => {
    if (!audioRef.current) return
    const audio = audioRef.current

    try {
      setLoading(true)
      if (!audio.src || audio.src !== streamUrl) {
        audio.src = streamUrl
        audio.crossOrigin = 'anonymous'
        audio.load()
        await new Promise((resolve) => {
          audio.oncanplay = resolve
        })
      }
      await audio.play()
      setStatus('playing')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }, [streamUrl])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setStatus('paused')
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlaying = () => setStatus('playing')
    const onPause = () => setStatus('paused')
    const onError = () => setStatus('error')
    const onCanPlay = () => {
      setStatus('idle')
      setLoading(false)
    }

    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)
    audio.addEventListener('canplay', onCanPlay)

    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('canplay', onCanPlay)
    }
  }, [])

  return { audioRef, status, loading, play, pause }
}

export default useAudioPlayer
