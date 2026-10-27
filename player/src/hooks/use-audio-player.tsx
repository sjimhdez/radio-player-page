import { useRef, useState, useCallback, useEffect } from 'react'
import { createAudioController } from 'src/core/audio/audio-controller'

/**
 * Custom hook for managing audio playback
 * Supports multiple streaming protocols: HLS (.m3u8), DASH (.mpd), and standard audio streams
 * Automatically selects the appropriate playback method based on stream URL and device capabilities
 *
 * Adapter of the audio controller (src/core/audio/audio-controller): creates one per
 * mount, attaches it to the audio element and publishes its snapshot. The snapshot
 * goes through useState, not useSyncExternalStore, so React renders it with the
 * priority of the event that changed it, as in 3.4.2: the transient error of the C1
 * retry without crossOrigin is never painted (ADR 0030, reviewed in spec 0007). It injects
 * window.AudioContext and navigator.userAgent for the Web Audio graph (ADR 0031), the
 * user agent and touch points to tell iOS for native HLS (K13, ADR 0036), and
 * an audio element of its own to probe whether the volume can be changed (ADR 0036).
 *
 * Features:
 * - Automatic protocol detection and library loading
 * - iOS native HLS support (no library needed)
 * - Error handling and status management
 * - Volume control (disabled where the volume cannot be changed, as on iOS)
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
 * @returns volumeControllable - Whether the volume can be changed (false on iOS, ADR 0056)
 * @returns handleVolumeChange - Function to change volume (ignored if it cannot be changed)
 * @returns canVisualize - Whether the live stream goes through the visualizer's analyser
 * @returns getAnalyser - The analyser of the Web Audio graph, or null
 */
function useAudioPlayer(streamUrl: string, introUrl?: string | null) {
  const audioRef = useRef<HTMLAudioElement>(null!)
  const [controller] = useState(() =>
    createAudioController({
      webAudio: {
        createContext:
          typeof window.AudioContext === 'function' ? () => new window.AudioContext() : undefined,
        userAgent: navigator.userAgent,
      },
      platform: { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints },
      volumeProbe: () => document.createElement('audio'),
    }),
  )
  const [snapshot, setSnapshot] = useState(controller.getSnapshot)
  const { status, loading, introLocked, volume, volumeControllable, canVisualize } = snapshot

  useEffect(() => controller.subscribe(() => setSnapshot(controller.getSnapshot())), [controller])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    controller.attach(audio)
    return () => controller.detach()
  }, [controller])

  // Cleanup on unmount
  useEffect(() => {
    return () => controller.dispose()
  }, [controller])

  const play = useCallback(
    () => controller.play({ streamUrl, introUrl }),
    [controller, streamUrl, introUrl],
  )

  const pause = useCallback(() => controller.pause(), [controller])

  const handleVolumeChange = useCallback(
    (newVolume: number) => controller.setVolume(newVolume),
    [controller],
  )

  return {
    audioRef,
    status,
    loading,
    introLocked,
    play,
    pause,
    volume,
    volumeControllable,
    handleVolumeChange,
    canVisualize,
    getAnalyser: controller.getAnalyser,
  }
}

export default useAudioPlayer
