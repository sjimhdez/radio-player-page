import { describe, expect, it } from 'vitest'
import { errorReason, type FailureFacts } from 'src/core/audio/error-reason'

const HTTPS_PAGE = 'https:'
const STREAM = 'https://radio.test/live.mp3'

const facts = (overrides: Partial<FailureFacts> = {}): FailureFacts => ({
  pageProtocol: HTTPS_PAGE,
  url: STREAM,
  ...overrides,
})

const rejection = (name: string) => new DOMException('fail', name)

describe('errorReason (ADR 0065)', () => {
  it.each([
    ['an http stream on an https page', facts({ url: 'http://radio.test/live.mp3' })],
    ['an HTTP stream in capitals', facts({ url: 'HTTP://radio.test/live.mp3' })],
    ['an http stream with a status', facts({ url: 'http://radio.test/a.m3u8', status: 404 })],
    [
      'an http stream with a media error',
      facts({ url: 'http://radio.test/live.mp3', mediaErrorCode: 4 }),
    ],
  ])('gives mixed-content for %s', (_, input) => {
    expect(errorReason(input)).toEqual({ code: 'mixed-content' })
  })

  it('does not give mixed-content on an http page', () => {
    expect(
      errorReason(facts({ pageProtocol: 'http:', url: 'http://radio.test/live.mp3' })),
    ).toBeNull()
  })

  it.each([404, 403, 500, 503])('gives http with the status %d', (status) => {
    expect(errorReason(facts({ status }))).toEqual({ code: 'http', status })
  })

  it.each([
    ['status 0 of hls.js or dashjs', facts({ status: 0 })],
    ['MediaError 2 (network)', facts({ mediaErrorCode: 2 })],
    [
      'MediaError 2 with a NotSupportedError',
      facts({ mediaErrorCode: 2, rejection: rejection('NotSupportedError') }),
    ],
  ])('gives unreachable for %s', (_, input) => {
    expect(errorReason(input)).toEqual({ code: 'unreachable' })
  })

  it.each([
    ['MediaError 4 (source not supported)', facts({ mediaErrorCode: 4 })],
    ['MediaError 3 (decode)', facts({ mediaErrorCode: 3 })],
    [
      'a NotSupportedError without a MediaError',
      facts({ rejection: rejection('NotSupportedError') }),
    ],
    [
      'a NotSupportedError with a null MediaError',
      facts({ mediaErrorCode: null, rejection: rejection('NotSupportedError') }),
    ],
  ])('gives not-supported for %s', (_, input) => {
    expect(errorReason(input)).toEqual({ code: 'not-supported' })
  })

  it.each([
    ['NotAllowedError', facts({ rejection: rejection('NotAllowedError') })],
    ['AbortError', facts({ rejection: rejection('AbortError') })],
    ['an Error', facts({ rejection: new Error('boom') })],
    ['MediaError 1 (aborted)', facts({ mediaErrorCode: 1 })],
    ['nothing', facts()],
  ])('gives null for %s', (_, input) => {
    expect(errorReason(input)).toBeNull()
  })

  it('prefers the status of the library to the media error', () => {
    expect(errorReason(facts({ status: 404, mediaErrorCode: 4 }))).toEqual({
      code: 'http',
      status: 404,
    })
  })
})
