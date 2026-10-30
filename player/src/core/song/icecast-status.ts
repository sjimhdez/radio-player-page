import { joinArtistTitle } from 'src/core/song/normalize'

/** The fields of a source (mount) of status-json.xsl the player reads */
interface IcecastSource {
  listenurl?: unknown
  title?: unknown
  artist?: unknown
}

/** The path of a URL, or null if it cannot be parsed */
function pathOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

/** The mounts of a parsed status-json.xsl: icestats.source is one object or a list */
function sourcesOf(status: unknown): IcecastSource[] {
  const source = (status as { icestats?: { source?: unknown } } | null)?.icestats?.source
  const list = Array.isArray(source) ? source : [source]
  return list.filter(
    (item): item is IcecastSource =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  )
}

/**
 * The current song in the body of an Icecast status-json.xsl (ADR 0068): from the
 * mount whose listenurl has the same path as the stream URL (host and port do not
 * count: Everestcast and AzuraCast change them); with a single mount, that one; with
 * several and none matching, none. The title is title, or artist + title when the
 * server sends them apart (AzuraCast).
 *
 * @returns The normalized song, or null (broken JSON included)
 */
export function songFromStatus(body: string, streamUrl: string): string | null {
  let status: unknown
  try {
    status = JSON.parse(body)
  } catch {
    return null
  }
  const sources = sourcesOf(status)
  const streamPath = pathOf(streamUrl)
  const source =
    sources.length === 1
      ? sources[0]
      : sources.find((item) => streamPath !== null && pathOf(item.listenurl) === streamPath)
  return source ? joinArtistTitle(source.artist, source.title) : null
}
