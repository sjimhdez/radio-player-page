// The ICY metadata block inside a stream (ADR 0068): after every icy-metaint bytes of
// audio, one length byte (x16) and that many bytes of text, padded with NULs.
import { describe, expect, it } from 'vitest'
import { icyBlockAt, songFromIcyBlock } from 'src/core/song/icy'

const encoder = new TextEncoder()

/** The block of a text: its length byte, the text and the NUL padding */
function block(text: string | Uint8Array): Uint8Array {
  const bytes = typeof text === 'string' ? encoder.encode(text) : text
  const length = Math.ceil(bytes.length / 16)
  const out = new Uint8Array(1 + length * 16)
  out[0] = length
  out.set(bytes, 1)
  return out
}

/** metaint bytes of audio followed by parts */
function stream(metaint: number, ...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(metaint + parts.reduce((sum, part) => sum + part.length, 0))
  out.fill(0xff, 0, metaint)
  let at = metaint
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

describe('icyBlockAt', () => {
  it('is the text of the first block after metaint bytes of audio', () => {
    const text = "StreamTitle='Kool Skool - Get To You';"
    const found = icyBlockAt(stream(8, block(text)), 8)
    expect(new TextDecoder().decode(found!).replace(/\0+$/, '')).toBe(text)
  })

  it('is null while the length byte has not arrived', () => {
    expect(icyBlockAt(stream(8), 8)).toBeNull()
  })

  it('is null while the block is incomplete', () => {
    const whole = stream(8, block("StreamTitle='A long enough title';"))
    expect(icyBlockAt(whole.subarray(0, whole.length - 1), 8)).toBeNull()
  })

  it('is an empty block for a length byte of 0', () => {
    expect(icyBlockAt(stream(8, new Uint8Array([0])), 8)).toEqual(new Uint8Array(0))
  })

  it('ignores the bytes after the block', () => {
    const found = icyBlockAt(stream(4, block("StreamTitle='A';"), new Uint8Array([1, 2, 3])), 4)
    expect(found).toHaveLength(16)
  })
})

describe('songFromIcyBlock', () => {
  const titleOf = (text: string | Uint8Array) => songFromIcyBlock(block(text).subarray(1))

  it('reads StreamTitle', () => {
    expect(titleOf("StreamTitle='Kool Skool - Get To You';StreamUrl='';")).toBe(
      'Kool Skool - Get To You',
    )
  })

  it('keeps an apostrophe inside the title', () => {
    expect(titleOf("StreamTitle='Guns N' Roses - Don't Cry';StreamUrl='http://x';")).toBe(
      "Guns N' Roses - Don't Cry",
    )
    expect(titleOf("StreamTitle='Rock 'n' Roll';")).toBe("Rock 'n' Roll")
  })

  it('decodes Latin-1 titles with the Windows-1252 fallback', () => {
    const latin1 = new Uint8Array([
      ...encoder.encode("StreamTitle='Caf"),
      0xe9,
      ...encoder.encode("';"),
    ])
    expect(titleOf(latin1)).toBe('Café')
  })

  it.each([
    ['an empty title', "StreamTitle='';"],
    ['no StreamTitle', "StreamUrl='http://x';"],
    ['an unterminated title', "StreamTitle='Half"],
  ])('is no song for %s', (_, text) => {
    expect(titleOf(text)).toBeNull()
  })

  it('is no song for an empty block', () => {
    expect(songFromIcyBlock(new Uint8Array(0))).toBeNull()
  })
})
