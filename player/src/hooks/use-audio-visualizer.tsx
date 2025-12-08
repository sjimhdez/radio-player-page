import { useEffect, useRef } from 'react'
import type { PlayerStatus } from 'src/types/player'
import type { VisualizerDataType } from 'src/config/visualizers'

export type VisualizerFn = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => void

function useAudioVisualizer(
  audioRef: React.RefObject<HTMLAudioElement>,
  canvasRef: React.RefObject<HTMLCanvasElement> | null,
  status: PlayerStatus,
  width: number,
  height: number,
  visualizerFn: VisualizerFn,
  dataType: VisualizerDataType = 'time',
) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (!canvasRef) return

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
        sourceNodeRef.current = audioCtx.createMediaElementSource(audioRef.current)
        sourceNodeRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioCtx.destination)
      }

      const analyser = analyserRef.current
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw)

        // Get data according to the type required by the visualizer
        if (dataType === 'frequency') {
          analyser.getByteFrequencyData(dataArray)
        } else {
          // Default uses time domain data
          analyser.getByteTimeDomainData(dataArray)
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        visualizerFn(ctx, dataArray, canvas, width, height)
      }

      draw()
    } catch (err) {
      console.warn('Visualization not supported:', err)
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [status, audioRef, canvasRef, width, height, visualizerFn, dataType])
}

export default useAudioVisualizer
