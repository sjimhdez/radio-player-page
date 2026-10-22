import { useEffect, useRef } from 'react'
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
 * Renders the visualization on canvas from the analyser of the audio controller,
 * which owns the Web Audio graph and decides canVisualize (ADR 0031 and 0033)
 *
 * The hook:
 * - Retrieves audio data (time or frequency domain) every frame while active
 * - Calls visualizer function to render on canvas
 * - Cleans up animation frame when inactive or on unmount
 *
 * @param getAnalyser - Returns the analyser of the Web Audio graph, or null
 * @param canvasRef - React ref to HTMLCanvasElement (can be null to disable visualization)
 * @param active - Whether to draw (status 'playing' and canVisualize)
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param visualizerFn - Function that renders visualization on canvas
 * @param dataType - Type of audio data to retrieve ('time' | 'frequency' | 'other'), defaults to 'time'
 */
function useAudioVisualizer(
  getAnalyser: () => AnalyserNode | null,
  canvasRef: React.RefObject<HTMLCanvasElement> | null,
  active: boolean,
  width: number,
  height: number,
  visualizerFn: VisualizerFn,
  dataType: VisualizerDataType = 'time',
) {
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (!canvasRef) return

    if (!active) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      return
    }

    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    // Disable image smoothing for sharper pixel-perfect rendering
    ctx.imageSmoothingEnabled = false

    const analyser = getAnalyser()
    if (!analyser) return

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

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [active, getAnalyser, canvasRef, width, height, visualizerFn, dataType])
}

export default useAudioVisualizer
