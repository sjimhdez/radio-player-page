// The poller of the current song (ADR 0068, ADR 0069): only while the live stream plays
// and the page is visible, the methods in order, each at its interval.
import { describe, expect, it, vi } from 'vitest'
import { createSongPoller, type Visibility } from 'src/core/song/song-poller'
import { FAILED, type MethodOptions, type MethodResult } from 'src/core/song/request'
import { createFakeClock } from 'src/test/fake-clock'

/** A method whose lookups stay pending until the test settles them */
function fakeMethod() {
  const calls: { options: MethodOptions; settle: (result: MethodResult) => void }[] = []
  const method = vi.fn(
    (options: MethodOptions) =>
      new Promise<MethodResult>((settle) => {
        calls.push({ options, settle })
      }),
  )
  return { method, calls, last: () => calls[calls.length - 1] }
}

function fakeVisibility(visible = true) {
  const listeners = new Set<() => void>()
  const visibility: Visibility = {
    isVisible: () => visible,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    visibility,
    listeners,
    set(value: boolean) {
      visible = value
      listeners.forEach((listener) => listener())
    },
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup({ visible = true } = {}) {
  const m1 = fakeMethod()
  const m3 = fakeMethod()
  const fake = createFakeClock(0)
  const page = fakeVisibility(visible)
  const fetch = vi.fn()
  const poller = createSongPoller({
    methods: [
      { lookUp: m1.method, intervalMs: 20000 },
      { lookUp: m3.method, intervalMs: 30000 },
    ],
    fetch,
    clock: fake.clock,
    visibility: page.visibility,
    pageProtocol: 'https:',
  })
  const listener = vi.fn()
  const unsubscribe = poller.subscribe(listener)
  return { m1, m3, fake, page, fetch, poller, listener, unsubscribe }
}

describe('createSongPoller', () => {
  it('asks nothing until the live stream plays', () => {
    const { m1, m3, fake, poller } = setup()
    fake.advance(60000)
    expect(m1.method).not.toHaveBeenCalled()
    expect(m3.method).not.toHaveBeenCalled()
    expect(poller.getSnapshot()).toBeNull()
  })

  it('asks the first method at once when it plays, with fetch, signal and page protocol', () => {
    const { m1, m3, fetch, poller } = setup()
    poller.setPlaying(true)
    expect(m1.method).toHaveBeenCalledTimes(1)
    expect(m1.last().options).toMatchObject({ fetch, pageProtocol: 'https:' })
    expect(m1.last().options.signal.aborted).toBe(false)
    expect(m3.method).not.toHaveBeenCalled()
  })

  it('publishes the song and asks again after the interval of the method', async () => {
    const { m1, fake, poller, listener } = setup()
    poller.setPlaying(true)
    m1.last().settle({ song: 'A - B' })
    await flush()
    expect(poller.getSnapshot()).toBe('A - B')
    expect(listener).toHaveBeenCalledTimes(1)
    fake.advance(19999)
    expect(m1.method).toHaveBeenCalledTimes(1)
    fake.advance(1)
    expect(m1.method).toHaveBeenCalledTimes(2)
    m1.last().settle({ song: 'C - D' })
    await flush()
    expect(poller.getSnapshot()).toBe('C - D')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('does not notify when the song is the same', async () => {
    const { m1, fake, poller, listener } = setup()
    poller.setPlaying(true)
    m1.last().settle({ song: 'A' })
    await flush()
    fake.advance(20000)
    m1.last().settle({ song: 'A' })
    await flush()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('falls back to the next method at once when the first fails, at its own interval', async () => {
    const { m1, m3, fake, poller } = setup()
    poller.setPlaying(true)
    m1.last().settle(FAILED)
    await flush()
    expect(m3.method).toHaveBeenCalledTimes(1)
    m3.last().settle({ song: 'ICY' })
    await flush()
    expect(poller.getSnapshot()).toBe('ICY')
    fake.advance(20000)
    expect(m3.method).toHaveBeenCalledTimes(1)
    fake.advance(10000)
    expect(m3.method).toHaveBeenCalledTimes(2)
    expect(m1.method).toHaveBeenCalledTimes(1)
  })

  it('does not try a failed method again after a pause (one page load)', async () => {
    const { m1, m3, poller } = setup()
    poller.setPlaying(true)
    m1.last().settle(FAILED)
    await flush()
    poller.setPlaying(false)
    poller.setPlaying(true)
    expect(m1.method).toHaveBeenCalledTimes(1)
    expect(m3.method).toHaveBeenCalledTimes(2)
  })

  it('stops for good when every method fails', async () => {
    const { m1, m3, fake, poller } = setup()
    poller.setPlaying(true)
    m1.last().settle(FAILED)
    await flush()
    m3.last().settle(FAILED)
    await flush()
    expect(fake.timerCount()).toBe(0)
    poller.setPlaying(false)
    poller.setPlaying(true)
    fake.advance(120000)
    expect(m1.method).toHaveBeenCalledTimes(1)
    expect(m3.method).toHaveBeenCalledTimes(1)
    expect(poller.getSnapshot()).toBeNull()
  })

  it('keeps a method that has answered when a later lookup fails, without a song', async () => {
    const { m1, m3, fake, poller } = setup()
    poller.setPlaying(true)
    m1.last().settle({ song: 'A' })
    await flush()
    fake.advance(20000)
    m1.last().settle(FAILED)
    await flush()
    expect(poller.getSnapshot()).toBeNull()
    expect(m3.method).not.toHaveBeenCalled()
    fake.advance(20000)
    expect(m1.method).toHaveBeenCalledTimes(3)
  })

  it('a pause aborts the lookup in flight, clears the song and stops asking', async () => {
    const { m1, fake, poller, listener } = setup()
    poller.setPlaying(true)
    m1.last().settle({ song: 'A' })
    await flush()
    fake.advance(20000)
    const inFlight = m1.last()
    poller.setPlaying(false)
    expect(inFlight.options.signal.aborted).toBe(true)
    expect(poller.getSnapshot()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(fake.timerCount()).toBe(0)
    fake.advance(60000)
    expect(m1.method).toHaveBeenCalledTimes(2)
  })

  it('ignores what an aborted lookup reports, its failure included', async () => {
    const { m1, m3, poller } = setup()
    poller.setPlaying(true)
    const aborted = m1.last()
    poller.setPlaying(false)
    aborted.settle(FAILED)
    await flush()
    poller.setPlaying(true)
    expect(m1.method).toHaveBeenCalledTimes(2)
    expect(m3.method).not.toHaveBeenCalled()
    const late = m1.last()
    poller.setPlaying(false)
    late.settle({ song: 'Late' })
    await flush()
    expect(poller.getSnapshot()).toBeNull()
  })

  it('asks once when told it plays twice', () => {
    const { m1, poller } = setup()
    poller.setPlaying(true)
    poller.setPlaying(true)
    expect(m1.method).toHaveBeenCalledTimes(1)
  })

  it('stops while the page is hidden and asks at once when it is visible again', async () => {
    const { m1, page, fake, poller } = setup()
    poller.setPlaying(true)
    m1.last().settle({ song: 'A' })
    await flush()
    page.set(false)
    expect(poller.getSnapshot()).toBeNull()
    fake.advance(60000)
    expect(m1.method).toHaveBeenCalledTimes(1)
    page.set(true)
    expect(m1.method).toHaveBeenCalledTimes(2)
  })

  it('asks nothing while it plays on a hidden page', () => {
    const { m1, poller } = setup({ visible: false })
    poller.setPlaying(true)
    expect(m1.method).not.toHaveBeenCalled()
  })

  it('stops with its last subscriber and starts again with the next one', async () => {
    const { m1, page, fake, poller, unsubscribe } = setup()
    poller.setPlaying(true)
    m1.last().settle({ song: 'A' })
    await flush()
    unsubscribe()
    expect(page.listeners.size).toBe(0)
    expect(fake.timerCount()).toBe(0)
    expect(poller.getSnapshot()).toBeNull()
    const stop = poller.subscribe(() => {})
    expect(page.listeners.size).toBe(1)
    expect(m1.method).toHaveBeenCalledTimes(2)
    stop()
  })

  it('does nothing without methods (DASH)', () => {
    const fake = createFakeClock(0)
    const poller = createSongPoller({
      methods: [],
      fetch: vi.fn(),
      clock: fake.clock,
      visibility: fakeVisibility().visibility,
      pageProtocol: 'https:',
    })
    poller.subscribe(() => {})
    poller.setPlaying(true)
    expect(fake.timerCount()).toBe(0)
    expect(poller.getSnapshot()).toBeNull()
  })
})
