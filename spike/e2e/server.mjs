// Local test servers for R3. No external requests.
//   :8900  page origin  -> harness page + player/dist (the real build)
//   :8901  media origin WITH    Access-Control-Allow-Origin: *
//   :8902  media origin WITHOUT CORS headers
// Media routes: /tone.mp3 (progressive, Range), /live.mp3 (infinite, no length), /hls/*, /dash/*
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.resolve(here, '../../player/dist')
const media = path.join(here, 'media')
const types = { '.mp3': 'audio/mpeg', '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
  '.mpd': 'application/dash+xml', '.m4s': 'video/iso.segment', '.mp4': 'audio/mp4',
  '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html' }

function sendFile(req, res, file, headers) {
  if (!file.startsWith(media) && !file.startsWith(dist)) return notFound(res)
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return notFound(res)
  const size = fs.statSync(file).size
  const type = types[path.extname(file)] || 'application/octet-stream'
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '')
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Number(range[2]) : size - 1
    res.writeHead(206, { ...headers, 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 })
    return fs.createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...headers, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size })
  fs.createReadStream(file).pipe(res)
}

function notFound(res) { res.writeHead(404); res.end() }

// Icecast-like endless MP3: loops tone.mp3 forever, no Content-Length, no Range.
function sendLive(res, headers) {
  const data = fs.readFileSync(path.join(media, 'tone.mp3'))
  res.writeHead(200, { ...headers, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' })
  let offset = 0
  const chunk = 16 * 1024 // ~1 s at 128 kbps
  const timer = setInterval(() => {
    const end = Math.min(offset + chunk, data.length)
    res.write(data.subarray(offset, end))
    offset = end >= data.length ? 0 : end
  }, 500) // ~2x real time: keeps the buffer ahead
  res.on('close', () => clearInterval(timer))
}

function mediaServer(port, cors) {
  const headers = cors ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range' } : {}
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (req.method === 'OPTIONS') { res.writeHead(204, headers); return res.end() }
    if (url.pathname === '/live.mp3') return sendLive(res, headers)
    sendFile(req, res, path.join(media, path.normalize(url.pathname)), headers)
  }).listen(port, () => console.log(`media ${cors ? 'with' : 'without'} CORS on :${port}`))
}

function pageServer(port) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'))
  const entry = manifest['src/main.tsx']
  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/') {
      // Same globals and markup as radplapag_output_clean_page(), minus WordPress.
      const config = { streamUrl: url.searchParams.get('stream'), siteTitle: 'Spike Radio',
        backgroundImage: null, logoImage: null, introAudioUrl: url.searchParams.get('intro'),
        themeColor: 'neutral', visualizer: url.searchParams.get('visualizer') || 'oscilloscope', timezoneOffset: 0 }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end(`<!DOCTYPE html><html lang="en-US"><head><meta charset="utf-8"><title>Spike</title>` +
        `<script>window.RADPLAPAG_CONFIG = ${JSON.stringify(config)};window.RADPLAPAG_PROGRAMS = [];window.RADPLAPAG_SCHEDULE = {};</script>` +
        (entry.css ? `<link rel="stylesheet" href="/dist/${entry.css[0]}">` : '') +
        `</head><body><div id="root"></div><script type="module" src="/dist/${entry.file}"></script></body></html>`)
    }
    if (url.pathname.startsWith('/dist/')) return sendFile(req, res, path.join(dist, path.normalize(url.pathname.slice(6))), {})
    notFound(res)
  }).listen(port, () => console.log(`page on :${port}`))
}

pageServer(8900)
mediaServer(8901, true)
mediaServer(8902, false)
