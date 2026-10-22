// Characterization of use-audio-visualizer (spec 0007, task 1.4). The hook builds
// the Web Audio graph in an effect once the status is 'playing', outside the
// click that started playback, and knows nothing of canVisualize (K82).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useAudioVisualizer, { type VisualizerFn } from 'src/hooks/use-audio-visualizer'
import type { PlayerStatus } from 'src/types/player'
import type { VisualizerDataType } from 'src/config/visualizers'
import {
  FREQUENCY_BYTE,
  TIME_DOMAIN_BYTE,
  installFakeWebAudio,
  webAudio,
} from 'src/test/fake-web-audio'

const WIDTH = 640
const HEIGHT = 480

// Animation frames run only when a test asks for them.
const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 1
const cancelAnimationFrame = vi.fn((id: number) => {
  frames.delete(id)
})

function runFrame() {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) callback(0)
}

// happy-dom returns no 2D context.
const context2d = { imageSmoothingEnabled: true, clearRect: vi.fn() }

let uninstall: () => void

beforeEach(() => {
  uninstall = installFakeWebAudio()
  frames.clear()
  nextFrame = 1
  cancelAnimationFrame.mockClear()
  context2d.imageSmoothingEnabled = true
  context2d.clearRect.mockClear()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(nextFrame, callback)
    return nextFrame++
  })
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context2d as unknown as CanvasRenderingContext2D,
  )
})

afterEach(() => {
  uninstall()
})

type Props = { status: PlayerStatus; dataType?: VisualizerDataType }

function mount(initial: Props, options: { canvas?: HTMLCanvasElement | null } = {}) {
  const audio = document.createElement('audio')
  const canvas = options.canvas === undefined ? document.createElement('canvas') : options.canvas
  const audioRef = { current: audio }
  const canvasRef = canvas === null ? null : { current: canvas }
  const draw = vi.fn<VisualizerFn>()
  const hook = renderHook(
    ({ status, dataType }: Props) =>
      useAudioVisualizer(audioRef, canvasRef, status, WIDTH, HEIGHT, draw, dataType),
    { initialProps: initial },
  )
  return { audio, canvas, draw, hook }
}

describe('useAudioVisualizer: Web Audio graph', () => {
  it('creates no AudioContext before the status is playing', () => {
    const { hook } = mount({ status: 'idle' })
    hook.rerender({ status: 'paused' })
    hook.rerender({ status: 'error' })
    expect(webAudio.contexts).toHaveLength(0)
  })

  // K82: the context is created by the effect that follows the 'playing' render,
  // not inside the user's click, so it is not tied to the gesture.
  it('currently creates the AudioContext in the effect when the status becomes playing', () => {
    const { hook } = mount({ status: 'idle' })
    expect(webAudio.contexts).toHaveLength(0)
    hook.rerender({ status: 'playing' })
    expect(webAudio.contexts).toHaveLength(1)
    expect(webAudio.contexts[0].resume).not.toHaveBeenCalled()
  })

  it('connects the audio element to an analyser of fftSize 256 and to the destination', () => {
    const { audio } = mount({ status: 'playing' })
    const [audioCtx] = webAudio.contexts
    const [source] = audioCtx.sources
    const [analyser] = audioCtx.analysers
    expect(audioCtx.createMediaElementSource).toHaveBeenCalledWith(audio)
    expect(source.connect).toHaveBeenCalledWith(analyser)
    expect(analyser.connect).toHaveBeenCalledWith(audioCtx.destination)
    expect(analyser.fftSize).toBe(256)
  })

  it('keeps one context, analyser and source across pause and play', () => {
    const { hook } = mount({ status: 'playing' })
    hook.rerender({ status: 'paused' })
    hook.rerender({ status: 'playing' })
    hook.rerender({ status: 'playing', dataType: 'frequency' })
    expect(webAudio.contexts).toHaveLength(1)
    expect(webAudio.contexts[0].createAnalyser).toHaveBeenCalledTimes(1)
    expect(webAudio.contexts[0].createMediaElementSource).toHaveBeenCalledTimes(1)
  })

  // K82: the dashboard always hands over its canvas, at opacity 0 when
  // canVisualize is false, so the graph is connected even then.
  it('currently connects the graph although the canvas is hidden', () => {
    const canvas = document.createElement('canvas')
    canvas.style.opacity = '0'
    mount({ status: 'playing' }, { canvas })
    expect(webAudio.contexts[0].createMediaElementSource).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a canvas ref', () => {
    mount({ status: 'playing' }, { canvas: null })
    expect(webAudio.contexts).toHaveLength(0)
    expect(frames.size).toBe(0)
  })

  it('does nothing when the canvas has no 2D context', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    mount({ status: 'playing' })
    expect(webAudio.contexts).toHaveLength(0)
  })

  it('warns and draws nothing when Web Audio throws', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no Web Audio')
        }
      },
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { draw } = mount({ status: 'playing' })
    expect(warn).toHaveBeenCalledWith('Visualization not supported:', expect.any(Error))
    expect(draw).not.toHaveBeenCalled()
  })
})

describe('useAudioVisualizer: drawing', () => {
  it('draws a first frame at once with time-domain data by default', () => {
    const { canvas, draw } = mount({ status: 'playing' })
    expect(context2d.imageSmoothingEnabled).toBe(false)
    expect(context2d.clearRect).toHaveBeenCalledWith(0, 0, canvas!.width, canvas!.height)
    expect(draw).toHaveBeenCalledTimes(1)
    const [ctx, data, drawnCanvas, width, height] = draw.mock.calls[0]
    expect(ctx).toBe(context2d)
    expect(drawnCanvas).toBe(canvas)
    expect([width, height]).toEqual([WIDTH, HEIGHT])
    expect(data).toHaveLength(128)
    expect([...data].every((byte) => byte === TIME_DOMAIN_BYTE)).toBe(true)
  })

  it('draws again on every animation frame', () => {
    const { draw } = mount({ status: 'playing' })
    runFrame()
    runFrame()
    expect(draw).toHaveBeenCalledTimes(3)
  })

  it('reads frequency data for a frequency visualizer', () => {
    const { draw } = mount({ status: 'playing', dataType: 'frequency' })
    const analyser = webAudio.contexts[0].analysers[0]
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(1)
    expect(analyser.getByteTimeDomainData).not.toHaveBeenCalled()
    expect([...draw.mock.calls[0][1]].every((byte) => byte === FREQUENCY_BYTE)).toBe(true)
  })

  it("reads time-domain data for an 'other' visualizer", () => {
    mount({ status: 'playing', dataType: 'other' })
    const analyser = webAudio.contexts[0].analysers[0]
    expect(analyser.getByteTimeDomainData).toHaveBeenCalledTimes(1)
    expect(analyser.getByteFrequencyData).not.toHaveBeenCalled()
  })

  it('cancels the loop on pause', () => {
    const { draw, hook } = mount({ status: 'playing' })
    runFrame()
    hook.rerender({ status: 'paused' })
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2)
    runFrame()
    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('cancels the loop on unmount', () => {
    const { draw, hook } = mount({ status: 'playing' })
    hook.unmount()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
    runFrame()
    expect(draw).toHaveBeenCalledTimes(1)
  })
})
