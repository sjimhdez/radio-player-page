// Normalization of the current song (ADR 0068). The cases come from the titles of the
// real streams sampled before the feature was built.
import { describe, expect, it } from 'vitest'
import {
  decodeIcyText,
  joinArtistTitle,
  normalizeSong,
  MAX_SONG_LENGTH,
} from 'src/core/song/normalize'

describe('normalizeSong', () => {
  it('keeps a plain title', () => {
    expect(normalizeSong('Bee Gees - You Win Again')).toBe('Bee Gees - You Win Again')
  })

  it('trims the ends and collapses the spaces (samples: "Suzan  - Halverwege")', () => {
    expect(normalizeSong('  Suzan  - Halverwege \t')).toBe('Suzan - Halverwege')
  })

  it('removes the control characters', () => {
    expect(normalizeSong('Artist\u0000\u0007 -\nTitle\u007f\u0085')).toBe('Artist - Title')
  })

  it(`cuts the title to ${MAX_SONG_LENGTH} characters`, () => {
    const song = normalizeSong('a'.repeat(MAX_SONG_LENGTH + 1))
    expect(song).toBe('a'.repeat(MAX_SONG_LENGTH))
  })

  it('cuts by characters, not UTF-16 units, and trims what is left', () => {
    const song = normalizeSong(`${'a'.repeat(MAX_SONG_LENGTH - 2)} 🎵🎵`)
    expect(song).toBe(`${'a'.repeat(MAX_SONG_LENGTH - 2)} 🎵`)
    expect(normalizeSong(`${'a'.repeat(MAX_SONG_LENGTH - 1)} b`)).toBe(
      'a'.repeat(MAX_SONG_LENGTH - 1),
    )
  })

  it.each(['', '   ', '-', ' - ', 'Unknown', 'unknown', ' UNKNOWN '])(
    'is no song for %j',
    (raw) => {
      expect(normalizeSong(raw)).toBeNull()
    },
  )

  it.each([null, undefined, 42, {}])('is no song for the non-string %j', (raw) => {
    expect(normalizeSong(raw)).toBeNull()
  })
})

describe('joinArtistTitle', () => {
  it('joins artist and title with a hyphen (ADR 0068)', () => {
    expect(joinArtistTitle('Aparna Rajeev', 'Konchiva Kanmani')).toBe(
      'Aparna Rajeev - Konchiva Kanmani',
    )
  })

  it('is the title alone without an artist', () => {
    expect(joinArtistTitle(undefined, 'Live Like Kings')).toBe('Live Like Kings')
    expect(joinArtistTitle('  ', 'Live Like Kings')).toBe('Live Like Kings')
    expect(joinArtistTitle('Unknown', 'Live Like Kings')).toBe('Live Like Kings')
  })

  it('is the artist alone without a title', () => {
    expect(joinArtistTitle('Clouseau', null)).toBe('Clouseau')
  })

  it('is no song without either', () => {
    expect(joinArtistTitle('', 'unknown')).toBeNull()
  })

  it('normalizes the joined text', () => {
    expect(joinArtistTitle(' A\u0000 ', ' B  C ')).toBe('A - B C')
  })
})

describe('decodeIcyText', () => {
  const bytes = (values: number[]) => new Uint8Array(values)

  it('decodes UTF-8', () => {
    expect(decodeIcyText(new TextEncoder().encode('Café — Ñandú'))).toBe('Café — Ñandú')
  })

  it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
    // "Café" in Latin-1, and the Windows-1252 euro sign (0x80)
    expect(decodeIcyText(bytes([0x43, 0x61, 0x66, 0xe9, 0x20, 0x80]))).toBe('Café €')
  })
})
