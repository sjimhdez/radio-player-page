// Spike 0007 harness: one <audio> and one function in window.spike per measurement.
// The tests call these through page.evaluate(); anything that must run inside a user gesture is
// armed with spike.armGesture(name, ...args) and fired by clicking #gesture.
// Media origins: same host, :8911 with CORS and :8912 without.
;(function () {
  const host = location.hostname
  const t0 = performance.now()
  const now = () => Math.round(performance.now() - t0)
  const MEDIA_EVENTS = ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled',
    'suspend', 'error', 'emptied', 'abort', 'ended']

  const s = {
    CORS: `http://${host}:8911`,
    NO_CORS: `http://${host}:8912`,
    audio: null,
    ctx: null,
    source: null,
    analyser: null,
    hls: null,
    dash: null,
    events: [],
    gestureResult: null,
  }

  function log(type, detail) {
    s.events.push({ t: now(), type, detail })
    const el = document.getElementById('log')
    if (el) el.textContent += `${now()} ${type}${detail === undefined ? '' : ' ' + JSON.stringify(detail)}\n`
  }

  // A fresh <audio>: createMediaElementSource() binds an element for life, so every case starts here.
  s.reset = function () {
    if (s.hls) { s.hls.destroy(); s.hls = null }
    if (s.dash) { s.dash.destroy(); s.dash = null }
    if (s.audio) { s.audio.pause(); s.audio.removeAttribute('src'); s.audio.load(); s.audio.remove() }
    if (s.ctx) s.ctx.close()
    s.ctx = s.source = s.analyser = null
    s.events = []
    s.gestureResult = null
    const audio = document.createElement('audio')
    audio.preload = 'none'
    for (const type of MEDIA_EVENTS) {
      audio.addEventListener(type, () => log(type, type === 'error' ? s.error() : undefined))
    }
    document.getElementById('slot').append(audio)
    s.audio = audio
    return s.state()
  }

  s.error = function () {
    const e = s.audio && s.audio.error
    return e ? { code: e.code, message: e.message } : null
  }

  s.state = function () {
    const a = s.audio
    const buffered = []
    for (let i = 0; i < a.buffered.length; i++) buffered.push([+a.buffered.start(i).toFixed(2), +a.buffered.end(i).toFixed(2)])
    return {
      t: now(), currentTime: +a.currentTime.toFixed(2), paused: a.paused, readyState: a.readyState,
      networkState: a.networkState, error: s.error(), crossOrigin: a.getAttribute('crossorigin'),
      src: a.currentSrc || a.getAttribute('src'), buffered, ctxState: s.ctx ? s.ctx.state : null,
    }
  }

  // play() as a string outcome, never a rejection.
  s.play = function () {
    return s.audio.play().then(() => 'ok', (e) => `${e.name}: ${e.message}`)
  }

  // Direct source. order 'before' sets crossOrigin before src; 'after' as player/src/core/audio/sources/direct.ts.
  s.loadDirect = function (url, { crossOrigin = true, order = 'after' } = {}) {
    const a = s.audio
    if (crossOrigin && order === 'before') a.crossOrigin = 'anonymous'
    a.src = url
    if (crossOrigin && order === 'after') a.crossOrigin = 'anonymous'
    log('loadDirect', { url, crossOrigin, order })
    return s.state()
  }

  // C1 candidate: same element, drop crossorigin and reload.
  s.retryWithoutCors = function () {
    s.audio.removeAttribute('crossorigin')
    s.audio.load()
    log('retryWithoutCors')
    return s.state()
  }

  // K18 candidate: set the same src again and reload (vs. a plain play() that resumes).
  s.reload = function () {
    const src = s.audio.getAttribute('src')
    s.audio.src = src
    s.audio.load()
    log('reload', { src })
    return s.state()
  }

  // Web Audio as the visualizer does: element -> analyser -> destination.
  s.connectAnalyser = function ({ fftSize = 2048 } = {}) {
    if (!s.ctx) s.ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (!s.source) {
      s.source = s.ctx.createMediaElementSource(s.audio)
      s.analyser = s.ctx.createAnalyser()
      s.analyser.fftSize = fftSize
      s.source.connect(s.analyser)
      s.analyser.connect(s.ctx.destination)
    }
    log('connectAnalyser', { ctxState: s.ctx.state })
    return s.ctx.state
  }

  s.createContext = function () {
    if (!s.ctx) s.ctx = new (window.AudioContext || window.webkitAudioContext)()
    log('createContext', { ctxState: s.ctx.state })
    return s.ctx.state
  }

  s.resumeContext = function () {
    if (!s.ctx) return Promise.resolve('no context')
    return s.ctx.resume().then(() => s.ctx.state, (e) => `${e.name}: ${e.message}`)
  }

  // RMS and peak of the analyser's time-domain data: zeros mean silence (or a tainted element).
  s.rms = function () {
    if (!s.analyser) return null
    const data = new Float32Array(s.analyser.fftSize)
    s.analyser.getFloatTimeDomainData(data)
    let sum = 0
    let peak = 0
    for (const v of data) { sum += v * v; peak = Math.max(peak, Math.abs(v)) }
    return { rms: +Math.sqrt(sum / data.length).toFixed(4), peak: +peak.toFixed(4) }
  }

  // Polls until currentTime advances by `delta` seconds (or `timeout` ms pass); samples RMS on the way.
  s.measure = function ({ delta = 1, timeout = 8000, every = 250 } = {}) {
    const start = s.audio.currentTime
    const began = now()
    const samples = []
    return new Promise((done) => {
      const tick = () => {
        const r = s.rms()
        if (r) samples.push({ t: now() - began, currentTime: +s.audio.currentTime.toFixed(2), ...r })
        const advanced = s.audio.currentTime - start
        if (advanced >= delta || s.audio.error || now() - began >= timeout) {
          const firstSignal = samples.find((x) => x.rms > 0)
          done({ advanced: +advanced.toFixed(2), ms: now() - began, state: s.state(), samples,
            maxRms: samples.length ? Math.max(...samples.map((x) => x.rms)) : null,
            firstSignalMs: firstSignal ? firstSignal.t : null })
          return
        }
        setTimeout(tick, every)
      }
      tick()
    })
  }

  s.loadHls = function (url, config = {}) {
    s.hls = new window.Hls(config)
    for (const ev of [window.Hls.Events.MANIFEST_PARSED, window.Hls.Events.ERROR]) {
      s.hls.on(ev, (_, data) => log(`hls:${ev}`, ev === window.Hls.Events.ERROR ? { type: data.type, details: data.details, fatal: data.fatal } : undefined))
    }
    s.hls.loadSource(url)
    s.hls.attachMedia(s.audio)
    return s.state()
  }

  // dashjs as player/src/core/audio/sources/dash.ts, optionally without the default UTC timing sources (K67).
  s.loadDash = function (url, { clearTimeSources = false, settings } = {}) {
    const d = window.dashjs.MediaPlayer().create()
    s.dash = d
    if (settings) d.updateSettings(settings)
    const E = window.dashjs.MediaPlayer.events
    d.on(E.ERROR, (e) => log('dash:error', { code: e.error && e.error.code, message: e.error && e.error.message }))
    d.on(E.PLAYBACK_STARTED, () => log('dash:playbackStarted'))
    d.on(E.MANIFEST_LOADED, () => log('dash:manifestLoaded'))
    if (clearTimeSources) d.clearDefaultUTCTimingSources()
    d.initialize(s.audio, url, true)
    log('loadDash', { url, clearTimeSources })
    return s.state()
  }

  s.dashInfo = function () {
    if (!s.dash) return null
    const safe = (fn) => { try { return fn() } catch (e) { return `${e.name}: ${e.message}` } }
    return { isDynamic: safe(() => s.dash.isDynamic()), liveLatency: safe(() => s.dash.getCurrentLiveLatency()),
      time: safe(() => s.dash.time()), duration: safe(() => s.dash.duration()) }
  }

  // Can a fetch tell "no CORS" from a 404? mode 'cors' fails on both without CORS; 'no-cors' gives an opaque response.
  s.probe = function (url, mode = 'cors') {
    const ctrl = new AbortController()
    const began = now()
    return fetch(url, { mode, signal: ctrl.signal, headers: mode === 'cors' ? { Range: 'bytes=0-0' } : undefined })
      .then((r) => { ctrl.abort(); return { ok: r.ok, status: r.status, type: r.type, ms: now() - began } },
        (e) => ({ error: `${e.name}: ${e.message}`, ms: now() - began }))
  }

  // Run spike[name](...args) inside the next click on #gesture (a real user activation).
  s.armGesture = function (name, ...args) {
    s.gestureResult = null
    document.getElementById('gesture').onclick = () => {
      log('gesture', { name })
      s.gestureResult = Promise.resolve(s[name](...args))
    }
  }

  window.spike = s
  document.addEventListener('DOMContentLoaded', () => { s.reset(); log('ready') })
})()
