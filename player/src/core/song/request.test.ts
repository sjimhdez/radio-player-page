// What the methods of the current song share (ADR 0068).
import { describe, expect, it } from 'vitest'
import { readTextAtMost, requestableUrl, requestInit } from 'src/core/song/request'

describe('requestableUrl', () => {
  it.each([
    ['https://radio.test/live', 'https:', true],
    ['http://radio.test/live', 'http:', true],
    ['https://radio.test/live', 'http:', true],
    ['http://radio.test/live', 'https:', false],
    ['ftp://radio.test/live', 'http:', false],
    ['/live.mp3', 'http:', false],
  ])('%s from an %s page is requestable: %j', (url, page, expected) => {
    expect(requestableUrl(url, page) !== null).toBe(expected)
  })
})

describe('requestInit', () => {
  it('adds the headers when given', () => {
    const signal = new AbortController().signal
    expect(requestInit(signal, { 'Icy-MetaData': '1' })).toEqual({
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'Icy-MetaData': '1' },
      signal,
    })
  })
})

describe('readTextAtMost', () => {
  it('is empty for a response without a body', async () => {
    expect(await readTextAtMost(new Response(null, { status: 204 }), 10)).toBe('')
  })

  it('decodes UTF-8 split across chunks', async () => {
    const bytes = new TextEncoder().encode('Café')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 4))
        controller.enqueue(bytes.subarray(4))
        controller.close()
      },
    })
    expect(await readTextAtMost(new Response(body), 10)).toBe('Café')
  })
})
