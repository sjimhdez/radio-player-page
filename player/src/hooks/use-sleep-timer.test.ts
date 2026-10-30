// The React adapter of src/core/sleep/sleep-timer.ts.
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useSleepTimer from 'src/hooks/use-sleep-timer'

const SECOND = 1000
const MINUTE = 60 * SECOND

function mount(isPlaying: boolean, onEnd: () => void, options?: { strict?: boolean }) {
  return renderHook(
    (props: { isPlaying: boolean; onEnd: () => void }) =>
      useSleepTimer(props.isPlaying, props.onEnd),
    { initialProps: { isPlaying, onEnd }, wrapper: options?.strict ? StrictMode : undefined },
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSleepTimer', () => {
  it('starts inactive, without a timer', () => {
    const { result } = mount(true, vi.fn())

    expect(result.current.remainingSeconds).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('counts down one second per tick after start()', () => {
    const { result } = mount(true, vi.fn())

    act(() => result.current.start(30 * 60))
    expect(result.current.remainingSeconds).toBe(1800)

    act(() => vi.advanceTimersByTime(SECOND))
    expect(result.current.remainingSeconds).toBe(1799)
    act(() => vi.advanceTimersByTime(9 * SECOND))
    expect(result.current.remainingSeconds).toBe(1790)
  })

  it('calls the latest onEnd once when the countdown runs out', () => {
    const first = vi.fn()
    const latest = vi.fn()
    const { result, rerender } = mount(true, first)

    act(() => result.current.start(3))
    rerender({ isPlaying: true, onEnd: latest })
    act(() => vi.advanceTimersByTime(3 * SECOND))

    expect(result.current.remainingSeconds).toBeNull()
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels without calling onEnd', () => {
    const onEnd = vi.fn()
    const { result } = mount(true, onEnd)

    act(() => result.current.start(30 * 60))
    act(() => result.current.cancel())

    expect(result.current.remainingSeconds).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(60 * MINUTE))
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('cancels when isPlaying turns false, without calling onEnd', () => {
    const onEnd = vi.fn()
    const { result, rerender } = mount(true, onEnd)

    act(() => result.current.start(30 * 60))
    rerender({ isPlaying: false, onEnd })

    expect(result.current.remainingSeconds).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    rerender({ isPlaying: true, onEnd })
    act(() => vi.advanceTimersByTime(60 * MINUTE))
    expect(result.current.remainingSeconds).toBeNull()
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('keeps start and cancel stable across renders', () => {
    const { result, rerender } = mount(true, vi.fn())
    const { start, cancel } = result.current

    act(() => start(60))
    rerender({ isPlaying: true, onEnd: vi.fn() })

    expect(result.current.start).toBe(start)
    expect(result.current.cancel).toBe(cancel)
  })

  it('runs a single interval under StrictMode', () => {
    const { result, unmount } = mount(true, vi.fn(), { strict: true })

    act(() => result.current.start(30 * 60))
    expect(vi.getTimerCount()).toBe(1)
    act(() => vi.advanceTimersByTime(5 * SECOND))
    expect(result.current.remainingSeconds).toBe(1795)
    expect(vi.getTimerCount()).toBe(1)

    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('counts against a deadline when the ticks are held back (K66)', () => {
    // 29 minutes go by with the timers held back (a suspended page), then one tick.
    const { result } = mount(true, vi.fn())

    act(() => result.current.start(30 * 60))
    vi.setSystemTime(Date.now() + 29 * MINUTE)
    act(() => vi.advanceTimersByTime(SECOND))

    expect(result.current.remainingSeconds).toBe(59)
  })
})
