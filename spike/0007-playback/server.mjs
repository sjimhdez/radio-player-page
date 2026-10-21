// Local servers for the spike of spec 0007, phase 0. No external requests.
//   :8910  page origin  -> harness.html, harness.js, manual.html, /vendor/hls.js, /vendor/dash.js
//   :8911  media origin WITH    Access-Control-Allow-Origin: *
//   :8912  media origin WITHOUT CORS headers
// Media origins serve tests/fixtures/audio/ (not copied) plus:
//   /live.mp3              endless, Icecast-like (tone.mp3 in a loop, no length, no Range)
//   /404.mp3               404
//   /live.mpd              dynamic DASH (live) built from the fixture segments, WITHOUT <UTCTiming>
//   /live/seg-<t>.m4s      fixture segment for time t, with tfdt/sidx rewritten to t
//   ?exposeDate=1          on any route: adds Date to Access-Control-Expose-Headers (CORS origin only)
//   GET|DELETE /__requests requests by path (with query) of that origin; DELETE resets
// Listens on all interfaces so that an iPhone on the local network can open manual.html.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const audioDir = path.resolve(here, '../../tests/fixtures/audio')
const nodeModules = path.resolve(here, '../../player/node_modules')
const vendor = {
  '/vendor/hls.js': path.join(nodeModules, 'hls.js/dist/hls.min.js'),
  '/vendor/dash.js': path.join(nodeModules, 'dashjs/dist/modern/umd/dash.all.min.js'),
}
const pages = ['/harness.html', '/harness.js', '/manual.html']
const types = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.mpd': 'application/dash+xml', '.m4s': 'video/iso.segment', '.js': 'text/javascript', '.html': 'text/html; charset=utf-8' }

export const PAGE_PORT = 8910
export const MEDIA_PORT = 8911
export const MEDIA_NOCORS_PORT = 8912

// --- Live DASH -----------------------------------------------------------------------------
// The 4 fixture segments (8 s of AAC, timescale 44100) loop forever. Their tfdt are 0, 89088,
// 178176 and 267264, so one loop is 352800 (8 s). AST is 60 s before the server started, so the
// whole time-shift window is available from the first request.
const TIMESCALE = 44100
const LOOP = 352800
const SEG_T = [0, 89088, 178176, 267264]
const SEG_D = [89088, 89088, 89088, LOOP - 267264]
const WINDOW_S = 30
const ast = Math.floor(Date.now() / 1000) * 1000 - 60_000

function liveMpd() {
  const now = Date.now()
  const elapsed = Math.floor(((now - ast) / 1000) * TIMESCALE)
  const from = elapsed - WINDOW_S * TIMESCALE
  const s = []
  for (let k = Math.max(0, Math.floor(from / LOOP)); k * LOOP < elapsed; k++) {
    for (let i = 0; i < 4; i++) {
      const t = k * LOOP + SEG_T[i]
      if (t >= from && t + SEG_D[i] <= elapsed) s.push(`<S t="${t}" d="${SEG_D[i]}" />`)
    }
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-live:2011" type="dynamic"
  availabilityStartTime="${new Date(ast).toISOString()}" publishTime="${new Date(now).toISOString()}"
  minimumUpdatePeriod="PT2S" timeShiftBufferDepth="PT${WINDOW_S}S" suggestedPresentationDelay="PT6S"
  maxSegmentDuration="PT3S" minBufferTime="PT4S">
  <Period id="0" start="PT0S">
    <AdaptationSet id="0" contentType="audio" segmentAlignment="true">
      <Representation id="0" mimeType="audio/mp4" codecs="mp4a.40.2" bandwidth="64000" audioSamplingRate="44100">
        <SegmentTemplate timescale="${TIMESCALE}" initialization="dash/init-0.m4s" media="live/seg-$Time$.m4s">
          <SegmentTimeline>${s.join('')}</SegmentTimeline>
        </SegmentTemplate>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>
`
}

// Fixture segment for time t, with the decode time of tfdt and the presentation time of sidx set to t.
function liveSegment(t) {
  const k = Math.floor(t / LOOP)
  const i = SEG_T.indexOf(t - k * LOOP)
  if (!Number.isSafeInteger(t) || t < 0 || i < 0) return null
  const data = Buffer.from(fs.readFileSync(path.join(audioDir, `dash/seg-0-00${i + 1}.m4s`)))
  const tfdt = data.indexOf('tfdt')
  if (data[tfdt + 4] === 1) data.writeBigUInt64BE(BigInt(t), tfdt + 8)
  else data.writeUInt32BE(t, tfdt + 8)
  const sidx = data.indexOf('sidx')
  if (sidx >= 0) {
    // version(1) flags(3) reference_ID(4) timescale(4) earliest_presentation_time(4|8)
    if (data[sidx + 4] === 1) data.writeBigUInt64BE(BigInt(t), sidx + 16)
    else data.writeUInt32BE(t, sidx + 16)
  }
  return data
}

// --- Media origins -------------------------------------------------------------------------
function corsHeaders(cors, exposeDate) {
  if (!cors) return {}
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': `Accept-Ranges, Content-Length, Content-Range${exposeDate ? ', Date' : ''}` }
}

function notFound(res, headers = {}) { res.writeHead(404, headers); res.end() }

// Sends a file under `root` (or exactly `root`), honouring a single `Range: bytes=` request.
function sendFile(req, res, file, headers, root) {
  if (file !== root && !file.startsWith(root + path.sep)) return notFound(res, headers)
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound(res, headers)
  const size = fs.statSync(file).size
  const base = { ...headers, 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  let start = 0
  let end = size - 1
  let status = 200
  if (range && (range[1] || range[2])) {
    if (range[1]) { start = Number(range[1]); if (range[2]) end = Math.min(Number(range[2]), end) }
    else start = Math.max(size - Number(range[2]), 0)
    if (start >= size || start > end) { res.writeHead(416, { ...base, 'Content-Range': `bytes */${size}` }); return res.end() }
    status = 206
    base['Content-Range'] = `bytes ${start}-${end}/${size}`
  }
  res.writeHead(status, { ...base, 'Content-Length': end - start + 1 })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file, { start, end }).pipe(res)
}

// tone.mp3 is 64 kbps (8 KB/s): 8 KB every 500 ms is twice real time, which keeps the buffer ahead.
function sendLive(res, headers) {
  const data = fs.readFileSync(path.join(audioDir, 'tone.mp3'))
  res.writeHead(200, { ...headers, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache, no-store' })
  let offset = 0
  const write = () => {
    const end = Math.min(offset + 8 * 1024, data.length)
    res.write(data.subarray(offset, end))
    offset = end >= data.length ? 0 : end
  }
  write()
  const timer = setInterval(write, 500)
  res.on('close', () => clearInterval(timer))
}

function mediaServer(cors) {
  let requests = {}
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const headers = corsHeaders(cors, url.searchParams.get('exposeDate') === '1')
    if (url.pathname === '/__requests') {
      if (req.method === 'DELETE') requests = {}
      res.writeHead(200, { ...corsHeaders(true, false), 'Content-Type': 'application/json' })
      return res.end(JSON.stringify(requests))
    }
    if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end() }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end() }
    const key = url.pathname + url.search
    requests[key] = (requests[key] || 0) + 1

    if (url.pathname === '/live.mp3') return sendLive(res, headers)
    if (url.pathname === '/404.mp3') return notFound(res, headers)
    if (url.pathname === '/live.mpd') {
      res.writeHead(200, { ...headers, 'Content-Type': types['.mpd'], 'Cache-Control': 'no-cache, no-store' })
      return res.end(req.method === 'HEAD' ? undefined : liveMpd())
    }
    const seg = /^\/live\/seg-(\d+)\.m4s$/.exec(url.pathname)
    if (seg) {
      const data = liveSegment(Number(seg[1]))
      if (!data) return notFound(res, headers)
      res.writeHead(200, { ...headers, 'Content-Type': types['.m4s'], 'Content-Length': data.length })
      return res.end(req.method === 'HEAD' ? undefined : data)
    }
    let decoded
    try { decoded = decodeURIComponent(url.pathname) } catch { return notFound(res, headers) }
    sendFile(req, res, path.resolve(audioDir, `.${decoded}`), headers, audioDir)
  })
}

function pageServer() {
  return http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://x')
    if (pathname === '/') return sendFile(req, res, path.join(here, 'harness.html'), { 'Cache-Control': 'no-store' }, here)
    if (pages.includes(pathname)) return sendFile(req, res, path.join(here, pathname.slice(1)), { 'Cache-Control': 'no-store' }, here)
    if (vendor[pathname]) return sendFile(req, res, vendor[pathname], {}, vendor[pathname])
    notFound(res)
  })
}

for (const [server, port, name] of [[pageServer(), PAGE_PORT, 'page'], [mediaServer(true), MEDIA_PORT, 'media with CORS'],
  [mediaServer(false), MEDIA_NOCORS_PORT, 'media without CORS']]) {
  server.listen(port, () => console.log(`${name} on :${port}`))
}
