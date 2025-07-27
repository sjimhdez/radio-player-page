import { useEffect, useRef, useState } from 'react'
import type { PlayerStatus } from '../types/player'
import { oscilloscopeVisualizer } from '../components/visualizers/oscilloscope-visualizer'

function useAudioVisualizer(
  audioRef: React.RefObject<HTMLAudioElement>,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  status: PlayerStatus,
) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationRef = useRef<number>(0)
  const [canVisualize, setCanVisualize] = useState(false)

  useEffect(() => {
    if (status !== 'playing') {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      return
    }

    if (!audioRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.imageSmoothingEnabled = false

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const audioCtx = audioContextRef.current

      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser()
        analyserRef.current.fftSize = 256
      }

      if (!sourceNodeRef.current) {
        try {
          sourceNodeRef.current = audioCtx.createMediaElementSource(audioRef.current)
          sourceNodeRef.current.connect(analyserRef.current)
          analyserRef.current.connect(audioCtx.destination)
        } catch (err) {
          console.warn('Unable to create MediaElementSource:', err)
          setCanVisualize(false)
          return
        }
      }

      const analyser = analyserRef.current
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      let detectionFrames = 0
      let signalDetected = false

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw)
        analyser.getByteTimeDomainData(dataArray)

        // Detect valid signal (≠ 128 nor 0)
        const allZero = dataArray.every((v) => v === 0)
        const all128 = dataArray.every((v) => v === 128)

        if (!signalDetected) {
          detectionFrames++
          if (!allZero && !all128) {
            signalDetected = true
            setCanVisualize(true)
          } else if (detectionFrames > 20) {
            setCanVisualize(false)
            return
          }
        }

        if (signalDetected) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          oscilloscopeVisualizer(ctx, dataArray, canvas)
        }
      }

      draw()
    } catch (err) {
      console.warn('Visualization not supported:', err)
      setCanVisualize(false)
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [status, audioRef, canvasRef])

  return { canVisualize }
}

export default useAudioVisualizer
