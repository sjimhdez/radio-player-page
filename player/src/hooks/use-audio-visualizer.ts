import { useEffect, useMemo, useRef } from 'react'
import type { VisualizerDefinition } from 'src/core/visualizers/types'

/** Highest density the canvas is drawn at: above it the drawing costs more than it shows */
const MAX_PIXEL_RATIO = 2

/**
 * Draws a visualizer on the canvas every frame while active, from the analyser of
 * the audio controller, which owns the Web Audio graph and decides canVisualize
 * (ADR 0031 and 0033).
 *
 * It creates one instance of the visualizer per definition, so its drawing state
 * survives a pause. It is the only one that sizes the canvas: in device pixels
 * (devicePixelRatio, up to 2), only when the size or the ratio changes, with the
 * context scaled so that the visualizers draw in CSS pixels (K116, K117). It stops
 * the frames when inactive or on unmount.
 *
 * @param getAnalyser - Returns the analyser of the Web Audio graph, or null
 * @param canvasRef - The canvas, or null to draw nothing
 * @param active - Whether to draw (status 'playing' and canVisualize)
 * @param width - Canvas width in CSS pixels
 * @param height - Canvas height in CSS pixels
 * @param definition - The visualizer to draw with, or null until it is loaded
 */
function useAudioVisualizer(
  getAnalyser: () => AnalyserNode | null,
  canvasRef: React.RefObject<HTMLCanvasElement> | null,
  active: boolean,
  width: number,
  height: number,
  definition: VisualizerDefinition | null,
) {
  const animationRef = useRef<number>(0)
  const visualizer = useMemo(() => definition?.create() ?? null, [definition])
  const dataType = definition?.dataType ?? 'time'

  useEffect(() => {
    if (!canvasRef) return

    if (!active) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      return
    }

    if (!canvasRef.current || !visualizer) return

    const canvas = canvasRef.current
    // A plain context: nothing reads pixels back (K125)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = getAnalyser()
    if (!analyser) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // Sizes the canvas when the size or the density of the screen changes; setting
    // the size resets the context, so its scale and smoothing go again
    const fitCanvas = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      const deviceWidth = Math.round(width * ratio)
      const deviceHeight = Math.round(height * ratio)
      if (canvas.width === deviceWidth && canvas.height === deviceHeight) return
      canvas.width = deviceWidth
      canvas.height = deviceHeight
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      // It only applies to drawn images, not to the shapes the visualizers draw
      ctx.imageSmoothingEnabled = false
    }

    const draw = (time: number) => {
      animationRef.current = requestAnimationFrame(draw)
      fitCanvas()

      if (dataType === 'frequency') {
        analyser.getByteFrequencyData(dataArray)
      } else {
        // Any other data type gets the waveform too
        analyser.getByteTimeDomainData(dataArray)
      }

      // The whole canvas, so the visualizers need not clear it (K120)
      ctx.clearRect(0, 0, width, height)
      visualizer.draw(ctx, dataArray, { width, height, time })
    }

    // The first frame now, on the clock of requestAnimationFrame
    draw(performance.now())

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [active, getAnalyser, canvasRef, width, height, visualizer, dataType])
}

export default useAudioVisualizer
