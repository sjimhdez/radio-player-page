// The song in an Icecast status-json.xsl (ADR 0068). The vectors are the samples of
// tests/fixtures/streams/ (origin in its README.md).
import { describe, expect, it } from 'vitest'
import { songFromStatus } from 'src/core/song/icecast-status'
import { readSampleBody } from 'src/test/stream-samples'

const icecast250 = readSampleBody('icecast250-multi-status-json')
const icecast2499 = readSampleBody('icecast2499-multi-status-json')
const icecast244 = readSampleBody('icecast244-single-status-json')
const everestcast = readSampleBody('everestcast-status-json-origin')
const azuracast = readSampleBody('azuracast-status-json-origin')

describe('songFromStatus', () => {
  it('picks the mount whose listenurl has the path of the stream (Icecast 2.5.0)', () => {
    expect(songFromStatus(icecast250, 'http://radiohanzestad.ddns.net:18000/nonstop')).toBe(
      'Bee Gees - You Win Again',
    )
  })

  it('ignores host and port when it compares the paths', () => {
    expect(songFromStatus(icecast250, 'https://other.host/nonstop')).toBe(
      'Bee Gees - You Win Again',
    )
  })

  it('is no song when the matching mount has no title', () => {
    expect(songFromStatus(icecast250, 'http://radiohanzestad.ddns.net:18000/live')).toBeNull()
  })

  it('is no song when several mounts and none has the path of the stream', () => {
    expect(songFromStatus(icecast250, 'http://radiohanzestad.ddns.net:18000/other')).toBeNull()
  })

  it('picks among four mounts (Icecast 2.4.99)', () => {
    expect(songFromStatus(icecast2499, 'http://as.fm1.be:8000/media')).toBe(
      'CLOUSEAU - LIVE LIKE KINGS',
    )
    expect(songFromStatus(icecast2499, 'http://as.fm1.be:8000/rand')).toBe(
      'George Michael - Praying For Time',
    )
  })

  it('takes the only mount, whatever its path (Icecast 2.4.4)', () => {
    expect(songFromStatus(icecast244, 'http://radio2.sikhnet.com:8018/other')).toBe(
      'Bhai Sarvan Singh - Akhand Path - Siri Guru Granth Sahib',
    )
  })

  it('is no song for an "Unknown" title (Everestcast, listenurl on another port)', () => {
    expect(songFromStatus(everestcast, 'http://s7.everestcast.com:1155/stream')).toBeNull()
  })

  it('joins artist and title sent apart (AzuraCast, another path and a private IP)', () => {
    expect(songFromStatus(azuracast, 'https://radio.example/listen/shahimsha/radio.mp3')).toBe(
      'Aparna Rajeev - Mp3Chetta - Konchiva Kanmani (Female) - Mp3Chetta',
    )
  })

  it('normalizes the title', () => {
    const body = JSON.stringify({ icestats: { source: { title: '  Suzan  - Halverwege ' } } })
    expect(songFromStatus(body, 'http://radio.test/live')).toBe('Suzan - Halverwege')
  })

  it('matches a listenurl that is not a URL by nothing, and the stream URL that is not either', () => {
    const body = JSON.stringify({
      icestats: { source: [{ listenurl: 'not a url', title: 'A' }, { title: 'B' }] },
    })
    expect(songFromStatus(body, 'http://radio.test/live')).toBeNull()
    expect(songFromStatus(icecast250, 'not a url')).toBeNull()
  })

  it.each([
    ['broken JSON', '{"icestats":'],
    ['no icestats', '{}'],
    ['no source', '{"icestats":{}}'],
    ['an empty source list', '{"icestats":{"source":[]}}'],
    ['a source that is not an object', '{"icestats":{"source":"x"}}'],
    ['null', 'null'],
  ])('is no song for %s', (_, body) => {
    expect(songFromStatus(body, 'http://radio.test/live')).toBeNull()
  })
})
