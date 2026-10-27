// use-audio-visualizer (spec 0007, task 1.8; K82, ADR 0031 and 0033): only the
// drawing loop. The audio controller owns the Web Audio graph and decides
// canVisualize; the hook reads its analyser while active.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useAudioVisualizer, { type VisualizerFn } from 'src/hooks/use-audio-visualizer'
import type { VisualizerDataType } from 'src/config/visualizers'
import {
  FREQUENCY_BYTE,
  FakeAnalyserNode,
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

type Props = { active: boolean; dataType?: VisualizerDataType }

function mount(
  initial: Props,
  options: { canvas?: HTMLCanvasElement | null; analyser?: FakeAnalyserNode | null } = {},
) {
  const canvas = options.canvas === undefined ? document.createElement('canvas') : options.canvas
  const canvasRef = canvas === null ? null : { current: canvas }
  const analyser = options.analyser === undefined ? new FakeAnalyserNode() : options.analyser
  if (analyser) analyser.fftSize = 256
  const getAnalyser = vi.fn(() => analyser as unknown as AnalyserNode | null)
  const draw = vi.fn<VisualizerFn>()
  const hook = renderHook(
    ({ active, dataType }: Props) =>
      useAudioVisualizer(getAnalyser, canvasRef, active, WIDTH, HEIGHT, draw, dataType),
    { initialProps: initial },
  )
  return { analyser, canvas, draw, getAnalyser, hook }
}

describe('useAudioVisualizer: no Web Audio of its own', () => {
  // K82: the context used to be created by the effect that followed the
  // 'playing' render, outside the user's gesture.
  it('never creates an AudioContext, also when active', () => {
    const { hook } = mount({ active: false })
    hook.rerender({ active: true })
    expect(webAudio.contexts).toHaveLength(0)
  })

  // K82: the graph used to be connected although the canvas was hidden.
  it('neither reads the analyser nor draws while inactive', () => {
    const { draw, getAnalyser } = mount({ active: false })
    expect(getAnalyser).not.toHaveBeenCalled()
    expect(draw).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('does nothing without a canvas ref', () => {
    const { getAnalyser } = mount({ active: true }, { canvas: null })
    expect(getAnalyser).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('does nothing when the canvas has no 2D context', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    const { draw } = mount({ active: true })
    expect(draw).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('does nothing without an analyser', () => {
    const { draw } = mount({ active: true }, { analyser: null })
    expect(draw).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })
})

describe('useAudioVisualizer: drawing', () => {
  it('draws a first frame at once with time-domain data by default', () => {
    const { canvas, draw } = mount({ active: true })
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

  it('starts drawing when it becomes active', () => {
    const { draw, hook } = mount({ active: false })
    hook.rerender({ active: true })
    expect(draw).toHaveBeenCalledTimes(1)
  })

  it('draws again on every animation frame', () => {
    const { draw } = mount({ active: true })
    runFrame()
    runFrame()
    expect(draw).toHaveBeenCalledTimes(3)
  })

  it('reads frequency data for a frequency visualizer', () => {
    const { analyser, draw } = mount({ active: true, dataType: 'frequency' })
    expect(analyser!.getByteFrequencyData).toHaveBeenCalledTimes(1)
    expect(analyser!.getByteTimeDomainData).not.toHaveBeenCalled()
    expect([...draw.mock.calls[0][1]].every((byte) => byte === FREQUENCY_BYTE)).toBe(true)
  })

  it("reads time-domain data for an 'other' visualizer", () => {
    const { analyser } = mount({ active: true, dataType: 'other' })
    expect(analyser!.getByteTimeDomainData).toHaveBeenCalledTimes(1)
    expect(analyser!.getByteFrequencyData).not.toHaveBeenCalled()
  })

  it('cancels the loop when it becomes inactive', () => {
    const { draw, hook } = mount({ active: true })
    runFrame()
    hook.rerender({ active: false })
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2)
    runFrame()
    expect(draw).toHaveBeenCalledTimes(2)
  })

  it('cancels the loop on unmount', () => {
    const { draw, hook } = mount({ active: true })
    hook.unmount()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
    runFrame()
    expect(draw).toHaveBeenCalledTimes(1)
  })
})
