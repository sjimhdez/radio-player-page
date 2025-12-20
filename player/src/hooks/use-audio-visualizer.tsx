import { useEffect, useRef } from 'react'
import type { PlayerStatus } from 'src/types/player'
import type { VisualizerDataType } from 'src/config/visualizers'

/**
 * Visualizer function type
 * Called every animation frame to draw audio visualization on canvas
 *
 * @param ctx - Canvas 2D rendering context
 * @param dataArray - Audio data array (time domain or frequency domain based on dataType)
 * @param canvas - HTML canvas element
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 */
export type VisualizerFn = (
  ctx: CanvasRenderingContext2D,
  dataArray: Uint8Array,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => void

/**
 * Custom hook for audio visualization
 * Connects audio element to Web Audio API AnalyzerNode and renders visualization on canvas
 * Automatically handles AudioContext creation, node connections, and animation loop
 *
 * The hook:
 * - Creates AudioContext and AnalyserNode on first play (only for 'time' and 'frequency' dataTypes)
 * - Connects audio element source to analyzer (only for 'time' and 'frequency' dataTypes)
 * - Retrieves audio data (time or frequency domain) every frame (only for 'time' and 'frequency' dataTypes)
 * - For 'decorative' dataType: skips Web Audio API and runs visualizer with empty data array
 * - Calls visualizer function to render on canvas
 * - Cleans up animation frame on pause or unmount
 *
 * Note: Visualization requires CORS-enabled audio source (not applicable for 'decorative' type)
 *
 * @param audioRef - React ref to HTMLAudioElement
 * @param canvasRef - React ref to HTMLCanvasElement (can be null to disable visualization)
 * @param status - Current player status (only visualizes when 'playing')
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param visualizerFn - Function that renders visualization on canvas
 * @param dataType - Type of audio data to retrieve ('time' | 'frequency' | 'decorative'), defaults to 'time'
 */
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

    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    // Disable image smoothing for sharper pixel-perfect rendering
    ctx.imageSmoothingEnabled = false

    // Handle decorative visualizers (don't require Web Audio API)
    if (dataType === 'decorative') {
      // Create empty data array for decorative visualizers
      const emptyDataArray = new Uint8Array(0)

      // Animation loop that runs every frame
      const draw = () => {
        animationRef.current = requestAnimationFrame(draw)

        // Clear previous frame and render new visualization
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        visualizerFn(ctx, emptyDataArray, canvas, width, height)
      }

      draw()

      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
      }
    }

    // Handle audio-based visualizers (require Web Audio API)
    if (!audioRef.current) return

    try {
      // Create AudioContext on first render
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }

      const audioCtx = audioContextRef.current

      // Create AnalyserNode with fixed FFT size
      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser()
        analyserRef.current.fftSize = 256 // 256-point FFT for analysis
      }

      // Connect audio element to analyser (only once)
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = audioCtx.createMediaElementSource(audioRef.current)
        sourceNodeRef.current.connect(analyserRef.current)
        analyserRef.current.connect(audioCtx.destination)
      }

      const analyser = analyserRef.current
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      // Animation loop that runs every frame
      const draw = () => {
        animationRef.current = requestAnimationFrame(draw)

        // Retrieve audio data based on visualizer requirements
        if (dataType === 'frequency') {
          analyser.getByteFrequencyData(dataArray)
        } else {
          // Default: use time domain data (waveform)
          analyser.getByteTimeDomainData(dataArray)
        }

        // Clear previous frame and render new visualization
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        visualizerFn(ctx, dataArray, canvas, width, height)
      }

      draw()
    } catch (err) {
      // Silently fail if Web Audio API is not available
      console.warn('Visualization not supported:', err)
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [status, audioRef, canvasRef, width, height, visualizerFn, dataType])
}

export default useAudioVisualizer
