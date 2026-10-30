import { decodeIcyText, normalizeSong } from 'src/core/song/normalize'

/**
 * StreamTitle up to the "';" that ends it: the one followed by another field or by the
 * end of the block, so an apostrophe inside the title does not end it.
 */
const STREAM_TITLE = /StreamTitle='([\s\S]*?)';(?=[A-Za-z]\w*=|$)/

/**
 * The first ICY metadata block of a stream read with Icy-MetaData: 1 (ADR 0068):
 * after metaint bytes of audio, a length byte (x16) and that many bytes.
 *
 * @param bytes - The bytes of the response from its start
 * @param metaint - The icy-metaint header of the response
 * @returns The bytes of the block (empty for a length of 0), or null while they have
 *   not all arrived
 */
export function icyBlockAt(bytes: Uint8Array, metaint: number): Uint8Array | null {
  if (bytes.length <= metaint) return null
  const end = metaint + 1 + bytes[metaint] * 16
  return bytes.length < end ? null : bytes.subarray(metaint + 1, end)
}

/**
 * The song in an ICY metadata block (StreamTitle='…';), decoded as UTF-8 or, failing
 * that, Windows-1252, and normalized (ADR 0068).
 *
 * @param block - The bytes of the block, NUL padding included
 */
export function songFromIcyBlock(block: Uint8Array): string | null {
  const text = decodeIcyText(block).replace(/\0+$/, '')
  const match = STREAM_TITLE.exec(text)
  return match ? normalizeSong(match[1]) : null
}
