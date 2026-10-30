/** The longest song the player shows, in characters (ADR 0068) */
export const MAX_SONG_LENGTH = 200

/** What servers send when they have no song: nothing, a lone hyphen or "Unknown" */
const NO_SONG = new Set(['', '-', 'unknown'])

/** Whether a character is a C0 or C1 control character, or DEL */
const isControl = (char: string): boolean => {
  const code = char.codePointAt(0) ?? 0
  return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

/**
 * The song as the player shows it, or null when there is none (ADR 0068): without
 * control characters, trimmed, with single spaces and cut to MAX_SONG_LENGTH characters.
 * Empty, "-" or "Unknown" (any case) is no song. Ads and news are not filtered.
 *
 * @param raw - The title the server sent; anything that is not a string is no song
 */
export function normalizeSong(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const clean = Array.from(raw, (char) => (isControl(char) ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  const song = Array.from(clean).slice(0, MAX_SONG_LENGTH).join('').trimEnd()
  return NO_SONG.has(song.toLowerCase()) ? null : song
}

/**
 * Artist and title sent apart (AzuraCast, ID3 TPE1 and TIT2) as one song, joined with
 * " - " as servers already send them (ADR 0068); either one alone if the other is
 * missing.
 */
export function joinArtistTitle(artist: unknown, title: unknown): string | null {
  const parts = [normalizeSong(artist), normalizeSong(title)].filter((part) => part !== null)
  return normalizeSong(parts.join(' - '))
}

/**
 * The text of an ICY metadata block: UTF-8 and, if the bytes are not valid UTF-8,
 * Windows-1252, which older encoders send (ADR 0068).
 */
export function decodeIcyText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
