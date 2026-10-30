// use-audio-visualizer: only the drawing loop. The audio controller owns the Web
// Audio graph and decides canVisualize; the hook reads its analyser while active
// (K82, ADR 0031 and 0033).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useAudioVisualizer from 'src/hooks/use-audio-visualizer'
import type {
  Visualizer,
  VisualizerDataType,
  VisualizerDefinition,
} from 'src/core/visualizers/types'
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

function runFrame(timestamp = 0) {
  const pending = [...frames.values()]
  frames.clear()
  for (const callback of pending) callback(timestamp)
}

// happy-dom returns no 2D context.
const context2d = { imageSmoothingEnabled: true, clearRect: vi.fn(), setTransform: vi.fn() }

let uninstall: () => void

beforeEach(() => {
  uninstall = installFakeWebAudio()
  frames.clear()
  nextFrame = 1
  cancelAnimationFrame.mockClear()
  context2d.imageSmoothingEnabled = true
  context2d.clearRect.mockClear()
  context2d.setTransform.mockClear()
  vi.stubGlobal('devicePixelRatio', 1)
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
  vi.unstubAllGlobals()
})

type Props = { active: boolean; definition?: VisualizerDefinition | null }

/** A visualizer definition whose instances share one draw mock */
function definitionOf(dataType: VisualizerDataType = 'time') {
  const draw = vi.fn<Visualizer['draw']>()
  const create = vi.fn(() => ({ draw }))
  const definition: VisualizerDefinition = { id: 'test', dataType, create }
  return { create, definition, draw }
}

function mount(
  initial: { active: boolean; dataType?: VisualizerDataType },
  options: { canvas?: HTMLCanvasElement | null; analyser?: FakeAnalyserNode | null } = {},
) {
  const canvas = options.canvas === undefined ? document.createElement('canvas') : options.canvas
  const canvasRef = canvas === null ? null : { current: canvas }
  const analyser = options.analyser === undefined ? new FakeAnalyserNode() : options.analyser
  if (analyser) analyser.fftSize = 256
  const getAnalyser = vi.fn(() => analyser as unknown as AnalyserNode | null)
  const { create, definition, draw } = definitionOf(initial.dataType)
  const hook = renderHook(
    ({ active, definition: current = definition }: Props) =>
      useAudioVisualizer(getAnalyser, canvasRef, active, WIDTH, HEIGHT, current),
    { initialProps: { active: initial.active } as Props },
  )
  return { analyser, canvas, create, definition, draw, getAnalyser, hook }
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
    vi.spyOn(performance, 'now').mockReturnValue(1234)
    const { draw } = mount({ active: true })
    expect(context2d.imageSmoothingEnabled).toBe(false)
    expect(context2d.clearRect).toHaveBeenCalledWith(0, 0, WIDTH, HEIGHT)
    expect(draw).toHaveBeenCalledTimes(1)
    const [ctx, data, frame] = draw.mock.calls[0]
    expect(ctx).toBe(context2d)
    expect(frame).toEqual({ width: WIDTH, height: HEIGHT, time: 1234 })
    expect(data).toHaveLength(128)
    expect([...data].every((byte) => byte === TIME_DOMAIN_BYTE)).toBe(true)
  })

  it('gives the next frames the time of their animation frame', () => {
    const { draw } = mount({ active: true })
    runFrame(5000)
    expect(draw.mock.calls[1][2]).toEqual({ width: WIDTH, height: HEIGHT, time: 5000 })
  })

  // The state of the drawing survives a pause, as when it lived in a WeakMap per
  // canvas.
  it('draws with one instance of the visualizer across frames and pauses', () => {
    const { create, hook } = mount({ active: true })
    runFrame()
    hook.rerender({ active: false })
    hook.rerender({ active: true })
    runFrame()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('creates a new instance for another visualizer', () => {
    const { create, hook } = mount({ active: true })
    const other = definitionOf()
    hook.rerender({ active: true, definition: other.definition })
    expect(create).toHaveBeenCalledTimes(1)
    expect(other.create).toHaveBeenCalledTimes(1)
    expect(other.draw).toHaveBeenCalledTimes(1)
  })

  it('does nothing until a visualizer is loaded', () => {
    const { getAnalyser, hook } = mount({ active: true })
    getAnalyser.mockClear()
    frames.clear()
    hook.rerender({ active: true, definition: null })
    expect(getAnalyser).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  // Nothing reads pixels back, so a plain 2D context, which Chromium can accelerate
  // (willReadFrequently made it a CPU canvas, K125).
  it('asks for a plain 2D context', () => {
    const { canvas } = mount({ active: true })
    expect(vi.mocked(canvas!.getContext).mock.calls).toEqual([['2d']])
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

// The hook is the only one that sizes the canvas, in device pixels
// (devicePixelRatio, up to 2), and draws in CSS pixels (K116, K117).
describe('useAudioVisualizer: canvas size', () => {
  /** Counts the assignments of the width and height of a canvas */
  function countSizes(canvas: HTMLCanvasElement) {
    const sizes: string[] = []
    let width = canvas.width
    let height = canvas.height
    Object.defineProperty(canvas, 'width', {
      get: () => width,
      set: (value: number) => {
        width = value
        sizes.push(`width ${value}`)
      },
    })
    Object.defineProperty(canvas, 'height', {
      get: () => height,
      set: (value: number) => {
        height = value
        sizes.push(`height ${value}`)
      },
    })
    return sizes
  }

  it('sizes the canvas to the CSS size times devicePixelRatio and scales the context', () => {
    vi.stubGlobal('devicePixelRatio', 1.5)
    const canvas = document.createElement('canvas')
    mount({ active: true }, { canvas })
    expect([canvas.width, canvas.height]).toEqual([960, 720])
    expect(context2d.setTransform).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 0, 0)
    expect(context2d.clearRect).toHaveBeenCalledWith(0, 0, WIDTH, HEIGHT)
  })

  it('caps devicePixelRatio at 2', () => {
    vi.stubGlobal('devicePixelRatio', 3)
    const canvas = document.createElement('canvas')
    mount({ active: true }, { canvas })
    expect([canvas.width, canvas.height]).toEqual([1280, 960])
    expect(context2d.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
  })

  it('sizes the canvas once, and again only when devicePixelRatio changes', () => {
    const canvas = document.createElement('canvas')
    const sizes = countSizes(canvas)
    mount({ active: true }, { canvas })
    runFrame()
    runFrame()
    expect(sizes).toEqual(['width 640', 'height 480'])
    vi.stubGlobal('devicePixelRatio', 2)
    runFrame()
    runFrame()
    expect(sizes).toEqual(['width 640', 'height 480', 'width 1280', 'height 960'])
    expect(context2d.setTransform).toHaveBeenCalledTimes(2)
  })

  it('sizes the canvas again, once, when its CSS size changes', () => {
    const canvas = document.createElement('canvas')
    const sizes = countSizes(canvas)
    const { definition } = definitionOf()
    const analyser = new FakeAnalyserNode()
    analyser.fftSize = 256
    const getAnalyser = () => analyser as unknown as AnalyserNode
    const hook = renderHook(
      ({ width, height }: { width: number; height: number }) =>
        useAudioVisualizer(getAnalyser, { current: canvas }, true, width, height, definition),
      { initialProps: { width: WIDTH, height: HEIGHT } },
    )
    runFrame()
    hook.rerender({ width: 800, height: 600 })
    runFrame()
    runFrame()
    expect(sizes).toEqual(['width 640', 'height 480', 'width 800', 'height 600'])
  })

  it('turns image smoothing off again after sizing the canvas', () => {
    const canvas = document.createElement('canvas')
    mount({ active: true }, { canvas })
    context2d.imageSmoothingEnabled = true
    vi.stubGlobal('devicePixelRatio', 2)
    runFrame()
    expect(context2d.imageSmoothingEnabled).toBe(false)
  })
})
