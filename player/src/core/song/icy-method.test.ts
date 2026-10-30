// The song from the ICY metadata inside the stream, read up to the first block and
// aborted (ADR 0068).
import { describe, expect, it } from 'vitest'
import { createIcyMethod, MAX_ICY_METAINT } from 'src/core/song/icy-method'
import { FAILED } from 'src/core/song/request'
import { createFakeFetch, fakeBody } from 'src/test/fake-fetch'

const STREAM = 'https://radio.test:8000/live.mp3'

/** metaint bytes of audio, then the block of text */
function withBlock(metaint: number, text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text)
  const length = Math.ceil(bytes.length / 16)
  const out = new Uint8Array(metaint + 1 + length * 16)
  out.fill(0xff, 0, metaint)
  out[metaint] = length
  out.set(bytes, metaint + 1)
  return out
}

const icyResponse = (chunks: Uint8Array[], metaint: string | null, endless = false) => {
  const body = fakeBody(chunks, { endless })
  const headers: Record<string, string> = { 'Content-Type': 'audio/mpeg' }
  if (metaint !== null) headers['icy-metaint'] = metaint
  return { response: new Response(body.stream, { headers }), body: body.state }
}

const run = (fetch: ReturnType<typeof createFakeFetch>['fetch'], signal?: AbortSignal) =>
  createIcyMethod(STREAM)({
    fetch,
    signal: signal ?? new AbortController().signal,
    pageProtocol: 'https:',
  })

describe('createIcyMethod', () => {
  it('reads the title of the first block and cancels the stream', async () => {
    const { response, body } = icyResponse(
      [withBlock(16, "StreamTitle='Kool Skool - Get To You';")],
      '16',
      true,
    )
    const { fetch } = createFakeFetch({ [STREAM]: response })
    expect(await run(fetch)).toEqual({ song: 'Kool Skool - Get To You' })
    expect(body.cancelled).toBe(true)
  })

  it('asks the stream with Icy-MetaData, in cors mode, without credentials or cache', async () => {
    const { response } = icyResponse([withBlock(4, "StreamTitle='A';")], '4')
    const { fetch } = createFakeFetch({ [STREAM]: response })
    await run(fetch)
    const init = fetch.mock.calls[0][1]!
    expect(init).toMatchObject({
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Icy-MetaData': '1' },
    })
  })

  it('aborts its own request once it has the block', async () => {
    const { response } = icyResponse([withBlock(4, "StreamTitle='A';")], '4', true)
    const { fetch } = createFakeFetch({ [STREAM]: response })
    await run(fetch)
    expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true)
  })

  it('reads on when the block comes in a later chunk', async () => {
    const whole = withBlock(4096, "StreamTitle='Later';")
    const { response, body } = icyResponse(
      [whole.subarray(0, 1000), whole.subarray(1000, 4097), whole.subarray(4097)],
      '4096',
      true,
    )
    const { fetch } = createFakeFetch({ [STREAM]: response })
    expect(await run(fetch)).toEqual({ song: 'Later' })
    expect(body.pulled).toBeGreaterThanOrEqual(3)
  })

  it('is a live method without a song for an empty block', async () => {
    const audio = new Uint8Array(9)
    const { response } = icyResponse([audio], '8')
    const { fetch } = createFakeFetch({ [STREAM]: response })
    expect(await run(fetch)).toEqual({ song: null })
  })

  it.each([
    ['without icy-metaint (not sent or not exposed)', null],
    ['with an icy-metaint that is not a number', 'x'],
    ['with an icy-metaint of 0', '0'],
    [`with an icy-metaint above ${MAX_ICY_METAINT}`, String(MAX_ICY_METAINT + 1)],
  ])('fails %s, cancelling the stream', async (_, metaint) => {
    const { response, body } = icyResponse([new Uint8Array(100)], metaint, true)
    const { fetch } = createFakeFetch({ [STREAM]: response })
    expect(await run(fetch)).toBe(FAILED)
    expect(body.cancelled).toBe(true)
  })

  it('fails when the stream ends before the block', async () => {
    const { response } = icyResponse([new Uint8Array(10)], '16')
    const { fetch } = createFakeFetch({ [STREAM]: response })
    expect(await run(fetch)).toBe(FAILED)
  })

  it('fails on an error status', async () => {
    const { fetch } = createFakeFetch({ [STREAM]: new Response('', { status: 404 }) })
    expect(await run(fetch)).toBe(FAILED)
  })

  it('fails when CORS blocks the request', async () => {
    const { fetch } = createFakeFetch()
    expect(await run(fetch)).toBe(FAILED)
  })

  it('stops reading when the poller aborts, and aborts its own request', async () => {
    const outer = new AbortController()
    const { response, body } = icyResponse([new Uint8Array(1000)], '60000', true)
    const { fetch } = createFakeFetch({ [STREAM]: response })
    const pending = run(fetch, outer.signal)
    await Promise.resolve()
    outer.abort()
    expect(await pending).toBe(FAILED)
    expect(body.cancelled).toBe(true)
    expect(fetch.mock.calls[0][1]!.signal!.aborted).toBe(true)
  })

  it('does not ask when the poller has already aborted', async () => {
    const outer = new AbortController()
    outer.abort()
    const { fetch } = createFakeFetch()
    expect(await run(fetch, outer.signal)).toBe(FAILED)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never asks an http stream from an https page (mixed content)', async () => {
    const { fetch } = createFakeFetch()
    const result = await createIcyMethod('http://radio.test/live.mp3')({
      fetch,
      signal: new AbortController().signal,
      pageProtocol: 'https:',
    })
    expect(result).toBe(FAILED)
    expect(fetch).not.toHaveBeenCalled()
  })
})
