import { useRef, useState, useCallback, useEffect, useSyncExternalStore } from 'react'
import { useIsIOS } from 'src/hooks/use-is-ios'
import { createAudioController } from 'src/core/audio/audio-controller'

/**
 * Custom hook for managing audio playback
 * Supports multiple streaming protocols: HLS (.m3u8), DASH (.mpd), and standard audio streams
 * Automatically selects the appropriate playback method based on stream URL and device capabilities
 *
 * Adapter of the audio controller (src/core/audio/audio-controller): creates one per
 * mount, attaches it to the audio element and publishes its snapshot.
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
  const [controller] = useState(() => createAudioController())
  const { status, loading, introLocked, volume } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
  )
  const isIOS = useIsIOS()

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    controller.attach(audio, { isIOS })
    return () => controller.detach()
  }, [controller, isIOS])

  // Cleanup on unmount
  useEffect(() => {
    return () => controller.dispose()
  }, [controller])

  const play = useCallback(
    () => controller.play({ streamUrl, introUrl, isIOS }),
    [controller, streamUrl, introUrl, isIOS],
  )

  const pause = useCallback(() => controller.pause(), [controller])

  const handleVolumeChange = useCallback(
    (newVolume: number) => controller.setVolume(newVolume, { isIOS }),
    [controller, isIOS],
  )

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
