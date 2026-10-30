import { useRef, useState, useCallback, useEffect } from 'react'
import { createAudioController } from 'src/core/audio/audio-controller'

/**
 * Plays the stream: HLS (.m3u8), DASH (.mpd) and plain audio, with the method picked
 * from the URL and the device.
 *
 * Adapter of the audio controller (src/core/audio/audio-controller): creates one per
 * mount, attaches it to the audio element and publishes its snapshot. The snapshot
 * goes through useState, not useSyncExternalStore, so React renders it with the
 * priority of the event that changed it, as in 3.4.2: the transient error of the retry
 * without crossOrigin is never painted (ADR 0030). It injects window.AudioContext and
 * navigator.userAgent for the Web Audio graph (ADR 0031), the user agent and touch
 * points to tell iOS for native HLS (K13, ADR 0036), an audio element of its own to
 * probe whether the volume can be changed (ADR 0036), and the protocol of the page, to
 * tell mixed content in the error reason (ADR 0065). The controller reconnects the live
 * stream after a cut, shown as loading with reconnecting (ADR 0061, K129).
 *
 * @param introUrl - Welcome audio (mp3) played once, before the first live stream of
 *   this hook instance; it cannot be skipped or paused while it plays
 * @returns The ref of the audio element, the snapshot of the controller (status,
 *   loading, reconnecting, introLocked, volume, volumeControllable, canVisualize,
 *   errorReason) and
 *   its commands: play, pause (ignored while introLocked), handleVolumeChange (ignored
 *   if the volume cannot be changed) and getAnalyser (null until the element is in
 *   the Web Audio graph)
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
      pageProtocol: window.location.protocol,
    }),
  )
  const [snapshot, setSnapshot] = useState(controller.getSnapshot)
  const {
    status,
    loading,
    reconnecting,
    introLocked,
    volume,
    volumeControllable,
    canVisualize,
    errorReason,
  } = snapshot

  useEffect(() => controller.subscribe(() => setSnapshot(controller.getSnapshot())), [controller])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    controller.attach(audio)
    return () => controller.detach()
  }, [controller])

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
    reconnecting,
    introLocked,
    play,
    pause,
    volume,
    volumeControllable,
    handleVolumeChange,
    canVisualize,
    errorReason,
    getAnalyser: controller.getAnalyser,
  }
}

export default useAudioPlayer
