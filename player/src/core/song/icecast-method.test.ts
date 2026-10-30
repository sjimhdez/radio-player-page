// The song from the status-json.xsl of the stream server, at its root or, for
// AzuraCast, in the directory of the mount (ADR 0068).
import { describe, expect, it } from 'vitest'
import { createIcecastMethod, MAX_STATUS_BYTES } from 'src/core/song/icecast-method'
import { FAILED } from 'src/core/song/request'
import { createFakeFetch, fakeBody } from 'src/test/fake-fetch'
import { readSampleBody } from 'src/test/stream-samples'

const JSON_TYPE = { 'Content-Type': 'application/json; charset=UTF-8' }

const status = (title: string) =>
  new Response(JSON.stringify({ icestats: { source: { title } } }), { headers: JSON_TYPE })

const run = (
  streamUrl: string,
  fetch: ReturnType<typeof createFakeFetch>['fetch'],
  pageProtocol = 'https:',
) => createIcecastMethod(streamUrl)({ fetch, signal: new AbortController().signal, pageProtocol })

describe('createIcecastMethod', () => {
  it('reads status-json.xsl at the root of the stream origin', async () => {
    const { fetch } = createFakeFetch({
      'https://radio.test:8000/status-json.xsl': status('A - B'),
    })
    expect(await run('https://radio.test:8000/live.mp3', fetch)).toEqual({ song: 'A - B' })
  })

  it('reads a real sample (Icecast 2.4.99, four mounts)', async () => {
    const { fetch } = createFakeFetch({
      'http://as.fm1.be:8000/status-json.xsl': new Response(
        readSampleBody('icecast2499-multi-status-json'),
        { headers: JSON_TYPE },
      ),
    })
    expect(await run('http://as.fm1.be:8000/rand', fetch, 'http:')).toEqual({
      song: 'George Michael - Praying For Time',
    })
  })

  it('asks without credentials, without cache and in cors mode, with the signal', async () => {
    const { fetch } = createFakeFetch({ 'https://radio.test/status-json.xsl': status('A') })
    const signal = new AbortController().signal
    await createIcecastMethod('https://radio.test/live')({ fetch, signal, pageProtocol: 'https:' })
    expect(fetch).toHaveBeenCalledWith('https://radio.test/status-json.xsl', {
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      signal,
    })
  })

  it('is a live method without a song when the server has none', async () => {
    const { fetch } = createFakeFetch({ 'https://radio.test/status-json.xsl': status('Unknown') })
    expect(await run('https://radio.test/live', fetch)).toEqual({ song: null })
  })

  it('tries the directory of the mount once the root fails (AzuraCast)', async () => {
    const { fetch } = createFakeFetch({
      'https://radio.test/status-json.xsl': new Response('Not found', { status: 404 }),
      'https://radio.test/listen/station/status-json.xsl': new Response(
        readSampleBody('azuracast-status-json-origin'),
        { headers: JSON_TYPE },
      ),
    })
    expect(await run('https://radio.test/listen/station/radio.mp3', fetch)).toEqual({
      song: 'Aparna Rajeev - Mp3Chetta - Konchiva Kanmani (Female) - Mp3Chetta',
    })
  })

  it('keeps asking the URL that answered, without trying the root again', async () => {
    const { fetch, answers } = createFakeFetch({
      'https://radio.test/listen/station/status-json.xsl': () => status('A'),
    })
    const method = createIcecastMethod('https://radio.test/listen/station/radio.mp3')
    const options = { fetch, signal: new AbortController().signal, pageProtocol: 'https:' }
    await method(options)
    answers['https://radio.test/listen/station/status-json.xsl'] = () => status('B')
    expect(await method(options)).toEqual({ song: 'B' })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://radio.test/status-json.xsl',
      'https://radio.test/listen/station/status-json.xsl',
      'https://radio.test/listen/station/status-json.xsl',
    ])
  })

  it('fails without a second try when the path has a single segment', async () => {
    const { fetch } = createFakeFetch()
    expect(await run('https://radio.test/live.mp3', fetch)).toBe(FAILED)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails when CORS blocks both URLs', async () => {
    const { fetch } = createFakeFetch()
    expect(await run('https://radio.test/a/b.mp3', fetch)).toBe(FAILED)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('cancels a body that is not JSON without reading it (a Shoutcast sends its stream)', async () => {
    const audio = fakeBody([new Uint8Array(4096)], { endless: true })
    const { fetch } = createFakeFetch({
      'https://radio.test/status-json.xsl': new Response(audio.stream, {
        headers: { 'Content-Type': 'audio/mpeg' },
      }),
    })
    expect(await run('https://radio.test/stream', fetch)).toBe(FAILED)
    expect(audio.state.cancelled).toBe(true)
    expect(audio.state.pulled).toBeLessThanOrEqual(1)
  })

  it('fails a response without a Content-Type', async () => {
    const { fetch } = createFakeFetch({
      'https://radio.test/status-json.xsl': new Response(new Uint8Array([123, 125])),
    })
    expect(await run('https://radio.test/stream', fetch)).toBe(FAILED)
  })

  it(`stops reading past ${MAX_STATUS_BYTES} bytes`, async () => {
    const big = fakeBody([new Uint8Array(64 * 1024)], { endless: true })
    const { fetch } = createFakeFetch({
      'https://radio.test/status-json.xsl': new Response(big.stream, { headers: JSON_TYPE }),
    })
    expect(await run('https://radio.test/stream', fetch)).toBe(FAILED)
    expect(big.state.cancelled).toBe(true)
    expect(big.state.pulled).toBeLessThanOrEqual(MAX_STATUS_BYTES / (64 * 1024) + 2)
  })

  it('reads a body of exactly the limit', async () => {
    const text = JSON.stringify({ icestats: { source: { title: 'A' } } })
    const padded = text + ' '.repeat(MAX_STATUS_BYTES - text.length)
    const { fetch } = createFakeFetch({
      'https://radio.test/status-json.xsl': new Response(padded, { headers: JSON_TYPE }),
    })
    expect(await run('https://radio.test/stream', fetch)).toEqual({ song: 'A' })
  })

  it('never asks an http server from an https page (mixed content)', async () => {
    const { fetch } = createFakeFetch()
    expect(await run('http://radio.test/a/live.mp3', fetch, 'https:')).toBe(FAILED)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails a stream URL that cannot be parsed', async () => {
    const { fetch } = createFakeFetch()
    expect(await run('not a url', fetch)).toBe(FAILED)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('fails when the request is aborted', async () => {
    const { fetch } = createFakeFetch({
      'https://radio.test/status-json.xsl': new DOMException('aborted', 'AbortError'),
    })
    expect(await run('https://radio.test/stream', fetch)).toBe(FAILED)
  })
})
